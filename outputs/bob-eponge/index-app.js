(function () {
  const rarities = Array.isArray(window.KAYOUDEX_RARITIES)
    ? window.KAYOUDEX_RARITIES
    : (Array.isArray(window.NARUTO_KAYOU_RARITIES) ? window.NARUTO_KAYOU_RARITIES : []);
  const rarityGrid = document.querySelector("#rarityGrid");
  const rarityCount = document.querySelector("#rarityCount");
  const totalCards = document.querySelector("#totalCards");
  const visibleCards = document.querySelector("#visibleCards");
  const raritySearch = document.querySelector("#raritySearch");
  const emptyState = document.querySelector("#emptyState");

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

  function render() {
    const query = normalizeText(raritySearch.value.trim());
    const filtered = rarities.filter((rarity) => {
      return normalizeText([rarity.rarity, rarity.count, rarity.seriesCount].join(" ")).includes(query);
    });

    rarityGrid.innerHTML = filtered.map((rarity) => `
      <a class="rarity-card" href="${escapeHtml(rarity.href)}">
        <span class="rarity-code">${escapeHtml(rarity.rarity)}</span>
        <span class="rarity-meta">${rarity.count} cartes</span>
        <span class="rarity-sub">${rarity.seriesCount} séries</span>
      </a>
    `).join("");

    visibleCards.textContent = filtered.length;
    rarityCount.textContent = `${filtered.length} rareté${filtered.length > 1 ? "s" : ""} disponible${filtered.length > 1 ? "s" : ""}`;
    emptyState.hidden = filtered.length > 0;
  }

  const total = rarities.reduce((sum, rarity) => sum + rarity.count, 0);
  totalCards.textContent = total;
  raritySearch.addEventListener("input", render);
  render();
})();
