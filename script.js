// Elements
const bgm = document.getElementById("bgm");
const btnArm = document.getElementById("btnArm");
const btnMic = document.getElementById("btnMic");
const btnBlow = document.getElementById("btnBlow");
const btnReset = document.getElementById("btnReset");

const cakeWrap = document.getElementById("cakeWrap");
const smokeLayer = document.getElementById("smokeLayer");
let toastMsg = document.getElementById("toastMsg");

// Segment
const SEG_START = 42;
const SEG_END = 277;

const SMOKE_POINTS = [
  { x: 36.4, y: 16.0 },
  { x: 46.4, y: 16.0 },
  { x: 51.8, y: 16.0 },
  { x: 61.3, y: 16.0 },
];

// Audio state
let audioReady = false;
let audioLoading = false;
let segmentTimer = null;

// UX state
let toastShownOnce = false;
let blowLocked = false;

// Mic
let micEnabled = false;
let micCtx = null;
let micAnalyser = null;
let micStream = null;
let micRAF = null;

// Beat
let beatCtx = null;
let beatAnalyser = null;
let beatData = null;
let beatRAF = null;

// timers
let smokeTimer = null;
let toastEndTimer = null;

// initial
cakeWrap.classList.remove("blowMoment","showToast","showWish","toastZoom","beatToast","beatWish");
cakeWrap.style.setProperty("--pulse","0");

function haptic(){
  if(navigator.vibrate) navigator.vibrate([25,35,25]);
}

//////////////////////////////////////////////////////////
// ⭐ ARM AUDIO (MOBILE SAFE)
//////////////////////////////////////////////////////////

btnArm.addEventListener("click", async ()=>{
  if(audioReady || audioLoading) return;

  try{
    audioLoading = true;
    btnArm.textContent = "Loading Audio...";

    bgm.load();

    await new Promise((resolve,reject)=>{
      const ok = ()=> resolve();
      const fail = ()=> reject();

      bgm.addEventListener("canplaythrough", ok, {once:true});
      bgm.addEventListener("error", fail, {once:true});
    });

    // unlock mobile audio
    await bgm.play();
    bgm.pause();
    bgm.currentTime = 0;

    audioReady = true;
    btnArm.textContent = "Audio Armed";
    btnArm.disabled = true;

  }catch(e){
    console.error(e);
    alert("Audio load failed. Try refresh once.");
    btnArm.textContent = "Arm Audio";
  }
});

//////////////////////////////////////////////////////////
// ⭐ PLAY SEGMENT ONCE (MOBILE SAFE TIMER)
//////////////////////////////////////////////////////////

function playSegment(){

  if(!audioReady){
    alert("Tap Arm Audio first");
    return;
  }

  if(segmentTimer){
    clearTimeout(segmentTimer);
    segmentTimer = null;
  }

  bgm.pause();
  bgm.currentTime = SEG_START;

  bgm.play().catch(()=>{});

  const duration = (SEG_END - SEG_START) * 1000;

  segmentTimer = setTimeout(()=>{
    bgm.pause();
  }, duration);
}

//////////////////////////////////////////////////////////
// Smoke
//////////////////////////////////////////////////////////

function spawnSmoke(){
  smokeLayer.innerHTML="";
  SMOKE_POINTS.forEach((p,idx)=>{
    for(let i=0;i<7;i++){
      const puff=document.createElement("div");
      puff.className="smokePuff";
      puff.style.setProperty("--x",`${p.x}%`);
      puff.style.setProperty("--y",`${p.y}%`);
      puff.style.setProperty("--dx",`${(Math.random()*140-70)}px`);
      puff.style.setProperty("--dy",`${(Math.random()*40-20)}px`);
      puff.style.setProperty("--s",`${(14+Math.random()*16)}px`);
      smokeLayer.appendChild(puff);
      setTimeout(()=>puff.remove(),3200);
    }
  });
}

//////////////////////////////////////////////////////////
// Beat Pulse
//////////////////////////////////////////////////////////

function ensureBeat(){
  if(beatAnalyser) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  beatCtx = new Ctx();

  const src = beatCtx.createMediaElementSource(bgm);

  beatAnalyser = beatCtx.createAnalyser();
  beatAnalyser.fftSize = 1024;

  src.connect(beatAnalyser);
  beatAnalyser.connect(beatCtx.destination);

  beatData = new Uint8Array(beatAnalyser.frequencyBinCount);
}

