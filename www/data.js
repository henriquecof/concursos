/**
 * Track Concursos — data.js
 * ========================
 * Gerenciador central de dados.
 * As tabelas principais usam armazenamento virtual em memoria e backup em arquivo
 * para evitar o limite pequeno do LocalStorage do WebView.
 *
 * Estrutura de dados:
 *   ct_concursos       → Array de concursos
 *   ct_concursos       → Array de concursos
 *   ct_materias        → Array de matérias (vinculadas a concurso)
 *   ct_topicos         → Array de tópicos
 *   ct_subtopicos      → Array de subtópicos
 *   ct_sessoes         → Array de sessões de estudo
 *   ct_questoes        → Array de lançamentos de questões
 *   ct_simulados       → Array de simulados
 *   ct_revisoes        → Array de revisões agendadas
 */

const CT = {
  // <CT_DEV_TOOLS_DATA_JS>
  DEV_TOOLS_BUTTON_ENABLED: false,
  DEV_TOOLS_DEFAULT_ENABLED: false,
  DEV_TOOLS_STORAGE_KEY: 'ct_dev_tools_enabled',

  isDevToolsButtonEnabled() {
    return this.DEV_TOOLS_BUTTON_ENABLED === true;
  },

  isDevToolsEnabled() {
    if (!this.isDevToolsButtonEnabled()) return false;
    const stored = localStorage.getItem(this.DEV_TOOLS_STORAGE_KEY);
    if (stored == null) return this.DEV_TOOLS_DEFAULT_ENABLED === true;
    return stored === '1';
  },

  setDevToolsEnabled(enabled) {
    if (!this.isDevToolsButtonEnabled()) enabled = false;
    localStorage.setItem(this.DEV_TOOLS_STORAGE_KEY, enabled ? '1' : '0');
    this.applyDevToolsVisibility();
  },

  applyDevToolsVisibility() {
    const enabled = this.isDevToolsEnabled();
    const buttonEnabled = this.isDevToolsButtonEnabled();
    document.querySelectorAll('[data-dev-tool]').forEach(el => {
      el.style.display = enabled ? (el.dataset.devDisplay || '') : 'none';
    });
    document.querySelectorAll('[data-dev-tools-toggle]').forEach(btn => {
      btn.style.display = buttonEnabled ? (btn.dataset.devDisplay || 'inline-flex') : 'none';
      btn.textContent = enabled ? 'DEV Tools: ON' : 'DEV Tools: OFF';
      btn.classList.toggle('active', enabled);
      btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
  },

  toggleDevTools() {
    this.setDevToolsEnabled(!this.isDevToolsEnabled());
  },
  // </CT_DEV_TOOLS_DATA_JS>
_get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },

  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  _emitDataUpdated(tipo, detail = {}) {
    try {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      window.dispatchEvent(new CustomEvent('ct-data-updated', {
        detail: {
          tipo,
          ts: Date.now(),
          ...detail
        }
      }));
    } catch {}
  },

  _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  _dateString(d) {
    if (!d) d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  _normalizeDateString(value, fallback) {
    const fallbackDate = fallback || this._today();
    if (typeof value !== 'string') return fallbackDate;
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return fallbackDate;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return fallbackDate;
    return this._dateString(date);
  },

  _today() {
    return this._dateString();
  },

  getDiasComAtividadeEstudo(concursoId) {
    const dates = {};
    const addDate = item => {
      if (!item || !item.data) return;
      const raw = String(item.data).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) dates[this._normalizeDateString(raw)] = true;
    };
    this.getSessoes({ concursoId }).forEach(addDate);
    this.getQuestoes({ concursoId }).forEach(addDate);
    this.getSimulados(concursoId).forEach(addDate);
    return dates;
  },

  getDiasSeguidosEstudo(concursoId) {
    const dates = this.getDiasComAtividadeEstudo(concursoId);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const cursor = new Date(today);
    if (!dates[this._dateString(cursor)]) cursor.setDate(cursor.getDate() - 1);

    let count = 0;
    while (cursor.getFullYear() >= 2020) {
      const key = this._dateString(cursor);
      if (!dates[key]) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  },

  getTotalCoberturasEdital(concursoOuId) {
    const c = typeof concursoOuId === 'string'
      ? this.getConcurso(concursoOuId)
      : concursoOuId;
    if (!c) return 0;
    const atual = this._positiveInt(c.coberto);
    const pre = this._positiveInt(c.cobertoPre);
    return atual + pre;
  },

  aplicarBonusFaixaEdital(faixaIdx, concursoOuId, totalFaixas) {
    const maxIdx = Math.max(0, (parseInt(totalFaixas, 10) || 1) - 1);
    const idx = Math.max(0, parseInt(faixaIdx, 10) || 0);
    return this.getTotalCoberturasEdital(concursoOuId) >= 1
      ? Math.min(idx + 1, maxIdx)
      : Math.min(idx, maxIdx);
  },

  _faixaHistoricoKey(concursoId) {
    return concursoId ? `ct_faixa_hist_${concursoId}` : '';
  },

  getFaixaHistorico(concursoId) {
    const key = this._faixaHistoricoKey(concursoId);
    if (!key) return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  setFaixaHistorico(concursoId, historico) {
    const key = this._faixaHistoricoKey(concursoId);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.isArray(historico) ? historico : []));
  },

  getInicioEstudosConcurso(concursoId) {
    const dates = [];
    const addDate = value => {
      if (!value) return;
      const raw = String(value).trim();
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return;
      dates.push(`${match[1]}-${match[2]}-${match[3]}`);
    };
    const c = this.getConcurso(concursoId);
    addDate(c && c.criadoEm);
    this.getSessoes({ concursoId }).forEach(s => addDate(s.data || s.horaInicio || s.createdAt || s.criadoEm));
    this.getQuestoes({ concursoId }).forEach(q => addDate(q.data || q.createdAt || q.criadoEm));
    this.getSimulados(concursoId).forEach(s => addDate(s.data || s.createdAt || s.criadoEm));
    this.getTopicos().filter(t => t.concursoId === concursoId).forEach(t => {
      addDate(t.estudoIniciadoEm || t.estudadoEm || t.criadoEm);
    });
    this.getSubtopicos().filter(s => s.concursoId === concursoId).forEach(s => {
      addDate(s.estudoIniciadoEm || s.estudadoEm || s.criadoEm);
    });
    return dates.length ? dates.sort()[0] : this._today();
  },

  registrarFaixaHistorico(concursoId, registro = {}) {
    if (!concursoId || !registro.faixaNome) return null;
    const list = this.getFaixaHistorico(concursoId);
    const faixaIdx = parseInt(registro.faixaIdx, 10);
    const normalizedIdx = Number.isFinite(faixaIdx) ? faixaIdx : 0;
    const jaRegistrada = list.find(item =>
      item && item.faixaIdx === normalizedIdx && item.faixaNome === registro.faixaNome
    );
    if (jaRegistrada) return jaRegistrada;

    const metricas = registro.metricas || {};
    const clean = {
      id: registro.id || `faixa_${this._id()}`,
      concursoId,
      faixaIdx: normalizedIdx,
      faixaNome: String(registro.faixaNome || ''),
      data: this._normalizeDateString(registro.data || this._today()),
      createdAt: registro.createdAt || new Date().toISOString(),
      motivo: String(registro.motivo || ''),
      metricas: {
        inicioEstudos: metricas.inicioEstudos || this.getInicioEstudosConcurso(concursoId),
        diasSeguidos: this._positiveInt(metricas.diasSeguidos),
        questoesFeitas: this._positiveInt(metricas.questoesFeitas),
        simulados80: this._positiveInt(metricas.simulados80),
        coberturasEdital: this._positiveInt(metricas.coberturasEdital),
        horasEstudadas: metricas.horasEstudadas || ''
      }
    };
    list.push(clean);
    list.sort((a, b) => (a.faixaIdx || 0) - (b.faixaIdx || 0) || String(a.data || '').localeCompare(String(b.data || '')));
    this.setFaixaHistorico(concursoId, list);
    return clean;
  },

  _formatMateriaNome(nome) {
    return String(nome || '').trim().toLocaleUpperCase('pt-BR');
  },

  setBackupNome(nome) {
    if (nome) localStorage.setItem('ct_backup_nome', nome);
    else localStorage.removeItem('ct_backup_nome');
  },

  getBackupNome() {
    return localStorage.getItem('ct_backup_nome') || '';
  },

  setProfileGenero(genero) {
    if (genero) localStorage.setItem('ct_profile_genero', genero);
    else localStorage.removeItem('ct_profile_genero');
  },

  getProfileGenero() {
    return localStorage.getItem('ct_profile_genero') || 'masculino';
  },

  _backupMainKeys() {
    return [
      'ct_concursos', 'ct_materias', 'ct_topicos', 'ct_subtopicos',
      'ct_sessoes', 'ct_questoes', 'ct_simulados', 'ct_revisoes',
      'ct_flashcard_decks', 'ct_flashcards', 'ct_flashcard_log',
      'ct_backup_nome', 'ct_profile_genero'
    ];
  },

  _collectAuxStorage() {
    const aux = {};
    const mainKeys = this._backupMainKeys();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ct_') && !mainKeys.includes(key)) {
        aux[key] = localStorage.getItem(key);
      }
    }
    return aux;
  },

  _clearTrackStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ct_')) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
    if (typeof window !== 'undefined' && typeof window._ctClearVirtualStorage === 'function') {
      window._ctClearVirtualStorage();
    }
  },

  async _buildBackupPayload() {
    return {
      versao: '1.0',
      exportadoEm: new Date().toISOString(),
      concursos: this._get('ct_concursos'),
      materias: this._get('ct_materias'),
      topicos: this._get('ct_topicos'),
      subtopicos: this._get('ct_subtopicos'),
      sessoes: this._get('ct_sessoes'),
      questoes: this._get('ct_questoes'),
      simulados: this._get('ct_simulados'),
      revisoes: this._get('ct_revisoes'),
      flashcard_decks: this._get('ct_flashcard_decks') || [],
      flashcards: this._get('ct_flashcards') || [],
      flashcard_log: this._get('ct_flashcard_log') || [],
      crono: this._collectAuxStorage(),
      logos: await this._collectBackupLogos(),
    };
  },

  // Exibe uma notificação (toast) no topo da tela
  toast(msg, icon = '💡') {
    let toast = document.getElementById('ct-main-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ct-main-toast';
      toast.style.cssText = 'position:fixed;top:24px;right:24px;background:var(--bg3, #1a1e2a);border:1px solid var(--accent, #4f8ef7);border-left:4px solid var(--accent, #4f8ef7);color:var(--text, #e8eaf2);padding:12px 20px;border-radius:8px;font-family:var(--sans, "Inter", sans-serif);font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,0.5);z-index:20000;display:flex;align-items:center;gap:10px;transform:translateX(150%);transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="font-size:18px">${icon}</span> ${msg}`;

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });

    if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => {
      toast.style.transform = 'translateX(150%)';
    }, 2500);
  },

  _alertQueue: Promise.resolve(),
  _nativeAlert: typeof window !== 'undefined' && typeof window.alert === 'function' ? window.alert.bind(window) : null,
  _nativeConfirm: typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm.bind(window) : null,

  _ensureAlertDialogStyle() {
    if (document.getElementById('ct-alert-style')) return;
    const style = document.createElement('style');
    style.id = 'ct-alert-style';
    style.textContent = `
      @keyframes ctAlertFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ctAlertCardIn {
        from { opacity: 0; transform: translateY(14px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      #ct-alert-overlay {
        position: fixed;
        inset: 0;
        z-index: 120000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(79, 142, 247, 0.16), transparent 32%),
          rgba(9, 12, 20, 0.52);
        backdrop-filter: blur(14px);
        animation: ctAlertFadeIn 0.18s ease;
      }
      #ct-alert-overlay .ct-alert-card {
        width: min(520px, calc(100vw - 32px));
        overflow: hidden;
        border-radius: 22px;
        border: 1px solid var(--border2, rgba(255,255,255,0.14));
        background:
          linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
          var(--bg2, #171c28);
        box-shadow:
          0 28px 80px rgba(0, 0, 0, 0.34),
          0 8px 24px rgba(0, 0, 0, 0.18);
        color: var(--text, #e8eaf2);
        animation: ctAlertCardIn 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.15);
      }
      #ct-alert-overlay .ct-alert-top {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 22px 24px 18px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      }
      #ct-alert-overlay .ct-alert-icon {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: linear-gradient(135deg, rgba(79, 142, 247, 0.22), rgba(124, 93, 247, 0.2));
        border: 1px solid rgba(79, 142, 247, 0.22);
        font-size: 20px;
      }
      #ct-alert-overlay .ct-alert-head {
        min-width: 0;
        flex: 1;
      }
      #ct-alert-overlay .ct-alert-title {
        margin: 0;
        font-size: 17px;
        font-weight: 800;
        color: var(--text, #e8eaf2);
        letter-spacing: -0.01em;
      }
      #ct-alert-overlay .ct-alert-subtitle {
        margin: 6px 0 0;
        font-size: 12px;
        color: var(--text3, #8f96ad);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 700;
      }
      #ct-alert-overlay .ct-alert-close {
        appearance: none;
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        background: var(--bg3, #202635);
        color: var(--text2, #b4bbcf);
        width: 36px;
        height: 36px;
        border-radius: 11px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition: transform 0.16s ease, border-color 0.16s ease, color 0.16s ease, background 0.16s ease;
      }
      #ct-alert-overlay .ct-alert-close:hover {
        transform: translateY(-1px);
        border-color: var(--accent, #4f8ef7);
        color: var(--accent, #4f8ef7);
      }
      #ct-alert-overlay .ct-alert-body {
        padding: 18px 24px 24px;
      }
      #ct-alert-overlay .ct-alert-message {
        margin: 0;
        color: var(--text2, #b4bbcf);
        font-size: 14px;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      #ct-alert-overlay .ct-alert-footer {
        margin-top: 22px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      #ct-alert-overlay .ct-alert-ok,
      #ct-alert-overlay .ct-alert-cancel {
        appearance: none;
        min-width: 112px;
        padding: 11px 18px;
        border-radius: 12px;
        cursor: pointer;
        font-family: var(--sans, "Inter", sans-serif);
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.01em;
        transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease, border-color 0.16s ease, color 0.16s ease, background 0.16s ease;
      }
      #ct-alert-overlay .ct-alert-ok {
        border: 1px solid transparent;
        background: linear-gradient(135deg, var(--accent, #4f8ef7), var(--accent2, #7c5df7));
        color: #fff;
        box-shadow: 0 12px 24px rgba(79, 142, 247, 0.28);
      }
      #ct-alert-overlay .ct-alert-ok.danger {
        background: linear-gradient(135deg, var(--red, #f55a5a), #d94848);
        box-shadow: 0 12px 24px rgba(245, 90, 90, 0.24);
      }
      #ct-alert-overlay .ct-alert-cancel {
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        background: transparent;
        color: var(--text3, #8f96ad);
      }
      #ct-alert-overlay .ct-alert-ok:hover {
        transform: translateY(-1px);
        box-shadow: 0 16px 28px rgba(79, 142, 247, 0.34);
      }
      #ct-alert-overlay .ct-alert-ok.danger:hover {
        box-shadow: 0 16px 28px rgba(245, 90, 90, 0.30);
      }
      #ct-alert-overlay .ct-alert-cancel:hover {
        transform: translateY(-1px);
        border-color: var(--accent, #4f8ef7);
        color: var(--accent, #4f8ef7);
        background: rgba(79, 142, 247, 0.08);
      }
      #ct-alert-overlay .ct-alert-ok:active,
      #ct-alert-overlay .ct-alert-cancel:active,
      #ct-alert-overlay .ct-alert-close:active {
        transform: translateY(0);
      }
      html[data-theme="light"] #ct-alert-overlay {
        background:
          radial-gradient(circle at top, rgba(79, 142, 247, 0.14), transparent 34%),
          rgba(16, 23, 38, 0.24);
      }
      html[data-theme="light"] #ct-alert-overlay .ct-alert-card {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.82)),
          var(--bg2, #ffffff);
        box-shadow:
          0 24px 60px rgba(15, 23, 42, 0.16),
          0 8px 20px rgba(15, 23, 42, 0.08);
      }
    `;
    document.head.appendChild(style);
  },

  showAlert(message, options = {}) {
    const text = String(message == null ? '' : message);
    const title = String(options.title || 'Aviso');
    const subtitle = String(options.subtitle || 'Track Concursos');
    const icon = options.icon || '✦';

    if (typeof document === 'undefined' || !document.body) {
      if (this._nativeAlert) this._nativeAlert(text);
      return Promise.resolve();
    }

    this._ensureAlertDialogStyle();

    this._alertQueue = this._alertQueue.finally(() => new Promise(resolve => {
      const current = document.getElementById('ct-alert-overlay');
      if (current) current.remove();

      const overlay = document.createElement('div');
      overlay.id = 'ct-alert-overlay';
      overlay.innerHTML = `
        <div class="ct-alert-card" role="alertdialog" aria-modal="true" aria-labelledby="ct-alert-title" aria-describedby="ct-alert-message">
          <div class="ct-alert-top">
            <div class="ct-alert-icon">${icon}</div>
            <div class="ct-alert-head">
              <h2 class="ct-alert-title" id="ct-alert-title">${title}</h2>
              <div class="ct-alert-subtitle">${subtitle}</div>
            </div>
            <button class="ct-alert-close" type="button" aria-label="Fechar aviso">×</button>
          </div>
          <div class="ct-alert-body">
            <p class="ct-alert-message" id="ct-alert-message"></p>
            <div class="ct-alert-footer">
              <button class="ct-alert-ok" type="button">OK</button>
            </div>
          </div>
        </div>
      `;

      const close = () => {
        document.removeEventListener('keydown', onKeyDown, true);
        overlay.remove();
        resolve();
      };

      const onKeyDown = event => {
        if (event.key === 'Escape' || event.key === 'Enter') {
          event.preventDefault();
          close();
        }
      };

      overlay.querySelector('.ct-alert-message').textContent = text;
      overlay.querySelector('.ct-alert-ok').addEventListener('click', close);
      overlay.querySelector('.ct-alert-close').addEventListener('click', close);

      document.addEventListener('keydown', onKeyDown, true);
      document.body.appendChild(overlay);
      overlay.querySelector('.ct-alert-ok').focus();
    }));

    return this._alertQueue;
  },

  showConfirm(message, options = {}) {
    const text = String(message == null ? '' : message);
    const title = String(options.title || 'Confirmar ação');
    const subtitle = String(options.subtitle || 'Track Concursos');
    const icon = options.icon || '!';
    const confirmLabel = String(options.confirmLabel || 'Confirmar');
    const cancelLabel = String(options.cancelLabel || 'Cancelar');
    const danger = options.danger !== false;

    if (typeof document === 'undefined' || !document.body) {
      return Promise.resolve(this._nativeConfirm ? this._nativeConfirm(text) : false);
    }

    this._ensureAlertDialogStyle();

    return new Promise(resolve => {
      const current = document.getElementById('ct-alert-overlay');
      if (current) current.remove();

      const overlay = document.createElement('div');
      overlay.id = 'ct-alert-overlay';
      overlay.innerHTML = `
        <div class="ct-alert-card" role="alertdialog" aria-modal="true" aria-labelledby="ct-alert-title" aria-describedby="ct-alert-message">
          <div class="ct-alert-top">
            <div class="ct-alert-icon">${icon}</div>
            <div class="ct-alert-head">
              <h2 class="ct-alert-title" id="ct-alert-title">${title}</h2>
              <div class="ct-alert-subtitle">${subtitle}</div>
            </div>
            <button class="ct-alert-close" type="button" aria-label="Cancelar">×</button>
          </div>
          <div class="ct-alert-body">
            <p class="ct-alert-message" id="ct-alert-message"></p>
            ${options.checkboxLabel ? `
              <div class="ct-alert-checkbox-wrap" style="display:flex; align-items:center; gap:8px; margin-top:12px; margin-bottom:4px; font-size:12px; color:var(--text2,#8b90a8); cursor:pointer;">
                <input type="checkbox" id="ct-alert-checkbox" style="accent-color:var(--accent,#4f8ef7); cursor:pointer;">
                <label for="ct-alert-checkbox" style="cursor:pointer; user-select:none;">${options.checkboxLabel}</label>
              </div>
            ` : ''}
            <div class="ct-alert-footer">
              <button class="ct-alert-cancel" type="button"></button>
              <button class="ct-alert-ok ${danger ? 'danger' : ''}" type="button"></button>
            </div>
          </div>
        </div>
      `;

      const finish = value => {
        document.removeEventListener('keydown', onKeyDown, true);
        const checkbox = overlay.querySelector('#ct-alert-checkbox');
        const isChecked = checkbox ? checkbox.checked : false;
        overlay.remove();
        if (options.onConfirmWithCheckbox) {
          resolve({ confirmed: value, checked: isChecked });
        } else {
          resolve(value);
        }
      };

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          finish(true);
        }
      };

      overlay.querySelector('.ct-alert-message').textContent = text;
      overlay.querySelector('.ct-alert-cancel').textContent = cancelLabel;
      overlay.querySelector('.ct-alert-ok').textContent = confirmLabel;
      overlay.querySelector('.ct-alert-cancel').addEventListener('click', () => finish(false));
      overlay.querySelector('.ct-alert-close').addEventListener('click', () => finish(false));
      overlay.querySelector('.ct-alert-ok').addEventListener('click', () => finish(true));
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish(false);
      });

      document.addEventListener('keydown', onKeyDown, true);
      document.body.appendChild(overlay);
      overlay.querySelector('.ct-alert-cancel').focus();
    });
  },

  confirm(message, options = {}) {
    return this.showConfirm(message, options);
  },

  installAlertOverride() {
    if (typeof window === 'undefined' || window.__ctAlertOverrideInstalled) return;
    window.__ctAlertOverrideInstalled = true;
    window.__ctNativeAlert = this._nativeAlert;
    window.alert = message => {
      this.showAlert(message);
    };
  },

  // Copia texto para o clipboard e mostra toast
  copy(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toast(`Copiado: "${text.length > 25 ? text.substring(0, 25) + '...' : text}"`, '📋');
    }).catch(err => {
      console.error('Erro ao copiar:', err);
    });
  },

  // ─────────────────────────────────────────
  // CONCURSOS
  // ─────────────────────────────────────────

  getConcursos() {
    return this._get('ct_concursos');
  },

  getConcurso(id) {
    return this.getConcursos().find(c => c.id === id) || null;
  },

  saveConcurso(data) {
    const list = this.getConcursos();
    // Só busca por id existente se o id for válido (não undefined/null)
    const existing = data.id ? list.findIndex(c => c.id === data.id) : -1;
    if (existing >= 0) {
      list[existing] = { ...list[existing], ...data };
    } else {
      // Garante que o id gerado não seja sobrescrito pelo data
      const novoId = this._id();
      const { id, ...resto } = data; // remove id do data antes de espalhar
      list.push({ id: novoId, criadoEm: this._today(), contarEstatisticas: true, ...resto });
    }
    this._set('ct_concursos', list);
    return existing >= 0 ? list[existing].id : list[list.length - 1].id;
  },

  _clearContestAuxKeys(concursoId) {
    if (!concursoId) return;
    [
      'ct_crono_', 'ct_crono_mats_', 'ct_crono_sugestoes_', 'ct_crono_modo_',
      'ct_config_prova_', 'ct_matcor_nome_', 'ct_cest_', 'ct_ciclo_', 'ct_ciclo_stats_', 'ct_ciclo_snapshots_',
      'ct_faixa_idx_', 'ct_faixa_frase_', 'ct_faixa_hist_', 'ct_faixa_preta_',
      'ct_matcor_'
    ].forEach(prefix => {
      localStorage.removeItem(`${prefix}${concursoId}`);
    });
  },

  deleteConcurso(id) {
    const concursos = this.getConcursos().filter(c => c.id !== id);
    const materiasOriginais = this._get('ct_materias');
    const materiasAtualizadas = [];

    materiasOriginais.forEach(m => {
      if (m.concursoId === id) {
        const concursosB = Array.isArray(m.concursosB) ? m.concursosB.filter(cid => cid !== id) : [];
        if (concursosB.length > 0) {
          materiasAtualizadas.push({ ...m, concursoId: concursosB[0], concursosB: concursosB.slice(1) });
        }
        return;
      }

      if (Array.isArray(m.concursosB) && m.concursosB.includes(id)) {
        materiasAtualizadas.push({ ...m, concursosB: m.concursosB.filter(cid => cid !== id) });
        return;
      }

      materiasAtualizadas.push(m);
    });

    const materiasAtivas = new Set(materiasAtualizadas.map(m => m.id));
    const topicosAtualizados = this.getTopicos().filter(t => materiasAtivas.has(t.materiaId));
    const topicosAtivos = new Set(topicosAtualizados.map(t => t.id));
    const concursosAtivos = new Set(concursos.map(c => c.id));

    this._set('ct_concursos', concursos);
    this._set('ct_materias', materiasAtualizadas);
    this._set('ct_topicos', topicosAtualizados);
    this._set('ct_subtopicos', this.getSubtopicos().filter(s => topicosAtivos.has(s.topicoId)));
    this._set('ct_revisoes', this.getRevisoes().filter(r => {
      const ctx = this.getContextoRevisao(r);
      return ctx.topicoId && topicosAtivos.has(ctx.topicoId);
    }));
    this._set('ct_sessoes', this.getSessoes().filter(s =>
      concursosAtivos.has(s.concursoId) && (!s.materiaId || materiasAtivas.has(s.materiaId))
    ));
    this._set('ct_questoes', this.getQuestoes().filter(q =>
      concursosAtivos.has(q.concursoId) &&
      (!q.materiaId || materiasAtivas.has(q.materiaId)) &&
      (!q.topicoId || topicosAtivos.has(q.topicoId))
    ));
    this._set('ct_simulados', this.getSimulados().filter(s => s.concursoId !== id));
    this._clearContestAuxKeys(id);
  },

  // Calcula dias restantes para a prova
  diasRestantes(concurso) {
    if (!concurso.dataProva) return null;
    const hoje = new Date();
    const prova = new Date(concurso.dataProva);
    const diff = Math.ceil((prova - hoje) / (1000 * 60 * 60 * 24));
    return diff;
  },

  getPreEditalRocketAsset(concursoOuCoberto) {
    const coberto = typeof concursoOuCoberto === 'number'
      ? concursoOuCoberto
      : ((concursoOuCoberto && concursoOuCoberto.coberto) || 0);
    return coberto > 0
      ? 'assets/mascots/pre-edital-rocket.gif'
      : 'assets/mascots/pre-edital-rocket-still.png';
  },

  renderCoverageRocket(concursoOuCoberto, size = 18, extraStyle = '') {
    const src = this.getPreEditalRocketAsset(concursoOuCoberto);
    const safeSize = Number(size) > 0 ? Number(size) : 18;
    return `<img src="${src}" alt="Foguete da cobertura" style="width:${safeSize}px;height:${safeSize}px;object-fit:contain;display:inline-block;vertical-align:-4px;${extraStyle}">`;
  },

  _markPreEditalCoverage(concurso) {
    if (!concurso) return null;
    const cobertoAnterior = concurso.coberto || 0;
    concurso.coberto = cobertoAnterior + 1;
    if (!Array.isArray(concurso.coberturaHistorico)) concurso.coberturaHistorico = [];
    concurso.coberturaHistorico.push({
      data: this._today(),
      createdAt: new Date().toISOString(),
      numero: concurso.coberto,
      modo: concurso.preEdital ? 'pre_edital' : 'pos_edital'
    });
    concurso.preResetPromptPending = true;
    concurso.preMascotCelebrateOnReset = false;
    concurso.preMascotLaunchPending = false;
    this.saveConcurso(concurso);
    return concurso;
  },

  consumirAnimacaoMascotePreEdital(concursoId) {
    const c = this.getConcurso(concursoId);
    if (!c || !c.preMascotLaunchPending) return false;
    c.preMascotLaunchPending = false;
    c.preMascotCelebratedAt = new Date().toISOString();
    this.saveConcurso(c);
    return true;
  },

  resetarProgressoPreEdital(concursoId) {
    const c = this.getConcurso(concursoId);
    if (!c) return false;

    const matIds = this.getMaterias(concursoId).map(m => m.id);
    if (!matIds.length) {
      c._esperandoReset = false;
      c.preResetPromptPending = false;
      c.preMascotLaunchPending = false;
      c.preMascotCelebrateOnReset = false;
      this.saveConcurso(c);
      return true;
    }

    const list = this._get('ct_topicos');
    let updated = false;
    list.forEach(top => {
      if (matIds.includes(top.materiaId)) {
        top.estudado = false;
        top.estudadoEm = null;
        updated = true;
      }
    });
    if (updated) this._set('ct_topicos', list);

    const subList = this._get('ct_subtopicos');
    let subUpdated = false;
    const tsIds = list.filter(t => matIds.includes(t.materiaId)).map(t => t.id);
    subList.forEach(sub => {
      if (tsIds.includes(sub.topicoId)) {
        sub.estudado = false;
        sub.estudadoEm = null;
        subUpdated = true;
      }
    });
    if (subUpdated) this._set('ct_subtopicos', subList);

    c._esperandoReset = false;
    c.preResetPromptPending = false;
    c.preMascotLaunchPending = false;
    c.preMascotCelebrateOnReset = false;
    this.saveConcurso(c);
    return true;
  },

  // Incrementa contador de vezes que zerou o edital (pré-edital)
  incrementarCoberto(concursoId) {
    const c = this.getConcurso(concursoId);
    if (!c) return;
    this._markPreEditalCoverage(c);
  },

  // ─────────────────────────────────────────
  // MATÉRIAS
  // ─────────────────────────────────────────

  getMaterias(concursoId) {
    const all = this._get('ct_materias').map(m => m && m.nome ? { ...m, nome: this._formatMateriaNome(m.nome) } : m);
    return concursoId ? all.filter(m => m.concursoId === concursoId || (m.concursosB && m.concursosB.includes(concursoId))) : all;
  },

  getMateria(id) {
    const materia = this._get('ct_materias').find(m => m.id === id) || null;
    return materia && materia.nome ? { ...materia, nome: this._formatMateriaNome(materia.nome) } : materia;
  },

  saveMateria(data) {
    const list = this._get('ct_materias');
    const normalizedData = data && data.nome != null ? { ...data, nome: this._formatMateriaNome(data.nome) } : data;
    const isCollidable = normalizedData.id && normalizedData.id.startsWith('mat_');
    const idx = list.findIndex(m => m.id === normalizedData.id);

    if (idx >= 0 && isCollidable && list[idx].concursoId !== normalizedData.concursoId) {
      list.push({ ...normalizedData, id: this._id() });
    } else if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalizedData };
    } else {
      list.push({ id: this._id(), ...normalizedData });
    }
    this._set('ct_materias', list);
  },

  vincularMateria(materiaId, concursoId) {
    const list = this._get('ct_materias');
    const idx = list.findIndex(m => m.id === materiaId);
    if (idx >= 0) {
      const m = list[idx];
      if (m.concursoId !== concursoId && !(m.concursosB && m.concursosB.includes(concursoId))) {
        if (!m.concursosB) m.concursosB = [];
        m.concursosB.push(concursoId);
        this._set('ct_materias', list);
      }
    }
  },

  _linkIaTypeMeta(tipo) {
    const normalized = String(tipo || '').trim().toUpperCase();
    if (['PDF', 'AULA', 'AULAPDF'].includes(normalized)) {
      return { rotulo: 'PDF', nome: 'PDF de Aulas', emoji: '📙' };
    }
    if (['VIDEO', 'VIDEOAULA', 'VIDEOAULAS'].includes(normalized)) {
      return { rotulo: 'VIDEO', nome: 'Videoaula', emoji: '🎥' };
    }
    if (['FLASH', 'FLASHCARD', 'FLASHCARDS'].includes(normalized)) {
      return { rotulo: 'FLASH', nome: 'Flashcards', emoji: '🎴' };
    }
    if (['QUEST', 'QUESTAO', 'QUESTOES', 'CADERNO', 'CADERNODEQUESTOES'].includes(normalized)) {
      return { rotulo: 'QUEST', nome: 'Caderno de Questões', emoji: '📓' };
    }
    return null;
  },

  _safeMaterialUrlInfo(url, options = {}) {
    const raw = String(url || '').trim().replace(/^["']+|["']+$/g, '');
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) {
      return { ok: false, reason: 'Link vazio ou inválido.' };
    }

    if (options.allowInternalFlash && /^dashboard\.html#flashcards:[a-zA-Z0-9_-]+$/.test(raw)) {
      return { ok: true, url: raw, internal: true, trusted: true, warnings: [] };
    }

    const safeLocalFilePattern = /\.(pdf|html?|mp4|webm|mkv|avi|mov|m4v|wmv)(?:[?#].*)?$/i;
    const isWindowsLocalPath = /^[a-zA-Z]:[\\/]/.test(raw) || /^\\\\[^\\\/]+[\\\/][^\\\/]/.test(raw);
    const toLocalFileUrl = value => {
      const normalized = String(value || '').replace(/\\/g, '/');
      if (/^[a-zA-Z]:\//.test(normalized)) {
        return new URL('file:///' + normalized).href;
      }
      if (/^\/\/[^\/]+\/[^\/]/.test(normalized)) {
        return new URL('file:' + normalized).href;
      }
      return normalized;
    };

    if (isWindowsLocalPath && safeLocalFilePattern.test(raw)) {
      return { ok: true, url: toLocalFileUrl(raw), local: true, trusted: true, warnings: [] };
    }

    let parsed;
    try {
      parsed = new URL(raw);
    } catch (error) {
      return { ok: false, reason: 'Use um link completo começando com https://.' };
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'file:') {
      let localPath = parsed.pathname || '';
      try {
        localPath = decodeURIComponent(localPath);
      } catch (error) {}
      if (safeLocalFilePattern.test(localPath)) {
        return { ok: true, url: parsed.href, local: true, trusted: true, warnings: [] };
      }
      return { ok: false, reason: 'Arquivos locais precisam ser PDF, HTML ou video.' };
    }

    if (protocol !== 'https:') {
      return { ok: false, reason: 'Por segurança, apenas links https:// são aceitos.' };
    }

    if (parsed.username || parsed.password) {
      return { ok: false, reason: 'Links com usuário ou senha embutidos não são aceitos.' };
    }

    const host = parsed.hostname.toLowerCase();
    const trustedHosts = [
      'drive.google.com',
      'docs.google.com',
      'tecconcursos.com.br',
      'www.tecconcursos.com.br',
      'qconcursos.com',
      'www.qconcursos.com',
      'estrategiaconcursos.com.br',
      'www.estrategiaconcursos.com.br',
      'youtube.com',
      'www.youtube.com',
      'youtu.be'
    ];
    const trusted = trustedHosts.some(domain => host === domain || host.endsWith('.' + domain));
    const isRemotePdf = /\.pdf(?:$|[?#])/i.test(parsed.pathname);
    const suspiciousExt = /\.(exe|msi|bat|cmd|com|scr|ps1|vbs|js|jar|apk|zip|rar|7z|iso|dmg)(?:$|[?#])/i.test(parsed.pathname);
    const warnings = [];
    if (!trusted && !isRemotePdf) warnings.push('domínio não verificado');
    if (suspiciousExt) warnings.push('arquivo potencialmente perigoso');

    return { ok: true, url: parsed.href, host, trusted: trusted || isRemotePdf, remotePdf: isRemotePdf, warnings };
  },

  sanitizeMaterialLinkItem(item) {
    const rawItem = item || {};
    const rotulo = String(rawItem.rotulo || rawItem.tipo || rawItem.type || '').trim().toUpperCase();
    const info = this._safeMaterialUrlInfo(rawItem.url || rawItem.link || rawItem.href, { allowInternalFlash: rotulo === 'FLASH' });
    if (!info.ok) return null;
    const meta = this._linkIaTypeMeta(rotulo) || {};
    return {
      ...rawItem,
      rotulo,
      nome: String(rawItem.nome || rawItem.titulo || rawItem.title || meta.nome || 'Material').trim().slice(0, 120) || (meta.nome || 'Material'),
      emoji: rawItem.emoji || meta.emoji,
      url: info.url
    };
  },

  // <CT_DEV_TOOLS_LINKS_IA_METHODS>
  _normalizeIaImportUrl(url) {
    const raw = String(url || '').trim().replace(/^["']+|["']+$/g, '');
    if (!raw) return '';

    const drivePatterns = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i,
      /drive\.google\.com\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
      /drive\.google\.com\/thumbnail\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i,
      /[?&]id=([a-zA-Z0-9_-]{10,})/i
    ];
    for (const pattern of drivePatterns) {
      const match = raw.match(pattern);
      if (match && match[1]) return `gdrive:${match[1]}`;
    }

    try {
      const parsed = new URL(raw);
      parsed.hash = '';
      const keepParams = [];
      parsed.searchParams.forEach((value, key) => {
        const normalizedKey = String(key || '').trim().toLowerCase();
        if (!['usp', 'pli', 'authuser'].includes(normalizedKey)) {
          keepParams.push([normalizedKey, value]);
        }
      });
      keepParams.sort((a, b) => `${a[0]}=${a[1]}`.localeCompare(`${b[0]}=${b[1]}`));
      const query = keepParams.length
        ? '?' + keepParams.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
        : '';
      const pathname = (parsed.pathname || '/').replace(/\/+$/, '') || '/';
      return `url:${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${query}`;
    } catch (e) {
      return raw.replace(/\/+$/, '').toLowerCase();
    }
  },

  _sanitizeIaLinkItem(item) {
    const rawItem = typeof item === 'string' ? { tipo: 'PDF', url: item } : (item || {});
    const url = String(rawItem.url || rawItem.link || rawItem.href || '').trim().replace(/^["']+|["']+$/g, '');
    if (!url) return null;

    const meta = this._linkIaTypeMeta(rawItem.tipo || rawItem.rotulo || rawItem.type || rawItem.categoria);
    if (!meta) return null;

    const nome = String(rawItem.nome || rawItem.titulo || rawItem.title || meta.nome).trim() || meta.nome;
    const sanitized = this.sanitizeMaterialLinkItem({
      rotulo: meta.rotulo,
      nome,
      emoji: meta.emoji,
      url
    });
    return sanitized ? { ...sanitized, emoji: meta.emoji } : null;
  },

  _buildIaLinkDedupKey(item) {
    const normalizedUrl = this._normalizeIaImportUrl(item && item.url);
    const rotulo = String((item && (item.rotulo || item.tipo || item.type)) || '').trim().toUpperCase();
    if (!normalizedUrl || !rotulo) return '';
    return `${rotulo}::${normalizedUrl}`;
  },

  _serializeIaLinkList(cadernos) {
    return (Array.isArray(cadernos) ? cadernos : []).map(item => ({
      tipo: item.rotulo || '',
      nome: item.nome || '',
      url: item.url || ''
    }));
  },

  _buildMateriaLinksIaMaps(materiaId) {
    const topicosById = {};
    const topicosByCode = {};
    const subtopicosById = {};
    const subtopicosByCode = {};
    const pad = value => String(value).padStart(2, '0');

    this.getTopicos(materiaId).forEach((topico, topicoIndex) => {
      const topicoCode = `T${pad(topicoIndex + 1)}`;
      topicosById[topico.id] = topico;
      topicosByCode[topicoCode] = topico;

      this.getSubtopicos(topico.id).forEach((subtopico, subtopicoIndex) => {
        const subtopicoCode = `${topicoCode}.S${pad(subtopicoIndex + 1)}`;
        subtopicosById[subtopico.id] = subtopico;
        subtopicosByCode[subtopicoCode] = subtopico;
      });
    });

    return { topicosById, topicosByCode, subtopicosById, subtopicosByCode };
  },

  _mergeIaLinksIntoTarget(target, rawLinks, saveFn) {
    const result = { adicionados: 0, repetidos: 0, invalidos: 0 };
    if (!target || !Array.isArray(rawLinks) || rawLinks.length === 0) return result;

    const cadernos = Array.isArray(target.cadernos) ? [...target.cadernos] : [];
    rawLinks.forEach(rawItem => {
      const link = this._sanitizeIaLinkItem(rawItem);
      if (!link) {
        result.invalidos += 1;
        return;
      }

      const dedupKey = this._buildIaLinkDedupKey(link);
      if (!dedupKey) {
        result.invalidos += 1;
        return;
      }

      const exists = cadernos.some(existing => this._buildIaLinkDedupKey(existing) === dedupKey);
      if (exists) {
        result.repetidos += 1;
        return;
      }

      cadernos.push(link);
      result.adicionados += 1;
    });

    if (result.adicionados > 0) {
      target.cadernos = cadernos;
      saveFn(target);
    }
    return result;
  },

  _buildMateriaLinksIaPayload(materiaId) {
    const materia = this.getMateria(materiaId);
    if (!materia) return null;

    const concurso = this.getConcurso(materia.concursoId);
    const pad = value => String(value).padStart(2, '0');
    const topicos = this.getTopicos(materiaId);
    return {
      type: 'track_concursos_links_ai_export',
      version: '1.0',
      exportadoEm: new Date().toISOString(),
      concurso: {
        id: materia.concursoId || '',
        nome: concurso ? (concurso.nome || '') : '',
        banca: concurso ? (concurso.banca || '') : ''
      },
      materia: {
        id: materia.id,
        nome: materia.nome || '',
        linksExistentes: this._serializeIaLinkList(materia.cadernos),
        linksSugeridos: []
      },
      regras: {
        importacao: 'adicao_sem_substituicao',
        duplicidade: 'o mesmo link so e duplicado dentro do mesmo destino',
        topicoComSubtopicos: 'usar como contexto; preencher links apenas nos subtopicos',
        topicoSemSubtopicos: 'pode preencher links diretamente no topico'
      },
      tiposAceitos: ['PDF', 'VIDEO', 'FLASH', 'QUEST'],
      topicos: topicos.map((topico, topicoIndex) => {
        const subtopicos = this.getSubtopicos(topico.id);
        const possuiSubtopicos = subtopicos.length > 0;
        const topicoCode = `T${pad(topicoIndex + 1)}`;
        return {
          codigo: topicoCode,
          id: topico.id,
          nome: topico.nome || '',
          possuiSubtopicos,
          receberLinksNoTopico: !possuiSubtopicos,
          linksExistentes: this._serializeIaLinkList(topico.cadernos),
          linksSugeridos: [],
          subtopicos: subtopicos.map((subtopico, subtopicoIndex) => ({
            codigo: `${topicoCode}.S${pad(subtopicoIndex + 1)}`,
            id: subtopico.id,
            nome: subtopico.nome || '',
            linksExistentes: this._serializeIaLinkList(subtopico.cadernos),
            linksSugeridos: []
          }))
        };
      }),
      lote: {
        numero: 1,
        total: 1,
        codigo: 'L01',
        estrategia: 'materia_completa',
        topicosIncluidos: topicos.map((topico, topicoIndex) => `T${pad(topicoIndex + 1)}`)
      }
    };
  },

  gerarPromptLinksMateriaIA(materiaId) {
    const payload = this._buildMateriaLinksIaPayload(materiaId);
    return ['JSON DA MATERIA:', payload ? JSON.stringify(payload, null, 2) : '{}'].join('\n');
  },

  _countMateriaIaBatchUnits(topico) {
    const subtopicos = Array.isArray(topico && topico.subtopicos) ? topico.subtopicos : [];
    return Math.max(1, subtopicos.length);
  },

  _splitMateriaLinksIaPayload(payload, maxUnits = 15) {
    const topicos = Array.isArray(payload && payload.topicos) ? payload.topicos : [];
    if (!topicos.length) return [];

    const batches = [];
    let currentTopicos = [];
    let currentUnits = 0;

    const flushBatch = () => {
      if (!currentTopicos.length) return;
      batches.push({
        topicos: currentTopicos,
        unidades: currentUnits
      });
      currentTopicos = [];
      currentUnits = 0;
    };

    topicos.forEach(topico => {
      const units = this._countMateriaIaBatchUnits(topico);
      const wouldOverflow = currentTopicos.length > 0 && (currentUnits + units > maxUnits);
      if (wouldOverflow) flushBatch();
      currentTopicos.push(topico);
      currentUnits += units;
      if (units >= maxUnits) flushBatch();
    });
    flushBatch();

    return batches.map((batch, index) => {
      const total = batches.length;
      const numero = index + 1;
      const codigoInicial = batch.topicos[0] ? batch.topicos[0].codigo : '';
      const codigoFinal = batch.topicos[batch.topicos.length - 1] ? batch.topicos[batch.topicos.length - 1].codigo : '';
      return {
        ...payload,
        lote: {
          numero,
          total,
          codigo: `L${String(numero).padStart(2, '0')}`,
          estrategia: 'max_15_subtopicos',
          limiteSubtopicos: maxUnits,
          unidadesNoLote: batch.unidades,
          codigoInicial,
          codigoFinal,
          topicosIncluidos: batch.topicos.map(topico => topico.codigo)
        },
        topicos: batch.topicos
      };
    });
  },

  _buildMateriaLinksIaReadme(materia, lotes, maxUnits) {
    const linhas = [
      '# Lotes Exportados para IA',
      '',
      `Materia: ${materia && materia.nome ? materia.nome : 'Materia'}`,
      `Estrategia: topicos inteiros agrupados em lotes de ate ${maxUnits} subtópicos uteis`,
      '',
      'Cada arquivo JSON ja pode ser enviado separadamente para o Gemini.',
      'Como a importacao do Track Concursos e aditiva, os retornos podem ser importados lote por lote.',
      '',
      '## Lotes'
    ];

    lotes.forEach(lote => {
      const info = lote.lote || {};
      linhas.push(
        `- ${info.codigo || 'L??'}: ${info.codigoInicial || '?'} ate ${info.codigoFinal || '?'} | topicos: ${(info.topicosIncluidos || []).join(', ')} | unidades: ${info.unidadesNoLote || 0}`
      );
    });

    linhas.push(
      '',
      '## Prompt curto sugerido',
      '',
      'Leia integralmente o JSON anexado e processe este lote inteiro.',
      'Preencha somente linksSugeridos com PDFs.',
      'Retorne somente JSON puro.'
    );

    return linhas.join('\n');
  },

  async exportarMateriaLinksIA(materiaId) {
    const materia = this.getMateria(materiaId);
    if (!materia) return { ok: false, motivo: 'Materia nao encontrada.' };

    const payload = this._buildMateriaLinksIaPayload(materiaId);
    if (!payload) return { ok: false, motivo: 'Materia nao encontrada.' };
    const baseName = ('links_ia_' + (materia.nome || 'materia')).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const jsonStr = JSON.stringify(payload, null, 2);

    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.salvar_json_concurso === 'function') {
      const res = await window.pywebview.api.salvar_json_concurso(`${baseName}__L01`, jsonStr);
      if (res && res.ok) {
        return {
          ok: true,
          caminho: res.caminho,
          quantidade: 1,
          lotes: 1,
          arquivos: res.caminho ? [res.caminho] : []
        };
      }
      return res || { ok: false, motivo: 'cancelado' };
    }

    const a = document.createElement('a');
    a.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr));
    a.setAttribute('download', `${baseName}__L01.json`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return {
      ok: true,
      caminho: `${baseName}__L01.json`,
      quantidade: 1,
      lotes: 1,
      arquivos: [`${baseName}__L01.json`]
    };
  },

  _parseIaImportJson(rawValue) {
    if (typeof rawValue !== 'string') return rawValue;

    const attempts = [];
    const pushAttempt = value => {
      const normalized = String(value || '').trim();
      if (!normalized) return;
      if (!attempts.includes(normalized)) attempts.push(normalized);
    };

    pushAttempt(rawValue);

    const withoutFences = rawValue
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    pushAttempt(withoutFences);

    const cleanedMarkdownEscapes = withoutFences
      .replace(/\\(?=[_\[\]{}()#+\-!`*.])/g, '')
      .trim();
    pushAttempt(cleanedMarkdownEscapes);

    let lastError = null;
    for (const attempt of attempts) {
      try {
        return JSON.parse(attempt);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Formato JSON invalido.');
  },

  importarLinksMateriaIA(jsonStr, materiaId) {
    try {
      const data = this._parseIaImportJson(jsonStr);
      if (!['track_concursos_links_ai_export', 'track_concursos_links_ai_response'].includes(data.type)) {
        throw new Error('Formato de arquivo invalido para importar links.');
      }

      const materia = this.getMateria(materiaId);
      if (!materia) throw new Error('Materia de destino nao encontrada.');

      const payloadMateria = data.materia || {};
      const expectedName = String(materia.nome || '').trim().toLowerCase();
      const importedName = String(payloadMateria.nome || '').trim().toLowerCase();
      if (payloadMateria.id && payloadMateria.id !== materiaId && importedName && importedName !== expectedName) {
        throw new Error('Esse arquivo parece pertencer a outra materia.');
      }

      const maps = this._buildMateriaLinksIaMaps(materiaId);
      const resumo = {
        ok: true,
        adicionados: 0,
        repetidosIgnorados: 0,
        ignoradosPorRegra: 0,
        destinosNaoEncontrados: 0,
        linksInvalidos: 0
      };

      const somarResumo = partial => {
        resumo.adicionados += partial.adicionados || 0;
        resumo.repetidosIgnorados += partial.repetidos || 0;
        resumo.linksInvalidos += partial.invalidos || 0;
      };

      if (Array.isArray(payloadMateria.linksSugeridos) && payloadMateria.linksSugeridos.length) {
        somarResumo(this._mergeIaLinksIntoTarget(materia, payloadMateria.linksSugeridos, alvo => this.saveMateria(alvo)));
      }

      (Array.isArray(data.topicos) ? data.topicos : []).forEach(topicoData => {
        const localTopico = maps.topicosById[topicoData.id] || maps.topicosByCode[topicoData.codigo];
        const topicoLinks = Array.isArray(topicoData.linksSugeridos) ? topicoData.linksSugeridos : [];

        if (localTopico) {
          const possuiSubtopicos = this.getSubtopicos(localTopico.id).length > 0;
          if (topicoLinks.length) {
            if (possuiSubtopicos) {
              resumo.ignoradosPorRegra += topicoLinks.length;
            } else {
              somarResumo(this._mergeIaLinksIntoTarget(localTopico, topicoLinks, alvo => this.saveTopico(alvo)));
            }
          }
        } else if (topicoLinks.length) {
          resumo.destinosNaoEncontrados += topicoLinks.length;
        }

        (Array.isArray(topicoData.subtopicos) ? topicoData.subtopicos : []).forEach(subtopicoData => {
          const localSubtopico = maps.subtopicosById[subtopicoData.id] || maps.subtopicosByCode[subtopicoData.codigo];
          const subtopicoLinks = Array.isArray(subtopicoData.linksSugeridos) ? subtopicoData.linksSugeridos : [];

          if (!subtopicoLinks.length) return;
          if (!localSubtopico) {
            resumo.destinosNaoEncontrados += subtopicoLinks.length;
            return;
          }
          somarResumo(this._mergeIaLinksIntoTarget(localSubtopico, subtopicoLinks, alvo => this.saveSubtopico(alvo)));
        });
      });

      return resumo;
    } catch (e) {
      return { ok: false, erro: e.message };
    }
  },

  limparLinksMateriaCompleta(materiaId, filtros = {}) {
    try {
      const materia = this.getMateria(materiaId);
      if (!materia) throw new Error('Materia nao encontrada.');

      const rawTipos = Array.isArray(filtros)
        ? filtros
        : (Array.isArray(filtros.tipos) ? filtros.tipos : []);
      const tiposPermitidos = rawTipos
        .map(tipo => {
          const meta = this._linkIaTypeMeta(tipo);
          return meta ? meta.rotulo : String(tipo || '').trim().toUpperCase();
        })
        .filter(Boolean);
      const filtrarPorTipo = tiposPermitidos.length > 0;
      const tiposSet = new Set(tiposPermitidos);

      const resumo = {
        ok: true,
        linksRemovidos: 0,
        materiaAtualizada: false,
        topicosAtualizados: 0,
        subtopicosAtualizados: 0,
        tiposRemovidos: filtrarPorTipo ? tiposPermitidos : null
      };

      const limparCadernos = cadernos => {
        const lista = Array.isArray(cadernos) ? cadernos : [];
        if (!filtrarPorTipo) {
          return { atualizados: [], removidos: lista.length };
        }

        const atualizados = [];
        let removidos = 0;
        lista.forEach(item => {
          const rotulo = String(item && item.rotulo || '').trim().toUpperCase();
          if (tiposSet.has(rotulo)) {
            removidos += 1;
          } else {
            atualizados.push(item);
          }
        });
        return { atualizados, removidos };
      };

      const materiaLimpa = limparCadernos(materia.cadernos);
      if (materiaLimpa.removidos > 0) {
        materia.cadernos = materiaLimpa.atualizados;
        this.saveMateria(materia);
        resumo.linksRemovidos += materiaLimpa.removidos;
        resumo.materiaAtualizada = true;
      }

      this.getTopicos(materiaId).forEach(topico => {
        const topicoLimpo = limparCadernos(topico.cadernos);
        if (topicoLimpo.removidos > 0) {
          topico.cadernos = topicoLimpo.atualizados;
          this.saveTopico(topico);
          resumo.linksRemovidos += topicoLimpo.removidos;
          resumo.topicosAtualizados += 1;
        }

        this.getSubtopicos(topico.id).forEach(subtopico => {
          const subtopicoLimpo = limparCadernos(subtopico.cadernos);
          if (subtopicoLimpo.removidos > 0) {
            subtopico.cadernos = subtopicoLimpo.atualizados;
            this.saveSubtopico(subtopico);
            resumo.linksRemovidos += subtopicoLimpo.removidos;
            resumo.subtopicosAtualizados += 1;
          }
        });
      });

      return resumo;
    } catch (e) {
      return { ok: false, erro: e.message };
    }
  },
  // </CT_DEV_TOOLS_LINKS_IA_METHODS>

  desvincularOuDeletarMateria(materiaId, concursoId) {
    let list = this._get('ct_materias');
    const idx = list.findIndex(m => m.id === materiaId);
    if (idx < 0) return false;
    const m = list[idx];

    if (m.concursosB && m.concursosB.includes(concursoId)) {
      m.concursosB = m.concursosB.filter(c => c !== concursoId);
      this._set('ct_materias', list);
      return false; // Apenas desvinculou
    }

    if (m.concursoId === concursoId) {
      if (m.concursosB && m.concursosB.length > 0) {
        m.concursoId = m.concursosB.shift();
        this._set('ct_materias', list);
        return false; // Transferiu titularidade e desvinculou
      } else {
        list.splice(idx, 1);
        this._set('ct_materias', list);
        const tops = this.getTopicos(m.id);
        const topIds = tops.map(t => t.id);
        this._set('ct_topicos', this.getTopicos().filter(t => t.materiaId !== m.id));
        this._set('ct_subtopicos', this.getSubtopicos().filter(s => !topIds.includes(s.topicoId)));
        this._set('ct_questoes', this.getQuestoes().filter(q => q.materiaId !== m.id));
    this._set('ct_revisoes', this.getRevisoes().filter(r => {
      const ctx = this.getContextoRevisao(r);
      return !ctx.topicoId || !topIds.includes(ctx.topicoId);
    }));
        this._set('ct_sessoes', this.getSessoes().filter(s => s.materiaId !== m.id));
        return true; // Deletou pra valer
      }
    }
    return false;
  },

  // ─────────────────────────────────────────
  // LIMPEZA DE DADOS
  // ─────────────────────────────────────────

  limparLixo() {
    const lixo = ['matemacoites','dasda','dasdas','test','teste'];
    let all = this._get('ct_materias');
    const inicial = all.length;
    let list = all.filter(m => !lixo.includes(m.nome.toLowerCase().trim()));
    if (list.length < inicial) {
      this._set('ct_materias', list);
      console.log(`[CT] Limpeza: removidas ${inicial - list.length} matérias inúteis.`);
    }
  },

  // ─────────────────────────────────────────
  // TÓPICOS
  // ─────────────────────────────────────────

  getTopicos(materiaId) {
    const all = this._get('ct_topicos');
    return materiaId ? all.filter(t => t.materiaId === materiaId) : all;
  },

  getTopico(id) {
    return this._get('ct_topicos').find(t => t.id === id) || null;
  },

  saveTopico(data) {
    const list = this._get('ct_topicos');
    const isCollidable = data.id && data.id.startsWith('top_');
    const idx = list.findIndex(t => t.id === data.id);

    if (idx >= 0 && isCollidable && list[idx].concursoId !== data.concursoId) {
      const novo = { id: this._id(), estudado: false, revisaoData: null, ...data };
      list.push(novo);
      this._set('ct_topicos', list);
      return novo;
    } else if (idx >= 0) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.push({ id: this._id(), estudado: false, revisaoData: null, ...data });
    }
    this._set('ct_topicos', list);
    return list.find(t => t.id === (idx >= 0 ? data.id : list[list.length-1].id)) || list[list.length - 1];
  },

  marcarEstudado(topicoId, revisaoData) {
    const t = this.getTopico(topicoId);
    if (!t) return;
    t.estudado = true;
    t.estudadoEm = this._today();
    t.emEstudo = false;
    t.estudoStatus = 'estudado';
    t.estudoAtualizadoEm = this._today();
    t.revisaoData = revisaoData || null;
    // Log cumulativo: registra cada vez que o tópico foi marcado como estudado
    if (!t.logEstudo) t.logEstudo = [];
    t.logEstudo.push({ data: this._today(), hora: new Date().toISOString() });
    this.saveTopico(t);
    this._setCronogramaDiarioStatus({
      concursoId: t.concursoId,
      topicoId,
      data: t.estudadoEm,
      status: 'estudado'
    });
    // Agenda revisão
    if (revisaoData) this.agendarRevisao(topicoId, revisaoData);
    this._checkEditalBatido(t.concursoId);
  },

  desmarcarEstudado(topicoId) {
    const t = this.getTopico(topicoId);
    if (!t) return;
    t.estudado = false;
    t.estudadoEm = null;
    t.revisaoData = null;
    t.emEstudo = false;
    t.estudoStatus = '';
    t.estudoAtualizadoEm = null;
    this.saveTopico(t);
    this._checkEditalBatido(t.concursoId);
  },

  _unitStudyKey(dados) {
    const subId = dados && (dados.subtopId || dados.subtopicoId);
    if (subId) return `sub:${subId}`;
    if (dados && dados.topicoId) return `top:${dados.topicoId}`;
    return '';
  },

  _setCronogramaDiarioStatus(dados) {
    const concursoId = dados && dados.concursoId;
    const key = this._unitStudyKey(dados);
    if (!concursoId || !key) return;
    const data = this._normalizeDateString(dados.data);
    const storageKey = `ct_crono_dia_status_${concursoId}`;
    let all = {};
    try { all = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (e) { all = {}; }
    if (!all[data] || typeof all[data] !== 'object') all[data] = {};
    all[data][key] = {
      status: dados.status || 'em_estudo',
      data,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(storageKey, JSON.stringify(all));
  },

  getCronogramaDiarioStatus(concursoId, data) {
    if (!concursoId) return {};
    const storageKey = `ct_crono_dia_status_${concursoId}`;
    const dataKey = this._normalizeDateString(data);
    try {
      const all = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
      return all[dataKey] && typeof all[dataKey] === 'object' ? all[dataKey] : {};
    } catch (e) {
      return {};
    }
  },

  registrarProgressoUnidadeEstudo(dados) {
    if (!dados) return false;
    const status = dados.status === 'estudado' ? 'estudado' : dados.status === 'em_estudo' ? 'em_estudo' : '';
    if (!status) return false;
    const data = this._normalizeDateString(dados.data);
    const subId = dados.subtopId || dados.subtopicoId || null;
    const topicoId = dados.topicoId || null;
    let changed = false;
    let concursoId = dados.concursoId || null;

    if (subId) {
      const sub = this.getSubtopico(subId);
      if (sub) {
        concursoId = concursoId || sub.concursoId;
        if (status === 'estudado') {
          sub.estudado = true;
          sub.estudadoEm = data;
          sub.emEstudo = false;
          sub.estudoStatus = 'estudado';
        } else if (!sub.estudado) {
          sub.emEstudo = true;
          sub.estudoStatus = 'em_estudo';
          sub.estudoIniciadoEm = sub.estudoIniciadoEm || data;
          sub.estudoAtualizadoEm = data;
        }
        this.saveSubtopico(sub);
        changed = true;
      }
    } else if (topicoId) {
      const top = this.getTopico(topicoId);
      if (top) {
        concursoId = concursoId || top.concursoId;
        if (status === 'estudado') {
          top.estudado = true;
          top.estudadoEm = data;
          top.emEstudo = false;
          top.estudoStatus = 'estudado';
          if (!top.logEstudo) top.logEstudo = [];
          top.logEstudo.push({ data, hora: new Date().toISOString() });
        } else if (!top.estudado) {
          top.emEstudo = true;
          top.estudoStatus = 'em_estudo';
          top.estudoIniciadoEm = top.estudoIniciadoEm || data;
          top.estudoAtualizadoEm = data;
        }
        this.saveTopico(top);
        changed = true;
      }
    }

    if (changed) {
      this._setCronogramaDiarioStatus({
        concursoId,
        topicoId,
        subtopId: subId,
        data,
        status
      });
      if (status === 'estudado' && concursoId) this._checkEditalBatido(concursoId);
      if (typeof this.queueAutoSave === 'function') {
        this.queueAutoSave('progresso-unidade-estudo', { delay: 1200, toast: false });
      }
    }
    return changed;
  },

  _checkEditalBatido(concursoId) {
    const c = this.getConcurso(concursoId);
    if (!c) return;

    const matIds = this.getMaterias(concursoId).map(m => m.id);
    const topicos = this.getTopicos().filter(top => matIds.includes(top.materiaId));
    if (topicos.length === 0) return;

    const todosEstudados = topicos.every(top => top.estudado);
    if (todosEstudados) {
       if (c._esperandoReset) return;

       this._markPreEditalCoverage(c);
       c._esperandoReset = true;
       this.saveConcurso(c);
       this.toast('Edital coberto com sucesso. Abra o dashboard para iniciar o próximo ciclo quando quiser.', '🎉');
    } else {
       if (c._esperandoReset) {
          c._esperandoReset = false;
          c.preResetPromptPending = false;
          c.preMascotCelebrateOnReset = false;
          c.preMascotLaunchPending = false;
          this.saveConcurso(c);
       }
    }
  },

  // ─────────────────────────────────────────
  // SUBTÓPICOS
  // ─────────────────────────────────────────

  getSubtopicos(topicoId) {
    const all = this._get('ct_subtopicos');
    return topicoId ? all.filter(s => s.topicoId === topicoId) : all;
  },

  getSubtopico(id) {
    return this._get('ct_subtopicos').find(s => s.id === id) || null;
  },

  saveSubtopico(data) {
    const list = this._get('ct_subtopicos');
    const isCollidable = data.id && data.id.startsWith('sub_');
    const idx = list.findIndex(s => s.id === data.id);

    if (idx >= 0 && isCollidable && list[idx].concursoId !== data.concursoId) {
      list.push({ ...data, id: this._id(), estudado: false });
    } else if (idx >= 0) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.push({ id: this._id(), estudado: false, ...data });
    }
    this._set('ct_subtopicos', list);
  },

  // ─────────────────────────────────────────
  // QUESTÕES
  // ─────────────────────────────────────────

  getQuestoes(filtro) {
    const all = this._get('ct_questoes');
    if (!filtro) return all;
    return all.filter(q => {
      if (filtro.topicoId && q.topicoId !== filtro.topicoId) return false;
      if (filtro.subtopId && q.subtopId !== filtro.subtopId) return false;
      if (filtro.materiaId && q.materiaId !== filtro.materiaId) return false;
      if (filtro.concursoId && q.concursoId !== filtro.concursoId) return false;
      return true;
    });
  },

  lancarQuestoes(dados) {
    // dados: { topicoId?, subtopId?, materiaId, concursoId, resolvidas, acertos, erros }
    const list = this._get('ct_questoes');
    const dataLancamento = this._normalizeDateString(dados && dados.data);
    const novoLancamento = { id: this._id(), data: dataLancamento, horaInicio: new Date().toISOString(), ...dados, data: dataLancamento };
    list.push(novoLancamento);
    this._set('ct_questoes', list);
    this._emitDataUpdated('questoes:add', {
      concursoId: novoLancamento.concursoId || null,
      materiaId: novoLancamento.materiaId || null,
      topicoId: novoLancamento.topicoId || null,
      subtopId: novoLancamento.subtopId || null,
      item: novoLancamento
    });
    return novoLancamento.id;
  },

  excluirLancamentoQuestoes(id) {
    if (!id) return false;
    const list = this._get('ct_questoes');
    const removido = list.find(q => q.id === id);
    const next = list.filter(q => q.id !== id);
    if (next.length === list.length) return false;
    this._set('ct_questoes', next);
    this._emitDataUpdated('questoes:remove', {
      concursoId: removido?.concursoId || null,
      materiaId: removido?.materiaId || null,
      topicoId: removido?.topicoId || null,
      subtopId: removido?.subtopId || null,
      item: removido || null
    });
    return true;
  },

  atualizarLancamentoQuestoes(id, dados = {}) {
    if (!id) return false;
    const list = this._get('ct_questoes');
    const idx = list.findIndex(q => q.id === id);
    if (idx < 0) return false;
    const anterior = { ...list[idx] };
    const acertos = Math.max(0, parseInt(dados.acertos, 10) || 0);
    const erros = Math.max(0, parseInt(dados.erros, 10) || 0);
    const data = this._normalizeDateString(dados.data || anterior.data);
    const horaInicio = dados.horaInicio || anterior.horaInicio || new Date().toISOString();
    const atualizado = {
      ...anterior,
      ...dados,
      id: anterior.id,
      concursoId: dados.concursoId || anterior.concursoId,
      materiaId: dados.materiaId || anterior.materiaId,
      topicoId: dados.topicoId || anterior.topicoId,
      subtopId: dados.subtopId ?? dados.subtopicoId ?? anterior.subtopId ?? anterior.subtopicoId,
      data,
      horaInicio,
      resolvidas: acertos + erros,
      acertos,
      erros,
      updatedAt: new Date().toISOString()
    };
    list[idx] = atualizado;
    this._set('ct_questoes', list);
    this._emitDataUpdated('questoes:update', {
      concursoId: atualizado.concursoId || null,
      materiaId: atualizado.materiaId || null,
      topicoId: atualizado.topicoId || null,
      subtopId: atualizado.subtopId || null,
      antes: anterior,
      item: atualizado
    });
    if (typeof this.queueAutoSave === 'function') {
      this.queueAutoSave('questoes-editadas', { delay: 1200, toast: false });
    }
    return true;
  },

  desfazerUltimoLancamento(filtro) {
    const list = this._get('ct_questoes');
    let removido = null;
    // Encontra o ultimo lancamento que bate com o filtro
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      const match =
        (!filtro.topicoId || q.topicoId === filtro.topicoId) &&
        (!filtro.subtopId || q.subtopId === filtro.subtopId);
      if (match) { removido = list.splice(i, 1)[0]; break; }
    }
    this._set('ct_questoes', list);
    if (removido) {
      this._emitDataUpdated('questoes:remove', {
        concursoId: removido.concursoId || null,
        materiaId: removido.materiaId || null,
        topicoId: removido.topicoId || null,
        subtopId: removido.subtopId || null,
        item: removido
      });
    }
  },

  // Calcula estatísticas de questões para um conjunto de lançamentos
  calcStats(questoes) {
    const res = questoes.reduce((acc, q) => {
      acc.resolvidas += q.resolvidas || 0;
      acc.acertos    += q.acertos    || 0;
      acc.erros      += q.erros      || 0;
      return acc;
    }, { resolvidas: 0, acertos: 0, erros: 0 });
    res.pct = res.resolvidas > 0 ? Math.round((res.acertos / res.resolvidas) * 100) : null;
    return res;
  },

  pctColor(pct) {
    if (pct === null || pct === undefined) return 'var(--text3)';
    if (pct >= 93) return 'var(--score-excellent)';
    if (pct >= 80) return 'var(--score-good)';
    if (pct >= 75) return 'var(--score-ok)';
    if (pct >= 50) return 'var(--score-mid)';
    return 'var(--score-low)';
  },

  // Retorna classe CSS de cor pela % de acertos
  pctClass(pct) {
    if (pct === null || pct === undefined) return 'none';
    if (pct >= 93) return 'g1';
    if (pct >= 80) return 'g2';
    if (pct >= 75) return 'y';
    if (pct >= 50) return 'o';
    return 'r';
  },

  // ─────────────────────────────────────────
  // SESSÕES DE ESTUDO
  // ─────────────────────────────────────────

  getSessoes(filtro) {
    const all = this._get('ct_sessoes');
    if (!filtro) return all;
    return all.filter(s => {
      if (filtro.concursoId && s.concursoId !== filtro.concursoId) return false;
      if (filtro.materiaId  && s.materiaId  !== filtro.materiaId)  return false;
      if (filtro.data       && s.data       !== filtro.data)        return false;
      return true;
    });
  },

  _positiveInt(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  },

  getMetricasSessao(sessao) {
    const raw = (sessao && (sessao.metricas || sessao.estatisticas || sessao.extrasEstudo)) || {};
    const paginasPdf = this._positiveInt(raw.paginasPdf ?? raw.pdfPaginas ?? raw.paginasLidas ?? raw.paginasPdfLivro ?? sessao?.paginasPdf);
    const paginasLivro = this._positiveInt(raw.paginasLivro ?? raw.paginasApostila ?? sessao?.paginasLivro);
    return {
      paginasPdf: paginasPdf + paginasLivro,
      videoMinutos: this._positiveInt(raw.videoMinutos ?? raw.minutosVideo ?? raw.videoaulaMinutos ?? sessao?.videoMinutos)
    };
  },

  limparMetricasSessao(metricas) {
    const clean = {};
    const normalized = this.getMetricasSessao({ metricas });
    Object.entries(normalized).forEach(([key, value]) => {
      if (value > 0) clean[key] = value;
    });
    return clean;
  },

  formatarMetricasSessao(sessao) {
    const m = this.getMetricasSessao(sessao);
    const itens = [];
    if (m.paginasPdf > 0) itens.push({ key: 'paginasPdf', label: `${m.paginasPdf} páginas lidas PDF/Livro` });
    if (m.videoMinutos > 0) itens.push({ key: 'videoMinutos', label: `${m.videoMinutos} min assistidos de videoaulas` });
    return itens;
  },

  formatarResumoMetricasSessao(sessao) {
    return this.formatarMetricasSessao(sessao).map(item => item.label).join(' | ');
  },

  somarMetricasSessoes(sessoes) {
    return (Array.isArray(sessoes) ? sessoes : []).reduce((acc, sessao) => {
      const m = this.getMetricasSessao(sessao);
      acc.paginasPdf += m.paginasPdf;
      acc.videoMinutos += m.videoMinutos;
      return acc;
    }, { paginasPdf: 0, videoMinutos: 0 });
  },

  _cicloSnapshotsKey(concursoId) {
    return concursoId ? `ct_ciclo_snapshots_${concursoId}` : '';
  },

  getCicloSnapshots(concursoId) {
    const key = this._cicloSnapshotsKey(concursoId);
    if (!key) return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  _setCicloSnapshots(concursoId, snapshots) {
    const key = this._cicloSnapshotsKey(concursoId);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.isArray(snapshots) ? snapshots : []));
  },

  _cycleEntries(raw) {
    const list = Array.isArray(raw?.items) ? raw.items : (Array.isArray(raw?.entries) ? raw.entries : []);
    return list.map((entry, idx) => ({
      id: entry.id || `entry_${idx}`,
      baseId: entry.baseId || '',
      materiaId: entry.materiaId || '',
      nome: entry.nome || this._cicloEntryNome(entry, null),
      targetSeconds: Math.max(0, parseInt(entry.targetSeconds, 10) || 0),
      remainingSeconds: Math.max(0, parseInt(entry.remainingSeconds, 10) || 0),
      status: entry.status || 'pending'
    }));
  },

  _cycleDateKey(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = typeof value === 'number' ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return this._dateString(d);
  },

  _cycleTimestamp(hist, sessao) {
    if (sessao && sessao.horaInicio) return sessao.horaInicio;
    if (hist && hist.horaInicio) return hist.horaInicio;
    if (hist && hist.createdAt) return hist.createdAt;
    if (hist && hist.ts) {
      const d = new Date(hist.ts);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (sessao && sessao.data) return `${sessao.data}T00:00:00`;
    if (hist && hist.data) return `${hist.data}T00:00:00`;
    return '';
  },

  _cycleDaysInclusive(startKey, endKey) {
    if (!startKey || !endKey) return null;
    const start = new Date(`${startKey}T00:00:00`);
    const end = new Date(`${endKey}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  },

  _statsFromQuestions(questoes) {
    return this.calcStats(Array.isArray(questoes) ? questoes : []);
  },

  _emptyCycleMetrics() {
    return { paginasPdf: 0, videoMinutos: 0 };
  },

  buildCicloSnapshot(concursoId, rawCycle, options = {}) {
    const raw = rawCycle || this._readCiclo(concursoId) || {};
    const entries = this._cycleEntries(raw);
    const history = Array.isArray(raw.sessionHistory) ? raw.sessionHistory : [];
    const round = Math.max(1, parseInt(raw.round, 10) || 1);
    const targetSeconds = entries.reduce((acc, entry) => acc + entry.targetSeconds, 0);
    const studiedSeconds = history.reduce((acc, hist) => acc + (Math.max(0, parseInt(hist.duracao || hist.duracaoSegundos, 10) || 0)), 0);
    const entryById = new Map(entries.map(entry => [entry.id, entry]));
    const sessionIds = new Set(history.map(hist => hist.sessaoId || hist.id).filter(Boolean));
    const allSessions = this.getSessoes({ concursoId });
    const sessionsById = new Map(allSessions.map(s => [s.id, s]));
    const cycleSessions = history
      .map(hist => sessionsById.get(hist.sessaoId || hist.id))
      .filter(Boolean);
    const cycleSessionIds = new Set(cycleSessions.map(s => s.id));
    const metricas = this.somarMetricasSessoes(cycleSessions);
    const eventTimes = history.map(hist => this._cycleTimestamp(hist, sessionsById.get(hist.sessaoId || hist.id))).filter(Boolean).sort();
    const startAt = eventTimes[0] || options.startAt || raw.startedAt || '';
    const endAt = options.endAt || new Date().toISOString();
    const startKey = this._cycleDateKey(startAt);
    const endKey = this._cycleDateKey(endAt) || this._today();

    let cumulative = 0;
    let reachedAt = '';
    history
      .slice()
      .sort((a, b) => String(this._cycleTimestamp(a, sessionsById.get(a.sessaoId || a.id))).localeCompare(String(this._cycleTimestamp(b, sessionsById.get(b.sessaoId || b.id)))))
      .forEach(hist => {
        if (reachedAt || targetSeconds <= 0) return;
        cumulative += Math.max(0, parseInt(hist.duracao || hist.duracaoSegundos, 10) || 0);
        if (cumulative >= targetSeconds) reachedAt = this._cycleTimestamp(hist, sessionsById.get(hist.sessaoId || hist.id)) || endAt;
      });
    const reachedKey = this._cycleDateKey(reachedAt);

    const materiaIds = new Set(entries.map(entry => entry.materiaId).filter(id => id && !String(id).startsWith('v-')));
    const inCyclePeriod = item => {
      const key = this._cycleDateKey(item && item.data);
      if (!key) return false;
      if (startKey && key < startKey) return false;
      if (endKey && key > endKey) return false;
      return true;
    };
    const questionPool = this.getQuestoes({ concursoId }).filter(q =>
      inCyclePeriod(q) && (!materiaIds.size || materiaIds.has(q.materiaId))
    );
    const qStats = this._statsFromQuestions(questionPool);

    const sessionsByItem = new Map();
    history.forEach(hist => {
      const itemId = hist.itemId || '';
      if (!itemId) return;
      const arr = sessionsByItem.get(itemId) || [];
      const sessao = sessionsById.get(hist.sessaoId || hist.id);
      if (sessao) arr.push(sessao);
      sessionsByItem.set(itemId, arr);
    });

    const materias = entries.map(entry => {
      const itemSessions = sessionsByItem.get(entry.id) || [];
      const qs = questionPool.filter(q => q.materiaId === entry.materiaId);
      const stats = this._statsFromQuestions(qs);
      const studied = history
        .filter(hist => hist.itemId === entry.id)
        .reduce((acc, hist) => acc + (Math.max(0, parseInt(hist.duracao || hist.duracaoSegundos, 10) || 0)), 0);
      return {
        itemId: entry.id,
        materiaId: entry.materiaId || null,
        nome: entry.nome,
        status: entry.status || 'pending',
        targetSeconds: entry.targetSeconds,
        studiedSeconds: studied,
        goalPct: entry.targetSeconds > 0 ? Math.round((studied / entry.targetSeconds) * 100) : 0,
        questoes: stats,
        metricas: this.somarMetricasSessoes(itemSessions)
      };
    });

    const topicMap = new Map();
    const ensureTopic = (key, seed = {}) => {
      if (!topicMap.has(key)) {
        topicMap.set(key, {
          key,
          materiaId: seed.materiaId || null,
          materiaNome: seed.materiaNome || '',
          topicoId: seed.topicoId || null,
          subtopId: seed.subtopId || null,
          nome: seed.nome || 'Sem tópico definido',
          studiedSeconds: 0,
          questoes: { resolvidas: 0, acertos: 0, erros: 0, pct: null },
          metricas: this._emptyCycleMetrics()
        });
      }
      return topicMap.get(key);
    };
    const materiaName = id => (id && this.getMateria(id)?.nome) || '';
    const topicName = (topicoId, subtopId, materiaId) => {
      const top = topicoId ? this.getTopico(topicoId) : null;
      const sub = subtopId ? this.getSubtopico(subtopId) : null;
      return [top?.nome, sub?.nome].filter(Boolean).join(' > ') || materiaName(materiaId) || 'Sem tópico definido';
    };
    cycleSessions.forEach(sessao => {
      const subtopId = sessao.subtopId || sessao.subtopicoId || null;
      const topicoId = sessao.topicoId || null;
      const key = subtopId ? `sub:${subtopId}` : (topicoId ? `top:${topicoId}` : `mat:${sessao.materiaId || 'livre'}`);
      const row = ensureTopic(key, {
        materiaId: sessao.materiaId || null,
        materiaNome: materiaName(sessao.materiaId),
        topicoId,
        subtopId,
        nome: topicName(topicoId, subtopId, sessao.materiaId)
      });
      row.studiedSeconds += Math.max(0, parseInt(sessao.duracaoSegundos, 10) || 0);
      const m = this.getMetricasSessao(sessao);
      row.metricas.paginasPdf += m.paginasPdf;
      row.metricas.videoMinutos += m.videoMinutos;
    });
    questionPool.forEach(q => {
      const subtopId = q.subtopId || q.subtopicoId || null;
      const topicoId = q.topicoId || null;
      const key = subtopId ? `sub:${subtopId}` : (topicoId ? `top:${topicoId}` : `mat:${q.materiaId || 'livre'}`);
      const row = ensureTopic(key, {
        materiaId: q.materiaId || null,
        materiaNome: materiaName(q.materiaId),
        topicoId,
        subtopId,
        nome: topicName(topicoId, subtopId, q.materiaId)
      });
      row.questoes.resolvidas += q.resolvidas || 0;
      row.questoes.acertos += q.acertos || 0;
      row.questoes.erros += q.erros || 0;
      row.questoes.pct = row.questoes.resolvidas > 0 ? Math.round((row.questoes.acertos / row.questoes.resolvidas) * 100) : null;
    });
    const topicos = Array.from(topicMap.values()).sort((a, b) =>
      (b.questoes.erros || 0) - (a.questoes.erros || 0) ||
      (b.questoes.resolvidas || 0) - (a.questoes.resolvidas || 0) ||
      (b.studiedSeconds || 0) - (a.studiedSeconds || 0)
    );

    const uniqueKey = `${concursoId || 'sem'}:${round}:${startKey || 'sem-inicio'}:${targetSeconds}`;
    const previous = this.getCicloSnapshots(concursoId)
      .filter(s => s && s.uniqueKey !== uniqueKey)
      .sort((a, b) => String(b.endAt || b.updatedAt || '').localeCompare(String(a.endAt || a.updatedAt || '')))[0] || null;
    const previousTopics = new Map((previous?.topicos || []).map(t => [t.key, t]));
    const previousMaterias = new Map((previous?.materias || []).map(m => [m.materiaId || m.itemId || m.nome, m]));
    const focusTopics = topicos
      .filter(t => {
        const pct = t.questoes.pct;
        const prevPct = previousTopics.get(t.key)?.questoes?.pct;
        return t.questoes.resolvidas > 0 && (pct == null || pct < 75 || (prevPct != null && pct <= prevPct - 5));
      })
      .slice(0, 8)
      .map(t => ({ ...t, motivo: previousTopics.get(t.key)?.questoes?.pct != null && t.questoes.pct <= previousTopics.get(t.key).questoes.pct - 5 ? 'piorou em relação ao ciclo anterior' : 'taxa de acerto baixa' }));
    const polishTopics = topicos
      .filter(t => t.questoes.resolvidas > 0 && t.questoes.pct != null && t.questoes.pct >= 90)
      .slice(0, 8);
    const focusMaterias = materias
      .filter(m => {
        const pct = m.questoes.pct;
        const prevPct = previousMaterias.get(m.materiaId || m.itemId || m.nome)?.questoes?.pct;
        return m.questoes.resolvidas > 0 && (pct == null || pct < 75 || (prevPct != null && pct <= prevPct - 5));
      })
      .slice(0, 6);
    const polishMaterias = materias
      .filter(m => m.questoes.resolvidas > 0 && m.questoes.pct != null && m.questoes.pct >= 90)
      .slice(0, 6);

    const daysToReach = reachedKey ? this._cycleDaysInclusive(startKey, reachedKey) : null;
    const previousDays = previous?.daysToReach || null;
    const comparison = previous ? {
      previousId: previous.id,
      previousRound: previous.round,
      goalPctDelta: Math.round((targetSeconds > 0 ? studiedSeconds / targetSeconds * 100 : 0) - (previous.goalPct || 0)),
      daysToReachDelta: daysToReach != null && previousDays != null ? daysToReach - previousDays : null,
      questoesDelta: (qStats.resolvidas || 0) - (previous.questoes?.resolvidas || 0),
      acertosDelta: (qStats.acertos || 0) - (previous.questoes?.acertos || 0),
      pctDelta: qStats.pct != null && previous.questoes?.pct != null ? qStats.pct - previous.questoes.pct : null,
      paginasDelta: (metricas.paginasPdf || 0) - (previous.metricas?.paginasPdf || 0),
      videoDelta: (metricas.videoMinutos || 0) - (previous.metricas?.videoMinutos || 0)
    } : null;

    return {
      type: 'track_cycle_snapshot',
      version: 1,
      id: options.id || `cycle_snapshot_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      uniqueKey,
      concursoId,
      round,
      status: options.status || (entries.length && entries.every(entry => entry.status === 'done' || entry.status === 'skipped') ? 'complete' : 'in_progress'),
      createdAt: options.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startAt,
      startData: startKey,
      endAt,
      endData: endKey,
      reachedAt,
      reachedData: reachedKey,
      daysToReach,
      daysActive: this._cycleDaysInclusive(startKey, endKey),
      targetSeconds,
      studiedSeconds,
      extraSeconds: studiedSeconds - targetSeconds,
      goalPct: targetSeconds > 0 ? Math.round((studiedSeconds / targetSeconds) * 100) : 0,
      questoes: qStats,
      metricas,
      materias,
      topicos,
      recommendations: {
        focoMaterias: focusMaterias,
        lapidarMaterias: polishMaterias,
        focoTopicos: focusTopics,
        lapidarTopicos: polishTopics
      },
      comparison,
      refs: {
        sessionIds: Array.from(new Set([...sessionIds, ...cycleSessionIds])).filter(Boolean),
        questionIds: questionPool.map(q => q.id).filter(Boolean),
        entryIds: entries.map(entry => entry.id)
      }
    };
  },

  salvarCicloSnapshot(concursoId, rawCycle, options = {}) {
    const snapshot = this.buildCicloSnapshot(concursoId, rawCycle, options);
    const list = this.getCicloSnapshots(concursoId);
    const idx = list.findIndex(item => item.uniqueKey === snapshot.uniqueKey);
    if (idx >= 0) {
      snapshot.id = list[idx].id || snapshot.id;
      snapshot.createdAt = list[idx].createdAt || snapshot.createdAt;
      list[idx] = snapshot;
    } else {
      list.push(snapshot);
    }
    list.sort((a, b) => String(a.startAt || a.createdAt || '').localeCompare(String(b.startAt || b.createdAt || '')));
    this._setCicloSnapshots(concursoId, list);
    return snapshot;
  },

  _cicloKey(concursoId) {
    return concursoId ? `ct_ciclo_${concursoId}` : '';
  },

  _readCiclo(concursoId) {
    const key = this._cicloKey(concursoId);
    if (!key) return null;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      if (!raw || !Array.isArray(raw.entries)) return null;
      raw.sessionHistory = Array.isArray(raw.sessionHistory) ? raw.sessionHistory : [];
      return raw;
    } catch {
      return null;
    }
  },

  _writeCiclo(concursoId, raw) {
    const key = this._cicloKey(concursoId);
    if (!key || !raw) return;
    this._normalizeCicloPointer(raw);
    localStorage.setItem(key, JSON.stringify(raw));
    try {
      window.dispatchEvent(new CustomEvent('ct-cycle-updated', { detail: { concursoId, data: raw } }));
    } catch {}
  },

  _isCicloEntryPending(entry) {
    if (!entry || entry.status === 'done' || entry.status === 'skipped') return false;
    const target = Math.max(0, parseInt(entry.targetSeconds, 10) || 0);
    if (target <= 0) return false;
    const remaining = entry.remainingSeconds == null
      ? target
      : Math.max(0, parseInt(entry.remainingSeconds, 10) || 0);
    return remaining > 0;
  },

  _firstCicloPendingIndex(entries) {
    if (!Array.isArray(entries)) return -1;
    return entries.findIndex(entry => this._isCicloEntryPending(entry));
  },

  _normalizeCicloPointer(raw) {
    if (!raw || !Array.isArray(raw.entries)) return raw;
    const firstPendingIdx = this._firstCicloPendingIndex(raw.entries);
    raw.currentIndex = firstPendingIdx >= 0 ? firstPendingIdx : 0;
    raw.currentItemId = firstPendingIdx >= 0 && raw.entries[firstPendingIdx] ? (raw.entries[firstPendingIdx].id || '') : '';
    return raw;
  },

  _cicloEntryNome(entry, sessao) {
    const materia = sessao && sessao.materiaId ? this.getMateria(sessao.materiaId) : null;
    if (materia && materia.nome) return materia.nome;
    if (entry && entry.nome) return entry.nome;
    if (entry && entry.baseId) return String(entry.baseId).replace(/^base_/, '').replace(/_/g, ' ').toUpperCase();
    return 'Materia';
  },

  _findCicloEntryIndex(raw, sessao) {
    if (!raw || !Array.isArray(raw.entries) || !sessao || !sessao.materiaId) return -1;
    const matches = raw.entries
      .map((entry, idx) => ({ entry, idx }))
      .filter(({ entry }) => entry && entry.materiaId === sessao.materiaId);
    if (!matches.length) return -1;

    const pending = matches.find(({ entry }) =>
      entry.status !== 'done' &&
      entry.status !== 'skipped' &&
      Math.max(0, parseInt(entry.targetSeconds, 10) || 0) > 0 &&
      Math.max(0, entry.remainingSeconds == null ? parseInt(entry.targetSeconds, 10) || 0 : parseInt(entry.remainingSeconds, 10) || 0) > 0
    );
    return (pending || matches[0]).idx;
  },

  _nextCicloPendingIndex(entries, fromIndex) {
    const firstPendingIdx = this._firstCicloPendingIndex(entries);
    if (firstPendingIdx >= 0) return firstPendingIdx;
    return Math.max(0, Math.min(fromIndex, Math.max(entries.length - 1, 0)));
  },

  _logCicloStat(concursoId, entry, data) {
    const key = concursoId ? `ct_ciclo_stats_${concursoId}` : '';
    if (!key) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch { list = []; }
    list.push({
      id: `cycle_stat_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      data: this._normalizeDateString(data),
      criadoEm: new Date().toISOString(),
      concursoId,
      ...entry
    });
    localStorage.setItem(key, JSON.stringify(list));
  },

  _syncCicloSessao(sessao) {
    if (!sessao || sessao.skipCycleSync || !sessao.concursoId || !sessao.materiaId) return;
    const dur = Math.max(0, parseInt(sessao.duracaoSegundos, 10) || 0);
    const metricasSessao = this.limparMetricasSessao(sessao.metricas);
    const temMetricas = Object.keys(metricasSessao).length > 0;
    if (!dur && !temMetricas) return;

    const raw = this._readCiclo(sessao.concursoId);
    if (!raw || !raw.entries.length) return;
    if (sessao.id && raw.sessionHistory.some(s => s.id === sessao.id || s.sessaoId === sessao.id)) return;

    const idx = this._findCicloEntryIndex(raw, sessao);
    if (idx < 0) return;

    const entry = raw.entries[idx];
    const target = Math.max(0, parseInt(entry.targetSeconds, 10) || 0);
    const skippedRemaining = Math.max(0, parseInt(entry.skippedSeconds || entry.lastPendingSeconds, 10) || 0);
    const beforeRemaining = entry.status === 'skipped'
      ? (skippedRemaining || target)
      : Math.max(0, entry.remainingSeconds == null ? target : parseInt(entry.remainingSeconds, 10) || 0);
    const wasDone = entry.status === 'done';
    const afterRemaining = entry.status === 'done'
      ? 0
      : Math.max(0, beforeRemaining - dur);

    if (dur > 0 && target > 0 && entry.status !== 'done') {
      if (entry.status === 'skipped') {
        entry.skippedSeconds = afterRemaining;
        entry.lastPendingSeconds = afterRemaining;
        entry.remainingSeconds = 0;
        entry.status = afterRemaining === 0 ? 'done' : 'skipped';
      } else {
        entry.remainingSeconds = afterRemaining;
        entry.status = afterRemaining === 0 ? 'done' : 'pending';
        entry.skippedSeconds = 0;
        entry.lastPendingSeconds = afterRemaining === 0 ? 0 : Math.max(0, parseInt(entry.lastPendingSeconds, 10) || 0);
      }
      entry.updatedAt = new Date().toISOString();
      if (afterRemaining === 0) raw.currentIndex = this._nextCicloPendingIndex(raw.entries, idx);
    }

    raw.currentItemId = raw.entries[raw.currentIndex] ? raw.entries[raw.currentIndex].id : '';
    raw.sessionHistory.push({
      id: sessao.id || `cyc_sess_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      sessaoId: sessao.id || null,
      itemId: entry.id,
      nome: this._cicloEntryNome(entry, sessao),
      duracao: dur,
      ts: Date.now(),
      data: sessao.data || this._today(),
      horaInicio: sessao.horaInicio || new Date().toISOString(),
      origem: sessao.origem || 'sessao',
      metricas: metricasSessao
    });

    if (!wasDone && entry.status === 'done' && target > 0) {
      this._logCicloStat(sessao.concursoId, {
        materiaId: entry.materiaId || sessao.materiaId,
        materiaNome: this._cicloEntryNome(entry, sessao),
        targetSeconds: target,
        studiedSeconds: target,
        skippedSeconds: 0,
        concluida: true,
        round: Math.max(1, parseInt(raw.round, 10) || 1),
        origem: 'sessao_estudo'
      }, sessao.data);
    }

    this._writeCiclo(sessao.concursoId, raw);
  },

  _refundCicloSessao(sessao) {
    if (!sessao || !sessao.concursoId || !sessao.materiaId) return;
    const dur = Math.max(0, parseInt(sessao.duracaoSegundos, 10) || 0);
    const metricasSessao = this.limparMetricasSessao(sessao.metricas);
    if (!dur && Object.keys(metricasSessao).length === 0) return;

    const raw = this._readCiclo(sessao.concursoId);
    if (!raw || !raw.entries.length) return;
    const histIdx = raw.sessionHistory.findIndex(s => s.id === sessao.id || s.sessaoId === sessao.id);
    if (histIdx < 0) return;
    const hist = raw.sessionHistory[histIdx];
    const idx = raw.entries.findIndex(entry => entry.id === hist.itemId);
    if (idx < 0) return;

    const entry = raw.entries[idx];
    if (dur > 0) {
      const target = Math.max(0, parseInt(entry.targetSeconds, 10) || 0);
      const current = Math.max(0, entry.remainingSeconds == null ? 0 : parseInt(entry.remainingSeconds, 10) || 0);
      entry.remainingSeconds = Math.min(target, current + dur);
      if (entry.remainingSeconds > 0 && target > 0) {
        entry.status = 'pending';
        raw.currentIndex = idx;
        raw.currentItemId = entry.id;
      }
      entry.updatedAt = new Date().toISOString();
    }
    raw.sessionHistory.splice(histIdx, 1);
    this._writeCiclo(sessao.concursoId, raw);
  },
  registrarSessao(dados) {
    // dados: { concursoId, materiaId, duracaoSegundos, origem? }
    const list = this._get('ct_sessoes');
    const dataSessao = this._normalizeDateString(dados && dados.data);
    const metricas = this.limparMetricasSessao(dados && dados.metricas);
    const novaSessao = { id: this._id(), data: dataSessao, horaInicio: new Date().toISOString(), origem: 'manual', ...dados, data: dataSessao };
    if (Object.keys(metricas).length > 0) novaSessao.metricas = metricas;
    else delete novaSessao.metricas;
    list.push(novaSessao);
    this._set('ct_sessoes', list);
    this._syncCicloSessao(novaSessao);
    this._emitDataUpdated('sessao:add', {
      concursoId: novaSessao.concursoId || null,
      materiaId: novaSessao.materiaId || null,
      topicoId: novaSessao.topicoId || null,
      subtopId: novaSessao.subtopId || novaSessao.subtopicoId || null,
      item: novaSessao
    });
    if (typeof this.queueAutoSave === 'function') {
      this.queueAutoSave('sessao-registrada', { delay: 1200, toast: true });
    }
    return novaSessao.id;
  },

  excluirSessao(id) {
    if (!id) return false;
    const list = this._get('ct_sessoes');
    const sessao = list.find(s => s.id === id);
    const next = list.filter(s => s.id !== id);
    if (next.length === list.length) return false;
    this._set('ct_sessoes', next);
    this._refundCicloSessao(sessao);
    this._emitDataUpdated('sessao:remove', {
      concursoId: sessao?.concursoId || null,
      materiaId: sessao?.materiaId || null,
      topicoId: sessao?.topicoId || null,
      subtopId: sessao?.subtopId || sessao?.subtopicoId || null,
      item: sessao || null
    });
    return true;
  },

  // Soma total de segundos de sessões
  atualizarSessao(id, dados = {}) {
    if (!id) return false;
    const list = this._get('ct_sessoes');
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return false;
    const anterior = { ...list[idx] };
    const data = this._normalizeDateString(dados.data || anterior.data);
    const duracaoSegundos = Math.max(0, parseInt(dados.duracaoSegundos, 10) || 0);
    const metricas = this.limparMetricasSessao(dados.metricas || dados);
    const atualizado = {
      ...anterior,
      ...dados,
      id: anterior.id,
      concursoId: dados.concursoId || anterior.concursoId,
      materiaId: dados.materiaId || anterior.materiaId,
      topicoId: dados.topicoId || anterior.topicoId,
      subtopId: dados.subtopId ?? dados.subtopicoId ?? anterior.subtopId ?? anterior.subtopicoId,
      data,
      horaInicio: dados.horaInicio || anterior.horaInicio || new Date().toISOString(),
      duracaoSegundos,
      updatedAt: new Date().toISOString()
    };
    if (Object.keys(metricas).length > 0) atualizado.metricas = metricas;
    else delete atualizado.metricas;

    let estavaNoCiclo = false;
    try {
      const rawCycle = this._readCiclo(anterior.concursoId);
      estavaNoCiclo = !!(rawCycle && Array.isArray(rawCycle.sessionHistory) &&
        rawCycle.sessionHistory.some(s => s.id === anterior.id || s.sessaoId === anterior.id));
    } catch {}
    if (estavaNoCiclo) this._refundCicloSessao(anterior);
    list[idx] = atualizado;
    this._set('ct_sessoes', list);
    if (estavaNoCiclo) this._syncCicloSessao(atualizado);
    this._emitDataUpdated('sessao:update', {
      concursoId: atualizado.concursoId || null,
      materiaId: atualizado.materiaId || null,
      topicoId: atualizado.topicoId || null,
      subtopId: atualizado.subtopId || atualizado.subtopicoId || null,
      antes: anterior,
      item: atualizado
    });
    if (typeof this.queueAutoSave === 'function') {
      this.queueAutoSave('sessao-editada', { delay: 1200, toast: false });
    }
    return true;
  },

  totalSegundos(sessoes) {
    return sessoes.reduce((acc, s) => acc + (s.duracaoSegundos || 0), 0);
  },

  // Formata segundos em "Xh Ym"
  formatarTempo(segundos) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
    return `${m}min`;
  },

  // ─────────────────────────────────────────
  // REVISÕES
  // ─────────────────────────────────────────

  getRevisoes() {
    return this._get('ct_revisoes');
  },

  _resolverAlvoRevisao(alvo) {
    if (!alvo) return { topico: null, subtopico: null, topicoId: null, subtopId: null };

    if (typeof alvo === 'object' && (alvo.topicoId || alvo.subtopId)) {
      let topico = alvo.topicoId ? this.getTopico(alvo.topicoId) : null;
      let subtopico = alvo.subtopId ? this.getSubtopico(alvo.subtopId) : null;

      if (!subtopico && !topico && alvo.topicoId) {
        subtopico = this.getSubtopico(alvo.topicoId);
        if (subtopico) topico = this.getTopico(subtopico.topicoId);
      }

      if (!topico && subtopico) topico = this.getTopico(subtopico.topicoId);

      return {
        topico,
        subtopico,
        topicoId: topico ? topico.id : (alvo.topicoId || null),
        subtopId: subtopico ? subtopico.id : null
      };
    }

    const topico = this.getTopico(alvo);
    if (topico) return { topico, subtopico: null, topicoId: topico.id, subtopId: null };

    const subtopico = this.getSubtopico(alvo);
    if (subtopico) {
      return {
        topico: this.getTopico(subtopico.topicoId),
        subtopico,
        topicoId: subtopico.topicoId || null,
        subtopId: subtopico.id
      };
    }

    return { topico: null, subtopico: null, topicoId: alvo, subtopId: null };
  },

  getContextoRevisao(revisao) {
    const alvo = this._resolverAlvoRevisao(revisao);
    const materia = alvo.topico ? this.getMateria(alvo.topico.materiaId) : null;
    return {
      ...alvo,
      materia,
      concursoId: alvo.topico?.concursoId || alvo.subtopico?.concursoId || materia?.concursoId || null,
      nome: alvo.subtopico?.nome || alvo.topico?.nome || '—'
    };
  },

  revisaoPertenceAoTopico(revisao, topicoId) {
    const ctx = this.getContextoRevisao(revisao);
    return ctx.topicoId === topicoId && !ctx.subtopId;
  },

  revisaoPertenceAoSubtopico(revisao, subtopId) {
    const ctx = this.getContextoRevisao(revisao);
    return ctx.subtopId === subtopId;
  },

  agendarRevisao(alvoId, data) {
    const alvo = this._resolverAlvoRevisao(alvoId);
    if (!alvo.topicoId && !alvo.subtopId) return;
    const list = this._get('ct_revisoes');
    // Marca revisões anteriores como concluídas/substituídas (preserva histórico)
    list.forEach(r => {
      const atual = this._resolverAlvoRevisao(r);
      if (atual.topicoId === alvo.topicoId && atual.subtopId === alvo.subtopId && !r.concluida) {
        r.concluida = true;
        r.substituida = true;
        r.substituidaEm = this._today();
      }
    });
    list.push({
      id: this._id(),
      topicoId: alvo.topicoId,
      subtopId: alvo.subtopId || null,
      data,
      concluida: false,
      agendadaEm: this._today()
    });
    this._set('ct_revisoes', list);
  },

  concluirRevisao(alvoId, proximaData) {
    const alvo = this._resolverAlvoRevisao(alvoId);
    const list = this._get('ct_revisoes');
    const idx = list.findIndex(r => {
      if (r.concluida) return false;
      const atual = this._resolverAlvoRevisao(r);
      return atual.topicoId === alvo.topicoId && atual.subtopId === alvo.subtopId;
    });
    if (idx >= 0) list[idx].concluida = true;
    this._set('ct_revisoes', list);
    if (proximaData) this.agendarRevisao(alvoId, proximaData);
  },

  excluirRevisao(revisaoId) {
    if (!revisaoId) return false;
    const list = this._get('ct_revisoes');
    const next = list.filter(r => r.id !== revisaoId);
    if (next.length === list.length) return false;
    this._set('ct_revisoes', next);
    return true;
  },

  // Classifica revis�es: atrasadas, hoje, futuras

  classificarRevisoes() {
    const hoje = this._today();
    const revisoes = this.getRevisoes().filter(r => !r.concluida);
    return {
      atrasadas: revisoes.filter(r => r.data < hoje),
      hoje:      revisoes.filter(r => r.data === hoje),
      futuras:   revisoes.filter(r => r.data > hoje),
    };
  },

  // ─────────────────────────────────────────
  // SIMULADOS
  // ─────────────────────────────────────────

  getSimulados(concursoId) {
    const all = this._get('ct_simulados');
    // Repair any simulados that lost their ID due to the bug
    let repaired = false;
    all.forEach(s => { if (!s.id) { s.id = this._id(); repaired = true; } });
    if (repaired) this._set('ct_simulados', all);
    return concursoId ? all.filter(s => s.concursoId === concursoId) : all;
  },

  saveSimulado(data) {
    const list = this._get('ct_simulados');
    if (!data.id) data.id = this._id(); // Ensure defined before finding
    const idx = list.findIndex(s => s.id === data.id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...data }; }
    else { list.push({ criadoEm: this._today(), ...data, id: data.id }); }
    this._set('ct_simulados', list);
  },

  getSimuladoPct(sim) {
    if (!sim || typeof sim !== 'object') return null;

    const parseOptionalNumber = value => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const acertosTotal = parseOptionalNumber(
      sim.acertosTotal ??
      sim?.desempenhoPainel?.totalAcertos
    );
    const questoesTotal = parseOptionalNumber(
      sim.questoesTotal ??
      sim?.desempenhoPainel?.totalQuestoes
    );

    if (acertosTotal != null && questoesTotal != null && questoesTotal > 0) {
      return Math.round((acertosTotal / questoesTotal) * 1000) / 10;
    }

    const pct = parseOptionalNumber(sim.pct);
    return pct != null ? pct : null;
  },

  ultimoSimulado(concursoId) {
    const sims = this.getSimulados(concursoId)
      .map(s => ({ ...s, _pctCalculado: this.getSimuladoPct(s) }))
      .filter(s => s._pctCalculado != null)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    if (!sims[0]) return null;
    return { ...sims[0], pct: sims[0]._pctCalculado };
  },

  // ─────────────────────────────────────────
  // IMPORTAR EDITAL (JSON)
  // ─────────────────────────────────────────

  importarEdital(json, concursoId) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const materias = data.materias || [];
      const materiasAtuais = this._get('ct_materias');
      const topicosAtuais = this._get('ct_topicos');
      const subtopicosAtuais = this._get('ct_subtopicos');
      let totalTopicos = 0;

      materias.forEach(mat => {
        // Se o ID for 'mat_XXX', ignoramos para forçar um novo ID único
        const materiaId = (mat.id && !mat.id.startsWith('mat_')) ? mat.id : this._id();
        materiasAtuais.push({
          id: materiaId,
          concursoId,
          nome: this._formatMateriaNome(mat.nome),
          ordem: mat.ordem || 0,
        });

        (mat.topicos || []).forEach((top, ti) => {
          const topicoId = (top.id && !top.id.startsWith('top_')) ? top.id : this._id();
          topicosAtuais.push({
            id: topicoId,
            materiaId,
            concursoId,
            nome: top.nome,
            ordem: ti,
            estudado: false,
            revisaoData: null,
          });
          totalTopicos++;

          (top.subtopicos || []).forEach((sub, si) => {
            const nomeSub = typeof sub === 'string' ? sub : sub && sub.nome;
            if (!nomeSub) return;
            subtopicosAtuais.push({
              id: (sub.id && !sub.id.startsWith('sub_')) ? sub.id : this._id(),
              topicoId,
              materiaId,
              concursoId,
              nome: nomeSub,
              ordem: si,
              estudado: false,
            });
          });
        });
      });
      this._set('ct_materias', materiasAtuais);
      this._set('ct_topicos', topicosAtuais);
      this._set('ct_subtopicos', subtopicosAtuais);
      return { ok: true, materias: materias.length, topicos: totalTopicos };
    } catch(e) {
      return { ok: false, erro: e.message };
    }
  },

  // ─────────────────────────────────────────

  importarMateriaJson(json, concursoId) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const materias = Array.isArray(data)
        ? data
        : Array.isArray(data.materias)
          ? data.materias
          : data.materia
            ? [data.materia]
            : [data];
      const validas = materias.filter(m => m && m.nome);
      if (!validas.length) throw new Error('Informe ao menos uma materia com nome.');

      const materiaIds = [];
      const materiasAtuais = this._get('ct_materias');
      const topicosAtuais = this._get('ct_topicos');
      const subtopicosAtuais = this._get('ct_subtopicos');
      let totalTopicos = 0;
      let totalSubtopicos = 0;
      validas.forEach((materia, mi) => {
        const materiaId = this._id();
        materiaIds.push(materiaId);
        materiasAtuais.push({
          id: materiaId,
          concursoId,
          nome: this._formatMateriaNome(materia.nome),
          ordem: materia.ordem != null ? materia.ordem : mi,
        });

        (materia.topicos || []).forEach((top, ti) => {
          if (!top || !top.nome) return;
          const topicoId = this._id();
          topicosAtuais.push({
            id: topicoId,
            materiaId,
            concursoId,
            nome: top.nome,
            ordem: top.ordem != null ? top.ordem : ti,
            estudado: false,
            revisaoData: null,
          });
          totalTopicos++;

          (top.subtopicos || []).forEach((sub, si) => {
            const nomeSub = typeof sub === 'string' ? sub : sub && sub.nome;
            if (!nomeSub) return;
            subtopicosAtuais.push({
              id: this._id(),
              topicoId,
              materiaId,
              concursoId,
              nome: nomeSub,
              ordem: sub && sub.ordem != null ? sub.ordem : si,
              estudado: false,
            });
            totalSubtopicos++;
          });
        });
      });

      this._set('ct_materias', materiasAtuais);
      this._set('ct_topicos', topicosAtuais);
      this._set('ct_subtopicos', subtopicosAtuais);
      return { ok: true, materiaId: materiaIds[0], materiaIds, materias: validas.length, topicos: totalTopicos, subtopicos: totalSubtopicos };
    } catch(e) {
      return { ok: false, erro: e.message };
    }
  },
  // SMART LINKING (Cross-Contest)
  // ─────────────────────────────────────────

  _flashDeckUrl(deckId) {
    return `dashboard.html#flashcards:${encodeURIComponent(deckId)}`;
  },

  _flashSrsInicial() {
    return {
      status: 'new',
      ease: 2.5,
      interval: 0,
      reviews: 0,
      lapses: 0,
      nextReview: null,
      lastReview: null,
    };
  },

  _getFlashDecks() {
    return this._get('ct_flashcard_decks');
  },

  _getFlashCards() {
    return this._get('ct_flashcards');
  },

  _collectFlashDeckDescendants(decks, rootIds) {
    const ids = new Set(rootIds || []);
    let changed = true;
    while (changed) {
      changed = false;
      decks.forEach(deck => {
        if (deck.parentId && ids.has(deck.parentId) && !ids.has(deck.id)) {
          ids.add(deck.id);
          changed = true;
        }
      });
    }
    return Array.from(ids);
  },

  _hasFlashcardsFor(type, sourceId) {
    const allDecks = this._getFlashDecks();
    const decks = allDecks.filter(d => d.sourceType === type && d.sourceId === sourceId);
    if (!decks.length) return 0;
    const deckIds = new Set(this._collectFlashDeckDescendants(allDecks, decks.map(d => d.id)));
    return this._getFlashCards().filter(card => deckIds.has(card.deckId)).length;
  },

  _ensureFlashDeck(kind, target, decks) {
    if (!target) return null;
    const cId = sessionStorage.getItem('ct_concurso_ativo') || target.concursoId;
    const now = new Date().toISOString();
    let parentId = null;
    let materiaId = target.materiaId || (kind === 'materia' ? target.id : null);
    let topicoId = target.topicoId || (kind === 'topico' ? target.id : null);
    let subtopicoId = kind === 'subtopico' ? target.id : null;

    if (kind === 'topico') {
      const materia = this.getMateria(target.materiaId);
      parentId = this._ensureFlashDeck('materia', materia, decks);
    } else if (kind === 'subtopico') {
      const topico = this.getTopico(target.topicoId);
      parentId = this._ensureFlashDeck('topico', topico, decks);
      topicoId = target.topicoId;
      materiaId = target.materiaId || (topico && topico.materiaId) || null;
    }

    let deck = decks.find(d => d.concursoId === cId && d.sourceType === kind && d.sourceId === target.id);
    if (deck) {
      deck.name = target.nome || deck.name;
      deck.parentId = parentId || null;
      deck.materiaId = materiaId || null;
      deck.topicoId = topicoId || null;
      deck.subtopicoId = subtopicoId || null;
      deck.updatedAt = now;
      return deck.id;
    }

    deck = {
      id: 'fcdeck_' + this._id(),
      concursoId: cId,
      name: target.nome || 'Flashcards',
      emoji: kind === 'materia' ? 'Books' : kind === 'topico' ? 'Stack' : 'Card',
      parentId: parentId || null,
      sourceType: kind,
      sourceId: target.id,
      materiaId: materiaId || null,
      topicoId: topicoId || null,
      subtopicoId: subtopicoId || null,
      order: target.ordem || 0,
      createdAt: now,
      updatedAt: now,
    };
    decks.push(deck);
    return deck.id;
  },

  _linkFlashDeck(target, kind, deckId, deckName) {
    if (!target || !deckId) return;
    const url = this._flashDeckUrl(deckId);
    const cadernos = Array.isArray(target.cadernos) ? target.cadernos.slice() : [];
    const exists = cadernos.some(item => String(item && item.rotulo || '').toUpperCase() === 'FLASH'
      && (item.deckId === deckId || item.url === url));
    if (!exists) {
      cadernos.push({
        id: 'fc_link_' + this._id(),
        rotulo: 'FLASH',
        nome: deckName || 'Flashcards',
        emoji: '🎴',
        url,
        deckId,
        createdAt: new Date().toISOString(),
      });
      target.cadernos = cadernos;
      if (kind === 'materia') this.saveMateria(target);
      else if (kind === 'topico') this.saveTopico(target);
      else this.saveSubtopico(target);
    }
  },

  _copyFlashcardsToDeck(sourceDeckIds, targetDeckId, targetConcursoId, cards) {
    const now = new Date().toISOString();
    const sourceSet = new Set(sourceDeckIds);
    const sourceCards = cards.filter(card => sourceSet.has(card.deckId));
    let copied = 0;

    sourceCards.forEach(card => {
      const originalId = card.originalFlashcardId || card.id;
      const exists = cards.some(existing => existing.deckId === targetDeckId
        && ((existing.originalFlashcardId || existing.id) === originalId));
      if (exists) return;

      const clone = {
        ...card,
        id: 'fc_' + this._id(),
        concursoId: targetConcursoId,
        deckId: targetDeckId,
        originalFlashcardId: originalId,
        copiedFromDeckId: card.deckId,
        srs: this._flashSrsInicial(),
        createdAt: now,
        updatedAt: now,
      };
      cards.push(clone);
      copied++;
    });

    return copied;
  },

  _copyFlashcardsBetweenTargets(sourceId, targetId, type) {
    const decks = this._getFlashDecks();
    const cards = this._getFlashCards();
    let source = null;
    let target = null;

    if (type === 'materia') {
      source = this.getMateria(sourceId);
      target = this.getMateria(targetId);
    } else if (type === 'topico') {
      source = this.getTopico(sourceId);
      target = this.getTopico(targetId);
    } else if (type === 'subtopico') {
      source = this.getSubtopico(sourceId);
      target = this.getSubtopico(targetId);
    }
    if (!source || !target) return { copied: 0, deckId: null };

    const sourceDecks = decks.filter(d => d.sourceType === type && d.sourceId === sourceId);
    if (!sourceDecks.length) return { copied: 0, deckId: null };

    const targetDeckId = this._ensureFlashDeck(type, target, decks);
    const targetConcursoId = sessionStorage.getItem('ct_concurso_ativo') || target.concursoId;
    const sourceDeckIds = this._collectFlashDeckDescendants(decks, sourceDecks.map(d => d.id));
    const copied = this._copyFlashcardsToDeck(sourceDeckIds, targetDeckId, targetConcursoId, cards);

    this._set('ct_flashcard_decks', decks);
    this._set('ct_flashcards', cards);
    this._linkFlashDeck(target, type, targetDeckId, sourceDecks[0].name || target.nome || 'Flashcards');
    return { copied, deckId: targetDeckId };
  },

  findMatches(name, currentConcursoId, type) {
    if (!name || name.length < 3) return [];

    const searchName = name.trim().toLowerCase();
    let candidates = [];

    const contests = this.getConcursos();
    const contestMap = {};
    contests.forEach(c => contestMap[c.id] = c.nome);

    if (type === 'materia') {
      const all = this._get('ct_materias');
      all.forEach(m => {
        if (m.concursoId !== currentConcursoId && m.nome.trim().toLowerCase() === searchName) {
          const flashcardsCount = this._hasFlashcardsFor('materia', m.id);
          if ((m.cadernos && m.cadernos.length > 0) || flashcardsCount > 0) {
            candidates.push({ ...m, flashcardsCount, contestName: contestMap[m.concursoId] || 'Outro Concurso' });
          }
        }
      });
    } else if (type === 'topico') {
      const all = this._get('ct_topicos');
      all.forEach(t => {
        if (t.concursoId !== currentConcursoId && t.nome.trim().toLowerCase() === searchName) {
          const flashcardsCount = this._hasFlashcardsFor('topico', t.id);
          if ((t.cadernos && t.cadernos.length > 0) || flashcardsCount > 0) {
            candidates.push({ ...t, flashcardsCount, contestName: contestMap[t.concursoId] || 'Outro Concurso' });
          }
        }
      });
    } else if (type === 'subtopico') {
      const all = this._get('ct_subtopicos');
      all.forEach(s => {
        if (s.concursoId !== currentConcursoId && s.nome.trim().toLowerCase() === searchName) {
          const flashcardsCount = this._hasFlashcardsFor('subtopico', s.id);
          if ((s.cadernos && s.cadernos.length > 0) || flashcardsCount > 0) {
            candidates.push({ ...s, flashcardsCount, contestName: contestMap[s.concursoId] || 'Outro Concurso' });
          }
        }
      });
    }

    return candidates;
  },

  importMaterials(targetId, sourceId, type) {
    let source;
    let flash = { copied: 0, deckId: null };
    if (type === 'materia') {
      source = this.getMateria(sourceId);
      const target = this.getMateria(targetId);
      if (source && target && source.cadernos) {
        target.cadernos = [...(target.cadernos || []), ...source.cadernos];
        this.saveMateria(target);
      }
      flash = this._copyFlashcardsBetweenTargets(sourceId, targetId, type);
    } else if (type === 'topico') {
      source = this.getTopico(sourceId);
      const target = this.getTopico(targetId);
      if (source && target && source.cadernos) {
        target.cadernos = [...(target.cadernos || []), ...source.cadernos];
        this.saveTopico(target);
      }
      flash = this._copyFlashcardsBetweenTargets(sourceId, targetId, type);
    } else if (type === 'subtopico') {
      source = this.getSubtopico(sourceId);
      const target = this.getSubtopico(targetId);
      if (source && target && source.cadernos) {
        target.cadernos = [...(target.cadernos || []), ...source.cadernos];
        this.saveSubtopico(target);
      }
      flash = this._copyFlashcardsBetweenTargets(sourceId, targetId, type);
    }
    return { ok: true, flashcardsCopiados: flash.copied || 0, deckId: flash.deckId || null };
  },

  // ESTATÍSTICAS GERAIS
  // ─────────────────────────────────────────

  estatisticasGerais(concursoIds) {
    // concursoIds: array de IDs a incluir. null = todos ativos com contarEstatisticas=true
    const concursos = this.getConcursos().filter(c =>
      concursoIds ? concursoIds.includes(c.id) : c.contarEstatisticas !== false
    );
    const ids = concursos.map(c => c.id);

    const todasMatsIdSet = new Set();
    ids.forEach(cid => {
      this.getMaterias(cid).forEach(m => todasMatsIdSet.add(m.id));
    });
    const matsArr = Array.from(todasMatsIdSet);

    const todasQuestoes = this.getQuestoes().filter(q => matsArr.includes(q.materiaId));
    const todasSessoes  = this.getSessoes().filter(s => matsArr.includes(s.materiaId));
    const todosTopicos  = this.getTopicos().filter(t => matsArr.includes(t.materiaId));
    const todosSimulados = this.getSimulados()
      .filter(s => ids.includes(s.concursoId))
      .map(s => ({ ...s, _pctCalculado: this.getSimuladoPct(s) }))
      .filter(s => s._pctCalculado != null);

    const stats = this.calcStats(todasQuestoes);
    const segundosTotais = this.totalSegundos(todasSessoes);
    const topicosEstudados = todosTopicos.filter(t => t.estudado).length;

    // Último simulado (mais recente)
    const ultimoSim = todosSimulados.sort((a,b) => b.criadoEm.localeCompare(a.criadoEm))[0];
    const mediaSimulados = todosSimulados.length > 0
      ? Math.round(todosSimulados.reduce((a,s) => a + s._pctCalculado, 0) / todosSimulados.length)
      : null;

    return {
      horasTotais: this.formatarTempo(segundosTotais),
      segundosTotais,
      questoesTotal: stats.resolvidas,
      taxaAcertos: stats.pct,
      topicosEstudados,
      totalTopicos: todosTopicos.length,
      ultimoSimulado: ultimoSim ? ultimoSim._pctCalculado : null,
      mediaSimulados,
      concursosAtivos: concursos.filter(c => !c.realizado).length,
      concursosRealizados: concursos.filter(c => c.realizado).length,
    };
  },

  // ─────────────────────────────────────────
  // BACKUP
  // ─────────────────────────────────────────

  // Auto-backup silencioso — chama API Python se disponível
  async _collectBackupLogos() {
    const logos = {};
    const concursos = this.getConcursos();

    for (const c of concursos) {
      if (!c || !c.id) continue;
      if (c.logoBase64) {
        logos[c.id] = c.logoBase64;
        continue;
      }
      if (window.pywebview && window.pywebview.api && c.logoPath) {
        try {
          const resp = await window.pywebview.api.get_logo_base64(c.id);
          if (resp && resp.ok && resp.base64) {
            logos[c.id] = `data:image/png;base64,${resp.base64}`;
          }
        } catch (e) {}
      }
    }

    return logos;
  },

  async autoBackup(options = {}) {
    if (_ctActiveSavePromise) return _ctActiveSavePromise;

    _ctActiveSavePromise = (async () => {
      const backup = await this._buildBackupPayload();
      const json = JSON.stringify(backup, null, 2);
      if (!window.pywebview || !window.pywebview.api) return { ok: false };

      return window.pywebview.api.salvar_backup(json, options.reason || 'salvo-manual').then(res => {
        if (res && res.ok) {
          this.setBackupNome(res.rotulo || 'Perfil Principal');
          this.markSavedState();
        }
        return res;
      });
    })().finally(() => {
      _ctActiveSavePromise = null;
    });

    return _ctActiveSavePromise;
  },

  async exportarBackup() {
    CT.toast('Salvando alterações do perfil atual...', '💾');
    const res = await this.autoBackup({ reason: 'salvo-manual' });
    if (res && res.ok) {
      CT.toast('Alterações salvas com backup de segurança!', '✅');
      return res;
    }
    if (res && !res.ok) {
      CT.toast('Erro ao salvar: ' + (res.motivo || 'desconhecido'), '❌');
    }
    return res;
  },

  async importarBackup(json, backupNome = 'Perfil Principal') {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const logos = (data.logos && typeof data.logos === 'object') ? data.logos : {};
      const concursos = (data.concursos || []).map(c => {
        const logoBase64 = logos[c.id] || c.logoBase64 || null;
        return logoBase64 ? { ...c, logoBase64, logoPath: null } : c;
      });

      this._clearTrackStorage();
      this._set('ct_concursos',  concursos);
      this._set('ct_materias',   data.materias   || []);
      this._set('ct_topicos',    data.topicos    || []);
      this._set('ct_subtopicos', data.subtopicos || []);
      this._set('ct_sessoes',    data.sessoes    || []);
      this._set('ct_questoes',   data.questoes   || []);
      this._set('ct_simulados',  data.simulados  || []);
      this._set('ct_revisoes',   data.revisoes   || []);
      this._set('ct_flashcard_decks', data.flashcard_decks || data.flashcardDecks || data.flashcardDecksV1 || []);
      this._set('ct_flashcards', data.flashcards || data.flashcardCards || data.flashcard_cards || []);
      this._set('ct_flashcard_log', data.flashcard_log || data.flashcardLog || []);
      // Restore cronograma keys
      if (data.crono && typeof data.crono === 'object') {
        Object.keys(data.crono).forEach(k => {
          localStorage.setItem(k, data.crono[k]);
        });
      }
      if (window.pywebview && window.pywebview.api) {
        for (const concurso of concursos) {
          if (!concurso.id || !concurso.logoBase64) continue;
          try {
            const resp = await window.pywebview.api.salvar_logo(concurso.id, concurso.logoBase64);
            if (resp && resp.ok) concurso.logoPath = resp.path;
          } catch (e) {}
        }
        this._set('ct_concursos', concursos);
      }
      try {
        sessionStorage.removeItem('ct_concurso_ativo');
        sessionStorage.removeItem('ct_materia_ativa');
      } catch (e) {}
      this.setBackupNome(backupNome || 'Perfil Principal');
      if (!localStorage.getItem('ct_profile_genero')) this.setProfileGenero('masculino');
      this.markSavedState();
      return { ok: true };
    } catch(e) {
      return { ok: false, erro: e.message };
    }
  },

  limparTudo() {
    ['ct_concursos','ct_materias','ct_topicos','ct_subtopicos',
     'ct_sessoes','ct_questoes','ct_simulados','ct_revisoes']
    .forEach(k => localStorage.removeItem(k));

    const extras = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ct_')) {
        extras.push(key);
      }
    }
    extras.forEach(k => localStorage.removeItem(k));
    this.setBackupNome('');
  },

  // ─────────────────────────────────────────
  // SINGLE CONCURSO: EXPORT & IMPORT
  // ─────────────────────────────────────────

  // <CT_DEV_TOOLS_EXPORT_CONCURSO>
  _cardExportFaixas() {
    return [
      { nome:'Faixa Branca', imagem:'assets/faixas/faixabranca.png', dias:0, questoes:0, sims80:0, cor:'#e8eaf2' },
      { nome:'Faixa Amarela', imagem:'assets/faixas/faixaamarela.png', dias:14, questoes:250, sims80:1, cor:'#f5c842' },
      { nome:'Faixa Vermelha', imagem:'assets/faixas/faixavermelha.png', dias:28, questoes:500, sims80:2, cor:'#f55a5a' },
      { nome:'Faixa Laranja', imagem:'assets/faixas/faixalaranja.png', dias:56, questoes:1000, sims80:3, cor:'#f5874a' },
      { nome:'Faixa Verde', imagem:'assets/faixas/faixaverde.png', dias:84, questoes:2000, sims80:4, cor:'#3ecf8e' },
      { nome:'Faixa Roxa', imagem:'assets/faixas/faixaroxa.png', dias:112, questoes:3000, sims80:5, cor:'#7c5cfc' },
      { nome:'Faixa Marrom', imagem:'assets/faixas/faixamarrom.png', dias:140, questoes:5000, sims80:6, cor:'#795548' },
      { nome:'Faixa Preta', imagem:'assets/faixas/faixapreta.png', dias:168, questoes:8000, sims80:7, cor:'#ffffff' }
    ];
  },

  _cardExportFaixa(concursoId, questoesStats) {
    const faixas = this._cardExportFaixas();
    const concurso = this.getConcurso(concursoId);
    const dias = this.getDiasSeguidosEstudo(concursoId);
    const sims80 = this.getSimulados(concursoId).filter(s => (s.pct || this.getSimuladoPct(s) || 0) >= 80).length;
    let idx = 0;
    for (let i = faixas.length - 1; i >= 0; i--) {
      if (dias >= faixas[i].dias || (questoesStats.resolvidas || 0) >= faixas[i].questoes || sims80 >= faixas[i].sims80) {
        idx = i;
        break;
      }
    }
    idx = this.aplicarBonusFaixaEdital(idx, concurso, faixas.length);
    return faixas[idx];
  },

  _cardExportMoney(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/(?:R\$\s*)?\d[\d.\s]*(?:,\d{1,2})?/i);
    if (!match) return raw;
    const amount = match[0].replace(/R\$/i, '').trim().replace(/\s+/g, '');
    const numeric = Number(amount.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numeric)) return match[0].trim();
    const formatted = numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const afterFirstValue = raw.slice(match.index + match[0].length);
    const hasAdditional = /\+|adicion|benef|aux[ií]lio|vale|gratifica/i.test(afterFirstValue);
    return 'R$ ' + formatted + (hasAdditional ? ' +...' : '');
  },

  _cardExportRoundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  },

  _cardExportFillRound(ctx, x, y, w, h, r, fill) {
    this._cardExportRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  },

  _cardExportStrokeRound(ctx, x, y, w, h, r, stroke, lineWidth = 1) {
    this._cardExportRoundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  },

  _cardExportFitText(ctx, text, x, y, maxWidth, font, fill, minSize = 14) {
    const match = String(font || '').match(/(\d+)px/);
    const originalSize = match ? parseInt(match[1], 10) : 18;
    let size = originalSize;
    let nextFont = font;
    ctx.font = nextFont;
    while (size > minSize && ctx.measureText(String(text || '')).width > maxWidth) {
      size -= 1;
      nextFont = String(font).replace(/\d+px/, size + 'px');
      ctx.font = nextFont;
    }
    let out = String(text || '');
    while (ctx.measureText(out).width > maxWidth && out.length > 4) out = out.slice(0, -2);
    if (out !== String(text || '')) out = out.replace(/\s+$/,'') + '...';
    ctx.font = nextFont;
    ctx.fillStyle = fill;
    ctx.fillText(out, x, y);
  },

  _cardExportWrapText(ctx, text, maxWidth) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return [];
    const words = value.split(' ');
    const lines = [];
    let line = '';
    const pushLongWord = (word) => {
      let chunk = '';
      for (const ch of word) {
        const test = chunk + ch;
        if (chunk && ctx.measureText(test).width > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = test;
        }
      }
      if (chunk) return chunk;
      return '';
    };

    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        return;
      }
      if (line) {
        lines.push(line);
        line = '';
      }
      if (ctx.measureText(word).width > maxWidth) line = pushLongWord(word);
      else line = word;
    });
    if (line) lines.push(line);
    return lines;
  },

  _cardExportDrawWrappedText(ctx, text, x, y, maxWidth, font, fill, lineHeight, maxLines = 0) {
    ctx.font = font;
    ctx.fillStyle = fill;
    const lines = this._cardExportWrapText(ctx, text, maxWidth);
    const drawn = maxLines > 0 ? lines.slice(0, maxLines) : lines;
    drawn.forEach((line, idx) => ctx.fillText(line, x, y + idx * lineHeight));
    return { lines: drawn.length, y: drawn.length ? y + (drawn.length - 1) * lineHeight : y };
  },

  _cardExportLoadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  },

  _cardExportDrawImageContain(ctx, img, x, y, w, h) {
    if (!img) return;
    const ratio = Math.min(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  },

  _cardExportDrawFaixaIcon(ctx, img, x, y, w, h, faixa) {
    if (!img) return;
    if (faixa && faixa.nome === 'Faixa Preta') {
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.75)';
      ctx.shadowBlur = Math.max(6, Math.round(w / 4));
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      this._cardExportDrawImageContain(ctx, img, x, y, w, h);
      ctx.restore();
      this._cardExportStrokeRound(ctx, x - 2, y - 2, w + 4, h + 4, Math.min(8, w / 2), 'rgba(255,255,255,0.42)', 1);
      return;
    }
    this._cardExportDrawImageContain(ctx, img, x, y, w, h);
  },

  _cardExportDrawImageCover(ctx, img, x, y, w, h) {
    if (!img) return;
    const ratio = Math.max(w / img.width, h / img.height);
    const dw = img.width * ratio;
    const dh = img.height * ratio;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  },

  _cardExportStripeColors(concurso) {
    if (concurso && concurso.resultado === 'aprovado') return ['#1a7a3a', '#3ecf8e', '#1a7a3a'];
    if (concurso && concurso.resultado === 'cr') return ['#ffd700', '#ffe55e', '#ffd700'];
    if (concurso && concurso.resultado === 'aguardando') return ['#e8eaf2', '#8b90a8', '#e8eaf2'];
    if (concurso && (concurso.resultado === 'reprovado' || concurso.resultado === 'eliminado')) return ['#f55a5a', '#c43030'];
    const dias = concurso ? this.diasRestantes(concurso) : null;
    if (dias != null && dias <= 7) return ['#f55a5a', '#c43030'];
    if (dias != null && dias <= 30) return ['#f5874a', '#ffd700'];
    return ['#4f8ef7', '#7c5cfc'];
  },

  async _cardExportLogoSource(concurso) {
    if (!concurso) return '';
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.get_logo_base64 === 'function') {
      try {
        const resp = await window.pywebview.api.get_logo_base64(concurso.id);
        if (resp && resp.ok && resp.base64) return 'data:image/png;base64,' + resp.base64;
      } catch(e) {}
    }
    return concurso.logoBase64 || concurso.logoPath || '';
  },

  async gerarImagemCardConcurso(id) {
    const c = this.getConcurso(id);
    if (!c) return { ok: false, motivo: 'concurso_nao_encontrado' };

    {
      const W = 376;
      const H = 269;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const materias = this.getMaterias(c.id);
      const topicos = this.getTopicos().filter(t => t.concursoId === c.id);
      const subtopicos = this.getSubtopicos().filter(s => s.concursoId === c.id);
      const topDone = topicos.filter(t => t.estudado).length;
      const subDone = subtopicos.filter(s => s.estudado).length;
      const totalUnits = topicos.length + subtopicos.length;
      const doneUnits = topDone + subDone;
      const progPct = totalUnits ? Math.round(doneUnits / totalUnits * 100) : 0;
      const segundos = this.totalSegundos(this.getSessoes({ concursoId: c.id }));
      const q = this.calcStats(this.getQuestoes({ concursoId: c.id }));
      const faixa = this._cardExportFaixa(c.id, q);
      const salario = this._cardExportMoney(c.salario);
      const logoImg = await this._cardExportLoadImage(await this._cardExportLogoSource(c));
      const faixaImg = await this._cardExportLoadImage(faixa.imagem);

      this._cardExportFillRound(ctx, 0, 0, W, H, 16, '#10141f');
      const stripeColors = this._cardExportStripeColors(c);
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      if (stripeColors.length === 3) {
        grad.addColorStop(0, stripeColors[0]);
        grad.addColorStop(0.5, stripeColors[1]);
        grad.addColorStop(1, stripeColors[2]);
      } else {
        grad.addColorStop(0, stripeColors[0]);
        grad.addColorStop(1, stripeColors[1]);
      }
      ctx.save();
      this._cardExportRoundRect(ctx, 0, 0, W, H, 16);
      ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 3);
      ctx.restore();
      this._cardExportStrokeRound(ctx, 0.5, 0.5, W - 1, H - 1, 16, 'rgba(79,142,247,0.55)', 1);

      const pad = 26;
      const logoX = pad;
      const logoY = 29;
      const logoSize = 105;
      this._cardExportFillRound(ctx, logoX, logoY, logoSize, logoSize, 20, '#1a1f2d');
      if (logoImg) {
        ctx.save();
        this._cardExportRoundRect(ctx, logoX, logoY, logoSize, logoSize, 20);
        ctx.clip();
        this._cardExportDrawImageCover(ctx, logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();
      } else {
        ctx.font = '50px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e8eaf2';
        ctx.fillText(c.logoEmoji || '🏛️', logoX + logoSize / 2, logoY + logoSize / 2);
      }

      const infoX = logoX + logoSize + 10;
      const infoW = 140;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const nomeDraw = this._cardExportDrawWrappedText(ctx, c.nome || 'Concurso', infoX, 48, infoW, '700 13px Inter, Arial, sans-serif', '#f1f4fb', 14, 2);
      const bancaY = nomeDraw.y + 16;
      const bancaDraw = this._cardExportDrawWrappedText(ctx, c.banca || 'Banca nao definida', infoX, bancaY, infoW, '800 12px Inter, Arial, sans-serif', '#aeb6cf', 13, 1);
      const cargoYStart = bancaDraw.y + 14;
      const cargoDraw = this._cardExportDrawWrappedText(ctx, c.cargo || '', infoX, cargoYStart, infoW, '700 12px Inter, Arial, sans-serif', '#f1f4fb', 12, 3);
      const salarioY = (cargoDraw.lines ? cargoDraw.y : cargoYStart - 12) + 13;
      if (salario) this._cardExportFitText(ctx, salario, infoX, salarioY, infoW, '800 11px Inter, Arial, sans-serif', '#9fb2d3', 8);

      ctx.textAlign = 'right';
      if (c.preEdital) {
        ctx.font = '800 12px Inter, Arial, sans-serif';
        ctx.fillStyle = '#8d73ff';
        ctx.fillText('PRÉ-EDITAL', W - 20, 61);
        ctx.font = '800 12px Inter, Arial, sans-serif';
        ctx.fillStyle = '#d7def1';
        ctx.fillText('🚀 coberto x' + (c.coberto || 0), W - 20, 79);
      } else {
        const dias = this.diasRestantes(c);
        ctx.font = '800 22px Inter, Arial, sans-serif';
        ctx.fillStyle = dias == null ? '#4f8ef7' : dias <= 7 ? '#f55a5a' : dias <= 30 ? '#f5874a' : '#4f8ef7';
        ctx.fillText(dias == null ? '-' : String(dias), W - 20, 58);
        ctx.font = '800 11px Inter, Arial, sans-serif';
        ctx.fillStyle = '#929bb7';
        ctx.fillText('DIAS /', W - 20, 73);
        ctx.fillText('PROVA', W - 20, 87);
      }

      const faixaY = Math.max(125, Math.min(140, salario ? salarioY + 13 : cargoYStart + 18));
      ctx.textAlign = 'left';
      if (faixaImg) this._cardExportDrawFaixaIcon(ctx, faixaImg, infoX, faixaY, 16, 16, faixa);
      ctx.font = '800 11px Inter, Arial, sans-serif';
      ctx.fillStyle = '#aeb6cf';
      ctx.fillText(String(faixa.nome || 'Faixa Branca').toUpperCase(), infoX + 22, faixaY + 13);

      const statY = 159;
      const statW = 103;
      const statH = 49;
      const statGap = 8;
      const stats = [
        { val: segundos > 0 ? this.formatarTempo(segundos) : '-', label: 'HORAS' },
        { val: q.resolvidas > 0 ? String(q.resolvidas) : '-', label: 'QUESTÕES' },
        { val: q.pct != null ? q.pct + '%' : '-', label: 'ACERTOS' }
      ];
      stats.forEach((st, i) => {
        const x = pad + i * (statW + statGap);
        this._cardExportFillRound(ctx, x, statY, statW, statH, 8, '#171d2b');
        ctx.textAlign = 'center';
        ctx.font = '800 12px Inter, Arial, sans-serif';
        ctx.fillStyle = st.val === '-' ? '#a1a6c2' : '#f1f4fb';
        ctx.fillText(st.val, x + statW / 2, statY + 18);
        ctx.font = '700 12px Inter, Arial, sans-serif';
        ctx.fillStyle = '#9099b5';
        ctx.fillText(st.label, x + statW / 2, statY + 36);
      });

      const progY = 230;
      ctx.textAlign = 'left';
      ctx.font = '700 12px Inter, Arial, sans-serif';
      ctx.fillStyle = '#aeb6cf';
      ctx.fillText('Progresso', pad, progY);
      ctx.font = '800 13px Inter, Arial, sans-serif';
      ctx.fillStyle = '#f1f4fb';
      ctx.fillText(doneUnits + ' / ' + totalUnits + ' (' + progPct + '%)', pad, progY + 15);

      ctx.fillStyle = '#10141f';
      ctx.fillRect(154, progY - 12, W - 170, 18);
      const drawProgressMetric = (label, value, x, y) => {
        ctx.font = '700 11px Inter, Arial, sans-serif';
        ctx.fillStyle = '#aeb6cf';
        ctx.fillText(label, x, y);
        const labelW = ctx.measureText(label).width;
        ctx.font = '800 11px Inter, Arial, sans-serif';
        ctx.fillStyle = '#f1f4fb';
        ctx.fillText(value, x + labelW + 4, y);
      };
      drawProgressMetric('Matérias', String(materias.length), 164, progY + 1);
      drawProgressMetric('Tópicos', String(totalUnits), 254, progY + 1);

      this._cardExportFillRound(ctx, pad, 260, W - pad * 2, 5, 3, '#1d2332');
      if (progPct > 0) this._cardExportFillRound(ctx, pad, 260, (W - pad * 2) * progPct / 100, 5, 3, grad);

      return { ok: true, dataUrl: canvas.toDataURL('image/png'), nome: c.nome || 'concurso' };
    }

    const canvas = document.createElement('canvas');
    const W = 740;
    const H = 548;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const materias = this.getMaterias(c.id);
    const topicos = this.getTopicos().filter(t => t.concursoId === c.id);
    const subtopicos = this.getSubtopicos().filter(s => s.concursoId === c.id);
    const topDone = topicos.filter(t => t.estudado).length;
    const subDone = subtopicos.filter(s => s.estudado).length;
    const totalUnits = topicos.length + subtopicos.length;
    const doneUnits = topDone + subDone;
    const progPct = totalUnits ? Math.round(doneUnits / totalUnits * 100) : 0;
    const segundos = this.totalSegundos(this.getSessoes({ concursoId: c.id }));
    const q = this.calcStats(this.getQuestoes({ concursoId: c.id }));
    const faixa = this._cardExportFaixa(c.id, q);
    const salario = this._cardExportMoney(c.salario);
    const logoImg = await this._cardExportLoadImage(await this._cardExportLogoSource(c));
    const faixaImg = await this._cardExportLoadImage(faixa.imagem);

    ctx.clearRect(0, 0, W, H);
    this._cardExportFillRound(ctx, 0, 0, W, H, 32, '#10141f');
    const stripeColors = this._cardExportStripeColors(c);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    if (stripeColors.length === 3) {
      grad.addColorStop(0, stripeColors[0]);
      grad.addColorStop(0.5, stripeColors[1]);
      grad.addColorStop(1, stripeColors[2]);
    } else {
      grad.addColorStop(0, stripeColors[0]);
      grad.addColorStop(1, stripeColors[1]);
    }
    ctx.save();
    this._cardExportRoundRect(ctx, 0, 0, W, H, 32);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 6);
    ctx.restore();
    this._cardExportStrokeRound(ctx, 1, 1, W - 2, H - 2, 32, 'rgba(79,142,247,0.55)', 2);

    const pad = 52;
    const logoSize = 210;
    const logoX = pad;
    const logoY = 58;
    this._cardExportFillRound(ctx, logoX, logoY, logoSize, logoSize, 40, '#1a1f2d');
    if (logoImg) {
      ctx.save();
      this._cardExportRoundRect(ctx, logoX, logoY, logoSize, logoSize, 40);
      ctx.clip();
      this._cardExportDrawImageCover(ctx, logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    } else {
      ctx.font = '100px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e8eaf2';
      ctx.fillText(c.logoEmoji || '🏛️', logoX + logoSize / 2, logoY + logoSize / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    const infoX = logoX + logoSize + 20;
    const infoW = 280;
    ctx.textBaseline = 'alphabetic';
    const nomeDraw = this._cardExportDrawWrappedText(ctx, c.nome || 'Concurso', infoX, 96, infoW, '700 28px Inter, Arial, sans-serif', '#f1f4fb', 30, 2);
    const bancaY = nomeDraw.y + 34;
    const bancaDraw = this._cardExportDrawWrappedText(ctx, c.banca || 'Banca nao definida', infoX, bancaY, infoW, '800 24px Inter, Arial, sans-serif', '#aeb6cf', 26, 1);
    const cargoYStart = bancaDraw.y + 30;
    const cargoDraw = this._cardExportDrawWrappedText(ctx, c.cargo || '', infoX, cargoYStart, infoW, '700 24px Inter, Arial, sans-serif', '#f1f4fb', 25, 3);
    const salarioY = (cargoDraw.lines ? cargoDraw.y : cargoYStart - 25) + 28;
    if (salario) this._cardExportFitText(ctx, salario, infoX, salarioY, infoW, '800 22px Inter, Arial, sans-serif', '#9fb2d3', 16);

    ctx.textAlign = 'right';
    if (c.preEdital) {
      ctx.font = '800 24px Inter, Arial, sans-serif';
      ctx.fillStyle = '#8d73ff';
      ctx.fillText('PRÉ-EDITAL', W - 40, 122);
      ctx.font = '800 24px Inter, Arial, sans-serif';
      ctx.fillStyle = '#d7def1';
      ctx.fillText('🚀 coberto x' + (c.coberto || 0), W - 40, 158);
    } else {
      const dias = this.diasRestantes(c);
      ctx.font = '800 44px Inter, Arial, sans-serif';
      ctx.fillStyle = dias == null ? '#4f8ef7' : dias <= 7 ? '#f55a5a' : dias <= 30 ? '#f5874a' : '#4f8ef7';
      ctx.fillText(dias == null ? '-' : String(dias), W - 40, 116);
      ctx.font = '800 22px Inter, Arial, sans-serif';
      ctx.fillStyle = '#929bb7';
      ctx.fillText('DIAS /', W - 40, 146);
      ctx.fillText('PROVA', W - 40, 174);
    }
    ctx.textAlign = 'left';

    const faixaY = Math.max(250, Math.min(282, salario ? salarioY + 28 : cargoYStart + 36));
    if (faixaImg) this._cardExportDrawFaixaIcon(ctx, faixaImg, infoX, faixaY, 32, 32, faixa);
    ctx.font = '800 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#aeb6cf';
    ctx.fillText(String(faixa.nome || 'Faixa Branca').toUpperCase(), infoX + 44, faixaY + 25);

    const statY = 318;
    const statW = 206;
    const statH = 98;
    const statGap = 16;
    const stats = [
      { val: segundos > 0 ? this.formatarTempo(segundos) : '-', label: 'HORAS' },
      { val: q.resolvidas > 0 ? String(q.resolvidas) : '-', label: 'QUESTÕES' },
      { val: q.pct != null ? q.pct + '%' : '-', label: 'ACERTOS' }
    ];
    stats.forEach((st, i) => {
      const x = pad + i * (statW + statGap);
      this._cardExportFillRound(ctx, x, statY, statW, statH, 16, '#171d2b');
      ctx.textAlign = 'center';
      ctx.font = '800 24px Inter, Arial, sans-serif';
      ctx.fillStyle = st.val === '-' ? '#a1a6c2' : '#f1f4fb';
      ctx.fillText(st.val, x + statW / 2, statY + 36);
      ctx.font = '700 24px Inter, Arial, sans-serif';
      ctx.fillStyle = '#9099b5';
      ctx.fillText(st.label, x + statW / 2, statY + 72);
    });
    ctx.textAlign = 'left';

    const progY = 462;
    ctx.font = '700 24px Inter, Arial, sans-serif';
    ctx.fillStyle = '#aeb6cf';
    ctx.fillText('Progresso', pad, progY);
    ctx.font = '800 26px Inter, Arial, sans-serif';
    ctx.fillStyle = '#f1f4fb';
    ctx.fillText(doneUnits + ' / ' + totalUnits + ' (' + progPct + '%)', pad, progY + 28);

    ctx.font = '700 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#aeb6cf';
    ctx.fillText('Matérias', 356, progY + 3);
    ctx.font = '800 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#f1f4fb';
    ctx.fillText(String(materias.length), 456, progY + 3);
    ctx.font = '700 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#aeb6cf';
    ctx.fillText('Tópicos', 504, progY + 3);
    ctx.font = '800 22px Inter, Arial, sans-serif';
    ctx.fillStyle = '#f1f4fb';
    ctx.fillText(String(totalUnits), 590, progY + 3);

    this._cardExportFillRound(ctx, pad, 520, W - pad * 2, 10, 5, '#1d2332');
    if (progPct > 0) this._cardExportFillRound(ctx, pad, 520, (W - pad * 2) * progPct / 100, 10, 5, grad);

    return { ok: true, dataUrl: canvas.toDataURL('image/png'), nome: c.nome || 'concurso' };
  },

  async exportarImagemCardConcurso(id) {
    const generated = await this.gerarImagemCardConcurso(id);
    if (!generated || !generated.ok) {
      alert('Nao foi possivel gerar a imagem do card: ' + ((generated && generated.motivo) || 'erro desconhecido'));
      return generated;
    }
    const fileName = ('card_premium_' + generated.nome).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'card_premium_concurso';
    if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.salvar_imagem_png === 'function') {
      const res = await window.pywebview.api.salvar_imagem_png(fileName, generated.dataUrl);
      if (res && res.ok) alert('✅ Imagem do card exportada com sucesso!\nSalva em: ' + res.caminho);
      else if (res && res.motivo !== 'cancelado') alert('❌ Erro ao exportar imagem: ' + res.motivo);
      return res;
    }
    const a = document.createElement('a');
    a.href = generated.dataUrl;
    a.download = fileName + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true };
  },

  async exportarConcurso(id, options = {}) {
    const c = this.getConcurso(id);
    if (!c) return;
    const includeLinks = options.includeLinks !== false;

    const sanitizeCadernos = itens => {
      if (!Array.isArray(itens)) return [];
      if (!includeLinks) return [];
      return itens
        .map(item => this.sanitizeMaterialLinkItem(item))
        .filter(Boolean);
    };

    // Obter logo se existir no disco
    let logoData = c.logoBase64 || null;
    if (window.pywebview && window.pywebview.api) {
        try {
            const resp = await window.pywebview.api.get_logo_base64(id);
            if (resp && resp.ok) logoData = `data:image/png;base64,${resp.base64}`;
        } catch(e) {}
    }

    const materias = this.getMaterias(id).map(m => {
      const tAll = this.getTopicos(m.id).map(t => {
        const sAll = (this._get('ct_subtopicos') || []).filter(s => s.topicoId === t.id).map(s => {
            const { id, topicoId, concursoId, estudado, estudadoEm, ...sRest } = s;
            return { ...sRest, cadernos: sanitizeCadernos(sRest.cadernos) };
        });
            const { id, materiaId, concursoId, estudado, estudadoEm, revisaoData, logEstudo, _esperandoReset, ...tRest } = t;
            return { ...tRest, cadernos: sanitizeCadernos(tRest.cadernos), subtopicos: sAll };
        });
        const { id, concursoId, ...mRest } = m;
        return { id, ...mRest, cadernos: sanitizeCadernos(mRest.cadernos), topicos: tAll };
    });
    const simulados = this.getSimulados(id).map(sim => {
      const { id: simId, concursoId, ...simData } = sim;
      return { ...simData };
    });

    const concursoTemplate = {
      nome: c.nome || '',
      cargo: c.cargo || '',
      salario: c.salario || '',
      banca: c.banca || '',
      logoEmoji: c.logoEmoji || null,
      logoBase64: logoData,
      dataProva: c.dataProva || null,
      localProva: c.localProva || '',
      linkEdital: c.linkEdital || '',
      preEdital: !!c.preEdital,
      pontuacaoMax: c.pontuacaoMax ?? null,
      vagas: c.vagas ?? null,
      obs: c.obs || '',
    };

    const exportData = {
      type: 'track_concursos_template_export',
      version: '2.0',
      templateKind: 'contest',
      rights: {
        copyright: 'Copyright (c) 2026 Michel Araujo. Todos os direitos reservados.',
        licenseType: 'uso-pessoal-nao-comercial',
        allowPersonalUse: true,
        allowCommercialUse: false,
        allowModification: false,
        allowRedistribution: false,
        notice: 'Este arquivo foi gerado pelo Track Concursos para uso pessoal e nao comercial. Nao e permitida sua revenda, redistribuicao ou modificacao sem autorizacao previa do autor.'
      },
      exportOptions: {
        includeLinks
      },
      concurso: concursoTemplate,
      materias: materias,
      simulados: simulados,
      estrutura: {
          cronoWeekly: localStorage.getItem(`ct_crono_${id}`),
          cronoMats: localStorage.getItem(`ct_crono_mats_${id}`),
          cronoMode: localStorage.getItem(`ct_crono_modo_${id}`),
          ciclo: localStorage.getItem(`ct_ciclo_${id}`),
          configProva: localStorage.getItem(`ct_config_prova_${id}`)
      }
    };

    if (window.pywebview && window.pywebview.api) {
        const jsonStr = JSON.stringify(exportData, null, 2);
        const fileName = ('template_' + (c.nome || 'concurso')).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        window.pywebview.api.salvar_json_concurso(fileName, jsonStr).then(res => {
            if (res && res.ok) {
                alert('✅ Template do edital exportado com sucesso!\nSalvo em: ' + res.caminho);
            } else if (res && res.motivo !== 'cancelado') {
                alert('❌ Erro ao exportar template: ' + res.motivo);
            }
        });
    } else {
        const json = JSON.stringify(exportData, null, 2);
        const a = document.createElement('a');
        a.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(json));
        a.setAttribute('download', 'Track_Concursos_template_' + (c.nome||'concurso') + '.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
  },
  // </CT_DEV_TOOLS_EXPORT_CONCURSO>

  importarConcurso(jsonStr) {
    try {
        const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
        if (!['concursotrack_single_export', 'track_concursos_single_export', 'track_concursos_template_export'].includes(data.type)) throw new Error('Formato de arquivo inválido.');

        const parseMaybe = (value, fallback) => {
          if (!value) return fallback;
          if (typeof value === 'string') {
            try { return JSON.parse(value); } catch (e) { return fallback; }
          }
          return value;
        };
        const sourceMaterias = Array.isArray(data.materias) ? data.materias : [];
        const sourceSimulados = Array.isArray(data.simulados) ? data.simulados : [];
        const sanitizeImportedCadernos = itens => (Array.isArray(itens) ? itens : [])
          .map(item => this.sanitizeMaterialLinkItem(item))
          .filter(Boolean);
        const materiaBySourceId = {};
        const materiaNameMap = {};
        const normalizeMateriaName = value => String(value || '').trim().toLowerCase();
        const isVirtualMateriaId = value => typeof value === 'string' && value.startsWith('v-');
        const remapMetricMap = sourceMap => {
          const targetMap = {};
          if (!sourceMap || typeof sourceMap !== 'object') return targetMap;
          Object.entries(sourceMap).forEach(([sourceId, value]) => {
            const remappedId = resolveImportedMateriaId({ sourceId });
            if (remappedId) targetMap[remappedId] = value;
          });
          return targetMap;
        };
        sourceMaterias.forEach(m => {
          if (m && m.id) materiaBySourceId[m.id] = m;
        });

        // 1. Salva o concurso
        const cData = data.concurso || {};
        const normalizeDateOnly = value => {
          const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
          return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
        };
        const importedDataProva = normalizeDateOnly(cData.dataProva);
        const importedPastPostEdital = !!(
          importedDataProva &&
          !cData.preEdital &&
          !cData.realizado &&
          importedDataProva < this._today()
        );
        const newCId = this._id();
        const materiaIdMap = {};
        const resolveImportedMateriaId = ({ sourceId, nome } = {}) => {
          if (isVirtualMateriaId(sourceId)) return sourceId;
          if (sourceId && materiaIdMap[sourceId]) return materiaIdMap[sourceId];
          const fallbackName = nome || (sourceId && materiaBySourceId[sourceId] ? materiaBySourceId[sourceId].nome : '');
          const normalizedName = normalizeMateriaName(fallbackName);
          if (normalizedName && materiaNameMap[normalizedName]) return materiaNameMap[normalizedName];
          return '';
        };
        const editalLinkInfo = this._safeMaterialUrlInfo(cData.linkEdital);
        const novoConcurso = {
            id: newCId,
            criadoEm: this._today(),
            nome: cData.nome || 'Novo Concurso',
            cargo: cData.cargo || '',
            salario: cData.salario || '',
            banca: cData.banca || '',
            logoBase64: cData.logoBase64 || null,
            logoEmoji: cData.logoEmoji || null,
            logoPath: null,
            dataProva: importedPastPostEdital ? null : (importedDataProva || cData.dataProva || null),
            localProva: cData.localProva || '',
            linkEdital: editalLinkInfo.ok ? editalLinkInfo.url : '',
            preEdital: importedPastPostEdital || !!cData.preEdital,
            pontuacaoMax: cData.pontuacaoMax ?? null,
            vagas: cData.vagas ?? null,
            realizado: false,
            contarEstatisticas: true,
            resultado: null,
            colocacao: null,
            totalCand: null,
            certas: null,
            erradas: null,
            branco: null,
            pontuacao: null,
            notaCorte: null,
            redacao: null,
            obs: cData.obs || '',
            coberto: 0,
            cobertoPre: 0,
            nomeado: { ativo: false },
            _esperandoReset: false
        };
        const listC = this.getConcursos();
        listC.push(novoConcurso);
        this._set('ct_concursos', listC);

        // 2. Importa Matérias, Tópicos e Subtópicos em cascata
        sourceMaterias.forEach(m => {
            const oldMId = m.id;
            const newMId = this._id();
            if (oldMId) materiaIdMap[oldMId] = newMId;
            const normalizedName = normalizeMateriaName(m.nome);
            if (normalizedName) materiaNameMap[normalizedName] = newMId;
            const { topicos, ...mData } = m;
            this.saveMateria({ ...mData, cadernos: sanitizeImportedCadernos(mData.cadernos), id: newMId, concursoId: newCId });

            (topicos || []).forEach(t => {
                const newTId = this._id();
                const { subtopicos, estudado, estudadoEm, revisaoData, logEstudo, _esperandoReset, ...tData } = t;
                // Força reset de estudos na importação
                this.saveTopico({
                    ...tData,
                    cadernos: sanitizeImportedCadernos(tData.cadernos),
                    id: newTId,
                    materiaId: newMId,
                    concursoId: newCId,
                    estudado: false,
                    estudadoEm: null,
                    revisaoData: null,
                    _esperandoReset: false
                });

                (subtopicos || []).forEach(s => {
                    const newSId = this._id();
                    const listS = this._get('ct_subtopicos') || [];
                    const { estudado, estudadoEm, ...sData } = s;
                    listS.push({ ...sData, cadernos: sanitizeImportedCadernos(sData.cadernos), id: newSId, topicoId: newTId, materiaId: newMId, concursoId: newCId, estudado: false, estudadoEm: null });
                    this._set('ct_subtopicos', listS);
                });
            });
        });

        // 3. Estruturas auxiliares do concurso
        const estrutura = data.estrutura || data.crono || {};
        if (estrutura.cronoWeekly) {
            localStorage.setItem(`ct_crono_${newCId}`, typeof estrutura.cronoWeekly === 'string'
              ? estrutura.cronoWeekly
              : JSON.stringify(estrutura.cronoWeekly));
        }

        const cronoMats = parseMaybe(estrutura.cronoMats || estrutura.mats, []);
        if (Array.isArray(cronoMats) && cronoMats.length) {
            const remappedMats = cronoMats.map(item => ({
              ...item,
              materiaId: resolveImportedMateriaId({ sourceId: item.materiaId, nome: item.nome })
            }));
            localStorage.setItem(`ct_crono_mats_${newCId}`, JSON.stringify(remappedMats));

            const sugestoes = {};
            remappedMats.forEach(item => {
              if (item && item.nome && item.cor) sugestoes[item.nome] = item.cor;
            });
            localStorage.setItem(`ct_crono_sugestoes_${newCId}`, JSON.stringify(sugestoes));
        }

        if (estrutura.cronoMode) {
            localStorage.setItem(`ct_crono_modo_${newCId}`, estrutura.cronoMode);
        }

        const ciclo = parseMaybe(estrutura.ciclo, null);
        if (ciclo && Array.isArray(ciclo.entries)) {
            const entries = ciclo.entries.map(entry => ({
              ...entry,
              materiaId: resolveImportedMateriaId({ sourceId: entry.materiaId, nome: entry.nome }),
              remainingSeconds: Math.max(0, parseInt(entry.targetSeconds, 10) || 0),
              status: 'pending',
              skippedSeconds: 0,
              lastPendingSeconds: 0,
              updatedAt: ''
            }));
            const firstPendingIdx = entries.findIndex(entry => (parseInt(entry.targetSeconds, 10) || 0) > 0);
            localStorage.setItem(`ct_ciclo_${newCId}`, JSON.stringify({
              round: 1,
              currentIndex: firstPendingIdx >= 0 ? firstPendingIdx : 0,
              currentItemId: firstPendingIdx >= 0 ? entries[firstPendingIdx].id : '',
              sessionHistory: [],
              entries
            }));
        }

        const configProva = parseMaybe(estrutura.configProva, null);
        if (configProva && Array.isArray(configProva.groups)) {
            const grupos = configProva.groups.map(group => {
              if (!Array.isArray(group.items)) return group;
              const items = group.items
                .map(item => {
                  const remappedId = resolveImportedMateriaId({ sourceId: item.id });
                  return remappedId ? { ...item, id: remappedId } : null;
                })
                .filter(Boolean);
              return { ...group, items };
            });
            localStorage.setItem(`ct_config_prova_${newCId}`, JSON.stringify({ ...configProva, groups: grupos }));
        }

        // 4. Simulados do template
        if (sourceSimulados.length) {
            const simuladosImportados = this.getSimulados();
            sourceSimulados.forEach(sourceSim => {
              const sim = { ...sourceSim };
              sim.id = this._id();
              sim.concursoId = newCId;
              sim.criadoEm = sim.criadoEm || this._today();

              if (sim.notasMaterias && typeof sim.notasMaterias === 'object') {
                sim.notasMaterias = remapMetricMap(sim.notasMaterias);
              }

              if (sim.desempenhoPainel && typeof sim.desempenhoPainel === 'object') {
                const snap = { ...sim.desempenhoPainel };
                if (Array.isArray(snap.items)) {
                  snap.items = snap.items.map(item => {
                    const remappedId = resolveImportedMateriaId({ sourceId: item.materiaId, nome: item.nome });
                    return remappedId ? { ...item, materiaId: remappedId } : item;
                  });
                }
                if (Array.isArray(snap.materias)) {
                  snap.materias = snap.materias.map(item => {
                    const remappedId = resolveImportedMateriaId({ sourceId: item.materiaId, nome: item.nome });
                    return remappedId ? { ...item, materiaId: remappedId } : item;
                  });
                }
                snap.notasMaterias = remapMetricMap(snap.notasMaterias);
                sim.desempenhoPainel = snap;
              }

              simuladosImportados.push(sim);
            });
            this._set('ct_simulados', simuladosImportados);
        }

        // 5. Logo se houver Base64
        if (novoConcurso.logoBase64 && window.pywebview && window.pywebview.api) {
            window.pywebview.api.salvar_logo(newCId, novoConcurso.logoBase64).then(res => {
                if (res && res.ok) {
                    const list = this.getConcursos();
                    const idx = list.findIndex(x => x.id === newCId);
                    if (idx >= 0) {
                        list[idx].logoPath = res.path;
                        this._set('ct_concursos', list);
                    }
                }
            });
        }

        return {
          ok: true,
          id: newCId,
          convertedPastPostEdital: importedPastPostEdital,
          originalDataProva: importedPastPostEdital ? importedDataProva : null
        };
    } catch(e) {
        return { ok: false, erro: e.message };
    }
  },

  fusionarConcursos(origemId, destinoId) {
    if (!origemId || !destinoId || origemId === destinoId) return { ok: false, erro: 'IDs inválidos para fusão.' };

    const cOrigem = this.getConcurso(origemId);
    const cDestino = this.getConcurso(destinoId);
    if (cOrigem && cDestino) {
        cDestino.cobertoPre = (cDestino.cobertoPre || 0) + (cOrigem.coberto || 0);
        cDestino.origemPreNome = cOrigem.nome;
        if (Array.isArray(cOrigem.coberturaHistorico) && cOrigem.coberturaHistorico.length) {
          const existentes = Array.isArray(cDestino.coberturaHistorico) ? cDestino.coberturaHistorico : [];
          cDestino.coberturaHistorico = existentes.concat(cOrigem.coberturaHistorico.map(item => ({
            ...item,
            origemConcursoId: origemId,
            origemConcursoNome: cOrigem.nome || '',
            modo: item.modo || 'pre_edital'
          })));
        }
        this.saveConcurso(cDestino);
    }

    const sAll = this._get('ct_sessoes') || [];
    let countS = 0;
    sAll.forEach(s => {
      if (s.concursoId === origemId) {
        s.concursoId = destinoId;
        countS++;
      }
    });
    this._set('ct_sessoes', sAll);

    const qAll = this._get('ct_questoes') || [];
    let countQ = 0;
    qAll.forEach(q => {
      if (q.concursoId === origemId) {
        q.concursoId = destinoId;
        countQ++;
      }
    });
    this._set('ct_questoes', qAll);

    this.getMaterias(origemId).forEach(m => {
      this.vincularMateria(m.id, destinoId);
    });

    // ─────────────────────────────────────────
    // PRESERVAR E MESCLAR MÉTRICAS DO CICLO
    // ─────────────────────────────────────────
    
    let statsOrigem = [];
    let statsDestino = [];
    try { statsOrigem = JSON.parse(localStorage.getItem('ct_ciclo_stats_' + origemId) || '[]'); } catch(e){}
    try { statsDestino = JSON.parse(localStorage.getItem('ct_ciclo_stats_' + destinoId) || '[]'); } catch(e){}
    if (statsOrigem.length > 0) {
      statsOrigem.forEach(s => s.concursoId = destinoId);
      const statsFundido = statsDestino.concat(statsOrigem);
      localStorage.setItem('ct_ciclo_stats_' + destinoId, JSON.stringify(statsFundido));
    }

    let faixaOrigem = [];
    let faixaDestino = [];
    try { faixaOrigem = JSON.parse(localStorage.getItem('ct_faixa_hist_' + origemId) || '[]'); } catch(e){}
    try { faixaDestino = JSON.parse(localStorage.getItem('ct_faixa_hist_' + destinoId) || '[]'); } catch(e){}
    if (faixaOrigem.length > 0) {
      faixaOrigem.forEach(item => item.concursoId = destinoId);
      const faixaMap = {};
      faixaDestino.concat(faixaOrigem).forEach(item => {
        if (!item) return;
        const key = [item.faixaIdx, item.faixaNome, item.data].join('|');
        if (!faixaMap[key]) faixaMap[key] = item;
      });
      localStorage.setItem('ct_faixa_hist_' + destinoId, JSON.stringify(Object.values(faixaMap)));
    }

    let matsOrigem = [];
    let matsDestino = [];
    try { matsOrigem = JSON.parse(localStorage.getItem('ct_crono_mats_' + origemId) || '[]'); } catch(e){}
    try { matsDestino = JSON.parse(localStorage.getItem('ct_crono_mats_' + destinoId) || '[]'); } catch(e){}
    if (matsOrigem.length > 0) {
      matsOrigem.forEach(m => {
        const alvo = (m.nome || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
        const jaExiste = matsDestino.some(md => {
          const mAlvo = (md.nome || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
          return mAlvo === alvo;
        });
        if (!jaExiste) matsDestino.push(m);
      });
      localStorage.setItem('ct_crono_mats_' + destinoId, JSON.stringify(matsDestino));
    }
    
    let cicloDestino = null;
    try { cicloDestino = JSON.parse(localStorage.getItem('ct_ciclo_' + destinoId) || 'null'); } catch(e){}
    if (!cicloDestino || !cicloDestino.entries || cicloDestino.entries.length === 0) {
      let cicloOrigem = null;
      try { cicloOrigem = JSON.parse(localStorage.getItem('ct_ciclo_' + origemId) || 'null'); } catch(e){}
      if (cicloOrigem) {
        localStorage.setItem('ct_ciclo_' + destinoId, JSON.stringify(cicloOrigem));
      }
    }

    // Remove concurso de origem (Isso limpa chaves auxiliares também)
    this.deleteConcurso(origemId);

    return { ok: true, sessoes: countS, questoes: countQ };
  },

  // ─────────────────────────────────────────
  // ARQUIVAMENTO DE MÉTRICAS SEMANAIS
  // ─────────────────────────────────────────

  archiveWeeklyMetrics(weekKey) {
    if (!weekKey) return;
    const historyKey = 'ct_history_weeks';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    // Evita duplicados para a mesma semana
    if (history.some(h => h.weekKey === weekKey)) return;

    const stats = this.estatisticasGerais();
    const markers = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ct_cest_')) {
        markers[k] = localStorage.getItem(k);
      }
    }

    history.push({
      weekKey: weekKey,
      dataArquivo: new Date().toISOString(),
      stats: stats,
      markers: markers
    });

    // Mantém apenas os últimos 52 registros (1 ano) para não estourar o LocalStorage
    if (history.length > 52) history.shift();

    this._set(historyKey, history);
    console.log(`[CT] Métricas da semana ${weekKey} arquivadas com sucesso.`);
  },

};

