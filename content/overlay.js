/**
 * Promoscope Overlay Content Script
 *
 * Injected by the service worker when a work session completes.
 * Displays a full-screen overlay with the session's site distribution.
 * Uses ONLY safe DOM methods — no innerHTML.
 */

/* global chrome */

(function () {
  'use strict';

  /**
   * Remove any existing overlay before creating a new one.
   */
  function removeOverlay() {
    const existing = document.querySelector('.promoscope-overlay');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Format seconds into a human-readable string like "25m" or "1h 5m".
   * @param {number} totalSeconds
   * @returns {string}
   */
  function formatDuration(totalSeconds) {
    const minutes = Math.round(totalSeconds / 60);
    if (minutes < 60) {
      return minutes + 'm';
    }
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    if (remaining === 0) {
      return hours + 'h';
    }
    return hours + 'h ' + remaining + 'm';
  }

  /**
   * Build and display the overlay for a completed session.
   * @param {Object} session - { sites: { domain: seconds, ... }, duration, startTime, endTime }
   */
  function showOverlay(session) {
    removeOverlay();

    const sites = session.sites || {};
    const totalSeconds = Object.values(sites).reduce(function (sum, s) { return sum + s; }, 0);

    // Sort sites by time descending, take top 5
    const sortedSites = Object.entries(sites)
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 5);

    // ── Backdrop ──────────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.className = 'promoscope-overlay';

    // Click backdrop to dismiss
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        removeOverlay();
      }
    });

    // ── Card ──────────────────────────────────────────────────────────
    var card = document.createElement('div');
    card.className = 'promoscope-card';

    // Heading
    var heading = document.createElement('div');
    heading.className = 'promoscope-heading';
    heading.textContent = 'Session Complete!';
    card.appendChild(heading);

    // Subheading — total duration
    if (totalSeconds > 0) {
      var subheading = document.createElement('div');
      subheading.className = 'promoscope-subheading';
      subheading.textContent = formatDuration(totalSeconds) + ' focused';
      card.appendChild(subheading);
    }

    // ── Site bars ─────────────────────────────────────────────────────
    if (sortedSites.length > 0) {
      var sitesContainer = document.createElement('div');
      sitesContainer.className = 'promoscope-sites';

      var maxSeconds = sortedSites[0][1];

      for (var i = 0; i < sortedSites.length; i++) {
        var domain = sortedSites[i][0];
        var seconds = sortedSites[i][1];
        var percent = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
        var barWidth = maxSeconds > 0 ? Math.round((seconds / maxSeconds) * 100) : 0;

        var row = document.createElement('div');
        row.className = 'promoscope-site-row';

        // Domain name
        var nameEl = document.createElement('div');
        nameEl.className = 'promoscope-site-name';
        nameEl.textContent = domain;
        row.appendChild(nameEl);

        // Bar track
        var track = document.createElement('div');
        track.className = 'promoscope-bar-track';

        var fill = document.createElement('div');
        fill.className = 'promoscope-bar-fill';
        fill.style.width = barWidth + '%';
        track.appendChild(fill);
        row.appendChild(track);

        // Percentage
        var percentEl = document.createElement('div');
        percentEl.className = 'promoscope-site-percent';
        percentEl.textContent = percent + '%';
        row.appendChild(percentEl);

        sitesContainer.appendChild(row);
      }

      card.appendChild(sitesContainer);
    }

    // ── Start Break button ────────────────────────────────────────────
    var btn = document.createElement('button');
    btn.className = 'promoscope-btn';
    btn.textContent = 'Start Break';
    btn.addEventListener('click', function () {
      chrome.runtime.sendMessage({ action: 'startBreak' });
      removeOverlay();
    });
    card.appendChild(btn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // ── Message listener ──────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (message) {
    if (message.action === 'showOverlay' && message.session) {
      showOverlay(message.session);
    }
  });
})();
