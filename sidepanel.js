// sidepanel.js — Lógica da tela de busca

const WEBHOOK_URL = 'https://vmi2981253.contaboserver.net/webhook/7d9ef1ef-9721-48a5-94c7-431425e9fb3e';

// Registra a página atual para persistência ao trocar de aba
try {
  chrome.storage.session.set({ unihub_panel_path: 'sidepanel.html' });
} catch (_) {}

// ── Theme ──────────────────────────────────────────────────────────────────
const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const themeIcon   = document.getElementById('theme-icon');

function applyTheme(theme) {
  if (theme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
    themeIcon.textContent = 'light_mode';
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    themeIcon.textContent = 'dark_mode';
  }
}

// Load saved theme
const savedTheme = localStorage.getItem('unihub-theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = html.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('unihub-theme', next);
  applyTheme(next);
});

// ── References ─────────────────────────────────────────────────────────────
const searchType   = document.getElementById('search-type');
const searchValue  = document.getElementById('search-value');
const searchBtn    = document.getElementById('search-btn');
const searchForm   = document.getElementById('search-form');
const loadingState = document.getElementById('loading-state');
const errorBanner  = document.getElementById('error-banner');
const errorMsg     = document.getElementById('error-msg');

// ── Helpers ────────────────────────────────────────────────────────────────
function showLoading(show) {
  searchForm.style.display   = show ? 'none' : 'flex';
  loadingState.style.display = show ? 'flex' : 'none';
}

function showError(msg) {
  errorBanner.classList.add('active');
  errorMsg.textContent = msg || 'Erro ao buscar. Tente novamente.';
}

function hideError() {
  errorBanner.classList.remove('active');
}

function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Menu button — abre o navigation drawer ────────────────────────────────
const drawer   = document.getElementById('nav-drawer');
const closeBtn = document.getElementById('drawer-close-btn');

function openDrawer() {
  drawer.classList.add('open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'true');
}

function closeDrawer() {
  drawer.classList.remove('open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'false');
}

document.getElementById('menu-btn').addEventListener('click', openDrawer);
closeBtn.addEventListener('click', closeDrawer);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
});

// "Dados Aluno" — só navega se houver cache
document.getElementById('drawer-dados-aluno').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.storage.session.get('unihub_results', ({ unihub_results }) => {
    if (unihub_results && unihub_results.length > 0) {
      window.location.href = 'results.html';
    } else {
      closeDrawer();
      showToast('Busque um aluno primeiro.', 3000);
    }
  });
});

// ── Search ─────────────────────────────────────────────────────────────────
async function doSearch() {
  const tipo  = searchType.value.trim();
  const valor = searchValue.value.trim();

  if (!valor) {
    showError('Preencha o campo de busca.');
    return;
  }

  hideError();
  showLoading(true);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, valor }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Aceita array ou objeto único
    const results = Array.isArray(data) ? data : [data];

    if (!results || results.length === 0) {
      throw new Error('Nenhum resultado encontrado.');
    }

    // Salva os dados e navega para a tela de resultados
    await chrome.storage.session.set({ unihub_results: results });
    window.location.href = 'results.html';

  } catch (err) {
    console.error('[UniHub] Erro na busca:', err);
    showLoading(false);
    showError(err.message || 'Falha na conexão. Tente novamente.');
  }
}

// ── Event Listeners ────────────────────────────────────────────────────────
searchBtn.addEventListener('click', doSearch);

searchValue.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

// Atualiza placeholder conforme tipo selecionado
const placeholders = {
  cpf:       'Ex: 12345678900  (sem símbolos)',
  email:     'Ex: nome@email.com',
  telefone:  'Ex: 5561999998888 (precisa do DDD)',
};

searchType.addEventListener('change', () => {
  searchValue.placeholder = placeholders[searchType.value] || 'Digite aqui...';
  searchValue.value = '';
  hideError();
});

// Init placeholder
searchValue.placeholder = placeholders[searchType.value] || 'Digite aqui...';

// ── Busca Automática ───────────────────────────────────────────────────────
const autoSearchBtn = document.getElementById('auto-search-btn');

autoSearchBtn.addEventListener('click', async () => {
  hideError();

  // Anima o botão enquanto detecta
  autoSearchBtn.disabled = true;
  const originalText = autoSearchBtn.innerHTML;
  autoSearchBtn.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:20px;animation:spin 0.7s linear infinite;display:inline-block;">sync</span>
    DETECTANDO...
  `;

  try {
    // Pega a aba ativa (WhatsApp Web)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url?.includes('web.whatsapp.com')) {
      throw new Error('Abra uma conversa no WhatsApp Web primeiro.');
    }

    // Injeta o content script se ainda não estiver (aba pode ter sido aberta antes da extensão)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch (_) {
      // Já está injetado — ignora o erro de injeção duplicada
    }

    // Envia mensagem ao content script pedindo os dados do contato
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'getWhatsAppContact' }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Não foi possível comunicar com o WhatsApp. Recarregue a página.'));
        } else {
          resolve(res);
        }
      });
    });

    if (!response?.success || !response?.contact) {
      throw new Error('Nenhum contato detectado. Abra uma conversa primeiro.');
    }

    const { tipo, valor, nome } = response.contact;

    // Preenche o formulário automaticamente
    searchType.value = tipo;
    searchValue.value = valor;
    searchValue.placeholder = placeholders[tipo] || 'Digite aqui...';

    // Feedback visual antes de buscar
    autoSearchBtn.innerHTML = originalText;
    autoSearchBtn.disabled = false;

    // Pequeno delay para o usuário ver o campo preenchido, depois busca
    await new Promise(r => setTimeout(r, 400));
    doSearch();

  } catch (err) {
    console.error('[UniHub] Busca automática falhou:', err);
    showError(err.message || 'Erro na busca automática. Tente manualmente.');
    autoSearchBtn.innerHTML = originalText;
    autoSearchBtn.disabled = false;
  }
});

