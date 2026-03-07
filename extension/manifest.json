// Megatron — content.js v3.0
// Captura: multiplicador, cor RGB, rodada (ng-tns-c45)
(function() {
  "use strict";

  var SERVER = "https://aviator-real-time-dashboard.onrender.com";
  var DELAY  = 800;

  var ultimoMult   = null;
  var ultimaRodada = null;
  var enviando     = false;
  var prevCrash    = false;

  function getMult() {
    var sels = [
      '[class*="multiplier"]','[class*="coefficient"]',
      '[class*="crash-coeff"]','[class*="paycoeff"]',
      '[class*="current-multiplier"]','.jet-game__coefficient',
      '.multiplier-value'
    ];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (!el) continue;
      var txt = el.textContent.replace(/[^0-9.]/g,"").trim();
      var v = parseFloat(txt);
      if (!isNaN(v) && v >= 1 && v < 100000) return v;
    }
    var all = document.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var el2 = all[j];
      if (el2.children.length > 0) continue;
      var t = el2.textContent.trim();
      if (/^\d{1,5}\.\d{2}x?$/.test(t)) {
        var v2 = parseFloat(t);
        if (!isNaN(v2) && v2 >= 1 && v2 < 100000) return v2;
      }
    }
    return null;
  }

  function getCor() {
    var sels = ['[class*="plane"]','[class*="bird"]','[class*="rocket"]',
                '[class*="jet"]','[class*="craft"]','[class*="aviator"]'];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (!el) continue;
      var s = window.getComputedStyle(el);
      var bg = s.backgroundColor || s.color;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    }
    return null;
  }

  // HTML alvo: <span class="text-uppercase ng-tns-c45-3"> Rodada 3449963 </span>
  function getRodada() {
    var els = document.querySelectorAll("span,div,p,td,li");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 0) continue;
      var txt = el.textContent.trim();
      var m = txt.match(/[Rr]odada\s+(\d+)/);
      if (m) return m[1];
      var m2 = txt.match(/[Rr]ound\s+(\d+)/);
      if (m2) return m2[1];
    }
    var ngEls = document.querySelectorAll('[class*="ng-tns"]');
    for (var j = 0; j < ngEls.length; j++) {
      var e = ngEls[j];
      if (e.children.length > 0) continue;
      var t = e.textContent.trim();
      var n = t.match(/(\d{5,})/);
      if (n) return n[1];
    }
    var dataEls = document.querySelectorAll("[data-round],[data-game-id],[data-id]");
    for (var k = 0; k < dataEls.length; k++) {
      var v = dataEls[k].dataset.round || dataEls[k].dataset.gameId || dataEls[k].dataset.id;
      if (v && /^\d{4,}$/.test(v)) return v;
    }
    return null;
  }

  function isCrash() {
    var sels = ['[class*="crashed"]','[class*="fly-away"]',
                '[class*="game-over"]','[class*="round-end"]','[class*="flyaway"]'];
    for (var i = 0; i < sels.length; i++) {
      if (document.querySelector(sels[i])) return true;
    }
    var body = document.body ? document.body.textContent : "";
    return /(flew away|voou embora|crashed)/i.test(body);
  }

  function enviar(mult, cor, rodada) {
    if (enviando) return;
    enviando = true;
    fetch(SERVER + "/api/candle", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({multiplier:mult, color_rgb:cor, round:rodada})
    })
    .then(function(r) {
      if (r.ok) {
        console.log("[MEGATRON] Enviado: " + mult + "x | rodada=" + rodada);
        try { chrome.runtime.sendMessage({type:"CANDLE",multiplier:mult,round:rodada}); } catch(e){}
      }
    })
    .catch(function(e){ console.warn("[MEGATRON] Erro:", e.message); })
    .finally(function(){ enviando = false; });
  }

  function loop() {
    var crash = isCrash();
    var mult  = getMult();
    var rod   = getRodada();

    if (!prevCrash && crash && mult !== null) {
      var rodId = rod || ultimaRodada;
      if (mult !== ultimoMult || rodId !== ultimaRodada) {
        ultimoMult   = mult;
        ultimaRodada = rodId;
        enviar(mult, getCor(), rodId);
      }
    }

    prevCrash = crash;
    if (rod) ultimaRodada = rod;
    setTimeout(loop, DELAY);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ setTimeout(loop, 2500); });
  } else {
    setTimeout(loop, 2500);
  }

  console.log("[MEGATRON] Extensao ativa em:", location.hostname);
})();
