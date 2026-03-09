// ═══════════════════════════════════════════════
//  MEGATRON — server.js v4.0 (CommonJS, Render-safe)
// ═══════════════════════════════════════════════
const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST","OPTIONS"] },
  transports: ["polling", "websocket"],
  pingTimeout:  60000,
  pingInterval: 25000,
  allowEIO3: true
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

// ── Serve /client/index.html ──
const CLIENT_PATHS = [
  path.join(__dirname, "..", "client"),
  path.join(__dirname, "client"),
  path.join(__dirname, "public"),
  __dirname
];
let CLIENT_DIR = __dirname;
for (const p of CLIENT_PATHS) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
    CLIENT_DIR = p;
    break;
  }
}
console.log("[Server] Servindo cliente de:", CLIENT_DIR);
app.use(express.static(CLIENT_DIR));
app.get("/", (req, res) => {
  const idx = path.join(CLIENT_DIR, "index.html");
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.send("<h2>MEGATRON online</h2><a href='/api/status'>status</a>");
});

// ── Histórico em memória + backup em disco ──
const HIST_FILE = path.join(__dirname, "history_cache.json");
const MAX_HIST  = 1000;
let history = [];

try {
  if (fs.existsSync(HIST_FILE)) {
    const raw = JSON.parse(fs.readFileSync(HIST_FILE, "utf8"));
    if (Array.isArray(raw) && raw.length > 0) {
      history = raw;
      console.log(`[History] ${history.length} velas carregadas do disco`);
    }
  }
} catch(e) { console.warn("[History] Erro ao carregar:", e.message); }

function salvar() {
  try { fs.writeFileSync(HIST_FILE, JSON.stringify(history), "utf8"); }
  catch(e) { console.warn("[History] Erro ao salvar:", e.message); }
}

let onlineUsers = 0;

// ── Rotas de saúde ──
app.get("/health",  (req, res) => res.send("OK"));
app.get("/healthz", (req, res) => res.send("OK"));

app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: Date.now(), online: onlineUsers, candles: history.length });
});

app.get("/api/status", (req, res) => {
  res.json({
    ok:      true,
    online:  onlineUsers,
    candles: history.length,
    last:    history[0] || null,
    uptime:  Math.round(process.uptime()),
    hist:    fs.existsSync(HIST_FILE) ? "ok" : "nao existe"
  });
});

// ── Rota de diagnóstico (mostra últimas 5 velas) ──
app.get("/api/debug", (req, res) => {
  res.json({
    ok:      true,
    total:   history.length,
    ultimas: history.slice(0, 5),
    online:  onlineUsers,
    uptime:  Math.round(process.uptime()) + "s"
  });
});

// ── Limpar histórico ──
app.delete("/api/history", (req, res) => {
  history = []; salvar();
  res.json({ ok: true, msg: "Histórico limpo" });
});

// ── Recebe velas da extensão ──
app.post("/api/candle", (req, res) => {
  const { multiplier, color_rgb, round } = req.body || {};

  if (multiplier === undefined || multiplier === null)
    return res.status(400).json({ error: "multiplier required" });

  const mult = parseFloat(parseFloat(multiplier).toFixed(2));
  if (isNaN(mult) || mult < 1)
    return res.status(400).json({ error: "multiplier invalido: " + multiplier });

  // Anti-duplicata: mesma rodada nos últimos 4s
  if (history.length > 0) {
    const ult = history[0];
    const mesmaRodada = round && ult.round && String(ult.round) === String(round);
    const recente = (Date.now() - ult.timestamp) < 4000;
    if (mesmaRodada && recente) {
      console.log(`[Candle] Duplicata ignorada: ${mult}x rodada=${round}`);
      return res.sendStatus(200);
    }
  }

  const candle = {
    multiplier: mult,
    color_rgb:  color_rgb || null,
    round:      round     || null,
    timestamp:  Date.now()
  };

  history.unshift(candle);
  if (history.length > MAX_HIST) history.pop();
  salvar();

  io.emit("candle", candle);
  console.log(`[Candle] ✅ ${mult}x | round=${round} | total=${history.length}`);
  res.sendStatus(200);
});

// ── Rota de teste — injeta vela manual (debug) ──
app.get("/api/test-candle", (req, res) => {
  const mult = parseFloat(req.query.mult || "2.50");
  const candle = { multiplier: mult, color_rgb: null, round: "TEST" + Date.now(), timestamp: Date.now() };
  history.unshift(candle);
  if (history.length > MAX_HIST) history.pop();
  io.emit("candle", candle);
  console.log(`[TEST] Vela injetada: ${mult}x`);
  res.json({ ok: true, candle });
});

// ── Socket.IO ──
io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("online", onlineUsers);
  console.log(`[Socket] +${socket.id} | Online:${onlineUsers} | Velas:${history.length}`);

  // Envia histórico imediatamente
  socket.emit("history", history);
  socket.emit("status", { connected: true, online: onlineUsers, candles: history.length });

  socket.on("requestHistory", () => {
    console.log(`[Socket] requestHistory de ${socket.id} — enviando ${history.length} velas`);
    socket.emit("history", history);
  });

  socket.on("disconnect", (reason) => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit("online", onlineUsers);
    console.log(`[Socket] -${socket.id} | ${reason} | Online:${onlineUsers}`);
  });
});

// Backup a cada 5 min
setInterval(salvar, 5 * 60 * 1000);

const PORT = process.env.PORT || 3333;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[MEGATRON] ✅ Porta ${PORT} | ${history.length} velas no histórico`);
});