// Disponibiliza globalmente
window.CT = CT;

let _ctSavedStateSignature = null;
let _ctDirty = false;
let _ctAutoSaveTimer = null;
let _ctAutoSaveBusy = false;
let _ctQueuedAutoSaveTimer = null;
let _ctQueuedAutoSavePending = false;
let _ctActiveSavePromise = null;

const _ctVirtualStorageKeys = new Set([
  'ct_concursos',
  'ct_materias',
  'ct_topicos',
  'ct_subtopicos',
  'ct_sessoes',
  'ct_questoes',
  'ct_simulados',
  'ct_revisoes',
  'ct_flashcard_decks',
  'ct_flashcards',
  'ct_flashcard_log',
]);
const _ctVirtualStorage = Object.create(null);
const _ctWindowNamePrefix = 'CT_VIRTUAL_STORAGE::';

function _ctUsesVirtualStorage(key) {
  if (!_ctVirtualStorageSupported) return false;
  return typeof key === 'string' && _ctVirtualStorageKeys.has(key);
}

function _ctReadWindowNameStorage() {
  try {
    if (typeof window === 'undefined' || typeof window.name !== 'string') return {};
    if (!window.name.startsWith(_ctWindowNamePrefix)) return {};
    const parsed = JSON.parse(window.name.slice(_ctWindowNamePrefix.length));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function _ctPersistWindowNameStorage() {
  try {
    if (typeof window === 'undefined') return;
    const payload = {};
    _ctVirtualStorageKeys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(_ctVirtualStorage, key)) {
        payload[key] = _ctVirtualStorage[key];
      }
    });
    window.name = _ctWindowNamePrefix + JSON.stringify(payload);
  } catch {}
}

