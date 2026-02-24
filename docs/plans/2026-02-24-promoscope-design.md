# Promoscope Design Document

> Date: 2026-02-24
> Status: Approved

## Overview

Promoscope is a Chrome Extension (Manifest V3) combining a Pomodoro timer with automatic website tracking. Each completed session shows a time distribution of websites visited. All data stored locally — no backend, no accounts.

## Architecture

```
manifest.json                    # MV3, permissions, i18n default_locale
├── _locales/
│   ├── en/messages.json         # English strings
│   └── zh_TW/messages.json     # Traditional Chinese strings
├── background/
│   └── service-worker.js        # Timer (alarms), tab tracking (event-driven), badge
├── popup/
│   ├── popup.html/css/js        # Timer UI, session report (Chart.js), today's stats
├── settings/
│   ├── settings.html/css/js     # Work/break duration settings
├── content/
│   └── overlay.js + overlay.css # Full-screen overlay on timer end
├── libs/
│   └── chart.min.js             # Chart.js (bundled locally)
├── assets/icons/                # 16, 48, 128px
└── utils/
    └── storage.js               # chrome.storage.local helpers
```

## Key Design Decisions

### Timer Engine
- `chrome.alarms` fires every minute for reliability (survives service worker restarts)
- Store absolute `endTime` timestamp in storage for crash/restart recovery
- Badge shows remaining **minutes** (updated every minute via alarm)
- Popup uses `setInterval` for **second-level** countdown display (only while open)

### Tab Tracking (Event-Driven)
- Listen to `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged`
- On each event: calculate elapsed time since last event, credit to previous domain
- When Chrome loses focus (`WINDOW_ID_NONE`): credit subsequent time to "Other Apps"
- No polling — zero CPU when user isn't switching tabs

### Browser Close / Sleep Recovery
- On service worker wake: compare `Date.now()` with stored `endTime`
- If past `endTime`: auto-complete the session, save to history
- Next popup open shows completion notification and session report

### Data Model
Extends idea.md schema with:
- `timer.endTime`: absolute timestamp for recovery
- `currentSession.sites["Other Apps"]`: time outside Chrome

```json
{
  "timer": {
    "status": "working | break | longBreak | idle",
    "timeLeft": 1500,
    "endTime": 1700001500000,
    "completedPomodoros": 0
  },
  "currentSession": {
    "startTime": 1700000000,
    "sites": {
      "github.com": 600,
      "Other Apps": 120
    },
    "lastTrackedTime": 1700000720,
    "lastDomain": "github.com"
  },
  "history": [
    {
      "date": "2026-02-24",
      "sessions": [
        {
          "startTime": 1700000000,
          "endTime": 1700001500,
          "duration": 1500,
          "sites": { "github.com": 900, "Other Apps": 100 }
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

### Charts
- Chart.js bundled locally in `libs/` (MV3 CSP blocks external CDN)
- Session report: doughnut or horizontal bar chart of domain time distribution
- Today's stats: summary card with total time, completed rounds, top sites

### UI Style
- Soft, warm color palette (rounded corners, gradients, pastel accents)
- Inspired by Forest App / Headspace aesthetic
- Clean layout optimized for popup's small viewport (~400x500px)

### i18n
- `chrome.i18n` API with `_locales/en/` and `_locales/zh_TW/`
- All UI strings referenced via `chrome.i18n.getMessage()`
- Default locale: English

### Storage Cleanup
- Not in MVP scope (10MB supports ~5 years of daily use)
- Phase 2: export JSON + auto-purge old data

## Feature Scope

### Phase 1 (Core)
1. Pomodoro timer (25/5/15 default cycle)
2. Event-driven tab tracking with "Other Apps"
3. Session completion report (Chart.js)
4. Badge minute countdown
5. Chrome notification on completion
6. Session history storage

### Phase 2 (Included in first release)
7. Settings page (adjustable work/break durations, sound toggle)
8. Today's statistics (total work time, completed rounds, per-site totals)
9. Full-screen overlay reminder (injected into current page on timer end)

### Phase 2 (Deferred)
- Daily/weekly trend dashboard
- Site categorization (productive / distraction / neutral)
- Whitelist (exclude sites from tracking)
- Data export and cleanup

## Chrome APIs Required

| API | Purpose |
|-----|---------|
| `chrome.alarms` | Timer countdown (1-min interval) |
| `chrome.tabs.onActivated` | Detect tab switches |
| `chrome.tabs.onUpdated` | Detect URL changes within tab |
| `chrome.tabs.query` | Get active tab URL |
| `chrome.windows.onFocusChanged` | Detect Chrome losing focus |
| `chrome.storage.local` | All data persistence |
| `chrome.notifications` | Timer completion alerts |
| `chrome.action.setBadgeText` | Show remaining minutes |
| `chrome.scripting.executeScript` | Inject overlay into active tab |
| `chrome.i18n` | Bilingual UI strings |
