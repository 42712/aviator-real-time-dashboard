// ═══════════════════════════════════════════════════════
//  Megatron — content.js v5.0 DEFINITIVO
//  Funciona no Kiwi Browser Android
//  Lógica: rastreia PICO e envia quando volta pra 1.00x
// ═══════════════════════════════════════════════════════
(function () {
  const SERVER = "https://aviator-real-time-dashboard.onrender.com";

  let pico = 0;          // maior multiplicador desta rodada
  let prevMult = null;   // último valor lido
  let lastRound = null;  // última rodada detectada
  let enviando = false;
  let rodadaEnviada = false; // evita envio duplo da mesma rodada

  // ─── Lê o multiplicador da tela ───────────────────────
  function getMult() {
    // Percorre todos os elementos folha (sem filhos) procurando padrão "1.23x" ou "1.23"
    const all = document.querySelectorAll("div, span, p, td, li");
    for (let el of all) {
      // Pula elementos com filhos — só texto puro
      if (el.children.length > 0) continue;
      const raw = (el.innerText || el.textContent || "").trim();
      // Aceita formatos: "1.23x" ou "1.23" ou "1,23x"
      const clean = raw.replace(",", ".").replace(/[^\d.]/g, "");
      if (!clean) continue;
      const v = parseFloat(clean);
      if (!isNaN(v) && v >= 1.0 && v <= 999.99) {
        // Confirma que o texto original tinha no mínimo um ponto/vírgula + 2 decimais
        if (/\d+[.,]\d{2}/.test(raw)) return v;
      }
    }
    return null;
  }

  // ─── Lê o número da rodada ────────────────────────────
  function getRound() {
    // Estratégia 1: texto contendo "Rodada" ou "Round" seguido de número
    const tudo = document.querySelectorAll("span, div, p, label");
    for (let el of tudo) {
      const t = (el.innerText || el.textContent || "").trim();
      const m = t.match(/[Rr]o(?:dada|und)[^\d]*(\d{4,})/);
      if (m) return m[1];
    }
    // Estratégia 2: classe ng-tns com número grande isolado
    const ng = document.querySelectorAll('[class*="ng-tns"]');
    for (let el of ng) {
      if (el.children.length > 0) continue;
      const t = (el.innerText || el.textContent || "").trim();
      const m = t.match(/^(\d{5,})$/);
      if (m) return m[1];
    }
    return null;
  }

  // ─── Envia a vela para o servidor ─────────────────────
  async function enviarVela(mult, round) {
    if (enviando) return;
    enviando = true;
    try {
      const r = await fetch(SERVER + "/api/candle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier: mult, round: round || null })
      });
      if (r.ok) {
        console.log("[MEGATRON] ✅ Enviado: " + mult + "x | rodada=" + round);
        try { chrome.runtime.sendMessage({ type: "CANDLE_CAPTURED", data: { multiplier: mult, round } }); } catch (_) {}
      } else {
        console.warn("[MEGATRON] ⚠ Servidor:", r.status);
      }
    } catch (e) {
      console.warn("[MEGATRON] ❌", e.message);
    } finally {
      enviando = false;
    }
  }

  // ─── Loop principal 800ms ─────────────────────────────
  function loop() {
    const mult  = getMult();
    const round = getRound();

    if (round) lastRound = round;

    if (mult !== null) {
      // Atualiza pico da rodada atual
      if (mult > pico) pico = mult;

      // Detecta início de nova rodada: multiplicador caiu para ~1.00
      // (estava acima de 1.05 e agora voltou pra base)
      const novaRodada = (prevMult !== null && prevMult > 1.05 && mult < 1.03);

      if (novaRodada && !rodadaEnviada && pico > 1.0) {
        const velaPico = parseFloat(pico.toFixed(2));
        console.log("[MEGATRON] 🎯 VELA FECHADA: " + velaPico + "x | rodada=" + lastRound);
        enviarVela(velaPico, lastRound);
        rodadaEnviada = true;
        pico = 0; // reset pico
      }

      // Quando sobe acima de 1.05 novamente = nova rodada começou
      if (prevMult !== null && prevMult < 1.03 && mult > 1.05) {
        rodadaEnviada = false; // libera envio para próxima rodada
      }

      prevMult = mult;
    }

    setTimeout(loop, 800);
  }

  // Inicia após 3s (espera página carregar)
  setTimeout(loop, 3000);
  console.log("[MEGATRON] content.js v5.0 ativo em:", location.href);
})();
