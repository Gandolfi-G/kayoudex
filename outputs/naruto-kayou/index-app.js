(function () {
  const rarities = Array.isArray(window.NARUTO_KAYOU_RARITIES) ? window.NARUTO_KAYOU_RARITIES : [];
  const rarityGrid = document.querySelector("#rarityGrid");
  const rarityCount = document.querySelector("#rarityCount");
  const totalCards = document.querySelector("#totalCards");
  const visibleCards = document.querySelector("#visibleCards");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const total = rarities.reduce((sum, rarity) => sum + rarity.count, 0);
  totalCards.textContent = total;
  visibleCards.textContent = rarities.length;
  rarityCount.textContent = `${rarities.length} raretés disponibles`;

  rarityGrid.innerHTML = rarities.map((rarity) => `
    <a class="rarity-card" href="${escapeHtml(rarity.href)}">
      <span class="rarity-code">${escapeHtml(rarity.rarity)}</span>
      <span class="rarity-meta">${rarity.count} cartes</span>
      <span class="rarity-sub">${rarity.seriesCount} séries</span>
    </a>
  `).join("");
})();
