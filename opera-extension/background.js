const DEFAULT_APP_URL = 'http://localhost:3000';

function normalizeBaseUrl(value) {
  const raw = (value || DEFAULT_APP_URL).trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

async function getAppUrl() {
  const result = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL });
  return normalizeBaseUrl(result.appUrl);
}

function buildCaptureUrl(appUrl, params) {
  const target = new URL('/capture', appUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) target.searchParams.set(key, value);
  }
  target.searchParams.set('source', 'opera-extension');
  return target.toString();
}

async function openCapture(params, asPopup = false) {
  const appUrl = await getAppUrl();
  const url = buildCaptureUrl(appUrl, params);
  if (asPopup) {
    await chrome.windows.create({ url, type: 'popup', width: 1120, height: 860, focused: true });
    return;
  }
  await chrome.tabs.create({ url, active: true });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'pinboard-page', title: 'Seite in Pinboard speichern', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'pinboard-link', title: 'Link in Pinboard speichern', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'pinboard-image', title: 'Bild in Pinboard speichern', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'pinboard-selection', title: 'Auswahl in Pinboard speichern', contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const tabUrl = tab?.url || '';
  const tabTitle = tab?.title || '';
  if (info.menuItemId === 'pinboard-link') {
    void openCapture({ url: info.linkUrl || tabUrl, title: info.selectionText || tabTitle, text: info.selectionText || '' }, true);
    return;
  }
  if (info.menuItemId === 'pinboard-image') {
    void openCapture({ url: tabUrl || info.srcUrl || '', title: tabTitle || 'Bild', image: info.srcUrl || '', text: info.selectionText || '' }, true);
    return;
  }
  if (info.menuItemId === 'pinboard-selection') {
    void openCapture({ url: tabUrl, title: tabTitle, text: info.selectionText || '' }, true);
    return;
  }
  void openCapture({ url: tabUrl, title: tabTitle, text: info.selectionText || '' }, true);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_CAPTURE') {
    openCapture(message.payload || {}, Boolean(message.asPopup)).then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }
  return false;
});
