{
  "manifest_version": 3,
  "name": "Megatron — Aviator Live Capture",
  "version": "3.0",
  "description": "Captura multiplicadores, cores e rodadas do Aviator em tempo real.",
  "permissions": [
    "activeTab",
    "scripting",
    "alarms",
    "storage"
  ],
  "host_permissions": [
    "https://*.spribegaming.com/*",
    "https://*.sortenabet.bet.br/*",
    "https://*.sortebet.bet.br/*",
    "https://*.aposta.bet.br/*",
    "https://aviator-real-time-dashboard.onrender.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.spribegaming.com/*",
        "https://*.sortenabet.bet.br/*",
        "https://*.sortebet.bet.br/*",
        "https://*.aposta.bet.br/*"
      ],
      "js": ["content.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ]
}
