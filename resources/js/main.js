'use strict';

/* ==================== Translation ==================== */
let translations = {};
let currentLang = localStorage.getItem('app_lang') || 'ru';

function getTranslation(key) {
    return translations[key]?.message || key;
}

function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[key] && translations[key].message) {
            el.textContent = translations[key].message;
        }
    });

    document.documentElement.lang = currentLang;
}

function updateSelectorValue() {
    const select = document.getElementById('lang_select');
    if (select) select.value = currentLang;
}

async function loadTranslations() {
    try {
        const response = await fetch(`_locales/${currentLang}/messages.json`);
        translations = await response.json();
        
        applyTranslations();
        updateSelectorValue();
    } catch (error) {
        console.error(`Ошибка загрузки локализации для языка [${currentLang}]:`, error);
    }
}

async function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('app_lang', lang);
    await loadTranslations(); 
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadTranslations();

    const select = document.getElementById('lang_select');
    select.addEventListener('change', (e) => {
        changeLanguage(e.target.value);
    });

});

/* ==================== State ==================== */
const EXPORT_SIZE = 1024;   // size PNG/JPG
const PREVIEW_SIZE = 480;   // size preview
const QUIET_ZONE = 4;       // default space

const STATE = {
  text: 'https://example.com',
  ecLevel: 'M',
  fgColor: '#000000',
  bgColor: '#ffffff',
};

const PRESET_FG = [
  '#000000', '#2563eb', '#16a34a',
  '#dc2626', '#ea580c', '#9333ea', 
  '#0891b2', '#6b7280'
];

const PRESET_BG = [
  '#ffffff', '#e2e8f0', '#fef3c7',
  '#fee2e2', '#dcfce7', '#dbeafe',
  '#fae8ff'
];

const $ = (id) => document.getElementById(id);

const elText = $('text-input');
const elEc = $('ec-level');
const elEcHint = $('ec-hint');
const elFgSwatches = $('fg-swatches');
const elBgSwatches = $('bg-swatches');
const elFgColor = $('fg-color');
const elBgColor = $('bg-color');
const elPreviewStage = $('preview-stage');
const elPreviewImg = $('preview-img');
const elPlaceholder = $('preview-placeholder');
const elBtnSvg = $('download-svg');
const elBtnPng = $('download-png');
const elBtnJpg = $('download-jpg');
const elBtnCopySvg = $('copy-svg');
const elBtnCopyPng = $('copy-png');
const elBtnCopyJpg = $('copy-jpg');
const elToast = $('toast');

function syncPreviewBackground() {
  elPreviewStage.style.backgroundColor = STATE.bgColor;
}


function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

let toastTimer;
function toast(message, isError = false) {
  elToast.textContent = message;
  elToast.classList.toggle('error', isError);
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2600);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/* ==================== Color Swatches ==================== */
function buildSwatches(container, colors, input, onChange) {
  colors.forEach((color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = color;
    btn.title = color;
    btn.dataset.color = color;
    btn.addEventListener('click', () => {
      input.value = color;
      onChange(color);
      setActiveSwatch(container, btn);
    });
    container.appendChild(btn);
  });
}

function setActiveSwatch(container, activeBtn) {
  container.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('active', s === activeBtn);
  });
}

function syncSwatchFromPicker(container, color) {
  container.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.color === color);
  });
}

/* ==================== QR logic ==================== */
function buildQr(text, ecLevel) {
  const qr = qrcode(0, ecLevel); 
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  qr.addData(text, 'Byte');
  qr.make();
  return qr;
}

/* ==================== Create SVG ==================== */
function buildQrSvg(qr, fgColor) {
  const count = qr.getModuleCount();
  const total = count + QUIET_ZONE * 2;
  const viewSize = 1024;
  const moduleSize = viewSize / total;

  let paths = [];
  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (qr.isDark(row, col)) {
        let end = col;
        while (end < count && qr.isDark(row, end)) end++;
        const x = (col + QUIET_ZONE) * moduleSize;
        const y = (row + QUIET_ZONE) * moduleSize;
        const w = (end - col) * moduleSize;
        paths.push(`M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}v${moduleSize.toFixed(2)}h-${w.toFixed(2)}z`);
        col = end;
      } else {
        col++;
      }
    }
  }

  let parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    ` width="1024" height="1024" viewBox="0 0 ${viewSize} ${viewSize}"`,
    ` shape-rendering="crispEdges">`
  ];

  parts.push(
    `<path d="${paths.join('')}" fill="${fgColor}"/>`
  );

  parts.push('</svg>');
  return parts.join('');
}

/* ==================== Canvas render ==================== */
async function svgStringToCanvas(svgString, size) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error(getTranslation('mess_copySVG_err')));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ==================== Export ==================== */
async function renderToCanvas(opts = {}) {
  const { size = EXPORT_SIZE, background = null } = opts;
  const qr = buildQr(STATE.text, STATE.ecLevel);
  const svg = buildQrSvg(qr, STATE.fgColor);
  const canvas = await svgStringToCanvas(svg, size);

  if (background) {
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }

  return canvas;
}

