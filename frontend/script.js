const API_URL = ""; // e.g. "https://your-api.com/predict"
const CLASSES = {
  mel:{n:"Melanoma",r:"high",d:"The most serious skin cancer. Early detection matters, so get any suspicious mole checked promptly."},
  bcc:{n:"Basal cell carcinoma",r:"high",d:"A common, slow-growing skin cancer. Treatable when found early; needs a clinician's review."},
  akiec:{n:"Actinic keratosis / Bowen's disease",r:"moderate",d:"Rough, sun-damaged patches that can progress to cancer if left untreated."},
  nv:{n:"Melanocytic nevus",r:"low",d:"A common benign mole. Watch for changes in size, shape, or color."},
  bkl:{n:"Benign keratosis",r:"low",d:"A harmless growth such as a seborrheic keratosis or solar lentigo."},
  df:{n:"Dermatofibroma",r:"low",d:"A firm, harmless skin nodule, often on the legs."},
  vasc:{n:"Vascular lesion",r:"low",d:"Usually benign growths of blood vessels, such as angiomas."}
};
const RISK = {low:"Low risk",moderate:"Moderate risk",high:"High risk"};
const $ = id => document.getElementById(id);

const lens=$("lens"), img=$("img"), heat=$("heat"), drop=$("drop"), file=$("file"), go=$("go"), err=$("err");
let current=null;

if(!API_URL) $("demo").hidden=false;

function showErr(m){err.textContent=m;err.hidden=!m}
function setFile(f){
  showErr("");
  if(!f) return;
  if(!/^image\/(jpeg|png)$/.test(f.type)) return showErr("Unsupported file. Upload a JPG or PNG image.");
  if(f.size>10*1024*1024) return showErr("File is larger than 10 MB. Choose a smaller image.");
  current=f;
  img.src=URL.createObjectURL(f); img.hidden=false; drop.hidden=true;
  heat.hidden=true; $("sl").classList.remove("on");
  go.disabled=false; $("reset").hidden=false;
  $("res").hidden=true; $("empty").hidden=false;
}
drop.onclick=()=>file.click();
$("reset").onclick=()=>{
  file.value="";
  current=null;
  img.hidden=true;
  drop.hidden=false;
  go.disabled=true;
  $("reset").hidden=true;
  $("res").hidden=true;
  $("empty").hidden=false;
  heat.hidden=true;
  $("sl").classList.remove("on");
};
file.onchange=()=>setFile(file.files[0]);
["dragenter","dragover"].forEach(e=>lens.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(e=>lens.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("over")}));
lens.addEventListener("drop",ev=>setFile(ev.dataTransfer.files[0]));
$("fade").oninput=e=>{heat.style.opacity=e.target.value/100;$("fv").textContent=e.target.value+"%"};

go.onclick=async()=>{
  if(!current) return;
  go.disabled=true; lens.classList.add("busy"); showErr("");
  try{
    const r = API_URL ? await callApi(current) : await simulate();
    render(r);
  }catch(e){ showErr("Analysis failed. Check your connection and try again.") }
  lens.classList.remove("busy"); go.disabled=false;
};

async function callApi(f){
  const fd=new FormData(); fd.append("file",f);
  const res=await fetch(API_URL,{method:"POST",body:fd});
  if(!res.ok) {
    const msg = await res.text();
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  const j=await res.json();
  if(j.gradcam_png){
    try {
      const im=new Image(); im.src=j.gradcam_png; await im.decode();
      const c=heat.getContext("2d"); c.clearRect(0,0,heat.width,heat.height);
      c.drawImage(im,0,0,heat.width,heat.height);
    } catch(e) {
      console.error("Heatmap decode failed", e);
    }
  }
  return j.probabilities;
}

// Demo only: random probabilities + synthetic heatmap
async function simulate(){
  await new Promise(r=>setTimeout(r,1400));
  const ids=Object.keys(CLASSES), prior=[.11,.05,.03,.67,.11,.01,.02];
  let t=Math.random(), top=0; for(let i=0;i<ids.length;i++){t-=prior[i]; if(t<=0){top=i;break}}
  const conf=.45+Math.random()*.47, rest=ids.map(()=>Math.random()**2+.02);
  rest[top]=0; const s=rest.reduce((a,b)=>a+b,0);
  const p={}; ids.forEach((k,i)=>p[k]= i===top?conf:(1-conf)*rest[i]/s);
  drawFakeHeat(); return p;
}
function drawFakeHeat(){
  const n=128, o=document.createElement("canvas"); o.width=o.height=n;
  const x=o.getContext("2d"), d=x.createImageData(n,n);
  const b=[[.5+(Math.random()-.5)*.2,.5+(Math.random()-.5)*.2,.16,1],[Math.random(),Math.random(),.1,.5]];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    let v=0; for(const[cx,cy,s,a]of b){const dx=i/n-cx,dy=j/n-cy;v+=a*Math.exp(-(dx*dx+dy*dy)/(2*s*s))}
    v=Math.min(1,v); const[k,g,bl]=jet(v), q=(j*n+i)*4;
    d.data.set([k,g,bl,v<.12?0:255],q);
  }
  x.putImageData(d,0,0);
  const c=heat.getContext("2d"); c.clearRect(0,0,heat.width,heat.height);
  c.imageSmoothingEnabled=true; c.drawImage(o,0,0,heat.width,heat.height);
}
function jet(v){const f=t=>Math.round(255*Math.max(0,Math.min(1,t)));return[f(1.5-Math.abs(4*v-3)),f(1.5-Math.abs(4*v-2)),f(1.5-Math.abs(4*v-1))]}

function render(p){
  const sorted=Object.entries(p).sort((a,b)=>b[1]-a[1]);
  const [id,conf]=sorted[0], c=CLASSES[id];
  $("pname").textContent=c.n;
  $("pconf").textContent=`Confidence ${(conf*100).toFixed(1)}%`;
  const rk=$("risk"); rk.className="risk "+c.r; rk.lastElementChild.textContent=RISK[c.r];
  $("pnote").textContent=c.d;
  $("lowc").hidden=conf>=.5;
  const ul=$("bars"); ul.innerHTML="";
  sorted.forEach(([k,v],i)=>{
    const li=document.createElement("li"); li.className="bar"+(i?"":" best");
    li.innerHTML='<span></span><div class="t"><div class="f"></div></div><b></b>';
    li.children[0].textContent=CLASSES[k].n; li.children[2].textContent=(v*100).toFixed(1)+"%";
    ul.appendChild(li); requestAnimationFrame(()=>requestAnimationFrame(()=>li.querySelector(".f").style.width=(v*100)+"%"));
  });
  $("empty").hidden=true; $("res").hidden=false;
  heat.hidden=false; heat.style.opacity=$("fade").value/100; $("sl").classList.add("on");
}

// Theme toggle
const themeToggle = document.getElementById("themeToggle");
themeToggle.onclick = () => {
  const root = document.documentElement;
  if (root.dataset.theme === "dark") {
    root.dataset.theme = "light";
    themeToggle.textContent = "🌙 Dark Mode";
  } else {
    root.dataset.theme = "dark";
    themeToggle.textContent = "☀️ Light Mode";
  }
};
