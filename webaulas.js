// webaulas.js — Lógica da tela de Web Aulas (v2 — ticket layout)

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
const changeMonitorBtn = document.getElementById('change-monitor-btn');
const refreshBtn = document.getElementById('refresh-webaulas-btn');
const reloadBtn = document.getElementById('reload-webaulas-btn');
const topActions = document.getElementById('top-actions');
const filterBar = document.getElementById('filter-bar');
const filterPendentesBtn = document.getElementById('filter-pendentes-btn');

// ── Webhook ────────────────────────────────────────────────────────────────
const WEBAULAS_WEBHOOK_URL = 'https://vmi2981253.contaboserver.net/webhook/cdc05d29-0021-4178-b87e-4fdfee1c61b3';
const SESSION_KEY = 'unihub_webaulas';
const MONITOR_KEY = 'unihub_webaulas_monitor';

// ── State ──────────────────────────────────────────────────────────────────
let allWebaulas = [];
let selectedMonitor = null;
let filterPendentes = false;

// ── Show / hide helpers ────────────────────────────────────────────────────
function showLoading() {
  webaulasLoading.classList.add('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'none';
  monitorSelectCard.style.display = 'none';
  topActions.style.display = 'none';
  filterBar.classList.remove('active');
  webaulasSubtitle.textContent = 'Carregando dados da semana...';
}

function showError() {
  webaulasLoading.classList.remove('active');
  webaulasError.classList.add('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'none';
  monitorSelectCard.style.display = 'none';
  topActions.style.display = 'none';
  filterBar.classList.remove('active');
  webaulasSubtitle.textContent = 'Erro ao carregar dados';
}

function showEmpty(msg) {
  webaulasLoading.classList.remove('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.add('active');
  webaulasList.style.display = 'none';
  topActions.style.display = 'flex';
  webaulasEmpty.querySelector('p').innerHTML = msg || 'Nenhuma web aula encontrada<br>para este monitor';
}

function hideAll() {
  webaulasLoading.classList.remove('active');
  webaulasError.classList.remove('active');
  webaulasEmpty.classList.remove('active');
  webaulasList.style.display = 'flex';
  topActions.style.display = 'flex';
  filterBar.classList.add('active');
}

// ── Show monitor selection ─────────────────────────────────────────────────
function showMonitorSelection() {
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
  topActions.style.display = 'none';
  filterBar.classList.remove('active');
  monitorSelectCard.style.display = 'block';
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
  try { chrome.storage.session.set({ [MONITOR_KEY]: chosen }); } catch (_) {}

  monitorSelectCard.style.display = 'none';
  filterAndRender();
});

// ── Change monitor ─────────────────────────────────────────────────────────
changeMonitorBtn.addEventListener('click', () => {
  selectedMonitor = null;
  try { chrome.storage.session.remove(MONITOR_KEY); } catch (_) {}
  showMonitorSelection();
});

// ── Filter toggle ──────────────────────────────────────────────────────────
filterPendentesBtn.addEventListener('click', () => {
  filterPendentes = !filterPendentes;
  filterPendentesBtn.classList.toggle('on', filterPendentes);

  const icon = filterPendentesBtn.querySelector('.material-symbols-outlined');
  if (filterPendentes) {
    icon.textContent = 'filter_alt';
    filterPendentesBtn.innerHTML = '';
    filterPendentesBtn.appendChild(icon);
    icon.textContent = 'filter_alt';
    filterPendentesBtn.append(' Pendentes ativo');
  } else {
    filterPendentesBtn.innerHTML = '';
    filterPendentesBtn.appendChild(icon);
    icon.textContent = 'filter_alt';
    filterPendentesBtn.append(' Somente pendentes');
  }

  filterAndRender();
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

// ── Date parsing helper (DD/MM/YYYY → sortable) ───────────────────────────
function parseDate(str) {
  if (!str) return 0;
  const parts = str.split('/');
  if (parts.length !== 3) return 0;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d).getTime();
}

// ── Render webaulas ────────────────────────────────────────────────────────
function filterAndRender() {
  if (!selectedMonitor) {
    showMonitorSelection();
    return;
  }

  let filtered = allWebaulas.filter(w =>
    w['Monitor'] && w['Monitor'].toUpperCase() === selectedMonitor.toUpperCase()
  );

  const totalForMonitor = filtered.length;

  // Apply pendentes filter
  if (filterPendentes) {
    filtered = filtered.filter(w =>
      !w['Postagem em Sala'] || w['Postagem em Sala'].toUpperCase() !== 'SIM'
    );
  }

  // Update subtitle with monitor chip
  const pendingCount = filterPendentes ? ` · ${filtered.length} pendente${filtered.length !== 1 ? 's' : ''}` : '';
  webaulasSubtitle.innerHTML = `${totalForMonitor} web aula${totalForMonitor !== 1 ? 's' : ''} — <span class="monitor-chip" id="subtitle-monitor-chip">${selectedMonitor} <span class="material-symbols-outlined">swap_horiz</span></span>${pendingCount}`;

  // Make chip clickable to change monitor
  const chip = document.getElementById('subtitle-monitor-chip');
  if (chip) {
    chip.addEventListener('click', () => {
      selectedMonitor = null;
      try { chrome.storage.session.remove(MONITOR_KEY); } catch (_) {}
      showMonitorSelection();
    });
  }

  if (filtered.length === 0) {
    if (filterPendentes) {
      showEmpty('Nenhuma web aula pendente<br>Tudo postado! 🎉');
    } else {
      showEmpty('Nenhuma web aula encontrada<br>para este monitor');
    }
    filterBar.classList.add('active');
    return;
  }

  hideAll();
  renderWebaulas(filtered);
}

function renderWebaulas(webaulas) {
  webaulasList.innerHTML = '';

  // Sort by date (newest first)
  const sorted = [...webaulas].sort((a, b) => {
    const da = parseDate(a['Data da Realização']);
    const db = parseDate(b['Data da Realização']);
    return db - da; // descending
  });

  // Group by date
  const byDate = {};
  sorted.forEach(w => {
    const date = w['Data da Realização'] || 'Sem data';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(w);
  });

  const dateKeys = Object.keys(byDate);
  let cardIndex = 0;

  dateKeys.forEach(date => {
    // Date divider
    const divider = document.createElement('div');
    divider.className = 'wa-date-divider';
    divider.innerHTML = `
      <span class="divider-line"></span>
      <span class="divider-text">📅 ${date}</span>
      <span class="divider-line"></span>
    `;
    webaulasList.appendChild(divider);

    byDate[date].forEach(wa => {
      const card = document.createElement('div');
      card.className = 'webaula-card';
      card.style.animationDelay = `${cardIndex * 0.05}s`;
      cardIndex++;

      // Status chip classes
      const ytClass = wa['Status do Youtube'] === 'OK' ? 'green' : (wa['Status do Youtube'] ? 'red' : 'neutral');
      const postClass = wa['Postagem em Sala'] === 'SIM' ? 'green' : (wa['Postagem em Sala'] === 'NÃO' ? 'red' : 'neutral');

      // Info strip items
      const infoItems = [
        wa['Evento'],
        wa['Número da Aula'] ? `Aula ${wa['Número da Aula']}` : null,
        wa['Horário'],
      ].filter(Boolean);

      const infoStripHtml = infoItems
        .map(item => `<span class="wa-info-tag">${item}</span>`)
        .join('<span class="wa-info-sep"></span>');

      // Action buttons (only show if not null)
      let actionBtns = '';

      if (wa['planilha_origem']) {
        actionBtns += `<a href="${wa['planilha_origem']}" target="_blank" rel="noopener" class="wa-icon-btn" title="Planilha de origem"><span class="material-symbols-outlined">table_view</span></a>`;
      }
      if (wa['link_categoria']) {
        actionBtns += `<a href="${wa['link_categoria']}" target="_blank" rel="noopener" class="wa-icon-btn" title="Categoria Moodle"><span class="material-symbols-outlined">category</span></a>`;
      }
      if (wa['link_uc']) {
        actionBtns += `<a href="${wa['link_uc']}" target="_blank" rel="noopener" class="wa-icon-btn" title="UC no Moodle"><span class="material-symbols-outlined">school</span></a>`;
      }
      if (wa['Link Youtube Formatado']) {
        actionBtns += `<button class="wa-icon-btn accent-icon copy-yt-html-btn" title="Copiar HTML YouTube"><span class="material-symbols-outlined">code</span></button>`;
      }

      // Tutor line
      const tutorHtml = wa['Tutor']
        ? `<div class="wa-meta-line"><span class="material-symbols-outlined">person</span><span class="wa-meta-val" data-copy="${(wa['Tutor'] || '').replace(/"/g, '&quot;')}">${wa['Tutor']}</span></div>`
        : '';

      // Categoria line (if it exists)
      const catHtml = wa['categoria']
        ? `<div class="wa-meta-line"><span class="material-symbols-outlined">label</span><span class="wa-meta-val" data-copy="${(wa['categoria'] || '').replace(/"/g, '&quot;')}" style="word-break:break-word;">${wa['categoria']}</span></div>`
        : '';

      // YouTube link line
      const ytHtml = wa['Link do Youtube']
        ? `<div class="wa-meta-line"><span class="material-symbols-outlined">smart_display</span><span class="wa-meta-val" data-copy="${wa['Link do Youtube']}" style="word-break:break-all;">${wa['Link do Youtube']}</span></div>`
        : '';

      card.innerHTML = `
        <div class="wa-header">
          <span class="wa-curso">${wa['Curso'] || '—'}</span>
          <span class="wa-estado">${wa['Estado'] || '—'}</span>
        </div>
        <div class="wa-body">
          <div class="wa-info-strip">${infoStripHtml}</div>

          <span class="wa-uc" data-copy="${(wa['Unidade Curricular'] || '').replace(/"/g, '&quot;')}">${wa['Unidade Curricular'] || '—'}</span>

          ${wa['Tema da Web Aula'] ? `<div class="wa-tema" data-copy="${(wa['Tema da Web Aula'] || '').replace(/"/g, '&quot;')}">${wa['Tema da Web Aula']}</div>` : ''}

          ${tutorHtml}
          ${catHtml}
          ${ytHtml}

          <div class="wa-bottom">
            <div class="wa-chips">
              <span class="wa-chip ${ytClass}">YT ${wa['Status do Youtube'] || '—'}</span>
              <span class="wa-chip ${postClass}">Post ${wa['Postagem em Sala'] || '—'}</span>
            </div>
            ${actionBtns ? `<div class="wa-icon-actions">${actionBtns}</div>` : ''}
          </div>
        </div>
      `;

      // Copy events for UC name
      const ucEl = card.querySelector('.wa-uc');
      if (ucEl && ucEl.dataset.copy) {
        ucEl.addEventListener('click', function () { copyText(this.dataset.copy, this); });
      }

      // Copy events for tema
      const temaEl = card.querySelector('.wa-tema');
      if (temaEl && temaEl.dataset.copy) {
        temaEl.addEventListener('click', function () { copyText(this.dataset.copy, this); });
      }

      // Copy events for meta values
      card.querySelectorAll('.wa-meta-val[data-copy]').forEach(el => {
        el.addEventListener('click', function () { copyText(this.dataset.copy, this); });
      });

      // Copy HTML button
      const copyHtmlBtn = card.querySelector('.copy-yt-html-btn');
      if (copyHtmlBtn) {
        copyHtmlBtn.addEventListener('click', () => {
          copyText(wa['Link Youtube Formatado'], copyHtmlBtn);
          const icon = copyHtmlBtn.querySelector('.material-symbols-outlined');
          icon.textContent = 'check';
          setTimeout(() => { icon.textContent = 'code'; }, 1500);
        });
      }

      webaulasList.appendChild(card);
    });
  });
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

    try { chrome.storage.session.set({ [SESSION_KEY]: data }); } catch (_) {}

    allWebaulas = data;

    // Check if we have a saved monitor
    try {
      chrome.storage.session.get(MONITOR_KEY, (result) => {
        const saved = result && result[MONITOR_KEY];
        if (saved) {
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
reloadBtn.addEventListener('click', () => fetchWebaulas());

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
