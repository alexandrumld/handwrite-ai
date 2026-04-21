/* ============================================
   HandWrite AI v2 — Main Script
   ============================================ */

(function() {
  'use strict';

  // ── Config ──────────────────────────────────
  const LANGUAGES = ['Welcome', 'Bienvenue', 'Bienvenido', 'Benvenuto', 'ようこそ'];
  const STYLE_NAMES = ['Emma', 'James', 'Sofia', 'Marcus', 'Lily', 'Oliver', 'Aria', 'Noah', 'Zara'];

  // SVG path data for each style's "Hello" preview
  const STYLE_HELLO_PATHS = {
    Emma: 'M8,40 C12,20 18,22 22,38 C26,52 30,24 36,28 C40,30 42,42 48,36 C54,28 56,18 62,32 C66,42 70,26 76,34 C80,38 84,22 90,30',
    James: 'M6,42 C10,30 16,34 22,36 C28,38 32,28 38,32 C44,38 48,26 56,34 C60,38 64,30 72,32 C76,34 80,28 88,38',
    Sofia: 'M10,38 C14,18 20,22 24,34 C28,46 32,20 38,26 C42,30 44,44 50,32 C54,22 58,28 64,36 C68,42 72,24 80,34',
    Marcus: 'M8,38 L18,38 L18,28 L28,28 L28,38 L38,38 M48,28 L48,42 M58,28 L58,42 M68,34 L78,34 M68,28 L78,42',
    Lily: 'M12,42 C16,24 20,28 24,38 C28,48 32,22 38,30 C42,36 44,46 50,34 C54,24 58,32 64,40 C68,46 72,26 80,36',
    Oliver: 'M8,38 C12,30 18,34 24,36 C30,40 34,28 40,32 L46,28 C50,34 54,40 60,36 C66,30 70,34 76,38',
    Aria: 'M8,36 C14,20 20,24 26,34 C30,42 36,22 42,28 C46,32 50,44 56,30 C60,20 66,26 72,34 C76,40 82,24 88,32',
    Noah: 'M8,36 L16,36 L16,28 L24,28 L24,36 L32,36 M40,28 L40,40 L52,40 M60,28 L60,40 L72,40',
    Zara: 'M6,40 C10,16 16,20 22,36 C26,48 30,14 38,28 C42,36 46,50 52,30 C56,14 62,24 68,38 C72,48 78,18 86,34'
  };

  // SVG path data for "The quick brown fox..." preview (longer sample per style)
  const STYLE_FULL_PATHS = {
    Emma: 'M10,30 C14,14 20,18 26,28 C30,36 36,16 42,24 C46,30 50,38 56,28 C60,20 64,24 70,32 C74,38 80,20 86,26 C90,30 94,36 100,28 C104,22 108,28 114,32 C118,36 124,18 130,26 C134,32 140,22 146,30 C150,36 156,16 162,28 C166,36 172,20 178,26 C182,30 188,36 194,28',
    James: 'M8,34 C14,28 18,30 24,32 C30,36 36,26 42,30 C48,36 54,24 60,32 C66,38 72,26 78,30 C84,34 90,28 96,36 C100,40 106,26 112,32 C118,36 124,28 130,34 C136,38 142,26 148,32 C154,36 160,28 166,34',
    Sofia: 'M10,28 C14,12 20,16 26,26 C30,36 34,14 40,22 C44,28 48,38 54,24 C58,14 64,20 70,30 C74,38 80,16 86,24 C90,30 96,38 102,26 C106,18 112,22 118,32 C122,40 128,16 134,26 C138,34 144,18 150,28',
    Marcus: 'M8,32 L18,32 L18,22 L28,22 L28,32 L38,32 L38,22 L48,22 L48,32 L58,32 L58,22 L68,22 L68,32 M78,22 L88,22 L88,32 L98,32 L98,22 L108,22 L108,32 L118,32 L118,22 L128,22',
    Lily: 'M12,34 C16,18 22,22 28,30 C32,38 38,14 44,24 C48,30 52,40 58,26 C62,16 68,24 74,34 C78,42 84,18 90,28 C94,36 100,14 106,26 C110,34 116,20 122,30 C126,38 132,16 138,28',
    Oliver: 'M8,32 C12,26 18,30 24,32 C30,36 36,26 42,30 L48,26 C52,32 56,38 62,34 C68,28 74,32 80,36 C86,40 92,28 98,32 L104,28 C108,34 112,40 118,34',
    Aria: 'M8,30 C14,14 20,18 26,28 C30,36 36,14 42,22 C46,28 52,40 58,24 C62,14 68,20 74,32 C78,40 84,16 90,26 C94,32 100,38 106,26 C110,18 116,22 122,30 C126,38 132,14 138,24',
    Noah: 'M8,30 L16,30 L16,22 L24,22 L24,30 L32,30 L32,22 L40,22 L40,30 L48,30 M56,22 L56,34 L66,34 M74,22 L74,34 L84,34 L84,22 L92,22 L92,30 L100,30',
    Zara: 'M6,32 C10,10 16,16 22,28 C26,38 30,8 38,22 C42,30 46,42 52,22 C56,6 62,18 68,34 C72,44 78,10 86,26 C90,36 96,12 102,28 C106,40 112,14 120,26 C124,34 130,10 138,24'
  };

  // Font style attributes per handwriting style
  const STYLE_ATTRS = {
    Emma:    { slant: 5, weight: 2.2, spacing: 1, loopSize: 1, baseline: 0, opacity: 1 },
    James:   { slant: 2, weight: 2.8, spacing: 1.4, loopSize: 0.5, baseline: 2, opacity: 0.9 },
    Sofia:   { slant: 3, weight: 2, spacing: 0.7, loopSize: 1.5, baseline: 0, opacity: 1 },
    Marcus:  { slant: 0, weight: 3.5, spacing: 1.2, loopSize: 0, baseline: 0, opacity: 1 },
    Lily:    { slant: 4, weight: 1.5, spacing: 1, loopSize: 1.8, baseline: 1, opacity: 0.95 },
    Oliver:  { slant: 1, weight: 2.5, spacing: 1.1, loopSize: 0.7, baseline: 3, opacity: 0.9 },
    Aria:    { slant: 8, weight: 2, spacing: 1.3, loopSize: 1.2, baseline: 0, opacity: 1 },
    Noah:    { slant: 0, weight: 3, spacing: 1.5, loopSize: 0, baseline: 0, opacity: 1 },
    Zara:    { slant: 10, weight: 2.3, spacing: 0.9, loopSize: 2, baseline: 2, opacity: 1 }
  };

  // ── State ───────────────────────────────────
  let selectedStyle = 'Emma';
  let selectedPaper = 'blank';
  let deferredPrompt = null;

  // ── Welcome Animation ───────────────────────
  function initWelcome() {
    const lang = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
    const styleIdx = Math.floor(Math.random() * STYLE_NAMES.length);
    const styleName = STYLE_NAMES[styleIdx];
    const attrs = STYLE_ATTRS[styleName];

    const welcomeText = document.getElementById('welcome-text');
    const headerText = document.getElementById('header-text');

    welcomeText.textContent = lang;
    headerText.textContent = lang;

    // Apply style-specific look
    welcomeText.style.strokeWidth = attrs.weight * 0.8;
    welcomeText.style.fontStyle = attrs.slant > 5 ? 'italic' : 'normal';
    headerText.style.fontStyle = attrs.slant > 5 ? 'italic' : 'normal';

    // After animation completes, move to header
    setTimeout(() => {
      const overlay = document.getElementById('welcome-overlay');
      const svg = document.getElementById('welcome-svg');
      const header = document.getElementById('signature-header');
      const app = document.getElementById('app');

      svg.classList.add('moveToHeader');

      setTimeout(() => {
        overlay.classList.add('fade-out');
        header.classList.add('visible');
        app.classList.add('visible');

        setTimeout(() => {
          overlay.style.display = 'none';
        }, 600);
      }, 500);
    }, 1800);
  }

  // ── Style Picker ────────────────────────────
  function createStyleSVG(name, isHello) {
    const pathData = isHello ? STYLE_HELLO_PATHS[name] : STYLE_FULL_PATHS[name];
    const attrs = STYLE_ATTRS[name];
    const color = '#1A1A1A';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', isHello ? '0 0 96 56' : '0 0 200 60');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', attrs.weight);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('opacity', attrs.opacity);

    if (attrs.slant > 0) {
      path.setAttribute('transform', `skewX(-${attrs.slant})`);
    }

    svg.appendChild(path);
    return svg;
  }

  function buildStylePicker() {
    const picker = document.getElementById('style-picker');
    STYLE_NAMES.forEach(name => {
      const card = document.createElement('button');
      card.className = 'style-card' + (name === selectedStyle ? ' active' : '');
      card.dataset.style = name;

      const svg = createStyleSVG(name, true);
      const label = document.createElement('span');
      label.className = 'style-name';
      label.textContent = name;

      card.appendChild(svg);
      card.appendChild(label);

      card.addEventListener('click', () => selectStyle(name));
      picker.appendChild(card);
    });
  }

  function selectStyle(name) {
    selectedStyle = name;
    document.querySelectorAll('.style-card').forEach(c => {
      c.classList.toggle('active', c.dataset.style === name);
    });
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

        const attrs = STYLE_ATTRS[selectedStyle];
        const text = document.getElementById('user-text').value || 'The quick brown fox jumps over the lazy dog';
        const thickness = parseFloat(document.getElementById('slider-thickness').value);
        const neatness = parseFloat(document.getElementById('slider-neatness').value);

        // Build a handwritten-style rendering of the text
        renderHandwriting(previewSvg, text, selectedStyle, thickness, neatness);

        actions.style.display = 'flex';
        btn.disabled = false;
        btn.textContent = 'Generate';
      }, 1200);
    });
  }

  function renderHandwriting(svgEl, text, styleName, thickness, neatness) {
    const attrs = STYLE_ATTRS[styleName];
    const words = text.split(' ');
    const color = '#1A1A1A';

    let x = 20;
    let y = 40;
    const maxX = 580;
    const lineHeight = 36;
    const fontSize = Math.max(16, 20 - (1 - neatness) * 6);

    words.forEach((word, wi) => {
      const wordWidth = word.length * (fontSize * 0.55 * attrs.spacing);

      if (x + wordWidth > maxX && x > 20) {
        x = 20;
        y += lineHeight;
      }

      // Add baseline wobble
      const baselineWobble = (1 - neatness) * (Math.random() - 0.5) * 6;

      word.split('').forEach((char, ci) => {
        const charX = x + ci * (fontSize * 0.55 * attrs.spacing);
        const jitter = (1 - neatness) * (Math.random() - 0.5) * 3;
        const rotation = (1 - neatness) * (Math.random() - 0.5) * 8 - attrs.slant * 0.3;

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', charX + jitter);
        textEl.setAttribute('y', y + baselineWobble);
        textEl.setAttribute('fill', color);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-family', attrs.slant > 5 ? 'serif' : (styleName === 'Noah' || styleName === 'Marcus' ? 'sans-serif' : 'cursive'));
        textEl.setAttribute('font-weight', attrs.weight > 2.5 ? 'bold' : 'normal');
        textEl.setAttribute('font-style', attrs.slant > 5 ? 'italic' : 'normal');
        textEl.setAttribute('opacity', attrs.opacity);

        if (rotation !== 0) {
          textEl.setAttribute('transform', `rotate(${rotation}, ${charX}, ${y})`);
        }

        textEl.textContent = char;
        svgEl.appendChild(textEl);
      });

      x += wordWidth + fontSize * 0.35 * attrs.spacing;
    });

    // Update SVG viewBox based on content
    const totalHeight = y + 40;
    svgEl.setAttribute('viewBox', `0 0 600 ${Math.max(200, totalHeight)}`);
  }

  // ── Save / Share ────────────────────────────
  function initActions() {
    document.getElementById('save-btn').addEventListener('click', () => {
      const svgEl = document.getElementById('preview-svg');
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'handwrite-ai.svg';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('share-btn').addEventListener('click', async () => {
      const svgEl = document.getElementById('preview-svg');
      const svgData = new XMLSerializer().serializeToString(svgEl);
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
    let lastScroll = 0;

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
      lastScroll = window.scrollY;
    }, { passive: true });
  }

  // ── PWA Install ─────────────────────────────
  function initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBanner();
    });

    // Register service worker
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