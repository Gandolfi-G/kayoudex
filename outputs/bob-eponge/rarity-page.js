(function () {
  const COLLECTION_ID = document.body.dataset.collectionKey || "kayoudex";
  const CARD_LABEL = document.body.dataset.cardLabel || "Carte";
  const STORAGE_KEY = `kayoudex-${COLLECTION_ID}-collection-v2`;
  const LEGACY_CURRENT_STORAGE_KEY = "kayoudex-collection-v2";
  const LEGACY_STORAGE_KEY = "kayoudex-owned-cards-v1";
  const LEGACY_BACKUP_PREFIX = "KAYOUDEX1.";
  const BITSET_BACKUP_PREFIX = "KAYOUDEX2.";
  const cards = Array.isArray(window.KAYOUDEX_RARITY_CARDS)
    ? window.KAYOUDEX_RARITY_CARDS
    : (Array.isArray(window.NARUTO_KAYOU_RARITY_CARDS) ? window.NARUTO_KAYOU_RARITY_CARDS : []);
  const cardKeys = Array.isArray(window.KAYOUDEX_CARD_KEYS)
    ? window.KAYOUDEX_CARD_KEYS
    : (Array.isArray(window.NARUTO_KAYOU_CARD_KEYS) ? window.NARUTO_KAYOU_CARD_KEYS : []);
  const table = document.querySelector("#cardsTable");
  const emptyState = document.querySelector("#emptyState");
  const visibleCards = document.querySelector("#visibleCards");
  const ownedCards = document.querySelector("#ownedCards");
  const ownedCopies = document.querySelector("#ownedCopies");
  const gradedCards = document.querySelector("#gradedCards");
  const searchInput = document.querySelector("#searchInput");
  const seriesFilter = document.querySelector("#seriesFilter");
  const displayFilter = document.querySelector("#displayFilter");
  const ownershipFilter = document.querySelector("#ownershipFilter");
  const clearFilters = document.querySelector("#clearFilters");
  const backupStatus = document.querySelector("#backupStatus");
  const downloadCollection = document.querySelector("#downloadCollection") || document.querySelector("#exportCollection");
  const importCollection = document.querySelector("#importCollection");
  const collectionFile = document.querySelector("#collectionFile");

  let collection = readCollection();

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function cardKey(card) {
    return String(card.reference || card.id || "").trim();
  }

  function clampNumber(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.min(number, 999);
  }

  function normalizeEntry(entry) {
    const quantity = clampNumber(entry?.quantity);
    const graded = clampNumber(entry?.graded);
    return {
      quantity: Math.max(quantity, graded),
      graded,
    };
  }

  function hasEntry(entry) {
    return Boolean(entry && (entry.quantity > 0 || entry.graded > 0));
  }

  function isOwned(key) {
    return hasEntry(collection.get(key));
  }

  function sortKeys(keys) {
    return [...keys].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  }

  function bytesToBinary(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return binary;
  }

  function base64UrlToBytes(value) {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function collectionFromOwnedKeys(keys) {
    const restored = new Map();
    for (const key of keys) {
      if (key) restored.set(String(key), { quantity: 1, graded: 0 });
    }
    return restored;
  }

  function decodeLegacyBackup(value) {
    const clean = String(value || "").trim();
    if (!clean) return new Map();
    if (clean.startsWith(BITSET_BACKUP_PREFIX)) {
      const bytes = base64UrlToBytes(clean.slice(BITSET_BACKUP_PREFIX.length));
      const keys = [];
      for (let index = 0; index < cardKeys.length; index += 1) {
        if (bytes[index >> 3] & (1 << (index % 8))) keys.push(cardKeys[index]);
      }
      return collectionFromOwnedKeys(keys);
    }
    const raw = clean.startsWith(LEGACY_BACKUP_PREFIX) ? clean.slice(LEGACY_BACKUP_PREFIX.length) : clean;
    const bytes = base64UrlToBytes(raw);
    const payload = JSON.parse(decodeURIComponent(escape(bytesToBinary(bytes))));
    if (!payload || payload.v !== 1 || !Array.isArray(payload.cards)) {
      throw new Error("Code invalide");
    }
    return collectionFromOwnedKeys(payload.cards);
  }

  function readCollection() {
    try {
      const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_CURRENT_STORAGE_KEY) || "null");
      if (payload?.version === 2 && Array.isArray(payload.cards)) {
        const restored = new Map();
        for (const card of payload.cards) {
          const key = String(card.reference || card.id || "").trim();
          const entry = normalizeEntry(card);
          if (key && hasEntry(entry)) restored.set(key, entry);
        }
        return restored;
      }
    } catch {
      // Ignore malformed local data and try the legacy storage below.
    }

    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
      if (Array.isArray(legacy)) {
        const restored = collectionFromOwnedKeys(legacy);
        if (restored.size) saveCollection(restored);
        return restored;
      }
    } catch {
      // Empty collection is safer than blocking the page.
    }

    return new Map();
  }

  function collectionPayload(source = collection) {
    return {
      app: "kayoudex",
      version: 2,
      exportedAt: new Date().toISOString(),
      cards: sortKeys(source.keys()).map((key) => {
        const entry = normalizeEntry(source.get(key));
        return {
          reference: key,
          quantity: entry.quantity,
          graded: entry.graded,
        };
      }).filter((card) => card.quantity > 0 || card.graded > 0),
    };
  }

  function saveCollection(source = collection) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectionPayload(source)));
  }

  function parseCollectionFile(payload) {
    if (payload?.app === "kayoudex" && payload.version === 2 && Array.isArray(payload.cards)) {
      const restored = new Map();
      for (const card of payload.cards) {
        const key = String(card.reference || card.id || "").trim();
        const entry = normalizeEntry(card);
        if (key && hasEntry(entry)) restored.set(key, entry);
      }
      return restored;
    }
    if (payload?.v === 1 && Array.isArray(payload.cards)) {
      return collectionFromOwnedKeys(payload.cards);
    }
    if (Array.isArray(payload)) {
      return collectionFromOwnedKeys(payload);
    }
    throw new Error("Fichier invalide");
  }

  function downloadCollectionFile() {
    const payload = JSON.stringify(collectionPayload(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `kayoudex-collection-${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    backupStatus.textContent = "Fichier de collection téléchargé.";
  }

  function uniqueValues(key) {
    return [...new Set(cards.map((card) => card[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  }

  function fillSelect(select, label, values) {
    select.innerHTML = [`<option value="">${label}</option>`]
      .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
      .join("");
  }

  function matchesSearch(card, query) {
    if (!query) return true;
    return normalizeText([card.reference, card.id, card.rarity, card.series, card.display, card.variant, card.type, card.imageAlt].join(" ")).includes(query);
  }

  function matchesOwnership(card, ownership) {
    if (!ownership) return true;
    const cardOwned = isOwned(cardKey(card));
    return ownership === "owned" ? cardOwned : !cardOwned;
  }

  function orientationClass(card) {
    if (card.imageOrientation === "landscape") return " is-landscape";
    if (card.imageWidth && card.imageHeight && card.imageWidth > card.imageHeight) return " is-landscape";
    return "";
  }

  function updateOwnedCount() {
    let ownedOnPage = 0;
    let copiesOnPage = 0;
    let gradedOnPage = 0;
    for (const card of cards) {
      const entry = collection.get(cardKey(card));
      if (!hasEntry(entry)) continue;
      ownedOnPage += 1;
      copiesOnPage += entry.quantity;
      gradedOnPage += entry.graded;
    }
    ownedCards.textContent = ownedOnPage;
    if (ownedCopies) ownedCopies.textContent = copiesOnPage;
    if (gradedCards) gradedCards.textContent = gradedOnPage;
  }

  function render() {
    const query = normalizeText(searchInput.value.trim());
    const series = seriesFilter.value;
    const display = displayFilter.value;
    const ownership = ownershipFilter.value;
    const filtered = cards.filter((card) => {
      return matchesSearch(card, query)
        && (!series || card.series === series)
        && (!display || card.display === display)
        && matchesOwnership(card, ownership);
    });

    table.innerHTML = filtered.map((card, index) => {
      const key = cardKey(card);
      const entry = normalizeEntry(collection.get(key));
      const cardOwned = hasEntry(entry);
      return `
        <article class="visual-card${orientationClass(card)}${cardOwned ? " is-owned" : ""}" data-card-key="${escapeHtml(key)}" itemscope itemtype="https://schema.org/CreativeWork">
          <button class="visual-link card-image-toggle" type="button" data-card-key="${escapeHtml(key)}" aria-pressed="${cardOwned ? "true" : "false"}" aria-label="${escapeHtml(`${cardOwned ? "Retirer" : "Ajouter"} ${card.reference || card.id} de ma collection`)}">
            ${card.image ? `
              <img
                src="${escapeHtml(card.image)}"
                alt="${escapeHtml(card.imageAlt || `${CARD_LABEL} ${card.reference || card.id}`)}"
                width="${escapeHtml(card.imageWidth || 213)}"
                height="${escapeHtml(card.imageHeight || 300)}"
                loading="${index < 12 ? "eager" : "lazy"}"
                decoding="async"
                fetchpriority="${index < 4 ? "high" : "auto"}"
                itemprop="image"
              >
            ` : `<span class="image-missing">Visuel indisponible</span>`}
            <span class="sr-only">${cardOwned ? "Carte possédée" : "Carte non possédée"}</span>
          </button>
          <div class="visual-info">
            <div class="collection-controls">
              <label class="card-owned-toggle">
                <input class="owned-checkbox" type="checkbox" value="${escapeHtml(key)}" ${cardOwned ? "checked" : ""}>
                <span>Je l'ai</span>
              </label>
              <label class="quantity-field">
                <span>Total</span>
                <input class="quantity-input" type="number" inputmode="numeric" min="0" max="999" value="${entry.quantity}" data-field="quantity" data-card-key="${escapeHtml(key)}" aria-label="Nombre d'exemplaires ${escapeHtml(card.reference || card.id)}">
              </label>
              <label class="quantity-field">
                <span>Grad.</span>
                <input class="quantity-input" type="number" inputmode="numeric" min="0" max="999" value="${entry.graded}" data-field="graded" data-card-key="${escapeHtml(key)}" aria-label="Nombre de cartes gradées ${escapeHtml(card.reference || card.id)}">
              </label>
            </div>
            <h3 itemprop="name">${escapeHtml(card.reference || card.id)}</h3>
            <p>
              <span class="rarity">${escapeHtml(card.rarity)}</span>
              <span>${escapeHtml(card.series)}</span>
              ${card.display ? `<span>${escapeHtml(card.display)}</span>` : ""}
            </p>
          </div>
        </article>
      `;
    }).join("");

    visibleCards.textContent = filtered.length;
    emptyState.hidden = filtered.length > 0;
    clearFilters.disabled = !searchInput.value.trim() && !series && !display && !ownership;
    updateOwnedCount();
  }

  function updateCardElement(cardElement, key) {
    const entry = normalizeEntry(collection.get(key));
    const cardOwned = hasEntry(entry);
    cardElement?.classList.toggle("is-owned", cardOwned);
    const checkbox = cardElement?.querySelector(".owned-checkbox");
    if (checkbox) checkbox.checked = cardOwned;
    const quantityInput = cardElement?.querySelector(".quantity-input[data-field='quantity']");
    const gradedInput = cardElement?.querySelector(".quantity-input[data-field='graded']");
    if (quantityInput) quantityInput.value = entry.quantity;
    if (gradedInput) gradedInput.value = entry.graded;
    const imageToggle = cardElement?.querySelector(".card-image-toggle");
    if (imageToggle) {
      const reference = cardElement?.querySelector("[itemprop='name']")?.textContent || key;
      imageToggle.setAttribute("aria-pressed", cardOwned ? "true" : "false");
      imageToggle.setAttribute("aria-label", `${cardOwned ? "Retirer" : "Ajouter"} ${reference} de ma collection`);
      const stateText = imageToggle.querySelector(".sr-only");
      if (stateText) stateText.textContent = cardOwned ? "Carte possédée" : "Carte non possédée";
    }
  }

  function setCollectionEntry(key, entry, cardElement) {
    if (!key) return;
    const normalized = normalizeEntry(entry);
    if (hasEntry(normalized)) {
      collection.set(key, normalized);
    } else {
      collection.delete(key);
    }
    saveCollection();
    if (ownershipFilter.value) {
      render();
      return;
    }
    updateCardElement(cardElement, key);
    updateOwnedCount();
  }

  fillSelect(seriesFilter, "Toutes les séries", uniqueValues("series"));
  fillSelect(displayFilter, "Tous les displays", uniqueValues("display"));
  [searchInput, seriesFilter, displayFilter, ownershipFilter].forEach((control) => control.addEventListener("input", render));
  clearFilters.addEventListener("click", () => {
    searchInput.value = "";
    seriesFilter.value = "";
    displayFilter.value = "";
    ownershipFilter.value = "";
    render();
    searchInput.focus();
  });

  table.addEventListener("change", (event) => {
    const checkbox = event.target.closest(".owned-checkbox");
    const quantityInput = event.target.closest(".quantity-input");
    if (checkbox) {
      const cardElement = checkbox.closest(".visual-card");
      const key = checkbox.value;
      const current = normalizeEntry(collection.get(key));
      setCollectionEntry(key, checkbox.checked ? { ...current, quantity: Math.max(current.quantity, 1) } : { quantity: 0, graded: 0 }, cardElement);
      return;
    }
    if (quantityInput) {
      const cardElement = quantityInput.closest(".visual-card");
      const key = quantityInput.dataset.cardKey;
      const current = normalizeEntry(collection.get(key));
      const nextValue = clampNumber(quantityInput.value);
      const next = quantityInput.dataset.field === "graded"
        ? { quantity: Math.max(current.quantity, nextValue), graded: nextValue }
        : { quantity: nextValue, graded: Math.min(current.graded, nextValue) };
      setCollectionEntry(key, next, cardElement);
    }
  });

  table.addEventListener("click", (event) => {
    const imageToggle = event.target.closest(".card-image-toggle");
    if (!imageToggle) return;
    const cardElement = imageToggle.closest(".visual-card");
    const key = imageToggle.dataset.cardKey;
    const current = normalizeEntry(collection.get(key));
    setCollectionEntry(key, hasEntry(current) ? { quantity: 0, graded: 0 } : { quantity: 1, graded: 0 }, cardElement);
  });

  downloadCollection?.addEventListener("click", downloadCollectionFile);

  importCollection?.addEventListener("click", () => {
    collectionFile?.click();
  });

  collectionFile?.addEventListener("change", async () => {
    const file = collectionFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const trimmed = text.trim();
      collection = trimmed.startsWith("{") || trimmed.startsWith("[")
        ? parseCollectionFile(JSON.parse(trimmed))
        : decodeLegacyBackup(trimmed);
      saveCollection();
      backupStatus.textContent = `Collection restaurée depuis ${file.name}.`;
      render();
    } catch {
      backupStatus.textContent = "Fichier impossible à lire.";
    } finally {
      collectionFile.value = "";
    }
  });

  render();
})();
