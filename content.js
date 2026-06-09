// content.js — Plenum
// Injeta no WhatsApp Web e extrai dados do contato ativo.
// Ouve mensagens do side panel solicitando a busca automática.

// ── Side-tab toggle button ───────────────────────────────────────────────────
(function injectMenuButton() {
  if (document.getElementById('unihub-menu-btn')) return; // evita duplicata

  let panelOpen = false; // estado local do painel

  const iconSpan = document.createElement('span');
  iconSpan.className = 'material-symbols-outlined';
  iconSpan.style.cssText = [
    "font-family:'Material Symbols Outlined'",
    'font-size:20px',
    'font-style:normal',
    'font-weight:700',
    'line-height:1',
    'user-select:none',
    'transition:transform 0.25s ease',
  ].join(';');
  iconSpan.textContent = 'chevron_left';

  const btn = document.createElement('button');
  btn.id = 'unihub-menu-btn';
  btn.title = 'Abrir / Fechar Plenum';
  btn.appendChild(iconSpan);

  Object.assign(btn.style, {
    position:        'fixed',
    top:             '50%',
    right:           '0',
    transform:       'translateY(-50%)',
    zIndex:          '999999',
    width:           '24px',
    height:          '64px',
    background:      '#ffd709',
    color:           '#000',
    border:          '2px solid #000',
    borderRight:     'none',
    boxShadow:       '-3px 3px 0px 0px #000',
    cursor:          'pointer',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    '6px 0 0 6px',
    padding:         '0',
    opacity:         '0.75',
    transition:      'opacity 0.2s ease',
  });

  function updateIcon() {
    // seta aponta para esquerda (fechar) quando aberto, para direita (abrir) quando fechado
    iconSpan.textContent = panelOpen ? 'chevron_right' : 'chevron_left';
    btn.title = panelOpen ? 'Fechar Plenum' : 'Abrir Plenum';
  }

  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.75'; });

  // Micro-animação no click
  btn.addEventListener('mousedown', () => {
    btn.style.boxShadow = '-1px 1px 0px 0px #000';
  });
  btn.addEventListener('mouseup', () => {
    btn.style.boxShadow = '-3px 3px 0px 0px #000';
  });

  btn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    updateIcon();
    chrome.runtime.sendMessage({
      action: panelOpen ? 'openSidePanel' : 'closeSidePanel',
    });
  });

  document.body.appendChild(btn);
  updateIcon();

  // Carrega a fonte Material Symbols se ainda não estiver na página
  if (!document.getElementById('unihub-material-font')) {
    const link = document.createElement('link');
    link.id   = 'unihub-material-font';
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap';
    document.head.appendChild(link);
  }
})();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== 'getWhatsAppContact') return;

  try {
    const contact = extractActiveContact();
    sendResponse({ success: true, contact });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }

  return true; // mantém o canal aberto para resposta assíncrona
});

// ── Extrai dados do contato ativo no WhatsApp Web ──────────────────────────
function extractActiveContact() {
  // 1. Tenta pegar o número pelo header do chat ativo
  //    WhatsApp exibe o número no título quando não há nome salvo,
  //    ou no <span> de informação do cabeçalho.

  // Estratégia A: número no título do header (contatos sem nome salvo)
  const headerTitle = document.querySelector(
    'header [data-testid="conversation-header"] span[title], ' +
    'header span[dir="auto"][title], ' +
    '#main header span[dir="auto"]'
  );

  let rawText = headerTitle?.title || headerTitle?.textContent || '';

  // Se o título tiver apenas dígitos e + (número puro), retorna como telefone
  const phoneFromTitle = extractPhone(rawText);
  if (phoneFromTitle) {
    return { tipo: 'telefone', valor: phoneFromTitle, nome: rawText };
  }

  // Estratégia B: Procura número no subtítulo / descrição da conversa
  const subHeader = document.querySelector(
    'header [data-testid="conversation-header-subtitle"] span, ' +
    'header span[data-testid="status"]'
  );
  const subText = subHeader?.textContent || '';
  const phoneFromSub = extractPhone(subText);
  if (phoneFromSub) {
    return { tipo: 'telefone', valor: phoneFromSub, nome: rawText };
  }

  // Estratégia C: URL da conversa — WhatsApp usa /chat/553199998888/... às vezes
  const urlMatch = window.location.href.match(/chat\/(\d{10,15})/);
  if (urlMatch) {
    return { tipo: 'telefone', valor: urlMatch[1], nome: rawText };
  }

  // Estratégia D: Retorna o nome do contato para busca por nome como fallback
  if (rawText && rawText.trim().length > 1) {
    return { tipo: 'nome', valor: rawText.trim(), nome: rawText.trim() };
  }

  // Nenhum dado encontrado
  return null;
}

// ── Limpa e valida possíveis números de telefone ───────────────────────────
function extractPhone(text) {
  if (!text) return null;

  // Remove tudo exceto dígitos e +
  const digits = text.replace(/[^\d+]/g, '');

  // Número com DDD+número = 10-15 dígitos
  if (/^\+?\d{10,15}$/.test(digits)) {
    // Remove o + inicial se houver (envia só dígitos)
    return digits.replace(/^\+/, '');
  }

  // Tenta achar um número dentro de texto misto
  const match = text.match(/\+?\d[\d\s\-().]{8,14}\d/);
  if (match) {
    const cleaned = match[0].replace(/[^\d]/g, '');
    if (cleaned.length >= 10 && cleaned.length <= 15) return cleaned;
  }

  return null;
}
