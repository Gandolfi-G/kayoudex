import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = "outputs/naruto-kayou";
const cardsSource = `${root}/data/cards.js`;
const rarityOrder = ["R", "SR", "SSR", "TR/TGR", "HR", "PTR", "UR", "ZR", "AR", "OR", "SLR", "CP", "PU", "SP", "MR", "GP", "CR", "NR", "BP", "SE", "ASP", "SV", "SCR", "LR", "PR", "BR"];

function extractCards(js) {
  const json = js.replace(/^window\.NARUTO_KAYOU_CARDS\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(json);
}

function slugify(rarity) {
  return rarity.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function seriesNumber(card) {
  return Number(String(card.series || "").match(/\d+/)?.[0] || 999);
}

function displayRank(display) {
  if (!display) return 0;
  if (/2\s*Yuan/i.test(display)) return 1;
  if (/10\s*Yuan/i.test(display)) return 2;
  return 9;
}

function cardNumber(card) {
  return Number(String(card.reference || card.id || "").match(/(\d+)/)?.[1] || 9999);
}

function cardPrefixRank(card) {
  const prefix = String(card.reference || card.id || "").match(/^[A-Z]+/)?.[0] || "";
  if (prefix === "TR") return 0;
  if (prefix === "TGR") return 1;
  return 0;
}

function sortCards(a, b) {
  return seriesNumber(a) - seriesNumber(b)
    || displayRank(a.display) - displayRank(b.display)
    || cardNumber(a) - cardNumber(b)
    || cardPrefixRank(a) - cardPrefixRank(b)
    || String(a.reference || a.id).localeCompare(String(b.reference || b.id), "fr", { numeric: true });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageHtml(rarity, slug, count) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Naruto Kayou - ${escapeHtml(rarity)}</title>
    <meta name="description" content="Liste compacte des cartes Naruto Kayou de rareté ${escapeHtml(rarity)}, avec visuels, références, séries et displays.">
    <link rel="stylesheet" href="../styles.css">
  </head>
  <body data-page="rarity">
    <header class="topbar">
      <div>
        <p class="eyebrow">Rareté Naruto Kayou</p>
        <h1>${escapeHtml(rarity)}</h1>
      </div>
      <div class="stats" aria-label="Statistiques de la liste">
        <span><strong id="totalCards">${count}</strong> cartes</span>
        <span><strong id="visibleCards">${count}</strong> affichées</span>
      </div>
    </header>

    <main>
      <section class="list-panel" aria-labelledby="cardsTitle">
        <div class="section-head">
          <div>
            <a class="ghost-button" href="../index.html">Toutes les raretés</a>
            <h2 id="cardsTitle">Cartes ${escapeHtml(rarity)}</h2>
          </div>
          <p id="cardsNote" class="section-note">Triées par série puis numéro</p>
        </div>

        <section id="filters" class="controls" aria-label="Filtres de recherche">
          <label class="search">
            <span>Recherche</span>
            <input id="searchInput" type="search" placeholder="Référence, série, display..." autocomplete="off" inputmode="search">
          </label>

          <label>
            <span>Série</span>
            <select id="seriesFilter"></select>
          </label>

          <label>
            <span>Display</span>
            <select id="displayFilter"></select>
          </label>

          <button id="clearFilters" class="filter-reset" type="button" disabled>Réinitialiser</button>
        </section>

        <section class="cards-grid-wrap" aria-label="Liste des visuels ${escapeHtml(rarity)}">
          <div id="cardsTable" class="visual-grid"></div>
          <p id="emptyState" class="empty" hidden>Aucune carte ne correspond aux filtres.</p>
        </section>
      </section>
    </main>

    <a class="mobile-filter-jump" href="#filters" aria-label="Revenir aux filtres">Filtres</a>

    <footer>
      <p>Remerciements : checklist initiale constituée à partir des informations publiques de Narutopia, puis localisée pour ce site.</p>
    </footer>

    <script src="../data/rarities/${slug}.js"></script>
    <script src="../rarity-page.js"></script>
  </body>
</html>
`;
}

const cards = extractCards(await readFile(cardsSource, "utf8"));
const groups = new Map();
for (const card of cards) {
  if (!groups.has(card.rarity)) groups.set(card.rarity, []);
  groups.get(card.rarity).push(card);
}

await mkdir(`${root}/data/rarities`, { recursive: true });
await mkdir(`${root}/rarites`, { recursive: true });

const summary = [...groups.entries()]
  .map(([rarity, items]) => {
    const sorted = [...items].sort(sortCards);
    const slug = slugify(rarity);
    return {
      rarity,
      slug,
      count: sorted.length,
      seriesCount: new Set(sorted.map((card) => card.series).filter(Boolean)).size,
      href: `./rarites/${slug}.html`,
    };
  })
  .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

for (const item of summary) {
  const cardsForRarity = [...groups.get(item.rarity)].sort(sortCards);
  await writeFile(
    `${root}/data/rarities/${item.slug}.js`,
    `window.NARUTO_KAYOU_RARITY = ${JSON.stringify(item)};\nwindow.NARUTO_KAYOU_RARITY_CARDS = ${JSON.stringify(cardsForRarity, null, 2)};\n`,
    "utf8"
  );
  await writeFile(`${root}/rarites/${item.slug}.html`, pageHtml(item.rarity, item.slug, item.count), "utf8");
}

await writeFile(`${root}/data/rarities-summary.js`, `window.NARUTO_KAYOU_RARITIES = ${JSON.stringify(summary, null, 2)};\n`, "utf8");

console.table(summary.map(({ rarity, count, href }) => ({ rarity, count, href })));
