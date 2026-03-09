// ═══════════════════════════════════════════════
//  Megatron — content.js v4.0
//  Lógica simples e direta — funciona no Kiwi
// ═══════════════════════════════════════════════
(function(){
  const SERVER = "https://aviator-real-time-dashboard.onrender.com";
  let lastRound = null;
  let peak = 1;
  let prev = null;

  // ── Pega o multiplicador atual na tela ──
  function getMultiplier(){
    const els = document.querySelectorAll("div,span");
    for(let el of els){
      const t = el.innerText ? el.innerText.trim() : "";
      if(/^\d+\.\d{2}x?$/.test(t)){
        const v = parseFloat(t.replace("x",""));
        if(v >= 1 && v < 10000) return v;
      }
    }
    return null;
  }

  // ── Pega o número da rodada na tela ──
  function getRound(){
    // Prioridade 1: texto "Rodada XXXXXX" ou "Round XXXXXX"
    const els = document.querySelectorAll("span,div,p");
    for(let el of els){
      const txt = el.innerText || "";
      if(txt.includes("Rodada") || txt.includes("Round")){
        const m = txt.match(/(\d{5,})/);
        if(m) return m[1];
      }
    }
    // Prioridade 2: qualquer elemento ng-tns com 5+ dígitos
    const ng = document.querySelectorAll('[class*="ng-tns"],[class*="round-id"],[class*="game-id"]');
    for(let el of ng){
      const txt = el.innerText || el.textContent || "";
      const m = txt.match(/(\d{5,})/);
      if(m) return m[1];
    }
    return null;
  }

  // ── Envia vela para o servidor ──
  async function send(mult, round){
    try{
      await fetch(SERVER + "/api/candle", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({multiplier: mult, round: round})
      });
      console.log("[MEGATRON] ✅ " + mult + "x | rodada=" + round);
      try{ chrome.runtime.sendMessage({type:"CANDLE_CAPTURED", data:{multiplier:mult, round:round}}); }catch(_){}
    }catch(e){
      console.warn("[MEGATRON] ❌ Erro envio:", e.message);
    }
  }

  // ── Loop principal ──
  // Detecta queda do multiplicador (nova rodada começando)
  // e registra o PICO da rodada anterior como a vela
  function loop(){
    const mult  = getMultiplier();
    const round = getRound();

    // Atualiza rodada sempre que encontrar
    if(round) lastRound = round;

    if(mult !== null){
      // Rastreia pico da rodada atual
      if(mult > peak) peak = mult;

      // Detecta transição: estava alto → voltou pra base (nova rodada)
      if(prev !== null && mult <= 1.05 && prev > 1.05){
        const velaPeak = parseFloat(peak.toFixed(2));
        console.log("[MEGATRON] 🎯 Vela: " + velaPeak + "x | rodada=" + lastRound);
        send(velaPeak, lastRound);
        peak = 1; // reseta pico para próxima rodada
      }

      prev = mult;
    }

    setTimeout(loop, 800);
  }

  // Aguarda 4s para a página carregar antes de iniciar
  setTimeout(loop, 4000);
  console.log("[MEGATRON] content.js v4.0 carregado em:", window.location.href);
})();
