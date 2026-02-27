/**
 * Storage helper for Promoscope Chrome Extension.
 * Wraps chrome.storage.local with typed accessors for timer state,
 * session tracking, history, and user settings.
 *
 * Compatible with both service worker (importScripts) and popup (ES module)
 * contexts via the global `Storage` namespace.
 */

/* eslint-disable no-unused-vars */
/* global chrome */

const Storage = (() => {
  // ── Defaults ──────────────────────────────────────────────────────────

  const DEFAULTS = {
    timer: {
      status: 'idle',        // 'idle' | 'working' | 'break' | 'longBreak'
      timeLeft: 1500,         // seconds remaining
      endTime: null,          // epoch ms when alarm fires (null if not running)
      completedPomodoros: 0
    },
    settings: {
      workDuration: 1500,      // 25 min
      breakDuration: 300,      // 5 min
      longBreakDuration: 900,  // 15 min
      longBreakInterval: 4,    // long break every N pomodoros
      soundEnabled: true
    }
  };

  // ── Internal helpers ──────────────────────────────────────────────────

  /**
   * Read one or more keys from chrome.storage.local.
   * @param {string|string[]} keys
   * @returns {Promise<Object>}
   */
  function _get(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Write key/value pairs to chrome.storage.local.
   * @param {Object} data
   * @returns {Promise<void>}
   */
  function _set(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove one or more keys from chrome.storage.local.
   * @param {string|string[]} keys
   * @returns {Promise<void>}
   */
  function _remove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  // ── Timer ─────────────────────────────────────────────────────────────

  /**
   * Get the current timer state, merged with defaults for any missing fields.
   * @returns {Promise<Object>}
   */
  async function getTimer() {
    const { timer } = await _get('timer');
    return { ...DEFAULTS.timer, ...timer };
  }

  /**
   * Merge partial timer data into the stored timer object and persist.
   * @param {Object} timerData - partial timer fields to update
   * @returns {Promise<void>}
   */
  async function setTimer(timerData) {
    const current = await getTimer();
    const merged = { ...current, ...timerData };
    return _set({ timer: merged });
  }

  // ── Current Session ───────────────────────────────────────────────────

  /**
   * Get the in-progress session object, or null if none exists.
   * @returns {Promise<Object|null>}
   */
  async function getCurrentSession() {
    const { currentSession } = await _get('currentSession');
    return currentSession ?? null;
  }

  /**
   * Save (or overwrite) the current in-progress session.
   * @param {Object} session - { startTime, sites, ... }
   * @returns {Promise<void>}
   */
  async function setCurrentSession(session) {
    return _set({ currentSession: session });
  }

  /**
   * Remove the current session from storage (e.g. after completing or resetting).
   * @returns {Promise<void>}
   */
  async function clearCurrentSession() {
    return _remove('currentSession');
  }

  // ── History ───────────────────────────────────────────────────────────

  /**
   * Get the full session history array.
   * Structure: [{ date: "YYYY-MM-DD", sessions: [...] }, ...]
   * @returns {Promise<Array>}
   */
  async function getHistory() {
    const { history } = await _get('history');
    return history ?? [];
  }

  /**
   * Append a completed session to today's entry in the history.
   * Creates a new date entry if one doesn't exist for today.
   *
   * @param {Object} session - { startTime, endTime, duration, sites }
   *   - startTime {number}  epoch ms
   *   - endTime   {number}  epoch ms
   *   - duration  {number}  seconds
   *   - sites     {Object}  { domain: seconds, ... }
   * @returns {Promise<void>}
   */
  async function addSessionToHistory(session) {
    const history = await getHistory();
    const today = getTodayDateString();

    let dayEntry = history.find((entry) => entry.date === today);
    if (!dayEntry) {
      dayEntry = { date: today, sessions: [] };
      history.push(dayEntry);
    }

    dayEntry.sessions.push(session);
    return _set({ history });
  }

  // ── Settings ──────────────────────────────────────────────────────────

  /**
   * Get user settings, merged with defaults for any missing fields.
   * @returns {Promise<Object>}
   */
  async function getSettings() {
    const { settings } = await _get('settings');
    return { ...DEFAULTS.settings, ...settings };
  }

  /**
   * Merge partial settings into the stored settings and persist.
   * @param {Object} settings - partial settings fields to update
   * @returns {Promise<void>}
   */
  async function setSettings(settings) {
    const current = await getSettings();
    const merged = { ...current, ...settings };
    return _set({ settings: merged });
  }

  // ── Date helpers ──────────────────────────────────────────────────────

  /**
   * Return today's date as a "YYYY-MM-DD" string in local time.
   * @returns {string}
   */
  function getTodayDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Return only today's sessions from the history.
   * @returns {Promise<Array>} array of session objects for today (may be empty)
   */
  async function getTodaySessions() {
    const history = await getHistory();
    const today = getTodayDateString();
    const dayEntry = history.find((entry) => entry.date === today);
    return dayEntry ? dayEntry.sessions : [];
  }

  // ── Last Session for Report ──────────────────────────────────────────

  async function setLastSessionForReport(session) {
    return _set({ lastSessionForReport: session });
  }

  async function getLastSessionForReport() {
    const { lastSessionForReport } = await _get('lastSessionForReport');
    return lastSessionForReport ?? null;
  }

  async function clearLastSessionForReport() {
    return _remove('lastSessionForReport');
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    DEFAULTS,
    getTimer,
    setTimer,
    getCurrentSession,
    setCurrentSession,
    clearCurrentSession,
    getHistory,
    addSessionToHistory,
    getSettings,
    setSettings,
    getTodaySessions,
    getTodayDateString,
    setLastSessionForReport,
    getLastSessionForReport,
    clearLastSessionForReport
  };
})();
