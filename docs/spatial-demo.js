/* Original geometric illustration. No model output, external libraries, or network requests. */
(() => {
  'use strict';
  const host = document.getElementById('spatial-demo');
  if (!host || host.dataset.initialized) return;
  host.dataset.initialized = 'true';
  host.innerHTML = `
    <div class="sd-shell">
      <div class="sd-header">
        <h3>Explore in 3D</h3><p id="sd-description">Illustrative scene · hand-built geometry, not model output.</p>
      </div>
      <div class="sd-stage">
        <canvas class="sd-canvas" tabindex="0" role="img" aria-label="Interactive 3D room. Drag horizontally or use arrow keys to orbit; drag vertically to change elevation." aria-describedby="sd-description sd-instructions">A teal sofa, wooden table, lounge chair, plant, and window form a constructed 3D room. Use the viewpoint and representation controls to explore it.</canvas>
        <div class="sd-stage-tip" id="sd-instructions">Drag or use arrow keys to rotate</div>
      </div>
      <div class="sd-controls">
        <div class="sd-representations" role="group" aria-label="Scene representation"><button type="button" data-sd-mode="solid" aria-pressed="true">Solid</button><button type="button" data-sd-mode="wire" aria-pressed="false">Wireframe</button><button type="button" data-sd-mode="points" aria-pressed="false">Points</button></div>
        <div class="sd-actions"><button class="sd-tour" type="button" aria-pressed="false" aria-label="Play camera tour">▶ Play</button><button class="sd-reset" type="button">Reset</button></div>
      </div>
      <span class="sr-only" role="status" aria-live="polite" id="sd-status"></span>
    </div>`;

  const canvas = host.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    host.querySelector('.sd-controls').hidden = true;
    host.querySelector('.sd-stage-tip').textContent = 'This illustration needs a browser with Canvas support.';
    return;
  }
  const tourButton = host.querySelector('.sd-tour');
  const status = host.querySelector('#sd-status');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  let angle = 35 * Math.PI / 180;
  let elevation = 0.54;
  let mode = 'solid';
  let playing = false;
  let visible = false;
  let frame = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let drag = null;
  const faces = [];
  const edges = [];
  const points = [];

  function tint(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const parts = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * factor))));
    return `rgb(${parts.join(',')})`;
  }
  function addFace(vertices, color, normal, options = {}) {
    faces.push({ vertices, color, normal, ...options });
    const a = vertices[0], b = vertices[1], d = vertices[vertices.length - 1];
    const uLength = Math.hypot(...b.map((v, i) => v - a[i]));
    const vLength = Math.hypot(...d.map((v, i) => v - a[i]));
    if (vertices.length === 4) {
      const nu = Math.max(1, Math.ceil(uLength / .19));
      const nv = Math.max(1, Math.ceil(vLength / .19));
      for (let i = 0; i <= nu; i++) {
        for (let j = 0; j <= nv; j++) {
          points.push({ p: a.map((v, k) => v + (b[k] - v) * i / nu + (d[k] - v) * j / nv), color, wall: options.wall });
        }
      }
    } else {
      vertices.forEach(p => points.push({ p, color, wall: options.wall }));
    }
  }
  function box(x, y, z, sx, sy, sz, color, options = {}) {
    const p = [
      [x-sx/2,y,z-sz/2],[x+sx/2,y,z-sz/2],[x+sx/2,y+sy,z-sz/2],[x-sx/2,y+sy,z-sz/2],
      [x-sx/2,y,z+sz/2],[x+sx/2,y,z+sz/2],[x+sx/2,y+sy,z+sz/2],[x-sx/2,y+sy,z+sz/2]
    ];
    [
      [[0,3,2,1],[0,0,-1]],[[4,5,6,7],[0,0,1]],[[0,4,7,3],[-1,0,0]],
      [[1,2,6,5],[1,0,0]],[[3,7,6,2],[0,1,0]],[[0,1,5,4],[0,-1,0]]
    ].forEach(([indices, normal]) => addFace(indices.map(i => p[i]), color, normal, options));
    [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b]) => edges.push({a:p[a],b:p[b],color,wall:options.wall}));
  }
  function cylinder(x, y, z, bottomRadius, topRadius, h, color, sides = 12) {
    const bottom = [], top = [];
    for (let i = 0; i < sides; i++) {
      const theta = TAU * i / sides;
      bottom.push([x+Math.cos(theta)*bottomRadius,y,z+Math.sin(theta)*bottomRadius]);
      top.push([x+Math.cos(theta)*topRadius,y+h,z+Math.sin(theta)*topRadius]);
    }
    addFace(top, color, [0,1,0]);
    for (let i = 0; i < sides; i++) {
      const j = (i+1)%sides;
      const theta = TAU * (i+.5)/sides;
      addFace([bottom[i],bottom[j],top[j],top[i]],color,[Math.cos(theta),.1,Math.sin(theta)]);
      edges.push({a:top[i],b:top[j],color},{a:bottom[i],b:top[i],color});
    }
  }
  function leaf(x, y, z, length, direction, color) {
    const dx = Math.cos(direction), dz = Math.sin(direction);
    const p = [[x,y,z],[x+dx*length*.45-dz*.19,y+length*.36,z+dz*length*.45+dx*.19],
      [x+dx*length,y+length*.22,z+dz*length],[x+dx*length*.45+dz*.19,y+length*.36,z+dz*length*.45-dx*.19]];
    addFace([p[0],p[1],p[2]],color,[0,1,0]);
    addFace([p[0],p[2],p[3]],color,[.4,.8,.1]);
    edges.push({a:p[0],b:p[2],color});
  }

  // Floor, low-cut walls, window: a deliberately small, hand-built scene.
  // Planar ground layers are composited before the objects standing on them.
  // A large floor face cannot be ordered correctly against furniture using
  // its average depth alone, especially while the camera is orbiting.
  box(0,-.22,0,8.6,.22,6.5,'#dfd2b7',{layer:-6});
  box(0,.004,0,8.25,.035,6.14,'#ebe4d2',{layer:-5});
  box(-4.08,.03,0,.13,2.6,6.15,'#e1e6dc',{wall:true});
  box(0,.03,-3.04,8.16,2.6,.13,'#e8e6da',{wall:true});
  box(1.85,.94,-2.955,2.25,1.3,.025,'#adc9c4',{wall:true});
  box(1.85,.88,-2.91,2.43,.07,.12,'#bb9b65',{wall:true});
  box(1.85,2.23,-2.91,2.43,.06,.12,'#d0b583',{wall:true});
  box(.65,.88,-2.91,.06,1.4,.12,'#d0b583',{wall:true});
  box(3.05,.88,-2.91,.06,1.4,.12,'#d0b583',{wall:true});
  box(1.85,.88,-2.90,.045,1.4,.12,'#d0b583',{wall:true});
  box(1.85,1.56,-2.90,2.43,.045,.12,'#d0b583',{wall:true});
  // Inlaid floor lines and a woven rug.
  for (let x = -3.6; x < 4; x += .7) box(x,.041,0,.014,.008,6,'#d6cdb9',{layer:-4});
  box(-.3,.055,.15,4.8,.025,3.45,'#a6b5a4',{layer:-3});
  box(-.3,.082,.15,4.54,.009,3.2,'#bac5b1',{layer:-2});
  for (let z = -1.25; z < 1.7; z += .22) box(-.3,.093,z,4.4,.003,.018,'#abbba6',{layer:-1});
  // Sofa frame, feet, armrests, cushions and warm accent pillows.
  [-2.5,.5].forEach(x => [-2.25,-1.15].forEach(z => box(x,.08,z,.13,.2,.13,'#8f754d')));
  box(-1,.26,-1.73,3.7,.36,1.42,'#356c69');
  box(-1,.58,-2.28,3.7,.67,.3,'#448781');
  [-2.72,.72].forEach(x => box(x,.57,-1.72,.26,.43,1.43,'#3a7975'));
  [-1.83,-.19].forEach(x => {
    box(x,.61,-1.58,1.52,.18,1.03,'#55918b');
    box(x,.8,-2.03,1.5,.39,.16,'#5b9990');
  });
  box(-2.13,.8,-1.9,.51,.4,.21,'#d7b274');
  box(.12,.8,-1.9,.47,.4,.21,'#b4c2a0');
  // Coffee table with two books and a small cup.
  [-.65,.65].forEach(x => [-.19,.67].forEach(z => box(x,.09,z,.085,.59,.085,'#a47e45')));
  box(0,.65,.24,1.83,.11,1.24,'#d5ad6c');
  box(-.34,.76,.32,.55,.065,.4,'#5b7f80');
  box(-.3,.825,.29,.5,.035,.34,'#eee6d1');
  cylinder(.49,.76,.03,.12,.13,.17,'#e7ddc5',10);
  cylinder(.49,.928,.03,.105,.105,.005,'#9f825b',10);
  // Lounge chair and side table.
  [2.3,3.15].forEach(x => [.78,1.65].forEach(z => box(x,.05,z,.09,.51,.09,'#a58852')));
  box(2.72,.47,1.2,1.1,.19,1.13,'#bdad8a');
  box(2.72,.65,1.7,1.1,.67,.15,'#cdbb93');
  [2.17,3.27].forEach(x => box(x,.72,1.2,.1,.12,1.18,'#a58852'));
  cylinder(2.5,.05,-.82,.21,.15,.72,'#b18b50',10);
  cylinder(2.5,.77,-.82,.49,.49,.08,'#d8b77b',16);
  // A planter and faceted leaves keep the geometry readable in every mode.
  cylinder(-3.18,.05,1.93,.26,.39,.61,'#bb8a65',14);
  cylinder(-3.18,.66,1.93,.36,.36,.025,'#6f6d4d',14);
  cylinder(-3.18,.68,1.93,.025,.02,1.18,'#6c8861',6);
  for (let i = 0; i < 10; i++) leaf(-3.18,.88+i*.095,1.93,.55+(i%3)*.13,i*2.4,['#688c69','#779575','#829e78'][i%3]);
  // Minimal wall art, an object hint rather than a textured image.
  box(-2.05,1.3,-2.94,1.23,.92,.04,'#c7b491',{wall:true});
  box(-2.05,1.38,-2.90,1.07,.75,.03,'#f4ead3',{wall:true});
  box(-2.22,1.46,-2.87,.3,.42,.025,'#aab99e',{wall:true});
  box(-1.89,1.46,-2.87,.23,.25,.026,'#d7b16d',{wall:true});

  function project(p) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const rx = p[0]*c-p[2]*s;
    const rz = p[0]*s+p[2]*c;
    const scale = Math.min(width/11.2,height/7.9);
    return {
      x: width/2+rx*scale,
      y: height*.59+(rz*Math.sin(elevation)-p[1]*Math.cos(elevation))*scale,
      depth: rz*Math.cos(elevation)+p[1]*Math.sin(elevation)
    };
  }
  function wallOpacity(depth) { return depth > -.15 ? .12 : .86; }
  function draw() {
    if (!width || !height) return;
    ctx.clearRect(0,0,width,height);
    const scale = Math.min(width/11.2,height/7.9);
    ctx.save();
    ctx.translate(width/2,height*.64);
    ctx.scale(1,.32);
    const shadow = ctx.createRadialGradient(0,0,scale*.4,0,0,scale*5.8);
    shadow.addColorStop(0,'rgba(61,77,61,.16)');
    shadow.addColorStop(1,'rgba(61,77,61,0)');
    ctx.fillStyle = shadow; ctx.fillRect(-scale*6,-scale*6,scale*12,scale*12);
    ctx.restore();
    if (mode === 'solid') {
      const ordered = faces.map(face => {
        const vertices = face.vertices.map(project);
        return {face,vertices,depth:vertices.reduce((a,p)=>a+p.depth,0)/vertices.length};
      }).sort((a,b)=>(a.face.layer || 0)-(b.face.layer || 0) || a.depth-b.depth);
      for (const {face,vertices,depth} of ordered) {
        ctx.globalAlpha = face.wall ? wallOpacity(depth) : 1;
        const light = .88 + face.normal[1]*.13 - face.normal[0]*.055 + face.normal[2]*.025;
        ctx.fillStyle = tint(face.color,light);
        ctx.strokeStyle = tint(face.color,light*.97);
        ctx.lineWidth = .55;
        ctx.beginPath();
        vertices.forEach((p,i)=>i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (mode === 'wire') {
      ctx.lineWidth = .8;
      for (const edge of edges) {
        const a=project(edge.a), b=project(edge.b);
        ctx.globalAlpha = edge.wall ? .18 : .76;
        ctx.strokeStyle = edge.wall ? '#8ba395' : tint(edge.color,.71);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    } else {
      const ordered = points.map(p=>({...p,view:project(p.p)})).sort((a,b)=>a.view.depth-b.view.depth);
      for (const p of ordered) {
        ctx.globalAlpha = p.wall ? .2 : .83;
        ctx.fillStyle = tint(p.color,.86);
        ctx.beginPath();ctx.arc(p.view.x,p.view.y,width<500 ? 1.05 : 1.2,0,TAU);ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  function setSize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    draw();
  }
  function cancelLoop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;lastTime = 0;
  }
  function setPlaying(value, announce = false) {
    playing = value && visible && !document.hidden;
    tourButton.setAttribute('aria-pressed',String(playing));
    tourButton.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    tourButton.setAttribute('aria-label',playing ? 'Pause camera tour' : 'Play camera tour');
    cancelLoop();
    if (announce) status.textContent = playing ? 'Camera tour playing. Press Pause to stop.' : 'Camera tour paused.';
    if (playing) frame = requestAnimationFrame(animate);
  }
  function animate(time) {
    frame=0;
    if (!playing || !visible || document.hidden || !host.isConnected) { setPlaying(false);return; }
    if (lastTime) angle += Math.min(time-lastTime,60)*.00013;
    lastTime=time;draw();
    frame=requestAnimationFrame(animate);
  }
  function setMode(next) {
    mode=next;
    host.querySelectorAll('[data-sd-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.sdMode===mode)));
    const name = mode === 'wire' ? 'Wireframe' : mode === 'points' ? 'Points' : 'Solid';
    canvas.setAttribute('aria-label',`${name} view of an interactive 3D room. Drag or use arrow keys to rotate the viewpoint.`);
    status.textContent = `${name} representation selected.`;
    draw();
  }
  host.querySelectorAll('[data-sd-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.sdMode)));
  tourButton.addEventListener('click',()=>setPlaying(!playing,true));
  host.querySelector('.sd-reset').addEventListener('click',()=>{
    setPlaying(false);angle=35*Math.PI/180;elevation=.54;setMode('solid');status.textContent='Scene reset to the original viewpoint and solid representation.';
  });
  canvas.addEventListener('pointerdown',event=>{
    if (event.button !== 0) return;
    setPlaying(false);drag={x:event.clientX,y:event.clientY,angle,elevation,id:event.pointerId};
    canvas.setPointerCapture(event.pointerId);canvas.classList.add('sd-dragging');
  });
  canvas.addEventListener('pointermove',event=>{
    if (!drag || drag.id!==event.pointerId) return;
    angle=drag.angle+(event.clientX-drag.x)*.009;
    elevation=Math.max(.25,Math.min(.95,drag.elevation+(event.clientY-drag.y)*.004));
    draw();
  });
  function endDrag(){drag=null;canvas.classList.remove('sd-dragging');}
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
  canvas.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();setPlaying(false);
    if(event.key==='ArrowLeft') angle-=.12;
    if(event.key==='ArrowRight') angle+=.12;
    if(event.key==='ArrowUp') elevation=Math.min(.95,elevation+.05);
    if(event.key==='ArrowDown') elevation=Math.max(.25,elevation-.05);
    draw();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
  window.addEventListener('pagehide',()=>setPlaying(false));
  motionPreference.addEventListener('change',event=>{if(event.matches)setPlaying(false);});
  if ('ResizeObserver' in window) new ResizeObserver(setSize).observe(canvas);
  else window.addEventListener('resize',setSize,{passive:true});
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if (!visible) setPlaying(false);else setSize();
    },{threshold:.15});
    observer.observe(canvas);
  } else visible=true;
  setSize();
})();
