const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";

let lastValue = null;
let tentativas = 0;

function capture() {
  const payouts = document.querySelectorAll(".payout");
  if (!payouts.length) {
    tentativas++;
    // Log só nas primeiras tentativas para debug
    if (tentativas < 5) {
      console.log("[Aviator] Aguardando .payout... tentativa", tentativas);
    }
    return;
  }

  tentativas = 0;
  const raw = (payouts[0].innerText || payouts[0].textContent || "").trim();
  const clean = raw.replace(/x/gi, "").replace(",", ".").trim();
  const value = parseFloat(clean);

  if (!value || isNaN(value) || value < 1 || value > 10000) return;
  if (value === lastValue) return;

  lastValue = value;
  console.log("[Aviator] ✅ Vela capturada:", value);

  fetch(`${SERVER_URL}/api/candle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiplier: value }),
  })
  .then(r => console.log("[Aviator] Enviado! Status:", r.status))
  .catch(e => console.log("[Aviator] Erro ao enviar:", e));
}

setInterval(capture, 1000);
