(function () {

const SERVER = "https://aviator-real-time-dashboard.onrender.com";

let prevMultiplier = null;
let peakMultiplier = 1;
let lastRound = null;

function getMultiplier(){

 const els = document.querySelectorAll("div,span");

 for(let el of els){

  const txt = el.innerText.trim();

  if(/^\d{1,4}\.\d{2}x?$/.test(txt)){

   let v = parseFloat(txt.replace("x",""));

   if(v >= 1 && v < 100000){
    return v;
   }

  }

 }

 return null;

}

function getRound(){

 const els = document.querySelectorAll("span,div");

 for(let el of els){

  const txt = el.innerText.trim();

  const m = txt.match(/Rodada\s*(\d+)/i);

  if(m){
   return m[1];
  }

 }

 return null;

}

function isCrash(){

 if(/(flew away|voou|crash|fim)/i.test(document.body.innerText)){
  return true;
 }

 return false;

}

async function send(mult, round){

 try{

  await fetch(SERVER+"/api/candle",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    multiplier:mult,
    round:round
   })
  });

  console.log("[MEGATRON] enviado",mult,"rodada",round);

  chrome.runtime.sendMessage({
   type:"CANDLE_CAPTURED",
   data:{multiplier:mult,round:round}
  });

 }catch(e){

  console.log("[MEGATRON] erro envio");

 }

}

function loop(){

 const mult = getMultiplier();
 const round = getRound();

 if(round){
  lastRound = round;
 }

 if(mult){

  if(mult > peakMultiplier){
   peakMultiplier = mult;
  }

  if(prevMultiplier){

   if(mult <= 1.05 && prevMultiplier > 1.05){

    send(parseFloat(peakMultiplier.toFixed(2)), lastRound);

    peakMultiplier = 1;

   }

  }

  prevMultiplier = mult;

 }

 setTimeout(loop,500);

}

setTimeout(loop,3000);

console.log("MEGATRON content carregado");

})();
