/* GAC Scout+  (FireFight / ANZGC)
   Built on samobudo's GAC Scout+ V2, with Arrikhan's round-by-round report, merged with the original GAC Scout.
   Runs on swgoh.gg from a bookmark. Reads public swgoh.gg pages in your own browser; sends nothing anywhere else.

   What's new compared with samobudo's V2:
   - Your ally code is asked once and remembered (no hard-coded code), and can be changed in the header.
   - Counter odds blend the two players' own battles with swgoh.gg's GAC counters page (thousands of battles),
     matched to their exact defence squad where swgoh.gg has enough battles for it.
   - Suggested defence uses swgoh.gg hold data too, and stops tiny samples outranking solid ones.
   - "Keep GLs for attack" switch for the suggested defence (on by default).
   - Zones named (Front top, Front bottom, Back, Fleet) instead of swgoh.gg's numbers.
   - Round by round tab (from Arrikhan): result, score, first attack time and delay, their holds and their drops.
*/
(async () => {
  const VERSION = '2.3';
  if (!/(^|\.)swgoh\.gg$/.test(location.hostname)) {
    alert('GAC Scout+ runs on swgoh.gg. Open https://swgoh.gg in this tab, then click the bookmark again.');
    return;
  }
  const SKEY = 'gacScoutPlus:settings', RKEY = 'gacScoutPlus:rounds', GKEY = 'gacScoutPlus:global';
  const DAY = 864e5, G_TTL = 3 * DAY;

  // ---------- small helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const inc = (o, k, v = 1) => (o[k] = (o[k] || 0) + v);
  const top = (o, n = 5) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const pct = x => (x == null || isNaN(x) ? '–' : Math.round(100 * x) + '%');
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const fmtAlly = a => String(a).replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
  const kNum = n => (n >= 1000 ? (n / 1000).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(Math.round(n)));
  const sqKey = s => [...s].sort().join(',');

  // every page that fails to load is counted, so the report can say when it is working from partial data
  // Retries share a 45-second waiting budget per scout, so a blocked or overloaded swgoh.gg fails quickly instead of hanging.
  const fails = { n: 0, codes: {}, waited: 0 };
  const BUDGET = 45000;
  async function get(url, type = 'text', tries = 4) {
    let code = 'no connection';
    for (let i = 0; i < tries; i++) {
      if (fails.waited >= BUDGET && i) break;
      let wait = 1200 * (i + 1);
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (r.ok) return type === 'json' ? await r.json() : await r.text();
        code = r.status;
        if (r.status === 404) return null;
        if (r.status === 403 && i) break; // blocked (usually swgoh.gg's bot check): one retry is enough
        if (r.status === 429 || r.status === 503) { // "slow down": wait as long as asked, up to 15 seconds
          const ra = parseFloat(r.headers.get('retry-after'));
          wait = Math.min(ra > 0 ? ra * 1000 : 3000 * (i + 1), 15000);
        }
      } catch (e) { code = 'no connection'; }
      if (i < tries - 1 && fails.waited < BUDGET) { fails.waited += wait; await sleep(wait); }
    }
    fails.n++; inc(fails.codes, code);
    return null;
  }
  const getDoc = async url => { const t = await get(url); return t ? new DOMParser().parseFromString(t, 'text/html') : null; };
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { console.warn('[GAC Scout+]', e); out[k] = null; } }
    }));
    return out;
  }

  // ---------- storage ----------
  // Settings (your ally code, your defence) are kept apart from the page caches, so a full cache can never stop them saving.
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const store = load(SKEY);
  const cache = load(RKEY); cache.rounds = cache.rounds || {};
  const gstore = load(GKEY); gstore.leads = gstore.leads || {};
  try { // carry settings over from v2.1 (and your defence from samobudo's Scout+), then drop the v2.1 cache
    const old = localStorage.getItem('gacScoutPlus:v2');
    if (old) {
      const o = JSON.parse(old);
      ['myAlly', 'lastOpp', 'myDefence', 'rank', 'keepGL', 'showShips'].forEach(k => { if (store[k] == null && o[k] != null) store[k] = o[k]; });
      localStorage.removeItem('gacScoutPlus:v2');
    }
    if (!store.myDefence) { const v1 = load('gacScoutPlus:v1'); if (v1.myDefence && Array.isArray(v1.myDefence.ids)) store.myDefence = v1.myDefence; }
  } catch (e) {}
  const save = () => {
    const put = () => localStorage.setItem(SKEY, JSON.stringify(store));
    try { put(); } catch (e) {
      try { localStorage.removeItem(RKEY); localStorage.removeItem(GKEY); put(); } catch (e2) { console.warn('[GAC Scout+] could not save settings', e2); }
    }
  };
  // caches keep the most recently used entries, and shrink further if the browser's storage for swgoh.gg is full
  const putCache = (key, obj, field, max) => {
    let ks = Object.keys(obj[field]).sort((a, b) => obj[field][b].t - obj[field][a].t);
    for (let keep = Math.min(max, ks.length); ; keep = Math.floor(keep / 2)) {
      ks.slice(keep).forEach(k => delete obj[field][k]);
      ks = ks.slice(0, keep);
      try { if (keep) localStorage.setItem(key, JSON.stringify(obj)); else localStorage.removeItem(key); return; } catch (e) { if (!keep) return; }
    }
  };
  const csave = () => putCache(RKEY, cache, 'rounds', 300);
  const gsave = () => putCache(GKEY, gstore, 'leads', 60);
  let MY = store.myAlly || localStorage.getItem('gacScoutAlly') || localStorage.getItem('swgoh_gac_scout_ally') || '';

  // ---------- overlay ----------
  const old = document.getElementById('gac-scout-plus'); if (old) old.remove();
  const host = document.createElement('div');
  host.id = 'gac-scout-plus';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{all:initial}*{box-sizing:border-box}
  .wrap{position:absolute;inset:0;overflow:auto;background:#0b0f1a;color:#dde3f0;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
  header{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;padding:12px 20px;background:#111829;border-bottom:1px solid #263050}
  .brand{font-weight:800;font-size:20px;color:#8cc8ff}.brand span{color:#ffd166}.ver{color:#5d6a88;font-size:11px;margin-left:4px;font-weight:400}
  form{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}label{color:#9aa6c0;font-size:13px}
  input,select{background:#0b0f1a;color:#fff;border:1px solid #33406a;border-radius:8px;padding:8px 10px;font:inherit;width:140px;margin-left:6px}select{width:auto}
  #q{width:100%;max-width:320px;margin:0 0 10px}
  button{font:inherit;cursor:pointer}#go{background:#1f6feb;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:700}#go:disabled{opacity:.5}
  .x{margin-left:auto;background:none;border:0;color:#9aa6c0;font-size:20px}
  .status{padding:0 20px}.status span{display:block;margin-top:12px;color:#ffd166}.status .err{color:#ff7b72}
  nav{display:flex;gap:4px;flex-wrap:wrap;padding:12px 20px 0}nav button{background:#141b2e;color:#9aa6c0;border:1px solid #263050;border-radius:8px 8px 0 0;padding:8px 14px}
  nav button.on{background:#1b2440;color:#fff;border-bottom-color:#1b2440}
  main{padding:16px 20px 60px;max-width:1240px}h2{color:#8cc8ff;font-size:17px;margin:24px 0 8px}h3{color:#cfe3ff;font-size:14px;margin:14px 0 6px}
  .vs{display:flex;align-items:center;gap:16px}.vs b{display:block;font-size:18px}.vs small{color:#9aa6c0}.vs .v{color:#ffd166;font-weight:800}
  .sub{color:#8f9ab5;font-size:12px;margin:4px 0}.sub a,a.lnk{color:#8cc8ff}.warn{color:#ffb86b}
  table{border-collapse:collapse;width:100%;color:inherit;font:inherit}th,td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #1e2742}th{color:#8cc8ff;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .sq{display:flex;flex-wrap:wrap;gap:4px}.u{display:inline-flex;align-items:center;gap:4px;background:#141b2e;border:1px solid #263050;border-radius:14px;padding:2px 8px 2px 2px;font-size:12px;max-width:230px}
  .u img{width:22px;height:22px;border-radius:50%}.u>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.u i{font-style:normal;font-weight:700;font-size:11px}
  .u.miss{opacity:.55;border-style:dashed}i.me,.me{color:#7ee787}i.opp,.opp{color:#ff9e9e}
  .bar{position:relative;display:inline-block;width:120px;height:20px;background:#1e2742;border-radius:10px;overflow:hidden;vertical-align:middle}
  .bar>span{position:absolute;inset:0 auto 0 0}.bar.g>span{background:#238636}.bar.y>span{background:#9e6a03}.bar.r>span{background:#b62324}
  .bar b{position:relative;display:block;text-align:center;font-size:12px;line-height:20px}
  .conf{display:inline-block;margin-left:6px;font-size:11px;border-radius:6px;padding:1px 6px}.conf.high{background:#123d1f;color:#7ee787}.conf.med{background:#3d2e05;color:#ffd166}.conf.low{background:#3a1416;color:#ff9e9e}
  .card{background:#111829;border:1px solid #263050;border-radius:12px;padding:12px;margin:12px 0}.dh{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:6px}
  .stats{display:flex;gap:16px;flex-wrap:wrap}.stats b{display:block;font-size:16px}.stats small{color:#8f9ab5;font-size:11px}
  tr.dim{opacity:.6}.filters{display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:#9aa6c0;margin:6px 0}
  .chip{background:#141b2e;color:#dde3f0;border:1px solid #33406a;border-radius:14px;padding:4px 12px}.chip.on{background:#1f6feb;border-color:#1f6feb;color:#fff}
  .cmp td.me,.cmp td.opp{font-weight:700}.pos{color:#7ee787}.neg{color:#ff9e9e}.cmp{max-width:720px}
  .gl{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px}.gl div{display:flex;gap:8px;background:#111829;border:1px solid #263050;border-radius:8px;padding:6px 10px}
  .gl div span{margin-left:auto;font-weight:700}.gl div span+span{margin-left:8px}
  .hrs{display:flex;gap:2px;align-items:flex-end;height:90px;max-width:720px;margin:8px 0 16px}.hrs div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}
  .hrs span{display:block;width:100%;background:#1f6feb;border-radius:3px 3px 0 0;min-height:1px}.hrs small{color:#8f9ab5;font-size:10px}
  .about li{margin:8px 0;max-width:800px}
  details{margin:6px 0}summary{cursor:pointer;font-size:13px}
  .picker{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}#addu{width:260px;margin:0}
  .locked{margin-bottom:8px}button.u.lk{cursor:pointer;color:inherit;font:inherit;font-size:12px}button.u.lk:hover{border-color:#ff7b72}
  .ban{font-size:16px;color:#ffd166}.gstat{color:#8f9ab5;font-size:12px}
  .tog{display:inline-flex;align-items:center;gap:6px;margin-left:12px;cursor:pointer}.tog input{width:auto;margin:0;accent-color:#1f6feb}
  .zones{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.zone{background:#111829;border:1px solid #263050;border-radius:10px;padding:8px 12px}.zone b{display:block;color:#8cc8ff;margin-bottom:4px}.zone small{color:#8f9ab5}
  .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-width:760px}.kpi{background:#111829;border:1px solid #263050;border-radius:10px;padding:8px 12px}.kpi b{display:block;font-size:18px}.kpi small{color:#8f9ab5;font-size:11px}
  td.w{border-left:4px solid #238636}td.l{border-left:4px solid #b62324}.att li{margin:2px 0}.att{margin:4px 0 0 16px;padding:0}
  .lose{color:#ff9e9e;font-weight:700}.draw{color:#ffd166;font-weight:700}
  @media (max-width:700px){header{padding:10px;position:static}.x{position:absolute;top:8px;right:10px}main{padding:12px}table.stack,.stack tbody,.stack tr,.stack td{display:block;width:100%}.stack tr:first-child{display:none}.stack tr{border-bottom:1px solid #263050;padding:6px 0}.stack td{border:0;padding:4px 0}}</style>
  <div class="wrap"><header>
  <div class="brand">GAC Scout<span>+</span><span class="ver">v${VERSION}</span></div>
  <form id="f"><label>Your ally code <input id="me" inputmode="numeric" autocomplete="off" placeholder="123-456-789"></label>
  <label>Opponent ally code <input id="opp" inputmode="numeric" autocomplete="off" placeholder="123-456-789"></label>
  <label>Format <select id="fmt"><option value="">Auto</option><option>3v3</option><option>5v5</option></select></label>
  <button id="go">Scout</button></form>
  <button class="x" id="close" title="Close">✕</button></header>
  <div id="status" class="status"></div><nav id="tabs"></nav><main id="out"></main></div>`;
  const $ = s => root.querySelector(s);
  $('#close').onclick = () => host.remove();
  const status = (msg, err) => { $('#status').innerHTML = msg ? `<span class="${err ? 'err' : ''}">${msg}</span>` : ''; };
  const digits = s => String(s || '').replace(/\D/g, '');
  const pageAlly = (location.pathname.match(/\/p\/(\d{9})\//) || [])[1];
  if (MY) $('#me').value = fmtAlly(MY);
  if (pageAlly && pageAlly !== MY) $('#opp').value = fmtAlly(pageAlly);
  else if (store.lastOpp) $('#opp').value = fmtAlly(store.lastOpp);
  (MY ? $('#opp') : $('#me')).focus();
  $('#f').onsubmit = e => { e.preventDefault(); run(digits($('#opp').value)); };

  // ---------- unit database ----------
  let NAME = null; const IMG = {}, SHIP = {}, CAP = {};
  const nm = id => (NAME && NAME[id]) || id;
  async function loadUnits() {
    if (NAME) return;
    const [c, s] = await Promise.all([get('/api/characters/', 'json'), get('/api/ships/', 'json')]);
    NAME = {};
    (c || []).forEach(u => { NAME[u.base_id] = u.name; IMG[u.base_id] = u.image; });
    (s || []).forEach(u => { NAME[u.base_id] = u.name; IMG[u.base_id] = u.image; SHIP[u.base_id] = 1; if ((u.categories || []).includes('Capital Ship')) CAP[u.base_id] = 1; });
    if (!c || !s) { NAME = null; throw new Error("couldn't load swgoh.gg's unit list"); }
  }

  async function loadRoster(ally) {
    const j = await get(`/api/player/${ally}/`, 'json');
    if (!j) return null;
    const units = {};
    (j.units || []).forEach(x => {
      const d = x.data || x, ship = d.combat_type === 2;
      const relic = !ship && d.gear_level >= 13 ? Math.max(0, (d.relic_tier || 0) - 2) : null;
      units[d.base_id] = {
        id: d.base_id, ship, gear: d.gear_level || 0, relic, stars: d.rarity || 0, power: d.power || 0,
        zetas: (d.zeta_abilities || []).length, omis: (d.omicron_abilities || []).length, gl: !!d.is_galactic_legend,
        score: ship ? d.rarity : relic != null ? 13 + relic : d.gear_level || 0,
      };
    });
    const d = j.data || {};
    return { ally, name: d.name || ally, gp: d.galactic_power || 0, cgp: d.character_galactic_power || 0, sgp: d.ship_galactic_power || 0, guild: d.guild_name || '', units };
  }
  const lv = u => (u ? (u.ship ? u.stars + '★' : u.relic != null ? 'R' + u.relic : u.stars < 7 ? u.stars + '★ G' + u.gear : 'G' + u.gear) : '—');

  // ---------- GAC history ----------
  const ZONES4 = ['Front top', 'Front bottom', 'Fleet', 'Back'];
  const zoneName = (z, n) => (n === 4 && ZONES4[z]) || 'Zone ' + z;

  async function parseRound(r, owner) {
    const doc = await getDoc(r.h);
    if (!doc || !doc.querySelector('main')) return null;
    const txt = doc.querySelector('main').textContent.replace(/\s+/g, ' ');
    const m = txt.match(/Round \d Round \d Round \d (.+?) vs (.+?) ([\d,]+) - ([\d,]+)/) || txt.match(/Round \d Round \d Round \d (.+?) vs (.+?) \d/);
    const meta = m ? { foe: m[2].trim(), s1: m[3] ? +m[3].replace(/,/g, '') : null, s2: m[4] ? +m[4].replace(/,/g, '') : null } : { foe: '' };
    const defRe = new RegExp(`'s attacks / .*${owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'s defenses`);
    // the page lists "<owner>'s attacks / ..." first, then ".../ <owner>'s defenses"; fall back to matching the name
    const heads = [...doc.querySelectorAll('main *')].filter(e => !e.children.length && /'s attacks \/ .*'s defenses/.test(e.textContent));
    const head = heads.length === 2 ? heads[1] : heads.find(e => defRe.test(e.textContent));
    const b = [];
    for (const card of doc.querySelectorAll('.gac-counters-battle-summary')) {
      const st = {};
      card.querySelectorAll('.gac-counters-battle-summary__stat').forEach(s => {
        const l = s.querySelector('.gac-counters-battle-summary__stat-label'), v = s.querySelector('.gac-counters-battle-summary__stat-value');
        if (!l || !v) return;
        const k = l.textContent.trim();
        if (k === 'Date') { const t = v.querySelector('time'); st.date = t ? t.getAttribute('datetime') : ''; }
        else if (k === 'Zone') { const ps = [...v.querySelectorAll('path')]; st.zone = ps.findIndex(p => /is-active/.test(p.getAttribute('class') || '')); st.zn = ps.length; }
        else st[k.toLowerCase()] = v.textContent.trim();
      });
      const ids = sel => [...card.querySelectorAll(sel + ' [data-unit-def-tooltip-app]')].map(e => e.getAttribute('data-unit-def-tooltip-app'));
      const att = ids('.gac-counters-battle-summary__side--attacker'), def = ids('.gac-counters-battle-summary__side--defense');
      if (!att.length || !def.length) continue;
      // the datacron each side brought: set, level, name, focused, and which characters its top tiers boost
      const dc = sel => {
        const el = card.querySelector(sel + ' [data-player-datacron-tooltip-app]');
        if (!el) return null;
        try {
          const j = JSON.parse(el.getAttribute('data-player-datacron-tooltip-app'));
          const dv = j.derived || {};
          const chars = [...new Set((dv.tiers || []).filter(x => x.derived && x.derived.tier_id >= 9 && x.derived.scope_target_name).map(x => x.derived.scope_target_name))];
          return { s: j.set_id || 0, t: dv.tier || 0, n: dv.name || '', f: !!j.focused, c: chars };
        } catch (e) { return null; }
      };
      const adc = dc('.gac-counters-battle-summary__side--attacker'), ddc = dc('.gac-counters-battle-summary__side--defense');
      const isDef = !!head && !!(head.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING);
      b.push({ side: isDef ? 'DEF' : 'ATT', date: st.date || '', zone: st.zone, zn: st.zn, out: st.outcome || '', win: st.outcome === 'Win', banners: parseInt(st.banners) || null, att, def, adc, ddc });
    }
    return { m: meta, b };
  }

  async function loadHistory(ally, wantFmt) {
    const doc = await getDoc(`/p/${ally}/gac-history/`);
    if (!doc) return { name: ally, rounds: [], battles: [], fmt: wantFmt || '3v3', seasons: [], failed: true };
    const owner = (doc.title.match(/^(.*?)'s GAC History/) || [, ally])[1];
    const links = []; let season = null, fmt = null;
    doc.querySelectorAll('main *').forEach(el => {
      const sm = el.textContent.replace(/\s+/g, ' ').trim().match(/^Season (\d+) \((\dv\d)\)$/);
      if (sm) { season = +sm[1]; fmt = sm[2]; }
      if (el.tagName === 'A') {
        const h = el.getAttribute('href') || '';
        const lm = h.match(/gac-history\/O(\d+)\/(\d)\/$/);
        if (lm && !links.find(x => x.h === h)) links.push({ h, season, fmt, epoch: +lm[1], rn: +lm[2] });
      }
    });
    const useFmt = wantFmt || (links[0] && links[0].fmt) || '3v3';
    const same = links.filter(x => x.fmt === useFmt);
    const seasons = [...new Set(same.map(x => x.season))].slice(0, 8);
    const rounds = same.filter(x => seasons.includes(x.season));
    let done = 0;
    const res = await pool(rounds, 3, async r => {
      const k = ally + '|' + r.h;
      let c = cache.rounds[k];
      if (c && c.m && c.v === 3) c.t = Date.now();
      else {
        const p = await parseRound(r, owner);
        // only keep a round once its attack phase has been over for 12 hours, so a half-played round is never frozen
        const finished = Date.now() > r.epoch + 2 * r.rn * DAY + DAY / 2;
        if (p && p.b.length && finished) { c = { t: Date.now(), m: p.m, b: p.b, v: 3 }; cache.rounds[k] = c; }
        else c = p;
      }
      status(`Reading ${esc(owner)}'s GAC history: ${++done}/${rounds.length} rounds…`);
      return c;
    });
    csave();
    const battles = [];
    rounds.forEach((r, i) => {
      const c = res[i]; if (!c) return;
      r.foe = c.m.foe; r.my = c.m.s1; r.them = c.m.s2;
      r.result = r.my != null && r.them != null ? (r.my > r.them ? 'W' : 'L') : '';
      c.b.forEach(x => battles.push({ ...x, r: r.h, season: r.season, foe: c.m.foe }));
    });
    return { name: owner, rounds, battles, fmt: useFmt, seasons: seasons.filter(s => rounds.some(r => r.season === s)), listed: links.length };
  }

  // ---------- swgoh.gg GAC counters page ----------
  const seasonParam = {}; // fmt -> '' (default page) or '&season_id=...'
  function parseCounterRows(doc) {
    const rows = [], seen = new Set();
    doc.querySelectorAll('main [data-unit-def-tooltip-app]').forEach(t => {
      let row = t.parentElement;
      while (row && !/\bSeen\b/.test(row.textContent)) row = row.parentElement;
      if (!row || seen.has(row)) return;
      seen.add(row);
      const groups = [...row.children].filter(c => c.querySelector('[data-unit-def-tooltip-app]'));
      const m = row.textContent.replace(/\s+/g, ' ').match(/Seen ([\d.,]+)(K?) Win % (\d+)% Avg ([\d.]+)/);
      if (!m || groups.length < 2) return;
      const ids = g => [...g.querySelectorAll('[data-unit-def-tooltip-app]')].map(e => e.getAttribute('data-unit-def-tooltip-app'));
      rows.push([Math.round(parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1)), +m[3] / 100, +m[4], ids(groups[0]), ids(groups[groups.length - 1])]);
    });
    return rows;
  }
  async function globalFor(lead, fmt) {
    const ck = lead + '|' + fmt, c = gstore.leads[ck];
    if (c && Date.now() - c.t < G_TTL) return c.rows;
    const base = `/gac/counters/${lead}/?sort=seen`;
    let doc;
    if (seasonParam[fmt] == null) {
      doc = await getDoc(base);
      if (!doc || !doc.querySelector('main')) return [];
      const sm = doc.querySelector('main').textContent.replace(/\s+/g, ' ').match(/Season:\s*\d+\s*-\s*(\dv\d)/);
      if (!sm || sm[1] === fmt) seasonParam[fmt] = '';
      else {
        const a = [...doc.querySelectorAll('a[href*="season_id="]')].find(x => new RegExp(`-\\s*${fmt}`).test(x.textContent));
        seasonParam[fmt] = a ? '&season_id=' + (a.getAttribute('href').match(/season_id=([^&]+)/) || [])[1] : '';
        if (seasonParam[fmt]) doc = null;
      }
    }
    if (!doc) doc = await getDoc(base + seasonParam[fmt]);
    if (!doc) return [];
    const rows = parseCounterRows(doc);
    gstore.leads[ck] = { t: Date.now(), rows };
    return rows;
  }

  // ---------- analysis ----------
  function analyse(S) {
    const { me, opp, myHist, oppHist, G } = S;
    // all battles from both histories, deduped
    const keys = new Set(), all = [];
    const add = (b, who) => {
      const k = b.date + '|' + b.att.join() + '|' + b.def.join();
      if (keys.has(k)) return;
      keys.add(k);
      all.push({ ...b, mine: who === 'me' && b.side === 'ATT', myDef: who === 'me' && b.side === 'DEF' });
    };
    myHist.battles.forEach(b => add(b, 'me'));
    oppHist.battles.forEach(b => add(b, 'opp'));
    // history record: defLead -> attLead -> stats
    const H = {};
    all.forEach(b => {
      const d = (H[b.def[0]] = H[b.def[0]] || {});
      const o = (d[b.att[0]] = d[b.att[0]] || { n: 0, w: 0, myN: 0, myW: 0, squads: {}, ban: 0, banN: 0 });
      o.n++; if (b.win) o.w++;
      if (b.mine) { o.myN++; if (b.win) o.myW++; }
      if (b.win && b.banners) { o.ban += b.banners; o.banN++; }
      inc(o.squads, b.att.join(','));
    });
    S.all = all; S.H = H;
    // squads change over time, so the latest season counts 4x and the one before 2x when picking a "usual" line-up
    const recency = hist => season => { const i = (hist.seasons || []).indexOf(season); return i === 0 ? 4 : i === 1 ? 2 : 1; };
    const wOpp = recency(oppHist), wMine = recency(myHist);
    // "how often they set it" is measured over their two most recent seasons (all of them if that is under 6 rounds)
    const recentSeasons = (oppHist.seasons || []).slice(0, 2);
    let span = new Set(oppHist.battles.filter(b => recentSeasons.includes(b.season)).map(b => b.r));
    if (span.size < 6) span = new Set(oppHist.battles.map(b => b.r));
    S.span = span.size;
    const lastSeason = oppHist.seasons && oppHist.seasons[0];
    // their defences
    const D = {}, setIn = {}; // setIn: lead|round -> the fullest line-up seen for that lead in that round
    oppHist.battles.filter(b => b.side === 'DEF').forEach(b => {
      const L = b.def[0];
      const o = (D[L] = D[L] || { lead: L, n: 0, held: 0, rounds: new Set(), recent: false, squads: {}, zones: {}, zn: 0, ships: !!SHIP[L] });
      o.n++; if (!b.win) o.held++;
      if (b.zone >= 0 && !o.rounds.has(b.r)) { inc(o.zones, b.zone); o.zn = b.zn || o.zn; }
      o.rounds.add(b.r);
      if (b.season === lastSeason) o.recent = true;
      const rk = L + '|' + b.r;
      if (!setIn[rk] || b.def.length > setIn[rk].n) setIn[rk] = { n: b.def.length, key: b.def.join(','), season: b.season };
    });
    Object.entries(setIn).forEach(([rk, v]) => inc(D[rk.slice(0, rk.indexOf('|'))].squads, v.key, wOpp(v.season)));
    S.defs = Object.values(D).map(o => {
      const squad = top(o.squads, 1)[0][0].split(',');
      const theirLv = mean(squad.map(u => opp.units[u]).filter(Boolean).map(u => u.score));
      const zt = top(o.zones, 1)[0], zn = Object.values(o.zones).reduce((a, b) => a + b, 0);
      return { ...o, likely: [...o.rounds].filter(r => span.has(r)).length / (span.size || 1), holdRate: o.held / o.n, squad, theirLv, zone: zt ? { z: +zt[0], share: zt[1] / zn, n: zn, of: o.zn } : null };
    }).sort((a, b) => b.likely - a.likely || b.n - a.n);
    // strong teams in their roster never seen on their defence
    const seenLeads = new Set(Object.keys(D)), U = {};
    const consider = (sq, src) => {
      const L = sq[0];
      if (seenLeads.has(L) || SHIP[L] || !sq.every(u => opp.units[u])) return;
      const l = mean(sq.map(u => opp.units[u].score));
      if (l < 18 && !opp.units[L].gl) return;
      if (!U[L] || U[L].theirLv < l || (U[L].src === 'gl' && src !== 'gl')) U[L] = { lead: L, squad: sq, theirLv: l, src };
    };
    all.forEach(b => consider(b.def, 'pool'));
    all.forEach(b => consider(b.att, 'pool'));
    Object.values(opp.units).filter(u => u.gl && !u.ship).forEach(u => consider([u.id], 'gl'));
    S.unseen = Object.values(U).sort((a, b) => b.theirLv - a.theirLv).slice(0, 12)
      .map(o => ({ ...o, unseen: true, n: 0, held: 0, likely: 0, holdRate: NaN, zone: null, ships: false }));
    // their attacks
    const A = {};
    oppHist.battles.filter(b => b.side === 'ATT').forEach(b => {
      const L = b.att[0];
      const o = (A[L] = A[L] || { lead: L, n: 0, w: 0, squads: {}, lostTo: {}, beat: {} });
      o.n++;
      if (b.win) { o.w++; inc(o.beat, b.def[0]); } else inc(o.lostTo, b.def[0]);
      inc(o.squads, b.att.join(','), wOpp(b.season));
    });
    S.atts = Object.values(A).sort((a, b) => b.n - a.n);
    // timing per round
    S.byRound = {};
    oppHist.battles.filter(b => b.side === 'ATT' && b.date).forEach(b => {
      (S.byRound[b.r] = S.byRound[b.r] || { foe: b.foe, season: b.season, t: [] }).t.push(b.date);
    });
    Object.values(S.byRound).forEach(o => o.t.sort());
    // my usual defence squads and fleet
    const myByLead = {}, seenR = new Set(), fleetSq = {}, capRounds = {}, roundCaps = {};
    const fleetSeason = (myHist.battles.find(b => b.side === 'DEF' && SHIP[b.def[0]]) || {}).season;
    myHist.battles.filter(b => b.side === 'DEF').forEach(b => {
      const k = b.r + '|' + b.def.join(',');
      if (seenR.has(k)) return;
      seenR.add(k);
      const L = b.def[0];
      if (SHIP[L]) {
        inc((fleetSq[L] = fleetSq[L] || {}), b.def.join(','), wMine(b.season));
        if (b.season === fleetSeason) { (roundCaps[b.r] = roundCaps[b.r] || new Set()).add(L); (capRounds[L] = capRounds[L] || new Set()).add(b.r); }
      } else inc((myByLead[L] = myByLead[L] || {}), b.def.join(','), wMine(b.season));
    });
    S.myDefByLead = myByLead;
    // fleet defence: the capital ships you set most in your latest season (as many as you set in one round), with their usual line-ups
    S.myFleetByCap = {};
    Object.keys(fleetSq).forEach(c => (S.myFleetByCap[c] = top(fleetSq[c], 1)[0][0].split(',').filter(u => me.units[u])));
    const nFleets = Math.max(0, ...Object.values(roundCaps).map(x => x.size));
    S.fleetDetected = Object.keys(capRounds).sort((a, b) => capRounds[b].size - capRounds[a].size).slice(0, nFleets).flatMap(c => S.myFleetByCap[c]);
    S.myBattles = myHist.battles.filter(b => b.side === 'ATT').length;
    // the datacron they last ran on each defence, and with each attack team (sets rotate, so only the newest sighting counts)
    const epOf = b => +((b.r || '').match(/O(\d+)\//) || [0, 0])[1];
    S.maxEp = Math.max(0, ...oppHist.rounds.map(r => r.epoch));
    S.dcDef = {}; S.dcAtt = {};
    oppHist.battles.forEach(b => {
      const dc = b.side === 'DEF' ? b.ddc : b.adc;
      if (!dc) return;
      const map = b.side === 'DEF' ? S.dcDef : S.dcAtt, L = (b.side === 'DEF' ? b.def : b.att)[0], ep = epOf(b);
      if (!map[L] || ep > map[L].ep || (ep === map[L].ep && dc.t > map[L].dc.t)) map[L] = { ep, dc };
    });
    const wins = all.filter(b => b.win && b.banners).map(b => b.banners);
    S.defaultBan = wins.length ? mean(wins) : 60;
    // counters for every defence (seen and unseen)
    S.defs.forEach(d => (d.counters = counters(S, d.lead, d.squad, d.theirLv)));
    S.unseen.forEach(d => (d.counters = counters(S, d.lead, d.squad, d.theirLv)));
  }

  // blend their own history with swgoh.gg's counters page for one defence
  function counters(S, defLead, defSquad, theirLv) {
    const { me, H, G } = S;
    const hist = H[defLead] || {};
    const gRows = G[defLead] || [];
    const want = sqKey(defSquad);
    const exact = gRows.filter(r => r[4][0] === defLead && sqKey(r[4]) === want);
    const exN = exact.reduce((a, r) => a + r[0], 0);
    const rows = defSquad.length > 1 && exN >= 20 ? exact : gRows.filter(r => r[4][0] === defLead);
    const g = {};
    rows.forEach(([n, w, avg, att]) => {
      const o = (g[att[0]] = g[att[0]] || { n: 0, w: 0, ban: 0, banW: 0, squads: {}, rows: [] });
      o.n += n; o.w += n * w;
      if (avg) { o.ban += avg * n * w; o.banW += n * w; }
      inc(o.squads, att.join(','), n);
      o.rows.push([n, w, avg, sqKey(att)]);
    });
    const leads = new Set([...Object.keys(hist), ...Object.keys(g)]);
    const out = [...leads].map(a => {
      const h = hist[a] || { n: 0, w: 0, myN: 0, myW: 0, squads: {}, ban: 0, banN: 0 };
      const gAll = g[a] || { n: 0, w: 0, ban: 0, banW: 0, squads: {}, rows: [] };
      const sq = {};
      Object.entries(h.squads).forEach(([k, v]) => inc(sq, k, v * 5));
      Object.entries(gAll.squads).forEach(([k, v]) => inc(sq, k, v));
      const variants = top(sq, 20).map(([k]) => k.split(','));
      const squad = variants.find(v => v.every(u => me.units[u])) || variants[0];
      const missing = squad.filter(u => !me.units[u]);
      const myLv = mean(squad.map(u => me.units[u]).filter(Boolean).map(u => u.score));
      // swgoh.gg numbers for this exact attacking squad when it has 20+ battles, otherwise for every squad with this leader
      const sk = sqKey(squad), same = gAll.rows.filter(r => r[3] === sk), sameN = same.reduce((x, r) => x + r[0], 0);
      const gSquad = sameN >= 20;
      const gg = gSquad ? { n: sameN, w: same.reduce((x, r) => x + r[0] * r[1], 0), ban: same.reduce((x, r) => x + (r[2] ? r[2] * r[0] * r[1] : 0), 0), banW: same.reduce((x, r) => x + (r[2] ? r[0] * r[1] : 0), 0) } : gAll;
      const gRate = gg.n ? gg.w / gg.n : null;
      // swgoh.gg rate, itself smoothed towards 50/50 so 1 recorded win isn't read as 100%
      const k = gg.n ? Math.min(gg.n, 30) : 2, prior = gg.n ? (gg.w + 1) / (gg.n + 2) : 0.5;
      const base = (h.w + k * prior) / (h.n + k);
      const delta = !SHIP[a] && myLv && theirLv ? clamp(myLv - theirLv, -3, 3) : 0;
      const total = h.n + gg.n;
      return {
        lead: a, n: h.n, w: h.w, raw: h.n ? h.w / h.n : null, myN: h.myN, myW: h.myW, gN: gg.n, gRate, gSquad,
        squad, missing, own: !missing.length,
        ready: !missing.length && squad.every(u => { const x = me.units[u]; return x.ship ? x.stars >= 7 : x.relic != null && x.relic >= 5; }),
        myLv, delta, est: clamp(base + 0.04 * delta, 0.02, 0.98),
        conf: total >= 20 ? 'high' : total >= 6 ? 'med' : 'low', total,
        avgBan: h.banN ? h.ban / h.banN : gg.banW ? gg.ban / gg.banW : null,
        exact: rows === exact,
      };
    });
    return out.sort((x, y) => y.est - x.est || y.total - x.total);
  }

  // my defence candidates, scored against the attack teams they use
  function defenceCandidates(S) {
    const { me, all, H, G, atts } = S;
    const C = {};
    all.forEach(b => {
      const L = b.def[0];
      const o = (C[L] = C[L] || { lead: L, n: 0, held: 0, squads: {}, myN: 0, myHeld: 0, ships: !!SHIP[L] });
      o.n++; if (!b.win) o.held++;
      inc(o.squads, b.def.join(','));
      if (b.myDef) { o.myN++; if (!b.win) o.myHeld++; }
    });
    const tot = Object.values(C).reduce((a, o) => [a[0] + o.held, a[1] + o.n], [0, 0]);
    const poolHold = tot[1] ? tot[0] / tot[1] : 0.25;
    const attN = atts.reduce((a, o) => a + o.n, 0) || 1;
    return Object.values(C).map(o => {
      const squad = top(o.squads, 10).map(([k]) => k.split(',')).find(s => s.every(u => me.units[u]));
      if (!squad || o.ships) return null;
      // swgoh.gg rows where this lead defended: hold = 1 - attacker win
      const gRows = (G[o.lead] || []).filter(r => r[4][0] === o.lead);
      const gN = gRows.reduce((a, r) => a + r[0], 0), gW = gRows.reduce((a, r) => a + r[0] * r[1], 0);
      const gHold = gN ? 1 - gW / gN : null;
      const K = gN ? Math.min(gN, 30) : 10;
      const prior = (o.held + K * (gN ? (gN - gW + 10 * poolHold) / (gN + 10) : poolHold)) / (o.n + K);
      const vs = atts.map(a => {
        const h = (H[o.lead] || {})[a.lead], s = h ? h.n : 0, held = h ? h.n - h.w : 0;
        const ga = gRows.filter(r => r[3][0] === a.lead);
        const gaN = ga.reduce((x, r) => x + r[0], 0), gaW = ga.reduce((x, r) => x + r[0] * r[1], 0);
        const k = gaN ? Math.min(gaN, 30) : 2, p0 = gaN ? (gaN - gaW + 2 * prior) / (gaN + 2) : prior;
        return { lead: a.lead, n: s, held, gN: gaN, gHold: gaN ? 1 - gaW / gaN : null, p: (held + k * p0) / (s + k), weight: a.n / attN };
      });
      const score = atts.length ? vs.reduce((x, v) => x + v.p * v.weight, 0) : prior;
      const evidence = o.n + gN;
      return {
        ...o, squad, prior, gN, gHold, score, vs: vs.filter(v => v.n || v.gN).sort((a, b) => b.weight - a.weight),
        conf: evidence >= 20 ? 'high' : evidence >= 6 ? 'med' : 'low', hasGL: squad.some(u => me.units[u] && me.units[u].gl),
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }

  // ---------- plans ----------
  function plan(S) {
    const blocked = new Set([...S.locked, ...S.fleet]);
    const val = c => (S.rank === 'banners' ? c.est * (c.avgBan || S.defaultBan) : c.est);
    const defs = S.defs.filter(d => d.likely >= 0.1 || d.recent || S.defs.length <= 12).slice(0, 18);
    const free = defs.map(d => d.counters.filter(c => c.own && !c.squad.some(u => blocked.has(u))).sort((a, b) => val(b) - val(a)));
    const opts = free.map(f => f.slice(0, 4));
    let best = { score: -1, pick: [] };
    const used = new Set(), cur = [];
    const N = Math.min(9, defs.length);
    (function go(i, sc) {
      if (i === N) { if (sc > best.score) best = { score: sc, pick: [...cur] }; return; }
      for (const c of opts[i]) {
        if (c.squad.some(u => used.has(u))) continue;
        c.squad.forEach(u => used.add(u)); cur.push(c);
        go(i + 1, sc + val(c) * defs[i].likely);
        cur.pop(); c.squad.forEach(u => used.delete(u));
      }
      cur.push(null); go(i + 1, sc); cur.pop();
    })(0, 0);
    const taken = new Set(best.pick.filter(Boolean).flatMap(c => c.squad));
    // then give every defence still without a counter the best one that only uses units nobody else needs
    for (let i = 0; i < defs.length; i++) {
      if (best.pick[i]) continue;
      const c = free[i].find(c => !c.squad.some(u => taken.has(u)));
      best.pick[i] = c || null;
      if (c) c.squad.forEach(u => taken.add(u));
    }
    S.plan = defs.map((d, i) => {
      const p = best.pick[i];
      const clash = !p && (free[i][0] || d.counters.find(c => c.own));
      return { d, pick: p, clash, clashWith: clash ? clash.squad.filter(u => taken.has(u) || blocked.has(u)) : [] };
    });
    // suggested defence, kept clear of the attack plan, my placed defence and each other
    const busy = new Set([...taken, ...blocked]);
    S.defPlan = [];
    for (const c of S.defCands) {
      if (S.defPlan.length >= 8) break;
      if (S.keepGL && c.hasGL) continue;
      if (c.squad.some(u => busy.has(u))) continue;
      c.squad.forEach(u => busy.add(u));
      S.defPlan.push(c);
    }
  }

  // ---------- run ----------
  let S = null;
  async function run(oppAlly) {
    const myAlly = digits($('#me').value);
    if (!/^\d{9}$/.test(myAlly)) return status('Enter your own 9-digit ally code first. It is remembered in this browser.', true);
    if (!/^\d{9}$/.test(oppAlly)) return status('Enter a 9-digit ally code for your opponent.', true);
    if (oppAlly === myAlly) return status("That's your own ally code. Enter your opponent's.", true);
    MY = myAlly; store.myAlly = myAlly; store.lastOpp = oppAlly; save();
    $('#go').disabled = true; $('#out').innerHTML = ''; $('#tabs').innerHTML = '';
    fails.n = 0; fails.codes = {}; fails.waited = 0;
    const blockedMsg = what => {
      const codes = Object.keys(fails.codes).join(', ');
      return `swgoh.gg wouldn't give me ${what}${codes ? ` (error ${esc(codes)})` : ''}. Reload this swgoh.gg page, complete any "checking your browser" step, sign in to swgoh.gg if it asks you to, then click the bookmark again.`;
    };
    try {
      status('Loading unit names and both rosters…');
      await loadUnits();
      const [me, opp] = await Promise.all([loadRoster(myAlly), loadRoster(oppAlly)]);
      if (!opp || !me) {
        if (fails.n) return status(blockedMsg('the rosters'), true);
        return status(!opp ? `Couldn't find a player with ally code ${fmtAlly(oppAlly)} on swgoh.gg. Check the code. A player who has never been synced to swgoh.gg can't be scouted.`
          : `Couldn't find your ally code (${fmtAlly(myAlly)}) on swgoh.gg. Check it in the "Your ally code" box.`, true);
      }
      const wantFmt = $('#fmt').value || undefined;
      const oppHist = await loadHistory(oppAlly, wantFmt);
      if (oppHist.failed) return status(blockedMsg(`${esc(opp.name)}'s GAC history`), true);
      const myHist = await loadHistory(myAlly, oppHist.fmt);
      S = { me, opp, myHist, oppHist, G: {}, filter: 'own', rank: store.rank || 'odds', keepGL: store.keepGL !== false, autoFmt: !wantFmt };
      S.locked = new Set(((store.myDefence && store.myDefence.ids) || []).filter(u => me.units[u] && !me.units[u].ship));
      analyse(S);
      S.fleet = new Set((store.myFleet && Array.isArray(store.myFleet.ids) ? store.myFleet.ids : S.fleetDetected).filter(u => me.units[u] && me.units[u].ship));
      // swgoh.gg counters pages: their likely + unseen defences, then my best defence candidates
      const theirLeads = [...S.defs.filter(d => d.likely >= 0.1 || d.recent).slice(0, 18), ...S.unseen].map(d => d.lead);
      const prelim = defenceCandidates(S).slice(0, 14).map(c => c.lead);
      const leads = [...new Set([...theirLeads, ...prelim])];
      let n = 0;
      const got = await pool(leads, 3, async L => { const r = await globalFor(L, oppHist.fmt); status(`Reading swgoh.gg counters: ${++n}/${leads.length}…`); return r; });
      leads.forEach((L, i) => (S.G[L] = got[i] || []));
      gsave();
      analyse(S);
      S.defCands = defenceCandidates(S);
      plan(S);
      S.note = fails.n ? `${fails.n} swgoh.gg page${fails.n === 1 ? '' : 's'} didn't load (error ${esc(Object.keys(fails.codes).join(', '))}), so this report is missing some battles. Press Scout again in a minute to fill the gaps.` : '';
      status('');
      show('plan');
    } catch (e) {
      console.error(e);
      status('Something went wrong: ' + esc(e.message) + '. Try again in a minute (swgoh.gg may be rate-limiting). If it keeps happening, swgoh.gg may have changed its pages: tell FireFight.', true);
    } finally {
      $('#go').disabled = false;
    }
  }

  // ---------- rendering ----------
  const TABS = [['plan', 'Battle plan'], ['defs', 'Their defences & counters'], ['atts', 'Their attacks'], ['rounds', 'Round by round'], ['time', 'When they attack'], ['roster', 'Roster compare'], ['about', 'How it works']];
  const gpTxt = n => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n.toLocaleString());
  const chipU = (id, who) => {
    const u = (who === 'me' ? S.me : S.opp).units[id];
    return `<span class="u ${u ? '' : 'miss'}" title="${esc(nm(id))}">${IMG[id] ? `<img src="${esc(IMG[id])}" alt="">` : ''}<span>${esc(nm(id))}</span><i class="${who}">${u ? lv(u) : 'missing'}</i></span>`;
  };
  const squadH = (ids, who) => `<div class="sq">${ids.map(id => chipU(id, who)).join('')}</div>`;
  const bar = (x, label) => `<span class="bar ${x >= 0.75 ? 'g' : x >= 0.5 ? 'y' : 'r'}"><span style="width:${Math.round(100 * x)}%"></span><b>${label ?? pct(x)}</b></span>`;
  const confH = c => `<span class="conf ${c.conf}" title="${c.total ?? c.n} battles behind this">${c.conf === 'high' ? 'solid data' : c.conf === 'med' ? 'some data' : 'thin data'}</span>`;
  const zoneTxt = d => (d.ships ? 'Fleet' : d.zone ? zoneName(d.zone.z, d.zone.of) : 'Zone unknown');
  const zoneLong = d => (d.zone ? `${zoneTxt(d)} <small>(${pct(d.zone.share)} of ${d.zone.n} rounds)</small>` : d.ships ? 'Fleet' : 'Zone unknown');
  const banTxt = c => (c.avgBan ? Math.round(c.avgBan) : '–');
  const dcLine = (map, lead) => {
    const e = map[lead];
    if (!e) return '';
    const d = e.dc;
    const big = d.t >= 12;
    const when = e.ep === S.maxEp ? 'latest round' : 'last seen ' + new Date(e.ep).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return `<div class="sub">Datacron: <span class="${big ? 'warn' : ''}">Lvl ${d.t}${big ? ' ⚠' : ''}</span> ${esc(d.n)}${d.f ? ' (focused)' : ''}${d.c.length ? ' → ' + esc(d.c.join(', ')) : ''} <small>(${when})</small></div>`;
  };
  const recTxt = c => `${c.n ? `${c.w}/${c.n} in these histories` : 'not in these histories'}${c.myN ? ` · you ${c.myW}/${c.myN}` : ''}${c.gN ? ` · swgoh.gg ${pct(c.gRate)} of ${kNum(c.gN)}${c.gSquad ? '' : ` (all ${esc(nm(c.lead))} teams)`}` : ''}`;
  const delayMs = r => { const t = S.byRound[r.h]; if (!t || !t.t.length) return null; return Date.parse(t.t[0]) - (r.epoch + DAY + (r.rn - 1) * 2 * DAY); };
  const hm = ms => { if (ms == null || isNaN(ms)) return '—'; const m = Math.max(0, Math.round(ms / 6e4)); return '+' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const when = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function show(tab) {
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
    $('#tabs').querySelectorAll('button').forEach(b => (b.onclick = () => show(b.dataset.t)));
    const head = `<div class="vs"><div><b>${esc(S.me.name)}</b><small>${gpTxt(S.me.gp)} GP</small></div><div class="v">vs</div><div><b>${esc(S.opp.name)}</b><small>${gpTxt(S.opp.gp)} GP${S.opp.guild ? ' · ' + esc(S.opp.guild) : ''}</small></div></div>
      <p class="sub">${S.oppHist.battles.length} battles from ${S.oppHist.rounds.length} of their ${S.oppHist.fmt} rounds (seasons ${(S.oppHist.seasons || []).join(', ') || '–'}), plus ${S.myBattles} of your own attacks, blended with swgoh.gg's GAC counters page. <a href="#" data-t="about">How it works</a></p>
      ${S.autoFmt ? `<p class="sub">Format: ${S.oppHist.fmt}, from their latest finished event. swgoh.gg only lists an event once it's over, so in the first week of a new season pick the format yourself at the top.</p>` : ''}
      ${S.note ? `<p class="warn">${S.note}</p>` : ''}`;
    const body = { plan: viewPlan, defs: viewDefs, atts: viewAtts, rounds: viewRounds, time: viewTime, roster: viewRoster, about: viewAbout }[tab]();
    $('#out').innerHTML = head + body;
    wire(tab);
  }

  function persistAndReplan(tab = 'plan') {
    store.myDefence = { ids: [...S.locked], saved: new Date().toISOString() };
    store.rank = S.rank; store.keepGL = S.keepGL; save();
    plan(S); show(tab);
  }

  function wire(tab) {
    const out = $('#out');
    out.querySelectorAll('[data-t]').forEach(a => (a.onclick = e => { e.preventDefault(); show(a.dataset.t); }));
    out.querySelectorAll('[data-filter]').forEach(b => (b.onclick = () => { S.filter = b.dataset.filter; show(tab); }));
    out.querySelectorAll('[data-rank]').forEach(b => (b.onclick = () => { S.rank = b.dataset.rank; persistAndReplan(tab); }));
    out.querySelectorAll('[data-unlock]').forEach(b => (b.onclick = () => { S.locked.delete(b.dataset.unlock); persistAndReplan(tab); }));
    out.querySelectorAll('[data-lock]').forEach(b => (b.onclick = () => { b.dataset.lock.split(',').forEach(u => S.locked.add(u)); persistAndReplan(tab); }));
    const fb = $('#fleetbox'); if (fb) fb.ontoggle = () => { S.fleetOpen = fb.open; };
    const fleetEdited = () => { store.myFleet = { ids: [...S.fleet] }; S.fleetOpen = true; };
    out.querySelectorAll('[data-unfleet]').forEach(b => (b.onclick = () => { S.fleet.delete(b.dataset.unfleet); fleetEdited(); persistAndReplan(tab); }));
    const fleetReset = () => { delete store.myFleet; S.fleet = new Set(S.fleetDetected); };
    out.querySelectorAll('[data-act="fleetreset"]').forEach(b => (b.onclick = () => { fleetReset(); persistAndReplan(tab); }));
    out.querySelectorAll('[data-act="clear"]').forEach(b => (b.onclick = () => { S.locked.clear(); fleetReset(); persistAndReplan(tab); }));
    const gl = $('#keepgl'); if (gl) gl.onchange = () => { S.keepGL = gl.checked; persistAndReplan(tab); };
    const sh = $('#ships'); if (sh) sh.onchange = () => { store.showShips = sh.checked; save(); show(tab); };
    out.querySelectorAll('[data-act="export"]').forEach(b => (b.onclick = () => {
      const data = { app: 'gac-scout-plus', ally: MY, saved: new Date().toISOString(), defence: [...S.locked].map(id => ({ id, name: nm(id) })), fleet: [...S.fleet].map(id => ({ id, name: nm(id) })) };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `gac-defence-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }));
    const file = $('#impfile');
    out.querySelectorAll('[data-act="import"]').forEach(b => (b.onclick = () => file && file.click()));
    if (file) file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const pick = (list, ship) => (Array.isArray(list) ? list : []).map(x => (typeof x === 'string' ? x : x && x.id)).filter(id => S.me.units[id] && !!S.me.units[id].ship === ship);
        const ids = pick(j.defence, false), ships = pick(j.fleet, true);
        if (j.app !== 'gac-scout-plus' || !(ids.length + ships.length)) throw new Error('not a GAC Scout+ defence file');
        S.locked = new Set(ids);
        if (Array.isArray(j.fleet)) { S.fleet = new Set(ships); fleetEdited(); }
        persistAndReplan(tab);
        status(`Loaded ${ids.length} units${ships.length ? ` and ${ships.length} ships` : ''} from ${esc(f.name)}.`);
      } catch (e) { status(`Couldn't load that file: ${esc(e.message)}.`, true); }
    };
    const add = $('#addu');
    if (add) add.onchange = () => {
      const v = add.value.trim().toLowerCase();
      const u = Object.values(S.me.units).find(x => nm(x.id).toLowerCase() === v);
      if (!u) return;
      const ids = usualSquad(u.id);
      ids.forEach(id => (SHIP[id] ? S.fleet : S.locked).add(id));
      if (ids.some(id => SHIP[id])) fleetEdited();
      persistAndReplan(tab);
      setTimeout(() => $('#addu') && $('#addu').focus(), 0);
    };
    const q = $('#q');
    if (q) { q.oninput = () => { const t = q.value.toLowerCase(); root.querySelectorAll('#rt tr[data-n]').forEach(r => (r.style.display = r.dataset.n.includes(t) ? '' : 'none')); }; q.focus(); }
  }

  function usualSquad(lead) {
    if (SHIP[lead] && !CAP[lead]) return [lead];
    if (CAP[lead] && S.myFleetByCap[lead] && S.myFleetByCap[lead].length) return S.myFleetByCap[lead];
    const mine = S.myDefByLead[lead] && top(S.myDefByLead[lead], 1)[0];
    if (mine) return mine[0].split(',').filter(u => S.me.units[u]);
    const c = {};
    S.all.filter(b => b.def[0] === lead).forEach(b => inc(c, b.def.join(',')));
    const s = top(c, 20).map(([k]) => k.split(',')).find(s => s.every(u => S.me.units[u]));
    return s || [lead];
  }

  function viewMyDefence() {
    const isLead = u => !!(S.myDefByLead[u.id] || (CAP[u.id] && S.myFleetByCap[u.id]));
    const mine = Object.values(S.me.units).filter(u => !S.locked.has(u.id) && !S.fleet.has(u.id)).sort((a, b) => isLead(b) - isLead(a) || b.power - a.power);
    const saved = store.myDefence && store.myDefence.saved && S.locked.size ? ` Last changed ${esc(when(store.myDefence.saved))}.` : '';
    const chip = (id, attr) => `<button class="u lk" ${attr}="${esc(id)}" title="Remove">${IMG[id] ? `<img src="${esc(IMG[id])}" alt="">` : ''}<span>${esc(nm(id))}</span><i class="me">${lv(S.me.units[id])}</i> ✕</button>`;
    const any = S.locked.size || S.fleet.size;
    return `<h2>Your defence</h2><p class="sub">Pick a leader and the team you usually set with it is added. Tap ✕ on any unit to correct it, or add single units. The attack plan won't use them.</p>
      <p class="sub">Saved in this browser (one list, not per opponent), so it carries over to rounds 2 and 3. Use <b>Save to file</b> to move it to another device, and <b>Clear all</b> when a new GAC event starts.${saved}</p>
      <div class="picker"><input id="addu" list="myunits" placeholder="Add a unit or ship…" autocomplete="off"><datalist id="myunits">${mine.map(u => `<option value="${esc(nm(u.id))}">${lv(u)}${u.ship ? (CAP[u.id] ? ' · adds your usual fleet' : ' · ship') : S.myDefByLead[u.id] ? ' · adds your usual team' : ''}</option>`).join('')}</datalist>
      ${any ? '<button class="chip" data-act="export">Save to file</button>' : ''}<button class="chip" data-act="import">Load from file</button><input type="file" id="impfile" accept=".json,application/json" hidden>${S.locked.size || store.myFleet ? '<button class="chip" data-act="clear">Clear all</button>' : ''}</div>
      <div class="sq locked">${[...S.locked].map(id => chip(id, 'data-unlock')).join('') || '<span class="sub">No squads added yet.</span>'}</div>
      <details id="fleetbox" ${S.fleetOpen ? 'open' : ''}><summary><b>Fleet defence:</b> ${[...S.fleet].filter(id => CAP[id]).map(nm).map(esc).join(', ') || (S.fleet.size ? S.fleet.size + ' ships' : 'none')} <span class="sub">(${store.myFleet ? 'edited by you' : 'from your latest season'}; tap to change)</span></summary>
      <p class="sub">Tap ✕ to remove a ship, or add a capital ship in the box above to add its usual fleet. These ships are kept out of the attack plan.${store.myFleet ? ' <button class="chip" data-act="fleetreset">Reset from my history</button>' : ''}</p>
      <div class="sq locked">${[...S.fleet].map(id => chip(id, 'data-unfleet')).join('') || '<span class="sub">No ships.</span>'}</div></details>`;
  }

  function viewPlan() {
    const chip = (k, l) => `<button class="chip ${S.rank === k ? 'on' : ''}" data-rank="${k}">${l}</button>`;
    let h = viewMyDefence();
    if (!S.defs.length) {
      const why = S.note ? `None of ${esc(S.opp.name)}'s rounds could be read, so there's nothing to plan from yet. Press Scout again in a minute.`
        : !S.oppHist.rounds.length ? `swgoh.gg has no ${S.oppHist.fmt} GAC rounds for ${esc(S.opp.name)}${S.oppHist.listed ? ` (it lists ${S.oppHist.listed} rounds in the other format: change Format at the top)` : ' (their GAC history is empty)'}.`
        : `swgoh.gg lists ${S.oppHist.rounds.length} rounds for ${esc(S.opp.name)} but no battles could be read from them. swgoh.gg may have changed its pages: tell FireFight.`;
      return h + `<p class="warn">${why} The Roster compare tab still works.</p>` + viewDefPlan();
    }
    h += `<h2>Suggested attack plan</h2><p class="sub">The combination of your counters with the best overall result against the defences they usually set, never reusing a unit or anything on your defence.</p>
      <div class="filters">Rank by: ${chip('odds', 'Best win %')}${chip('banners', 'Most banners')}</div>
      <table class="stack"><tr><th>Their likely defence</th><th>Your counter</th><th>Est. win for you</th><th>Avg banners</th></tr>${S.plan.map(({ d, pick, clash, clashWith }) => `<tr>
      <td>${squadH(d.squad, 'opp')}<div class="sub">${zoneLong(d)} · set in ${pct(d.likely)} of their last ${S.span} rounds${d.recent ? '' : ' · not used last season'} · held ${pct(d.holdRate)} of ${d.n} attacks</div>${dcLine(S.dcDef, d.lead)}</td>
      <td>${pick ? squadH(pick.squad, 'me') + `<div class="sub">${recTxt(pick)}</div>` : clash ? `<span class="warn">Best owned counter (${esc(nm(clash.lead))}, ${pct(clash.est)}) needs ${clashWith.map(nm).map(esc).join(', ')}, already on your defence or used above.</span>` : '<span class="warn">No recorded counter you own. Check the counters tab with "All recorded".</span>'}</td>
      <td>${pick ? bar(pick.est) + confH(pick) + (pick.delta ? `<div class="sub">${pick.delta > 0 ? '+' : ''}${pick.delta.toFixed(1)} relic vs their team</div>` : '') : ''}</td>
      <td>${pick ? `<b class="ban">${banTxt(pick)}</b>${pick.avgBan ? '<div class="sub">banners per win</div>' : ''}` : ''}</td></tr>`).join('')}</table>`;
    if (S.unseen.length) h += `<h2>Other teams they could set</h2><p class="sub">Strong teams in their roster that haven't shown up on their defence (swgoh.gg only records defences that got attacked). Your best free counter, not counted in the plan above.</p>
      <table class="stack"><tr><th>Their team</th><th>Your best counter</th><th>Est. win</th></tr>${S.unseen.map(d => {
        const c = d.counters.find(c => c.own && !c.squad.some(u => S.locked.has(u) || S.fleet.has(u)));
        return `<tr><td>${squadH(d.squad, 'opp')}</td><td>${c ? squadH(c.squad, 'me') + `<div class="sub">${recTxt(c)}</div>` : '<span class="sub">No recorded counter you own</span>'}</td><td>${c ? bar(c.est) + confH(c) : ''}</td></tr>`;
      }).join('')}</table>`;
    const byZone = {};
    S.plan.forEach(p => (byZone[zoneTxt(p.d)] = byZone[zoneTxt(p.d)] || []).push(p.d));
    const order = ['Front top', 'Front bottom', 'Back', 'Fleet'];
    h += `<h2>Where they put their teams</h2><p class="sub">Most common zone for each of their defences, counted once per round.</p>
      <div class="zones">${Object.entries(byZone).sort((a, b) => (order.indexOf(a[0]) + 1 || 9) - (order.indexOf(b[0]) + 1 || 9)).map(([z, ds]) => `<div class="zone"><b>${esc(z)}</b>${ds.map(d => `<div>${esc(nm(d.lead))} <small>${d.zone ? pct(d.zone.share) : ''}</small></div>`).join('')}</div>`).join('')}</div>`;
    return h + viewDefPlan();
  }

  function viewDefPlan() {
    const users = S.atts.slice(0, 3).map(a => esc(nm(a.lead))).join(', ');
    return `<h2>Suggested defence</h2><p class="sub">Squads you own that hold best against the attack teams ${esc(S.opp.name)} uses${users ? ` (mostly ${users})` : ''}, weighted by how often they use each one, kept clear of your attack plan and each other. Tap "I've set this" once it's placed.</p>
      <div class="filters"><label class="tog"><input type="checkbox" id="keepgl" ${S.keepGL ? 'checked' : ''}> Keep Galactic Legends for attack</label></div>
      ${S.defPlan.length ? `<table class="stack"><tr><th>Your defence</th><th>Holds (est.)</th><th>Evidence</th><th></th></tr>${S.defPlan.map(c => `<tr>
      <td>${squadH(c.squad, 'me')}</td><td>${bar(c.score)}${confH({ conf: c.conf, total: c.n + c.gN })}</td>
      <td class="sub">Held ${c.held}/${c.n} in these histories${c.myN ? ` · on your defence ${c.myHeld}/${c.myN}` : ''}${c.gN ? ` · swgoh.gg holds ${pct(c.gHold)} of ${kNum(c.gN)}` : ''}${c.vs.slice(0, 3).map(v => `<br>vs ${esc(nm(v.lead))}: ${v.n ? `held ${v.held}/${v.n}` : ''}${v.n && v.gN ? ' · ' : ''}${v.gN ? `swgoh.gg ${pct(v.gHold)} of ${kNum(v.gN)}` : ''}`).join('')}</td>
      <td><button class="chip" data-lock="${esc(c.squad.join(','))}">I've set this</button></td></tr>`).join('')}</table>`
        : '<p class="sub">No recorded defence squads you own are free. Remove some units from your defence list, or untick "Keep Galactic Legends for attack".</p>'}`;
  }

  function counterTable(list) {
    return `<table class="ct stack"><tr><th>Counter</th><th>Record</th><th>Est. for you</th><th>Avg banners</th></tr>${list.map(c => `<tr class="${c.own ? '' : 'dim'}">
      <td>${squadH(c.squad, 'me')}${c.missing.length ? `<div class="sub warn">Missing: ${c.missing.map(nm).map(esc).join(', ')}</div>` : ''}${c.squad.some(u => S.locked.has(u) || S.fleet.has(u)) ? `<div class="sub warn">Uses ${c.squad.filter(u => S.locked.has(u) || S.fleet.has(u)).map(nm).map(esc).join(', ')} from your defence</div>` : ''}</td>
      <td>${c.n ? `${c.w}/${c.n}` : '–'}${c.myN ? `<div class="sub">you ${c.myW}/${c.myN}</div>` : ''}${c.gN ? `<div class="gstat">swgoh.gg ${pct(c.gRate)} of ${kNum(c.gN)}${c.gSquad ? '' : ' (all teams with this leader)'}</div>` : ''}</td>
      <td>${bar(c.est)}${confH(c)}</td><td>${banTxt(c)}</td></tr>`).join('')}</table>`;
  }

  function viewDefs() {
    const f = S.filter, chip = (k, l) => `<button class="chip ${f === k ? 'on' : ''}" data-filter="${k}">${l}</button>`;
    const pick = d => d.counters.filter(c => f === 'all' || (f === 'own' ? c.own : c.ready)).slice(0, 8);
    let h = `<h2>Their defences and what beats them</h2>
      <div class="filters">Show counters: ${chip('all', 'All recorded')}${chip('own', 'Teams I own')}${chip('ready', 'Teams I own at R5+')}<label class="tog"><input type="checkbox" id="ships" ${store.showShips ? 'checked' : ''}> Show fleets</label></div>
      ${S.defs.filter(d => store.showShips || !d.ships).map(d => {
        const list = pick(d), exact = d.counters.some(c => c.exact && c.gN);
        return `<section class="card"><div class="dh">${squadH(d.squad, 'opp')}<div class="stats"><div><b>${pct(d.likely)}</b><small>of last ${S.span} rounds</small></div><div><b>${pct(d.holdRate)}</b><small>held (${d.held}/${d.n})</small></div><div><b>${esc(zoneTxt(d))}</b><small>${d.zone ? pct(d.zone.share) + ' of rounds' : 'zone'}</small></div></div></div>${dcLine(S.dcDef, d.lead)}
        ${d.counters.some(c => c.gN) ? `<p class="sub">swgoh.gg data: ${exact ? 'this exact squad' : `any ${esc(nm(d.lead))} team`}.</p>` : ''}
        ${list.length ? counterTable(list) : `<p class="sub">No recorded counters${f !== 'all' ? ' that match this filter' : ''}.</p>`}</section>`;
      }).join('')}`;
    if (S.unseen.length) h += `<h2>Teams they own but haven't been seen setting</h2><p class="sub">swgoh.gg only records defences that someone attacked, so these strong roster teams may still turn up.</p>
      ${S.unseen.map(d => { const list = pick(d).slice(0, 5); return `<section class="card"><div class="dh">${squadH(d.squad, 'opp')}<div class="stats"><div><b>${d.src === 'gl' ? 'GL' : 'Roster'}</b><small>not seen on defence</small></div></div></div>${list.length ? counterTable(list) : '<p class="sub">No recorded counters.</p>'}</section>`; }).join('')}`;
    return h;
  }

  function viewAtts() {
    if (!S.atts.length) return '<p class="warn">No attack history found.</p>';
    return `<h2>Their attacks: what to put on defence</h2><p class="sub">Defences that beat their main attackers are the ones to set. Your levels are shown in green. The Suggested defence on the Battle plan tab turns this into a list.</p>
      <table class="stack"><tr><th>Their attack team</th><th>Wins</th><th>Lost to (set these)</th><th>Beat</th></tr>${S.atts.map(a => `<tr>
      <td>${squadH(top(a.squads, 1)[0][0].split(','), 'opp')}${dcLine(S.dcAtt, a.lead)}</td><td>${bar(a.w / a.n, `${a.w}/${a.n}`)}</td>
      <td>${top(a.lostTo).map(([id, n]) => chipU(id, 'me') + ` <small>×${n}</small>`).join('<br>') || '–'}</td>
      <td>${top(a.beat).map(([id, n]) => `${esc(nm(id))} <small>×${n}</small>`).join('<br>') || '–'}</td></tr>`).join('')}</table>`;
  }

  // Arrikhan's round-by-round report
  function viewRounds() {
    const rs = [...S.oppHist.rounds].sort((a, b) => b.epoch - a.epoch || b.rn - a.rn);
    if (!rs.length) return '<p class="warn">No rounds found.</p>';
    const done = rs.filter(r => r.result);
    const w = done.filter(r => r.result === 'W').length;
    const ds = rs.map(delayMs).filter(x => x != null);
    const holds = {}, drops = {};
    S.oppHist.battles.forEach(b => {
      if (b.win) return;
      if (b.side === 'DEF') inc(holds, b.def[0]); else inc(drops, b.def[0]);
    });
    const name = S.opp.name;
    let h = `<h2>${esc(name)}, round by round</h2><div class="kpis">
      <div class="kpi"><b>${w}W ${done.length - w}L</b><small>record (${S.oppHist.fmt}, last ${S.oppHist.seasons.length} seasons)</small></div>
      <div class="kpi"><b>${done.length ? Math.round(mean(done.map(r => r.my))) : '–'}</b><small>average score for</small></div>
      <div class="kpi"><b>${done.length ? Math.round(mean(done.map(r => r.them))) : '–'}</b><small>average score against</small></div>
      <div class="kpi"><b>${hm(ds.length ? mean(ds) : null)}</b><small>average delay to first attack</small></div></div>
      <div class="zones" style="margin-top:10px"><div class="zone"><b>Their defences that held most</b>${top(holds, 5).map(([id, n]) => `<div>${esc(nm(id))} <small>×${n}</small></div>`).join('') || '<small>None recorded</small>'}</div>
      <div class="zone"><b>Defences they dropped battles to</b>${top(drops, 5).map(([id, n]) => `<div>${esc(nm(id))} <small>×${n}</small></div>`).join('') || '<small>None recorded</small>'}</div></div>
      <p class="sub">Delay is the time from attacks opening to their first attack. A hold is an attack on their defence that wasn't a win (loss, draw or retreat).</p>`;
    const att = b => `<li><span class="${/draw/i.test(b.out) ? 'draw' : 'lose'}">${esc(b.out || 'Loss')}:</span> ${esc(nm(b.att[0]))} <span class="sub">${esc(b.att.slice(1).map(nm).join(', '))}</span></li>`;
    const group = (bs, key) => {
      const g = {};
      bs.forEach(b => (g[b[key].join(',')] = g[b[key].join(',')] || []).push(b));
      return Object.entries(g).map(([k, list]) => { const ids = k.split(','); return `<div style="margin-bottom:8px">🛡️ <b>${esc(nm(ids[0]))}</b> <span class="sub">${esc(ids.slice(1).map(nm).join(', '))}</span><ul class="att">${list.map(att).join('')}</ul></div>`; }).join('');
    };
    let lastSeason = null;
    h += `<table class="stack"><tr><th>Round</th><th>Their defence: holds</th><th>Their attacks: drops</th></tr>`;
    rs.forEach(r => {
      if (r.season !== lastSeason) { lastSeason = r.season; h += `<tr><td colspan="3"><h3>Season ${r.season}</h3></td></tr>`; }
      const bs = S.oppHist.battles.filter(b => b.r === r.h && !b.win);
      const first = S.byRound[r.h] && S.byRound[r.h].t[0];
      h += `<tr><td class="${r.result === 'W' ? 'w' : r.result === 'L' ? 'l' : ''}"><b>Round ${r.rn}</b> vs <a class="lnk" href="${esc(r.h)}" target="_blank">${esc(r.foe || 'opponent')}</a><div>${r.my != null ? `${r.result} ${r.my} to ${r.them}` : ''}</div>
        <div class="sub">${first ? `First attack ${esc(when(first))} (delay ${hm(delayMs(r))})` : 'No attacks recorded'}</div></td>
        <td>${group(bs.filter(b => b.side === 'DEF'), 'def') || '<span class="sub">No holds</span>'}</td>
        <td>${group(bs.filter(b => b.side === 'ATT'), 'def') || '<span class="sub">No dropped battles</span>'}</td></tr>`;
    });
    return h + '</table>';
  }

  function viewTime() {
    const rs = S.oppHist.rounds.filter(r => S.byRound[r.h]);
    if (!rs.length) return '<p class="warn">No attack times found.</p>';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone, hrs = {};
    rs.forEach(r => inc(hrs, new Date(S.byRound[r.h].t[0]).getHours()));
    const mx = Math.max(...Object.values(hrs));
    const ds = rs.map(delayMs).filter(x => x != null);
    return `<h2>When they attack (${esc(tz)})</h2><p class="sub">Hour of their first attack each round. Average delay from attacks opening: <b>${hm(ds.length ? mean(ds) : null)}</b>.</p>
      <div class="hrs">${Array.from({ length: 24 }, (_, i) => `<div title="${i}:00 ×${hrs[i] || 0}"><span style="height:${((hrs[i] || 0) / mx) * 100}%"></span><small>${i}</small></div>`).join('')}</div>
      <table><tr><th>Round</th><th>First attack</th><th>Delay</th><th>Last attack</th><th>Attacks</th></tr>${rs.map(r => { const t = S.byRound[r.h].t; return `<tr><td>S${r.season} R${r.rn} vs ${esc(r.foe)}</td><td>${esc(when(t[0]))}</td><td>${hm(delayMs(r))}</td><td>${esc(when(t[t.length - 1]))}</td><td>${t.length}</td></tr>`; }).join('')}</table>`;
  }

  function viewRoster() {
    const me = S.me, op = S.opp;
    const stats = p => { const us = Object.values(p.units), ch = us.filter(u => !u.ship); return { gls: us.filter(u => u.gl).length, r9: ch.filter(u => u.relic >= 9).length, r7: ch.filter(u => u.relic >= 7).length, r5: ch.filter(u => u.relic >= 5).length, zetas: ch.reduce((a, u) => a + u.zetas, 0), omis: ch.reduce((a, u) => a + u.omis, 0), ships7: us.filter(u => u.ship && u.stars >= 7).length }; };
    const a = stats(me), b = stats(op);
    const row = (l, x, y) => `<tr><td>${l}</td><td class="me">${x.toLocaleString()}</td><td class="opp">${y.toLocaleString()}</td><td class="${x >= y ? 'pos' : 'neg'}">${x - y >= 0 ? '+' : ''}${(x - y).toLocaleString()}</td></tr>`;
    const ids = [...new Set([...Object.keys(me.units), ...Object.keys(op.units)])].map(id => ({ id, a: me.units[id], b: op.units[id] }))
      .sort((x, y) => Math.max(y.a?.power || 0, y.b?.power || 0) - Math.max(x.a?.power || 0, x.b?.power || 0));
    const gls = ids.filter(x => x.a?.gl || x.b?.gl);
    const behind = ids.filter(x => x.b && !x.b.ship && (!x.a || x.b.score - (x.a.score || 0) >= 3) && x.b.relic >= 5).slice(0, 15);
    return `<h2>Roster compare</h2><table class="cmp"><tr><th></th><th class="me">${esc(me.name)}</th><th class="opp">${esc(op.name)}</th><th>Diff</th></tr>
      ${row('Galactic power', me.gp, op.gp)}${row('Character GP', me.cgp, op.cgp)}${row('Ship GP', me.sgp, op.sgp)}${row('Galactic Legends', a.gls, b.gls)}${row('Relic 9+', a.r9, b.r9)}${row('Relic 7+', a.r7, b.r7)}${row('Relic 5+', a.r5, b.r5)}${row('Zetas', a.zetas, b.zetas)}${row('Omicrons', a.omis, b.omis)}${row('7★ ships', a.ships7, b.ships7)}</table>
      <h2>Galactic Legends</h2><div class="gl">${gls.map(x => `<div>${esc(nm(x.id))}<span class="me">${lv(x.a)}</span><span class="opp">${lv(x.b)}</span></div>`).join('') || '<p class="sub">None.</p>'}</div>
      <h2>Their key units you're behind on</h2><div class="gl">${behind.map(x => `<div>${esc(nm(x.id))}<span class="me">${lv(x.a)}</span><span class="opp">${lv(x.b)}</span></div>`).join('') || '<p class="sub">Nothing major.</p>'}</div>
      <h2>Every unit</h2><input id="q" placeholder="Search a unit…"><table id="rt" class="cmp"><tr><th>Unit</th><th class="me">You</th><th class="opp">Them</th><th>Power diff</th></tr>
      ${ids.map(x => `<tr data-n="${esc(nm(x.id).toLowerCase())}"><td>${esc(nm(x.id))}</td><td class="me">${lv(x.a)}</td><td class="opp">${lv(x.b)}</td><td class="${(x.a?.power || 0) >= (x.b?.power || 0) ? 'pos' : 'neg'}">${((x.a?.power || 0) - (x.b?.power || 0)).toLocaleString()}</td></tr>`).join('')}</table>`;
  }

  function viewAbout() {
    return `<h2>How it works</h2><ul class="about">
      <li><b>Two sources of battles.</b> (1) Every battle in your GAC history and your opponent's on swgoh.gg (up to 8 seasons in the same format). (2) swgoh.gg's GAC counters page for each of their defences (the page swgoh.gg shows by default, or the latest season in the right format), which covers thousands of battles. Where swgoh.gg has 20 or more battles against their exact defence squad, only those are used; otherwise every team with the same leader. The same rule applies to your attacking squad, and the line under each counter says which you're looking at.</li>
      <li><b>Format</b> is 3v3 or 5v5. Auto uses their latest finished event. swgoh.gg only lists an event after it ends, so in the first week of a new season choose the format yourself at the top.</li>
      <li><b>Est. for you</b> starts from the swgoh.gg win rate (counted as up to 30 battles), adds the battles in your two histories on top, then nudges ±4% per relic level your counter is above or below their defence, capped at ±12%. With no swgoh.gg data it falls back to a 50/50 start worth two battles. Fleets get no relic adjustment.</li>
      <li><b>Data label</b> counts both sources: solid = 20+ battles, some = 6 to 19, thin = 5 or fewer.</li>
      <li><b>Battle plan</b> covers up to 18 of their defences (those set in at least 10% of the rounds in their two most recent seasons, or at all in the latest one). It tries every combination of your top 4 owned counters for the 9 most likely, then fills any gaps with the best counter whose units are all still free. It never reuses a unit, and leaves out everything in Your defence, fleets included. <b>Most banners</b> ranks by win chance × average banners per win.</li>
      <li><b>Your defence</b> is one list saved in this browser. Your fleet defence starts as the fleets you set in your latest season; remove ships or add a capital ship if you've changed it.</li>
      <li><b>Suggested defence</b> scores each squad you own by how often it held against each attack team your opponent uses, weighted by how often they use it. Hold rates blend the two histories with swgoh.gg's numbers for your squad's leader, so a squad with 4 holds from 5 battles can't outrank one with 38 from 81. Galactic Legends are left out unless you untick the switch.</li>
      <li><b>Their usual squad</b> for each leader is the line-up they set most, with the latest season counted 4 times and the one before twice, so a team they changed recently shows the new version.</li>
      <li><b>Zones</b> (Front top, Front bottom, Back, Fleet) are where each of their defences was placed most often, counted once per round.</li>
      <li><b>Round by round</b> lists each of their rounds: result and score, first attack time, delay from attacks opening, the attacks their defence held against, and their own failed attacks.</li>
      <li><b>Datacrons</b> are shown, not modelled: each defence and attack team shows the datacron they last ran with it (level, set, and who it boosts), taken from their newest recorded battles. ⚠ marks Lvl 12+. They are left out of the win % on purpose: sets rotate every few weeks, so most recorded battles ran under datacrons that no longer exist.</li>
      <li><b>What it can't see:</b> mods, omicrons and turn-meter luck. Datacron abilities and rerolls since their last recorded round are also invisible. A defence nobody attacked never appears in swgoh.gg's history, and the event being played right now isn't listed until it ends.</li>
      <li>Everything is read from public swgoh.gg pages in your own browser. Nothing is sent anywhere else. Finished rounds are cached in this browser, and swgoh.gg counters pages for 3 days, so later scouts are much faster.</li>
      <li>Credits: original GAC Scout by FireFight; GAC Scout+ (battle plan, defence planner, zones, banners) by samobudo; round-by-round report by Arrikhan (PHX).</li></ul>`;
  }

  if (pageAlly && MY && pageAlly !== MY) run(pageAlly);
})();
