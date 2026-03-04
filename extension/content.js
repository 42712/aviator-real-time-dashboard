// ═══════════════════════════════════════════════════════════════
//  Aviator Live Capture — content.js v4.2
//  ✅ Anti-throttle | ✅ Cor RGB | ✅ Rodada (busca agressiva)
// ═══════════════════════════════════════════════════════════════

const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";
let lastValue = null;
let tentativas = 0;

// ── ANTI-THROTTLE ──
function keepAlive() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setInterval(() => { if (ctx.state === "suspended") ctx.resume(); }, 20000);
  } catch (e) {}
}

// ── COR RGB ──
function extractRgb(el) {
  try {
    const ic = el.style.color;
    if (ic && ic.startsWith("rgb")) return ic.replace(/[^0-9,]/g,"").replace(/,$/,"");
    const cc = window.getComputedStyle(el).color;
    if (cc && cc.startsWith("rgb")) return cc.replace(/[^0-9,]/g,"").replace(/,$/,"");
  } catch(e) {}
  return null;
}

// ── RODADA ──
// DOM real: <span _ngcontent-xnt-c45="" class="text-uppercase ng-tns-c45-3"> Rodada 3438356 </span>
// O prefixo (_ngcontent-xnt / uns / abc) muda a cada build, mas a CLASSE é estável
function extractRound() {
  try {
    // Método DIRETO: span com classe text-uppercase E ng-tns-c45- (padrão confirmado)
    const direct = document.querySelectorAll("span.text-uppercase[class*='ng-tns-c45-']");
    for (const s of direct) {
      const t = (s.innerText || s.textContent || "").trim();
      const m = t.match(/\d{5,}/);
      if (m) { console.log("[Rodada] ✅", m[0]); return m[0]; }
    }

    // Fallback 1: qualquer span.text-uppercase com número longo (sem exigir ng-tns)
    const spans = document.querySelectorAll("span.text-uppercase");
    for (const s of spans) {
      const t = (s.innerText || s.textContent || "").trim();
      if (/rodada|round/i.test(t)) {
        const m = t.match(/\d{5,}/);
        if (m) { console.log("[Rodada] fallback1:", m[0]); return m[0]; }
      }
    }

    // Fallback 2: qualquer elemento com ng-tns-c45- na classe
    const ngEls = document.querySelectorAll("[class*='ng-tns-c45-']");
    for (const el of ngEls) {
      const t = (el.innerText || el.textContent || "").trim();
      if (t.length > 30) continue; // ignora containers grandes
      const m = t.match(/\d{5,}/);
      if (m) { console.log("[Rodada] fallback2:", m[0]); return m[0]; }
    }
  } catch(e) {}
  return null;
}



// ── CAPTURE ──
function capture() {
  const payouts = document.querySelectorAll(".payout");
  if (!payouts.length) {
    tentativas++;
    if (tentativas < 5) console.log("[Aviator] Aguardando .payout...", tentativas);
    return;
  }
  tentativas = 0;

  const el    = payouts[0];
  const raw   = (el.innerText || el.textContent || "").trim();
  const clean = raw.replace(/x/gi,"").replace(",",".").trim();
  const value = parseFloat(clean);

  if (!value || isNaN(value) || value < 1 || value > 10000) return;
  if (value === lastValue) return;
  lastValue = value;

  const rgb   = extractRgb(el);
  const round = extractRound();

  console.log(`[Aviator] ✅ ${value}x | Rodada: ${round||"NÃO ENCONTRADA"} | Cor: ${rgb||"—"}`);

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiplier: value, color_rgb: rgb||null, round: round||null }),
    keepalive: true,
  })
  .then(r => console.log("[Aviator] Enviado:", r.status))
  .catch(e => console.log("[Aviator] Erro:", e));
}

function pingServer() {
  fetch(`${SERVER_URL}/api/ping`).catch(()=>{});
}

keepAlive();
setInterval(capture, 1000);
setInterval(pingServer, 4 * 60 * 1000);
