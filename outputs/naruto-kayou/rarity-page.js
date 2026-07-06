(function () {
  const STORAGE_KEY = "kayoudex-owned-cards-v1";
  const BACKUP_PREFIX = "KAYOUDEX2.";
  const LEGACY_BACKUP_PREFIX = "KAYOUDEX1.";
  const cards = Array.isArray(window.NARUTO_KAYOU_RARITY_CARDS) ? window.NARUTO_KAYOU_RARITY_CARDS : [];
  const cardKeys = Array.isArray(window.NARUTO_KAYOU_CARD_KEYS) ? window.NARUTO_KAYOU_CARD_KEYS : [];
  const cardKeyIndex = new Map(cardKeys.map((key, index) => [key, index]));
  const table = document.querySelector("#cardsTable");
  const emptyState = document.querySelector("#emptyState");
  const visibleCards = document.querySelector("#visibleCards");
  const ownedCards = document.querySelector("#ownedCards");
  const searchInput = document.querySelector("#searchInput");
  const seriesFilter = document.querySelector("#seriesFilter");
  const displayFilter = document.querySelector("#displayFilter");
  const ownershipFilter = document.querySelector("#ownershipFilter");
  const clearFilters = document.querySelector("#clearFilters");
  const backupCode = document.querySelector("#backupCode");
  const backupStatus = document.querySelector("#backupStatus");
  const exportCollection = document.querySelector("#exportCollection");
  const importCollection = document.querySelector("#importCollection");

  let ownedSet = readOwnedSet();

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

  function readOwnedSet() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return new Set(Array.isArray(stored) ? stored.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  function saveOwnedSet() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ownedSet].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))));
  }

  function bytesToBase64Url(bytes) {
    return btoa(bytesToBinary(bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
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

  function encodeLegacyBackup() {
    const payload = JSON.stringify({ v: 1, cards: [...ownedSet].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })) });
    return `${LEGACY_BACKUP_PREFIX}${btoa(unescape(encodeURIComponent(payload)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "")}`;
  }

  function encodeBackup() {
    if (!cardKeys.length) return encodeLegacyBackup();
    const bytes = new Uint8Array(Math.ceil(cardKeys.length / 8));
    for (const key of ownedSet) {
      const index = cardKeyIndex.get(key);
      if (index == null) return encodeLegacyBackup();
      bytes[index >> 3] |= 1 << (index % 8);
    }
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end -= 1;
    return `${BACKUP_PREFIX}${bytesToBase64Url(bytes.subarray(0, end))}`;
  }

  function decodeLegacyBackup(value) {
    const raw = value.startsWith(LEGACY_BACKUP_PREFIX) ? value.slice(LEGACY_BACKUP_PREFIX.length) : value;
    const bytes = base64UrlToBytes(raw);
    const payload = JSON.parse(decodeURIComponent(escape(bytesToBinary(bytes))));
    if (!payload || payload.v !== 1 || !Array.isArray(payload.cards)) {
      throw new Error("Code invalide");
    }
    return new Set(payload.cards.map(String).filter(Boolean));
  }

  function decodeBackup(value) {
    const clean = String(value || "").trim();
    if (clean.startsWith(LEGACY_BACKUP_PREFIX)) {
      return decodeLegacyBackup(clean);
    }
    if (!cardKeys.length) {
      return decodeLegacyBackup(clean);
    }
    const raw = clean.startsWith(BACKUP_PREFIX) ? clean.slice(BACKUP_PREFIX.length) : clean;
    const bytes = base64UrlToBytes(raw);
    const restored = new Set();
    for (let index = 0; index < cardKeys.length; index += 1) {
      if (bytes[index >> 3] & (1 << (index % 8))) {
        restored.add(cardKeys[index]);
      }
    }
    return restored;
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
    return normalizeText([card.reference, card.id, card.rarity, card.series, card.display, card.type, card.imageAlt].join(" ")).includes(query);
  }

  function matchesOwnership(card, ownership) {
    if (!ownership) return true;
    const isOwned = ownedSet.has(cardKey(card));
    return ownership === "owned" ? isOwned : !isOwned;
  }

  function orientationClass(card) {
    if (card.imageOrientation === "landscape") return " is-landscape";
    if (card.imageWidth && card.imageHeight && card.imageWidth > card.imageHeight) return " is-landscape";
    return "";
  }

  function updateOwnedCount() {
    const ownedOnPage = cards.reduce((sum, card) => sum + (ownedSet.has(cardKey(card)) ? 1 : 0), 0);
    ownedCards.textContent = ownedOnPage;
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
      const isOwned = ownedSet.has(key);
      return `
        <article class="visual-card${orientationClass(card)}${isOwned ? " is-owned" : ""}" data-card-key="${escapeHtml(key)}" itemscope itemtype="https://schema.org/CreativeWork">
          <a class="visual-link" href="${escapeHtml(card.fullImage || card.image || card.source)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(card.imageAlt || card.reference || card.id)}">
            ${card.image ? `
              <img
                src="${escapeHtml(card.image)}"
                alt="${escapeHtml(card.imageAlt || `Carte Naruto Kayou ${card.reference || card.id}`)}"
                width="${escapeHtml(card.imageWidth || 213)}"
                height="${escapeHtml(card.imageHeight || 300)}"
                loading="${index < 12 ? "eager" : "lazy"}"
                decoding="async"
                fetchpriority="${index < 4 ? "high" : "auto"}"
                itemprop="image"
              >
            ` : `<span class="image-missing">Visuel indisponible</span>`}
          </a>
          <div class="visual-info">
            <label class="card-owned-toggle">
              <input class="owned-checkbox" type="checkbox" value="${escapeHtml(key)}" ${isOwned ? "checked" : ""}>
              <span>Je l'ai</span>
            </label>
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
    if (!checkbox) return;
    const key = checkbox.value;
    if (checkbox.checked) {
      ownedSet.add(key);
    } else {
      ownedSet.delete(key);
    }
    saveOwnedSet();
    if (ownershipFilter.value) {
      render();
      return;
    }
    checkbox.closest(".visual-card")?.classList.toggle("is-owned", checkbox.checked);
    updateOwnedCount();
  });

  exportCollection.addEventListener("click", () => {
    backupCode.value = encodeBackup();
    backupCode.select();
    backupStatus.textContent = `Code généré (${backupCode.value.length} caractères). Garde-le pour restaurer ta collection plus tard.`;
  });

  importCollection.addEventListener("click", () => {
    try {
      ownedSet = decodeBackup(backupCode.value);
      saveOwnedSet();
      backupStatus.textContent = "Collection restaurée.";
      render();
    } catch {
      backupStatus.textContent = "Code impossible à lire.";
    }
  });

  render();
})();
