// monitors.js — Lógica da tela de Monitores

// ── Theme ───────────────────────────────────────────────────────────────────
const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

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

// ── Navigation Drawer ────────────────────────────────────────────────────────
const drawer = document.getElementById('nav-drawer');
const closeBtn = document.getElementById('drawer-close-btn');

function openDrawer() { drawer.classList.add('open'); }
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

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── DOM References ───────────────────────────────────────────────────────────
const monitorsList = document.getElementById('monitors-list');
const monitorsLoading = document.getElementById('monitors-loading');
const monitorsError = document.getElementById('monitors-error');
const monitorsEmpty = document.getElementById('monitors-empty');
const monitorsSubtitle = document.getElementById('monitors-subtitle');
const searchWrap = document.getElementById('search-wrap');
const searchInput = document.getElementById('search-monitor');
const reloadBtn = document.getElementById('reload-btn');
const refreshBtn = document.getElementById('refresh-monitors-btn');

// ── Webhook ───────────────────────────────────────────────────────────────────
const MONITORS_WEBHOOK_URL = 'https://vmi2981253.contaboserver.net/webhook/55832d02-cc94-401f-a94d-c152866ec33b';
const SESSION_KEY = 'unihub_monitors';

// ── State ─────────────────────────────────────────────────────────────────────
let allMonitors = [];

// ── Show / hide helpers ───────────────────────────────────────────────────────
function showLoading() {
  monitorsLoading.classList.add('active');
  monitorsError.classList.remove('active');
  monitorsEmpty.classList.remove('active');
  monitorsList.style.display = 'none';
  searchWrap.style.display = 'none';
  refreshBtn.style.display = 'none';
  monitorsSubtitle.textContent = 'Carregando lista de monitores...';
}

function showError() {
  monitorsLoading.classList.remove('active');
  monitorsError.classList.add('active');
  monitorsEmpty.classList.remove('active');
  monitorsList.style.display = 'none';
  searchWrap.style.display = 'none';
  refreshBtn.style.display = 'none';
  monitorsSubtitle.textContent = 'Erro ao carregar lista';
}

function showEmpty() {
  monitorsLoading.classList.remove('active');
  monitorsError.classList.remove('active');
  monitorsEmpty.classList.add('active');
  monitorsList.style.display = 'none';
  refreshBtn.style.display = 'flex';
}

