// Живой макет окна Sapfire: панели прячутся, пространства переключаются, папки раскрываются, вкладки выбираются.
// Координаты — точки окна 1400×900 (замеры снимков tools/screens, /2). Всё видимое — вырезки настоящих снимков
// (assets/mock, собирает tools/screens/buildmock.py), каркас, раскладка и движение — здесь.
// Использование: <div class="mock" data-mock></div>; состояние панелей — классы no-side / no-bar на .mock.
(() => {
  const A = 'assets/mock/';
  const D = window.SapfireMockData;               // данные: assets/mock/data.js (цвета, заголовки — замеры снимков)
  if (!D) return;
  const V = D.ver ? `?${D.ver}` : '';             // снимки пересобираются под теми же именами — номер сборки мимо кэша

  // ── Геометрия панели (Views.swift › Metrics; замеры) ──
  const CARD = { x0: 6, y0: 6, x1: 214, y1: 894, R: 20 };          // inset 6, cardRadius 26 − 6
  const LIST = 155, ROW = 32, GAP = 6, STEP = 34, PAD = 4;         // строки 32; между блоками 6, в папке шаг 34; поле подложки 4
  const NOTCH_R = 6;                                                // углы карточки у выреза
  const blockH = n => PAD * 2 + ROW + STEP * n;                     // подложка раскрытой папки: шапка + вкладки

  const svgPath = notch => {
    const { x0, y0, x1, y1, R } = CARD, r = NOTCH_R;
    let right = `V${y1 - R}`;
    if (notch) {
      const { a, n } = notch, b = a + ROW, h = ROW / 2;
      right = `V${a - r} A${r},${r} 0 0 1 ${x1 - r},${a} H${n + h} A${h},${h} 0 0 0 ${n + h},${b} H${x1 - r} A${r},${r} 0 0 1 ${x1},${b + r} V${y1 - R}`;
    }
    return `M${x0 + R},${y0} H${x1 - R} A${R},${R} 0 0 1 ${x1},${y0 + R} ${right}
      A${R},${R} 0 0 1 ${x1 - R},${y1} H${x0 + R} A${R},${R} 0 0 1 ${x0},${y1 - R} V${y0 + R} A${R},${R} 0 0 1 ${x0 + R},${y0} Z`;
  };

  // ── Раскладка списка пространства: где стоит каждая строка и подложка ──
  // Свёрнутое сохранённое — видна только открытая вкладка (Views.swift › sidebar list); раздел — строка 28, подпись 20 посередине, шаг списка 2
  const SEC = 129;                                                  // подпись «Pinned» (шапка — вырезка до неё)
  const layout = (sp, open, savedC, tempC, active) => {
    const out = [{ key: 'sec:saved', kind: 'sec', sec: 'saved', y: SEC, n: sp.folders.length, c: savedC }]; let y = LIST;
    if (savedC) {
      if (sp.folders.some(f => f.tabs.includes(active))) { out.push({ key: `t:${active}`, kind: 'tab', t: active, y }); y += ROW + GAP; }
    } else for (const f of sp.folders) {
      const isOpen = open.has(f.id) && f.tabs.length > 0;
      if (isOpen) {
        const h = blockH(f.tabs.length);
        out.push({ key: `b:${f.id}`, kind: 'block', y, h });
        out.push({ key: `f:${f.id}`, kind: 'folder', f, open: true, y: y + PAD });
        f.tabs.forEach((t, i) => out.push({ key: `t:${t}`, kind: 'tab', t, y: y + PAD + STEP * (i + 1) }));
        y += h + GAP;
      } else {
        out.push({ key: `f:${f.id}`, kind: 'folder', f, open: false, y });
        y += ROW + GAP;
      }
    }
    out.push({ key: 'sec:temp', kind: 'sec', sec: 'temp', y, n: sp.temp.tabs.length, c: tempC });
    if (!tempC) sp.temp.tabs.forEach((t, i) => out.push({ key: `t:${t}`, kind: 'tab', t, y: y + 26 + STEP * i }));
    return out;
  };

  const ease = t => 1 - Math.pow(1 - t, 3);

  const build = el => {
    for (const k in D.spaces) for (const f of D.spaces[k].folders) f.id = f.id || f.name;
    const st = {
      space: D.start, sel: {}, open: {}, visited: new Set(), titles: {}, savedC: {}, tempC: {},
    };
    for (const k in D.spaces) { st.sel[k] = D.spaces[k].sel; st.open[k] = new Set(['★']); st.visited.add(D.spaces[k].sel); }

    el.innerHTML = `<div class="mk-win">
      <div class="mk-page"><img class="narrow margin" alt=""><img class="narrow" alt=""><img class="wide" alt=""></div>
      <div class="mk-bar"><div class="mk-barside"></div><img class="narrow" alt=""><img class="wide" alt="">
        <button class="mk-hit only-full" data-act="side" style="left:83px;top:14px;width:26px;height:24px" aria-label="Show sidebar"></button></div>
      <img class="mk-handle narrow" alt=""><img class="mk-handle wide" alt="">
      <div class="mk-side">
        <div class="mk-notch"></div>
        <div class="mk-cardclip"><svg class="mk-card" width="220" height="900" viewBox="0 0 220 900">
          <defs><clipPath id="mk-clip-${D.uid = (D.uid || 0) + 1}"><path class="clip"/></clipPath>
            <pattern id="mk-bg-${D.uid}" patternUnits="userSpaceOnUse" width="220" height="900"><image class="bgimg" width="220" height="900"/></pattern></defs>
          <path class="card"/><g class="blocks"></g></svg></div>
        <div class="mk-hdr"></div>
        <img class="mk-baroff" alt="">
        <button class="mk-hit" data-act="bar" style="left:143px;top:16px;width:26px;height:20px" aria-label="Hide toolbar"></button>
        <button class="mk-hit" data-act="side" style="left:175px;top:16px;width:26px;height:20px" aria-label="Hide sidebar"></button>
        ${D.spaceOrder.map(k => `<button class="mk-sp" data-sp="${k}" style="left:${D.spaces[k].btn - 14}px" aria-label="${D.spaces[k].name}"></button>`).join('')}
        <div class="mk-spaces"></div><div class="mk-pins"></div>
        <div class="mk-list"></div>
        <img class="mk-newtab" alt=""><img class="mk-botcap" alt="">
      </div>
      <div class="mk-hp"><div class="im"></div><div class="tt"><b></b><span></span></div></div>
      <div class="mk-fp"><svg class="bub"><path/></svg><div class="in">
        <label class="sr"><svg width="13" height="13" viewBox="0 0 13 13"><circle cx="5.5" cy="5.5" r="4.3"/><path d="M8.7 8.7 12 12"/></svg><input spellcheck="false"></label>
        <hr><div class="ls"></div><div class="mo"></div></div></div>
      <div class="mk-tophit"></div>
      <div class="mk-top"><div class="cl"><button class="sb" aria-label="Show sidebar"></button><i class="bn"></i><i class="ad"></i><i class="ae"></i><i class="rt"></i></div></div>
      <div class="mk-scene">
        <img class="sc hn" alt=""><img class="sc split" alt=""><img class="sc peek" alt=""><img class="sc card" alt=""><img class="sc incog" alt=""><img class="sc incogerase" alt="">
        <div class="sc-drop"></div><div class="sc-ghost"></div><div class="sc-keys"></div>
        <svg class="sc-cursor" width="22" height="32" viewBox="0 0 22 32"><path d="M2 1.5v24.2l6.1-5.9 3.9 9.2 4.2-1.8-3.9-9h8.4z" fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </div></div>`;
    const q = s => el.querySelector(s);
    const clipId = q('clipPath').id;
    const list = q('.mk-list'), blocks = q('.blocks');

    // Шапка пространства (светофор, профиль, кнопки, значки пространств, закреплённые, «Pinned») — вырезка; по пространству
    for (const k in D.spaces) {
      q('.mk-hdr').insertAdjacentHTML('beforeend', `<img data-sp="${k}" src="${A}${k}/hdr.png${V}" alt="">`);
    }

    // ── Страница и верхняя панель текущей вкладки: две ширины ──
    const pageKey = () => st.sel[st.space];
    const showPage = () => {
      const k = pageKey();
      const set = (sel, file) => { const im = q(sel); const src = `${A}p/${k}-${file}${V}`; if (!im.src.endsWith(src)) im.src = src; };
      set('.mk-page .narrow:not(.margin)', 'n.avif'); set('.mk-page .margin', 'm.png'); set('.mk-page .wide', 'w.avif');
      set('.mk-bar .narrow', 'tn.avif'); set('.mk-bar .wide', 'tw.avif');
      set('.mk-handle.narrow', 'hn.png'); set('.mk-handle.wide', 'hw.png');
      q('.mk-botcap').src = `${A}p/${k}-cap.png${V}`;
      el.style.setProperty('--tw', `url(${new URL(`${A}p/${k}-tw.avif${V}`, document.baseURI).href})`);   // url() в переменной считается от файла стилей — даём полный
      const P = D.pages[k];
      q('.mk-notch').style.background = P.notch || '#fff';
      el.style.setProperty('--page-bg', P.bg || '#fff'); el.style.setProperty('--bar-bg', P.bar || '#fff');
    };
    const preload = () => {
      const all = Object.values(D.spaces).map(s => s.sel);
      let i = 0;
      const next = () => { if (i >= all.length) return; const k = all[i++];
        for (const f of ['n.avif', 'w.avif', 'tn.avif', 'tw.avif', 'm.png', 'hn.png', 'hw.png', 'cap.png']) { const im = new Image(); im.src = `${A}p/${k}-${f}${V}`; }
        window.requestIdleCallback ? requestIdleCallback(next, { timeout: 600 }) : setTimeout(next, 300); };
      next();
      for (const f of ['hn.avif', 'peek.avif', 'peekcard.avif', 'split.avif']) { const im = new Image(); im.src = `${A}scene/${f}`; }
    };

    // ── Список: строки по ключу; движение — свой твин (раскладка, вырез, подложки) ──
    const rows = new Map();          // key → { el, y, from, to, op, opFrom, opTo }
    const blk = new Map();           // key → { el, y, h, from, to, op... }
    let tween = null;

    const tabData = t => D.tabs[t.split('~')[0]];
    const tabHTML = t => { const T = tabData(t), b = t.split('~')[0];
      return T.fav ? `<button class="mk-row tab" data-tab="${t}"><img class="fi web" src="${A}${T.fav}" alt=""><span class="tx"></span></button>`
        : `<button class="mk-row tab" data-tab="${t}"><img class="fi" src="${A}f/${b}-i.png${V}" alt=""><img class="fa" src="${A}f/${b}-a.png${V}" alt=""><span class="tx"></span></button>`; };
    const folderHTML = (sp, f) => `<button class="mk-row folder" data-folder="${f.id}">
      <img class="ic c" src="${A}${sp}/fold-c.png${V}" alt=""><img class="ic o" src="${A}${sp}/fold-o.png${V}" alt="">
      ${f.id === '★' ? `<img class="star" src="${A}star.png${V}" alt="">` : `<span class="tx m"></span>`}
      <span class="cnt">${f.tabs.length || ''}</span></button>`;

    // Линия раздела: черта — подпись — черта — стрелка справа (свёрнуто — число скрытого). Views.swift › SectionLine, FoldButton
    const secHTML = sec => `<div class="mk-row sec" data-sec="${sec}"><div class="mk-sec"><i class="l"></i><i class="r"></i>
      <button class="lb">${sec === 'saved' ? 'Pinned' : 'Temp'}</button>
      <button class="fold"><span class="n"></span><svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.2 3 4.5 6.2 7.8 3"/></svg></button></div></div>`;
    const target = () => layout(D.spaces[st.space], st.open[st.space], st.savedC[st.space], st.tempC[st.space], pageKey());

    const paintRow = (r, it) => {
      const e = r.el;
      if (it.kind === 'tab') {
        const T = tabData(it.t), active = it.t === pageKey();
        e.classList.toggle('on', active);
        e.querySelector('.tx').textContent = st.titles[it.t] || (st.visited.has(it.t) ? T.long : T.title);
        e.style.setProperty('--on-ink', (D.pages[it.t] || {}).ink || 'var(--ink)');
      }
      if (it.kind === 'sec') { const fold = it.sec === 'saved' || it.n > 0;
        e.classList.toggle('fold', fold); e.classList.toggle('shut', !!it.c && fold); e.querySelector('.n').textContent = it.n; }
      if (it.kind === 'folder') { e.classList.toggle('open', it.open); e.querySelector('.cnt').textContent = it.f.tabs.length || '';
        const tx = e.querySelector('.tx'); if (tx) tx.textContent = it.f.name; e.toggleAttribute('disabled', !it.f.tabs.length); }
    };

    // Состояние → цель для каждого элемента; старт твина от текущих значений
    const relayout = (instant, swapSpace) => {
      const items = target();
      const seen = new Set();
      if (swapSpace) {   // другое пространство: старые строки гаснут на месте, новые проявляются на своих
        for (const [k, r] of rows) { r.dying = true; r.opFrom = r.op; r.opTo = 0; r.from = r.to = r.y; }
        for (const [k, b] of blk) { b.dying = true; b.opFrom = b.op; b.opTo = 0; b.from = b.to = { y: b.y, h: b.h }; }
      }
      const sp = st.space;
      for (const it of items) {
        if (it.kind === 'block') {
          const key = sp + it.key; seen.add(key);
          let b = blk.get(key);
          if (!b) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', 12); rect.setAttribute('width', 196); rect.setAttribute('rx', 20);
            rect.setAttribute('clip-path', `url(#${clipId})`); rect.setAttribute('fill', 'var(--fold)');
            blocks.appendChild(rect);
            const f = items.find(x => x.key === `f:${it.key.slice(2)}`);
            const y0 = instant ? it.y : f.y - PAD;  // раскрытие: подложка растёт из строки папки
            b = { el: rect, y: y0, h: instant ? it.h : ROW + PAD * 2, op: instant || swapSpace ? (swapSpace && !instant ? 0 : 1) : 1 };
            blk.set(key, b);
          }
          b.dying = false; b.from = { y: b.y, h: b.h }; b.to = { y: it.y, h: it.h }; b.opFrom = b.op; b.opTo = 1;
          continue;
        }
        const key = it.key === 'sec:saved' ? it.key : sp + it.key; seen.add(key);
        let r = rows.get(key);
        if (r && r.dying && !swapSpace) r.late = false;   // гасла — возвращается та же строка, без копии рядом
        else if (!r) {
          const wrap = document.createElement('div');
          wrap.innerHTML = it.kind === 'tab' ? tabHTML(it.t) : it.kind === 'folder' ? folderHTML(sp, it.f) : secHTML(it.sec);
          const e = wrap.firstElementChild; list.appendChild(e);
          // новая вкладка в раскрываемой папке выезжает из-под шапки папки
          let y0 = it.y;
          if (!instant && !swapSpace && it.kind === 'tab') { const f = items.find(x => x.kind === 'folder' && x.f.tabs.includes(it.t)); if (f) y0 = f.y; }
          r = { el: e, y: y0, op: instant ? 1 : 0, kind: it.kind, late: !instant };
          rows.set(key, r);
        }
        r.dying = false; r.from = r.y; r.to = it.y; r.opFrom = r.op; r.opTo = 1; r.it = it; if (r.op >= 1) r.late = false;
        paintRow(r, it);
      }
      // ушедшие: строки свернувшейся папки въезжают под шапку и гаснут; подложка сжимается в строку
      for (const [k, r] of rows) if (!seen.has(k) && !r.dying) {
        r.dying = true; r.from = r.y; r.opFrom = r.op; r.opTo = 0;
        r.to = r.y;   // гаснет на месте: подложка папки сжимается под ней
      }
      for (const [k, b] of blk) if (!seen.has(k) && !b.dying) {
        b.dying = true; b.from = { y: b.y, h: b.h }; b.opFrom = b.op; b.opTo = 0;
        const f = items.find(x => x.key === `f:${k.slice(st.space.length + 2)}`);
        b.to = f ? { y: f.y, h: ROW } : { y: b.y, h: b.h };
      }
      // вырез под активную вкладку
      const act = items.find(x => x.kind === 'tab' && x.t === pageKey());
      notch.to = act ? act.y : null;
      if (notch.to != null && notch.y == null) notch.y = notch.to;
      notch.from = notch.y;
      start(instant ? 0 : (swapSpace ? 260 : 300));
    };

    const notch = { y: null, from: null, to: null };
    const clip = q('.clip'), card = q('.card'), notchEl = q('.mk-notch');

    const frame = p => {
      const e = ease(p);
      for (const [key, r] of rows) {
        // уходящие гаснут в первой четверти (не читаются сквозь шапку папки и новый список), новые проявляются после
        const k = r.dying ? Math.min(1, p * 4) : r.late ? Math.max(0, Math.min(1, (p - .3) / .5)) : e;
        r.y = r.from + (r.to - r.from) * e; r.op = r.opFrom + (r.opTo - r.opFrom) * k;
        r.el.style.transform = `translateY(${r.y}px)`; r.el.style.opacity = r.op;
        if (p >= 1 && r.dying) { r.el.remove(); rows.delete(key); }
      }
      for (const [k, b] of blk) {
        b.y = b.from.y + (b.to.y - b.from.y) * e; b.h = b.from.h + (b.to.h - b.from.h) * e;
        b.op = b.opFrom + (b.opTo - b.opFrom) * (b.dying ? Math.min(1, p * 1.6) : e);
        b.el.setAttribute('y', b.y); b.el.setAttribute('height', Math.max(0, b.h)); b.el.style.opacity = b.op;
        if (p >= 1 && b.dying) { b.el.remove(); blk.delete(k); }
      }
      if (notch.to == null) { notch.y = null; }
      else notch.y = notch.from == null ? notch.to : notch.from + (notch.to - notch.from) * e;
      const n = notch.y == null ? null : { a: notch.y, n: 16 };
      const d = svgPath(n); clip.setAttribute('d', d); card.setAttribute('d', d);
      notchEl.style.display = n ? 'block' : 'none';
      if (n) notchEl.style.transform = `translateY(${n.a}px)`;
    };
    const start = ms => {
      if (tween) cancelAnimationFrame(tween.raf);
      if (!ms) { frame(1); tween = null; return; }
      const t0 = performance.now();
      tween = {};
      const step = now => { if (window.__mockFreeze) return; const p = Math.min(1, (now - t0) / ms); frame(p); if (p < 1) tween.raf = requestAnimationFrame(step); else tween = null; };
      tween.raf = requestAnimationFrame(step);
    };

    // ── Пространство: шапка, цвета карточки, список ──
    const paintSpace = () => {
      const S = D.spaces[st.space];
      // градиент — фон снимком пустой панели (узор в SVG), сплошной — цветом
      if (S.cardImg) q('.bgimg').setAttribute('href', `${A}${S.cardImg}${V}`);
      el.style.setProperty('--card', S.cardImg ? `url(#${q('pattern').id})` : S.card);
      el.style.setProperty('--card-line', S.line); el.style.setProperty('--fold', S.fold);
      el.querySelectorAll('.mk-hdr img, .mk-sp').forEach(im => im.classList.toggle('on', im.dataset.sp === st.space));
      q('.mk-baroff').src = `${A}${st.space}/baroff.png${V}`;
      q('.mk-newtab').src = `${A}${st.space}/newtab.png${V}`;
      const sel = pageKey();
      el.querySelectorAll('.mk-pin').forEach(b => {
        const on = b.dataset.pin === sel; b.classList.toggle('on', on);
        b.querySelector('img').src = on ? `${A}${st.space}/pin-${b.dataset.pin}.png${V}` : '';
      });
    };

    const select = key => {
      if (pageKey() === key) return;
      st.sel[st.space] = key; st.visited.add(key);
      showPage(); paintSpace(); relayout(false);
    };
    const toggleFolder = name => {
      const o = st.open[st.space];
      if (o.has(name)) {
        o.delete(name);
        // свернули папку с активной вкладкой — выделение остаётся на вкладке, но строки не видно: выреза нет
      } else o.add(name);
      relayout(false);
    };
    const toggleSaved = () => { st.savedC[st.space] = !st.savedC[st.space]; relayout(false); };
    const toggleTemp = () => { if (!D.spaces[st.space].temp.tabs.length) return; st.tempC[st.space] = !st.tempC[st.space]; relayout(false); };
    const clearTemp = () => { D.spaces[st.space].temp.tabs = []; st.tempC[st.space] = false; relayout(false); };
    const switchSpace = k => {
      if (k === st.space) return;
      hidePops(); st.space = k; showPage(); paintSpace(); relayout(false, true);
    };

    const toggle = cls => {
      el.classList.toggle(cls, !el.classList.contains(cls)); if (cls === 'no-bar') el.classList.remove('top-on');
      el.dispatchEvent(new CustomEvent('mockchange', { bubbles: true }));
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.dataset.act) toggle(b.dataset.act === 'side' ? 'no-side' : 'no-bar');
    });
    // ── Сцены: короткие показы механик — курсор сам ходит и нажимает. Окно — витрина, не песочница ──
    const sc = s => q('.mk-scene ' + s);
    const cursor = sc('.sc-cursor'), ghost = sc('.sc-ghost'), drop = sc('.sc-drop'), keys = sc('.sc-keys');
    const origin = JSON.parse(JSON.stringify(D.spaces));
    let token = 0, cx = 700, cy = 520;
    class Cancel extends Error {}
    const alive = my => { if (my !== token) throw new Cancel(); };
    const wait = (ms, my) => new Promise((res, rej) => setTimeout(() => my === token ? res() : rej(new Cancel()), ms));
    const show = (node, on, ms = 220) => { node.style.transition = `opacity ${ms}ms ease, transform ${ms}ms cubic-bezier(.3,.75,.25,1)`; node.style.opacity = on ? 1 : 0; };
    const placeCursor = (x, y, ms) => {
      cursor.style.transition = ms ? `transform ${ms}ms cubic-bezier(.45,.05,.25,1), opacity .2s` : 'opacity .2s';
      cursor.style.transform = `translate(${x - 2}px, ${y - 1.5}px)`; cx = x; cy = y;
    };
    // путь курсора — по расстоянию: 250 мс + 0.5 мс на точку, не дольше 800
    const move = async (x, y, my) => { const ms = Math.min(800, 250 + Math.hypot(x - cx, y - cy) * .5); placeCursor(x, y, ms); await wait(ms + 60, my); };
    const press = async my => { cursor.style.transition = 'transform 90ms ease'; cursor.style.transform += ' scale(.86)'; await wait(110, my);
      cursor.style.transform = `translate(${cx - 2}px, ${cy - 1.5}px)`; await wait(90, my); };
    const img = (node, file) => { if (!node.getAttribute('src')) node.src = `${A}scene/${file}${V}`;   /* с версией сборки: пересняли кадр — кеш браузера его не подменит */ };
    const rowOf = key => rows.get(st.space + key);

    // Исходное состояние: Studio, панели на месте, папки как в данных, слой сцен пуст
    const reset = () => {
      for (const k in origin) { D.spaces[k].folders = JSON.parse(JSON.stringify(origin[k].folders)); D.spaces[k].temp = JSON.parse(JSON.stringify(origin[k].temp)); }
      st.savedC = {}; st.tempC = {};
      for (const k in D.spaces) st.open[k] = new Set(['★']);
      st.titles = {}; closeMenu(); hidePops();
      el.classList.remove('no-side', 'no-bar');
      st.space = 'studio'; showPage(); paintSpace(); relayout(true);
      el.querySelectorAll('.mk-scene .sc, .sc-drop, .sc-ghost, .sc-keys, .sc-ins').forEach(n => { n.style.transition = 'none'; n.style.opacity = 0; n.style.transform = ''; });
      ghost.innerHTML = ''; keys.textContent = '';
      el.querySelectorAll('.mk-row').forEach(r => r.classList.remove('lift', 'target'));
      cursor.style.opacity = 0;
      el.dispatchEvent(new CustomEvent('mockchange', { bubbles: true }));
    };
    const key = async (label, my) => { keys.textContent = label; show(keys, true, 160); await wait(700, my); show(keys, false, 200); };

    // Перетаскивание строки: строка на месте бледнеет (как в Sapfire — 35 %), её копия едет за курсором
    const grab = async (tabKey, my) => {
      const r = rowOf(`t:${tabKey}`), y = r.y + 16;
      await move(110, y, my); await press(my);
      ghost.innerHTML = r.el.outerHTML; ghost.firstElementChild.classList.remove('on'); ghost.firstElementChild.style.transform = 'none';
      ghost.style.transition = 'none'; ghost.style.transform = `translate(0px, ${r.y}px)`; ghost.style.opacity = 1;
      void ghost.offsetWidth;   // место применить сейчас — иначе движение начнётся от прежнего (сверху окна)
      r.el.style.opacity = .35;
      return { r, dx: 110, dy: y - r.y };
    };
    const drag = async (g, x, y, my) => {
      const ms = Math.min(800, 300 + Math.hypot(x - cx, y - cy) * .5);
      ghost.style.transition = `transform ${ms}ms cubic-bezier(.45,.05,.25,1)`; ghost.style.transform = `translate(${x - g.dx}px, ${y - g.dy}px)`;
      placeCursor(x, y, ms); await wait(ms + 60, my);
    };

    const SCENES = {
      // Пространства: три нажатия — у каждого свой цвет, свои вкладки и своя страница
      async spaces(my) {
        for (const k of ['dev', 'home', 'studio']) { await move(D.spaces[k].btn, 57, my); await press(my); switchSpace(k); await wait(1300, my); }
      },
      // Папки: свернуть и раскрыть ★
      async folders(my) {
        await move(100, 175, my); await press(my); toggleFolder('★'); await wait(1200, my);
        await press(my); toggleFolder('★'); await wait(1000, my);
        // разделы Pinned и Temp сворачиваются стрелкой справа от подписи (у Pinned — вместе со всеми папками)
        for (const [sec, flip] of [['saved', toggleSaved], ['temp', toggleTemp]]) {
          const at = () => (sec === 'saved' ? rows.get('sec:saved') : rowOf('sec:temp')).to + 10;   // Pinned — строка общая для всех пространств
          await move(188, at(), my); await press(my); flip(); await wait(1100, my);
          await move(188, at(), my); await press(my); flip(); await wait(900, my);
        }
        // навёл на свёрнутую папку — попап с поиском и её вкладками; на вкладку в открытой — превью страницы
        const d = rowOf('f:Design'); await move(110, d.y + 16, my); await wait(350, my); fpOpen(d, false); await wait(1900, my);
        fpClose(true); const f = rowOf('t:figma'); await move(110, f.y + 16, my); await wait(500, my); showHP(f, 'figma'); await wait(2000, my);
        hp.classList.remove('on'); await wait(300, my);
      },
      // Между пространствами: Figma из Studio бросаешь на значок Dev — вкладка переезжает; переключился — она там
      async across(my) {
        const g = await grab('figma', my);
        const dev = el.querySelector('.mk-sp[data-sp="dev"]');
        // строка висит под курсором (за левый край, на 16 ниже), иначе она закрыла бы значок и его подсветку
        await drag({ ...g, dx: 20, dy: -16 }, D.spaces.dev.btn, 57, my);
        dev.classList.add('target'); await wait(450, my);
        const S = D.spaces.studio; S.folders[0].tabs = S.folders[0].tabs.filter(x => x !== 'figma'); D.spaces.dev.folders[0].tabs.push('figma');
        dev.classList.remove('target'); show(ghost, false, 160); g.r.el.style.opacity = 1;
        relayout(false); await wait(900, my);
        await press(my); switchSpace('dev'); await wait(1700, my);
        await move(D.spaces.studio.btn, 57, my); await press(my); switchSpace('studio'); await wait(700, my);
      },
      // Сплит: Figma на правую половину страницы — подсветка места, отпустил — две страницы рядом
      async split(my) {
        img(sc('.split'), 'split.avif');
        const g = await grab('figma', my);
        await drag(g, 1080, 470, my);
        show(drop, true, 180); await wait(450, my);
        show(ghost, false, 120); show(drop, false, 200); g.r.el.style.opacity = 1;
        show(sc('.split'), true, 260); await wait(1600, my);
        // и обратно — в панели вкладок: Figma тащишь из строки сплита ниже в список — сплит распался
        // (строка сплита на снимке: Aurora | Figma, y 196–222; Figma — правая половина)
        await move(150, 209, my); await press(my);
        const r = rowOf('t:figma');
        ghost.innerHTML = r.el.outerHTML; const gr = ghost.firstElementChild; gr.classList.remove('on'); gr.style.transform = 'none'; gr.style.opacity = '';
        ghost.style.transition = 'none'; ghost.style.transform = 'translate(84px, 193px)'; ghost.style.opacity = 1; void ghost.offsetWidth;
        await drag({ dx: 150 - 84, dy: 16 }, 66, 243, my);   // копия встаёт строкой под строкой сплита
        ins.style.transform = 'translateY(226px)'; ins.style.opacity = 1; await wait(450, my);
        ins.style.opacity = 0; show(ghost, false, 140); show(sc('.split'), false, 260); await wait(1100, my);
      },
      // Peek: из закреплённого сайта ссылка на другой сайт открывается карточкой поверх страницы
      async peek(my) {
        img(sc('.hn'), 'hn.avif'); img(sc('.peek'), 'peek.avif'); img(sc('.card'), 'peekcard.avif');
        await move(171.5, 98.5, my); await press(my); show(sc('.hn'), true, 160); await wait(700, my);
        await move(420, 104, my); await press(my);
        const card = sc('.card'); card.style.transition = 'none'; card.style.transform = 'scale(.94)'; card.style.opacity = 0;
        show(sc('.peek'), true, 200); requestAnimationFrame(() => { card.style.transition = 'transform 340ms cubic-bezier(.3,1.25,.4,1), opacity 160ms ease'; card.style.transform = 'scale(1)'; card.style.opacity = 1; });
        await wait(420, my); card.style.transition = 'none'; card.style.opacity = 0;
        await move(1338, 104, my); await wait(1300, my); await press(my);
        card.style.opacity = 1; requestAnimationFrame(() => { card.style.transition = 'transform 160ms ease, opacity 160ms ease'; card.style.transform = 'scale(.96)'; card.style.opacity = 0; });
        show(sc('.peek'), false, 160); await wait(900, my);
      },
      // Инкогнито в том же окне: ⇧⌘N — последнее пространство (тёмная панель), значок с щитом — идёт через VPN.
      // Закрывается кнопкой Erase All (под курсором краснеет): всё стёрто — окно возвращается в Studio.
      // Кадры — настоящий Sapfire: pages/incog-s1t1 и incoghover-s1t1 (PROFILES=1, прокси 127.0.0.1:10808)
      async incognito(my) {
        img(sc('.incog'), 'incog.avif'); img(sc('.incogerase'), 'incogerase.avif');
        await key('⇧⌘N', my); show(sc('.incog'), true, 260); await wait(600, my);
        await move(157.5, 57, my); await wait(1500, my);            // значок инкогнито со щитом VPN
        await move(110, 91.5, my); show(sc('.incogerase'), true, 150); await wait(500, my);
        await press(my); show(sc('.incogerase'), false, 200); show(sc('.incog'), false, 260); await wait(900, my);
      },
      // Фокус: ⌘S и ⇧⌘L — остаётся одна страница
      async focus(my) {
        await key('⌘S', my); el.classList.add('no-side'); await wait(500, my);
        await key('⇧⌘L', my); el.classList.add('no-bar'); await wait(900, my);
        // адрес никуда не делся: курсор к полоске у верхнего края (над серединой страницы) — выезжает панель адреса, увёл — спряталась
        placeCursor(700, 330, 0); show(cursor, true, 160); await wait(200, my);
        await move(700, 9, my); await wait(150, my); el.classList.add('top-on'); await wait(1500, my);
        await move(700, 300, my); el.classList.remove('top-on'); await wait(700, my);
        show(cursor, false, 160);
        await key('⇧⌘L', my); el.classList.remove('no-bar'); await wait(400, my);
        await key('⌘S', my); el.classList.remove('no-side'); await wait(600, my);
      },
    };
    let playing = false;
    const play = async name => {
      const my = ++token; reset(); playing = true;
      if (name !== 'focus') { placeCursor(700, 520, 0); cursor.style.opacity = 1; }
      try { await SCENES[name](my); } catch (e) { if (!(e instanceof Cancel)) throw e; playing = false; return false; }
      playing = false;
      // конец: курсор, слой сцены и список гаснут — и окно тихо возвращается в исходное
      cursor.style.opacity = 0; el.querySelectorAll('.mk-scene .sc, .sc-drop, .sc-ghost').forEach(n => show(n, false, 260));
      const lst = q('.mk-list'), blk = q('.blocks');
      const dirty = name === 'across';   // сцена переложила вкладку — список гасим и собираем заново
      if (dirty) { lst.style.transition = blk.style.transition = 'opacity .2s'; lst.style.opacity = blk.style.opacity = 0; }
      await new Promise(r => setTimeout(r, 300));
      if (my !== token) return false;
      reset();
      if (dirty) requestAnimationFrame(() => { lst.style.opacity = blk.style.opacity = 1; });
      return true;
    };
    const stop = () => { token++; playing = false; reset(); };

    // ── Сам: папки раскрываются, вкладки перетаскиваются, правый щелчок — меню из Sapfire. Сайты в папках не открываются ──
    const win = q('.mk-win');
    const toWin = e => { const r = win.getBoundingClientRect(), k = r.width / 1400; return [(e.clientX - r.left) / k, (e.clientY - r.top) / k]; };
    const live = () => [...rows.values()].filter(r => !r.dying && r.it);
    const hit = (x, y) => live().find(r => y >= r.y && y < r.y + ROW && (r.kind === 'tab' ? x >= 16 && x < 204 : x >= 12 && x < 208));
    const folderOf = t => { const S = D.spaces[st.space]; return [...S.folders, S.temp].find(f => f.tabs.includes(t)); };
    const user = () => el.dispatchEvent(new CustomEvent('mockuser', { bubbles: true }));
    const ins = document.createElement('div'); ins.className = 'sc-ins'; q('.mk-scene').appendChild(ins);

    list.addEventListener('click', e => {
      const s = e.target.closest('.mk-row.sec button');
      if (s) { const sec = s.closest('.sec'); user();
        if (sec.dataset.sec === 'saved') toggleSaved();
        else if (s.classList.contains('lb') && sec.classList.contains('armed')) { disarm(sec); clearTemp(); }
        else { toggleTemp(); if (s.classList.contains('lb')) arm(sec); }
        return; }
      const b = e.target.closest('.mk-row.folder'); if (!b || dragged || b.disabled) return;
      user(); toggleFolder(b.dataset.folder);
    });
    // «Temp»: курсор задержался на подписи секунду — она становится красной «Clear», нажатие убирает временные
    let armT = 0;
    const disarm = sec => { clearTimeout(armT); sec.classList.remove('armed'); sec.querySelector('.lb').textContent = 'Temp'; };
    const arm = sec => { disarm(sec); if (!D.spaces[st.space].temp.tabs.length) return;
      armT = setTimeout(() => { sec.classList.add('armed'); sec.querySelector('.lb').textContent = 'Clear'; }, 1000); };
    list.addEventListener('pointerover', e => { const lb = e.target.closest('.sec[data-sec="temp"] .lb'); if (lb && !lb.contains(e.relatedTarget)) arm(lb.closest('.sec')); });
    list.addEventListener('pointerout', e => { const lb = e.target.closest('.sec[data-sec="temp"] .lb'); if (lb && !lb.contains(e.relatedTarget)) disarm(lb.closest('.sec')); });
    el.querySelectorAll('.mk-sp').forEach(b => b.addEventListener('click', () => { user(); switchSpace(b.dataset.sp); }));

    // Перетаскивание: строка бледнеет до 35 %, копия — за указателем; на папку — в конец, между вкладками — синяя черта
    let drag0 = null, dragged = false;
    list.addEventListener('pointerdown', e => {
      const b = e.target.closest('.mk-row.tab'); if (!b || e.button !== 0) return;
      user(); const [x, y] = toWin(e); drag0 = { t: b.dataset.tab, x, y, r: rows.get(st.space + 't:' + b.dataset.tab) }; dragged = false;
      e.preventDefault();
    });
    let dropAt = null;
    addEventListener('pointermove', e => {
      if (!drag0) return;
      const [x, y] = toWin(e);
      if (!dragged) {
        if (Math.hypot(x - drag0.x, y - drag0.y) < 4) return;
        dragged = true; const r = drag0.r;
        ghost.innerHTML = r.el.outerHTML; ghost.firstElementChild.classList.remove('on'); ghost.firstElementChild.style.transform = 'none'; ghost.firstElementChild.style.opacity = '';
        ghost.style.transition = 'none'; ghost.style.opacity = 1; r.el.style.opacity = .35;
        drag0.dy = drag0.y - r.y; drag0.dx = drag0.x;
      }
      ghost.style.transform = `translate(${x - drag0.dx}px, ${y - drag0.dy}px)`;
      el.querySelectorAll('.mk-row.target').forEach(n => n.classList.remove('target')); ins.style.opacity = 0; dropAt = null;
      const h = hit(x, y);
      if (h && h.kind === 'folder') { h.el.classList.add('target'); dropAt = { f: h.it.f, at: h.it.f.tabs.length }; }
      else if (h && h.kind === 'sec' && h.it.sec === 'temp') { dropAt = { f: D.spaces[st.space].temp, at: 0 }; st.tempC[st.space] = false; ins.style.transform = `translateY(${h.y + 24}px)`; ins.style.opacity = 1; }
      else if (h && h.kind === 'tab' && h.it.t !== drag0.t) {
        const f = folderOf(h.it.t), below = y > h.y + ROW / 2, at = f.tabs.indexOf(h.it.t) + (below ? 1 : 0);
        dropAt = { f, at }; ins.style.transform = `translateY(${h.y + (below ? ROW + 1 : -1)}px)`; ins.style.opacity = 1;
      }
    });
    // родное перетаскивание картинок отменяет указатель (pointercancel, без pointerup) — копия строки оставалась висеть
    el.addEventListener('dragstart', e => e.preventDefault());
    const dragEnd = (drop) => {
      if (!drag0) return;
      const d = drag0; drag0 = null; if (!drop) dropAt = null;
      el.querySelectorAll('.mk-row.target').forEach(n => n.classList.remove('target')); ins.style.opacity = 0;
      if (!dragged) return;
      setTimeout(() => { dragged = false; }, 0);
      show(ghost, false, 140); if (d.r) d.r.el.style.opacity = 1;
      if (!dropAt) return;
      const src = folderOf(d.t); let at = dropAt.at;
      if (src === dropAt.f && src.tabs.indexOf(d.t) < at) at--;
      src.tabs.splice(src.tabs.indexOf(d.t), 1); dropAt.f.tabs.splice(at, 0, d.t);
      relayout(false);
    };
    addEventListener('pointerup', () => dragEnd(true));
    addEventListener('pointercancel', () => dragEnd(false));
    addEventListener('blur', () => dragEnd(false));

    // Контекстное меню — пункты из Sapfire (Views.swift › TabMenu, Folders.swift › FolderMenu); чего в макете нет — приглушено
    let menu = null;
    const closeMenu = () => { if (menu) { menu.remove(); menu = null; } };
    const openMenu = (cx, cy, items, w) => {   // w — ширина как у настоящего меню (по снимку)
      closeMenu(); menu = document.createElement('div'); menu.className = 'mk-menu'; if (w) menu.style.minWidth = w + 'px';
      const build = (box, list) => {
        for (const it of list) {
          if (it === '-') { box.insertAdjacentHTML('beforeend', '<hr>'); continue; }
          const b = document.createElement('div'); b.className = 'mi' + (it.sub ? ' has' : '');
          b.innerHTML = `<span>${it.t}</span>${it.k ? `<kbd>${[...it.k].map(c => `<b>${c}</b>`).join('')}</kbd>` : ''}${it.sub ? '<i></i>' : ''}`;
          if (it.sub) { const sm = document.createElement('div'); sm.className = 'mk-menu sub'; build(sm, it.sub.length ? it.sub : [{ t: '—', off: true }]); b.appendChild(sm); }
          else b.addEventListener('click', ev => { ev.stopPropagation(); closeMenu(); if (!it.off && it.do) it.do(); });
          box.appendChild(b);
        }
      };
      build(menu, items); document.body.appendChild(menu);
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.min(cx, innerWidth - r.width - 8) + 'px'; menu.style.top = Math.max(8, Math.min(cy - 6, innerHeight - r.height - 8)) + 'px';
    };
    addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    addEventListener('scroll', closeMenu, { passive: true });

    // Переименовать: поле поверх названия строки
    const rename = (r, get, set) => {
      const inp = document.createElement('input'); inp.className = 'mk-rename'; inp.value = get();
      const tx = r.el.querySelector('.tx, .star'); const left = (r.kind === 'tab' ? 16 + 42 : 12 + 36) - 4;
      inp.style.transform = `translate(${left}px, ${r.y + 5}px)`; inp.style.width = (r.kind === 'tab' ? 146 : 150) + 'px';
      list.appendChild(inp); inp.focus(); inp.select(); if (tx) tx.style.visibility = 'hidden';
      const done = ok => { if (!inp.isConnected) return; if (ok && inp.value.trim()) set(inp.value.trim()); inp.remove(); if (tx) tx.style.visibility = ''; relayout(true); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    };
    const others = () => D.spaceOrder.filter(k => k !== st.space);
    const fid = () => 'f' + Math.random().toString(36).slice(2, 7);

    list.addEventListener('contextmenu', e => {
      const b = e.target.closest('.mk-row.tab, .mk-row.folder, .mk-row.sec'); if (!b) return;
      e.preventDefault(); user();
      const S = D.spaces[st.space];
      if (b.classList.contains('sec')) {
        if (b.dataset.sec === 'saved') openMenu(e.clientX, e.clientY, [{ t: st.savedC[st.space] ? 'Show Saved Tabs' : 'Collapse Saved Tabs', do: toggleSaved }]);
        else openMenu(e.clientX, e.clientY, [
          ...(S.temp.tabs.length ? [{ t: st.tempC[st.space] ? 'Show Temporary Tabs' : 'Collapse Temporary Tabs', do: toggleTemp }] : []),
          { t: 'New Temporary Folder…', off: true }, '-',
          { t: 'Clear Temporary Tabs', off: !S.temp.tabs.length, do: clearTemp }]);
        return;
      }
      if (b.classList.contains('tab')) {
        const t = b.dataset.tab, T = tabData(t), f = folderOf(t), r = rows.get(st.space + 't:' + t), act = t === pageKey();
        const site = T.url || (D.pages[t] ? new URL('https://' + (T.long.includes('Wikipedia') ? 'en.wikipedia.org' : t + '.com')).host : 'site');
        openMenu(e.clientX, e.clientY, [
          { t: 'Open in Split View', off: t !== 'figma', do: () => { SCENES.split(++token).catch(() => {}); } },
          { t: 'Pin', k: '⇧⌘D', off: true },
          { t: 'Duplicate', k: '⌘D', do: () => { let n = 2; while (f.tabs.includes(`${t.split('~')[0]}~${n}`)) n++; f.tabs.splice(f.tabs.indexOf(t) + 1, 0, `${t.split('~')[0]}~${n}`); relayout(false); } },
          { t: 'Auto Reload', sub: [{ t: 'Off', off: true }, '-', { t: 'Every 30 Seconds', off: true }, { t: 'Every Minute', off: true }, { t: 'Every 5 Minutes', off: true }] },
          { t: 'Move to Folder', sub: S.folders.filter(x => x !== f).map(x => ({ t: x.name, do: () => { f.tabs.splice(f.tabs.indexOf(t), 1); x.tabs.push(t); relayout(false); } })) },
          { t: 'Remove from Folder', off: f === S.temp || act, do: () => { f.tabs.splice(f.tabs.indexOf(t), 1); S.temp.tabs.unshift(t); st.tempC[st.space] = false; relayout(false); } },
          { t: 'Copy Link', k: '⇧⌘C', do: () => navigator.clipboard && navigator.clipboard.writeText('https://' + (T.url || site)).catch(() => {}) },
          { t: 'Share…', off: true },
          '-',
          { t: 'Reopen As', sub: [{ t: 'Primary', off: true }], off: true },
          { t: `Always Open ${(T.url || site).replace(/^(www|open|developer|cooking|en)\./, '')} As`, off: true, sub: [] },
          { t: 'Move to Space', off: act, sub: others().map(k => ({ t: D.spaces[k].name, do: () => { f.tabs.splice(f.tabs.indexOf(t), 1); D.spaces[k].folders[0].tabs.push(t); relayout(false); } })) },
          { t: 'Open in Incognito', off: true },
          '-',
          { t: 'Rename…', do: () => rename(r, () => b.querySelector('.tx').textContent, v => { st.titles[t] = v; }) },
          { t: 'Tidy Title', off: true },
          '-',
          { t: 'Close', k: '⌘W', off: act, do: () => { f.tabs.splice(f.tabs.indexOf(t), 1); relayout(false); } },
        ], 257);
      } else {
        const f = S.folders.find(x => x.id === b.dataset.folder), r = rows.get(st.space + 'f:' + f.id), has = f.tabs.includes(pageKey());
        const open = st.open[st.space].has(f.id);
        openMenu(e.clientX, e.clientY, [
          { t: 'Rename…', off: f.id === '★', do: () => rename(r, () => f.name, v => { f.name = v; }) },
          { t: 'Icon & Color…', off: true },
          '-',
          { t: open ? 'Collapse' : 'Expand', off: !f.tabs.length, do: () => toggleFolder(f.id) },
          { t: 'Sleep All Tabs', off: true },
          { t: 'Close All Tabs', off: has || !f.tabs.length, do: () => { f.tabs = []; relayout(false); } },
          '-',
          { t: 'New Folder Inside…', off: true },
          { t: 'Make Folder Temporary', off: true },
          { t: 'Move to Space', off: has, sub: others().map(k => ({ t: D.spaces[k].name, do: () => { S.folders.splice(S.folders.indexOf(f), 1); D.spaces[k].folders.push(f); relayout(false); } })) },
          '-',
          { t: 'Delete Folder', off: true },
          { t: 'Delete Folder and Tabs', off: has || f.id === '★', do: () => { S.folders.splice(S.folders.indexOf(f), 1); relayout(false); } },
        ], 207);
      }
    });


    // ── Наведение (TabSwitcher.swift › HoverPreview, Folders.swift › FolderPeek, Views.swift › TopBar) ──
    // Вкладка: задержался 0,5 с — справа карточка (снимок, заголовок, адрес); пока она видна, соседние — сразу. Открытую не показывает.
    const hp = q('.mk-hp'), fp = q('.mk-fp'), top = q('.mk-top');
    const HOST = { aurora: 'en.wikipedia.org', figma: 'www.figma.com', unsplash: 'unsplash.com', appledev: 'developer.apple.com' };
    const SHOT = { figma: { src: `scene/split.avif${V}`, x: 812, y: 61, w: 581 } };   // Figma — правая половина снимка сплита
    let hpT = 0, hpKey = null;
    const quiet = () => playing || drag0 || menu;
    const hideHP = (ms = 80) => { clearTimeout(hpT); hpT = setTimeout(() => { hpKey = null; hp.classList.remove('on'); }, ms); };
    const showHP = (r, t) => {
      const T = tabData(t), b = t.split('~')[0], im = hp.querySelector('.im');
      const S = SHOT[b] || (D.pages[b] && D.pages[b].bg && { src: `p/${b}-w.avif${V}`, x: 0, y: 0, w: 1400 });
      if (S) { const k = 280 / S.w; im.className = 'im snap';
        im.style.cssText = `background-image:url(${A}${S.src});background-size:${1400 * k}px ${900 * k}px;background-position:${-S.x * k}px ${-S.y * k}px`;
        im.innerHTML = ''; }
      else { im.className = 'im'; im.style.cssText = ''; im.innerHTML = `<img src="${A}${T.fav || `f/${b}-i.png`}" alt="">`; }
      hp.querySelector('b').textContent = st.titles[t] || T.long;
      hp.querySelector('span').textContent = T.url ? new URL('https://' + T.url).host : HOST[b] || '';
      const h = 280 * .62 + 64, y = Math.max(8, Math.min(r.y + ROW / 2 - h / 2, 900 - h - 8));
      hp.style.top = y + 'px'; hpKey = t; hp.classList.add('on');
    };
    // Свёрнутая папка: задержался 0,35 с (уже открыт попап другой — 0,1) — пузырь с поиском и последними вкладками
    let fpT = 0, fpF = null, overHead = false, overPop = false;
    const fpClose = (now) => { clearTimeout(fpT);
      const go = () => { fpF = null; fp.classList.remove('on'); const i = fp.querySelector('input'); if (document.activeElement === i) i.blur(); };
      if (now) go(); else fpT = setTimeout(() => { if (!overHead && !overPop) go(); }, 300); };
    const fpList = () => {
      const f = fpF, qv = fp.querySelector('input').value.trim().toLowerCase();
      const all = f.tabs, list = qv ? all.filter(t => { const T = tabData(t); return (st.titles[t] || T.long).toLowerCase().includes(qv) || (T.url || '').includes(qv); }) : all.slice(0, 5);
      fp.querySelector('.ls').innerHTML = list.length ? list.map(t => { const T = tabData(t), b = t.split('~')[0];
        return `<div class="it" data-t="${t}"><img src="${A}${T.fav || `f/${b}-i.png`}" alt=""><span>${st.titles[t] || T.title}</span></div>`; }).join('')
        : `<div class="none">${qv ? 'Nothing found' : 'No tabs'}</div>`;
      fp.querySelector('.mo').textContent = !qv && all.length > list.length ? `${all.length - list.length} more — type to search` : '';
      bubble();
    };
    // контур: скругление 10, кончик 9 слева — точно в середину строки папки (Folders.swift › PeekBubble)
    let tipY = 0;
    const bubble = () => {
      const w = 279, h = fp.querySelector('.in').offsetHeight, t = 9, R = 10, hf = 6, y = Math.min(Math.max(tipY, R + hf), h - R - hf);
      const svg = fp.querySelector('.bub'); svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.querySelector('path').setAttribute('d', `M${t + R},.25 H${w - R} A${R},${R} 0 0 1 ${w - .25},${R} V${h - R} A${R},${R} 0 0 1 ${w - R},${h - .25} H${t + R}
        A${R},${R} 0 0 1 ${t},${h - R} V${y + hf} L.5,${y} L${t},${y - hf} V${R} A${R},${R} 0 0 1 ${t + R},.25 Z`);
    };
    const fpOpen = (r, focus = true) => {   // в сцене — без фокуса: клавиатура остаётся у страницы
      fpF = r.it.f; const inp = fp.querySelector('input'); inp.value = ''; inp.placeholder = `Search in ${fpF.name}`;
      const mid = r.y + ROW / 2, y = Math.max(8, Math.min(mid - 16, 900 - 260));
      fp.style.top = y + 'px'; tipY = mid - y; fpList(); fp.classList.add('on');
      if (focus) inp.focus({ preventScroll: true });
    };
    fp.querySelector('input').addEventListener('input', fpList);
    fp.querySelector('input').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' || e.key === 'Enter') fpClose(true); });
    fp.addEventListener('click', e => { if (e.target.closest('.it')) fpClose(true); });   // сайты в макете не открываются
    fp.addEventListener('pointerenter', () => { overPop = true; clearTimeout(fpT); });
    fp.addEventListener('pointerleave', () => { overPop = false; fpClose(); });
    const hidePops = () => { clearTimeout(hpT); hpKey = null; hp.classList.remove('on'); overHead = overPop = false; fpClose(true); };

    list.addEventListener('pointerover', e => {
      const b = e.target.closest('.mk-row'); if (!b || b.contains(e.relatedTarget) || quiet()) return;
      const r = live().find(x => x.el === b); if (!r) return;
      if (r.kind === 'tab' && r.it.t !== pageKey()) {
        clearTimeout(hpT); if (hpKey) showHP(r, r.it.t); else hpT = setTimeout(() => { if (!quiet()) showHP(r, r.it.t); }, 500);
      } else hideHP();
      if (r.kind === 'folder') {
        overHead = true; clearTimeout(fpT);
        if (!r.it.open && r.it.f.tabs.length && fpF !== r.it.f) fpT = setTimeout(() => { if (overHead && !quiet()) fpOpen(r); }, fpF ? 100 : 350);
      }
    });
    list.addEventListener('pointerout', e => {
      const b = e.target.closest('.mk-row'); if (!b || b.contains(e.relatedTarget)) return;
      if (b.classList.contains('tab')) hideHP();
      if (b.classList.contains('folder')) { overHead = false; fpClose(); }
    });
    list.addEventListener('pointerdown', () => { hidePops(); }, true);
    list.addEventListener('contextmenu', () => { hidePops(); }, true);

    // Панель адреса скрыта: у верхней кромки полоска — навёл (0,12 с) — капсула с кнопками и адресом; увёл — прячется
    let topT = 0;
    const topShow = on => { clearTimeout(topT); topT = setTimeout(() => el.classList.toggle('top-on', on && el.classList.contains('no-bar')), on ? 120 : 250); };
    q('.mk-tophit').addEventListener('pointerenter', () => { if (!playing) topShow(true); });
    q('.mk-tophit').addEventListener('pointerleave', () => topShow(false));
    top.addEventListener('pointerenter', () => clearTimeout(topT));
    top.addEventListener('pointerleave', () => topShow(false));
    top.querySelector('.sb').addEventListener('click', () => { el.classList.remove('top-on'); toggle('no-side'); });
    el.addEventListener('mockchange', () => { if (!el.classList.contains('no-bar')) el.classList.remove('top-on'); });

    el.mock = {
      play, stop, scenes: Object.keys(SCENES), get playing() { return playing; },
      toggle, select, toggleFolder, switchSpace,
      set(side, bar) { el.classList.toggle('no-side', !side); el.classList.toggle('no-bar', !bar); },
      state: st,
      // сразу, без движения: пространство, выбранная вкладка, раскрытые папки (для сверки со снимками)
      jump(sp, sel, open) { st.space = sp; if (sel) { st.sel[sp] = sel; st.visited.add(sel); } if (open) st.open[sp] = new Set(open);
        showPage(); paintSpace(); relayout(true); },
    };
    const fit = () => { const w = el.parentElement.clientWidth; el.style.setProperty('--k', Math.min(1, w / 1400)); };
    if (!el.hasAttribute('data-fixed')) { new ResizeObserver(fit).observe(el.parentElement); fit(); }
    showPage(); paintSpace(); relayout(true);
    if (!el.hasAttribute('data-nopreload')) (document.readyState === 'complete' ? setTimeout(preload, 800) : addEventListener('load', () => setTimeout(preload, 800), { once: true }));
  };
  // Скрипт стоит после разметки — строим сразу, чтобы следующий скрипт страницы уже видел el.mock
  document.querySelectorAll('[data-mock]').forEach(el => { if (!el.dataset.media || matchMedia(el.dataset.media).matches) build(el); });
})();
