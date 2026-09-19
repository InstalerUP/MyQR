### Language:</br>
<img src="https://etf2l.org/images/flags/UnitedKingdom.gif" height="13"> - [Read in English](README.md)</br>
<img src="https://etf2l.org/images/flags/Russia.gif" height="13"> - [Читать на русском языке](README.ru.md)
---

<div align="middle">
    <img src="resources/img/app_logo_w.png" width="256px">
</div>

# MyQR – local generation of QR codes

A small utility for creating a QR code from your text or link and saving it in a convenient format. Everything works on your computer – not a single link leaves your machine.

## Screenshots
<div align="middle">
    <img width="auto" height="300" alt="MyQR-screenshot-1" src="https://github.com/user-attachments/assets/db97166b-44fa-4db7-96da-b785faf8de7b" />
    <img width="auto" height="300" alt="MyQR-screenshot-2" src="https://github.com/user-attachments/assets/7291609f-cdad-4668-bc37-bb9e25c01ba2" />
</div>

## Features

- 🔒 **Fully local.** No accounts, no ads, no analytics: the program works offline.
- 📦 **Portable version.** The program requires no installation and does not embed itself into the system.
- ✍️ **Instant operation.** The program's performance is limited only by your own device.
- 💾 **Convenient export.** Save the result or copy it to the clipboard (so you can paste it into Word, Figma, a messenger, an email, etc.).
- 🖼️ **Format of your choice.** Multiple options for saving and copying:
    - **JPG** – with a background, like a regular picture,
    - **PNG** – with a transparent background,
    - **SVG** – vector (no quality loss when scaled up).
- 🎨 **Color picker.** Set your own colors for both the code and the background.
- 🔧 **Accuracy tuning.** Lets you set the error correction levels.
- 🌍 **Interface translation.** Switch the interface language from the available list (the list keeps growing).


## Installation (Windows 10 or later)

1. Open the [**Releases**](https://github.com/InstalerUP/MyQR/releases) section.
2. Download the `MyQR-vX.Y.Z-win_x64.zip` file.
3. Unpack the archive contents into a separate folder.
4. **No installation required** – this is a portable application, just run the `.exe` file.

> For **Linux** and **macOS** you can build the project yourself using the instructions below.

## Technical information

<details>
<summary><b>Click to expand the technical information</b></summary>

<br />

### 📜 Version System
The version number is determined by three numbers (`vX.Y.Z`):
- `X` is the first number, which defines the overall direction of the project's development;
- `Y` is the second number, which defines the functional version;
- `Z` is the third number, which defines patches for fixes and minor changes.

### 🧰 Tech stack

| Layer | What is used |
| --- | --- |
| Runtime | [Neutralinojs](https://neutralino.js.org/) 6.9.0 — native window + local HTTP server + WebSocket bridge to the native API |
| Webview | WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux |
| Frontend | Plain HTML + CSS + JavaScript (ES2020+), no frameworks, no bundlers |
| QR generation | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT), connected locally as a vendored file |
| Export and clipboard | Canvas 2D API, `Blob`/`toBlob()`, clipboard via `ClipboardItem` |
| Build | [Node.js](https://nodejs.org/en/download) + the official `@neutralinojs/neu` CLI, wrapped in a custom `build.js` |

### 💡 How it works

1. **A lightweight runtime instead of Electron.** The application does not need a "second browser" shipped with it: Neutralino renders the interface in the system webview component and communicates with it over WebSocket. As a result, the application takes up very little space.
2. **Requirements.** An installed WebView2 (Windows) / WebKit (macOS) / WebKitGTK (Linux) is required. As a rule, they are preinstalled by default.
3. **Simple and predictable degradation.** `saveFileViaDialog()` returns `'saved' | 'cancelled' | 'fallback'`: if the app is not running in a native window (for example, `index.html` is simply opened in a browser) or a native call fails, a browser download via `a[download]` is silently enabled. Cancelling the dialog writes no file and shows no extra messages.
4. **Minimalistic built-in localization.** Dictionaries are `_locales/<lang>/messages.json` (the Chrome i18n format with `message` and `description`), markup is tagged with the `data-i18n` attribute, and `applyTranslations()` substitutes the strings. A new language is one JSON file plus one `<option>` in the select: the code reads the language list straight from the DOM.
5. **Settings live in `Neutralino.storage`, not in `localStorage`.** The app uses `"port": 0` (the local server port is random on every launch).

### 📁 Repository structure

```
MyQR/
├─ bin/                             # Neutralinojs runtime for all target platforms
├─ dist/                            # directory with the build result
├─ resources/                       # application frontend
│  ├─ index.html                    # markup
│  ├─ css/style.css                 # styling
│  ├─ js/                           # application scripts
│  │  ├─ main.js                    # the core application logic
│  │  ├─ qrcode.min.js              # third-party QR generator library (qrcode-generator)
│  │  └─ neutralino.js (+ .d.ts)    # Neutralino client library and types
│  ├─ img/                          # images in use
│  └─ _locales/                     # localization files directory
│     └─ {ru,en}/                   # sorted by language
│       └─ messages.json            # translation .json file
├─ neutralino.config.json           # application–system configuration
├─ build.js                         # custom application build script
└─ LICENSE                          # the license in use
```

### 🚀 Local development run

You will need [Node.js v18+ (LTS)](https://nodejs.org/en/download).

```bash
# 1. Clone the repository
git clone https://github.com/InstalerUP/MyQR.git
cd MyQR

# 2. Install the Neutralino CLI (once per machine)
npm install -g @neutralinojs/neu
#    alternative without a global install:
#    npm install -D @neutralinojs/neu && npx neu run

# 3. (optional) update the runtime in bin/ to the version from the config
neu update

# 4. Start in dev mode: application window + live reload on changes
neu run
```

### 🏗 Release build

**Windows build via the script.** As a result, a `.zip` archive with everything needed to run on Windows will appear in the `dist/` directory.
```bash 
node build.js
```
---
**Windows build without the script.**
```bash
neu build --win
```
---
**macOS build without the script.** Requires macOS 11.0 (Big Sur) or later.
```bash
neu build --mac --macos-bundle
```
---
**Linux build without the script.** Suitable for Debian / Arch / Fedora based systems.
```bash
neu build --linux
```
---

### 📄 License

The project is distributed under the **MIT** license — use, modify and embed it freely (see [LICENSE](LICENSE) for details).

</details>
