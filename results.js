// results.js — Lógica da tela de resultados

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
const savedTheme = localStorage.getItem('unihub-theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const next = html.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem('unihub-theme', next);
  applyTheme(next);
});

// ── Back button ────────────────────────────────────────────────────────────
document.getElementById('back-btn').addEventListener('click', () => {
  // Limpa o flag para que o painel volte ao comportamento padrão
  chrome.storage.session.remove('unihub_panel_path');
  window.location.href = 'sidepanel.html';
});

// ── Helpers ────────────────────────────────────────────────────────────────
function maskCPF(cpf) {
  if (!cpf) return '—';
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.***.***-${c.slice(9)}`;
}

function formatPhone(phone) {
  if (!phone) return '—';
  const p = phone.replace(/\D/g, '');
  if (p.length === 11) return `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`;
  if (p.length === 10) return `(${p.slice(0,2)}) ${p.slice(2,6)}-${p.slice(6)}`;
  return phone;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = value || '—';
  el.textContent = text;

  // Nada para copiar se for placeholder
  if (text === '—') {
    el.style.cursor = '';
    el.title = '';
    el.onclick = null;
    return;
  }

  // Click-to-copy: copia o texto bruto e mostra o label do campo pai
  el.style.cursor = 'pointer';
  el.title = 'Clique para copiar';
  el.onclick = () => {
    copyToClipboard(text);
    // tenta pegar o label do campo para mostrar no toast
    const label = el.closest('.field, .date-box')?.querySelector('.field-label, .date-label')?.textContent?.trim();
    showToast(label ? `${label} copiado!` : 'Copiado!');
  };
}

function setBadge(badgeId, valueId, value) {
  const badge = document.getElementById(badgeId);
  const valueEl = document.getElementById(valueId);
  if (!badge || !valueEl) return;

  const v = (value || '').toUpperCase();
  valueEl.textContent = v || '—';

  badge.classList.remove('green', 'red', 'neutral');
  if (v === 'ATIVO' || v === 'ATIVA' || v === 'ACTIVE') {
    badge.classList.add('green');
  } else if (v === 'INATIVO' || v === 'INATIVA' || v === 'INACTIVE' || v === 'CANCELADO') {
    badge.classList.add('red');
  } else {
    badge.classList.add('neutral');
  }
}

function showToast(msg = 'Copiado!') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copiado!'));
}

function openUrl(url) {
  if (!url) return;
  // Sinaliza ao background que o painel deve continuar em results.html
  // mesmo após a troca de aba provocada pela abertura do link.
  chrome.storage.session.set({ unihub_panel_path: 'results.html' });
  chrome.tabs.create({ url: url, active: true });
}

// ── Data Population ────────────────────────────────────────────────────────
let allResults = [];
let currentIndex = 0;

function populateAluno(data) {
  // Student header
  setText('student-name', data.nome_completo);
  setText('student-email', data.email);

  // Dados Aluno section
  setText('f-cpf',          data.cpf);
  setText('f-email',        data.email);
  setText('f-tel1',         formatPhone(data.telefone_1));
  setText('f-tel2',         data.telefone_2 ? formatPhone(data.telefone_2) : '—');
  setText('f-nasc',         data.data_nascimento);
  setText('f-acesso-moodle', data.ultimo_acesso_moodle);

  // Perfil Moodle button — only show when link is present
  const wrapPerfil = document.getElementById('wrap-btn-perfil');
  if (data.link_profile_moodle) {
    wrapPerfil.style.display = '';
    document.getElementById('btn-perfil').onclick = () => openUrl(data.link_profile_moodle);
  } else {
    wrapPerfil.style.display = 'none';
  }

  // Copy student data
  document.getElementById('btn-copy-aluno').onclick = () => {
    const text = [
      `Nome: ${data.nome_completo || '—'}`,
      `CPF: ${data.cpf || '—'}`,
      `E-mail: ${data.email || '—'}`,
      `Telefone 1: ${formatPhone(data.telefone_1)}`,
      `Telefone 2: ${data.telefone_2 ? formatPhone(data.telefone_2) : '—'}`,
      `Último Acesso Moodle: ${data.ultimo_acesso_moodle || '—'}`,
      `Perfil Moodle: ${data.link_profile_moodle || '—'}`,
    ].join('\n');
    copyToClipboard(text);
  };
}

function populateMatricula(data) {
  setText('m-curso-nome',    data.nome_uc);
  setText('m-inicio',        data.inicio_matricula);
  setText('m-fim',           data.fim_matricula);
  setText('m-cod-modal',     data.cod_modalidade);
  setText('m-modalidade',    data.nome_modalidade);
  setText('m-acesso-curso',  data.ultimo_acesso_curso);
  setText('m-nota',          data.nota_total || '—');

  setBadge('badge-moodle', 'm-status-moodle', data.status_moodle);
  setBadge('badge-gestor',  'm-status-gestor',  data.status_gestor);

  // Acessar UC button (link_curso) — only show when link is present
  const wrapUC = document.getElementById('wrap-btn-uc');
  if (data.link_curso) {
    wrapUC.style.display = '';
    document.getElementById('btn-uc').onclick = () => openUrl(data.link_curso);
  } else {
    wrapUC.style.display = 'none';
  }

  // Acessar Curso button (link_categoria) — only show when link is present
  const wrapCat = document.getElementById('wrap-btn-categoria');
  if (data.link_categoria) {
    wrapCat.style.display = '';
    document.getElementById('btn-categoria').onclick = () => openUrl(data.link_categoria);
  } else {
    wrapCat.style.display = 'none';
  }

  // Copy matrícula
  document.getElementById('btn-copy-matricula').onclick = () => {
    const text = [
      `Curso: ${data.nome_uc || '—'}`,
      `ID Matrícula: ${data.id_matricula || '—'}`,
      `ID UC: ${data.id_uc || '—'}`,
      `Evento Sige: ${data.evento || '—'}`,
      `Início: ${data.inicio_matricula || '—'}`,
      `Fim: ${data.fim_matricula || '—'}`,
      `Status Gestor: ${data.status_gestor || '—'}`,
      `Status Moodle: ${data.status_moodle || '—'}`,
      `Acesso ao Curso: ${data.ultimo_acesso_curso || '—'}`,
      `Nota Total: ${data.nota_total || '—'}`,
      `Modalidade: ${data.nome_modalidade || '—'}`,
      `Link Sala: ${data.link_curso || '—'}`,
      `Link Categoria: ${data.link_categoria || '—'}`,
    ].join('\n');
    copyToClipboard(text);
  };

  // Unidade
  setText('u-id',    data.id_unidade_gestor);
  setText('u-nome',  data.nome_unidade);
  setText('u-email', data.email_unidade);
  setText('u-tel',   data.telefone_unidade ? formatPhone(data.telefone_unidade) : '—');

  // Copy unidade
  document.getElementById('btn-copy-unidade').onclick = () => {
    const text = [
      `Nome Unidade: ${data.nome_unidade || '—'}`,
      `E-mail Unidade: ${data.email_unidade || '—'}`,
      `Telefone Unidade: ${data.telefone_unidade ? formatPhone(data.telefone_unidade) : '—'}`,
    ].join('\n');
    copyToClipboard(text);
  };
}

function renderRecord(index) {
  const data = allResults[index];
  if (!data) return;

  currentIndex = index;

  // Aluno data only from first record (same student across records)
  populateAluno(data);
  populateMatricula(data);

  // Update navigation
  updateNav();
}

function updateNav() {
  const nav     = document.getElementById('matricula-nav');
  const navInfo = document.getElementById('nav-info');
  const navPrev = document.getElementById('nav-prev');
  const navNext = document.getElementById('nav-next');

  if (allResults.length > 1) {
    nav.style.display = 'flex';
    navInfo.textContent = `Matrícula ${currentIndex + 1} de ${allResults.length}`;
    navPrev.disabled = currentIndex === 0;
    navNext.disabled = currentIndex === allResults.length - 1;
  } else {
    nav.style.display = 'none';
  }
}

// ── Navigation buttons ─────────────────────────────────────────────────────
document.getElementById('nav-prev').addEventListener('click', () => {
  if (currentIndex > 0) renderRecord(currentIndex - 1);
});
document.getElementById('nav-next').addEventListener('click', () => {
  if (currentIndex < allResults.length - 1) renderRecord(currentIndex + 1);
});

// ── Load data from storage ─────────────────────────────────────────────────
chrome.storage.session.get('unihub_results', ({ unihub_results }) => {
  if (!unihub_results || unihub_results.length === 0) {
    // No data — redirect back to search
    window.location.href = 'sidepanel.html';
    return;
  }

  allResults = unihub_results;
  renderRecord(0);
});

// ── Navigation Drawer ──────────────────────────────────────────────────────
(function () {
  var drawerEl   = document.getElementById('nav-drawer');
  var menuBtnEl  = document.getElementById('menu-btn');
  var closeBtnEl = document.getElementById('drawer-close-btn');

  if (!drawerEl || !menuBtnEl || !closeBtnEl) return;

  function openDrawer() {
    drawerEl.classList.add('open');
    menuBtnEl.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    drawerEl.classList.remove('open');
    menuBtnEl.setAttribute('aria-expanded', 'false');
  }


  // fecha o drawer ao clicar em "Dados Aluno" (evita onclick inline bloqueado pela CSP)
  var dadosAlunoLink = document.getElementById('drawer-dados-aluno');
  if (dadosAlunoLink) {
    dadosAlunoLink.addEventListener('click', function (e) {
      e.preventDefault();
      closeDrawer();
    });
  }

  menuBtnEl.addEventListener('click', openDrawer);
  closeBtnEl.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });
})();