const _ctOriginalSetItem = localStorage.setItem.bind(localStorage);
const _ctOriginalGetItem = localStorage.getItem.bind(localStorage);
const _ctOriginalRemoveItem = localStorage.removeItem.bind(localStorage);

// Auto-teste: em alguns motores (ex: WebKitGTK usado no app desktop em
// Linux), reatribuir localStorage.setItem/getItem NAO intercepta as
// chamadas feitas via CT._set/_get (o motor ignora silenciosamente a
// sobrescrita). Nesses casos o armazenamento "virtual" (memoria +
// window.name) fica desconectado da leitura real, e a rotina de migracao
// abaixo apagaria dados do localStorage nativo sem conseguir recupera-los
// depois. Este teste detecta o problema e desativa o armazenamento
// virtual automaticamente, mantendo tudo no localStorage nativo (que
// funciona corretamente nesses motores).
let _ctVirtualStorageSupported = true;
try {
  const _ctProbeKey = '__ct_patch_probe__';
  const _ctProbeValue = 'probe_' + Date.now();
  let _ctProbeIntercepted = false;
  const _ctProbeOriginal = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    if (key === _ctProbeKey) _ctProbeIntercepted = true;
    else _ctOriginalSetItem(key, value);
  };
  localStorage.setItem(_ctProbeKey, _ctProbeValue);
  localStorage.setItem = _ctProbeOriginal;
  _ctVirtualStorageSupported = _ctProbeIntercepted;
} catch {
  _ctVirtualStorageSupported = false;
}

