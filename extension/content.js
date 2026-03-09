// ═══════════════════════════════════════════════
//  Megatron — content.js v3.2
//  Fix: detecção de rodada robusta + crash mobile
// ═══════════════════════════════════════════════
(function () {
  "use strict";

  const SERVER = "https://aviator-real-time-dashboard.onrender.com";
  const INTERVAL_MS = 600;

  let lastRoundSent = null;
  let lastMultSent = null;
  let sending = false;
  let prevMultiplier = null;
  let peakMultiplier = 1;
  let roundActive = false;

  function getMultiplier() {
    const selectors = [
      '[class*="multiplier"]','[class*="coefficient"]','[class*="crash-coeff"]',
      '[class*="current-multiplier"]','[data-cy="current-multiplier"]',
      '.jet-game__coefficient','.paycoeff','.multiplier-value',
      '[class*="coef"]','[class*="odds"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = el.textContent.replace(/[^0-9.]/g, "").trim();
        const v = parseFloat(txt);
        if (!isNaN(v) && v >= 1 && v < 100000) return v;
      }
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.textContent.trim();
      if (/^\d{1,5}\.\d{2}x?$/.test(txt)) {
        const v = parseFloat(txt);
        if (!isNaN(v) && v >= 1 && v <= 100000) return v;
      }
    }
    return null;
  }

  function getRound() {
    const allEls = document.querySelectorAll("span, div, p, td, li, label");
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const m = txt.match(/[Rr]o(?:dada|und)\s*[#:]?\s*(\d{4,})/);
      if (m) return m[1];
    }
    const ngEls = document.querySelectorAll('[class*="ng-tns"],[class*="round"],[class*="rodada"]');
    for (const el of ngEls) {
      if (el.children.length > 0) continue;
      const txt = el.textContent.trim();
      const m = txt.match(/(\d{5,})/);
      if (m) return m[1];
    }
    const dataEls = document.querySelectorAll('[data-round],[data-game-id],[data-id],[data-round-id]');
    for (const el of dataEls) {
      const v = el.dataset.round || el.dataset.gameId || el.dataset.id || el.dataset.roundId;
      if (v && /^\d{4,}$/.test(v)) return v;
    }
    return null;
  }

  function getColorRGB() {
    const sels = ['[class*="plane"]','[class*="bird"]','[class*="rocket"]','[class*="jet"]','canvas'];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const st = window.getComputedStyle(el);
      const bg = st.backgroundColor || st.color;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && bg !== "rgb(0, 0, 0)") return bg;
    }
    return null;
  }

  function isCrashed() {
    const crashSels = [
      '[class*="crashed"]','[class*="fly-away"]','[class*="game-over"]',
      '[class*="flyaway"]','[class*="round-end"]','[class*="result"]'
    ];
    for (const sel of crashSels) {
      if (document.querySelector(sel)) return true;
    }
    if (/(flew away|voou|crashou|fim de rodada|round over)/i.test(document.body.innerText)) return true;
    return false;
  }

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
        console.log(`[MEGATRON] OK ${multiplier}x | rodada=${round}`);
        try { chrome.runtime.sendMessage({ type: "CANDLE_CAPTURED", data: { multiplier, round } }); } catch(_) {}
      }
    } catch (err) {
      console.warn("[MEGATRON] Erro:", err.message);
    } finally {
      sending = false;
    }
  }

  function loop() {
    const mult = getMultiplier();
    const crashed = isCrashed();

    if (mult !== null) {
      if (mult > peakMultiplier) peakMultiplier = mult;

      if (prevMultiplier !== null) {
        const voltouBase = mult <= 1.05 && prevMultiplier > 1.05;
        const crashDetect = crashed && roundActive;

        if (voltouBase || crashDetect) {
          const finalMult = peakMultiplier > 1.01 ? peakMultiplier : prevMultiplier;
          const round = getRound();
          const roundKey = round || String(Math.floor(Date.now() / 30000));

          if (roundKey !== lastRoundSent || Math.abs(finalMult - (lastMultSent || 0)) > 0.01) {
            lastRoundSent = roundKey;
            lastMultSent = finalMult;
            sendCandle(parseFloat(finalMult.toFixed(2)), getColorRGB(), round);
          }
          peakMultiplier = 1;
          roundActive = false;
        } else if (mult > 1.05) {
          roundActive = true;
        }
      }
      prevMultiplier = mult;
    }

    setTimeout(loop, INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { setTimeout(loop, 2500); });
  } else {
    setTimeout(loop, 2500);
  }

  console.log("[MEGATRON] content.js v3.2 carregado:", window.location.href);
})();
