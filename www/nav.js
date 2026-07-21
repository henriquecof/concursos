(function() {
  // Evita que o WebKitGTK restaure uma copia congelada (bfcache) da pagina
  // ao navegar de volta. Sem isso, dados recem-importados/alterados em
  // outra pagina (ex: Editais Premium) podem nao aparecer ao voltar para
  // Meus Concursos, pois a pagina restaurada do cache nao re-executa os
  // scripts de carregamento de dados.
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
      location.reload();
    }
  });

  const APP_VERSION = '1.0.6';
  const GITHUB_REPO = 'michel-softwares/track-concursos';
  const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
  const RELEASE_CHECK_CACHE_KEY = 'ct_release_check_cache';
  const RELEASE_CHECK_START_PAGE_KEY = 'ct_release_check_start_page';
  const RELEASE_DISMISSED_KEY = 'ct_release_update_dismissed_tag';

  // Mapa de rotas: id do nav-item -> arquivo html
  const ROUTES = {
    'nav-concursos' : 'concursos.html',
    'nav-dashboard' : 'dashboard.html',
    'nav-cronograma': 'cronograma_inteligente.html',
    'nav-materias'  : 'dashboard.html',
    'nav-revisoes'  : 'revisoes.html',
    'nav-historico' : 'historico.html',
    'nav-simulados' : 'simulados.html',
    'nav-edital'    : 'cadastro_edital.html',
    'nav-config'    : 'config.html',
  };

  // Detecta qual página está ativa pelo nome do arquivo
  const currentPage = window.location.pathname.split('/').pop() || 'concursos.html';
  const NAV_ICON_PATH = 'assets/remix-nav/';
  const NAV_ICON_FILES = {
    dashboard: 'home-4',
    cronograma: 'compass-3',
    revisoes: 'check-double',
    flashcards: 'device-recover',
    historico: 'bar-chart-2',
    simulados: 'file-list-2',
    ajuda: 'information',
  };

  let latestRelease = null;
  let releaseCheckStarted = false;
  let sidebarConcursoObserver = null;
  let sidebarConcursoFrame = 0;
  let sidebarConcursoRendering = false;

  function ensureNavIconStyles() {
    if (document.getElementById('tc-nav-icon-style')) return;

    const style = document.createElement('style');
    style.id = 'tc-nav-icon-style';
    style.textContent = `
      .nav-item .icon.tc-nav-icon{display:inline-flex!important;align-items:center;justify-content:center;width:20px!important;min-width:20px;height:20px;line-height:1;color:inherit;flex:0 0 20px}
      .tc-nav-icon{--tc-nav-icon-current:var(--tc-nav-icon-fill)}
      :root[data-theme="light"] .tc-nav-icon{--tc-nav-icon-current:var(--tc-nav-icon-line)}
      .tc-nav-icon::before{content:"";display:block;width:18px;height:18px;background:currentColor;-webkit-mask-image:var(--tc-nav-icon-current);mask-image:var(--tc-nav-icon-current);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}
    `;
    document.head.appendChild(style);
  }

  function navIconHtml(key) {
    const file = NAV_ICON_FILES[key];
    if (!file) return '';
    return '<span class="icon tc-nav-icon" data-nav-icon="' + key + '" aria-hidden="true"'
      + ' style="--tc-nav-icon-line:url(&quot;' + NAV_ICON_PATH + file + '-line.svg&quot;);--tc-nav-icon-fill:url(&quot;' + NAV_ICON_PATH + file + '-fill.svg&quot;)"></span>';
  }

  function normalizeNavText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function inferNavIconKey(item) {
    if (!item || item.closest?.('.nav') == null) return '';
    const id = item.id || '';
    const onclick = String(item.getAttribute('onclick') || '').toLowerCase();
    const text = normalizeNavText(item.textContent || '');

    if (id === 'navFlashcardsDashboard' || text.includes('flashcards')) return 'flashcards';
    if (id === 'navCronogramaInteligente' || onclick.includes('cronograma_inteligente') || text.includes('cronograma inteligente')) return 'cronograma';
    if (id === 'navDashboardOverview' || onclick.includes('dashboard.html') || /\bdashboard\b/.test(text)) return 'dashboard';
    if (onclick.includes('revisoes.html') || text.includes('revis')) return 'revisoes';
    if (onclick.includes('historico.html') || text.includes('metric')) return 'historico';
    if (onclick.includes('simulados.html') || text.includes('simulados')) return 'simulados';
    if (onclick.includes('ajuda.html') || text.includes('ajuda')) return 'ajuda';
    return '';
  }

  function setNavItemIcon(item, key) {
    if (!item || !NAV_ICON_FILES[key]) return;
    const existing = item.querySelector(':scope > .icon');
    if (existing && existing.dataset.navIcon === key) return;
    const html = navIconHtml(key);
    if (!html) return;
    if (existing) existing.outerHTML = html;
    else item.insertAdjacentHTML('afterbegin', html + ' ');
  }

  function applyProfessionalNavIcons() {
    ensureNavIconStyles();
    document.querySelectorAll('nav.nav .nav-item').forEach(item => {
      const key = inferNavIconKey(item);
      if (key) setNavItemIcon(item, key);
    });
  }

  function ensureSidebarScrollStyles() {
    if (document.getElementById('tc-sidebar-scroll-style')) return;

    const style = document.createElement('style');
    style.id = 'tc-sidebar-scroll-style';
    style.textContent = `
      .sidebar{height:100vh;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
      .sidebar>:not(.modal-overlay){flex-shrink:0}
      .sidebar .nav{flex:1 0 auto!important}
      .sidebar a[href="ajuda.html"] span[style*="accent2"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;flex-wrap:nowrap!important;white-space:nowrap!important;max-width:100%!important;font-size:11px!important;line-height:1.1!important}
      .sidebar a[href="ajuda.html"] span[style*="accent2"] img[src*="logoMichelSoftwares"]{height:36px!important;width:auto!important;max-width:117px!important;object-fit:contain!important;flex:0 0 auto!important;vertical-align:middle!important}
      @supports (height:100dvh){.sidebar{height:100dvh}}
      @media (max-width:820px){.sidebar{height:auto;overflow:visible}.sidebar .nav{flex:none!important}}
    `;
    document.head.appendChild(style);
  }

  function todayKey() {
    if (window.CT && typeof CT._today === 'function') return CT._today();
    return new Date().toISOString().slice(0, 10);
  }

  function readReleaseCache() {
    try {
      const raw = localStorage.getItem(RELEASE_CHECK_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeReleaseCache(cache) {
    try {
      localStorage.setItem(RELEASE_CHECK_CACHE_KEY, JSON.stringify(cache || {}));
    } catch (error) {
      // Cache failure must never affect app startup.
    }
  }

  function getAppStartPage() {
    let startPage = sessionStorage.getItem(RELEASE_CHECK_START_PAGE_KEY);
    if (!startPage) {
      startPage = currentPage;
      sessionStorage.setItem(RELEASE_CHECK_START_PAGE_KEY, startPage);
    }
    return startPage;
  }

  function ensureVersionStyles() {
    if (document.getElementById('tc-version-style')) return;

    const style = document.createElement('style');
    style.id = 'tc-version-style';
    style.textContent = `
      .sidebar-logo{display:flex;flex-direction:column;align-items:center;gap:4px}
      .logo{flex-direction:column;align-items:flex-start;gap:3px}
      .tc-version-check{display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1;text-align:center}
      .logo .tc-version-check{align-items:flex-start;margin-left:4px}
      .tc-version-current{font-family:var(--mono,'Inter',sans-serif);font-size:10px;font-weight:700;color:var(--text3);opacity:.76;letter-spacing:.02em}
      .tc-version-update{display:none;border:0;background:transparent;padding:0;font-family:var(--sans,'Inter',sans-serif);font-size:10px;font-weight:700;color:var(--green);cursor:pointer;line-height:1.25;text-decoration:none}
      .tc-version-update.visible{display:inline-flex}
      .tc-version-update.compact{width:14px;height:14px;border:1px solid var(--border);border-radius:999px;align-items:center;justify-content:center;color:var(--text3);font-size:9px;line-height:1;background:rgba(255,255,255,.03)}
      .tc-version-update:hover{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
      .tc-version-update.compact:hover{text-decoration:none;border-color:var(--accent);color:var(--accent)}
      .tc-update-overlay{position:fixed;inset:0;background:var(--overlay,rgba(4,7,14,.72));z-index:99999;display:none;align-items:center;justify-content:center;padding:18px}
      .tc-update-overlay.visible{display:flex}
      .tc-update-card{width:min(360px,100%);background:var(--bg2);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-medium,0 24px 60px rgba(0,0,0,.46));padding:18px;color:var(--text)}
      .tc-update-title{font-size:16px;font-weight:800;color:var(--text2);margin-bottom:8px}
      .tc-update-text{font-size:13px;line-height:1.55;color:var(--text3);margin-bottom:14px}
      .tc-update-text strong{color:var(--text2);font-weight:800}
      .tc-update-actions{display:flex;gap:8px;justify-content:flex-end}
      .tc-update-btn{border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text2);font:700 12px var(--sans,'Inter',sans-serif);padding:9px 12px;cursor:pointer;transition:all .15s}
      .tc-update-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft,rgba(79,142,247,.1))}
      .tc-update-btn.primary{border-color:transparent;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}
      .tc-update-btn.primary:hover{transform:translateY(-1px);color:#fff}
    `;
    document.head.appendChild(style);
  }

  function normalizeVersion(version) {
    return String(version || '').trim().replace(/^v/i, '');
  }

  function compareVersions(a, b) {
    const pa = normalizeVersion(a).split(/[.-]/).map(part => parseInt(part, 10) || 0);
    const pb = normalizeVersion(b).split(/[.-]/).map(part => parseInt(part, 10) || 0);
    const len = Math.max(pa.length, pb.length);

    for (let i = 0; i < len; i += 1) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function injectVersionCheck() {
    ensureVersionStyles();

    const targets = Array.from(document.querySelectorAll('.sidebar-logo, .logo'));
    targets.forEach(target => {
      if (target.querySelector('.tc-version-check')) return;

      const wrap = document.createElement('div');
      wrap.className = 'tc-version-check';
      wrap.innerHTML = `
        <div class="tc-version-current">v${APP_VERSION}</div>
        <button class="tc-version-update" type="button">(nova atualização disponível)</button>
      `;

      const updateButton = wrap.querySelector('.tc-version-update');
      updateButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openUpdateModal();
      });

      target.appendChild(wrap);
    });
  }

  function setUpdateAvailable(release) {
    latestRelease = release || latestRelease || {};
    const tag = latestRelease.tag_name || latestRelease.latestTag || 'latest';
    const dismissed = localStorage.getItem(RELEASE_DISMISSED_KEY) === tag;
    document.querySelectorAll('.tc-version-update').forEach(button => {
      button.classList.add('visible');
      button.classList.toggle('compact', dismissed);
      button.textContent = dismissed ? '?' : '(nova atualizacao disponivel)';
      button.setAttribute('title', `Abrir detalhes da versao ${latestRelease.tag_name || 'mais recente'}`);
      button.setAttribute('aria-label', 'Nova atualizacao disponivel');
    });
  }

  function applyCachedRelease(cache) {
    if (!cache || !cache.latestTag) return;
    if (compareVersions(cache.latestTag, APP_VERSION) > 0) {
      setUpdateAvailable({
        tag_name: cache.latestTag,
        html_url: cache.html_url || RELEASES_URL,
      });
    }
  }

  async function checkLatestRelease(force) {
    const today = todayKey();
    const cache = readReleaseCache();
    applyCachedRelease(cache);

    if (!force && cache && cache.checkedOn === today) return;
    if (!force && getAppStartPage() !== currentPage) return;
    if (releaseCheckStarted && !force) return;
    releaseCheckStarted = true;

    try {
      let release = null;

      if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_latest_release === 'function') {
        const result = await window.pywebview.api.get_latest_release();
        if (result && result.ok) release = result;
      } else {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store',
        });
        if (response.ok) release = await response.json();
      }

      const latestTag = release && (release.tag_name || release.version);
      writeReleaseCache({
        checkedOn: today,
        checkedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        latestTag: latestTag || '',
        html_url: release && (release.html_url || RELEASES_URL) || RELEASES_URL,
      });
      if (latestTag && compareVersions(latestTag, APP_VERSION) > 0) {
        setUpdateAvailable({
          tag_name: latestTag,
          html_url: release.html_url || RELEASES_URL,
        });
      }
    } catch (error) {
      writeReleaseCache({
        checkedOn: today,
        checkedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        latestTag: cache && cache.latestTag || '',
        html_url: cache && cache.html_url || RELEASES_URL,
        failed: true,
      });
      // Falha de rede nao deve incomodar o uso normal do app.
    }
  }

  function checkLatestReleaseWithApi() {
    checkLatestRelease(false);
  }

  function closeUpdateModal() {
    const overlay = document.getElementById('tcUpdateOverlay');
    if (overlay) overlay.remove();
  }

  function dismissUpdateNotice() {
    if (latestRelease && latestRelease.tag_name) {
      localStorage.setItem(RELEASE_DISMISSED_KEY, latestRelease.tag_name);
    }
    closeUpdateModal();
    setUpdateAvailable(latestRelease);
  }

  async function openLatestRelease() {
    const url = (latestRelease && latestRelease.html_url) || RELEASES_URL;

    try {
      if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.open_external_url === 'function') {
        await window.pywebview.api.open_external_url(url);
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } finally {
      closeUpdateModal();
    }
  }

  function openUpdateModal() {
    closeUpdateModal();

    const versionLabel = latestRelease && latestRelease.tag_name
      ? `versão ${latestRelease.tag_name}`
      : 'versão mais recente';

    const overlay = document.createElement('div');
    overlay.id = 'tcUpdateOverlay';
    overlay.className = 'tc-update-overlay visible';
    overlay.innerHTML = `
      <div class="tc-update-card" role="dialog" aria-modal="true" aria-labelledby="tcUpdateTitle">
        <div class="tc-update-title" id="tcUpdateTitle">Nova atualização disponível</div>
        <div class="tc-update-text">
          Existe uma nova versão do Track Concursos no GitHub: <strong>${versionLabel}</strong>.<br>
          Ao confirmar, o app vai abrir a release mais recente no seu navegador.
        </div>
        <div class="tc-update-actions">
          <button class="tc-update-btn" type="button" data-close-update>Depois</button>
          <button class="tc-update-btn primary" type="button" data-open-release>Abrir release</button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-close-update]')) dismissUpdateNotice();
      if (event.target.closest('[data-open-release]')) openLatestRelease();
    });

    document.body.appendChild(overlay);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getFlashcardsDueCount() {
    const cId = sessionStorage.getItem('ct_concurso_ativo');
    const today = todayKey();
    return readJson('ct_flashcards', []).filter(card => {
      if (cId && card.concursoId !== cId) return false;
      const srs = card.srs || {};
      if (!srs.status || srs.status === 'new') return true;
      if (!srs.nextReview) return true;
      return String(srs.nextReview).slice(0, 10) <= today;
    }).length;
  }

  function ensureFlashcardsNavStyles() {
    if (document.getElementById('flashcards-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'flashcards-nav-style';
    style.textContent = '.nav-badge{margin-left:auto;background:var(--red,#f55a5a);color:#fff;font-size:12px;font-weight:700;padding:2px 6px;border-radius:20px;font-family:var(--mono,monospace);line-height:1.2}';
    document.head.appendChild(style);
  }

  function openFlashcards(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    sessionStorage.setItem('ct_dashboard_tab', 'flashcards');
    if (currentPage === 'dashboard.html' && typeof window.showDashTab === 'function') {
      window.showDashTab('flashcards');
    } else {
      window.location.href = 'dashboard.html#flashcards';
    }
  }

  function updateFlashcardsBadge() {
    const badge = document.getElementById('flashTabBadge');
    if (!badge) return;
    const due = getFlashcardsDueCount();
    badge.textContent = due > 0 ? due : '';
    badge.style.display = due > 0 ? 'inline-flex' : 'none';
  }

  function updateRevisoesBadge() {
    const b = document.getElementById('revBadge');
    if (!b) return;
    if (!window.CT || typeof CT.classificarRevisoes !== 'function') {
      b.style.display = 'none';
      return;
    }

    const cId = sessionStorage.getItem('ct_concurso_ativo');
    const rev = CT.classificarRevisoes();
    if (rev) {
      const urgentes = [...(rev.atrasadas || []), ...(rev.hoje || [])].filter(r => {
        if (typeof CT.getContextoRevisao !== 'function') return true;
        const ctx = CT.getContextoRevisao(r);
        return ctx && ctx.concursoId === cId;
      }).length;
      b.textContent = urgentes > 0 ? urgentes : '0';
      b.style.display = urgentes > 0 ? '' : 'none';
    } else {
      b.style.display = 'none';
    }
  }

  function updateAllBadges() {
    updateFlashcardsBadge();
    updateRevisoesBadge();
  }

  function ensureFlashcardsNavItem() {
    ensureFlashcardsNavStyles();

    document.querySelectorAll('.nav-item[onclick*="dashboard.html"]').forEach(item => {
      if (item.id === 'navFlashcardsDashboard') return;
      item.addEventListener('click', () => {
        sessionStorage.setItem('ct_dashboard_tab', 'overview');
      }, true);
    });

    document.querySelectorAll('nav.nav').forEach(nav => {
      let flashItem = nav.querySelector('#navFlashcardsDashboard');
      if (!flashItem) {
        const revItem = nav.querySelector('#revBadge')?.closest('.nav-item')
          || Array.from(nav.querySelectorAll('.nav-item')).find(item => item.textContent.includes('Revis'));
        if (!revItem) return;

        flashItem = document.createElement('div');
        flashItem.className = 'nav-item';
        flashItem.id = 'navFlashcardsDashboard';
        flashItem.style.cursor = 'pointer';
        flashItem.innerHTML = navIconHtml('flashcards') + ' Flashcards <span class="nav-badge" id="flashTabBadge" style="display:none">0</span>';
        revItem.insertAdjacentElement('afterend', flashItem);
      }

      flashItem.onclick = openFlashcards;
      flashItem.style.cursor = 'pointer';
    });

    updateFlashcardsBadge();
  }

  function ensureSidebarConcursoStyles() {
    if (document.getElementById('sidebar-concurso-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'sidebar-concurso-nav-style';
    style.textContent = `
      .sidebar-concurso.clickable{cursor:pointer;transition:background .2s,box-shadow .2s,transform .2s,border-color .2s}
      .sidebar-concurso.clickable:hover,.sidebar-concurso.clickable:focus-visible{background:var(--bg4);box-shadow:0 8px 24px rgba(0,0,0,.4);transform:translateY(-2px);border-color:var(--accent2);outline:0}
      .sidebar-concurso{width:190px!important;min-width:190px!important;max-width:190px!important;margin:0 10px 12px!important;padding:10px!important;border-radius:10px!important;background:var(--bg3)!important;border:1px solid var(--border)!important;box-sizing:border-box!important;overflow:visible!important;flex:0 0 auto!important;font-family:var(--sans)!important}
      .sidebar-concurso *{box-sizing:border-box!important}
      .sidebar-concurso .sidebar-concurso-head,.sidebar-concurso>div:first-child{display:grid!important;grid-template-columns:48px minmax(0,1fr)!important;align-items:start!important;gap:8px!important;margin:0 0 8px!important}
      .sidebar-concurso .sidebar-concurso-info,.sidebar-concurso>div:first-child>div:not(#sideLogoImg){min-width:0!important;width:100%!important;text-align:left!important;overflow:visible!important}
      .sidebar-concurso #sideLogoImg{width:48px!important;height:48px!important;min-width:48px!important;flex:0 0 48px!important;border-radius:10px!important;font-size:26px!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;background:var(--bg2)!important;border:1px solid var(--border)!important}
      .sidebar-concurso #sideLogoImg img{width:100%!important;height:100%!important;object-fit:cover!important;border-radius:10px!important;display:block!important}
      .sidebar-concurso .concurso-nome{display:block!important;width:100%!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;font-size:10.8px!important;line-height:1.16!important;font-weight:900!important;color:var(--text)!important;text-align:left!important;margin:0 0 3px!important}
      .sidebar-concurso .concurso-banca{display:block!important;width:100%!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;font-size:10.2px!important;line-height:1.18!important;color:var(--text3)!important;text-align:left!important;margin:0!important}
      .sidebar-concurso .concurso-cargo-salario{display:flex!important;flex-direction:column!important;gap:1px!important;width:100%!important;min-width:0!important;margin:0 0 10px!important;color:var(--text2)!important;text-align:left!important;font-size:10.5px!important;line-height:1.15!important;overflow:visible!important}
      .sidebar-concurso .concurso-cargo{display:block!important;width:100%!important;-webkit-line-clamp:unset!important;-webkit-box-orient:initial!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;font-weight:800!important;color:var(--text2)!important}
      .sidebar-concurso .concurso-salario{display:block!important;width:100%!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;font-weight:800!important;color:var(--text)!important}
      .sidebar-concurso .timer-box{width:100%!important;background:var(--bg2)!important;border:1px solid var(--border)!important;border-radius:8px!important;padding:10px!important;text-align:center!important;box-sizing:border-box!important;overflow:visible!important}
      .sidebar-concurso .timer-box.pre-edital-mode{padding:12px 10px 10px!important}
      .sidebar-concurso .pre-rocket-panel,.sidebar-concurso .timer-box>div[style*="flex-direction:column"]{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:7px!important}
      .sidebar-concurso .pre-rocket-kicker,.sidebar-concurso .timer-box>div[style*="flex-direction:column"]>div:first-child{font-size:12px!important;font-weight:900!important;color:var(--accent2)!important;text-transform:uppercase!important;letter-spacing:1.8px!important;line-height:1.1!important;white-space:nowrap!important}
      .sidebar-concurso .pre-rocket-row,.sidebar-concurso .timer-box>div[style*="flex-direction:column"]>div:last-child{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;min-width:0!important;font-size:16px!important;font-weight:800!important}
      .sidebar-concurso .pre-rocket-shell,.sidebar-concurso .pre-rocket-shell img,.sidebar-concurso .timer-box img[src*="pre-edital"]{width:36px!important;height:36px!important;object-fit:contain!important;flex:0 0 auto!important}
      @media (max-width:820px){.sidebar-concurso{width:calc(100% - 24px)!important;min-width:0!important;max-width:none!important;margin:0 12px 12px!important}}
      .sidebar>div[style*="text-align:center"] span[style*="accent2"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;flex-wrap:nowrap!important;white-space:nowrap!important;max-width:100%!important;font-size:11px!important;line-height:1.1!important}
      .sidebar>div[style*="text-align:center"] span[style*="accent2"] img[src*="logoMichelSoftwares"]{height:36px!important;width:auto!important;max-width:117px!important;object-fit:contain!important;flex:0 0 auto!important;vertical-align:middle!important}
    `;
    document.head.appendChild(style);
  }

  function normalizeSidebarConcursoLayout() {
    ensureSidebarConcursoStyles();
    document.querySelectorAll('.sidebar-concurso').forEach(card => {
      card.id = card.id || 'sideCard';
      const logo = card.querySelector('#sideLogoImg');
      const header = logo ? logo.parentElement : card.firstElementChild;
      if (header) header.classList.add('sidebar-concurso-head');
      if (logo && logo.nextElementSibling) logo.nextElementSibling.classList.add('sidebar-concurso-info');

      const box = card.querySelector('.timer-box');
      if (box) {
        const isPreEdital = /PR[ÉE]-EDITAL/i.test(box.textContent || '') || !!box.querySelector('.pre-rocket-panel');
        box.classList.toggle('pre-edital-mode', isPreEdital);
      }
    });
  }

  function escapeSidebarHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[ch]);
  }

  function sidebarLogoHtml(concurso) {
    if (!concurso) return '&#128203;';
    if (concurso.logoPath) {
      return `<img src="${escapeSidebarHtml(concurso.logoPath)}?t=${Date.now()}" alt="">`;
    }
    if (concurso.logoBase64) {
      return `<img src="${escapeSidebarHtml(concurso.logoBase64)}" alt="">`;
    }
    if (concurso.logoEmoji) return escapeSidebarHtml(concurso.logoEmoji);
    return '&#128203;';
  }

  function sidebarSnapshot(concurso) {
    if (!concurso) return 'empty';
    return [
      concurso.id || '',
      concurso.nome || '',
      concurso.banca || '',
      concurso.cargo || '',
      concurso.salario || '',
      concurso.preEdital ? 'pre' : 'pos',
      concurso.coberto || 0,
      concurso.dataProva || '',
      concurso.logoPath || '',
      concurso.logoBase64 || '',
      concurso.logoEmoji || '',
    ].join('|');
  }

  function sidebarIsCanonical(card, concurso, key) {
    if (!card || card.dataset.sidebarCanonicalKey !== key) return false;
    if (!card.querySelector('.sidebar-concurso-head')) return false;
    if (!card.querySelector('#sideLogoImg')) return false;
    if (!card.querySelector('#sideNome')) return false;
    if (!card.querySelector('#sideBanca')) return false;
    if (!card.querySelector('#sideCargoSalario')) return false;
    if (!card.querySelector('.timer-box[data-sidebar-timer-canonical="1"]')) return false;
    if (concurso && concurso.preEdital) return !!card.querySelector('.pre-rocket-panel');
    return !!card.querySelector('#sideTimer');
  }

  function sidebarTimerHtml(concurso) {
    if (!concurso) {
      return '<div class="timer-box" data-sidebar-timer-canonical="1"><div class="timer-num" id="sideTimer">&mdash;</div><div class="timer-label" id="sideTimerLabel">dias para a prova</div></div>';
    }

    if (concurso.preEdital) {
      const rocket = (window.CT && typeof CT.renderCoverageRocket === 'function')
        ? CT.renderCoverageRocket(concurso, 36, 'display:block;')
        : '&#128640;';
      const coberto = Number(concurso.coberto || 0);
      return '<div class="timer-box pre-edital-mode" data-sidebar-timer-canonical="1">'
        + '<div class="pre-rocket-panel">'
        + '<div class="pre-rocket-kicker">&#10022; PR&Eacute;-EDITAL</div>'
        + '<div class="pre-rocket-row"><span class="pre-rocket-shell">' + rocket + '</span>'
        + '<span class="pre-rocket-count"><span>coberto</span> <strong>&times;' + escapeSidebarHtml(coberto) + '</strong></span></div>'
        + '</div>'
        + '</div>';
    }

    const dias = (window.CT && typeof CT.diasRestantes === 'function') ? CT.diasRestantes(concurso) : null;
    const cor = dias == null ? 'var(--accent)' : dias <= 7 ? 'var(--red)' : dias <= 30 ? 'var(--orange)' : 'var(--accent)';
    const coberto = Number(concurso.coberto || 0);
    const cobHtml = coberto > 0
      ? '<div style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px;display:flex;flex-direction:column;align-items:center;gap:2px">'
        + '<div style="font-size:10px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.5px">&#10022; P&oacute;s-Edital</div>'
        + '<div style="font-size:11px;font-weight:700;color:var(--text3)">'
        + ((window.CT && typeof CT.renderCoverageRocket === 'function') ? CT.renderCoverageRocket(concurso, 18) : '&#128640;')
        + ' Coberto <span style="color:var(--accent2)">&times;' + escapeSidebarHtml(coberto) + '</span></div>'
        + '</div>'
      : '';
    return '<div class="timer-box" data-sidebar-timer-canonical="1">'
      + '<div class="timer-num" id="sideTimer" style="color:' + cor + '">' + (dias != null ? escapeSidebarHtml(dias) : '&mdash;') + '</div>'
      + '<div class="timer-label" id="sideTimerLabel">dias para a prova</div>'
      + cobHtml
      + '</div>';
  }

  function sidebarCargoSalarioHtml(concurso) {
    const rawCargo = String((concurso && concurso.cargo) || '').trim();
    const cargo = /^[-\u2013\u2014]+$/.test(rawCargo) ? '' : rawCargo;
    const salario = formatSidebarSalary(concurso && concurso.salario);
    if (!cargo && !salario) return '<div class="concurso-cargo-salario" id="sideCargoSalario" style="display:none"></div>';

    return '<div class="concurso-cargo-salario" id="sideCargoSalario">'
      + (cargo ? '<span class="concurso-cargo">' + escapeSidebarHtml(cargo) + '</span>' : '')
      + (salario ? '<span class="concurso-salario">' + escapeSidebarHtml(salario) + '</span>' : '')
      + '</div>';
  }

  function formatSidebarSalary(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const match = raw.match(/(?:R\$\s*)?\d[\d.\s]*(?:,\d{1,2})?/i);
    if (!match) return raw;

    const amount = match[0].replace(/R\$/i, '').trim().replace(/\s+/g, '');
    const numeric = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return raw;

    const formatted = numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const suffix = raw.slice(match.index + match[0].length).trim();
    return `R$ ${formatted}${suffix ? ' ' + suffix : ''}`;
  }

  function renderSidebarConcursoCards(concurso) {
    ensureSidebarConcursoStyles();
    const cId = sessionStorage.getItem('ct_concurso_ativo');
    const c = concurso || (window.CT && cId ? CT.getConcurso(cId) : null);
    const key = sidebarSnapshot(c);
    const cards = Array.from(document.querySelectorAll('.sidebar-concurso'));
    if (!cards.length) return;

    sidebarConcursoRendering = true;
    try {
      cards.forEach(card => {
        card.id = card.id || 'sideCard';
        const nome = c && c.nome ? escapeSidebarHtml(c.nome) : '&mdash;';
        const banca = c && c.banca ? escapeSidebarHtml(c.banca) : '&mdash;';
        card.dataset.sidebarCanonical = '1';
        card.dataset.sidebarCanonicalKey = key;
        card.innerHTML = ''
          + '<div class="sidebar-concurso-head">'
          + '<div id="sideLogoImg">' + sidebarLogoHtml(c) + '</div>'
          + '<div class="sidebar-concurso-info">'
          + '<div class="concurso-nome" id="sideNome" title="' + nome + '">' + nome + '</div>'
          + '<div class="concurso-banca" id="sideBanca" title="' + banca + '">' + banca + '</div>'
          + '</div>'
          + '</div>'
          + sidebarCargoSalarioHtml(c)
          + sidebarTimerHtml(c);
      });
      normalizeSidebarConcursoLayout();
    } finally {
      window.setTimeout(() => {
        sidebarConcursoRendering = false;
      }, 0);
    }
  }

  function watchSidebarConcursoLayout() {
    if (sidebarConcursoObserver || typeof MutationObserver === 'undefined') return;

    const scheduleRender = () => {
      if (sidebarConcursoFrame) return;
      sidebarConcursoFrame = window.requestAnimationFrame(() => {
        sidebarConcursoFrame = 0;
        refreshSidebarConcursoInfo();
      });
    };

    sidebarConcursoObserver = new MutationObserver(mutations => {
      const touchesSidebarConcurso = mutations.some(mutation => {
        const target = mutation.target;
        if (target && target.closest && target.closest('.sidebar-concurso')) return true;
        if (target && target.parentElement && target.parentElement.closest('.sidebar-concurso')) return true;
        return Array.from(mutation.addedNodes || []).some(node => {
          if (!node || node.nodeType !== 1) return false;
          return node.matches?.('.sidebar-concurso') || node.querySelector?.('.sidebar-concurso');
        });
      });
      if (sidebarConcursoRendering) {
        return;
      }
      if (touchesSidebarConcurso) {
        scheduleRender();
      }
    });
    sidebarConcursoObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  }

  function openCronogramaInteligente(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    window.location.href = 'cronograma_inteligente.html';
  }

  function findDashboardNavItem(nav) {
    if (!nav) return null;
    return nav.querySelector('#navDashboardOverview')
      || nav.querySelector('.nav-item[onclick*="dashboard.html"]')
      || Array.from(nav.querySelectorAll('.nav-item')).find(item => /\bDashboard\b/.test(item.textContent || ''));
  }

  function ensureCronogramaNavItem() {
    document.querySelectorAll('nav.nav').forEach(nav => {
      let item = nav.querySelector('#navCronogramaInteligente');
      if (!item) {
        const dashboardItem = findDashboardNavItem(nav);
        if (!dashboardItem) return;
        item = document.createElement('div');
        item.className = 'nav-item';
        item.id = 'navCronogramaInteligente';
        item.style.cursor = 'pointer';
        item.innerHTML = navIconHtml('cronograma') + ' Cronograma Inteligente';
        dashboardItem.insertAdjacentElement('afterend', item);
      }

      item.onclick = openCronogramaInteligente;
      item.style.cursor = 'pointer';
      if (currentPage === 'cronograma_inteligente.html') {
        item.classList.add('active');
        const dashboardItem = findDashboardNavItem(nav);
        if (dashboardItem && dashboardItem !== item) dashboardItem.classList.remove('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  function normalizeMoney(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const match = raw.match(/(?:R\$\s*)?\d[\d.\s]*(?:,\d{1,2})?/i);
    if (!match) return raw;

    let amount = match[0].replace(/R\$/i, '').trim().replace(/\s+/g, '');
    const numeric = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return match[0].trim();

    const formatted = numeric.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const afterFirstValue = raw.slice(match.index + match[0].length);
    const hasAdditional = /\+|adicion|benef|aux[ií]lio|vale|gratifica/i.test(afterFirstValue);
    return `R$ ${formatted}${hasAdditional ? ' +...' : ''}`;
  }

  function buildCargoSalario(concurso) {
    if (!concurso) return '';
    const rawCargo = String(concurso.cargo || '').trim();
    const cargo = /^[-–—]+$/.test(rawCargo) ? '' : rawCargo;
    const salario = normalizeMoney(concurso.salario);
    if (cargo && salario) return `${cargo}\n${salario}`;
    return cargo || salario || '';
  }

  function renderSidebarConcursoMeta(concurso) {
    const bancaEl = document.getElementById('sideBanca');
    if (!bancaEl) return;

    const rawCargo = String((concurso && concurso.cargo) || '').trim();
    const detail = {
      cargo: /^[-\u2013\u2014]+$/.test(rawCargo) ? '' : rawCargo,
      salario: normalizeMoney(concurso && concurso.salario)
    };
    const hasDetail = !!(detail.cargo || detail.salario);
    let detailEl = document.getElementById('sideCargoSalario');
    if (!detailEl) {
      detailEl = document.createElement('div');
      detailEl.id = 'sideCargoSalario';
      detailEl.className = 'concurso-cargo-salario';
      bancaEl.insertAdjacentElement('afterend', detailEl);
    }

    detailEl.replaceChildren();
    if (detail.cargo) {
      const cargoEl = document.createElement('span');
      cargoEl.className = 'concurso-cargo';
      cargoEl.textContent = detail.cargo;
      detailEl.appendChild(cargoEl);
    }
    if (detail.salario) {
      const salarioEl = document.createElement('span');
      salarioEl.className = 'concurso-salario';
      salarioEl.textContent = detail.salario;
      detailEl.appendChild(salarioEl);
    }
    detailEl.style.display = hasDetail ? '' : 'none';
  }

  function refreshSidebarConcursoInfo(concurso) {
    const cId = sessionStorage.getItem('ct_concurso_ativo');
    const c = concurso || (window.CT && cId ? CT.getConcurso(cId) : null);
    renderSidebarConcursoCards(c);
    normalizeSidebarConcursoLayout();
    if (typeof updateAllBadges === 'function') updateAllBadges();
  }

  function stabilizeSidebarConcursoInfo() {
    [0, 80, 250].forEach(delay => {
      window.setTimeout(() => {
        refreshSidebarConcursoInfo();
      }, delay);
    });
  }

  function openConcursoOptions(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }

    if (currentPage === 'dashboard.html' && typeof window.abrirModalMerge === 'function') {
      window.abrirModalMerge();
      return;
    }

    sessionStorage.setItem('ct_open_concurso_options', '1');
    if (currentPage !== 'dashboard.html') {
      window.location.href = 'dashboard.html';
    }
  }

  function ensureSidebarConcursoClickable() {
    ensureSidebarConcursoStyles();
    normalizeSidebarConcursoLayout();
    watchSidebarConcursoLayout();

    document.querySelectorAll('.sidebar-concurso').forEach(card => {
      if (card.dataset.sidebarClickReady === '1') return;
      card.dataset.sidebarClickReady = '1';
      card.classList.add('clickable');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'Clique para ver ou editar informações sobre o concurso';
      card.addEventListener('click', openConcursoOptions);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') openConcursoOptions(event);
      });
    });
  }

  function openPendingConcursoOptions() {
    if (currentPage !== 'dashboard.html') return;
    if (sessionStorage.getItem('ct_open_concurso_options') !== '1') return;

    const tryOpen = attempt => {
      if (typeof window.abrirModalMerge === 'function') {
        sessionStorage.removeItem('ct_open_concurso_options');
        window.abrirModalMerge();
        return;
      }
      if (attempt < 20) setTimeout(() => tryOpen(attempt + 1), 100);
    };

    tryOpen(0);
  }

  function removeElementById(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.remove();
    return true;
  }

  function hideVisibleById(id) {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains('visible')) return false;
    el.classList.remove('visible');
    return true;
  }

  function closeTopAppSurface() {
    if (document.getElementById('tcUpdateOverlay')) {
      closeUpdateModal();
      return true;
    }

    if (document.getElementById('dayDetailOverlay')) {
      if (typeof window.closeDayDetail === 'function') window.closeDayDetail();
      else removeElementById('dayDetailOverlay');
      return true;
    }

    const dayModal = document.getElementById('dayModal');
    if (dayModal && dayModal.classList.contains('visible')) {
      if (typeof window.closeCalendarDay === 'function') window.closeCalendarDay();
      else {
        dayModal.classList.remove('visible');
        dayModal.setAttribute('aria-hidden', 'true');
      }
      return true;
    }

    if (removeElementById('flashModalOverlay')) return true;
    if (removeElementById('tcUpdateOverlay')) return true;
    if (removeElementById('modalAddMatDash')) return true;
    if (removeElementById('modalSmartLink')) return true;
    if (removeElementById('modalOpcoes')) return true;
    if (removeElementById('modalEditarMaterial')) return true;
    if (removeElementById('modalMateriaisItem')) return true;
    if (removeElementById('modalSessaoQuestoes')) return true;
    if (removeElementById('modalGerenciarTop')) return true;
    if (removeElementById('modalCrono')) return true;
    if (removeElementById('modalSimulado')) return true;
    if (removeElementById('modalCaderno')) return true;
    if (removeElementById('timer-popup-overlay')) return true;

    if (hideVisibleById('modalPreEditalReset')) return true;
    if (hideVisibleById('modalMerge')) return true;
    if (hideVisibleById('modalDetalhes')) return true;
    if (hideVisibleById('modalPerfil')) return true;
    if (hideVisibleById('modalImportPremium')) return true;
    if (hideVisibleById('modalPremiumSuccess')) return true;
    if (hideVisibleById('modal-ajuste')) return true;
    if (hideVisibleById('popup-overlay')) return true;
    if (hideVisibleById('popupOverlay')) return true;

    const visibleOverlay = document.querySelector('.modal-overlay.visible, .popup-overlay.visible');
    if (visibleOverlay) {
      visibleOverlay.classList.remove('visible');
      return true;
    }

    const ctxMenu = document.getElementById('ctxMenu');
    if (ctxMenu && ctxMenu.style.display !== 'none' && typeof window.closeCtxMenu === 'function') {
      window.closeCtxMenu();
      return true;
    }

    const flashSection = document.getElementById('dashboardFlashcards');
    const flashVisible = flashSection && flashSection.style.display !== 'none';
    if (flashVisible && window.FlashcardsDashboard) {
      if (document.querySelector('.flash-study')) {
        window.FlashcardsDashboard.cancelStudy();
        return true;
      }
      if (document.querySelector('.flash-detail')) {
        window.FlashcardsDashboard.backToDecks();
        return true;
      }
      if (typeof window.showDashTab === 'function') {
        window.showDashTab('overview');
        return true;
      }
    }

    const openSub = Array.from(document.querySelectorAll('.subtopico-row .sub-body'))
      .find(body => body.style.display !== 'none');
    if (openSub) {
      openSub.style.display = 'none';
      const arrow = openSub.closest('.subtopico-row')?.querySelector('.sub-expand');
      if (arrow) arrow.style.transform = '';
      return true;
    }

    const openTopic = document.querySelector('.topico-card.open');
    if (openTopic) {
      openTopic.classList.remove('open');
      return true;
    }

    return false;
  }

  function installSoftBackNavigation() {
    if (!window.history || window.__ctSoftBackInstalled) return;
    window.__ctSoftBackInstalled = true;

    try {
      const baseState = Object.assign({}, history.state || {}, { ctSoftBack: 'base' });
      history.replaceState(baseState, document.title, window.location.href);
      history.pushState({ ctSoftBack: 'guard' }, document.title, window.location.href);
    } catch (error) {
      return;
    }

    window.addEventListener('popstate', function () {
      if (closeTopAppSurface()) {
        setTimeout(function () {
          try {
            history.pushState({ ctSoftBack: 'guard' }, document.title, window.location.href);
          } catch {}
        }, 0);
      } else {
        setTimeout(function () {
          try { history.back(); } catch {}
        }, 0);
      }
    });
  }

  ensureSidebarScrollStyles();
  injectVersionCheck();
  checkLatestRelease();
  window.addEventListener('pywebviewready', checkLatestReleaseWithApi);
  ensureCronogramaNavItem();
  ensureFlashcardsNavItem();
  applyProfessionalNavIcons();
  ensureSidebarConcursoClickable();
  refreshSidebarConcursoInfo();
  stabilizeSidebarConcursoInfo();
  window.CT_renderSidebarConcursoInfo = concurso => {
    refreshSidebarConcursoInfo(concurso);
    normalizeSidebarConcursoLayout();
    updateAllBadges();
  };
  installSoftBackNavigation();
  // <CT_DEV_TOOLS_NAV>
  if (window.CT && typeof CT.applyDevToolsVisibility === 'function') CT.applyDevToolsVisibility();
  // </CT_DEV_TOOLS_NAV>
  window.addEventListener('load', openPendingConcursoOptions);
  window.addEventListener('load', () => {
    applyProfessionalNavIcons();
    refreshSidebarConcursoInfo();
    stabilizeSidebarConcursoInfo();
    normalizeSidebarConcursoLayout();
    updateAllBadges();
  });
  document.addEventListener('DOMContentLoaded', updateAllBadges);
  window.addEventListener('ct-data-updated', () => {
    refreshSidebarConcursoInfo();
    normalizeSidebarConcursoLayout();
    updateAllBadges();
  });

  // Adiciona navegação em todos os .nav-item que tiverem data-nav
  document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
    const key = item.getAttribute('data-nav');
    const dest = ROUTES[key];

    // Marca o item ativo
    if (dest === currentPage) {
      item.classList.add('active');
    }

    // Navega ao clicar
    item.addEventListener('click', () => {
      if (dest && dest !== currentPage) {
        window.location.href = dest;
      }
    });
    item.style.cursor = 'pointer';
  });

  // Botões de "voltar ao dashboard"
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dest = btn.getAttribute('data-goto');
      if (dest) window.location.href = dest;
    });
  });

  // Global ESC Shortcut to close modals
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (closeTopAppSurface()) return;
      // 1. Functions (usually in aba_materia.html or global)
      closeUpdateModal();
      if (typeof closePopup === 'function') closePopup();
      if (typeof fecharModalCaderno === 'function') fecharModalCaderno();
      if (typeof fecharModalMerge === 'function') fecharModalMerge();
      if (typeof fecharModalAjuste === 'function') fecharModalAjuste();
      if (typeof closeCtxMenu === 'function') closeCtxMenu();
      if (typeof fecharModalCrono === 'function') fecharModalCrono(); // if exists
      if (typeof fecharModalDetalhes === 'function') fecharModalDetalhes();

      // 2. DOM elements that can be removed
      const idsToRemove = [
        'modalSmartLink', 'modalGerenciarTop', 'modalCrono', 
        'modalSimulado', 'modalCaderno', 'modalMateriaisItem', 'modalEditarMaterial', 'timer-popup-overlay'
      ];
      idsToRemove.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      // 3. Modals that use a visibility class (like dashboard.html)
      const modalMerge = document.getElementById('modalMerge');
      if (modalMerge) modalMerge.classList.remove('visible');

      const modalDetalhes = document.getElementById('modalDetalhes');
      if (modalDetalhes) modalDetalhes.classList.remove('visible');
      
      const modalCrono = document.getElementById('modalCrono');
      if (modalCrono) modalCrono.remove();
    }
  });

  // Global mouse back button shortcut to close modals/popups
  window.addEventListener('mouseup', e => {
    if (e.button === 3) {
      if (closeTopAppSurface()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);

})();