// MEGATRON content.js v10.0 - KIWI IFRAME FIX
(function() {
  "use strict";

  var SERVER    = "https://aviator-real-time-dashboard-1.onrender.com";
  var MIN_DELAY = 4000;
  var lastSent  = 0;
  var sending   = false;
  var wsActive  = false;

  // ENVIA VELA
  function enviar(mult, round, timestamp) {
    if (sending) return;
    if (Date.now() - lastSent < MIN_DELAY) return;
    if (!mult || mult < 1.01) return;
    sending  = true;
    lastSent = Date.now();
    var ts   = timestamp || new Date().toISOString();
    var body = JSON.stringify({
      multiplier: parseFloat(parseFloat(mult).toFixed(2)),
      color_rgb:  null,
      round:      round || null,
      timestamp:  ts
    });
    console.log("[MEGATRON v10] enviando " + parseFloat(mult).toFixed(2) + "x");
    function tentar(n) {
      fetch(SERVER + "/api/candle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    body,
        mode:    "cors"
      })
      .then(function(r) { sending = false; if (r.ok) console.log("[MEGATRON v10] OK"); })
      .catch(function() { if (n < 4) setTimeout(function() { tentar(n+1); }, 2000); else sending = false; });
    }
    tentar(1);
  }

  // INTERCEPTA WS NA PAGINA ATUAL
  function interceptarWS(win) {
    var w = win || window;
    if (w.__megatronWS) return;
    var OldWS = w.WebSocket;
    if (!OldWS) return;
    w.__megatronWS = true;
    wsActive = true;

    w.WebSocket = function(url, protocols) {
      var ws = protocols ? new OldWS(url, protocols) : new OldWS(url);
      console.log("[MEGATRON v10] WS capturado:", url);
      var pico = 0, emRodada = false, roundAtual = null;

      ws.addEventListener("message", function(ev) {
        function processar(txt) {
          if (!txt || txt.length > 3000) return;
          var obj = null;
          try { obj = JSON.parse(txt); } catch(e) {}

          var mR = txt.match(/"(?:round_id|roundId|gameId|game_id)"\s*:\s*"?(\d{4,})"?/i);
          if (mR) roundAtual = mR[1];
          if (obj && (obj.round_id || obj.roundId || obj.gameId)) roundAtual = obj.round_id || obj.roundId || obj.gameId;

          if (/start|begin|new_game|fly|launching/i.test(txt) && !emRodada) {
            emRodada = true; pico = 1.0;
            console.log("[MEGATRON v10] INICIO rodada round=" + roundAtual);
          }

          var mult = null;
          if (obj) mult = parseFloat(obj.coef || obj.coefficient || obj.multiplier || obj.c || obj.k || obj.x || obj.current || 0);
          if (!mult || isNaN(mult) || mult < 1) {
            var mC = txt.match(/"(?:coef|coefficient|multiplier|c|k|x)"\s*:\s*(\d+\.?\d*)/i);
            if (mC) mult = parseFloat(mC[1]);
          }
          if (!mult || isNaN(mult) || mult < 1) {
            var mN = txt.match(/\b(\d{1,4}\.\d{2})\b/);
            if (mN) mult = parseFloat(mN[1]);
          }
          if (mult && mult >= 1.0 && mult <= 50000 && emRodada && mult > pico) pico = mult;

          if (/crash|crashed|end|finish|fly_away|flew|over/i.test(txt) && emRodada && pico > 1.0) {
            emRodada = false;
            console.log("[MEGATRON v10] CRASH " + pico.toFixed(2) + "x round=" + roundAtual);
            enviar(pico, roundAtual, new Date().toISOString());
            pico = 0;
          }
        }
        var raw = ev.data;
        if (typeof raw === "string") processar(raw);
        else if (raw instanceof Blob) raw.text().then(processar).catch(function(){});
        else if (raw instanceof ArrayBuffer) processar(new TextDecoder().decode(raw));
      });
      return ws;
    };
    for (var k in OldWS) { try { w.WebSocket[k] = OldWS[k]; } catch(e) {} }
    w.WebSocket.prototype = OldWS.prototype;
    console.log("[MEGATRON v10] WS interceptado em:", w.location ? w.location.href : "iframe");
  }

  // INJETA EM TODOS OS IFRAMES
  function injetarIframes() {
    var frames = document.querySelectorAll("iframe");
    frames.forEach(function(fr) {
      try {
        var fw = fr.contentWindow;
        var fd = fr.contentDocument || (fw && fw.document);
        if (!fw || !fd) return;
        if (fw.__megatronWS) return;
        interceptarWS(fw);
        console.log("[MEGATRON v10] iframe interceptado:", fr.src || "inline");
      } catch(e) {
        // cross-origin bloqueado pelo browser — normal
      }
    });
  }

  // FALLBACK DOM (busca multiplicador na tela)
  var domPico = 0, domStable = 0, domLast = null, domEnv = false;

  function getMult() {
    var sels = [
      '[class*="multiplier"],[class*="coefficient"],[class*="coef"],[class*="crash-coeff"],[class*="fly-coef"]'
    ];
    var all = document.querySelectorAll(sels[0]);
    for (var i = 0; i < all.length; i++) {
      if (all[i].children.length > 0) continue;
      var m = (all[i].textContent || "").trim().match(/(\d+[.,]\d+)\s*x?/i);
      if (m) { var v = parseFloat(m[1].replace(",",".")); if (v >= 1.0 && v <= 50000) return v; }
    }
    // Busca dentro de iframes
    var frames = document.querySelectorAll("iframe");
    for (var fi = 0; fi < frames.length; fi++) {
      try {
        var fels = frames[fi].contentDocument.querySelectorAll('[class*="multiplier"],[class*="coef"],[class*="coefficient"]');
        for (var fj = 0; fj < fels.length; fj++) {
          if (fels[fj].children.length > 0) continue;
          var fm = (fels[fj].textContent || "").trim().match(/(\d+[.,]\d+)\s*x?/i);
          if (fm) { var fv = parseFloat(fm[1].replace(",",".")); if (fv >= 1.0 && fv <= 50000) return fv; }
        }
      } catch(e) {}
    }
    return null;
  }

  function loopDOM() {
    var mult = getMult();
    if (mult && mult > 1.0 && mult > domPico) domPico = mult;
    if (mult !== null && domLast !== null) {
      if (Math.abs(mult - (domLast||0)) < 0.01) domStable++;
      else domStable = 0;
    }
    if (!domEnv && domStable >= 6 && domPico > 1.1) {
      domEnv = true;
      enviar(domPico, null, new Date().toISOString());
      domPico = 0; domStable = 0;
    }
    if (domLast !== null && (domLast||0) < 1.10 && mult !== null && mult >= 1.10) {
      domEnv = false; domPico = 0; domStable = 0;
    }
    domLast = mult;
    setTimeout(loopDOM, 600);
  }

  // POPUP TEST
  try {
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
      if (msg && msg.type === "TEST_CAPTURE") {
        sendResponse({ status: "OK", multiplier: getMult(), url: window.location.href, ws: wsActive });
      }
      return true;
    });
  } catch(e) {}

  // INICIA
  console.log("[MEGATRON v10] iniciando em:", window.location.href);
  interceptarWS(window);
  setTimeout(function() { interceptarWS(window); injetarIframes(); }, 500);
  setTimeout(function() { interceptarWS(window); injetarIframes(); }, 2000);
  setTimeout(function() { injetarIframes(); }, 5000);

  // Observer para iframes novos
  try {
    new MutationObserver(function() { injetarIframes(); })
      .observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}

  setTimeout(loopDOM, 3000);
  fetch(SERVER + "/api/ping").catch(function(){});

})();
