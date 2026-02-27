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

// 🟢 SERVIR O HTML DO CLIENT
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../client")));

let history = [];

app.post("/api/candle", (req, res) => {
  const { multiplier } = req.body;
  if (!multiplier) return res.sendStatus(400);

  const candle = { multiplier, timestamp: Date.now() };
  history.unshift(candle);
  if (history.length > 200) history.pop();

  io.emit("candle", candle);
  res.sendStatus(200);
});

io.on("connection", (socket) => {
  socket.emit("history", history);
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
