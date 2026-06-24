const DEFAULT_APP_URL = 'http://localhost:3000';
const appUrlInput = document.getElementById('appUrl');
const statusEl = document.getElementById('status');
function normalizeBaseUrl(value) {
  const raw = (value || DEFAULT_APP_URL).trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}
async function load() {
  const settings = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL });
  appUrlInput.value = normalizeBaseUrl(settings.appUrl);
}
async function save() {
  const appUrl = normalizeBaseUrl(appUrlInput.value);
  await chrome.storage.sync.set({ appUrl });
  appUrlInput.value = appUrl;
  statusEl.textContent = 'Gespeichert.';
}
document.getElementById('save').addEventListener('click', save);
load();