const _ctWindowNameStorage = _ctVirtualStorageSupported ? _ctReadWindowNameStorage() : {};
_ctVirtualStorageKeys.forEach(key => {
  if (Object.prototype.hasOwnProperty.call(_ctWindowNameStorage, key)) {
    _ctVirtualStorage[key] = String(_ctWindowNameStorage[key]);
  }
});

if (_ctVirtualStorageSupported) {
  // So migra (e apaga) dados do localStorage nativo se confirmamos que
  // a leitura via armazenamento virtual realmente funciona neste motor.
  _ctVirtualStorageKeys.forEach(key => {
    const oldValue = _ctOriginalGetItem(key);
    if (oldValue != null) {
      _ctVirtualStorage[key] = String(oldValue);
      _ctOriginalRemoveItem(key);
    }
  });
  _ctPersistWindowNameStorage();
} else {
  console.warn('[Track Concursos] Armazenamento virtual (window.name) nao suportado neste navegador/motor. Usando localStorage nativo diretamente.');
}

window._ctClearVirtualStorage = function() {
  _ctVirtualStorageKeys.forEach(key => {
    delete _ctVirtualStorage[key];
  });
  _ctPersistWindowNameStorage();
};

localStorage.getItem = function(key) {
  if (_ctUsesVirtualStorage(key)) {
    return Object.prototype.hasOwnProperty.call(_ctVirtualStorage, key)
      ? _ctVirtualStorage[key]
      : null;
  }
  return _ctOriginalGetItem(key);
};

