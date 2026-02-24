/**
 * Promoscope Popup
 *
 * Handles:
 * - Timer display with second-level countdown
 * - Start / Pause / Reset controls
 * - Session report chart (Chart.js doughnut)
 * - Today's statistics
 * - i18n localization
 */

/* global chrome, Storage, Chart */

// ── Soft pastel palette for chart segments ────────────────────────────
const CHART_COLORS = [
  '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB',
  '#B5EAD7', '#C7CEEA', '#D4A5A5', '#F2D1C9'
];

const STATUS_GRADIENTS = {
  working: 'linear-gradient(135deg, #FFE5D9 0%, #FFD6C0 100%)',
  break: 'linear-gradient(135deg, #D9FFE5 0%, #C0FFD6 100%)',
  longBreak: 'linear-gradient(135deg, #D9E5FF 0%, #C0D6FF 100%)',
  idle: 'linear-gradient(135deg, #FFE5D9 0%, #FFD6C0 100%)'
};

const STATUS_LABEL_COLORS = {
  working: '#C47A5A',
  break: '#5AC47A',
  longBreak: '#5A7AC4',
  idle: '#C47A5A'
};

let tickInterval = null;
let sessionChart = null;

// ── i18n ──────────────────────────────────────────────────────────────

function msg(key) {
  return chrome.i18n.getMessage(key) || key;
}

function localizeUI() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const translated = chrome.i18n.getMessage(key);
    if (translated) el.textContent = translated;
  });
}

// ── Timer Display ─────────────────────────────────────────────────────

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0')
  };
}

function updateTimerDisplay(seconds) {
  const { minutes, seconds: secs } = formatTime(Math.max(0, seconds));
  document.getElementById('timer-minutes').textContent = minutes;
  document.getElementById('timer-seconds').textContent = secs;
}

function updateStatusLabel(status) {
  const label = document.querySelector('.status-label');
  const section = document.querySelector('.timer-section');

  const labelMap = {
    working: msg('workLabel'),
    break: msg('breakLabel'),
    longBreak: msg('longBreakLabel'),
    idle: msg('workLabel')
  };

  label.textContent = labelMap[status] || labelMap.idle;
  label.style.color = STATUS_LABEL_COLORS[status] || STATUS_LABEL_COLORS.idle;
  section.style.background = STATUS_GRADIENTS[status] || STATUS_GRADIENTS.idle;
}

function renderDots(completed, interval) {
  const container = document.getElementById('pomodoro-dots');
  while (container.firstChild) container.removeChild(container.firstChild);
  for (let i = 0; i < interval; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot' + (i < (completed % interval) ? ' filled' : '');
    container.appendChild(dot);
  }
}

function updateButtonVisibility(status) {
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');

  if (status === 'working' || status === 'break' || status === 'longBreak') {
    btnStart.hidden = true;
    btnPause.hidden = false;
  } else {
    btnStart.hidden = false;
    btnPause.hidden = true;
  }
}

// ── Timer Tick (runs only while popup is open) ────────────────────────

function startTick() {
  stopTick();
  tick(); // immediate first tick
  tickInterval = setInterval(tick, 1000);
}

function stopTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

async function tick() {
  const timer = await Storage.getTimer();

  updateStatusLabel(timer.status);
  updateButtonVisibility(timer.status);

  if (timer.endTime && timer.status !== 'idle') {
    const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
    updateTimerDisplay(remaining);

    if (remaining <= 0) {
      stopTick();
      setTimeout(async () => {
        await refreshAll();
        startTick();
      }, 500);
    }
  } else {
    updateTimerDisplay(timer.timeLeft);
  }
}

// ── Session Report (Chart.js) ─────────────────────────────────────────

