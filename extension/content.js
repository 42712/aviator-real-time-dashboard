const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";

let lastValue = null;

// Lista de seletores para tentar capturar o multiplicador
const SELECTORS = [
  ".payout",
  ".multiplier",
  "[class*='payout']",
  "[class*='multiplier']",
  "[class*='crash-value']",
  "[class*='bet-result']",
  ".jet-game-result",
  ".aviator-coefficient",
];

function tryCapture() {
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (!el) continue;

    const raw = el.innerText || el.textContent || "";
    const clean = raw.replace(/[^0-9.,]/g, "").replace(",", ".");
    const value = parseFloat(clean);

    if (!value || isNaN(value) || value < 1 || value === lastValue) continue;
    if (value > 1000) continue; // ignora valores absurdos

    lastValue = value;

    fetch(`${SERVER_URL}/api/candle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ multiplier: value }),
    }).catch(() => {}); // silencia erros de rede

    break;
  }
}

// Tenta capturar a cada 1 segundo
setInterval(tryCapture, 1000);
