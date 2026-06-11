// webaulas.js — Lógica da tela de Web Aulas

// Registra a página atual para persistência ao trocar de aba
try {
  chrome.storage.session.set({ unihub_panel_path: 'webaulas.html' });
} catch (_) {}

// ── Theme ──────────────────────────────────────────────────────────────────
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

// ── Navigation Drawer ──────────────────────────────────────────────────────
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

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── DOM References ─────────────────────────────────────────────────────────
const webaulasSubtitle = document.getElementById('webaulas-subtitle');
const webaulasList = document.getElementById('webaulas-list');
const webaulasLoading = document.getElementById('webaulas-loading');
const webaulasError = document.getElementById('webaulas-error');
const webaulasEmpty = document.getElementById('webaulas-empty');
const monitorSelectCard = document.getElementById('monitor-select-card');
const monitorSelector = document.getElementById('monitor-selector');
const confirmMonitorBtn = document.getElementById('confirm-monitor-btn');
const changeMonitorBanner = document.getElementById('change-monitor-banner');
const selectedMonitorName = document.getElementById('selected-monitor-name');
const changeMonitorBtn = document.getElementById('change-monitor-btn');
const refreshBtn = document.getElementById('refresh-webaulas-btn');
const reloadBtn = document.getElementById('reload-webaulas-btn');

// ── Webhook ────────────────────────────────────────────────────────────────
const WEBAULAS_WEBHOOK_URL = 'https://vmi2981253.contaboserver.net/webhook/cdc05d29-0021-4178-b87e-4fdfee1c61b3';
const SESSION_KEY = 'unihub_webaulas';
const MONITOR_KEY = 'unihub_webaulas_monitor';

// ── State ──────────────────────────────────────────────────────────────────
let allWebaulas = [];
let selectedMonitor = null;

// ── Show / hide helpers ────────────────────────────────────────────────────
function showLoading() {
  webaulasLoading.classList.add('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'none';
  monitorSelectCard.style.display = 'none';
  changeMonitorBanner.classList.remove('active');
  refreshBtn.style.display = 'none';
  webaulasSubtitle.textContent = 'Carregando dados da semana...';
}

function showError() {
  webaulasLoading.classList.remove('active');
  webaulasError.classList.add('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'none';
  monitorSelectCard.style.display = 'none';
  changeMonitorBanner.classList.remove('active');
  refreshBtn.style.display = 'none';
  webaulasSubtitle.textContent = 'Erro ao carregar dados';
}

function showEmpty() {
  webaulasLoading.classList.remove('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.add('active');
  webaulasList.style.display = 'none';
  refreshBtn.style.display = 'flex';
}

function hideAll() {
  webaulasLoading.classList.remove('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'flex';
  refreshBtn.style.display = 'flex';
}

// ── Show monitor selection ─────────────────────────────────────────────────
function showMonitorSelection() {
  // Extract unique monitor names
  const monitors = [...new Set(
    allWebaulas
      .map(w => w['Monitor'])
      .filter(m => m != null && m.trim() !== '')
  )].sort();

  monitorSelector.innerHTML = '<option value="">Selecione...</option>';
  monitors.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    monitorSelector.appendChild(opt);
  });

  webaulasLoading.classList.remove('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'none';
  changeMonitorBanner.classList.remove('active');
  monitorSelectCard.style.display = 'block';
  refreshBtn.style.display = 'none';
  webaulasSubtitle.textContent = 'Selecione seu monitor';
}

// ── Confirm monitor ────────────────────────────────────────────────────────
confirmMonitorBtn.addEventListener('click', () => {
  const chosen = monitorSelector.value;
  if (!chosen) {
    showToast('Selecione um monitor!', 2500);
    return;
  }

  selectedMonitor = chosen;

  // Save selection
  try {
    chrome.storage.session.set({ [MONITOR_KEY]: chosen });
  } catch (_) {}

  monitorSelectCard.style.display = 'none';
  filterAndRender();
});

// ── Change monitor ─────────────────────────────────────────────────────────
changeMonitorBtn.addEventListener('click', () => {
  selectedMonitor = null;
  try {
    chrome.storage.session.remove(MONITOR_KEY);
  } catch (_) {}
  showMonitorSelection();
});

// ── Copy text helper ───────────────────────────────────────────────────────
function copyText(text, element) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado!');
    if (element) {
      element.style.opacity = '0.5';
      setTimeout(() => { element.style.opacity = ''; }, 600);
    }
  });
}

// ── Render webaulas ────────────────────────────────────────────────────────
function filterAndRender() {
  if (!selectedMonitor) {
    showMonitorSelection();
    return;
  }

  const filtered = allWebaulas.filter(w =>
    w['Monitor'] && w['Monitor'].toUpperCase() === selectedMonitor.toUpperCase()
  );

  // Show banner
  selectedMonitorName.textContent = selectedMonitor;
  changeMonitorBanner.classList.add('active');

  if (filtered.length === 0) {
    showEmpty();
    webaulasSubtitle.textContent = `Nenhuma web aula para ${selectedMonitor}`;
    return;
  }

  hideAll();
  renderWebaulas(filtered);
}

