/**
 * Promoscope Service Worker
 *
 * Responsibilities:
 * 1. Timer engine (chrome.alarms-based, survives SW restarts)
 * 2. Badge countdown (minutes remaining)
 * 3. Notifications on timer completion
 * 4. Message handling from popup
 * 5. Timer recovery after browser restart / SW wake
 */

/* global Storage, chrome */
importScripts('/utils/storage.js');

const ALARM_NAME = 'pomodoroTick';

// Badge colors per timer state
const BADGE_COLORS = {
  working: '#E8836B',
  break: '#6BCB77',
  longBreak: '#6B9FE8',
  idle: '#CCCCCC'
};

// ── Timer Actions ─────────────────────────────────────────────────────

/**
 * Start or resume the timer for a given duration.
 * Creates an alarm and stores the absolute endTime for crash recovery.
 */
async function startTimer() {
  const timer = await Storage.getTimer();
  const settings = await Storage.getSettings();

  let duration;
  let status;

  if (timer.status === 'idle') {
    // Fresh start — begin work session
    duration = settings.workDuration;
    status = 'working';
  } else if (timer.endTime === null) {
    // Resuming from pause — keep the same status (could be working, break, or longBreak)
    duration = timer.timeLeft;
    status = timer.status;
  } else {
    // Already running — ignore
    return;
  }

  const endTime = Date.now() + duration * 1000;

  await Storage.setTimer({
    status,
    timeLeft: duration,
    endTime
  });

  chrome.alarms.create(ALARM_NAME, { when: endTime, periodInMinutes: 1 });
  updateBadge(Math.ceil(duration / 60), status);

  // Initialize tracking session only when starting fresh work
  if (timer.status === 'idle') {
    await initTrackingSession();
  }
}

/**
 * Start a break timer (called after work completes).
 */
async function startBreak() {
  const timer = await Storage.getTimer();
  // Guard: if already on a break, don't restart it
  if (timer.status === 'break' || timer.status === 'longBreak') return;

  const settings = await Storage.getSettings();

  const isLongBreak = timer.completedPomodoros > 0 &&
    timer.completedPomodoros % settings.longBreakInterval === 0;

  const breakType = isLongBreak ? 'longBreak' : 'break';
  const duration = isLongBreak ? settings.longBreakDuration : settings.breakDuration;
  const endTime = Date.now() + duration * 1000;

  await Storage.setTimer({
    status: breakType,
    timeLeft: duration,
    endTime
  });

  chrome.alarms.create(ALARM_NAME, { when: endTime, periodInMinutes: 1 });
  updateBadge(Math.ceil(duration / 60), breakType);
}

/**
 * Pause the timer — clear alarm, store remaining time.
 */
async function pauseTimer() {
  const timer = await Storage.getTimer();
  if (timer.status === 'idle') return;

  const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));

  await Storage.setTimer({
    timeLeft: remaining,
    endTime: null
  });

  chrome.alarms.clear(ALARM_NAME);
  updateBadge(Math.ceil(remaining / 60), timer.status);
}

/**
 * Reset timer to idle state.
 */
async function resetTimer() {
  const settings = await Storage.getSettings();

  await Storage.setTimer({
    status: 'idle',
    timeLeft: settings.workDuration,
    endTime: null
  });

  chrome.alarms.clear(ALARM_NAME);
  clearBadge();
  await Storage.clearCurrentSession();
}

// ── Timer Completion ──────────────────────────────────────────────────

/**
 * Handle timer reaching zero.
 * Transitions: working → break, break/longBreak → working.
 */
async function onTimerComplete() {
  const timer = await Storage.getTimer();
  const settings = await Storage.getSettings();

  chrome.alarms.clear(ALARM_NAME);

  if (timer.status === 'working') {
    // Capture session data BEFORE finalizing (which clears it)
    const sessionData = await captureSessionData();

    // Work session ended — save session, increment pomodoros
    await finalizeTrackingSession();

    const newCount = timer.completedPomodoros + 1;
    await Storage.setTimer({
      completedPomodoros: newCount,
      timeLeft: 0,
      endTime: null,
      status: 'idle'
    });

    sendNotification(
      chrome.i18n.getMessage('workLabel'),
      chrome.i18n.getMessage('completed') + '!'
    );

    // Open report page with session data
    if (sessionData) {
      await Storage.setLastSessionForReport(sessionData);
      chrome.tabs.create({ url: chrome.runtime.getURL('report/report.html') });
    }

    // Auto-start break
    await startBreak();

  } else if (timer.status === 'break' || timer.status === 'longBreak') {
    // Break ended — ready for next work session
    await Storage.setTimer({
      status: 'idle',
      timeLeft: settings.workDuration,
      endTime: null
    });

    clearBadge();

    sendNotification(
      chrome.i18n.getMessage('breakLabel'),
      chrome.i18n.getMessage('completed') + '!'
    );
  }
}

// ── Tracking Session ──────────────────────────────────────────────────

/**
 * Initialize a new tracking session when work starts.
 */
async function initTrackingSession() {
  const now = Date.now();
  let lastDomain = null;

  // Try to get current active tab's domain
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      lastDomain = extractDomain(tab.url);
    }
  } catch {
    // Tabs API may fail in some contexts
  }

  await Storage.setCurrentSession({
    startTime: now,
    sites: {},
    lastTrackedTime: Math.floor(now / 1000),
    lastDomain: lastDomain
  });
}

