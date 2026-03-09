// ═══════════════════════════════════════════════
//  MEGATRON — server.js v5.1 FINAL
//  CommonJS (Render-safe), persistência em disco
// ═══════════════════════════════════════════════
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST','OPTIONS'], credentials: true },
  transports: ['polling','websocket']
});

app.use(cors());
app.use(express.json());

// ── Serve client ──
const CLIENT_PATHS = [
  path.join(__dirname, '..', 'client'),
  path.join(__dirname, 'client'),
  path.join(__dirname, 'public'),
  __dirname
];
var CLIENT_DIR = __dirname;
for (var i = 0; i < CLIENT_PATHS.length; i++) {
  var p = CLIENT_PATHS[i];
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) { CLIENT_DIR = p; break; }
}
console.log('[Server] Servindo cliente de:', CLIENT_DIR);
app.use(express.static(CLIENT_DIR));
app.get('/', function(req, res) {
  var idx = path.join(CLIENT_DIR, 'index.html');
  if (fs.existsSync(idx)) return res.sendFile(idx);
  res.send('<h2>MEGATRON online</h2><a href="/api/status">status</a>');
});

// ── Histórico em memória + disco ──
const HIST_FILE = path.join(__dirname, 'history_cache.json');
const MAX_HIST  = 1000;
var candles     = [];
var onlineUsers = 0;

try {
  if (fs.existsSync(HIST_FILE)) {
    var raw = JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
    if (Array.isArray(raw) && raw.length > 0) {
      candles = raw;
      console.log('[History] ' + candles.length + ' velas carregadas do disco');
    }
  }
} catch(e) { console.warn('[History] Erro ao carregar:', e.message); }

function salvar() {
  try { fs.writeFileSync(HIST_FILE, JSON.stringify(candles), 'utf8'); }
  catch(e) { console.warn('[History] Erro ao salvar:', e.message); }
}

// ── Health ──
app.get('/health',  function(req, res) { res.send('OK'); });
app.get('/healthz', function(req, res) { res.send('OK'); });

// ── Ping ──
app.get('/api/ping', function(req, res) {
  res.json({ status:'ok', message:'pong', timestamp: new Date().toISOString(), candles: candles.length, online: onlineUsers, uptime: process.uptime() });
});

// ── Status ──
app.get('/api/status', function(req, res) {
  res.json({ online: onlineUsers, candles: candles.length, lastCandle: candles[0]||null, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ── Debug ──
app.get('/api/debug', function(req, res) {
  res.json({ ok:true, total: candles.length, ultimas: candles.slice(0,5), online: onlineUsers });
});

// ── Histórico ──
app.get('/api/history', function(req, res) { res.json(candles); });

// ── Limpar ──
app.delete('/api/history', function(req, res) {
  candles = []; salvar();
  res.json({ ok:true, msg:'Histórico limpo' });
});

// ── Vela de teste ──
app.get('/api/test-candle', function(req, res) {
  var mult = parseFloat(req.query.mult || '2.50');
  var now  = new Date().toISOString();
  var c = { multiplier: mult, color_rgb: null, round: 'TEST'+Date.now(), timestamp: now };
  candles.unshift(c);
  if (candles.length > MAX_HIST) candles.pop();
  salvar();
  io.emit('candle', c);
  console.log('[TEST] Vela injetada: '+mult+'x');
  res.json({ ok:true, candle:c });
});

// ── Recebe vela da extensão ──
app.post('/api/candle', function(req, res) {
  try {
    var candle = req.body;
    if (!candle || !candle.multiplier)
      return res.status(400).json({ error: 'multiplier required' });

    candle.multiplier = parseFloat(parseFloat(candle.multiplier).toFixed(2));
    if (isNaN(candle.multiplier) || candle.multiplier < 1)
      return res.status(400).json({ error: 'multiplier invalido' });

    if (!candle.timestamp) candle.timestamp = new Date().toISOString();

    // Anti-duplicata: mesma rodada ou mesmo mult nos últimos 8s
    if (candles.length > 0) {
      var ult = candles[0];
      var tsUlt = new Date(ult.timestamp).getTime();
      var mesmaRodada = candle.round && ult.round && String(ult.round) === String(candle.round);
      var mesmoMult   = Math.abs(ult.multiplier - candle.multiplier) < 0.01;
      var recente     = (Date.now() - tsUlt) < 8000;
      if ((mesmaRodada || mesmoMult) && recente) {
        console.log('[Candle] Duplicata bloqueada: '+candle.multiplier+'x rodada='+candle.round);
        return res.sendStatus(200);
      }
    }

    candles.unshift(candle);
    if (candles.length > MAX_HIST) candles.pop();
    salvar();

    io.emit('candle', candle);
    console.log('[Candle] ✅ '+candle.multiplier+'x | round='+candle.round+' | total='+candles.length);
    res.json({ success:true, received: candle, total: candles.length });

  } catch(err) {
    console.error('[Candle] Erro:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── Socket.IO ──
io.on('connection', function(socket) {
  onlineUsers++;
  io.emit('online', onlineUsers);
  console.log('[Socket] +'+socket.id+' | Online:'+onlineUsers+' | Velas:'+candles.length);

  socket.emit('history', candles);
  socket.emit('status', { connected:true, online:onlineUsers, candles:candles.length });

  socket.on('requestHistory', function() {
    socket.emit('history', candles);
  });
  socket.on('requestStatus', function() {
    socket.emit('status', { online:onlineUsers, candles:candles.length });
  });
  socket.on('disconnect', function(reason) {
    onlineUsers = Math.max(0, onlineUsers - 1);
    io.emit('online', onlineUsers);
    console.log('[Socket] -'+socket.id+' | '+reason);
  });
});

// Backup a cada 5min
setInterval(salvar, 5 * 60 * 1000);

// Heartbeat log
setInterval(function() {
  console.log('💓 Online:'+onlineUsers+' | Velas:'+candles.length);
}, 5 * 60 * 1000);

var PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', function() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  🚀 MEGATRON SERVER v5.1             ║');
  console.log('║  📡 Porta: '+PORT+'                       ║');
  console.log('║  📊 Velas: '+candles.length+'                        ║');
  console.log('╚══════════════════════════════════════╝\n');
});
