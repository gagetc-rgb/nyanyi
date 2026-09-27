/* Nyanyi: three illustrative building concepts on the surveyed terrain.
   Shared by the live 3D viewer (index.html) and the image baker (_build/bake_scene_nyanyi.html).
   Local frame: x = east, y = north (metres); three.js: (x, elevation - Z0, -y). Elevations are absolute (survey datum).
   Enclosed rooms stay on the upper half of the slope; only a light pavilion goes down toward the river. */
window.buildConcepts = function (THREE, hAt, Z0) {
  "use strict";
  const M = {
    glass: new THREE.MeshStandardMaterial({color: '#cfe6ea', emissive: '#ffd49a', emissiveIntensity: .3, roughness: .06, metalness: .1, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2}),
    slab: new THREE.MeshStandardMaterial({color: '#f7f4ee', roughness: .5}),
    col: new THREE.MeshStandardMaterial({color: '#eeebe3', roughness: .6}),
    pool: new THREE.MeshStandardMaterial({color: '#7fdde0', emissive: '#12939b', emissiveIntensity: .55, roughness: .1}),
    deck: new THREE.MeshStandardMaterial({color: '#c2a47a', roughness: .8}),
    lane: new THREE.MeshStandardMaterial({color: '#f1ede4', roughness: .85}),
    stone: new THREE.MeshStandardMaterial({color: '#c6c2ba', roughness: .82}),  // smooth light concrete
    timber: new THREE.MeshStandardMaterial({color: '#a9825a', roughness: .75}),
    coping: new THREE.MeshStandardMaterial({color: '#f4efe6', roughness: .55}),
    cushion: new THREE.MeshStandardMaterial({color: '#fbf8f2', roughness: .9}),
    rail: new THREE.MeshStandardMaterial({color: '#dff0f2', roughness: .05, transparent: true, opacity: .28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2}),
    edge: new THREE.LineBasicMaterial({color: '#ffffff'}),
    mull: new THREE.LineBasicMaterial({color: '#ffffff', transparent: true, opacity: .55}),
  };
  const R = d => d * Math.PI / 180;
  // plan point (u along the long axis, v across) of a rotated rectangle -> world plan (x, y)
  const P = (cx, cy, rot, u, v) => [cx + u * Math.cos(R(rot)) - v * Math.sin(R(rot)), cy + u * Math.sin(R(rot)) + v * Math.cos(R(rot))];
  const rect = (cx, cy, rot, w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => P(cx, cy, rot, u, v));

  function orient(o, cx, cy, z, rot) { o.position.set(cx, z - Z0, -cy); o.rotation.y = R(rot); return o; }
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

  // one storey: floor slab, glass volume with white edges and mullions, roof slab with an overhang
  function volume(parent, o) {
    const {cx, cy, rot = 0, z, w, d, h = 3.4, over = .9, roof = true, cols = true, posts = false} = o;
    const g = orient(new THREE.Group(), cx, cy, z, rot);
    const floor = box(w + .2, .35, d + .2, M.slab); floor.position.y = -.175; floor.castShadow = floor.receiveShadow = true; g.add(floor);
    // glass stops 3 cm short of the floor and roof slabs: coplanar faces z-fight (flicker) as the model turns
    const gl = box(w, h - .06, d, M.glass); gl.position.y = h / 2; gl.renderOrder = 1; g.add(gl);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(gl.geometry), M.edge); e.position.y = h / 2; g.add(e);
    const mv = [], n = Math.max(Math.round(w / 2.6), 2);
    for (let i = 1; i < n; i++) { const u = -w / 2 + w * i / n; mv.push(u, 0, d / 2, u, h, d / 2, u, 0, -d / 2, u, h, -d / 2); }
    for (let i = 1; i < Math.max(Math.round(d / 2.6), 2); i++) { const v = -d / 2 + d * i / Math.max(Math.round(d / 2.6), 2); mv.push(w / 2, 0, v, w / 2, h, v, -w / 2, 0, v, -w / 2, h, v); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mv, 3)); const ml = new THREE.LineSegments(mg, M.mull); ml.renderOrder = 2; g.add(ml);
    // slim white posts just inside the glass: the frame reads as part of the rooms, not as stilts
    if (posts) [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]].forEach(([a, b]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, h, 10), M.col); c.position.set(a * (w / 2 - .35), h / 2, b * (d / 2 - .35)); c.castShadow = true; g.add(c); });
    if (roof) { const r = box(w + 2 * over, .3, d + 2 * over, M.slab); r.position.y = h + .15; r.castShadow = r.receiveShadow = true; g.add(r); }
    parent.add(g);
    // no stilts: a concrete base set 1.2 m in from the slab edge, so the house seems to hover over its own shadow
    if (cols && groundRange(cx, cy, rot, w - 2.4, d - 2.4)[0] < z - .9) podium(parent, cx, cy, rot, w - 2.4, d - 2.4, z - .35, false);
    return rect(cx, cy, rot, w, d);
  }

  // lowest and highest ground under a rotated rectangle (sampled every ~0.75 m, corners included)
  function groundRange(cx, cy, rot, w, d) {
    let lo = 1e9, hi = -1e9;
    const nu = Math.max(Math.ceil(w / .75), 1), nv = Math.max(Math.ceil(d / .75), 1);
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const [x, y] = P(cx, cy, rot, -w / 2 + w * i / nu, -d / 2 + d * j / nv), g = hAt(x, y) + Z0;
      lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    return [lo, hi];
  }

  // a stone terrace from below the ground up to zTop: it follows the slope, so nothing floats and nothing sinks
  function podium(parent, cx, cy, rot, w, d, zTop, coping = true) {
    const lo = groundRange(cx, cy, rot, w, d)[0] - .6, h = zTop - lo;
    const g = orient(new THREE.Group(), cx, cy, lo, rot), b = box(w, h, d, M.stone);
    b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
    if (coping) { const cp = box(w + .12, .12, d + .12, M.coping); cp.position.y = h - .06; cp.receiveShadow = true; g.add(cp); }
    parent.add(g);
    return rect(cx, cy, rot, w, d);
  }

  // a sun lounger in a group's local frame (u across, v toward north), lying along u
  function lounger(g, u, v) {
    const L = new THREE.Group(); L.position.set(u, 0, -v); L.rotation.y = Math.PI / 2;
    const base = box(.75, .22, 2, M.coping); base.position.y = .11; L.add(base);
    const cu = box(.7, .1, 1.35, M.cushion); cu.position.set(0, .27, .3); L.add(cu);
    const back = box(.7, .1, .7, M.cushion); back.position.set(0, .5, -.62); back.rotation.x = -.6; L.add(back);
    L.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(L);
  }

  // infinity pool on its own stone terrace, set above the highest ground under it; teak deck, loungers
  function pool(parent, o) {
    const {cx, cy, rot = 0, z, w, d, deckW = w + 3, deckD = d + 2.4} = o;
    const zTop = Math.max(z, groundRange(cx, cy, rot, deckW, deckD)[1] + .3);
    podium(parent, cx, cy, rot, deckW, deckD, zTop);
    const g = orient(new THREE.Group(), cx, cy, zTop, rot);
    const dk = box(deckW - .4, .05, deckD - .4, M.deck); dk.position.y = .025; dk.receiveShadow = true; g.add(dk);
    const wz = (deckD - d) / 2 - .2;  // water on the river-side edge of the terrace
    const wt = box(w, .05, d, M.pool); wt.position.set(0, .06, wz); g.add(wt);
    const cp = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, .05, d)), M.edge); cp.position.copy(wt.position); g.add(cp);
    if (deckD - d > 1.6) for (let u = -w / 2 + 1.2; u <= w / 2 - 1; u += 2.4) lounger(g, u, deckD / 2 - .65);
    parent.add(g);
    return rect(cx, cy, rot, deckW, deckD);
  }

  // a paved lane draped on the ground
  function lane(parent, pts, width) {
    const v = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(Math.ceil(L / .8), 1), nx = -(y1 - y0) / L * width / 2, ny = (x1 - x0) / L * width / 2;
      for (let s = 0; s < n; s++) {
        const a = [x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n], b = [x0 + (x1 - x0) * (s + 1) / n, y0 + (y1 - y0) * (s + 1) / n];
        const q = [[a[0] + nx, a[1] + ny], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + nx, b[1] + ny]].map(([x, y]) => [x, hAt(x, y) + .1, -y]);
        v.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.lane); m.receiveShadow = true; parent.add(m);
  }

  M.thatch = new THREE.MeshStandardMaterial({color: '#5a4b3b', roughness: .95});

  // an open Balinese-style pavilion on slim posts: timber deck lifted over the slope, a glass room, a dark hipped roof
  function pavilion(parent, o) {
    const {cx, cy, rot = 0, w = 6, d = 6, lift = 1.2, glass = true} = o;
    const [, hi] = groundRange(cx, cy, rot, w + 1.6, d + 1.6), z = o.z || hi + lift;
    const g = orient(new THREE.Group(), cx, cy, z, rot);
    const deck = box(w + 1.6, .3, d + 1.6, M.timber); deck.position.y = -.15; deck.castShadow = deck.receiveShadow = true; g.add(deck);
    [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]].forEach(([a, b]) => {
      const u = a * (w / 2 + .5), v = b * (d / 2 + .5), [px, py] = P(cx, cy, rot, u, v), gz = hAt(px, py) + Z0 - .4, h = z - .3 - gz;
      if (h > .2) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, h, 8), M.col); c.position.set(u, -.3 - h / 2, -v); c.castShadow = true; g.add(c); }
    });
    if (glass) { const gl = box(w - .6, 2.9, d - .6, M.glass); gl.position.y = 1.45; gl.renderOrder = 1; g.add(gl); const e = new THREE.LineSegments(new THREE.EdgesGeometry(gl.geometry), M.edge); e.position.copy(gl.position); g.add(e); }
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3.1, 8), M.col); c.position.set(a * (w / 2 - .1), 1.55, b * (d / 2 - .1)); c.castShadow = true; g.add(c); });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 1.4, 2.6, 4, 1), M.thatch);
    roof.rotation.y = Math.PI / 4; roof.position.y = 3.1 + 1.3; roof.castShadow = true; g.add(roof);
    parent.add(g);
    return rect(cx, cy, rot, w + 1.6, d + 1.6);
  }

  // a gate at the road: two pylons and a thin roof, the opening facing the road (rot = direction into the land)
  function gate(parent, cx, cy, rot) {
    const g = orient(new THREE.Group(), cx, cy, hAt(cx, cy) + Z0, rot);
    [-2.2, 2.2].forEach(v => { const p = box(.7, 3.2, .7, M.slab); p.position.set(0, 1.6, v); p.castShadow = true; g.add(p); });
    const top = box(2.4, .3, 6, M.slab); top.position.y = 3.35; top.castShadow = true; g.add(top);
    parent.add(g);
  }

  // a stepped run of glass storeys down the slope: each one sits on the highest ground under it,
  // and at least one storey below the one above, so the roof of each is the terrace of the next
  function cascade(parent, fp, pts, o) {
    const zs = [];
    pts.forEach(([cx, cy], i) => {
      const {w, d, rot = 0} = o, gz = groundRange(cx, cy, rot, w, d)[1] + .3, z = i ? Math.min(gz, zs[i - 1] - 3.75) : gz;
      zs.push(z);
      fp.push(volume(parent, {cx, cy, rot, z, w, d, h: 3.4, over: 1.1}));
    });
    return zs;
  }

  const C = {};

  /* A — The Cascade: one house stepping down from the road in four levels, a pool terrace, a pavilion on the lower terraces */
  (function () {
    const g = new THREE.Group(), fp = [];
    const zs = cascade(g, fp, [[-32, 14.3], [-25.5, 14.3], [-19, 14.3], [-12.5, 14.3]], {w: 6.5, d: 11.4});
    fp.push(pool(g, {cx: -5.4, cy: 14.3, rot: 90, z: zs[3] - 3.75, w: 10, d: 3.2, deckW: 11.4, deckD: 6.2}));
    fp.push(pavilion(g, {cx: 9, cy: 13, w: 6, d: 6, lift: .9}));
    gate(g, -38.4, 15.2, 0);
    lane(g, [[-5.4, 8.4], [0, 10.2], [3.5, 12], [5.6, 13]], 1.4);
    C.cascade = {group: g, footprints: fp, label: 'The Cascade'};
  })();

  /* B — Two Houses, Two Gates: one house on each plot, each with its own gate */
  (function () {
    const g = new THREE.Group(), fp = [];
    // north plot: three storeys stepping down from the road shelf, a pool terrace below
    const zn = cascade(g, fp, [[-32, 14.3], [-25.5, 14.3], [-19, 14.3]], {w: 6.5, d: 11.4});
    fp.push(pool(g, {cx: -12.2, cy: 14.3, rot: 90, z: zn[2] - 3.75, w: 9, d: 3, deckW: 11.4, deckD: 5.5}));
    gate(g, -38.4, 15.7, 0);
    // south plot: a gate at its own stretch of road, a garden stair along the ridge, the house on the gentle lower terrace
    const zs = cascade(g, fp, [[4.5, -9], [11, -9]], {w: 6.5, d: 13});
    fp.push(pool(g, {cx: 17.3, cy: -9, rot: 90, z: zs[1] - 1.2, w: 10, d: 3, deckW: 12, deckD: 5.2}));
    gate(g, -26.9, -16.9, -8);
    lane(g, [[-26.2, -17.2], [-18, -18.4], [-9, -19.6], [-3, -18.5], [0, -16.2]], 1.4);
    C.two = {group: g, footprints: fp, label: 'Two Houses, Two Gates'};
  })();

  /* C — The Canopy Pavilions: a main lobby at the road, four lifted guest pavilions among the trees, a path between them */
  (function () {
    const g = new THREE.Group(), fp = [];
    fp.push(volume(g, {cx: -31.3, cy: 14.3, z: groundRange(-31.3, 14.3, 0, 8, 11.4)[1] + .3, w: 8, d: 11.4, h: 3.4, over: 1.2}));
    gate(g, -38.4, 15.2, 0);
    [[-19, 20.2], [-8.5, 6], [0.5, 20.5], [9, 3]].forEach(([cx, cy]) => fp.push(pavilion(g, {cx, cy, w: 5.5, d: 5.5, lift: 1.5})));
    lane(g, [[-27.3, 16.5], [-22.5, 19], [-15, 15], [-9.5, 9.5], [-4, 14.5], [0, 16], [4, 9], [8, 6.5]], 1.2);
    C.pavilions = {group: g, footprints: fp, label: 'The Canopy Pavilions'};
  })();

  // glass panes draw in a fixed order instead of being re-sorted by depth every frame (no popping while turning)
  let order = 1;
  Object.values(C).forEach(c => c.group.traverse(o => { if (o.material === M.glass) o.renderOrder = 1 + (order++) * 1e-4; }));
  Object.values(C).forEach(c => { c.group.visible = false; c.group.traverse(o => { if (o.isMesh && o.material !== M.glass) o.castShadow = true; }); });
  const inRing = (x, y, ring) => { let c = false; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) { const [xa, ya] = ring[a], [xb, yb] = ring[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
  const near = (x, y, ring, m) => inRing(x, y, ring) || ring.some((p, i) => { const q = ring[(i + 1) % ring.length], vx = q[0] - p[0], vy = q[1] - p[1], L = vx * vx + vy * vy; let t = ((x - p[0]) * vx + (y - p[1]) * vy) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - p[0] - t * vx, y - p[1] - t * vy) < m; });
  C.blocks = (name, x, y) => !!(C[name] && C[name].footprints.some(r => near(x, y, r, 2.4)));
  return C;
};