function renderSessionReport(session) {
  const emptyEl = document.getElementById('report-empty');
  const chartWrapper = document.getElementById('report-chart-wrapper');
  const topSitesEl = document.getElementById('report-top-sites');

  if (!session || !session.sites || Object.keys(session.sites).length === 0) {
    emptyEl.hidden = false;
    chartWrapper.hidden = true;
    clearChildren(topSitesEl);
    return;
  }

  emptyEl.hidden = true;
  chartWrapper.hidden = false;

  const entries = Object.entries(session.sites).sort((a, b) => b[1] - a[1]);
  const totalSeconds = entries.reduce((sum, [, s]) => sum + s, 0);

  const MAX_SLICES = 6;
  let chartEntries = entries.slice(0, MAX_SLICES);
  if (entries.length > MAX_SLICES) {
    const othersSeconds = entries.slice(MAX_SLICES).reduce((sum, [, s]) => sum + s, 0);
    chartEntries.push(['Others', othersSeconds]);
  }

  const labels = chartEntries.map(([domain]) => domain);
  const data = chartEntries.map(([, s]) => s);
  const colors = chartEntries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (sessionChart) {
    sessionChart.destroy();
  }

  const ctx = document.getElementById('sessionChart').getContext('2d');
  sessionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '55%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (tooltipItem) => {
              const secs = tooltipItem.parsed;
              const pct = totalSeconds > 0 ? Math.round(secs / totalSeconds * 100) : 0;
              return `${tooltipItem.label}: ${formatDuration(secs)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  // Top sites list below chart (using safe DOM methods)
  clearChildren(topSitesEl);
  chartEntries.slice(0, 5).forEach(([domain, secs], i) => {
    const pct = totalSeconds > 0 ? Math.round(secs / totalSeconds * 100) : 0;
    topSitesEl.appendChild(buildSiteRow(domain, formatDuration(secs), pct, colors[i]));
  });
}

// ── Today's Statistics ────────────────────────────────────────────────

async function renderTodayStats() {
  const sessions = await Storage.getTodaySessions();

  const totalRounds = sessions.length;
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

  document.getElementById('stat-rounds').textContent = totalRounds;
  document.getElementById('stat-total-work').textContent = formatDuration(totalSeconds);

  const siteTotals = {};
  sessions.forEach((s) => {
    Object.entries(s.sites || {}).forEach(([domain, secs]) => {
      siteTotals[domain] = (siteTotals[domain] || 0) + secs;
    });
  });

  const sorted = Object.entries(siteTotals).sort((a, b) => b[1] - a[1]);
  const topSitesEl = document.getElementById('today-top-sites');
  const grandTotal = sorted.reduce((sum, [, s]) => sum + s, 0);

  clearChildren(topSitesEl);

  if (sorted.length === 0) return;

  sorted.slice(0, 5).forEach(([domain, secs]) => {
    const pct = grandTotal > 0 ? Math.round(secs / grandTotal * 100) : 0;
    topSitesEl.appendChild(buildSiteBarRow(domain, pct));
  });
}

// ── DOM Builders (safe, no innerHTML) ─────────────────────────────────

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * Build a site row for the session report: [color dot] [name] [time] [pct%]
 */
function buildSiteRow(domain, timeStr, pct, color) {
  const row = document.createElement('div');
  row.className = 'site-bar';

  const dot = document.createElement('span');
  dot.className = 'site-color-dot';
  dot.style.background = color;
  row.appendChild(dot);

  const name = document.createElement('span');
  name.className = 'site-name';
  name.textContent = domain;
  row.appendChild(name);

  const time = document.createElement('span');
  time.className = 'site-time';
  time.textContent = timeStr;
  row.appendChild(time);

  const percent = document.createElement('span');
  percent.className = 'site-percent';
  percent.textContent = pct + '%';
  row.appendChild(percent);

  return row;
}

/**
 * Build a site bar row for today stats: [name] [bar track] [pct%]
 */
function buildSiteBarRow(domain, pct) {
  const row = document.createElement('div');
  row.className = 'site-bar';

  const name = document.createElement('span');
  name.className = 'site-name';
  name.textContent = domain;
  row.appendChild(name);

  const track = document.createElement('div');
  track.className = 'site-bar-track';
  const fill = document.createElement('div');
  fill.className = 'site-bar-fill';
  fill.style.width = pct + '%';
  track.appendChild(fill);
  row.appendChild(track);

  const percent = document.createElement('span');
  percent.className = 'site-percent';
  percent.textContent = pct + '%';
  row.appendChild(percent);

  return row;
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return totalSeconds + 's';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

// ── Controls ──────────────────────────────────────────────────────────

function initControls() {
  document.getElementById('btn-start').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start' });
    startTick();
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'pause' });
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'reset' });
    stopTick();
    const settings = await Storage.getSettings();
    updateTimerDisplay(settings.workDuration);
    updateStatusLabel('idle');
    updateButtonVisibility('idle');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });
}

// ── Refresh All Data ──────────────────────────────────────────────────

async function refreshAll() {
  const timer = await Storage.getTimer();
  const settings = await Storage.getSettings();

  if (timer.endTime && timer.status !== 'idle') {
    const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
    updateTimerDisplay(remaining);
  } else {
    updateTimerDisplay(timer.timeLeft);
  }

  updateStatusLabel(timer.status);
  updateButtonVisibility(timer.status);
  renderDots(timer.completedPomodoros, settings.longBreakInterval);

  const todaySessions = await Storage.getTodaySessions();
  if (todaySessions.length > 0) {
    renderSessionReport(todaySessions[todaySessions.length - 1]);
  } else {
    renderSessionReport(null);
  }

  await renderTodayStats();
}

// ── Init ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  localizeUI();
  initControls();
  await refreshAll();

  const timer = await Storage.getTimer();
  if (timer.status !== 'idle' && timer.endTime) {
    startTick();
  }
});
