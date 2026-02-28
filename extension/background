// ═══════════════════════════════════════════════
//  Aviator Live Capture — background.js v2.0
//  Service Worker: mantém a extensão ativa
//  mesmo com a aba do Aviator minimizada
// ═══════════════════════════════════════════════

const SERVER_URL = "https://aviator-real-time-dashboard.onrender.com";

// ── Cria alarme recorrente ao instalar ──
chrome.runtime.onInstalled.addListener(() => {
  // Alarme a cada 1 minuto para manter o service worker vivo
  chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
  // Alarme para ping no servidor a cada 4 minutos (evita Render dormir)
  chrome.alarms.create("serverPing", { periodInMinutes: 4 });
  console.log("[BG] Alarmes criados.");
});

// ── Reativa alarmes se o SW reiniciar ──
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("keepAlive",   { periodInMinutes: 1 });
  chrome.alarms.create("serverPing",  { periodInMinutes: 4 });
});

// ── Handler dos alarmes ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // Acorda o service worker — apenas loga para manter ativo
    console.log("[BG] KeepAlive tick:", new Date().toLocaleTimeString());
  }

  if (alarm.name === "serverPing") {
    // Ping no servidor para evitar que o Render.com "durma"
    fetch(`${SERVER_URL}/api/ping`)
      .then(r => console.log("[BG] Ping servidor:", r.status))
      .catch(() => {});
  }
});

// ── Injeta o content script em abas do Aviator que já estão abertas ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AVIATOR_PING") {
    sendResponse({ alive: true });
  }
});
