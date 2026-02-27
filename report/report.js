/**
 * Promoscope Report Page
 *
 * Opened automatically when a work session completes.
 * Reads session data from chrome.storage.local (lastSessionForReport key),
 * renders a Chart.js doughnut chart and top-5 site list.
 */

/* global chrome, Storage, Chart */

const CHART_COLORS = [
  '#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB',
  '#B5EAD7', '#C7CEEA', '#D4A5A5', '#F2D1C9'
];

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

// ── Helpers ───────────────────────────────────────────────────────────

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return totalSeconds + 's';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

// ── Render ────────────────────────────────────────────────────────────

function renderReport(session) {
  const durationLabel = document.getElementById('duration-label');
  const chartWrapper = document.getElementById('chart-wrapper');
  const sitesList = document.getElementById('sites-list');

  if (!session || !session.sites || Object.keys(session.sites).length === 0) {
    durationLabel.textContent = '';
    return;
  }

  const entries = Object.entries(session.sites).sort((a, b) => b[1] - a[1]);
  const totalSeconds = entries.reduce((sum, [, s]) => sum + s, 0);

  // Duration subheading
  durationLabel.textContent = formatDuration(totalSeconds) + ' ' + msg('focused');

  // Chart data — up to 6 slices + "Others"
  const MAX_SLICES = 6;
  let chartEntries = entries.slice(0, MAX_SLICES);
  if (entries.length > MAX_SLICES) {
    const othersSeconds = entries.slice(MAX_SLICES).reduce((sum, [, s]) => sum + s, 0);
    chartEntries.push(['Others', othersSeconds]);
  }

  const labels = chartEntries.map(([domain]) => domain);
  const data = chartEntries.map(([, s]) => s);
  const colors = chartEntries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  // Doughnut chart
  chartWrapper.hidden = false;
  const ctx = document.getElementById('reportChart').getContext('2d');
  new Chart(ctx, {
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

  // Top 5 site rows
  chartEntries.slice(0, 5).forEach(([domain, secs], i) => {
    const pct = totalSeconds > 0 ? Math.round(secs / totalSeconds * 100) : 0;

    const row = document.createElement('div');
    row.className = 'site-row';

    const dot = document.createElement('span');
    dot.className = 'site-color-dot';
    dot.style.background = colors[i];
    row.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'site-name';
    name.textContent = domain;
    row.appendChild(name);

    const time = document.createElement('span');
    time.className = 'site-time';
    time.textContent = formatDuration(secs);
    row.appendChild(time);

    const percent = document.createElement('span');
    percent.className = 'site-percent';
    percent.textContent = pct + '%';
    row.appendChild(percent);

    sitesList.appendChild(row);
  });
}

// ── Init ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  localizeUI();

  const session = await Storage.getLastSessionForReport();
  renderReport(session);

  // Clean up after reading
  await Storage.clearLastSessionForReport();

  document.getElementById('btn-close').addEventListener('click', () => {
    window.close();
  });
});
