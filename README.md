# Promoscope

Pomodoro timer + automatic website tracking for Chrome. See exactly where your time went each focus session.

**番茄鐘 + 自動網站追蹤。每次專注結束，立即看到時間花在哪些網站。**

---

## Features

- **Pomodoro Timer** — 25 min work / 5 min break / 15 min long break (every 4 rounds), fully customizable
- **Automatic Website Tracking** — records which domains you visit during each session, down to the second
- **Session Reports** — visual chart showing time distribution across websites when a session ends
- **Badge Countdown** — remaining minutes displayed on the extension icon
- **Notifications** — browser notification when the timer completes
- **100% Local** — all data stored in `chrome.storage.local`, nothing leaves your device
- **Bilingual** — supports English and Traditional Chinese (繁體中文)

## 功能特色

- **番茄鐘計時器** — 預設 25 分鐘工作 / 5 分鐘休息 / 15 分鐘長休息（每 4 輪），可自訂
- **自動網站追蹤** — 專注期間自動記錄你在哪些網域停留了多少秒
- **本輪報告** — 每輪結束時以視覺化圖表顯示網站時間分佈
- **圖示倒數** — 擴充功能圖示上顯示剩餘分鐘數
- **通知提醒** — 時間到時發送瀏覽器通知
- **完全本地** — 所有資料儲存於 `chrome.storage.local`，不傳送任何資料
- **雙語支援** — 支援英文與繁體中文

---

## Install / 安裝

### From Chrome Web Store

_Coming soon._

### Manual (Developer Mode) / 手動安裝（開發者模式）

1. Clone or download this repository / 下載此專案
   ```
   git clone https://github.com/luhanwangdev/promoscope.git
   ```
2. Open `chrome://extensions/` in Chrome / 在 Chrome 開啟 `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle) / 開啟右上角的「開發人員模式」
4. Click **Load unpacked** and select the project folder / 點選「載入未封裝項目」並選擇專案資料夾

---

## Usage / 使用方式

1. Click the Promoscope icon in the Chrome toolbar / 點擊工具列上的 Promoscope 圖示
2. Press **Start** to begin a focus session / 按下「開始」進入專注模式
3. Work normally — Promoscope tracks which sites you visit in the background / 正常工作，Promoscope 會在背景追蹤你造訪的網站
4. When the timer ends, a full-page report shows your time breakdown by domain / 計時結束後，完整報告頁面會顯示各網域的時間分佈

---

## Tech Stack / 技術架構

- Vanilla JavaScript — no frameworks, no build tools
- Chrome Extension Manifest V3
- Plain HTML / CSS / JS

```
manifest.json              # Extension manifest
├── background/
│   └── service-worker.js  # Timer (chrome.alarms), tab tracking, badge
├── popup/
│   ├── popup.html/css/js  # Timer UI, controls, today's stats
├── report/
│   ├── report.html/css/js # Full-page session report
├── settings/
│   ├── settings.html/css/js # User preferences
├── assets/icons/          # Extension icons (16, 48, 128px)
├── utils/
│   └── storage.js         # chrome.storage.local helpers
└── _locales/              # i18n (en, zh_TW)
```

---

## Privacy / 隱私

Promoscope does **not** collect, transmit, or share any data. All tracking data is stored locally on your device using Chrome's built-in storage API. There are no accounts, no analytics, no network requests.

Promoscope **不會**收集、傳送或分享任何資料。所有追蹤資料皆透過 Chrome 內建的儲存 API 存放在你的裝置上。無帳號、無分析追蹤、無網路請求。

