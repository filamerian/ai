const C=["#6fffe9","#55b7ff","#9a7cff","#ff63c5","#ff6f61","#ffdb6e"],PAT=["full","diamond","checker","waves","fortress","cross"];
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),$=id=>document.getElementById(id);
let W=900,H=600,dpr=1,last=0,state="menu",paused=false,counting=false,score=0,level=1,lives=3,combo=1,best=+localStorage.getItem("nbBest")||0,shake=0;
let paddle=null,balls=[],blocks=[],powerups=[],parts=[],keys={},audioCtx=null,active={};
function resize(){let r=canvas.getBoundingClientRect();W=Math.max(320,r.width);H=Math.max(300,r.height);dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(paddle){paddle.y=H-44;paddle.w=Math.min(paddle.base,W*.34);paddle.x=Math.max(0,Math.min(W-paddle.w,paddle.x));paddle.target=Math.max(paddle.w/2,Math.min(W-paddle.w/2,paddle.target))}}
new ResizeObserver(resize).observe(canvas);
function fmt(n){return String(Math.floor(Math.max(0,n))).padStart(6,"0")}function hud(){$("score").textContent=fmt(score);$("best").textContent=fmt(best);$("level").textContent=String(level).padStart(2,"0");$("lives").textContent=String(lives).padStart(2,"0");$("combo").textContent="x"+combo}
function audio(){if(!audioCtx)try{audioCtx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}if(audioCtx?.state==="suspended")audioCtx.resume()}function beep(f=440,d=.06,t="sine",v=.025){if(!audioCtx)return;let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=t;o.frequency.value=f;g.gain.value=v;g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}
function toast(t,c="#6fffe9"){
  let e=$("toast");
  e.textContent=t;
  e.style.color=c;
  e.classList.remove("show");
  void e.offsetWidth;
  e.classList.add("show");
  clearTimeout(e.t);
  e.t=setTimeout(()=>e.classList.remove("show"),1100);
}
function banner(t){
  let e=$("levelBanner");
  e.textContent=t;
  e.classList.remove("show");
  void e.offsetWidth;
  e.classList.add("show");
}
function renderActive(){const e=$("activePowerups");const labels={wide:"WIDE",multi:"MULTI x3",fire:"FIREBALL",slow:"SLOW",magnet:"MAGNET"};e.innerHTML=Object.keys(active).filter(k=>active[k]).map(k=>`<span class="power-pill ${k}">${labels[k]}</span>`).join("")}
function cell(r,c,R,Cn,p){let x=(Cn-1)/2,y=(R-1)/2,d=Math.abs(c-x)+Math.abs(r-y);return p==="full"||p==="diamond"&&d<=Math.min(x,y)+.25||p==="checker"&&((r+c)%2===0||r===0)||p==="waves"&&Math.sin(c*.9+r*.9)>-.25||p==="fortress"&&(r===0||r===R-1||c===0||c===Cn-1||Math.abs(c-x)<1.2)||p==="cross"&&(r===Math.floor(R/2)||c===Math.floor(Cn/2)||d<2.1)}
function makeLevel(){blocks=[];let cols=Math.min(11,Math.max(6,Math.floor(W/84))),rows=Math.min(8,3+Math.floor((level-1)/2)),gap=7,bw=Math.min(78,(W-40-gap*(cols-1))/cols),side=(W-cols*bw-(cols-1)*gap)/2,bh=23,p=PAT[(level-1)%PAT.length];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(cell(r,c,rows,cols,p)){let type="normal",hp=1;if(level>=2&&r<2&&Math.random()<.3){type="armored";hp=2}if(level>=3&&Math.random()<.1)type="explosive";if(level>=4&&(r+c)%5===0&&Math.random()<.55)type="steel";if(level>=5&&Math.random()<.08)type="bonus";blocks.push({x:side+c*(bw+gap),y:42+r*(bh+gap),w:bw,h:bh,hp,max:hp,type,color:C[r%C.length],alive:true})}}
function resetBall(){let s=Math.min(700,335+level*25),a=-Math.PI/2+(Math.random()-.5)*.9;balls=[{x:W/2,y:H-80,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:7,trail:[],fire:false}]}
function particles(x,y,c,n=12){for(let i=0;i<n;i++){let a=Math.random()*6.28,s=50+Math.random()*180;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.5+Math.random()*.5,max:1,r:1+Math.random()*3,c})}}
function addScore(v){score+=v*combo;if(score>best){best=score;localStorage.setItem("nbBest",best)}combo=Math.min(20,combo+1);hud()}
function circleHit(a,b){let x=Math.max(a.x,Math.min(b.x,a.x+a.w)),y=Math.max(a.y,Math.min(b.y,a.y+a.h)),dx=b.x-x,dy=b.y-y;return dx*dx+dy*dy<b.r*b.r}
function destroy(bl,b){if(bl.type==="steel"&&!b.fire){b.vy*=-1;particles(b.x,b.y,"#78839b",5);beep(160,.04,"square");return}bl.hp--;b.vy*=-1;shake=bl.type==="explosive"?7:3;if(bl.hp<=0){bl.alive=false;addScore(bl.type==="bonus"?300:bl.type==="explosive"?180:100);beep(520,.07,"triangle",.04);particles(b.x,b.y,bl.type==="explosive"?"#ff6f61":bl.color,bl.type==="explosive"?30:16);if(bl.type==="explosive")for(let o of blocks)if(o!==bl&&o.alive&&Math.hypot(o.x+o.w/2-(bl.x+bl.w/2),o.y+o.h/2-(bl.y+bl.h/2))<bl.w*1.6){o.alive=false;score+=50;particles(o.x+o.w/2,o.y+o.h/2,o.color,8)}if(Math.random()<.13||bl.type==="bonus"){let ts=["wide","multi","slow","fire","life","magnet"];powerups.push({x:bl.x+bl.w/2,y:bl.y,vy:125,type:ts[Math.floor(Math.random()*ts.length)]})}}else{beep(270,.03,"square");particles(b.x,b.y,bl.color,5)}}
function power(t){beep(800,.1,"triangle",.04);particles(paddle.x+paddle.w/2,paddle.y,"#ffdb6e",20);
if(t==="wide"){paddle.w=Math.min(W*.4,paddle.w*1.5);active.wide=true;renderActive();toast("WIDE PADDLE","#ffdb6e");setTimeout(()=>{paddle.w=paddle.base;active.wide=false;renderActive()},9000)}
if(t==="multi"){
  const source=balls[0];
  if(source){
    const speed=Math.max(380,Math.hypot(source.vx,source.vy));
    const base=Math.atan2(source.vy,source.vx);
    const angles=[base-0.48,base,base+0.48];
    balls=angles.map((a,i)=>({
      x:source.x+(i-1)*14,
      y:source.y-4,
      vx:Math.cos(a)*speed,
      vy:Math.sin(a)*speed,
      r:7,
      trail:[],
      fire:source.fire||false,
      dead:false
    }));
  }
  active.multi=true;
  renderActive();
  toast("MULTI BALL — 3 BALLS","#ffdb6e");
  setTimeout(()=>{
    active.multi=false;
    renderActive();
  },10000);
}
if(t==="slow"){balls.forEach(b=>{b.vx*=.7;b.vy*=.7});active.slow=true;renderActive();toast("SLOW MOTION","#ffdb6e");setTimeout(()=>{balls.forEach(b=>{b.vx*=1.43;b.vy*=1.43});active.slow=false;renderActive()},6000)}
if(t==="fire"){balls.forEach(b=>b.fire=true);active.fire=true;renderActive();toast("FIREBALL","#ff6f61");setTimeout(()=>{balls.forEach(b=>b.fire=false);active.fire=false;renderActive()},8000)}
if(t==="life"){lives++;hud();toast("EXTRA LIFE","#ffdb6e")}
if(t==="magnet"){paddle.magnet=true;active.magnet=true;renderActive();toast("MAGNET","#9a7cff");setTimeout(()=>{paddle.magnet=false;active.magnet=false;renderActive()},7000)}}
async function countdown(){counting=true;for(let n of["3","2","1","GO"]){let e=$("countdown");e.textContent=n;e.classList.remove("go");void e.offsetWidth;e.classList.add("go");beep(n==="GO"?740:440,.07,"square");await new Promise(r=>setTimeout(r,600))}counting=false}
function start(){audio();paused=false;counting=false;score=0;level=1;lives=3;combo=1;active={};renderActive();state="play";$("menu").classList.add("hidden");$("pause").classList.add("hidden");let pw=Math.min(150,W*.18);paddle={base:pw,w:pw,h:13,x:W/2-pw/2,target:W/2,y:H-44,magnet:false};parts=[];powerups=[];makeLevel();resetBall();hud();draw();banner("LEVEL 01");countdown();}
function lose(){lives--;combo=1;hud();beep(100,.2,"sawtooth",.035);if(lives<=0){state="menu";$("menuText").textContent=`SCORE ${fmt(score)} • BEST ${fmt(best)} • LEVEL ${String(level).padStart(2,"0")}`;$("play").textContent="PLAY AGAIN";$("menu").classList.remove("hidden")}else{resetBall();toast("LIFE LOST","#ff6f61")}}
function update(dt){if(state!=="play"||paused||counting||!paddle)return;let sp=680;if(keys.ArrowLeft||keys.a)paddle.target-=sp*dt;if(keys.ArrowRight||keys.d)paddle.target+=sp*dt;paddle.target=Math.max(paddle.w/2,Math.min(W-paddle.w/2,paddle.target));paddle.x+=(paddle.target-paddle.w/2-paddle.x)*Math.min(1,dt*15);
for(let b of balls){
  const speedNow=Math.hypot(b.vx,b.vy);
  const minVy=Math.max(110,speedNow*0.18);
  if(Math.abs(b.vy)<minVy) b.vy=(b.vy<0?-1:1)*minVy;
  b.trail.push({x:b.x,y:b.y});if(b.trail.length>10)b.trail.shift();b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx)}if(b.x+b.r>W){b.x=W-b.r;b.vx=-Math.abs(b.vx)}if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy)}if(b.y>H+30){b.dead=true;continue}