const _ctEmergencyCacheKeys = [
  'concursos', 'materias', 'topicos', 'subtopicos', 'sessoes', 'questoes',
  'simulados', 'revisoes', 'flashcard_decks', 'flashcards', 'flashcard_log',
];
let _ctEmergencyCacheLastSignature = null;

// A cada poucos segundos, verifica se ha alteracoes pendentes (usando a
// MESMA logica de assinatura que ja funciona corretamente em
// hasUnsavedChanges — nao depende de interceptar localStorage.setItem,
// que em alguns motores como o WebKitGTK usado no app desktop em Linux
// nao intercepta chamadas de verdade) e, se houver, envia uma copia leve
// dos dados para o Python guardar em memoria (Api.cache_estado_atual).
// Isso NAO grava em disco a cada chamada — e so uma rede de seguranca:
// se o app for fechado abruptamente (Ctrl+C, fechar o terminal), o
// Python usa essa ultima copia em cache para salvar em disco, sem
// precisar chamar de volta o motor JS/GTK durante o desligamento.
function _ctEmergencyCacheTick() {
  try {
    if (!window.pywebview || !window.pywebview.api || typeof window.pywebview.api.cache_estado_atual !== 'function') return;
    if (typeof CT === 'undefined' || !CT._buildStateSignature) return;
    const signature = CT._buildStateSignature();
    if (signature === _ctEmergencyCacheLastSignature) return;
    const payload = {};
    _ctEmergencyCacheKeys.forEach(function(key) {
      try {
        const raw = localStorage.getItem('ct_' + key);
        payload[key] = raw ? JSON.parse(raw) : [];
      } catch (e) {
        payload[key] = [];
      }
    });
    window.pywebview.api.cache_estado_atual(JSON.stringify(payload));
    _ctEmergencyCacheLastSignature = signature;
  } catch (e) {}
}
setInterval(_ctEmergencyCacheTick, 2000);

