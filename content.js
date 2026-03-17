// ═══════════════════════════════════════════════════════════
//  Megatron — content.js v4.0
//  ✅ Envia vela ao fechar (POST /api/candle)
//  ✅ Envia multiplicador em tempo real (POST /api/mult)
//  ✅ Envia tick do cronômetro ao iniciar nova rodada
//  Site: sortenabet.bet.br / spribegaming.com
// ═══════════════════════════════════════════════════════════
(function () {
  "use strict";

  const SERVER      = "https://aviator-real-time-dashboard-1.onrender.com";
  const INTERVAL_MS = 100; // poll a cada 200ms para multiplicador suave

  let lastMultiplier  = null;
  let lastRound       = null;
  let prevCrashed     = false;
  let sending         = false;
  let lastMultSent    = null;
  let roundAtiva      = false; // true = rodada em jogo
  let roundStartTs    = null;  // timestamp início da rodada atual

  // ── Extrai o multiplicador do DOM ──────────────────────
  function getMultiplier() {
    const selectors = [
      '[class*="multiplier"]',
      '[class*="coefficient"]',
      '[class*="crash-coeff"]',
      '[class*="current-multiplier"]',
      '[data-cy="current-multiplier"]',
      '.jet-game__coefficient',
      '.paycoeff',
      '.multiplier-value',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.textContent.replace(/[^0-9.]/g, "").trim();
        const v = parseFloat(txt);
        if (!isNaN(v) && v >= 1) return v;
      }
    }
    // Fallback: qualquer texto que pareça multiplicador
    const all = document.querySelectorAll("*");
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

  // ── Extrai cor RGB ──────────────────────────────────────
  function getColorRGB() {
    const colorSelectors = [
      '[class*="plane"]', '[class*="bird"]', '[class*="rocket"]',
      '[class*="jet"]', '[class*="craft"]', 'canvas', '[class*="aviator"]',
    ];
    for (const sel of colorSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor || style.color || style.fill;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    }
    return null;
  }

  // ── Extrai número da rodada ──────────────────────────────
  function getRound() {
    const allSpans = document.querySelectorAll("span, div, p");
    for (const el of allSpans) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const match = txt.match(/[Rr]o(?:dada|und)\s+(\d+)/);
      if (match) return match[1];
    }
    const ngEls = document.querySelectorAll('[class*="ng-tns"]');
    for (const el of ngEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const match = txt.match(/(\d{5,})/);
      if (match) return match[1];
    }
    return null;
  }

  // ── Detecta crash ───────────────────────────────────────
  function isCrashed() {
    const crashSelectors = [
      '[class*="crashed"]', '[class*="fly-away"]',
      '[class*="game-over"]', '[class*="round-end"]',
    ];
    for (const sel of crashSelectors) {
      if (document.querySelector(sel)) return true;
    }
    if (/(flew away|voou|crashed|fim de rodada)/i.test(document.body.textContent)) return true;
    return false;
  }

  // ── Envia VELA FECHADA ao servidor ──────────────────────
  async function sendCandle(multiplier, color_rgb, round) {
    if (sending) return;
    sending = true;
    try {
      const resp = await fetch(`${SERVER}/api/candle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier, color_rgb, round }),
      });
      if (resp.ok) {
        console.log(`[MEGATRON] ✅ Vela: ${multiplier}x | rodada=${round}`);
        try { chrome.runtime.sendMessage({ type: "CANDLE_CAPTURED", data: { multiplier, round } }); } catch(_) {}
      }
    } catch (err) {
      console.warn("[MEGATRON] ❌ Erro candle:", err.message);
    } finally {
      sending = false;
    }
  }

  // ── Envia MULTIPLICADOR EM TEMPO REAL ──────────────────
  // Envia a cada variação significativa (≥ 0.01x diferença)
  function sendMultRT(mult) {
    // Só envia se mudou o suficiente
    if (lastMultSent !== null && Math.abs(mult - lastMultSent) < 0.005) return;
    lastMultSent = mult;
    // Fire-and-forget — não bloqueia o loop
    fetch(`${SERVER}/api/mult`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mult, ts: Date.now() }),
    }).catch(() => {});
  }

  // ── Envia INÍCIO DE NOVA RODADA (para o cronômetro) ────
  async function sendRoundStart(round) {
    try {
      await fetch(`${SERVER}/api/round_start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, ts: Date.now() }),
      });
      console.log(`[MEGATRON] 🟢 Nova rodada iniciou | rodada=${round}`);
    } catch (_) {}
  }

  // ── Loop principal ──────────────────────────────────────
  let captureCount = 0;

  function loop() {
    const crashed = isCrashed();
    const mult    = getMultiplier();
    const round   = getRound();

    // ── RODADA EM JOGO: envia mult em tempo real ──
    if (!crashed && mult !== null && mult >= 1) {
      roundAtiva = true;
      sendMultRT(mult);
    }

    // ── CRASH DETECTADO: vela fechou ──
    if (!prevCrashed && crashed && mult !== null) {
      const roundId = round || lastRound || null;
      if (mult !== lastMultiplier || roundId !== lastRound) {
        lastMultiplier = mult;
        lastRound      = roundId;
        captureCount++;
        const color = getColorRGB();
        console.log(`[MEGATRON] 🎯 Crash! ${mult}x | rodada=${roundId} | #${captureCount}`);
        sendCandle(mult, color, roundId);
        // Reseta mult RT após crash
        lastMultSent = null;
        roundAtiva   = false;
      }
    }

    // ── NOVA RODADA INICIOU (mult voltou para ~1.00x após crash) ──
    if (prevCrashed && !crashed && mult !== null && mult < 1.1) {
      roundStartTs = Date.now();
      sendRoundStart(round || lastRound);
      lastMultSent = null;
    }

    // ── Fallback: mult reiniciou para 1x sem crash detectado ──
    if (!crashed && mult !== null && lastMultiplier !== null && mult < 1.05 && lastMultiplier > 1.5) {
      if (!prevCrashed) {
        sendCandle(lastMultiplier, getColorRGB(), round);
        lastMultSent = null;
        roundAtiva   = false;
      }
    }

    prevCrashed = crashed;
    if (mult !== null) lastRound = round;

    setTimeout(loop, INTERVAL_MS);
  }

  // ── Inicia ──────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(loop, 2000));
  } else {
    setTimeout(loop, 2000);
  }

  console.log("[MEGATRON] ✅ content.js v4.0 carregado em:", window.location.href);
})();
