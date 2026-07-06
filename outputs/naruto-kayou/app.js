(function () {
  const cards = Array.isArray(window.NARUTO_KAYOU_CARDS) ? window.NARUTO_KAYOU_CARDS : [];
  const table = document.querySelector("#cardsTable");
  const emptyState = document.querySelector("#emptyState");
  const totalCards = document.querySelector("#totalCards");
  const visibleCards = document.querySelector("#visibleCards");
  const rarityGrid = document.querySelector("#rarityGrid");
  const rarityCount = document.querySelector("#rarityCount");
  const listPanel = document.querySelector(".list-panel");
  const cardsTitle = document.querySelector("#cardsTitle");
  const cardsNote = document.querySelector("#cardsNote");
  const backButton = document.querySelector("#backButton");
  const searchInput = document.querySelector("#searchInput");
  const seriesFilter = document.querySelector("#seriesFilter");
  const rarityFilter = document.querySelector("#rarityFilter");
  const sortSelect = document.querySelector("#sortSelect");

  const rarityOrder = ["R", "SR", "SSR", "TR/TGR", "HR", "PTR", "UR", "ZR", "AR", "OR", "SLR", "CP", "PU", "SP", "MR", "GP", "CR", "NR", "BP", "SE", "ASP", "SV", "SCR", "LR", "PR", "BR"];
  let selectedRarity = "";

  function uniqueValues(key) {
    return [...new Set(cards.map((card) => card[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  }

  function fillSelect(select, label, values) {
    select.innerHTML = [`<option value="">${label}</option>`]
      .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
      .join("");
  }

  function rarityRank(rarity) {
    const rank = rarityOrder.indexOf(rarity);
    return rank === -1 ? rarityOrder.length : rank;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function matchesSearch(card, query) {
    if (!query) return true;
    const haystack = [card.series, card.display, card.reference, card.id, card.name, card.rarity, card.type, card.source].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function sortCards(items) {
    const mode = sortSelect.value;
    return [...items].sort((a, b) => {
      if (mode === "id") return a.id.localeCompare(b.id, "fr", { numeric: true });
      if (mode === "rarity") {
        const rarityDiff = rarityRank(a.rarity) - rarityRank(b.rarity);
        return rarityDiff || a.id.localeCompare(b.id, "fr", { numeric: true });
      }
      return a.series.localeCompare(b.series, "fr", { numeric: true }) || a.id.localeCompare(b.id, "fr", { numeric: true });
    });
  }

  function groupedRarities() {
    const groups = new Map();
    for (const card of cards) {
      if (!groups.has(card.rarity)) {
        groups.set(card.rarity, { rarity: card.rarity, count: 0, series: new Set(), source: card.source });
      }
      const group = groups.get(card.rarity);
      group.count += 1;
      if (card.series && card.series !== "Serie inconnue") group.series.add(card.series);
    }
    return [...groups.values()].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.rarity.localeCompare(b.rarity, "fr"));
  }

  function renderRarityGrid() {
    const groups = groupedRarities();
    rarityCount.textContent = `${groups.length} raretes disponibles`;
    rarityGrid.innerHTML = groups.map((group) => {
      const seriesText = group.series.size > 0 ? `${group.series.size} series` : "Series a verifier";
      const active = group.rarity === selectedRarity ? " active" : "";
      return `
        <button class="rarity-card${active}" type="button" data-rarity="${escapeHtml(group.rarity)}">
          <span class="rarity-code">${escapeHtml(group.rarity)}</span>
          <span class="rarity-meta">${group.count} cartes</span>
          <span class="rarity-sub">${escapeHtml(seriesText)}</span>
        </button>
      `;
    }).join("");
  }

  function setSelectedRarity(rarity, updateHash) {
    selectedRarity = rarity || "";
    rarityFilter.value = selectedRarity;
    cardsTitle.textContent = selectedRarity ? `Cartes ${selectedRarity}` : "Toutes les cartes";
    cardsNote.textContent = selectedRarity ? "Liste filtree par rarete" : "Clique sur une rarete au-dessus pour filtrer la liste";
    listPanel.hidden = !selectedRarity;
    backButton.hidden = !selectedRarity;
    if (updateHash) {
      if (selectedRarity) {
        window.location.hash = encodeURIComponent(selectedRarity);
      } else {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    renderRarityGrid();
    render();
  }

  function render() {
    const query = searchInput.value.trim();
    const series = seriesFilter.value;
    const rarity = selectedRarity || rarityFilter.value;
    const filtered = sortCards(cards.filter((card) => {
      return matchesSearch(card, query)
        && (!series || card.series === series)
        && (!rarity || card.rarity === rarity);
    }));

    table.innerHTML = filtered.map((card) => `
      <tr>
        <td>${escapeHtml(card.reference || card.id)}</td>
        <td><span class="rarity">${escapeHtml(card.rarity)}</span></td>
        <td>${escapeHtml(card.series)}</td>
        <td>${escapeHtml(card.display || "-")}</td>
        <td>${escapeHtml(card.type)}</td>
        <td><a href="${escapeHtml(card.source)}" target="_blank" rel="noreferrer">Narutopia</a></td>
      </tr>
    `).join("");

    totalCards.textContent = cards.length;
    visibleCards.textContent = filtered.length;
    emptyState.hidden = filtered.length > 0;
  }

  fillSelect(seriesFilter, "Toutes les series", uniqueValues("series"));
  fillSelect(rarityFilter, "Toutes les raretes", uniqueValues("rarity"));
  rarityGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rarity]");
    if (!button) return;
    setSelectedRarity(button.dataset.rarity, true);
    document.querySelector(".list-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  backButton.addEventListener("click", () => setSelectedRarity("", true));
  rarityFilter.addEventListener("input", () => setSelectedRarity(rarityFilter.value, true));
  [searchInput, seriesFilter, sortSelect].forEach((control) => control.addEventListener("input", render));
  window.addEventListener("hashchange", () => setSelectedRarity(decodeURIComponent(window.location.hash.slice(1)), false));
  setSelectedRarity(decodeURIComponent(window.location.hash.slice(1)), false);
})();
