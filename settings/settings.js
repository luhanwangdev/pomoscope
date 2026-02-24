/* global chrome, Storage */

(function () {
  'use strict';

  // ── Field config ──────────────────────────────────────────────────────

  const FIELDS = [
    { id: 'workDuration',      key: 'workDuration',      type: 'number', min: 1,  max: 60, isSeconds: true },
    { id: 'breakDuration',     key: 'breakDuration',     type: 'number', min: 1,  max: 30, isSeconds: true },
    { id: 'longBreakDuration', key: 'longBreakDuration', type: 'number', min: 1,  max: 60, isSeconds: true },
    { id: 'longBreakInterval', key: 'longBreakInterval', type: 'number', min: 1,  max: 10, isSeconds: false },
    { id: 'soundEnabled',      key: 'soundEnabled',      type: 'checkbox' }
  ];

  let saveTimeout = null;

  // ── Localization ──────────────────────────────────────────────────────

  function localize() {
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-i18n');
      var msg = chrome.i18n.getMessage(key);
      if (msg) {
        el.textContent = msg;
      }
    }
  }

  // ── Populate form from storage ────────────────────────────────────────

  async function loadSettings() {
    var settings = await Storage.getSettings();

    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      var el = document.getElementById(field.id);
      if (!el) continue;

      if (field.type === 'checkbox') {
        el.checked = !!settings[field.key];
      } else {
        // Duration fields stored in seconds, displayed in minutes
        var value = settings[field.key];
        if (field.isSeconds) {
          value = Math.round(value / 60);
        }
        el.value = value;
      }
    }
  }

  // ── Validate and clamp a number input ─────────────────────────────────

  function clampValue(el, min, max) {
    var val = parseInt(el.value, 10);
    if (isNaN(val) || val < min) {
      val = min;
    } else if (val > max) {
      val = max;
    }
    el.value = val;
    return val;
  }

  // ── Save settings to storage ──────────────────────────────────────────

  async function saveSettings() {
    var update = {};

    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      var el = document.getElementById(field.id);
      if (!el) continue;

      if (field.type === 'checkbox') {
        update[field.key] = el.checked;
      } else {
        var val = clampValue(el, field.min, field.max);
        // Convert minutes to seconds for duration fields
        if (field.isSeconds) {
          val = val * 60;
        }
        update[field.key] = val;
      }
    }

    await Storage.setSettings(update);
    showSaveIndicator();
  }

  // ── Save indicator flash ──────────────────────────────────────────────

  function showSaveIndicator() {
    var indicator = document.getElementById('saveIndicator');
    if (!indicator) return;

    indicator.removeAttribute('hidden');
    indicator.classList.add('visible');

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(function () {
      indicator.classList.remove('visible');
      // Hide after fade-out transition completes
      setTimeout(function () {
        indicator.setAttribute('hidden', '');
      }, 300);
    }, 1200);
  }

  // ── Bind event listeners ──────────────────────────────────────────────

  function bindListeners() {
    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      var el = document.getElementById(field.id);
      if (!el) continue;

      if (field.type === 'checkbox') {
        el.addEventListener('change', saveSettings);
      } else {
        el.addEventListener('change', saveSettings);
        el.addEventListener('input', saveSettings);
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    localize();
    loadSettings();
    bindListeners();
  });
})();