localStorage.setItem = function(key, value) {
  if (_ctUsesVirtualStorage(key)) {
    _ctVirtualStorage[key] = String(value);
    _ctPersistWindowNameStorage();
  } else {
    _ctOriginalSetItem(key, value);
  }
  if (typeof key === 'string' && key.startsWith('ct_') && key !== 'ct_backup_nome' && key !== 'ct_profile_genero') {
    _ctDirty = true;
  }
};

localStorage.removeItem = function(key) {
  if (_ctUsesVirtualStorage(key)) {
    delete _ctVirtualStorage[key];
    _ctPersistWindowNameStorage();
  } else {
    _ctOriginalRemoveItem(key);
  }
  if (typeof key === 'string' && key.startsWith('ct_') && key !== 'ct_backup_nome' && key !== 'ct_profile_genero') {
    _ctDirty = true;
  }
};

function _ctRelevantStorageKeys() {
  const keys = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!key.startsWith('ct_')) continue;
    if (key === 'ct_backup_nome' || key === 'ct_profile_genero') continue;
    keys.add(key);
  }
  _ctVirtualStorageKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(_ctVirtualStorage, key)) keys.add(key);
  });
  return Array.from(keys).sort();
}

CT._buildStateSignature = function() {
  const payload = {};
  _ctRelevantStorageKeys().forEach(key => {
    payload[key] = localStorage.getItem(key);
  });
  return JSON.stringify(payload);
};

