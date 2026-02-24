# Promoscope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome Extension that combines a Pomodoro timer with automatic website tracking, showing time distribution per session.

**Architecture:** Manifest V3 extension with a service worker (timer + tab tracking), popup UI (timer display + Chart.js reports), settings page, and content script overlay. All data in `chrome.storage.local`. Bilingual via `chrome.i18n`.

**Tech Stack:** Vanilla JS, HTML, CSS, Chart.js (local), Chrome Extension APIs (MV3)

**Design Doc:** `docs/plans/2026-02-24-promoscope-design.md`

---

## Task 1: Scaffold — Manifest + Empty Popup

**Files:**
- Create: `manifest.json`
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`
- Create: `assets/icons/icon16.png`, `icon48.png`, `icon128.png`
- Create: `_locales/en/messages.json`
- Create: `_locales/zh_TW/messages.json`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  "version": "0.1.0",
  "default_locale": "en",
  "permissions": [
    "alarms",
    "tabs",
    "storage",
    "notifications",
    "scripting",
    "activeTab"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  }
}
```

**Step 2: Create i18n message files**

`_locales/en/messages.json`:
```json
{
  "extName": { "message": "Promoscope" },
  "extDescription": { "message": "Pomodoro timer with automatic website tracking" },
  "startBtn": { "message": "Start" },
  "pauseBtn": { "message": "Pause" },
  "resetBtn": { "message": "Reset" },
  "workLabel": { "message": "Work" },
  "breakLabel": { "message": "Break" },
  "longBreakLabel": { "message": "Long Break" },
  "sessionReport": { "message": "Session Report" },
  "todayStats": { "message": "Today" },
  "settings": { "message": "Settings" },
  "otherApps": { "message": "Other Apps" },
  "completed": { "message": "completed" },
  "rounds": { "message": "rounds" },
  "totalWork": { "message": "Total Work" },
  "noSessions": { "message": "No sessions yet. Start your first Pomodoro!" }
}
```

`_locales/zh_TW/messages.json`:
```json
{
  "extName": { "message": "Promoscope" },
  "extDescription": { "message": "番茄鐘 + 自動網站時間追蹤" },
  "startBtn": { "message": "開始" },
  "pauseBtn": { "message": "暫停" },
  "resetBtn": { "message": "重置" },
  "workLabel": { "message": "工作" },
  "breakLabel": { "message": "休息" },
  "longBreakLabel": { "message": "長休息" },
  "sessionReport": { "message": "本輪報告" },
  "todayStats": { "message": "今日" },
  "settings": { "message": "設定" },
  "otherApps": { "message": "其他應用" },
  "completed": { "message": "已完成" },
  "rounds": { "message": "輪" },
  "totalWork": { "message": "總工作時間" },
  "noSessions": { "message": "尚無紀錄，開始你的第一個番茄鐘吧！" }
}
```

**Step 3: Create placeholder popup**

`popup/popup.html` — minimal HTML with timer display, start/pause/reset buttons. Link to `popup.css` and `popup.js`.

`popup/popup.js` — just localize text nodes using `chrome.i18n.getMessage()`.

`popup/popup.css` — basic soft-color styling (see design doc: rounded corners, pastel palette, ~400x500px).

**Step 4: Create placeholder icons**

Generate simple colored circle icons at 16x16, 48x48, 128x128. These are temporary — replace with real icons later.

**Step 5: Create empty service worker**

`background/service-worker.js` — empty file with a console.log to verify it loads.

**Step 6: Verify — Load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked", select project root
4. Verify: extension appears, popup opens, no console errors

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold manifest, popup, i18n, and icons"
```

---

## Task 2: Storage Helper — `utils/storage.js`

**Files:**
- Create: `utils/storage.js`

**Step 1: Implement storage helpers**

This module wraps `chrome.storage.local` with typed getter/setter functions for each data domain:

```js
// Key functions to implement:

// getTimer() → returns timer object or defaults
// setTimer(timerData) → merges into storage
// getCurrentSession() → returns current session or null
// setCurrentSession(session) → saves session
// clearCurrentSession() → removes current session
// getHistory() → returns full history array
// addSessionToHistory(session) → appends session to today's entry
// getSettings() → returns settings with defaults
// setSettings(settings) → saves settings
// getTodaySessions() → returns only today's sessions from history

const DEFAULTS = {
  timer: {
    status: 'idle',
    timeLeft: 1500,
    endTime: null,
    completedPomodoros: 0
  },
  settings: {
    workDuration: 1500,
    breakDuration: 300,
    longBreakDuration: 900,
    longBreakInterval: 4,
    soundEnabled: true
  }
};
```

**Step 2: Verify — test in popup console**

Open popup → DevTools → Console:
```js
// Quick manual test
const s = await chrome.storage.local.get(null);
console.log('Storage:', s);
```

**Step 3: Commit**

```bash
git add utils/storage.js
git commit -m "feat: add chrome.storage.local helper module"
```

---

## Task 3: Timer Core — Service Worker

**Files:**
- Create: `background/service-worker.js`
- Modify: `utils/storage.js` (import in service worker context)

**Step 1: Implement timer state machine in service worker**

The timer has 4 states: `idle`, `working`, `break`, `longBreak`.

Key functions:
```js
// startTimer(duration) — set alarm, store endTime, update badge
// pauseTimer() — clear alarm, store remaining timeLeft
// resetTimer() — clear alarm, reset to idle
// onAlarmFired(alarm) — update badge, check if timer done
// onTimerComplete() — transition state (working→break or break→working),
//                      send notification, save session if work period ended
// updateBadge(minutes) — chrome.action.setBadgeText
// recoverTimer() — called on service worker startup, check endTime vs now
```

State transitions:
```
idle → [start] → working → [complete] → break → [complete] → working → ...
                                                  (every 4th → longBreak)
working → [pause] → idle (preserves timeLeft)
working → [reset] → idle (resets timeLeft to workDuration)
```

**Step 2: Set up alarm-based tick**

```js
// On start: create alarm "pomodoroTick" repeating every 1 minute
// On each tick: calculate timeLeft from endTime, update badge
// When timeLeft <= 0: fire onTimerComplete()
chrome.alarms.create('pomodoroTick', { periodInMinutes: 1 });
```

**Step 3: Add service worker recovery**

```js
// On service worker startup, call recoverTimer():
// 1. Read timer from storage
// 2. If status !== 'idle' and endTime exists:
//    - If Date.now() >= endTime → call onTimerComplete()
//    - Else → re-create alarm, update badge
```

**Step 4: Verify — start timer via popup, check badge updates**

Load extension → click Start → wait 1 minute → badge should show "24".

**Step 5: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: implement timer core with alarms and badge"
```

---

## Task 4: Popup Timer UI

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.css`
- Modify: `popup/popup.js`

**Step 1: Build timer display UI**

HTML structure:
```
┌─────────────────────────┐
│    [status label]       │
│                         │
│      24:59              │  ← large countdown
│                         │
│   ● ● ● ○  (4 dots)    │  ← pomodoro progress
│                         │
│  [Start] [Reset]        │  ← buttons
│                         │
│  ─── Session Report ─── │
│  (chart area)           │
│                         │
│  ─── Today ──────────── │
│  (stats area)           │
│                         │
│            ⚙ Settings   │
└─────────────────────────┘
```

**Step 2: Implement popup.js timer sync**

```js
// On popup open:
// 1. Read timer state from storage
// 2. Calculate display time from endTime (if running) or timeLeft (if paused)
// 3. Start setInterval(1000) to update display every second
// 4. Listen for storage changes to stay in sync

// Button handlers:
// Start → send message to service worker { action: 'startTimer' }
// Pause → send message { action: 'pauseTimer' }
// Reset → send message { action: 'resetTimer' }
```

**Step 3: Style with soft color palette**

CSS guidelines:
- Background: warm off-white (`#FFF8F0` or similar)
- Primary accent: soft coral/peach gradient
- Text: warm dark gray (`#3D3D3D`)
- Buttons: rounded pill shape, soft shadows
- Timer text: large, clean sans-serif
- Pomodoro dots: filled circles for completed, outline for remaining
- Width: 380px, let height be natural

