/* 界面、正交三维投影、方案对比与导出。无需网络或第三方依赖。 */
(() => {
  'use strict';
  const G = window.StairGeometry;
  const $ = id => document.getElementById(id);
  const keys = Object.keys(G.limits);
  const labels = {height:'层间高度', risers:'上升级数', tread:'踏步宽度', width:'梯段净宽', landing:'上平台长度'};
  const canvas = $('model'), elevation = $('elevation');
  let params = {...G.defaults}, baseline = {...G.defaults};
  let camera = {yaw:-0.66, pitch:0.48, zoom:1};
  let valid = true, drag = null, demo = null, demoFrame = 0, toastTimer = 0;
  const font = '"Segoe UI", "Microsoft YaHei", sans-serif';
  const f = (x, digits=1) => Number(x).toLocaleString('zh-CN', {minimumFractionDigits:digits, maximumFractionDigits:digits});
  const signed = (x, digits=1) => (Math.abs(x) < .5 * 10 ** -digits ? '—' : (x > 0 ? '+' : '−') + f(Math.abs(x), digits));

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  function syncInputs() {
    keys.forEach(k => { $(k).value = params[k]; $(k+'-range').value = params[k]; $(k).removeAttribute('aria-invalid'); });
  }
  function readInputs() {
    const next = {}, errors = [];
    keys.forEach(k => {
      const text = $(k).value.trim();
      next[k] = text === '' ? NaN : Number(text);
      const [min,max] = G.limits[k];
      const bad = !Number.isFinite(next[k]) || next[k] < min || next[k] > max || (k === 'risers' && !Number.isInteger(next[k]));
      $(k).setAttribute('aria-invalid', String(bad));
      if (bad) errors.push(labels[k] + '须为 ' + min + '–' + max + (k === 'risers' ? ' 的整数' : ' mm'));
      else $(k+'-range').value = next[k];
    });
    valid = errors.length === 0;
    $('input-error').hidden = valid;
    $('input-error').textContent = errors.join('；') + '。模型暂时保留上一组有效尺寸。';
    ['save-baseline','export-png','export-data','auto-demo'].forEach(k => { $(k).disabled = !valid; });
    if (valid) { params = next; update(); }
  }
  function setParameters(next) {
    params = {...next};
    syncInputs();
    readInputs();
  }
  function update() {
    const m = G.calculate(params), a = G.calculate(baseline);
    $('metric-rise').textContent = f(m.rise);
    $('metric-run').textContent = f(m.run/1000,2);
    $('metric-area').textContent = f(m.area,2);
    $('metric-pitch').textContent = f(m.pitch);
    $('model-summary').textContent = m.risers + ' 级 · ' + m.treads + ' 个梯段踏面';
    const rows = [
      ['上升级数', a.risers, m.risers, 0, ' 级'],
      ['每级高度', a.rise, m.rise, 1, ' mm'],
      ['梯段水平长', a.run/1000, m.run/1000, 2, ' m'],
      ['平面占地', a.area, m.area, 2, ' m²'],
      ['鼻口连线倾角', a.pitch, m.pitch, 1, '°']
    ];
    $('comparison').replaceChildren(...rows.map(([name,av,bv,d,u]) => {
      const tr = document.createElement('tr');
      [name, f(av,d)+u, f(bv,d)+u, signed(bv-av,d)+(Math.abs(bv-av)<.5*10**-d?'':u)].forEach(text => {
        const td = document.createElement('td'); td.textContent = text; tr.append(td);
      });
      return tr;
    }));
    const same = keys.every(k=>params[k]===baseline[k]);
    let insight;
    if (same) insight = 'A 与 B 尺寸一致。试着改变级数，观察每级高度和水平长度如何变化。';
    else if (params.height===baseline.height && params.tread===baseline.tread && params.risers!==baseline.risers) {
      const more = params.risers>baseline.risers;
      insight = '同高度、同踏步宽度：级数' + (more?'增加':'减少') + Math.abs(params.risers-baseline.risers) + ' 级，每级' + (more?'降低':'升高') + f(Math.abs(m.rise-a.rise)) + ' mm，梯段' + (more?'增长':'缩短') + f(Math.abs(m.run-a.run)/1000,2) + ' m。';
      if (params.width!==baseline.width || params.landing!==baseline.landing) insight += ' 净宽或平台也有变化，需一并比较占地。';
    } else insight = '当前方案含 ' + m.risers + ' 次上升，每级 ' + f(m.rise) + ' mm；含上平台总长 ' + f(m.length/1000,2) + ' m。请结合实际可用空间比较取舍。';
    $('insight').textContent = insight;
    $('compare-caption').textContent = 'A：H ' + baseline.height + ' / n ' + baseline.risers + ' / b ' + baseline.tread + ' / W ' + baseline.width + ' / p ' + baseline.landing + '（mm，n 为级数）';
    drawAll();
  }

  function fitCanvas(element) {
    const rect = element.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    if (element.width !== Math.round(w*dpr) || element.height !== Math.round(h*dpr)) {
      element.width = Math.round(w*dpr); element.height = Math.round(h*dpr);
    }
    const ctx = element.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return {ctx,w,h};
  }
  function path(ctx, points, fill, stroke='#73908f', lineWidth=1) {
    ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1])); ctx.closePath();
    if (fill) {ctx.fillStyle=fill;ctx.fill();}
    if (stroke) {ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
  }
  function line(ctx, a, b, color='#b5c8c5', width=1) {
    ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function label(ctx,x,y,text,size=11,color='#456765',bg=true) {
    ctx.font = '500 '+size+'px '+font;ctx.textAlign='center';ctx.textBaseline='middle';
    if(bg){const width=ctx.measureText(text).width;ctx.fillStyle='rgba(248,251,249,.94)';ctx.fillRect(x-width/2-5,y-size/2-3,width+10,size+6);}
    ctx.fillStyle=color;ctx.fillText(text,x,y);
  }
  function dimension(ctx,a,b,text,size=11) {
    line(ctx,a,b,'#789a93',.8);
    const vx=b[0]-a[0],vy=b[1]-a[1],len=Math.hypot(vx,vy)||1;
    const nx=-vy/len*4,ny=vx/len*4;
    [a,b].forEach(p=>line(ctx,[p[0]-nx,p[1]-ny],[p[0]+nx,p[1]+ny],'#789a93',.8));
    label(ctx,(a[0]+b[0])/2,(a[1]+b[1])/2,text,size);
  }
  function renderModel(ctx,w,h,input,view,showDimensions) {
    const m=G.calculate(input), half=m.width/2;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#f4f8f6';ctx.fillRect(0,0,w,h);
    const cy=Math.cos(view.yaw),sy=Math.sin(view.yaw),cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
    function raw([x,y,z]) {
      x-=m.length/2;y-=m.height/2;
      const zz=sy*x+cy*z;
      return [cy*x-sy*z, -(cp*y-sp*zz), sp*y+cp*zz];
    }
    const corners=[];
    for(const x of [0,m.length]) for(const y of [0,m.height]) for(const z of [-half,half]) corners.push(raw([x,y,z]));
    const spanX=Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0]));
    const spanY=Math.max(...corners.map(p=>p[1]))-Math.min(...corners.map(p=>p[1]));
    const scale=Math.min((w-110)/spanX,(h-125)/spanY)*view.zoom;
    const project=p=>{const q=raw(p);return [w/2+q[0]*scale,h*.53+q[1]*scale,q[2]];};
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    // 500 mm 地面网格，作为尺度感的辅助，不参与任何计算。
    for(let x=-1000;x<=m.length+1000;x+=500) line(ctx,project([x,0,-half-1600]),project([x,0,half+1600]),'#e4ece7',.7);
    for(let z=-2500;z<=2500;z+=500) line(ctx,project([-1000,0,z]),project([m.length+1000,0,z]),'#e4ece7',.7);
    path(ctx,[[0,0,-half],[m.length+200,0,-half],[m.length+200,0,half+220],[0,0,half+220]].map(project),'#183b4510',null);
    const faces=[];
    const normalCamera=[sy*cp,sp,cy*cp];
    function face(points,normal,color) {
      if(normal.reduce((sum,n,i)=>sum+n*normalCamera[i],0)<.001)return;
      const projected=points.map(project);
      faces.push({points:projected,color,depth:projected.reduce((sum,p)=>sum+p[2],0)/projected.length});
    }
    const outline=G.profile(input);
    face(outline.map(([x,y])=>[x,y,half]),[0,0,1],'#7d9e9e');
    face(outline.map(([x,y])=>[x,y,-half]),[0,0,-1],'#8eaeaa');
    face([[m.length,0,-half],[m.length,m.height,-half],[m.length,m.height,half],[m.length,0,half]],[1,0,0],'#779493');
    for(let i=0;i<m.risers;i++) {
      const x=i*m.tread,y=(i+1)*m.rise,end=i===m.risers-1?m.length:(i+1)*m.tread;
      face([[x,y,-half],[end,y,-half],[end,y,half],[x,y,half]],[0,1,0],i===m.risers-1?'#e3b98e':'#edf0e7');
      face([[x,i*m.rise,-half],[x,y,-half],[x,y,half],[x,i*m.rise,half]],[-1,0,0],'#b2c6bd');
    }
    faces.sort((a,b)=>a.depth-b.depth).forEach(v=>path(ctx,v.points,v.color,'#5f7e7a',.65));
    // 细分侧面轮廓更利于看清最后一级与上平台的衔接。
    if(showDimensions) {
      const size=w<450?9:11;
      dimension(ctx,project([0,0,half+430]),project([m.run,0,half+430]),'L '+f(m.run/1000,2)+' m',size);
      dimension(ctx,project([-300,0,-half-160]),project([-300,m.height,-half-160]),'H '+f(m.height/1000,2)+' m',size);
      dimension(ctx,project([m.length+250,m.height,-half]),project([m.length+250,m.height,half]),'W '+f(m.width/1000,2)+' m',size);
    }
    ctx.restore();
  }
  function renderElevation(ctx,w,h,input) {
    const m=G.calculate(input), left=47, right=20, top=30, bottom=39;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    const scale=Math.min((w-left-right)/m.length,(h-top-bottom)/m.height);
    const originX=left+(w-left-right-m.length*scale)/2, ground=h-bottom;
    const pt=([x,y])=>[originX+x*scale,ground-y*scale];
    path(ctx,G.profile(input).map(pt),'#e4efeb','#507873',1.2);
    line(ctx,pt([-250,0]),pt([m.length+150,0]),'#9aada7',.8);
    ctx.setLineDash([4,4]);line(ctx,pt([0,m.height]),pt([m.length,m.height]),'#ccd5d1');ctx.setLineDash([]);
    dimension(ctx,[originX-20,ground],[originX-20,ground-m.height*scale],'H '+m.height,10);
    dimension(ctx,[originX,ground+20],[originX+m.run*scale,ground+20],'L '+f(m.run,0),10);
    dimension(ctx,[originX+m.run*scale,ground+20],[originX+m.length*scale,ground+20],'p '+m.landing,9);
    label(ctx,originX+m.length*scale*.4,top-8,m.risers+' 次上升 / '+m.treads+' 个梯段踏面',10,'#6e8480',false);
  }
  function drawAll() {
    const v=fitCanvas(canvas);renderModel(v.ctx,v.w,v.h,params,camera,$('dimensions').checked);
    const e=fitCanvas(elevation);renderElevation(e.ctx,e.w,e.h,params);
  }
  keys.forEach(k => {
    $(k).addEventListener('input',readInputs);
    $(k+'-range').addEventListener('input',()=>{$(k).value=$(k+'-range').value;readInputs();});
  });
  $('parameters').addEventListener('submit',e=>e.preventDefault());
  $('dimensions').addEventListener('change',drawAll);
  $('view-reset').addEventListener('click',()=>{camera={yaw:-.66,pitch:.48,zoom:1};drawAll();});
  $('reset').addEventListener('click',()=>{baseline={...G.defaults};camera={yaw:-.66,pitch:.48,zoom:1};setParameters(G.defaults);toast('尺寸、对照 A 与视角已恢复。');});
  for(const n of [16,18]) $('preset'+n).addEventListener('click',()=>setParameters({...G.defaults,risers:n}));
  $('save-baseline').addEventListener('click',()=>{baseline={...params};update();toast('已保存对照 A。现在调整尺寸，比较当前 B。');});
  canvas.addEventListener('pointerdown',e=>{
    if(demo)return;
    drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag)return;
    camera.yaw+=(e.clientX-drag.x)*.008;
    camera.pitch=Math.max(.14,Math.min(1.2,camera.pitch+(e.clientY-drag.y)*.006));
    drag={x:e.clientX,y:e.clientY,id:e.pointerId};drawAll();
  });
  function stopDrag(){drag=null;canvas.classList.remove('dragging');}
  canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);canvas.addEventListener('lostpointercapture',stopDrag);
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();if(demo)return;
    camera.zoom=Math.max(.65,Math.min(1.5,camera.zoom*Math.exp(-e.deltaY*.001)));drawAll();
  },{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(demo)return;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft')camera.yaw-=.1;
    if(e.key==='ArrowRight')camera.yaw+=.1;
    if(e.key==='ArrowUp')camera.pitch=Math.min(1.2,camera.pitch+.06);
    if(e.key==='ArrowDown')camera.pitch=Math.max(.14,camera.pitch-.06);
    if(e.key==='+'||e.key==='=')camera.zoom=Math.min(1.5,camera.zoom+.05);
    if(e.key==='-')camera.zoom=Math.max(.65,camera.zoom-.05);
    drawAll();
  });

  function download(blob,name) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  $('export-data').addEventListener('click',()=>{
    const data={title:'楼梯几何实验室',version:'1.0',exportedAt:new Date().toISOString(),units:'尺寸 mm；面积 m²；角度 °',
      baseline:G.calculate(baseline),current:G.calculate(params),
      formulas:{rise:'H / n',run:'(n - 1) * b',area:'(L + p) * W / 1000000',pitch:'atan(h / b) * 180 / PI'},
      scope:'单跑直梯几何外轮廓，含上平台、不含下平台；不包含结构、净空或规范审查'};
    download(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),'楼梯几何实验-参数.json');
    toast('已生成参数文件，包含对照 A 和当前 B。');
  });
  $('export-png').addEventListener('click',()=>{
    const out=document.createElement('canvas');out.width=1800;out.height=1120;
    const ctx=out.getContext('2d'),m=G.calculate(params),a=G.calculate(baseline);
    ctx.fillStyle='#f4f5f0';ctx.fillRect(0,0,1800,1120);
    ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#b17752';ctx.font='500 16px '+font;ctx.fillText('PARAMETRIC STAIR STUDY / 01',65,62);
    ctx.fillStyle='#183d4b';ctx.font='600 42px '+font;ctx.fillText('楼梯几何实验室',65,120);
    ctx.font='20px '+font;ctx.fillStyle='#6f8387';ctx.fillText('尺寸改变空间，模型帮助理解取舍。',65,158);
    ctx.save();ctx.translate(40,195);renderModel(ctx,1120,735,params,camera,true);ctx.restore();
    ctx.fillStyle='#fff';ctx.fillRect(1190,200,555,735);
    ctx.fillStyle='#183d4b';ctx.font='600 23px '+font;ctx.fillText('当前 B · 尺寸与结果',1225,246);
    const items=[['层间高度 / 级数',f(m.height,0)+' mm / '+m.risers+' 级'],['踏步宽度 / 梯段净宽',m.tread+' / '+m.width+' mm'],['上平台长度',m.landing+' mm'],['每级高度',f(m.rise)+' mm'],['梯段水平长',f(m.run/1000,2)+' m'],['平面占地（含上平台）',f(m.area,2)+' m²'],['鼻口连线倾角',f(m.pitch)+'°']];
    items.forEach(([name,value],i)=>{
      const y=300+i*57;ctx.font='17px '+font;ctx.fillStyle='#7a8c8b';ctx.textAlign='left';ctx.fillText(name,1225,y);
      ctx.fillStyle='#183d4b';ctx.font='600 20px '+font;ctx.textAlign='right';ctx.fillText(value,1710,y);line(ctx,[1225,y+16],[1710,y+16],'#e5ece8');
    });
    ctx.textAlign='left';ctx.fillStyle='#a26945';ctx.font='500 18px '+font;ctx.fillText('对照 A → 当前 B',1225,736);
    ctx.fillStyle='#536e70';ctx.font='17px '+font;ctx.fillText('级高变化 '+signed(m.rise-a.rise)+' mm',1225,777);ctx.fillText('梯段水平长变化 '+signed((m.run-a.run)/1000,2)+' m',1225,811);ctx.fillText('占地变化 '+signed(m.area-a.area,2)+' m²',1225,845);
    ctx.fillStyle='#7a8b89';ctx.font='13px '+font;ctx.fillText('A: H '+a.height+' / n '+a.risers+' / b '+a.tread+' / W '+a.width+' / p '+a.landing,1225,898);
    ctx.fillStyle='#183d4b';ctx.font='20px '+font;ctx.fillText('h = H / n      L = (n − 1) × b      S = (L + p) × W',65,993);
    ctx.font='16px '+font;ctx.fillStyle='#768681';ctx.fillText('参数化几何练习 · 体块仅表示外轮廓，不含结构、净空及规范审查。',65,1040);
    ctx.fillText('AI 辅助开发原型 / v1.0',65,1074);
    out.toBlob(blob=>{if(blob){download(blob,'楼梯几何实验-展示图.png');toast('已生成 1800 × 1120 展示图。');}else toast('图片生成失败，请重试。');},'image/png');
  });

  function lockDemo(locked) {
    document.querySelectorAll('#parameters input, #preset16, #preset18, #reset, #save-baseline, #view-reset').forEach(el=>{el.disabled=locked;});
    $('auto-demo').textContent=locked?'■ 停止并还原':'▶ 30 秒自动演示';
  }
  function stopDemo(finished=false) {
    if(!demo)return;
    cancelAnimationFrame(demoFrame);
    const previous=demo.previous;demo=null;baseline=previous.baseline;camera=previous.camera;
    lockDemo(false);setParameters(previous.params);
    $('demo-caption').textContent='一段直梯，连接两个标高。';
    toast(finished?'演示结束，已还原你的尺寸和对照 A。':'已停止演示并还原。');
  }
  function tick(time) {
    if(!demo)return;
    if(demo.start===null)demo.start=time;
    const seconds=(time-demo.start)/1000;
    if(seconds>=30){stopDemo(true);return;}
    const stage=seconds<10?0:seconds<20?1:2;
    if(stage!==demo.stage) {
      demo.stage=stage;params={...G.defaults,risers:[16,18,20][stage]};syncInputs();update();
    }
    camera={yaw:-.65+Math.sin(seconds*.22)*.28,pitch:.48,zoom:1};
    $('demo-caption').textContent=[
      '01 / 同样 3 m 高度：16 级，每级 187.5 mm。',
      '02 / 改为 18 级：每级降低，水平长度增加。',
      '03 / 改为 20 级：观察级高与占地的取舍。'
    ][stage]+' '+Math.ceil(30-seconds)+'s';
    drawAll();demoFrame=requestAnimationFrame(tick);
  }
  $('auto-demo').addEventListener('click',()=>{
    if(demo){stopDemo();return;}
    demo={start:null,stage:-1,previous:{params:{...params},baseline:{...baseline},camera:{...camera}}};
    baseline={...G.defaults,risers:16};lockDemo(true);demoFrame=requestAnimationFrame(tick);
  });
  new ResizeObserver(drawAll).observe(canvas.parentElement);
  new ResizeObserver(drawAll).observe(elevation.parentElement);
  syncInputs();update();
})();
