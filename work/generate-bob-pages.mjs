import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";

const root = "outputs/bob-eponge";
const manifestSource = "work/bob-eponge/cards-manifest.json";
const rarityOrder = ["FR", "R", "SR", "SSR", "UR", "AR", "OR", "SLR", "SCR", "STR", "UGR", "XR", "PR"];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function waveNumber(card) {
  return Number(String(card.series || "").match(/\d+/)?.[0] || 999);
}

function cardNumber(card) {
  return Number(String(card.reference || card.id || "").match(/(\d+)$/)?.[1] || 9999);
}

function variantRank(card) {
  if (/etoile/i.test(String(card.variant || card.display || ""))) return 1;
  return 0;
}

function sortCards(a, b) {
  return waveNumber(a) - waveNumber(b)
    || String(a.display || "").localeCompare(String(b.display || ""), "fr", { numeric: true })
    || variantRank(a) - variantRank(b)
    || cardNumber(a) - cardNumber(b)
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
    <title>Bob l'éponge - ${escapeHtml(rarity)}</title>
    <meta name="description" content="Liste compacte des cartes Bob l'éponge de rareté ${escapeHtml(rarity)}, avec visuels, références, waves et variantes.">
    <link rel="stylesheet" href="../styles.css">
  </head>
  <body data-page="rarity" data-collection-key="bob-eponge" data-card-label="Carte Bob l'éponge">
    <header class="topbar">
      <div>
        <p class="eyebrow">Rareté Bob l'éponge</p>
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
            <a class="ghost-button" href="../../index.html">Toutes les licences</a>
            <h2 id="cardsTitle">Cartes ${escapeHtml(rarity)}</h2>
          </div>
          <p id="cardsNote" class="section-note">Triées par wave puis numéro</p>
        </div>

        <section id="filters" class="controls" aria-label="Filtres de recherche">
          <label class="search">
            <span>Recherche</span>
            <input id="searchInput" type="search" placeholder="Référence, wave, variante..." autocomplete="off" inputmode="search">
          </label>

          <label>
            <span>Wave</span>
            <select id="seriesFilter"></select>
          </label>

          <label>
            <span>Variante</span>
            <select id="displayFilter"></select>
          </label>

          <label>
            <span>Collection</span>
            <select id="ownershipFilter">
              <option value="">Toutes les cartes</option>
              <option value="owned">Possédées</option>
              <option value="missing">Manquantes</option>
            </select>
          </label>

          <button id="clearFilters" class="filter-reset" type="button" disabled>Réinitialiser</button>
        </section>

        <section class="collection-panel" aria-label="Gestion de la collection">
          <div class="collection-count">
            <strong id="ownedCards">0</strong>
            <span>/</span>
            <span id="collectionTotal">${count}</span>
            <span>cartes possédées</span>
            <span class="count-extra"><strong id="ownedCopies">0</strong> exemplaires</span>
            <span class="count-extra"><strong id="gradedCards">0</strong> gradées</span>
          </div>

          <details class="backup-panel">
            <summary>Fichier de collection</summary>
            <div class="backup-grid">
              <p class="backup-help">Télécharge un fichier JSON pour sauvegarder ou partager ta collection, puis réimporte-le pour retrouver le total d'exemplaires et le sous-total de cartes gradées.</p>
              <div class="backup-actions">
                <button id="downloadCollection" class="secondary-button" type="button">Télécharger</button>
                <button id="importCollection" class="secondary-button" type="button">Importer</button>
                <input id="collectionFile" type="file" accept="application/json,.json,.txt" hidden>
              </div>
              <p id="backupStatus" class="backup-status" aria-live="polite"></p>
            </div>
          </details>
        </section>

        <section class="cards-grid-wrap" aria-label="Liste des visuels ${escapeHtml(rarity)}">
          <div id="cardsTable" class="visual-grid"></div>
          <p id="emptyState" class="empty" hidden>Aucune carte ne correspond aux filtres.</p>
        </section>
      </section>
    </main>

    <a class="filter-jump" href="#filters" aria-label="Revenir aux filtres">Filtres</a>

    <footer>
      <p>Checklist Bob l'éponge générée depuis les visuels fournis localement.</p>
    </footer>

    <script src="../data/card-keys.js"></script>
    <script src="../data/rarities/${slug}.js"></script>
    <script src="../rarity-page.js"></script>
  </body>
</html>
`;
}

function indexHtml(totalCards, rarityCount) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bob l'éponge - Raretés</title>
    <meta name="description" content="Liste visuelle des raretés Bob l'éponge avec pages dédiées, visuels légers et suivi de collection.">
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <header class="topbar">
      <div>
        <p class="eyebrow">Checklist visuelle</p>
        <h1>Bob l'éponge</h1>
      </div>
      <div class="stats" aria-label="Statistiques de la liste">
        <span><strong id="totalCards">${totalCards}</strong> cartes</span>
        <span><strong id="visibleCards">${rarityCount}</strong> raretés</span>
      </div>
    </header>

    <main>
      <section class="rarity-overview" aria-labelledby="rarityTitle">
        <div class="section-head">
          <div>
            <a class="ghost-button" href="../../index.html">Toutes les licences</a>
            <p class="eyebrow">Choix de la liste</p>
            <h2 id="rarityTitle">Raretés Bob l'éponge</h2>
          </div>
          <p id="rarityCount" class="section-note"></p>
        </div>

        <div class="home-toolbar" aria-label="Recherche de rareté">
          <label class="search">
            <span>Recherche</span>
            <input id="raritySearch" type="search" placeholder="R, SSR, ETOILE..." autocomplete="off" inputmode="search">
          </label>
        </div>

        <div id="rarityGrid" class="rarity-grid"></div>
        <p id="emptyState" class="empty" hidden>Aucune rareté ne correspond à cette recherche.</p>
      </section>
    </main>

    <footer>
      <p>Chaque rareté ouvre une page dédiée pour garder le site rapide, même avec les visuels.</p>
    </footer>

    <script src="./data/rarities-summary.js"></script>
    <script src="./index-app.js"></script>
  </body>
</html>
`;
}