**Step 4: Verify — full timer cycle**

1. Click Start → countdown runs in popup
2. Close popup → badge still updates
3. Reopen popup → shows correct remaining time
4. Let timer complete → notification fires

**Step 5: Commit**

```bash
git add popup/
git commit -m "feat: implement popup timer UI with second-level countdown"
```

---

## Task 5: Tab Tracking — Event-Driven

**Files:**
- Modify: `background/service-worker.js`

**Step 1: Implement domain extraction**

```js
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
```

**Step 2: Implement event-driven tracking**

```js
// State: lastTrackedTime, lastDomain (stored in currentSession)
//
// creditTime():
//   - elapsed = (Date.now() / 1000) - lastTrackedTime
//   - if lastDomain: currentSession.sites[lastDomain] += elapsed
//   - update lastTrackedTime = Date.now() / 1000
//   - save to storage
//
// Listen to:
// chrome.tabs.onActivated → query tab URL → creditTime() → update lastDomain
// chrome.tabs.onUpdated (status=complete) → creditTime() → update lastDomain
// chrome.windows.onFocusChanged:
//   - WINDOW_ID_NONE → creditTime() → lastDomain = "Other Apps"
//   - else → query active tab → creditTime() → update lastDomain
//
// IMPORTANT: Only track when timer.status === 'working'
```

**Step 3: Wire tracking to timer lifecycle**

```js
// On startTimer (working):
//   - Initialize currentSession: { startTime, sites: {}, lastTrackedTime, lastDomain }
//   - Query current active tab to set initial lastDomain
//
// On timer complete (working→break):
//   - creditTime() one final time
//   - Save session to history via addSessionToHistory()
//   - Clear currentSession
```

**Step 4: Verify — start timer, switch tabs, check storage**

1. Start timer
2. Visit github.com for ~10 seconds
3. Switch to stackoverflow.com for ~10 seconds
4. Open DevTools → Application → Extension Storage → check currentSession.sites

**Step 5: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: add event-driven tab tracking during work sessions"
```

---

## Task 6: Session Report — Chart.js in Popup

**Files:**
- Create: `libs/chart.min.js` (download Chart.js v4 UMD bundle)
- Modify: `popup/popup.html` (add chart.js script tag + canvas)
- Modify: `popup/popup.js` (render chart on session complete)
- Modify: `popup/popup.css` (chart container styling)

**Step 1: Download Chart.js**

Download `chart.umd.js` (minified) from Chart.js GitHub releases. Save to `libs/chart.min.js`.

**Step 2: Add chart canvas to popup HTML**

```html
<script src="../libs/chart.min.js"></script>
<!-- In the session report section: -->
<div class="report-section">
  <h3 data-i18n="sessionReport"></h3>
  <canvas id="sessionChart" width="350" height="200"></canvas>
  <div id="topSites"></div>
