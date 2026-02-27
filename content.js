const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com"; // trocar depois

let lastValue = null;

function capture() {
  const el = document.querySelector(".payout"); // AJUSTAR SELETOR
  if (!el) return;

  const text = el.innerText.replace("x", "").replace(",", ".");
  const value = parseFloat(text);

  if (!value || value === lastValue) return;

  lastValue = value;

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiplier: value })
  });
}

setInterval(capture, 1000);
