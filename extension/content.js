// ═══════════════════════════════════════════════════════════════
//  Aviator Live Capture — content.js v4.0
//  ✅ Anti-throttle (aba minimizada)
//  ✅ Captura COR REAL do DOM
//  ✅ Captura NÚMERO DA RODADA (ng-tns-c45-*)
//  ✅ Keep-alive do servidor Render.com
// ═══════════════════════════════════════════════════════════════

const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";
let lastValue = null;
let lastRound = null;
let tentativas = 0;

// ── ANTI-THROTTLE: AudioContext silencioso mantém aba viva ──
function keepAlive() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setInterval(() => {
      if (ctx.state === "suspended") ctx.resume();
    }, 20000);
    console.log("[Aviator] ✅ Anti-throttle ativo");
  } catch (e) {
    console.log("[Aviator] AudioContext indisponível:", e.message);
  }
}

// ── EXTRAI COR RGB do style inline ──
function extractRgb(el) {
  try {
    const inlineColor = el.style.color;
    if (inlineColor && inlineColor.startsWith("rgb")) {
      return inlineColor.replace(/[^0-9,]/g, "").replace(/,$/, "");
    }
    const computed = window.getComputedStyle(el).color;
    if (computed && computed.startsWith("rgb")) {
      return computed.replace(/[^0-9,]/g, "").replace(/,$/, "");
    }
  } catch (e) {}
  return null;
}

// ── CAPTURA NÚMERO DA RODADA ──
// O Aviator exibe: <span class="text-uppercase ng-tns-c45-3"> Rodada 3428938 </span>
// O sufixo numérico do ng-tns pode variar (c45-0, c45-1, etc.)
function extractRound() {
  try {
    // Busca qualquer span com classe contendo "ng-tns-c45-" e "text-uppercase"
    const spans = document.querySelectorAll("span.text-uppercase[class*=\"ng-tns-c45-\"]");
    for (const span of spans) {
      const txt = (span.innerText || span.textContent || "").trim();
      // Formato: "Rodada 3428938" ou "Round 3428938"
      const match = txt.match(/\d{5,}/);
      if (match) return match[0];
    }
    // Fallback: busca por texto contendo "Rodada" em qualquer span
    const allSpans = document.querySelectorAll("span.text-uppercase");
    for (const span of allSpans) {
      const txt = (span.innerText || span.textContent || "").trim();
      const match = txt.match(/\d{5,}/);
      if (match) return match[0];
    }
  } catch (e) {}
  return null;
}

// ── CAPTURE ──
function capture() {
  const payouts = document.querySelectorAll(".payout");
  if (!payouts.length) {
    tentativas++;
    if (tentativas < 5) console.log("[Aviator] Aguardando .payout... tentativa", tentativas);
    return;
  }
  tentativas = 0;

  const el    = payouts[0];
  const raw   = (el.innerText || el.textContent || "").trim();
  const clean = raw.replace(/x/gi, "").replace(",", ".").trim();
  const value = parseFloat(clean);

  if (!value || isNaN(value) || value < 1 || value > 10000) return;
  if (value === lastValue) return;
  lastValue = value;

  const rgb   = extractRgb(el);
  const round = extractRound();

  console.log("[Aviator] ✅ Vela:", value, "| Rodada:", round || "?", "| Cor:", rgb || "?");

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      multiplier: value,
      color_rgb:  rgb   || null,
      round:      round || null
    }),
    keepalive: true,
  })
  .then(r => console.log("[Aviator] Enviado! Status:", r.status))
  .catch(e => console.log("[Aviator] Erro:", e));
}

// ── KEEP-ALIVE DO SERVIDOR ──
function pingServer() {
  fetch(`${SERVER_URL}/api/ping`, { method: "GET" })
    .then(() => console.log("[Aviator] 🔄 Ping OK"))
    .catch(() => {});
}

keepAlive();
setInterval(capture, 1000);
setInterval(pingServer, 4 * 60 * 1000);
