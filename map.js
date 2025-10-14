(function(){
  const img = document.getElementById('mapImg');
  const wrap = document.querySelector('.image-wrap');
  const areas = Array.from(document.querySelectorAll('map[name="image-map"] area'));

  // Store original coords
  areas.forEach(a => a.dataset.orig = a.getAttribute('coords'));

  // Resize image map areas
  function resizeMap(){
    const scaleX = img.clientWidth / (img.naturalWidth || img.clientWidth);
    const scaleY = img.clientHeight / (img.naturalHeight || img.clientHeight);
    areas.forEach(a => {
      const orig = (a.dataset.orig||"").split(',').map(n => parseFloat(n) || 0);
      a.coords = orig.map((v, i) => Math.round(i % 2 === 0 ? v * scaleX : v * scaleY)).join(',');
    });
  }

  // Map image-space coordinates to viewport
  function toViewport(x, y){
    const imgRect = img.getBoundingClientRect();
    const scaleX = imgRect.width / (img.naturalWidth || 1);
    const scaleY = imgRect.height / (img.naturalHeight || 1);
    return {
      x: Math.round(imgRect.left + x * scaleX),
      y: Math.round(imgRect.top + y * scaleY)
    };
  }

  // Debounce helper
  let t;
  function debounceResize(fn, delay=120){ clearTimeout(t); t = setTimeout(fn, delay); }
  window.addEventListener('resize', ()=>debounceResize(()=>{ resizeMap(); createAreaOverlays(); }));

  if (img.complete) resizeMap(); else img.addEventListener('load', resizeMap);

  // Create overlays
  function createAreaOverlays(){
    wrap.querySelectorAll('.area-overlay').forEach(n => n.remove());
    const seen = new Set();

    areas.forEach(a => {
      const orig = (a.dataset.orig||"").split(',').map(n => parseFloat(n) || 0);
      const title = (a.getAttribute('title')||a.getAttribute('alt')||'').trim();
      if (!orig.length || !title || seen.has(title)) return;
      seen.add(title);

      let left, top, width, height;
      if (orig.length >= 4){
        const [x1,y1,x2,y2] = orig;
        const p1 = toViewport(Math.min(x1,x2), Math.min(y1,y2));
        const p2 = toViewport(Math.max(x1,x2), Math.max(y1,y2));
        left = p1.x - wrap.getBoundingClientRect().left;
        top = p1.y - wrap.getBoundingClientRect().top;
        width = Math.max(6, p2.x - p1.x);
        height = Math.max(6, p2.y - p1.y);
      } else if (orig.length === 3){
        const [cx,cy,r] = orig;
        const p1 = toViewport(cx-r, cy-r);
        const p2 = toViewport(cx+r, cy+r);
        left = p1.x - wrap.getBoundingClientRect().left;
        top = p1.y - wrap.getBoundingClientRect().top;
        width = Math.max(6, p2.x - p1.x);
        height = Math.max(6, p2.y - p1.y);
      } else return;

      const ov = document.createElement('div');
      ov.className = 'area-overlay soft';
      ov.dataset.title = title;
      ov.setAttribute('aria-hidden','true');
      ov.tabIndex = 0;
      ov.setAttribute('role','button');
      ov.setAttribute('aria-label', title);
      Object.assign(ov.style,{ left: left+'px', top: top+'px', width: width+'px', height: height+'px', opacity:'0.96' });
      wrap.appendChild(ov);

      ov.addEventListener('click', e=>{
        e.stopPropagation();
        const r = ov.getBoundingClientRect();
        const cx = Math.round(r.left + r.width/2);
        const cy = Math.round(r.top + r.height/2);
        if (regionInfo[title]) showModal(title, regionInfo[title], cx, cy);
        else showLabel(cx, cy, title);
      });
      ov.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); ov.click(); } });
      requestAnimationFrame(()=>{ ov.classList.add('flash'); setTimeout(()=>ov.classList.remove('flash'),900); });
    });
  }

  if (img.complete) createAreaOverlays(); else img.addEventListener('load', createAreaOverlays);

  // Click handler for map areas
  areas.forEach(a=>{
    a.addEventListener('click', ev=>{
      ev.preventDefault();
      const name = a.getAttribute('title') || a.getAttribute('alt') || 'Zona';
      if (name==='Goverment Seat'){
        ['Tarbean','Ralien','Khershaen','Renere'].forEach(t=>highlightAreaByTitle(t));
      }
      if (regionInfo[name]) showModal(name, regionInfo[name], ev.clientX, ev.clientY);
      else showLabel(ev.clientX, ev.clientY, name);
    });
  });

  // Highlight helper
  function highlightAreaByTitle(title){
    const target = areas.find(x => (x.getAttribute('title')||x.getAttribute('alt')) === title);
    if (!target) return;
    const orig = (target.dataset.orig||"").split(',').map(n=>parseFloat(n)||0);
    if (!orig.length) return;

    let left, top, width, height;
    const p1 = orig.length>=4 ? toViewport(Math.min(orig[0],orig[2]), Math.min(orig[1],orig[3])) : toViewport(orig[0]-orig[2], orig[1]-orig[2]);
    const p2 = orig.length>=4 ? toViewport(Math.max(orig[0],orig[2]), Math.max(orig[1],orig[3])) : toViewport(orig[0]+orig[2], orig[1]+orig[2]);
    const wrapRect = wrap.getBoundingClientRect();
    left = p1.x - wrapRect.left;
    top = p1.y - wrapRect.top;
    width = Math.abs(p2.x - p1.x);
    height = Math.abs(p2.y - p1.y);

    const h = document.createElement('div');
    h.className='map-highlight pulse';
    Object.assign(h.style,{left:left+'px', top:top+'px', width:width+'px', height:height+'px'});
    wrap.appendChild(h);
    setTimeout(()=>{ h.classList.remove('pulse'); h.style.opacity='0'; setTimeout(()=>h.remove(),600); },8000);
  }

  // Modal & label helpers
  const modal = document.getElementById('regionModal');
  const modalContent = modal.querySelector('.region-modal-content');
  const modalTitle = document.getElementById('regionModalTitle');
  const modalBody = document.getElementById('regionModalBody');
  const modalClose = document.getElementById('modalClose');
  const modalBackdrop = document.getElementById('modalBackdrop');

  function showModal(title, html, x=null, y=null){
    modalTitle.textContent = title;
    modalBody.innerHTML = `<div class="region-info">${html}</div>`;
    modalBackdrop.style.display='block'; modal.style.display='block'; modalContent.style.display='block';
    modal.setAttribute('aria-hidden','false');

    requestAnimationFrame(()=>{
      const rect = modalContent.getBoundingClientRect();
      let left = (x!=null ? x+12 : (window.innerWidth-rect.width)/2);
      if (left+rect.width>window.innerWidth-12 && x!=null) left=x-rect.width-12;
      left = Math.max(12,left);
      let top = (y!=null ? y-rect.height/2 : (window.innerHeight-rect.height)/2);
      top = Math.max(12, Math.min(top, window.innerHeight-rect.height-12));
      modalContent.style.left=left+'px'; modalContent.style.top=top+'px';
    });
  }

  function closeModal(){
    modalBackdrop.style.display='none';
    modal.style.display='none';
    modalContent.style.display='none';
    modal.setAttribute('aria-hidden','true');
  }
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  window.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

  function showLabel(x,y,text){
    const existing = document.querySelector('.map-label'); if(existing) existing.remove();
    const d = document.createElement('div');
    d.className='map-label';
    d.textContent=text;
    Object.assign(d.style,{position:'fixed',left:(x+8)+'px',top:(y+8)+'px',background:'#222',color:'#fff',padding:'6px 8px',borderRadius:'6px',zIndex:9999,fontSize:'13px',pointerEvents:'none'});
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),1200);
  }

})();