if(b.vy>0&&b.x>paddle.x&&b.x<paddle.x+paddle.w&&b.y+b.r>paddle.y&&b.y-b.r<paddle.y+paddle.h){let pos=(b.x-(paddle.x+paddle.w/2))/(paddle.w/2),a=pos*1.12-Math.PI/2,s=Math.min(735,Math.hypot(b.vx,b.vy)*1.015);b.vx=paddle.magnet?0:Math.cos(a)*s;b.vy=-Math.abs(Math.sin(a)*s);b.y=paddle.y-b.r;particles(b.x,paddle.y,"#6fffe9",8);beep(180,.04,"sine")}
for(let bl of blocks)if(bl.alive&&circleHit(bl,b)){destroy(bl,b);break}}
const beforeBalls=balls.length;
balls=balls.filter(b=>!b.dead);
if(beforeBalls>balls.length && balls.length>0) toast("BALL LOST","#ff6f61");for(let p of parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=100*dt;p.life-=dt}parts=parts.filter(p=>p.life>0);for(let p of powerups){p.y+=p.vy*dt;if(p.y>paddle.y-4&&p.y<paddle.y+18&&p.x>paddle.x&&p.x<paddle.x+paddle.w){power(p.type);p.dead=true}}powerups=powerups.filter(p=>!p.dead&&p.y<H+30);if(!balls.length)lose();if(blocks.length&&blocks.every(b=>!b.alive)){level++;combo=1;makeLevel();resetBall();hud();banner("LEVEL "+String(level).padStart(2,"0"));beep(660,.13,"triangle",.04)}}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function draw(){ctx.clearRect(0,0,W,H);let g=ctx.createRadialGradient(W*.5,H*.4,10,W*.5,H*.4,Math.max(W,H)*.75);g.addColorStop(0,"#111b3b");g.addColorStop(1,"#05060b");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle="#ffffff08";for(let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
for(let bl of blocks)if(bl.alive){let c=bl.type==="steel"?"#68738e":bl.type==="explosive"?"#ff6f61":bl.type==="bonus"?"#ffdb6e":bl.color;ctx.shadowBlur=bl.type==="steel"?7:18;ctx.shadowColor=c;ctx.fillStyle=c;rr(bl.x,bl.y,bl.w,bl.h,6);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#ffffff44";ctx.fillRect(bl.x+3,bl.y+3,bl.w-6,3);ctx.fillStyle="#fff";ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.textBaseline="middle";if(bl.type==="explosive")ctx.fillText("✦",bl.x+bl.w/2,bl.y+bl.h/2);if(bl.type==="bonus")ctx.fillText("+",bl.x+bl.w/2,bl.y+bl.h/2);if(bl.type==="steel")ctx.fillText("◆",bl.x+bl.w/2,bl.y+bl.h/2)}
for(let p of powerups){
  const pc=p.type==="fire"?"#ff6f61":p.type==="magnet"?"#9a7cff":"#ffdb6e";
  ctx.shadowBlur=20;ctx.shadowColor=pc;ctx.fillStyle=pc;
  ctx.beginPath();ctx.arc(p.x,p.y,11,0,6.28);ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle="#111522";ctx.font="bold 10px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(p.type[0].toUpperCase(),p.x,p.y);
}
for(let b of balls){for(let i=0;i<b.trail.length;i++){let q=b.trail[i];ctx.globalAlpha=i/b.trail.length*.3;ctx.fillStyle=b.fire?"#ff6f61":"#6fffe9";ctx.beginPath();ctx.arc(q.x,q.y,b.r*i/b.trail.length,0,6.28);ctx.fill()}ctx.globalAlpha=1;ctx.shadowBlur=30;ctx.shadowColor=b.fire?"#ff6f61":"#6fffe9";ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.28);ctx.fill();ctx.shadowBlur=0}
if(paddle){ctx.shadowBlur=26;ctx.shadowColor=paddle.magnet?"#9a7cff":"#6fffe9";ctx.fillStyle=paddle.magnet?"#9a7cff":"#6fffe9";rr(paddle.x,paddle.y,paddle.w,paddle.h,8);ctx.fill();ctx.shadowBlur=0}for(let p of parts){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill()}ctx.globalAlpha=1}
function loop(t){let dt=Math.min(.022,(t-last)/1000||0);last=t;update(dt);draw();requestAnimationFrame(loop)}
canvas.addEventListener("pointermove",e=>{if(!paddle)return;let r=canvas.getBoundingClientRect();paddle.target=(e.clientX-r.left)/r.width*W});canvas.addEventListener("pointerdown",()=>audio());
window.addEventListener("keydown",e=>{keys[e.key]=true;if(e.key==="Escape"&&state==="play"&&!counting){paused=!paused;$("pause").classList.toggle("hidden",!paused)}if(e.key.toLowerCase()==="r")start()});window.addEventListener("keyup",e=>keys[e.key]=false);
$("play").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();start();});$("resume").onclick=()=>{paused=false;$("pause").classList.add("hidden");audio()};$("restart").onclick=start;$("how").onclick=()=>$("help").classList.remove("hidden");$("closeHelp").onclick=()=>$("help").classList.add("hidden");
resize();hud();requestAnimationFrame(loop);