function renderWebaulas(webaulas) {
  webaulasList.innerHTML = '';

  // Group by date
  const byDate = {};
  webaulas.forEach(w => {
    const date = w['Data da Realização'] || 'Sem data';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(w);
  });

  const dateKeys = Object.keys(byDate);

  dateKeys.forEach((date, dateIdx) => {
    // Date divider
    const divider = document.createElement('div');
    divider.className = 'wa-date-divider';
    divider.innerHTML = `
      <span class="divider-line"></span>
      <span class="divider-text">📅 ${date}</span>
      <span class="divider-line"></span>
    `;
    webaulasList.appendChild(divider);

    byDate[date].forEach((wa, index) => {
      const card = document.createElement('div');
      card.className = 'webaula-card';
      card.style.animationDelay = `${(dateIdx * 3 + index) * 0.06}s`;

      // Determine status badge classes
      const ytStatusClass = wa['Status do Youtube'] === 'OK' ? 'green' : (wa['Status do Youtube'] ? 'red' : 'neutral');
      const postClass = wa['Postagem em Sala'] === 'SIM' ? 'green' : (wa['Postagem em Sala'] === 'NÃO' ? 'red' : 'neutral');

      // Build action buttons (only show if value is not null)
      let actionsHtml = '';
      const actions = [];

      if (wa['planilha_origem']) {
        actions.push(`
          <a href="${wa['planilha_origem']}" target="_blank" rel="noopener" class="wa-action-btn" title="Abrir planilha de origem">
            <span class="material-symbols-outlined" style="font-size:14px;">table_view</span>
            Planilha
          </a>
        `);
      }

      if (wa['link_categoria']) {
        actions.push(`
          <a href="${wa['link_categoria']}" target="_blank" rel="noopener" class="wa-action-btn" title="Abrir categoria no Moodle">
            <span class="material-symbols-outlined" style="font-size:14px;">category</span>
            Categoria
          </a>
        `);
      }

      if (wa['link_uc']) {
        actions.push(`
          <a href="${wa['link_uc']}" target="_blank" rel="noopener" class="wa-action-btn" title="Abrir UC no Moodle">
            <span class="material-symbols-outlined" style="font-size:14px;">school</span>
            UC
          </a>
        `);
      }

      if (wa['Link Youtube Formatado']) {
        actions.push(`
          <button class="wa-action-btn accent-btn copy-yt-html-btn" title="Copiar HTML do YouTube formatado">
            <span class="material-symbols-outlined" style="font-size:14px;">code</span>
            Copiar HTML
          </button>
        `);
      }

      if (actions.length > 0) {
        actionsHtml = `
          <hr class="wa-separator">
          <div class="wa-actions">
            ${actions.join('')}
          </div>
        `;
      }

      // Build YouTube link display
      const ytLinkHtml = wa['Link do Youtube']
        ? `<span class="wa-field-value" title="Clique para copiar" data-copy="${wa['Link do Youtube']}">${wa['Link do Youtube']}</span>`
        : `<span class="wa-field-value null-val">—</span>`;

      // Build categoria display
      const categoriaHtml = wa['categoria']
        ? `<span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['categoria'] || '').replace(/"/g, '&quot;')}" style="word-break:break-word;">${wa['categoria']}</span>`
        : `<span class="wa-field-value null-val">—</span>`;

      card.innerHTML = `
        <div class="webaula-card-header">
          <span class="wa-curso">${wa['Curso'] || '—'}</span>
          <span class="wa-estado">${wa['Estado'] || '—'}</span>
        </div>
        <div class="webaula-card-body">

          <!-- Evento & UC -->
          <div class="wa-field-row">
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Evento</span>
              <span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['Evento'] || '').replace(/"/g, '&quot;')}">${wa['Evento'] || '—'}</span>
            </div>
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Nº Aula</span>
              <span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['Número da Aula'] || '').replace(/"/g, '&quot;')}">${wa['Número da Aula'] || '—'}</span>
            </div>
          </div>

          <!-- UC Full -->
          <div class="wa-field-row full">
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Unidade Curricular</span>
              <span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['Unidade Curricular'] || '').replace(/"/g, '&quot;')}" style="word-break:break-word;">${wa['Unidade Curricular'] || '—'}</span>
            </div>
          </div>

          <!-- Tema -->
          <div class="wa-field-row full">
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Tema da Web Aula</span>
              <span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['Tema da Web Aula'] || '').replace(/"/g, '&quot;')}" style="word-break:break-word;">${wa['Tema da Web Aula'] || '—'}</span>
            </div>
          </div>

          <!-- Tutor & Horário -->
          <div class="wa-field-row">
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Tutor</span>
              <span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['Tutor'] || '').replace(/"/g, '&quot;')}">${wa['Tutor'] || '—'}</span>
            </div>
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Horário</span>
              <span class="wa-field-value" title="Clique para copiar" data-copy="${(wa['Horário'] || '').replace(/"/g, '&quot;')}">${wa['Horário'] || '—'}</span>
            </div>
          </div>

          <!-- Categoria -->
          <div class="wa-field-row full">
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Categoria</span>
              ${categoriaHtml}
            </div>
          </div>

          <!-- YouTube Link -->
          <div class="wa-field-row full">
            <div class="wa-field">
              <span class="wa-field-label"><span class="sq"></span> Link do YouTube</span>
              ${ytLinkHtml}
            </div>
          </div>

          <!-- Status badges -->
          <div class="wa-status-row">
            <div class="wa-badge ${ytStatusClass}">
              <span class="badge-label">YouTube</span>
              <span class="badge-value">${wa['Status do Youtube'] || '—'}</span>
            </div>
            <div class="wa-badge ${postClass}">
              <span class="badge-label">Postagem</span>
              <span class="badge-value">${wa['Postagem em Sala'] || '—'}</span>
            </div>
          </div>

          ${actionsHtml}

        </div>
      `;

      // Attach copy events to all copyable fields
      card.querySelectorAll('.wa-field-value[data-copy]').forEach(el => {
        el.addEventListener('click', function () {
          const text = this.getAttribute('data-copy');
          if (text) copyText(text, this);
        });
      });

      // Attach copy HTML button event
      const copyHtmlBtn = card.querySelector('.copy-yt-html-btn');
      if (copyHtmlBtn) {
        copyHtmlBtn.addEventListener('click', () => {
          copyText(wa['Link Youtube Formatado'], copyHtmlBtn);
          const icon = copyHtmlBtn.querySelector('.material-symbols-outlined');
          const label = copyHtmlBtn.childNodes[copyHtmlBtn.childNodes.length - 1];
          if (icon) icon.textContent = 'check';
          if (label && label.nodeType === Node.TEXT_NODE) label.textContent = ' Copiado!';
          setTimeout(() => {
            if (icon) icon.textContent = 'code';
            if (label && label.nodeType === Node.TEXT_NODE) label.textContent = '\n            Copiar HTML\n          ';
          }, 1800);
        });
      }

      webaulasList.appendChild(card);
    });
  });

  const total = webaulas.length;
  webaulasSubtitle.textContent = `${total} web aula${total !== 1 ? 's' : ''} — ${selectedMonitor}`;
}

