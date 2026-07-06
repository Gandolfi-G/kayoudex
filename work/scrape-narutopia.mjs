import { writeFile } from "node:fs/promises";

const pages = [
  ["R", "https://narutopia.fr/r-naruto-kayou"],
  ["SR", "https://narutopia.fr/sr-naruto-kayou"],
  ["SSR", "https://narutopia.fr/ssr-naruto-kayou"],
  ["TR/TGR", "https://narutopia.fr/tr-tgr-naruto-kayou"],
  ["HR", "https://narutopia.fr/hr-naruto-kayou"],
  ["PTR", "https://narutopia.fr/cartes-ptr-naruto-kayou/"],
  ["UR", "https://narutopia.fr/ur-naruto-kayou"],
  ["ZR", "https://narutopia.fr/zr-naruto-kayou"],
  ["AR", "https://narutopia.fr/ar-naruto-kayou"],
  ["OR", "https://narutopia.fr/or-naruto-kayou"],
  ["SLR", "https://narutopia.fr/slr-naruto-kayou"],
  ["CP", "https://narutopia.fr/cp-naruto-kayou"],
  ["PU", "https://narutopia.fr/cartes-pu-naruto-kayou/"],
  ["SP", "https://narutopia.fr/sp-naruto-kayou"],
  ["MR", "https://narutopia.fr/mr-naruto-kayou"],
  ["GP", "https://narutopia.fr/gp-naruto-kayou"],
  ["CR", "https://narutopia.fr/cr-naruto-kayou"],
  ["NR", "https://narutopia.fr/nr-naruto-kayou"],
  ["BP", "https://narutopia.fr/bp-naruto-kayou"],
  ["SE", "https://narutopia.fr/se-naruto-kayou"],
  ["ASP", "https://narutopia.fr/cartes-asp-naruto-kayou/"],
  ["SV", "https://narutopia.fr/sv-naruto-kayou"],
  ["SCR", "https://narutopia.fr/scr-naruto-kayou"],
  ["LR", "https://narutopia.fr/lr-naruto-kayou"],
  ["PR", "https://narutopia.fr/pr-naruto-kayou"],
  ["BR", "https://narutopia.fr/br-naruto-kayou"],
];

function decodeHtml(text) {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#8211;", "-")
    .replaceAll("&ndash;", "-")
    .replaceAll("&amp;", "&")
    .replaceAll("&eacute;", "e")
    .replaceAll("é", "e")
    .replaceAll("É", "E")
    .replaceAll("é", "e");
}

