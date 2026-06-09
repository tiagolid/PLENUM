// messages.js — Lógica da tela de modelos de mensagens

// Registra a página atual para persistência ao trocar de aba
try {
  chrome.storage.session.set({ unihub_panel_path: 'messages.html' });
} catch (_) {}

// ── Theme ──────────────────────────────────────────────────────────────────
const html        = document.documentElement;
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

const savedTheme = localStorage.getItem('unihub-theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = html.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('unihub-theme', next);
  applyTheme(next);
});

// ── Navigation Drawer ──────────────────────────────────────────────────────
const drawer   = document.getElementById('nav-drawer');
const closeBtn = document.getElementById('drawer-close-btn');

function openDrawer()  { drawer.classList.add('open'); }
function closeDrawer() { drawer.classList.remove('open'); }

document.getElementById('menu-btn').addEventListener('click', openDrawer);
closeBtn.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

// "Dados Aluno" — só navega se houver cache, senão exibe toast
document.getElementById('drawer-dados-aluno').addEventListener('click', (e) => {
  e.preventDefault();
  try {
    chrome.storage.session.get('unihub_results', ({ unihub_results }) => {
      if (unihub_results && unihub_results.length > 0) {
        window.location.href = 'results.html';
      } else {
        closeDrawer();
        showToast('Busque um aluno primeiro.', 3000);
      }
    });
  } catch (_) {
    closeDrawer();
    showToast('Busque um aluno primeiro.', 3000);
  }
});

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── References ─────────────────────────────────────────────────────────────
const inputMonitor    = document.getElementById('input-monitor');
const searchMsgsBtn   = document.getElementById('search-msgs-btn');
const msgsList        = document.getElementById('messages-list');
const emptyState      = document.getElementById('empty-state');
const msgsLoading     = document.getElementById('msgs-loading');
const msgCount        = document.getElementById('msg-count');
const searchContainer = document.getElementById('search-container');
const toggleSearchBtn = document.getElementById('toggle-search-btn');

toggleSearchBtn.addEventListener('click', () => {
  searchContainer.style.display = 'block';
  toggleSearchBtn.style.display = 'none';
  inputMonitor.focus();
});

// ── Copy Message ───────────────────────────────────────────────────────────
function copiarMensagem(texto, btn) {
  navigator.clipboard.writeText(texto).then(() => {
    const icon  = btn.querySelector('.btn-icon');
    const label = btn.querySelector('.btn-label');

    const prevIcon  = icon ? icon.textContent : '';
    const prevLabel = label ? label.textContent : '';

    if (icon) icon.textContent  = 'check';
    if (label) label.textContent = 'Copiado!';
    btn.classList.add('copied');

    showToast('Mensagem copiada!');

    setTimeout(() => {
      if (icon) icon.textContent  = prevIcon;
      if (label) label.textContent = prevLabel;
      btn.classList.remove('copied');
    }, 1800);
  });
}

// ── Render messages ────────────────────────────────────────────────────────
/**
 * Recebe o objeto do webhook: { "Titulo": "texto", ... }
 * Converte em array de cards e renderiza.
 */
function renderMessages(templates, monitorName) {
  msgsList.innerHTML = '';

  templates.forEach((tpl, index) => {
    // Replace [MONITOR] placeholder if the monitor name is provided
    const texto = monitorName
      ? tpl.mensagem.replace(/\[MONITOR\]/gi, monitorName)
      : tpl.mensagem;

    const isAccent = !!tpl.acento;

    const card = document.createElement('div');
    card.className = 'msg-card';
    card.style.animationDelay = `${index * 0.06}s`;

    card.innerHTML = `
      <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; ${isAccent ? 'background: var(--accent); color: var(--black);' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined" style="font-size: 16px; opacity: 0.8;">${tpl.icone || 'mail'}</span>
            <h3 style="font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">${tpl.titulo}</h3>
          </div>
          <button class="btn-copy" id="copy-btn-${index}" title="Copiar Mensagem" style="background: transparent; border: 2px solid var(--border-color); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: inherit; transition: all 0.15s; flex-shrink: 0;">
            <span class="material-symbols-outlined btn-icon" style="font-size: 16px;">content_copy</span>
          </button>
        </div>
        <p class="msg-text" style="color: inherit; opacity: 0.95; line-height: 1.5; margin-top: 4px;">${texto.replace(/\n/g, '<br>')}</p>
      </div>
    `;

    // Anexa o evento de cópia com o texto original (preserva \n)
    card.querySelector(`#copy-btn-${index}`).addEventListener('click', function () {
      copiarMensagem(texto, this);
    });

    msgsList.appendChild(card);
  });


  // Update count label
  msgCount.textContent = `${templates.length} ${templates.length !== 1 ? 'modelos disponíveis' : 'modelo disponível'}`;

  // Show list, hide empty state & loading
  emptyState.style.display  = 'none';
  msgsLoading.classList.remove('active');
  msgsList.style.display = 'flex';
}

// ── Webhook ────────────────────────────────────────────────────────────────
const MSGS_WEBHOOK_URL = 'https://vmi2981253.contaboserver.net/webhook/608bf17d-a951-44c7-aced-2d9cb492921a';

// ── Search / Fetch messages ────────────────────────────────────────────────
async function buscarMensagens() {
  const monitor = inputMonitor.value.trim();

  // Esconde o card de busca e mostra o botão da lupa
  searchContainer.style.display = 'none';
  toggleSearchBtn.style.display = 'flex';

  // Mostra loading
  emptyState.style.display = 'none';
  msgsList.style.display   = 'none';
  msgsLoading.classList.add('active');
  msgCount.textContent     = 'Carregando...';

  try {
    const response = await fetch(MSGS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monitor }),
    });

    const data = await response.json();

    // Verifica se o webhook retornou uma resposta de erro explícita
    if (data && data.Error) {
      throw new Error(data.Error);
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // Converte { "Titulo": "texto" } → array de templates
    const templates = Object.entries(data).map(([titulo, mensagem]) => ({
      titulo,
      mensagem: String(mensagem),
    }));

    if (!templates || templates.length === 0) {
      throw new Error('Nenhum modelo encontrado.');
    }

    // Salva no cache de sessão
    chrome.storage.session.set({
      unihub_messages: { templates, monitor },
    });

    renderMessages(templates, monitor);

  } catch (err) {
    console.error('[VisãoPlena] Erro ao buscar modelos:', err);
    msgsLoading.classList.remove('active');
    emptyState.style.display = 'flex';
    msgCount.textContent = 'Erro ao carregar modelos';
    
    // Se deu erro, volta a exibir o campo de busca
    searchContainer.style.display = 'block';
    toggleSearchBtn.style.display = 'none';
    
    showToast(err.message || 'Erro ao buscar mensagens.', 4000);
  }
}

// ── Event Listeners ────────────────────────────────────────────────────────
searchMsgsBtn.addEventListener('click', buscarMensagens);

inputMonitor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') buscarMensagens();
});

// ── Restaura cache ao carregar a página ────────────────────────────────────
chrome.storage.session.get('unihub_messages', ({ unihub_messages }) => {
  if (unihub_messages && unihub_messages.templates && unihub_messages.templates.length > 0) {
    // Preenche o campo do monitor com o último valor buscado
    inputMonitor.value = unihub_messages.monitor || '';
    renderMessages(unihub_messages.templates, unihub_messages.monitor);
    
    // Esconde o card de busca, já que recuperamos resultados
    searchContainer.style.display = 'none';
    toggleSearchBtn.style.display = 'flex';
  }
});
