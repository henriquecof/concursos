/**
 * Track Concursos — timer-popup.js
 * ================================
 * Timer flutuante inline (popup) que funciona em qualquer página.
 * Inclui modo Livre e Pomodoro com salvamento de sessão via CT.
 * 
 * Uso: <script src="timer-popup.js"></script> (após data.js)
 * Automaticamente cria o botão flutuante e o painel popup.
 */

(function () {
  'use strict';

  // ─── INJECT CSS ───────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    #timerFab {
      position: fixed; bottom: 28px; left: 215px; right: auto; z-index: 900;
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg, #4f8ef7, #7c5cfc);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; cursor: pointer;
      box-shadow: 0 4px 20px rgba(79,142,247,0.5);
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
      touch-action: none;
    }
    #timerFab:hover { transform: scale(1.05); box-shadow: 0 6px 28px rgba(79,142,247,0.65); }
    #timerFab.dragging { opacity: 0.8; transform: scale(1.1); transition: none; cursor: grabbing; }
    #timerFab.running { animation: fabPulse 2s ease-in-out infinite; }
    #timerFab::after {
      content: attr(data-tooltip);
      position: absolute;
      left: 50%;
      bottom: calc(100% + 14px);
      transform: translateX(-50%) translateY(4px);
      background: rgba(19,22,30,0.96);
      color: var(--text, #e8eaf2);
      border: 1px solid rgba(79,142,247,0.22);
      border-radius: 10px;
      padding: 7px 10px;
      font-family: var(--sans, "Inter", sans-serif);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 10px 24px rgba(0,0,0,0.38);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.16s ease, transform 0.16s ease;
    }
    #timerFab:hover::after {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    @keyframes fabPulse {
      0%,100% { box-shadow: 0 4px 20px rgba(79,142,247,0.5); }
      50% { box-shadow: 0 4px 28px rgba(62,207,142,0.6); }
    }
    #timerFab .fab-badge {
      position: absolute; bottom: -10px; left: 50%;
      transform: translateX(-50%);
      background: var(--bg3, #1a1e2a); color: var(--accent, #4f8ef7);
      font-size: 11px; font-weight: 800; font-family: var(--mono, monospace);
      padding: 3px 8px; border-radius: 12px;
      border: 1px solid var(--accent, #4f8ef7);
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      display: none;
      white-space: nowrap;
      pointer-events: none;
    }
    #timerFab.running .fab-badge { display: block; border-color: var(--green, #3ecf8e); color: var(--green, #3ecf8e); }

    /* OVERLAY */
    #timerOverlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 9998;
    }

    /* PANEL */
    #timerPopup {
      display: none; position: fixed;
      bottom: 90px; left: 228px; right: auto;
      width: 310px;
      background: var(--bg2, #13161e);
      border: 1px solid var(--border2, #2e3347);
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,142,247,0.1);
      z-index: 9999;
      user-select: none;
      overflow: hidden;
    }
    #timerPopup.minimized {
        display: none !important;
    }

    /* HANDLE */
    .tp-handle {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px;
      background: var(--bg3, #1a1e2a);
      border-bottom: 1px solid var(--border, #252836);
    }
    .tp-handle-title { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text3, #555a72); }
    .tp-actions { display: flex; gap: 8px; align-items: center; }
    .tp-action-btn { background: none; border: none; color: var(--text3, #555a72); font-size: 18px; cursor: pointer; padding: 4px; transition: color 0.15s; line-height: 1; display: flex; align-items: center; justify-content: center; }
    .tp-action-btn:hover { color: var(--accent, #4f8ef7); }
    .tp-action-btn.red:hover { color: var(--red, #f55a5a); }

    /* MODE TABS */
    .tp-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--border, #252836); }
    .tp-tab { padding: 8px; text-align: center; font-size: 12px; font-weight: 600; color: var(--text3, #555a72); cursor: pointer; border: none; background: none; font-family: var(--sans, 'DM Sans', sans-serif); transition: all 0.15s; }
    .tp-tab:first-child { border-right: 1px solid var(--border, #252836); }
    .tp-tab.active { color: var(--accent, #4f8ef7); background: rgba(79,142,247,0.06); }

    /* MATERIA/TOPICO SELECT */
    .tp-selectors { padding: 10px 14px 6px; display:flex; flex-direction:column; gap:6px; }
    .tp-selectors select {
      width: 100%; background: var(--bg3, #1a1e2a); border: 1px solid var(--border2, #2e3347);
      border-radius: 8px; padding: 6px 10px; color: var(--text2, #8b90a8);
      font-family: var(--sans, 'DM Sans', sans-serif); font-size: 12px; font-weight: 600;
      outline: none; cursor: pointer; transition: border-color 0.15s;
    }
    .tp-selectors select:focus { border-color: var(--accent, #4f8ef7); }
    .tp-selectors select:disabled { opacity: 0.5; cursor: not-allowed; }

    /* TIMER DISPLAY */
    .tp-body { padding: 12px 14px 16px; }
    .tp-ring-wrap { text-align: center; margin-bottom: 16px; }
    .tp-ring { width: 130px; height: 130px; margin: 0 auto 8px; position: relative; }
    .tp-ring svg { transform: rotate(-90deg); }
    .tp-ring-bg { fill: none; stroke: var(--bg3, #1a1e2a); stroke-width: 6; }
    .tp-ring-prog { fill: none; stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
    .tp-ring-inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .tp-time { font-family: var(--mono, monospace); font-size: 26px; font-weight: 700; color: var(--text, #e8eaf2); line-height: 1; letter-spacing: -1px; }
    .tp-status { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; }

    /* CONTROLS */
    .tp-controls { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .tp-btn { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border2, #2e3347); background: var(--bg3, #1a1e2a); color: var(--text2, #8b90a8); font-size: 15px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
    .tp-btn:hover { border-color: var(--text2, #8b90a8); color: var(--text, #e8eaf2); }
    .tp-btn.primary { width: 52px; height: 52px; font-size: 20px; background: linear-gradient(135deg, var(--accent, #4f8ef7), var(--accent2, #7c5cfc)); border: none; color: #fff; box-shadow: 0 4px 16px rgba(79,142,247,0.35); }
    .tp-btn.primary:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(79,142,247,0.45); }
    .tp-btn.stop:hover { border-color: var(--red, #f55a5a); color: var(--red, #f55a5a); }
    .tp-btn.reset:hover { border-color: var(--orange, #f5874a); color: var(--orange, #f5874a); }
    .tp-cycle-clear-wrap { display: none; text-align: center; margin: 8px 0 4px; }
    .tp-cycle-clear-btn {
      border: 0; background: transparent; color: var(--text3, #555a72);
      font-family: var(--sans, 'DM Sans', sans-serif); font-size: 10px; font-weight: 800;
      letter-spacing: .8px; text-transform: uppercase; cursor: pointer; opacity: .72;
      padding: 4px 8px; border-radius: 999px;
    }
    .tp-cycle-clear-btn:hover { opacity: 1; color: var(--accent, #4f8ef7); background: rgba(79,142,247,.08); }

    /* SESSION LOG */
    .tp-log { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border, #252836); }
    .tp-log-title { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text3, #555a72); margin-bottom: 6px; }
    .tp-log-entry { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text2, #8b90a8); padding: 4px 0; border-bottom: 1px solid var(--border, #252836); }
    .tp-log-entry:last-child { border-bottom: none; }
    .tp-log-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tp-log-time { font-family: var(--mono, monospace); font-size: 12px; color: var(--green, #3ecf8e); font-weight: 700; flex-shrink: 0; }
    .tp-log-del { background: none; border: none; color: var(--text3, #555a72); font-size: 12px; cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: all 0.15s; flex-shrink: 0; line-height: 1; }
    .tp-log-del:hover { color: var(--red, #f55a5a); background: rgba(245,90,90,0.1); }

    /* POMODORO */
    .tp-pomo { padding: 12px 14px 16px; }
    .tp-pomo-cycles { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 12px; }
    .tp-pomo-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--bg3, #1a1e2a); border: 1px solid var(--border2, #2e3347); transition: all 0.3s; }
    .tp-pomo-dot.done { background: var(--accent, #4f8ef7); border-color: var(--accent, #4f8ef7); }
    .tp-pomo-dot.current { background: var(--green, #3ecf8e); border-color: var(--green, #3ecf8e); box-shadow: 0 0 6px rgba(62,207,142,0.5); }
    .tp-pomo-fase { text-align: center; margin-bottom: 10px; }
    .tp-fase-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .tp-fase-badge.foco   { background: rgba(79,142,247,0.12); color: var(--accent, #4f8ef7); border: 1px solid rgba(79,142,247,0.25); }
    .tp-fase-badge.pausa  { background: rgba(62,207,142,0.12); color: var(--green, #3ecf8e); border: 1px solid rgba(62,207,142,0.25); }
    .tp-fase-badge.longa  { background: rgba(124,92,252,0.12); color: var(--accent2, #7c5cfc); border: 1px solid rgba(124,92,252,0.25); }
    .tp-pomo-config { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
    .tp-cfg-item { background: var(--bg3, #1a1e2a); border: 1px solid var(--border, #252836); border-radius: 8px; padding: 6px 8px; text-align: center; }
    .tp-cfg-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text3, #555a72); margin-bottom: 4px; }
    .tp-cfg-input { width: 100%; background: transparent; border: none; color: var(--accent, #4f8ef7); font-family: var(--mono, monospace); font-size: 16px; font-weight: 700; text-align: center; outline: none; -moz-appearance: textfield; appearance: textfield; }
    .tp-cfg-input::-webkit-inner-spin-button, .tp-cfg-input::-webkit-outer-spin-button { -webkit-appearance: none; }
    .tp-cfg-unit { font-size: 8px; color: var(--text3, #555a72); margin-top: 1px; }
    .tp-pomo-time { text-align: center; font-family: var(--mono, monospace); font-size: 36px; font-weight: 700; color: var(--text, #e8eaf2); letter-spacing: -2px; line-height: 1; margin-bottom: 14px; }
    .tp-pomo-bar { height: 4px; background: var(--bg3, #1a1e2a); border-radius: 4px; overflow: hidden; margin-bottom: 5px; }
    .tp-pomo-fill { height: 100%; border-radius: 4px; transition: width 1s linear; }
    .tp-pomo-fill.foco  { background: linear-gradient(90deg, var(--accent, #4f8ef7), var(--accent2, #7c5cfc)); }
    .tp-pomo-fill.pausa { background: var(--green, #3ecf8e); }
    .tp-pomo-fill.longa { background: var(--accent2, #7c5cfc); }
    .tp-pomo-row { display: flex; justify-content: space-between; font-family: var(--mono, monospace); font-size: 12px; color: var(--text3, #555a72); }

    /* FINALIZATION MODAL */
    #tpSessionModal,
    #tpSoundModal {
      display: none; position: absolute; inset: 0;
      background: var(--bg2, #13161e); z-index: 10000;
      border-radius: 18px; padding: 16px; flex-direction: column;
      overflow-y: auto;
    }
    .tp-modal-title { font-size: 14px; font-weight: 700; color: var(--text, #e8eaf2); margin-bottom: 4px; text-align: center; }
    .tp-modal-sub { font-size: 10px; color: var(--text3, #555a72); margin-bottom: 12px; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
    .tp-modal-field { margin-bottom: 10px; }
    .tp-modal-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text3, #555a72); margin-bottom: 4px; }
    .tp-modal-select {
      width: 100%; background: var(--bg3, #1a1e2a); border: 1px solid var(--border2, #2e3347);
      border-radius: 8px; padding: 6px 10px; color: var(--text2, #8b90a8);
      font-family: var(--sans, sans-serif); font-size: 12px; font-weight: 600; outline: none;
    }
    .tp-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .tp-modal-input {
      width: 100%; background: var(--bg3, #1a1e2a); border: 1px solid var(--border2, #2e3347);
      border-radius: 8px; padding: 6px; text-align: center; font-family: var(--mono, monospace);
      font-size: 16px; font-weight: 700; outline: none;
    }
    .tp-modal-input.c { color: var(--green, #3ecf8e); }
    .tp-modal-input.e { color: var(--red, #f55a5a); }
    .tp-modal-extra { margin: 0 0 10px; padding: 10px; background: rgba(79,142,247,0.06); border: 1px solid rgba(79,142,247,0.2); border-radius: 10px; }
    .tp-modal-extra-title { font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: var(--accent, #4f8ef7); margin-bottom: 8px; }
    .tp-modal-extra .tp-modal-grid { margin-bottom: 0; align-items: start; }
    .tp-modal-extra .tp-modal-grid > div { min-width: 0; display: flex; flex-direction: column; }
    .tp-modal-extra .tp-modal-label { min-height: 34px; display: flex; align-items: flex-start; margin-bottom: 6px; font-size: 9px; line-height: 1.15; letter-spacing: 0.45px; }
    .tp-modal-extra .tp-modal-input { color: var(--text, #e8eaf2); }
    .tp-study-status { margin: 0 0 10px; padding: 10px; background: rgba(245,200,66,0.07); border: 1px solid rgba(245,200,66,0.22); border-radius: 10px; }
    .tp-study-status-title { font-size: 10px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; color: var(--yellow, #f5c842); margin-bottom: 8px; }
    .tp-study-status-options { display: grid; grid-template-columns: 1fr; gap: 7px; }
    .tp-study-status-options label { display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--border, #252836); background: rgba(255,255,255,.035); border-radius: 9px; padding: 8px; font-size: 11px; line-height: 1.35; color: var(--text2, #f1f2f6); cursor: pointer; }
    .tp-study-status-options input { margin-top: 1px; accent-color: var(--accent, #4f8ef7); }
    .tp-modal-btns { display: flex; gap: 8px; margin-top: auto; }
    .tp-modal-btn {
      flex: 1; padding: 8px; border-radius: 8px; border: none; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .tp-modal-btn.cancel { background: transparent; border: 1px solid var(--border, #252836); color: var(--text3, #555a72); }
    .tp-modal-btn.save { background: linear-gradient(135deg, var(--accent, #4f8ef7), var(--accent2, #7c5cfc)); color: #fff; }
    .tp-sound-card { display:flex; flex-direction:column; gap:10px; margin:10px 0; padding:12px; border-radius:12px; background:var(--bg3,#1a1e2a); border:1px solid var(--border,#252836); }
    .tp-sound-name { font-size:12px; color:var(--text2,#f1f2f6); font-weight:700; word-break:break-word; }
    .tp-sound-help { font-size:10px; color:var(--text3,#555a72); line-height:1.5; }
    .tp-sound-row { display:flex; align-items:center; gap:8px; }
    .tp-sound-row input[type="range"] { flex:1; accent-color:var(--accent,#4f8ef7); }
  `;
  document.head.appendChild(css);

  // ─── STATE (persisted in sessionStorage) ──────────────
  const SS_KEY = 'ct_timer_state';
  const TIMER_SKIP_DISCARD_CONFIRM_KEY = 'ct_timer_skip_discard_confirm';
  const TIMER_SKIP_CLOSE_RUNNING_CONFIRM_KEY = 'ct_timer_skip_close_running_confirm';
  let state = loadState();

  function timerConfirmSkipped(key) {
    try {
      return localStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  }

  function saveTimerConfirmSkip(key) {
    try {
      localStorage.setItem(key, '1');
    } catch (e) { }
  }

  async function confirmTimerAction(key, message, options) {
    if (timerConfirmSkipped(key)) return true;

    if (!window.CT || typeof window.CT.confirm !== 'function') {
      return window.confirm ? window.confirm(message) : false;
    }

    const result = await window.CT.confirm(message, {
      ...(options || {}),
      checkboxLabel: 'Nunca mais mostrar este aviso',
      onConfirmWithCheckbox: true
    });
    const confirmed = result && typeof result === 'object' ? !!result.confirmed : !!result;
    if (confirmed && result && typeof result === 'object' && result.checked) {
      saveTimerConfirmSkip(key);
    }
    return confirmed;
  }

  function loadState() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SS_KEY));
      if (s) return s;
    } catch (e) { }
    return {
      mode: 'free', open: false,
      freeRunning: false, freeSeconds: 0,
      pomoRunning: false, pomoFase: 'foco', pomoFocosFeitos: 0,
      pomoTotal: 0, pomoElapsed: 0, pomoAccumulatedTime: 0,
      cfgFoco: 25, cfgPausa: 5, cfgLonga: 15,
      selectedMateria: '', selectedTopic: '', selectedSubtopic: '',
      sessions: [], minimized: false,
      lastTick: null, cyclePreset: null,
      fabPos: { x: 215, y: 28 } // x is from left, y is from bottom (matching default css)
    };
  }

  function saveState() {
    sessionStorage.setItem(SS_KEY, JSON.stringify(state));
  }

  function refreshState() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SS_KEY));
      if (s) {
          // Merge current local state with fresh storage state
          state = { ...state, ...s };
      }
    } catch (e) { }
  }

  window._refreshTimerState = refreshState;

  // Recover elapsed time from navigation
  if (state.lastTick && (state.freeRunning || state.pomoRunning)) {
    const elapsed = Math.floor((Date.now() - state.lastTick) / 1000);
    if (elapsed > 0 && elapsed < 7200) { // max 2h gap
      if (state.freeRunning) state.freeSeconds += elapsed;
      if (state.pomoRunning) state.pomoElapsed += elapsed;
    }
    state.lastTick = Date.now();
  }

  // ─── BUILD HTML ───────────────────────────────────────
  // Remove old timer triggers
  document.querySelectorAll('#timerTrigger, [onclick*="timer.html"]').forEach(function (el) {
    // Only remove floating timer buttons, not nav items
    if (el.style && el.style.position === 'fixed') el.remove();
  });

  // FAB button
  const fab = document.createElement('div');
  fab.id = 'timerFab';
  fab.setAttribute('data-tooltip', 'Arraste para qualquer lugar');
  fab.innerHTML = '⏱️<span class="fab-badge" id="fabBadge"></span>';
  
  // Apply saved position
  if (state.fabPos) {
      fab.style.left = state.fabPos.x + 'px';
      fab.style.bottom = state.fabPos.y + 'px';
      fab.style.right = 'auto'; // ensure left takes priority
  }

  fab.addEventListener('click', function(e) { 
      if (fab.dataset.dragged === 'true') return; // skip if just dragged
      togglePopup(); 
  });
  document.body.appendChild(fab);

  // Mantem o cronometro acessivel em todas as telas que carregam este script.
  function updateFabVisibility() {
      const isRunning = state.freeRunning || state.pomoRunning;
      fab.style.display = 'flex';
      fab.classList.toggle('running', isRunning);
  }
  updateFabVisibility();

  // DRAGGABLE LOGIC
  (function initDraggable() {
      let isDragging = false;
      let startX, startY, origX, origY;

      fab.addEventListener('mousedown', dragStart);
      window.addEventListener('mousemove', dragMove);
      window.addEventListener('mouseup', dragEnd);

      function dragStart(e) {
          if (e.target.closest('.tp-action-btn')) return;
          isDragging = true;
          fab.dataset.dragged = 'false';
          fab.classList.add('dragging');
          const rect = fab.getBoundingClientRect();
          startX = e.clientX;
          startY = e.clientY;
          origX = rect.left;
          origY = rect.top;
      }

      function dragMove(e) {
          if (!isDragging) return;
          fab.dataset.dragged = 'true';
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          
          let newX = origX + dx;
          let newY = origY + dy;

          // Constraints
          newX = Math.max(0, Math.min(window.innerWidth - 44, newX));
          newY = Math.max(0, Math.min(window.innerHeight - 44, newY));

          fab.style.left = newX + 'px';
          fab.style.top = newY + 'px';
          fab.style.bottom = 'auto';
      }

      function dragEnd(e) {
          if (!isDragging) return;
          isDragging = false;
          fab.classList.remove('dragging');
          
          // Save position (relative to bottom-left for persistence consistency)
          const rect = fab.getBoundingClientRect();
          state.fabPos = { 
              x: rect.left, 
              y: window.innerHeight - rect.bottom 
          };
          saveState();
          
          // small delay to prevent click fire
          setTimeout(() => { fab.dataset.dragged = 'false'; }, 50);
      }
  })();

  // Overlay (Removed to allow interaction)
  // const overlay = document.createElement('div'); ...

  // Load materias for select
  const cId = sessionStorage.getItem('ct_concurso_ativo');
  let materias = [];
  if (cId && typeof CT !== 'undefined') {
    materias = CT.getMaterias(cId);
  }
  const matOptions = materias.map(function (m) {
    return '<option value="' + m.id + '"' + (state.selectedMateria === m.id ? ' selected' : '') + '>' + m.nome + '</option>';
  }).join('');

  // Panel
  const panel = document.createElement('div');
  panel.id = 'timerPopup';
  panel.innerHTML = `
    <div class="tp-handle">
      <span class="tp-handle-title">⏱ Cronômetro</span>
      <div class="tp-actions">
        <button class="tp-action-btn" id="tpSoundConfig" title="Configurar som">&#9835;</button>
        <button class="tp-action-btn" id="tpMinimize" title="Minimizar">➖</button>
        <button class="tp-action-btn red" id="tpClose" title="Encerrar">✕</button>
      </div>
    </div>
    <div class="tp-tabs">
      <button class="tp-tab${state.mode === 'free' ? ' active' : ''}" id="tpTabFree">⏱ Livre</button>
      <button class="tp-tab${state.mode === 'pomo' ? ' active' : ''}" id="tpTabPomo">🍅 Pomodoro</button>
    </div>
    <div class="tp-selectors">
      <select id="tpMatSelect">
        <option value="">— Selecione a matéria —</option>
        ${matOptions}
      </select>
      <select id="tpTopicSelect" disabled>
        <option value="">— Selecione o tópico —</option>
      </select>
      <select id="tpSubtopicSelect" disabled>
        <option value="">— Selecione o subtópico —</option>
      </select>
    </div>

    <!-- MODO LIVRE -->
    <div class="tp-body" id="tpFreePanel" style="${state.mode === 'free' ? 'display:block' : 'display:none'}">
      <div class="tp-ring-wrap">
        <div class="tp-ring">
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle class="tp-ring-bg" cx="65" cy="65" r="56"/>
            <circle class="tp-ring-prog" id="tpRingProg" cx="65" cy="65" r="56"
              stroke="var(--accent, #4f8ef7)"
              stroke-dasharray="351.86"
              stroke-dashoffset="351.86"/>
          </svg>
          <div class="tp-ring-inner">
            <div class="tp-time" id="tpFreeTime">00:00:00</div>
            <div class="tp-status" id="tpFreeStatus" style="color:var(--text3)">PRONTO</div>
          </div>
        </div>
      </div>
      <div class="tp-controls">
        <button class="tp-btn stop" title="Parar e registrar" id="tpBtnStop">⏹</button>
        <button class="tp-btn primary" id="tpBtnPlay">▶</button>
        <button class="tp-btn" title="Resetar" id="tpBtnReset">↺</button>
      </div>
      <div class="tp-log" id="tpLog" style="display:none">
        <div class="tp-log-title">Sessões de hoje</div>
        <div id="tpLogEntries"></div>
      </div>
    </div>

    <!-- MODO POMODORO -->
    <div class="tp-pomo" id="tpPomoPanel" style="${state.mode === 'pomo' ? 'display:block' : 'display:none'}">
      <div class="tp-pomo-cycles" id="tpPomoCycles">
        <div class="tp-pomo-dot${state.pomoFocosFeitos % 4 > 0 ? ' done' : ''}${state.pomoFase === 'foco' && state.pomoFocosFeitos % 4 === 0 ? ' current' : ''}"></div>
        <div class="tp-pomo-dot${state.pomoFocosFeitos % 4 > 1 ? ' done' : ''}${state.pomoFase === 'foco' && state.pomoFocosFeitos % 4 === 1 ? ' current' : ''}"></div>
        <div class="tp-pomo-dot${state.pomoFocosFeitos % 4 > 2 ? ' done' : ''}${state.pomoFase === 'foco' && state.pomoFocosFeitos % 4 === 2 ? ' current' : ''}"></div>
        <div class="tp-pomo-dot${state.pomoFocosFeitos % 4 > 3 ? ' done' : ''}${state.pomoFase === 'foco' && state.pomoFocosFeitos % 4 === 3 ? ' current' : ''}"></div>
        <span style="font-size:12px;color:var(--text3,#555a72);margin-left:4px" id="tpPomoCycleLabel">ciclo 1/4</span>
      </div>
      <div class="tp-pomo-fase">
        <span class="tp-fase-badge foco" id="tpPomoFaseBadge">🎯 Foco</span>
      </div>
      <div class="tp-pomo-config">
        <div class="tp-cfg-item">
          <div class="tp-cfg-label">🎯 Foco</div>
          <input class="tp-cfg-input" type="number" id="tpCfgFoco" value="${state.cfgFoco}" min="1" max="120">
          <div class="tp-cfg-unit">min</div>
        </div>
        <div class="tp-cfg-item">
          <div class="tp-cfg-label">☕ Pausa</div>
          <input class="tp-cfg-input" type="number" id="tpCfgPausa" value="${state.cfgPausa}" min="1" max="60">
          <div class="tp-cfg-unit">min</div>
        </div>
        <div class="tp-cfg-item">
          <div class="tp-cfg-label" style="color:var(--accent2,#7c5cfc)">🛋 Longa</div>
          <input class="tp-cfg-input" type="number" id="tpCfgLonga" value="${state.cfgLonga}" min="1" max="60" style="color:var(--accent2,#7c5cfc)">
          <div class="tp-cfg-unit">min</div>
        </div>
      </div>
      <div class="tp-pomo-time" id="tpPomoTime">25:00</div>
      <div style="margin-bottom:14px">
        <div class="tp-pomo-bar"><div class="tp-pomo-fill foco" id="tpPomoFill" style="width:0%"></div></div>
        <div class="tp-pomo-row">
          <span id="tpPomoElapsed">0:00 decorrido</span>
          <span id="tpPomoRemaining">25:00 restante</span>
        </div>
      </div>
      <div class="tp-controls">
        <button class="tp-btn stop" title="Parar" id="tpBtnPomoStop">⏹</button>
        <button class="tp-btn primary" id="tpBtnPomoPlay">▶</button>
        <button class="tp-btn" title="Pular fase" id="tpBtnPomoSkip">⏭</button>
        <button class="tp-btn reset" title="Descartar e reiniciar Pomodoro" id="tpBtnPomoReset">&#8634;</button>
      </div>
    </div>
    
    <!-- MODAL DE SESSÃO -->
    <div id="tpSessionModal">
      <div class="tp-modal-title">Sessão Concluída 👏</div>
      <div class="tp-modal-sub" id="tpModalDuracao">00:00 estudado</div>
      
      <div class="tp-modal-field">
        <div class="tp-modal-label">Tipo de Estudo</div>
        <select class="tp-modal-select" id="tpModalTipo">
          <option value="Estudo">📚 Estudo Teórico</option>
          <option value="Revisão">↺ Revisão</option>
          <option value="Resolução de Questões">📝 Resolução de Questões</option>
          <option value="Simulado">🎯 Simulado</option>
        </select>
      </div>

      <div class="tp-modal-field">
        <div class="tp-modal-label">Matéria & Tópico</div>
        <select class="tp-modal-select" id="tpModalMateria" style="margin-bottom:6px">
          <option value="">— Matéria —</option>
          ${matOptions}
        </select>
        <select class="tp-modal-select" id="tpModalTopico" style="margin-bottom:6px" disabled>
          <option value="">— Tópico —</option>
        </select>
        <select class="tp-modal-select" id="tpModalSubtopic" disabled>
          <option value="">— Subtópico —</option>
        </select>
      </div>

      <div class="tp-modal-field">
        <div class="tp-modal-label">Questões Resolvidas? (opicional)</div>
        <div class="tp-modal-grid">
          <input type="number" class="tp-modal-input c" id="tpModalAcertos" placeholder="Acertos" min="0">
          <input type="number" class="tp-modal-input e" id="tpModalErros" placeholder="Erros" min="0">
        </div>
      </div>

      <div class="tp-modal-extra">
        <div class="tp-modal-extra-title">Estatísticas opcionais</div>
        <div class="tp-modal-grid">
          <div>
            <div class="tp-modal-label">Páginas lidas PDF/Livro</div>
            <input type="number" class="tp-modal-input" id="tpModalPaginasPdf" placeholder="0" min="0" step="1">
          </div>
          <div>
            <div class="tp-modal-label">Minutos assistidos de videoaulas</div>
            <input type="number" class="tp-modal-input" id="tpModalVideoMinutos" placeholder="0" min="0" step="1">
          </div>
        </div>
      </div>

      <div class="tp-study-status" id="tpStudyStatusBox">
        <div class="tp-study-status-title">Você concluiu este tópico?</div>
        <div class="tp-study-status-options">
          <label><input type="radio" name="tpStudyStatus" value="em_estudo"> Ainda não, continuar depois</label>
          <label><input type="radio" name="tpStudyStatus" value="estudado" checked> Sim, concluir tópico</label>
        </div>
      </div>

      <div class="tp-modal-btns">
        <button class="tp-modal-btn cancel" id="tpBtnModalCancel">Descartar</button>
        <button class="tp-modal-btn save" id="tpBtnModalSave">✓ Salvar Sessão</button>
      </div>
    </div>

    <div id="tpSoundModal">
      <div class="tp-modal-title">Som dos cronometros</div>
      <div class="tp-modal-sub">Use o bip padrao ou carregue um MP3 curto</div>
      <div class="tp-sound-card">
        <div class="tp-modal-label">Som atual</div>
        <div class="tp-sound-name" id="tpSoundName">Bip padrao do Track</div>
        <div class="tp-sound-help">Recomendado: MP3 curto, de ate poucos segundos, para nao cansar no uso diario.</div>
        <div class="tp-sound-row">
          <span class="tp-modal-label" style="margin:0">Volume</span>
          <input type="range" id="tpSoundVolume" min="10" max="100" value="85">
          <span id="tpSoundVolumeLabel" class="tp-sound-help">85%</span>
        </div>
      </div>
      <input type="file" id="tpSoundFile" accept=".mp3,audio/mpeg" style="display:none">
      <div class="tp-modal-btns">
        <button class="tp-modal-btn cancel" id="tpBtnSoundDefault">Padrao</button>
        <button class="tp-modal-btn cancel" id="tpBtnSoundUpload">Carregar MP3</button>
      </div>
      <div class="tp-modal-btns" style="margin-top:8px">
        <button class="tp-modal-btn cancel" id="tpBtnSoundTest">Testar</button>
        <button class="tp-modal-btn save" id="tpBtnSoundClose">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // ─── ELEMENTS ─────────────────────────────────────────
  const $close = document.getElementById('tpClose');
  const $tabFree = document.getElementById('tpTabFree');
  const $tabPomo = document.getElementById('tpTabPomo');
  const $freePanel = document.getElementById('tpFreePanel');
  const $pomoPanel = document.getElementById('tpPomoPanel');
  const $matSelect = document.getElementById('tpMatSelect');
  const $topicSelect = document.getElementById('tpTopicSelect');
  // Modal Variables
  let modalPendingDur = 0;
  let modalPendingOrigem = '';
  const $modal = document.getElementById('tpSessionModal');
  const $modalDuracao = document.getElementById('tpModalDuracao');
  const $modalTipo = document.getElementById('tpModalTipo');
  const $modalMat = document.getElementById('tpModalMateria');
  const $modalTopico = document.getElementById('tpModalTopico');
  const $modalAcertos = document.getElementById('tpModalAcertos');
  const $modalErros = document.getElementById('tpModalErros');
  const $modalPaginasPdf = document.getElementById('tpModalPaginasPdf');
  const $modalVideoMinutos = document.getElementById('tpModalVideoMinutos');
  const $studyStatusBox = document.getElementById('tpStudyStatusBox');
  const $btnModalCancel = document.getElementById('tpBtnModalCancel');
  const $btnModalSave = document.getElementById('tpBtnModalSave');
  const $modalSubtopic = document.getElementById('tpModalSubtopic');
  const $subtopicSelect = document.getElementById('tpSubtopicSelect');
  const $minimize = document.getElementById('tpMinimize');
  const $soundConfig = document.getElementById('tpSoundConfig');
  const $soundModal = document.getElementById('tpSoundModal');
  const $soundName = document.getElementById('tpSoundName');
  const $soundVolume = document.getElementById('tpSoundVolume');
  const $soundVolumeLabel = document.getElementById('tpSoundVolumeLabel');
  const $soundFile = document.getElementById('tpSoundFile');
  const $btnSoundDefault = document.getElementById('tpBtnSoundDefault');
  const $btnSoundUpload = document.getElementById('tpBtnSoundUpload');
  const $btnSoundTest = document.getElementById('tpBtnSoundTest');
  const $btnSoundClose = document.getElementById('tpBtnSoundClose');

  // Free
  const $freeTime = document.getElementById('tpFreeTime');
  const $freeStatus = document.getElementById('tpFreeStatus');
  const $ringProg = document.getElementById('tpRingProg');
  const $btnPlay = document.getElementById('tpBtnPlay');
  const $btnStop = document.getElementById('tpBtnStop');
  const $btnReset = document.getElementById('tpBtnReset');
  const $cycleClearWrap = document.createElement('div');
  $cycleClearWrap.className = 'tp-cycle-clear-wrap';
  $cycleClearWrap.id = 'tpCycleClearWrap';
  $cycleClearWrap.innerHTML = '<button class="tp-cycle-clear-btn" id="tpCycleClearBtn" title="Limpa a sess&atilde;o atual de estudo do cron&ocirc;metro">Limpar sess&atilde;o</button>';
  $btnReset.closest('.tp-controls')?.insertAdjacentElement('afterend', $cycleClearWrap);
  const $cycleClearBtn = document.getElementById('tpCycleClearBtn');
  $btnPlay.innerHTML = '&#9654;';
  const $log = document.getElementById('tpLog');
  const $logEntries = document.getElementById('tpLogEntries');
  // Pomo
  const $pomoTime = document.getElementById('tpPomoTime');
  const $pomoFill = document.getElementById('tpPomoFill');
  const $pomoElapsed = document.getElementById('tpPomoElapsed');
  const $pomoRemaining = document.getElementById('tpPomoRemaining');
  const $pomoFaseBadge = document.getElementById('tpPomoFaseBadge');
  const $pomoCycleLabel = document.getElementById('tpPomoCycleLabel');
  const $btnPomoPlay = document.getElementById('tpBtnPomoPlay');
  const $btnPomoStop = document.getElementById('tpBtnPomoStop');
  const $btnPomoSkip = document.getElementById('tpBtnPomoSkip');
  const $btnPomoReset = document.getElementById('tpBtnPomoReset');
  $btnPomoPlay.innerHTML = '&#9654;';
  const $cfgFoco = document.getElementById('tpCfgFoco');
  const $cfgPausa = document.getElementById('tpCfgPausa');
  const $cfgLonga = document.getElementById('tpCfgLonga');

  // ─── MATERIA / TOPICO SYNC ────────────────────────────
  function populateTopics(materiaId, targetSelect, selectedTopicId) {
    if (!materiaId || typeof CT === 'undefined') {
      targetSelect.innerHTML = '<option value="">— Selecione o tópico —</option>';
      targetSelect.disabled = true;
      return;
    }
    const topics = CT.getTopicos(materiaId);
    if (topics.length === 0) {
      targetSelect.innerHTML = '<option value="">Nenhum tópico cadastrado</option>';
      targetSelect.disabled = true;
      return;
    }
    targetSelect.innerHTML = '<option value="">— Selecione o tópico —</option>' + topics.map(function (t) {
      return '<option value="' + t.id + '"' + (selectedTopicId === t.id ? ' selected' : '') + '>' + t.nome + '</option>';
    }).join('');
    targetSelect.disabled = false;
  }

  function populateSubtopics(topicoId, targetSelect, selectedSubtopicId) {
    if (!topicoId || typeof CT === 'undefined') {
      targetSelect.innerHTML = '<option value="">— Selecione o subtópico —</option>';
      targetSelect.disabled = true;
      return;
    }
    const subs = CT.getSubtopicos(topicoId);
    if (subs.length === 0) {
      targetSelect.innerHTML = '<option value="">Sem subtópicos</option>';
      targetSelect.disabled = true;
      return;
    }
    targetSelect.innerHTML = '<option value="">— Selecione o subtópico —</option>' + subs.map(function (s) {
      return '<option value="' + s.id + '"' + (selectedSubtopicId === s.id ? ' selected' : '') + '>' + s.nome + '</option>';
    }).join('');
    targetSelect.disabled = false;
  }

  $matSelect.addEventListener('change', function () {
    state.selectedMateria = this.value;
    state.selectedTopic = '';
    state.selectedSubtopic = '';
    populateTopics(this.value, $topicSelect, '');
    populateSubtopics('', $subtopicSelect, '');
    saveState();
  });

  $topicSelect.addEventListener('change', function () {
    state.selectedTopic = this.value;
    state.selectedSubtopic = '';
    populateSubtopics(this.value, $subtopicSelect, '');
    saveState();
  });

  $subtopicSelect.addEventListener('change', function () {
    state.selectedSubtopic = this.value;
    saveState();
  });

  $modalMat.addEventListener('change', function () {
    populateTopics(this.value, $modalTopico, '');
    populateSubtopics('', $modalSubtopic, '');
    updateStudyStatusBox();
  });

  $modalTopico.addEventListener('change', function () {
    populateSubtopics(this.value, $modalSubtopic, '');
    updateStudyStatusBox();
  });

  $modalSubtopic.addEventListener('change', updateStudyStatusBox);

  // Restore selects on UI load
  if (state.selectedMateria) {
    populateTopics(state.selectedMateria, $topicSelect, state.selectedTopic);
    if (state.selectedTopic) {
      populateSubtopics(state.selectedTopic, $subtopicSelect, state.selectedSubtopic);
    }
  }

  // ─── MODAL LOGIC ──────────────────────────────────────
  function readPositiveInput(el) {
    const n = parseInt(el && el.value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function readSessionMetricas() {
    if (typeof CT === 'undefined' || typeof CT.limparMetricasSessao !== 'function') return {};
    return CT.limparMetricasSessao({
      paginasPdf: readPositiveInput($modalPaginasPdf),
      videoMinutos: readPositiveInput($modalVideoMinutos)
    });
  }

  function readStudyStatus() {
    if ($studyStatusBox && $studyStatusBox.style.display === 'none') return '';
    const selected = document.querySelector('input[name="tpStudyStatus"]:checked');
    return selected ? selected.value : '';
  }

  function selectedStudyTargetIsDone() {
    if (typeof CT === 'undefined' || !$modalTopico || !$modalTopico.value) return false;
    const topico = CT.getTopico($modalTopico.value);
    const subtopicoId = $modalSubtopic && $modalSubtopic.value ? $modalSubtopic.value : '';
    if (subtopicoId) {
      const subtopico = CT.getSubtopico
        ? CT.getSubtopico(subtopicoId)
        : (CT.getSubtopicos($modalTopico.value) || []).find(s => s.id === subtopicoId);
      return !!(subtopico && subtopico.estudado) || !!(topico && topico.estudado);
    }
    return !!(topico && topico.estudado);
  }

  function updateStudyStatusBox() {
    if (!$studyStatusBox) return;
    const hasTopic = !!($modalTopico && $modalTopico.value);
    const alreadyDone = hasTopic && selectedStudyTargetIsDone();
    $studyStatusBox.style.display = hasTopic && !alreadyDone ? '' : 'none';
    if (hasTopic && !alreadyDone) {
      const defaultStatus = document.querySelector('input[name="tpStudyStatus"][value="estudado"]');
      if (defaultStatus) defaultStatus.checked = true;
    }
  }

  function openSessionModal(durSeconds, origem) {
    modalPendingDur = durSeconds;
    modalPendingOrigem = origem;
    if (state.cyclePreset && durSeconds > state.cyclePreset.startRemaining) {
      var plannedSeconds = Math.max(0, parseInt(state.cyclePreset.startRemaining, 10) || 0);
      var extraSeconds = Math.max(0, durSeconds - plannedSeconds);
      $modalDuracao.textContent = formatHMS(plannedSeconds) + ' + ' + formatHMS(extraSeconds) + ' extra';
    } else {
      $modalDuracao.textContent = formatHMS(durSeconds) + ' estudado';
    }

    // reset/sync inputs
    $modalAcertos.value = '';
    $modalErros.value = '';
    $modalPaginasPdf.value = '';
    $modalVideoMinutos.value = '';
    $modalTipo.value = 'Estudo';
    $modalMat.value = state.selectedMateria;
    populateTopics(state.selectedMateria, $modalTopico, state.selectedTopic);
    populateSubtopics(state.selectedTopic, $modalSubtopic, state.selectedSubtopic);
    const defaultStatus = document.querySelector('input[name="tpStudyStatus"][value="estudado"]');
    if (defaultStatus) defaultStatus.checked = true;
    updateStudyStatusBox();

    $modal.style.display = 'flex';
  }

  function closeSessionModal() {
    $modal.style.display = 'none';
    modalPendingDur = 0;
    modalPendingOrigem = '';
  }

  function clearCyclePresetState() {
    state.cyclePreset = null;
    state.isRevisionCard = false;
    state.selectedTipo = '';
  }

  function clearCycleTimerMode() {
    clearInterval(freeInterval);
    state.freeRunning = false;
    state.freeSeconds = 0;
    state.lastTick = null;
    state.cyclePreset = null;
    state.isRevisionCard = false;
    state.selectedTipo = '';
    state.selectedMateria = '';
    state.selectedTopic = '';
    state.selectedSubtopic = '';
    state.mode = 'free';
    state.open = true;
    state.minimized = false;

    $btnPlay.innerHTML = '&#9654;';
    $matSelect.disabled = false;
    $modalMat.disabled = false;
    $matSelect.value = '';
    $topicSelect.value = '';
    $subtopicSelect.value = '';
    $modalMat.value = '';
    $modalTopico.value = '';
    $modalSubtopic.value = '';
    populateTopics('', $topicSelect, '');
    populateSubtopics('', $subtopicSelect, '');
    populateTopics('', $modalTopico, '');
    populateSubtopics('', $modalSubtopic, '');

    const cycleHint = document.getElementById('tpCycleHint');
    if (cycleHint) cycleHint.style.display = 'none';
    if ($cycleClearWrap) $cycleClearWrap.style.display = 'none';

    saveState();
    setMode('free');
    $freeStatus.textContent = 'PRONTO';
    $freeStatus.style.color = 'var(--text3,#555a72)';
    saveState();
    updateFreeDisplay();
    updatePomoDisplay();
    updateFabVisibility();
    window.dispatchEvent(new CustomEvent('timer-cycle-cleared'));
  }

  function discardPendingSession() {
    const origem = modalPendingOrigem;
    if (origem === 'pomodoro') {
      state.pomoAccumulatedTime = 0;
      saveState();
    }
    if (state.cyclePreset) clearCyclePresetState();
    closeSessionModal();
    if (origem === 'timer_livre') resetFree();
  }

  $btnModalCancel.addEventListener('click', async function () {
    if (await confirmTimerAction(TIMER_SKIP_DISCARD_CONFIRM_KEY, 'Tem certeza que deseja descartar este tempo estudado? Ele não vai para suas métricas.', {
      title: 'Descartar tempo',
      confirmLabel: 'Descartar',
    })) {
      discardPendingSession();
    }
  });

  $btnModalSave.addEventListener('click', function () {
    if (modalPendingDur === 0) { closeSessionModal(); return; }

    const matId = $modalMat.value;
    const topicoId = $modalTopico.value || null;
    const subtopicoId = $modalSubtopic.value || null;
    const tipo = $modalTipo.value;
    const a = parseInt($modalAcertos.value) || 0;
    const e = parseInt($modalErros.value) || 0;
    const metricas = readSessionMetricas();
    const temMetricas = Object.keys(metricas).length > 0;
    const studyStatus = readStudyStatus();

    let savedSessaoId = null;
    const cyclePresetForSave = state.cyclePreset || null;
    const cyclePlannedSeconds = cyclePresetForSave ? Math.max(0, parseInt(cyclePresetForSave.startRemaining, 10) || 0) : 0;
    const cycleExtraSeconds = cyclePresetForSave ? Math.max(0, modalPendingDur - cyclePlannedSeconds) : 0;
    if (cId && typeof CT !== 'undefined') {
      const sessao = {
        concursoId: cId,
        materiaId: matId || null,
        topicoId: topicoId,
        subtopicoId: subtopicoId,
        duracaoSegundos: modalPendingDur,
        origem: modalPendingOrigem,
        tipoEstudo: tipo,
        cicloPlanejadoSegundos: cyclePresetForSave ? cyclePlannedSeconds : null,
        extraSegundos: cycleExtraSeconds || 0
      };
      if (temMetricas) sessao.metricas = metricas;
      savedSessaoId = CT.registrarSessao(sessao);

      if (a > 0 || e > 0) {
        CT.lancarQuestoes({
          concursoId: cId,
          materiaId: matId || null,
          topicoId: topicoId,
          subtopId: subtopicoId,
          resolvidas: a + e,
          acertos: a,
          erros: e
        });
      }
      if ((topicoId || subtopicoId) && studyStatus && typeof CT.registrarProgressoUnidadeEstudo === 'function') {
        CT.registrarProgressoUnidadeEstudo({
          concursoId: cId,
          materiaId: matId || null,
          topicoId: topicoId,
          subtopId: subtopicoId,
          status: studyStatus
        });
      }
    }

    const matNameInfo = matId ? ($modalMat.options[$modalMat.selectedIndex].text) : (modalPendingOrigem === 'pomodoro' ? 'Pomodoro' : 'Livre');
    const cPreset = cyclePresetForSave;
    const cItemId = cPreset ? cPreset.itemId : null;
    state.sessions.push({ dur: modalPendingDur, mat: matNameInfo, ts: Date.now(), sessaoId: savedSessaoId, materiaId: matId || null, cycleItemId: cItemId });
    renderSessions();
    if (cPreset) clearCyclePresetState();

    if (modalPendingOrigem === 'pomodoro') {
      state.pomoAccumulatedTime = 0;
      saveState();
    } else {
      resetFree();
    }
    closeSessionModal();
    if (typeof window.renderCrono === 'function') window.renderCrono();
  });

  function openPopup() {
    refreshState();
    state.minimized = false;
    panel.style.display = 'block';
    panel.classList.remove('minimized');
    state.open = true;
    saveState();
    updateFreeDisplay();
    updatePomoDisplay();
    updateFabVisibility();
  }

  function timerPopupIsVisible() {
    return panel && panel.style.display === 'block' && !panel.classList.contains('minimized');
  }

  function isTextEntryTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  function handleTimerShortcut(event) {
    if (!event || (event.key !== ' ' && event.key !== 'Spacebar')) return;
    if (!timerPopupIsVisible()) return;
    if ($modal && $modal.style.display === 'flex') return;
    if ($soundModal && $soundModal.style.display === 'flex') return;
    if (isTextEntryTarget(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    refreshState();
    if (state.mode === 'pomo') togglePomo();
    else toggleFree();
  }

  document.addEventListener('keydown', handleTimerShortcut, true);

  function minimizePopup() {
    state.minimized = true;
    panel.classList.add('minimized');
    state.open = true; // Still open, just hidden
    saveState();
  }

  async function closePopup() {
    if (state.freeRunning || state.pomoRunning) {
      if (!(await confirmTimerAction(TIMER_SKIP_CLOSE_RUNNING_CONFIRM_KEY, 'Deseja encerrar o cronômetro? Se minimizar, o tempo continuará contando no botão flutuante.', {
        title: 'Encerrar cronômetro',
        confirmLabel: 'Encerrar',
      }))) return;
    }
    panel.style.display = 'none';
    state.open = false;
    state.minimized = false;
    saveState();
  }

  function togglePopup() {
    if (state.open && !state.minimized) minimizePopup();
    else openPopup();
  }

  function refreshTimerState() {
     refreshState();
     syncSelectorsFromState();
     updateFreeDisplay();
     updatePomoDisplay();
     updateFabVisibility();
     
     // Special Mode Handling
     if (state.selectedTipo) {
        $modalTipo.value = state.selectedTipo;
     }

     // If it's a revision card, it MUST NOT be disabled (so user can pick subject)
     const isRevision = !!state.isRevisionCard;
     if (isRevision) {
        $matSelect.disabled = false;
        $modalMat.disabled = false;
     }
  }

  function syncSelectorsFromState() {
    if ($matSelect) {
      $matSelect.disabled = false;
      $matSelect.value = state.selectedMateria || '';
      populateTopics(state.selectedMateria || '', $topicSelect, state.selectedTopic || '');
      if (state.selectedTopic) {
        populateSubtopics(state.selectedTopic, $subtopicSelect, state.selectedSubtopic || '');
      } else {
        populateSubtopics('', $subtopicSelect, '');
      }
      if (state.selectedTopic) $topicSelect.value = state.selectedTopic;
      if (state.selectedSubtopic) $subtopicSelect.value = state.selectedSubtopic;
    }
    if ($modalMat) {
      $modalMat.disabled = false;
      $modalMat.value = state.selectedMateria || '';
      populateTopics(state.selectedMateria || '', $modalTopico, state.selectedTopic || '');
      if (state.selectedTopic) {
        populateSubtopics(state.selectedTopic, $modalSubtopic, state.selectedSubtopic || '');
      } else {
        populateSubtopics('', $modalSubtopic, '');
      }
      if (state.selectedTopic) $modalTopico.value = state.selectedTopic;
      if (state.selectedSubtopic) $modalSubtopic.value = state.selectedSubtopic;
    }
  }

  function openFreeTimerPreset(target) {
    target = target || {};
    if (document.activeElement && document.activeElement !== document.body && !panel.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    clearInterval(freeInterval);
    state.mode = 'free';
    state.open = true;
    state.minimized = false;
    state.freeRunning = false;
    state.freeSeconds = 0;
    state.lastTick = null;
    state.cyclePreset = null;
    state.isRevisionCard = false;
    state.selectedTipo = target.tipoEstudo || 'Estudo';
    state.selectedMateria = target.materiaId || '';
    state.selectedTopic = target.topicoId || '';
    state.selectedSubtopic = target.subtopicoId || target.subtopId || '';
    $btnPlay.innerHTML = '&#9654;';
    $freeStatus.textContent = 'PRONTO';
    $freeStatus.style.color = 'var(--text3,#555a72)';
    syncSelectorsFromState();
    saveState();
    setMode('free');
    openPopup();
    updateFreeDisplay();
    updateFabVisibility();
    if (target.autoStart) {
      setTimeout(function () {
        if (!state.freeRunning) toggleFree();
      }, 0);
    }
  }

  // Global Exports for crono-cycle.js bridge
  window.openTimerPopup = openPopup;
  window.closeTimerPopup = closePopup;
  window.minimizeTimerPopup = minimizePopup;
  window.setTimerMode = setMode;
  window.openFreeTimerPreset = openFreeTimerPreset;
  window.clearTimerCycleMode = clearCycleTimerMode;
  window._refreshTimerState = refreshTimerState;

  $close.addEventListener('click', closePopup);
  $minimize.addEventListener('click', minimizePopup);
  $soundConfig.addEventListener('click', function () {
    syncTimerSoundUI();
    $soundModal.style.display = 'flex';
  });
  $btnSoundClose.addEventListener('click', function () {
    $soundModal.style.display = 'none';
  });
  $btnSoundUpload.addEventListener('click', function () {
    $soundFile.click();
  });
  $btnSoundDefault.addEventListener('click', function () {
    timerSoundConfig = { mode: 'default', name: '', dataUrl: '', volume: timerSoundConfig.volume || 0.85 };
    saveTimerSoundConfig();
    syncTimerSoundUI();
    playTimerChime('focus', true);
  });
  $btnSoundTest.addEventListener('click', function () {
    timerSoundConfig.volume = getTimerSoundVolumeFromInput();
    saveTimerSoundConfig();
    syncTimerSoundUI();
    playTimerChime('focus', true);
  });
  $soundVolume.addEventListener('input', function () {
    timerSoundConfig.volume = getTimerSoundVolumeFromInput();
    saveTimerSoundConfig();
    syncTimerSoundUI();
  });
  $soundFile.addEventListener('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    if (!/\.mp3$/i.test(file.name || '') && file.type !== 'audio/mpeg') {
      alert('Escolha um arquivo .mp3.');
      this.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      try {
        timerSoundConfig = {
          mode: 'custom',
          name: file.name,
          dataUrl: String(reader.result || ''),
          volume: getTimerSoundVolumeFromInput()
        };
        saveTimerSoundConfig();
        syncTimerSoundUI();
        playTimerChime('focus', true);
      } catch (e) {
        alert('Nao foi possivel salvar esse MP3. Tente um arquivo mais curto/leve.');
      }
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  // MODE TABS
  $tabFree.addEventListener('click', function () { setMode('free'); });
  $tabPomo.addEventListener('click', function () { setMode('pomo'); });

  function setMode(m) {
    refreshState();
    state.mode = m;
    $freePanel.style.display = m === 'free' ? 'block' : 'none';
    $pomoPanel.style.display = m === 'pomo' ? 'block' : 'none';
    $tabFree.classList.toggle('active', m === 'free');
    $tabPomo.classList.toggle('active', m === 'pomo');
    saveState();
    updateFreeDisplay();
    updatePomoDisplay();
    updateFabVisibility();
  }

  // ─── MATERIA SELECT ───────────────────────────────────
  $matSelect.addEventListener('change', function () {
    state.selectedMateria = this.value;
    saveState();
  });

  // ─── UTILS ────────────────────────────────────────────
  function formatHMS(s) {
    return String(Math.floor(s / 3600)).padStart(2, '0') + ':' +
      String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' +
      String(s % 60).padStart(2, '0');
  }
  function formatMMSS(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' +
      String(s % 60).padStart(2, '0');
  }

  // ─── FREE MODE ────────────────────────────────────────

  // Soft timer chimes. Kept intentionally short and low-volume because students may hear them many times a day.
  const TIMER_SOUND_KEY = 'ct_timer_sound_config';
  const TRACK_DEFAULT_SOUND_URL = 'assets/track-default-timer-bip.mp3';
  let timerAudioCtx = null;
  let lastTimerSoundAt = 0;
  let timerSoundConfig = loadTimerSoundConfig();
  function loadTimerSoundConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem(TIMER_SOUND_KEY) || '{}');
      return {
        mode: cfg.mode === 'custom' ? 'custom' : 'default',
        name: cfg.name || '',
        dataUrl: cfg.dataUrl || '',
        volume: Math.min(1, Math.max(0.1, Number(cfg.volume) || 0.85))
      };
    } catch (e) {
      return { mode: 'default', name: '', dataUrl: '', volume: 0.85 };
    }
  }
  function saveTimerSoundConfig() {
    localStorage.setItem(TIMER_SOUND_KEY, JSON.stringify(timerSoundConfig));
  }
  function getTimerSoundVolumeFromInput() {
    if (!$soundVolume) return Math.min(1, Math.max(0.1, timerSoundConfig.volume || 0.85));
    return Math.min(1, Math.max(0.1, Number($soundVolume.value) / 100 || 0.85));
  }
  function syncTimerSoundUI() {
    if (!$soundName) return;
    $soundName.textContent = timerSoundConfig.mode === 'custom' && timerSoundConfig.name
      ? timerSoundConfig.name
      : 'Bip padrao do Track';
    if ($soundVolume) $soundVolume.value = Math.round((timerSoundConfig.volume || 0.85) * 100);
    if ($soundVolumeLabel) $soundVolumeLabel.textContent = Math.round((timerSoundConfig.volume || 0.85) * 100) + '%';
  }
  function playAudioSource(src) {
    if (!src) return false;
    try {
      const audio = new Audio(src);
      audio.volume = Math.min(1, Math.max(0.1, timerSoundConfig.volume || 0.85));
      audio.play().catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }
  function playConfiguredTimerSound() {
    if (timerSoundConfig && timerSoundConfig.mode === 'custom' && timerSoundConfig.dataUrl) {
      return playAudioSource(timerSoundConfig.dataUrl);
    }
    return playAudioSource(TRACK_DEFAULT_SOUND_URL);
  }
  function getTimerAudioCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!timerAudioCtx) timerAudioCtx = new AudioCtx();
    if (timerAudioCtx.state === 'suspended') timerAudioCtx.resume().catch(function () {});
    return timerAudioCtx;
  }
  function playSoftTone(freq, start, duration, gainValue) {
    const ctx = getTimerAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }
  function getTimerSoundGain(scale) {
    const volume = Math.min(1, Math.max(0.1, timerSoundConfig.volume || 0.85));
    return scale * volume;
  }
  function playTimerChime(kind, force) {
    const now = Date.now();
    if (!force && now - lastTimerSoundAt < 900) return;
    if (playConfiguredTimerSound()) {
      lastTimerSoundAt = now;
      return;
    }
    const ctx = getTimerAudioCtx();
    if (!ctx) return;
    lastTimerSoundAt = now;
    const t = ctx.currentTime + 0.03;
    if (kind === 'countdown') {
      playSoftTone(740, t, 0.2, getTimerSoundGain(0.112));
      playSoftTone(560, t + 0.24, 0.24, getTimerSoundGain(0.096));
      playSoftTone(560, t + 0.54, 0.18, getTimerSoundGain(0.082));
    } else if (kind === 'break') {
      playSoftTone(560, t, 0.22, getTimerSoundGain(0.088));
    } else {
      playSoftTone(560, t, 0.18, getTimerSoundGain(0.094));
      playSoftTone(740, t + 0.22, 0.24, getTimerSoundGain(0.1));
    }
  }

  syncTimerSoundUI();

  let freeInterval = null;

  function updateFreeDisplay() {
    let displaySecs = state.freeSeconds;
    let ringPct = (state.freeSeconds % 3600) / 3600;
    let cycleExtraSecs = 0;
    
    if (state.cyclePreset) {
      const cycleTargetSecs = Math.max(0, parseInt(state.cyclePreset.startRemaining, 10) || 0);
      const remainingSecs = Math.max(0, cycleTargetSecs - state.freeSeconds);
      cycleExtraSecs = Math.max(0, state.freeSeconds - cycleTargetSecs);
      displaySecs = cycleExtraSecs > 0 ? cycleExtraSecs : remainingSecs;
      ringPct = cycleTargetSecs > 0 ? (state.freeSeconds / cycleTargetSecs) : 0;
    }

    $freeTime.textContent = state.cyclePreset && cycleExtraSecs > 0 ? '+' + formatHMS(displaySecs) : formatHMS(displaySecs);
    $ringProg.style.strokeDashoffset = 351.86 - (351.86 * Math.min(1, ringPct));
    
    if (state.cyclePreset) {
        const isExtra = cycleExtraSecs > 0;
        $freeStatus.textContent = isExtra ? (state.freeRunning ? 'TEMPO EXTRA' : 'EXTRA PAUSADO') : (displaySecs > 0 ? (state.freeRunning ? 'ESTUDANDO (REGRESSIVO)' : 'PAUSADO') : 'META BATIDA!');
        $freeStatus.style.color = isExtra ? 'var(--accent,#4f8ef7)' : (displaySecs > 0 ? (state.freeRunning ? 'var(--green,#3ecf8e)' : 'var(--orange,#f5874a)') : 'var(--accent,#4f8ef7)');
    }

    // FAB badge
    const badge = document.getElementById('fabBadge');
    if (state.freeRunning || state.pomoRunning) {
      badge.style.display = '';
      badge.textContent = state.freeRunning ? (state.cyclePreset && cycleExtraSecs > 0 ? '+' + formatMMSS(displaySecs) : formatMMSS(displaySecs)) : formatMMSS(Math.max(0, state.pomoTotal - state.pomoElapsed));
      fab.classList.add('running');
    } else {
      badge.style.display = 'none';
      fab.classList.remove('running');
    }
  }

  function tickFree() {
    const now = Date.now();
    const elapsed = state.lastTick ? Math.floor((now - state.lastTick) / 1000) : 1;
    if (elapsed > 0) {
      state.freeSeconds += elapsed;
      state.lastTick = state.lastTick ? state.lastTick + (elapsed * 1000) : now;
    } else {
      return;
    }
    if (state.cyclePreset && state.freeRunning && state.freeSeconds >= state.cyclePreset.startRemaining && !state.cyclePreset.soundPlayed) {
      state.cyclePreset.soundPlayed = true;
      playTimerChime('countdown');
    }
    updateFreeDisplay();
    saveState();
  }

  function toggleFree() {
    state.freeRunning = !state.freeRunning;
    $btnPlay.innerHTML = state.freeRunning ? '&#10074;&#10074;' : '&#9654;';
    
    let runningText = state.cyclePreset ? 'ESTUDANDO (REGRESSIVO)' : 'ESTUDANDO';
    $freeStatus.textContent = state.freeRunning ? runningText : 'PAUSADO';
    $freeStatus.style.color = state.freeRunning ? 'var(--green,#3ecf8e)' : 'var(--orange,#f5874a)';
    
    if (state.freeRunning) {
      state.lastTick = Date.now();
      freeInterval = setInterval(tickFree, 1000);
    } else {
      clearInterval(freeInterval);
    }
    updateFabVisibility();
    saveState();
    updateFreeDisplay();
  }

  function stopFree() {
    if (state.freeSeconds === 0) return;
    clearInterval(freeInterval);
    state.freeRunning = false;
    $btnPlay.innerHTML = '&#9654;';
    if (state.cyclePreset) {
        $freeStatus.textContent = 'PAUSADO';
        $freeStatus.style.color = 'var(--orange,#f5874a)';
    } else {
        $freeStatus.textContent = 'PRONTO';
        $freeStatus.style.color = 'var(--text3,#555a72)';
    }
    updateFabVisibility();
    saveState();
    updateFreeDisplay();
    openSessionModal(state.freeSeconds, 'timer_livre');
  }

  function resetFree() {
    clearInterval(freeInterval);
    state.freeRunning = false;
    state.freeSeconds = 0;
    state.lastTick = null;
    $btnPlay.innerHTML = '&#9654;';
    
    if (state.cyclePreset) {
        $freeStatus.textContent = 'RECOMEÇAR CICLO';
        $freeStatus.style.color = 'var(--accent,#4f8ef7)';
    } else {
        $freeStatus.textContent = 'PRONTO';
        $freeStatus.style.color = 'var(--text3,#555a72)';
    }
    
    updateFreeDisplay();
    updateFabVisibility();
    saveState();
  }

  function renderSessions() {
    if (state.sessions.length === 0) { $log.style.display = 'none'; saveState(); return; }
    $log.style.display = '';
    $logEntries.innerHTML = state.sessions.slice(-5).reverse().map(function (s, ri) {
      var realIdx = state.sessions.length - 1 - ri;
      return '<div class="tp-log-entry">' +
        '<span class="tp-log-name">' + s.mat + '</span>' +
        '<span class="tp-log-time">' + formatHMS(s.dur) + '</span>' +
        '<button class="tp-log-del" data-idx="' + realIdx + '" title="Excluir sessão">✕</button>' +
        '</div>';
    }).join('');
    // Bind delete buttons
    $logEntries.querySelectorAll('.tp-log-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.dataset.idx);
        deleteSession(idx);
      });
    });
  }

  function deleteSession(idx) {
    if (idx < 0 || idx >= state.sessions.length) return;
    var session = state.sessions[idx];
    var removedByCT = false;
    // Remove from CT localStorage
    if (cId && typeof CT !== 'undefined') {
      try {
        var foundId = session.sessaoId || null;
        if (!foundId) {
          var allSessoes = JSON.parse(localStorage.getItem('ct_sessoes') || '[]');
          for (var i = allSessoes.length - 1; i >= 0; i--) {
            var s = allSessoes[i];
            if (s.concursoId === cId && s.duracaoSegundos === session.dur && s.materiaId === (session.materiaId || null)) {
              foundId = s.id;
              break;
            }
          }
        }
        if (foundId && typeof CT.excluirSessao === 'function') {
          removedByCT = CT.excluirSessao(foundId);
        }
      } catch (e) { }
    }
    if (!removedByCT && session.cycleItemId && typeof window.CTCycle !== 'undefined') {
      window.CTCycle.refundCycleTime(session.cycleItemId, session.dur, session.sessaoId);
    }
    state.sessions.splice(idx, 1);
    renderSessions();
    saveState();
  }

  $btnPlay.addEventListener('click', toggleFree);
  $btnStop.addEventListener('click', stopFree);
  $btnReset.addEventListener('click', resetFree);

  // ─── POMODORO MODE ────────────────────────────────────
  let pomoInterval = null;

  function getPomoConfig() {
    return {
      foco: parseInt($cfgFoco.value) * 60,
      pausa: parseInt($cfgPausa.value) * 60,
      longa: parseInt($cfgLonga.value) * 60,
    };
  }

  function initPomo() {
    const cfg = getPomoConfig();
    state.pomoTotal = cfg[state.pomoFase] || cfg.foco;
    state.pomoElapsed = 0;
    state.cfgFoco = parseInt($cfgFoco.value);
    state.cfgPausa = parseInt($cfgPausa.value);
    state.cfgLonga = parseInt($cfgLonga.value);
    updatePomoDisplay();
    saveState();
  }

  function updatePomoDisplay() {
    const rem = Math.max(0, state.pomoTotal - state.pomoElapsed);
    const pct = state.pomoTotal > 0 ? (state.pomoElapsed / state.pomoTotal) * 100 : 0;
    $pomoTime.textContent = formatMMSS(rem);
    $pomoFill.style.width = pct + '%';
    $pomoElapsed.textContent = formatMMSS(state.pomoElapsed) + ' decorrido';
    $pomoRemaining.textContent = formatMMSS(rem) + ' restante';
    updateFreeDisplay(); // For FAB badge
  }

  function updateFaseBadge() {
    const map = { foco: { cls: 'foco', txt: '🎯 Foco' }, pausa: { cls: 'pausa', txt: '☕ Pausa' }, longa: { cls: 'longa', txt: '🛋 Pausa longa' } };
    const m = map[state.pomoFase] || map.foco;
    $pomoFaseBadge.className = 'tp-fase-badge ' + m.cls;
    $pomoFaseBadge.textContent = m.txt;
    $pomoFill.className = 'tp-pomo-fill ' + (state.pomoFase || 'foco');
  }

  function updatePomoCycles() {
    const dots = document.querySelectorAll('#tpPomoCycles .tp-pomo-dot');
    dots.forEach(function (d, i) {
      d.classList.remove('done', 'current');
      if (i < state.pomoFocosFeitos % 4) d.classList.add('done');
      else if (i === state.pomoFocosFeitos % 4 && state.pomoFase === 'foco') d.classList.add('current');
    });
    $pomoCycleLabel.textContent = 'ciclo ' + (Math.floor(state.pomoFocosFeitos / 4) + 1) + '/4';
  }

  function togglePomo() {
    if (state.pomoTotal === 0) initPomo();
    state.pomoRunning = !state.pomoRunning;
    $btnPomoPlay.innerHTML = state.pomoRunning ? '&#10074;&#10074;' : '&#9654;';
    if (state.pomoRunning) {
      state.lastTick = Date.now();
      pomoInterval = setInterval(tickPomo, 1000);
    } else {
      clearInterval(pomoInterval);
    }
    saveState();
    updatePomoDisplay();
  }

  function tickPomo() {
    const now = Date.now();
    const elapsed = state.lastTick ? Math.floor((now - state.lastTick) / 1000) : 1;
    if (elapsed > 0) {
      state.pomoElapsed += elapsed;
      state.lastTick = state.lastTick ? state.lastTick + (elapsed * 1000) : now;
    } else {
      return;
    }
    if (state.pomoElapsed >= state.pomoTotal) { nextPomoFase(); return; }
    updatePomoDisplay();
    saveState();
  }

  function nextPomoFase() {
    clearInterval(pomoInterval);
    state.pomoRunning = false;
    $btnPomoPlay.innerHTML = '&#9654;';

    if (state.pomoFase === 'foco') {
      playTimerChime('focus');
      const dur = state.pomoTotal; // segundos do foco
      state.pomoAccumulatedTime = (state.pomoAccumulatedTime || 0) + dur;

      state.pomoFocosFeitos++;
      state.pomoFase = state.pomoFocosFeitos % 4 === 0 ? 'longa' : 'pausa';
    } else {
      playTimerChime('break');
      state.pomoFase = 'foco';
    }
    initPomo();
    updatePomoCycles();
    updateFaseBadge();
  }

  function stopPomo() {
    clearInterval(pomoInterval);
    state.pomoRunning = false;

    // Add current elapsed if in focus
    if (state.pomoFase === 'foco' && state.pomoElapsed > 0) {
      state.pomoAccumulatedTime = (state.pomoAccumulatedTime || 0) + state.pomoElapsed;
    }

    $btnPomoPlay.innerHTML = '&#9654;';

    if (state.pomoAccumulatedTime > 0) {
      // Pause visual state but don't reset completely yet, wait for Modal
      saveState();
      openSessionModal(state.pomoAccumulatedTime, 'pomodoro');
    } else {
      // Reset if no time to save
      state.pomoFase = 'foco';
      state.pomoFocosFeitos = 0;
      state.pomoTotal = 0;
      state.pomoElapsed = 0;
      state.lastTick = null;
      initPomo();
      updatePomoCycles();
      updateFaseBadge();
      saveState();
    }
  }

  async function resetPomo() {
    if ((state.pomoRunning || state.pomoElapsed > 0 || state.pomoAccumulatedTime > 0 || state.pomoFocosFeitos > 0) &&
        !(await window.CT.confirm('Descartar o Pomodoro atual e voltar para o ciclo 1? O tempo acumulado nao sera salvo.', {
          title: 'Resetar Pomodoro',
          confirmLabel: 'Resetar',
        }))) {
      return;
    }
    clearInterval(pomoInterval);
    state.pomoRunning = false;
    state.pomoFase = 'foco';
    state.pomoFocosFeitos = 0;
    state.pomoTotal = 0;
    state.pomoElapsed = 0;
    state.pomoAccumulatedTime = 0;
    state.lastTick = null;
    $btnPomoPlay.textContent = String.fromCharCode(9654);
    initPomo();
    updatePomoCycles();
    updateFaseBadge();
    saveState();
  }

  $btnPomoPlay.addEventListener('click', togglePomo);
  $btnPomoStop.addEventListener('click', stopPomo);
  $btnPomoSkip.addEventListener('click', nextPomoFase);
  $btnPomoReset.addEventListener('click', resetPomo);

  [$cfgFoco, $cfgPausa, $cfgLonga].forEach(function (inp) {
    inp.addEventListener('change', function () {
      if (!state.pomoRunning) initPomo();
    });
  });

  // ─── RESTORE STATE ON LOAD ────────────────────────────
  updateFreeDisplay();
  renderSessions();
  updatePomoDisplay();
  updateFaseBadge();
  updatePomoCycles();

  if (state.freeRunning) {
    $btnPlay.innerHTML = '&#10074;&#10074;';
    $freeStatus.textContent = 'ESTUDANDO';
    $freeStatus.style.color = 'var(--green,#3ecf8e)';
    freeInterval = setInterval(tickFree, 1000);
  }
  if (state.pomoRunning) {
    $btnPomoPlay.innerHTML = '&#10074;&#10074;';
    pomoInterval = setInterval(tickPomo, 1000);
  }
  if (state.open) {
    if (state.minimized) minimizePopup();
    else openPopup();
  }

})();
