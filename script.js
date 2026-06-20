const STORAGE_KEY = "trivia-belgrano-state-v1";

const CATEGORY_COLORS = ["#087d82", "#e85f76", "#6d4fc2", "#35a56c", "#f2b735"];

const GAME_CONFIG = {
  classroom: {
    label: "1°, 2° y 3° año",
    subtitle: "Ronda de participación",
    values: [100, 200, 300, 400, 500],
    adjustStep: 100,
    categories: [
      { name: "Primeros pasos", color: "#087d82", indices: [0, 1, 4, 42, 48] },
      { name: "Ideas y educación", color: "#e85f76", indices: [3, 5, 6, 32, 38] },
      { name: "La bandera", color: "#29b8d6", indices: [10, 11, 12, 13, 31] },
      { name: "Campañas del norte", color: "#35a56c", indices: [14, 15, 16, 17, 18] },
      { name: "Vida ciudadana", color: "#f2b735", indices: [7, 9, 33, 34, 41] },
    ],
  },
  upper: {
    label: "4° y 5° año",
    subtitle: "Ronda técnica basada en el documental",
    values: [200, 400, 600, 800, 1000, 1200],
    adjustStep: 200,
    categories: [
      { name: "Mundo colonial", color: "#087d82", indices: [55, 56, 57, 58, 59, 60] },
      { name: "Formación intelectual", color: "#6d4fc2", indices: [61, 62, 63, 64, 65, 66] },
      { name: "Consulado y reforma", color: "#f2b735", indices: [67, 68, 69, 70, 71, 72] },
      { name: "Guerra y estrategia", color: "#35a56c", indices: [73, 74, 75, 76, 77, 78] },
      { name: "Bandera y mando", color: "#e85f76", indices: [79, 80, 81, 82, 83, 84] },
    ],
  },
  final: {
    label: "La gran final",
    subtitle: "Ronda decisiva",
    values: [200, 400, 600, 800, 1000, 1200],
    adjustStep: 200,
    categories: [
      { name: "Misión y batallas", color: "#e85f76", indices: [8, 20, 35, 44, 45, 51] },
      { name: "Proyecto de nación", color: "#f2b735", indices: [21, 22, 23, 36, 37, 47] },
      { name: "Símbolos y legado", color: "#29b8d6", indices: [19, 40, 49, 50, 52, 54] },
      { name: "Vida privada", color: "#35a56c", indices: [24, 25, 26, 28, 29, 39] },
      { name: "Archivo secreto", color: "#6d4fc2", indices: [2, 27, 30, 43, 46, 53] },
    ],
  },
};

const DEFAULT_TEAMS = [
  { id: "team-1", name: "Equipo Celeste", score: 0, color: "#29b8d6" },
  { id: "team-2", name: "Equipo Blanco", score: 0, color: "#f2f7f8" },
  { id: "team-3", name: "Equipo Dorado", score: 0, color: "#f2b735" },
];

const dom = {
  body: document.body,
  modeKicker: document.querySelector("#modeKicker"),
  modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
  resetButton: document.querySelector("#resetButton"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  addTeamButton: document.querySelector("#addTeamButton"),
  scoreboard: document.querySelector("#scoreboard"),
  board: document.querySelector("#gameBoard"),
  roundTitle: document.querySelector("#roundTitle"),
  roundSubtitle: document.querySelector("#roundSubtitle"),
  remainingCount: document.querySelector("#remainingCount"),
  dialog: document.querySelector("#questionDialog"),
  dialogCategory: document.querySelector("#dialogCategory"),
  dialogValue: document.querySelector("#dialogValue"),
  dialogQuestion: document.querySelector("#dialogQuestion"),
  dialogAnswer: document.querySelector("#dialogAnswer"),
  answerPanel: document.querySelector("#answerPanel"),
  revealButton: document.querySelector("#revealButton"),
  correctButton: document.querySelector("#correctButton"),
  wrongButton: document.querySelector("#wrongButton"),
  skipButton: document.querySelector("#skipButton"),
  toast: document.querySelector("#toast"),
};

let cards = [];
let currentCell = null;
let toastTimer = 0;

let state = loadState();
applyInitialModeFromUrl();

init();

async function init() {
  wireEvents();
  renderShell();

  try {
    cards = await loadCards();
    validateDeck();
    renderAll();
  } catch (error) {
    renderLoadError(error);
  }
}

function wireEvents() {
  dom.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      saveState();
      renderAll();
    });
  });

  dom.resetButton.addEventListener("click", () => {
    const ok = window.confirm("¿Reiniciar puntajes y preguntas usadas?");
    if (!ok) return;

    state.used = createEmptyUsedState();
    state.teams = state.teams.map((team) => ({ ...team, score: 0 }));
    saveState();
    renderAll();
    showToast("Partida reiniciada");
  });

  dom.fullscreenButton.addEventListener("click", async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      return;
    }

    await document.exitFullscreen?.();
  });

  dom.addTeamButton.addEventListener("click", () => {
    const nextIndex = state.teams.length + 1;
    const color = CATEGORY_COLORS[state.teams.length % CATEGORY_COLORS.length];
    const team = {
      id: `team-${Date.now()}`,
      name: `Equipo ${nextIndex}`,
      score: 0,
      color,
    };

    state.teams.push(team);
    state.activeTeamId = team.id;
    saveState();
    renderScoreboard();
  });

  dom.revealButton.addEventListener("click", revealAnswer);
  dom.correctButton.addEventListener("click", () => finishQuestion(currentCell.value));
  dom.wrongButton.addEventListener("click", () => finishQuestion(-currentCell.value));
  dom.skipButton.addEventListener("click", () => finishQuestion(0));

  document.addEventListener("keydown", (event) => {
    if (!dom.dialog.open || !currentCell) return;

    const key = event.key.toLowerCase();
    if (key === "r") revealAnswer();
    if (key === "c" && !dom.correctButton.hidden) finishQuestion(currentCell.value);
    if (key === "x" && !dom.wrongButton.hidden) finishQuestion(-currentCell.value);
    if (key === "s" && !dom.skipButton.hidden) finishQuestion(0);
  });
}

