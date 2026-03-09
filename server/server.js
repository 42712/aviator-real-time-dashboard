import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

app.use(cors({ origin: "*" }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Serve /client — tenta pasta irmã, senão pasta local ──
// Estrutura esperada no GitHub:
//   /server/server.js   ← este arquivo
//   /client/index.html  ← painel
const CLIENT_PATHS = [
  path.join(__dirname, "..", "client"),   // /client (raiz do repo)
  path.join(__dirname, "client"),         // /server/client
  path.join(__dirname, "public"),         // /server/public
  __dirname                               // fallback: mesma pasta
];

let CLIENT = CLIENT_PATHS[0];
import { existsSync } from "fs";
for (const p of CLIENT_PATHS) {
  if (existsSync(p)) { CLIENT = p; break; }
}
console.log(`[Server] Servindo client em: ${CLIENT}`);

app.use(express.static(CLIENT));
app.get("/", (req, res) => {
  const idx = path.join(CLIENT, "index.html");
  if (existsSync(idx)) return res.sendFile(idx);
  res.send(`<h2>MEGATRON Server OK</h2><p>Coloque o index.html em /client/</p><p><a href="/api/ping">ping</a></p>`);
});

// ── Estado global ──
let history     = [];   // até 1000 velas
let onlineUsers = 0;

// ── Health checks (Render keep-alive) ──
app.get("/healthz", (req, res) => res.status(200).send("OK"));
app.get("/health",  (req, res) => res.status(200).send("OK"));

// ── Ping ──
app.get("/api/ping", (req, res) => {
  res.status(200).json({ ok: true, ts: Date.now(), online: onlineUsers, candles: history.length });
});

// ── Status geral ──
app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    online: onlineUsers,
    candles: history.length,
    last: history[0] || null,
    uptime: process.uptime()
  });
});

// ── Recebe velas da extensão ──
app.post("/api/candle", (req, res) => {
  const { multiplier, color_rgb, round } = req.body;
  if (multiplier === undefined || multiplier === null)
    return res.status(400).json({ error: "multiplier required" });

  const candle = {
    multiplier: parseFloat(multiplier),
    color_rgb:  color_rgb || null,
    round:      round     || null,
    timestamp:  Date.now()
  };

  history.unshift(candle);
  if (history.length > 1000) history.pop();

  // Emite para TODOS os clientes conectados
  io.emit("candle", candle);
  console.log(`[Candle] ${candle.multiplier}x | round=${candle.round} | total=${history.length}`);
  res.sendStatus(200);
});

// ── Login simples ──
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.json({ ok: false, msg: "Preencha email e senha." });
  res.json({ ok: true, msg: "Conectado!" });
});

// ── Socket.io ──
io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online", onlineUsers);
  console.log(`[Socket] +Conectado: ${socket.id} | Online: ${onlineUsers}`);

  // Envia histórico imediatamente ao conectar
  socket.emit("history", history);
  socket.emit("status", {
    connected: true,
    online: onlineUsers,
    candles: history.length
  });

  // Responde pedido manual de histórico
  socket.on("requestHistory", () => {
    console.log(`[Socket] requestHistory de ${socket.id} | ${history.length} velas`);
    socket.emit("history", history);
  });

  socket.on("disconnect", (reason) => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit("online", onlineUsers);
    console.log(`[Socket] -Desconectado: ${socket.id} | motivo: ${reason} | Online: ${onlineUsers}`);
  });

  socket.on("error", (err) => {
    console.warn(`[Socket] Erro ${socket.id}:`, err.message);
  });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[MEGATRON] Servidor na porta ${PORT}`);
  console.log(`[MEGATRON] Client: ${CLIENT}`);
});
