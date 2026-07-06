const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const props = data.properties;

const SECTION_TITLES = {
  pinned: "Jesse's Top Pick",
  new: "New This Sweep",
  still: "Still Listed",
  background: "Also On File (background)",
};
const SECTION_ORDER = ["pinned", "new", "still", "background"];

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function flagHtml(f) {
  return `<span class="flag" style="background:${f.color}">${esc(f.text)}</span>`;
}

function photosHtml(id, photos) {
  if (!photos.length) {
    return `<div class="no-photo">No photo available this sweep</div>`;
  }
  const main = photos[0];
  const rest = photos.slice(1);
  return `
    <div class="photo-main"><img src="images/${main}" alt="${esc(id)} main photo" loading="lazy"></div>
    ${rest.length ? `<div class="photo-strip">${rest.map(p => `<img src="images/${p}" alt="${esc(id)} photo" loading="lazy">`).join("")}</div>` : ""}
  `;
}

function reactionHtml(id) {
  return `
    <div class="reactions" data-id="${id}">
      <button class="react-btn" data-val="love" onclick="react('${id}','love')">♥ Love it</button>
      <button class="react-btn" data-val="maybe" onclick="react('${id}','maybe')">? Maybe</button>
      <button class="react-btn" data-val="pass" onclick="react('${id}','pass')">✕ Not for me</button>
      <span class="react-note">(a quick private reminder saved only in your own browser — for a real comment your brothers can see, use the discussion box below)</span>
    </div>
  `;
}

const REPO = "jkellyllekj/devon-house-search";
const GISCUS_REPO_ID = "R_kgDOTN1h4w";
const GISCUS_CATEGORY = "General";
const GISCUS_CATEGORY_ID = "DIC_kwDOTN1h484DApI-";