async function downloadSvg() {
  try {
    const qr = buildQr(STATE.text, STATE.ecLevel);
    const svg = buildQrSvg(qr, STATE.fgColor);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `qr-${stamp()}.svg`);
    toast(getTranslation('mess_saveSVG_succes'));
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function downloadPng() {
  try {
    const canvas = await renderToCanvas({ size: EXPORT_SIZE, background: null });
    canvas.toBlob((blob) => {
      if (!blob) return toast(getTranslation('mess_saveErr'), true);
      triggerDownload(blob, `qr-${stamp()}.png`);
      toast(getTranslation('mess_savePNG_succes'));
    }, 'image/png');
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function downloadJpg() {
  try {
    const canvas = await renderToCanvas({ size: EXPORT_SIZE, background: STATE.bgColor });
    canvas.toBlob((blob) => {
      if (!blob) return toast(getTranslation('mess_saveErr'), true);
      triggerDownload(blob, `qr-${stamp()}.jpg`);
      toast(getTranslation('mess_saveJPG_succes'));
    }, 'image/jpeg', 0.92);
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function copySvgToClipboard() {
  try {
    const qr = buildQr(STATE.text, STATE.ecLevel);
    const svg = buildQrSvg(qr, STATE.fgColor);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/svg+xml': blob })]);
      toast(getTranslation('mess_copySVG_success'));
    } else {
      toast(getTranslation('mess_saveErr'), true);
    }
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function copyPngToClipboard() {
  try {
    const canvas = await renderToCanvas({ size: 1024, background: null });
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast(getTranslation('mess_copyPNG_success'));
    } else {
      toast(getTranslation('mess_saveErr'), true);
    }
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function copyJpgToClipboard() {
  try {
    const canvas = await renderToCanvas({ size: 1024, background: STATE.bgColor });
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast(getTranslation('mess_copyJPG_success'));
    } else {
      toast(getTranslation('mess_saveErr'), true);
    }
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

/* ==================== Preview ==================== */
async function updatePreview() {
  const text = STATE.text.trim();

  if (!text) {
    elPreviewImg.hidden = true;
    elPlaceholder.hidden = false;
    [elBtnSvg, elBtnPng, elBtnJpg, elBtnCopySvg, elBtnCopyPng, elBtnCopyJpg].forEach((b) => (b.disabled = true));
    return;
  }

  try {
    const canvas = await renderToCanvas({ size: PREVIEW_SIZE, background: null });
    const dataUrl = canvas.toDataURL('image/png');
    elPreviewImg.src = dataUrl;
    elPreviewImg.hidden = false;
    elPlaceholder.hidden = true;
    [elBtnSvg, elBtnPng, elBtnJpg, elBtnCopySvg, elBtnCopyPng, elBtnCopyJpg].forEach((b) => (b.disabled = false));
  } catch (e) {
  }
}

const renderDebounced = debounce(() => {
  updatePreview();
}, 200);

/* ==================== Events ==================== */
elText.addEventListener('input', () => {
  STATE.text = elText.value;
  renderDebounced();
});

elEc.addEventListener('change', () => {
  STATE.ecLevel = elEc.value;
  renderDebounced();
});

elFgColor.addEventListener('input', () => {
  STATE.fgColor = elFgColor.value;
  syncSwatchFromPicker(elFgSwatches, STATE.fgColor);
  renderDebounced();
});

elBgColor.addEventListener('input', () => {
  STATE.bgColor = elBgColor.value;
  syncSwatchFromPicker(elBgSwatches, STATE.bgColor);
  syncPreviewBackground();
});

elBtnSvg.addEventListener('click', downloadSvg);
elBtnPng.addEventListener('click', downloadPng);
elBtnJpg.addEventListener('click', downloadJpg);
elBtnCopySvg.addEventListener('click', copySvgToClipboard);
elBtnCopyPng.addEventListener('click', copyPngToClipboard);
elBtnCopyJpg.addEventListener('click', copyJpgToClipboard);


/* ==================== Init QR ==================== */
function init() {
  const ecLabels = {
    L: 'L',
    M: 'M',
    Q: 'Q',
    H: 'H'
  };

  buildSwatches(elFgSwatches, PRESET_FG, elFgColor, (color) => {
    STATE.fgColor = color;
    renderDebounced();
  });
  buildSwatches(elBgSwatches, PRESET_BG, elBgColor, (color) => {
    STATE.bgColor = color;
    syncPreviewBackground();
  });

  // Default statch
  const activeFg = elFgSwatches.querySelector(`[data-color="${STATE.fgColor}"]`);
  if (activeFg) activeFg.classList.add('active');
  const activeBg = elBgSwatches.querySelector(`[data-color="${STATE.bgColor}"]`);
  if (activeBg) activeBg.classList.add('active');

  renderDebounced();
  syncPreviewBackground();
}

init();