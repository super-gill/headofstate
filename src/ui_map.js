// ===================== MAP VIEW =====================
const MapView = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const W = MAPDATA.W, H = MAPDATA.H;
  const info = {}; MAPDATA.c.forEach(m => info[m.id] = m);
  let svg, wrap, gLand, gLines, gLabels, gMarks, tipEl;
  const paths = {}, dots = {}, labels = {};
  let cw = 800, ch = 400, k = 1, kMin = 1, kMax = 20, cx = W / 2, cy = H / 2;
  let selIso = null, hooks = {}, youIso = null;
  const pointers = new Map(); let dragMoved = false, pinch0 = null, downAt = null;

  const el = (name, attrs, parent) => { const e = document.createElementNS(NS, name); for (const a in attrs) e.setAttribute(a, attrs[a]); if (parent) parent.appendChild(e); return e; };

  function init(svgEl, wrapEl, h) {
    svg = svgEl; wrap = wrapEl; hooks = h || {};
    svg.innerHTML = '';
    el('rect', { x: -400, y: -300, width: W + 800, height: H + 600, fill: 'var(--sea)' }, svg);
    gLand = el('g', {}, svg); gLines = el('g', {}, svg); gLabels = el('g', {}, svg); gMarks = el('g', {}, svg);
    MAPDATA.c.forEach(m => {
      const p = el('path', { d: m.d, class: 'land', 'data-iso': m.id }, gLand); paths[m.id] = p;
      if (m.w < 4.5 && m.h < 4.5) { const d = el('circle', { cx: m.cx, cy: m.cy, r: 3, class: 'dot', 'data-iso': m.id }, gLand); dots[m.id] = d; }
    });
    tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.hidden = true; wrap.appendChild(tipEl);
    bind();
    const ro = new ResizeObserver(() => { resize(); }); ro.observe(wrap);
    resize(true);
  }

  function nameOf(id) { return hooks.name ? hooks.name(id) : id; }
  function buildLabels() {
    gLabels.innerHTML = '';
    MAPDATA.c.forEach(m => {
      if (m.w < 6) return;
      const n = nameOf(m.id); if (!n) return;
      const t = el('text', { x: m.cx, y: m.cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'lbl' }, gLabels);
      t.textContent = n; labels[m.id] = t;
    });
    updateLabels();
  }
  function updateLabels() {
    const cand = [];
    const x0 = cx - cw / k / 2, y0 = cy - ch / k / 2;
    for (const id in labels) {
      const m = info[id], t = labels[id]; const len = t.textContent.length;
      const bw = m.w * k;
      const fs = Math.min(13, Math.max(8, bw / (len * 0.7)));
      const sx = (m.cx - x0) * k, sy = (m.cy - y0) * k;
      if (bw < len * 5.6 || m.h * k < 9 || sx < -20 || sy < -20 || sx > cw + 20 || sy > ch + 20) { t.style.display = 'none'; continue; }
      cand.push({ t, fs, sx, sy, len, area: m.w * m.h });
    }
    cand.sort((a, b) => b.area - a.area);
    const placed = [];
    cand.forEach(c => {
      const w = c.len * c.fs * 0.72, h = c.fs * 1.15;
      const r = [c.sx - w / 2, c.sy - h / 2, c.sx + w / 2, c.sy + h / 2];
      if (placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) { c.t.style.display = 'none'; return; }
      placed.push(r); c.t.style.display = ''; c.t.setAttribute('font-size', (c.fs / k).toFixed(3));
    });
    for (const id in dots) { dots[id].setAttribute('r', (3.4 / k).toFixed(3)); }
  }

  function clampView() {
    const vw = cw / k, vh = ch / k;
    if (vw >= W) cx = W / 2; else cx = Math.max(vw / 2, Math.min(W - vw / 2, cx));
    if (vh >= H) cy = H / 2; else cy = Math.max(vh / 2, Math.min(H - vh / 2, cy));
  }
  function apply() {
    clampView();
    const vw = cw / k, vh = ch / k;
    svg.setAttribute('viewBox', (cx - vw / 2).toFixed(2) + ' ' + (cy - vh / 2).toFixed(2) + ' ' + vw.toFixed(2) + ' ' + vh.toFixed(2));
    updateLabels();
  }
  function resize(first) {
    const r = wrap.getBoundingClientRect(); if (!r.width || !r.height) return;
    const wasFit = first || Math.abs(k - kMin) < 1e-6;
    cw = r.width; ch = r.height;
    kMin = Math.min(cw / W, ch / H) * 1.0; kMax = kMin * 16;
    if (wasFit) { k = kMin; cx = W / 2; cy = H / 2; }
    k = Math.max(kMin, Math.min(kMax, k));
    apply();
  }
  function zoomAt(px, py, factor) {
    const r = svg.getBoundingClientRect();
    const mx = (cx - cw / k / 2) + (px - r.left) / k, my = (cy - ch / k / 2) + (py - r.top) / k;
    const nk = Math.max(kMin, Math.min(kMax, k * factor));
    // keep the point under the cursor fixed
    cx = mx - ((px - r.left) - cw / 2) / nk; cy = my - ((py - r.top) - ch / 2) / nk; k = nk; apply();
  }
  function focus(iso, zoom) {
    const m = info[iso]; if (!m) return;
    const nk = zoom ? Math.min(kMax, Math.max(kMin, kMin * zoom)) : k;
    // smooth-ish: animate over a few frames
    const sx = cx, sy = cy, sk = k; let t = 0;
    const step = () => { t += 0.12; const e = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); cx = sx + (m.cx - sx) * e; cy = sy + (m.cy - sy) * e; k = sk + (nk - sk) * e; apply(); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function reset() { k = kMin; cx = W / 2; cy = H / 2; apply(); }

  function bind() {
    svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016))); hideTip(); }, { passive: false });
    svg.addEventListener('pointerdown', e => {
      try { svg.setPointerCapture && svg.setPointerCapture(e.pointerId); } catch (err) { }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downAt = { x: e.clientX, y: e.clientY, target: e.target }; dragMoved = false;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), k }; }
    });
    svg.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse') hover(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (pointers.size === 1) {
        if (!dragMoved && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) { dragMoved = true; svg.classList.add('dragging'); hideTip(); }
        if (dragMoved) { cx -= dx / k; cy -= dy / k; apply(); }
      } else if (pointers.size === 2 && pinch0) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        const nk = Math.max(kMin, Math.min(kMax, pinch0.k * d / pinch0.d)); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, nk / k); dragMoved = true; return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = e => {
      const had = pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = null;
      svg.classList.remove('dragging');
      if (had && !dragMoved && pointers.size === 0 && downAt) {
        const t = document.elementFromPoint(e.clientX, e.clientY);
        const node = t && t.closest ? t.closest('[data-iso]') : null;
        if (node && hooks.select) hooks.select(node.getAttribute('data-iso'));
      }
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pinch0 = null; });
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideTip(); });
  }
  function hover(e) {
    const node = e.target.closest ? e.target.closest('[data-iso]') : null;
    if (!node || !hooks.tip) return hideTip();
    const iso = node.getAttribute('data-iso');
    const html = hooks.tip(iso); if (!html) return hideTip();
    tipEl.innerHTML = html; tipEl.hidden = false;
    const r = wrap.getBoundingClientRect();
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    if (x + tw > r.width - 6) x = e.clientX - r.left - tw - 14;
    if (y + th > r.height - 6) y = e.clientY - r.top - th - 14;
    tipEl.style.left = Math.max(4, x) + 'px'; tipEl.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; }

  function paint(fillFn) {
    for (const id in paths) {
      const f = fillFn(id); paths[id].style.fill = f;
      if (dots[id]) dots[id].style.fill = f;
    }
  }
  function select(iso) {
    if (selIso) { paths[selIso] && paths[selIso].classList.remove('sel'); dots[selIso] && dots[selIso].classList.remove('sel'); }
    selIso = iso;
    if (iso && paths[iso]) { paths[iso].classList.add('sel'); gLand.appendChild(paths[iso]); if (dots[iso]) { dots[iso].classList.add('sel'); gLand.appendChild(dots[iso]); } }
  }
  function curve(a, b, cls, bend) {
    const A = info[a], B = info[b]; if (!A || !B) return;
    const mx = (A.cx + B.cx) / 2, my = (A.cy + B.cy) / 2; const d = Math.hypot(A.cx - B.cx, A.cy - B.cy);
    const p = el('path', { d: 'M' + A.cx + ',' + A.cy + ' Q' + mx + ',' + (my - d * (bend == null ? 0.22 : bend)) + ' ' + B.cx + ',' + B.cy, class: cls }, gLines);
    return p;
  }
  function setOverlay(lines, you, hots) {
    gLines.innerHTML = ''; gMarks.innerHTML = '';
    (lines || []).forEach(l => curve(l.a, l.b, l.cls, l.bend));
    (hots || []).forEach(i => { const m = info[i]; if (m) { el('circle', { cx: m.cx, cy: m.cy, r: 2.6, class: 'hot' }, gMarks); } });
    youIso = you;
    if (you && info[you]) { const m = info[you]; el('circle', { cx: m.cx, cy: m.cy, r: 7, class: 'pulse' }, gMarks); el('circle', { cx: m.cx, cy: m.cy, r: 2.8, class: 'youdot' }, gMarks); }
  }
  return { init, paint, select, focus, reset, setOverlay, buildLabels, zoomIn: () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.5); }, zoomOut: () => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.5); }, hideTip, info, resize };
})();
