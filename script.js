/* ============================================
   HandWrite AI v2.2 — Real SVG Stroke Rendering
   Uses opentype.js for glyph path extraction
   Fixed: white screen bug, reliable welcome animation
   ============================================ */

(function() {
  'use strict';

  // ── Config ──────────────────────────────────
  const LANGUAGES = [
    { text: 'Welcome', lang: 'en' },
    { text: 'Bienvenue', lang: 'fr' },
    { text: 'Bienvenido', lang: 'es' },
    { text: 'Benvenuto', lang: 'it' },
    { text: 'ようこそ', lang: 'ja' }
  ];

  const STYLE_NAMES = ['Emma', 'James', 'Sofia', 'Marcus', 'Lily', 'Oliver', 'Aria', 'Noah', 'Zara'];

  // Style characteristics
  const STYLE_ATTRS = {
    Emma:    { slant: 5, weight: 2.2, spacing: 1, loopSize: 1, baseline: 0, opacity: 1, ink: '#1A1A1A' },
    James:   { slant: 2, weight: 2.8, spacing: 1.4, loopSize: 0.5, baseline: 2, opacity: 0.9, ink: '#222' },
    Sofia:   { slant: 3, weight: 2, spacing: 0.7, loopSize: 1.5, baseline: 0, opacity: 1, ink: '#1A1A1A' },
    Marcus:  { slant: 0, weight: 3.5, spacing: 1.2, loopSize: 0, baseline: 0, opacity: 1, ink: '#000' },
    Lily:    { slant: 4, weight: 1.5, spacing: 1, loopSize: 1.8, baseline: 1, opacity: 0.95, ink: '#333' },
    Oliver:  { slant: 1, weight: 2.5, spacing: 1.1, loopSize: 0.7, baseline: 3, opacity: 0.9, ink: '#222' },
    Aria:    { slant: 8, weight: 2, spacing: 1.3, loopSize: 1.2, baseline: 0, opacity: 1, ink: '#1A1A1A' },
    Noah:    { slant: 0, weight: 3, spacing: 1.5, loopSize: 0, baseline: 0, opacity: 1, ink: '#111' },
    Zara:    { slant: 10, weight: 2.3, spacing: 0.9, loopSize: 2, baseline: 2, opacity: 1, ink: '#1A1A1A' }
  };

  // ── Hand-crafted SVG paths for "Welcome" per style ──
  // Each is a set of continuous stroke paths that look like real handwriting
  // Using the "multiple stroke" technique: thin background + medium + main stroke
  const WELCOME_PATHS = {
    Emma: [
      // W - neat, slight right slant, consistent
      'M 30 65 C 30 40, 35 20, 40 55 C 45 35, 50 20, 55 55 C 58 35, 63 20, 68 60',
      // e
      'M 72 48 C 85 42, 100 42, 100 52 C 100 62, 85 65, 72 58 C 72 48, 72 42, 78 38',
      // l
      'M 108 32 C 108 22, 108 18, 108 68',
      // c
      'M 128 52 C 128 40, 140 38, 146 42',
      // o
      'M 150 50 C 150 38, 165 36, 165 50 C 165 62, 150 64, 150 50',
      // m
      'M 170 58 C 170 45, 172 38, 178 42 C 184 46, 184 56, 184 58 C 184 45, 186 38, 192 42 C 198 46, 198 56, 198 58',
      // e
      'M 202 48 C 215 42, 228 42, 228 52 C 228 62, 215 65, 202 58 C 202 48, 202 42, 208 38'
    ],
    James: [
      // W - fast, heavier, wide spacing
      'M 25 68 C 28 35, 38 18, 42 58 C 46 30, 56 18, 60 55 C 63 32, 72 22, 78 62',
      // e - messier
      'M 88 50 C 100 40, 118 42, 116 54 C 114 66, 92 66, 88 56',
      // l
      'M 128 28 C 130 20, 130 70, 126 72',
      // c
      'M 148 54 C 146 38, 162 36, 168 44',
      // o
      'M 176 50 C 174 34, 194 34, 192 52 C 190 68, 176 66, 176 50',
      // m
      'M 200 60 C 200 42, 204 36, 210 42 C 216 48, 214 58, 214 60 C 216 42, 220 36, 226 42 C 232 48, 230 58, 232 60',
      // e
      'M 240 50 C 254 40, 268 44, 266 56 C 264 68, 242 66, 240 56'
    ],
    Sofia: [
      // W - loopy, rounded, thinner
      'M 30 62 C 28 30, 40 15, 44 52 C 48 28, 56 12, 60 52 C 62 30, 72 15, 76 58',
      // e - tight loops
      'M 82 46 C 92 38, 104 40, 102 50 C 100 60, 86 62, 82 54 C 80 46, 84 36, 90 34',
      // l - loopy
      'M 112 28 C 114 18, 112 68, 114 70',
      // c
      'M 126 50 C 126 38, 138 36, 142 40',
      // o - round
      'M 150 48 C 148 34, 166 32, 166 48 C 166 62, 150 64, 150 48',
      // m - tight
      'M 172 56 C 172 40, 174 32, 180 38 C 186 44, 184 54, 184 56 C 184 40, 186 32, 192 38 C 198 44, 196 54, 198 56',
      // e
      'M 204 46 C 216 38, 228 40, 226 50 C 224 60, 208 62, 204 54 C 202 46, 206 36, 212 34'
    ],
    Marcus: [
      // W - angular, print-like, bold
      'M 28 62 L 36 22 L 44 58 L 52 22 L 60 62',
      // e - angular
      'M 70 50 L 90 50 L 90 56 C 88 62, 70 64, 70 50 C 70 38, 90 36, 90 44',
      // l
      'M 100 22 L 100 62',
      // c
      'M 118 50 C 118 38, 132 38, 132 44',
      // o
      'M 142 50 C 142 38, 156 38, 156 50 C 156 62, 142 62, 142 50',
      // m
      'M 166 62 L 166 38 L 176 38 L 176 62 L 182 38 L 192 38 L 192 62',
      // e
      'M 202 50 L 222 50 L 222 56 C 220 62, 202 64, 202 50 C 202 38, 222 36, 222 44'
    ],
    Lily: [
      // W - delicate, thin, wide loops
      'M 32 60 C 30 28, 42 12, 46 50 C 50 24, 58 10, 62 50 C 64 28, 74 14, 78 56',
      // e - delicate
      'M 86 44 C 96 36, 108 38, 106 48 C 104 58, 88 60, 86 52 C 84 44, 88 34, 96 32',
      // l
      'M 116 24 C 118 14, 116 64, 118 66',
      // c - wide loop
      'M 130 48 C 128 36, 144 34, 148 40',
      // o
      'M 158 46 C 156 32, 174 30, 174 46 C 174 60, 158 62, 158 46',
      // m
      'M 182 54 C 182 38, 184 30, 190 36 C 196 42, 194 52, 194 54 C 194 38, 196 30, 202 36 C 208 42, 206 52, 208 54',
      // e
      'M 216 44 C 226 36, 238 38, 236 48 C 234 58, 218 60, 216 52 C 214 44, 218 34, 226 32'
    ],
    Oliver: [
      // W - casual, mixed, uneven
      'M 28 66 C 30 38, 38 20, 42 56 C 46 34, 54 22, 58 58 C 60 36, 70 24, 74 64',
      // e - uneven
      'M 84 50 C 96 42, 110 44, 108 54 C 106 62, 86 64, 84 56',
      // l - slight lean
      'M 120 30 C 122 20, 120 68, 122 70',
      // c
      'M 138 52 C 136 40, 150 38, 156 44',
      // o
      'M 166 50 C 164 36, 182 36, 180 52 C 178 64, 166 64, 166 50',
      // m - casual
      'M 190 58 C 190 42, 194 36, 200 40 C 206 44, 204 54, 204 58 C 206 42, 210 36, 216 42 C 220 46, 220 54, 222 58',
      // e
      'M 232 50 C 244 42, 258 46, 256 56 C 254 64, 234 64, 232 54'
    ],
    Aria: [
      // W - elegant, strong slant, calligraphic
      'M 20 68 C 24 34, 34 16, 40 54 C 44 28, 54 14, 60 52 C 62 30, 70 18, 76 60',
      // e - elegant loop
      'M 82 48 C 92 38, 108 40, 106 52 C 104 64, 84 66, 82 54 C 80 46, 86 34, 96 32',
      // l - tall, slanted
      'M 118 26 C 120 14, 118 68, 120 70',
      // c
      'M 134 52 C 132 38, 148 36, 154 42',
      // o - round, elegant
      'M 162 48 C 160 32, 180 30, 180 48 C 180 64, 162 66, 162 48',
      // m - flowing
      'M 188 58 C 188 40, 190 32, 198 38 C 206 44, 204 56, 204 58 C 204 40, 206 32, 214 38 C 222 44, 220 56, 222 58',
      // e
      'M 230 48 C 240 38, 256 40, 254 52 C 252 64, 232 66, 230 54 C 228 46, 234 34, 244 32'
    ],
    Noah: [
      // W - blocky, printed, no connections
      'M 28 62 L 28 22 L 38 58 L 48 22 L 48 62',
      // e - printed
      'M 58 42 L 76 42 M 76 38 C 76 56, 58 60, 58 48 C 58 38, 76 36, 76 42',
      // l
      'M 86 22 L 86 62',
      // c
      'M 104 52 C 104 38, 118 38, 118 44',
      // o
      'M 130 50 C 130 38, 144 38, 144 50 C 144 62, 130 62, 130 50',
      // m - blocky
      'M 154 62 L 154 38 L 164 38 L 164 62 M 170 38 L 180 38 L 180 62',
      // e
      'M 190 42 L 208 42 M 208 38 C 208 56, 190 60, 190 48 C 190 38, 208 36, 208 42'
    ],
    Zara: [
      // W - dramatic, large loops, heavy slant
      'M 18 70 C 22 28, 36 8, 42 52 C 48 20, 58 6, 64 50 C 68 24, 80 10, 86 62',
      // e - dramatic loop
      'M 92 48 C 106 36, 124 38, 122 52 C 120 68, 92 70, 92 54 C 90 46, 96 30, 112 28',
      // l - tall, expressive
      'M 132 22 C 136 8, 132 68, 136 72',
      // c
      'M 148 52 C 146 34, 166 32, 172 40',
      // o - large
      'M 182 48 C 178 28, 204 26, 204 48 C 204 68, 182 70, 182 48',
      // m - dramatic
      'M 212 60 C 212 36, 214 26, 224 34 C 234 42, 230 56, 232 60 C 232 36, 234 26, 244 34 C 254 42, 250 56, 252 60',
      // e
      'M 260 48 C 274 36, 292 38, 290 52 C 288 68, 262 70, 260 54 C 258 46, 264 30, 280 28'
    ]
  };

  // Translated welcome paths
  const WELCOME_I18N = {
    Bienvenue: {
      Emma: [
        'M 20 55 C 20 35, 26 20, 30 55 C 34 35, 40 20, 44 55 C 48 35, 54 20, 58 60',
        'M 66 48 C 78 42, 92 42, 92 52 C 92 62, 78 65, 66 58',
        'M 100 32 L 100 68',
        'M 110 52 C 110 40, 124 38, 128 42',
        'M 136 50 C 136 38, 150 36, 150 50 C 150 62, 136 64, 136 50',
        'M 158 48 C 170 42, 184 42, 184 52 C 184 62, 170 65, 158 58',
        'M 192 52 C 192 40, 206 38, 210 42',
        'M 218 50 C 218 38, 232 36, 232 50 C 232 62, 218 64, 218 50'
      ]
    },
    Bienvenido: {
      Emma: [
        'M 20 55 C 20 35, 26 20, 30 55 C 34 35, 40 20, 44 55 C 48 35, 54 20, 58 60',
        'M 66 48 C 78 42, 92 42, 92 52 C 92 62, 78 65, 66 58',
        'M 100 52 C 100 40, 114 38, 118 42',
        'M 126 50 C 126 38, 140 36, 140 50 C 140 62, 126 64, 126 50',
        'M 148 52 C 148 40, 162 38, 166 42',
        'M 174 48 C 186 42, 200 42, 200 52 C 200 62, 186 65, 174 58',
        'M 210 32 L 210 68',
        'M 220 50 C 220 38, 234 36, 234 50 C 234 62, 220 64, 220 50'
      ]
    },
    Benvenuto: {
      Emma: [
        'M 20 55 C 20 35, 26 20, 30 55 C 34 35, 40 20, 44 55 C 48 35, 54 20, 58 60',
        'M 66 48 C 78 42, 92 42, 92 52 C 92 62, 78 65, 66 58',
        'M 102 52 C 102 40, 116 38, 120 42',
        'M 130 48 C 142 42, 156 42, 156 52 C 156 62, 142 65, 130 58',
        'M 166 50 C 166 38, 180 36, 180 50 C 180 62, 166 64, 166 50',
        'M 190 32 L 190 68',
        'M 200 32 C 202 20, 200 68, 204 70',
        'M 214 50 C 214 38, 228 36, 228 50 C 228 62, 214 64, 214 50'
      ]
    }
  };

  // Style "Hello" preview paths for style cards
  const HELLO_PATHS = {
    Emma: 'M 8 38 C 12 22, 18 24, 20 36 C 22 26, 26 20, 28 36 M 34 32 C 40 28, 50 28, 50 34 C 50 40, 40 42, 34 38 C 34 32, 36 28, 40 26 M 54 22 C 54 18, 54 42, 54 42 M 60 34 C 60 26, 72 24, 72 34 C 72 42, 60 44, 60 34 M 78 34 C 78 26, 88 24, 88 34 C 88 42, 78 44, 78 34',
    James: 'M 6 40 C 8 28, 16 20, 18 36 C 20 26, 24 18, 26 38 M 32 34 C 40 28, 52 30, 50 38 C 48 46, 32 46, 32 38 M 58 24 C 60 18, 58 42, 56 44 M 64 36 C 64 28, 76 26, 76 36 C 76 44, 64 46, 64 36 M 84 36 C 84 28, 94 26, 94 36 C 94 44, 84 46, 84 36',
    Sofia: 'M 8 36 C 10 18, 18 12, 20 34 C 22 24, 28 10, 30 34 M 36 30 C 44 24, 54 26, 52 34 C 50 42, 36 44, 36 36 C 34 28, 40 22, 46 20 M 58 18 C 60 12, 58 40, 60 42 M 66 32 C 64 20, 80 18, 80 32 C 80 42, 66 44, 66 32 M 88 32 C 86 20, 100 18, 100 32 C 100 42, 88 44, 88 32',
    Marcus: 'M 8 38 L 14 18 L 18 36 L 24 18 L 24 38 M 32 34 L 48 34 L 48 38 C 46 44, 32 46, 32 36 C 32 26, 48 24, 48 30 M 54 18 L 54 40 M 62 34 C 62 26, 74 24, 74 34 C 74 42, 62 44, 62 34 M 80 34 C 80 26, 90 24, 90 34 C 90 42, 80 44, 80 34',
    Lily: 'M 10 38 C 12 20, 20 10, 22 34 C 24 22, 30 8, 32 36 M 38 28 C 46 22, 58 24, 56 32 C 54 40, 38 42, 38 34 C 36 28, 42 18, 50 16 M 62 14 C 64 8, 62 40, 64 42 M 70 30 C 68 18, 84 16, 84 30 C 84 42, 70 44, 70 30 M 92 30 C 90 18, 104 16, 104 30 C 104 42, 92 44, 92 30',
    Oliver: 'M 8 40 C 10 28, 16 20, 18 38 C 20 30, 24 22, 26 40 M 32 34 C 40 28, 52 32, 50 38 C 48 44, 34 44, 32 38 M 56 24 C 58 18, 56 42, 58 44 M 64 36 C 64 28, 76 26, 76 36 C 76 46, 64 46, 64 36 M 84 36 C 84 28, 94 26, 94 36 C 94 44, 84 46, 84 36',
    Aria: 'M 6 38 C 10 20, 16 10, 18 34 C 20 22, 28 8, 30 32 C 32 22, 38 10, 40 38 M 48 30 C 56 22, 68 24, 66 34 C 64 44, 48 46, 48 36 C 46 28, 52 18, 62 16 M 72 16 C 74 10, 72 42, 74 44 M 80 32 C 78 18, 96 16, 96 32 C 96 44, 80 46, 80 32 M 104 32 C 102 18, 118 16, 118 32 C 118 44, 104 46, 104 32',
    Noah: 'M 8 38 L 8 18 L 16 36 L 24 18 L 24 38 M 32 30 L 48 30 M 48 26 C 48 38, 32 40, 32 34 C 32 26, 48 24, 48 30 M 54 18 L 54 40 M 62 34 C 62 26, 74 24, 74 34 C 74 42, 62 44, 62 34 M 82 34 C 82 26, 92 24, 92 34 C 92 42, 82 44, 82 34',
    Zara: 'M 4 42 C 8 16, 16 6, 20 36 C 24 14, 32 4, 36 34 C 38 18, 46 8, 50 40 M 56 34 C 64 24, 78 26, 76 36 C 74 48, 54 50, 54 38 C 52 28, 60 16, 74 14 M 82 14 C 86 6, 82 44, 86 46 M 92 32 C 90 16, 110 14, 110 32 C 110 48, 92 50, 92 32 M 118 32 C 116 16, 134 14, 134 32 C 134 48, 118 50, 118 32'
  };

  // ── State ───────────────────────────────────
  let selectedStyle = 'Emma';
  let selectedPaper = 'blank';
  let deferredPrompt = null;
  let loadedFont = null; // opentype.js Font object

  // ── Font Loading ────────────────────────────
  const FONT_URL = 'https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SII.ttf';
  const FONT_URL_BOLD = 'https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjRV6SII.ttf';

  function loadFonts() {
    return new Promise((resolve) => {
      if (typeof opentype === 'undefined') {
        console.warn('opentype.js not loaded, using fallback rendering');
        resolve(null);
        return;
      }

      const fontPromises = [
        loadFont(FONT_URL),
        loadFont(FONT_URL_BOLD)
      ];

      Promise.all(fontPromises).then(([regular, bold]) => {
        loadedFont = { regular, bold };
        resolve(loadedFont);
      }).catch(() => {
        console.warn('Font loading failed, using fallback');
        resolve(null);
      });
    });
  }

  function loadFont(url) {
    return new Promise((resolve, reject) => {
      // Try loading via fetch (handles CORS for CDN)
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(buffer => {
          try {
            const font = opentype.parse(buffer);
            resolve(font);
          } catch (e) {
            reject(e);
          }
        })
        .catch(reject);
    });
  }

  // ── SVG Path Helpers ────────────────────────
  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  function estimatePathLength(pathData) {
    // Rough estimate — we'll fix this with getTotalLength() after DOM append
    return Math.max(pathData.length * 1.5, 200);
  }

  // After a path is in the DOM, get its true length and fix dasharray/offset
  function fixPathLength(pathEl) {
    try {
      const len = pathEl.getTotalLength();
      if (len && len > 0) {
        pathEl.style.strokeDasharray = len;
        pathEl.style.strokeDashoffset = len;
        // Re-trigger animation by re-setting it
        const currentAnim = pathEl.style.animation;
        if (currentAnim) {
          pathEl.style.animation = 'none';
          // Force reflow
          void pathEl.offsetWidth;
          pathEl.style.animation = currentAnim;
        }
      }
    } catch (e) {
      // getTotalLength not supported or path invalid — keep estimate
    }
  }

  // ── Variable Stroke Width Rendering ──────────
  // The "multiple stroke" technique: draw the same path at different widths
  // to simulate pen pressure variation (thicker on downstrokes)
  function renderStrokePath(parentSvg, pathData, attrs, animate, delay) {
    const weight = attrs.weight || 2;
    const ink = attrs.ink || '#1A1A1A';
    const pathLen = estimatePathLength(pathData);

    // Layer 1: Thinnest background stroke (subtle spread)
    const thin = svgEl('path', {
      d: pathData,
      fill: 'none',
      stroke: ink,
      'stroke-width': weight * 1.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.06'
    });

    // Layer 2: Medium stroke
    const medium = svgEl('path', {
      d: pathData,
      fill: 'none',
      stroke: ink,
      'stroke-width': weight * 1.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.15'
    });

    // Layer 3: Main stroke
    const main = svgEl('path', {
      d: pathData,
      fill: 'none',
      stroke: ink,
      'stroke-width': weight,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: String(attrs.opacity || 0.85)
    });

    // Layer 4: Highlight/thin center stroke for gloss
    const highlight = svgEl('path', {
      d: pathData,
      fill: 'none',
      stroke: ink,
      'stroke-width': Math.max(weight * 0.3, 0.5),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.9'
    });

    const paths = [thin, medium, main, highlight];

    if (animate) {
      paths.forEach((p, i) => {
        p.classList.add('stroke-path');
        p.style.strokeDasharray = pathLen;
        p.style.strokeDashoffset = pathLen;
        p.style.animation = `drawStroke 1.4s ease ${delay + i * 0.02}s forwards`;
      });
    }

    parentSvg.appendChild(thin);
    parentSvg.appendChild(medium);
    parentSvg.appendChild(main);
    parentSvg.appendChild(highlight);

    // Fix dasharray/offset with actual path length after DOM insertion
    if (animate) {
      // Use requestAnimationFrame to ensure paths are rendered
      requestAnimationFrame(() => {
        paths.forEach(p => fixPathLength(p));
      });
    }

    return paths;
  }

  // ── Welcome Animation ───────────────────────
  function initWelcome() {
    const langEntry = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
    const styleIdx = Math.floor(Math.random() * STYLE_NAMES.length);
    const styleName = STYLE_NAMES[styleIdx];
    const attrs = STYLE_ATTRS[styleName];

    const welcomeSvg = document.getElementById('welcome-svg');
    const headerSvg = document.getElementById('header-svg');

    // Mark overlay as JS-handled so CSS auto-hide doesn't double-fire
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) overlay.classList.add('handled');

    // Clear any existing content
    welcomeSvg.innerHTML = '';
    headerSvg.innerHTML = '';

    if (langEntry.lang === 'ja') {
      // Japanese: use styled text approach since we can't hand-draw kana
      renderJapaneseWelcome(welcomeSvg, langEntry.text, attrs);
      renderJapaneseWelcome(headerSvg, langEntry.text, attrs, true);
    } else {
      // Use hand-crafted SVG paths
      const paths = getWelcomePaths(langEntry.text, styleName);

      // Apply slant transform to the whole SVG content group
      const g = svgEl('g', {});
      if (attrs.slant > 0) {
        g.setAttribute('transform', `translate(0,0) skewX(-${attrs.slant * 0.5})`);
      }

      paths.forEach((pathData, i) => {
        renderStrokePath(g, pathData, { ...attrs, weight: attrs.weight * 1.6 }, true, i * 0.12);
      });

      welcomeSvg.appendChild(g);

      // Header version (no animation, just static paths)
      const hg = svgEl('g', {});
      if (attrs.slant > 0) {
        hg.setAttribute('transform', `skewX(-${attrs.slant * 0.5})`);
      }
      paths.forEach(pathData => {
        renderStrokePath(hg, pathData, { ...attrs, weight: attrs.weight * 1.0 }, false, 0);
      });
      headerSvg.appendChild(hg);
    }

    // After animation completes, move to header
    const animDone = () => {
      const svg = document.getElementById('welcome-svg');
      const header = document.getElementById('signature-header');
      const app = document.getElementById('app');

      svg.classList.add('moveToHeader');

      setTimeout(() => {
        overlay.classList.add('fade-out');
        header.classList.add('visible');
        app.classList.add('visible');

        // Mark welcome as done so safety timeout knows
        window._welcomeDone = true;

        setTimeout(() => {
          overlay.style.display = 'none';
        }, 600);
      }, 500);
    };

    // Wait for drawStroke animations to finish before transitioning
    // Longest animation: last letter starts at (paths.length-1)*0.12 + 3*0.02 and runs 1.4s
    // Total = (paths.length-1)*0.12 + 0.06 + 1.4
    const letterCount = (langEntry.lang === 'ja') ? 1 : getWelcomePaths(langEntry.text, styleName).length;
    const totalAnimMs = ((letterCount - 1) * 120 + 60 + 1400) + 200; // +200ms buffer
    setTimeout(animDone, Math.max(totalAnimMs, 1500));
  }

  function renderJapaneseWelcome(svgContainer, text, attrs, isHeader) {
    // For Japanese, use a text element with a nice font since we can't hand-draw it
    const textEl = svgEl('text', {
      x: '50%',
      y: '55',
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: attrs.ink || '#1A1A1A',
      'font-family': "'Caveat', cursive",
      'font-size': isHeader ? '28' : '52',
      'font-weight': '700',
      opacity: String(attrs.opacity)
    });
    textEl.textContent = text;

    if (!isHeader) {
      // Add stroke drawing animation for text
      textEl.style.stroke = attrs.ink || '#1A1A1A';
      textEl.style.strokeWidth = '1';
      textEl.style.fill = 'none';
      textEl.style.strokeDasharray = '2000';
      textEl.style.strokeDashoffset = '2000';
      textEl.style.animation = 'drawStroke 1.5s ease forwards';
      textEl.classList.add('stroke-path');
    }

    svgContainer.appendChild(textEl);
  }

  function getWelcomePaths(text, styleName) {
    // Try i18n paths first
    if (WELCOME_I18N[text] && WELCOME_I18N[text][styleName]) {
      return WELCOME_I18N[text][styleName];
    }
    // Default to "Welcome" paths
    return WELCOME_PATHS[styleName] || WELCOME_PATHS.Emma;
  }

  // ── Style Picker ────────────────────────────
  function buildStylePicker() {
    const picker = document.getElementById('style-picker');
    picker.innerHTML = '';

    STYLE_NAMES.forEach(name => {
      const card = document.createElement('button');
      card.className = 'style-card' + (name === selectedStyle ? ' active' : '');
      card.dataset.style = name;

      const svg = createStyleCardSVG(name);
      const label = document.createElement('span');
      label.className = 'style-name';
      label.textContent = name;

      card.appendChild(svg);
      card.appendChild(label);

      card.addEventListener('click', () => selectStyle(name));
      picker.appendChild(card);
    });
  }

  function createStyleCardSVG(name) {
    const attrs = STYLE_ATTRS[name];
    const pathData = HELLO_PATHS[name] || HELLO_PATHS.Emma;

    const svg = svgEl('svg', {
      viewBox: '0 0 120 56',
      xmlns: 'http://www.w3.org/2000/svg'
    });

    const g = svgEl('g', {});
    if (attrs.slant > 0) {
      g.setAttribute('transform', `skewX(-${attrs.slant * 0.4})`);
    }

    // Render the "Hello" path with variable stroke width
    renderStrokePath(g, pathData, { ...attrs, weight: attrs.weight * 0.85 }, false, 0);

    svg.appendChild(g);
    return svg;
  }

  function selectStyle(name) {
    selectedStyle = name;
    document.querySelectorAll('.style-card').forEach(c => {
      c.classList.toggle('active', c.dataset.style === name);
    });
  }

  // ── Glyph-based Text Rendering (opentype.js) ──
  function renderGlyphText(svgContainer, text, styleName, thickness, neatness, animate) {
    const attrs = STYLE_ATTRS[styleName];
    const fontSize = 32;
    const color = attrs.ink || '#1A1A1A';
    const baseWeight = thickness * attrs.weight * 0.5;

    if (!loadedFont || !loadedFont.regular) {
      // Wait for Google Fonts to be ready, then render fallback
      const render = () => renderFallbackText(svgContainer, text, styleName, thickness, neatness, animate);
      if (typeof document.fonts !== 'undefined') {
        document.fonts.ready.then(render);
      } else {
        render();
      }
      return;
    }

    const font = attrs.weight > 2.5 && loadedFont.bold ? loadedFont.bold : loadedFont.regular;
    const words = text.split(' ');
    const lineHeight = fontSize * 2.2;
    const maxX = 560;
    let x = 20;
    let y = fontSize + 10;
    let pathIndex = 0;

    // Create a group for the entire text with slant
    const mainGroup = svgEl('g', {});
    if (attrs.slant > 0) {
      mainGroup.setAttribute('transform', `skewX(-${attrs.slant * 0.3})`);
    }

    words.forEach((word, wi) => {
      const wordGlyphs = font.stringToGlyphs(word);
      const wordWidth = wordGlyphs.reduce((sum, g) => sum + g.advanceWidth, 0) * (fontSize / font.unitsPerEm) * attrs.spacing;

      if (x + wordWidth > maxX && x > 20) {
        x = 20;
        y += lineHeight;
      }

      const baselineWobble = attrs.baseline * (1 - neatness) * (Math.random() - 0.5) * 4;

      wordGlyphs.forEach((glyph, ci) => {
        if (!glyph.path || !glyph.path.commands || glyph.path.commands.length === 0) {
          // Space or empty glyph
          x += glyph.advanceWidth * (fontSize / font.unitsPerEm) * attrs.spacing;
          return;
        }

        const scale = fontSize / font.unitsPerEm;
        const glyphPath = glyph.getPath(x, y + baselineWobble, fontSize);
        let pathD = glyphPath.toPathData ? glyphPath.toPathData() : glyphPath.toPathData(2);

        // Add jitter per character
        const jitterX = (1 - neatness) * (Math.random() - 0.5) * 2 * attrs.baseline;
        const jitterY = (1 - neatness) * (Math.random() - 0.5) * 1.5;
        const rotation = (1 - neatness) * (Math.random() - 0.5) * 4 - attrs.slant * 0.2;

        // Apply small transform for jitter
        if (jitterX || jitterY || rotation) {
          const cx = x + (glyph.advanceWidth * scale * attrs.spacing) / 2;
          const cy = y + baselineWobble;
          const charGroup = svgEl('g', {
            transform: `translate(${jitterX}, ${jitterY}) rotate(${rotation}, ${cx}, ${cy})`
          });

          // Variable stroke width rendering
          renderVariableStrokePath(charGroup, pathD, baseWeight, color, attrs, animate, pathIndex * 0.03);
          mainGroup.appendChild(charGroup);
        } else {
          renderVariableStrokePath(mainGroup, pathD, baseWeight, color, attrs, animate, pathIndex * 0.03);
        }

        x += glyph.advanceWidth * scale * attrs.spacing;
        pathIndex++;
      });

      // Word spacing
      x += fontSize * 0.4 * attrs.spacing;
    });

    svgContainer.appendChild(mainGroup);

    // Update viewBox
    const totalHeight = y + fontSize + 20;
    svgContainer.setAttribute('viewBox', `0 0 600 ${Math.max(200, totalHeight)}`);
  }

  function renderVariableStrokePath(parent, pathD, weight, color, attrs, animate, delay) {
    // Multiple stroke layers for pen pressure effect

    // Wide soft background
    const bg = svgEl('path', {
      d: pathD,
      fill: 'none',
      stroke: color,
      'stroke-width': weight * 2.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.05'
    });

    // Medium spread
    const spread = svgEl('path', {
      d: pathD,
      fill: 'none',
      stroke: color,
      'stroke-width': weight * 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.12'
    });

    // Main stroke
    const main = svgEl('path', {
      d: pathD,
      fill: 'none',
      stroke: color,
      'stroke-width': weight,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: String(attrs.opacity || 0.85)
    });

    // Fine center line for pen highlight
    const fine = svgEl('path', {
      d: pathD,
      fill: 'none',
      stroke: color,
      'stroke-width': Math.max(weight * 0.35, 0.4),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: '0.92'
    });

    const paths = [bg, spread, main, fine];

    if (animate) {
      const estLen = Math.max(pathD.length * 1.2, 100);
      paths.forEach((p, i) => {
        p.classList.add('draw-path');
        p.style.strokeDasharray = estLen;
        p.style.strokeDashoffset = estLen;
        p.style.animation = `previewDraw ${0.3 + Math.random() * 0.2}s ease ${delay + i * 0.01}s forwards`;
      });
    }

    parent.appendChild(bg);
    parent.appendChild(spread);
    parent.appendChild(main);
    parent.appendChild(fine);

    // Fix dasharray/offset with actual path length after DOM insertion
    if (animate) {
      requestAnimationFrame(() => {
        paths.forEach(p => {
          try {
            const len = p.getTotalLength();
            if (len && len > 0) {
              const currentAnim = p.style.animation;
              p.style.strokeDasharray = len;
              p.style.strokeDashoffset = len;
              p.style.animation = 'none';
              void p.offsetWidth;
              p.style.animation = currentAnim;
            }
          } catch(e) {}
        });
      });
    }
  }

  // ── Fallback Rendering (when opentype.js fails) ──
  function renderFallbackText(svgContainer, text, styleName, thickness, neatness, animate) {
    const attrs = STYLE_ATTRS[styleName];
    const fontSize = 28;
    const color = attrs.ink || '#1A1A1A';
    const baseWeight = thickness * attrs.weight * 0.5;
    const words = text.split(' ');
    const lineHeight = fontSize * 2;
    const maxX = 560;
    let x = 20;
    let y = fontSize + 15;
    let charIndex = 0;

    const mainGroup = svgEl('g', {});
    if (attrs.slant > 0) {
      mainGroup.setAttribute('transform', `skewX(-${attrs.slant * 0.3})`);
    }

    // Use canvas to measure text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px Caveat, cursive`;

    words.forEach((word, wi) => {
      const wordWidth = ctx.measureText(word).width * attrs.spacing;
      if (x + wordWidth > maxX && x > 20) {
        x = 20;
        y += lineHeight;
      }

      const baselineWobble = attrs.baseline * (1 - neatness) * (Math.random() - 0.5) * 4;

      // Render each character as a text element with path-like styling
      for (let ci = 0; ci < word.length; ci++) {
        const char = word[ci];
        const charWidth = ctx.measureText(char).width * attrs.spacing;
        const jitterX = (1 - neatness) * (Math.random() - 0.5) * 2;
        const jitterY = (1 - neatness) * (Math.random() - 0.5) * 1.5;
        const rotation = (1 - neatness) * (Math.random() - 0.5) * 4 - attrs.slant * 0.2;

        // Create a group for the character with multiple text layers (simulating variable stroke)
        const charGroup = svgEl('g', {
          transform: `translate(${x + jitterX}, ${y + baselineWobble + jitterY}) rotate(${rotation})`
        });

        // Background layer (wider, lighter)
        const bgText = svgEl('text', {
          x: '0', y: '0',
          fill: 'none',
          stroke: color,
          'stroke-width': baseWeight * 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          opacity: '0.05',
          'font-family': styleName === 'Noah' || styleName === 'Marcus' ? 'Inter, sans-serif' : 'Caveat, cursive',
          'font-size': fontSize,
          'font-weight': attrs.weight > 2.5 ? '700' : '400'
        });
        bgText.textContent = char;

        // Spread layer
        const spreadText = svgEl('text', {
          x: '0', y: '0',
          fill: 'none',
          stroke: color,
          'stroke-width': baseWeight * 1.5,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          opacity: '0.12',
          'font-family': styleName === 'Noah' || styleName === 'Marcus' ? 'Inter, sans-serif' : 'Caveat, cursive',
          'font-size': fontSize,
          'font-weight': attrs.weight > 2.5 ? '700' : '400'
        });
        spreadText.textContent = char;

        // Main stroke
        const mainText = svgEl('text', {
          x: '0', y: '0',
          fill: color,
          stroke: color,
          'stroke-width': baseWeight * 0.3,
          opacity: String(attrs.opacity || 0.85),
          'font-family': styleName === 'Noah' || styleName === 'Marcus' ? 'Inter, sans-serif' : 'Caveat, cursive',
          'font-size': fontSize,
          'font-weight': attrs.weight > 2.5 ? '700' : '400'
        });
        mainText.textContent = char;

        charGroup.appendChild(bgText);
        charGroup.appendChild(spreadText);
        charGroup.appendChild(mainText);
        mainGroup.appendChild(charGroup);

        x += charWidth;
        charIndex++;
      }

      // Word spacing
      x += fontSize * 0.4 * attrs.spacing;
    });

    svgContainer.appendChild(mainGroup);

    // Update viewBox
    const totalHeight = y + fontSize + 20;
    svgContainer.setAttribute('viewBox', `0 0 600 ${Math.max(200, totalHeight)}`);
  }

  // ── Sliders ─────────────────────────────────
  function initSliders() {
    const sliders = [
      { id: 'slider-speed', display: 'val-speed', fixed: 1 },
      { id: 'slider-neatness', display: 'val-neatness', fixed: 2 },
      { id: 'slider-thickness', display: 'val-thickness', fixed: 1 }
    ];

    sliders.forEach(s => {
      const input = document.getElementById(s.id);
      const display = document.getElementById(s.display);
      input.addEventListener('input', () => {
        display.textContent = parseFloat(input.value).toFixed(s.fixed);
      });
    });
  }

  // ── Paper Picker ────────────────────────────
  function initPaperPicker() {
    document.querySelectorAll('.paper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedPaper = btn.dataset.paper;
        document.querySelectorAll('.paper-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const paperBg = document.getElementById('paper-bg');
        paperBg.className = 'paper-bg paper-' + selectedPaper;
      });
    });
  }

  // ── Generate Preview ────────────────────────
  function initGenerate() {
    const btn = document.getElementById('generate-btn');
    const previewSvg = document.getElementById('preview-svg');
    const actions = document.getElementById('preview-actions');
    const paperBg = document.getElementById('paper-bg');

    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Writing...';

      // Show pen animation
      const pen = document.createElement('div');
      pen.className = 'pen-anim';
      pen.textContent = '\u270D';
      paperBg.appendChild(pen);

      // Clear previous
      while (previewSvg.firstChild) previewSvg.removeChild(previewSvg.firstChild);

      setTimeout(() => {
        pen.remove();

        const thickness = parseFloat(document.getElementById('slider-thickness').value);
        const neatness = parseFloat(document.getElementById('slider-neatness').value);
        const text = document.getElementById('user-text').value || 'The quick brown fox jumps over the lazy dog';

        // Render with opentype.js glyph paths
        renderGlyphText(previewSvg, text, selectedStyle, thickness, neatness, true);

        actions.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = 'Generate';
      }, 800);
    });
  }

  // ── Save / Share ────────────────────────────
  function initActions() {
    document.getElementById('save-btn').addEventListener('click', () => {
      const previewSvg = document.getElementById('preview-svg');
      // Clone and clean animation styles for clean export
      const clone = previewSvg.cloneNode(true);
      clone.querySelectorAll('.draw-path').forEach(p => {
        p.style.animation = 'none';
        p.style.strokeDasharray = 'none';
        p.style.strokeDashoffset = '0';
      });

      const svgData = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'handwrite-ai.svg';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('share-btn').addEventListener('click', async () => {
      const previewSvg = document.getElementById('preview-svg');
      const clone = previewSvg.cloneNode(true);
      clone.querySelectorAll('.draw-path').forEach(p => {
        p.style.animation = 'none';
        p.style.strokeDasharray = 'none';
        p.style.strokeDashoffset = '0';
      });

      const svgData = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const file = new File([blob], 'handwrite-ai.svg', { type: 'image/svg+xml' });

      if (navigator.share) {
        try {
          await navigator.share({ files: [file], title: 'HandWrite AI' });
        } catch (e) { /* cancelled */ }
      }
    });
  }

  // ── Character Count ─────────────────────────
  function initTextarea() {
    const textarea = document.getElementById('user-text');
    const counter = document.getElementById('char-count');

    textarea.addEventListener('input', () => {
      counter.textContent = textarea.value.length + '/200';
    });
  }

  // ── Sticky Header Shrink ────────────────────
  function initStickyHeader() {
    const header = document.getElementById('signature-header');

    window.addEventListener('scroll', () => {
      const svg = document.getElementById('header-svg');
      if (window.scrollY > 60) {
        svg.style.transform = 'scale(0.8)';
        svg.style.transition = 'transform 0.3s ease';
        header.style.paddingTop = '6px';
        header.style.paddingBottom = '4px';
      } else {
        svg.style.transform = 'scale(1)';
        header.style.paddingTop = '10px';
        header.style.paddingBottom = '6px';
      }
    }, { passive: true });
  }

  // ── PWA Install ─────────────────────────────
  function initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBanner();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  function showInstallBanner() {
    if (!deferredPrompt) return;

    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <button class="install-banner-close" aria-label="Close">&times;</button>
      <span class="install-banner-text">Add HandWrite to your home screen</span>
      <button class="install-banner-btn">Install</button>
    `;

    document.body.appendChild(banner);

    setTimeout(() => banner.classList.add('show'), 100);

    banner.querySelector('.install-banner-close').addEventListener('click', () => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 400);
    });

    banner.querySelector('.install-banner-btn').addEventListener('click', async () => {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 400);
    });
  }

  // ── Init ────────────────────────────────────
  function init() {
    // Start loading fonts in background (non-blocking)
    // Wait for both opentype.js fonts AND Google Fonts to be ready
    const fontsReady = typeof document.fonts !== 'undefined'
      ? document.fonts.ready
      : Promise.resolve();

    fontsReady.then(() => loadFonts());

    initWelcome();
    buildStylePicker();
    initSliders();
    initPaperPicker();
    initGenerate();
    initActions();
    initTextarea();
    initStickyHeader();
    initPWA();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();