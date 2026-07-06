import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = "outputs/naruto-kayou";
const rarityDataDir = `${root}/data/rarities`;
const assetRoot = `${root}/assets/cards`;
const concurrency = 10;

function extractPayload(js) {
  const metaMatch = js.match(/window\.NARUTO_KAYOU_RARITY\s*=\s*(\{.*?\});\s*window\.NARUTO_KAYOU_RARITY_CARDS/s);
  const cardsMatch = js.match(/window\.NARUTO_KAYOU_RARITY_CARDS\s*=\s*(\[.*\]);\s*$/s);
  if (!metaMatch || !cardsMatch) throw new Error("Invalid rarity data file");
  return {
    meta: JSON.parse(metaMatch[1]),
    cards: JSON.parse(cardsMatch[1]),
  };
}

function safeFileName(url, fallback) {
  const fromUrl = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  return (fromUrl || `${fallback}.webp`)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function download(url, target) {
  if (existsSync(target)) return "cached";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(target, bytes);
  return "downloaded";
}

async function runPool(items, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

const files = (await readdir(rarityDataDir)).filter((file) => file.endsWith(".js")).sort();
let totalImages = 0;
let downloaded = 0;
let cached = 0;
let missing = 0;

for (const file of files) {
  const slug = file.replace(/\.js$/, "");
  const filePath = `${rarityDataDir}/${file}`;
  const { meta, cards } = extractPayload(await readFile(filePath, "utf8"));
  const assetDir = `${assetRoot}/${slug}`;
  await mkdir(assetDir, { recursive: true });

  const jobs = cards
    .filter((card) => card.image && /^https?:\/\//i.test(card.image))
    .map((card) => ({ card, url: card.image }));

  await runPool(jobs, async ({ card, url }) => {
    const name = safeFileName(url, card.reference || card.id);
    const localFile = `${assetDir}/${name}`;
    const localUrl = `../assets/cards/${slug}/${name}`;
    const state = await download(url, localFile);
    if (state === "downloaded") downloaded += 1;
    if (state === "cached") cached += 1;
    totalImages += 1;
    card.image = localUrl;
    card.fullImage = localUrl;
  });

  for (const card of cards) {
    if (!card.image) missing += 1;
  }

  await writeFile(
    filePath,
    `window.NARUTO_KAYOU_RARITY = ${JSON.stringify(meta)};\nwindow.NARUTO_KAYOU_RARITY_CARDS = ${JSON.stringify(cards, null, 2)};\n`,
    "utf8"
  );

  console.log(`${slug}: ${jobs.length} local images`);
}

console.log(`Images localized: ${totalImages}`);
console.log(`Downloaded: ${downloaded}`);
console.log(`Cached: ${cached}`);
console.log(`Cards without image: ${missing}`);
