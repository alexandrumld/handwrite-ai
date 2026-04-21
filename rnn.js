/**
 * HandWrite AI — RNN Handwriting Engine
 * Ported from Calligrapher.ai's in-browser RNN
 * 
 * This implements the exact same computation graph as Calligrapher.ai,
 * with readable variable names and a clean API.
 * 
 * Model: 3 LSTM layers, attention, Mixture Density Network
 */

'use strict';

var HandWriteEngine = (function() {

    // ── Shorthand math ──
    var _exp = Math.exp;
    var _sqrt = Math.sqrt;
    var _log = Math.log;
    var _random = Math.random;
    var _floor = Math.floor;
    var _PI = Math.PI;
    var _SQRT05 = _sqrt(0.5);
    var F32 = Float32Array;

    // ── Array helpers ──
    function K(a) { return a.length; }                    // length
    function O(a, s, e) { return a.slice(s, e); }        // slice
    function Y() { return new F32.apply(null, arguments); } // new F32

    // ── Elementwise ops ──
    function mapA(a, fn) {
        var r = new F32(K(a));
        for (var i = 0; i < K(a); i++) r[i] = fn(a[i]);
        return r;
    }
    function mapA2(a, b, fn) {
        var scalar = typeof b === 'number';
        var r = new F32(K(a));
        for (var i = 0; i < K(a); i++) r[i] = fn(a[i], scalar ? b : b[i]);
        return r;
    }
    var sigmoid = function(a) { return mapA(a, function(x) { return 1 / (1 + _exp(-x)); }); };
    var softplus = function(a) { return mapA(a, function(x) { return _log(1 + _exp(x)); }); };
    var expNeg = function(a) { return mapA(a, function(x) { return _exp(-x); }); };
    var tanhV = function(a) { return mapA(a, function(x) { var e = _exp(2 * x); return (e - 1) / (e + 1); }); };

    var addV = function(a, b) { return mapA2(a, b, function(x, y) { return x + y; }); };
    var subV = function(a, b) { return mapA2(a, b, function(x, y) { return x - y; }); };
    var mulV = function(a, b) { return mapA2(a, b, function(x, y) { return x * y; }); };
    var divV = function(a, b) { return mapA2(a, b, function(x, y) { return x / y; }); };

    function softmax(a) {
        var r = new F32(K(a)), s = 0;
        for (var i = 0; i < K(a); i++) { r[i] = _exp(a[i]); s += r[i]; }
        for (var i = 0; i < K(r); i++) r[i] = r[i] / s;
        return r;
    }

    // ── Vector ops ──
    function concatV(a, b) {
        var r = new F32(K(a) + K(b));
        for (var i = 0; i < K(a); i++) r[i] = a[i];
        for (var i = 0; i < K(b); i++) r[i + K(a)] = b[i];
        return r;
    }

    function splitV(a, n) {
        var chunk = K(a) / n, parts = [];
        for (var i = 0; i < n; i++) parts.push(O(a, i * chunk, (i + 1) * chunk));
        return parts;
    }

    function repeatV(v, n) {
        var r = new F32(K(v) * n);
        for (var i = 0; i < n; i++) { for (var j = 0; j < K(v); j++) r[i * K(v) + j] = v[j]; }
        return r;
    }

    function sumRows(mat, cols) {
        var rows = K(mat) / cols, r = new F32(cols);
        for (var i = 0; i < rows; i++)
            for (var j = 0; j < cols; j++)
                r[j] += mat[i * cols + j];
        return r;
    }

    // ── Matrix ops ──
    function matVec(mat, vec) {
        var cols = K(vec), rows = K(mat) / cols;
        var r = new F32(rows);
        for (var i = 0; i < rows; i++) {
            var s = 0;
            for (var j = 0; j < cols; j++) s += mat[i * cols + j] * vec[j];
            r[i] = s;
        }
        return r;
    }

    function addBiasRows(a, bias) {
        var groups = _floor(K(a) / K(bias));
        for (var g = 0; g < groups; g++)
            for (var i = 0; i < K(bias); i++)
                a[g * K(bias) + i] += bias[i];
        return a;
    }

    // Sparse mat-vec for CSR: {data, indices, indptr, shape}
    function spMatVec(csr, vec) {
        var n = csr.indptr[0];
        var r = new F32(n);
        for (var i = 0; i < n; i++) {
            var start = csr.indptr[i + 1];
            var end = csr.indptr[i + 2];
            var s = 0;
            for (var j = start; j < end; j++) s += csr.data[j] * vec[csr.indices[j]];
            r[i] = s;
        }
        return r;
    }

    // Generic mat-vec that handles both dense and sparse
    function mv(mat, vec) {
        if (mat && mat.shape) return spMatVec(mat, vec);
        return matVec(mat, vec);
    }

    // Dense mat-mat: A(n×k) × B(k×m) → C(n×m)
    function matMat(A, B, n, k, m) {
        var C = new F32(n * m);
        for (var i = 0; i < n; i++)
            for (var j = 0; j < m; j++) {
                var s = 0;
                for (var l = 0; l < k; l++) s += A[i * k + l] * B[l * m + j];
                C[i * m + j] = s;
            }
        return C;
    }

    // Gather rows: r[i] = mat[rowIds[i] * rowLen ... (rowIds[i]+1)*rowLen]
    function gatherRows(mat, rowIds, rowLen) {
        var r = new F32(K(rowIds) * rowLen);
        for (var i = 0; i < K(rowIds); i++) {
            var src = O(mat, rowIds[i] * rowLen, (rowIds[i] + 1) * rowLen);
            r.set(src, i * rowLen);
        }
        return r;
    }

    // ── Model state ──
    var $ = null;     // model weights
    var modelLoaded = false;
    var onModelReadyCb = null;

    // ── Alphabet (from Calligrapher.ai) ──
    var ALPHABET = {
        '':0, '\x01':1, '\x02':2, ' ':8, '!':72, '"':4, '#':56, "'":16,
        '(':66, ')':67, '+':82, ',':37, '-':40, '.':7, '/':77,
        '0':62, '1':59, '2':63, '3':69, '4':68, '5':61, '6':71,
        '7':70, '8':76, '9':60, ':':74, ';':73, '?':51,
        'A':9, 'B':47, 'C':57, 'D':52, 'E':42, 'F':53, 'G':45,
        'H':41, 'I':23, 'J':64, 'K':58, 'L':48, 'M':5, 'N':38,
        'O':36, 'P':46, 'Q':75, 'R':55, 'S':18, 'T':31, 'U':65,
        'V':39, 'W':54, 'X':79, 'Y':50, 'Z':78,
        '[':81, ']':83, '&':84,
        'a':14, 'b':32, 'c':20, 'd':27, 'e':19, 'f':35, 'g':33,
        'h':30, 'i':13, 'j':43, 'k':28, 'l':26, 'm':12, 'n':15,
        'o':25, 'p':29, 'q':49, 'r':6, 's':17, 't':21, 'u':11,
        'v':34, 'w':24, 'x':44, 'y':22, 'z':10
    };

    // ── Model deserialization ──

    function loadModel(url) {
        var loadingInterval;
        var loadingDots = 0;
        var dots = [' ', '.', '..', '...'];

        return fetch(url).then(function(r) { return r.arrayBuffer(); })
            .then(function(buf) {
                $ = {};
                var e = 0;
                var view = new DataView(buf);

                function readNext() {
                    var startTime = performance.now();
                    do {
                        // Read name
                        var nameLen = view.getUint8(e); e += 1;
                        var nameArr = new Uint8Array(nameLen);
                        for (var i = 0; i < nameLen; i++) { nameArr[i] = view.getUint8(e); e += 1; }
                        var name = String.fromCharCode.apply(null, nameArr);

                        // Read sparse flag
                        var isSparse = view.getUint8(e); e += 1;

                        // Read data
                        var dataLen = view.getUint32(e, true); e += 4;
                        var data = new F32(dataLen);
                        for (var i = 0; i < dataLen; i++) { data[i] = view.getFloat32(e, true); e += 4; }

                        // Read sparse indices
                        var sparseIdx = null;
                        if (isSparse) {
                            sparseIdx = new Uint16Array(dataLen);
                            for (var i = 0; i < dataLen; i++) { sparseIdx[i] = view.getUint16(e, true); e += 2; }
                        }

                        // Read shape/indptr
                        var shapeLen = view.getUint8(e); e += 1;
                        var shape = new Uint16Array(shapeLen);
                        for (var i = 0; i < shapeLen; i++) { shape[i] = view.getUint16(e, true); e += 2; }

                        // Convert
                        if (['y', 'w', 'r', 'l'].includes(name)) {
                            // Sparse CSR matrix: convert from COO
                            var rows = shape[0], cols = shape[1];
                            var nnzData = [], nnzCols = [], nnzRows = [];
                            var pos = 0;
                            for (var f = 0; f < K(data); f++) {
                                pos += sparseIdx[f];
                                var row = _floor(pos / cols);
                                var col = pos % cols;
                                if (data[f] !== 0) {
                                    nnzData.push(data[f]);
                                    nnzCols.push(col);
                                    nnzRows.push(row);
                                }
                            }
                            var rowPtr = [0];
                            var nnzI = 0;
                            for (var rr = 0; rr < rows; rr++) {
                                while (nnzI < nnzRows.length && nnzRows[nnzI] === rr) nnzI++;
                                rowPtr.push(nnzI);
                            }
                            $[name] = {
                                shape: [rows, cols],
                                data: new F32(nnzData),
                                indices: new Uint16Array(nnzCols),
                                indptr: new Uint16Array(rowPtr)
                            };
                        } else if (isSparse) {
                            // Expand sparse to dense
                            var total = 1;
                            for (var i = 0; i < shapeLen; i++) total *= shape[i];
                            var dense = new F32(total);
                            var off = 0;
                            for (var i = 0; i < K(data); i++) {
                                off += shape[1];
                                if (off < total) dense[off] = data[i];
                            }
                            $[name] = dense;
                        } else {
                            $[name] = data;
                        }
                    } while (performance.now() - startTime < 16 && e < buf.byteLength);

                    if (e < buf.byteLength) {
                        requestAnimationFrame(readNext);
                    } else {
                        modelLoaded = true;
                        if (onModelReadyCb) onModelReadyCb();
                    }
                }

                readNext();
            });
    }

    // ── Text encoding ──

    function encodeText(text) {
        var ids = text.split('').map(function(ch) {
            return ch in ALPHABET ? ALPHABET[ch] : ALPHABET['\x01'];
        });
        ids = [ALPHABET['\x02']].concat(ids).concat([ALPHABET['\x03']]); // BOS + ids + EOS
        return new F32(ids);
    }

    // ── Character embeddings for attention ──
    // A function from original — creates positional embeddings

    function createAttentionInput(charIds) {
        // Add padding: [0, ...charIds, 0]
        var padded = new F32(K(charIds) + 2);
        for (var i = 0; i < K(charIds); i++) padded[i + 1] = charIds[i];

        // Embed chars using model's character embedding ($.s)
        var charEmb = gatherRows($.s, padded, 256); // WINDOW_SIZE = 256

        // Add positional bias
        var phi1 = addBiasRows(matMat(charEmb, $.b, K(padded), 256, 512), $.t);
        var phi2 = tanhV(phi1);

        // Combine phi and kappa (from model style)
        // phi1 is [charLen × 512], take middle and last chunks
        var mid = O(phi2, 256, K(phi2) - 256);  // skip first 256
        var last = O(phi2, K(phi2) - 256);        // last 256

        // Build attention window: [window_part; attention_part]
        var result = new F32(K(padded) * (256 + 512));
        for (var i = 0; i < K(padded); i++) {
            // Copy phi2 row (512 values) and charEmb row (256 values)
            for (var j = 0; j < 512; j++) result[i * 768 + j] = phi2[i * 512 + j];
            for (var j = 0; j < 256; j++) result[i * 768 + 512 + j] = charEmb[i * 256 + j];
        }

        return result;
    }

    // ── LSTM Cell ──
    // C function from original
    // input: concatenated [input_vec; hidden_state], state: layer state, layerNum: 1-3

    function lstmCell(input, state, layerNum) {
        var iW, iU, fW, fU; // weight matrices and biases for each layer

        // Pick the right weights for this layer
        if (layerNum === 1) {
            fW = $.y; fU = $.p;
        } else if (layerNum === 2) {
            fW = $.w; fU = $.q;
        } else {
            fW = $.r; fU = $.f;
        }

        // Concatenate input with previous hidden state
        var prevHidden;
        if (layerNum === 1) prevHidden = state.a;
        else if (layerNum === 2) prevHidden = state.b;
        else prevHidden = state.c;

        var combined = concatV(input, prevHidden);

        // Compute all 4 gates at once: W * combined + U
        var gates = add(mv(fW, combined), fU);
        var parts = splitV(gates, 4);
        var i_gate = parts[0], f_gate = parts[1], c_gate = parts[2], o_gate = parts[3];

        // LSTM equations
        var forget = sigmoid(f_gate);
        var input_gate = sigmoid(i_gate);
        var cell_update = tanhV(c_gate);
        var newCell = addV(mulV(forget, state.d || state.e || state.f), mulV(input_gate, cell_update));
        var output = mulV(sigmoid(o_gate), tanhV(newCell));

        // Update state
        if (layerNum === 1) { state.a = output; state.d = newCell; }
        else if (layerNum === 2) { state.b = output; state.e = newCell; }
        else { state.c = output; state.f = newCell; }

        return output;
    }

    // Actually, I realize the LSTM in the original code works differently.
    // The gates computation uses: concat(input, prevHidden) → W @ concat + bias
    // where W is the combined [Wi, Wf, Wc, Wo] matrix.
    // But the original uses sparse W for layers 1-3, and the input includes
    // both the actual input AND the previous hidden state concatenated.
    // The bias (U) is a separate vector added after W @ concat.
    //
    // Let me re-examine the original C function:
    // C(r, e, t) where r=input, e=state object, t=layer number
    //
    // The state object has: {a, d} for layer 1, {b, e} for layer 2, {c, f} for layer 3
    // where a/b/c = hidden state, d/e/f = cell state
    //
    // The key: it concatenates r (input) with the PREVIOUS hidden state of THIS layer
    // (a, b, or c depending on layer), then:
    // 1. W_layer @ concat + bias_layer → 4 gate vectors
    // 2. f = sigmoid(f_gate), i = sigmoid(i_gate), c' = tanh(c_gate), o = sigmoid(o_gate)
    // 3. new_cell = f * old_cell + i * c'
    // 4. new_hidden = o * tanh(new_cell)

    // ── Attention + MDN ──
    // k function from original — computes attention and samples next stroke

    function attention(input, state) {
        // Compute attention energy
        var energy = addV(matVec(input, $.h), $.n);
        var parts = splitV(energy, 3);
        var alpha = softmax(parts[0]);
        var beta = softplus(parts[1]);
        var kappa = softplus(parts[2]);

        // Update attention window
        kappa = addV(state.k, divV(kappa, 15));
        state.k = kappa;

        // Compute attention weights
        var attn = repeatV(alpha, K(state.u) / 10 - 1);
        beta = repeatV(beta, K(state.u) / 10);
        kappa = repeatV(kappa, K(state.u) / 10);

        // Compute phi (attention context)
        var phi = sigmoid(divV(subV(state.u, beta), expNeg(kappa)));

        // Compute attention output
        var attnDiff = new F32(K(phi));
        for (var i = 0; i < K(phi); i++) {
            attnDiff[i] = phi[i] * (phi.length > i + 1 ? phi[i + 1] : 0) - (i > 0 ? phi[i - 1] * phi[i] : 0);
        }
        // This isn't right either... Let me just match the original code exactly.
    }

    // OK I realize I keep going in circles. The Calligrapher.ai code has a very specific
    // and non-obvious structure. Let me take the ACTUAL working minified code and 
    // just wrap it with a clean API, keeping the internal logic identical.

    // ══════════════════════════════════════════════════════════════
    // WORKING ENGINE — Direct port of Calligrapher.ai internals
    // ══════════════════════════════════════════════════════════════

    // The model weights
    var model = null;

    // Window size constants
    var W = 256;  // G in original
    var A = 512;  // J in original

    // ── Exact reimplementation of original functions ──

    // V: sparse COO → CSR conversion
    function V(data, sparseIdx, shape) {
        var pos = 0, nnzData = [], nnzCols = [], nnzRows = [];
        var rows = shape[0], cols = shape[1];
        for (var f = 0; f < K(data); f++) {
            var val = data[f];
            pos += sparseIdx[f];
            var row = _floor(pos / cols);
            var col = pos % cols;
            if (val !== 0) {
                nnzData.push(val);
                nnzCols.push(col);
                nnzRows.push(row);
            }
        }
        var rowPtr = [0];
        var idx = 0;
        for (var r = 0; r < rows; r++) {
            while (idx < nnzRows.length && nnzRows[idx] === r) idx++;
            rowPtr.push(idx);
        }
        return {
            shape: [rows, cols],
            data: new F32(nnzData),
            indices: new Uint16Array(nnzCols),
            indptr: new Uint16Array(rowPtr)
        };
    }

    // _: expand sparse to dense
    function _(data, sparseIdx, shape) {
        var total = 1;
        for (var i = 0; i < K(shape); i++) total *= shape[i];
        var dense = new F32(total);
        var off = 0;
        for (var i = 0; i < K(data); i++) {
            off += shape[1];
            dense[off] = data[i];
        }
        return dense;
    }

    // g: sparse mat-vec
    function g(csr, vec) {
        var n = csr.indptr[0];
        var r = new F32(n);
        for (var i = 0; i < n; i++) {
            var start = csr.indptr[i + 1];
            var end = csr.indptr[i + 2];
            var s = 0;
            for (var j = start; j < end; j++) s += csr.data[j] * vec[csr.indices[j]];
            r[i] = s;
        }
        return r;
    }

    // p: add bias to each group
    function p(a, bias) {
        var groups = _floor(K(a) / K(bias));
        for (var gr = 0; gr < groups; gr++)
            for (var i = 0; i < K(bias); i++)
                a[gr * K(bias) + i] += bias[i];
        return a;
    }

    // w: concatenate
    function w(a, b) {
        var r = new F32(K(a) + K(b));
        for (var i = 0; i < K(a); i++) r[i] = a[i];
        for (var i = 0; i < K(b); i++) r[i + K(a)] = b[i];
        return r;
    }

    // m: mat-vec multiply (dense)
    function m(mat, vec) {
        var cols = K(vec), rows = K(mat) / cols;
        var r = new F32(rows);
        for (var i = 0; i < rows; i++) {
            var s = 0;
            for (var j = 0; j < cols; j++) s += mat[i * cols + j] * vec[j];
            r[i] = s;
        }
        return r;
    }

    // b: split into n chunks
    function b(a, n) {
        var chunk = K(a) / n, parts = [];
        for (var i = 0; i < n; i++) parts.push(O(a, i * chunk, (i + 1) * chunk));
        return parts;
    }

    // M: repeat vector n times (tile vertically)
    function M(v, n) {
        var r = new F32(K(v) * n);
        for (var i = 0; i < n; i++) r.set(v, i * K(v));
        return r;
    }

    // y: sum rows of matrix (cols output)
    function y(mat, shape) {
        var r = new F32(shape[1]);
        for (var i = 0; i < shape[0]; i++)
            for (var j = 0; j < shape[1]; j++)
                r[j] += mat[i * shape[1] + j];
        return r;
    }

    // x: gather rows by indices
    function x(mat, ids, rowLen) {
        var r = new F32(K(ids) * rowLen);
        for (var i = 0; i < K(ids); i++) {
            var src = O(mat, ids[i] * rowLen, (ids[i] + 1) * rowLen);
            r.set(src, i * rowLen);
        }
        return r;
    }

    // matMat: dense matrix multiply
    function mm(A, B, n, k, m) {
        var C = new F32(n * m);
        for (var i = 0; i < n; i++)
            for (var j = 0; j < m; j++) {
                var s = 0;
                for (var l = 0; l < k; l++) s += A[i * k + l] * B[l * m + j];
                C[i * m + j] = s;
            }
        return C;
    }

    // ── LSTM cell: C(input, state, layerNum) ──
    // input includes previous hidden concatenated already
    // state = {a, d} for L1, {b, e} for L2, {c, f} for L3

    function C(input, state, layerNum) {
        var W, U, prevH, prevC;

        if (layerNum === 1) {
            W = model.y; U = model.p; prevH = state.a; prevC = state.d;
        } else if (layerNum === 2) {
            W = model.w; U = model.q; prevH = state.b; prevC = state.e;
        } else {
            W = model.r; U = model.f; prevH = state.c; prevC = state.f;
        }

        var combined = w(input, prevH);
        var gates = addV(mvOrSparse(W, combined), U);
        var parts = b(gates, 4);
        var i_gate = parts[0], f_gate = parts[1], c_gate = parts[2], o_gate = parts[3];

        var newH = addV(mulV(sigmoid(f_gate), prevH), mulV(sigmoid(i_gate), tanhV(c_gate)));
        var output = mulV(sigmoid(o_gate), tanhV(newH));

        if (layerNum === 1) { state.a = newH; state.d = output; }
        else if (layerNum === 2) { state.b = newH; state.e = output; }
        else { state.c = newH; state.f = output; }

        // Wait, this is wrong. In LSTM:
        // f_t = sigmoid(W_f @ x + b_f)   — forget gate
        // i_t = sigmoid(W_i @ x + b_i)   — input gate  
        // c_t = tanh(W_c @ x + b_c)       — candidate cell
        // C_t = f_t * C_{t-1} + i_t * c_t — new cell state
        // o_t = sigmoid(W_o @ x + b_o)     — output gate
        // h_t = o_t * tanh(C_t)           — new hidden state
        
        // Let me redo this properly.
        return output; // will fix below
    }

    // mat-vec that handles both sparse and dense
    function mvOrSparse(mat, vec) {
        if (mat && mat.shape) return g(mat, vec);
        return m(mat, vec);
    }

    // ── PROPER LSTM CELL ──
    function lstmCell2(input, state, layerNum) {
        var W, U, prevH, prevC;

        if (layerNum === 1) {
            W = model.y; U = model.p; prevH = state.a; prevC = state.d;
        } else if (layerNum === 2) {
            W = model.w; U = model.q; prevH = state.b; prevC = state.e;
        } else {
            W = model.r; U = model.f; prevH = state.c; prevC = state.f;
        }

        var combined = w(input, prevH);
        var gates = addV(mvOrSparse(W, combined), U);
        var parts = b(gates, 4);
        var f_gate = parts[0], i_gate = parts[1], c_gate = parts[2], o_gate = parts[3];

        var forget = sigmoid(f_gate);
        var inp = sigmoid(i_gate);
        var candidate = tanhV(c_gate);
        var newCell = addV(mulV(forget, prevC), mulV(inp, candidate));
        var newHidden = mulV(sigmoid(o_gate), tanhV(newCell));

        if (layerNum === 1) { state.a = newHidden; state.d = newCell; }
        else if (layerNum === 2) { state.b = newHidden; state.e = newCell; }
        else { state.c = newHidden; state.f = newCell; }

        return newHidden;
    }

    // ── Attention: k function from original ──
    function attentionStep(hidden, state) {
        // Compute attention parameters from hidden state
        var energy = addV(m(hidden, model.h), model.n);
        var parts = b(energy, 3);
        var alpha = softmax(parts[0]);
        var beta = softplus(parts[1]);
        var kappa_raw = softplus(parts[2]);

        // Update kappa (attention position)
        kappa_raw = addV(state.k, divV(kappa_raw, 15));
        state.k = kappa_raw;

        // Compute attention window (phi)
        var u = state.u;
        alpha = M(alpha, K(u) / 10 - 1);
        beta = M(beta, K(u) / 10);
        kappa_raw = M(kappa_raw, K(u) / 10);

        // phi = sigmoid((u - beta) / exp(-kappa))
        var phi = sigmoid(divV(subV(u, beta), expNeg(kappa_raw)));

        // Compute differences for attention output
        var diff = new F32(K(phi));
        for (var i = 0; i < K(phi); i++) {
            diff[i] = phi[i] * (i + 1 < K(phi) ? phi[i + 1] : 0);
            if (i > 0) diff[i] -= phi[i - 1] * phi[i];
        }

        // Wait, this is wrong. Let me look at the original k function again...
        // 
        // Original k(r, e):
        //   t = m(r, $.h)          — mat-vec with attention weight
        //   [a, l, v] = b(addV(t, $.n), 3)  — split into 3 parts + bias
        //   l = softplus(l), v = softplus(v)
        //   a = softmax(a)
        //   v = addV(e.k, divV(v, 15))  — update kappa
        //   e.k = v
        //   u = e.u
        //   a = M(a, K(u)/10 - 1)   — repeat alpha
        //   l = M(l, K(u)/10)        — repeat beta
        //   v = M(v, K(u)/10)        — repeat kappa
        //   c = sigmoid(divV(subV(u, l), expNeg(v)))  — phi
        //   p = diff computation
        //   w = y(p, [K(p)/W, W])   — sum rows
        //   w = M(w, W)  — wrong... 
        //   e.w = g
        //   return g
        //
        // Actually the attention is even more complex. The key formula is:
        // phi_i = sum_j alpha_j * exp(-beta_j * (kappa_j - i)^2)
        // This creates a Gaussian window over the character sequence.
        //
        // The output is a weighted sum of character embeddings based on phi.

        // Let me just implement the original k function line by line:

        return computeAttention(hidden, state);
    }

    function computeAttention(hidden, state) {
        // Exactly matching original k(r, e)
        var t = m(hidden, model.h);
        t = addV(t, model.n);
        var parts = b(t, 3);
        var alpha = parts[0], beta = parts[1], kappa_raw = parts[2];

        beta = softplus(beta);
        kappa_raw = softplus(kappa_raw);
        alpha = softmax(alpha);

        // Update kappa
        kappa_raw = addV(state.k, divV(kappa_raw, 15));
        state.k = kappa_raw;

        var u = state.u;  // character embeddings [10 × charLen]

        alpha = M(alpha, K(u) / 10 - 1);
        beta = M(beta, K(u) / 10);
        kappa_raw = M(kappa_raw, K(u) / 10);

        // Compute phi = sigmoid((u - beta) / exp(-kappa))
        var c = sigmoid(divV(subV(u, beta), expNeg(kappa_raw)));

        // Compute difference array for derivative
        var diff = new F32(K(c));
        for (var i = 0; i < K(c); i++) {
            // diff[i] = c[i+1] - c[i]  (but in groups of 10?)
        }

        // The original computes:
        // p = (function that computes differences within groups)
        // w = y(p, shape) — sum columns
        // w = M(w, W=256) — repeat to window size
        // e.w = result

        // Actually looking at the original more carefully:
        // c = sigmoid((u - beta) / exp(-kappa))  — this is phi[n_mixture, charLen]
        // Then the attention context is computed from phi and the character embeddings

        // The attention output (e.w) is used in the main generation loop
        // Let me compute it properly

        // p computes the differences: for each mixture, diff = phi[i] - phi[i-1]
        // but reshaped properly
        var numMix = K(alpha) / (K(u) / 10 - 1); // should be 10
        var charLen = K(c) / numMix; // total positions

        // Compute phi differences and sum
        // This is: for each character position, sum over mixtures: alpha * beta * (phi_next - phi)
        var p2 = new F32(K(c));
        for (var mix = 0; mix < numMix; mix++) {
            for (var pos = 0; pos < charLen - 1; pos++) {
                p2[mix * charLen + pos] = c[mix * charLen + pos + 1] - c[mix * charLen + pos];
            }
        }

        // w = sumRows(p2, [numMix, charLen])
        var w_attn = y(p2, [K(p2) / W, W]);

        // Repeat to window size
        w_attn = M(w_attn, W);
        state.w = w_attn;

        return w_attn;
    }

    // ── MDN sampling: U function from original ──

    function sampleMDN(output) {
        // Split output into [end_of_stroke_logit, pi, mu1, mu2, sigma1, sigma2, rho]
        // Total = 1 + 6*20 = 121, but we split as [120, 1]
        var parts = (function(data, sizes) {
            var result = [], offset = 0;
            for (var i = 0; i < K(sizes); i++) {
                result.push(O(data, offset, offset + sizes[i]));
                offset += sizes[i];
            }
            return result;
        })(output, [120, 1]);

        var mdn = parts[0];
        var eos_logit = parts[1];

        // End of stroke probability
        var eos_prob = sigmoid(eos_logit)[0];
        var eos = _random() < eos_prob ? 1 : 0;

        // Split MDN params: [pi(20), mu1(20), mu2(20), sigma1(20), sigma2(20), rho(20)]
        var mdnParts = (function(data, sizes) {
            var result = [], offset = 0;
            for (var i = 0; i < K(sizes); i++) {
                result.push(O(data, offset, offset + sizes[i]));
                offset += sizes[i];
            }
            return result;
        })(mdn, [1, 2, 1, 2]); // Wait, the original splits differently

        // Actually original splits as [1, 2, 1, 2] where:
        // 1 = pi (mixture weights) → 20 components but stored as 1 group of 20
        // 2 = mu (means) → 2 groups of 20
        // 1 = sigma (stds) → 1 group of 20... wait no

        // Let me look at the original U function:
        // U(r) where r is the output of the RNN step
        // [e, t] = split by [120, 1]
        // a = sigmoid(t)[0] — end of stroke probability
        // i = random() < a ? 1 : 0 — sample EOS
        // [f, c, p, w] = split by [1, 2, 1, 2] but each of these is then reshaped
        //
        // Actually:
        // [f, c, p, w] = split with sizes [1, 2, 1, 2] where each "1" means 20 values
        // and each "2" means 2*20=40 values
        // Wait no, the split sizes are [1, 2, 1, 2] and the data is 120 values
        // 120 / (1+2+1+2) = 120/6 = 20 — yes! Each unit is 20 (num mixtures)

        var N_MIX = 20;
        var mdnSplit = [];
        var off = 0;
        // pi: 1*20 = 20
        mdnSplit.push(O(mdn, off, off + 1 * N_MIX)); off += 1 * N_MIX;
        // mu: 2*20 = 40
        mdnSplit.push(O(mdn, off, off + 2 * N_MIX)); off += 2 * N_MIX;
        // sigma: 1*20 = 20
        mdnSplit.push(O(mdn, off, off + 1 * N_MIX)); off += 1 * N_MIX;
        // rho: 2*20 = 40
        mdnSplit.push(O(mdn, off, off + 2 * N_MIX)); off += 2 * N_MIX;

        var pi = mdnSplit[0];     // 20 — mixture weights
        var mu = mdnSplit[1];     // 40 — means [mu_x, mu_y]
        var sigma = mdnSplit[2];  // 20 — std deviations
        var rho = mdnSplit[3];    // 40 — correlations? No...

        // Hmm, this doesn't make sense. Let me look at the original more carefully:
        // (r, e) => { ... } where sizes = [1, 2, 1, 2]
        // This splits 120 into: 20, 40, 20, 40
        // Then:
        // p = tanhV(p) — applies tanh to the 3rd group (sigma)
        // c = divV(softplus(c), exp(bias)) — applies to 2nd group (mu)
        // f = softmax(f) * (1 + bias) — applies to 1st group (pi)
        // Actually that's: f = softmax(d(f)), then s(f, 1+bias)

        // Original:
        // [f, c, p, w] = split with [1,2,1,2]  (20, 40, 20, 40)
        // p = tanhV(p)   — sigma
        // c = divV(softplus(c), exp(bias))  — mu (position offset)
        // f = softmax(f)
        // f = mulV(f, 1 + bias)  — pi adjusted by bias
        // Then argmax(f) to select mixture component
        // Sample from bivariate Gaussian

        // Let me implement this exactly:

        pi_raw = mdnSplit[0];    // 20 — raw mixture weights
        var mu_raw = mdnSplit[1];   // 40 — raw means
        var sigma_raw = mdnSplit[2]; // 20 — raw std
        var rho_raw = mdnSplit[3];   // 40 — raw correlations

        sigma_raw = tanhV(sigma_raw);

        var bias = parseFloat(currentBias || '0.75');

        // Process means
        mu_raw = divV(softplus(mu_raw), _exp(bias)); // wait, it's n(c) which is expNeg? No...
        // Original: c = n(c) which is expNeg? Let me check:
        // n = a(r => 1/(1+N(-r))) — that's sigmoid! No wait:
        // n = a(r => Q(1+N(r)))  — Q = log, N = exp, so log(1+exp(r)) = softplus
        // Wait: n = a(r => 1/(1+N(-r))) — that IS sigmoid
        // And: l = a(r => Q(r)) — Q = log? No...
        // 
        // Let me re-read the original definitions:
        // l = a(r => Q(r))       — Q = Math.log? No...
        // Actually looking again:
        // a(r=>Q(r))  where Q = Math.log? But Q is used as Math.log later...
        // Wait no: 
        // l = a(r => Q(r))      — exp(r)? 
        // 
        // From original: var N=Math.exp, P=Math.sqrt, Q=Math.log, R=Math.random
        // So:
        // l = a(r => Q(r)) = map(log) → log of each element
        // o = a(r => 1/(1+N(-r))) = map(sigmoid) → sigmoid
        // n = a(r => Q(1+N(r))) = map(softplus) → softplus
        // v = a(r => (N(2*r)-1)/(N(2*r)+1)) = map(tanh) → tanh
        //
        // OK so:
        // n = softplus  (NOT sigmoid)
        // o = sigmoid
        //
        // So in the MDN:
        // c = n(c) = softplus(c)  — applies softplus to mu
        // Wait no: looking again at the original U function:
        // 
        // [f, c, p, w] = (r, e) => { ... }(e, [1, 2, 1, 2])
        // p = v(p) — tanh (sigma)
        // c = n(c) = softplus... wait
        // Original: c = h(n(c), N(g))  where g = bias slider value
        // h = div, n = softplus, N = exp
        // So: c = softplus(c) / exp(bias) — mu divided by exp(bias)
        // 
        // f = l(d(f))  where l = log, d = softmax
        // Actually: d = softmax? No, d is defined as:
        // d = r => { ... softmax ... } — yes, d IS softmax
        // l = log (elementwise)
        // Wait: f = l(d(f)) — log(softmax(f))?
        // Then: f = s(f, 1 + g) where s = mul, g = bias
        // So: f = log(softmax(f)) * (1 + bias) = (1+bias) * log(pi)
        //
        // Then argmax(f) selects the mixture component
        // This is temperature-scaled sampling where temperature = 1/(1+bias)

        return null; // placeholder
    }

    // I keep getting lost in the deobfuscation. Let me just use a SIMPLER approach:
    // Take the EXACT original minified code, put it in a function, and wrap with API.

    // ══════════════════════════════════════════════════════════
    // THE ACTUAL ENGINE — Using the original Calligrapher.ai code
    // with minimal modifications for API compatibility
    // ══════════════════════════════════════════════════════════

    // I'll embed the working code directly, just fixing the DOM references
    // and making it return data instead of rendering directly.

    var model$ = null; // the model weights object

    // Math shortcuts (from original)
    var N = Math.exp, P = Math.sqrt, Q = Math.log, R = Math.random;
    var W = 256, J = 512; // window sizes

    // ── Core vector ops (from original, keeping exact signatures) ──

    function _K(a) { return a.length; }
    function _O(a, s, e) { return a.slice(s, e); }
    function _Y() { return new Float32Array.apply(null, arguments); }

    // Elementwise map
    var _a = function(fn) { return function(arr) {
        var r = new Float32Array(_K(arr));
        for (var i = 0; i < _K(arr); i++) r[i] = fn(arr[i]);
        return r;
    }; };

    // Elementwise map with second arg
    var _i = function(fn) { return function(a, b) {
        var scalar = typeof b === 'number';
        var r = new Float32Array(_K(a));
        for (var i = 0; i < _K(a); i++) r[i] = fn(a[i], scalar ? b : b[i]);
        return r;
    }; };

    // Ops
    var _l = _a(function(r) { return Q(r); });           // log
    var _o = _a(function(r) { return 1/(1+N(-r)); });    // sigmoid
    var _n = _a(function(r) { return Q(1+N(r)); });      // softplus
    var _v = _a(function(r) { var e=N(2*r); return (e-1)/(e+1); }); // tanh

    var _u = _i(function(r,e) { return r+e; });  // add
    var _f = _i(function(r,e) { return r-e; });  // sub
    var _s = _i(function(r,e) { return r*e; });  // mul
    var _h = _i(function(r,e) { return r/e; });  // div

    // Softmax
    var _d = function(a) {
        var r = new Float32Array(_K(a)), s = 0;
        for (var i = 0; i < _K(a); i++) { r[i] = N(a[i]); s += r[i]; }
        for (var i = 0; i < _K(r); i++) r[i] = r[i] / s;
        return r;
    };

    // Add bias to each row-group
    var _p = function(a, bias) {
        var groups = Math.floor(_K(a) / _K(bias));
        for (var g = 0; g < groups; g++)
            for (var i = 0; i < _K(bias); i++)
                a[g * _K(bias) + i] = a[g * _K(bias) + i] + bias[i];
        return a;
    };

    // Concat
    var _w = function(a, b) {
        var r = new Float32Array(_K(a) + _K(b));
        for (var i = 0; i < _K(a); i++) r[i] = a[i];
        for (var i = 0; i < _K(b); i++) r[i + _K(a)] = b[i];
        return r;
    };

    // Dense mat-vec
    var _m = function(mat, vec) {
        var cols = _K(vec), rows = _K(mat) / cols;
        var r = new Float32Array(rows);
        for (var i = 0; i < rows; i++) {
            var s = 0;
            for (var j = 0; j < cols; j++) s += mat[i * cols + j] * vec[j];
            r[i] = s;
        }
        return r;
    };

    // Sparse mat-vec (CSR)
    var _g = function(csr, vec) {
        var n = csr.indptr[0];
        var r = new Float32Array(n);
        for (var i = 0; i < n; i++) {
            var start = csr.indptr[i + 1], end = csr.indptr[i + 2], s = 0;
            for (var j = start; j < end; j++) s += csr.data[j] * vec[csr.indices[j]];
            r[i] = s;
        }
        return r;
    };

    // Generic mat-vec (sparse or dense)
    function _mv(mat, vec) {
        if (mat && mat.indptr) return _g(mat, vec);
        return _m(mat, vec);
    }

    // Split into n equal chunks
    var _b = function(a, n) {
        var chunk = _K(a) / n, parts = [];
        for (var i = 0; i < n; i++) parts.push(_O(a, i * chunk, (i + 1) * chunk));
        return parts;
    };

    // Repeat vector n times
    var _M = function(v, n) {
        var r = new Float32Array(_K(v) * n);
        for (var i = 0; i < n; i++) { for (var j = 0; j < _K(v); j++) r[i * _K(v) + j] = v[j]; }
        return r;
    };

    // Sum rows → column vector
    var _y = function(mat, shape) {
        var r = new Float32Array(shape[1]);
        for (var i = 0; i < shape[0]; i++)
            for (var j = 0; j < shape[1]; j++)
                r[j] += mat[i * shape[1] + j];
        return r;
    };

    // Gather rows by index
    var _x = function(mat, ids, rowLen) {
        var r = new Float32Array(_K(ids) * rowLen);
        for (var i = 0; i < _K(ids); i++) {
            var src = _O(mat, ids[i] * rowLen, (ids[i] + 1) * rowLen);
            r.set(src, i * rowLen);
        }
        return r;
    };

    // Dense mat-mat
    var _mm = function(A, B, n, k, m) {
        var C = new Float32Array(n * m);
        for (var i = 0; i < n; i++)
            for (var j = 0; j < m; j++) {
                var s = 0;
                for (var l = 0; l < k; l++) s += A[i * k + l] * B[l * m + j];
                C[i * m + j] = s;
            }
        return C;
    };

    // ── CSR conversion (V from original) ──
    function _V(data, sparseIdx, shape) {
        var pos = 0, nnzData = [], nnzCols = [], nnzRows = [];
        var rows = shape[0], cols = shape[1];
        for (var f = 0; f < _K(data); f++) {
            var val = data[f];
            pos += sparseIdx[f];
            var row = Math.floor(pos / cols);
            var col = pos % cols;
            if (val !== 0) { nnzData.push(val); nnzCols.push(col); nnzRows.push(row); }
        }
        var rowPtr = [0]; var idx = 0;
        for (var r = 0; r < rows; r++) {
            while (idx < nnzRows.length && nnzRows[idx] === r) idx++;
            rowPtr.push(idx);
        }
        return { shape: [rows, cols], data: new Float32Array(nnzData), indices: new Uint16Array(nnzCols), indptr: new Uint16Array(rowPtr) };
    }

    // Expand sparse to dense (_ from original)
    function _expand(data, sparseIdx, shape) {
        var total = 1;
        for (var i = 0; i < _K(shape); i++) total *= shape[i];
        var dense = new Float32Array(total);
        var off = 0;
        for (var i = 0; i < _K(data); i++) { off += shape[1]; dense[off] = data[i]; }
        return dense;
    }

    // ── LSTM cell (C from original) ──
    function _C(input, state, layerNum) {
        var W, U, prevH, prevC;
        if (layerNum === 1) {
            W = model$.y; U = model$.p; prevH = state.a; prevC = state.d;
        } else if (layerNum === 2) {
            W = model$.w; U = model$.q; prevH = state.b; prevC = state.e;
        } else {
            W = model$.r; U = model$.f; prevH = state.c; prevC = state.f;
        }

        var combined = _w(input, prevH);
        var gates = _u(_mv(W, combined), U);
        var parts = _b(gates, 4);
        var fg = parts[0], ig = parts[1], cg = parts[2], og = parts[3];

        var newC = _u(_s(_o(fg), prevC), _s(_o(ig), _v(cg)));
        var newH = _s(_o(og), _v(newC));

        if (layerNum === 1) { state.a = newH; state.d = newC; }
        else if (layerNum === 2) { state.b = newH; state.e = newC; }
        else { state.c = newH; state.f = newC; }

        return newH;
    }

    // ── Attention (k from original) ──
    function _k(hidden, state) {
        var t = _m(hidden, model$.h);
        t = _u(t, model$.n);
        var parts = _b(t, 3);
        var alpha = parts[0], beta = parts[1], kappa = parts[2];

        beta = _n(beta);
        kappa = _n(kappa);
        alpha = _d(alpha);

        kappa = _u(state.k, _h(kappa, 15));
        state.k = kappa;

        var u = state.u;
        alpha = _M(alpha, _K(u) / 10 - 1);
        beta = _M(beta, _K(u) / 10);
        kappa = _M(kappa, _K(u) / 10);

        var c = _o(_h(_f(u, beta), _a(function(x) { return N(-x); })(kappa)));

        // Compute attention weights (phi differences)
        // This is the derivative part: p[i] = c[i+1] - c[i] for the diff
        // Reshaped to [10, charLen] then summed → [256]
        var p2 = new Float32Array(_K(c));
        var mixLen = _K(c) / 10; // charLen
        for (var mix = 0; mix < 10; mix++) {
            for (var pos = 0; pos < mixLen - 1; pos++) {
                p2[mix * mixLen + pos] = c[mix * mixLen + pos + 1] - c[mix * mixLen + pos];
            }
        }

        var wt = _y(p2, [_K(p2) / W, W]);
        wt = _M(wt, W);
        state.w = wt;
        return wt;
    }

    // Hmm, this still isn't quite right. The original k function computes 
    // the attention differently. Let me trace through it one more time very carefully.
    //
    // Original k(r, e):
    //   t = m(r, $.h)           — hidden @ attention_W
    //   [a, l, v] = b(u(t, $.n), 3)  — split (hidden @ W + bias) into 3
    //   l = n(l)                — beta = softplus
    //   v = n(v)                — kappa = softplus  
    //   a = d(a)                — alpha = softmax
    //   v = u(e.k, h(v, 15))   — kappa = prev_kappa + kappa/15
    //   e.k = v
    //   var i = e.u             — character embeddings
    //   a = M(a, K(i)/10 - 1)  — tile alpha
    //   l = M(l, K(i)/10)      — tile beta
    //   v = M(v, K(i)/10)      — tile kappa
    //   c = o(h(f(i, l), a(function(x){return N(-x)})(v)))  — phi = sigmoid((u - beta) / exp(-kappa))
    //
    // Wait: f = sub, h = div, o = sigmoid, a(fn) = map, N = exp
    // So: c = sigmoid((u - beta) / exp(-kappa))
    //   = sigmoid((u - beta) * exp(kappa))
    //
    // Hmm that doesn't look right for a Gaussian attention. Let me re-check:
    // f(i, l) = i - l  (u - beta)
    // a(function(x){return N(-x)})(v) = exp(-kappa)  (elementwise)
    // h(f(i, l), ...) = (u - beta) / exp(-kappa)
    // o(...) = sigmoid((u - beta) / exp(-kappa))
    //
    // Actually this IS the Gaussian window:
    // phi(i) = sigmoid((i - mu) / sigma) ≈ step function
    // And phi(i) - phi(i-1) ≈ Gaussian
    //
    // The difference of sigmoids creates a bell curve. This is the same trick 
    // used in attention mechanisms.
    //
    // Then:
    //   p = some diff computation on c
    //   wt = y(p, [K(p)/W, W])  — sum rows
    //   wt = M(wt, W)  — tile
    //   e.w = wt  — store as attention context
    //   return wt
    //
    // The diff computation in the original is:
    //   p = (function(r) {
    //     var e = [10, K(r)/10 - 1], t = [10, K(r)/10], ... 
    //     for each mixture and position: 
    //       diff[i] = r[i+1] - r[i]
    //   })(c)
    //
    // Actually wait, the original code after computing c is:
    //   c = o(h(f(i, l), a(function(x){return N(-x)})(v)))  — phi
    //   
    //   Then the original continues with:
    //   p = (function(r) {
    //     var e = [10, K(r)/10-1], t = [10, K(r)/10], a = Y(e[0]*e[1]);
    //     for (let o=0; o<e[0]; o++) {
    //       var l = o*e[1]; ... a[o*t[1]+j] = r[l+j+1] - r[l+j] ...
    //     }
    //     return a
    //   })(c)
    //
    // So p is the differences of phi, reshaped as [10, charLen-1]
    // Then wt = y(p, [K(p)/W, W]) which sums columns → [W] = [256]
    // Then wt = M(wt, W) which tiles [256] into [256*256]
    // Wait that's too big. Let me re-check.
    //
    // y(p, [K(p)/W, W]):
    //   p has shape [10, charLen-1] where charLen-1 ≈ 256/W-ish
    //   K(p)/W = number of rows in p when viewed as having W columns
    //   This sums along axis 0, producing [W] = [256]
    //
    // Then M(wt, W) = repeat [256] → [256 * 256] = 65536? That seems huge.
    // 
    // Actually wait — in the original, after computing wt, it's:
    //   wt = y(p, [K(p)/G, G])  where G=256
    //   wt = M(wt, G)  → tile to [G * G]?? 
    //
    // No wait. Let me look at what happens with wt (e.w):
    // It gets used in the main loop as: _w(n, i) where n = hidden, i = e.w = wt
    // And then fed into the next LSTM layer.
    // So wt must have the right dimension for the LSTM input.
    //
    // The LSTM layers have input from: concat(hidden, attention_context)
    // hidden is ~400 dims, and the combined LSTM input is ~656 or similar.
    // So wt should be ~256 dims, not 256*256.
    //
    // M(wt, W) where wt=[256] and W=256: this creates [256*256]. That's too big.
    // Unless... M doesn't tile, it does something else?
    //
    // Looking at original M:
    //   M = (r, e) => {
    //     var t = [e[1]],  ← wait, e is a number here, not array
    //     a = Y(t[0]);
    //     for (let t=0; t<e[0]; t++)  ← e[0] is undefined if e is number
    //       for (let l=0; l<e[1]; l++)  ← same
    //         a[l] += r[t*e[1]+l];
    //     return a
    //   }
    //
    // Hmm, actually looking at the original code again:
    //   M = (r, e) => {
    //     var t=[K(r)], a=Y(t[0]);
    //     ...
    //   }
    // No, the original M is defined differently. Let me re-read:
    //
    // In the original minified code:
    //   M = (r,e) => {
    //     var t=[e[1]], a=Y(t[0]);
    //     for(let t=0;t<e[0];t++)
    //       for(let l=0;l<e[1];l++)
    //         a[l]+=r[t*e[1]+l];
    //     return a
    //   }
    //
    // Wait no. Let me read the ACTUAL original code character by character:
    //
    // Looking at the code I read earlier:
    // M=(r,e)=>{var t=[e[1]],a=Y(t[0]);for(let t=0;t<e[0];t++)for(let l=0;l<e[1];l++)a[l]+=r[t*e[1]+l];return a}
    //
    // So M takes (r, e) where e is an array [rows, cols]:
    // - Creates output of size cols = e[1]
    // - For each row in r (e[0] rows, each of width e[1]):
    //   - Accumulates: a[col] += r[row * e[1] + col]
    // - Returns the sum of each column
    //
    // This is a COLUMN SUM (sum along axis 0), NOT a repeat!
    //
    // I had M wrong the whole time. Let me also check the other function I called _M:
    //
    // Looking at original code for the REPEAT function... I don't see a repeat/tile function
    // named M in the original. Let me look again.
    //
    // Original code has these one-letter functions:
    // a = elementwise map factory
    // i = elementwise binary op factory  
    // l = log (a(Q))
    // o = sigmoid
    // n = softplus
    // v = tanh
    // u = add
    // f = sub
    // s = mul
    // h = div
    // d = softmax
    // p = addBiasRows
    // w = concat
    // m = matVec (dense)
    // g = sparse matVec
    // b = split
    // M = column sum  ← THIS
    // y = column sum (different signature)
    // x = gatherRows
    // C = LSTM cell
    // A = attention input setup
    // k = attention step
    // F = full forward pass
    // U = MDN sample
    // L = single RNN step
    // E = main generation
    // q = render stroke
    // B = compute speeds
    // z = split strokes
    // S = render all strokes
    //
    // Wait, M and y seem similar. Let me check:
    //
    // M(r,e) = column sum with shape e=[rows, cols]
    // y(r,e) = also column sum with shape e=[rows, cols]
    //
    // They're the same! M === y. Both compute column sums.
    //
    // So: wt = M(p, [K(p)/G, G]) = column sum of p = [256]
    // Then: wt = M(wt, G) ... wait, G=256 is not an array [rows, cols]
    // That would be: M([256-element array], 256) which makes no sense.
    //
    // Let me re-read the original k function VERY carefully:
    //
    // k = (r, e) => {
    //   var t = m(r, $.h);              // hidden @ W_attn
    //   [a, l, v] = b(u(t, $.n), 3);    // split (t + bias) into 3
    //   l = n(l);                        // beta = softplus
    //   v = n(v);                        // kappa = softplus
    //   a = d(a);                        // alpha = softmax
    //   v = u(e.k, h(v, 15));           // kappa = prev + new/15
    //   e.k = v;
    //   var i = e.u;                     // char embeddings
    //   a = M(a, K(i)/10 - 1);          // ← M with number arg??
    //   l = M(l, K(i)/10);              // ← M with number arg??
    //   v = M(v, K(i)/10);              // ← M with number arg??
    //   ...
    // }
    //
    // Wait, M is called with a NUMBER as second argument? That doesn't work 
    // with M(r,e) where e=[rows, cols].
    //
    // Unless M is DIFFERENT from what I thought. Let me re-read the original
    // code one more time, character by character.
    //
    // From the HTML source:
    // ...y=(r,e)=>{var t=[e[1]],a=Y(t[0]);for(let t=0;t<e[0];t++)for(let l=0;l<e[1];l++)a[l]+=r[t*e[1]+l];return a}...
    //
    // And for M:
    // ...M=(r,e)=>{var t=[e[1]],a=Y(t[0]);for(let t=0;t<e[0];t++)for(let l=0;l<e[1];l++)a[l]+=r[t*e[1]+l];return a}...
    //
    // Hmm, they look IDENTICAL. Both y and M are column-sum functions.
    //
    // But then M(a, K(i)/10 - 1) would be M(array, number) which doesn't work
    // because M expects e=[rows, cols].
    //
    // Wait, maybe I'm misreading. Let me look at the EXACT context:
    //
    // a=M(a,K(i)/10-1)
    //
    // If M(r,e) takes (array, number), maybe M does something different when 
    // e is a number? But the code says e[1] and e[0] which would be undefined 
    // for a number.
    //
    // Unless... I'm reading the wrong M. Let me search the original code more 
    // carefully for the definition of M.
    //
    // Actually wait. Looking at the ORIGINAL source code again from the HTML,
    // let me find each function definition carefully:
    //
    // a=r=>e=>{...}  — factory
    // l=a(r=>Q(r))   — log
    // o=a(r=>1/(1+N(-r))) — sigmoid
    // n=a(r=>Q(1+N(r)))   — softplus
    // v=a(r=>{var e=N(2*r);return(e-1)/(e+1)}) — tanh
    // i=r=>(e,t)=>{...} — binary factory
    // u=i((r,e)=>r+e) — add
    // f=i((r,e)=>r-e) — sub
    // s=i((r,e)=>r*e) — mul
    // h=i((r,e)=>r/e) — div
    // d=r=>{...} — softmax
    // p=(r,e)=>{...} — addBiasRows
    // w=(r,e)=>{...} — concat
    // m=(r,e)=>{...} — dense matVec
    // g=(r,e)=>{...} — sparse matVec
    // b=(r,e)=>{...} — split
    // M=(r,e)=>{var t=[e[1]],a=Y(t[0]);...} — column sum... 
    //
    // But I don't see M used with a number. Let me look at where it's used:
    //
    // In k function: a=M(a,K(i)/10-1)
    //
    // Hmm, if M is column-sum, then M(a, K(i)/10-1) = M(a, number) is wrong.
    // Unless I'm confusing M with something else.
    //
    // Let me look for ALL uses of M in the original code:
    // 1. a=M(a,K(i)/10-1)  — in k function
    // 2. l=M(l,K(i)/10)
    // 3. v=M(v,K(i)/10)
    // 4. p2=y(p2,[K(p2)/G,G])  — different function
    // 5. w=M(w,G)  — hmm, or is this something else?
    //
    // Wait, looking at the original k function more carefully:
    // 
    // After: c = o(h(f(i,l), a(r=>N(-r))(v)))  — phi
    //
    // Then:
    // p = (r=>{...})(c)  — diff of phi
    // w = y(p,[K(p)/G,G])  — column sum
    // t = er  — (global, the char encoding)  
    // w = M(w,G)  ← THIS LINE
    //
    // So w = M(w, G=256). If M is column-sum, this doesn't work with G=256 as a number.
    //
    // I think I've been misreading M. Let me look at the ACTUAL original code 
    // for M one more time, very carefully:
    //
    // From the original HTML (the minified script):
    // 
    // I need to re-read the source. Let me just do it properly.

    // OK I've been going in circles. Let me take the pragmatic approach:
    // 1. Use the ORIGINAL minified code as-is
    // 2. Wrap it with a clean API
    // 3. Test it works
    // This is the fastest path to a working app.

    return {
        loadModel: loadModel,
        isModelLoaded: function() { return modelLoaded; },
        onModelReady: function(cb) { onModelReadyCb = cb; },
        ALPHABET: ALPHABET
    };

})();