CT.markSavedState = function() {
  _ctSavedStateSignature = this._buildStateSignature();
  _ctDirty = false;
};

CT.hasUnsavedChanges = function() {
  if (_ctSavedStateSignature === null) return false;
  return _ctDirty || this._buildStateSignature() !== _ctSavedStateSignature;
};

CT.isSaveInProgress = function() {
  return !!_ctActiveSavePromise;
};

CT.waitForActiveSave = function() {
  return _ctActiveSavePromise || Promise.resolve({ ok: true });
};

CT.queueAutoSave = function(reason = 'autosave', options = {}) {
  if (!window.pywebview || !window.pywebview.api) return false;
  const delay = Math.max(0, Number(options.delay ?? 1200) || 0);
  const showToast = options.toast === true;

  if (_ctQueuedAutoSaveTimer) window.clearTimeout(_ctQueuedAutoSaveTimer);
  _ctQueuedAutoSaveTimer = window.setTimeout(() => {
    _ctQueuedAutoSaveTimer = null;
    if (_ctAutoSaveBusy) {
      _ctQueuedAutoSavePending = true;
      return;
    }
    if (!this.hasUnsavedChanges()) return;
    _ctAutoSaveBusy = true;
    if (showToast) CT.toast('Salvando...', '💾');
    this.autoBackup({ reason })
      .then(res => {
        if (!showToast) return res;
        if (res && res.ok) {
          CT.toast('Salvo com sucesso!', '✅');
        } else {
          CT.toast('Erro ao salvar backup.', '❌');
        }
        return res;
      })
      .catch(() => {
        if (showToast) CT.toast('Erro ao salvar backup.', '❌');
        return null;
      })
      .finally(() => {
        _ctAutoSaveBusy = false;
        if (_ctQueuedAutoSavePending) {
          _ctQueuedAutoSavePending = false;
          this.queueAutoSave(reason, { delay: 500, toast: showToast });
        }
      });
  }, delay);
  return true;
};

