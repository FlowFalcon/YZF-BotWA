/**
 * A self-contained Chrome-style runner game.
 *
 * Everything is inline: no network, no images, no eval. The sprites are drawn
 * with canvas rectangles rather than data URLs, which keeps the payload small
 * enough to survive the primitive's size ceiling and removes any external
 * fetch that the client sandbox would block anyway.
 */
export const DINO_HTML = `<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
html,body{margin:0;padding:0;background:transparent;font-family:Roboto,Arial,sans-serif;overflow:hidden}
.wrap{width:100%;max-width:620px;margin:auto;padding:6px}
.card{border-radius:18px;overflow:hidden;background:#111b21;border:1px solid rgba(255,255,255,.12);box-shadow:0 14px 44px rgba(0,0,0,.5)}
.bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#202c33;border-bottom:1px solid rgba(255,255,255,.06)}
.dot{width:8px;height:8px;border-radius:50%;background:#00a884;box-shadow:0 0 8px rgba(0,168,132,.8)}
.title{flex:1;color:#e9edef;font-size:13px;font-weight:700}
.score{color:#8fa3ad;font-size:11px;font-variant-numeric:tabular-nums}
canvas{display:block;width:100%;height:190px;background:#0b141a;touch-action:manipulation}
.hint{padding:8px 12px;background:#18252d;color:#8fa3ad;font-size:10px;text-align:center}
.over{color:#e3c56f;font-weight:700}
</style>
<div class="wrap"><div class="card">
<div class="bar"><span class="dot"></span><span class="title">Dino Run</span><span class="score" id="s">0</span></div>
<canvas id="c" width="600" height="190"></canvas>
<div class="hint" id="h">Tap atau tekan spasi untuk lompat</div>
</div></div>
<script>
(function(){
"use strict";
var c=document.getElementById("c"),x=c.getContext("2d");
var s=document.getElementById("s"),h=document.getElementById("h");
var W=600,H=190,GY=150;
var dy=0,y=GY,run=1,over=0,sc=0,sp=5,t=0,obs=[];
function jump(){if(over){reset();return}if(y>=GY){dy=-11.2}}
function reset(){obs=[];sc=0;sp=5;y=GY;dy=0;over=0;run=1;h.textContent="Tap atau tekan spasi untuk lompat";h.className="hint"}
c.addEventListener("touchstart",function(e){e.preventDefault();jump()},{passive:false});
c.addEventListener("mousedown",function(e){e.preventDefault();jump()});
document.addEventListener("keydown",function(e){if(e.key===" "||e.key==="ArrowUp"){e.preventDefault();jump()}});
function spawn(){var big=Math.random()<0.3;obs.push({x:W+20,w:big?18:12,h:big?34:24})}
function box(px,py,pw,ph,col){x.fillStyle=col;x.fillRect(px,py,pw,ph)}
function dino(){
  var by=y-30;
  box(40,by,22,22,"#e9edef");
  box(58,by+4,10,7,"#e9edef");
  box(64,by+6,3,2,"#0b141a");
  box(44,by+22,5,9,"#e9edef");
  box(53,by+22,5,9,"#e9edef");
  box(34,by+8,7,4,"#e9edef");
}
function loop(){
  t++;
  x.clearRect(0,0,W,H);
  box(0,GY,W,2,"#2a3942");
  for(var i=0;i<6;i++){box((i*140-t*sp*0.6)%(W+140),GY+8,26,2,"#1c2b33")}
  if(!over){
    dy+=0.62;y+=dy;
    if(y>GY){y=GY;dy=0}
    if(t%Math.max(38,86-Math.floor(sp*4))===0){spawn()}
    for(var j=obs.length-1;j>=0;j--){
      var o=obs[j];o.x-=sp;
      if(o.x+o.w<0){obs.splice(j,1);continue}
      if(o.x<62&&o.x+o.w>40&&y-30+22>GY-o.h){over=1;run=0;h.innerHTML='<span class="over">Kena! Tap untuk main lagi</span>'}
    }
    sc+=1;if(sc%260===0&&sp<12){sp+=0.55}
    s.textContent=Math.floor(sc/6);
  }
  for(var k=0;k<obs.length;k++){
    var ob=obs[k];
    box(ob.x,GY-ob.h,ob.w,ob.h,"#00a884");
    box(ob.x-4,GY-ob.h+6,5,9,"#00a884");
    box(ob.x+ob.w-1,GY-ob.h+9,5,8,"#00a884");
  }
  dino();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
</script>`
