# 🧠 MEGATRON — Painel de Velas Aviator

## Estrutura do Projeto

```
megatron/
├── server/
│   ├── server.js        ← Servidor Node.js
│   └── package.json
├── client/
│   └── index.html       ← Painel (copiar para /client na raiz)
└── extension/
    ├── manifest.json
    ├── background.js
    └── content.js
```

---

## 🚀 Deploy no Render.com

1. Suba o repositório no GitHub com esta estrutura:
```
/
├── server/
│   ├── server.js
│   └── package.json
└── client/
    └── index.html
```

2. No Render → **New Web Service**
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Root Directory:** deixar vazio (raiz)

3. O painel ficará disponível em `https://seu-app.onrender.com`

---

## 🔌 Extensão Chrome

1. Abra `chrome://extensions`
2. Ative **Modo desenvolvedor**
3. Clique **Carregar sem compactação**
4. Selecione a pasta `/extension`
5. Abra o Aviator na Sortenabet → a extensão captura automaticamente

### Como funciona a captura de rodadas:
O HTML do jogo contém:
```html
<span class="text-uppercase ng-tns-c45-3"> Rodada 3449963 </span>
```
O content.js captura este número buscando texto com padrão `Rodada XXXXXXX`
e envia junto com o multiplicador e cor RGB ao servidor.

---

## 🔧 Variáveis de ambiente (Render)

Nenhuma obrigatória. A porta é definida automaticamente pelo `process.env.PORT`.

---

## 📡 Endpoints da API

| Método | URL | Descrição |
|--------|-----|-----------|
| POST | `/api/candle` | Recebe vela da extensão |
| GET | `/api/ping` | Keep-alive + contagem online |
| GET | `/health` | Health check Render |

---

## ⚡ Desenvolvedor: Marcos Duarte — Todos os direitos reservados 2026
