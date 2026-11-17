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
  const VERSION = '2.8';
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
  const gsave = () => putCache(GKEY, gstore, 'leads', 150);
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
  .dchint{border-bottom:1px dotted #5d6a88;cursor:help}
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
  let NAME = null; const IMG = {}, SHIP = {}, CAP = {}, ALIGN = {}, CATS = {}, OMI = {};
  // the GAC omicrons that exist for a squad's units in this format; with a roster, only the ones that player has applied
  const gacOmis = (squad, fmt, roster) => squad.flatMap(u => (OMI[u] || []).filter(o => o.mode === 9 || o.mode === (fmt === '5v5' ? 15 : 14))
    .filter(o => !roster || (roster.units[u] && (roster.units[u].omi || []).includes(o.skill))));
  const OQ = list => (list.length ? '&d_omicron_skill_key=' + list.map(o => o.key).join(',') : '');
  const nm = id => (NAME && NAME[id]) || id;
  async function loadUnits() {
    if (NAME) return;
    const [c, s] = await Promise.all([get('/api/characters/', 'json'), get('/api/ships/', 'json')]);
    NAME = {};
    (c || []).forEach(u => { NAME[u.base_id] = u.name; IMG[u.base_id] = u.image; ALIGN[u.base_id] = u.alignment || ''; CATS[u.base_id] = new Set(u.categories || []); });
    (s || []).forEach(u => { NAME[u.base_id] = u.name; IMG[u.base_id] = u.image; SHIP[u.base_id] = 1; if ((u.categories || []).includes('Capital Ship')) CAP[u.base_id] = 1; });
    if (!c || !s) { NAME = null; throw new Error("couldn't load swgoh.gg's unit list"); }
    // GAC omicrons: swgoh.gg's omicron_mode 9 = all GAC, 14 = GAC 3v3 only, 15 = GAC 5v5 only
    const ab = await get('/api/abilities/', 'json');
    (ab || []).filter(a => a.is_omicron && [9, 14, 15].includes(a.omicron_mode) && a.character_base_id)
      .forEach(a => (OMI[a.character_base_id] = OMI[a.character_base_id] || []).push({ key: a.character_base_id + ':' + a.base_id, skill: a.base_id, mode: a.omicron_mode, name: a.name }));
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
        zetas: (d.zeta_abilities || []).length, omis: (d.omicron_abilities || []).length, omi: d.omicron_abilities || [], gl: !!d.is_galactic_legend,
        score: ship ? d.rarity : relic != null ? 13 + relic : d.gear_level || 0,
      };
    });
    // datacrons: only the ability tiers they have reached (3 alignment, 6 faction, 9 character; focused ones have a character at every third tier)
    const dcs = (j.datacrons || []).map(x => ({
      id: x.id, s: x.set_id | 0, lv: x.tier | 0, f: /focused/.test(x.template_base_id || ''),
      ab: (x.tiers || []).map((t, i) => ({ i: i + 1, type: t.scope_target_type, id: t.scope_target_id, name: t.scope_target_name || '' }))
        .filter(t => t.i <= (x.tier | 0) && t.type >= 2 && t.type <= 4),
    })).filter(x => x.lv > 0);
    const d = j.data || {};
    return { ally, name: d.name || ally, gp: d.galactic_power || 0, cgp: d.character_galactic_power || 0, sgp: d.ship_galactic_power || 0, guild: d.guild_name || '', league: d.league_name || '', division: d.division_number | 0, units, dcs };
  }

  // ---------- datacrons: how much of a datacron actually works for a squad ----------
  // Tier 3 (alignment) and 6 (faction) work if any squad member matches; tier 9+ (character) only if that character is in it.
  // "band" is the highest ability tier that works: 0 (none), 3, 6 or 9. Insight is filtered to battles with a datacron of
  // similar strength: none, level 1-5, or level 6+.
  const dcLive = dc => { const si = S0_sets[dc.s]; return !si || si.active; };
  function dcFit(dc, squad) {
    let band = 0; const hit = [];
    for (const t of dc.ab) {
      const ok = t.type === 4 ? squad.includes(t.id)
        : t.type === 3 ? squad.some(u => CATS[u] && CATS[u].has(t.name))
        : squad.some(u => ALIGN[u] === t.name);
      if (ok) { band = Math.max(band, t.i >= 9 ? 9 : t.i >= 6 ? 6 : 3); hit.push(t.name); }
    }
    return { band, hit };
  }
  // the strongest free datacron for a squad (ties go to the lower level, keeping the big ones for elsewhere)
  function bestDc(dcs, squad, used) {
    let best = null;
    for (const dc of dcs || []) {
      if (used && used.has(dc.id)) continue;
      if (!dcLive(dc) || squad.some(u => SHIP[u])) continue;
      const f = dcFit(dc, squad);
      if (!f.band) continue;
      if (!best || f.band > best.band || (f.band === best.band && dc.lv < best.dc.lv)) best = { dc, band: f.band, hit: f.hit };
    }
    return best;
  }
  const bandKey = b => (!b ? 'none' : b >= 6 ? 'high' : 'low');
  const DQ = b => (b == null ? '' : !b ? '&d_has_datacron=false' : b >= 6 ? '&d_datacron_tier=6:15' : '&d_datacron_tier=1:5');
  const AQ = { none: '&a_has_datacron=false', low: '&a_datacron_tier=1:5', high: '&a_datacron_tier=6:15', has: '&a_has_datacron=true' };
  const setName = s => (S0_sets[s] && S0_sets[s].n) || 'set ' + s;
  const dcTxt = (x, who) => x ? `${who} Lvl ${x.dc.lv} ${esc(setName(x.dc.s))}${x.dc.f ? ' (focused)' : ''} datacron${x.hit.length ? ' (' + esc(x.hit.slice(-1)[0]) + ')' : ''}` : '';
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
          // character tiers carry unit_target_base_id; stat and reroll tiers don't, so this keeps only the boosted characters
          const charTiers = (dv.tiers || []).filter(x => x.derived && x.derived.unit_target_base_id && x.derived.scope_target_name);
          const chars = [...new Set(charTiers.map(x => x.derived.scope_target_name))];
          // their ability text, so hovering the datacron line shows what it actually does (capped to keep the cache small)
          const abil = charTiers.filter(x => x.derived.ability_description).slice(0, 3)
            .map(x => (x.derived.scope_target_name + ': ' + x.derived.ability_description.replace(/\s+/g, ' ')).slice(0, 180));
          return { s: j.set_id || 0, t: dv.tier || 0, n: dv.name || '', f: !!j.focused, c: chars, a: abil };
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
      if (c && c.m && c.v === 4) c.t = Date.now();
      else {
        const p = await parseRound(r, owner);
        // only keep a round once its attack phase has been over for 12 hours, so a half-played round is never frozen
        const finished = Date.now() > r.epoch + 2 * r.rn * DAY + DAY / 2;
        if (p && p.b.length && finished) { c = { t: Date.now(), m: p.m, b: p.b, v: 4 }; cache.rounds[k] = c; }
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

  // ---------- swgoh.gg datacron catalogue (set id -> name, active, expiry) ----------
  async function loadSets() {
    if (gstore.sets && Date.now() - gstore.sets.t < DAY) return gstore.sets.map;
    const doc = await getDoc('/datacrons/');
    if (!doc) return (gstore.sets && gstore.sets.map) || {};
    const map = {};
    doc.querySelectorAll('main a[href]').forEach(a => {
      const m = (a.getAttribute('href') || '').match(/^\/datacrons\/(\d+)\/$/);
      if (!m) return;
      const txt = a.textContent.replace(/\s+/g, ' ').trim();
      const nm = txt.match(/^(.*?) (Active|Expired)\b/);
      const dt = txt.match(/(?:Expires|Expired) ([A-Z][a-z]{2} \d{1,2}, \d{4})/);
      if (nm) map[m[1]] = { n: nm[1], active: nm[2] === 'Active', exp: dt ? new Date(dt[1]).getTime() : 0 };
    });
    if (Object.keys(map).length) { gstore.sets = { t: Date.now(), map }; gsave(); }
    return map;
  }

  // ---------- swgoh.gg squad meta page (defence hold %, all leagues) ----------
  async function loadMetaSG(fmt) {
    const ck = 'meta|' + fmt, c = gstore.leads[ck];
    if (c && Date.now() - c.t < DAY) return c.rows;
    const rows = [], seenKeys = new Set();
    let sp = seasonParam[fmt] || '';
    for (let page = 1; page <= 6; page++) {
      const doc = await getDoc(`/gac/squads/?sort=percent&cutoff=0.1${sp}&page=${page}`);
      if (!doc || !doc.querySelector('main')) break;
      if (page === 1 && !sp) {
        const sm = doc.querySelector('main').textContent.replace(/\s+/g, ' ').match(/Season:\s*\d+\s*-\s*(\dv\d)/);
        if (sm && sm[1] !== fmt) {
          const a = [...doc.querySelectorAll('a[href*="season_id="]')].find(x => new RegExp(`-\\s*${fmt}`).test(x.textContent));
          if (a) { sp = '&season_id=' + (a.getAttribute('href').match(/season_id=([^&]+)/) || [])[1]; page = 0; continue; }
        }
      }
      let added = 0;
      const done = new Set();
      doc.querySelectorAll('main [data-unit-def-tooltip-app]').forEach(t => {
        let row = t.parentElement;
        while (row && !/\bSeen\b/.test(row.textContent)) row = row.parentElement;
        if (!row || done.has(row)) return;
        done.add(row);
        const m = row.textContent.replace(/\s+/g, ' ').match(/Seen ([\d.,]+)(K?) Hold % (\d+)% Banners ([\d.]+)/);
        const u = [...row.querySelectorAll('[data-unit-def-tooltip-app]')].map(e => e.getAttribute('data-unit-def-tooltip-app'));
        if (!m || !u.length) return;
        const key = sqKey(u);
        if (seenKeys.has(key)) return;
        seenKeys.add(key); added++;
        rows.push([Math.round(parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1)), +m[3] / 100, +m[4], u]);
      });
      if (!added) break;
    }
    if (rows.length) { gstore.leads[ck] = { t: Date.now(), rows }; }
    return rows;
  }
  const metaMap = rows => { const o = {}; (rows || []).forEach(([n, h, b, u]) => (o[sqKey(u)] = { n, h, b, u })); return o; };

  // ---------- swgoh.gg GAC Insight: your league and division, exact squads (needs a swgoh.gg login) ----------
  async function insightInit(fmt, me) {
    try {
      const r = await fetch('/api/v1/gac/config-data/', { credentials: 'include' });
      if (!r.ok) return null;
      const c = (await r.json()).data || {};
      const sz = fmt === '5v5' ? 5 : 3;
      const ids = c.latestBattleSeasonIdsBySquadSize || {};
      const season = ids[sz] || ids[String(sz)] || ((c.seasons || []).find(x => x.squadSize === sz) || {}).id;
      const league = String(me.league || '').toUpperCase();
      if (!season || !/^[A-Z]{3,12}$/.test(league) || !/^[A-Z0-9_]+$/.test(season)) return null;
      const dn = me.division | 0;
      return { season, league, sz, dn, div: dn >= 1 && dn <= 5 ? (6 - dn) * 5 : 0, ok: true };
    } catch (e) { return null; }
  }
  // battles against one exact defence squad, split by datacrons: the defender's datacron strength is fixed (dBand),
  // and the attacks are split into buckets by the attacker's datacron (aKeys). Your division first, the whole league
  // if your division has under 150 battles. If the defender's datacron filter leaves under 50 battles, it is dropped.
  // oq: the defender's GAC omicrons to require (all of them). If the filters leave under 50 battles, the datacron filter
  // is dropped first, then the omicron filter; v.dBand and v.oq say what was actually used.
  async function insightSquad(I, squad, dBand, aKeys, oq = '') {
    const key = 'ins3|' + I.season + '|' + I.league + '|' + I.div + '|' + sqKey(squad) + '|' + dBand + '|' + aKeys.join(',') + '|' + oq;
    const c = gstore.leads[key];
    if (c && Date.now() - c.t < DAY) return c.v;
    const tries = [[dBand, oq]];
    if (dBand != null) tries.push([null, oq]);
    if (oq) tries.push([null, '']);
    let best = null;
    for (const [b, o] of tries) {
      const v = await insightBuckets(I, squad, b, aKeys, o);
      if (!v) return best;
      v.dBand = b; v.oq = o;
      if (!best || v.n > best.n) best = v;
      if (v.n >= 50) { best = v; break; }
    }
    if (best) gstore.leads[key] = { t: Date.now(), v: best };
    return best;
  }
  // battles minus battles: e.g. "all battles with the omicrons you have" minus "those that also had the one you lack"
  const minusV = (a, b) => {
    if (!a || !b || a.scope !== b.scope || a.dBand !== b.dBand) return a;
    const out = { ...a, b: {}, minus: true };
    Object.keys(a.b).forEach(k => {
      const sub = {}; (b.b[k] || []).forEach(r => (sub[sqKey(r[3])] = r));
      out.b[k] = a.b[k].map(r => { const s = sub[sqKey(r[3])]; if (!s) return r; const n = r[0] - s[0], w = r[0] * r[1] - s[0] * s[1]; return n > 0 ? [n, Math.min(1, Math.max(0, w / n)), r[2], r[3]] : null; }).filter(Boolean);
    });
    const all = Object.values(out.b).flat();
    out.n = all.reduce((x, r) => x + r[0], 0);
    out.h = out.n ? 1 - all.reduce((x, r) => x + r[0] * r[1], 0) / out.n : null;
    return out;
  };
  async function insightBuckets(I, squad, dBand, aKeys, oq = '') {
    const res = {};
    let scope = 'div';
    for (const k of aKeys) res[k] = await insightRows(I, squad, DQ(dBand) + oq + AQ[k], I.div);
    if (!I.ok) return null;
    const tot = o => Object.values(o).reduce((a, r) => a + (r ? r.reduce((x, y) => x + y[0], 0) : 0), 0);
    if (I.div && tot(res) < 150) {
      const wide = {};
      for (const k of aKeys) wide[k] = await insightRows(I, squad, DQ(dBand) + oq + AQ[k], 0);
      if (!I.ok) return null;
      if (tot(wide) > tot(res)) { Object.assign(res, wide); scope = 'league'; }
    }
    const all = Object.values(res).flatMap(r => r || []);
    const n = all.reduce((a, r) => a + r[0], 0), w = all.reduce((a, r) => a + r[0] * r[1], 0);
    const b = {}; aKeys.forEach(k => (b[k] = res[k] || []));
    return { scope, b, n, h: n ? 1 - w / n : null, dBand };
  }
  async function insightRows(I, squad, extra, div) {
    const base = `/api/v1/gac/battle/battles/?g=1&show_cleanups=false&squad_size=${I.sz}&season_id=${I.season}&league=${I.league}&d_lead=${squad[0]}` + (squad.length > 1 ? `&d_member=${squad.slice(1).join(',')}` : '') + extra;
    const one = async url => {
      for (let i = 0; i < 3; i++) {
        if (!I.ok) return null;
        try {
          const r = await fetch(url, { credentials: 'include' });
          if (r.ok) return (await r.json()).data || null;
          if (r.status === 401 || r.status === 403) { I.ok = false; I.code = r.status; return null; }
          if (r.status === 400 || r.status === 404) return null;
        } catch (e) {}
        await sleep(1200 * (i + 1));
      }
      return null;
    };
    const want = sqKey(squad);
    const pick = d => (d && Array.isArray(d.battles) ? d.battles.filter(b => sqKey([b.defenseLeadId, ...(b.defenseMemberIds || [])]) === want) : []);
    const rows = pick(await one(base + (div ? `&division=${div}` : '')));
    if (!I.ok) return null;
    return rows.sort((a, b) => b.count - a.count).slice(0, 60)
      .map(b => [b.count | 0, +b.percentage || 0, +b.avgBannersWinsOnly || 0, [b.attackLeadId, ...(b.attackMemberIds || [])]])
      .filter(r => r[3].every(x => /^[A-Z0-9_]{2,40}$/.test(String(x))));
  }
  // rows for one attacker from a bucketed Insight result: the bucket you asked for if it has enough battles, else all buckets
  const insRowsFor = (v, k, test, min = 20) => {
    const pickRows = rows => (rows || []).filter(test);
    const cnt = rows => rows.reduce((a, r) => a + r[0], 0);
    const own = pickRows(v.b[k]);
    if (cnt(own) >= min) return { rows: own, split: true };
    return { rows: Object.values(v.b).flatMap(pickRows), split: false };
  };
  const insLabel = scope => (S && S.INS ? (scope === 'div' && S.INS.dn ? `swgoh.gg ${nice(S.INS.league)} Div ${S.INS.dn}` : `swgoh.gg ${nice(S.INS.league)}`) : 'swgoh.gg');

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
  // With GAC Insight, each counter is read from battles where the attacker had a datacron like the one you'd bring
  // (none, level 1-5, or 6+ that works for that squad) against a defender with a datacron like theirs.
  function counters(S, defLead, defSquad, theirLv) {
    const { me, H, G } = S;
    const hist = H[defLead] || {};
    const gRows = G[defLead] || [];
    const want = sqKey(defSquad);
    const exact = gRows.filter(r => r[4][0] === defLead && sqKey(r[4]) === want);
    const exN = exact.reduce((a, r) => a + r[0], 0);
    // GAC Insight (your league/division) and HotUtils counters are always for this exact defence squad
    const ins = S.INS && S.INS.ctr[want];
    const insAll = ins ? Object.values(ins.b).flat() : [], insN = insAll.reduce((a, r) => a + r[0], 0);
    const hu = S.HU && S.HU.ctr[want], huN = hu ? hu.reduce((a, r) => a + r[0], 0) : 0;
    const src = insN >= 20 ? 'ins' : huN >= 20 ? 'hu' : 'gg';
    const live = src === 'ins' ? insAll : hu;
    const rows = src !== 'gg' ? live.map(r => [r[0], r[1], r[2], r[3], defSquad]) : defSquad.length > 1 && exN >= 20 ? exact : gRows.filter(r => r[4][0] === defLead);
    const g = {};
    rows.forEach(([n, w, avg, att]) => {
      const o = (g[att[0]] = g[att[0]] || { n: 0, w: 0, ban: 0, banW: 0, squads: {}, rows: [] });
      o.n += n; o.w += n * w;
      if (avg) { o.ban += avg * n * w; o.banW += n * w; }
      inc(o.squads, att.join(','), n);
      o.rows.push([n, w, avg, sqKey(att)]);
    });
    const agg = rs => ({ n: rs.reduce((x, r) => x + r[0], 0), w: rs.reduce((x, r) => x + r[0] * r[1], 0), ban: rs.reduce((x, r) => x + (r[2] ? r[2] * r[0] * r[1] : 0), 0), banW: rs.reduce((x, r) => x + (r[2] ? r[0] * r[1] : 0), 0) });
    const theirDc = S.oppDcDef && S.oppDcDef[defLead];
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
      const sk = sqKey(squad);
      // your datacron for this squad (one not already on your defence)
      const myDc = src === 'ins' && !missing.length ? bestDc(me.dcs, squad, S.myDcRes) : null;
      // swgoh.gg numbers for this exact attacking squad when it has 20+ battles, otherwise for every squad with this leader
      const rate = key => {
        if (src !== 'ins') {
          const same = gAll.rows.filter(r => r[3] === sk), sameN = same.reduce((x, r) => x + r[0], 0);
          return sameN >= 20 ? { ...agg(same), gSquad: true, split: false } : { ...gAll, gSquad: false, split: false };
        }
        const bySq = insRowsFor(ins, key, r => sqKey(r[3]) === sk);
        if (agg(bySq.rows).n >= 20) return { ...agg(bySq.rows), gSquad: true, split: bySq.split };
        const byLead = insRowsFor(ins, key, r => r[3][0] === a);
        return { ...agg(byLead.rows), gSquad: false, split: byLead.split };
      };
      const gg = rate(src === 'ins' ? bandKey(myDc ? myDc.band : 0) : null);
      const estOf = x => {
        const k = x.n ? Math.min(x.n, 30) : 2, prior = x.n ? (x.w + 1) / (x.n + 2) : 0.5;
        const base = (h.w + k * prior) / (h.n + k);
        return clamp(base + 0.04 * delta, 0.02, 0.98);
      };
      const delta = !SHIP[a] && myLv && theirLv ? clamp(myLv - theirLv, -3, 3) : 0;
      const gRate = gg.n ? gg.w / gg.n : null;
      // the same counter without your datacron, used when the plan has already given that datacron to another battle
      const ggNo = myDc ? rate('none') : null;
      const total = h.n + gg.n;
      return {
        lead: a, n: h.n, w: h.w, raw: h.n ? h.w / h.n : null, myN: h.myN, myW: h.myW, gN: gg.n, gRate, gSquad: gg.gSquad,
        squad, missing, own: !missing.length,
        ready: !missing.length && squad.every(u => { const x = me.units[u]; return x.ship ? x.stars >= 7 : x.relic != null && x.relic >= 5; }),
        myLv, delta, est: estOf(gg), estNo: ggNo ? estOf(ggNo) : null, gNoN: ggNo ? ggNo.n : 0, gNoRate: ggNo && ggNo.n ? ggNo.w / ggNo.n : null,
        myDc, theirDc, dcSplit: gg.split,
        conf: total >= 20 ? 'high' : total >= 6 ? 'med' : 'low', total,
        avgBan: h.banN ? h.ban / h.banN : gg.banW ? gg.ban / gg.banW : null,
        exact: src !== 'gg' || rows === exact, src, scope: src === 'ins' ? ins.scope : null, dFilt: src === 'ins' ? ins.dBand : undefined,
      };
    });
    return out.sort((x, y) => y.est - x.est || y.total - x.total);
  }

  // my defence candidates, scored against the attack teams they use
  // With GAC Insight, each squad is rated with the datacron you'd put on it (the best one of yours that works for it and
  // isn't already on your defence), and against each of their attack teams with or without the datacron they'd bring.
  function defenceCandidates(S) {
    const { me, all, H, G, atts } = S;
    const ownR5 = u => { const x = me.units[u]; return x && !x.ship && x.relic != null && x.relic >= 5; };
    // history, by defence leader
    const C = {};
    all.forEach(b => {
      const L = b.def[0];
      const o = (C[L] = C[L] || { lead: L, n: 0, held: 0, squads: {}, myN: 0, myHeld: 0 });
      o.n++; if (!b.win) o.held++;
      inc(o.squads, b.def.join(','));
      if (b.myDef) { o.myN++; if (!b.win) o.myHeld++; }
    });
    const tot = Object.values(C).reduce((a, o) => [a[0] + o.held, a[1] + o.n], [0, 0]);
    const poolHold = tot[1] ? tot[0] / tot[1] : 0.25;
    const attN = atts.reduce((a, o) => a + o.n, 0) || 1;
    // candidate squads: every meta defence you own at R5+, plus the squad you'd field for each leader in the histories
    // HotUtils' pasted league meta (whole league, live datacrons only) stands in for swgoh.gg's all-league squad meta,
    // and with GAC Insight on it is shown next to Insight's division hold % and used where Insight is thin
    const huMeta = S.HU ? S.HU.meta : null;
    const meta = huMeta || S.metaSG || {};
    const metaSrc = huMeta ? 'hu' : 'gg';
    // a squad missing from the meta list is rarely set or rarely holds: start it at the lower quartile of meta holds
    const mh = Object.values(meta).map(m => m.h).sort((a, b) => a - b);
    const floor = mh.length ? mh[Math.floor(mh.length / 4)] : poolHold;
    const cands = {};
    Object.values(meta).forEach(m => { if (m.n >= 300 && m.u.every(ownR5)) cands[sqKey(m.u)] = m.u; });
    Object.values(C).forEach(o => {
      if (SHIP[o.lead]) return;
      const sq = top(o.squads, 10).map(([k]) => k.split(',')).find(x => x.every(u => me.units[u]));
      if (sq && !cands[sqKey(sq)]) cands[sqKey(sq)] = sq;
    });
    return Object.entries(cands).map(([key, squad]) => {
      const L = squad[0], o = C[L] || { n: 0, held: 0, myN: 0, myHeld: 0 };
      const cd = S.INS && S.INS.cand && S.INS.cand[key];
      // v = Insight battles for this squad with one datacron strength on it; without Insight, the older all-datacron sources
      const hu = huMeta ? huMeta[key] || null : null;
      const variant = v => {
        // meta hold %: Insight for this exact squad when it has 50+ battles; HotUtils' league figure when Insight is thinner
        // than that (and says so); without Insight, the pasted HotUtils meta or swgoh.gg's squad meta
        const mt = v && v.n >= 50 ? { n: v.n, h: v.h, scope: v.scope, src: 'ins' }
          : hu ? { n: hu.n, h: hu.h, src: 'hu', insThin: v ? v.n : cd ? 0 : undefined }
          : !v && !cd && meta[key] ? { ...meta[key], src: metaSrc } : null;
        const mine = !v && S.HU && S.HU.mine[key];
        const oneAtt = lead => {
          if (v) {
            const k = S.oppDcAtt && S.oppDcAtt[lead] ? 'has' : 'none';
            return insRowsFor(v, k, r => r[3][0] === lead, 10).rows;
          }
          return (mine ? mine.map(r => [r[0], r[1], r[2], r[3], squad]) : (G[L] || []).filter(r => r[4][0] === L)).filter(r => r[3][0] === lead);
        };
        const gRows = v ? Object.values(v.b).flat() : mine ? mine.map(r => [r[0], r[1], r[2], r[3], squad]) : (G[L] || []).filter(r => r[4][0] === L);
        const gN = gRows.reduce((a, r) => a + r[0], 0), gW = gRows.reduce((a, r) => a + r[0] * r[1], 0);
        const gHold = gN ? 1 - gW / gN : null;
        // the starting point is the meta hold rate for this exact squad (up to 200 battles' weight); then leader-level data; then the pool
        const base = mt ? mt.h : gN ? (gN - gW + 10 * floor) / (gN + 10) : floor;
        const K = mt ? Math.min(mt.n, 200) : gN ? Math.min(gN, 30) : 20;
        const prior = (o.held + K * base) / (o.n + K);
        const vs = atts.map(a => {
          const h = (H[L] || {})[a.lead], n = h ? h.n : 0, held = h ? h.n - h.w : 0;
          const ga = oneAtt(a.lead);
          const gaN = ga.reduce((x, r) => x + r[0], 0), gaW = ga.reduce((x, r) => x + r[0] * r[1], 0);
          const k = gaN ? Math.min(gaN, 30) : 2, p0 = gaN ? (gaN - gaW + 2 * prior) / (gaN + 2) : prior;
          return { lead: a.lead, n, held, gN: gaN, gHold: gaN ? 1 - gaW / gaN : null, p: (held + k * p0) / (n + k), weight: a.n / attN, theirDc: !!(S.oppDcAtt && S.oppDcAtt[a.lead]) };
        });
        // half the score is how it holds in general (meta), half how it holds against this opponent's attack teams
        const vsScore = atts.length ? vs.reduce((x, v) => x + v.p * v.weight, 0) : prior;
        return { mt, gN, gHold, prior, score: 0.5 * prior + 0.5 * vsScore, vs, exactVs: !!(v || mine) };
      };
      const myX = cd ? bestDc(me.dcs, squad, S.myDcRes) : null;
      const A = variant(cd ? cd.dc || cd.no || null : null);
      const B = myX && cd && cd.no ? variant(cd.no) : null;
      const evidence = o.n + A.gN + (A.mt ? A.mt.n : 0);
      return {
        lead: L, n: o.n, held: o.held, myN: o.myN, myHeld: o.myHeld, squad, prior: A.prior, gN: A.gN, gHold: A.gHold, score: A.score,
        meta: A.mt || null, metaSrc: A.mt ? A.mt.src : 'gg', hu, exactVs: A.exactVs,
        vs: A.vs.filter(v => v.n || v.gN).sort((a, b) => b.weight - a.weight),
        dc: myX, dBand: cd ? (cd.dc ? cd.dc.dBand : cd.no ? 0 : null) : undefined, no: B ? { score: B.score, meta: B.mt, vs: B.vs.filter(v => v.n || v.gN).sort((a, b) => b.weight - a.weight) } : null,
        conf: evidence >= 20 ? 'high' : evidence >= 6 ? 'med' : 'low', hasGL: squad.some(u => me.units[u] && me.units[u].gl),
      };
    }).sort((a, b) => b.score - a.score);
  }

  // ---------- plans ----------
  // which datacrons are where: yours on your defence, and the best fit for each of their teams
  function assignDcs(S) {
    const { me, opp } = S;
    // a datacron of yours whose character tier names a unit on your defence is taken to be on that team
    S.myDcRes = new Set((me.dcs || []).filter(dc => dcLive(dc) && dc.ab.some(t => t.type === 4 && S.locked && S.locked.has(t.id))).map(dc => dc.id));
    // theirs: the best fit for each of their likely defences in turn, then their attack teams from what's left
    const used = new Set();
    S.oppDcDef = {}; S.oppDcAtt = {};
    [...(S.defs || []), ...(S.unseen || [])].forEach(d => {
      if (d.ships) return;
      const x = bestDc(opp.dcs, d.squad, used);
      if (x) { used.add(x.dc.id); S.oppDcDef[d.lead] = x; }
    });
    (S.atts || []).forEach(a => {
      const sq = top(a.squads, 1)[0][0].split(',');
      const x = bestDc(opp.dcs, sq, used);
      if (x) { used.add(x.dc.id); S.oppDcAtt[a.lead] = x; }
    });
  }

  function plan(S) {
    assignDcs(S);
    S.defs.forEach(d => (d.counters = counters(S, d.lead, d.squad, d.theirLv)));
    S.unseen.forEach(d => (d.counters = counters(S, d.lead, d.squad, d.theirLv)));
    const blocked = new Set([...S.locked, ...S.fleet]);
    // a counter's value with its datacron, or without it once another battle in the plan has taken that datacron
    const estFor = (c, dcFree) => (c.myDc && !dcFree && c.estNo != null ? c.estNo : c.est);
    const val = (c, dcFree = true) => (S.rank === 'banners' ? estFor(c, dcFree) * (c.avgBan || S.defaultBan) : estFor(c, dcFree));
    const defs = S.defs.filter(d => d.likely >= 0.1 || d.recent || S.defs.length <= 12).slice(0, 18);
    const free = defs.map(d => d.counters.filter(c => c.own && !c.squad.some(u => blocked.has(u))).sort((a, b) => val(b) - val(a)));
    const opts = free.map(f => f.slice(0, 4));
    let best = { score: -1, pick: [], dc: [] };
    const used = new Set(), usedDc = new Set(), cur = [], curDc = [];
    const N = Math.min(9, defs.length);
    (function go(i, sc) {
      if (i === N) { if (sc > best.score) best = { score: sc, pick: [...cur], dc: [...curDc] }; return; }
      for (const c of opts[i]) {
        if (c.squad.some(u => used.has(u))) continue;
        const dcOn = !!c.myDc && !usedDc.has(c.myDc.dc.id);
        c.squad.forEach(u => used.add(u)); if (dcOn) usedDc.add(c.myDc.dc.id);
        cur.push(c); curDc.push(dcOn);
        go(i + 1, sc + val(c, dcOn || !c.myDc) * defs[i].likely);
        cur.pop(); curDc.pop();
        c.squad.forEach(u => used.delete(u)); if (dcOn) usedDc.delete(c.myDc.dc.id);
      }
      cur.push(null); curDc.push(false); go(i + 1, sc); cur.pop(); curDc.pop();
    })(0, 0);
    const taken = new Set(best.pick.filter(Boolean).flatMap(c => c.squad));
    const takenDc = new Set(best.pick.map((c, i) => (c && best.dc[i] ? c.myDc.dc.id : null)).filter(Boolean));
    // then give every defence still without a counter the best one that only uses units nobody else needs
    for (let i = 0; i < defs.length; i++) {
      if (best.pick[i]) continue;
      const c = free[i].find(c => !c.squad.some(u => taken.has(u)));
      best.pick[i] = c || null;
      best.dc[i] = !!(c && c.myDc && !takenDc.has(c.myDc.dc.id));
      if (c) { c.squad.forEach(u => taken.add(u)); if (best.dc[i]) takenDc.add(c.myDc.dc.id); }
    }
    S.plan = defs.map((d, i) => {
      const p = best.pick[i];
      const clash = !p && (free[i][0] || d.counters.find(c => c.own));
      return { d, pick: p, dcOn: !!best.dc[i], est: p ? estFor(p, !!best.dc[i] || !p.myDc) : null, clash, clashWith: clash ? clash.squad.filter(u => taken.has(u) || blocked.has(u)) : [] };
    });
    // suggested defence, kept clear of the attack plan, my placed defence and each other; a datacron goes to one team only
    const busy = new Set([...taken, ...blocked]);
    const busyDc = new Set([...S.myDcRes, ...takenDc]);
    S.defPlan = [];
    const pool_ = S.defCands.filter(c => !(S.keepGL && c.hasGL));
    while (S.defPlan.length < 8) {
      let pick = null;
      for (const c of pool_) {
        if (S.defPlan.includes(c) || c.squad.some(u => busy.has(u))) continue;
        const dcOk = c.dc && !busyDc.has(c.dc.dc.id);
        const eff = c.dc && !dcOk && c.no ? c.no.score : c.score;
        if (!pick || eff > pick.eff) pick = { c, eff, dcOk };
      }
      if (!pick) break;
      pick.c.squad.forEach(u => busy.add(u));
      if (pick.dcOk) busyDc.add(pick.c.dc.dc.id);
      pick.c.useDc = !!pick.dcOk; pick.c.eff = pick.eff;
      S.defPlan.push(pick.c);
    }
  }

  // ---------- run ----------
  let S = null, S0_sets = {};
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
      S0_sets = await loadSets();
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
      S = { me, opp, myHist, oppHist, G: {}, HU: null, INS: null, metaSG: {}, filter: 'own', rank: store.rank || 'odds', keepGL: store.keepGL !== false, autoFmt: !wantFmt };
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
      status('Reading swgoh.gg defence meta…');
      S.metaSG = metaMap(await loadMetaSG(oppHist.fmt));
      const hu = gstore.hu;
      if (hu && hu.fmt === oppHist.fmt && String(me.league || '').toUpperCase() === hu.league && Date.now() - hu.t < 3 * DAY) S.HU = hu.data;
      gsave();
      analyse(S);
      // swgoh.gg GAC Insight for your league and division, if your swgoh.gg login allows it
      S.INS = null; S.insNote = '';
      const I = await insightInit(oppHist.fmt, me);
      if (I) {
        assignDcs(S);
        // their defences: split by your datacron, with the datacron they can put on that team
        const theirs = {};
        [...S.defs.filter(d => d.likely >= 0.1 || d.recent).slice(0, 18), ...S.unseen.slice(0, 6)].filter(d => !d.ships).forEach(d => (theirs[sqKey(d.squad)] = d));
        // their defences are assumed to have every GAC omicron their units can take (worst case for you)
        const fmt = oppHist.fmt;
        const jobs = Object.values(theirs).map(d => { const om = gacOmis(d.squad, fmt); return { kind: 'ctr', sq: d.squad, band: S.oppDcDef[d.lead] ? S.oppDcDef[d.lead].band : 0, keys: ['none', 'low', 'high'], oq: OQ(om), om }; });
        // your defence options: with the best datacron you have free for them, and without one in case it's needed elsewhere;
        // with the GAC omicrons you actually have, and minus battles where the defender had one you're missing
        const candJobs = c => {
          const out = [];
          const x = bestDc(me.dcs, c.squad, S.myDcRes);
          const have = gacOmis(c.squad, fmt, me), lack = gacOmis(c.squad, fmt).filter(o => !have.includes(o) && !have.some(h => h.key === o.key));
          const add = (band, which) => {
            out.push({ kind: 'cand', sq: c.squad, band, keys: ['none', 'has'], which, oq: OQ(have), have, lack });
            if (lack.length) out.push({ kind: 'cand', sq: c.squad, band, keys: ['none', 'has'], which: which + 'Lack', oq: OQ([...have, ...lack]) });
          };
          add(x ? x.band : 0, 'dc');
          if (x) add(0, 'no');
          return out;
        };
        // skip squads the Suggested defence can't use anyway: ships, anything already on your defence, and GL teams while they're kept for attack
        defenceCandidates(S).filter(c => !c.squad.some(u => SHIP[u] || S.locked.has(u)) && !(S.keepGL && c.hasGL)).slice(0, 24).forEach(c => jobs.push(...candJobs(c)));
        let k = 0, total = jobs.length;
        const runJobs = js => pool(js, 4, async j => { const v = await insightSquad(I, j.sq, j.band, j.keys, j.oq); status(`Reading swgoh.gg GAC Insight for ${nice(I.league)}${I.div ? ' Division ' + I.dn : ''}, split by datacron and omicron: ${++k}/${total}…`); return v; });
        const takeJobs = (js, got) => {
          js.forEach((j, i) => {
            const key = sqKey(j.sq);
            // a checked squad with no Insight battles still gets an (empty) entry, so it isn't reported as unchecked
            if (j.kind === 'cand') S.INS.cand[key] = S.INS.cand[key] || {};
            const v = got[i]; if (!v) return;
            if (j.kind === 'ctr') { v.om = j.om; S.INS.ctr[key] = v; S.INS.hold[key] = { n: v.n, h: v.h, scope: v.scope }; }
            else { const c = (S.INS.cand[key] = S.INS.cand[key] || {}); c[j.which] = v; if (j.have) { c.have = j.have; c.lack = j.lack; } }
          });
          // a defence missing an omicron: its battles minus the ones where the defender had the omicron you lack
          Object.values(S.INS.cand).forEach(c => {
            ['dc', 'no'].forEach(w => {
              if (!c[w] || !c[w + 'Lack'] || c.lackDone) return;
              const m = minusV(c[w], c[w + 'Lack']);
              if (m.minus && m.n >= 20) { c[w] = m; c.lackDone = true; }
            });
          });
        };
        const got = await runJobs(jobs);
        if (I.ok && got.some(Boolean)) {
          S.INS = { league: I.league, dn: I.dn, ctr: {}, hold: {}, cand: {} };
          takeJobs(jobs, got);
          gsave();
          analyse(S);
          // second pass: the attack plan takes units from the strongest squads, so the defences left free may not have been
          // among the 24 checked above. Check any suggested defence Insight hasn't seen yet, then plan again.
          for (let pass = 0; pass < 4 && I.ok; pass++) {
            S.defCands = defenceCandidates(S);
            plan(S);
            const more = S.defPlan.filter(c => !S.INS.cand[sqKey(c.squad)]).flatMap(candJobs);
            if (!more.length) break;
            total += more.length;
            takeJobs(more, await runJobs(more));
            gsave();
            analyse(S);
          }
        } else if (!I.ok) S.insNote = `swgoh.gg's GAC Insight (battles for your own league and division) needs you to be signed in to swgoh.gg${I.code === 403 ? ' with access to Insights' : ''}. Without it, counters come from swgoh.gg's all-league counters pages, and datacrons can't be taken into account.`;
      }
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

  // ---------- HotUtils league meta (optional, pasted) ----------
  // HotUtils' pages don't let bookmarks run on them and don't let other sites read their data, so this step is manual:
  // open HotUtils' public defence-meta feed for your league, copy it all, paste it here. It's cached for 3 days.
  const LEAGUES = ['KYBER', 'AURODIUM', 'CHROMIUM', 'BRONZIUM', 'CARBONITE'];
  const leagueName = () => { const l = String((S && S.me.league) || '').toUpperCase(); return LEAGUES.includes(l) ? l : 'KYBER'; };
  const nice = l => l[0] + l.slice(1).toLowerCase();
  const huUrl = () => `https://players.hotutils.com/api/gac/squad-meta?mode=${S.oppHist.fmt}&side=defense&battleType=character&league=${leagueName()}&division=ALL&hideExpired=1`;
  function takeHotUtils(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { return status("That isn't HotUtils' data. Open the link, press Ctrl+A then Ctrl+C on that page, and paste everything here.", true); }
    const ids = a => Array.isArray(a) && a.length && a.every(x => typeof x === 'string' && /^[A-Z0-9_]{2,40}$/.test(x));
    const rows = (j && Array.isArray(j.rows) ? j.rows : []).filter(r => r && ids(r.units) && Number.isFinite(r.battles) && Number.isFinite(r.holdPct));
    if (!rows.length) return status("That paste has no defence squads in it. Make sure you copied the whole HotUtils page.", true);
    if (j.mode && j.mode !== S.oppHist.fmt) return status(`That's HotUtils' ${esc(j.mode)} data, but this scout is ${S.oppHist.fmt}. Use the link above, which asks for ${S.oppHist.fmt}.`, true);
    const league = LEAGUES.includes(j.league) ? j.league : leagueName();
    const data = { league, season: j.season | 0, ctr: {}, mine: {}, meta: metaMap(rows.filter(r => r.battles >= 100).map(r => [r.battles | 0, r.holdPct / 100, +(r.avgBanners || 0), r.units])) };
    S.HU = data;
    gstore.hu = { t: Date.now(), fmt: S.oppHist.fmt, league, data };
    gsave();
    S.defCands = defenceCandidates(S);
    plan(S);
    status(`Added HotUtils ${nice(league)} defence meta (season ${data.season}, live datacrons only): ${Object.keys(data.meta).length} squads.`);
    show('plan');
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
    const si = S0_sets[d.s];
    const days = si && si.active && si.exp ? Math.max(0, Math.round((si.exp - Date.now()) / DAY)) : null;
    const setNote = si && !si.active ? ' · <span class="warn">set expired, cron is gone</span>' : days != null && days <= 21 ? ` · <span class="warn">set expires in ${days}d</span>` : '';
    const tip = (d.a && d.a.length) ? ` title="${esc(d.a.join('\n'))}"` : '';
    return `<div class="sub"${tip}>Datacron: <span class="${big ? 'warn' : ''}">Lvl ${d.t}${big ? ' ⚠' : ''}</span> <span class="${tip ? 'dchint' : ''}">${esc(d.n)}</span>${d.f ? ' (focused)' : ''}${d.c.length ? ' → ' + esc(d.c.join(', ')) : ''} <small>(${when})</small>${setNote}</div>`;
  };
  const recTxt = c => `${c.n ? `${c.w}/${c.n} in these histories` : 'not in these histories'}${c.myN ? ` · you ${c.myW}/${c.myN}` : ''}${c.gN ? ` · ${c.src === 'ins' ? insLabel(c.scope) : c.src === 'hu' ? 'HotUtils ' + nice(S.HU.league) : 'swgoh.gg'} ${pct(c.gRate)} of ${kNum(c.gN)}${c.gSquad ? '' : ` (all ${esc(nm(c.lead))} teams)`}` : ''}`;
  // datacron lines. b is a strength band: null = not split (too few battles), 0 = none, 3 = level 1-5, 6/9 = level 6+
  const bandTxt = b => (b == null ? 'any datacron' : !b ? 'no datacron' : b >= 6 ? 'a level 6+ datacron' : 'a level 1-5 datacron');
  const theirDcLine = lead => {
    const x = S.oppDcDef && S.oppDcDef[lead];
    return x ? `<div class="sub">Their best datacron for it: <b class="opp">${dcTxt(x, '')}</b>${x.band < 9 ? ` <small>(only its ${x.band === 6 ? 'faction' : 'alignment'} tier works here)</small>` : ''}</div>`
      : S.opp.dcs && S.opp.dcs.length ? '<div class="sub">None of their datacrons work for this team.</div>' : '';
  };
  // GAC omicrons assumed on their defence (all of them: worst case for you), and whether the numbers could use that
  const omiNames = list => list.map(o => `${esc(nm(o.key.split(':')[0]))} "${esc(o.name)}"`).join(', ');
  const theirOmiLine = d => {
    const v = S.INS && S.INS.ctr[sqKey(d.squad)];
    if (!v || !v.om || !v.om.length) return '';
    return `<div class="sub">GAC omicrons assumed on: <span class="opp">${omiNames(v.om)}</span>${v.oq ? '' : ' <span class="warn">(too few battles with them, so the numbers include teams without)</span>'}</div>`;
  };
  // what the counter's number assumes, datacron-wise, on both sides
  const myDcLine = (c, dcOn) => {
    if (c.src !== 'ins') return S.INS ? '' : '<div class="sub">Not split by datacron (needs swgoh.gg GAC Insight).</div>';
    const them = c.dFilt == null ? 'any datacron on their side (too few battles to split)' : `their side with ${bandTxt(c.dFilt)}`;
    const mine = !c.myDc ? 'none of your datacrons work for this team'
      : dcOn ? `with your <b class="me">${dcTxt(c.myDc, '')}</b>${c.myDc.band < 9 ? ` <small>(${c.myDc.band === 6 ? 'faction' : 'alignment'} tier only)</small>` : ''}`
      : `your ${dcTxt(c.myDc, '')} is used in another battle, so this is without it${c.gNoN ? ` (${pct(c.gNoRate)} of ${kNum(c.gNoN)})` : ''}`;
    return `<div class="sub">Datacrons: ${mine} · ${them}${c.dcSplit || !c.myDc || !dcOn ? '' : ' · <span class="warn">too few battles with your datacron strength, so all datacrons counted</span>'}</div>`;
  };
  const delayMs = r => { const t = S.byRound[r.h]; if (!t || !t.t.length) return null; return Date.parse(t.t[0]) - (r.epoch + DAY + (r.rn - 1) * 2 * DAY); };
  const hm = ms => { if (ms == null || isNaN(ms)) return '—'; const m = Math.max(0, Math.round(ms / 6e4)); return '+' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const when = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function show(tab) {
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('');
    $('#tabs').querySelectorAll('button').forEach(b => (b.onclick = () => show(b.dataset.t)));
    const head = `<div class="vs"><div><b>${esc(S.me.name)}</b><small>${gpTxt(S.me.gp)} GP</small></div><div class="v">vs</div><div><b>${esc(S.opp.name)}</b><small>${gpTxt(S.opp.gp)} GP${S.opp.guild ? ' · ' + esc(S.opp.guild) : ''}</small></div></div>
      <p class="sub">${S.oppHist.battles.length} battles from ${S.oppHist.rounds.length} of their ${S.oppHist.fmt} rounds (seasons ${(S.oppHist.seasons || []).join(', ') || '–'}), plus ${S.myBattles} of your own attacks, blended with swgoh.gg's GAC counters page. <a href="#" data-t="about">How it works</a></p>
      ${S.autoFmt ? `<p class="sub">Format: ${S.oppHist.fmt}, from their latest finished event. swgoh.gg only lists an event once it's over, so in the first week of a new season pick the format yourself at the top.</p>` : ''}
      ${S.note ? `<p class="warn">${S.note}</p>` : ''}
      ${S.INS ? `<p class="sub"><b class="me">Using swgoh.gg GAC Insight for ${nice(S.INS.league)}${S.INS.dn ? ' Division ' + S.INS.dn : ''}</b> (this season, exact squads) for counters and defence holds. Squads with too few battles in your division use your whole league.</p>
        <p class="sub"><b class="me">Datacrons counted:</b> ${(S.me.dcs || []).filter(dcLive).length} of yours and ${(S.opp.dcs || []).filter(dcLive).length} of ${esc(S.opp.name)}'s (live sets). Every number is from battles where each side had a datacron of the same strength as the one you or they can actually put on that team.${S.myDcRes && S.myDcRes.size ? ` ${S.myDcRes.size} of yours are taken as already on your defence.` : ''}</p>` : S.insNote ? `<p class="sub">${S.insNote}</p>` : ''}
      ${S.HU ? `<p class="sub"><b class="me">${S.INS ? `HotUtils ${nice(S.HU.league)} hold % shown beside Insight's in Suggested defence` : `Suggested defence uses HotUtils ${nice(S.HU.league)} hold %`}</b> (season ${S.HU.season}, whole league, live datacrons only)${S.INS ? ', and used for squads where Insight has under 50 battles' : ''}. <a href="#" data-act="hureset">Drop it</a></p>`
        : `<details class="sub"><summary>Optional: add HotUtils' ${nice(leagueName())} defence meta (whole league, live datacrons only${S.INS ? '; shown beside Insight and used where Insight is thin' : ''})</summary>
        <p>1. <a class="lnk" href="${esc(huUrl())}" target="_blank" rel="noopener">Open HotUtils' ${nice(leagueName())} ${S.oppHist.fmt} defence data</a> (a page of raw text).<br>2. On that page press <b>Ctrl+A</b> then <b>Ctrl+C</b> (on a Mac, Cmd).<br>3. Paste it here: <input id="hupaste" placeholder="Paste here" autocomplete="off"></p>
        <p>It's remembered for 3 days, so you only do this once per event.</p></details>`}`;
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
    const hp = $('#hupaste'); if (hp) hp.onpaste = e => { const t = (e.clipboardData || window.clipboardData).getData('text'); e.preventDefault(); takeHotUtils(t); };
    out.querySelectorAll('[data-act="hureset"]').forEach(b => (b.onclick = e => { e.preventDefault(); S.HU = null; delete gstore.hu; gsave(); S.defCands = defenceCandidates(S); plan(S); show(tab); }));
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
      <table class="stack"><tr><th>Their likely defence</th><th>Your counter</th><th>Est. win for you</th><th>Avg banners</th></tr>${S.plan.map(({ d, pick, dcOn, est, clash, clashWith }) => `<tr>
      <td>${squadH(d.squad, 'opp')}<div class="sub">${zoneLong(d)} · set in ${pct(d.likely)} of their last ${S.span} rounds${d.recent ? '' : ' · not used last season'} · held ${pct(d.holdRate)} of ${d.n} attacks</div>${theirDcLine(d.lead)}${theirOmiLine(d)}${dcLine(S.dcDef, d.lead)}</td>
      <td>${pick ? squadH(pick.squad, 'me') + `<div class="sub">${recTxt(pick)}</div>` + myDcLine(pick, dcOn) : clash ? `<span class="warn">Best owned counter (${esc(nm(clash.lead))}, ${pct(clash.est)}) needs ${clashWith.map(nm).map(esc).join(', ')}, already on your defence or used above.</span>` : '<span class="warn">No recorded counter you own. Check the counters tab with "All recorded".</span>'}</td>
      <td>${pick ? bar(est) + confH(pick) + (pick.delta ? `<div class="sub">${pick.delta > 0 ? '+' : ''}${pick.delta.toFixed(1)} relic vs their team</div>` : '') : ''}</td>
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
    const huLabel = S.HU ? `HotUtils ${nice(S.HU.league)}` : '';
    const src = S.INS ? insLabel('div') : S.HU ? huLabel : 'swgoh.gg';
    const srcTxt = S.INS && S.HU ? `${src} hold %, with ${huLabel}'s whole-league figure beside it and used where Insight has under 50 battles` : `${src} hold %`;
    const metaLabel = m => (m.src === 'ins' ? insLabel(m.scope) : m.src === 'hu' ? huLabel : 'swgoh.gg');
    // the meta line: the source that drives the score, then HotUtils' league figure next to it when both are available
    const metaH = c => {
      const m = !c.useDc && c.dc && c.no ? c.no.meta : c.meta;
      if (!m && !c.hu) return '';
      if (!m) return `<b>Meta: holds ${pct(c.hu.h)} of ${kNum(c.hu.n)}</b> (${huLabel}, not in the score)<br>`;
      let h = `<b>Meta: holds ${pct(m.h)} of ${kNum(m.n)}</b> (${metaLabel(m)})`;
      // insThin: Insight's battle count when it was checked and found thin (0 = none); undefined when Insight never checked this squad
      if (m.src === 'hu' && S.INS && m.insThin !== undefined) h += ` <span class="warn">· ${insLabel('div')} had ${m.insThin ? `only ${m.insThin}` : 'no'} battles for this squad, so HotUtils is used</span>`;
      else if (m.src === 'ins' && c.hu) h += ` · ${huLabel}: ${pct(c.hu.h)} of ${kNum(c.hu.n)}`;
      return h + '<br>';
    };
    // the datacron line for a suggested defence: which of yours to put on it, or why it's rated without one
    const dcAdvice = c => c.dBand === undefined ? (S.INS ? '<span class="warn">Not split by datacron (outside the squads checked in Insight).</span><br>' : '')
      : c.useDc ? `<b class="me">Put your ${dcTxt(c.dc, '')} on it.</b>${c.dc.band < 9 ? ` <small>(${c.dc.band === 6 ? 'faction' : 'alignment'} tier only)</small>` : ''}${c.dBand == null ? ' <small>(too few battles to split by datacron)</small>' : ''}<br>`
      : c.dc ? `<span class="warn">Your ${dcTxt(c.dc, '')} is needed in your attack plan or on another defence, so this is rated without it.</span><br>`
      : 'None of your datacrons work for this team, so it is rated without one.<br>';
    const omiAdvice = c => {
      const cd = S.INS && S.INS.cand && S.INS.cand[sqKey(c.squad)];
      if (!cd || !cd.have) return '';
      const v = cd.dc || cd.no;
      return (cd.have.length ? `Your GAC omicrons counted: ${omiNames(cd.have)}${v && !v.oq ? ' <span class="warn">(too few battles with them, so not filtered)</span>' : ''}.<br>` : '')
        + (cd.lack.length ? `<span class="warn">You don't have ${omiNames(cd.lack)}${cd.lackDone ? ', so battles where the defender had it are left out' : ', and there were too few battles to leave those out, so this may be optimistic'}.</span><br>` : '');
    };
    return `<h2>Suggested defence</h2><p class="sub">Squads you own, ranked half on how often they hold in the current meta (${srcTxt}) and half on how they do against the attack teams ${esc(S.opp.name)} uses${users ? ` (mostly ${users})` : ''}${S.INS ? ', each with the datacron you can actually put on it and the datacron they would bring' : ''}. Kept clear of your attack plan and each other. Tap "I've set this" once it's placed.</p>
      <div class="filters"><label class="tog"><input type="checkbox" id="keepgl" ${S.keepGL ? 'checked' : ''}> Keep Galactic Legends for attack</label></div>
      ${S.defPlan.length ? `<table class="stack"><tr><th>Your defence</th><th>Holds (est.)</th><th>Evidence</th><th></th></tr>${S.defPlan.map(c => { const m = !c.useDc && c.dc && c.no ? c.no.meta : c.meta, vs = !c.useDc && c.dc && c.no ? c.no.vs : c.vs; return `<tr>
      <td>${squadH(c.squad, 'me')}</td><td>${bar(c.eff ?? c.score)}${confH({ conf: c.conf, total: c.n + c.gN + (m ? m.n : 0) })}</td>
      <td class="sub">${dcAdvice(c)}${omiAdvice(c)}${metaH(c)}${c.n ? `Held ${c.held}/${c.n} in these histories` : 'Not in these histories'}${c.myN ? ` · on your defence ${c.myHeld}/${c.myN}` : ''}${vs.slice(0, 3).map(v => `<br>vs ${esc(nm(v.lead))}${S.INS && c.dBand !== undefined ? (v.theirDc ? ' (with their datacron)' : ' (no datacron of theirs fits)') : ''}: ${v.n ? `held ${v.held}/${v.n}` : ''}${v.n && v.gN ? ' · ' : ''}${v.gN ? `${c.exactVs ? src : 'swgoh.gg, any ' + esc(nm(c.lead)) + ' team,'} ${pct(v.gHold)} of ${kNum(v.gN)}` : ''}`).join('')}</td>
      <td><button class="chip" data-lock="${esc(c.squad.join(','))}">I've set this</button></td></tr>`; }).join('')}</table>`
        : '<p class="sub">No recorded defence squads you own are free. Remove some units from your defence list, or untick "Keep Galactic Legends for attack".</p>'}`;
  }

  function counterTable(list) {
    return `<table class="ct stack"><tr><th>Counter</th><th>Record</th><th>Est. for you</th><th>Avg banners</th></tr>${list.map(c => `<tr class="${c.own ? '' : 'dim'}">
      <td>${squadH(c.squad, 'me')}${c.missing.length ? `<div class="sub warn">Missing: ${c.missing.map(nm).map(esc).join(', ')}</div>` : ''}${c.squad.some(u => S.locked.has(u) || S.fleet.has(u)) ? `<div class="sub warn">Uses ${c.squad.filter(u => S.locked.has(u) || S.fleet.has(u)).map(nm).map(esc).join(', ')} from your defence</div>` : ''}${c.own ? myDcLine(c, true) : ''}</td>
      <td>${c.n ? `${c.w}/${c.n}` : '–'}${c.myN ? `<div class="sub">you ${c.myW}/${c.myN}</div>` : ''}${c.gN ? `<div class="gstat">${c.src === 'ins' ? insLabel(c.scope) : c.src === 'hu' ? 'HotUtils ' + nice(S.HU.league) : 'swgoh.gg'} ${pct(c.gRate)} of ${kNum(c.gN)}${c.gSquad ? '' : ' (all teams with this leader)'}</div>` : ''}</td>
      <td>${bar(c.est)}${confH(c)}</td><td>${banTxt(c)}</td></tr>`).join('')}</table>`;
  }

  function viewDefs() {
    const f = S.filter, chip = (k, l) => `<button class="chip ${f === k ? 'on' : ''}" data-filter="${k}">${l}</button>`;
    const pick = d => d.counters.filter(c => f === 'all' || (f === 'own' ? c.own : c.ready)).slice(0, 8);
    let h = `<h2>Their defences and what beats them</h2>
      <div class="filters">Show counters: ${chip('all', 'All recorded')}${chip('own', 'Teams I own')}${chip('ready', 'Teams I own at R5+')}<label class="tog"><input type="checkbox" id="ships" ${store.showShips ? 'checked' : ''}> Show fleets</label></div>
      ${S.defs.filter(d => store.showShips || !d.ships).map(d => {
        const list = pick(d), exact = d.counters.some(c => c.exact && c.gN);
        return `<section class="card"><div class="dh">${squadH(d.squad, 'opp')}<div class="stats"><div><b>${pct(d.likely)}</b><small>of last ${S.span} rounds</small></div><div><b>${pct(d.holdRate)}</b><small>held (${d.held}/${d.n})</small></div><div><b>${esc(zoneTxt(d))}</b><small>${d.zone ? pct(d.zone.share) + ' of rounds' : 'zone'}</small></div></div></div>${theirDcLine(d.lead)}${theirOmiLine(d)}${dcLine(S.dcDef, d.lead)}
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
      <li><b>Suggested defence</b> looks at every meta defence squad you own at R5+ (from swgoh.gg's squad meta page, or HotUtils once added), plus the squads in the two histories. Each is scored half on its meta hold %, and half on how it holds against the attack teams your opponent uses, weighted by how often they use them. Galactic Legends are left out unless you untick the switch.</li>
      <li><b>swgoh.gg GAC Insight</b> is used automatically if you're signed in to swgoh.gg: for each of their defences and your 24 best free defence options (not already on your defence, and not GL teams while they're kept for attack), it reads this season's battles against that exact squad in your league and division (or your whole league if your division has under 150). Those numbers replace the all-league counters pages and squad meta. Signed out, the tool uses those instead.</li>
      <li><b>HotUtils defence meta</b> (optional): HotUtils publishes defence hold % for each league, with expired datacrons left out. Their site doesn't let bookmarks or other websites read it, so you open their data page, copy it and paste it into the box under the summary. It's remembered for 3 days and covers your whole league, because HotUtils' division filter needs a login. With GAC Insight on, Insight's division hold % still drives the Suggested defence score and HotUtils' figure is shown beside it as a second opinion with a much bigger sample; where Insight has under 50 battles for a squad, HotUtils' figure is used instead and the line says so. Without Insight, HotUtils replaces swgoh.gg's all-league hold %. Counters never come from HotUtils.</li>
      <li><b>Their usual squad</b> for each leader is the line-up they set most, with the latest season counted 4 times and the one before twice, so a team they changed recently shows the new version.</li>
      <li><b>Zones</b> (Front top, Front bottom, Back, Fleet) are where each of their defences was placed most often, counted once per round.</li>
      <li><b>Round by round</b> lists each of their rounds: result and score, first attack time, delay from attacks opening, the attacks their defence held against, and their own failed attacks.</li>
      <li><b>Datacrons</b> (needs GAC Insight). Both players' datacrons are read from swgoh.gg (live sets only). For each team, the tool works out how much of a datacron actually works on it: the alignment tier (3) and faction tier (6) work if any unit in the squad matches, the character tier (9, and every third tier on a focused datacron) only if that character is in the squad. That gives a strength: none, level 1-5, or level 6+. Each counter's win % then comes only from Insight battles where the attacker had a datacron of the strength you can bring to that squad, against a defender with a datacron of the strength they can put on that team. Each suggested defence is rated the same way, against their attack teams with or without the datacron they'd bring. If a split leaves too few battles (under 20 for a counter, under 50 for a defence), it falls back to all datacrons and says so.</li>
      <li><b>Who gets which datacron:</b> a datacron of yours whose character tier names a unit on Your defence is taken to be on that team. The rest go to the attack plan, one battle each (a datacron used in one attack isn't counted again in another; that battle is rated without it), then to the suggested defence. For your opponent, their best-fitting datacron goes to each of their defences in order of how often they set it, then to their attack teams. The line "Datacron: Lvl 6 …" under their defences is what they actually ran last time, from their battle history.</li>
      <li><b>Omicrons</b> (needs GAC Insight). Only GAC omicrons count: those swgoh.gg marks for all GAC, plus the 3v3-only or 5v5-only ones for the format being scouted. <b>Their defences</b> are assumed to have every GAC omicron their units can take (the worst case for you), so each counter's win % comes only from battles against defences that had all of them. <b>Your suggested defences</b> use the GAC omicrons you actually have; if you're missing one, battles where the defender had it are taken out. If a filter leaves too few battles, the datacron filter is dropped first and then the omicron filter, and the line says so. Omicrons on the attacking side aren't split yet.</li>
      <li><b>What it can't see:</b> mods and turn-meter luck. A defence nobody attacked never appears in swgoh.gg's history, and the event being played right now isn't listed until it ends.</li>
      <li>Everything is read from public swgoh.gg pages in your own browser. Nothing is sent anywhere else. Finished rounds are cached in this browser, and swgoh.gg counters pages for 3 days, so later scouts are much faster.</li>
      <li>Credits: original GAC Scout by FireFight; GAC Scout+ (battle plan, defence planner, zones, banners) by samobudo; round-by-round report by Arrikhan (PHX).</li></ul>`;
  }

  if (pageAlly && MY && pageAlly !== MY) run(pageAlly);
})();