async function loadCards() {
  const response = await fetch("flashcards.csv", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo cargar flashcards.csv (${response.status})`);
  }

  const text = await response.text();
  return parseCsv(text)
    .map((row) => ({
      question: cleanCell(row[0]),
      answer: cleanCell(row[1]),
    }))
    .filter((card) => card.question && card.answer);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const content = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function cleanCell(value = "") {
  return value.trim();
}

function validateDeck() {
  const missing = [];
  Object.values(GAME_CONFIG).forEach((config) => {
    config.categories.forEach((category) => {
      category.indices.forEach((index) => {
        if (!cards[index]) missing.push(index + 1);
      });
    });
  });

  if (missing.length) {
    throw new Error(`Faltan preguntas en el CSV: ${missing.join(", ")}`);
  }
}

function renderAll() {
  renderShell();
  renderScoreboard();
  renderBoard();
}

function renderShell() {
  const config = GAME_CONFIG[state.mode];
  dom.body.classList.toggle("final-mode", state.mode === "final");
  dom.modeKicker.textContent = config.label;
  dom.roundTitle.textContent = config.label;
  dom.roundSubtitle.textContent = config.subtitle;

  dom.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function renderScoreboard() {
  dom.scoreboard.replaceChildren();

  state.teams.forEach((team) => {
    const card = document.createElement("article");
    card.className = "team-card";
    card.classList.toggle("is-active", team.id === state.activeTeamId);
    card.style.setProperty("--team-color", team.color);
    card.addEventListener("click", (event) => {
      if (event.target.closest("button") || event.target.closest("input")) return;
      state.activeTeamId = team.id;
      saveState();
      renderScoreboard();
    });

    const main = document.createElement("div");
    main.className = "team-card-main";

    const name = document.createElement("input");
    name.className = "team-name";
    name.value = team.name;
    name.setAttribute("aria-label", "Nombre del equipo");
    name.addEventListener("focus", () => {
      state.activeTeamId = team.id;
      saveState();
      syncActiveTeamCards();
    });
    name.addEventListener("change", () => {
      team.name = name.value.trim() || "Equipo";
      saveState();
      renderScoreboard();
    });

    const score = document.createElement("strong");
    score.className = "team-score";
    score.textContent = formatScore(team.score);

    const tools = document.createElement("div");
    tools.className = "team-tools";

    const minus = createMiniButton("-", `Restar ${GAME_CONFIG[state.mode].adjustStep}`, () => adjustTeam(team.id, -GAME_CONFIG[state.mode].adjustStep));
    const plus = createMiniButton("+", `Sumar ${GAME_CONFIG[state.mode].adjustStep}`, () => adjustTeam(team.id, GAME_CONFIG[state.mode].adjustStep));

    main.append(name, score);
    tools.append(minus, plus);
    card.append(main, tools);
    dom.scoreboard.append(card);
  });
}

function syncActiveTeamCards() {
  Array.from(dom.scoreboard.children).forEach((card, index) => {
    const team = state.teams[index];
    card.classList.toggle("is-active", team?.id === state.activeTeamId);
  });
}

function createMiniButton(text, label, onClick) {
  const button = document.createElement("button");
  button.className = "mini-button";
  button.type = "button";
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function adjustTeam(teamId, amount) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return;

  team.score += amount;
  state.activeTeamId = teamId;
  saveState();
  renderScoreboard();
}

function renderBoard() {
  const config = GAME_CONFIG[state.mode];
  const used = state.used[state.mode] || {};

  dom.board.style.setProperty("--columns", config.categories.length);
  dom.board.style.setProperty("--rows", config.values.length);
  dom.board.replaceChildren();

  config.categories.forEach((category) => {
    const header = document.createElement("div");
    header.className = "category-cell";
    header.style.setProperty("--accent", category.color);
    header.textContent = category.name;
    dom.board.append(header);
  });

  config.values.forEach((value, rowIndex) => {
    config.categories.forEach((category) => {
      const cardIndex = category.indices[rowIndex];
      const card = cards[cardIndex];
      const id = getCellId(state.mode, cardIndex);
      const button = document.createElement("button");
      button.className = "question-cell";
      button.type = "button";
      button.style.setProperty("--accent", category.color);
      button.setAttribute("aria-label", `${category.name}, ${value} puntos`);

      if (used[id]) {
        button.classList.add("is-used");
        button.disabled = true;
        button.textContent = "Hecha";
      } else {
        button.textContent = value;
        button.addEventListener("click", () => openQuestion({ id, cardIndex, card, category, value }));
      }

      dom.board.append(button);
    });
  });

  const total = config.categories.length * config.values.length;
  const usedCount = Object.keys(used).filter((key) => key.startsWith(`${state.mode}:`)).length;
  dom.remainingCount.textContent = `${total - usedCount}/${total}`;
}

function openQuestion(cell) {
  currentCell = cell;

  dom.dialogCategory.textContent = cell.category.name;
  dom.dialogValue.textContent = cell.value;
  dom.dialogQuestion.textContent = cell.card.question;
  dom.dialogAnswer.textContent = cell.card.answer;

  dom.answerPanel.hidden = true;
  dom.revealButton.hidden = false;
  dom.correctButton.hidden = true;
  dom.wrongButton.hidden = true;
  dom.skipButton.hidden = true;

  if (typeof dom.dialog.showModal === "function") {
    dom.dialog.showModal();
  } else {
    dom.dialog.setAttribute("open", "");
  }
}

function revealAnswer() {
  if (!currentCell) return;

  dom.answerPanel.hidden = false;
  dom.revealButton.hidden = true;
  dom.correctButton.hidden = false;
  dom.wrongButton.hidden = false;
  dom.skipButton.hidden = false;
}

function finishQuestion(amount) {
  if (!currentCell) return;

  const team = state.teams.find((item) => item.id === state.activeTeamId) || state.teams[0];
  if (team && amount !== 0) {
    team.score += amount;
    state.activeTeamId = team.id;
  }

  state.used[state.mode][currentCell.id] = true;
  saveState();

  const message = amount === 0 ? "Pregunta marcada" : `${team.name} ${amount > 0 ? "+" : ""}${amount}`;
  showToast(message);

  currentCell = null;
  dom.dialog.close?.();
  renderAll();
}

function getCellId(mode, cardIndex) {
  return `${mode}:${cardIndex}`;
}

function loadState() {
  const fallback = {
    mode: "classroom",
    teams: DEFAULT_TEAMS.map((team) => ({ ...team })),
    activeTeamId: DEFAULT_TEAMS[0].id,
    used: createEmptyUsedState(),
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored) return fallback;

    return {
      mode: GAME_CONFIG[stored.mode] ? stored.mode : fallback.mode,
      teams: Array.isArray(stored.teams) && stored.teams.length ? stored.teams : fallback.teams,
      activeTeamId: stored.activeTeamId || fallback.activeTeamId,
      used: createUsedState(stored.used),
    };
  } catch {
    return fallback;
  }
}

function createEmptyUsedState() {
  return Object.fromEntries(Object.keys(GAME_CONFIG).map((mode) => [mode, {}]));
}

function createUsedState(storedUsed = {}) {
  return Object.fromEntries(
    Object.keys(GAME_CONFIG).map((mode) => [mode, storedUsed?.[mode] || {}]),
  );
}

function applyInitialModeFromUrl() {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (GAME_CONFIG[requestedMode]) {
    state.mode = requestedMode;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatScore(score) {
  return new Intl.NumberFormat("es-AR").format(score);
}

function renderLoadError(error) {
  dom.board.replaceChildren();
  dom.board.style.setProperty("--columns", 1);
  dom.board.style.setProperty("--rows", 1);

  const message = document.createElement("div");
  message.className = "category-cell";
  message.style.setProperty("--accent", "#e85f76");
  message.textContent = error.message;
  dom.board.append(message);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.hidden = false;

  toastTimer = window.setTimeout(() => {
    dom.toast.hidden = true;
  }, 1800);
}
