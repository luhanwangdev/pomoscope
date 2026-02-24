/**
 * Promoscope Popup
 * Handles UI initialization, i18n, and button event wiring.
 */

/** Apply chrome.i18n translations to all elements with data-i18n attribute. */
function localizeUI() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = chrome.i18n.getMessage(key);
    if (msg) {
      el.textContent = msg;
    }
  });
}

/** Bind click handlers for timer control buttons. */
function initControls() {
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnSettings = document.getElementById('btn-settings');

  btnStart.addEventListener('click', () => {
    btnStart.hidden = true;
    btnPause.hidden = false;
    chrome.runtime.sendMessage({ action: 'start' });
  });

  btnPause.addEventListener('click', () => {
    btnPause.hidden = true;
    btnStart.hidden = false;
    chrome.runtime.sendMessage({ action: 'pause' });
  });

  btnReset.addEventListener('click', () => {
    btnPause.hidden = true;
    btnStart.hidden = false;
    document.getElementById('timer-minutes').textContent = '25';
    document.getElementById('timer-seconds').textContent = '00';
    chrome.runtime.sendMessage({ action: 'reset' });
  });

  btnSettings.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSettings' });
  });
}

/** Fill pomodoro dots based on completed count (0-4). */
function renderDots(completed) {
  const dots = document.querySelectorAll('#pomodoro-dots .dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < completed);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  localizeUI();
  initControls();
  renderDots(0);
});
