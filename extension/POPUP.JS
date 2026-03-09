document.getElementById('abrirPainel').onclick = () => {
  chrome.tabs.create({ url: 'https://aviator-real-time-dashboard.onrender.com' });
};

document.getElementById('testar').onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "TEST_CAPTURE" }, (response) => {
      alert(response ? response.status : 'Falha no teste');
    });
  });
};

// Verifica status do servidor
fetch('https://aviator-real-time-dashboard.onrender.com/api/ping')
  .then(r => r.json())
  .then(d => {
    document.getElementById('servidor').textContent = 'Online';
    document.getElementById('servidor').style.color = '#00e676';
  })
  .catch(() => {
    document.getElementById('servidor').textContent = 'Offline';
    document.getElementById('servidor').style.color = '#ff1744';
  });

// Escuta mensagens do background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CANDLE_CAPTURED") {
    document.getElementById('ultima').textContent = 
      msg.data.multiplier.toFixed(2) + 'x';
  }
});