function githubIssueUrl(kind, p) {
  const titles = { remove: `Remove: ${p.title}`, research: `Research: ${p.title}` };
  const bodies = {
    remove: `Property ID: ${p.id}\n\nReason (optional): \n`,
    research: `Property ID: ${p.id}\n\nYour name: \n\nWhat should Claude look into? (e.g. a specific risk, local news, planning history, why the price is what it is): \n`,
  };
  const labels = { remove: "removal-request", research: "research-request" };
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(titles[kind])}&body=${encodeURIComponent(bodies[kind])}&labels=${labels[kind]}`;
}

function giscusHtml(p) {
  return `
    <div class="giscus-block">
      <h3>💬 Family Comments</h3>
      <p class="rating-hint">💡 Tip: include <code>Rating: 7/10</code> (or any number 1-10) in your comment and it'll show up as a rating badge above after tomorrow's sweep.</p>
      <iframe class="giscus-frame-outer" data-term="${esc(p.id)}" src="giscus-embed.html?term=${encodeURIComponent(p.id)}" loading="lazy" title="Family comments on ${esc(p.title)}"></iframe>
    </div>
  `;
}

function sourceBadgeHtml(p) {
  let domain;
  try { domain = new URL(p.link).hostname.replace(/^www\./, ""); } catch (e) { domain = p.linkLabel; }
  return `<a class="source-badge" href="${esc(p.link)}" target="_blank" rel="noopener">View on ${esc(domain.toUpperCase())} ↗</a>`;
}

const RATER_LABELS = data.raterLabels || {};

function ratingsHtml(p) {
  const ratings = p.ratings || {};
  const entries = Object.entries(ratings);
  const familyBadges = entries.length
    ? entries.map(([who, r]) => `<span class="rating-badge">${esc(RATER_LABELS[who] || "Unknown rater")}: ${esc(r.score)}/10</span>`).join("")
    : `<span class="rating-empty">No family ratings yet</span>`;
  const avg = entries.length ? entries.reduce((s, [, r]) => s + r.score, 0) / entries.length : null;
  const aiBadge = (p.aiRating !== undefined && p.aiRating !== null) ? `<span class="rating-ai">🤖 AI Rating: ${esc(p.aiRating)}/10</span>` : "";
  return `
    <div class="ratings-block">
      ${aiBadge}
      ${avg !== null ? `<span class="rating-avg">Family avg ${avg.toFixed(1)}/10</span>` : ""}
      ${familyBadges}
    </div>
  `;
}

function avgRating(p) {
  const entries = Object.entries(p.ratings || {});
  if (!entries.length) return null;
  return entries.reduce((s, [, r]) => s + r.score, 0) / entries.length;
}

const CHECKLIST_ITEMS = [
  { key: "ocean", label: "🌊 Close to ocean" },
  { key: "trainStation", label: "🚉 Close to train station" },
  { key: "poolSwimTeam", label: "🏊 Close to pool/swim team" },
  { key: "private", label: "🔒 Private/secluded" },
  { key: "mtbTrails", label: "🚵 Close to Woodbury Common/MTB trails" },
  { key: "character", label: "✨ Has character" },
  { key: "garden", label: "🌳 Has a garden" },
  { key: "garageWorkspace", label: "🔧 Garage/shed/workspace" },
];

function checklistIcon(val) {
  if (val === "yes") return { icon: "✓", cls: "cl-yes" };
  if (val === "partial" || val === "adaptable") return { icon: "~", cls: "cl-partial" };
  if (val === "no") return { icon: "✕", cls: "cl-no" };
  return { icon: "?", cls: "cl-unknown" };
}

function checklistHtml(p) {
  const c = p.checklist || {};
  const rows = CHECKLIST_ITEMS.map(item => {
    const { icon, cls } = checklistIcon(c[item.key]);
    return `<span class="cl-item ${cls}"><span class="cl-icon">${icon}</span>${esc(item.label)}</span>`;
  }).join("");
  const gfVal = c.groundFloorLongTerm === "yes" ? "yes" : c.groundFloorLongTerm === "adaptable" ? "partial" : c.groundFloorLongTerm === "no" ? "no" : null;
  const gf = checklistIcon(gfVal);
  const gfLabel = c.groundFloorLongTerm === "yes" ? "♿ Already ground-floor livable"
    : c.groundFloorLongTerm === "adaptable" ? "♿ Could adapt to ground-floor living"
    : c.groundFloorLongTerm === "no" ? "♿ Not realistically ground-floor adaptable"
    : "♿ Ground-floor adaptability unknown";
  const unique = c.uniqueFeature ? `<div class="cl-unique">🎁 <strong>Unique:</strong> ${esc(c.uniqueFeature)}</div>` : "";
  return `
    <div class="checklist-block">
      <h3>Jesse's Checklist</h3>
      <div class="checklist-grid">
        ${rows}
        <span class="cl-item ${gf.cls}"><span class="cl-icon">${gf.icon}</span>${esc(gfLabel)}</span>
      </div>
      ${unique}
    </div>
  `;
}

function aiTakeHtml(p) {
  if (!p.aiTake) return "";
  return `<p class="ai-take">🤖 <strong>AI's take:</strong> ${esc(p.aiTake)}</p>`;
}

function askClaudeHtml(p) {
  return `
    <div class="ask-claude-block">
      <a href="${githubIssueUrl("research", p)}" target="_blank" rel="noopener">🔍 Ask Claude to research this further</a>
      <a href="${githubIssueUrl("remove", p)}" target="_blank" rel="noopener">Request removal</a>
      <span class="notes-caveat">These open a GitHub issue (free account needed) — Claude actions them on the next daily sweep, not instantly.</span>
    </div>
  `;
}