</div>
```

**Step 3: Implement chart rendering**

```js
// renderSessionReport(session):
//   - If no session or no sites: show "no data" message
//   - Sort sites by seconds descending
//   - Take top 5-7 domains, group rest as "Others"
//   - Create Chart.js doughnut chart with soft color palette
//   - Show top 3 sites with time and percentage below chart
//
// Color palette for chart segments (soft pastels):
//   ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#D4A5A5']
```

**Step 4: Load last session report on popup open**

```js
// On popup open:
// 1. Check if there's a recently completed session in history
// 2. If yes, render its chart
// 3. If timer is currently working, show live session data (updating sites)
```

**Step 5: Verify — complete a pomodoro, check chart**

1. Start a work session (set to short duration for testing, e.g. 1 min in settings)
2. Visit a few sites
3. Let timer complete
4. Reopen popup → session report chart appears with correct data

**Step 6: Commit**

```bash
git add libs/ popup/
git commit -m "feat: add Chart.js session report with doughnut chart"
```

---

## Task 7: Notifications

**Files:**
- Modify: `background/service-worker.js`

**Step 1: Add notification on timer complete**

```js
// In onTimerComplete():
chrome.notifications.create('pomodoroComplete', {
  type: 'basic',
  iconUrl: '../assets/icons/icon128.png',
  title: chrome.i18n.getMessage('extName'),
  message: /* "Work session complete!" or "Break's over!" depending on state */,
  priority: 2
});
```

**Step 2: Add notification click handler**

```js
// clicking notification opens popup (default behavior) — no extra code needed
// but clear notification after click:
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
});
```

**Step 3: Verify — let timer complete, notification appears**

**Step 4: Commit**

```bash
git add background/service-worker.js
git commit -m "feat: add chrome notifications on timer completion"
```

---

## Task 8: Today's Statistics

**Files:**
- Modify: `popup/popup.html` (add stats section)
- Modify: `popup/popup.js` (render today's stats)
- Modify: `popup/popup.css` (stats card styling)
- Modify: `utils/storage.js` (add `getTodaySessions` if not done)

**Step 1: Implement stats calculation**

```js
// calculateTodayStats():
//   sessions = getTodaySessions()
//   totalWorkTime = sum of session durations
//   completedRounds = sessions.length
//   allSites = merge all session site maps, sum seconds per domain
//   topSites = sort by seconds desc, take top 5
//   return { totalWorkTime, completedRounds, topSites }
```

**Step 2: Build stats UI**

```
┌─────────────────────────┐
│  Today                  │
│                         │
│  🕐 1h 45m  │  🍅 4    │  ← total time + rounds
│                         │
│  github.com      45m    │
│  ████████████░░░  60%   │
│  docs.google.com 20m    │
│  █████░░░░░░░░░  27%    │
│  Other Apps      10m    │
│  ██░░░░░░░░░░░░  13%   │
└─────────────────────────┘
```

Use CSS bar widths (percentage-based) for the simple inline bars.

**Step 3: Verify — after a few sessions, stats reflect correctly**

**Step 4: Commit**

```bash
git add popup/ utils/
git commit -m "feat: add today's statistics with top sites"
```

---

## Task 9: Settings Page

**Files:**
- Create: `settings/settings.html`
- Create: `settings/settings.css`
- Create: `settings/settings.js`
- Modify: `popup/popup.html` (add settings link)
- Modify: `popup/popup.js` (settings link handler)

**Step 1: Build settings HTML**

Settings to expose:
- Work duration (slider or input, 1-60 min, default 25)
- Break duration (1-30 min, default 5)
- Long break duration (1-60 min, default 15)
- Long break interval (1-10, default 4)
- Sound enabled (toggle)

Display durations in minutes in the UI, store as seconds in storage.

**Step 2: Implement settings.js**

```js
// On load: read settings from storage, populate form
// On change: validate, save to storage immediately (auto-save, no submit button)
// Use chrome.i18n.getMessage() for all labels
```

**Step 3: Style settings page**

Same soft-color palette as popup. Full-page layout (not popup-sized).

**Step 4: Add settings link to popup**

Small gear icon (⚙) at bottom of popup. On click:
```js
chrome.runtime.openOptionsPage();
// OR: chrome.tabs.create({ url: 'settings/settings.html' });
```

Also register in manifest.json:
```json
"options_page": "settings/settings.html"
```

**Step 5: Wire settings to timer**

Modify service worker: when starting a new timer, read `workDuration`/`breakDuration`/`longBreakDuration` from settings instead of hardcoded values.

**Step 6: Verify — change settings, start timer, verify new durations apply**

**Step 7: Commit**

```bash
git add settings/ popup/ manifest.json background/service-worker.js
git commit -m "feat: add settings page with adjustable durations"
```

---

## Task 10: Full-Screen Overlay

**Files:**
- Create: `content/overlay.js`
- Create: `content/overlay.css`
- Modify: `background/service-worker.js` (inject overlay on timer complete)
- Modify: `manifest.json` (add content script permissions if needed)

**Step 1: Build overlay UI**

The overlay is injected via `chrome.scripting.executeScript` into the active tab when a work session completes.

```
┌──────────────────────────────────────┐
│ (semi-transparent dark backdrop)     │
│                                      │
│      ┌────────────────────┐          │
│      │  ✅ Session Done!  │          │
│      │                    │          │
│      │  github.com  60%   │          │
│      │  ██████████░░░░    │          │
│      │  docs.google  27%  │          │
│      │  █████░░░░░░░░     │          │
│      │  Other Apps   13%  │          │
│      │  ██░░░░░░░░░░░     │          │
│      │                    │          │
│      │  [Start Break]     │          │
│      └────────────────────┘          │
│                                      │
└──────────────────────────────────────┘
```

**Step 2: Implement overlay injection**

```js
// In service worker onTimerComplete() for work sessions:
// 1. Get the session data (sites map)
// 2. Inject overlay.css into active tab
// 3. Inject overlay.js with session data
//
// chrome.scripting.insertCSS({ target: { tabId }, files: ['content/overlay.css'] });
// chrome.scripting.executeScript({
//   target: { tabId },
//   files: ['content/overlay.js']
// });
// Then send session data to content script via chrome.tabs.sendMessage()
```

**Step 3: Implement overlay dismiss**

```js
// "Start Break" button in overlay:
// 1. Send message to service worker { action: 'startBreak' }
// 2. Remove overlay from DOM
//
// Also: clicking the backdrop dismisses overlay
```

**Step 4: Verify — complete a work session, overlay appears on current tab**

Test on various sites (make sure CSP of target site doesn't block injection — note: some sites like chrome:// pages cannot be injected into).

**Step 5: Commit**

```bash
git add content/ background/service-worker.js manifest.json
git commit -m "feat: add full-screen overlay on work session completion"
```

---

## Task 11: Polish & Edge Cases

**Files:**
- Modify: multiple files

**Step 1: Handle edge cases**

- `chrome://` and `edge://` URLs → cannot inject overlay, skip gracefully
- No active tab → don't crash, log warning
- Storage write failures → catch and log
- Timer running when extension updates → recover via `recoverTimer()`

