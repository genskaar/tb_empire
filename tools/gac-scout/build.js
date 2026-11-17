// Builds GAC Scout+ for the site:
//   js/gac-scout-plus.js  minified script that the loader bookmark pulls in (always the latest version)
//   gac-scout.html        install page with the loader bookmark and a full-code fallback bookmark
// Usage: node tools/gac-scout/build.js   (needs terser: npx terser is used)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const src = path.join(__dirname, 'scout_plus.js');
// ascii_only: every non-ASCII character becomes a \u escape, so the bookmark survives any copy/paste or URL handling
const min = execFileSync('npx', ['--yes', 'terser', src, '--compress', '--mangle', '--ecma', '2020', '--format', 'ascii_only=true'], { encoding: 'utf8' }).trim();
if (/[^\x00-\x7f]/.test(min)) throw new Error('non-ASCII left in the minified script');
const version = (fs.readFileSync(src, 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
fs.writeFileSync(path.join(root, 'js', 'gac-scout-plus.js'), min + '\n');

const URL_ = 'https://seanvintin-wwws.github.io/tb_empire/js/gac-scout-plus.js';
const loaderSrc = `(()=>{if(!/(^|\\.)swgoh\\.gg$/.test(location.hostname)){alert('GAC Scout+ runs on swgoh.gg. Open swgoh.gg in this tab, then click the bookmark again.');return}var s=document.createElement('script');s.src='${URL_}?v='+Date.now();s.onerror=function(){alert('GAC Scout+ could not load from ${URL_.split('/')[2]}. Check your connection or ad blocker, or use the full-code bookmark from the install page.')};document.body.appendChild(s)})()`;
// Both bookmarks are fully percent-encoded, so no browser has anything left to rewrite when it saves them.
// The full version carries the whole tool gzipped and base64-encoded (about 25,000 characters, well under
// Firefox's 65,536-character bookmark limit) and unpacks it with the browser's built-in DecompressionStream.
// `void` stops the bookmark returning a value, which would otherwise replace the page.
const loader = 'javascript:' + encodeURIComponent(loaderSrc);
const b64 = require('zlib').gzipSync(Buffer.from(min, 'utf8'), { level: 9 }).toString('base64');
const fullSrc = `void(async()=>{try{if(!/(^|\\.)swgoh\\.gg$/.test(location.hostname)){alert("GAC Scout+ runs on swgoh.gg. Open swgoh.gg in this tab, then click the bookmark again.");return}var b=Uint8Array.from(atob("${b64}"),function(c){return c.charCodeAt(0)}),t=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();(0,eval)(t)}catch(e){alert("GAC Scout+ could not start ("+e.message+"). Update your browser, or use the main GAC Scout+ bookmark.")}})()`;
const full = 'javascript:' + encodeURIComponent(fullSrc);
if (full.length > 60000) throw new Error('full bookmark is ' + full.length + ' characters: too long for Firefox');
if (require('zlib').gunzipSync(Buffer.from(b64, 'base64')).toString('utf8') !== min) throw new Error('packed script does not unpack to the original');
for (const [name, url, want] of [['loader', loader, loaderSrc], ['full', full, fullSrc]]) {
  if (decodeURIComponent(url.slice('javascript:'.length)) !== want) throw new Error(name + ' bookmark does not decode back to its source');
  new Function(want); // must parse
}
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const txt = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GAC Scout+: scout your GAC opponent</title>
<meta name="description" content="Scout your SWGOH Grand Arena opponent: counter odds, a no-reuse battle plan, a defence planner, round-by-round history and a roster comparison.">
<meta property="og:title" content="GAC Scout+ for SWGOH">
<meta property="og:description" content="One-click scouting of your Grand Arena opponent on swgoh.gg: counter odds, battle plan, defence planner, zones and round-by-round history.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://seanvintin-wwws.github.io/tb_empire/gac-scout.html">
<meta name="theme-color" content="#1f6feb">
<style>
body{background:#0b0f1a;color:#dde3f0;font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;max-width:820px;margin:40px auto;padding:0 18px 60px}
h1{font-size:34px;margin:0 0 4px;color:#8cc8ff}h1 span{color:#ffd166}h2{font-size:20px;margin:34px 0 10px;color:#8cc8ff}
.lead{color:#9aa6c0;margin:0 0 22px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.f{background:#111829;border:1px solid #263050;border-radius:12px;padding:14px}.f b{display:block;margin-bottom:4px}.f p{margin:0;color:#9aa6c0;font-size:14px}
.btn{display:inline-block;background:#1f6feb;color:#fff;padding:14px 26px;border-radius:10px;font-weight:700;text-decoration:none;cursor:grab;font-size:18px}
.btn2{background:#263050;font-size:15px;padding:10px 18px}
textarea{width:100%;height:80px;font:11px/1.3 ui-monospace,monospace;background:#111829;color:#dde3f0;border:1px solid #263050;border-radius:8px;padding:8px}
.copy{margin-top:6px;background:#111829;color:#dde3f0;border:1px solid #263050;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer}
.note{color:#9aa6c0;font-size:14px}li{margin:6px 0}code{background:#111829;border:1px solid #263050;border-radius:5px;padding:1px 5px}
details{margin-top:14px}summary{cursor:pointer;color:#8cc8ff}
</style></head><body>
<h1>GAC Scout<span>+</span></h1>
<p class="lead">Scout your Grand Arena opponent in one click on swgoh.gg. Version ${version}.</p>
<div class="grid">
<div class="f"><b>Counter odds</b><p>Your two GAC histories blended with swgoh.gg's counters page, matched to their exact defence squad when there's enough data, and adjusted for your relic levels.</p></div>
<div class="f"><b>Battle plan</b><p>The best combination of your counters against the defences they usually set, never reusing a unit or anything on your defence.</p></div>
<div class="f"><b>Your defence</b><p>Add what you've placed and the plan stops using it. Picking a leader adds your usual team. Saved for rounds 2 and 3.</p></div>
<div class="f"><b>Defence planner</b><p>Squads you own that hold best against the attack teams your opponent uses. Keeps GLs for attack unless you say otherwise.</p></div>
<div class="f"><b>Zones and banners</b><p>Where they usually put each team (Front top, Front bottom, Back, Fleet), and counters ranked by expected banners.</p></div>
<div class="f"><b>HotUtils meta</b><p>Optional: paste HotUtils' defence hold % for your own league (live datacrons only). It sits beside swgoh.gg Insight's division figure in the defence planner, and fills in where Insight is thin.</p></div>
<div class="f"><b>Datacrons</b><p>Your datacrons and theirs are in the odds: each counter and defence is rated from battles with the datacron strength each side can actually bring, and the plan never uses one datacron twice.</p></div>
<div class="f"><b>Round by round</b><p>Each of their rounds: score, first attack time and delay, what held on their defence and what they dropped.</p></div>
<div class="f"><b>Their attacks</b><p>What they win with and which defences stopped them.</p></div>
<div class="f"><b>When they attack</b><p>Their usual attack hours in your time zone, and average delay.</p></div>
<div class="f"><b>Roster compare</b><p>GP, GLs, relic counts, zetas, omicrons, ships, and every unit side by side.</p></div>
</div>

<h2>1. Install (once)</h2>
<p><b>Computer:</b> show your bookmarks bar (Ctrl+Shift+B, or Cmd+Shift+B on Mac), then <b>drag this button onto it</b>:</p>
<p><a class="btn" href="${attr(loader)}" onclick="alert('Drag this button to your bookmarks bar instead of clicking it.');return false;">GAC Scout+</a></p>
<p class="note">This bookmark is tiny: it loads the latest GAC Scout+ from this site each time, so you get updates without reinstalling.</p>
<p class="note">Can't drag it, or on a phone? Copy the code below, bookmark any page, then edit that bookmark: name it <b>GAC Scout+</b> and replace its URL with the code. If you opened this page from Discord on a phone, open it in Chrome or Safari first (Discord's built-in browser can't save bookmarks).</p>
<textarea id="code" readonly>${txt(loader)}</textarea>
<button class="copy" data-for="code">Copy code</button>
<details><summary>Full-code version (only if the bookmark above won't load)</summary>
<p class="note">This contains the whole tool (packed), so it works even if this site can't be reached, but it won't update itself. Reinstall it from here to get new versions.</p>
<p><a class="btn btn2" href="${attr(full)}" onclick="alert('Drag this button to your bookmarks bar instead of clicking it.');return false;">GAC Scout+ (full)</a></p>
<textarea id="full" readonly>${txt(full)}</textarea>
<button class="copy" data-for="full">Copy full code</button>
</details>

<h2>2. Use it</h2>
<ol>
<li>Open any page on <a href="https://swgoh.gg" style="color:#8cc8ff">swgoh.gg</a>. If you open your opponent's profile, their ally code fills in and it starts straight away.</li>
<li>Click the <b>GAC Scout+</b> bookmark. On Android Chrome, type <code>GAC Scout+</code> in the address bar and tap the bookmark.</li>
<li>The first time, enter <b>your own</b> ally code too. It's remembered in your browser, and you can change it in the header.</li>
<li>Press <b>Scout</b>. The first run takes about 30 to 60 seconds. Later runs are much faster because finished rounds and swgoh.gg counters pages are cached.</li>
<li><b>Optional:</b> under the summary, open the HotUtils link, copy that page (Ctrl+A, Ctrl+C) and paste it into the box. The suggested defence then shows your league's hold rates beside swgoh.gg's, and uses them where swgoh.gg has too few battles. It's remembered for 3 days.</li>
<li><b>Format</b> is Auto (their latest finished event). In the first week of a new season, set it to 3v3 or 5v5 yourself, because swgoh.gg only lists an event once it's over.</li>
<li>Add the units you've put on defence under <b>Your defence</b> so the battle plan doesn't use them. Your fleet defence is filled in from your latest season; fix it there if you've changed it. Press <b>Clear all</b> when a new GAC event starts.</li>
</ol>

<h2>If it doesn't work</h2>
<ul class="note">
<li><b>Nothing happens, or it says it only runs on swgoh.gg:</b> the bookmark has to be clicked while a swgoh.gg page is open in that tab.</li>
<li><b>"swgoh.gg wouldn't give me...":</b> reload the swgoh.gg page, pass its "checking your browser" step, sign in to swgoh.gg if it asks, and click the bookmark again.</li>
<li><b>"Couldn't find a player":</b> check the ally code. Both players need a profile on swgoh.gg.</li>
<li><b>Some pages didn't load:</b> swgoh.gg was busy. Press Scout again after a minute; pages already read are remembered.</li>
<li><b>No history for a new opponent:</b> swgoh.gg may not have their GAC rounds, or they haven't played this format recently. Try the other format.</li>
</ul>

<h2>Where the numbers come from</h2>
<ul class="note">
<li>Battles from your GAC history and your opponent's (up to 8 seasons in the same format), plus swgoh.gg's GAC counters page for each of their defences.</li>
<li><b>Est. for you</b> starts from the swgoh.gg win rate, adds the battles in your two histories, and is nudged up to ±12% for the relic gap between your counter and their defence. Each figure is labelled solid, some or thin data.</li>
<li>It runs on swgoh.gg itself and reads the same public pages you can open, from your own browser. Nothing is sent anywhere else.</li>
<li>The bookmark loads the tool's code from this site (GitHub Pages) each time you click it. The source is in the <a href="https://github.com/seanvintin-wwws/tb_empire/tree/main/tools/gac-scout" style="color:#8cc8ff">tools/gac-scout</a> folder of the repository.</li>
<li>With swgoh.gg GAC Insight (sign in to swgoh.gg), datacrons are in the win %: both players' datacrons are read, and each number comes from this season's battles where each side had a datacron of the strength they can actually bring to that team. GAC omicrons count too: your opponent's defences are assumed to have every GAC omicron (worst case), and your defences use the ones you have. Mods aren't visible, so treat the odds as a guide. For what to build on your own account, see <a href="https://ahnaldt101.com/swgoh/datacrons" style="color:#8cc8ff">AhnaldT101's datacron guide</a>.</li>
<li>Made for ANZGC. Original GAC Scout by FireFight; GAC Scout+ battle plan, defence planner, zones and banners by samobudo; round-by-round report by Arrikhan (PHX).</li>
</ul>
<script>
document.querySelectorAll('.copy').forEach(function(b){b.onclick=function(){var t=document.getElementById(b.dataset.for);t.select();try{navigator.clipboard.writeText(t.value).then(function(){b.textContent='Copied';});}catch(e){document.execCommand('copy');b.textContent='Copied';}};});
</script>
</body></html>
`;
fs.writeFileSync(path.join(root, 'gac-scout.html'), html);
console.log('built', version, 'min', min.length, 'bytes; full bookmark', full.length, 'chars');
