import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Armazenamento em memória
let candles = [];
const MAX_CANDLES = 1000;
let onlineUsers = 0;

// Rota de ping para manter o servidor acordado
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'pong', 
    timestamp: new Date().toISOString(),
    candles: candles.length,
    online: onlineUsers
  });
});

// Rota de status
app.get('/api/status', (req, res) => {
  res.json({
    online: onlineUsers,
    candles: candles.length,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Rota para receber velas via HTTP (fallback)
app.post('/api/candle', (req, res) => {
  try {
    const candle = req.body;
    
    // Validação básica
    if (!candle || !candle.multiplier) {
      return res.status(400).json({ error: 'Invalid candle data' });
    }

    // Adiciona timestamp se não veio
    if (!candle.timestamp) {
      candle.timestamp = new Date().toISOString();
    }

    // Adiciona ao histórico
    candles.unshift(candle);
    if (candles.length > MAX_CANDLES) {
      candles.pop();
    }

    // Emite para todos os clientes conectados
    io.emit('candle', candle);

    console.log(`📊 Nova vela: ${candle.multiplier}x | Total: ${candles.length}`);
    
    res.json({ success: true, received: candle });
  } catch (error) {
    console.error('Erro ao processar candle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para histórico
app.get('/api/history', (req, res) => {
  res.json(candles);
});

// Socket.IO
io.on('connection', (socket) => {
  onlineUsers++;
  console.log(`🔌 Cliente conectado. Total: ${onlineUsers}`);

  // Envia histórico para o novo cliente
  socket.emit('history', candles);
  
  // Atualiza contagem para todos
  io.emit('online', onlineUsers);

  socket.on('requestHistory', () => {
    socket.emit('history', candles);
  });

  socket.on('disconnect', () => {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit('online', onlineUsers);
    console.log(`🔌 Cliente desconectado. Total: ${onlineUsers}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