const cards = JSON.parse((await readFile(manifestSource, "utf8")).replace(/^\uFEFF/, ""));
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
  .sort((a, b) => {
    const aRank = rarityOrder.indexOf(a.rarity);
    const bRank = rarityOrder.indexOf(b.rarity);
    return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank)
      || a.rarity.localeCompare(b.rarity, "fr", { numeric: true });
  });

for (const item of summary) {
  const cardsForRarity = [...groups.get(item.rarity)].sort(sortCards);
  await writeFile(
    `${root}/data/rarities/${item.slug}.js`,
    `window.KAYOUDEX_RARITY = ${JSON.stringify(item)};\nwindow.KAYOUDEX_RARITY_CARDS = ${JSON.stringify(cardsForRarity, null, 2)};\n`,
    "utf8"
  );
  await writeFile(`${root}/rarites/${item.slug}.html`, pageHtml(item.rarity, item.slug, item.count), "utf8");
}

await writeFile(`${root}/data/rarities-summary.js`, `window.KAYOUDEX_RARITIES = ${JSON.stringify(summary, null, 2)};\n`, "utf8");

const cardKeys = cards.map((card) => String(card.reference || card.id || "").trim()).filter(Boolean);
await writeFile(`${root}/data/card-keys.js`, `window.KAYOUDEX_CARD_KEYS = ${JSON.stringify(cardKeys)};\n`, "utf8");
await writeFile(`${root}/data/cards.js`, `window.KAYOUDEX_CARDS = ${JSON.stringify(cards, null, 2)};\n`, "utf8");
await writeFile(`${root}/index.html`, indexHtml(cards.length, summary.length), "utf8");
await copyFile("outputs/naruto-kayou/styles.css", `${root}/styles.css`);
await copyFile("outputs/naruto-kayou/index-app.js", `${root}/index-app.js`);
await copyFile("outputs/naruto-kayou/rarity-page.js", `${root}/rarity-page.js`);

console.table(summary.map(({ rarity, count, href }) => ({ rarity, count, href })));
