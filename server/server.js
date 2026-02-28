import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Serve o painel.html da mesma pasta
app.use(express.static(__dirname));

let history = [];

// PING — evita Render.com dormir
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// CANDLE — recebe multiplicador + cor RGB da extensão
app.post("/api/candle", (req, res) => {
  const { multiplier, color_rgb } = req.body;
  if (!multiplier) return res.sendStatus(400);
  const candle = { multiplier, color_rgb: color_rgb || null, timestamp: Date.now() };
  history.unshift(candle);
  if (history.length > 200) history.pop();
  io.emit("candle", candle);
  res.sendStatus(200);
});

// LOGIN
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.json({ ok: false, msg: "Preencha email e senha." });
  res.json({ ok: true, msg: "Conectado! Aguardando velas do Aviator..." });
});

// SOCKET.IO
io.on("connection", (socket) => {
  socket.emit("history", history);
  socket.emit("status", { connected: true, source: "Aviator — Sortenabet" });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