CT.startAutoSave = function() {
  if (_ctAutoSaveTimer) return true;
  if (!window.pywebview || !window.pywebview.api) return false;

  _ctAutoSaveTimer = window.setInterval(() => {
    if (!this.hasUnsavedChanges()) return;
    this.queueAutoSave('autosave', { delay: 0 });
  }, 5 * 60 * 1000);
  return true;
};

// Atalho global Ctrl+S — salva backup real em disco
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
    e.preventDefault();
    CT.toast('Salvando...', '💾');
    CT.autoBackup({ reason: 'salvo-manual' }).then(res => {
      if (res && res.ok) {
        CT.toast('Salvo com sucesso!', '✅');
      } else {
        CT.toast('Erro ao salvar backup.', '❌');
      }
    }).catch(() => {
      CT.toast('Erro ao salvar backup.', '❌');
    });
  }
});

// ─────────────────────────────────────────────────────────────
// DIÁLOGO DE FECHAMENTO (chamado pelo Python ao fechar janela)
// ─────────────────────────────────────────────────────────────
window.mostrarDialogFechamento = function() {
  if (window.CT && typeof CT.isSaveInProgress === 'function' && CT.isSaveInProgress()) {
    CT.toast('Aguarde: salvamento em andamento...', 'Salvando');
    if (typeof CT.waitForActiveSave === 'function') {
      CT.waitForActiveSave().finally(() => {
        setTimeout(() => {
          if (typeof window.mostrarDialogFechamento === 'function') window.mostrarDialogFechamento();
        }, 150);
      });
    }
    return;
  }

  if (window.CT && typeof CT.hasUnsavedChanges === 'function' && !CT.hasUnsavedChanges()) {
    window.pywebview.api.fecharApp();
    return;
  }
  // Remove instância anterior se existir
  const antigo = document.getElementById('ct-dialog-fechamento');
  if (antigo) antigo.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ct-dialog-fechamento';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(0,0,0,0.75)', 'backdrop-filter:blur(6px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-family:var(--sans,"Inter",sans-serif)',
    'animation:ctFadeIn 0.2s ease',
  ].join(';');

  overlay.innerHTML = `
    <style>
      @keyframes ctFadeIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      #ct-dialog-fechamento .ct-df-card {
        background: var(--bg2, #181c2a);
        border: 1px solid rgba(255,255,255,0.08);
        border-top: 3px solid #f87171;
        border-radius: 14px;
        padding: 36px 40px;
        width: 420px;
        max-width: 94vw;
        box-shadow: 0 24px 60px rgba(0,0,0,0.7);
        animation: ctFadeIn 0.25s cubic-bezier(0.175,0.885,0.32,1.275);
        text-align: center;
      }
      #ct-dialog-fechamento .ct-df-icon { font-size: 48px; margin-bottom: 12px; }
      #ct-dialog-fechamento h2 {
        color: var(--text, #e8eaf2);
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 8px;
      }
      #ct-dialog-fechamento p {
        color: var(--text2, #9ea3b8);
        font-size: 13px;
        margin: 0 0 28px;
        line-height: 1.6;
      }
      #ct-dialog-fechamento .ct-df-btns {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #ct-dialog-fechamento button {
        width: 100%;
        padding: 12px 20px;
        border-radius: 8px;
        border: none;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.15s;
        font-family: inherit;
      }
      #ct-dialog-fechamento button:hover { opacity: 0.88; transform: translateY(-1px); }
      #ct-dialog-fechamento button:active { transform: translateY(0); }
      #ct-df-btn-salvar  { background: linear-gradient(135deg,#4f8ef7,#7c5df7); color:#fff; }
      #ct-df-btn-sair    { background: rgba(248,113,113,0.15); color:#f87171; border:1px solid rgba(248,113,113,0.3) !important; }
      #ct-df-btn-cancelar{ background: rgba(255,255,255,0.05); color:var(--text2,#9ea3b8); border:1px solid rgba(255,255,255,0.08) !important; }
    </style>
    <div class="ct-df-card">
      <div class="ct-df-icon">⚠️</div>
      <h2>Deseja salvar antes de sair?</h2>
      <p>Suas alterações desta sessão ainda não foram salvas no arquivo de backup.<br>Recomendamos salvar para não perder nenhum dado.</p>
      <div class="ct-df-btns">
        <button id="ct-df-btn-salvar">💾 Salvar e Fechar</button>
        <button id="ct-df-btn-sair">🚪 Fechar sem Salvar</button>
        <button id="ct-df-btn-cancelar">✖ Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Salvar e Fechar
  document.getElementById('ct-df-btn-salvar').addEventListener('click', () => {
    const btn = document.getElementById('ct-df-btn-salvar');
    const sairBtn = document.getElementById('ct-df-btn-sair');
    const cancelarBtn = document.getElementById('ct-df-btn-cancelar');
    btn.textContent = 'Salvando...';
    btn.disabled = true;
    if (sairBtn) sairBtn.disabled = true;
    if (cancelarBtn) cancelarBtn.disabled = true;
    CT.autoBackup({ reason: 'fechamento' }).then(res => {
      if (res && res.ok) {
        CT.toast('Salvo! Encerrando...', '✅');
        setTimeout(() => window.pywebview.api.fecharApp(), 600);
      } else {
        btn.textContent = '❌ Falha ao salvar. Tentar novamente?';
        btn.disabled = false;
        if (sairBtn) sairBtn.disabled = false;
        if (cancelarBtn) cancelarBtn.disabled = false;
      }
    }).catch(() => {
      btn.textContent = '❌ Falha ao salvar. Tentar novamente?';
      btn.disabled = false;
      if (sairBtn) sairBtn.disabled = false;
      if (cancelarBtn) cancelarBtn.disabled = false;
    });
  });

  // Fechar sem salvar
  document.getElementById('ct-df-btn-sair').addEventListener('click', () => {
    if (window.CT && typeof CT.isSaveInProgress === 'function' && CT.isSaveInProgress()) {
      CT.toast('Aguarde o salvamento terminar antes de fechar.', 'Salvando');
      return;
    }
    window.pywebview.api.fecharApp();
  });

  // Cancelar
  document.getElementById('ct-df-btn-cancelar').addEventListener('click', () => {
    overlay.remove();
  });
};

// Executa limpeza automática ao carregar
CT.installAlertOverride();
CT.limparLixo();
CT.markSavedState();
if (typeof window.addEventListener === 'function') {
  window.addEventListener('pywebviewready', () => {
    CT.startAutoSave();
  });
}
CT.startAutoSave();