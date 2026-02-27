# Aviator Real-Time Dashboard

Painel em tempo real para visualizar os multiplicadores do jogo Aviator.

## Funcionalidades

- Captura multiplicadores visíveis no navegador via extensão
- Envia dados para backend Node.js no Render
- Painel HTML atualizado em tempo real com WebSocket
- Sem armazenar senha ou login automático

## Estrutura do Projeto

aviator-real-time-dashboard
│
├── server
│   ├── server.js
│   └── package.json
│
├── client
│   └── index.html
│
├── extension
│   ├── manifest.json
│   └── content.js
│
├── README.md
├── LICENSE
└── .gitignore



## Como usar

1. Subir backend no Render
2. Instalar extensão no Chrome
3. Abrir painel HTML e visualizar os dados em tempo real
