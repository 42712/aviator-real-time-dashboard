import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// Serve o painel HTML
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../client")));

let history = [];

// Recebe multiplicador da extensão
app.post("/api/candle", (req, res) => {
  const { multiplier } = req.body;
  if (!multiplier) return res.sendStatus(400);

  const candle = { multiplier, timestamp: Date.now() };
  history.unshift(candle);
  if (history.length > 200) history.pop();

  io.emit("candle", candle);
  res.sendStatus(200);
});

// Rota de login (valida e responde ok)
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ ok: false, msg: "Preencha email e senha." });
  }
  // Aqui apenas confirma login — a extensão que captura os dados reais
  res.json({ ok: true, msg: "Conectado! Aguardando velas do Aviator..." });
});

// Envia histórico ao conectar
io.on("connection", (socket) => {
  socket.emit("history", history);
  socket.emit("status", { connected: true, source: "Aviator — Sortenabet" });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
