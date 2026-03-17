// ═══════════════════════════════════════════════════════════
//  Megatron — content.js v5.0
//  ✅ Intercepta WebSocket do Aviator para multiplicador RT
//  ✅ Fallback: polling DOM a cada 100ms
//  ✅ Envia vela fechada via POST /api/candle
//  ✅ Envia multiplicador RT via POST /api/mult
// ═══════════════════════════════════════════════════════════
(function () {
  "use strict";

  const SERVER      = "https://aviator-real-time-dashboard-1.onrender.com";
  const INTERVAL_MS = 100;

  let lastMultiplier = null;
  let lastRound      = null;
  let prevCrashed    = false;
  let lastMultSent   = null;
  let roundAtiva     = false;

  // ══════════════════════════════════════════════════════
  //  INTERCEPTADOR DE WEBSOCKET
  //  Sobrescreve o WebSocket nativo para capturar mensagens
  //  do jogo antes que cheguem ao código do Aviator
  // ══════════════════════════════════════════════════════
  (function interceptarWS() {
    const OriginalWS = window.WebSocket;

    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OriginalWS(url, protocols) : new OriginalWS(url);

      // Só intercepta conexões do jogo Aviator/Spribe
      const isGame = /spribe|aviator|crash/i.test(url);

      ws.addEventListener('message', function(event) {
        if (!isGame) return;
        try {
          if (typeof event.data === 'string') {
            processarMensagemWS(event.data);
          } else if (event.data instanceof ArrayBuffer) {
            processarBinario(new Uint8Array(event.data));
          } else if (event.data instanceof Blob) {
            event.data.arrayBuffer().then(buf => processarBinario(new Uint8Array(buf)));
          }
        } catch(e) { /* ignora */ }
      });

      return ws;
    };

    // Copia propriedades estáticas do WebSocket original
    Object.assign(window.WebSocket, OriginalWS);
    window.WebSocket.prototype = OriginalWS.prototype;
  })();

  // ══════════════════════════════════════════════════════
  //  PROCESSA MENSAGEM DO WEBSOCKET
  //  Tenta extrair o multiplicador de vários formatos JSON
  // ══════════════════════════════════════════════════════
  // ── Valida se o valor é um multiplicador real crescente ──
  // (lógica do protocolo Spribe/Aviator — crédito ao amigo)
  let _ultimoValor = 0;
  function validarMultiplicador(valor) {
    if (valor < 1 || valor > 99999) return false;
    // Crescendo — rodada ativa
    if (valor >= _ultimoValor) {
      _ultimoValor = valor;
      return true;
    }
    // Reset para ~1x após mult alto — NOVA RODADA
    if (valor < 1.2 && _ultimoValor > 1.5) {
      console.log('[MEGATRON] 🔄 Nova rodada detectada');
      sendRoundStart(lastRound);
      _ultimoValor = valor;
      lastMultiplier = null;
      return true;
    }
    return false;
  }

  function processarMensagemWS(txt) {
    try {
      // Remove prefixos de protocolo (ex: "42[...]" do socket.io)
      const jsonStr = txt.replace(/^\d+/, '').replace(/^[a-z]+\[/, '[');

      let data;
      try { data = JSON.parse(jsonStr); } catch(_) {
        const match = txt.match(/\{.*\}/s) || txt.match(/\[.*\]/s);
        if (!match) return;
        data = JSON.parse(match[0]);
      }

      // ── 1. Evento de CRASH (fim de rodada) ── prioridade máxima
      // Formatos conhecidos do Spribe:
      if (data.event === 'crash' && data.multiplier) {
        const mult = parseFloat(data.multiplier);
        sendCandle(mult, detectarCorJSON(data), data.round || lastRound);
        _ultimoValor = 0;
        lastMultiplier = null;
        return;
      }
      if (data.round && data.round.state === 'complete' && data.round.crash_point) {
        const mult = parseFloat(data.round.crash_point);
        sendCandle(mult, null, data.round.id || lastRound);
        _ultimoValor = 0;
        lastMultiplier = null;
        return;
      }

      // ── 2. Histórico de rodadas anteriores ──
      if (data.history && Array.isArray(data.history)) {
        data.history.forEach(item => {
          const m = parseFloat(item.multiplier || item.crash_point || item.coefficient);
          if (!isNaN(m) && m >= 1) sendCandle(m, item.color || null, item.round || item.id || null);
        });
        return;
      }

      // ── 3. Multiplicador CRESCENTE (avião voando) ──
      const mult = extrairMultiplicadorJSON(data);
      if (mult !== null && isFinite(mult)) {
        if (validarMultiplicador(mult)) {
          sendMultRT(mult);
          lastMultiplier = mult;
        }
      }

      // ── 4. Detecta crash pelo JSON genérico ──
      const crashed = detectarCrashJSON(data);
      if (crashed && crashed.mult) {
        sendCandle(crashed.mult, detectarCorJSON(data), crashed.round || lastRound);
        _ultimoValor = 0;
        lastMultiplier = null;
      }

    } catch(e) { /* ignora */ }
  }

  // ══════════════════════════════════════════════════════
  //  PROCESSA MENSAGEM BINÁRIA (protocolo Spribe/Aviator)
  //  O protocolo usa: [2 bytes header] + [zlib data]
  //  ou float32/float64 em posição fixa
  // ══════════════════════════════════════════════════════
  function processarBinario(bytes) {
    // Tenta descomprimir zlib (header 0x78 0x9c ou 0x78 0xda)
    for (let offset = 0; offset < Math.min(bytes.length, 8); offset++) {
      if (bytes[offset] === 0x78 && (bytes[offset+1] === 0x9c || bytes[offset+1] === 0xda || bytes[offset+1] === 0x01)) {
        try {
          // Usa DecompressionStream (API nativa do browser)
          const compressed = bytes.slice(offset);
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          writer.write(compressed);
          writer.close();
          
          const chunks = [];
          const pump = () => reader.read().then(({done, value}) => {
            if (done) {
              const decoded = new TextDecoder().decode(new Uint8Array(chunks.flat()));
              processarMensagemWS(decoded);
              return;
            }
            chunks.push(Array.from(value));
            pump();
          });
          pump();
          return;
        } catch(e) {}
      }
    }

    // Fallback: tenta decodificar como UTF-8 direto
    try {
      const txt = new TextDecoder('utf-8').decode(bytes);
      if (txt.includes('{') || txt.includes('[')) {
        processarMensagemWS(txt);
        return;
      }
    } catch(e) {}

    // Fallback: busca float32 que pareça multiplicador (1.00 ~ 9999.99)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i <= bytes.length - 4; i++) {
      try {
        const vLE = view.getFloat32(i, true);   // little-endian
        const vBE = view.getFloat32(i, false);  // big-endian
        for (const v of [vLE, vBE]) {
          if (v >= 1.0 && v <= 9999.0 && isFinite(v)) {
            // Valor razoável de multiplicador
            const rounded = Math.round(v * 100) / 100;
            if (rounded >= 1.0 && rounded !== lastMultSent) {
              sendMultRT(rounded);
              break;
            }
          }
        }
      } catch(e) {}
    }
  }

  // Navega recursivamente no JSON procurando o multiplicador
  function extrairMultiplicadorJSON(obj, depth=0) {
    if (depth > 6) return null;
    if (!obj || typeof obj !== 'object') return null;

    // Chaves comuns que contêm o multiplicador
    const keys = ['coefficient','multiplier','coef','x','value','rate',
                   'currentCoef','current','cf','mult','odds','payout'];

    for (const k of keys) {
      if (obj[k] !== undefined) {
        const v = parseFloat(obj[k]);
        if (!isNaN(v) && v >= 1.0 && v <= 99999) return v;
      }
    }

    // Busca recursiva nos valores
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) {
        for (const item of val) {
          const r = extrairMultiplicadorJSON(item, depth+1);
          if (r !== null) return r;
        }
      } else if (typeof val === 'object') {
        const r = extrairMultiplicadorJSON(val, depth+1);
        if (r !== null) return r;
      }
    }
    return null;
  }

  // Detecta crash/fim de rodada no JSON
  function detectarCrashJSON(obj, depth=0) {
    if (depth > 4 || !obj || typeof obj !== 'object') return null;
    const crashKeys = ['crash','crashed','flyAway','bust','result','finish','end'];
    for (const k of crashKeys) {
      if (obj[k] !== undefined) {
        const mult = parseFloat(obj[k]) || parseFloat(obj.coefficient) || parseFloat(obj.multiplier);
        if (!isNaN(mult) && mult >= 1) return { mult, round: obj.round || obj.id || obj.gameId };
      }
    }
    for (const val of Object.values(obj)) {
      if (typeof val === 'object') {
        const r = detectarCrashJSON(val, depth+1);
        if (r) return r;
      }
    }
    return null;
  }

  // Detecta cor da vela no JSON
  function detectarCorJSON(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const keys = ['color','colour','rgb','bg'];
    for (const k of keys) {
      if (obj[k]) return String(obj[k]);
    }
    return null;
  }

  // ══════════════════════════════════════════════════════
  //  FALLBACK: POLLING DO DOM
  //  Usado quando o WS não capturar o multiplicador
  // ══════════════════════════════════════════════════════
  function getMultiplierDOM() {
    const selectors = [
      '[class*="multiplier"]', '[class*="coefficient"]',
      '[class*="crash-coeff"]', '[class*="current-multiplier"]',
      '[data-cy="current-multiplier"]', '.jet-game__coefficient',
      '.paycoeff', '.multiplier-value',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const v = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
        if (!isNaN(v) && v >= 1) return v;
      }
    }
    // Fallback texto
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      if (/^\d+\.\d{2}x?$/.test(txt)) {
        const v = parseFloat(txt);
        if (!isNaN(v) && v >= 1 && v <= 99999) return v;
      }
    }
    return null;
  }

  function getColorRGB() {
    const sels = ['[class*="plane"]','[class*="bird"]','[class*="rocket"]','canvas'];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const s = window.getComputedStyle(el);
      const bg = s.backgroundColor || s.color;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
    }
    return null;
  }

  function getRound() {
    const spans = document.querySelectorAll('span, div, p');
    for (const el of spans) {
      if (el.children.length > 0) continue;
      const m = el.textContent.trim().match(/[Rr]o(?:dada|und)\s+(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  function isCrashedDOM() {
    const sels = ['[class*="crashed"]','[class*="fly-away"]','[class*="game-over"]','[class*="round-end"]'];
    for (const s of sels) if (document.querySelector(s)) return true;
    if (/(flew away|voou|crashed|fim de rodada)/i.test(document.body.textContent)) return true;
    return false;
  }

  // ══════════════════════════════════════════════════════
  //  ENVIO AO SERVIDOR
  // ══════════════════════════════════════════════════════
  let sending = false;

  async function sendCandle(multiplier, color_rgb, round) {
    if (sending) return;
    sending = true;
    try {
      await fetch(`${SERVER}/api/candle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier, color_rgb, round }),
      });
      console.log(`[MEGATRON] ✅ Vela: ${multiplier}x`);
      try { chrome.runtime.sendMessage({ type: 'CANDLE_CAPTURED', data: { multiplier, round } }); } catch(_) {}
    } catch(e) {
      console.warn('[MEGATRON] ❌ Candle:', e.message);
    } finally { sending = false; }
  }

  function sendMultRT(mult) {
    if (lastMultSent !== null && Math.abs(mult - lastMultSent) < 0.005) return;
    lastMultSent = mult;
    fetch(`${SERVER}/api/mult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mult, ts: Date.now() }),
    }).catch(()=>{});
  }

  function sendRoundStart(round) {
    fetch(`${SERVER}/api/round_start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round, ts: Date.now() }),
    }).catch(()=>{});
    console.log('[MEGATRON] 🟢 Nova rodada');
  }

  // ══════════════════════════════════════════════════════
  //  LOOP DE FALLBACK DOM
  //  Garante captura mesmo se WS não funcionar
  // ══════════════════════════════════════════════════════
  let captureCount = 0;

  function loopDOM() {
    const crashed = isCrashedDOM();
    const mult    = getMultiplierDOM();
    const round   = getRound();

    // Crash pelo DOM — envia vela se WS não enviou
    if (!prevCrashed && crashed && mult !== null) {
      const roundId = round || lastRound || null;
      if (mult !== lastMultiplier || roundId !== lastRound) {
        lastMultiplier = mult;
        lastRound      = roundId;
        captureCount++;
        console.log(`[MEGATRON] 🎯 Crash DOM: ${mult}x #${captureCount}`);
        sendCandle(mult, getColorRGB(), roundId);
        lastMultSent = null;
      }
    }

    // Fallback: mult voltou a 1x → nova rodada
    if (prevCrashed && !crashed && mult !== null && mult < 1.1) {
      sendRoundStart(round || lastRound);
      lastMultSent = null;
    }

    prevCrashed = crashed;
    if (round) lastRound = round;

    setTimeout(loopDOM, INTERVAL_MS);
  }

  // ── Inicia ──
  const init = () => {
    setTimeout(loopDOM, 2000);
    console.log('[MEGATRON] ✅ v5.0 carregado — WS interceptado + DOM fallback');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
