# Site-Aware Pomodoro — Chrome Extension

## 一句話描述
我要做一個 chrome extension
番茄鐘 + 自動追蹤每個 session 內你在哪些網站花了多少時間。零帳號、純本地、輕量。

## 核心差異化
市面上 Pomodoro 類只計時不追蹤行為；Time Tracker 類只記錄不給結構。這個工具把兩者結合：每完成一輪 Pomodoro，你會看到這 25 分鐘的網站時間分佈。

---

## MVP 功能（Phase 1）

### 計時器
- 預設 25 分鐘工作 / 5 分鐘休息 / 15 分鐘長休息（每 4 輪）
- Popup UI 顯示倒數計時、開始/暫停/重置
- 時間到時發送 Chrome notification

### 自動網站追蹤
- 計時期間每秒記錄當前 active tab 的 domain
- 累計每個 domain 的停留秒數
- Session 結束時產生該輪的網站時間分佈

### Session 報告
- Popup 內顯示上一輪的 domain 時間分佈（簡單 bar chart）
- 顯示 top 3 網站 + 百分比

### 資料儲存
- 全部用 `chrome.storage.local`，不需要後端
- 儲存每日的 session 歷史

---

## Phase 2（MVP 完成後）

### 遮罩提醒
- 時間到時在當前頁面注入全螢幕遮罩
- 顯示本輪網站分佈摘要 + 「開始休息」按鈕

### 每日/每週統計 Dashboard
- New Tab Override 或 Popup 內的統計頁
- 每日總工作時間、完成幾輪、各網站累計時間
- 簡單的趨勢圖（過去 7 天）

### 網站分類標籤
- 讓使用者自訂分類（如 productive / distraction / neutral）
- 報告時顯示 productive vs distraction 比例

### 自訂設定
- 可調整工作/休息時長
- 可設定白名單（某些網站不計入追蹤）
- 通知音效開關

---

## 技術架構

```
manifest.json (Manifest V3)
├── background/
│   └── service-worker.js    — 計時器核心、tab 追蹤、alarm 管理
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js             — 計時器 UI、session 報告
├── content/
│   └── overlay.js           — Phase 2: 注入遮罩
├── assets/
│   └── icons/               — 16, 48, 128px icons
└── utils/
    └── storage.js           — chrome.storage 的 helper functions
```

### 關鍵 Chrome APIs
| API | 用途 |
|-----|------|
| `chrome.alarms` | 計時器（service worker 會被 kill，不能靠 setInterval） |
| `chrome.tabs.onActivated` | 偵測切換 tab |
| `chrome.tabs.onUpdated` | 偵測同一 tab 內換網址 |
| `chrome.tabs.query` | 取得當前 active tab 的 URL |
| `chrome.storage.local` | 儲存所有 session 資料 |
| `chrome.notifications` | 時間到提醒 |
| `chrome.scripting.executeScript` | Phase 2: 注入遮罩 |
| `chrome.action.setBadgeText` | 在 extension icon 上顯示倒數 |

### 資料結構

```json
{
  "timer": {
    "status": "working | break | longBreak | idle",
    "timeLeft": 1500,
    "completedPomodoros": 0
  },
  "currentSession": {
    "startTime": 1700000000,
    "sites": {
      "github.com": 600,
      "stackoverflow.com": 300,
      "reddit.com": 120
    }
  },
  "history": [
    {
      "date": "2026-02-24",
      "sessions": [
        {
          "startTime": 1700000000,
          "endTime": 1700001500,
          "duration": 1500,
          "sites": { "github.com": 900, "docs.google.com": 600 }
        }
      ]
    }
  ],
  "settings": {
    "workDuration": 1500,
    "breakDuration": 300,
    "longBreakDuration": 900,
    "longBreakInterval": 4,
    "soundEnabled": true
  }
}
```

---

## 建議實作順序

1. **Manifest + 空 popup** — 確認 extension 能載入
2. **Service worker 計時器** — 用 `chrome.alarms` 實作倒數，popup 顯示時間
3. **Tab 追蹤** — 計時期間記錄 active tab domain + 累計秒數
4. **Session 報告** — popup 內顯示上一輪的網站分佈
5. **Badge 倒數** — icon 上顯示剩餘分鐘數
6. **Notification** — 時間到時推播
7. **歷史紀錄** — 儲存到 storage，popup 可查看今日統計
8. **Phase 2 功能逐步加入**

---

## 設計原則
- **零摩擦**：打開就用，不需要帳號、不需要設定
- **純本地**：所有資料存在 chrome.storage.local，不送任何地方
- **輕量**：沒有 React、沒有框架，vanilla JS + CSS
- **資訊密度高**：popup 小空間內最大化有用資訊