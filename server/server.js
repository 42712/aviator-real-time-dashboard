import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*" },
  transports: ['polling', 'websocket'],
  pingTimeout: 30000,
  pingInterval: 10000
});

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Estrutura: /server/server.js → /client/index.html
const CLIENT = path.join(__dirname, "..", "client");
console.log(`[Server] CLIENT: ${CLIENT}`);

// ── HEALTH CHECK ──
app.get("/healthz", (req, res) => res.status(200).send("OK"));
app.get("/health",  (req, res) => res.status(200).send("OK"));

// ── Arquivos estáticos da pasta /client ──
app.use(express.static(CLIENT));

// ── Rota raiz → /client/index.html ──
app.get("/", (req, res) => {
  res.sendFile(path.join(CLIENT, "index.html"));
});

let history = [];

app.get("/api/ping", (req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

app.post("/api/candle", (req, res) => {
  const { multiplier, color_rgb, round } = req.body;
  if (!multiplier) return res.sendStatus(400);
  const candle = {
    multiplier,
    color_rgb: color_rgb || null,
    round:     round     || null,
    timestamp: Date.now()
  };
  history.unshift(candle);
  if (history.length > 200) history.pop();
  io.emit("candle", candle);
  res.sendStatus(200);
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.json({ ok: false, msg: "Preencha email e senha." });
  res.json({ ok: true, msg: "Conectado! Aguardando velas do Aviator..." });
});

io.on("connection", (socket) => {
  socket.emit("history", history);
  socket.emit("status", { connected: true, source: "Aviator — Sortenabet" });
  socket.on("requestHistory", () => socket.emit("history", history));
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
