import { readdir, readFile, writeFile } from "node:fs/promises";
import { normalize } from "node:path";

const root = "outputs/naruto-kayou";
const rarityDataDir = `${root}/data/rarities`;

function extractPayload(js) {
  const metaMatch = js.match(/window\.NARUTO_KAYOU_RARITY\s*=\s*(\{.*?\});\s*window\.NARUTO_KAYOU_RARITY_CARDS/s);
  const cardsMatch = js.match(/window\.NARUTO_KAYOU_RARITY_CARDS\s*=\s*(\[.*\]);\s*$/s);
  if (!metaMatch || !cardsMatch) throw new Error("Invalid rarity data file");
  return {
    meta: JSON.parse(metaMatch[1]),
    cards: JSON.parse(cardsMatch[1]),
  };
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Not a WebP file");
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (chunk === "VP8X") {
      return {
        width: readUInt24LE(buffer, data + 4) + 1,
        height: readUInt24LE(buffer, data + 7) + 1,
      };
    }

    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(data + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    if (chunk === "VP8 ") {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }

    offset += 8 + size + (size % 2);
  }

  throw new Error("No WebP dimension chunk found");
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("Not a JPEG file");
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + length;
  }

  throw new Error("No JPEG dimension marker found");
}

function pngDimensions(buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) throw new Error("Not a PNG file");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function imageDimensions(buffer, imagePath) {
  if (/\.webp$/i.test(imagePath)) return webpDimensions(buffer);
  if (/\.jpe?g$/i.test(imagePath)) return jpegDimensions(buffer);
  if (/\.png$/i.test(imagePath)) return pngDimensions(buffer);
  throw new Error(`Unsupported image type: ${imagePath}`);
}

function localPathFromImage(image) {
  if (!image || !image.startsWith("../assets/")) return null;
  return normalize(`${root}/rarites/${image}`);
}

const files = (await readdir(rarityDataDir)).filter((file) => file.endsWith(".js")).sort();
let updated = 0;
let missing = 0;

for (const file of files) {
  const filePath = `${rarityDataDir}/${file}`;
  const { meta, cards } = extractPayload(await readFile(filePath, "utf8"));

  for (const card of cards) {
    const imagePath = localPathFromImage(card.image);
    if (!imagePath) {
      missing += 1;
      continue;
    }

    const dimensions = imageDimensions(await readFile(imagePath), imagePath);
    card.imageWidth = dimensions.width;
    card.imageHeight = dimensions.height;
    card.imageOrientation = dimensions.width > dimensions.height ? "landscape" : "portrait";
    updated += 1;
  }

  await writeFile(
    filePath,
    `window.NARUTO_KAYOU_RARITY = ${JSON.stringify(meta)};\nwindow.NARUTO_KAYOU_RARITY_CARDS = ${JSON.stringify(cards, null, 2)};\n`,
    "utf8"
  );
}

console.log(`Images updated: ${updated}`);
console.log(`Cards without local image: ${missing}`);