function hideAll() {
  monitorsLoading.classList.remove('active');
  monitorsError.classList.remove('active');
  monitorsEmpty.classList.remove('active');
  monitorsList.style.display = 'flex';
  searchWrap.style.display = 'block';
  refreshBtn.style.display = 'flex';
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderMonitors(monitors) {
  monitorsList.innerHTML = '';

  if (!monitors || monitors.length === 0) {
    showEmpty();
    return;
  }

  hideAll();

  monitors.forEach((mon, index) => {
    const card = document.createElement('div');
    card.className = 'monitor-card';
    card.style.animationDelay = `${index * 0.05}s`;

    const telHtml = mon.contato_telefonico
      ? `<span class="monitor-tel">
           <span class="material-symbols-outlined">phone</span>
           ${mon.contato_telefonico}
         </span>`
      : `<span class="monitor-tel" style="opacity:0.4;">
           <span class="material-symbols-outlined">phone_disabled</span>
           Sem contato
         </span>`;

    const respLines = (mon.responsabilidades || []).map(r =>
      `  • ${r.modalidade}: ${r.regional_unidade}`
    ).join('\n');

    const copyText = [
      `Monitor(a): ${mon.monitor}`,
      mon.contato_telefonico ? `Contato: ${mon.contato_telefonico}` : 'Sem contato telefônico',
      '',
      'Responsabilidades:',
      respLines,
    ].join('\n');

    const respItems = (mon.responsabilidades || []).map(r => `
      <div class="resp-item">
        <span class="resp-modalidade">${r.modalidade}</span>
        <span class="resp-regional">${r.regional_unidade}</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div class="monitor-card-header">
        <span class="monitor-name">${mon.monitor}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          ${telHtml}
          <button class="copy-monitor-btn" data-copy="${copyText.replace(/"/g, '&quot;')}" title="Copiar dados do monitor"
            style="background:none;border:2px solid rgba(128,128,128,0.25);padding:4px;display:flex;align-items:center;cursor:pointer;opacity:0.65;color:inherit;transition:opacity 0.15s,transform 0.08s;flex-shrink:0;">
            <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>
          </button>
        </div>
      </div>
      <div class="monitor-card-body">
        <p class="resp-label">
          <span class="sq"></span>
          Responsabilidades
        </p>
        ${respItems}
      </div>
    `;

    // Copy button event
    card.querySelector('.copy-monitor-btn').addEventListener('click', function () {
      const text = this.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(() => {
        const icon = this.querySelector('.material-symbols-outlined');
        icon.textContent = 'check';
        this.style.opacity = '1';
        showToast('Dados copiados!');
        setTimeout(() => {
          icon.textContent = 'content_copy';
          this.style.opacity = '0.65';
        }, 1800);
      });
    });

    monitorsList.appendChild(card);
  });

  const total = allMonitors.length;
  const shown = monitors.length;
  if (shown < total) {
    monitorsSubtitle.textContent = `${shown} de ${total} monitores exibidos`;
  } else {
    monitorsSubtitle.textContent = `${total} monitor${total !== 1 ? 'es' : ''} disponível${total !== 1 ? 'is' : ''}`;
  }
}

// ── Filter ────────────────────────────────────────────────────────────────────
function filterMonitors(query) {
  if (!query || query.trim() === '') {
    renderMonitors(allMonitors);
    return;
  }

  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filtered = allMonitors.filter(mon => {
    const name = mon.monitor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (name.includes(q)) return true;

    return (mon.responsabilidades || []).some(r => {
      const modalidade = r.modalidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const regional = r.regional_unidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return modalidade.includes(q) || regional.includes(q);
    });
  });

  renderMonitors(filtered);
}

searchInput.addEventListener('input', () => filterMonitors(searchInput.value));

// ── Fetch from webhook ────────────────────────────────────────────────────────
async function fetchMonitors() {
  showLoading();

  try {
    const response = await fetch(MONITORS_WEBHOOK_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Resposta inválida ou lista vazia.');
    }

    // Salva na sessão do Chrome para evitar re-fetch
    try {
      chrome.storage.session.set({ [SESSION_KEY]: data });
    } catch (_) {
      // Ambiente sem chrome.storage — ignora
    }

    allMonitors = data;
    renderMonitors(allMonitors);

  } catch (err) {
    console.error('[VisãoPlena] Erro ao buscar monitores:', err);
    showError();
  }
}

// ── Reload button (no error state) ───────────────────────────────────────────
reloadBtn.addEventListener('click', () => {
  searchInput.value = '';
  fetchMonitors();
});

// ── Refresh button (no title bar) ────────────────────────────────────────────
refreshBtn.addEventListener('click', () => {
  searchInput.value = '';
  try {
    chrome.storage.session.remove(SESSION_KEY, () => fetchMonitors());
  } catch (_) {
    fetchMonitors();
  }
});

// ── Init: verifica cache de sessão antes de chamar o webhook ──────────────────
function init() {
  // Registra a página atual para persistência ao trocar de aba
  try {
    chrome.storage.session.set({ unihub_panel_path: 'monitors.html' });
  } catch (_) {}

  try {
    chrome.storage.session.get(SESSION_KEY, (result) => {
      const cached = result && result[SESSION_KEY];
      if (cached && Array.isArray(cached) && cached.length > 0) {
        allMonitors = cached;
        renderMonitors(allMonitors);
      } else {
        fetchMonitors();
      }
    });
  } catch (_) {
    // Fallback para ambientes sem chrome.storage (ex: visualização direta)
    fetchMonitors();
  }
}

init();
