// ═══════════════════════════════════════════════
//  Megatron — content.js v3.0
//  Captura: multiplicador, cor RGB, rodada
//  Fix: seletor de rodada corrigido para ng-tns
// ═══════════════════════════════════════════════
(function () {
  "use strict";
  const SERVER = "https://aviator-real-time-dashboard.onrender.com";
  const INTERVAL_MS = 800;

  let lastMultiplier = null;
  let lastRound = null;
  let sending = false;

  // ── Extrai o multiplicador do DOM ──
  function getMultiplier() {
    // Seletores comuns do Aviator / Spribe
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
    // Fallback: busca qualquer elemento com "x" que pareça multiplicador
    const all = document.querySelectorAll("*");
    for (const el of all) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      if (/^\d+\.\d{2}x?$/.test(txt)) {
        const v = parseFloat(txt);
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
      'canvas',
      '[class*="aviator"]',
    ];
    for (const sel of colorSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor || style.color || style.fill;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        return bg;
      }
    }
    return null;
  }

  // ── Extrai o número da rodada ──
  // Selector do HTML: <span class="text-uppercase ng-tns-c45-3"> Rodada 3449963 </span>
  function getRound() {
    // Busca por texto contendo "Rodada" ou "Round"
    const allSpans = document.querySelectorAll("span, div, p");
    for (const el of allSpans) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      // Pega "Rodada 3449963" ou "Round 3449963"
      const match = txt.match(/[Rr]o(?:dada|und)\s+(\d+)/);
      if (match) return match[1];
    }

    // Fallback: qualquer elemento com classe ng-tns que tenha número grande
    const ngEls = document.querySelectorAll('[class*="ng-tns"]');
    for (const el of ngEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const match = txt.match(/(\d{5,})/); // número com 5+ dígitos = provável rodada
      if (match) return match[1];
    }

    // Fallback 2: atributos data-
    const dataEls = document.querySelectorAll('[data-round], [data-game-id], [data-id]');
    for (const el of dataEls) {
      const v = el.dataset.round || el.dataset.gameId || el.dataset.id;
      if (v && /^\d+$/.test(v)) return v;
    }

    return null;
  }

  // ── Detecta se o jogo crashou (vela fechou) ──
  function isCrashed() {
    const crashSelectors = [
      '[class*="crashed"]',
      '[class*="fly-away"]',
      '[class*="game-over"]',
      '[class*="cashout"]',
      '[class*="round-end"]',
    ];
    for (const sel of crashSelectors) {
      if (document.querySelector(sel)) return true;
    }
    // Texto indicando crash
    const body = document.body.textContent;
    if (/(flew away|voou|crashed|fim de rodada)/i.test(body)) return true;
    return false;
  }

  // ── Envia vela ao servidor ──
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
        console.log(`[MEGATRON] ✅ Vela enviada: ${multiplier}x | rodada=${round} | rgb=${color_rgb}`);
        // Notifica background
        try {
          chrome.runtime.sendMessage({ type: "CANDLE_CAPTURED", data: { multiplier, round } });
        } catch (_) {}
      } else {
        console.warn("[MEGATRON] ⚠ Servidor retornou:", resp.status);
      }
    } catch (err) {
      console.warn("[MEGATRON] ❌ Erro ao enviar:", err.message);
    } finally {
      sending = false;
    }
  }

  // ── Loop principal de captura ──
  let prevCrashed = false;
  let captureCount = 0;

  function loop() {
    const crashed = isCrashed();
    const mult = getMultiplier();
    const round = getRound();

    // Detecta transição: jogo ativo → crashou
    // Isso significa que a rodada acabou — registra o multiplicador final
    if (!prevCrashed && crashed && mult !== null) {
      const roundId = round || lastRound || null;
      if (mult !== lastMultiplier || roundId !== lastRound) {
        lastMultiplier = mult;
        lastRound = roundId;
        captureCount++;
        const color = getColorRGB();
        console.log(`[MEGATRON] 🎯 Crash detectado! ${mult}x | rodada=${roundId} | captura #${captureCount}`);
        sendCandle(mult, color, roundId);
      }
    }

    // Fallback: se não detectar crash mas multiplicador mudou muito (>= 1.5x diferença)
    // captura mesmo assim para não perder dados
    if (mult !== null && lastMultiplier !== null && mult < lastMultiplier && mult < 1.5) {
      // Reiniciou para perto de 1x — rodada nova começou, registra anterior
      if (lastMultiplier > 1.01 && lastMultiplier !== lastMultiplier) {
        sendCandle(lastMultiplier, getColorRGB(), round);
      }
    }

    prevCrashed = crashed;
    if (mult !== null) lastRound = round;

    setTimeout(loop, INTERVAL_MS);
  }

  // ── Inicia após página carregar ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(loop, 2000));
  } else {
    setTimeout(loop, 2000);
  }

  console.log("[MEGATRON] ✅ Content script v3.0 carregado em:", window.location.href);
})();
