// ═══════════════════════════════════════════════
//  Megatron — background.js v4.0
//  Service Worker: mantém ativo + ping servidor
// ═══════════════════════════════════════════════
const SERVER_URL = "https://aviator-real-time-dashboard-1.onrender.com";

function criarAlarmes() {
  chrome.alarms.create("keepAlive",  { periodInMinutes: 0.5 });
  chrome.alarms.create("serverPing", { periodInMinutes: 4 });
}

chrome.runtime.onInstalled.addListener(() => {
  criarAlarmes();
  console.log("[MEGATRON BG] v4.0 instalado.");
});

chrome.runtime.onStartup.addListener(() => {
  criarAlarmes();
  console.log("[MEGATRON BG] Startup — alarmes recriados.");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    console.log("[MEGATRON BG] KeepAlive:", new Date().toLocaleTimeString());
  }
  if (alarm.name === "serverPing") {
    fetch(`${SERVER_URL}/api/ping`)
      .then(r => r.json())
      .then(d => console.log("[MEGATRON BG] Ping OK — online:", d.online))
      .catch(() => console.log("[MEGATRON BG] Ping falhou (servidor dormindo?)"));
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CANDLE_CAPTURED") {
    console.log("[MEGATRON BG] Vela recebida:", msg.data);
    sendResponse({ ok: true });
  }
  if (msg.type === "PING") {
    sendResponse({ alive: true });
  }
  return true;
});