function researchHtml(p) {
  const items = p.research || [];
  if (!items.length) return "";
  return `
    <div class="research-block">
      <h3>Research findings</h3>
      ${items.map(r => `
        <div class="research-item">
          <p class="research-q"><strong>Asked:</strong> ${esc(r.question)} <span class="research-date">(${esc(r.date)})</span></p>
          <p class="research-a">${esc(r.findings)}</p>
          ${(r.sources || []).length ? `<p class="research-sources">Sources: ${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ")}</p>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function mapQuery(p) {
  return p.title.replace(/\s*\([^)]*\)/g, "").trim() + ", Devon, UK";
}

function mapEmbedHtml(p) {
  const q = encodeURIComponent(mapQuery(p));
  return `
    <div class="map-embed">
      <iframe
        src="https://www.google.com/maps?q=${q}&z=15&output=embed"
        width="100%" height="380" style="border:0"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen
      ></iframe>
      <div class="map-links">
        <a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Open full Google Maps ↗</a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${q}" target="_blank" rel="noopener">Directions ↗</a>
      </div>
    </div>
  `;
}

function propertyCard(p) {
  const avg = avgRating(p);
  const aiR = (p.aiRating !== undefined && p.aiRating !== null) ? p.aiRating : "";
  return `
  <section class="card" id="${esc(p.id)}" data-avg-rating="${avg !== null ? avg.toFixed(2) : ""}" data-ai-rating="${aiR}">
    <h2>${esc(p.title)}</h2>
    <div class="price-row">
      <span class="price">${esc(p.price)}</span>
      <span class="agent">${esc(p.agent)}</span>
    </div>
    ${sourceBadgeHtml(p)}
    <div class="flags">${p.flags.map(flagHtml).join("")}</div>
    ${ratingsHtml(p)}
    ${checklistHtml(p)}
    <div class="photos">${photosHtml(p.id, p.photos)}</div>
    ${mapEmbedHtml(p)}
    <p class="body">${esc(p.body)}</p>
    <p class="why"><strong>Why it's here:</strong> ${esc(p.why)}</p>
    ${aiTakeHtml(p)}
    ${researchHtml(p)}
    ${reactionHtml(p.id)}
    ${askClaudeHtml(p)}
    ${giscusHtml(p)}
    <div class="added">Added ${esc(p.dateAdded)}</div>
  </section>`;
}

const orderedProps = SECTION_ORDER.flatMap(sec => props.filter(p => p.section === sec));

const navLinks = orderedProps.map(p => `<a href="#${esc(p.id)}">${esc(p.title.split(",")[0].split(" (")[0])}</a>`).join("");

const sections = SECTION_ORDER.filter(s => props.some(p => p.section === s)).map(sec => {
  const items = props.filter(p => p.section === sec);
  return `<h1 class="section-title">${SECTION_TITLES[sec]}</h1>` + items.map(propertyCard).join("\n");
}).join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Devon House Search</title>
<style>
  :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  body { margin: 0; background: #f4f1ea; color: #222; }
  header { background: #1b3a2f; color: #fff; padding: 28px 20px 20px; }
  header h1 { margin: 0 0 4px; font-size: 28px; }
  header .sub { color: #cfe0d6; font-size: 14px; }
  .sort-row { margin-top: 12px; font-size: 13px; }
  .sort-row label { color: #cfe0d6; margin-right: 8px; }
  .sort-row select { font-size: 13px; padding: 4px 8px; border-radius: 4px; border: 1px solid #3f6a55; background: #23483a; color: #fff; }
  nav { background: #23483a; padding: 10px 20px; overflow-x: auto; white-space: nowrap; position: sticky; top: 0; z-index: 10; }
  nav a { color: #d9ecdf; text-decoration: none; font-size: 13px; margin-right: 16px; }
  nav a:hover { text-decoration: underline; }
  main { max-width: 880px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; }
  .section-title { margin-top: 48px; border-bottom: 3px solid #1b3a2f; padding-bottom: 8px; font-size: 22px; color: #1b3a2f; }
  .card { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); padding: 24px; margin: 20px 0; scroll-margin-top: 60px; }
  .card h2 { margin: 0 0 8px; font-size: 20px; }
  .price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .price { font-size: 20px; font-weight: 700; color: #1b5e20; }
  .agent { color: #666; font-style: italic; font-size: 14px; }
  .flags { margin-bottom: 14px; }
  .flag { display: inline-block; color: #fff; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px; margin: 0 6px 6px 0; }
  .photos { margin-bottom: 14px; }
  .photo-main img { width: 100%; border-radius: 8px; display: block; max-height: 380px; object-fit: cover; }
  .photo-strip { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .photo-strip img { flex: 1 1 140px; max-width: 200px; border-radius: 6px; height: 110px; object-fit: cover; }
  .no-photo { background: #eee; border-radius: 8px; padding: 40px; text-align: center; color: #888; font-size: 13px; }
  .map-embed { margin-bottom: 14px; }
  .map-embed iframe { width: 100%; border-radius: 8px; display: block; }
  .map-links { display: flex; justify-content: flex-end; gap: 20px; margin-top: 6px; }
  .map-links a { font-size: 13px; color: #1155cc; text-decoration: none; font-weight: 600; }
  .map-links a:hover { text-decoration: underline; }
  .body { line-height: 1.5; }
  .why { background: #fdf6e3; border-left: 4px solid #e6b800; padding: 10px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; }
  .source-badge { display: inline-block; background: #1b3a2f; color: #fff !important; font-weight: 700; font-size: 13px; letter-spacing: 0.4px; padding: 7px 14px; border-radius: 20px; text-decoration: none; margin-bottom: 12px; }
  .source-badge:hover { background: #23483a; }
  .ratings-block { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .rating-ai { background: #6A1B9A; color: #fff; font-weight: 700; font-size: 13px; padding: 4px 10px; border-radius: 4px; }
  .rating-avg { background: #C2185B; color: #fff; font-weight: 700; font-size: 13px; padding: 4px 10px; border-radius: 4px; }
  .rating-badge { background: #f0f0f0; color: #444; font-size: 12px; padding: 4px 10px; border-radius: 4px; }
  .rating-empty { font-size: 12px; color: #999; }
  .rating-hint { font-size: 12px; color: #8a5a00; background: #fff3cd; border-radius: 4px; padding: 6px 10px; margin: 0 0 10px; }
  .rating-hint code { background: #fff; padding: 1px 5px; border-radius: 3px; }
  .checklist-block { margin-bottom: 14px; padding: 12px 14px; background: #f4f8f5; border-radius: 6px; }
  .checklist-block h3 { margin: 0 0 8px; font-size: 13px; color: #1b3a2f; text-transform: uppercase; letter-spacing: 0.5px; }
  .checklist-grid { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .cl-item { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; }
  .cl-icon { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
  .cl-yes .cl-icon { background: #2E7D32; }
  .cl-partial .cl-icon { background: #E65100; }
  .cl-no .cl-icon { background: #9E9E9E; }
  .cl-unknown .cl-icon { background: #ccc; color: #777; }
  .cl-unique { margin-top: 8px; font-size: 13px; }
  .ai-take { background: #f3e5f5; border-left: 4px solid #6A1B9A; padding: 10px 14px; border-radius: 4px; font-size: 14px; line-height: 1.5; margin-top: 10px; }
  .research-block { margin-top: 14px; padding: 12px 14px; background: #eef4fb; border-left: 4px solid #1565C0; border-radius: 4px; }
  .research-block h3 { margin: 0 0 8px; font-size: 14px; color: #1b3a2f; }
  .research-item + .research-item { margin-top: 12px; padding-top: 12px; border-top: 1px solid #d6e4f2; }
  .research-q { margin: 0 0 6px; font-size: 13px; color: #444; }
  .research-date { color: #888; font-weight: 400; }
  .research-a { margin: 0 0 6px; font-size: 14px; line-height: 1.5; }
  .research-sources { margin: 0; font-size: 12px; color: #666; }
  .research-sources a { color: #1155cc; }
  .giscus-block { margin-top: 18px; padding: 16px; background: #fff8f0; border: 3px solid #E65100; border-radius: 8px; }
  .giscus-block h3 { margin: 0 0 10px; font-size: 18px; font-weight: 800; color: #E65100; letter-spacing: 0.3px; }
  .giscus-frame-outer { width: 100%; border: 0; min-height: 400px; }
  .ask-claude-block { margin-top: 10px; padding-top: 10px; }
  .ask-claude-block a { font-size: 13px; color: #1155cc; margin-right: 16px; text-decoration: none; }
  .ask-claude-block a:hover { text-decoration: underline; }
  .notes-caveat { display: block; font-size: 11px; color: #999; margin-top: 6px; }
  .reactions { margin-top: 14px; padding-top: 12px; border-top: 1px solid #eee; }
  .react-btn { border: 1px solid #ccc; background: #fafafa; border-radius: 20px; padding: 6px 14px; font-size: 13px; cursor: pointer; margin-right: 8px; }
  .react-btn.active-love { background: #C2185B; color: #fff; border-color: #C2185B; }
  .react-btn.active-maybe { background: #E65100; color: #fff; border-color: #E65100; }
  .react-btn.active-pass { background: #757575; color: #fff; border-color: #757575; }
  .react-note { font-size: 11px; color: #999; display: block; margin-top: 6px; }
  .added { font-size: 11px; color: #aaa; margin-top: 10px; }
  footer { max-width: 880px; margin: 0 auto; padding: 20px; color: #555; font-size: 13px; }
</style>
</head>
<body>
<header>
  <h1>Devon House Search</h1>
  <div class="sub">Exmouth · Woodbury · Budleigh Salterton · East Devon coast — last updated ${esc(data.lastUpdated)}</div>
  <div class="sort-row">
    <label for="sortControl">Sort:</label>
    <select id="sortControl">
      <option value="default">Default (newest first)</option>
      <option value="ai-high">Highest AI rating first</option>
      <option value="ai-low">Lowest AI rating first</option>
      <option value="family-high">Highest family rating first</option>
      <option value="family-low">Lowest family rating first</option>
    </select>
  </div>
</header>
<nav>${navLinks}</nav>
<main>
${sections}
</main>
<footer>
  <p>This page is rebuilt daily. New finds are added to the top of their section; nothing already here is removed unless it's confirmed gone. Reactions typed here are stored only in your browser (localStorage) as a personal memory aid — to actually change what future sweeps prioritise, reply in chat.</p>
</footer>
<script>
function react(id, val) {
  localStorage.setItem('devon-react-' + id, val);
  render(id);
}
function render(id) {
  const el = document.querySelector('.reactions[data-id="' + id + '"]');
  if (!el) return;
  const saved = localStorage.getItem('devon-react-' + id);
  el.querySelectorAll('.react-btn').forEach(b => {
    b.classList.remove('active-love', 'active-maybe', 'active-pass');
    if (saved && b.dataset.val === saved) b.classList.add('active-' + saved);
  });
}
document.querySelectorAll('.reactions').forEach(el => render(el.dataset.id));

window.addEventListener('message', function (e) {
  if (e.data && e.data.giscusEmbedResize && e.data.term) {
    var frame = document.querySelector('iframe.giscus-frame-outer[data-term="' + e.data.term + '"]');
    if (frame) frame.style.height = e.data.giscusEmbedResize + 'px';
  }
});

(function () {
  var sortCards = Array.from(document.querySelectorAll('.card'));
  var headers = Array.from(document.querySelectorAll('.section-title'));
  var select = document.getElementById('sortControl');
  if (!select) return;
  select.addEventListener('change', function () {
    var mode = select.value;
    if (mode === 'default') {
      sortCards.forEach(function (c) { c.style.order = ''; });
      headers.forEach(function (h) { h.style.display = ''; });
      return;
    }
    headers.forEach(function (h) { h.style.display = 'none'; });
    var attr = mode.indexOf('ai') === 0 ? 'aiRating' : 'avgRating';
    var asc = mode.indexOf('low') !== -1;
    var ranked = sortCards.slice().sort(function (a, b) {
      var av = a.dataset[attr] !== '' && a.dataset[attr] != null ? parseFloat(a.dataset[attr]) : -1;
      var bv = b.dataset[attr] !== '' && b.dataset[attr] != null ? parseFloat(b.dataset[attr]) : -1;
      return asc ? av - bv : bv - av;
    });
    ranked.forEach(function (c, i) { c.style.order = i; });
  });
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("wrote index.html,", html.length, "bytes,", props.length, "properties");
