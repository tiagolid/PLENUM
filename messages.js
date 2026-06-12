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
    if(themeIcon) themeIcon.textContent = 'light_mode';
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    if(themeIcon) themeIcon.textContent = 'dark_mode';
  }
}

const savedTheme = localStorage.getItem('unihub-theme') || 'light';
applyTheme(savedTheme);

if(themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = html.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('unihub-theme', next);
    applyTheme(next);
  });
}

// ── Navigation Drawer ──────────────────────────────────────────────────────
const drawer   = document.getElementById('nav-drawer');
const closeBtn = document.getElementById('drawer-close-btn');
const menuBtn  = document.getElementById('menu-btn');
const dadosAlunoBtn = document.getElementById('drawer-dados-aluno');

function openDrawer()  { if(drawer) drawer.classList.add('open'); }
function closeDrawer() { if(drawer) drawer.classList.remove('open'); }

if(menuBtn) menuBtn.addEventListener('click', openDrawer);
if(closeBtn) closeBtn.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

if(dadosAlunoBtn) {
  dadosAlunoBtn.addEventListener('click', (e) => {
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
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ── DOM References ─────────────────────────────────────────────────────────
const msgsSubtitle       = document.getElementById('msgs-subtitle');
const msgsList           = document.getElementById('messages-list');
const msgsLoading        = document.getElementById('msgs-loading');
const msgsError          = document.getElementById('msgs-error');
const emptyState         = document.getElementById('empty-state');
const monitorSelectCard  = document.getElementById('monitor-select-card');
const monitorSelector    = document.getElementById('monitor-selector');
const confirmMonitorBtn  = document.getElementById('confirm-monitor-btn');
const changeMonitorBtn   = document.getElementById('change-monitor-btn');
const refreshBtn         = document.getElementById('refresh-msgs-btn');
const reloadBtn          = document.getElementById('reload-msgs-btn');
const topActions         = document.getElementById('top-actions');
const planilhaBtn        = document.getElementById('planilha-btn');
const filterBar          = document.getElementById('filter-bar');
const filterModalidade   = document.getElementById('filter-modalidade');

// ── Webhook ────────────────────────────────────────────────────────────────
const MSGS_WEBHOOK_URL = 'https://vmi2981253.contaboserver.net/webhook/608bf17d-a951-44c7-aced-2d9cb492921a';
const SESSION_KEY = 'unihub_messages_data';
const MONITOR_KEY = 'unihub_messages_monitor';

// ── State ──────────────────────────────────────────────────────────────────
let allData = [];
let messagesList = [];
let planilhaUrl = '';
let selectedMonitor = null;
let selectedModalidade = '';

// ── Show / hide helpers ────────────────────────────────────────────────────
function showLoading() {
  if(msgsLoading) msgsLoading.classList.add('active');
  if(msgsError) msgsError.style.display = 'none';
  if(emptyState) emptyState.style.display = 'none';
  if(msgsList) msgsList.style.display = 'none';
  if(monitorSelectCard) monitorSelectCard.style.display = 'none';
  if(topActions) topActions.style.display = 'none';
  if(filterBar) filterBar.classList.remove('active');
  if(msgsSubtitle) msgsSubtitle.textContent = 'Carregando modelos...';
}

function showError() {
  if(msgsLoading) msgsLoading.classList.remove('active');
  if(msgsError) msgsError.style.display = 'flex';
  if(emptyState) emptyState.style.display = 'none';
  if(msgsList) msgsList.style.display = 'none';
  if(monitorSelectCard) monitorSelectCard.style.display = 'none';
  if(topActions) topActions.style.display = 'none';
  if(filterBar) filterBar.classList.remove('active');
  if(msgsSubtitle) msgsSubtitle.textContent = 'Erro ao carregar dados';
}

function showEmpty(msg) {
  if(msgsLoading) msgsLoading.classList.remove('active');
  if(msgsError) msgsError.style.display = 'none';
  if(emptyState) {
    emptyState.style.display = 'flex';
    const p = emptyState.querySelector('p');
    if(p) p.innerHTML = msg || 'Nenhuma mensagem encontrada<br>para este monitor';
  }
  if(msgsList) msgsList.style.display = 'none';
  if(topActions) topActions.style.display = 'flex';
  if(filterBar) filterBar.classList.add('active');
}

function hideAll() {
  if(msgsLoading) msgsLoading.classList.remove('active');
  if(msgsError) msgsError.style.display = 'none';
  if(emptyState) emptyState.style.display = 'none';
  if(msgsList) msgsList.style.display = 'flex';
  if(topActions) topActions.style.display = 'flex';
  if(filterBar) filterBar.classList.add('active');
}

// ── Show monitor selection ─────────────────────────────────────────────────
function showMonitorSelection() {
  try {
    if(!Array.isArray(messagesList)) messagesList = [];
    
    const monitors = [...new Set(
      messagesList
        .map(m => m && m['monitor'])
        .filter(m => typeof m === 'string' && m.trim() !== '')
    )].sort();

    if(monitorSelector) {
      monitorSelector.innerHTML = '<option value="">Selecione...</option>';
      monitors.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monitorSelector.appendChild(opt);
      });
    }

    if(msgsLoading) msgsLoading.classList.remove('active');
    if(msgsError) msgsError.style.display = 'none';
    if(emptyState) emptyState.style.display = 'none';
    if(msgsList) msgsList.style.display = 'none';
    if(filterBar) filterBar.classList.remove('active');
    
    if(topActions) topActions.style.display = 'flex';
    if(changeMonitorBtn) changeMonitorBtn.style.display = 'none';
    
    if(planilhaBtn) {
      if (planilhaUrl) {
        planilhaBtn.href = planilhaUrl;
        planilhaBtn.style.display = 'flex';
      } else {
        planilhaBtn.style.display = 'none';
      }
    }
    
    if(monitorSelectCard) monitorSelectCard.style.display = 'block';
    if(msgsSubtitle) msgsSubtitle.textContent = 'Selecione seu monitor';
  } catch (err) {
    console.error('showMonitorSelection error:', err);
    showError();
  }
}

// ── Update Modalidade Filter ───────────────────────────────────────────────
function updateModalidadeFilter(monitorMessages) {
  if(!filterModalidade) return;
  
  const modalidades = [...new Set(
    monitorMessages
      .map(m => m && m['modalidade'])
      .filter(m => typeof m === 'string' && m.trim() !== '')
  )].sort();

  const currentVal = filterModalidade.value;
  filterModalidade.innerHTML = '<option value="">Todas as modalidades</option>';
  
  modalidades.forEach(mod => {
    const opt = document.createElement('option');
    opt.value = mod;
    opt.textContent = mod;
    filterModalidade.appendChild(opt);
  });

  if (modalidades.includes(currentVal)) {
    filterModalidade.value = currentVal;
    selectedModalidade = currentVal;
  } else {
    filterModalidade.value = '';
    selectedModalidade = '';
  }
}

// ── Confirm monitor ────────────────────────────────────────────────────────
if(confirmMonitorBtn) {
  confirmMonitorBtn.addEventListener('click', () => {
    if(!monitorSelector) return;
    const chosen = String(monitorSelector.value || '');
    if (!chosen) {
      showToast('Selecione um monitor!', 2500);
      return;
    }

    selectedMonitor = chosen;
    selectedModalidade = ''; // reset modalidade
    if(filterModalidade) filterModalidade.value = '';
    try { chrome.storage.session.set({ [MONITOR_KEY]: chosen }); } catch (_) { }

    if(monitorSelectCard) monitorSelectCard.style.display = 'none';
    if(changeMonitorBtn) changeMonitorBtn.style.display = 'flex';
    filterAndRender();
  });
}

// ── Change monitor ─────────────────────────────────────────────────────────
if(changeMonitorBtn) {
  changeMonitorBtn.addEventListener('click', () => {
    selectedMonitor = null;
    selectedModalidade = ''; // reset modalidade
    if(filterModalidade) filterModalidade.value = '';
    try { chrome.storage.session.remove(MONITOR_KEY); } catch (_) { }
    showMonitorSelection();
  });
}

// ── Filter change listener ─────────────────────────────────────────────────
if(filterModalidade) {
  filterModalidade.addEventListener('change', () => {
    selectedModalidade = String(filterModalidade.value || '');
    filterAndRender(true); // render without updating options
  });
}

// ── Copy text helper ───────────────────────────────────────────────────────
function copiarMensagem(texto, btn) {
  navigator.clipboard.writeText(texto).then(() => {
    const icon  = btn.querySelector('.btn-icon');
    
    const prevIcon  = icon ? icon.textContent : '';
    
    if (icon) icon.textContent  = 'check';
    btn.classList.add('copied');

    showToast('Mensagem copiada!');

    setTimeout(() => {
      if (icon) icon.textContent  = prevIcon;
      btn.classList.remove('copied');
    }, 1800);
  });
}

// ── Filter and Render messages ──────────────────────────────────────────────
function filterAndRender(skipFilterUpdate = false) {
  try {
    if (!selectedMonitor) {
      showMonitorSelection();
      return;
    }

    if(!Array.isArray(messagesList)) messagesList = [];

    const monitorMessages = messagesList.filter(m =>
      m && m['monitor'] && typeof m['monitor'] === 'string' && m['monitor'].toUpperCase() === String(selectedMonitor).toUpperCase()
    );

    if (!skipFilterUpdate) {
      updateModalidadeFilter(monitorMessages);
    }

    const filtered = selectedModalidade
      ? monitorMessages.filter(m => m && m['modalidade'] === selectedModalidade)
      : monitorMessages;

    const totalForMonitor = filtered.length;

    if(msgsSubtitle) {
      msgsSubtitle.innerHTML = `${totalForMonitor} modelo${totalForMonitor !== 1 ? 's' : ''} — <span class="monitor-chip" id="subtitle-monitor-chip">${selectedMonitor} <span class="material-symbols-outlined">swap_horiz</span></span>`;
    }

    const chip = document.getElementById('subtitle-monitor-chip');
    if (chip) {
      chip.addEventListener('click', () => {
        selectedMonitor = null;
        selectedModalidade = ''; // reset
        if(filterModalidade) filterModalidade.value = '';
        try { chrome.storage.session.remove(MONITOR_KEY); } catch (_) { }
        showMonitorSelection();
      });
    }

    if(changeMonitorBtn) changeMonitorBtn.style.display = 'flex';
    if(planilhaBtn) {
      if (planilhaUrl) {
        planilhaBtn.href = planilhaUrl;
        planilhaBtn.style.display = 'flex';
      } else {
        planilhaBtn.style.display = 'none';
      }
    }

    if (filtered.length === 0) {
      if(selectedModalidade) {
        showEmpty(`Nenhuma mensagem de ${selectedModalidade} encontrada para este monitor.`);
      } else {
        showEmpty('Nenhuma mensagem encontrada<br>para este monitor');
      }
      return;
    }

    hideAll();
    renderMessages(filtered, String(selectedMonitor));
  } catch (err) {
    console.error('filterAndRender error:', err);
    showError();
  }
}

function renderMessages(templates, monitorName) {
  if(!msgsList) return;
  msgsList.innerHTML = '';

  if(!Array.isArray(templates)) return;

  templates.forEach((tpl, index) => {
    if(!tpl) return;
    
    const originalText = String(tpl.mensagem || '');
    const texto = monitorName
      ? originalText.replace(/\[MONITOR\]/gi, monitorName)
      : originalText;

    const tipo = String(tpl.tipo || 'Mensagem');
    const modalidade = String(tpl.modalidade || '');

    const card = document.createElement('div');
    card.className = 'msg-card';
    card.style.animationDelay = `${index * 0.06}s`;

    card.innerHTML = `
      <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="material-symbols-outlined" style="font-size: 16px; opacity: 0.8;">mail</span>
            <h3 style="font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">${tipo}</h3>
            ${modalidade ? `<span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; background: var(--accent); color: var(--black); padding: 2px 6px; border: 2px solid var(--border-color); text-transform: uppercase;">${modalidade}</span>` : ''}
          </div>
          <button class="btn-copy" id="copy-btn-${index}" title="Copiar Mensagem" style="background: transparent; border: 2px solid var(--border-color); padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: inherit; transition: all 0.15s; flex-shrink: 0;">
            <span class="material-symbols-outlined btn-icon" style="font-size: 16px;">content_copy</span>
          </button>
        </div>
        <p class="msg-text" style="color: inherit; opacity: 0.95; line-height: 1.5; margin-top: 4px;">${texto.replace(/\\n/g, '<br>')}</p>
      </div>
    `;

    const copyBtn = card.querySelector(`#copy-btn-${index}`);
    if(copyBtn) {
      copyBtn.addEventListener('click', function () {
        copiarMensagem(texto, this);
      });
    }

    msgsList.appendChild(card);
  });
}

// ── Fetch from webhook ─────────────────────────────────────────────────────
async function fetchMessages() {
  showLoading();

  try {
    const response = await fetch(MSGS_WEBHOOK_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Resposta inválida ou lista vazia.');
    }

    try { chrome.storage.session.set({ [SESSION_KEY]: data }); } catch (_) { }

    allData = data;
    
    // First item is planilha
    if (allData.length > 0 && allData[0] && allData[0].planilha) {
      planilhaUrl = String(allData[0].planilha);
      messagesList = allData.slice(1);
    } else {
      messagesList = allData;
    }

    // Check if we have a saved monitor
    try {
      chrome.storage.session.get(MONITOR_KEY, (result) => {
        try {
          const saved = result && result[MONITOR_KEY];
          if (saved && typeof saved === 'string') {
            const exists = messagesList.some(m =>
              m && m['monitor'] && typeof m['monitor'] === 'string' && m['monitor'].toUpperCase() === saved.toUpperCase()
            );
            if (exists) {
              selectedMonitor = saved;
              filterAndRender();
              return;
            }
          }
          showMonitorSelection();
        } catch (e) {
          console.error('fetchMessages callback error:', e);
          showMonitorSelection();
        }
      });
    } catch (_) {
      showMonitorSelection();
    }

  } catch (err) {
    console.error('[Plenum] Erro ao buscar mensagens:', err);
    showError();
  }
}

// ── Reload button (error state) ────────────────────────────────────────────
if(reloadBtn) {
  reloadBtn.addEventListener('click', () => fetchMessages());
}

// ── Refresh button (title bar) ─────────────────────────────────────────────
if(refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    try {
      chrome.storage.session.remove(SESSION_KEY, () => fetchMessages());
    } catch (_) {
      fetchMessages();
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  try {
    chrome.storage.session.get([SESSION_KEY, MONITOR_KEY], (result) => {
      try {
        const cached = result && result[SESSION_KEY];
        const savedMonitor = result && result[MONITOR_KEY];

        if (cached && Array.isArray(cached) && cached.length > 0) {
          allData = cached;
          
          if (allData.length > 0 && allData[0] && allData[0].planilha) {
            planilhaUrl = String(allData[0].planilha);
            messagesList = allData.slice(1);
          } else {
            messagesList = allData;
          }

          if (savedMonitor && typeof savedMonitor === 'string') {
            const exists = messagesList.some(m =>
              m && m['monitor'] && typeof m['monitor'] === 'string' && m['monitor'].toUpperCase() === savedMonitor.toUpperCase()
            );
            if (exists) {
              selectedMonitor = savedMonitor;
              filterAndRender();
              return;
            }
          }
          showMonitorSelection();
        } else {
          fetchMessages();
        }
      } catch (e) {
        console.error('init callback error:', e);
        fetchMessages();
      }
    });
  } catch (_) {
    fetchMessages();
  }
}

init();