**Step 2: Add sound on completion**

If `settings.soundEnabled`:
- Use `chrome.offscreen` API to play a short notification sound, OR
- Rely on system notification sound (simpler — recommended for MVP)

**Step 3: Badge color changes by state**

```js
// working → coral/red badge background
// break → green badge background
// longBreak → blue badge background
// idle → clear badge
chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' }); // working
```

**Step 4: Verify — full end-to-end test**

1. Load extension fresh
2. Adjust settings (set short durations for testing, e.g. 1 min work / 30 sec break)
3. Start timer → verify badge updates
4. Switch between tabs → verify tracking
5. Switch to another app → verify "Other Apps" tracking
6. Let timer complete → verify notification + overlay
7. Click "Start Break" on overlay → verify break starts
8. Let break complete → verify notification
9. Repeat 4 times → verify long break triggers
10. Check today's stats → verify accuracy
11. Switch Chrome language to zh_TW → verify i18n

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish edge cases, badge colors, and end-to-end flow"
```

---

## Summary

| Task | Description | Dependencies |
|------|------------|--------------|
| 1 | Scaffold: manifest, popup, i18n, icons | — |
| 2 | Storage helper module | — |
| 3 | Timer core (service worker + alarms) | 2 |
| 4 | Popup timer UI | 2, 3 |
| 5 | Tab tracking (event-driven) | 2, 3 |
| 6 | Session report (Chart.js) | 4, 5 |
| 7 | Notifications | 3 |
| 8 | Today's statistics | 5, 6 |
| 9 | Settings page | 2, 3 |
| 10 | Full-screen overlay | 5, 7 |
| 11 | Polish & edge cases | all |

**Parallel opportunities:**
- Tasks 1 + 2 can be done in parallel
- Tasks 4 + 5 + 7 can be done in parallel (all depend on 3)
- Tasks 6 + 9 can be done in parallel