function startBeat(mode){
  ensureBeat();
  if(!beatCtx) return;

  if(beatCtx.state==="suspended") beatCtx.resume();

  cakeWrap.classList.toggle("beatToast",mode==="toast");
  cakeWrap.classList.toggle("beatWish",mode==="wish");

  if(beatRAF) return;

  const loop=()=>{
    beatRAF=requestAnimationFrame(loop);
    beatAnalyser.getByteFrequencyData(beatData);

    let sum=0;
    for(let i=0;i<beatData.length*0.15;i++){
      sum+=beatData[i];
    }

    const pulse=Math.min(1,sum/5000);
    cakeWrap.style.setProperty("--pulse",pulse.toFixed(3));
  };

  loop();
}

function stopBeat(){
  if(beatRAF) cancelAnimationFrame(beatRAF);
  beatRAF=null;
  cakeWrap.classList.remove("beatToast","beatWish");
  cakeWrap.style.setProperty("--pulse","0");
}

//////////////////////////////////////////////////////////
// ⭐ MAIN MOMENT
//////////////////////////////////////////////////////////

function triggerBlowMoment(){

  if(blowLocked) return;
  blowLocked=true;
  setTimeout(()=>blowLocked=false,900);

  cakeWrap.classList.add("blowMoment");
  haptic();

  playSegment();

  clearTimeout(smokeTimer);
  smokeTimer=setTimeout(spawnSmoke,250);

  if(toastShownOnce){
    cakeWrap.classList.add("showWish");
    startBeat("wish");
    return;
  }

  toastShownOnce=true;

  cakeWrap.classList.add("showToast");
  startBeat("toast");

  toastEndTimer=setTimeout(()=>{
    cakeWrap.classList.remove("showToast");

    if(toastMsg && toastMsg.parentNode){
      toastMsg.remove();
      toastMsg=null;
    }

    cakeWrap.classList.add("showWish");
    startBeat("wish");

  },6000);
}

//////////////////////////////////////////////////////////
// Reset
//////////////////////////////////////////////////////////

function resetMoment(){
  cakeWrap.classList.remove("blowMoment","showToast","showWish","toastZoom");
  smokeLayer.innerHTML="";
  clearTimeout(smokeTimer);
  clearTimeout(toastEndTimer);

  bgm.pause();
  bgm.currentTime = SEG_START;

  stopBeat();
}

btnBlow.addEventListener("click",triggerBlowMoment);
btnReset.addEventListener("click",resetMoment);

//////////////////////////////////////////////////////////
// MIC (unchanged good code)
//////////////////////////////////////////////////////////

btnMic.addEventListener("click", async ()=>{
  try{
    if(!micEnabled){
      await enableMic();
      micEnabled=true;
      btnMic.textContent="Blow Enabled";
    }else{
      disableMic();
      micEnabled=false;
      btnMic.textContent="Enable Blow";
    }
  }catch(e){
    console.error(e);
    alert("Mic failed");
  }
});

async function enableMic(){

  micStream = await navigator.mediaDevices.getUserMedia({audio:true});

  const Ctx = window.AudioContext || window.webkitAudioContext;
  micCtx = new Ctx();

  if(micCtx.state==="suspended") await micCtx.resume();

  const src = micCtx.createMediaStreamSource(micStream);

  micAnalyser = micCtx.createAnalyser();
  micAnalyser.fftSize=2048;

  src.connect(micAnalyser);

  listenForBlow();
}

function disableMic(){
  if(micRAF) cancelAnimationFrame(micRAF);
  micStream?.getTracks().forEach(t=>t.stop());
}

function listenForBlow(){

  const data=new Uint8Array(micAnalyser.fftSize);

  let score=0;
  let last=0;

  const loop=()=>{
    micRAF=requestAnimationFrame(loop);

    micAnalyser.getByteTimeDomainData(data);

    let sum=0;
    for(let i=0;i<data.length;i++){
      const v=(data[i]-128)/128;
      sum+=v*v;
    }

    const rms=Math.sqrt(sum/data.length);

    if(rms>0.08) score=Math.min(1,score+0.08);
    else score=Math.max(0,score-0.03);

    if(score>0.75 && performance.now()-last>1500){
      last=performance.now();
      score=0;
      triggerBlowMoment();
    }
  };

  loop();
}
