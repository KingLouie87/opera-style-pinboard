const DEFAULT_APP_URL = 'http://localhost:3000';
const titleEl = document.getElementById('title');
const urlEl = document.getElementById('url');
const appUrlInput = document.getElementById('appUrl');
const statusEl = document.getElementById('status');
let activeTab = null;

function normalizeBaseUrl(value) {
  const raw = (value || DEFAULT_APP_URL).trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

async function getSelectionText(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection ? window.getSelection().toString().trim() : ''
    });
    return result?.result || '';
  } catch {
    return '';
  }
}

async function load() {
  const settings = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL });
  appUrlInput.value = normalizeBaseUrl(settings.appUrl);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  titleEl.textContent = tab?.title || 'Aktuelle Seite';
  urlEl.textContent = tab?.url || '';
}

async function saveSettings() {
  const appUrl = normalizeBaseUrl(appUrlInput.value);
  appUrlInput.value = appUrl;
  await chrome.storage.sync.set({ appUrl });
  statusEl.textContent = 'App-Adresse gespeichert.';
}

async function pin(asPopup) {
  await saveSettings();
  if (!activeTab?.url) {
    statusEl.textContent = 'Keine aktive Seite erkannt.';
    return;
  }
  const text = await getSelectionText(activeTab.id);
  chrome.runtime.sendMessage({
    type: 'OPEN_CAPTURE',
    asPopup,
    payload: { url: activeTab.url, title: activeTab.title || '', text }
  }, response => {
    if (!response?.ok) statusEl.textContent = response?.error || 'Capture konnte nicht geöffnet werden.';
  });
}

document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('pinPopup').addEventListener('click', () => pin(true));
document.getElementById('pinTab').addEventListener('click', () => pin(false));
load();
