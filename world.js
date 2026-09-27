/* Nyanyi: the surveyed land as a three.js scene. Shared by the live viewer (index.html) and the image baker
   (_build/bake_scene_nyanyi.html), so the baked turntable and the live model are the same model.
   Local frame: x = east, y = north (metres); three.js: (x, elevation - Z0, -y). */
window.buildWorld = function (THREE, S, opt) {
  "use strict";
  const LAT = opt.lat, LON = opt.lon, TZ = 8;
  const scene = new THREE.Scene();

  /* terrain grid */
  const nx = S.nx, ny = S.ny, dx = (S.x1 - S.x0) / (nx - 1), dy = (S.y1 - S.y0) / (ny - 1);
  const raw = Uint8Array.from(atob(S.h), c => c.charCodeAt(0));
  const H = new Int16Array(raw.buffer);
  const hAt = (x, y) => {
    const j = Math.min(Math.max((x - S.x0) / dx, 0), nx - 1.001), i = Math.min(Math.max((y - S.y0) / dy, 0), ny - 1.001);
    const j0 = Math.floor(j), i0 = Math.floor(i), fj = j - j0, fi = i - i0;
    const g = (a, b) => H[a * nx + b] / 100;
    return (g(i0, j0) * (1 - fj) + g(i0, j0 + 1) * fj) * (1 - fi) + (g(i0 + 1, j0) * (1 - fj) + g(i0 + 1, j0 + 1) * fj) * fi;
  };
  const V = (x, y, lift = 0) => new THREE.Vector3(x, hAt(x, y) + lift, -y);
  const inPoly = (x, y, ring) => { let c = false; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) { const [xa, ya] = ring[a], [xb, yb] = ring[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
  const PLOT_IDS = S.plots.map(p => p.id);                        // ['north', 'south']
  const BED = S.plots.length;                                       // region index of the riverbed

  const N = nx * ny, pos = new Float32Array(N * 3), region = new Int8Array(N).fill(-1), slope = new Float32Array(N), hv = new Float32Array(N);
  for (let i = 0; i < ny; i++) for (let j = 0; j < nx; j++) {
    const k = i * nx + j, x = S.x0 + j * dx, y = S.y0 + i * dy, h = H[k] / 100;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = -y; hv[k] = h;
    S.plots.forEach((p, n) => { if (inPoly(x, y, p.ring)) region[k] = n; });
    if (region[k] < 0 && inPoly(x, y, S.bed.ring)) region[k] = BED;
    const l = H[i * nx + Math.max(j - 1, 0)] / 100, r = H[i * nx + Math.min(j + 1, nx - 1)] / 100, d = H[Math.max(i - 1, 0) * nx + j] / 100, u = H[Math.min(i + 1, ny - 1) * nx + j] / 100;
    slope[k] = Math.hypot((r - l) / (2 * dx), (u - d) / (2 * dy)) * 100;
  }
  const idx = [];
  for (let i = 0; i < ny - 1; i++) for (let j = 0; j < nx - 1; j++) { const a = i * nx + j, b = a + 1, c = a + nx, d = c + 1; idx.push(a, b, c, b, d, c); }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setIndex(idx); tGeo.computeVertexNormals();
  const col = new Float32Array(N * 3); tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: .93, metalness: 0}));
  terrain.castShadow = terrain.receiveShadow = true; scene.add(terrain);

  /* block sides and plinth */
  const base = -4, side = [];
  const edge = list => { for (let n = 0; n < list.length - 1; n++) { const [a, b] = [list[n], list[n + 1]]; side.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[a * 3], base, pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2], pos[a * 3], base, pos[a * 3 + 2], pos[b * 3], base, pos[b * 3 + 2]); } };
  const rowS = [...Array(nx).keys()], rowN = rowS.map(j => (ny - 1) * nx + j).reverse(), colW = [...Array(ny).keys()].map(i => i * nx).reverse(), colE = [...Array(ny).keys()].map(i => i * nx + nx - 1);
  [rowS, colE, rowN, colW].forEach(edge);
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.Float32BufferAttribute(side, 3)); sGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({color: 0x2b241c, roughness: .8, side: THREE.DoubleSide})));
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(S.x1 - S.x0 + 6, 1.2, S.y1 - S.y0 + 6), new THREE.MeshStandardMaterial({color: 0x151a16, roughness: .6}));
  plinth.position.set((S.x0 + S.x1) / 2, base - .6, -(S.y0 + S.y1) / 2); plinth.receiveShadow = true; scene.add(plinth);

  /* colours */
  const C = h => new THREE.Color(h);
  const clay = C('#ece8de'), clayOut = C('#a8a598'), plotT = C('#d9b777'), plotHi = C('#f2c96e'), bedC = C('#b9b3a4');
  const slopeCls = [[15, '#aebf93', 'Under 15%, gentle'], [30, '#e2d29a', '15–30%, moderate'], [50, '#d39a63', '30–50%, steep'], [999, '#a4553f', 'Over 50%, very steep']];
  const elevRamp = [C('#4f7c78'), C('#9fb59a'), C('#e6dcb8'), C('#c79c62')];
  const ELEV = [0, 34];                                             // +70 m (riverbed) to +104 m (road)
  function paint(shade, sel, hover, out = col) {
    const tmp = new THREE.Color();
    for (let k = 0; k < N; k++) {
      const r = region[k], onLand = r >= 0 && r < BED, picked = onLand && (sel === 'both' || sel === PLOT_IDS[r]);
      if (shade === 'slope') { tmp.copy(C(slopeCls.find(c => slope[k] < c[0])[1])); if (!onLand) tmp.lerp(clayOut, .55); }
      else if (shade === 'elev') { const t = Math.min(Math.max((hv[k] - ELEV[0]) / (ELEV[1] - ELEV[0]), 0), 1) * 3, a = Math.min(Math.floor(t), 2); tmp.copy(elevRamp[a]).lerp(elevRamp[a + 1], t - a); if (!onLand) tmp.lerp(clayOut, .5); }
      else { tmp.copy(r === BED ? bedC : onLand ? clay : clayOut); if (picked) tmp.lerp(r === hover ? plotHi : plotT, r === hover ? .85 : .6); }
      out[k * 3] = tmp.r; out[k * 3 + 1] = tmp.g; out[k * 3 + 2] = tmp.b;
    }
    if (out === col) tGeo.attributes.color.needsUpdate = true;
  }

  /* draped lines */
  const groups = {};
  const grp = name => (groups[name] = groups[name] || (() => { const g = new THREE.Group(); scene.add(g); return g; })());
  function densify(pts, step = .5) { const o = []; for (let n = 0; n < pts.length - 1; n++) { const [x0, y0] = pts[n], [x1, y1] = pts[n + 1], L = Math.hypot(x1 - x0, y1 - y0); if (L < 1e-3) continue; const m = Math.max(1, Math.ceil(L / step)); for (let s = 0; s < m; s++) o.push([x0 + (x1 - x0) * s / m, y0 + (y1 - y0) * s / m]); } o.push(pts[pts.length - 1]); return o; }
  function tube(pts, r, mat, lift) { const v = densify(pts).map(p => V(p[0], p[1], lift)); if (v.length < 2) return null; const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal', 0); return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(v.length * 2, 1200), r, 6, false), mat); }
  const inside = (x, y) => x > S.x0 && x < S.x1 && y > S.y0 && y < S.y1;
  const clip = pts => { const segs = []; let cur = []; pts.forEach(p => { if (inside(p[0], p[1])) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur); return segs.filter(s => s.length > 1); };
  // a dashed line: short tubes along the densified path
  function dashes(pts, on, off, r, mat, lift, parent) {
    const d = densify(pts, .25); let acc = 0, cur = [d[0]], draw = true;
    for (let n = 1; n < d.length; n++) {
      acc += Math.hypot(d[n][0] - d[n - 1][0], d[n][1] - d[n - 1][1]); cur.push(d[n]);
      if (acc >= (draw ? on : off)) { if (draw && cur.length > 1) { const t = tube(cur, r, mat, lift); if (t) parent.add(t); } draw = !draw; acc = 0; cur = [d[n]]; }
    }
    if (draw && cur.length > 1) { const t = tube(cur, r, mat, lift); if (t) parent.add(t); }
  }

  const mBrass = new THREE.MeshStandardMaterial({color: '#d6bd8e', emissive: '#6b4f22', emissiveIntensity: .35, roughness: .4, metalness: .3});
  const mDiv = new THREE.MeshStandardMaterial({color: '#fbf6ea', emissive: '#6b5a3a', emissiveIntensity: .25, roughness: .5});
  { const t = tube(S.land.ring, .18, mBrass, .12); t.castShadow = true; grp('plots').add(t); }
  dashes(S.div, 1.4, .9, .12, mDiv, .14, grp('plots'));
  /* road (2026-09-27, as on Kaba-Kaba): the surveyed road outline filled as one flat strip draped on the terrain,
     instead of a thin tube; the roadside ditch is left out */
  (function road() {
    const ring = (S.roadArea || []).slice(0, -1); if (ring.length < 3) return;
    let T = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(p[0], p[1])), []).map(t => t.map(i => ring[i]));
    // refine by halving each triangle across its longest edge until every edge is under 1.2 m (a long thin strip
    // split four ways per pass would explode into hundreds of thousands of triangles)
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const out = [];
    while (T.length) {
      const t = T.pop(), e = [d(t[0], t[1]), d(t[1], t[2]), d(t[2], t[0])], k = e.indexOf(Math.max(...e));
      if (e[k] < 1.2) { out.push(t); continue; }
      const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      T.push([a, m, c], [m, b, c]);
    }
    T = out;
    const pos = [], idx = []; let k = 0;
    T.forEach(t => { if (!t.every(p => inside(p[0], p[1]))) return; t.forEach(p => { const v = V(p[0], p[1], .06); pos.push(v.x, v.y, v.z); }); idx.push(k, k + 1, k + 2); k += 3; });
    if (!k) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 1 ? 1 : 0), 3));   // all up: one even colour
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: '#8f866f', roughness: .9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
    m.receiveShadow = true; grp('road').add(m);
  })();

  /* river: a water sheet over the surveyed bed */
  const shape = new THREE.Shape(S.bed.ring.map(p => new THREE.Vector2(p[0], p[1])));
  const wGeo = new THREE.ShapeGeometry(shape); wGeo.rotateX(-Math.PI / 2);
  // one flat, matte colour, as on Kaba-Kaba (2026-09-27)
  const water = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({color: '#3f9089', roughness: .6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
  water.position.y = S.bed.z + .55;   // above the levelled bed stones by the land edge (they sit at +.35), so no ties show water.receiveShadow = true; grp('river').add(water);

  /* contours, draped at their surveyed height */
  const cMaj = [], cMin = [];
  S.contours.forEach(c => { clip(c.p).forEach(s => { for (let n = 0; n < s.length - 1; n++) { const arr = c.major ? cMaj : cMin; const za = Math.max(c.z, hAt(s[n][0], s[n][1])) + .06, zb = Math.max(c.z, hAt(s[n + 1][0], s[n + 1][1])) + .06; arr.push(s[n][0], za, -s[n][1], s[n + 1][0], zb, -s[n + 1][1]); } }); });
  [[cMaj, '#7d6a48', .8], [cMin, '#9c8e72', .35]].forEach(([arr, c, o]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); grp('contours').add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: c, transparent: true, opacity: o}))); });

  /* the 13 surveyed trees: broadleaf canopies */
  (function trees() {
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const trunkM = new THREE.MeshStandardMaterial({color: '#7d6d58', roughness: .9});
    const leafM = [new THREE.MeshStandardMaterial({color: '#6f8a5e', roughness: .85, flatShading: true}), new THREE.MeshStandardMaterial({color: '#5f7a52', roughness: .85, flatShading: true})];
    S.trees.forEach(t => {
      if (!inside(t[0], t[1])) return;
      const g = new THREE.Group(), hgt = 9 + rnd() * 5, cr = 3.6 + rnd() * 1.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22, .42, hgt, 7), trunkM); trunk.position.y = hgt / 2; trunk.castShadow = true; g.add(trunk);
      // a broad crown of five lobes, the lower ones hanging off to the sides
      for (let b = 0; b < 5; b++) {
        const a = b * 1.57 + rnd() * .8, rr = b ? cr * (.62 + rnd() * .2) : cr, off = b ? cr * .72 : 0;
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), leafM[b % 2]);
        blob.scale.y = .66; blob.position.set(Math.cos(a) * off, hgt - (b ? 1 + rnd() * 1.6 : -.6), Math.sin(a) * off); blob.castShadow = true; g.add(blob);
      }
      g.position.copy(V(t[0], t[1], -.3)); g.rotation.y = rnd() * 6.28; grp('trees').add(g);
    });
  })();

  /* existing buildings (storage by the road, a small structure near the river): true footprints, drawn low and
     see-through so they do not pull the eye (user, 2026-09-26); no shadows; userData.bld = index for hover */
  const mBld = new THREE.MeshStandardMaterial({color: '#c9c5ba', roughness: .75, transparent: true, opacity: .32, depthWrite: false}),
        mRoof = new THREE.MeshStandardMaterial({color: '#e4e0d6', roughness: .6, transparent: true, opacity: .42, depthWrite: false});
  S.buildings.forEach((b, n) => {
    const ring = b.ring.slice(0, -1), lo = Math.min(...ring.map(p => hAt(p[0], p[1]))) - .5, top = b.base - S.z0 + Math.min(b.h * .6, 2.6);
    const sh = new THREE.Shape(ring.map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, {depth: top - lo, bevelEnabled: false}); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mBld); m.position.y = lo; m.renderOrder = 2; m.userData.bld = n; grp('buildings').add(m);
    const rg = new THREE.ExtrudeGeometry(sh, {depth: .2, bevelEnabled: false}); rg.rotateX(-Math.PI / 2);
    const roof = new THREE.Mesh(rg, mRoof); roof.position.y = top; roof.renderOrder = 3; roof.userData.bld = n; grp('buildings').add(roof);
  });

  /* lights and the sun */
  const hemi = new THREE.HemisphereLight(0xdfe8ee, 0x3a3226, .55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 500}); sun.shadow.bias = -0.0004; sun.shadow.normalBias = .4;
  scene.add(sun); scene.add(sun.target); sun.target.position.set(0, 14, 0);
  function sunPos(minutes, month) {
    const yr = new Date().getFullYear(), now = new Date(Date.UTC(yr, month, 21)), start = Date.UTC(yr, 0, 0), doy = Math.floor((now - start) / 864e5);
    const g = 2 * Math.PI / 365 * (doy - 1 + (minutes / 60 - 12) / 24);
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const tst = minutes + eot + 4 * LON - 60 * TZ, ha = (tst / 4 - 180) * Math.PI / 180, lat = LAT * Math.PI / 180;
    const cz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha), zen = Math.acos(Math.min(Math.max(cz, -1), 1));
    let az = Math.acos(Math.min(Math.max((Math.sin(lat) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat) * Math.sin(zen)), -1), 1));
    az = ha > 0 ? (az + Math.PI) % (2 * Math.PI) : (3 * Math.PI - az) % (2 * Math.PI);
    return {el: Math.PI / 2 - zen, az, date: now};
  }
  function sunAt(minutes, month) {
    const p = sunPos(minutes, month), el = Math.max(p.el, .02), warm = Math.min(Math.max(p.el / .5, 0), 1);
    return {p, pos: new THREE.Vector3(Math.sin(p.az) * Math.cos(el) * 200, Math.sin(el) * 200, -Math.cos(p.az) * Math.cos(el) * 200).add(sun.target.position),
            col: new THREE.Color().setRGB(1, .72 + .26 * warm, .48 + .45 * warm), i: p.el <= 0 ? .15 : .9 + 1.7 * Math.min(p.el / .6, 1), h: .25 + .4 * Math.min(Math.max(p.el / .6, 0), 1)};
  }
  function setSun(minutes, month) { const s = sunAt(minutes, month); sun.position.copy(s.pos); sun.color.copy(s.col); sun.intensity = s.i; hemi.intensity = s.h; return s.p; }

  return {scene, hAt, V, inPoly, terrain, tGeo, N, nx, ny, dx, dy, region, slope, hv, BED, PLOT_IDS, groups, paint, slopeCls,
          sun, hemi, sunPos, sunAt, setSun, clay, clayOut, plotT};
};
