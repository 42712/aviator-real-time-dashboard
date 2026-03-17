import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] },
  transports: ["polling", "websocket"],
  pingTimeout: 30000,
  pingInterval: 10000,
  allowEIO3: true
});

app.use(cors({ origin: "*" }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CLIENT = path.join(__dirname, "..", "client");
app.use(express.static(CLIENT));
app.get("/", (req, res) => res.sendFile(path.join(CLIENT, "index.html")));

// ── Estado global ──
let history     = [];   // até 200 velas fechadas
let onlineUsers = 0;
let multAtual   = 1.0;  // multiplicador em tempo real
let emJogo      = false;

// ── Health / Ping ──
app.get("/healthz", (req, res) => res.status(200).send("OK"));
app.get("/health",  (req, res) => res.status(200).send("OK"));
app.get("/api/ping",(req, res) => res.status(200).json({ ok:true, ts:Date.now(), online:onlineUsers }));

// ── Vela fechada ──
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
  if (history.length > 200) history.pop();

  emJogo   = false;
  multAtual = candle.multiplier;

  io.emit("candle", candle);
  console.log(`[Candle] ${candle.multiplier}x | round=${candle.round}`);
  res.sendStatus(200);
});

// ── Multiplicador em tempo real ──
app.post("/api/mult", (req, res) => {
  const { mult, ts } = req.body;
  if (!mult || isNaN(parseFloat(mult))) return res.sendStatus(400);

  multAtual = parseFloat(mult);
  emJogo    = true;

  // Emite para todos os clientes conectados
  io.emit("mult_rt", { mult: multAtual, ts: ts || Date.now() });
  res.sendStatus(200);
});

// ── Início de nova rodada (para cronômetro) ──
app.post("/api/round_start", (req, res) => {
  const { round, ts } = req.body;
  emJogo    = true;
  multAtual = 1.0;

  io.emit("round_start", { round: round || null, ts: ts || Date.now() });
  console.log(`[RoundStart] rodada=${round}`);
  res.sendStatus(200);
});

// ── Login simples ──
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.json({ ok: false, msg: "Preencha email e senha." });
  res.json({ ok: true, msg: "Conectado! Aguardando velas do Aviator..." });
});

// ── Socket.io ──
io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online", onlineUsers);
  console.log(`[Socket] Conectado: ${socket.id} | Online: ${onlineUsers}`);

  socket.emit("history", history);
  socket.emit("status", { connected: true, source: "Aviator — Sortenabet", online: onlineUsers });

  // Envia estado atual do multiplicador ao conectar
  socket.emit("mult_rt", { mult: multAtual, ts: Date.now(), emJogo });

  socket.on("requestHistory", () => socket.emit("history", history));

  socket.on("disconnect", () => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit("online", onlineUsers);
    console.log(`[Socket] Desconectado: ${socket.id} | Online: ${onlineUsers}`);
  });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`[MEGATRON] Servidor v4 rodando na porta ${PORT}`);
});
