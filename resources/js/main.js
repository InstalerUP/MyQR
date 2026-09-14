'use strict';

/* ==================== Neutralino init ==================== */
if (typeof window.Neutralino !== 'undefined' && window.NL_PORT) {
  try {
    Neutralino.init();
  } catch (e) {
    console.warn('Neutralino init failed', e);
  }
}

/* ==================== Translation ==================== */
const SETTINGS_KEY = 'app_lang';
const DEFAULT_LANG = 'ru';

let translations = {};
let currentLang = DEFAULT_LANG;

function getTranslation(key) {
    return translations[key]?.message || key;
}

/* ==================== Persistent settings ==================== */
/*
  Neutralino.storage хранит настройки в папке данных приложения и не зависит
  от порта локального сервера. localStorage оставлен как резервный вариант
  (в собранном приложении он бесполезен: порт при каждом запуске новый,
  поэтому origin — и хранилище вместе с ним — каждый раз другой).
*/
function hasNativeStorage() {
    return typeof window.Neutralino !== 'undefined' &&
           !!window.Neutralino.storage &&
           !!window.NL_PORT;
}

async function readSetting(key) {
    if (hasNativeStorage()) {
        try {
            const value = await Neutralino.storage.getData(key);
            if (value) return value;
        } catch (e) {
            // записи ещё нет — это нормально, пробуем резервное хранилище
        }
    }

    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

async function writeSetting(key, value) {
    if (hasNativeStorage()) {
        try {
            await Neutralino.storage.setData(key, value);
        } catch (e) {
            console.warn(`Не удалось сохранить настройку "${key}":`, e);
        }
    }

    try {
        localStorage.setItem(key, value);
    } catch (e) {
        // localStorage может быть недоступен — игнорируем
    }
}

/* Список доступных языков берём из самого селектора */
function availableLangs() {
    const select = document.getElementById('lang_select');
    if (!select) return [DEFAULT_LANG];
    return Array.from(select.options).map((option) => option.value);
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

/* Читает сохранённый язык и применяет локализацию */
async function initLanguage() {
    const saved = await readSetting(SETTINGS_KEY);
    currentLang = availableLangs().includes(saved) ? saved : DEFAULT_LANG;
    await loadTranslations();
}

async function changeLanguage(lang) {
    currentLang = lang;
    await writeSetting(SETTINGS_KEY, lang);
    await loadTranslations(); 
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    initLanguage();

    const select = document.getElementById('lang_select');
    if (select) {
        select.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }

});

/* Версия приложения в подвале — после готовности Neutralino */
if (typeof window.Neutralino !== 'undefined') {
    try {
        Neutralino.events.on("ready", () => {
            // Находим наш элемент и вставляем в него текст с авто-версией
            const versionLabel = document.getElementById("footer-appName");
            if (versionLabel) {
                versionLabel.innerHTML = `<b>MyQR</b> | v${window.NL_APPVERSION}`;
            }
        });
    } catch (e) {
        console.warn('Neutralino ready handler failed', e);
    }
}


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

/* ==================== Native save dialog (Neutralino) ==================== */
function isNativeMode() {
  return typeof window.Neutralino !== 'undefined' &&
         !!window.Neutralino.os &&
         !!window.Neutralino.filesystem &&
         !!window.NL_PORT &&
         (!window.NL_MODE || window.NL_MODE === 'window');
}

async function pickSavePath(fileName, filters) {
  let defaultPath = fileName;
  try {
    const dir = await Neutralino.os.getPath('downloads');
    if (dir) defaultPath = `${dir}/${fileName}`;
  } catch (e) {
    // если папку загрузок получить не удалось — открываем диалог с именем файла
  }
  return await Neutralino.os.showSaveDialog('Save QR code', {
    defaultPath,
    filters
  });
}

/* Пытается сохранить файл через системный диалог выбора пути.
   Возвращает: 'saved' (сохранено), 'cancelled' (пользователь отменил)
   или 'fallback' (нативный способ недоступен/не сработал). */
async function saveFileViaDialog(fileName, filters, data, isText = false) {
  if (!isNativeMode()) return 'fallback';

  try {
    const path = await pickSavePath(fileName, filters);
    if (!path) return 'cancelled';

    if (isText) {
      await Neutralino.filesystem.writeFile(path, data);
    } else {
      await Neutralino.filesystem.writeBinaryFile(path, data);
    }
    return 'saved';
  } catch (e) {
    console.warn('Native save failed, falling back to browser download', e);
    return 'fallback';
  }
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
    const fileName = `qr-${stamp()}.svg`;
    const filters = [{ name: 'SVG Image', extensions: ['svg'] }];

    const result = await saveFileViaDialog(fileName, filters, svg, true);
    if (result === 'cancelled') return;
    if (result === 'fallback') {
      triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName);
    }

    toast(getTranslation('mess_saveSVG_succes'));
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function downloadPng() {
  try {
    const canvas = await renderToCanvas({ size: EXPORT_SIZE, background: null });
    const fileName = `qr-${stamp()}.png`;
    const filters = [{ name: 'PNG Image', extensions: ['png'] }];
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });

    const result = await saveFileViaDialog(fileName, filters, await blob.arrayBuffer());
    if (result === 'cancelled') return;
    if (result === 'fallback') triggerDownload(blob, fileName);

    toast(getTranslation('mess_savePNG_succes'));
  } catch (e) {
    toast(getTranslation('mess_saveErr'), true);
  }
}

async function downloadJpg() {
  try {
    const canvas = await renderToCanvas({ size: EXPORT_SIZE, background: STATE.bgColor });
    const fileName = `qr-${stamp()}.jpg`;
    const filters = [{ name: 'JPG Image', extensions: ['jpg', 'jpeg'] }];
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.92);
    });

    const result = await saveFileViaDialog(fileName, filters, await blob.arrayBuffer());
    if (result === 'cancelled') return;
    if (result === 'fallback') triggerDownload(blob, fileName);

    toast(getTranslation('mess_saveJPG_succes'));
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