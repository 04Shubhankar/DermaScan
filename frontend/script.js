const API_URL = "/predict";
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

const lens=$("lens"), img=$("img"), drop=$("drop"), file=$("file"), go=$("go"), err=$("err");
let current=null;

function showErr(m){err.textContent=m;err.hidden=!m}
function setFile(f){
  showErr("");
  if(!f) return;
  if(!/^image\/(jpeg|png)$/.test(f.type)) return showErr("Unsupported file. Upload a JPG or PNG image.");
  if(f.size>5*1024*1024) return showErr("File is larger than 5 MB. Choose a smaller image.");
  current=f;
  img.src=URL.createObjectURL(f); img.hidden=false; drop.hidden=true;
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
};
file.onchange=()=>setFile(file.files[0]);
["dragenter","dragover"].forEach(e=>lens.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("over")}));
["dragleave","drop"].forEach(e=>lens.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("over")}));
lens.addEventListener("drop",ev=>setFile(ev.dataTransfer.files[0]));

go.onclick=async()=>{
  if(!current) return;
  go.disabled=true; lens.classList.add("busy"); showErr("");
  try{
    render(await callApi(current));
  }catch(e){ showErr(e.message || "Analysis failed. Check your connection and try again.") }
  lens.classList.remove("busy"); go.disabled=false;
};

async function callApi(f){
  const fd=new FormData(); fd.append("file",f);
  const res=await fetch(API_URL,{method:"POST",body:fd});
  let payload;
  try {
    payload=await res.json();
  } catch {
    throw new Error("The prediction service returned an invalid response.");
  }
  if(!res.ok) throw new Error(payload.error || `Analysis failed (${res.status}).`);
  if(!Array.isArray(payload.predictions)) throw new Error("The prediction service returned no predictions.");
  const probabilities=Object.fromEntries(payload.predictions
    .filter(result=>CLASSES[result.code] && Number.isFinite(result.probability))
    .map(result=>[result.code,result.probability]));
  if(!Object.keys(probabilities).length) throw new Error("The prediction service returned unsupported results.");
  return probabilities;
}

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
