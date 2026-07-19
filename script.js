"use strict";

/**
 * Pokémon defensive calculator
 *
 * Keep type metadata and damage data separate so future calculators (offense,
 * move coverage, team builder) can reuse these values without touching the UI.
 */

// Alphabetical display order. Each icon is a standalone SVG asset.
const TYPES = [
  { id: "bug", color: "#a7ba18", ink: "#ffffff" },
  { id: "dark", color: "#735243", ink: "#ffffff" },
  { id: "dragon", color: "#6f5ce2", ink: "#ffffff" },
  { id: "electric", color: "#f4c83f", ink: "#ffffff" },
  { id: "fairy", color: "#df8fe6", ink: "#ffffff" },
  { id: "fighting", color: "#bd543f", ink: "#ffffff" },
  { id: "fire", color: "#ef6048", ink: "#ffffff" },
  { id: "flying", color: "#7f92e8", ink: "#ffffff" },
  { id: "ghost", color: "#625fb5", ink: "#ffffff" },
  { id: "grass", color: "#72c75a", ink: "#ffffff" },
  { id: "ground", color: "#ddb849", ink: "#ffffff" },
  { id: "ice", color: "#65c5ee", ink: "#ffffff" },
  { id: "normal", color: "#a6a697", ink: "#ffffff" },
  { id: "poison", color: "#a457a1", ink: "#ffffff" },
  { id: "psychic", color: "#f04f93", ink: "#ffffff" },
  { id: "rock", color: "#bfae68", ink: "#ffffff" },
  { id: "steel", color: "#a9a9bc", ink: "#ffffff" },
  { id: "water", color: "#3f9be8", ink: "#ffffff" },
];

/**
 * Official defensive effectiveness chart transcribed from weakness-chart.png.
 * Rows are attacking types; keys in each row are defending types that are not 1×.
 */
const ATTACK_EFFECTIVENESS = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

const DEFENDING_SECTIONS = [
  { id: "weak", title: "Weak", multipliers: [4, 2], color: "#ffffff" },
  { id: "resistant", title: "Resistant", multipliers: [0.5, 0.25], color: "#ffffff" },
  { id: "immune", title: "Immune", multipliers: [0], color: "#ffffff" },
  { id: "normal", title: "Normal", multipliers: [1], color: "#ffffff" },
];

const ATTACKING_SECTIONS = [
  { id: "strong", title: "Strong", multipliers: [2], color: "#ffffff" },
  { id: "weak", title: "Weak", multipliers: [0.5], color: "#ffffff" },
  { id: "immune", title: "Immune", multipliers: [0], color: "#ffffff" },
  { id: "normal", title: "Normal", multipliers: [1], color: "#ffffff" },
];

const elements = {
  typeGrid: document.querySelector("#type-grid"),
  selectionStatus: document.querySelector("#selection-status"),
  selectionCount: document.querySelector("#selection-count"),
  emptyState: document.querySelector("#empty-state"),
  resultsGrid: document.querySelector("#results-grid"),
  viewButtons: [...document.querySelectorAll("[data-result-view]")],
};

let selectedTypes = [];
let activeResultView = "defending";

