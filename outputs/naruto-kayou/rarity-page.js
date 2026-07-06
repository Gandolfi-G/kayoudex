(function () {
  const cards = Array.isArray(window.NARUTO_KAYOU_RARITY_CARDS) ? window.NARUTO_KAYOU_RARITY_CARDS : [];
  const table = document.querySelector("#cardsTable");
  const emptyState = document.querySelector("#emptyState");
  const visibleCards = document.querySelector("#visibleCards");
  const searchInput = document.querySelector("#searchInput");
  const seriesFilter = document.querySelector("#seriesFilter");
  const displayFilter = document.querySelector("#displayFilter");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    return [card.reference, card.id, card.rarity, card.series, card.display, card.type]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  }

  function orientationClass(card) {
    if (card.imageOrientation === "landscape") return " is-landscape";
    if (card.imageWidth && card.imageHeight && card.imageWidth > card.imageHeight) return " is-landscape";
    return "";
  }

  function render() {
    const query = searchInput.value.trim();
    const series = seriesFilter.value;
    const display = displayFilter.value;
    const filtered = cards.filter((card) => {
      return matchesSearch(card, query)
        && (!series || card.series === series)
        && (!display || card.display === display);
    });

    table.innerHTML = filtered.map((card, index) => `
      <article class="visual-card${orientationClass(card)}" itemscope itemtype="https://schema.org/CreativeWork">
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
          <h3 itemprop="name">${escapeHtml(card.reference || card.id)}</h3>
          <p>
            <span class="rarity">${escapeHtml(card.rarity)}</span>
            <span>${escapeHtml(card.series)}</span>
            ${card.display ? `<span>${escapeHtml(card.display)}</span>` : ""}
          </p>
        </div>
      </article>
    `).join("");

    visibleCards.textContent = filtered.length;
    emptyState.hidden = filtered.length > 0;
  }

  fillSelect(seriesFilter, "Toutes les séries", uniqueValues("series"));
  fillSelect(displayFilter, "Tous les displays", uniqueValues("display"));
  [searchInput, seriesFilter, displayFilter].forEach((control) => control.addEventListener("input", render));
  render();
})();