// ── Fetch from webhook ─────────────────────────────────────────────────────
async function fetchWebaulas() {
  showLoading();

  try {
    const response = await fetch(WEBAULAS_WEBHOOK_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Resposta inválida ou lista vazia.');
    }

    // Save in session
    try {
      chrome.storage.session.set({ [SESSION_KEY]: data });
    } catch (_) {}

    allWebaulas = data;

    // Check if we have a saved monitor
    try {
      chrome.storage.session.get(MONITOR_KEY, (result) => {
        const saved = result && result[MONITOR_KEY];
        if (saved) {
          // Verify the monitor still exists in data
          const exists = allWebaulas.some(w =>
            w['Monitor'] && w['Monitor'].toUpperCase() === saved.toUpperCase()
          );
          if (exists) {
            selectedMonitor = saved;
            filterAndRender();
            return;
          }
        }
        showMonitorSelection();
      });
    } catch (_) {
      showMonitorSelection();
    }

  } catch (err) {
    console.error('[Plenum] Erro ao buscar web aulas:', err);
    showError();
  }
}

// ── Reload button (error state) ────────────────────────────────────────────
reloadBtn.addEventListener('click', () => {
  fetchWebaulas();
});

// ── Refresh button (title bar) ─────────────────────────────────────────────
refreshBtn.addEventListener('click', () => {
  try {
    chrome.storage.session.remove(SESSION_KEY, () => fetchWebaulas());
  } catch (_) {
    fetchWebaulas();
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  try {
    chrome.storage.session.get([SESSION_KEY, MONITOR_KEY], (result) => {
      const cached = result && result[SESSION_KEY];
      const savedMonitor = result && result[MONITOR_KEY];

      if (cached && Array.isArray(cached) && cached.length > 0) {
        allWebaulas = cached;

        if (savedMonitor) {
          const exists = allWebaulas.some(w =>
            w['Monitor'] && w['Monitor'].toUpperCase() === savedMonitor.toUpperCase()
          );
          if (exists) {
            selectedMonitor = savedMonitor;
            filterAndRender();
            return;
          }
        }
        showMonitorSelection();
      } else {
        fetchWebaulas();
      }
    });
  } catch (_) {
    fetchWebaulas();
  }
}

init();
