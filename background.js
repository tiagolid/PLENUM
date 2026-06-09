// background.js — Service Worker Plenum
//
// Compatível com Chrome, Edge e Opera GX (Chromium).
//
// Opera GX não implementa chrome.sidePanel — todas as chamadas são
// protegidas com verificação de existência para não quebrar o service worker.

const hasSidePanel = !!(chrome.sidePanel);

// ── Ativa o comportamento nativo de abertura (Chrome 116+) ────────────────
if (hasSidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {/* Edge/Opera podem ignorar silenciosamente */});
}

// ── Clique no ícone: abre o painel explicitamente (Edge + Opera GX) ────────
// No Chrome, quando setPanelBehavior assume o clique, este listener NÃO dispara.
// No Edge/Opera, dispara e abre o painel via sidePanel.open().
chrome.action.onClicked.addListener((tab) => {
  if (!hasSidePanel) {
    // Opera GX sem sidePanel: abre o sidepanel.html em uma nova aba como fallback
    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    return;
  }

  chrome.sidePanel
    .open({ tabId: tab.id })
    .catch(() => {
      chrome.sidePanel
        .open({ windowId: tab.windowId })
        .catch((e) => console.error('[UniHub] sidePanel.open fallback falhou:', e));
    });
});

// ── Habilita o painel para cada aba que termina de carregar ───────────────
if (hasSidePanel) {
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'complete') return;
    chrome.storage.session.get('unihub_panel_path', ({ unihub_panel_path }) => {
      const path = unihub_panel_path || 'sidepanel.html';
      chrome.sidePanel.setOptions({ tabId, path, enabled: true }).catch(() => {});
    });
  });

  // ── Habilita ao trocar de aba ────────────────────────────────────────────
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.storage.session.get('unihub_panel_path', ({ unihub_panel_path }) => {
      const path = unihub_panel_path || 'sidepanel.html';
      chrome.sidePanel.setOptions({ tabId, path, enabled: true }).catch(() => {});
    });
  });
}

// ── Reconfigura ao instalar/atualizar ────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  if (hasSidePanel) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {});
  }
});

// ── Abre/fecha o painel ao receber mensagem do botão injetado (content.js) ──
chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId     = sender?.tab?.id;
  const windowId  = sender?.tab?.windowId;

  // ── Fechar painel: desabilita e reabilita (Chrome não tem sidePanel.close) ─
  if (msg.action === 'closeSidePanel') {
    if (!hasSidePanel) return;
    chrome.sidePanel
      .setOptions({ tabId, enabled: false })
      .then(() => chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true }))
      .catch(() => {});
    return;
  }

  // ── Abrir painel ─────────────────────────────────────────────────────────
  if (msg.action === 'openSidePanel') {
    if (!hasSidePanel) {
      // Opera GX fallback
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      return;
    }

    chrome.sidePanel
      .open({ tabId })
      .catch(() =>
        chrome.sidePanel
          .open({ windowId })
          .catch(e => console.error('[UniHub] openSidePanel falhou:', e))
      );
  }
});