/**
 * Credit elapsed time to the previous domain and update tracking state.
 */
async function creditTime(newDomain) {
  const timer = await Storage.getTimer();
  if (timer.status !== 'working') return;

  const session = await Storage.getCurrentSession();
  if (!session) return;

  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - session.lastTrackedTime;

  if (elapsed > 0 && session.lastDomain) {
    session.sites[session.lastDomain] = (session.sites[session.lastDomain] || 0) + elapsed;
  }

  session.lastTrackedTime = now;
  session.lastDomain = newDomain;

  await Storage.setCurrentSession(session);
}

/**
 * Capture a snapshot of the current session data (with final time credited)
 * before it gets cleared by finalizeTrackingSession.
 * @returns {Promise<Object|null>}
 */
async function captureSessionData() {
  const session = await Storage.getCurrentSession();
  if (!session) return null;

  // Clone sites to avoid mutation
  const sites = { ...session.sites };

  // Credit remaining time to the last domain (same logic as finalize)
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - session.lastTrackedTime;
  if (elapsed > 0 && session.lastDomain) {
    sites[session.lastDomain] = (sites[session.lastDomain] || 0) + elapsed;
  }

  const totalDuration = Object.values(sites).reduce((sum, s) => sum + s, 0);

  return {
    startTime: session.startTime,
    endTime: Date.now(),
    duration: totalDuration,
    sites
  };
}

/**
 * Finalize the current tracking session and save to history.
 */
async function finalizeTrackingSession() {
  const session = await Storage.getCurrentSession();
  if (!session) return;

  // Credit remaining time to last domain
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - session.lastTrackedTime;
  if (elapsed > 0 && session.lastDomain) {
    session.sites[session.lastDomain] = (session.sites[session.lastDomain] || 0) + elapsed;
  }

  const totalDuration = Object.values(session.sites).reduce((sum, s) => sum + s, 0);

  await Storage.addSessionToHistory({
    startTime: session.startTime,
    endTime: Date.now(),
    duration: totalDuration,
    sites: session.sites
  });

  await Storage.clearCurrentSession();
}

// ── Tab Tracking Events ───────────────────────────────────────────────

/**
 * Extract domain from a URL string.
 */
function extractDomain(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:')) {
      return null;
    }
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Tab switched
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = extractDomain(tab.url);
    await creditTime(domain);
  } catch {
    // Tab may no longer exist
  }
});

// URL changed within same tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  // Only track if this is the active tab
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id === tabId) {
      const domain = extractDomain(tab.url);
      await creditTime(domain);
    }
  } catch {
    // Ignore
  }
});

// Chrome window focus changed (detect leaving Chrome)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // User left Chrome — credit to "Other Apps"
    await creditTime(chrome.i18n.getMessage('otherApps') || 'Other Apps');
  } else {
    // User returned to Chrome
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        await creditTime(extractDomain(tab.url));
      }
    } catch {
      // Ignore
    }
  }
});

// ── Badge ─────────────────────────────────────────────────────────────

function updateBadge(minutes, status) {
  chrome.action.setBadgeText({ text: String(minutes) });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[status] || BADGE_COLORS.idle });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: '' });
}

// ── Notifications ─────────────────────────────────────────────────────

function sendNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon128.png',
    title: `Promoscope — ${title}`,
    message,
    priority: 2
  });
}

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.notifications.clear(notificationId);
});

// ── Alarm Handler ─────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const timer = await Storage.getTimer();
  if (!timer.endTime) return;

  const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));

  if (remaining <= 0) {
    await onTimerComplete();
  } else {
    const minutes = Math.ceil(remaining / 60);
    updateBadge(minutes, timer.status);
    await Storage.setTimer({ timeLeft: remaining });
  }
});

// ── Message Handler (from popup) ──────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handlers = {
    start: startTimer,
    pause: pauseTimer,
    reset: resetTimer,
    startBreak: startBreak,
    checkComplete: async () => {
      const timer = await Storage.getTimer();
      if (timer.endTime) {
        const remaining = Math.round((timer.endTime - Date.now()) / 1000);
        if (remaining <= 0) {
          await onTimerComplete();
        }
      }
    },
    getState: async () => {
      const timer = await Storage.getTimer();
      const session = await Storage.getCurrentSession();
      return { timer, session };
    }
  };

  const handler = handlers[message.action];
  if (handler) {
    handler().then((result) => sendResponse(result ?? { ok: true }));
    return true; // Keep message channel open for async response
  }
});

// ── Recovery on Service Worker Start ──────────────────────────────────

(async function recoverTimer() {
  const timer = await Storage.getTimer();

  if (timer.status === 'idle' || !timer.endTime) {
    clearBadge();
    return;
  }

  const remaining = Math.round((timer.endTime - Date.now()) / 1000);

  if (remaining <= 0) {
    // Timer expired while SW was dead
    await onTimerComplete();
  } else {
    // Timer still running — re-create alarm and update badge
    chrome.alarms.create(ALARM_NAME, { when: timer.endTime, periodInMinutes: 1 });
    updateBadge(Math.ceil(remaining / 60), timer.status);
  }
})();

console.log('Promoscope service worker loaded');
