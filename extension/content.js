const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";

let lastValue = null;

function capture() {
  const payouts = document.querySelectorAll(".payout");
  if (!payouts.length) return;

  // Pega o texto do primeiro .payout (mais recente)
  const raw = (payouts[0].innerText || payouts[0].textContent || "").trim();
  const clean = raw.replace(/x/gi, "").replace(",", ".").trim();
  const value = parseFloat(clean);

  if (!value || isNaN(value) || value < 1 || value > 10000) return;
  if (value === lastValue) return;

  lastValue = value;

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiplier: value }),
  }).catch(() => {});
}

setInterval(capture, 1000);