function createTypeIcon(type) {
  const icon = document.createElement("img");
  icon.className = "type-icon";
  icon.src = `assets/icons/${type.id}.svg`;
  icon.alt = "";
  icon.decoding = "async";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function renderTypeSelector() {
  const selectionIsFull = selectedTypes.length === 2;
  elements.typeGrid.replaceChildren(
    ...TYPES.map((type) => {
      const isSelected = selectedTypes.includes(type.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `type-button${isSelected ? " is-selected" : ""}`;
      button.style.setProperty("--type-color", type.color);
      button.setAttribute("aria-pressed", String(isSelected));
      button.setAttribute("aria-label", `${isSelected ? "Deselect" : "Select"} ${type.id} type`);
      button.disabled = selectionIsFull && !isSelected;
      button.append(createTypeIcon(type));
      button.addEventListener("click", () => toggleType(type.id));
      return button;
    }),
  );

  elements.selectionCount.textContent = `${selectedTypes.length} / 2`;
  elements.selectionStatus.textContent = selectionIsFull
    ? "Two types selected — deselect one to change it"
    : selectedTypes.length === 1
      ? "Choose one more type or calculate this type alone"
      : "Select up to two types";
}

function toggleType(typeId) {
  if (selectedTypes.includes(typeId)) {
    selectedTypes = selectedTypes.filter((selectedType) => selectedType !== typeId);
  } else if (selectedTypes.length < 2) {
    selectedTypes = [...selectedTypes, typeId];
  }

  renderTypeSelector();
  renderResults();
}

function effectivenessFor(attackingType, defendingTypes) {
  return defendingTypes.reduce(
    (total, defendingType) => total * (ATTACK_EFFECTIVENESS[attackingType][defendingType] ?? 1),
    1,
  );
}

function displayName(typeId) {
  return `${typeId.charAt(0).toUpperCase()}${typeId.slice(1)}`;
}

function multiplierLabel(multiplier) {
  const labels = { 4: "×4", 2: "×2", 1: "×1", 0.5: "×½", 0.25: "×¼", 0: "×0" };
  return labels[multiplier];
}

function resultsForMultipliers(results, multipliers) {
  return multipliers.flatMap((multiplier) => results
    .filter((result) => result.multiplier === multiplier)
    .sort((first, second) => first.type.id.localeCompare(second.type.id)));
}

function createResultBadge(result) {
  const badge = document.createElement("div");
  badge.className = "result-badge";
  badge.style.setProperty("--type-color", result.type.color);
  badge.style.setProperty("--badge-ink", result.type.ink);

  const name = document.createElement("span");
  name.className = "result-badge__name";
  name.textContent = displayName(result.type.id);

  const multiplier = document.createElement("span");
  multiplier.className = "result-badge__multiplier";
  multiplier.textContent = multiplierLabel(result.multiplier);

  badge.append(name, multiplier);
  return badge;
}

function createResultSection(section, results) {
  const sectionResults = resultsForMultipliers(results, section.multipliers);
  if (sectionResults.length === 0) return null;

  const panel = document.createElement("section");
  panel.className = `result-panel result-panel--${section.id}`;
  panel.style.setProperty("--section-color", section.color);

  const title = document.createElement("h3");
  title.textContent = section.title;

  const badges = document.createElement("div");
  badges.className = "result-badges";
  badges.append(...sectionResults.map(createResultBadge));

  panel.append(title, badges);
  return panel;
}

function defendingResults() {
  return TYPES.map((attackingType) => ({
    type: attackingType,
    multiplier: effectivenessFor(attackingType.id, selectedTypes),
  }));
}

function attackingResults(attackingType) {
  return TYPES.map((defendingType) => ({
    type: defendingType,
    multiplier: effectivenessFor(attackingType.id, [defendingType.id]),
  }));
}

function createAttackCard(attackingType) {
  const card = document.createElement("article");
  card.className = "attack-card";

  const header = document.createElement("header");
  const eyebrow = document.createElement("p");
  eyebrow.textContent = "Attacking with";
  const title = document.createElement("h3");
  title.textContent = displayName(attackingType.id);
  header.append(eyebrow, title);

  const results = attackingResults(attackingType);
  const sections = ATTACKING_SECTIONS
    .map((section) => createResultSection(section, results))
    .filter(Boolean);

  card.append(header, ...sections);
  return card;
}

function setActiveResultView(view) {
  if (view === activeResultView) return;

  activeResultView = view;
  elements.viewButtons.forEach((button) => {
    const isActive = button.dataset.resultView === activeResultView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderResults();
}

function renderResults() {
  const noTypesSelected = selectedTypes.length === 0;
  elements.emptyState.hidden = !noTypesSelected;
  elements.resultsGrid.replaceChildren();

  if (noTypesSelected) return;

  elements.resultsGrid.dataset.view = activeResultView;

  if (activeResultView === "attacking") {
    const cards = selectedTypes
      .map((typeId) => TYPES.find((type) => type.id === typeId))
      .map(createAttackCard);
    elements.resultsGrid.append(...cards);
    return;
  }

  const results = defendingResults();
  const sections = DEFENDING_SECTIONS
    .map((section) => createResultSection(section, results))
    .filter(Boolean);
  elements.resultsGrid.append(...sections);
}

elements.viewButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveResultView(button.dataset.resultView));
});

renderTypeSelector();
renderResults();