function extractLines(html) {
  const blocks = [...html.matchAll(/<(h[1-6]|p|figcaption)[^>]*>(.*?)<\/\1>/gis)]
    .map((match) => match[2])
    .join("\n");
  return decodeHtml(blocks)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractCardImages(html) {
  const imageByReference = new Map();
  const tokenPattern = /<img[^>]*>|<h[1-6][^>]*>.*?<\/h[1-6]>/gis;
  let pendingImage = null;

  function attr(tag, name) {
    return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1] || "";
  }

  function storeImage(parsed, image) {
    const keys = new Set([
      parsed.reference,
      parsed.id,
      normalizedReferenceKey(parsed.reference),
      normalizedReferenceKey(parsed.id),
    ]);
    for (const key of keys) {
      if (key && !imageByReference.has(key)) imageByReference.set(key, image);
    }
  }

  function referenceFromImageUrl(url) {
    const filename = decodeURIComponent(new URL(url).pathname.split("/").pop() || "")
      .replace(/-\d+x\d+(?=\.(?:webp|jpe?g|png)$)/i, "")
      .replace(/\.(?:webp|jpe?g|png)$/i, "");
    return parseReference(filename);
  }

  for (const tokenMatch of html.matchAll(tokenPattern)) {
    const token = tokenMatch[0];

    if (/^<img/i.test(token)) {
      const srcset = attr(token, "data-srcset") || attr(token, "srcset");
      const src = attr(token, "data-src") || attr(token, "src");
      const thumb = srcset.match(/(https?:\/\/[^,\s"']+-(?:\d+x\d+)\.(?:webp|jpe?g|png))/i)?.[1] || src;
      const full = src.match(/^https?:\/\//i) ? src : thumb;
      if (/\/wp-content\/uploads\/.+\.(?:webp|jpe?g|png)/i.test(thumb)) {
        pendingImage = { image: thumb, fullImage: full };
        const parsedFromImage = referenceFromImageUrl(thumb);
        if (parsedFromImage) storeImage(parsedFromImage, pendingImage);
      }
      continue;
    }

    const headingText = decodeHtml(token.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const parsed = parseReference(headingText);
    if (parsed && pendingImage) {
      storeImage(parsed, pendingImage);
      pendingImage = null;
    }
  }

  return imageByReference;
}

function displayFromReference(reference) {
  if (/^NRB\d{2}-/i.test(reference)) return "2 Yuan";
  if (/^NRZ\d{2}-/i.test(reference)) return "10 Yuan";
  return "";
}

function parseReference(line) {
  const reference = line.match(/\b(?:[A-Z]{2,}\d{2}-[A-Z]{1,4}-\d{1,3}|[A-Z]{1,4}-\d{1,3}(?:-[A-ZÀ-ÖØ-Þ0-9 ]+)?)\b/i)?.[0]?.trim().toUpperCase();
  if (!reference) return null;
  const id = reference.match(/^(?:[A-Z]{2,}\d{2}-[A-Z]{1,4}-\d{1,3}|[A-Z]{1,4}-\d{1,3})/i)?.[0]?.toUpperCase();
  return id ? { id, reference } : null;
}

function normalizedReferenceKey(reference) {
  return String(reference || "").replace(/^([A-Z]{1,4})-(\d{1,3})(.*)$/i, (_, prefix, number, suffix) => {
    return `${prefix.toUpperCase()}-${number.padStart(3, "0")}${String(suffix || "").toUpperCase()}`;
  });
}

function seriesFromReference(reference) {
  const match = reference.match(/^NR[BZ](\d{2})-/i);
  if (!match) return "";
  return `Serie ${Number(match[1])}`;
}

function isValidCardReference(reference) {
  return reference !== "TR-00";
}

function collectorReference(card, image) {
  const match = image.image.match(/\/SS-([A-Z]+)-(\d+)(?:-|\.webp)/i);
  if (!match) return card;
  const rarity = match[1].toUpperCase();
  const number = match[2].padStart(3, "0");
  const suffix = String(card.reference || card.id).match(new RegExp(`^${rarity}-\\d{1,3}-(.+)$`, "i"))?.[1] || "";
  const id = `SS-${rarity}-${number}`;
  return {
    ...card,
    id,
    reference: suffix ? `${id}-${suffix}` : id,
    display: card.display || "Collector Noir-Dore",
  };
}

function specialImageReference(card, image) {
  const aspDiamond = image.image.match(/\/NRZ08-◇ASP-(\d+)(?:-|\.webp)/i);
  if (!aspDiamond) return card;
  const id = `NRZ08-◇ASP-${aspDiamond[1].padStart(3, "0")}`;
  return {
    ...card,
    id,
    reference: id,
    display: "10 Yuan - ASP losange",
  };
}

function enrichCard(card, imageByReference) {
  const inferredSeries = seriesFromReference(card.id);
  const inferredDisplay = displayFromReference(card.id);
  let baseCard = {
    ...card,
    series: inferredSeries || card.series,
    display: card.display || inferredDisplay,
  };
  const image = imageByReference.get(card.reference)
    || imageByReference.get(card.id)
    || imageByReference.get(normalizedReferenceKey(card.reference))
    || imageByReference.get(normalizedReferenceKey(card.id));
  if (!image) return baseCard;
  baseCard = specialImageReference(baseCard, image);
  baseCard = collectorReference(baseCard, image);
  const display = baseCard.display ? ` ${baseCard.display}` : "";
  return {
    ...baseCard,
    image: image.image,
    fullImage: image.fullImage,
    imageAlt: `Carte Naruto Kayou ${baseCard.reference || baseCard.id} rarete ${baseCard.rarity} ${baseCard.series}${display}`,
  };
}

function extractCards(lines, rarity, source) {
  const cards = [];
  const seriesById = new Map();
  const textIds = new Set();
  let pendingId = null;
  let pendingReference = null;
  let currentSeries = "";
  let currentSection = {};

  for (const line of lines) {
    const section = line.match(/Serie\s+(\d+)\s+Yuan\s+(\d+)/i);
    if (section) {
      currentSection = {
        series: `Serie ${section[1]}`,
        display: `${section[2]} Yuan`,
      };
      continue;
    }

    const parsed = parseReference(line);
    const id = parsed?.id;
    const reference = parsed?.reference;
    const series = line.match(/Serie\s+\d+/i)?.[0];

    if (reference && !isValidCardReference(reference)) continue;

    if (id) textIds.add(id);

    if (id && series) {
      cards.push({ id, reference, rarity, series, display: "", name: "", type: "Carte", source });
      seriesById.set(id, series);
      currentSeries = series;
      pendingId = null;
      pendingReference = null;
      continue;
    }

    if (id && currentSection.series) {
      cards.push({
        id,
        reference,
        rarity,
        series: currentSection.series,
        display: currentSection.display,
        name: "",
        type: "Carte",
        source,
      });
      seriesById.set(id, currentSection.series);
      currentSeries = currentSection.series;
      pendingId = null;
      pendingReference = null;
      continue;
    }

    if (id) {
      if (pendingId && currentSeries) {
        cards.push({ id: pendingId, reference: pendingReference || pendingId, rarity, series: currentSeries, display: "", name: "", type: "Carte", source });
        seriesById.set(pendingId, currentSeries);
      }
      pendingId = id;
      pendingReference = reference;
      continue;
    }

    if (pendingId && series) {
      cards.push({ id: pendingId, reference: pendingReference || pendingId, rarity, series, display: "", name: "", type: "Carte", source });
      seriesById.set(pendingId, series);
      currentSeries = series;
      pendingId = null;
      pendingReference = null;
    }
  }

  if (pendingId && currentSeries) {
    cards.push({ id: pendingId, reference: pendingReference || pendingId, rarity, series: currentSeries, display: "", name: "", type: "Carte", source });
    seriesById.set(pendingId, currentSeries);
  }

  for (const id of textIds) {
    if (!cards.some((card) => card.id === id)) {
      cards.push({ id, reference: id, rarity, series: "Serie inconnue", display: "", name: "", type: "Carte", source });
    }
  }

  return { cards, seriesById };
}

function mergeCards(textCards, imageCards) {
  const cardsByReference = new Map();
  const textIds = new Set(textCards.map((card) => card.id));

  for (const card of textCards) {
    cardsByReference.set(card.reference || card.id, card);
  }

  for (const card of imageCards) {
    if (textIds.has(card.id)) continue;
    cardsByReference.set(card.reference || card.id, card);
  }

  return [...cardsByReference.values()];
}

function extractImageCards(html, rarity, source, seriesById) {
  const cards = [];
  const prefix = rarity.split("/")[0];
  const pattern = new RegExp(`/(${prefix})-(\\d+)\\.webp`, "gi");

  for (const match of html.matchAll(pattern)) {
    const id = `${match[1].toUpperCase()}-${match[2].padStart(3, "0")}`;
    cards.push({
      id,
      reference: id,
      rarity,
      series: seriesById.get(id) || "Serie inconnue",
      display: "",
      name: "",
      type: "Carte",
      source,
    });
  }

  return cards;
}

const allCards = [];
const summary = [];

for (const [rarity, url] of pages) {
  console.log(`Fetching ${rarity} from ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const html = await response.text();
  const imageById = extractCardImages(html);
  const textResult = extractCards(extractLines(html), rarity, url);
  const imageCards = extractImageCards(html, rarity, url, textResult.seriesById);
  const cards = mergeCards(textResult.cards, imageCards).map((card) => enrichCard(card, imageById));
  allCards.push(...cards);
  summary.push({ rarity, count: cards.length, url });
}

const seen = new Set();
const uniqueCards = allCards.filter((card) => {
  const key = `${card.rarity}|${card.reference || card.id}|${card.source}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

uniqueCards.sort((a, b) =>
  a.rarity.localeCompare(b.rarity, "fr") ||
  a.series.localeCompare(b.series, "fr", { numeric: true }) ||
  (a.reference || a.id).localeCompare(b.reference || b.id, "fr", { numeric: true })
);

await writeFile(
  "outputs/naruto-kayou/data/cards.js",
  `window.NARUTO_KAYOU_CARDS = ${JSON.stringify(uniqueCards, null, 2)};\n`,
  "utf8"
);

console.table(summary);
console.log(`Total cards: ${uniqueCards.length}`);
