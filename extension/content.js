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

// ── RODADA — 4 estratégias progressivas ──
function extractRound() {
  try {
    // Estratégia 1: span.text-uppercase com texto "Rodada XXXXXXX"
    const spans = document.querySelectorAll("span.text-uppercase");
    for (const s of spans) {
      const t = (s.innerText || s.textContent || "").trim();
      if (/rodada|round/i.test(t)) {
        const m = t.match(/\d{4,}/);
        if (m) { console.log("[Rodada] método 1:", m[0]); return m[0]; }
      }
    }

    // Estratégia 2: qualquer elemento com ng-tns-c45 na classe
    const ngEls = document.querySelectorAll("[class*='ng-tns-c45']");
    for (const el of ngEls) {
      const t = (el.innerText || el.textContent || "").trim();
      if (/rodada|round/i.test(t)) {
        const m = t.match(/\d{4,}/);
        if (m) { console.log("[Rodada] método 2:", m[0]); return m[0]; }
      }
    }

    // Estratégia 3: busca texto curto que começa com "Rodada" em qualquer span/div
    const all = document.querySelectorAll("span, div, p, h1, h2, h3, label");
    for (const el of all) {
      if (el.children.length > 1) continue;
      const t = (el.innerText || "").trim();
      if (t.length < 5 || t.length > 30) continue;
      if (/^(rodada|round)\s*#?\s*\d{4,}/i.test(t)) {
        const m = t.match(/\d{4,}/);
        if (m) { console.log("[Rodada] método 3:", m[0]); return m[0]; }
      }
    }

    // Estratégia 4: procura número longo (6-8 dígitos) próximo a payout
    //   Muitos jogos colocam o ID da rodada como texto próximo ao multiplicador
    const payoutEl = document.querySelector(".payout");
    if (payoutEl) {
      // Busca no pai e avôs até 4 níveis
      let node = payoutEl.parentElement;
      for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
        const t = (node.innerText || "").substring(0, 200);
        const m = t.match(/\b(\d{6,8})\b/);
        if (m) { console.log("[Rodada] método 4 (ancestral):", m[1]); return m[1]; }
      }
    }
  } catch(e) {
    console.log("[Rodada] erro:", e.message);
  }
  return null;
}

// ── LOG DE DEBUG: roda uma vez no início para mapear o DOM ──
function debugDOM() {
  console.log("[Debug] Mapeando elementos de rodada no DOM...");
  // Imprime todos os spans text-uppercase
  const spans = document.querySelectorAll("span.text-uppercase");
  spans.forEach((s,i) => {
    const t = (s.innerText||"").trim();
    if (t) console.log(`[Debug] span.text-uppercase[${i}]: "${t}" | class="${s.className}"`);
  });
  // Imprime ng-tns-c45
  const ngEls = document.querySelectorAll("[class*='ng-tns-c45']");
  ngEls.forEach((el,i) => {
    const t = (el.innerText||"").trim().substring(0,50);
    if (t) console.log(`[Debug] ng-tns[${i}]: "${t}" | class="${el.className}"`);
  });
}
setTimeout(debugDOM, 5000); // roda 5s após load

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
