
(function () {
  // Remove dash-only restriction to allow timer bridge on all pages

  var TIMER_KEY = 'ct_timer_state';
  function getTimerState() {
    try { return JSON.parse(sessionStorage.getItem(TIMER_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveTimerState(s) {
    sessionStorage.setItem(TIMER_KEY, JSON.stringify(s));
    // Trigger storage event for cross-tab sync if needed
    window.dispatchEvent(new Event('storage'));
  }

  function normName(nome) {
    return (nome || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }
  function sanitizeName(nome) {
    return (nome || '').toString().replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function escapeHtml(value) {
    return (value == null ? '' : String(value)).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function abbreviateSubjectName(nome) {
    var n = sanitizeName(nome);
    // Common exam abbreviations
    n = n.replace(/\bDireito\b/gi, 'Dir.');
    n = n.replace(/\bConhecimentos\b/gi, 'Con.');
    if (normName(n) !== 'ATUALIDADES') n = n.replace(/\bAtualidades\b/gi, 'At.');
    n = n.replace(/\bAdministrativo\b/gi, 'Adm.');
    return n;
  }
  var NEUTRAL_CARD_COLOR = '#607d8b';
  var AUTO_COLOR_PALETTE = ['#f55a5a','#4f8ef7','#7c5cfc','#3ecf8e','#f5c842','#f5874a','#00bcd4','#e91e8c','#8bc34a','#ff9800','#9c27b0','#ff5722','#009688','#795548','#3f51b5','#cddc39','#03a9f4','#e91e63','#4caf50'];
  function isSpecialNeutralName(nome) {
    var normalized = normName(nome);
    return normalized === 'SIMULADO' || normalized === 'REVISAO' || normalized.indexOf('REVIS') === 0;
  }
  function toHexChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  }
  function hslToHex(h, s, l) {
    var hue = ((h % 360) + 360) % 360;
    var sat = Math.max(0, Math.min(100, s)) / 100;
    var light = Math.max(0, Math.min(100, l)) / 100;
    var chroma = (1 - Math.abs((2 * light) - 1)) * sat;
    var x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    var match = light - (chroma / 2);
    var red = 0;
    var green = 0;
    var blue = 0;

    if (hue < 60) {
      red = chroma; green = x;
    } else if (hue < 120) {
      red = x; green = chroma;
    } else if (hue < 180) {
      green = chroma; blue = x;
    } else if (hue < 240) {
      green = x; blue = chroma;
    } else if (hue < 300) {
      red = x; blue = chroma;
    } else {
      red = chroma; blue = x;
    }

    return '#' + toHexChannel((red + match) * 255) + toHexChannel((green + match) * 255) + toHexChannel((blue + match) * 255);
  }
  function getDistinctMateriaColor(index) {
    if (index < AUTO_COLOR_PALETTE.length) return AUTO_COLOR_PALETTE[index];
    return hslToHex((index * 137.508) % 360, 72, 58);
  }
  function getCid() {
    return window._cCid || window.cId || sessionStorage.getItem('ct_concurso_ativo') || '';
  }
  function getMateriasAtivas() {
    var cid = getCid();
    if (!cid || typeof CT === 'undefined' || typeof CT.getMaterias !== 'function') return [];
    try { return CT.getMaterias(cid) || []; } catch (e) { return []; }
  }
  function getMateriaById(materiaId) {
    var id = (materiaId || '').toString();
    if (!id) return null;
    return getMateriasAtivas().find(function (m) { return (m.id || '').toString() === id; }) || null;
  }
  function resolveMateriaId(nome) {
    var alvo = normName(nome);
    if (!alvo) return '';
    var materias = getMateriasAtivas();
    var exata = materias.find(function (m) { return normName(m.nome) === alvo; });
    if (exata) return exata.id;
    var aproximada = materias.find(function (m) {
      var atual = normName(m.nome);
      return atual.indexOf(alvo) >= 0 || alvo.indexOf(atual) >= 0;
    });
    return aproximada ? aproximada.id : '';
  }
  function isVirtualMateriaId(materiaId) {
    var id = (materiaId || '').toString();
    return !id || id.indexOf('v-') === 0;
  }
  function openMateriaTab(materiaId, topicoId, subtopicoId) {
    if (isVirtualMateriaId(materiaId)) return false;
    
    if (topicoId) {
      sessionStorage.setItem('ct_expand_topico', topicoId);
    } else {
      sessionStorage.removeItem('ct_expand_topico');
    }
    if (subtopicoId) {
      sessionStorage.setItem('ct_expand_subtopico', subtopicoId);
    } else {
      sessionStorage.removeItem('ct_expand_subtopico');
    }

    if (typeof window.abrirMateria === 'function') {
      window.abrirMateria(materiaId);
      return true;
    }
    sessionStorage.setItem('ct_materia_ativa', materiaId);
    window.location.href = 'aba_materia.html';
    return true;
  }
  function hydrateCronoMat(item, forceIdx) {
    if (!item) return null;
    var rawNome = typeof item === 'string' ? item : (item.nome || '');
    var nome = sanitizeName(rawNome).toUpperCase();
    var materiaId = (typeof item === 'object' && item.materiaId) ? item.materiaId : '';
    var materiaOriginal = getMateriaById(materiaId);
    if (/^AT\.?$/i.test(nome) && materiaOriginal && normName(materiaOriginal.nome) === 'ATUALIDADES') {
      nome = sanitizeName(materiaOriginal.nome).toUpperCase();
    }
    if (!nome) return null;
    
    // Core Logic: Never overwrite a user color if provided
    var cor = (typeof item === 'object' && item.cor) ? item.cor : null;
    if (!cor) {
       if (isSpecialNeutralName(nome)) {
         cor = NEUTRAL_CARD_COLOR;
       } else {
         // More robust hashing to separate subjects with similar prefixes
         var h = 0;
         for (var i = 0; i < nome.length; i++) {
            h = (h << 5) - h + nome.charCodeAt(i);
            h |= 0; // Convert to 32bit int
         }
         // If no idx provided, use h to pick a palette index
         var pIdx = (typeof forceIdx === 'number') ? forceIdx : Math.abs(h);
         cor = getDistinctMateriaColor(pIdx);
       }
    }

    return {
      nome: nome,
      cor: cor,
      materiaId: materiaId || resolveMateriaId(nome) || ''
    };
  }

  window._getCronoMats = function () {
    var raw = [];
    try { raw = JSON.parse(localStorage.getItem('ct_crono_mats_' + (getCid() || '')) || '[]'); } catch (e) { raw = []; }
    if (!raw || !raw.length) {
      importFromContest();
      try { raw = JSON.parse(localStorage.getItem('ct_crono_mats_' + (getCid() || '')) || '[]'); } catch (e) { raw = []; }
    }
    var mats = [];
    raw.forEach(function (item, idx) {
      var mat = hydrateCronoMat(item, idx); // Use idx as secondary seed only if hash collides? No, hydrate uses hash.
      if (!mat) return;
      if (!mats.some(function (m) { return normName(m.nome) === normName(mat.nome); })) mats.push(mat);
    });
    return mats;
  };
  window._saveCronoMats = function (mats) {
    var list = [];
    var seen = {};
    (mats || []).forEach(function (item, idx) {
      if (!item) return;
      var mat = hydrateCronoMat(item, idx);
      if (!mat || !mat.nome) return;
      
      var normalized = normName(mat.nome);
      if (normalized && !seen[normalized]) {
         seen[normalized] = true;
         list.push(mat);
      }
    });
    localStorage.setItem('ct_crono_mats_' + (getCid() || ''), JSON.stringify(list));
    // Suggestion cache
    var sug = {};
    list.forEach(function (m) { sug[m.nome] = m.cor; });
    localStorage.setItem('ct_crono_sugestoes_' + (getCid() || ''), JSON.stringify(sug));
    
    if (typeof window.renderCrono === 'function') window.renderCrono();
  };

  function cycleKey() { return 'ct_ciclo_' + (getCid() || ''); }
  function cycleStatsKey() { return 'ct_ciclo_stats_' + (getCid() || ''); }
  function cycleModeKey() { 
    var cid = getCid();
    return cid ? ('ct_crono_modo_' + cid) : 'ct_crono_modo_global'; 
  }
  function getViewMode() {
    var mode = localStorage.getItem(cycleModeKey());
    if (!mode && getCid()) mode = localStorage.getItem('ct_crono_modo_global');
    return mode === 'cycle' ? 'cycle' : 'weekly';
  }
  function setViewMode(mode) {
    var val = mode === 'cycle' ? 'cycle' : 'weekly';
    localStorage.setItem(cycleModeKey(), val);
    localStorage.setItem('ct_crono_modo_global', val); // Always keep a global fallback
  }
  function parseDurationInput(value) {
    var raw = (value || '').toString().trim().toLowerCase();
    if (!raw) return 0;
    raw = raw.replace(',', '.').replace(/\s+/g, '');
    if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Math.round(parseFloat(raw) * 3600));
    var hhmm = raw.match(/^(\d+):(\d{1,2})$/);
    if (hhmm) return (parseInt(hhmm[1], 10) * 3600) + (parseInt(hhmm[2], 10) * 60);
    var hm = raw.match(/^(\d+)h(?:(\d{1,2})m?)?$/);
    if (hm) return (parseInt(hm[1], 10) * 3600) + ((parseInt(hm[2] || '0', 10)) * 60);
    var onlyMin = raw.match(/^(\d{1,3})m(?:in)?$/);
    if (onlyMin) return parseInt(onlyMin[1], 10) * 60;
    return 0;
  }
  function formatDurationInput(segundos) {
    var total = Math.max(0, Math.floor(segundos || 0));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    if (h > 0) return h + 'h' + String(m).padStart(2, '0');
    return m > 0 ? m + 'min' : '';
  }
  function formatHMS(segundos) {
    var total = Math.max(0, Math.floor(segundos || 0));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function importFromContest() {
    var cid = getCid();
    if (!cid) return [];
    var materias = getMateriasAtivas();
    if (!materias || !materias.length) return [];
    
    var list = [];
    var seen = {};
    var nextColorIndex = 0;
    materias.forEach(function (m) {
      if (!m.nome) return;
      var abrName = abbreviateSubjectName(m.nome);
      var normalized = normName(abrName);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      var hydrated = hydrateCronoMat({
         nome: abrName,
         cor: getDistinctMateriaColor(nextColorIndex++),
         materiaId: m.id
      });
      list.push(hydrated);
    });
    if (false) {
    
    // Always add special cards (SIMULADO and REVISÃO) at the end
    list.push(hydrateCronoMat({ nome: 'SIMULADO', cor: '#607d8b', materiaId: 'v-simulado' }));
    list.push(hydrateCronoMat({ nome: 'REVISÃO', cor: '#607d8b', materiaId: 'v-revisao' }));
    }
    list = list.filter(function (item) { return !isSpecialNeutralName(item && item.nome); });
    list.push(hydrateCronoMat({ nome: 'SIMULADO', cor: NEUTRAL_CARD_COLOR, materiaId: 'v-simulado' }));
    list.push(hydrateCronoMat({ nome: 'REVISAO', cor: NEUTRAL_CARD_COLOR, materiaId: 'v-revisao' }));

    window._saveCronoMats(list);
    return list;
  }
  function loadCycleRaw() {
    try { return JSON.parse(localStorage.getItem(cycleKey()) || '{}'); } catch (e) { return {}; }
  }
  function saveCycleRaw(raw) {
    var key = cycleKey();
    if (!key || key === 'ct_ciclo_') return;
    var next = normalizeCycleRawPointer(raw || {});
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('ct-cycle-updated', { detail: { concursoId: getCid(), data: next } }));
  }
  function saveCycleRawSilent(raw) {
    var key = cycleKey();
    if (!key || key === 'ct_ciclo_') return null;
    var next = normalizeCycleRawPointer(raw || {});
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  function isCyclePendingItem(item) {
    if (!item || item.status === 'done' || item.status === 'skipped') return false;
    var target = Math.max(0, parseInt(item.targetSeconds, 10) || 0);
    if (target <= 0) return false;
    var remaining = item.remainingSeconds == null ? target : Math.max(0, parseInt(item.remainingSeconds, 10) || 0);
    return remaining > 0;
  }
  function firstCyclePendingIndex(items) {
    if (!Array.isArray(items)) return -1;
    for (var i = 0; i < items.length; i++) {
      if (isCyclePendingItem(items[i])) return i;
    }
    return -1;
  }
  function normalizeCyclePointer(data) {
    if (!data || !Array.isArray(data.items)) return data || {};
    var firstPending = firstCyclePendingIndex(data.items);
    data.currentIndex = firstPending >= 0 ? firstPending : 0;
    data.currentItemId = firstPending >= 0 && data.items[firstPending] ? (data.items[firstPending].id || '') : '';
    return data;
  }
  function normalizeCycleRawPointer(raw) {
    if (!raw || !Array.isArray(raw.entries)) return raw || {};
    var firstPending = firstCyclePendingIndex(raw.entries);
    raw.currentIndex = firstPending >= 0 ? firstPending : 0;
    raw.currentItemId = firstPending >= 0 && raw.entries[firstPending] ? (raw.entries[firstPending].id || '') : '';
    return raw;
  }
  function baseIdFromName(nome) {
    return 'base_' + normName(nome);
  }
  function getMatByBaseId(baseId) {
    return window._getCronoMats().find(function (mat) { return baseIdFromName(mat.nome) === baseId; }) || null;
  }
  function getMatByMateriaId(materiaId) {
    if (!materiaId) return null;
    return window._getCronoMats().find(function (mat) { return String(mat.materiaId) === String(materiaId); }) || null;
  }
  function buildCycleEntry(baseId, prev) {
    var old = prev || {};
    var mat = getMatByBaseId(baseId) || (old.materiaId ? getMatByMateriaId(old.materiaId) : null);
    if (!mat) return null;
    var targetSeconds = Math.max(0, parseInt(old.targetSeconds, 10) || 0);
    var remainingSeconds = old.remainingSeconds == null ? targetSeconds : Math.max(0, parseInt(old.remainingSeconds, 10) || 0);
    if (remainingSeconds > targetSeconds) remainingSeconds = targetSeconds;
    var status = old.status === 'done' || old.status === 'skipped' ? old.status : 'pending';
    return {
      id: old.id || ('entry_' + Date.now() + '_' + Math.random().toString(16).slice(2, 7)),
      baseId: baseId,
      nome: mat.nome,
      cor: mat.cor,
      materiaId: mat.materiaId || old.materiaId || resolveMateriaId(mat.nome) || '',
      targetSeconds: targetSeconds,
      remainingSeconds: status === 'pending' ? remainingSeconds : 0,
      status: status,
      skippedSeconds: Math.max(0, parseInt(old.skippedSeconds, 10) || 0),
      lastPendingSeconds: Math.max(0, parseInt(old.lastPendingSeconds, 10) || 0),
      updatedAt: old.updatedAt || ''
    };
  }
  function saveCycle(data) {
    var raw = data || {};
    var previous = loadCycleRaw();
    if (raw && raw.items && raw.items.length) {
      normalizeCyclePointer(raw);
    }
    saveCycleRaw({
      round: Math.max(1, parseInt(raw.round, 10) || 1),
      startedAt: raw.startedAt || previous.startedAt || new Date().toISOString(),
      currentIndex: Math.max(0, parseInt(raw.currentIndex, 10) || 0),
      currentItemId: raw.currentItemId || '',
      sessionHistory: raw.sessionHistory || [],
      entries: (raw.items || []).map(function (item) {
        return {
          id: item.id,
          baseId: item.baseId || baseIdFromName(item.nome),
          materiaId: item.materiaId || '',
          targetSeconds: Math.max(0, parseInt(item.targetSeconds, 10) || 0),
          remainingSeconds: Math.max(0, parseInt(item.remainingSeconds, 10) || 0),
          status: item.status || 'pending',
          skippedSeconds: Math.max(0, parseInt(item.skippedSeconds, 10) || 0),
          lastPendingSeconds: Math.max(0, parseInt(item.lastPendingSeconds, 10) || 0),
          updatedAt: item.updatedAt || ''
        };
      })
    });
  }
  function reconcileCycleCompletion(data) {
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.sessionHistory)) return data;
    var studiedByItem = {};
    data.sessionHistory.forEach(function (session) {
      if (!session || !session.itemId) return;
      studiedByItem[session.itemId] = (studiedByItem[session.itemId] || 0) + Math.max(0, parseInt(session.duracao, 10) || 0);
    });
    var changed = false;
    data.items.forEach(function (item) {
      if (!item || item.status !== 'skipped') return;
      var target = Math.max(0, parseInt(item.targetSeconds, 10) || 0);
      if (!target) return;
      var pending = Math.max(0, parseInt(item.skippedSeconds || item.lastPendingSeconds, 10) || 0);
      var inferredStudied = Math.max(0, target - pending);
      var totalStudied = Math.max(studiedByItem[item.id] || 0, inferredStudied);
      if (totalStudied >= target) {
        item.status = 'done';
        item.remainingSeconds = 0;
        item.skippedSeconds = 0;
        item.lastPendingSeconds = 0;
        item.updatedAt = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) saveCycle(data);
    return data;
  }
  function logCycleStat(entry) {
    var key = cycleStatsKey();
    if (!key || key === 'ct_ciclo_stats_') return;
    var list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { list = []; }
    list.push({ id: 'cycle_stat_' + Date.now() + '_' + Math.random().toString(16).slice(2, 7), data: CT._today(), criadoEm: new Date().toISOString(), concursoId: getCid(), ...entry });
    localStorage.setItem(key, JSON.stringify(list));
  }
  function resetCycle(data) {
    var round = Math.max(1, parseInt(data && data.round, 10) || 1);
    try {
      if (window.CT && typeof window.CT.salvarCicloSnapshot === 'function' && data && data.items && data.items.length) {
        window.CT.salvarCicloSnapshot(getCid(), data, { status: 'complete', endAt: new Date().toISOString() });
      }
    } catch (e) {}
    
    // Log finalização do ciclo anterior antes de subir o round
    logCycleStat({ 
      materiaNome: 'CICLO COMPLETO', 
      round: round, 
      origem: 'ciclo_reset', 
      concluida: true,
      dataFim: new Date().toISOString()
    });

    var nextRound = round + 1;
    var items = (data && data.items || []).map(function (item) {
      return { ...item, status: 'pending', remainingSeconds: Math.max(0, parseInt(item.targetSeconds, 10) || 0), skippedSeconds: 0, lastPendingSeconds: 0, updatedAt: new Date().toISOString() };
    });
    
    // Log início do novo ciclo
    logCycleStat({ 
      materiaNome: 'CICLO INICIADO', 
      round: nextRound, 
      origem: 'ciclo_start',
      dataInicio: new Date().toISOString()
    });

    return { round: nextRound, startedAt: new Date().toISOString(), currentIndex: items.findIndex(function (item) { return item.targetSeconds > 0; }), items: items, sessionHistory: [] };
  }
  function restartCycle(data) {
    var next = resetCycle(data || getCycleData({ skipAutoRestart: true }));
    saveCycle(next);
    if (typeof window.renderCrono === 'function') window.renderCrono();
    return next;
  }
  function getCycleData(options) {
    var config = options || {};
    var saved = loadCycleRaw();

    var cronoConfig = getCronogramaConfig();
    var activeMode = getViewMode();
    var isCycleActive = (cronoConfig.tipo === 'ciclo' || activeMode === 'cycle');
    var isLivre = (cronoConfig.cicloModo === 'livre');

    var needsSuggestedGeneration = isCycleActive && 
                                   !isLivre && 
                                   (!saved.entries || saved.entries.length === 0 || saved.entries.every(function(e) { return !e.targetSeconds; }));
    
    var needsLivreGeneration = isCycleActive && 
                               isLivre && 
                               (!saved.entries || saved.entries.length === 0);

    if (needsSuggestedGeneration) {
      var suggested = buildSuggestedCycleData(getCid());
      if (suggested) {
        saveCycle(suggested);
        saved = loadCycleRaw();
      }
    } else if (needsLivreGeneration) {
      var livre = buildLivreCycleData(getCid());
      if (livre) {
        saveCycle(livre);
        saved = loadCycleRaw();
      }
    }

    if (!Array.isArray(saved.entries) && Array.isArray(saved.orderIds)) {
      saved.entries = [];
      saved.orderIds = [];
      saved.currentItemId = '';
      saved.currentIndex = 0;
      saveCycleRaw(saved);
    }
    var items = (saved.entries || []).map(function (entry) {
      return buildCycleEntry(entry.baseId || baseIdFromName(entry.nome || ''), entry);
    }).filter(Boolean);
    var data = { round: Math.max(1, parseInt(saved.round, 10) || 1), startedAt: saved.startedAt || '', currentIndex: Math.max(0, parseInt(saved.currentIndex, 10) || 0), currentItemId: saved.currentItemId || '', items: items, sessionHistory: saved.sessionHistory || [] };
    if (!items.length) return data;
    if (data.currentItemId) {
      var currentById = items.findIndex(function (item) { return item.id === data.currentItemId; });
      if (currentById >= 0) data.currentIndex = currentById;
    }
    reconcileCycleCompletion(data);
    var pendingIndexes = items.map(function (item, idx) { return isCyclePendingItem(item) ? idx : -1; }).filter(function (idx) { return idx >= 0; });
    if (!pendingIndexes.length && items.some(function (item) { return item.targetSeconds > 0; })) {
      data.currentIndex = 0;
      data.currentItemId = '';
    } else {
      normalizeCyclePointer(data);
    }
    if (!config.skipPersist) saveCycle(data);
    return data;
  }
  function advanceCycle(data, fromIndex) {
    return normalizeCyclePointer(data);
  }
  function formatCycleTime(segundos) {
    var s = Math.max(0, Math.floor(segundos || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + 'h' + String(m).padStart(2, '0');
    if (m > 0) return m + 'min';
    return s + 's';
  }
  function formatCycleClock(segundos) {
    var s = Math.max(0, Math.floor(segundos || 0));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h + 'h' + String(m).padStart(2, '0');
  }
  function formatCycleDelta(segundos) {
    var value = Math.round(segundos || 0);
    var sign = value >= 0 ? '+' : '-';
    var abs = Math.abs(value);
    var h = Math.floor(abs / 3600);
    var m = Math.floor((abs % 3600) / 60);
    if (h > 0 && m > 0) return sign + h + 'h' + String(m).padStart(2, '0');
    if (h > 0) return sign + h + 'h';
    return sign + m + 'min';
  }
  function updateCycleHours(itemId, horas) {
    var data = getCycleData({ skipAutoRestart: true });

    var item = data.items.find(function (it) { return it.id === itemId; });
    if (!item) return data;
    var newTarget = Math.max(0, parseDurationInput(horas));
    var oldTarget = Math.max(0, parseInt(item.targetSeconds, 10) || 0);
    var studied = item.status === 'done' ? oldTarget : Math.max(0, oldTarget - (parseInt(item.remainingSeconds, 10) || 0));
    item.targetSeconds = newTarget;
    if (item.status === 'pending') item.remainingSeconds = Math.max(0, newTarget - studied);
    item.materiaId = item.materiaId || resolveMateriaId(item.nome) || '';
    if (item.status === 'pending' && item.remainingSeconds === 0 && newTarget > 0) item.status = 'done';
    saveCycle(data);
    return data;
  }
  function reactivateCycleItem(itemId) {
    var raw = loadCycleRaw();
    var entryIdx = (raw.entries || []).findIndex(function(e) { return e.id === itemId; });
    if (entryIdx >= 0) {
        var entry = raw.entries[entryIdx];
        entry.status = 'pending';
        entry.remainingSeconds = Math.max(0, parseInt(entry.targetSeconds, 10) || 0);
        entry.skippedSeconds = 0;
        entry.lastPendingSeconds = 0;
        
        var firstPendingIdx = raw.entries.findIndex(function(e) { return e.status === 'pending' && parseInt(e.targetSeconds, 10) > 0; });
        if (firstPendingIdx >= 0) {
            raw.currentIndex = firstPendingIdx;
            raw.currentItemId = raw.entries[firstPendingIdx].id;
        }

        saveCycleRaw(raw);
    }
  }
  function moveCycleItem(itemId, direction) {
    var mats = window._getCronoMats();
    var idx = mats.findIndex(function (m) { return 'ciclo_' + normName(m.nome) === itemId; });
    if (idx < 0) return;
    var next = idx + direction;
    if (next < 0 || next >= mats.length) return;
    var swap = mats[idx];
    mats[idx] = mats[next];
    mats[next] = swap;
    window._saveCronoMats(mats);
    var data = getCycleData({ skipPersist: true, skipAutoRestart: true });
    saveCycle(data);
  }
  function placeCycleItem(itemId, targetIndex) {
    var raw = loadCycleRaw();
    raw.entries = Array.isArray(raw.entries) ? raw.entries.slice() : [];
    var nextIndex = Math.max(0, Math.min(targetIndex, raw.entries.length));
    if (itemId.indexOf('entry_') === 0) {
      var fromIndex = raw.entries.findIndex(function (entry) { return entry.id === itemId; });
      if (fromIndex < 0) return;
      var moving = raw.entries.splice(fromIndex, 1)[0];
      if (fromIndex < nextIndex) nextIndex--;
      raw.entries.splice(nextIndex, 0, moving);
      raw.currentIndex = nextIndex;
      raw.currentItemId = moving.id;
      saveCycleRaw(raw);
      return;
    }
    var created = buildCycleEntry(itemId);
    if (!created) return;
    raw.entries.splice(nextIndex, 0, created);
    if (!raw.currentItemId) {
      raw.currentItemId = created.id;
      raw.currentIndex = nextIndex;
    }
    saveCycleRaw(raw);
  }
  function shuffleList(list) {
    var shuffled = (list || []).slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled;
  }
  function addAllCycleMatsRandomly() {
    var mats = window._getCronoMats().filter(function (mat) {
      return mat && mat.nome && !isSpecialNeutralName(mat.nome);
    });
    if (!mats.length) {
      importFromContest();
      mats = window._getCronoMats().filter(function (mat) {
        return mat && mat.nome && !isSpecialNeutralName(mat.nome);
      });
    }
    if (!mats.length) return { added: 0, total: 0 };

    var raw = loadCycleRaw();
    raw.entries = Array.isArray(raw.entries) ? raw.entries.slice() : [];
    var used = {};
    raw.entries.forEach(function (entry) {
      var baseId = entry && (entry.baseId || baseIdFromName(entry.nome || ''));
      if (baseId) used[baseId] = true;
    });

    var missing = shuffleList(mats.filter(function (mat) {
      return !used[baseIdFromName(mat.nome)];
    }));
    missing.forEach(function (mat) {
      var entry = buildCycleEntry(baseIdFromName(mat.nome));
      if (!entry) return;
      raw.entries.push(entry);
      used[entry.baseId] = true;
    });

    if (!raw.currentItemId && raw.entries[0]) {
      raw.currentItemId = raw.entries[0].id;
      raw.currentIndex = 0;
    }
    saveCycleRaw(raw);
    return { added: missing.length, total: mats.length };
  }
  function removeCycleItem(itemId) {
    var raw = loadCycleRaw();
    raw.entries = Array.isArray(raw.entries) ? raw.entries.filter(function (entry) { return entry.id !== itemId; }) : [];
    if (raw.currentItemId === itemId) raw.currentItemId = raw.entries[0] ? raw.entries[0].id : '';
    raw.currentIndex = Math.max(0, Math.min(parseInt(raw.currentIndex, 10) || 0, Math.max(raw.entries.length - 1, 0)));
    saveCycleRaw(raw);
  }
  function finalizeCycleItem(itemId) {
    var data = getCycleData({ skipAutoRestart: true });
    var index = data.items.findIndex(function (item) { return item.id === itemId; });
    if (index < 0) return data;
    var item = data.items[index];
    if (!item.targetSeconds) return data;
    if (item.status === 'done' && Math.max(0, parseInt(item.remainingSeconds, 10) || 0) === 0) return data;
    var pendingSeconds = Math.max(0, parseInt(item.remainingSeconds, 10) || 0);
    var studiedSeconds = Math.max(0, parseInt(item.targetSeconds, 10) || 0) - pendingSeconds;
    item.status = pendingSeconds === 0 ? 'done' : 'skipped';
    item.lastPendingSeconds = pendingSeconds;
    item.skippedSeconds = pendingSeconds;
    item.remainingSeconds = 0;
    item.updatedAt = new Date().toISOString();
    logCycleStat({ materiaId: item.materiaId || null, materiaNome: item.nome, targetSeconds: item.targetSeconds, studiedSeconds: studiedSeconds, skippedSeconds: pendingSeconds, concluida: pendingSeconds === 0, round: data.round, origem: pendingSeconds === 0 ? 'ciclo_completo' : 'ciclo_finalizado' });
    data = advanceCycle(data, index);
    saveCycle(data);
    if (typeof window.renderCrono === 'function') window.renderCrono();
    return data;
  }
  function syncCycleSession(payload) {
    if (!payload || !payload.itemId) return null;
    var data = getCycleData({ skipAutoRestart: true });
    if (payload.sessaoId && Array.isArray(data.sessionHistory) && data.sessionHistory.some(function (s) { return s.id === payload.sessaoId || s.sessaoId === payload.sessaoId; })) return data;
    var index = data.items.findIndex(function (item) { return item.id === payload.itemId; });
    if (index < 0) return null;
    var item = data.items[index];
    item.materiaId = payload.materiaId || item.materiaId || '';
    var incomingRemaining = Math.max(0, parseInt(payload.remainingSeconds, 10) || 0);
    var studiedSecs = Math.max(0, parseInt(payload.studiedSeconds, 10) || 0);
    var target = Math.max(0, parseInt(item.targetSeconds, 10) || 0);
    var skippedRemaining = Math.max(0, parseInt(item.skippedSeconds || item.lastPendingSeconds, 10) || 0);
    if (item.status === 'skipped') {
      item.skippedSeconds = Math.max(0, (skippedRemaining || target) - studiedSecs);
      item.lastPendingSeconds = item.skippedSeconds;
      item.remainingSeconds = 0;
    } else {
      item.remainingSeconds = incomingRemaining;
    }
    item.updatedAt = new Date().toISOString();
    data.currentIndex = index;
    
    if (studiedSecs > 0) {
      data.sessionHistory = data.sessionHistory || [];
      data.sessionHistory.push({
        id: payload.sessaoId || ('cyc_sess_' + Date.now() + '_' + Math.random().toString(16).slice(2, 7)),
        sessaoId: payload.sessaoId || null,
        itemId: item.id,
        nome: item.nome,
        duracao: studiedSecs,
        ts: Date.now()
      });
    }
    if (((item.status === 'skipped' ? item.skippedSeconds : item.remainingSeconds) === 0) && item.targetSeconds > 0) {
      item.status = 'done';
      item.lastPendingSeconds = 0;
      item.skippedSeconds = 0;
      logCycleStat({ materiaId: item.materiaId || null, materiaNome: item.nome, targetSeconds: item.targetSeconds, studiedSeconds: item.targetSeconds, skippedSeconds: 0, concluida: true, round: data.round, origem: 'ciclo_timer' });
      data = advanceCycle(data, index);
    } else if (item.status !== 'skipped') item.status = 'pending';
    saveCycle(data);
    if (typeof window.renderCrono === 'function') window.renderCrono();
    return data;
  }

  window.CTCycle = {
    getData: function (options) { return getCycleData(options || {}); },
    handleTimerSave: function (payload) { return syncCycleSession(payload); },
    finalizeItem: function (itemId) { return finalizeCycleItem(itemId); },
    openTimerForItem: function (item) { openCycleTimer(item); },
    restart: function () { return restartCycle(getCycleData({ skipAutoRestart: true })); },
    refundCycleTime: function (itemId, sec, sessaoId) { return refundCycleTime(itemId, sec, sessaoId); }
  };
  var cycleTimer = {
    preset: null,
    pending: null,
    bound: false
  };
  
  function refundCycleTime(itemId, secondsToRefund, sessaoId) {
    var data = getCycleData({ skipAutoRestart: true });
    
    if (sessaoId && Array.isArray(data.sessionHistory)) {
      data.sessionHistory = data.sessionHistory.filter(function(s) { return s.id !== sessaoId; });
    }
    
    var index = data.items.findIndex(function (item) { return item.id === itemId; });
    if (index < 0) return;
    
    var item = data.items[index];
    if (item.status === 'done') {
      item.status = 'pending';
      data.currentIndex = index;
    }
    
    var r = typeof item.remainingSeconds === 'number' ? item.remainingSeconds : item.targetSeconds;
    item.remainingSeconds = Math.min(item.targetSeconds, r + secondsToRefund);
    
    saveCycle(data);
    if (typeof window.renderCrono === 'function') window.renderCrono();
  }
  function ensureTimerNodes() {
    var panel = document.getElementById('timerPopup');
    if (!panel) return null;
    var hint = document.getElementById('tpCycleHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'tpCycleHint';
      hint.style.cssText = 'display:none;margin-bottom:10px;padding:10px 12px;border-radius:10px;background:rgba(79,142,247,.12);border:1px solid rgba(79,142,247,.24);font-size:12px;color:var(--text2);line-height:1.45';
      var freePanel = document.getElementById('tpFreePanel');
      if (freePanel) freePanel.insertBefore(hint, freePanel.firstChild);
    }
    return {
      fab: document.getElementById('timerFab'),
      panel: panel,
      play: document.getElementById('tpBtnPlay'),
      stop: document.getElementById('tpBtnStop'),
      reset: document.getElementById('tpBtnReset'),
      close: document.getElementById('tpClose'),
      freeTime: document.getElementById('tpFreeTime'),
      freeStatus: document.getElementById('tpFreeStatus'),
      ring: document.getElementById('tpRingProg'),
      badge: document.getElementById('fabBadge'),
      tabFree: document.getElementById('tpTabFree'),
      matSelect: document.getElementById('tpMatSelect'),
      modalMat: document.getElementById('tpModalMateria'),
      modalSave: document.getElementById('tpBtnModalSave'),
      modalCancel: document.getElementById('tpBtnModalCancel'),
      clearWrap: document.getElementById('tpCycleClearWrap'),
      clearButton: document.getElementById('tpCycleClearBtn'),
      hint: hint
    };
  }
  function setTimerLocked(locked) {
    var nodes = ensureTimerNodes();
    if (!nodes) return;
    if (nodes.matSelect) nodes.matSelect.disabled = !!locked;
    if (nodes.modalMat) nodes.modalMat.disabled = !!locked;
  }
  function clearCycleTimer() {
    var state = getTimerState();
    state.cyclePreset = null;
    state.isRevisionCard = false;
    state.selectedTipo = '';
    saveTimerState(state);
    
    cycleTimer.preset = null;
    cycleTimer.pending = null;
    setTimerLocked(false);
    var nodes = ensureTimerNodes();
    if (nodes && nodes.hint) nodes.hint.style.display = 'none';
    if (nodes && nodes.clearWrap) nodes.clearWrap.style.display = 'none';
  }
  async function clearCycleTimerFromUser() {
    var state = getTimerState();
    var studiedSeconds = Math.max(0, parseInt(state.freeSeconds, 10) || 0);
    if (studiedSeconds > 0 && window.CT && typeof window.CT.confirm === 'function') {
      var ok = await window.CT.confirm('Limpar o cronometro regressivo do ciclo? O tempo atual nao sera registrado.', {
        title: 'Limpar cronometro',
        confirmLabel: 'Limpar'
      });
      if (!ok) return;
    }
    if (typeof window.clearTimerCycleMode === 'function') {
      window.clearTimerCycleMode();
    } else {
      state.freeRunning = false;
      state.freeSeconds = 0;
      state.lastTick = null;
      state.cyclePreset = null;
      state.isRevisionCard = false;
      state.selectedTipo = '';
      state.selectedMateria = '';
      state.selectedTopic = '';
      state.selectedSubtopic = '';
      saveTimerState(state);
      if (typeof window._refreshTimerState === 'function') window._refreshTimerState();
    }
    clearCycleTimer();
  }
  function syncCycleTimerUI() {
    var state = getTimerState();
    cycleTimer.preset = state.cyclePreset || null;
    
    var nodes = ensureTimerNodes();
    if (!nodes || !cycleTimer.preset) return;
    
    var studiedSeconds = Math.max(0, parseInt(state.freeSeconds, 10) || 0);
    var remainingSeconds = Math.max(0, cycleTimer.preset.startRemaining - studiedSeconds);
    var extraSeconds = Math.max(0, studiedSeconds - cycleTimer.preset.startRemaining);
    cycleTimer.pending = { itemId: cycleTimer.preset.itemId, materiaId: cycleTimer.preset.materiaId || '', studiedSeconds: studiedSeconds, remainingSeconds: remainingSeconds };
    
    var isRevision = !!state.isRevisionCard;
    
    if (nodes.matSelect && cycleTimer.preset.materiaId && !nodes.matSelect.disabled) {
      if (!isRevision) {
        nodes.matSelect.value = cycleTimer.preset.materiaId;
        nodes.matSelect.disabled = true;
        nodes.matSelect.dispatchEvent(new Event('change'));
      }
    }
    if (nodes.modalMat && cycleTimer.preset.materiaId && !nodes.modalMat.disabled) {
      if (!isRevision) {
        nodes.modalMat.value = cycleTimer.preset.materiaId;
        nodes.modalMat.disabled = true;
        nodes.modalMat.dispatchEvent(new Event('change'));
      }
    }
    
    // UI feedback in the popup (handled by timer-popup.js, but we can add meta info)
    if (nodes.hint) {
      nodes.hint.style.display = '';
      var extraLabel = extraSeconds > 0 ? '<br><span style="color:var(--accent);font-weight:800">+' + formatHMS(extraSeconds) + ' extra</span>' : '';
      nodes.hint.innerHTML = '<strong style="display:block;color:var(--text);margin-bottom:4px">Ciclo de estudos</strong>'
        + cycleTimer.preset.materiaNome + '<br>' + formatHMS(studiedSeconds) + ' estudado(s) de ' + formatHMS(cycleTimer.preset.startRemaining) + ' planejado(s)' + extraLabel;
    }
    if (nodes.clearWrap) nodes.clearWrap.style.display = 'block';
    if (nodes.clearButton) {
      nodes.clearButton.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          clearCycleTimerFromUser();
      };
    }
  }
  function openCycleTimer(item) {
    console.log('[CycleTimer] openCycleTimer called for:', item.nome);

    // Step 1: Find the timer panel and fab directly in the DOM
    var panel = document.getElementById('timerPopup');
    var fab = document.getElementById('timerFab');

    if (!panel) return;
    if (!fab) return;

    // Step 2: Set up the cycle preset
    var materiaId = item.materiaId || resolveMateriaId(item.nome) || '';
    cycleTimer.preset = {
      itemId: item.id,
      materiaId: materiaId,
      materiaNome: item.nome,
      startRemaining: item.remainingSeconds || item.targetSeconds,
      targetSeconds: item.targetSeconds
    };
    cycleTimer.pending = null;

    // Step 3: Update shared timer state in sessionStorage
    var state = getTimerState();
    state.mode = 'free';
    state.open = true;
    state.minimized = false;
    state.freeRunning = false;
    state.freeSeconds = 0;
    state.lastTick = null;
    state.selectedMateria = materiaId || '';
    
    state.selectedTopic = '';
    state.selectedSubtopic = '';
    var cronoConfig = getCronogramaConfig();
    if (cronoConfig.cicloModo === 'sugerido' && !isVirtualMateriaId(materiaId)) {
      var suggestedTopic = getNextUnstudiedTopicForSubject(materiaId);
      if (suggestedTopic) {
        state.selectedTopic = suggestedTopic.topicoId || '';
        state.selectedSubtopic = suggestedTopic.subtopicId || '';
      }
    }
    
    state.cyclePreset = cycleTimer.preset;
    
    // Special Logic for SIMULADO & REVISÃO
    var n = normName(item.nome);
    state.selectedTipo = 'Estudo'; // Default
    state.isRevisionCard = false;
    
    if (n === 'REVISAO') {
       state.selectedTipo = 'Revisão';
       state.isRevisionCard = true;
       state.selectedMateria = ''; // DON'T LOCK - let user choose
    } else if (n === 'SIMULADO') {
       state.selectedTipo = 'Simulado';
    }

    saveTimerState(state);

    // Step 4: Open the official popup flow when available, with direct DOM fallback.
    if (typeof window.setTimerMode === 'function') window.setTimerMode('free');
    if (typeof window.openTimerPopup === 'function') {
      window.openTimerPopup();
    } else {
      panel.style.display = 'block';
      panel.classList.remove('minimized');
      fab.style.display = 'flex';
    }

    // Step 5: Tell timer-popup.js to refresh its internal state from sessionStorage
    if (typeof window._refreshTimerState === 'function') {
      window._refreshTimerState();
    }

    // Step 6: Switch to Free mode tab
    var tabFree = document.getElementById('tpTabFree');
    var tabPomo = document.getElementById('tpTabPomo');
    var freePanel = document.getElementById('tpFreePanel');
    var pomoPanel = document.getElementById('tpPomoPanel');
    if (tabFree) { tabFree.classList.add('active'); }
    if (tabPomo) { tabPomo.classList.remove('active'); }
    if (freePanel) { freePanel.style.display = 'block'; }
    if (pomoPanel) { pomoPanel.style.display = 'none'; }

    // Step 7: Pre-select the materia in the dropdown
    var matSelect = document.getElementById('tpMatSelect');
    if (matSelect && materiaId) {
      matSelect.value = materiaId;
      matSelect.disabled = true;
      matSelect.dispatchEvent(new Event('change'));
    }
    var modalMat = document.getElementById('tpModalMateria');
    if (modalMat && materiaId) {
      modalMat.value = materiaId;
      modalMat.disabled = true;
    }

    console.log('[CycleTimer] Panel shown. Syncing UI...');
    syncCycleTimerUI();
  }
  function bindTimerBridge() {
    if (!document.getElementById('cronoGrid')) return;
    if (cycleTimer.bound) return;
    var nodes = ensureTimerNodes();
    if (!nodes || !nodes.play || !nodes.modalSave) {
      setTimeout(bindTimerBridge, 500);
      return;
    }
    cycleTimer.bound = true;
    nodes.play.addEventListener('click', function () { if (cycleTimer.preset) setTimeout(syncCycleTimerUI, 30); });
    nodes.stop.addEventListener('click', function () { if (cycleTimer.preset) setTimeout(syncCycleTimerUI, 30); });
    nodes.reset.addEventListener('click', function () {
      if (!cycleTimer.preset) return;
      setTimeout(function () {
        var state = getTimerState();
        state.freeRunning = false;
        state.freeSeconds = 0;
        state.lastTick = null;
        saveTimerState(state);
        syncCycleTimerUI();
      }, 0);
    });
    nodes.modalSave.addEventListener('click', function () {
      if (!cycleTimer.preset || !cycleTimer.pending) return;
      setTimeout(function () {
        clearCycleTimer();
      }, 0);
    });
    nodes.modalCancel.addEventListener('click', function () { if (cycleTimer.preset) setTimeout(clearCycleTimer, 0); });
    window.setInterval(syncCycleTimerUI, 250);
  }

  function ensureCronoStyles() {
    if (document.getElementById('cronoCycleStyles')) return;
    var style = document.createElement('style');
    style.id = 'cronoCycleStyles';
    style.textContent = ''
      + '.crono-flip-scene{position:relative;flex:1;min-height:0;perspective:1800px;}'
      + '.crono-flip-card{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.22,.61,.36,1);}'
      + '.crono-flip-card.is-back{transform:rotateY(180deg);}'
      + '.crono-face{position:absolute;inset:0;display:flex;flex-direction:column;gap:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;}'
      + '.crono-face.back{transform:rotateY(180deg);}'
      + '.crono-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:4px;}'
      + '.crono-scroll::-webkit-scrollbar{width:6px;}'
      + '.crono-scroll::-webkit-scrollbar-track{background:transparent;}'
      + '.crono-scroll::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px;}'
      + '.crono-scroll::-webkit-scrollbar-thumb:hover{background:var(--text3);}'
      + '.crono-chip-full{white-space:normal;line-height:1.2;max-width:100%;}'
      + '.crono-cycle-palette{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;padding:12px;border-radius:12px;background:var(--bg3);border:1px solid var(--border);}'
      + '.crono-cycle-chip{background:var(--cor);border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);cursor:pointer;display:flex;align-items:flex-start;gap:8px;user-select:none;max-width:100%;transition:transform .15s ease;text-transform:uppercase;}'
      + '.crono-cycle-chip:hover{transform:scale(1.02);box-shadow:0 4px 12px rgba(0,0,0,0.2);}'
      + '.crono-cycle-list{display:flex;flex-direction:column;gap:6px;}'
      + '.crono-cycle-card{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr) 90px;gap:8px;align-items:center;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:4px 8px;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease,opacity .15s ease;}'
      + '.crono-cycle-card.current{border-color:var(--accent);box-shadow:0 0 0 1px rgba(79,142,247,.18);}'
      + '.crono-cycle-card.done{border-color:rgba(62,207,142,.45);background:rgba(62,207,142,.07);}'
      + '.crono-cycle-card.skipped{border-color:rgba(245,200,66,.45);}'
      + '.crono-cycle-card.drag-over{border-color:var(--accent2);box-shadow:0 0 0 1px rgba(124,92,252,.24);}'
      + '.crono-cycle-card.dragging{opacity:.42;transform:scale(.985);border-color:var(--accent);box-shadow:0 0 0 2px rgba(79,142,247,.18);}'
      + '.crono-cycle-placeholder{min-height:44px;border:1.5px dashed var(--accent);border-radius:8px;background:rgba(79,142,247,.10);box-shadow:inset 0 0 0 1px rgba(79,142,247,.08);display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;}'
      + '.crono-cycle-slot{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:999px;background:rgba(255,255,255,.05);font-size:9px;font-weight:700;color:var(--text2);}'
      + '.crono-cycle-left{min-width:0;}'
      + '.crono-cycle-name{font-size:11px;font-weight:700;color:var(--text);line-height:1.15;word-break:break-word;padding-right:12px;text-transform:uppercase;}'
      + '.crono-cycle-meta{font-size:10px;color:var(--text3);margin-top:2px;line-height:1.2;}'
      + '.crono-cycle-right{display:flex;justify-content:flex-end;}'
      + '.crono-cycle-right input{width:90px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;padding:2px 6px;color:var(--text);font-size:10px;font-family:var(--mono);outline:none;text-align:center;height:20px;}'
      + '.crono-cycle-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:700;margin-top:4px;}'
      + '.crono-cycle-badge.current{background:rgba(79,142,247,.14);color:var(--accent);}'
      + '.crono-cycle-badge.done{background:rgba(62,207,142,.14);color:var(--green);}'
      + '.crono-cycle-badge.skipped{background:rgba(245,200,66,.14);color:var(--yellow);}'
      + '.crono-cycle-drop-end{padding:12px;border:1px dashed var(--border);border-radius:12px;text-align:center;font-size:11px;color:var(--text3);margin-top:2px;}'
      + '.crono-cycle-drop-end.drag-over{border-color:var(--accent2);color:var(--accent2);}'
      + '.crono-dash-row{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);margin-bottom:0;position:relative;z-index:2;box-shadow:0 1px 3px rgba(0,0,0,0.2);transition:transform .2s ease;}'
      + '.crono-dash-row:hover{transform:translateY(-1px);}'
      + '.crono-dash-row.current{border-color:var(--accent);box-shadow:0 0 0 1px rgba(79,142,247,.25);}'
      + '.crono-dash-row.done{border-color:rgba(62,207,142,.4);background:rgba(62,207,142,.08);}'
      + '.crono-dash-row.skipped{border-color:rgba(245,200,66,.35);}'
      + '.crono-dash-order{width:26px;height:26px;border-radius:999px;background:rgba(255,255,255,.06);text-shadow:0 1px 2px rgba(0,0,0,0.5);border:2px solid var(--bg3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text2);flex-shrink:0;z-index:3;}'
      + '.crono-dash-name{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--text);line-height:1.25;word-break:break-word;text-transform:uppercase;}'
      + '.crono-dash-time{border:none;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;background:rgba(79,142,247,.14);color:var(--accent);flex-shrink:0;display:flex;align-items:center;gap:6px;transition:all .2s ease;}'
      + '.crono-dash-time:hover{background:var(--accent);color:#fff;}'
      + '.crono-dash-time.done{background:rgba(62,207,142,.16);color:#27a06b;}'
      + '.crono-dash-time.done:hover{background:var(--green);color:#fff;}'
      + '.crono-dash-empty{font-size:12px;color:var(--text3);text-align:center;padding:16px 8px;}'
      + '@media (max-width:680px){.crono-cycle-card{grid-template-columns:26px minmax(0,1fr);} .crono-cycle-right{grid-column:1 / -1;justify-content:stretch;} .crono-cycle-right input{width:100%;}}';
    document.head.appendChild(style);
  }
  function patchCronoGridNames() {
    var chips = document.querySelectorAll('#cronoGrid [title*="clique"]');
    chips.forEach(function (chip) {
      var fullName = (chip.title || '').split(' - ')[0].split(' — ')[0].trim();
      if (!fullName) return;
      var prefix = '';
      if ((chip.textContent || '').trim().startsWith('✓')) prefix = '✓ ';
      if ((chip.textContent || '').trim().startsWith('✗')) prefix = '✗ ';
      chip.textContent = prefix + fullName;
      chip.style.whiteSpace = 'normal';
      chip.style.textOverflow = 'clip';
      chip.style.lineHeight = '1.2';
      chip.style.padding = '4px 6px';
      chip.style.minHeight = '30px';
    });
  }
  function removeSmartShareControls(header) {
    var wrap = header && header.querySelector('.smart-share-wrap');
    if (wrap) wrap.remove();
    var card = header && header.closest ? header.closest('.dashboard-crono-card') : null;
    if (card) card.classList.remove('smart-share-enabled');
  }

  function ensureSmartShareControls(header, mainButton) {
    if (!header) return;
    var card = header.closest ? header.closest('.dashboard-crono-card') : null;
    if (card) card.classList.add('smart-share-enabled');
    var wrap = header.querySelector('.smart-share-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'smart-share-wrap';
      wrap.innerHTML = ''
        + '<button class="smart-share-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Compartilhar estudos de hoje">'
        + '<span class="smart-share-icon">↗</span><span class="smart-share-label">Compartilhar</span>'
        + '</button>'
        + '<div class="smart-share-menu" role="menu">'
        + '<button class="smart-share-option" type="button" data-smart-share="pdf" role="menuitem"><span>Gerar PDF</span><small>Estudos de hoje</small></button>'
        + '<button class="smart-share-option" type="button" data-smart-share="whatsapp_pdf" role="menuitem"><span>Enviar PDF por WhatsApp</span><small>Anexo pronto</small></button>'
        + '<button class="smart-share-option" type="button" data-smart-share="telegram_pdf" role="menuitem"><span>Enviar PDF por Telegram</span><small>Anexo pronto</small></button>'
        + '<button class="smart-share-option" type="button" data-smart-share="copy" role="menuitem"><span>Copiar resumo</span><small>Texto simples</small></button>'
        + '</div>';

      var toggle = wrap.querySelector('.smart-share-btn');
      var menu = wrap.querySelector('.smart-share-menu');
      toggle.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      wrap.querySelectorAll('[data-smart-share]').forEach(function (option) {
        option.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          menu.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          smartShareToday(option.getAttribute('data-smart-share'));
        });
      });

      if (!window.__smartShareGlobalClose) {
        window.__smartShareGlobalClose = true;
        document.addEventListener('click', function () {
          document.querySelectorAll('.smart-share-menu.open').forEach(function (openMenu) {
            openMenu.classList.remove('open');
            var btn = openMenu.parentElement && openMenu.parentElement.querySelector('.smart-share-btn');
            if (btn) btn.setAttribute('aria-expanded', 'false');
          });
        });
      }
    }

    if (mainButton && mainButton.parentElement === header && wrap.parentElement !== header) {
      header.insertBefore(wrap, mainButton);
    } else if (wrap.parentElement !== header) {
      header.appendChild(wrap);
    }
  }

  function updateDashboardCardHeader() {
    var grid = document.getElementById('cronoGrid');
    if (!grid || !grid.parentElement) return;
    var header = grid.parentElement.querySelector('.card-header');
    if (!header) return;
    var title = header.querySelector('.card-title');
    var button = header.querySelector('[data-crono-main-action="1"]') || header.querySelector('button');
    if (button) button.setAttribute('data-crono-main-action', '1');
    if (getSmartAgendadoConfig()) {
      if (title) title.textContent = 'Estudos de Hoje';
      if (button) {
        button.textContent = 'Abrir';
        button.onclick = function () { window.location.href = 'cronograma_inteligente.html'; };
      }
      removeSmartShareControls(header);
      return;
    }
    removeSmartShareControls(header);
    var mode = getViewMode();
    if (button) button.onclick = function () { window.abrirModalCrono(); };
    if (title) title.innerHTML = mode === 'cycle' ? '🔄 Ciclo de estudos' : '📅 Cronograma semanal';
    if (button) button.textContent = mode === 'cycle' ? '✏️ Editar ciclo' : '✏️ Editar';
  }
  function renderCycleDashboard() {
    ensureCronoStyles();
    var grid = document.getElementById('cronoGrid');
    if (!grid) return;
    grid.setAttribute('data-dashboard-mode', 'cycle');
    grid.innerHTML = '';
    var data = getCycleData();
    if (!data.items.length) {
      grid.innerHTML = '<div style="padding: 24px 16px; text-align: center; color: var(--text3); font-size: 13px; font-weight: 500; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: linear-gradient(135deg, rgba(79, 142, 247, 0.08), rgba(62, 207, 142, 0.04)); border: 1px solid rgba(79, 142, 247, 0.2); border-radius: 12px; margin: 8px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">' +
        '<span style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">📅</span>' +
        '<span style="color: var(--text); font-weight: 800; font-size: 15px; letter-spacing: -0.2px;">Monte seu Cronograma Inteligente</span>' +
        '<span style="font-size: 12px; color: var(--text2); max-width: 290px; line-height: 1.5; margin: 0 auto;">Organize seus estudos de forma automática por tópicos do edital ou utilize o Ciclo de Estudos personalizado.</span>' +
        '<button onclick="location.href=\'cronograma_inteligente.html\'" class="btn primary" style="padding: 8px 20px; font-weight: 700; border-radius: 8px; font-size: 12px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 10px rgba(79, 142, 247, 0.3);">✨ Começar Agora</button>' +
        '</div>';
      updateDashboardCardHeader();
      return;
    }
    var cycleComplete = data.items.some(function (item) { return item.targetSeconds > 0; })
      && !data.items.some(function (item) { return item.status === 'pending' && item.targetSeconds > 0; });
    var pathWrapper = document.createElement('div');
    pathWrapper.style.cssText = 'position:relative;margin:8px 0;padding-right:24px;';
    
    var leftLine = document.createElement('div');
    leftLine.style.cssText = 'position:absolute;top:20px;bottom:20px;left:24px;width:0;border-left:2px dashed var(--text3);pointer-events:none;opacity:0.6;z-index:1;';
    var leftHead = document.createElement('div');
    leftHead.style.cssText = 'position:absolute;bottom:-2px;left:-6px;width:10px;height:10px;border-bottom:2px solid var(--text3);border-right:2px solid var(--text3);transform:rotate(45deg);';
    leftLine.appendChild(leftHead);
    pathWrapper.appendChild(leftLine);
    
    var returnArrow = document.createElement('div');
    returnArrow.style.cssText = 'position:absolute;top:20px;bottom:20px;right:0;width:30px;border-top:2px dashed var(--text3);border-right:2px dashed var(--text3);border-bottom:2px dashed var(--text3);border-radius:0 16px 16px 0;pointer-events:none;opacity:0.6;';
    var returnHead = document.createElement('div');
    returnHead.style.cssText = 'position:absolute;top:-6px;right:12px;width:10px;height:10px;border-top:2px solid var(--text3);border-left:2px solid var(--text3);transform:rotate(-45deg);';
    var returnHeadOut = document.createElement('div');
    returnHeadOut.style.cssText = 'position:absolute;bottom:-6px;left:-2px;width:10px;height:10px;border-bottom:2px solid var(--text3);border-right:2px solid var(--text3);transform:rotate(-45deg);';
    returnArrow.appendChild(returnHead);
    returnArrow.appendChild(returnHeadOut);
    pathWrapper.appendChild(returnArrow);
    
    var itemsContainer = document.createElement('div');
    itemsContainer.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:column;gap:6px;';

    data.items.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'crono-dash-row'
        + (idx === data.currentIndex && item.status === 'pending' && item.targetSeconds > 0 ? ' current' : '')
        + (item.status === 'done' ? ' done' : '')
        + (item.status === 'skipped' ? ' skipped' : '');
      
      var order = document.createElement('div');
      order.className = 'crono-dash-order';
      order.textContent = String(idx + 1).padStart(2, '0');
      
      var name = document.createElement('div');
      name.className = 'crono-dash-name';
      name.style.position = 'relative';
      name.style.zIndex = '4';
      if (!isVirtualMateriaId(item.materiaId)) {
        name.title = 'Abrir aba da matéria';
        name.style.cursor = 'pointer';
        name.style.textDecoration = 'none';
        name.tabIndex = 0;
        name.setAttribute('role', 'button');
        name.onclick = function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          openMateriaTab(item.materiaId);
        };
        name.onkeydown = function (e) {
          if (!e) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openMateriaTab(item.materiaId);
          }
        };
      }
      var isCurrent = idx === data.currentIndex && item.status === 'pending' && item.targetSeconds > 0;
      var cronoConfig = getCronogramaConfig();
      var suggestedTopic = null;
      if (isCurrent && cronoConfig.cicloModo === 'sugerido') {
        suggestedTopic = getNextUnstudiedTopicForSubject(item.materiaId);
      }

      if (suggestedTopic) {
        name.style.display = 'flex';
        name.style.flexDirection = 'column';
        name.style.gap = '3px';
        name.style.textTransform = 'none';

        var subjectSpan = document.createElement('span');
        subjectSpan.style.cssText = 'font-size:13px;font-weight:700;text-transform:uppercase;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);';
        subjectSpan.textContent = (item.status === 'done' ? '✅ ' : '') + item.nome;
        name.appendChild(subjectSpan);

        var topicBtn = document.createElement('div');
        topicBtn.style.cssText = 'font-size:10px;font-weight:700;color:var(--yellow);cursor:pointer;line-height:1.2;text-align:left;text-shadow:0 1px 2px rgba(0,0,0,0.8);display:inline-flex;align-items:center;gap:4px;word-break:break-word;margin-top:2px;';
        topicBtn.innerHTML = '<span>🎯 Sugerido: ' + escapeHtml(suggestedTopic.fullLabel) + '</span>';
        topicBtn.onclick = function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          openMateriaTab(item.materiaId, suggestedTopic.topicoId, suggestedTopic.subtopicId);
        };
        name.appendChild(topicBtn);
      } else {
        name.textContent = (item.status === 'done' ? '✅ ' : '') + item.nome;
      }
      
      var timeBtn = document.createElement('button');
      timeBtn.type = 'button';
      timeBtn.className = 'crono-dash-time' + (item.status === 'done' ? ' done' : '');
      timeBtn.style.position = 'relative';
      timeBtn.style.zIndex = '4';
      timeBtn.innerHTML = '<span style="font-size:12px;opacity:0.9">⏱️</span> ' + (item.targetSeconds ? formatCycleClock(item.status === 'pending' ? item.remainingSeconds || item.targetSeconds : 0) : 'Definir');
      timeBtn.title = item.targetSeconds ? 'Clique para abrir o cronometro dessa materia' : 'Defina as horas primeiro no ciclo de estudos';

      if (item.cor) {
        row.style.background = item.cor;
        row.style.borderColor = 'rgba(0,0,0,0.1)';
        
        name.style.color = '#fff';
        name.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';
        
        order.style.background = 'rgba(0,0,0,0.15)';
        order.style.color = '#fff';
        order.style.borderColor = 'rgba(255,255,255,0.2)';
        order.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
        
        timeBtn.style.background = 'rgba(0,0,0,0.2)';
        timeBtn.style.color = '#fff';
        timeBtn.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
        timeBtn.onmouseover = function() { timeBtn.style.background = 'rgba(0,0,0,0.35)'; };
        timeBtn.onmouseout = function() { timeBtn.style.background = 'rgba(0,0,0,0.2)'; };
      }

      if (item.status === 'done' || item.status === 'skipped') {
        row.style.filter = 'saturate(0.65) brightness(0.78)';
      }

      timeBtn.onclick = function (e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        console.log('[CycleTimer] Click detected for:', item.nome);
        if (!item.targetSeconds) {
           if (typeof window.abrirModalCrono === 'function') window.abrirModalCrono();
           return;
        }
        // Force pop-up to show
        openCycleTimer(item);
      };
      var actsWrap = document.createElement('div');
      actsWrap.style.cssText = 'display:flex;gap:6px;align-items:stretch;position:relative;z-index:4;';
      
      var manBtn = document.createElement('button');
      manBtn.type = 'button';
      manBtn.innerHTML = '📝';
      manBtn.title = 'Lançamento manual de estudo e questões';
      manBtn.style.cssText = 'background:rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.05); color:#fff; border-radius:8px; width:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:14px; transition:0.2s';
      manBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.2)'; };
      manBtn.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.15)'; };
      
      if (!item.targetSeconds) manBtn.style.display = 'none';
      if (item.status === 'done' || item.status === 'skipped') manBtn.style.display = 'none';
      
      manBtn.onclick = function() {
        openManualEntryModal(item);
      };

      actsWrap.appendChild(timeBtn);
      actsWrap.appendChild(manBtn);
      row.appendChild(order);
      row.appendChild(name);
      row.appendChild(actsWrap);
      itemsContainer.appendChild(row);
    });
    pathWrapper.appendChild(itemsContainer);
    grid.appendChild(pathWrapper);

    if (cycleComplete) {
      var completeBox = document.createElement('div');
      completeBox.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;background:rgba(62,207,142,0.08);border:1px solid rgba(62,207,142,0.35);border-radius:12px;margin-top:10px;color:var(--text);';
      completeBox.innerHTML = '<div style="min-width:0;"><strong style="display:block;font-size:13px;color:var(--green);margin-bottom:2px;">Ciclo concluido</strong><span style="font-size:11px;color:var(--text3);">Confira suas estatísticas desse Ciclo de Estudos antes de iniciar um novo ciclo.</span></div>';
      var restartBtn = document.createElement('button');
      restartBtn.type = 'button';
      restartBtn.textContent = 'Iniciar Próximo Ciclo';
      restartBtn.style.cssText = 'border:1px solid rgba(62,207,142,0.55);background:rgba(62,207,142,0.16);color:var(--green);border-radius:8px;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;';
      restartBtn.onclick = async function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (await window.CT.confirm('Iniciar o próximo ciclo agora? O resumo atual será zerado para a nova rodada.', {
          title: 'Iniciar Próximo Ciclo',
          confirmLabel: 'Iniciar',
        })) {
          restartCycle(data);
        }
      };
      completeBox.appendChild(restartBtn);
      grid.appendChild(completeBox);
    }

    var totalTarget = 0;
    var totalStudied = 0;
    data.items.forEach(function (item) {
      if (item.targetSeconds) totalTarget += item.targetSeconds;
    });
    totalStudied = (data.sessionHistory || []).reduce(function(acc, s) { return acc + (s.duracao || 0); }, 0);

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;margin-top:10px;color:var(--text);font-size:13px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.2);';
    
    var leftStats = document.createElement('div');
    leftStats.innerHTML = '<span style="color:var(--text3);font-size:10px;font-weight:800;letter-spacing:0.5px">CARGA ESTUDADA</span><br><span id="cycleCargaEstudadaValue" class="crono-cycle-studied-value" style="font-size:15px;color:var(--accent)">⏱️ ' + formatCycleClock(totalStudied) + '</span>';
    
    var rightStats = document.createElement('div');
    rightStats.style.textAlign = 'right';
    rightStats.innerHTML = '<span style="color:var(--text3);font-size:10px;font-weight:800;letter-spacing:0.5px">META DO CICLO</span><br><span id="cycleMetaValue" class="crono-cycle-target-value" style="font-size:15px;color:var(--green)">🎯 ' + formatCycleClock(totalTarget) + '</span>';

    var progressWrapper = document.createElement('div');
    progressWrapper.style.cssText = 'flex:1;margin:0 24px;height:6px;background:var(--bg2);border:1px solid var(--border2);border-radius:999px;position:relative;overflow:hidden;';
    var pct = totalTarget > 0 ? Math.min(100, Math.max(0, (totalStudied / totalTarget) * 100)) : 0;
    var progressBar = document.createElement('div');
    progressBar.style.cssText = 'position:absolute;inset:0;width:' + pct + '%;background:var(--accent);border-radius:999px;transition:width 0.5s ease;';
    progressWrapper.appendChild(progressBar);

    footer.appendChild(leftStats);
    footer.appendChild(progressWrapper);
    footer.appendChild(rightStats);

    footer.style.cursor = 'pointer';
    footer.title = 'Ver carga estudada por materia';
    footer.addEventListener('mouseover', function() { footer.style.background = 'var(--bg2)'; footer.style.borderColor = 'var(--accent)'; });
    footer.addEventListener('mouseout', function() { footer.style.background = 'var(--bg3)'; footer.style.borderColor = 'var(--border)'; });
    footer.addEventListener('click', function() {
      openCycleSessionsModal(data);
    });

    grid.appendChild(footer);

    updateDashboardCardHeader();
  }

  function buildCycleLoadSummary(data) {
    var history = Array.isArray(data && data.sessionHistory) ? data.sessionHistory : [];
    var studiedByItem = {};
    history.forEach(function (session) {
      if (!session || !session.itemId) return;
      studiedByItem[session.itemId] = (studiedByItem[session.itemId] || 0) + Math.max(0, parseInt(session.duracao, 10) || 0);
    });

    var rows = (data && data.items || []).filter(function (item) {
      return item && Math.max(0, parseInt(item.targetSeconds, 10) || 0) > 0;
    }).map(function (item, index) {
      var target = Math.max(0, parseInt(item.targetSeconds, 10) || 0);
      var remaining = Math.max(0, item.remainingSeconds == null ? target : parseInt(item.remainingSeconds, 10) || 0);
      var skipped = Math.max(0, parseInt(item.skippedSeconds || item.lastPendingSeconds, 10) || 0);
      var inferredStudied = item.status === 'skipped'
        ? Math.max(0, target - skipped)
        : Math.max(0, target - remaining);
      var studied = Math.max(studiedByItem[item.id] || 0, inferredStudied);
      return {
        id: item.id,
        index: index + 1,
        nome: item.nome || 'Materia',
        cor: item.cor || 'var(--accent)',
        target: target,
        studied: studied,
        diff: studied - target,
        remaining: Math.max(0, target - studied),
        status: item.status || 'pending'
      };
    });

    return {
      rows: rows,
      target: rows.reduce(function (acc, row) { return acc + row.target; }, 0),
      studied: rows.reduce(function (acc, row) { return acc + row.studied; }, 0)
    };
  }

  function cyclePctText(pct) {
    return pct == null ? '-' : pct + '%';
  }

  function cycleStatCard(label, value, sub, color) {
    return '<div style="background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px;min-width:0;">'
      + '<div style="font-size:10px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:var(--text3);margin-bottom:4px;">' + label + '</div>'
      + '<div style="font-family:var(--mono);font-size:17px;font-weight:900;color:' + (color || 'var(--text)') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(value) + '</div>'
      + (sub ? '<div style="font-size:10px;color:var(--text3);margin-top:3px;line-height:1.25;">' + sub + '</div>' : '')
      + '</div>';
  }

  function cycleBarRows(rows, valueFn, maxValue, emptyText) {
    if (!rows || !rows.length) return '<div style="color:var(--text3);font-size:12px;text-align:center;padding:14px">' + escapeHtml(emptyText || 'Sem dados neste ciclo.') + '</div>';
    return rows.map(function (row) {
      var value = Math.max(0, valueFn(row) || 0);
      var target = Math.max(0, parseInt(row.targetSeconds, 10) || 0);
      var hasTarget = target > 0 && maxValue > 0;
      var barHtml = '';
      if (hasTarget) {
        var studiedPct = Math.max(0, Math.min(100, (value / maxValue) * 100));
        var targetPct = Math.max(0, Math.min(100, (target / maxValue) * 100));
        var basePct = Math.min(studiedPct, targetPct);
        var extraPct = Math.max(0, studiedPct - targetPct);
        var underTargetFinalized = value < target && (row.status === 'skipped' || row.status === 'done' || row.finalizado);
        var baseColor = underTargetFinalized ? 'var(--red)' : 'var(--accent)';
        barHtml = '<div style="height:6px;background:var(--bg2);border-radius:999px;position:relative;overflow:visible;margin-top:5px;">'
          + '<div style="position:absolute;left:0;top:0;height:100%;width:' + basePct.toFixed(2) + '%;background:' + baseColor + ';border-radius:999px;"></div>'
          + (extraPct > 0 ? '<div style="position:absolute;left:' + targetPct.toFixed(2) + '%;top:0;height:100%;width:' + extraPct.toFixed(2) + '%;background:var(--green);border-radius:0 999px 999px 0;"></div>' : '')
          + '<div title="Meta da matéria" style="position:absolute;left:' + targetPct.toFixed(2) + '%;top:-3px;width:2px;height:12px;background:rgba(241,244,251,.96);border-radius:999px;box-shadow:0 0 0 1px rgba(0,0,0,.35);transform:translateX(-1px);"></div>'
          + '</div>';
      } else {
        var pct = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0;
        barHtml = '<div style="height:6px;background:var(--bg2);border-radius:999px;overflow:hidden;margin-top:5px;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:999px;"></div></div>';
      }
      return '<div style="display:grid;grid-template-columns:minmax(0,1fr) 82px;gap:10px;align-items:center;margin-bottom:8px;">'
        + '<div style="min-width:0;">'
        + '<div style="font-size:12px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(row.nome || row.materiaNome || 'Item') + '</div>'
        + barHtml
        + '</div>'
        + '<div style="text-align:right;font-family:var(--mono);font-size:12px;font-weight:900;color:var(--text2);">' + escapeHtml(row.valueLabel || '') + '</div>'
        + '</div>';
    }).join('');
  }

  function buildCycleAnalyticsHtml(snapshot) {
    if (!snapshot) return '';
    var comp = snapshot.comparison || null;
    var compareParts = [];
    if (comp) {
      if (comp.daysToReachDelta != null) {
        compareParts.push(comp.daysToReachDelta < 0
          ? 'atingiu 100% da meta ' + Math.abs(comp.daysToReachDelta) + ' dia(s) mais rápido que no ciclo anterior'
          : (comp.daysToReachDelta > 0 ? 'levou ' + comp.daysToReachDelta + ' dia(s) a mais para bater a meta' : 'bateu a meta no mesmo ritmo do ciclo anterior'));
      }
      if (comp.questoesDelta) compareParts.push((comp.questoesDelta > 0 ? '+' : '') + comp.questoesDelta + ' questões em relação ao ciclo anterior');
      if (comp.pctDelta != null) compareParts.push((comp.pctDelta > 0 ? '+' : '') + comp.pctDelta + ' p.p. na taxa de acerto');
      if (comp.paginasDelta) compareParts.push((comp.paginasDelta > 0 ? '+' : '') + comp.paginasDelta + ' páginas lidas');
      if (comp.videoDelta) compareParts.push((comp.videoDelta > 0 ? '+' : '') + comp.videoDelta + ' min de videoaulas');
    }
    var headline = 'Você completou ' + snapshot.goalPct + '% da meta do ciclo'
      + (snapshot.daysToReach ? ' e atingiu 100% em ' + snapshot.daysToReach + ' dia(s)' : '')
      + '.';
    var compareText = compareParts.length ? compareParts.join(' | ') : (comp ? 'Sem variações relevantes contra o ciclo anterior.' : 'Este ciclo será a base de comparação para os próximos.');

    var topStudy = (snapshot.materias || [])
      .filter(function (m) { return m.studiedSeconds > 0; })
      .sort(function (a, b) { return b.studiedSeconds - a.studiedSeconds; })
      .slice(0, 5)
      .map(function (m) {
        return {
          nome: m.nome,
          valueLabel: formatCycleClock(m.studiedSeconds),
          studiedSeconds: m.studiedSeconds,
          targetSeconds: m.targetSeconds || 0,
          status: m.status || 'pending',
          finalizado: snapshot.status === 'complete'
        };
      });
    var maxStudy = topStudy.reduce(function (acc, row) { return Math.max(acc, row.studiedSeconds || 0, row.targetSeconds || 0); }, 0);
    var topQuestions = (snapshot.materias || [])
      .filter(function (m) { return m.questoes && m.questoes.resolvidas > 0; })
      .sort(function (a, b) { return (b.questoes.resolvidas || 0) - (a.questoes.resolvidas || 0); })
      .slice(0, 5)
      .map(function (m) { return { nome: m.nome, valueLabel: (m.questoes.resolvidas || 0) + ' q | ' + cyclePctText(m.questoes.pct), resolvidas: m.questoes.resolvidas || 0 }; });
    var maxQuestions = topQuestions.reduce(function (acc, row) { return Math.max(acc, row.resolvidas); }, 0);
    var focoTopicos = (snapshot.recommendations && snapshot.recommendations.focoTopicos || []).slice(0, 4);
    var lapidarTopicos = (snapshot.recommendations && snapshot.recommendations.lapidarTopicos || []).slice(0, 4);

    function topicList(rows, emptyText) {
      if (!rows.length) return '<div style="color:var(--text3);font-size:12px;line-height:1.4">' + escapeHtml(emptyText) + '</div>';
      return rows.map(function (t) {
        return '<div style="padding:8px 0;border-top:1px solid rgba(255,255,255,.06)">'
          + '<div style="font-size:12px;font-weight:800;color:var(--text);line-height:1.25;">' + escapeHtml(t.nome) + '</div>'
          + '<div style="font-size:10px;color:var(--text3);margin-top:2px;">' + escapeHtml(t.materiaNome || '') + ' | ' + (t.questoes.resolvidas || 0) + ' questões | ' + cyclePctText(t.questoes.pct) + ' acerto' + (t.motivo ? ' | ' + escapeHtml(t.motivo) : '') + '</div>'
          + '</div>';
      }).join('');
    }

    return '<div style="background:linear-gradient(135deg,rgba(79,142,247,.10),rgba(62,207,142,.06));border:1px solid rgba(79,142,247,.24);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:12px;">'
      + '<div><div style="font-size:13px;font-weight:900;color:var(--text);margin-bottom:4px;">Estatísticas deste Ciclo de Estudos</div>'
      + '<div style="font-size:12px;color:var(--text2);line-height:1.45;">' + headline + ' ' + compareText + '</div></div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;">'
      + cycleStatCard('Meta', snapshot.goalPct + '%', formatCycleClock(snapshot.studiedSeconds) + ' de ' + formatCycleClock(snapshot.targetSeconds), 'var(--green)')
      + cycleStatCard('Questões', String(snapshot.questoes.resolvidas || 0), cyclePctText(snapshot.questoes.pct) + ' de acerto', 'var(--yellow)')
      + cycleStatCard('Páginas', String(snapshot.metricas.paginasPdf || 0), 'PDF/Livro', 'var(--accent)')
      + cycleStatCard('Videoaulas', (snapshot.metricas.videoMinutos || 0) + ' min', 'assistidos', 'var(--accent2)')
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">'
      + '<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;"><div style="font-size:11px;font-weight:900;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;">O que mais estudou</div>' + cycleBarRows(topStudy, function (r) { return r.studiedSeconds; }, maxStudy, 'Sem horas registradas.') + '</div>'
      + '<div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;"><div style="font-size:11px;font-weight:900;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;">Questões e acertos por matéria</div>' + cycleBarRows(topQuestions, function (r) { return r.resolvidas; }, maxQuestions, 'Sem questões registradas.') + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">'
      + '<div style="background:rgba(245,90,90,.055);border:1px solid rgba(245,90,90,.18);border-radius:12px;padding:12px;"><div style="font-size:11px;font-weight:900;color:var(--red);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px;">Tópicos para focar</div>' + topicList(focoTopicos, 'Nenhum tópico crítico detectado neste ciclo.') + '</div>'
      + '<div style="background:rgba(62,207,142,.055);border:1px solid rgba(62,207,142,.18);border-radius:12px;padding:12px;"><div style="font-size:11px;font-weight:900;color:var(--green);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px;">Tópicos para lapidar</div>' + topicList(lapidarTopicos, 'Nenhum tópico acima de 90% ainda.') + '</div>'
      + '</div>'
      + '</div>';
  }

  function openCycleSessionsModal(data) {
    var overlay = document.getElementById('cycleSessOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cycleSessOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;animation: popIn 0.2s ease;';
      document.body.appendChild(overlay);
    } else {
      overlay.innerHTML = '';
      overlay.style.display = 'flex';
    }

    var panel = document.createElement('div');
    panel.style.cssText = 'width:760px;max-width:100%;max-height:88vh;background:var(--bg2);border:1px solid var(--border2);border-radius:16px;display:flex;flex-direction:column;box-shadow:0 10px 50px rgba(0,0,0,0.6);overflow:hidden;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--bg3);';
    header.innerHTML = '<span style="font-size:14px;font-weight:700;color:var(--text);letter-spacing:1px;text-transform:uppercase;">Estatísticas do ciclo de estudos</span>';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = 'x';
    closeBtn.style.cssText = 'background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;line-height:1;transition:color 0.15s;';
    closeBtn.onmouseover = function() { this.style.color = 'var(--red)'; };
    closeBtn.onmouseout = function() { this.style.color = 'var(--text3)'; };
    closeBtn.onclick = function() { overlay.style.display = 'none'; };
    header.appendChild(closeBtn);

    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'padding:14px 16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px;';

    var summary = buildCycleLoadSummary(data || {});
    var snapshot = null;
    try {
      if (window.CT && typeof window.CT.buildCicloSnapshot === 'function') {
        var finished = summary.target > 0 && summary.studied >= summary.target && !(summary.rows || []).some(function (row) { return row.status === 'pending'; });
        snapshot = finished && typeof window.CT.salvarCicloSnapshot === 'function'
          ? window.CT.salvarCicloSnapshot(getCid(), data || {}, { status: 'complete', endAt: new Date().toISOString() })
          : window.CT.buildCicloSnapshot(getCid(), data || {}, { status: finished ? 'complete' : 'in_progress', endAt: new Date().toISOString() });
      }
    } catch (e) {
      snapshot = null;
    }
    if (snapshot) {
      listWrap.insertAdjacentHTML('beforeend', buildCycleAnalyticsHtml(snapshot));
    }
    if (summary.rows.length === 0) {
      listWrap.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:30px 10px;line-height:1.5">Nenhuma meta de ciclo definida.<br><span style="font-size:11px;opacity:0.7">Defina a carga horaria das materias para acompanhar a comparacao.</span></div>';
    } else {
      summary.rows.forEach(function(rowData) {
        var diff = rowData.diff;
        var isPending = rowData.status === 'pending';
        var isMissingFinalized = rowData.status === 'skipped' && diff < 0;
        var statusColor = isPending ? 'var(--text3)' : (isMissingFinalized ? 'var(--red)' : 'var(--green)');
        var pct = rowData.target > 0 ? Math.max(0, Math.min(130, (rowData.studied / rowData.target) * 100)) : 0;
        var row = document.createElement('div');
        row.style.cssText = 'padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);display:flex;flex-direction:column;gap:10px;';

        var top = document.createElement('div');
        top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';
        top.innerHTML =
          '<div style="min-width:0;display:flex;align-items:center;gap:8px;">' +
            '<span style="width:8px;height:28px;border-radius:999px;background:' + rowData.cor + ';flex-shrink:0;"></span>' +
            '<div style="min-width:0;">' +
              '<strong style="color:var(--text);display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(rowData.nome) + '</strong>' +
              '<span style="color:var(--text3);font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Meta ' + formatCycleClock(rowData.target) + ' | estudado ' + formatCycleClock(rowData.studied) + '</span>' +
            '</div>' +
          '</div>';

        var right = document.createElement('div');
        right.style.cssText = 'font-family:var(--mono);font-weight:800;font-size:14px;letter-spacing:-0.4px;white-space:nowrap;color:' + statusColor + ';';
        right.textContent = isPending ? ('faltam ' + formatCycleClock(rowData.remaining)) : formatCycleDelta(diff);
        top.appendChild(right);

        var bar = document.createElement('div');
        bar.style.cssText = 'height:6px;background:var(--bg2);border:1px solid var(--border2);border-radius:999px;overflow:hidden;';
        var fill = document.createElement('div');
        fill.style.cssText = 'height:100%;width:' + pct + '%;background:' + (isPending ? 'var(--text3)' : (isMissingFinalized ? 'var(--red)' : 'var(--green)')) + ';border-radius:999px;';
        bar.appendChild(fill);

        row.appendChild(top);
        row.appendChild(bar);
        listWrap.appendChild(row);
      });

      var totalDiff = summary.studied - summary.target;
      var hasPending = summary.rows.some(function (row) { return row.status === 'pending'; });
      var totalPositive = totalDiff >= 0;
      var totalColor = hasPending ? 'var(--text3)' : (totalPositive ? 'var(--green)' : 'var(--red)');
      var totalLabel = hasPending ? ('faltam ' + formatCycleClock(Math.max(0, summary.target - summary.studied))) : formatCycleDelta(totalDiff);
      var totalCaption = hasPending ? 'ciclo em andamento' : (totalPositive ? 'extra, parabens!' : 'abaixo da meta');
      var total = document.createElement('div');
      total.style.cssText = 'margin-top:4px;padding:14px;background:var(--bg);border:1px solid ' + (hasPending ? 'var(--border2)' : (totalPositive ? 'rgba(50,213,131,0.35)' : 'rgba(245,90,90,0.35)')) + ';border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;';
      total.innerHTML =
        '<div style="min-width:0;">' +
          '<strong style="display:block;color:var(--text);font-size:13px;margin-bottom:3px;">Total do ciclo</strong>' +
          '<span style="color:var(--text3);font-size:11px;">Meta ' + formatCycleClock(summary.target) + ' | estudado ' + formatCycleClock(summary.studied) + '</span>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;">' +
          '<div style="font-family:var(--mono);font-size:16px;font-weight:900;color:' + totalColor + ';">' + totalLabel + '</div>' +
          '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.4px;color:' + totalColor + ';">' + totalCaption + '</div>' +
        '</div>';
      listWrap.appendChild(total);
    }

    panel.appendChild(header);
    panel.appendChild(listWrap);
    overlay.appendChild(panel);

    overlay.onclick = function(e) { if (e.target === overlay) overlay.style.display = 'none'; };
  }
  function openManualEntryModal(item) {
    var overlay = document.getElementById('cycleManOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cycleManOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10005;display:flex;align-items:center;justify-content:center;padding:20px;animation: popIn 0.2s ease;';
      document.body.appendChild(overlay);
    } else {
      overlay.innerHTML = '';
      overlay.style.display = 'flex';
    }
    
    var panel = document.createElement('div');
    panel.style.cssText = 'width:380px;max-width:100%;max-height:92vh;background:var(--bg2);border:1px solid var(--border2);border-radius:16px;display:flex;flex-direction:column;box-shadow:0 10px 50px rgba(0,0,0,0.6);overflow:hidden;';
    
    var header = document.createElement('div');
    header.style.cssText = 'padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--bg3);';
    header.innerHTML = '<span style="font-size:14px;font-weight:700;color:var(--text);letter-spacing:1px;text-transform:uppercase;">Lançamento Manual</span>';
    
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;line-height:1;transition:color 0.15s;';
    closeBtn.onmouseover = function() { this.style.color = 'var(--red)'; };
    closeBtn.onmouseout = function() { this.style.color = 'var(--text3)'; };
    closeBtn.onclick = function() { overlay.style.display = 'none'; };
    header.appendChild(closeBtn);
    
    var body = document.createElement('div');
    body.style.cssText = 'padding:20px 16px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;';
    
    body.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;">Registre o tempo e questões para<br><strong style="color:var(--text);font-size:15px;display:block;margin-top:4px;">' + (item.nome || 'a Matéria') + '</strong></div>';
    
    var dateGroup = document.createElement('div');
    dateGroup.innerHTML = '<label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">DATA DO ESTUDO</label><input type="date" id="man_date" max="' + window.CT._today() + '" value="' + window.CT._today() + '" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;">';

    var timeGroup = document.createElement('div');
    timeGroup.style.cssText = 'display:flex;gap:10px;';
    timeGroup.innerHTML = '<div style="flex:1"><label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">HORAS</label><input type="number" id="man_h" min="0" max="23" placeholder="0" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;text-align:center;"></div>' +
                          '<div style="flex:1"><label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">MINUTOS</label><input type="number" id="man_m" min="0" max="59" placeholder="0" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;text-align:center;"></div>';
    
    var qsGroup = document.createElement('div');
    qsGroup.style.cssText = 'display:flex;gap:10px;';
    qsGroup.innerHTML = '<div style="flex:1"><label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">QUESTÕES</label><input type="number" id="man_q" min="0" placeholder="0" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;text-align:center;"></div>' +
                        '<div style="flex:1"><label style="display:block;font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">ACERTOS</label><input type="number" id="man_a" min="0" placeholder="0" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;text-align:center;"></div>';
    
    var metricsGroup = document.createElement('div');
    metricsGroup.style.cssText = 'padding:12px;background:rgba(79,142,247,0.06);border:1px solid rgba(79,142,247,0.2);border-radius:10px;display:flex;flex-direction:column;gap:10px;';
    metricsGroup.innerHTML = '<div style="font-size:11px;color:var(--accent);font-weight:800;letter-spacing:0.8px;text-transform:uppercase;">Estat&iacute;sticas opcionais</div>' +
      '<div style="display:flex;gap:10px;align-items:flex-start;">' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;"><label style="display:flex;align-items:flex-start;min-height:34px;font-size:9px;line-height:1.15;color:var(--text3);margin-bottom:6px;font-weight:800;letter-spacing:0.45px;text-transform:uppercase;">P&aacute;ginas lidas PDF/Livro</label><input type="number" id="man_paginas_pdf" min="0" step="1" placeholder="0" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;text-align:center;font-weight:700;"></div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;"><label style="display:flex;align-items:flex-start;min-height:34px;font-size:9px;line-height:1.15;color:var(--text3);margin-bottom:6px;font-weight:800;letter-spacing:0.45px;text-transform:uppercase;">Minutos assistidos de videoaulas</label><input type="number" id="man_video_minutos" min="0" step="1" placeholder="0" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;border-radius:8px;font-family:var(--sans);font-size:14px;text-align:center;font-weight:700;"></div>' +
      '</div>';

    var toggleGroup = document.createElement('div');
    toggleGroup.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 0;cursor:pointer;';
    toggleGroup.innerHTML = '<input type="checkbox" id="man_adv" checked style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;"><label for="man_adv" style="font-size:13px;color:var(--text);font-weight:400;cursor:pointer;flex:1">Marcar matéria como concluída</label>';
    
    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'Salvar Lançamento';
    saveBtn.style.cssText = 'padding:14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;transition:transform 0.1s;';
    saveBtn.onmousedown = function(){ this.style.transform='scale(0.97)'; };
    saveBtn.onmouseup = function(){ this.style.transform='none'; };
    saveBtn.onclick = function() {
       var h = parseInt(document.getElementById('man_h').value, 10) || 0;
       var m = parseInt(document.getElementById('man_m').value, 10) || 0;
       var q = parseInt(document.getElementById('man_q').value, 10) || 0;
       var a = parseInt(document.getElementById('man_a').value, 10) || 0;
       var adv = document.getElementById('man_adv').checked;
       var dur = (h * 3600) + (m * 60);
       var readPos = function(id) {
          var n = parseInt((document.getElementById(id) || {}).value, 10);
          return Number.isFinite(n) && n > 0 ? n : 0;
       };
       var metricas = window.CT && typeof window.CT.limparMetricasSessao === 'function'
          ? window.CT.limparMetricasSessao({
             paginasPdf: readPos('man_paginas_pdf'),
             videoMinutos: readPos('man_video_minutos')
          })
          : {};
       var temMetricas = Object.keys(metricas).length > 0;
       var dataLancamento = window.CT && typeof window.CT._normalizeDateString === 'function'
          ? window.CT._normalizeDateString(document.getElementById('man_date').value)
          : (document.getElementById('man_date').value || '');
       
       if (dur === 0 && q === 0 && !adv && !temMetricas) {
          overlay.style.display = 'none';
          return;
       }

       if (window.CT && dataLancamento > window.CT._today()) {
          alert('Escolha hoje ou uma data anterior para o lançamento.');
          return;
       }
       
       var matId = item.materiaId || resolveMateriaId(item.nome);
       var cid = typeof getCid === 'function' ? getCid() : (window._cData ? window._cData.id : '');
       var sessId = null;
       
       if (window.CT) {
          if ((dur > 0 || temMetricas) && typeof window.CT.registrarSessao === 'function') {
             var sessao = { concursoId: cid, materiaId: matId, duracaoSegundos: dur, origem: 'manual_ciclo', data: dataLancamento };
             if (temMetricas) sessao.metricas = metricas;
             sessId = window.CT.registrarSessao(sessao);
          }
          if (q > 0 && typeof window.CT.lancarQuestoes === 'function') {
             var acertos = Math.min(a, q);
             window.CT.lancarQuestoes({ materiaId: matId, concursoId: cid, resolvidas: q, acertos: acertos, erros: q - acertos, data: dataLancamento });
          }
       }
       
       if (adv) {
          window.CTCycle.finalizeItem(item.id);
       }
       
       overlay.style.display = 'none';
       if (typeof window.renderCrono === 'function') window.renderCrono();
       try { if (window.CTToast) window.CTToast('Lançamento salvo com sucesso!', 'success'); } catch(e) {}
    };
    
    body.appendChild(dateGroup);
    body.appendChild(timeGroup);
    body.appendChild(qsGroup);
    body.appendChild(metricsGroup);
    body.appendChild(toggleGroup);
    body.appendChild(saveBtn);
    
    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);
    
    overlay.onclick = function(e){ if (e.target === overlay) overlay.style.display = 'none'; };
  }

  var SMART_DAY_LABELS = [
    { key:'seg', label:'Seg' },
    { key:'ter', label:'Ter' },
    { key:'qua', label:'Qua' },
    { key:'qui', label:'Qui' },
    { key:'sex', label:'Sex' },
    { key:'sab', label:'Sáb' },
    { key:'dom', label:'Dom' }
  ];
  var SMART_JS_DAY_TO_KEY = ['dom','seg','ter','qua','qui','sex','sab'];
  var SMART_DEFAULT_CONFIG = {
    tipo: '',
    cicloModo: 'sugerido',
    agendadoSetupDone: false,
    agendadoSetupStep: 1,
    materiasSelecionadas: {},
    materiaAfinidade: {},
    materiaPrioridades: {},
    ritmo: 'equilibrado',
    horas: { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 },
    revisaoPct: 25,
    questoesPct: 20,
    minutosTopico: 60,
    minutosSubtopico: 40,
    maxTopicosDia: 0
  };

  function smartReadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function smartClampNumber(value, min, max, fallback) {
    var n = Number(String(value == null ? '' : value).replace(',', '.'));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function getSmartAgendadoConfig() {
    var cid = getCid();
    if (!cid) return null;
    var saved = smartReadJson('ct_cronograma_inteligente_' + cid, {});
    var cfg = Object.assign({}, SMART_DEFAULT_CONFIG, saved || {});
    cfg.horas = Object.assign({}, SMART_DEFAULT_CONFIG.horas, (saved && saved.horas) || {});
    cfg.materiasSelecionadas = saved && saved.materiasSelecionadas && typeof saved.materiasSelecionadas === 'object' ? saved.materiasSelecionadas : {};
    cfg.materiaAfinidade = saved && saved.materiaAfinidade && typeof saved.materiaAfinidade === 'object' ? saved.materiaAfinidade : {};
    cfg.materiaPrioridades = saved && saved.materiaPrioridades && typeof saved.materiaPrioridades === 'object' ? saved.materiaPrioridades : {};
    cfg.tipo = saved && saved.tipo ? saved.tipo : '';
    cfg.cicloModo = saved && saved.cicloModo ? saved.cicloModo : 'sugerido';
    cfg.ritmo = saved && saved.ritmo ? saved.ritmo : 'equilibrado';
    cfg.agendadoSetupDone = !!(saved && saved.agendadoSetupDone);
    cfg.revisaoPct = smartClampNumber(cfg.revisaoPct, 0, 80, SMART_DEFAULT_CONFIG.revisaoPct);
    cfg.questoesPct = smartClampNumber(cfg.questoesPct, 0, 80, SMART_DEFAULT_CONFIG.questoesPct);
    cfg.minutosTopico = smartClampNumber(cfg.minutosTopico, 10, 240, SMART_DEFAULT_CONFIG.minutosTopico);
    cfg.minutosSubtopico = smartClampNumber(cfg.minutosSubtopico, 10, 240, SMART_DEFAULT_CONFIG.minutosSubtopico);
    cfg.maxTopicosDia = smartClampNumber(cfg.maxTopicosDia, 0, 20, SMART_DEFAULT_CONFIG.maxTopicosDia);
    return cfg.tipo === 'agendado' && cfg.agendadoSetupDone ? cfg : null;
  }

  function smartMateriaSelectionMap(cfg) {
    return cfg && cfg.materiasSelecionadas && typeof cfg.materiasSelecionadas === 'object'
      ? cfg.materiasSelecionadas
      : {};
  }

  function smartIsMateriaSelected(cfg, materiaId) {
    var map = smartMateriaSelectionMap(cfg);
    var key = String(materiaId || '');
    if (!key || !Object.prototype.hasOwnProperty.call(map, key)) return true;
    return map[key] !== false;
  }

  function smartFilterSelectedMaterias(cfg, materias) {
    var list = Array.isArray(materias) ? materias : [];
    var selected = list.filter(function (materia) {
      return smartIsMateriaSelected(cfg, materia && materia.id);
    });
    return selected.length ? selected : list;
  }

  function ensureSmartScheduleStyles() {
    if (document.getElementById('smartScheduleDashStyles')) return;
    var style = document.createElement('style');
    style.id = 'smartScheduleDashStyles';
    style.textContent = ''
      + '.smart-dash-shell{display:flex;flex-direction:column;gap:10px;padding:10px;}'
      + '.smart-day-card{background:linear-gradient(135deg,rgba(79,142,247,.08),rgba(62,207,142,.04));border:1px solid rgba(79,142,247,.22);border-radius:12px;padding:12px;}'
      + '.smart-day-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;}'
      + '.smart-day-title{font-size:14px;font-weight:900;color:var(--text);line-height:1.25;}'
      + '.smart-day-sub{font-size:11px;color:var(--text3);line-height:1.45;margin-top:3px;}'
      + '.smart-day-items{display:flex;flex-direction:column;gap:8px;}'
      + '.smart-day-item{border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:10px;background:var(--bg3);padding:9px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;}'
      + '.smart-day-item.overdue{border-left-color:var(--red);background:linear-gradient(135deg,rgba(245,90,90,0.035),var(--bg3));}'
      + '.smart-day-item.support{border-left-color:var(--yellow);}'
      + '.smart-day-item.warning{border-left-color:var(--orange);}'
      + '.smart-day-item.important{border-left-color:var(--green);}'
      + '.smart-mat{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.smart-topic{font-size:12px;font-weight:900;color:var(--text);line-height:1.28;margin-top:3px;}'
      + '.smart-meta{font-size:10px;color:var(--text3);line-height:1.35;margin-top:5px;}'
      + '.smart-alert-pills{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;}'
      + '.smart-question-box{margin-top:8px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,.025);padding:7px 8px;}'
      + '.smart-question-title{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);line-height:1.2;margin-bottom:5px;}'
      + '.smart-pills{display:flex;gap:5px;flex-wrap:wrap;}'
      + '.smart-pill{font-size:9px;font-weight:900;border-radius:999px;padding:3px 7px;background:rgba(255,255,255,.06);color:var(--text2);border:1px solid rgba(255,255,255,.08);}'
      + '.smart-pill.overdue{background:rgba(245,90,90,0.16);color:var(--red);border-color:rgba(245,90,90,0.32);font-weight:900;}'
      + '.smart-pill.warning,.smart-pill.drop{background:rgba(245,90,90,.12);color:var(--red);border-color:rgba(245,90,90,.24);}'
      + '.smart-pill.recovery,.smart-pill.dominate{background:rgba(62,207,142,.12);color:var(--green);border-color:rgba(62,207,142,.22);}'
      + '.smart-day-item.finalized{border-left-color:var(--green) !important;background:rgba(62,207,142,0.08) !important;opacity:0.85;}'
      + '.smart-day-item.finalized .smart-topic{text-decoration:line-through;color:var(--text3) !important;opacity:0.75;}'
      + '.smart-day-item.finalized .smart-mat{text-decoration:line-through;opacity:0.7;}'
      + '.smart-day-item.extra-finalized{border-left-color:#ffd700 !important;background:rgba(255,215,0,0.08) !important;border-color:rgba(255,215,0,0.18) !important;box-shadow:0 0 0 1px rgba(255,215,0,0.03),0 0 18px rgba(255,215,0,0.04);opacity:0.88;}'
      + '.smart-day-item.extra-finalized .smart-topic{text-decoration:line-through;color:#ffd700 !important;opacity:0.9;}'
      + '.smart-day-item.extra-finalized .smart-mat{text-decoration:line-through;opacity:0.72;}'
      + '.smart-day-item.studied{border-left-color:var(--orange) !important;background:rgba(245,135,74,0.08) !important;}'
      + '.smart-badge-done{border:1px solid rgba(62,207,142,.35);background:rgba(62,207,142,.13);color:var(--green);border-radius:8px;padding:8px 10px;font-size:11px;font-weight:900;text-align:center;white-space:nowrap;display:inline-block;cursor:default;}'
      + '.smart-badge-extra-done{border:1px solid rgba(255,215,0,.36);background:rgba(255,215,0,.12);color:#ffd700;border-radius:8px;padding:8px 10px;font-size:11px;font-weight:900;text-align:center;white-space:nowrap;display:inline-block;cursor:default;}'
      + '.smart-pill.started{background:rgba(245,135,74,.12);color:var(--orange);border-color:rgba(245,135,74,.24);}'
      + '.smart-pill.extra-finalized{background:rgba(255,215,0,.14);color:#ffd700;border-color:rgba(255,215,0,.32);}'
      + '.smart-start{border:1px solid rgba(79,142,247,.35);background:rgba(79,142,247,.13);color:var(--accent);border-radius:8px;padding:8px 10px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;}'
      + '.smart-start:hover{background:var(--accent);color:#fff;}'
      + '.smart-load-card{border:1px solid var(--border);background:var(--bg3);border-radius:12px;padding:11px 12px;cursor:pointer;text-align:left;color:var(--text);transition:border-color .16s,background .16s,transform .16s;}'
      + '.smart-load-card:hover{border-color:rgba(79,142,247,.52);background:rgba(79,142,247,.07);transform:translateY(-1px);}'
      + '.smart-load-row{display:grid;grid-template-columns:minmax(76px,auto) minmax(0,1fr) minmax(76px,auto);gap:10px;align-items:center;}'
      + '.smart-load-label{font-size:9px;font-weight:900;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px;}'
      + '.smart-load-value{font-family:var(--mono);font-size:14px;font-weight:900;color:var(--text);white-space:nowrap;}'
      + '.smart-load-value.goal{color:var(--green);text-align:right;}'
      + '.smart-load-bar{height:6px;background:var(--bg2);border:1px solid var(--border2);border-radius:999px;overflow:hidden;}'
      + '.smart-load-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:999px;}'
      + '.smart-load-sub{font-size:10px;color:var(--text3);line-height:1.35;margin-top:8px;}'
      + '.smart-analysis-overlay{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;}'
      + '.smart-analysis-panel{width:min(860px,96vw);max-height:88vh;overflow:auto;background:var(--bg2);border:1px solid var(--border2);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.58);padding:18px;}'
      + '.smart-analysis-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px;}'
      + '.smart-analysis-title{font-size:16px;font-weight:900;color:var(--text);}'
      + '.smart-analysis-sub{font-size:12px;color:var(--text3);line-height:1.45;margin-top:3px;}'
      + '.smart-analysis-close{border:1px solid var(--border2);background:var(--bg3);color:var(--text2);border-radius:8px;width:34px;height:34px;font-size:18px;font-weight:900;cursor:pointer;}'
      + '.smart-analysis-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px;}'
      + '.smart-analysis-stat{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px;min-width:0;}'
      + '.smart-analysis-stat b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:5px;}'
      + '.smart-analysis-stat span{display:block;font-family:var(--mono);font-size:16px;font-weight:900;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.smart-analysis-section{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;margin-top:10px;}'
      + '.smart-analysis-section-title{font-size:11px;font-weight:900;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px;}'
      + '.smart-analysis-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);}'
      + '.smart-analysis-row:first-of-type{border-top:0;padding-top:0;}'
      + '.smart-analysis-name{font-size:12px;font-weight:900;color:var(--text);line-height:1.3;min-width:0;}'
      + '.smart-analysis-meta{font-size:10px;color:var(--text3);line-height:1.35;margin-top:3px;}'
      + '.smart-analysis-time{font-family:var(--mono);font-size:12px;font-weight:900;color:var(--accent);white-space:nowrap;}'
      + '.smart-empty{font-size:12px;color:var(--text3);text-align:center;padding:18px 10px;line-height:1.5;}'
      + '.smart-empty-day{background:rgba(79,142,247,0.04);border:1px dashed rgba(79,142,247,0.25);border-radius:12px;padding:24px 16px;margin-bottom:12px;text-align:center;}'
      + '.smart-empty-day-emoji{font-size:32px;display:block;margin-bottom:10px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1));}'
      + '.smart-empty-day-title{font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px;}'
      + '.smart-empty-day-desc{font-size:11px;color:var(--text3);line-height:1.5;max-width:290px;margin:0 auto;}'
      + '.dashboard-crono-card.smart-share-enabled{overflow:visible !important;}'
      + '.smart-share-wrap{position:relative;margin-left:auto;margin-right:8px;display:flex;align-items:center;z-index:20;}'
      + '.smart-share-btn{border:1px solid rgba(79,142,247,.36);background:rgba(79,142,247,.10);color:var(--accent);border-radius:8px;padding:7px 10px;font-size:11px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px;line-height:1;white-space:nowrap;}'
      + '.smart-share-btn:hover{background:rgba(79,142,247,.18);border-color:rgba(79,142,247,.58);}'
      + '.smart-share-icon{font-size:13px;line-height:1;}'
      + '.smart-share-menu{display:none;position:absolute;right:0;top:calc(100% + 7px);width:190px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;box-shadow:0 16px 34px rgba(0,0,0,.42);padding:6px;z-index:50;}'
      + '.smart-share-menu.open{display:flex;flex-direction:column;gap:4px;}'
      + '.smart-share-option{width:100%;border:0;background:transparent;color:var(--text);border-radius:8px;padding:9px 10px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;}'
      + '.smart-share-option:hover{background:rgba(79,142,247,.12);}'
      + '.smart-share-option span{font-size:12px;font-weight:900;}'
      + '.smart-share-option small{font-size:9px;font-weight:800;color:var(--text3);white-space:nowrap;}'
      + '@media(max-width:760px){.smart-day-item{grid-template-columns:1fr}.smart-start{width:100%;}.smart-load-row{grid-template-columns:1fr}.smart-load-value.goal{text-align:left}.smart-analysis-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.smart-analysis-row{grid-template-columns:1fr;}}'
      + '@media(max-width:520px){.smart-share-wrap{margin-left:auto;margin-right:6px}.smart-share-label{display:none}.smart-share-btn{width:34px;height:32px;justify-content:center;padding:0}.smart-share-menu{right:-42px;}}';
    document.head.appendChild(style);
  }

  function smartNumOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function smartNormalizePainelConfig(cid) {
    var raw = smartReadJson('ct_config_prova_' + cid, { groups: [] }) || {};
    var config = Object.assign({}, raw);
    if (Array.isArray(config.geral) || Array.isArray(config.especifico)) {
      config.groups = [];
      if (Array.isArray(config.geral)) config.groups.push({ id:'geral', name:'Conhecimentos Gerais', items: config.geral });
      if (Array.isArray(config.especifico)) config.groups.push({ id:'especifico', name:'Conhecimentos Específicos', items: config.especifico });
    }
    config.groups = Array.isArray(config.groups) ? config.groups : [];
    config.scoringMode = ['cebraspe', 'media_areas'].indexOf(config.scoringMode) >= 0 ? config.scoringMode : 'tradicional';
    return config;
  }

  function smartGroupUsesPoolScoring(group, scoringMode) {
    return Array.isArray(group.items) && group.items.length && group.items.some(function (item) {
      return smartNumOrNull(item.q) == null || (scoringMode !== 'cebraspe' && smartNumOrNull(item.w) == null);
    });
  }

  function smartPainelMeta(cid, materias) {
    var prova = smartNormalizePainelConfig(cid);
    var map = new Map();
    var materiaById = new Map((materias || []).map(function (m) { return [String(m.id), m]; }));
    var totalPontos = 0;
    var totalQuestoes = 0;
    var isCespe = prova.scoringMode === 'cebraspe';
    var isAreaMean = prova.scoringMode === 'media_areas';

    prova.groups.forEach(function (group) {
      var items = Array.isArray(group.items) ? group.items : [];
      if (!items.length) return;
      if (smartGroupUsesPoolScoring(group, prova.scoringMode)) {
        var blocoQuestoes = Math.max(0, smartNumOrNull(group.q) || 0);
        var blocoPeso = Math.max(0, smartNumOrNull(group.w) || 1);
        var validItems = items.map(function (item) { return materiaById.get(String(item.id)); }).filter(Boolean);
        if (!validItems.length) return;
        var pontos = isAreaMean ? blocoPeso * 10 : (isCespe ? blocoQuestoes : blocoQuestoes * blocoPeso);
        var qEach = blocoQuestoes / validItems.length;
        var pEach = pontos / validItems.length;
        validItems.forEach(function (materia) {
          var row = map.get(String(materia.id)) || { questoes:0, pontos:0 };
          row.questoes += qEach;
          row.pontos += pEach;
          map.set(String(materia.id), row);
        });
        totalQuestoes += blocoQuestoes;
        totalPontos += pontos;
        return;
      }
      items.forEach(function (item) {
        var materia = materiaById.get(String(item.id));
        if (!materia) return;
        var q = Math.max(0, smartNumOrNull(item.q) || 0);
        var w = Math.max(0, smartNumOrNull(item.w) || 1);
        if (!q) return;
        var pontos = isAreaMean ? w * 10 : (isCespe ? q : q * w);
        var row = map.get(String(materia.id)) || { questoes:0, pontos:0 };
        row.questoes += q;
        row.pontos += pontos;
        map.set(String(materia.id), row);
        totalQuestoes += q;
        totalPontos += pontos;
      });
    });

    if (!map.size && materias.length) {
      materias.forEach(function (m) { map.set(String(m.id), { questoes:1, pontos:1 }); });
      totalQuestoes = materias.length;
      totalPontos = materias.length;
    }
    map.forEach(function (row) {
      row.share = totalPontos > 0 ? row.pontos / totalPontos : 0;
    });
    return { map: map, totalPontos: totalPontos, totalQuestoes: totalQuestoes, hasPanel: prova.groups.length > 0 };
  }

  function smartSortByTimeDesc(a, b) {
    var ad = String(a.horaInicio || a.createdAt || a.data || '');
    var bd = String(b.horaInicio || b.createdAt || b.data || '');
    return bd.localeCompare(ad);
  }

  function smartCalcRecentStats(entries, limit) {
    var remaining = limit || 30;
    var resolvidas = 0;
    var acertos = 0;
    var erros = 0;
    (entries || []).slice().sort(smartSortByTimeDesc).forEach(function (q) {
      if (remaining <= 0) return;
      var total = Math.max(0, Number(q.resolvidas) || 0);
      if (!total) return;
      var take = Math.min(remaining, total);
      var ratio = take / total;
      resolvidas += take;
      acertos += (Number(q.acertos) || 0) * ratio;
      erros += (Number(q.erros) || 0) * ratio;
      remaining -= take;
    });
    var pct = resolvidas > 0 ? Math.round((acertos / resolvidas) * 100) : null;
    return { resolvidas: Math.round(resolvidas), acertos: Math.round(acertos), erros: Math.round(erros), pct: pct };
  }

  function smartClassifyPerformance(general, recent) {
    if (!general || !general.resolvidas) return { key:'sem_amostra', label:'sem amostra', className:'neutral' };
    if (!recent || recent.resolvidas < Math.min(10, general.resolvidas)) return { key:'amostra_baixa', label:'amostra baixa', className:'neutral' };
    if (general.pct < 75 && recent.pct >= 80) return { key:'recuperacao', label:'em recuperação', className:'recovery' };
    if (general.pct >= 80 && recent.pct < 70) return { key:'queda', label:'queda recente', className:'drop' };
    if (recent.pct >= 90) return { key:'dominando', label:'dominando', className:'dominate' };
    if (recent.pct < 70) return { key:'dificuldade', label:'atenção', className:'warning' };
    return { key:'estavel', label:'estável', className:'neutral' };
  }

  function smartGetMateriaAffinity(cfg, materiaId) {
    var n = Number(cfg && cfg.materiaAfinidade && cfg.materiaAfinidade[materiaId]);
    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
  }

  function smartGetSimMateriaStats(cid, materiaId) {
    var sims = (CT.getSimulados(cid) || [])
      .filter(function (sim) { return sim && sim.tipo !== 'pendente'; })
      .sort(function (a, b) { return String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')); });
    var values = [];
    sims.forEach(function (sim) {
      var pct = null;
      if (sim.desempenhoPainel && Array.isArray(sim.desempenhoPainel.materias)) {
        var row = sim.desempenhoPainel.materias.find(function (item) { return String(item.materiaId) === String(materiaId); });
        if (row && Number.isFinite(Number(row.pct))) pct = Number(row.pct);
      } else if (sim.notasMaterias && sim.notasMaterias[materiaId] != null) {
        pct = Number(sim.notasMaterias[materiaId]);
      }
      if (Number.isFinite(pct)) values.push({ pct: pct, sim: sim });
    });
    if (!values.length) return { ultimo:null, media:null, count:0 };
    var media = Math.round(values.reduce(function (acc, item) { return acc + item.pct; }, 0) / values.length);
    return { ultimo: Math.round(values[values.length - 1].pct), media: media, count: values.length };
  }

  function smartBuildMateriasRows(cfg, units) {
    var cid = getCid();
    var materias = smartFilterSelectedMaterias(cfg, CT.getMaterias(cid) || []);
    var allQuestions = CT.getQuestoes({ concursoId: cid }) || [];
    var allSessions = CT.getSessoes({ concursoId: cid }) || [];
    var painel = smartPainelMeta(cid, materias);
    var maxShare = Math.max.apply(null, materias.map(function (m) {
      return (painel.map.get(String(m.id)) || {}).share || 0;
    }).concat([0.01]));

    var materiasRows = materias.map(function (materia) {
      var qs = allQuestions.filter(function (q) { return q.materiaId === materia.id; });
      var sessoes = allSessions.filter(function (s) { return s.materiaId === materia.id; });
      var materiaUnits = units.filter(function (u) { return u.materiaId === materia.id; });
      var meta = painel.map.get(String(materia.id)) || { share: 0, questoes: 0, pontos: 0 };
      var general = CT.calcStats ? CT.calcStats(qs) : { resolvidas:0, acertos:0, erros:0, pct:null };
      var recent = smartCalcRecentStats(qs, 30);
      var signal = smartClassifyPerformance(general, recent);
      var doneUnits = materiaUnits.filter(function (u) { return u.done; }).length;
      var totalUnits = materiaUnits.length;
      var remainingUnitsCount = Math.max(0, totalUnits - doneUnits);
      var sim = smartGetSimMateriaStats(cid, materia.id);
      var coveragePct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
      
      var weightScore = ((meta.share || 0) / maxShare) * 35;
      var coverageScore = totalUnits ? (remainingUnitsCount / totalUnits) * 25 : 12;
      
      var difficultyBase = general.resolvidas >= 10
        ? (recent.resolvidas >= 8 ? (100 - (recent.pct || 0)) : (100 - (general.pct || 0)))
        : 45;
        
      var simModifier = 0;
      if (sim.ultimo != null) {
        if (sim.ultimo >= 75) {
          simModifier = -12;
        } else if (sim.ultimo < 70) {
          simModifier = 8;
        }
      }
      
      var affinity = smartGetMateriaAffinity(cfg, materia.id);
      var affinityModifier = { 1: 15, 2: 7, 3: 0, 4: -7, 5: -15 }[affinity] || 0;
      
      var priority = Math.round(weightScore + coverageScore + Math.max(0, Math.min(25, difficultyBase * 0.25)) + simModifier + affinityModifier);
      
      var hasFewQuestions = meta.questoes != null && meta.questoes > 0 && meta.questoes <= 5;
      if (hasFewQuestions) {
        priority = Math.min(54, priority);
        if (affinity < 5) {
          priority = Math.max(40, priority);
        }
      }
      var autoPriority = priority;
      var manualPriority = smartManualPriorityLevel(cfg, materia.id);
      priority = smartApplyManualMateriaPriority(cfg, materia.id, autoPriority);
      return {
        materia: materia,
        meta: meta,
        general: general,
        recent: recent,
        signal: signal,
        sim: sim,
        seconds: CT.totalSegundos ? CT.totalSegundos(sessoes) : 0,
        totalUnits: totalUnits,
        doneUnits: doneUnits,
        remainingUnits: remainingUnitsCount,
        coveragePct: coveragePct,
        autoPriority: autoPriority,
        manualPriority: manualPriority,
        priority: priority
      };
    }).sort(function (a, b) { return b.priority - a.priority; });

    return materiasRows;
  }

  function smartEstimateUnitMinutes(unit, meta, maxShare, cfg) {
    var affinity = smartGetMateriaAffinity(cfg, unit.materiaId);
    var relevance = Math.max(0.12, Math.min(1, ((meta.share || 0) / maxShare) || 0.35));
    var affinityMultiplier = ({ 1:1.35, 2:1.18, 3:1, 4:.86, 5:.72 })[affinity] || 1;
    var rhythmMultiplier = cfg.ritmo === 'conservador' ? 1.12 : (cfg.ritmo === 'intensivo' ? .9 : 1);
    var trendBonus = ['dificuldade', 'queda'].indexOf(unit.signal && unit.signal.key) >= 0 ? 10 : 0;
    var typeBonus = unit.tipo === 'materia' ? 8 : (unit.tipo === 'topico' ? 4 : 0);
    var raw = (24 + (relevance * 42) + trendBonus + typeBonus) * affinityMultiplier * rhythmMultiplier;
    return Math.round(Math.max(20, Math.min(95, raw)));
  }

  function smartDailyTopicLimit(cfg, hours) {
    var minutesPerTopic = Math.max(1, Number(cfg && cfg.minutosTopico) || SMART_DEFAULT_CONFIG.minutosTopico || 60);
    var availableMinutes = Math.max(0, Number(hours) || 0) * 60;
    if (availableMinutes <= 0) return 0;
    var automaticLimit = Math.max(1, Math.floor(availableMinutes / minutesPerTopic));
    var manualCap = Math.max(0, Math.min(20, parseInt(cfg && cfg.maxTopicosDia, 10) || 0));
    return manualCap ? Math.min(automaticLimit, manualCap) : automaticLimit;
  }

  function smartDailyMateriaLimit(maxItems, eligibleMateriaCount) {
    var itemLimit = Math.max(1, parseInt(maxItems, 10) || 1);
    var materiaCount = Math.max(1, parseInt(eligibleMateriaCount, 10) || 1);
    if (materiaCount >= itemLimit) return 1;
    return Math.max(1, Math.ceil(itemLimit / materiaCount));
  }

  function smartIdEq(a, b) {
    return String(a || '') === String(b || '');
  }

  function smartGetUnitQuestions(allQuestions, unit) {
    return (allQuestions || []).filter(function (q) {
      if (unit.subtopId) return smartIdEq(q.subtopId || q.subtopicoId, unit.subtopId);
      if (unit.topicoId) return smartIdEq(q.topicoId, unit.topicoId) && !(q.subtopId || q.subtopicoId);
      return smartIdEq(q.materiaId, unit.materiaId);
    });
  }

  function smartGetUnitSessions(allSessions, unit) {
    return (allSessions || []).filter(function (s) {
      if (unit.subtopId) return smartIdEq(s.subtopId || s.subtopicoId, unit.subtopId);
      if (unit.topicoId) return smartIdEq(s.topicoId, unit.topicoId) && !(s.subtopId || s.subtopicoId);
      return smartIdEq(s.materiaId, unit.materiaId);
    });
  }

  function buildSmartUnits(cfg) {
    var cid = getCid();
    if (!cid || typeof CT === 'undefined') return [];
    var materias = smartFilterSelectedMaterias(cfg, CT.getMaterias(cid) || []);
    var allQuestions = (CT.getQuestoes({ concursoId: cid }) || []);
    var allSessions = (CT.getSessoes({ concursoId: cid }) || []);
    var painel = smartPainelMeta(cid, materias);
    var maxShare = Math.max.apply(null, materias.map(function (m) {
      return (painel.map.get(String(m.id)) || {}).share || 0;
    }).concat([0.01]));
    var units = [];

    materias.forEach(function (materia) {
      var topicos = CT.getTopicos(materia.id) || [];
      if (!topicos.length) {
        units.push({
          id:'mat:' + materia.id,
          tipo:'materia',
          materiaId:materia.id,
          materiaNome:materia.nome,
          topicoId:null,
          subtopId:null,
          topicoNome:materia.nome,
          subtopicoNome:'',
          nome:materia.nome,
          done:false,
          minutes:cfg.minutosTopico
        });
        return;
      }
      topicos.forEach(function (topico) {
        var subs = CT.getSubtopicos(topico.id) || [];
        if (subs.length) {
          subs.forEach(function (sub) {
            units.push({
              id:'sub:' + sub.id,
              tipo:'subtopico',
              materiaId:materia.id,
              materiaNome:materia.nome,
              topicoId:topico.id,
              subtopId:sub.id,
              topicoNome:topico.nome || 'Tópico',
              subtopicoNome:sub.nome || 'Subtópico',
              nome:sub.nome || 'Subtópico',
              done:!!topico.estudado || !!sub.estudado,
              doneAt:topico.estudadoEm || sub.estudadoEm || '',
              minutes:cfg.minutosSubtopico
            });
          });
        } else {
          units.push({
            id:'top:' + topico.id,
            tipo:'topico',
            materiaId:materia.id,
            materiaNome:materia.nome,
            topicoId:topico.id,
            subtopId:null,
            topicoNome:topico.nome || 'Tópico',
            subtopicoNome:'',
            nome:topico.nome || 'Tópico',
            done:!!topico.estudado,
            doneAt:topico.estudadoEm || '',
            minutes:cfg.minutosTopico
          });
        }
      });
    });

    units.forEach(function (unit) {
      var qs = smartGetUnitQuestions(allQuestions, unit);
      var sessoes = smartGetUnitSessions(allSessions, unit);
      unit.questions = qs;
      unit.general = CT.calcStats ? CT.calcStats(qs) : { resolvidas:0, acertos:0, erros:0, pct:null };
      unit.recent = smartCalcRecentStats(qs, 30);
      unit.signal = smartClassifyPerformance(unit.general, unit.recent);
      unit.seconds = CT.totalSegundos ? CT.totalSegundos(sessoes) : 0;
      var meta = painel.map.get(String(unit.materiaId)) || { share: 0 };
      unit.estimateMinutes = smartEstimateUnitMinutes(unit, meta, maxShare, cfg);
      unit.minutes = unit.estimateMinutes;
      var weightScore = ((meta.share || 0) / maxShare) * 34;
      var difficultyBase = unit.recent.resolvidas >= 8 ? (100 - (unit.recent.pct || 0)) : (unit.general.pct != null ? 100 - unit.general.pct : 45);
      var difficultyScore = Math.max(0, Math.min(28, difficultyBase * 0.28));
      var coverageScore = unit.done ? 0 : 24;
      var trendScore = ['dificuldade', 'queda'].indexOf(unit.signal.key) >= 0 ? 12 : (unit.signal.key === 'recuperacao' ? 5 : 0);
      unit.priority = Math.round(weightScore + difficultyScore + coverageScore + trendScore);
    });

    return units;
  }

  function smartDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function smartGetEntryDateKey(entry) {
    if (entry && typeof entry.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.data.trim())) {
      return entry.data.trim();
    }
    var raw = entry && (entry.horaInicio || entry.createdAt || entry.updatedAt);
    if (raw) {
      var d = new Date(raw);
      if (!isNaN(d.getTime())) {
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
      }
    }
    return '';
  }

  function smartAddDays(date, amount) {
    var next = new Date(date);
    next.setDate(next.getDate() + amount);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function smartNormalizeMatterName(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function smartIsConstancyMatter(name) {
    return /\b(matematica|raciocinio|logica|estatistica|financeira|contabilidade|quantitativa)\b/.test(smartNormalizeMatterName(name));
  }

  function buildSmartScheduleForHistory(cfg, remainingUnits, historyStart, historyEnd) {
    var remaining = (remainingUnits || []).slice().sort(function (a, b) { return b.priority - a.priority; });
    var materiaRows = Array.from(remaining.reduce(function (map, unit) {
      var key = unit.materiaId || 'sem-materia';
      var row = map.get(key) || { materiaId:key, nome:unit.materiaNome || '', totalPriority:0, maxPriority:0, count:0, totalEstimate:0 };
      row.count += 1;
      row.totalPriority += Number(unit.priority) || 0;
      row.totalEstimate += Number(unit.estimateMinutes || unit.minutes) || 0;
      row.maxPriority = Math.max(row.maxPriority, Number(unit.priority) || 0);
      if (!row.nome && unit.materiaNome) row.nome = unit.materiaNome;
      map.set(key, row);
      return map;
    }, new Map()).values()).map(function (row) {
      row.avgPriority = row.count ? row.totalPriority / row.count : 0;
      row.avgEstimate = row.count ? row.totalEstimate / row.count : 0;
      row.constancy = smartIsConstancyMatter(row.nome);
      row.affinity = smartGetMateriaAffinity(cfg, row.materiaId);
      return row;
    }).sort(function (a, b) { return (b.avgPriority - a.avgPriority) || (b.maxPriority - a.maxPriority); });

    materiaRows.forEach(function (row) {
      var difficultyBoost = Math.max(0, 4 - row.affinity) * 14;
      var volumeBoost = Math.min(24, Math.log2(row.count + 1) * 7);
      var constancyBoost = row.constancy ? 58 : 0;
      row.supportWeight = row.avgPriority + (row.maxPriority * 0.35) + volumeBoost + difficultyBoost + constancyBoost;
    });

    var materiaIndex = new Map(materiaRows.map(function (row) { return [String(row.materiaId), row]; }));
    var coreMatterLimit = Math.min(materiaRows.length, Math.max(1, Math.ceil(materiaRows.length * 0.35), materiaRows.length >= 4 ? 3 : 1));
    var coreMatterIds = new Set(materiaRows.slice(0, coreMatterLimit).map(function (row) { return row.materiaId; }));
    var scheduledByMateria = new Map();
    var lastDayByMateria = new Map();

    function unitFits(unit, capacity, hasItems) {
      if (!unit) return false;
      return unit.estimateMinutes <= capacity + (hasItems ? 10 : 20);
    }

    function pickScheduleUnit(opts) {
      var support = !!opts.support;
      var capacity = opts.capacity;
      var usedMateria = opts.usedMateria;
      var dayIndex = opts.dayIndex;
      var hasItems = opts.hasItems;
      var candidates = remaining
        .map(function (unit, index) { return { unit: unit, index: index }; })
        .filter(function (item) { return unitFits(item.unit, capacity, hasItems); });
      if (!candidates.length) return null;
      var unusedCandidates = candidates.filter(function (item) { return !usedMateria.has(item.unit.materiaId); });
      if (unusedCandidates.length) candidates = unusedCandidates;

      if (support) {
        var supportCandidates = candidates.filter(function (item) { return !coreMatterIds.has(item.unit.materiaId); });
        if (supportCandidates.length) candidates = supportCandidates;
        candidates.sort(function (a, b) {
          function score(item) {
            var id = String(item.unit.materiaId);
            var row = materiaIndex.get(id);
            var count = scheduledByMateria.get(item.unit.materiaId) || 0;
            var last = lastDayByMateria.has(item.unit.materiaId) ? lastDayByMateria.get(item.unit.materiaId) : null;
            var gap = last == null ? 7 : Math.max(0, dayIndex - last);
            var dueBonus = Math.min(28, gap * 4);
            var base = (row && row.supportWeight) || item.unit.priority || 1;
            return (base / (1 + (count * .72))) + dueBonus + ((item.unit.priority || 0) * .12);
          }
          var delta = score(b) - score(a);
          if (Math.abs(delta) > .01) return delta;
          return b.unit.priority - a.unit.priority;
        });
      } else {
        candidates.sort(function (a, b) {
          var aCore = coreMatterIds.has(a.unit.materiaId) ? 0 : 1;
          var bCore = coreMatterIds.has(b.unit.materiaId) ? 0 : 1;
          if (aCore !== bCore) return aCore - bCore;
          return b.unit.priority - a.unit.priority;
        });
      }

      var selected = candidates[0];
      var unit = remaining.splice(selected.index, 1)[0];
      unit.scheduleLane = support && !coreMatterIds.has(unit.materiaId) ? 'support' : 'core';
      scheduledByMateria.set(unit.materiaId, (scheduledByMateria.get(unit.materiaId) || 0) + 1);
      lastDayByMateria.set(unit.materiaId, dayIndex);
      return unit;
    }

    var days = [];
    var diffMs = Math.abs(historyEnd.getTime() - historyStart.getTime());
    var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    for (var i = 0; i < diffDays && remaining.length; i++) {
      var date = smartAddDays(historyStart, i);
      var dayKey = SMART_JS_DAY_TO_KEY[date.getDay()];
      var hours = Number(cfg && cfg.horas && cfg.horas[dayKey]) || 0;
      if (hours <= 0) continue;
      var reserved = Math.min(.85, Math.max(0, ((cfg.revisaoPct || 0) + (cfg.questoesPct || 0)) / 100));
      var capacity = Math.max(20, hours * 60 * (1 - reserved));
      var maxItems = smartDailyTopicLimit(cfg, hours);
      var items = [];
      var usedMateria = new Set();
      var safety = 0;
      while (remaining.length && capacity >= 18 && items.length < maxItems && safety < 30) {
        safety += 1;
        var unit = pickScheduleUnit({ support: false, capacity: capacity, usedMateria: usedMateria, dayIndex: i, hasItems: items.length > 0 });
        if (!unit) break;
        items.push(unit);
        usedMateria.add(unit.materiaId);
        capacity -= unit.estimateMinutes;
      }
      if (items.length) days.push({ date: date, key: smartDateKey(date), items: items });
    }
    return { days: days };
  }

  function getOverdueUnits(cfg, allUnits) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var historyStart = smartAddDays(today, -7);

    var simUnits = allUnits.map(function (u) {
      var simDone = u.done;
      if (u.done && u.doneAt) {
        if (u.doneAt >= smartDateKey(historyStart)) {
          simDone = false;
        }
      }
      return Object.assign({}, u, { done: simDone });
    });

    var simRemainingUnits = simUnits.filter(function (u) { return !u.done; });
    var simSchedule = buildSmartScheduleForHistory(cfg, simRemainingUnits, historyStart, today);

    var scheduledIds = new Set();
    if (simSchedule && simSchedule.days) {
      simSchedule.days.forEach(function (day) {
        day.items.forEach(function (item) {
          scheduledIds.add(item.id);
        });
      });
    }
    return scheduledIds;
  }

  function buildSmartSchedule(cfg, remainingUnits, materiasRows, customStartDate, customDayLimit) {
    var remaining = (remainingUnits || []).slice().sort(function (a, b) { return b.priority - a.priority; });
    var lastDayByMateria = new Map();
    var consecutiveDaysByMateria = new Map();
    var days = [];
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var start = customStartDate || smartAddDays(today, 1);
    var limit = customDayLimit || 420;
    
    var studyDayIndex = 0;
    
    function unitFits(unit, capacity, hasItems) {
      if (!unit) return false;
      return unit.estimateMinutes <= capacity + (hasItems ? 10 : 20);
    }

    var JS_DAY_TO_KEY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

    for (var i = 0; i < limit && remaining.length; i++) {
      var date = smartAddDays(start, i);
      var dayKey = JS_DAY_TO_KEY[date.getDay()];
      var hours = Number(cfg && cfg.horas && cfg.horas[dayKey]) || 0;
      if (hours <= 0) continue;
      
      var capacity = hours * 60;
      var maxItems = smartDailyTopicLimit(cfg, hours);
      var items = [];
      var usedMateria = new Set();
      var materiaUseCount = new Map();

      // Check eligibility of all candidate materias
      var eligibleMateriaIds = new Set();
      remaining.forEach(function (u) {
        var id = String(u.materiaId);
        var consecutive = consecutiveDaysByMateria.get(id) || 0;
        var matRow = (materiasRows || []).find(function (r) { return String(r.materia.id) === id; });
        var priority = matRow ? matRow.priority : 50;
        
        var eligible = true;
        if (priority >= 70) {
          eligible = true;
        } else if (priority >= 55) {
          if (consecutive >= 2) eligible = false;
        } else if (priority >= 40) {
          if (consecutive >= 1) eligible = false;
        } else {
          if (consecutive >= 1) eligible = false;
        }
        
        if (eligible) {
          eligibleMateriaIds.add(id);
        }
      });

      var maxPerMateria = smartDailyMateriaLimit(maxItems, eligibleMateriaIds.size);
      var markMateriaUsed = function (materiaId) {
        var id = String(materiaId || '');
        if (!id) return;
        usedMateria.add(id);
        materiaUseCount.set(id, (materiaUseCount.get(id) || 0) + 1);
      };
      var canUseMateria = function (materiaId) {
        var id = String(materiaId || '');
        return (materiaUseCount.get(id) || 0) < maxPerMateria;
      };

      // 1. Force schedule Tier 1 (Máxima) and Tier 2 (Alta Streak Continuation) subjects to guarantee study cadences
      var forceCandidates = (materiasRows || [])
        .filter(function (r) { return eligibleMateriaIds.has(String(r.materia.id)); })
        .map(function (r) {
          var id = String(r.materia.id);
          var consecutive = consecutiveDaysByMateria.get(id) || 0;
          var forceTier = 0;
          if (r.priority >= 70) {
            forceTier = 1; // Máxima (always force daily)
          } else if (r.priority >= 55 && consecutive < 2) {
            forceTier = 2; // Alta Streak Continuation
          }
          return { row: r, forceTier: forceTier };
        })
        .filter(function (item) { return item.forceTier > 0; })
        .sort(function (a, b) { return a.forceTier - b.forceTier || b.row.priority - a.row.priority; });

      forceCandidates.forEach(function (item) {
        if (items.length >= maxItems) return;
        var idx = remaining.findIndex(function (u) {
          return String(u.materiaId) === String(item.row.materia.id) && unitFits(u, capacity, items.length > 0);
        });
        if (idx !== -1) {
          var unit = remaining.splice(idx, 1)[0];
          unit.scheduleLane = 'core';
          items.push(unit);
          markMateriaUsed(unit.materiaId);
          lastDayByMateria.set(unit.materiaId, studyDayIndex);
          capacity -= unit.estimateMinutes;
        }
      });
      
      var safety = 0;
      while (remaining.length && capacity >= 18 && items.length < maxItems && safety < 100) {
        safety += 1;
        
        // Find all remaining units that fit the capacity and are eligible
        var candidates = remaining.filter(function (unit) {
          return eligibleMateriaIds.has(String(unit.materiaId)) && unitFits(unit, capacity, items.length > 0);
        });
        if (!candidates.length) break;
        var cappedCandidates = candidates.filter(function (unit) { return canUseMateria(unit.materiaId); });
        if (cappedCandidates.length) candidates = cappedCandidates;
        
        // Check which materias have units in candidates
        var candidateMateriaIds = new Set(candidates.map(function (u) { return String(u.materiaId); }));
        
        // Partition candidate materias into not-used and used
        var targetMateriaIds = Array.from(candidateMateriaIds).filter(function (id) { return !usedMateria.has(id); });
        if (!targetMateriaIds.length) {
          // If all eligible materias are already used today, allow reuse to fill capacity
          targetMateriaIds = Array.from(candidateMateriaIds);
        }
        
        // Calculate dueScore for each target materia
        var targetMateriaRows = targetMateriaIds.map(function (materiaId) {
          var last = lastDayByMateria.get(materiaId);
          var gap = last === undefined ? 99 : (studyDayIndex - last);
          var matRow = (materiasRows || []).find(function (r) { return String(r.materia.id) === String(materiaId); });
          var priority = matRow ? matRow.priority : 50;
          
          var targetInterval = 3.5;
          if (priority >= 70) targetInterval = 1.0;
          else if (priority >= 55) targetInterval = 1.5;
          else if (priority >= 40) targetInterval = 2.0;
          
          var dueScore = gap / targetInterval;
          return { materiaId: materiaId, priority: priority, dueScore: dueScore };
        });
        
        // Sort target materias
        targetMateriaRows.sort(function (a, b) { return (b.dueScore - a.dueScore) || (b.priority - a.priority); });
        
        var bestMateriaId = targetMateriaRows[0].materiaId;
        
        // Pick the highest priority unit from remaining for this bestMateriaId that fits capacity
        var bestUnitIndex = remaining.findIndex(function (u) {
          return String(u.materiaId) === String(bestMateriaId) && unitFits(u, capacity, items.length > 0);
        });
        
        if (bestUnitIndex === -1) {
          break;
        }
        
        var unit = remaining.splice(bestUnitIndex, 1)[0];
        var bestPriority = targetMateriaRows[0] ? targetMateriaRows[0].priority : 50;
        unit.scheduleLane = bestPriority < 55 ? 'support' : 'core';
        items.push(unit);
        markMateriaUsed(unit.materiaId);
        lastDayByMateria.set(unit.materiaId, studyDayIndex);
        capacity -= unit.estimateMinutes;
      }
      
      if (items.length) {
        days.push({ date: date, key: smartDateKey(date), dayKey: dayKey, hours: hours, items: items });
        
        // Update consecutive study days streaks
        (materiasRows || []).forEach(function (row) {
          var id = String(row.materia.id);
          if (usedMateria.has(id)) {
            consecutiveDaysByMateria.set(id, (consecutiveDaysByMateria.get(id) || 0) + 1);
          } else {
            consecutiveDaysByMateria.set(id, 0);
          }
        });
        
        studyDayIndex += 1;
      }
    }
    
    var scheduledUnits = days.reduce(function (acc, day) { return acc + day.items.length; }, 0);
    var studyDaysUsed = days.length;
    var finishDate = days.length ? days[days.length - 1].date : null;
    return {
      days: days,
      finishDate: finishDate,
      scheduledUnits: scheduledUnits,
      studyDaysUsed: studyDaysUsed,
      avgUnitsPerStudyDay: studyDaysUsed ? scheduledUnits / studyDaysUsed : 0
    };
  }

  function smartFormatHours(value) {
    var minutes = Math.max(0, Math.round((Number(value) || 0) * 60));
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (h && m) return h + 'h' + String(m).padStart(2, '0');
    if (h) return h + 'h';
    return minutes + 'min';
  }

  function smartFormatMinutes(value) {
    var minutes = Math.max(0, Math.round(Number(value) || 0));
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    if (h && m) return h + 'h' + String(m).padStart(2, '0');
    if (h) return h + 'h';
    return minutes + 'min';
  }

  function smartFormatTopicCount(value) {
    var n = Math.max(0, Math.round(Number(value) || 0));
    return n + (n === 1 ? ' tópico' : ' tópicos');
  }

  function smartPriorityTierLabel(value) {
    var n = Number(value) || 0;
    if (n >= 1000) n -= 1000;
    if (n >= 70) return 'Prioridade Máxima';
    if (n >= 55) return 'Prioridade Alta';
    if (n >= 40) return 'Prioridade Média';
    return 'Prioridade Baixa';
  }

  var SMART_PRIORITY_LEVELS = {
    baixa: 32,
    media: 47,
    alta: 62,
    maxima: 78
  };

  function smartNormalizePriorityLevel(value) {
    var key = String(value || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(SMART_PRIORITY_LEVELS, key) ? key : '';
  }

  function smartManualPriorityLevel(cfg, materiaId) {
    var map = cfg && cfg.materiaPrioridades && typeof cfg.materiaPrioridades === 'object' ? cfg.materiaPrioridades : {};
    return smartNormalizePriorityLevel(map[String(materiaId || '')]);
  }

  function smartApplyManualMateriaPriority(cfg, materiaId, autoPriority) {
    var level = smartManualPriorityLevel(cfg, materiaId);
    return level ? SMART_PRIORITY_LEVELS[level] : Math.round(Number(autoPriority) || 0);
  }

  function smartTotalWeeklyHours(cfg) {
    return SMART_DAY_LABELS.reduce(function (acc, day) {
      return acc + (Number(cfg && cfg.horas && cfg.horas[day.key]) || 0);
    }, 0);
  }

  function smartStartOfWeek(date) {
    var d = new Date(date || new Date());
    d.setHours(0, 0, 0, 0);
    var diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }

  function smartEndOfWeek(date) {
    var d = smartStartOfWeek(date || new Date());
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function smartEntryDateKey(entry) {
    if (entry && typeof entry.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.data.trim())) {
      return entry.data.trim();
    }
    var raw = entry && (entry.horaInicio || entry.createdAt || entry.updatedAt);
    if (raw) {
      var d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return smartDateKey(d);
    }
    return '';
  }

  function smartBuildLookup(cid) {
    var materias = (CT.getMaterias(cid) || []);
    var topicos = (CT.getTopicos() || []).filter(function (topico) {
      return materias.some(function (materia) { return materia.id === topico.materiaId; });
    });
    var topicoIds = new Set(topicos.map(function (topico) { return topico.id; }));
    var subtopicos = (CT.getSubtopicos() || []).filter(function (subtopico) {
      return topicoIds.has(subtopico.topicoId);
    });
    return {
      materias: new Map(materias.map(function (m) { return [String(m.id), m]; })),
      topicos: new Map(topicos.map(function (t) { return [String(t.id), t]; })),
      subtopicos: new Map(subtopicos.map(function (s) { return [String(s.id), s]; }))
    };
  }

  function smartMateriaName(lookup, materiaId) {
    var materia = lookup.materias.get(String(materiaId || ''));
    return materia && materia.nome ? materia.nome : 'Sem matéria';
  }

  function smartStudyUnitName(lookup, item) {
    var subId = item && (item.subtopId || item.subtopicoId);
    var topId = item && item.topicoId;
    if (subId) {
      var sub = lookup.subtopicos.get(String(subId));
      if (sub && sub.nome) return sub.nome;
    }
    if (topId) {
      var top = lookup.topicos.get(String(topId));
      if (top && top.nome) return top.nome;
    }
    return smartMateriaName(lookup, item && item.materiaId);
  }

  function smartStudyUnitKey(item) {
    var subId = item && (item.subtopId || item.subtopicoId);
    if (subId) return 'sub:' + subId;
    if (item && item.topicoId) return 'top:' + item.topicoId;
    return 'mat:' + ((item && item.materiaId) || 'sem-materia');
  }

  function smartWeekStats(cfg) {
    var cid = getCid();
    var start = smartStartOfWeek(new Date());
    var end = smartEndOfWeek(new Date());
    var startKey = smartDateKey(start);
    var endKey = smartDateKey(end);
    var lookup = smartBuildLookup(cid);
    var sessions = (CT.getSessoes({ concursoId: cid }) || []).filter(function (s) {
      var key = smartEntryDateKey(s);
      return key && key >= startKey && key <= endKey;
    });
    var questions = (CT.getQuestoes({ concursoId: cid }) || []).filter(function (q) {
      var key = smartEntryDateKey(q);
      return key && key >= startKey && key <= endKey;
    });
    var studiedSeconds = CT.totalSegundos ? CT.totalSegundos(sessions) : sessions.reduce(function (acc, s) {
      return acc + (Number(s.duracaoSegundos) || 0);
    }, 0);
    var metaSeconds = Math.round(smartTotalWeeklyHours(cfg) * 3600);
    var metricas = CT.somarMetricasSessoes ? CT.somarMetricasSessoes(sessions) : sessions.reduce(function (acc, sessao) {
      var m = CT.getMetricasSessao ? CT.getMetricasSessao(sessao) : {};
      acc.paginasPdf += Number(m.paginasPdf) || 0;
      acc.videoMinutos += Number(m.videoMinutos) || 0;
      return acc;
    }, { paginasPdf:0, videoMinutos:0 });
    var questoes = questions.reduce(function (acc, q) {
      acc.resolvidas += Number(q.resolvidas) || 0;
      acc.acertos += Number(q.acertos) || 0;
      acc.erros += Number(q.erros) || 0;
      return acc;
    }, { resolvidas:0, acertos:0, erros:0, pct:null });
    questoes.pct = questoes.resolvidas ? Math.round((questoes.acertos / questoes.resolvidas) * 100) : null;

    var byMateria = new Map();
    var byUnit = new Map();
    function ensureMateria(materiaId) {
      var id = String(materiaId || 'sem-materia');
      if (!byMateria.has(id)) {
        byMateria.set(id, { id:id, nome:smartMateriaName(lookup, materiaId), seconds:0, questoes:{ resolvidas:0, acertos:0, erros:0, pct:null }, metricas:{ paginasPdf:0, videoMinutos:0 } });
      }
      return byMateria.get(id);
    }
    function ensureUnit(item) {
      var key = smartStudyUnitKey(item);
      if (!byUnit.has(key)) {
        byUnit.set(key, { key:key, materiaNome:smartMateriaName(lookup, item && item.materiaId), nome:smartStudyUnitName(lookup, item), seconds:0, questoes:{ resolvidas:0, acertos:0, erros:0, pct:null }, metricas:{ paginasPdf:0, videoMinutos:0 } });
      }
      return byUnit.get(key);
    }
    sessions.forEach(function (s) {
      var seconds = Number(s.duracaoSegundos) || 0;
      var metrics = CT.getMetricasSessao ? CT.getMetricasSessao(s) : { paginasPdf:0, videoMinutos:0 };
      var mat = ensureMateria(s.materiaId);
      mat.seconds += seconds;
      mat.metricas.paginasPdf += Number(metrics.paginasPdf) || 0;
      mat.metricas.videoMinutos += Number(metrics.videoMinutos) || 0;
      var unit = ensureUnit(s);
      unit.seconds += seconds;
      unit.metricas.paginasPdf += Number(metrics.paginasPdf) || 0;
      unit.metricas.videoMinutos += Number(metrics.videoMinutos) || 0;
    });
    questions.forEach(function (q) {
      var mat = ensureMateria(q.materiaId);
      var unit = ensureUnit(q);
      [mat.questoes, unit.questoes].forEach(function (target) {
        target.resolvidas += Number(q.resolvidas) || 0;
        target.acertos += Number(q.acertos) || 0;
        target.erros += Number(q.erros) || 0;
      });
    });
    byMateria.forEach(function (row) {
      row.questoes.pct = row.questoes.resolvidas ? Math.round((row.questoes.acertos / row.questoes.resolvidas) * 100) : null;
    });
    byUnit.forEach(function (row) {
      row.questoes.pct = row.questoes.resolvidas ? Math.round((row.questoes.acertos / row.questoes.resolvidas) * 100) : null;
    });

    return {
      start:start,
      end:end,
      startKey:startKey,
      endKey:endKey,
      studiedSeconds:studiedSeconds,
      metaSeconds:metaSeconds,
      pct:metaSeconds ? Math.round((studiedSeconds / metaSeconds) * 100) : 0,
      sessions:sessions,
      questions:questions,
      questoes:questoes,
      metricas:metricas || { paginasPdf:0, videoMinutos:0 },
      materias:Array.from(byMateria.values()).sort(function (a, b) { return b.seconds - a.seconds || b.questoes.resolvidas - a.questoes.resolvidas; }),
      unidades:Array.from(byUnit.values()).sort(function (a, b) { return b.seconds - a.seconds || b.questoes.resolvidas - a.questoes.resolvidas; })
    };
  }

  function smartPctLabel(value) {
    return value == null ? '-' : value + '%';
  }

  function smartBuildLoadCard(cfg) {
    var stats = smartWeekStats(cfg);
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'smart-load-card';
    var pct = stats.metaSeconds ? Math.min(100, Math.max(0, (stats.studiedSeconds / stats.metaSeconds) * 100)) : 0;
    var details = [stats.metaSeconds ? (stats.pct + '% da meta semanal') : 'meta semanal não definida'];
    if (stats.questoes.resolvidas) details.push(stats.questoes.resolvidas + ' questões | ' + smartPctLabel(stats.questoes.pct) + ' acertos');
    if (stats.metricas.paginasPdf) details.push(stats.metricas.paginasPdf + ' páginas');
    if (stats.metricas.videoMinutos) details.push(stats.metricas.videoMinutos + ' min videoaulas');
    if (!details.length) details.push('Clique para ver a análise da semana.');
    card.innerHTML = ''
      + '<div class="smart-load-row">'
      + '<div><div class="smart-load-label">Carga estudada</div><div class="smart-load-value">' + escapeHtml(formatCycleClock(stats.studiedSeconds)) + '</div></div>'
      + '<div class="smart-load-bar"><div class="smart-load-fill" style="width:' + pct.toFixed(1) + '%"></div></div>'
      + '<div><div class="smart-load-label" style="text-align:right">Meta semanal</div><div class="smart-load-value goal">' + escapeHtml(formatCycleClock(stats.metaSeconds)) + '</div></div>'
      + '</div>'
      + '<div class="smart-load-sub">' + escapeHtml(details.join(' | ')) + '</div>';
    card.addEventListener('click', function () {
      openSmartWeeklyAnalysis(stats);
    });
    return card;
  }

  function smartAnalysisStat(label, value, sub) {
    return '<div class="smart-analysis-stat"><b>' + escapeHtml(label) + '</b><span>' + escapeHtml(value) + '</span>' + (sub ? '<div class="smart-analysis-meta">' + escapeHtml(sub) + '</div>' : '') + '</div>';
  }

  function smartAnalysisRows(rows, emptyText) {
    if (!rows || !rows.length) {
      return '<div class="smart-empty">' + escapeHtml(emptyText || 'Sem dados nesta semana.') + '</div>';
    }
    return rows.map(function (row) {
      var meta = [];
      if (row.questoes && row.questoes.resolvidas) meta.push(row.questoes.resolvidas + ' questões | ' + smartPctLabel(row.questoes.pct) + ' acertos');
      if (row.metricas && row.metricas.paginasPdf) meta.push(row.metricas.paginasPdf + ' páginas');
      if (row.metricas && row.metricas.videoMinutos) meta.push(row.metricas.videoMinutos + ' min videoaulas');
      return '<div class="smart-analysis-row">'
        + '<div><div class="smart-analysis-name">' + escapeHtml(row.nome || 'Item') + '</div>'
        + (row.materiaNome ? '<div class="smart-analysis-meta">' + escapeHtml(row.materiaNome) + '</div>' : '')
        + (meta.length ? '<div class="smart-analysis-meta">' + escapeHtml(meta.join(' | ')) + '</div>' : '') + '</div>'
        + '<div class="smart-analysis-time">' + escapeHtml(formatCycleClock(row.seconds || 0)) + '</div>'
        + '</div>';
    }).join('');
  }

  function openSmartWeeklyAnalysis(stats) {
    var old = document.getElementById('smartAnalysisModal');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'smartAnalysisModal';
    overlay.className = 'smart-analysis-overlay';
    var rangeLabel = stats.start.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' a ' + stats.end.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
    overlay.innerHTML = ''
      + '<div class="smart-analysis-panel" role="dialog" aria-modal="true">'
      + '<div class="smart-analysis-head">'
      + '<div><div class="smart-analysis-title">Análise da semana</div><div class="smart-analysis-sub">' + escapeHtml(rangeLabel + ' | progresso: ' + stats.pct + '% da meta semanal') + '</div></div>'
      + '<button class="smart-analysis-close" type="button" aria-label="Fechar">×</button>'
      + '</div>'
      + '<div class="smart-analysis-grid">'
      + smartAnalysisStat('Carga', formatCycleClock(stats.studiedSeconds), 'tempo registrado')
      + smartAnalysisStat('Meta', formatCycleClock(stats.metaSeconds), 'horas configuradas')
      + smartAnalysisStat('Questões', String(stats.questoes.resolvidas || 0), smartPctLabel(stats.questoes.pct) + ' acertos')
      + smartAnalysisStat('Método', (stats.metricas.paginasPdf || 0) + ' pág. | ' + (stats.metricas.videoMinutos || 0) + ' min', 'PDF/Livro e videoaulas')
      + '</div>'
      + '<div class="smart-analysis-section"><div class="smart-analysis-section-title">Por matéria</div>' + smartAnalysisRows(stats.materias.slice(0, 8), 'Nenhuma matéria estudada nesta semana.') + '</div>'
      + '<div class="smart-analysis-section"><div class="smart-analysis-section-title">Tópicos e subtópicos estudados</div>' + smartAnalysisRows(stats.unidades.slice(0, 12), 'Nenhum tópico registrado nesta semana.') + '</div>'
      + '</div>';
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) overlay.remove();
    });
    overlay.querySelector('.smart-analysis-close').addEventListener('click', function () {
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function smartUnitStudyName(unit) {
    if (!unit) return '';
    if (unit.tipo === 'subtopico') return unit.subtopicoNome || unit.nome || 'Subtópico';
    if (unit.tipo === 'topico') return unit.topicoNome || unit.nome || 'Tópico';
    return unit.nome || unit.materiaNome || 'Matéria';
  }

  function smartUnitClass(unit) {
    if (!unit) return '';
    if (unit.overdue) return 'overdue';
    if (unit.scheduleLane === 'support') return 'support';
    if (unit.signal && ['dificuldade', 'queda'].indexOf(unit.signal.key) >= 0) return 'warning';
    if (unit.priority >= 70 && unit.priority < 1000) return 'important';
    return '';
  }

  function smartPctText(stats) {
    return stats && stats.resolvidas ? Math.round(stats.pct || 0) + '%' : '';
  }

  function smartPillsHtml(unit, status) {
    var alertPills = [];
    var pills = [];
    if (unit.overdue) {
      alertPills.push({ label: 'Acumulado / Atrasado ⏳', cls: 'overdue' });
    }
    if (unit && unit._extraToday && status === 'finalized') {
      alertPills.push({ label: 'Estudo Extra Concluído! 🔥', cls: 'extra-finalized' });
    } else if (status === 'studied') {
      alertPills.push({ label: 'Estudo Iniciado 📙', cls: 'started' });
    } else if (status === 'finalized') {
      alertPills.push({ label: 'Finalizado 🎉', cls: 'recovery' });
    }
    if (unit.general && unit.general.resolvidas) pills.push({ label:'Geral: ' + smartPctText(unit.general), cls:'' });
    else pills.push({ label:'Sem questões', cls:'' });
    if (unit.recent && unit.recent.resolvidas) pills.push({ label:'Últimas ' + unit.recent.resolvidas + ': ' + smartPctText(unit.recent), cls:'' });
    else pills.push({ label:'Sem recentes', cls:'' });
    if (unit.signal) pills.push({ label:unit.signal.label, cls:unit.signal.className || '' });
    var alertHtml = alertPills.length ? '<div class="smart-alert-pills">' + alertPills.map(function (pill) {
      return '<span class="smart-pill ' + escapeHtml(pill.cls) + '">' + escapeHtml(pill.label) + '</span>';
    }).join('') + '</div>' : '';
    var statsHtml = '<div class="smart-question-box"><div class="smart-question-title">Desempenho em questões</div><div class="smart-pills">' + pills.map(function (pill) {
      return '<span class="smart-pill ' + escapeHtml(pill.cls) + '">' + escapeHtml(pill.label) + '</span>';
    }).join('') + '</div></div>';
    return alertHtml + statsHtml;
  }

  function openSmartScheduleTimer(unit) {
    if (!unit) return;
    var preset = {
      materiaId: unit.materiaId || '',
      topicoId: unit.topicoId || '',
      subtopicoId: unit.subtopId || '',
      tipoEstudo: 'Estudo',
      autoStart: true
    };
    if (typeof window.openFreeTimerPreset === 'function') {
      window.openFreeTimerPreset(preset);
      return;
    }
    var state = getTimerState();
    state.mode = 'free';
    state.open = true;
    state.minimized = false;
    state.freeRunning = false;
    state.freeSeconds = 0;
    state.lastTick = null;
    state.cyclePreset = null;
    state.selectedMateria = preset.materiaId;
    state.selectedTopic = preset.topicoId;
    state.selectedSubtopic = preset.subtopicoId;
    saveTimerState(state);
    if (typeof window.setTimerMode === 'function') window.setTimerMode('free');
    if (typeof window.openTimerPopup === 'function') window.openTimerPopup();
    if (typeof window._refreshTimerState === 'function') window._refreshTimerState();
  }

  function smartScheduleItemKey(unit) {
    if (!unit) return '';
    if (unit.subtopId) return 'sub:' + unit.subtopId;
    if (unit.topicoId) return 'top:' + unit.topicoId;
    if (unit.materiaId) return 'mat:' + unit.materiaId;
    return '';
  }

  function smartDashboardSnapshotKey(cid) {
    return 'ct_crono_dia_snapshot_' + cid;
  }

  function smartReadDashboardSnapshots(cid) {
    if (!cid) return {};
    try {
      var parsed = JSON.parse(localStorage.getItem(smartDashboardSnapshotKey(cid)) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function smartWriteDashboardSnapshot(cid, dayKey, items, overwrite) {
    if (!cid || !dayKey || !Array.isArray(items) || !items.length) return;
    var plannedItems = items.filter(function (unit) { return unit && !unit._extraToday; });
    if (!plannedItems.length) return;
    var snapshots = smartReadDashboardSnapshots(cid);
    if (!overwrite && snapshots[dayKey] && Array.isArray(snapshots[dayKey].items) && snapshots[dayKey].items.length) return;
    snapshots[dayKey] = {
      data: dayKey,
      createdAt: (snapshots[dayKey] && snapshots[dayKey].createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: plannedItems.map(function (unit) {
        return {
          id: unit.id || '',
          key: smartScheduleItemKey(unit),
          priority: Number(unit.priority) || 0,
          scheduleLane: unit.scheduleLane || '',
          estimateMinutes: Number(unit.estimateMinutes || unit.minutes) || 0
        };
      }).filter(function (entry) { return entry.id || entry.key; })
    };
    localStorage.setItem(smartDashboardSnapshotKey(cid), JSON.stringify(snapshots));
  }

  function smartFindSnapshotUnit(units, entry) {
    var id = typeof entry === 'string' ? entry : (entry && entry.id);
    var key = typeof entry === 'string' ? '' : (entry && entry.key);
    if (id) {
      var byId = units.find(function (unit) { return String(unit.id || '') === String(id); });
      if (byId) return byId;
    }
    if (!key) return null;
    if (key.indexOf('sub:') === 0) {
      var subId = key.slice(4);
      return units.find(function (unit) { return String(unit.subtopId || '') === String(subId); }) || null;
    }
    if (key.indexOf('top:') === 0) {
      var topId = key.slice(4);
      return units.find(function (unit) { return String(unit.topicoId || '') === String(topId) && !unit.subtopId; }) || null;
    }
    if (key.indexOf('mat:') === 0) {
      var matId = key.slice(4);
      return units.find(function (unit) { return String(unit.id || '') === key || String(unit.materiaId || '') === String(matId); }) || null;
    }
    return null;
  }

  function smartCloneDashboardUnit(unit, fromSnapshot) {
    return unit ? Object.assign({}, unit, {
      _fromTodaySnapshot: !!fromSnapshot,
      _extraToday: !!(unit && unit._extraToday)
    }) : null;
  }

  function smartSnapshotItemsForDay(cid, dayKey, units) {
    var snapshots = smartReadDashboardSnapshots(cid);
    var snapshot = snapshots[dayKey];
    if (!snapshot || !Array.isArray(snapshot.items) || !snapshot.items.length) return null;
    var items = snapshot.items.map(function (entry) {
      var unit = smartCloneDashboardUnit(smartFindSnapshotUnit(units, entry), true);
      if (unit && entry && typeof entry === 'object') {
        if (Number.isFinite(Number(entry.priority)) && Number(entry.priority) > 0) unit.priority = Number(entry.priority);
        if (entry.scheduleLane) unit.scheduleLane = entry.scheduleLane;
        if (Number.isFinite(Number(entry.estimateMinutes)) && Number(entry.estimateMinutes) > 0) {
          unit.estimateMinutes = Number(entry.estimateMinutes);
          unit.minutes = Number(entry.estimateMinutes);
        }
      }
      return unit;
    }).filter(Boolean);
    return items.length ? items : null;
  }

  function smartApplyTodayCompletionRecovery(items, units, todayKey) {
    var result = (items || []).map(function (unit) {
      return smartCloneDashboardUnit(unit, unit && unit._fromTodaySnapshot);
    }).filter(Boolean);
    var ids = new Set();
    result.forEach(function (unit) {
      if (unit.id) ids.add(String(unit.id));
      var key = smartScheduleItemKey(unit);
      if (key) ids.add(key);
    });
    var completedToday = (units || []).filter(function (unit) {
      return unit && unit.done && unit.doneAt === todayKey;
    });

    completedToday.forEach(function (doneUnit) {
      var doneId = String(doneUnit.id || '');
      var doneKey = smartScheduleItemKey(doneUnit);
      if ((doneId && ids.has(doneId)) || (doneKey && ids.has(doneKey))) return;

      var clone = smartCloneDashboardUnit(doneUnit, false);
      clone._extraToday = true;
      clone.scheduleLane = 'extra';
      result.push(clone);
      if (doneId) ids.add(doneId);
      if (doneKey) ids.add(doneKey);
    });

    return result;
  }

  function smartTrimTodayItems(items, units, todayKey, maxItems) {
    var limit = Math.max(0, parseInt(maxItems, 10) || 0);
    if (!Array.isArray(items)) return [];
    var extras = items.filter(function (unit) { return unit && unit._extraToday; });
    var planned = items.filter(function (unit) { return unit && !unit._extraToday; });
    if (!limit || planned.length <= limit) return planned.concat(extras);
    var unitById = new Map((units || []).map(function (unit) { return [String(unit.id || ''), unit]; }));
    var selected = [];
    var selectedIds = new Set();

    function isDoneToday(unit) {
      var realUnit = unitById.get(String(unit.id || '')) || unit;
      return !!(realUnit && realUnit.done && realUnit.doneAt === todayKey);
    }

    planned.forEach(function (unit) {
      if (selected.length >= limit) return;
      if (!isDoneToday(unit)) return;
      selected.push(unit);
      selectedIds.add(String(unit.id || ''));
    });

    planned.forEach(function (unit) {
      if (selected.length >= limit) return;
      var id = String(unit.id || '');
      if (selectedIds.has(id)) return;
      selected.push(unit);
      selectedIds.add(id);
    });

    return selected.concat(extras);
  }

  function smartRebalanceTodayItems(items, units, todayKey, maxItems) {
    var limit = Math.max(0, parseInt(maxItems, 10) || 0);
    if (!Array.isArray(items)) return [];
    var extras = items.filter(function (unit) { return unit && unit._extraToday; });
    var plannedItems = items.filter(function (unit) { return unit && !unit._extraToday; });
    if (!limit || plannedItems.length <= 1) return plannedItems.concat(extras);
    var unitById = new Map((units || []).map(function (unit) { return [String(unit.id || ''), unit]; }));
    var selected = [];
    var selectedIds = new Set();
    var selectedMateria = new Set();
    var done = [];
    var pending = [];

    function isDoneToday(unit) {
      var realUnit = unitById.get(String(unit.id || '')) || unit;
      return !!(realUnit && realUnit.done && realUnit.doneAt === todayKey);
    }

    function add(unit) {
      if (!unit || selected.length >= limit) return false;
      var id = String(unit.id || '');
      var key = id || smartScheduleItemKey(unit);
      if (key && selectedIds.has(key)) return false;
      selected.push(unit);
      if (key) selectedIds.add(key);
      if (unit.materiaId) selectedMateria.add(String(unit.materiaId));
      return true;
    }

    plannedItems.forEach(function (unit) {
      if (isDoneToday(unit)) done.push(unit);
      else pending.push(unit);
    });

    done.forEach(add);
    pending.forEach(function (unit) {
      if (selected.length >= limit) return;
      var materiaId = String(unit.materiaId || '');
      if (materiaId && selectedMateria.has(materiaId)) return;
      add(unit);
    });
    pending.forEach(add);

    return selected.concat(extras);
  }

  function smartSnapshotNeedsRebalance(items, maxItems) {
    if (!Array.isArray(items) || items.length < 3) return false;
    var counts = {};
    items.forEach(function (unit) {
      var id = String(unit && unit.materiaId || '');
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
    });
    var values = Object.keys(counts).map(function (id) { return counts[id]; });
    if (!values.length) return false;
    var maxCount = Math.max.apply(null, values);
    var distinct = values.length;
    var expectedMinimum = Math.min(items.length, Math.max(2, Math.ceil((parseInt(maxItems, 10) || items.length) / 2)));
    return maxCount > 2 || (items.length >= 4 && distinct < expectedMinimum);
  }

  function smartItemsIdentitySet(items) {
    var set = new Set();
    (items || []).forEach(function (unit) {
      if (!unit) return;
      if (unit.id) set.add(String(unit.id));
      var key = smartScheduleItemKey(unit);
      if (key) set.add(key);
    });
    return set;
  }

  function smartSnapshotHasExtraCompletion(snapshotItems, computedItems, units, todayKey) {
    if (!Array.isArray(snapshotItems) || !snapshotItems.length || !Array.isArray(computedItems) || !computedItems.length) return false;
    var computedIds = smartItemsIdentitySet(computedItems);
    var unitById = new Map((units || []).map(function (unit) { return [String(unit.id || ''), unit]; }));

    return snapshotItems.some(function (unit) {
      if (!unit) return false;
      var realUnit = unitById.get(String(unit.id || '')) || unit;
      if (!(realUnit && realUnit.done && realUnit.doneAt === todayKey)) return false;
      var id = String(unit.id || '');
      var key = smartScheduleItemKey(unit);
      return (!id || !computedIds.has(id)) && (!key || !computedIds.has(key));
    });
  }

  function smartResolveTodayDashboardItems(cid, todayKey, computedItems, units, maxItems) {
    var snapshotItems = smartSnapshotItemsForDay(cid, todayKey, units);
    var rebuildSnapshot = !!(snapshotItems && (
      smartSnapshotNeedsRebalance(snapshotItems, maxItems) ||
      smartSnapshotHasExtraCompletion(snapshotItems, computedItems, units, todayKey)
    ));
    var useSnapshot = !!snapshotItems && !rebuildSnapshot;
    var sourceItems = useSnapshot ? snapshotItems : (computedItems || []);
    var items = sourceItems.map(function (unit) {
      return smartCloneDashboardUnit(unit, useSnapshot || !!(unit && unit._fromTodaySnapshot));
    }).filter(Boolean);
    items = smartApplyTodayCompletionRecovery(items, units, todayKey);
    items = smartRebalanceTodayItems(items, units, todayKey, maxItems);
    items = smartTrimTodayItems(items, units, todayKey, maxItems);
    if (items.length) smartWriteDashboardSnapshot(cid, todayKey, items, !!snapshotItems || rebuildSnapshot);
    return items;
  }

  function smartGetDailyStatusMap(cid, dayKey) {
    if (!cid || !dayKey || typeof window.CT === 'undefined' || typeof window.CT.getCronogramaDiarioStatus !== 'function') return {};
    return window.CT.getCronogramaDiarioStatus(cid, dayKey) || {};
  }

  function smartUnitHasActivityToday(unit, allSessions, allQuestions, todayKey) {
    function matches(entry) {
      if (unit.subtopId) {
        return String(entry.subtopId || entry.subtopicoId || '') === String(unit.subtopId) ||
          (String(entry.topicoId || '') === String(unit.topicoId) && !(entry.subtopId || entry.subtopicoId));
      }
      if (unit.topicoId) return String(entry.topicoId || '') === String(unit.topicoId);
      return String(entry.materiaId || '') === String(unit.materiaId);
    }

    var hasSession = (allSessions || []).some(function (s) {
      return smartGetEntryDateKey(s) === todayKey && matches(s);
    });
    if (hasSession) return true;
    return (allQuestions || []).some(function (q) {
      return smartGetEntryDateKey(q) === todayKey && matches(q);
    });
  }

  function smartDashboardUnitStatus(unit, units, dailyStatusMap, allSessions, allQuestions, todayKey) {
    var realUnit = (units || []).find(function (u) { return String(u.id || '') === String(unit.id || ''); }) || unit;
    var record = dailyStatusMap[smartScheduleItemKey(unit)] || null;

    if (realUnit && realUnit.done && (realUnit.doneAt === todayKey || unit._fromTodaySnapshot || (record && record.status === 'estudado'))) {
      return 'finalized';
    }
    if (record && record.status === 'em_estudo' && !(realUnit && realUnit.done)) {
      return 'studied';
    }
    if (smartUnitHasActivityToday(unit, allSessions, allQuestions, todayKey)) {
      return 'studied';
    }
    return 'pending';
  }

  function smartBuildTodayDashboardState() {
    var cfg = getSmartAgendadoConfig();
    if (!cfg) return null;
    var units = buildSmartUnits(cfg);
    var materiasRows = smartBuildMateriasRows(cfg, units);

    var materiaPriorityMap = new Map(materiasRows.map(function (r) { return [String(r.materia.id), r.priority]; }));
    units.forEach(function (unit) {
      var sPriority = materiaPriorityMap.get(String(unit.materiaId)) || 50;
      unit.priority = sPriority;
    });

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var todayKey = smartDateKey(today);
    var cid = getCid();

    var historyStart = today;
    if (cfg.agendadoStartDate) {
      var parts = cfg.agendadoStartDate.split('-').map(Number);
      if (parts.length === 3) {
        historyStart = new Date(parts[0], parts[1] - 1, parts[2]);
        historyStart.setHours(0, 0, 0, 0);
      }
    }

    var simUnits = units.map(function (u) {
      var simDone = u.done;
      var simPriority = u.priority;
      if (u.done && u.doneAt) {
        if (u.doneAt >= smartDateKey(historyStart)) {
          simDone = false;
          simPriority = u.priority + 24;
        }
      }
      return Object.assign({}, u, { done: simDone, priority: simPriority });
    });

    var simRemainingUnits = simUnits.filter(function (u) { return !u.done; });
    var tomorrow = smartAddDays(today, 1);
    var diffMs = Math.abs(tomorrow.getTime() - historyStart.getTime());
    var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    var historySchedule = buildSmartSchedule(cfg, simRemainingUnits, materiasRows, historyStart, diffDays);
    var targetDay = (historySchedule.days || []).find(function (day) { return day.key === todayKey; }) || null;
    var todayDayKey = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][today.getDay()];
    var todayHours = targetDay ? targetDay.hours : (Number(cfg && cfg.horas && cfg.horas[todayDayKey]) || 0);
    var todayMaxItems = smartDailyTopicLimit(cfg, todayHours);
    var todayItems = smartResolveTodayDashboardItems(cid, todayKey, targetDay ? targetDay.items : [], units, todayMaxItems);
    var allSessions = (typeof CT !== 'undefined' && CT.getSessoes) ? (CT.getSessoes({ concursoId: cid }) || []) : [];
    var allQuestions = (typeof CT !== 'undefined' && CT.getQuestoes) ? (CT.getQuestoes({ concursoId: cid }) || []) : [];
    var dailyStatusMap = smartGetDailyStatusMap(cid, todayKey);

    return {
      cfg: cfg,
      units: units,
      materiasRows: materiasRows,
      cid: cid,
      today: today,
      todayKey: todayKey,
      todayHours: todayHours,
      todayMaxItems: todayMaxItems,
      todayItems: todayItems,
      allSessions: allSessions,
      allQuestions: allQuestions,
      dailyStatusMap: dailyStatusMap
    };
  }

  function smartShareUrlHost(url) {
    try {
      return new URL(String(url || '')).hostname.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function smartShareIsHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
  }

  function smartShareMaterialType(cad, url) {
    var rotulo = String(cad && cad.rotulo || cad && cad.tipo || '').trim().toUpperCase();
    var host = smartShareUrlHost(url);
    if (host === 'qconcursos.com' || host === 'www.qconcursos.com' || host.endsWith('.qconcursos.com')) return 'Caderno de questões Qconcursos';
    if (host === 'youtube.com' || host === 'www.youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'Videoaula YouTube';
    if (host === 'drive.google.com' || host === 'docs.google.com') return 'Google Drive';
    if (host === 'estrategiaconcursos.com.br' || host === 'www.estrategiaconcursos.com.br' || host.endsWith('.estrategiaconcursos.com.br')) return 'Estratégia Concursos';
    if (rotulo === 'QUEST') return 'Caderno de questões';
    if (rotulo === 'VIDEO') return 'Videoaula';
    if (rotulo === 'PDF' || /\.pdf(?:$|[?#])/i.test(String(url || ''))) return 'PDF';
    if (rotulo === 'FLASH') return 'Flashcards';
    return 'Material';
  }

  function smartCollectShareMaterials(unit) {
    if (typeof CT === 'undefined') return { links: [], total: 0 };
    var sub = unit && unit.subtopId && CT.getSubtopico ? CT.getSubtopico(unit.subtopId) : null;
    var top = unit && unit.topicoId && CT.getTopico ? CT.getTopico(unit.topicoId) : null;
    if (!top && sub && sub.topicoId && CT.getTopico) top = CT.getTopico(sub.topicoId);
    var materia = unit && unit.materiaId && CT.getMateria ? CT.getMateria(unit.materiaId) : null;
    var owners = [];
    if (sub) owners.push(sub);
    if (top) owners.push(top);

    var rows = [];
    var seen = new Set();
    function addFrom(owner) {
      (Array.isArray(owner && owner.cadernos) ? owner.cadernos : []).forEach(function (cad) {
        var url = String(cad && (cad.url || cad.link || cad.href) || '').trim();
        if (!smartShareIsHttpUrl(url)) return;
        var key = url.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          label: String(cad && (cad.nome || cad.titulo || cad.name) || '').trim() || smartShareMaterialType(cad, url),
          type: smartShareMaterialType(cad, url),
          url: url
        });
      });
    }

    owners.forEach(addFrom);
    if (!rows.length && materia) addFrom(materia);
    return { links: rows.slice(0, 4), total: rows.length };
  }

  function smartShareStatusLabel(status, unit) {
    if (status === 'finalized' && unit && unit._extraToday) return 'Estudo extra concluído';
    if (status === 'finalized') return 'Concluído';
    if (status === 'studied') return 'Estudo iniciado';
    return 'Pendente';
  }

  function smartBuildTodayShareMessage() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var currentKey = smartDateKey(today);
    var cached = window.__smartTodayShareState;
    var state = cached && cached.todayKey === currentKey ? cached : smartBuildTodayDashboardState();
    if (!state) return '';
    window.__smartTodayShareState = state;
    var concurso = (typeof CT !== 'undefined' && CT.getConcurso) ? CT.getConcurso(state.cid) : null;
    var dateLabel = state.today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    var total = (state.todayItems || []).length;
    var lines = [
      'Estudos de hoje - Track Concursos',
      'Concurso: ' + ((concurso && concurso.nome) || 'Concurso atual'),
      'Data: ' + dateLabel,
      'Plano: ' + total + (total === 1 ? ' tópico' : ' tópicos')
    ];

    if (!total) {
      lines.push('', 'Nenhum estudo sugerido para hoje.');
      return lines.join('\n');
    }

    (state.todayItems || []).forEach(function (unit, index) {
      var status = smartDashboardUnitStatus(unit, state.units, state.dailyStatusMap, state.allSessions, state.allQuestions, state.todayKey);
      var materials = smartCollectShareMaterials(unit);
      lines.push('');
      lines.push((index + 1) + '. ' + (unit.materiaNome || 'Matéria'));
      lines.push('   Estudo: ' + smartUnitStudyName(unit));
      lines.push('   Prioridade: ' + smartPriorityTierLabel(unit.priority).replace(/^Prioridade\s+/i, ''));
      lines.push('   Status: ' + smartShareStatusLabel(status, unit));
      if (materials.links.length) {
        lines.push('   Materiais:');
        materials.links.forEach(function (item) {
          var label = item.label === item.type ? item.label : item.type + ' - ' + item.label;
          lines.push('   - ' + label + ': ' + item.url);
        });
        if (materials.total > materials.links.length) {
          lines.push('   - +' + (materials.total - materials.links.length) + ' material(is) no app');
        }
      }
    });

    lines.push('', 'Bom estudo!');
    return lines.join('\n');
  }

  function smartCopyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  function smartShareToast(text, icon) {
    if (typeof CT !== 'undefined' && CT.toast) CT.toast(text, icon || 'OK');
    else alert(text);
  }

  async function smartOpenExternalShareUrl(url) {
    try {
      if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.open_external_url === 'function') {
        var res = await window.pywebview.api.open_external_url(url);
        if (res && res.ok) return;
      }
    } catch (e) {}
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function smartTodayPdfFileDate(date) {
    var d = date || new Date();
    return String(d.getDate()).padStart(2, '0') + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + d.getFullYear();
  }

  function smartPdfContestLine(concurso) {
    var parts = [];
    if (concurso && concurso.nome) parts.push(concurso.nome);
    if (concurso && concurso.cargo) parts.push(concurso.cargo);
    return parts.join(' - ') || 'Concurso atual';
  }

  function smartPdfProfileName() {
    if (typeof CT !== 'undefined' && CT.getBackupNome) {
      var name = CT.getBackupNome();
      if (name) return name;
    }
    return localStorage.getItem('ct_backup_nome') || 'Perfil do usuário';
  }

  function smartPdfEntryMatches(unit, entry) {
    if (!unit || !entry) return false;
    var unitSubId = unit.subtopId || unit.subtopicoId;
    var entrySubId = entry.subtopId || entry.subtopicoId;
    if (unitSubId) {
      return String(entrySubId || '') === String(unitSubId) ||
        (String(entry.topicoId || '') === String(unit.topicoId || '') && !entrySubId);
    }
    if (unit.topicoId) return String(entry.topicoId || '') === String(unit.topicoId);
    return String(entry.materiaId || '') === String(unit.materiaId || '');
  }

  function smartPdfUnitMetrics(unit, state) {
    var seconds = 0;
    var resolvidas = 0;
    var acertos = 0;
    (state.allSessions || []).forEach(function (sessao) {
      if (smartGetEntryDateKey(sessao) !== state.todayKey || !smartPdfEntryMatches(unit, sessao)) return;
      seconds += Number(sessao.duracaoSegundos) || 0;
    });
    (state.allQuestions || []).forEach(function (questao) {
      if (smartGetEntryDateKey(questao) !== state.todayKey || !smartPdfEntryMatches(unit, questao)) return;
      resolvidas += Number(questao.resolvidas) || 0;
      acertos += Number(questao.acertos) || 0;
    });
    return {
      seconds: seconds,
      horas: seconds > 0 ? formatCycleClock(seconds) : '',
      questoes: resolvidas > 0 ? String(resolvidas) : '',
      acertos: resolvidas > 0 ? String(acertos) : ''
    };
  }

  function smartBuildTodayPdfGroups(state) {
    var groups = [];
    var byKey = new Map();
    (state.todayItems || []).forEach(function (unit) {
      var key = String(unit.materiaId || unit.materiaNome || 'sem-materia');
      if (!byKey.has(key)) {
        var group = { key: key, materia: unit.materiaNome || 'Sem matéria', items: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      var status = smartDashboardUnitStatus(unit, state.units, state.dailyStatusMap, state.allSessions, state.allQuestions, state.todayKey);
      var materials = smartCollectShareMaterials(unit);
      byKey.get(key).items.push({
        unit: unit,
        nome: smartUnitStudyName(unit),
        prioridade: smartPriorityTierLabel(unit.priority).replace(/^Prioridade\s+/i, ''),
        status: smartShareStatusLabel(status, unit),
        metrics: smartPdfUnitMetrics(unit, state),
        materials: materials.links.slice(0, 2)
      });
    });
    return groups;
  }

  function smartTodayPdfTotals(groups) {
    return groups.reduce(function (acc, group) {
      group.items.forEach(function (item) {
        acc.seconds += item.metrics.seconds || 0;
        acc.questoes += Number(item.metrics.questoes) || 0;
        acc.acertos += Number(item.metrics.acertos) || 0;
        acc.topicos += 1;
      });
      return acc;
    }, { seconds: 0, questoes: 0, acertos: 0, topicos: 0 });
  }

  function smartSplitTodayPdfPages(groups) {
    var pages = [];
    var page = [];
    var weight = 0;
    var maxWeight = 23;
    function pushPage() {
      if (page.length) pages.push(page);
      page = [];
      weight = 0;
    }
    groups.forEach(function (group) {
      var headerWeight = 1.1;
      if (weight + headerWeight > maxWeight) pushPage();
      page.push({ type: 'subject', label: group.materia });
      weight += headerWeight;
      group.items.forEach(function (item) {
        var rowWeight = 1.45 + (item.materials && item.materials.length ? 0.45 : 0);
        if (weight + rowWeight > maxWeight && page.length) {
          pushPage();
          page.push({ type: 'subject', label: group.materia + ' (continuação)' });
          weight += headerWeight;
        }
        page.push({ type: 'item', item: item });
        weight += rowWeight;
      });
    });
    pushPage();
    return pages.length ? pages : [[{ type: 'empty' }]];
  }

  function smartTodayPdfRowHtml(row, indexRef) {
    if (row.type === 'subject') {
      return '<tr class="smart-pdf-subject"><td colspan="4">' + escapeHtml(row.label) + '</td></tr>';
    }
    if (row.type === 'empty') {
      return '<tr><td colspan="4" class="smart-pdf-empty">Nenhum estudo sugerido para hoje.</td></tr>';
    }
    indexRef.value += 1;
    var item = row.item;
    var materialHtml = '';
    if (item.materials && item.materials.length) {
      materialHtml = '<div class="smart-pdf-links">Materiais: '
        + item.materials.map(function (material) {
          return escapeHtml(material.type + ' - ' + material.url);
        }).join('<br>')
        + '</div>';
    }
    return '<tr>'
      + '<td class="smart-pdf-topic">'
      + '<div class="smart-pdf-topic-name">' + indexRef.value + '. ' + escapeHtml(item.nome) + '</div>'
      + '<div class="smart-pdf-topic-meta">Prioridade ' + escapeHtml(item.prioridade) + ' | ' + escapeHtml(item.status) + '</div>'
      + materialHtml
      + '</td>'
      + '<td class="smart-pdf-control">' + escapeHtml(item.metrics.horas) + '</td>'
      + '<td class="smart-pdf-control">' + escapeHtml(item.metrics.questoes) + '</td>'
      + '<td class="smart-pdf-control">' + escapeHtml(item.metrics.acertos) + '</td>'
      + '</tr>';
  }

  function smartBuildTodayPdfDom(state, groups) {
    var concurso = (typeof CT !== 'undefined' && CT.getConcurso) ? CT.getConcurso(state.cid) : null;
    var contestLine = smartPdfContestLine(concurso);
    var profileName = smartPdfProfileName();
    var dateLabel = state.today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    var totals = smartTodayPdfTotals(groups);
    var pages = smartSplitTodayPdfPages(groups);
    var root = document.createElement('div');
    root.className = 'smart-pdf-export-root';
    root.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;background:#fff;color:#111;z-index:-1;';
    var indexRef = { value: 0 };
    root.innerHTML = '<style>'
      + '.smart-pdf-page{width:794px;min-height:1123px;background:#fff;color:#111;padding:34px 34px 28px;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;display:flex;flex-direction:column;}'
      + '.smart-pdf-head{display:grid;grid-template-columns:minmax(0,1fr) 78px;gap:16px;align-items:start;margin-bottom:12px;}'
      + '.smart-pdf-title{font-size:24px;font-weight:800;line-height:1.1;margin:0 0 5px;color:#111;}'
      + '.smart-pdf-contest{font-size:13px;font-weight:700;color:#1b2433;margin-bottom:3px;}'
      + '.smart-pdf-profile{font-size:12px;color:#3d4b60;}'
      + '.smart-pdf-logo{width:66px;height:66px;object-fit:contain;justify-self:end;}'
      + '.smart-pdf-rule{height:1px;background:#8d99aa;margin-bottom:18px;}'
      + '.smart-pdf-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}'
      + '.smart-pdf-summary-card{border:1px solid #b9c4d4;background:#f5f7fb;padding:7px 9px;min-height:44px;}'
      + '.smart-pdf-summary-label{font-size:8px;font-weight:800;color:#34445a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;}'
      + '.smart-pdf-summary-value{font-size:14px;font-weight:800;color:#111;}'
      + '.smart-pdf-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;}'
      + '.smart-pdf-table th,.smart-pdf-table td{border:1px solid #aeb9ca;padding:5px 7px;vertical-align:middle;}'
      + '.smart-pdf-table thead th{background:#dbe5f4;color:#000;text-align:center;font-size:9px;text-transform:uppercase;font-weight:900;}'
      + '.smart-pdf-table .topic-col{text-align:left;width:auto;}'
      + '.smart-pdf-table .control-col{width:96px;}'
      + '.smart-pdf-subject td{background:#dbe5f4;text-align:center;font-weight:900;text-transform:uppercase;font-size:13px;color:#000;}'
      + '.smart-pdf-topic-name{font-size:11px;font-weight:700;line-height:1.25;color:#000;}'
      + '.smart-pdf-topic-meta{font-size:8px;text-transform:uppercase;letter-spacing:.3px;color:#526174;margin-top:2px;font-weight:700;}'
      + '.smart-pdf-links{font-size:7.6px;line-height:1.25;color:#2463b6;margin-top:3px;word-break:break-all;}'
      + '.smart-pdf-control{text-align:center;font-size:11px;font-weight:700;color:#111;background:#fbfcff;}'
      + '.smart-pdf-empty{text-align:center;padding:28px;color:#526174;}'
      + '.smart-pdf-footer{margin-top:auto;padding-top:10px;font-size:9px;color:#66758a;display:flex;justify-content:space-between;}'
      + '</style>'
      + pages.map(function (rows, pageIndex) {
        return '<div class="smart-pdf-page">'
          + '<div class="smart-pdf-head">'
          + '<div>'
          + '<h1 class="smart-pdf-title">Estudos de hoje</h1>'
          + '<div class="smart-pdf-contest">' + escapeHtml(contestLine) + '</div>'
          + '<div class="smart-pdf-profile">' + escapeHtml(profileName) + '</div>'
          + '</div>'
          + '<img class="smart-pdf-logo" src="assets/logo-oficial-track-concursos.png" alt="Track Concursos">'
          + '</div>'
          + '<div class="smart-pdf-rule"></div>'
          + '<div class="smart-pdf-summary">'
          + '<div class="smart-pdf-summary-card"><div class="smart-pdf-summary-label">Data</div><div class="smart-pdf-summary-value">' + escapeHtml(dateLabel) + '</div></div>'
          + '<div class="smart-pdf-summary-card"><div class="smart-pdf-summary-label">Tópicos</div><div class="smart-pdf-summary-value">' + totals.topicos + '</div></div>'
          + '<div class="smart-pdf-summary-card"><div class="smart-pdf-summary-label">Horas registradas</div><div class="smart-pdf-summary-value">' + escapeHtml(totals.seconds ? formatCycleClock(totals.seconds) : '-') + '</div></div>'
          + '<div class="smart-pdf-summary-card"><div class="smart-pdf-summary-label">Questões / Acertos</div><div class="smart-pdf-summary-value">' + totals.questoes + ' / ' + totals.acertos + '</div></div>'
          + '</div>'
          + '<table class="smart-pdf-table">'
          + '<thead><tr><th class="topic-col">Conteúdo programado</th><th class="control-col">Horas de Estudo</th><th class="control-col">Questões feitas</th><th class="control-col">Acertos</th></tr></thead>'
          + '<tbody>' + rows.map(function (row) { return smartTodayPdfRowHtml(row, indexRef); }).join('') + '</tbody>'
          + '</table>'
          + '<div class="smart-pdf-footer"><span>Track Concursos</span><span>Página ' + (pageIndex + 1) + ' de ' + pages.length + '</span></div>'
          + '</div>';
      }).join('');
    document.body.appendChild(root);
    return root;
  }

  function smartLoadScriptOnce(globalName, url) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    var pendingKey = '__loading_' + globalName;
    if (window[pendingKey]) return window[pendingKey];
    window[pendingKey] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = function () { resolve(window[globalName]); };
      script.onerror = function () { reject(new Error('Falha ao carregar ' + globalName)); };
      document.head.appendChild(script);
    });
    return window[pendingKey];
  }

  function smartEnsureHtml2Canvas() {
    return smartLoadScriptOnce('html2canvas', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  }

  function smartWaitForImages(root) {
    var images = Array.from(root.querySelectorAll('img'));
    return Promise.all(images.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
  }

  function smartBase64ToBytes(base64) {
    var raw = atob(base64);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function smartCanvasToJpegBytes(canvas) {
    var dataUrl = canvas.toDataURL('image/jpeg', 0.94);
    var base64 = dataUrl.split(',')[1] || '';
    return {
      bytes: smartBase64ToBytes(base64),
      width: canvas.width,
      height: canvas.height
    };
  }

  function smartCreatePdfBlobFromImages(images) {
    var encoder = new TextEncoder();
    var parts = [];
    var offsets = [];
    var byteLength = 0;
    function push(part) {
      var bytes = typeof part === 'string' ? encoder.encode(part) : part;
      parts.push(bytes);
      byteLength += bytes.length;
    }
    function addObject(id, writeBody) {
      offsets[id] = byteLength;
      push(id + ' 0 obj\n');
      writeBody();
      push('\nendobj\n');
    }
    var pageW = 595.28;
    var pageH = 841.89;
    var totalObjects = 2 + images.length * 3;
    var pageIds = images.map(function (_, index) { return 3 + index * 3; });

    push('%PDF-1.3\n%\n');
    addObject(1, function () {
      push('<< /Type /Catalog /Pages 2 0 R >>');
    });
    addObject(2, function () {
      push('<< /Type /Pages /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') + '] /Count ' + images.length + ' >>');
    });
    images.forEach(function (image, index) {
      var pageId = 3 + index * 3;
      var contentId = pageId + 1;
      var imageId = pageId + 2;
      var imageName = 'Im' + (index + 1);
      addObject(pageId, function () {
        push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /' + imageName + ' ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>');
      });
      addObject(contentId, function () {
        var content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/' + imageName + ' Do\nQ\n';
        push('<< /Length ' + encoder.encode(content).length + ' >>\nstream\n' + content + 'endstream');
      });
      addObject(imageId, function () {
        push('<< /Type /XObject /Subtype /Image /Width ' + image.width + ' /Height ' + image.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + image.bytes.length + ' >>\nstream\n');
        push(image.bytes);
        push('\nendstream');
      });
    });
    var xrefOffset = byteLength;
    push('xref\n0 ' + (totalObjects + 1) + '\n');
    push('0000000000 65535 f \n');
    for (var id = 1; id <= totalObjects; id++) {
      push(String(offsets[id] || 0).padStart(10, '0') + ' 00000 n \n');
    }
    push('trailer\n<< /Size ' + (totalObjects + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }

  function smartDownloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function smartGenerateTodayPdfBlob() {
    var state = smartBuildTodayDashboardState();
    if (!state) {
      return null;
    }
    window.__smartTodayShareState = state;
    var groups = smartBuildTodayPdfGroups(state);
    var root = smartBuildTodayPdfDom(state, groups);
    try {
      await smartEnsureHtml2Canvas();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await smartWaitForImages(root);
      var pages = Array.from(root.querySelectorAll('.smart-pdf-page'));
      var images = [];
      for (var i = 0; i < pages.length; i++) {
        var canvas = await html2canvas(pages[i], {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false
        });
        images.push(smartCanvasToJpegBytes(canvas));
      }
      var pdf = smartCreatePdfBlobFromImages(images);
      return {
        blob: pdf,
        filename: 'Estudos de hoje ' + smartTodayPdfFileDate(state.today) + '.pdf',
        state: state
      };
    } catch (err) {
      console.error(err);
      smartShareToast('Não foi possível gerar o PDF agora.', 'Erro');
    } finally {
      root.remove();
    }
  }

  async function smartExportTodayPdf() {
    smartShareToast('Gerando PDF dos estudos de hoje...', 'PDF');
    var result = await smartGenerateTodayPdfBlob();
    if (!result) {
      smartShareToast('Nenhum cronograma inteligente ativo para gerar PDF.', 'Aviso');
      return;
    }
    smartDownloadBlob(result.blob, result.filename);
    smartShareToast('PDF dos estudos de hoje gerado.', 'PDF');
  }

  function smartPdfFallbackMessage(channel, filename) {
    var label = channel === 'telegram' ? 'Telegram' : 'WhatsApp';
    return 'Segue meu PDF de estudos de hoje gerado no Track Concursos.\n\n'
      + 'Arquivo: ' + filename + '\n\n'
      + 'Se o arquivo nao aparecer anexado automaticamente, anexe o PDF baixado pelo app nesta conversa do ' + label + '.';
  }

  async function smartShareTodayPdfFile(channel) {
    var label = channel === 'telegram' ? 'Telegram' : 'WhatsApp';
    try {
      smartShareToast('Gerando PDF para enviar pelo ' + label + '...', 'PDF');
      var result = await smartGenerateTodayPdfBlob();
      if (!result) {
        smartShareToast('Nenhum cronograma inteligente ativo para gerar PDF.', 'Aviso');
        return;
      }
      var file = null;
      try {
        file = new File([result.blob], result.filename, { type: 'application/pdf' });
      } catch (e) {}

      if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({
            title: 'Estudos de hoje',
            text: 'PDF dos estudos de hoje - Track Concursos',
            files: [file]
          });
          smartShareToast('PDF pronto para envio pelo app escolhido.', 'PDF');
          return;
        } catch (shareErr) {
          if (shareErr && String(shareErr.name || '').toLowerCase() === 'aborterror') return;
        }
      }

      smartDownloadBlob(result.blob, result.filename);
      var fallbackText = smartPdfFallbackMessage(channel, result.filename);
      try { await smartCopyText(fallbackText); } catch (copyErr) {}
      if (channel === 'telegram') {
        await smartOpenExternalShareUrl('https://t.me/share/url?url=&text=' + encodeURIComponent(fallbackText));
      } else {
        await smartOpenExternalShareUrl('https://wa.me/?text=' + encodeURIComponent(fallbackText));
      }
      smartShareToast('PDF baixado. Anexe o arquivo no ' + label + ' se ele nao for anexado automaticamente.', 'PDF');
    } catch (err) {
      console.error(err);
      smartShareToast('Nao foi possivel preparar o PDF para envio.', 'Erro');
    }
  }

  async function smartShareToday(channel) {
    var message = smartBuildTodayShareMessage();
    if (!message) {
      smartShareToast('Nenhum estudo de hoje encontrado para compartilhar.', 'Aviso');
      return;
    }
    if (channel === 'pdf') {
      smartExportTodayPdf();
      return;
    }
    if (channel === 'whatsapp_pdf') {
      smartShareTodayPdfFile('whatsapp');
      return;
    }
    if (channel === 'telegram_pdf') {
      smartShareTodayPdfFile('telegram');
      return;
    }
    if (channel === 'copy') {
      try {
        await smartCopyText(message);
        smartShareToast('Texto dos estudos de hoje copiado.', 'Copiado');
      } catch (e) {
        smartShareToast('Não foi possível copiar o texto automaticamente.', 'Erro');
      }
      return;
    }
    smartShareToast('Opção de compartilhamento não encontrada.', 'Aviso');
  }

  function renderSmartDashboard() {
    ensureSmartScheduleStyles();
    var grid = document.getElementById('cronoGrid');
    if (!grid) return;
    grid.setAttribute('data-dashboard-mode', 'smart');
    var state = smartBuildTodayDashboardState();
    if (!state) return;
    window.__smartTodayShareState = state;
    var cfg = state.cfg;
    var units = state.units;
    var todayKey = state.todayKey;
    var cid = state.cid;
    var todayItems = state.todayItems;
    var allSessions = state.allSessions;
    var allQuestions = state.allQuestions;
    var dailyStatusMap = state.dailyStatusMap;

    grid.innerHTML = '';
    updateDashboardCardHeader();

    if (!todayItems.length) {
      var emptyShell = document.createElement('div');
      emptyShell.className = 'smart-dash-shell';
      emptyShell.innerHTML = ''
        + '<div class="smart-empty-day">'
        + '  <span class="smart-empty-day-emoji">☕</span>'
        + '  <div class="smart-empty-day-title">Nenhum estudo sugerido para hoje.</div>'
        + '  <div class="smart-empty-day-desc">Caso tenha tempo livre, revise ou adiante tópicos, faça questões e simulados.</div>'
        + '</div>';
      emptyShell.appendChild(smartBuildLoadCard(cfg));
      grid.appendChild(emptyShell);
      return;
    }

    var shell = document.createElement('div');
    shell.className = 'smart-dash-shell';
    var card = document.createElement('div');
    card.className = 'smart-day-card';
    card.innerHTML = '<div class="smart-day-items"></div>';
    var list = card.querySelector('.smart-day-items');

    todayItems.forEach(function (unit) {
      var status = smartDashboardUnitStatus(unit, units, dailyStatusMap, allSessions, allQuestions, todayKey);

      var row = document.createElement('div');
      var rowStatusClass = status === 'finalized'
        ? (unit && unit._extraToday ? 'extra-finalized ' : 'finalized ')
        : (status === 'studied' ? 'studied ' : '');
      row.className = 'smart-day-item ' + rowStatusClass + smartUnitClass(unit);

      var contentDiv = document.createElement('div');
      contentDiv.style.cssText = 'min-width:0; cursor:pointer;';
      contentDiv.className = 'smart-item-content';
      contentDiv.title = 'Clique para acessar esta matéria';
      contentDiv.innerHTML = ''
        + '<div class="smart-mat" style="text-decoration:none;">' + escapeHtml(unit.materiaNome || '') + '</div>'
        + '<div class="smart-topic" style="transition: color 0.15s; font-weight: 800;">' + escapeHtml(smartUnitStudyName(unit)) + '</div>'
        + '<div class="smart-meta">' + escapeHtml(smartPriorityTierLabel(unit.priority)) + '</div>'
        + smartPillsHtml(unit, status);

      contentDiv.addEventListener('mouseover', function () {
        var topicEl = contentDiv.querySelector('.smart-topic');
        if (topicEl) topicEl.style.color = 'var(--accent)';
      });
      contentDiv.addEventListener('mouseout', function () {
        var topicEl = contentDiv.querySelector('.smart-topic');
        if (topicEl) topicEl.style.color = '';
      });

      contentDiv.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openMateriaTab(unit.materiaId, unit.topicoId, unit.subtopId);
      });

      row.appendChild(contentDiv);

      var btn = document.createElement('button');
      btn.type = 'button';
      if (status === 'finalized') {
        btn.className = unit && unit._extraToday ? 'smart-badge-extra-done' : 'smart-badge-done';
        btn.textContent = unit && unit._extraToday ? 'Extra ✓' : 'Concluído ✓';
        btn.title = unit && unit._extraToday ? 'Estudo extra concluído!' : 'Tópico concluído!';
        btn.disabled = true;
      } else {
        btn.className = 'smart-start';
        btn.textContent = status === 'studied' ? 'Continuar' : 'Iniciar';
        btn.title = status === 'studied' ? 'Continuar estudos deste tópico' : 'Iniciar cronômetro livre para este tópico';
        btn.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          openSmartScheduleTimer(unit);
        });
      }
      row.appendChild(btn);
      list.appendChild(row);
    });
    shell.appendChild(card);
    shell.appendChild(smartBuildLoadCard(cfg));

    grid.appendChild(shell);
  }

  // Patch window.renderCrono reactively to ensure it's available after main app init
  (function patchRender() {
    if (!document.getElementById('cronoGrid')) return;
    var orig = window.renderCrono;
    if (typeof orig === 'function' && !orig._patched) {
      window.renderCrono = function () {
        if (getSmartAgendadoConfig()) renderSmartDashboard();
        else if (getViewMode() === 'cycle') renderCycleDashboard();
        else {
          orig();
          patchCronoGridNames();
        }
        updateDashboardCardHeader();
      };
      window.renderCrono._patched = true;
      // Force initial render once patched
      window.renderCrono();
    } else if (!window.renderCrono || !window.renderCrono._patched) {
      setTimeout(patchRender, 50);
    }
  })();

  window.abrirModalCrono = function () {
    ensureCronoStyles();
    var old = document.getElementById('modalCrono');
    if (old) old.remove();
    var cid = getCid();
    if (cid && cid !== window._cCid) window._cCid = cid;
    try { window._cData = JSON.parse(localStorage.getItem('ct_crono_' + cid) || '{}'); } catch (e) { window._cData = {}; }
    if (!window._cMats || !window._cMats.length) window._cMats = getMateriasAtivas();

    var palette = ['#4f8ef7','#7c5cfc','#3ecf8e','#f5c842','#f5874a','#f55a5a','#00bcd4','#e91e8c','#8bc34a','#ff9800','#9c27b0','#607d8b','#ff5722','#009688','#795548','#3f51b5','#cddc39','#03a9f4','#e91e63','#4caf50'];
    var overlay = document.createElement('div');
    overlay.id = 'modalCrono';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    var box = document.createElement('div');
    box.style.cssText = 'background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:24px;width:560px;max-width:95vw;height:min(92vh,820px);box-shadow:0 24px 60px rgba(0,0,0,0.6);display:flex;flex-direction:column;position:relative;overflow:hidden';
    var scene = document.createElement('div');
    scene.className = 'crono-flip-scene';
    var flipCard = document.createElement('div');
    flipCard.className = 'crono-flip-card';
    scene.appendChild(flipCard);
    box.appendChild(scene);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function createFace(titleText) {
      var face = document.createElement('div');
      face.className = 'crono-face';
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px';
      var title = document.createElement('div');
      title.style.cssText = 'font-size:16px;font-weight:700;color:var(--text)';
      title.textContent = titleText;
      var flipBtn = document.createElement('button');
      flipBtn.type = 'button';
      flipBtn.title = 'Clique aqui para escolher Ciclo de Estudos em vez de Cronograma Semanal';
      flipBtn.textContent = 'Flip';
      flipBtn.style.cssText = 'border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text2);border-radius:999px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0';
      header.appendChild(title);
      header.appendChild(flipBtn);
      var body = document.createElement('div');
      body.className = 'crono-scroll';
      var footer = document.createElement('div');
      footer.style.cssText = 'display:flex;gap:8px;margin-top:auto';
      face.appendChild(header);
      face.appendChild(body);
      face.appendChild(footer);
      return { face: face, body: body, footer: footer, flipBtn: flipBtn };
    }

    var front = createFace('Editar cronograma semanal');
    var back = createFace('Editar ciclo de estudos');
    front.face.classList.add('front');
    back.face.classList.add('back');
    flipCard.appendChild(front.face);
    flipCard.appendChild(back.face);
    function setFace(isBack) { flipCard.classList.toggle('is-back', !!isBack); }
    front.flipBtn.addEventListener('click', function () { setFace(true); });
    back.flipBtn.addEventListener('click', function () { setFace(false); });

    function closeModal() {
      persistVisibleMatColors();
      window.removeEventListener('ct-cycle-updated', rerenderCycle);
      overlay.remove();
      if (typeof window.renderCrono === 'function') window.renderCrono();
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    function persistVisibleMatColors() {
      var current = window._getCronoMats();
      if (!current.length) return false;

      var changed = false;
      var seenNames = {};
      var visibleChips = box.querySelectorAll('[data-crono-mat][data-cor]');

      visibleChips.forEach(function (chip) {
        var nome = chip.getAttribute('data-crono-mat');
        var cor = chip.getAttribute('data-cor');
        var normalized = normName(nome);

        if (!normalized || !cor || seenNames[normalized]) return;
        seenNames[normalized] = true;

        var target = current.find(function (item) { return normName(item.nome) === normalized; });
        if (target && target.cor !== cor) {
          target.cor = cor;
          changed = true;
        }
      });

      if (changed) window._saveCronoMats(current);
      return changed;
    }

    var matsSection = document.createElement('div');
    matsSection.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px';
    var matsTitle = document.createElement('div');
    matsTitle.style.cssText = 'font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:10px';
matsTitle.textContent = 'Matérias - arraste para os dias';
    matsSection.appendChild(matsTitle);
    var chipsArea = document.createElement('div');
    chipsArea.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:28px';
    matsSection.appendChild(chipsArea);
    var newRow = document.createElement('div');
    newRow.style.cssText = 'display:flex;gap:6px;align-items:center';
    var newInp = document.createElement('input');
    newInp.type = 'text';
    newInp.maxLength = 80;
    newInp.placeholder = 'Ex.: Direito Constitucional';
    newInp.style.cssText = 'flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--sans);font-size:13px;font-weight:600;outline:none';
    var newColorBtn = document.createElement('div');
    newColorBtn.style.cssText = 'width:32px;height:32px;border-radius:8px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0;background:' + palette[0];
    newColorBtn.setAttribute('data-cor', palette[0]);
    newColorBtn.title = 'Escolher cor';
    newColorBtn.addEventListener('click', function () { window.abrirPaletaInline(newColorBtn, palette); });
    var newAddBtn = document.createElement('button');
    newAddBtn.textContent = '+ Criar';
    newAddBtn.style.cssText = 'padding:8px 14px;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:8px;color:#fff;font-family:var(--sans);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap';
    var btnSaveColors = document.createElement('button');
    btnSaveColors.innerHTML = '💾';
    btnSaveColors.title = 'FORÇAR SALVAR CORES PERSONALIZADAS';
    btnSaveColors.style.cssText = 'width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease;';
    btnSaveColors.onclick = function() {
       persistVisibleMatColors();
       btnSaveColors.innerHTML = '✅';
       setTimeout(function() { btnSaveColors.innerHTML = '💾'; }, 2000);
    };

    newRow.appendChild(btnSaveColors);
    newRow.appendChild(newInp);
    newRow.appendChild(newColorBtn);
    newRow.appendChild(newAddBtn);
    
    var importBtn = document.createElement('button');
    importBtn.textContent = '📥 Importar do Concurso';
    importBtn.style.cssText = 'padding:8px 14px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-family:var(--sans);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;margin-top:8px';
    importBtn.onclick = async function() {
       if (await window.CT.confirm('Isso irá limpar sua lista atual e importar as matérias originais do seu concurso. Continuar?', {
          title: 'Importar matérias',
          confirmLabel: 'Importar',
       })) {
          importFromContest();
          renderMatsChips();
          renderCyclePalette();
          renderCycleList();
       }
    };
    
    matsSection.appendChild(newRow);
    matsSection.appendChild(importBtn);
    front.body.appendChild(matsSection);

    var daysContainer = document.createElement('div');
    front.body.appendChild(daysContainer);
var dayNames = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

    var cyclePaletteLabel = document.createElement('div');
    cyclePaletteLabel.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3);margin-bottom:6px';
cyclePaletteLabel.textContent = 'Matérias disponíveis - arraste para ordenar o ciclo';
    back.body.appendChild(cyclePaletteLabel);
    var cyclePalette = document.createElement('div');
    cyclePalette.className = 'crono-cycle-palette';
    back.body.appendChild(cyclePalette);

    var newRowCycle = document.createElement('div');
    newRowCycle.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:12px;padding:12px;border-radius:8px;background:var(--bg3);border:1px solid var(--border);';
    var newInpCycle = document.createElement('input');
    newInpCycle.type = 'text';
    newInpCycle.maxLength = 80;
    newInpCycle.placeholder = 'Nova matéria...';
    newInpCycle.style.cssText = 'flex:1;background:var(--bg2);border:1px solid var(--border2);border-radius:6px;padding:6px 8px;color:var(--text);font-family:var(--sans);font-size:12px;font-weight:600;outline:none';
    var newColorBtnCycle = document.createElement('div');
    newColorBtnCycle.style.cssText = 'width:28px;height:28px;border-radius:8px;border:2px solid var(--border2);cursor:pointer;flex-shrink:0;background:' + palette[0];
    newColorBtnCycle.setAttribute('data-cor', palette[0]);
    newColorBtnCycle.title = 'Escolher cor';
    newColorBtnCycle.addEventListener('click', function () { window.abrirPaletaInline(newColorBtnCycle, palette); });
    var newAddBtnCycle = document.createElement('button');
    newAddBtnCycle.textContent = '+ Criar';
    newAddBtnCycle.style.cssText = 'padding:6px 12px;background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:8px;color:#fff;font-family:var(--sans);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap';
    var btnSaveColorsCycle = document.createElement('button');
    btnSaveColorsCycle.innerHTML = '💾';
    btnSaveColorsCycle.title = 'FORÇAR SALVAR CORES PERSONALIZADAS';
    btnSaveColorsCycle.style.cssText = 'width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease;';
    btnSaveColorsCycle.onclick = function() {
       persistVisibleMatColors();
       btnSaveColorsCycle.innerHTML = '✅';
       setTimeout(function() { btnSaveColorsCycle.innerHTML = '💾'; }, 2000);
    };

    newRowCycle.appendChild(btnSaveColorsCycle);
    newRowCycle.appendChild(newInpCycle);
    newRowCycle.appendChild(newColorBtnCycle);
    newRowCycle.appendChild(newAddBtnCycle);

    newRowCycle.appendChild(newAddBtnCycle);
    
    var importBtnCycle = document.createElement('button');
    importBtnCycle.textContent = '📥 Importar do Concurso';
    importBtnCycle.style.cssText = 'padding:6px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-family:var(--sans);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;margin-top:6px';
    importBtnCycle.onclick = async function() {
       if (await window.CT.confirm('Isso irá limpar sua lista atual e importar as matérias originais do seu concurso. Continuar?', {
          title: 'Importar matérias',
          confirmLabel: 'Importar',
       })) {
          importFromContest();
          renderMatsChips();
          renderCyclePalette();
          renderCycleList();
       }
    };
    var randomAllCycleBtn = document.createElement('button');
    randomAllCycleBtn.textContent = 'Sortear todas no ciclo';
    randomAllCycleBtn.title = 'Adiciona no fim do ciclo todas as materias que ainda nao estao na ordem, em ordem aleatoria, sem definir horas.';
    randomAllCycleBtn.style.cssText = 'padding:6px 12px;background:rgba(79,142,247,0.12);border:1px solid rgba(79,142,247,0.45);border-radius:8px;color:var(--accent);font-family:var(--sans);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;margin-top:6px;margin-left:6px';
    randomAllCycleBtn.onclick = function() {
      var result = addAllCycleMatsRandomly();
      renderCyclePalette();
      renderCycleList();
      if (typeof window.renderCrono === 'function') window.renderCrono();
      if (window.CT && typeof CT.toast === 'function') {
        if (result.added > 0) CT.toast(result.added + ' materia(s) adicionada(s) ao ciclo.', 'OK');
        else CT.toast('Todas as materias ja estao no ciclo.', 'OK');
      }
    };

    newAddBtnCycle.addEventListener('click', function () {
      var nome = abbreviateSubjectName(newInpCycle.value);
      if (!nome) return;
      var cor = newColorBtnCycle.getAttribute('data-cor');
      var mats = window._getCronoMats();
      if (!mats.some(function (m) { return normName(m.nome) === normName(nome); })) {
        mats.push({ nome: nome, cor: cor, materiaId: resolveMateriaId(nome) || '' });
        window._saveCronoMats(mats);
      }
      newInpCycle.value = '';
      renderMatsChips();
      renderCyclePalette();
      renderCycleList();
    });
    newInpCycle.addEventListener('keydown', function (e) { if (e.key === 'Enter') newAddBtnCycle.click(); });
    back.body.appendChild(newRowCycle);
    back.body.appendChild(importBtnCycle);
    back.body.appendChild(randomAllCycleBtn);
    var cycleOrderLabel = document.createElement('div');
    cycleOrderLabel.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text3);margin:4px 0 6px';
    cycleOrderLabel.textContent = 'Ordem do ciclo';
    back.body.appendChild(cycleOrderLabel);
    var cycleList = document.createElement('div');
    cycleList.className = 'crono-cycle-list';
    back.body.appendChild(cycleList);

    var cycleDragState = null;

    function startCycleDrag(type, id, sourceEl) {
      cycleDragState = { type: type, id: id, sourceEl: sourceEl || null, finalized: false };
      if (sourceEl) sourceEl.classList.add('dragging');
    }

    function ensureCyclePlaceholder() {
      var ph = document.getElementById('cronoCyclePlaceholder');
      if (!ph) {
        ph = document.createElement('div');
        ph.id = 'cronoCyclePlaceholder';
        ph.className = 'crono-cycle-placeholder';
        ph.textContent = 'Solte aqui';
      }
      return ph;
    }

    function clearCycleDragVisuals() {
      var ph = document.getElementById('cronoCyclePlaceholder');
      if (ph) ph.remove();
      if (cycleDragState && cycleDragState.sourceEl) {
        cycleDragState.sourceEl.classList.remove('dragging');
        cycleDragState.sourceEl.style.opacity = '';
      }
      cycleList.querySelectorAll('.crono-cycle-card.dragging,.crono-cycle-card.drag-over').forEach(function (el) {
        el.classList.remove('dragging', 'drag-over');
        el.style.opacity = '';
      });
      var end = cycleList.querySelector('.crono-cycle-drop-end');
      if (end) end.classList.remove('drag-over');
    }

    function updateCycleVisibleSlots() {
      Array.from(cycleList.querySelectorAll('.crono-cycle-card[data-cycle-entry-id]')).forEach(function (card, index) {
        var slot = card.querySelector('.crono-cycle-slot');
        if (slot) slot.textContent = String(index + 1).padStart(2, '0');
      });
    }

    function persistCycleDomOrder(silent) {
      var order = Array.from(cycleList.querySelectorAll('.crono-cycle-card[data-cycle-entry-id]'))
        .map(function (card) { return card.getAttribute('data-cycle-entry-id'); })
        .filter(Boolean);
      if (!order.length) return;
      var raw = loadCycleRaw();
      raw.entries = Array.isArray(raw.entries) ? raw.entries.slice() : [];
      var byId = {};
      raw.entries.forEach(function (entry) { if (entry && entry.id) byId[entry.id] = entry; });
      var nextEntries = [];
      order.forEach(function (id) {
        if (byId[id]) {
          nextEntries.push(byId[id]);
          delete byId[id];
        }
      });
      raw.entries.forEach(function (entry) {
        if (entry && entry.id && byId[entry.id]) nextEntries.push(entry);
      });
      raw.entries = nextEntries;
      if (silent) saveCycleRawSilent(raw);
      else saveCycleRaw(raw);
    }

    function cycleInsertBeforeForCard(card, clientY) {
      if (!card) return null;
      var rect = card.getBoundingClientRect();
      return clientY > rect.top + rect.height / 2 ? card.nextSibling : card;
    }

    function moveCycleDraggedEntry(card, clientY) {
      if (!cycleDragState || cycleDragState.type !== 'entry' || !cycleDragState.sourceEl || !card) return;
      var dragging = cycleDragState.sourceEl;
      if (dragging === card) return;
      var ref = cycleInsertBeforeForCard(card, clientY);
      if (ref === dragging || ref === dragging.nextSibling) return;
      cycleList.insertBefore(dragging, ref);
      updateCycleVisibleSlots();
      persistCycleDomOrder(true);
    }

    function moveCyclePlaceholder(card, clientY) {
      if (!cycleDragState || cycleDragState.type !== 'base' || !card) return;
      var placeholder = ensureCyclePlaceholder();
      var ref = cycleInsertBeforeForCard(card, clientY);
      if (ref === placeholder) return;
      cycleList.insertBefore(placeholder, ref);
    }

    function moveCycleDragToEnd() {
      if (!cycleDragState) return;
      var endDrop = cycleList.querySelector('.crono-cycle-drop-end');
      if (cycleDragState.type === 'entry' && cycleDragState.sourceEl) {
        cycleList.insertBefore(cycleDragState.sourceEl, endDrop || null);
        updateCycleVisibleSlots();
        persistCycleDomOrder(true);
      } else if (cycleDragState.type === 'base') {
        cycleList.insertBefore(ensureCyclePlaceholder(), endDrop || null);
      }
    }

    function cyclePlaceholderIndex(fallback) {
      var placeholder = document.getElementById('cronoCyclePlaceholder');
      if (!placeholder || !placeholder.parentElement) return fallback;
      var index = 0;
      var children = Array.from(cycleList.children);
      for (var i = 0; i < children.length; i++) {
        if (children[i] === placeholder) return index;
        if (children[i].classList && children[i].classList.contains('crono-cycle-card')) index++;
      }
      return fallback;
    }

    function finishCycleEntryDrag() {
      if (!cycleDragState || cycleDragState.type !== 'entry' || cycleDragState.finalized) return;
      cycleDragState.finalized = true;
      persistCycleDomOrder(false);
      clearCycleDragVisuals();
      cycleDragState = null;
    }

    function finishCycleBaseDrop(fallbackIndex) {
      if (!cycleDragState || cycleDragState.type !== 'base' || cycleDragState.finalized) return;
      cycleDragState.finalized = true;
      var draggedId = cycleDragState.id;
      var index = cyclePlaceholderIndex(fallbackIndex);
      clearCycleDragVisuals();
      cycleDragState = null;
      if (!draggedId) return;
      placeCycleItem(draggedId, index);
      renderCycleList();
    }

    function cancelCycleDrag() {
      clearCycleDragVisuals();
      cycleDragState = null;
    }

    cycleList.addEventListener('dragover', function (e) {
      if (!cycleDragState) return;
      if (e.target.closest && (e.target.closest('.crono-cycle-card') || e.target.closest('.crono-cycle-drop-end'))) return;
      e.preventDefault();
      var cards = Array.from(cycleList.querySelectorAll('.crono-cycle-card[data-cycle-entry-id]'))
        .filter(function (card) { return !cycleDragState.sourceEl || card !== cycleDragState.sourceEl; });
      var ref = cards.find(function (card) {
        var rect = card.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      }) || null;
      if (!ref) {
        moveCycleDragToEnd();
        return;
      }
      if (cycleDragState.type === 'entry' && cycleDragState.sourceEl) {
        if (ref !== cycleDragState.sourceEl && ref !== cycleDragState.sourceEl.nextSibling) {
          cycleList.insertBefore(cycleDragState.sourceEl, ref);
          updateCycleVisibleSlots();
          persistCycleDomOrder(true);
        }
      } else if (cycleDragState.type === 'base') {
        cycleList.insertBefore(ensureCyclePlaceholder(), ref);
      }
    });

    cycleList.addEventListener('drop', function (e) {
      if (!cycleDragState) return;
      e.preventDefault();
      if (cycleDragState.type === 'entry') {
        finishCycleEntryDrag();
      } else if (cycleDragState.type === 'base') {
        finishCycleBaseDrop(cycleList.querySelectorAll('.crono-cycle-card[data-cycle-entry-id]').length);
      }
    });

    function renderMatsChips() {
      var mats = window._getCronoMats();
      chipsArea.innerHTML = '';
      if (!mats.length) {
        var hint = document.createElement('span');
        hint.style.cssText = 'font-size:12px;color:var(--text3)';
hint.textContent = 'Crie matérias acima e arraste para os dias.';
        chipsArea.appendChild(hint);
        return;
      }
      mats.forEach(function (m) {
        var chip = document.createElement('div');
        chip.draggable = true;
        chip.setAttribute('data-crono-mat', m.nome);
        chip.setAttribute('data-cor', m.cor);
        chip.style.cssText = 'background:' + m.cor + ';border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);cursor:pointer;display:flex;align-items:flex-start;gap:8px;user-select:none;max-width:100%';
        chip.title = 'Clique para trocar cor ou segure para arrastar';
        
        chip.onclick = function() {
           window.abrirPaletaInline(chip, palette, function(novaCor) {
              var all = window._getCronoMats();
              var target = all.find(function(x) { return normName(x.nome) === normName(m.nome); });
              if (target) {
                 target.cor = novaCor;
                 window._saveCronoMats(all);
                 // Force immediate UI update for both modal sides
                 renderMatsChips();
                 renderCyclePalette();
                 renderCycleList();
              }
           });
        };
        
        var lbl = document.createElement('span');
        lbl.className = 'crono-chip-full';
        lbl.textContent = m.nome;
        var del = document.createElement('span');
        del.textContent = 'x';
        del.style.cssText = 'opacity:0.7;cursor:pointer;font-size:12px;flex-shrink:0;line-height:1.2';
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          window._saveCronoMats(window._getCronoMats().filter(function (x) { return normName(x.nome) !== normName(m.nome); }));
          renderMatsChips();
          renderCyclePalette();
          renderCycleList();
        });
        chip.appendChild(lbl);
        chip.appendChild(del);
        chip.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', m.nome); chip.style.opacity = '0.5'; });
        chip.addEventListener('dragend', function () { chip.style.opacity = '1'; });
        chipsArea.appendChild(chip);
      });
    }

    function renderCyclePalette() {
      var mats = window._getCronoMats();
      cyclePalette.innerHTML = '';
      cyclePalette.ondragover = function (e) { e.preventDefault(); };
      cyclePalette.ondrop = function (e) {
        e.preventDefault();
        var draggedId = e.dataTransfer.getData('text/cycle-entry');
        if (!draggedId) return;
        if (cycleDragState) cycleDragState.finalized = true;
        removeCycleItem(draggedId);
        cancelCycleDrag();
        renderCycleList();
      };
      if (!mats.length) {
        var emptyPalette = document.createElement('div');
        emptyPalette.style.cssText = 'font-size:12px;color:var(--text3)';
emptyPalette.textContent = 'Crie matérias no cronograma para organizar o ciclo.';
        cyclePalette.appendChild(emptyPalette);
        return;
      }
      mats.forEach(function (m) {
        var chip = document.createElement('div');
        chip.className = 'crono-cycle-chip';
        chip.draggable = true;
        chip.setAttribute('data-crono-mat', m.nome);
        chip.setAttribute('data-cor', m.cor);
        chip.title = 'Clique para trocar cor / duplo clique p/ add / arraste p/ ordenar';
        chip.style.cssText = 'background:' + m.cor + ';border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);cursor:pointer;display:flex;align-items:flex-start;gap:8px;user-select:none;max-width:100%';
        
        chip.onclick = function(e) {
           window.abrirPaletaInline(chip, palette, function(novaCor) {
              var all = window._getCronoMats();
              var target = all.find(function(x) { return normName(x.nome) === normName(m.nome); });
              if (target) {
                 target.cor = novaCor;
                 window._saveCronoMats(all);
                 renderMatsChips();
                 renderCyclePalette();
                 renderCycleList();
              }
           });
        };
        chip.ondblclick = function() {
           placeCycleItem(baseIdFromName(m.nome), getCycleData({ skipPersist: true, skipAutoRestart: true }).items.length);
           renderCycleList();
        };

        chip.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/cycle-base', baseIdFromName(m.nome));
          e.dataTransfer.effectAllowed = 'copy';
          startCycleDrag('base', baseIdFromName(m.nome), chip);
          chip.style.opacity = '0.45';
        });
        chip.addEventListener('dragend', function () {
          chip.style.opacity = '1';
          if (cycleDragState && cycleDragState.type === 'base') cancelCycleDrag();
        });
// ... [existing label/del code removed to simplify chunk replacement as it was duplicated logic]
        var label = document.createElement('span');
        label.className = 'crono-chip-full';
        label.textContent = m.nome;
        var del = document.createElement('span');
        del.textContent = 'x';
        del.style.cssText = 'opacity:0.7;cursor:pointer;font-size:12px;flex-shrink:0;line-height:1.2';
        del.title = 'Apagar matéria';
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          window._saveCronoMats(window._getCronoMats().filter(function (x) { return normName(x.nome) !== normName(m.nome); }));
          renderMatsChips();
          renderCyclePalette();
          renderCycleList();
        });
        chip.appendChild(label);
        chip.appendChild(del);
        cyclePalette.appendChild(chip);
      });
    }

    function renderCycleList() {
      var data = getCycleData();
      cycleList.innerHTML = '';
      if (!data.items.length) {
        var empty = document.createElement('div');
        empty.className = 'crono-cycle-drop-end';
empty.textContent = 'Arraste matérias aqui para montar a ordem do ciclo';
        empty.addEventListener('dragover', function (e) {
          e.preventDefault();
          empty.classList.add('drag-over');
        });
        empty.addEventListener('dragleave', function () { empty.classList.remove('drag-over'); });
        empty.addEventListener('drop', function (e) {
          e.preventDefault();
          empty.classList.remove('drag-over');
          var draggedEntryId = e.dataTransfer.getData('text/cycle-entry');
          var draggedBaseId = e.dataTransfer.getData('text/cycle-base');
          var draggedId = draggedEntryId || draggedBaseId;
          if (!draggedId) return;
          if (cycleDragState) cycleDragState.finalized = true;
          placeCycleItem(draggedId, 0);
          cancelCycleDrag();
          renderCycleList();
        });
        cycleList.appendChild(empty);
        return;
      }
      data.items.forEach(function (item, idx) {
        var studiedSeconds = Math.max(0, item.targetSeconds - (item.status === 'pending' ? item.remainingSeconds : item.skippedSeconds || 0));
        if (item.status === 'done') studiedSeconds = item.targetSeconds;
        var pendingSeconds = item.status === 'pending' ? item.remainingSeconds : item.lastPendingSeconds || 0;

        var card = document.createElement('div');
        card.className = 'crono-cycle-card'
          + (idx === data.currentIndex && item.status === 'pending' && item.targetSeconds > 0 ? ' current' : '')
          + (item.status === 'done' ? ' done' : '')
          + (item.status === 'skipped' ? ' skipped' : '');
        card.draggable = true;
        card.setAttribute('data-cycle-entry-id', item.id);
        card.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/cycle-entry', item.id);
          e.dataTransfer.effectAllowed = 'move';
          startCycleDrag('entry', item.id, card);
          card.style.opacity = '0.45';
        });
        card.addEventListener('dragend', function () {
          card.style.opacity = '1';
          if (cycleDragState && cycleDragState.type === 'entry') finishCycleEntryDrag();
        });
        card.addEventListener('dragover', function (e) {
          e.preventDefault();
          card.classList.add('drag-over');
          if (cycleDragState && cycleDragState.type === 'entry') moveCycleDraggedEntry(card, e.clientY);
          else if (cycleDragState && cycleDragState.type === 'base') moveCyclePlaceholder(card, e.clientY);
        });
        card.addEventListener('dragleave', function () { card.classList.remove('drag-over'); });
        card.addEventListener('drop', function (e) {
          e.preventDefault();
          card.classList.remove('drag-over');
          if (cycleDragState && cycleDragState.type === 'entry') {
            finishCycleEntryDrag();
            return;
          }
          if (cycleDragState && cycleDragState.type === 'base') {
            finishCycleBaseDrop(idx);
            return;
          }
          var draggedEntryId = e.dataTransfer.getData('text/cycle-entry');
          var draggedBaseId = e.dataTransfer.getData('text/cycle-base');
          var draggedId = draggedEntryId || draggedBaseId;
          if (!draggedId) return;
          placeCycleItem(draggedId, idx);
          renderCycleList();
        });

        var slot = document.createElement('div');
        slot.className = 'crono-cycle-slot';
        slot.textContent = String(idx + 1).padStart(2, '0');
        slot.style.background = item.cor;
        slot.style.color = '#fff';

        var left = document.createElement('div');
        left.className = 'crono-cycle-left';
        var name = document.createElement('div');
        name.className = 'crono-cycle-name';
        name.textContent = (item.status === 'done' ? '✅ ' : '') + item.nome;
        var meta = document.createElement('div');
        meta.className = 'crono-cycle-meta';
        meta.textContent = item.targetSeconds
          ? (formatCycleTime(studiedSeconds) + ' de ' + formatCycleTime(item.targetSeconds))
          : '';
        left.appendChild(name);
        if (meta.textContent) left.appendChild(meta);
        if (item.status === 'done' || item.status === 'skipped' || (idx === data.currentIndex && item.targetSeconds > 0)) {
          var badge = document.createElement('div');
          if (item.status === 'done') {
            badge.className = 'crono-cycle-badge done';
            badge.textContent = 'Concluida';
          } else if (item.status === 'skipped') {
            badge.className = 'crono-cycle-badge skipped';
            badge.textContent = formatCycleTime(pendingSeconds) + ' pendente(s)';
          } else {
            badge.className = 'crono-cycle-badge current';
            badge.textContent = 'Materia atual';
          }
          left.appendChild(badge);
        }

        var right = document.createElement('div');
        right.className = 'crono-cycle-right';
        var hoursInput = document.createElement('input');
        hoursInput.type = 'text';
        hoursInput.value = item.targetSeconds ? formatDurationInput(item.targetSeconds) : '';
        hoursInput.placeholder = 'Ex. 3h30';
        hoursInput.addEventListener('change', function () {
          updateCycleHours(item.id, hoursInput.value);
          renderCycleList();
        });
        right.appendChild(hoursInput);

        var delBtn = document.createElement('div');
        delBtn.innerHTML = '×';
        delBtn.style.cssText = 'position:absolute;top:-5px;right:-5px;font-size:10px;color:#fff;cursor:pointer;line-height:1;background:var(--bg2);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border2);box-shadow:0 1px 3px rgba(0,0,0,0.5);z-index:10;transition:all 0.15s ease';
        delBtn.title = 'Remover matéria do ciclo';
        delBtn.onmouseover = function() { delBtn.style.background = 'var(--red)'; delBtn.style.borderColor = 'var(--red)'; delBtn.style.transform = 'scale(1.1)'; };
        delBtn.onmouseout = function() { delBtn.style.background = 'var(--bg2)'; delBtn.style.borderColor = 'var(--border2)'; delBtn.style.transform = 'none'; };
        delBtn.onclick = function(e) {
          e.stopPropagation();
          removeCycleItem(item.id);
          renderCycleList();
        };

        if (item.status === 'done' || item.status === 'skipped') {
            var reBtn = document.createElement('div');
            reBtn.innerHTML = '⟲';
            reBtn.style.cssText = 'position:absolute;top:-5px;right:15px;font-size:12px;color:#fff;cursor:pointer;line-height:1;background:var(--accent);border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border2);box-shadow:0 1px 3px rgba(0,0,0,0.5);z-index:10;transition:all 0.15s ease;font-weight:bold';
            reBtn.title = 'Reativar matéria e recarregar meta de horas';
            reBtn.onmouseover = function() { reBtn.style.transform = 'scale(1.1)'; };
            reBtn.onmouseout = function() { reBtn.style.transform = 'none'; };
            reBtn.onclick = function(e) {
                e.stopPropagation();
                reactivateCycleItem(item.id);
                renderCycleList();
                if (typeof window.renderCrono === 'function') window.renderCrono();
            };
            card.appendChild(reBtn);
        }

        card.appendChild(slot);
        card.appendChild(left);
        card.appendChild(right);
        card.appendChild(delBtn);
        cycleList.appendChild(card);
      });

      var endDrop = document.createElement('div');
      endDrop.className = 'crono-cycle-drop-end';
      endDrop.textContent = 'Arraste uma materia para colocar no fim da ordem';
      endDrop.addEventListener('dragover', function (e) {
        e.preventDefault();
        endDrop.classList.add('drag-over');
        moveCycleDragToEnd();
      });
      endDrop.addEventListener('dragleave', function () { endDrop.classList.remove('drag-over'); });
      endDrop.addEventListener('drop', function (e) {
        e.preventDefault();
        endDrop.classList.remove('drag-over');
        if (cycleDragState && cycleDragState.type === 'entry') {
          finishCycleEntryDrag();
          return;
        }
        if (cycleDragState && cycleDragState.type === 'base') {
          finishCycleBaseDrop(data.items.length);
          return;
        }
        var draggedEntryId = e.dataTransfer.getData('text/cycle-entry');
        var draggedBaseId = e.dataTransfer.getData('text/cycle-base');
        var draggedId = draggedEntryId || draggedBaseId;
        if (!draggedId) return;
        placeCycleItem(draggedId, data.items.length);
        renderCycleList();
      });
      cycleList.appendChild(endDrop);
    }
    for (var i = 0; i <= 6; i++) {
      (function (idx) {
        var d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay() + idx);
        var ds = CT._dateString(d);
        var isToday = ds === CT._today();
        var dayBlock = document.createElement('div');
        dayBlock.style.cssText = 'background:var(--bg3);border:1px solid ' + (isToday ? 'var(--accent)' : 'var(--border)') + ';border-radius:10px;margin-bottom:8px';
        var hdr = document.createElement('div');
        hdr.style.cssText = 'padding:7px 14px;border-bottom:1px solid var(--border)';
        var nm = document.createElement('span');
        nm.style.cssText = 'font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:' + (isToday ? 'var(--accent)' : 'var(--text2)');
        nm.textContent = dayNames[d.getDay()];
        hdr.appendChild(nm);
        dayBlock.appendChild(hdr);
        var zone = document.createElement('div');
        zone.setAttribute('data-ds', ds);
        zone.setAttribute('data-dropzone', '1');
        zone.style.cssText = 'padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px;min-height:36px;align-items:center;border-radius:0 0 10px 10px';
        zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.background = 'rgba(79,142,247,0.1)'; });
        zone.addEventListener('dragleave', function () { zone.style.background = ''; });
        zone.addEventListener('drop', function (e) {
          e.preventDefault();
          zone.style.background = '';
          var nome = e.dataTransfer.getData('text/plain');
          if (!nome) return;
          var cur = window._cData[ds] || [];
          if (cur.includes(nome) || cur.length >= 5) return;
          cur.push(nome);
          window._cData[ds] = cur;
          window._saveC();
          window.renderDropZone(ds, zone);
        });
        dayBlock.appendChild(zone);
        daysContainer.appendChild(dayBlock);
        window.renderDropZone(ds, zone);
      })(i);
    }

    function rerenderCycle() {
      if (!document.getElementById('modalCrono')) return;
      renderCyclePalette();
      renderCycleList();
    }
    window.addEventListener('ct-cycle-updated', rerenderCycle);

    newAddBtn.addEventListener('click', function () {
      var nome = sanitizeName(newInp.value);
      if (!nome) return;
      var cor = newColorBtn.getAttribute('data-cor');
      var mats = window._getCronoMats();
      if (!mats.some(function (m) { return normName(m.nome) === normName(nome); })) {
        mats.push({ nome: nome, cor: cor, materiaId: resolveMateriaId(nome) || '' });
        window._saveCronoMats(mats);
      }
      newInp.value = '';
      renderMatsChips();
      renderCyclePalette();
      renderCycleList();
    });
    newInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') newAddBtn.click(); });

    var clearBtn = document.createElement('button');
    clearBtn.textContent = 'Limpar cronograma';
    clearBtn.style.cssText = 'padding:10px 16px;border:1px solid var(--red);border-radius:8px;background:transparent;color:var(--red);font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0';
    clearBtn.addEventListener('click', function () {
      window._cData = {};
      window._saveC();
      closeModal();
      window.abrirModalCrono();
    });
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text3);font-family:var(--sans);font-size:14px;cursor:pointer';
    closeBtn.textContent = getViewMode() === 'cycle' ? 'Escolher Cronograma Semanal' : 'Fechar';
    closeBtn.addEventListener('click', function () {
      persistVisibleMatColors();
      if (getViewMode() === 'cycle') setViewMode('weekly');
      closeModal();
    });
    front.footer.appendChild(clearBtn);
    front.footer.appendChild(closeBtn);

    var resetCycleBtn = document.createElement('button');
    resetCycleBtn.textContent = 'Limpar Ciclo';
    resetCycleBtn.style.cssText = 'padding:10px 16px;border:1px solid var(--red);border-radius:8px;background:transparent;color:var(--red);font-family:var(--sans);font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0';
    resetCycleBtn.addEventListener('click', function () {
      var r = loadCycleRaw();
      r.entries = [];
      r.currentItemId = '';
      saveCycleRaw(r);
      renderCycleList();
    });
    var closeCycleBtn = document.createElement('button');
    closeCycleBtn.textContent = 'Escolher Ciclo de Estudos';
    closeCycleBtn.style.cssText = 'flex:1;padding:10px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-family:var(--sans);font-size:14px;font-weight:700;cursor:pointer';
    closeCycleBtn.addEventListener('click', function () {
      persistVisibleMatColors();
      setViewMode('cycle');
      closeModal();
    });
    back.footer.appendChild(resetCycleBtn);
    back.footer.appendChild(closeCycleBtn);

    renderMatsChips();
    renderCyclePalette();
    renderCycleList();
    updateDashboardCardHeader();
    setFace(getViewMode() === 'cycle');
  };
  window.abrirModalCrono._patched = true;

  bindTimerBridge();

  function getCronogramaConfig() {
    var cid = getCid();
    if (!cid) return {};
    var cfg = smartReadJson('ct_cronograma_inteligente_' + cid, {});
    if (cfg && (!cfg.materiasSelecionadas || typeof cfg.materiasSelecionadas !== 'object')) {
      cfg.materiasSelecionadas = {};
    }
    if (cfg && cfg.tipo === 'ciclo' && (!cfg.cicloModo || cfg.cicloModo === 'agendado')) {
      cfg.cicloModo = 'sugerido';
    }
    return cfg;
  }

  function calculateCycleSubjectPriorities(cid) {
    var cfg = getCronogramaConfig();
    var materias = smartFilterSelectedMaterias(cfg, window.CT.getMaterias(cid) || []);
    var allQuestions = window.CT.getQuestoes ? window.CT.getQuestoes({ concursoId: cid }) : [];
    
    var painel = smartPainelMeta(cid, materias);
    var maxShare = 0.01;
    materias.forEach(function (m) {
      var sh = (painel.map.get(String(m.id)) || {}).share || 0;
      if (sh > maxShare) maxShare = sh;
    });

    function getSimMateriaStats(materiaId) {
      try {
        var list = JSON.parse(localStorage.getItem('ct_simulados_' + cid) || '[]');
        var matSims = list.filter(function (s) {
          return String(s.materiaId) === String(materiaId) && s.porcentagem != null;
        }).sort(function (a, b) {
          return new Date(b.data || b.criadoEm).getTime() - new Date(a.data || a.criadoEm).getTime();
        });
        return { ultimo: matSims[0] ? Number(matSims[0].porcentagem) : null };
      } catch (e) {
        return { ultimo: null };
      }
    }

    function getMateriaAffinity(materiaId) {
      var n = Number(cfg && cfg.materiaAfinidade && cfg.materiaAfinidade[materiaId]);
      return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
    }

    var result = [];

    materias.forEach(function (materia) {
      var qs = allQuestions.filter(function (q) { return q.materiaId === materia.id; });
      var meta = painel.map.get(String(materia.id)) || { share: 0, questoes: 0, pontos: 0 };
      
      var general = window.CT.calcStats ? window.CT.calcStats(qs) : { resolvidas:0, acertos:0, erros:0, pct:null };
      var recent = smartCalcRecentStats(qs, 30);
      
      var topicos = window.CT.getTopicos(materia.id) || [];
      var totalUnits = 0;
      var doneUnits = 0;
      topicos.forEach(function (t) {
        var subs = window.CT.getSubtopicos(t.id) || [];
        if (subs.length) {
          totalUnits += subs.length;
          if (t.estudado) {
            doneUnits += subs.length;
          } else {
            doneUnits += subs.filter(function (s) { return s.estudado; }).length;
          }
        } else {
          totalUnits += 1;
          if (t.estudado) doneUnits += 1;
        }
      });
      var coverage = totalUnits > 0 ? (doneUnits / totalUnits) : 0;
      
      // Calculate Priority Score - dominated by exam weight/share
      var share = meta.share || 0;
      // Ensure subjects with no weight still get a baseline share (e.g. 3%) so they are not excluded
      var baseShare = Math.max(0.03, share);
      var basePriority = baseShare * 100;
      
      // Multipliers:
      // 1. Difficulty/Affinity (lower affinity = harder = needs more study)
      var affinity = getMateriaAffinity(materia.id);
      var affinityMultiplier = 1 + (3 - affinity) * 0.15; // 5 -> 0.7, 1 -> 1.3
      
      // 2. Performance (low performance = needs more study)
      var simStats = getSimMateriaStats(materia.id);
      var pct = recent.pct != null ? recent.pct : (general.pct != null ? general.pct : simStats.ultimo);
      var perfMultiplier = 1.0;
      if (pct != null) {
        if (pct < 50) perfMultiplier = 1.2;
        else if (pct < 70) perfMultiplier = 1.1;
        else if (pct > 85) perfMultiplier = 0.85;
      }
      
      // 3. Coverage (less coverage = needs more study)
      var coverageMultiplier = 1 + (1 - coverage) * 0.15; // 0% -> 1.15, 100% -> 1.0
      
      var priority = Math.max(1, basePriority * affinityMultiplier * perfMultiplier * coverageMultiplier);
      
      result.push({
        materia: materia,
        priority: priority,
        color: materia.cor || '#4f8ef7'
      });
    });

    return result;
  }

  function buildSuggestedCycleData(cid) {
    var cfg = getCronogramaConfig();
    var weeklyHours = 0;
    if (cfg && cfg.horas) {
      Object.keys(cfg.horas).forEach(function (k) {
        weeklyHours += Number(cfg.horas[k]) || 0;
      });
    }
    if (weeklyHours <= 0) weeklyHours = 15; // default fallback

    var priorities = calculateCycleSubjectPriorities(cid);
    if (!priorities.length) return null;

    var totalPriority = 0;
    priorities.forEach(function (p) { totalPriority += p.priority; });

    var sessions = [];
    priorities.forEach(function (p) {
      var hours = (p.priority / totalPriority) * weeklyHours;
      var allocatedHours = Math.round(hours * 2) / 2;
      allocatedHours = Math.max(0.5, allocatedHours); // floor 0.5h
      var targetSeconds = allocatedHours * 3600;
      
      var remaining = targetSeconds;
      var sessionIndex = 1;
      var abrName = abbreviateSubjectName(p.materia.nome);
      var baseId = baseIdFromName(abrName);
      while (remaining > 0) {
        var chunk = Math.min(7200, remaining); // max 2h per session
        sessions.push({
          id: 'entry_' + Date.now() + '_' + Math.random().toString(16).slice(2, 7) + '_' + sessionIndex,
          baseId: baseId,
          nome: abrName,
          cor: p.color,
          materiaId: p.materia.id,
          targetSeconds: chunk,
          remainingSeconds: chunk,
          status: 'pending',
          skippedSeconds: 0,
          lastPendingSeconds: 0,
          updatedAt: new Date().toISOString()
        });
        remaining -= chunk;
        sessionIndex++;
      }
    });

    // Interleave them using a Spaced Distribution Algorithm to space out sessions of the same subject evenly
    var groups = {};
    sessions.forEach(function (s) {
      if (!groups[s.baseId]) groups[s.baseId] = [];
      groups[s.baseId].push(s);
    });

    var sortedSubjects = Object.keys(groups).map(function (baseId) {
      return {
        baseId: baseId,
        sessions: groups[baseId]
      };
    }).sort(function (a, b) {
      return b.sessions.length - a.sessions.length;
    });

    var totalSessions = sessions.length;
    var finalAcademicItems = new Array(totalSessions).fill(null);

    sortedSubjects.forEach(function (subject) {
      var n = subject.sessions.length;
      if (n === 0) return;
      
      var stride = totalSessions / n;
      for (var i = 0; i < n; i++) {
        // Calculate the ideal index for this session (e.g. for N=3, N_total=9: indices 2, 5, 8)
        var idealIdx = Math.floor(i * stride + stride - 1);
        idealIdx = Math.max(0, Math.min(totalSessions - 1, idealIdx));
        
        // If the ideal index is occupied, find the nearest empty slot
        var actualIdx = idealIdx;
        var offset = 1;
        while (finalAcademicItems[actualIdx] !== null) {
          if (idealIdx - offset >= 0 && finalAcademicItems[idealIdx - offset] === null) {
            actualIdx = idealIdx - offset;
            break;
          }
          if (idealIdx + offset < totalSessions && finalAcademicItems[idealIdx + offset] === null) {
            actualIdx = idealIdx + offset;
            break;
          }
          offset++;
        }
        
        finalAcademicItems[actualIdx] = subject.sessions[i];
      }
    });

    finalAcademicItems = finalAcademicItems.filter(Boolean);

    return {
      round: 1,
      startedAt: new Date().toISOString(),
      currentIndex: 0,
      currentItemId: finalAcademicItems[0] ? finalAcademicItems[0].id : '',
      items: finalAcademicItems,
      sessionHistory: []
    };
  }

  function getNextUnstudiedTopicForSubject(materiaId) {
    if (!materiaId || isVirtualMateriaId(materiaId)) return null;
    var topicos = window.CT.getTopicos(materiaId) || [];
    for (var i = 0; i < topicos.length; i++) {
      var t = topicos[i];
      if (t.estudado) continue;
      var subs = window.CT.getSubtopicos(t.id) || [];
      if (subs.length) {
        for (var j = 0; j < subs.length; j++) {
          var s = subs[j];
          if (!s.estudado) {
            return {
              topicoId: t.id,
              subtopicoId: s.id,
              nome: s.nome || 'Subtópico',
              materiaId: materiaId,
              fullLabel: (t.nome || 'Tópico') + ' > ' + (s.nome || 'Subtópico')
            };
          }
        }
      } else {
        if (!t.estudado) {
          return {
            topicoId: t.id,
            subtopicoId: null,
            nome: t.nome || 'Tópico',
            materiaId: materiaId,
            fullLabel: t.nome || 'Tópico'
          };
        }
      }
    }
    return null;
  }
  
  function buildLivreCycleData(cid) {
    var cfg = getCronogramaConfig();
    var mats = window._getCronoMats().filter(function (mat) {
      return mat && mat.nome && !isSpecialNeutralName(mat.nome);
    });
    var selectedMats = mats.filter(function (mat) {
      return smartIsMateriaSelected(cfg, mat.materiaId || mat.id || resolveMateriaId(mat.nome));
    });
    if (selectedMats.length) mats = selectedMats;
    if (!mats.length) return null;
    
    var entries = mats.map(function (mat) {
      var abrName = abbreviateSubjectName(mat.nome);
      var baseId = baseIdFromName(abrName);
      return {
        id: 'entry_' + Date.now() + '_' + Math.random().toString(16).slice(2, 7) + '_' + Math.floor(Math.random()*1000),
        baseId: baseId,
        nome: abrName,
        cor: mat.cor || '#4f8ef7',
        materiaId: mat.materiaId || mat.id || resolveMateriaId(mat.nome) || '',
        targetSeconds: 0,
        remainingSeconds: 0,
        status: 'pending',
        skippedSeconds: 0,
        lastPendingSeconds: 0,
        updatedAt: new Date().toISOString()
      };
    });

    return {
      round: 1,
      startedAt: new Date().toISOString(),
      currentIndex: 0,
      currentItemId: entries[0] ? entries[0].id : '',
      items: entries,
      sessionHistory: []
    };
  }

  // Initial render with retry mechanism to ensure cId is ready and dashboard is updated
  (function initDashboard() {
    if (!document.getElementById('cronoGrid')) {
      return;
    }
    if (typeof window.renderCrono === 'function') {
        window.renderCrono();
        // Check again in 300ms to be absolutely sure the main app finished its slow init
        setTimeout(window.renderCrono, 300);
    } else {
        setTimeout(initDashboard, 50);
    }
  })();
})();
