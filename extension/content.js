// ═══════════════════════════════════════════════
//  Megatron — content.js v3.1 (CORRIGIDO)
//  Captura: multiplicador, cor RGB, rodada
//  Fix: detecção por queda de multiplicador (Kiwi)
// ═══════════════════════════════════════════════
(function () {
  "use strict";
  const SERVER = "https://aviator-real-time-dashboard.onrender.com";
  const INTERVAL_MS = 800;

  let lastMultiplier = null;
  let lastRound = null;
  let sending = false;
  let peak = 0;           // pico da rodada atual
  let rodadaEnviada = false;

  // ── Extrai o multiplicador do DOM ──
  function getMultiplier() {
    // Seletores específicos do Aviator/Spribe
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
    // Fallback: qualquer elemento folha com formato "1.23x" ou "1.23"
    const all = document.querySelectorAll("div, span, p");
    for (const el of all) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      if (/^\d+[.,]\d{2}x?$/.test(txt)) {
        const v = parseFloat(txt.replace(",", "."));
        if (!isNaN(v) && v >= 1 && v <= 10000) return v;
      }
    }
    return null;
  }

  // ── Extrai a cor RGB do avião/cursor ──
  function getColorRGB() {
    const colorSelectors = [
      '[class*="plane"]',
      '[class*="bird"]',
      '[class*="rocket"]',
      '[class*="jet"]',
      '[class*="craft"]',
      '[class*="aviator"]',
    ];
    for (const sel of colorSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor || style.color;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        return bg;
      }
    }
    return null;
  }

  // ── Extrai o número da rodada ──
  function getRound() {
    // Prioridade 1: texto "Rodada XXXXXX" ou "Round XXXXXX"
    const allEls = document.querySelectorAll("span, div, p");
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const match = txt.match(/[Rr]o(?:dada|und)[^\d]*(\d{4,})/);
      if (match) return match[1];
    }
    // Prioridade 2: elemento ng-tns com número grande isolado
    const ngEls = document.querySelectorAll('[class*="ng-tns"]');
    for (const el of ngEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const match = txt.match(/^(\d{5,})$/);
      if (match) return match[1];
    }
    // Prioridade 3: atributos data-
    const dataEls = document.querySelectorAll('[data-round], [data-game-id], [data-id]');
    for (const el of dataEls) {
      const v = el.dataset.round || el.dataset.gameId || el.dataset.id;
      if (v && /^\d{4,}$/.test(v)) return v;
    }
    return null;
  }

  // ── Detecta se o jogo crashou ──
  function isCrashed() {
    const crashSelectors = [
      '[class*="crashed"]',
      '[class*="fly-away"]',
      '[class*="game-over"]',
      '[class*="round-end"]',
    ];
    for (const sel of crashSelectors) {
      if (document.querySelector(sel)) return true;
    }
    const body = document.body.textContent;
    if (/(flew away|voou|crashed|fim de rodada)/i.test(body)) return true;
    return false;
  }

  // ── Envia vela ao servidor ──
  async function sendCandle(multiplier, color_rgb, round) {
    if (sending) return;
    sending = true;
    try {
      const resp = await fetch(SERVER + "/api/candle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier, color_rgb, round }),
      });
      if (resp.ok) {
        console.log("[MEGATRON] ✅ Enviado: " + multiplier + "x | rodada=" + round + " | rgb=" + color_rgb);
        try { chrome.runtime.sendMessage({ type: "CANDLE_CAPTURED", data: { multiplier, round } }); } catch (_) {}
      } else {
        console.warn("[MEGATRON] ⚠ Servidor:", resp.status);
      }
    } catch (err) {
      console.warn("[MEGATRON] ❌ Erro:", err.message);
    } finally {
      sending = false;
    }
  }

  // ── Loop principal ──
  let prevCrashed = false;

  function loop() {
    const crashed  = isCrashed();
    const mult     = getMultiplier();
    const round    = getRound();

    if (round) lastRound = round;
    if (mult !== null && mult > peak) peak = mult;

    // MÉTODO 1: detecta crash via seletor CSS (quando funciona)
    if (!prevCrashed && crashed && mult !== null && !rodadaEnviada) {
      const roundId = round || lastRound || null;
      rodadaEnviada = true;
      sendCandle(mult, getColorRGB(), roundId);
      console.log("[MEGATRON] 🎯 Crash detectado! " + mult + "x | rodada=" + roundId);
      peak = 0;
    }

    // MÉTODO 2: detecta por queda do multiplicador (fallback Kiwi)
    // Multiplicador estava alto (>1.05) e agora voltou pra base (<1.03)
    if (lastMultiplier !== null && lastMultiplier > 1.05 && mult !== null && mult < 1.03 && !rodadaEnviada) {
      const velaPico = parseFloat(peak.toFixed(2));
      const roundId  = round || lastRound || null;
      rodadaEnviada = true;
      sendCandle(velaPico, getColorRGB(), roundId);
      console.log("[MEGATRON] 🎯 Queda detectada! " + velaPico + "x | rodada=" + roundId);
      peak = 0;
    }

    // Reseta flag quando nova rodada começa (mult subindo de volta)
    if (lastMultiplier !== null && lastMultiplier < 1.03 && mult !== null && mult > 1.05) {
      rodadaEnviada = false;
    }

    prevCrashed = crashed;
    lastMultiplier = mult;

    setTimeout(loop, INTERVAL_MS);
  }

  // ── Inicia após página carregar ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(loop, 2000); });
  } else {
    setTimeout(loop, 2000);
  }

  console.log("[MEGATRON] ✅ Content script v3.1 carregado em:", window.location.href);
})();
