const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";

let lastFirst = null;

function capture() {
  // Pega TODOS os .payout visíveis
  const payouts = document.querySelectorAll(".payout");
  if (!payouts || payouts.length === 0) return;

  // O primeiro elemento é sempre o resultado mais recente
  const first = payouts[0];
  if (!first) return;

  const raw = (first.innerText || first.textContent || "").trim();
  // Remove o "x" e troca vírgula por ponto
  const clean = raw.replace("x", "").replace(",", ".").trim();
  const value = parseFloat(clean);

  if (!value || isNaN(value) || value < 1) return;
  if (value === lastFirst) return; // já enviou esse

  lastFirst = value;

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiplier: value }),
  }).catch(() => {});
}

// Roda a cada 1 segundo
setInterval(capture, 1000);
