(function(){
const SERVER="https://aviator-real-time-dashboard.onrender.com";
let lastRound=null;
let peak=1;
let prev=null;

function getMultiplier(){
  const els=document.querySelectorAll("div,span");
  for(let el of els){
    const t=el.innerText.trim();
    if(/^\d+\.\d{2}x?$/.test(t)){
      let v=parseFloat(t.replace("x",""));
      if(v>=1&&v<10000) return v;
    }
  }
  return null;
}

function getRound(){
  const els=document.querySelectorAll("span,div");
  for(let el of els){
    const txt=el.innerText;
    if(txt&&txt.includes("Rodada")){
      const m=txt.match(/(\d{5,})/);
      if(m) return m[1];
    }
  }
  return null;
}

async function send(mult,round){
  try{
    await fetch(SERVER+"/api/candle",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({multiplier:mult,round:round})
    });
    try{chrome.runtime.sendMessage({type:"CANDLE_CAPTURED",data:{multiplier:mult,round:round}});}catch(_){}
  }catch(e){console.log("[MEGATRON] erro envio",e.message);}
}

function loop(){
  const mult=getMultiplier();
  const round=getRound();
  if(round) lastRound=round;
  if(mult){
    if(mult>peak) peak=mult;
    if(prev&&mult<=1.05&&prev>1.05){
      send(parseFloat(peak.toFixed(2)),lastRound);
      peak=1;
    }
    prev=mult;
  }
  setTimeout(loop,800);
}

setTimeout(loop,4000);
console.log("[MEGATRON] content.js carregado em:",window.location.href);
})();
