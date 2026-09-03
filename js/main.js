'use strict';

/* ==================== Состояние ==================== */
const EXPORT_SIZE = 1024;   // размер скачиваемого PNG/JPG
const PREVIEW_SIZE = 480;   // размер preview
const QUIET_ZONE = 4;       // стандартный отступ (в модулях)

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

/* ==================== DOM ==================== */
const $ = (id) => document.getElementById(id);

const elText = $('text-input');
const elEc = $('ec-level');
const elEcHint = $('ec-hint');
const elFgSwatches = $('fg-swatches');
const elBgSwatches = $('bg-swatches');
const elFgColor = $('fg-color');
const elBgColor = $('bg-color');
const elPreviewImg = $('preview-img');
const elPlaceholder = $('preview-placeholder');
const elBtnSvg = $('download-svg');
const elBtnPng = $('download-png');
const elBtnJpg = $('download-jpg');
const elBtnCopySvg = $('copy-svg');
const elBtnCopyPng = $('copy-png');
const elBtnCopyJpg = $('copy-jpg');
const elToast = $('toast');

/* ==================== Маленькие помощники ==================== */
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

/* ==================== Свачи цветов ==================== */
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

/* ==================== QR-логика ==================== */
function buildQr(text, ecLevel) {
  const qr = qrcode(0, ecLevel); // type 0 — автоопределение версии
  // Включаем поддержку кириллицы/UTF-8 (по умолчанию библиотека режет до 1 байта)
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  qr.addData(text, 'Byte');
  qr.make();
  return qr;
}

/**
 * Строит SVG строку QR-кода.
 */
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

/* ==================== Рендер в canvas ==================== */
async function svgStringToCanvas(svgString, size) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Не удалось отрисовать SVG'));
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

/* ==================== Экспорт ==================== */
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
    toast('SVG скачан');
  } catch (e) {
    toast('Ошибка: ' + e.message, true);
  }
}

async function downloadPng() {
  try {
    const canvas = await renderToCanvas({ size: EXPORT_SIZE, background: null });
    canvas.toBlob((blob) => {
      if (!blob) return toast('Не удалось создать PNG', true);
      triggerDownload(blob, `qr-${stamp()}.png`);
      toast('PNG скачан (прозрачный)');
    }, 'image/png');
  } catch (e) {
    toast('Ошибка: ' + e.message, true);
  }
}

async function downloadJpg() {
  try {
    const canvas = await renderToCanvas({ size: EXPORT_SIZE, background: STATE.bgColor });
    canvas.toBlob((blob) => {
      if (!blob) return toast('Не удалось создать JPG', true);
      triggerDownload(blob, `qr-${stamp()}.jpg`);
      toast('JPG скачан');
    }, 'image/jpeg', 0.92);
  } catch (e) {
    toast('Ошибка: ' + e.message, true);
  }
}

async function copySvgToClipboard() {
  try {
    const qr = buildQr(STATE.text, STATE.ecLevel);
    const svg = buildQrSvg(qr, STATE.fgColor);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/svg+xml': blob })]);
      toast('Изображение скопировано в буфер (векторное)');
    } else {
      toast('Браузер не поддерживает копирование SVG.', true);
    }
  } catch (e) {
    toast('Не удалось скопировать SVG.', true);
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
      toast('Изображение скопировано в буфер (без фона)');
    } else {
      toast('Браузер не поддерживает копирование.', true);
    }
  } catch (e) {
    toast('Не удалось скопировать.', true);
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
      toast('Изображение скопировано в буфер (с фоном)');
    } else {
      toast('Браузер не поддерживает копирование изображений.', true);
    }
  } catch (e) {
    toast('Не удалось скопировать.', true);
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
    //console.error(e);
  }
}

const renderDebounced = debounce(() => {
  updatePreview();
}, 200);

/* ==================== События ==================== */
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
});

elBtnSvg.addEventListener('click', downloadSvg);
elBtnPng.addEventListener('click', downloadPng);
elBtnJpg.addEventListener('click', downloadJpg);
elBtnCopySvg.addEventListener('click', copySvgToClipboard);
elBtnCopyPng.addEventListener('click', copyPngToClipboard);
elBtnCopyJpg.addEventListener('click', copyJpgToClipboard);

/* ==================== Инициализация ==================== */
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
  });

  // активный свач по умолчанию
  const activeFg = elFgSwatches.querySelector(`[data-color="${STATE.fgColor}"]`);
  if (activeFg) activeFg.classList.add('active');
  const activeBg = elBgSwatches.querySelector(`[data-color="${STATE.bgColor}"]`);
  if (activeBg) activeBg.classList.add('active');

  renderDebounced();
}

init();