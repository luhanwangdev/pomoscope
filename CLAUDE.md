# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Promoscope is a Chrome Extension (Manifest V3) that combines a Pomodoro timer with automatic website tracking. Each completed Pomodoro session shows a time distribution of websites visited during that work period. All data is stored locally via `chrome.storage.local` — no backend, no accounts.

The full specification is in `idea.md` (written in Traditional Chinese).

## Tech Stack

- **Vanilla JavaScript** — no frameworks, no build tools, no bundler
- **Chrome Extension Manifest V3**
- **No package manager** — plain HTML/CSS/JS

## Development

### Loading the Extension
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the project root
4. After code changes, click the refresh icon on the extension card

### No Build Step
There is no build or compile step. Edit files directly and reload the extension.

## Architecture

```
manifest.json                  # Extension config, permissions, entry points
├── background/
│   └── service-worker.js      # Timer core (chrome.alarms), tab tracking, badge updates
├── popup/
│   ├── popup.html/css/js      # Timer UI, start/pause/reset, session reports
├── report/
│   ├── report.html/css/js     # Full-page session report (opened on timer end)
├── assets/icons/              # 16, 48, 128px extension icons
└── utils/
    └── storage.js             # chrome.storage.local helper functions
```

### Key Design Decisions

- **`chrome.alarms` for timer** — service workers get killed by the browser, so `setInterval`/`setTimeout` cannot be relied upon. `chrome.alarms` persists across service worker restarts.
- **Domain-level tracking** — tab URLs are reduced to domain only (e.g., `github.com`). Seconds are accumulated per domain during a work session.
- **Session-based data model** — each Pomodoro cycle = one session object containing `startTime`, `endTime`, `duration`, and a `sites` map of `{domain: seconds}`.

### Chrome APIs Used

| API | Purpose |
|-----|---------|
| `chrome.alarms` | Persistent timer countdown |
| `chrome.tabs.onActivated` / `onUpdated` | Detect tab switches and URL changes |
| `chrome.tabs.query` / `create` | Get current active tab URL; open report page |
| `chrome.storage.local` | All data persistence |
| `chrome.notifications` | Timer completion alerts |
| `chrome.action.setBadgeText` | Show remaining minutes on icon |

### Data Model

Timer state, current session tracking, session history, and user settings all live in `chrome.storage.local`. See `idea.md` § 資料結構 for the complete schema.

## Implementation Phases

**Phase 1 (MVP):** Timer, tab tracking, session reports, badge countdown, notifications, history storage
**Phase 2:** Full-screen overlay, daily/weekly dashboard, site categorization (productive/distraction), custom settings
