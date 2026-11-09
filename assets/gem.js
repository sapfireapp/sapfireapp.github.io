// Камень Sapfire — как на пустом экране браузера (Sapfire Sources/Gem.swift), на чистом WebGL.
// Медленно крутится вокруг своей оси всегда (в браузере — только пока двигается курсор, и поза там как на значке).
// Тянешь — поворачивается с инерцией, отпустил — возвращается в позу.
// Подключение: <canvas data-gem> внутри .gem; получилось — у .gem класс .live (картинка-заглушка прячется).
(() => {
  // ---------- Кватернионы [x, y, z, w] ----------
  const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];
  const qNorm = (q) => { const l = Math.hypot(...q); return q.map((v) => v / l); };
  const qAxis = (a, x, y, z) => { const l = Math.hypot(x, y, z), s = Math.sin(a / 2) / l; return [x * s, y * s, z * s, Math.cos(a / 2)]; };
  // Матрица поворота 3×3 по столбцам (для GL)
  const qMat = ([x, y, z, w]) => [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];

  // ---------- Огранка (как в браузере: площадка, верх и низ пояса, грани к острию) ----------
  const ring = (h, c, y) => [[h - c, h], [-h + c, h], [-h, h - c], [-h, -h + c], [-h + c, -h], [h - c, -h], [h, -h + c], [h, h - c]]
    .map(([x, z]) => [x, y, z]);
  const rings = [ring(0.46, 0.07, 0.52), ring(1.00, 0.15, 0.10), ring(1.00, 0.15, -0.02)];
  const tris = [], edges = [];
  const top = rings[0], tc = [0, top[0][1], 0];
  for (let i = 0; i < 8; i++) tris.push(tc, top[(i + 1) % 8], top[i]);
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r], b = rings[r + 1];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      tris.push(a[i], a[j], b[j], a[i], b[j], b[i]);
      edges.push(a[i], b[i]);
    }
  }
  const low = rings[rings.length - 1], culet = [0, -1.15, 0];
  for (let i = 0; i < 8; i++) { tris.push(low[i], low[(i + 1) % 8], culet); edges.push(low[i], culet); }
  for (const r of rings) for (let i = 0; i < 8; i++) edges.push(r[i], r[(i + 1) % 8]);

  // Плоские грани: у каждой свои вершины и нормаль
  const facetData = [];
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n);
    for (const p of [a, b, c]) facetData.push(...p, n[0] / l, n[1] / l, n[2] / l);
  }

  // Контур (силуэт): рёбра, у которых одна соседняя грань смотрит на зрителя, а другая — от него. Смежность — из треугольников;
  // нормали — наружу (камень выпуклый: от центра к грани), иначе знак зависит от порядка вершин. Рёбра между гранями одной плоскости
  // (диагонали площадки и граней) силуэтом не бывают — у них одна нормаль
  const silEdges = (() => {
    const key = (p) => p.map((v) => v.toFixed(4)).join(','), map = new Map(), mid = [0, -0.2, 0];
    for (let i = 0; i < tris.length; i += 3) {
      const t = [tris[i], tris[i + 1], tris[i + 2]];
      const u = [0, 1, 2].map((k) => t[1][k] - t[0][k]), v = [0, 1, 2].map((k) => t[2][k] - t[0][k]);
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const c = [0, 1, 2].map((k) => (t[0][k] + t[1][k] + t[2][k]) / 3 - mid[k]);
      if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) n = n.map((x) => -x);
      for (let e = 0; e < 3; e++) {
        const a = t[e], b = t[(e + 1) % 3], k = [key(a), key(b)].sort().join('|');
        if (!map.has(k)) map.set(k, { a, b, n: [] });
        map.get(k).n.push(n);
      }
    }
    return [...map.values()].filter((e) => e.n.length === 2);
  })();

  // ---------- Шейдеры (перенос из Gem.swift; цвета «как на экране», WebGL пишет их в sRGB без перевода) ----------
  const VS = `
    attribute vec3 aP; attribute vec3 aN;
    uniform mat3 uM; uniform mat4 uPV;
    varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vON; varying vec3 vEdge;
    uniform vec3 uCam;
    void main() {
      vec3 w = uM * aP;
      vN = uM * aN; vV = uCam - w; vP = aP; vON = aN;
      vEdge = uM * vec3(-1.0, 0.0, 0.0);   // куда смотрит левый край бирюзовой грани
      gl_Position = uPV * vec4(w, 1.0);
    }`;
  const FS = `
    precision highp float;
    uniform float uTime;
    uniform vec3 uTint; uniform vec2 uTintAM;   // подсветка: цвет; непрозрачность и номер режима (TINT_MODES)
    varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vON; varying vec3 vEdge;
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec3 V = normalize(vV);
      vec3 deep = vec3(0.16, 0.06, 0.95), blue = vec3(0.05, 0.36, 1.00), cyan = vec3(0.22, 0.98, 1.00);
      vec3 L1 = normalize(vec3(-0.6, 0.8, 0.9)), L2 = normalize(vec3(0.9, -0.2, 0.6));
      float d1 = max(dot(n, L1), 0.0), d2 = max(dot(n, L2), 0.0);
      vec3 col = mix(deep, blue, smoothstep(0.15, 0.85, d1 * 0.9 + d2 * 0.35));
      float sweep = clamp(dot(vP, vec3(-0.5, 0.3, 0.5)) * 0.6 + 0.5, 0.0, 1.0);
      col = mix(col, mix(col, vec3(0.35, 0.7, 1.0), 0.45), sweep * d1);
      float table = smoothstep(0.97, 0.995, normalize(vON).y) * step(0.4, vP.y);
      vec3 tcol = mix(vec3(0.0, 0.62, 1.0), cyan, clamp(0.5 - vP.x * 0.9 + vP.z * 0.5, 0.0, 1.0));
      col = mix(col, tcol, table * (0.55 + 0.45 * d1));
      // Блик бирюзовой грани, как на значке — виден только в позе значка
      float pose = smoothstep(0.80, 0.93, dot(normalize(vEdge), normalize(vec3(-0.7586, 0.4997, 0.4181))));
      float lit = table * pose;
      col = mix(col, mix(vec3(0.0, 0.55, 1.0), mix(cyan, vec3(1.0), 0.12), smoothstep(0.40, -0.46, vP.x)), lit * 0.85);
      float wedge = 0.17 * clamp((0.39 - vP.z) / 0.78, 0.0, 1.0);
      float sliver = 1.0 - smoothstep(-0.46 + wedge - 0.006, -0.46 + wedge + 0.006, vP.x);
      col = mix(col, vec3(1.0), lit * sliver * step(0.001, wedge));
      col = mix(col, deep, clamp(-vP.y * 0.35 + vP.x * 0.12, 0.0, 0.35));
      vec3 R = reflect(-V, n);
      float g1 = pow(max(dot(R, L1), 0.0), 10.0), g2 = pow(max(dot(R, L2), 0.0), 18.0);
      col = mix(col, cyan, clamp(g1 * 1.1 + g2 * 0.8, 0.0, 1.0));
      col = mix(col, vec3(1.0), pow(clamp(g1, 0.0, 1.0), 4.0) * 0.8);
      // Белый отблеск пробегает по освещённым граням раз в 3 с
      float cyc = mod(uTime, 3.0);
      float off = mix(-1.5, 1.5, cyc);
      float along = dot(vP, normalize(vec3(1.0, 0.45, -0.8)));
      float band = (1.0 - smoothstep(0.17, 0.185, abs(along - off))) * step(cyc, 1.0);
      float litMask = smoothstep(0.4, 0.44, dot(R, L1)) * smoothstep(0.2, 0.25, dot(n, V));
      col = mix(col, vec3(1.0), band * litMask);
      float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
      col += vec3(0.25, 0.3, 1.0) * fr * 0.35;
      // Подсветка — слой цвета поверх граней, только по самому камню
      col = clamp(col, 0.0, 1.0);
      vec3 b = col, t = uTint, r = t; float m = uTintAM.y;
      if (m < 0.5) r = t;                                                                 // normal
      else if (m < 1.5) r = b * t;                                                        // multiply
      else if (m < 2.5) r = 1.0 - (1.0 - b) * (1.0 - t);                                  // screen
      else if (m < 3.5) r = mix(2.0 * b * t, 1.0 - 2.0 * (1.0 - b) * (1.0 - t), step(0.5, b));   // overlay
      else if (m < 4.5) r = mix(b - (1.0 - 2.0 * t) * b * (1.0 - b), b + (2.0 * t - 1.0) * (sqrt(b) - b), step(0.5, t));   // soft-light
      else if (m < 5.5) r = mix(2.0 * b * t, 1.0 - 2.0 * (1.0 - b) * (1.0 - t), step(0.5, t));   // hard-light
      else if (m < 6.5) r = min(b / max(1.0 - t, 1e-3), 1.0);                             // color-dodge
      else if (m < 7.5) r = 1.0 - min((1.0 - b) / max(t, 1e-3), 1.0);                     // color-burn
      else if (m < 8.5) r = min(b + t, 1.0);                                              // plus-lighter (add)
      else if (m < 9.5) r = max(b, t);                                                    // lighten
      else if (m < 10.5) r = min(b, t);                                                   // darken
      else r = abs(b - t);                                                                // difference
      col = mix(b, clamp(r, 0.0, 1.0), uTintAM.x);
      gl_FragColor = vec4(col, 1.0);
    }`;
  // Настройки, которые крутит панель (assets/tune.js): общий объект на странице, значения по умолчанию — здесь
  const T = (window.SapfireTune ||= {});
  const TINT_MODES = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'plus-lighter', 'lighten', 'darken', 'difference'];
  const hex3 = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16) / 255);
  Object.entries({ gemTint: '#FFFFFF', gemTintA: 0, gemTintMode: 'plus-lighter', gemSpin: 0.39, strokeEvery: 1, strokeRun: 5, strokeWidth: 0.8, strokeAlpha: 1, strokeConst: 0 }).forEach(([k, v]) => { T[k] ??= v; });
  // Обводка по контуру (только силуэт, см. silEdges) — не постоянная: раз в strokeEvery с по камню по диагонали экрана (сверху-слева вниз-вправо)
  // проходит волна, рёбра в ней проявляются, к краям волны — градиент в прозрачность (гаусс). В браузере рёбра постоянные, 22 %
  const LVS = `attribute vec3 aP; uniform mat3 uM; uniform mat4 uPV; uniform vec2 uOff; varying float vAlong;
    void main() { vec3 w = uM * aP; vAlong = (w.x - w.y) * 0.7071; vec4 p = uPV * vec4(w, 1.0); gl_Position = p + vec4(uOff * p.w, 0.0, 0.0); }`;
  const LFS = `precision mediump float; uniform float uTime; uniform vec4 uStroke; uniform float uConst; varying float vAlong;   // uStroke: каждые, длительность, ширина, сила; uConst — постоянная обводка
    void main() {
      float cyc = mod(uTime, uStroke.x);
      float u = clamp(cyc / uStroke.y, 0.0, 1.0);
      float off = mix(-2.2, 2.2, u);                                   // фронт волны: от верхнего левого угла к нижнему правому
      float a = max(exp(-pow((vAlong - off) / uStroke.z, 2.0)) * step(cyc, uStroke.y) * uStroke.w, uConst);   // волна поверх постоянной обводки
      vec3 c = mix(vec3(0.624, 0.910, 1.0), vec3(1.0), a);
      gl_FragColor = vec4(c * a, a);
    }`;

  // Поза как на значке Sapfire (как в Sources/Gem.swift). Пробовали развернуть к зрителю — пользователь вернул
  const HOME = qNorm([-0.5765, -0.0120, 0.3472, -0.7395]);
  // Вращение вокруг своей оси — постоянное и медленное (оборот за 25 с), не зависит от курсора
  // Камера далеко и с узким углом — почти без перспективы, как на иконке (с 7.2 ближние грани раздувались)
  const DIST = 40;
  const FOV = 2 * Math.atan(2.0 / 0.83 / DIST);              // камень — на 83% кадра

  // Активность на странице общая для всех камней: двигается курсор или прокрутка
  let lastActivity = -1e9;
  const gems = [];
  const poke = () => { lastActivity = performance.now(); gems.forEach((g) => g.wake()); };
  addEventListener('pointermove', poke, { passive: true });
  addEventListener('scroll', poke, { passive: true });

  function compile(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function Gem(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) return null;
    const prog = compile(gl, VS, FS), lprog = compile(gl, LVS, LFS);
    const fbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(facetData), gl.STATIC_DRAW);
    const lbuf = gl.createBuffer(); const sil = new Float32Array(silEdges.length * 6);   // контур пересчитывается каждый кадр
    const U = (p, n) => gl.getUniformLocation(p, n);
    const fu = { M: U(prog, 'uM'), PV: U(prog, 'uPV'), T: U(prog, 'uTime'), C: U(prog, 'uCam'), TC: U(prog, 'uTint'), TA: U(prog, 'uTintAM') }, lu = { M: U(lprog, 'uM'), PV: U(lprog, 'uPV'), T: U(lprog, 'uTime'), S: U(lprog, 'uStroke'), K: U(lprog, 'uConst'), O: U(lprog, 'uOff') };
    const fa = { P: gl.getAttribLocation(prog, 'aP'), N: gl.getAttribLocation(prog, 'aN') }, la = gl.getAttribLocation(lprog, 'aP');

    // Проекция × вид: камера в (0, 0, DIST) смотрит в центр; кадр квадратный
    const f = 1 / Math.tan(FOV / 2), near = 0.1, far = 100, z = DIST;
    const A = (far + near) / (near - far), B = 2 * far * near / (near - far);
    const PV = new Float32Array([f, 0, 0, 0, 0, f, 0, 0, 0, 0, A, -1, 0, 0, -A * z + B, z]);

    // Состояние — как в GemSCNView
    let tilt = HOME.slice(), angle = 0, speed = 0, wobble = 0, settle = null;
    let dragging = false, lx = 0, ly = 0, lastMove = 0, vx = 0, vy = 0, idle = 0, tiltSpeed = 0;
    let last = null, raf = 0, visible = true;
    const t0 = performance.now();

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2), s = Math.round(canvas.clientWidth * dpr);
      if (canvas.width !== s) { canvas.width = canvas.height = s; }
    }

    function turn(dx, dy) {
      const a = Math.hypot(dx, dy) * 0.008;
      if (a) tilt = qMul(qAxis(a, dy, dx, 0), tilt);         // ось (dy, dx, 0); dy — вниз положительно
    }
    // Возврат к позе значка «пружиной» без отскока
    function springHome(v, dt) {
      let q = qMul(HOME, qInv(tilt));
      if (q[3] < 0) q = q.map((c) => -c);                     // короткий путь
      const s = Math.hypot(q[0], q[1], q[2]), theta = 2 * Math.atan2(s, q[3]);
      if (theta <= 0.0005) { tilt = HOME.slice(); return 0; }
      const w = 2.2;                                          // ~2 с до места
      v = Math.max(v + (w * w * theta - 2 * w * v) * dt, 0);
      tilt = qNorm(qMul(qAxis(Math.min(v * dt, theta), q[0], q[1], q[2]), tilt));
      return v;
    }
    const atHome = () => Math.abs(qMul(HOME, qInv(tilt))[3]) > 0.99999;

    function step(dt, now) {
      const active = true;                                     // крутится всегда: оборот за 25 с — не та анимация, ради которой есть reduced motion
      let d;
      if (active) {
        wobble *= Math.pow(0.05, dt);                          // докрутку прервали — доворот уходит
        settle = null;
        speed += (T.gemSpin - speed) * (1 - Math.pow(0.25, dt)); // разгон ~0,5 с; скорость — T.gemSpin, рад/с
        d = speed * dt;
      } else {
        if (!settle) {
          // Докрутить вперёд до ближайшей позы значка; время — чтобы скорость только убывала
          const full = 2 * Math.PI;
          let target = Math.ceil(angle / full) * full;
          if (target - angle < 0.02) target += speed > 0.05 ? full : 0;
          const past = angle - Math.floor(angle / full) * full;
          if (past < 0.5 && speed < 0.4) target = angle - past;  // едва отошёл — назад
          const dd = target - angle;
          const T = Math.abs(dd) < 0.001 ? 0 : dd < 0 ? 1.2 : Math.min(Math.max(1.5 * dd / Math.max(speed, 0.1), 1.2), 12);
          settle = { a0: angle, v0: speed, target, t: 0, T };
        }
        const st = settle;
        if (st.T > 0 && st.t < st.T) {
          st.t = Math.min(st.t + dt, st.T);
          // Кубическая кривая Эрмита: старт со скоростью v0, финиш в цели с нулевой скоростью
          const u = st.t / st.T, dd = st.target - st.a0;
          const h = (3 * u * u - 2 * u * u * u) * dd + (u - 2 * u * u + u * u * u) * st.v0 * st.T;
          d = st.a0 + h - angle;
          speed = d / dt;
          const amp = 0.22 * Math.min(1, Math.abs(dd) / Math.PI), b = Math.sin(Math.PI * u);
          wobble = amp * b * b;                                  // по пути чуть качнётся и выпрямится
        } else { d = 0; speed = 0; wobble = 0; }
      }
      angle += d;

      // Наклон: инерция после броска, потом плавный возврат к позе значка
      if (!dragging) {
        if (Math.hypot(vx, vy) > 4) {
          turn(vx * dt, vy * dt);
          const k = Math.pow(0.46, dt); vx *= k; vy *= k; idle = 0; tiltSpeed = 0;
        } else {
          vx = vy = 0; idle += dt;
          if (idle > 1) tiltSpeed = springHome(tiltSpeed, dt);
        }
      }
      // Всё на месте и тихо — можно не рисовать
      return active || !(settle ? settle.t >= settle.T : true) || speed !== 0 || idle <= 1 || !atHome();
    }

    function draw(now) {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.depthMask(true);                                       // иначе глубина не очистится (рёбра её выключают)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const q = qMul(qMul(tilt, qAxis(wobble, 1, 0, 0)), qAxis(angle, 0, 1, 0));
      const M = new Float32Array(qMat(q));

      gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      gl.useProgram(prog);
      gl.uniformMatrix3fv(fu.M, false, M); gl.uniformMatrix4fv(fu.PV, false, PV);
      gl.uniform1f(fu.T, (now - t0) / 1000); gl.uniform3f(fu.C, 0, 0, DIST);
      gl.uniform3f(fu.TC, ...hex3(T.gemTint)); gl.uniform2f(fu.TA, T.gemTintA, Math.max(0, TINT_MODES.indexOf(T.gemTintMode)));
      gl.bindBuffer(gl.ARRAY_BUFFER, fbuf);
      gl.enableVertexAttribArray(fa.P); gl.vertexAttribPointer(fa.P, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(fa.N); gl.vertexAttribPointer(fa.N, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, facetData.length / 6);
      gl.disableVertexAttribArray(fa.N);

      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(lprog);
      gl.uniformMatrix3fv(lu.M, false, M); gl.uniformMatrix4fv(lu.PV, false, PV);
      gl.uniform1f(lu.T, (now - t0) / 1000 + 2);              // +2 с: первая волна вскоре после загрузки
      gl.uniform4f(lu.S, Math.max(T.strokeEvery, T.strokeRun + .1), T.strokeRun, T.strokeWidth, T.strokeAlpha);
      gl.uniform1f(lu.K, T.strokeConst);
      // Рёбра силуэта в этой позе: камера в (0, 0, DIST), вид — из точки ребра в камеру; M — матрица по столбцам
      const rot = (v) => [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]];
      let nSil = 0;
      for (const e of silEdges) {
        const p = rot(e.a), view = [-p[0], -p[1], DIST - p[2]];
        const f = e.n.map((n) => { const w = rot(n); return w[0] * view[0] + w[1] * view[1] + w[2] * view[2] > 0; });
        if (f[0] !== f[1]) { sil.set(e.a, nSil * 6); sil.set(e.b, nSil * 6 + 3); nSil++; }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lbuf);
      gl.bufferData(gl.ARRAY_BUFFER, sil.subarray(0, nSil * 6), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 12, 0);
      // WebGL рисует линии в 1 пиксель — толщина за счёт сдвинутых копий (крест на ±0.5 пикселя устройства)
      const px = 1 / canvas.width;
      for (const [ox, oy] of [[0, 0], [px, 0], [-px, 0], [0, px], [0, -px]]) {
        gl.uniform2f(lu.O, ox, oy);
        gl.drawArrays(gl.LINES, 0, nSil * 2);
      }
    }

    function frame(now) {
      raf = 0;
      const dt = Math.min((now - (last ?? now)) / 1000, 0.05);
      last = now;
      const busy = dt > 0 ? step(dt, now) : true;
      draw(now);
      if (visible && busy) raf = requestAnimationFrame(frame);
      else last = null;                                         // уснул: проснётся от движения
    }
    const wake = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

    // Мышь и палец: тянешь — поворачивается; страница при этом не прокручивается
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lx = e.clientX; ly = e.clientY; vx = vy = 0; tiltSpeed = 0; lastMove = performance.now();
      canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); wake();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly, now = performance.now();
      const mdt = Math.max((now - lastMove) / 1000, 0.008);
      lastMove = now; lx = e.clientX; ly = e.clientY; idle = 0;
      vx = vx * 0.6 + (dx / mdt) * 0.4; vy = vy * 0.6 + (dy / mdt) * 0.4;
      turn(dx, dy);
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; canvas.classList.remove('drag');
      if (performance.now() - lastMove > 90) vx = vy = 0;   // держал на месте перед тем, как отпустить
      const sp = Math.hypot(vx, vy), cap = 4000;
      if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
      wake();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // Не на экране — не рисуем
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(canvas);
    addEventListener('resize', wake);

    draw(performance.now());
    return { wake };
  }

  // .live — заранее: иначе холст скрыт и у него нет размера; не вышло — снова картинка
  for (const c of document.querySelectorAll('canvas[data-gem]')) {
    const box = c.closest('.gem');
    box?.classList.add('live');
    try {
      const g = Gem(c);
      if (g) gems.push(g); else box?.classList.remove('live');
    } catch (err) { box?.classList.remove('live'); console.warn('Sapfire gem:', err); }
  }
})();
