// ═══════════════════════════════════════════════════════════════
//  Aviator Live Capture — content.js v3.0
//  ✅ Anti-throttle (aba minimizada)
//  ✅ Captura a COR REAL do DOM do Aviator (rgb inline style)
//  ✅ Keep-alive do servidor Render.com
// ═══════════════════════════════════════════════════════════════

const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";
let lastValue = null;
let tentativas = 0;

// ── ANTI-THROTTLE: AudioContext silencioso mantém aba viva ──
function keepAlive() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // Volume ZERO — sem nenhum som
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setInterval(() => {
      if (ctx.state === 'suspended') ctx.resume();
    }, 20000);
    console.log("[Aviator] ✅ Anti-throttle ativo (AudioContext silencioso)");
  } catch (e) {
    console.log("[Aviator] AudioContext indisponível:", e.message);
  }
}

// ── EXTRAI COR RGB do style inline do .payout ──
// Ex: style="color: rgb(52, 180, 255);" → retorna "52,180,255"
function extractRgb(el) {
  try {
    // Tenta o style inline primeiro (mais confiável)
    const inlineColor = el.style.color;
    if (inlineColor && inlineColor.startsWith('rgb')) {
      return inlineColor.replace(/[^0-9,]/g, '').replace(/,$/, '');
    }
    // Fallback: cor computada
    const computed = window.getComputedStyle(el).color;
    if (computed && computed.startsWith('rgb')) {
      return computed.replace(/[^0-9,]/g, '').replace(/,$/, '');
    }
  } catch (e) {}
  return null;
}

// ── CAPTURE ──
function capture() {
  const payouts = document.querySelectorAll(".payout");
  if (!payouts.length) {
    tentativas++;
    if (tentativas < 5) {
      console.log("[Aviator] Aguardando .payout... tentativa", tentativas);
    }
    return;
  }
  tentativas = 0;

  const el  = payouts[0];
  const raw = (el.innerText || el.textContent || "").trim();
  const clean = raw.replace(/x/gi, "").replace(",", ".").trim();
  const value = parseFloat(clean);

  if (!value || isNaN(value) || value < 1 || value > 10000) return;
  if (value === lastValue) return;
  lastValue = value;

  // Captura a cor RGB real do elemento DOM
  const rgb = extractRgb(el);

  console.log("[Aviator] ✅ Vela capturada:", value, "| Cor RGB:", rgb || "não detectada");

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      multiplier: value,
      color_rgb: rgb // ex: "52,180,255" — null se não detectar
    }),
    keepalive: true, // garante envio mesmo ao fechar aba
  })
  .then(r => console.log("[Aviator] Enviado! Status:", r.status))
  .catch(e => console.log("[Aviator] Erro ao enviar:", e));
}

// ── KEEP-ALIVE DO SERVIDOR (evita Render.com dormir) ──
function pingServer() {
  fetch(`${SERVER_URL}/api/ping`, { method: "GET" })
    .then(() => console.log("[Aviator] 🔄 Ping servidor OK"))
    .catch(() => {});
}

// ── INIT ──
keepAlive();
setInterval(capture, 1000);
setInterval(pingServer, 4 * 60 * 1000); // a cada 4 minutos
