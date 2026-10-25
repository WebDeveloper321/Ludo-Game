const colors = [
  { name: "Green", className: "green", start: 0, homeColumn: 7, homeRow: 1 },
  { name: "Yellow", className: "yellow", start: 13, homeColumn: 13, homeRow: 7 },
  { name: "Blue", className: "blue", start: 26, homeColumn: 7, homeRow: 13 },
  { name: "Red", className: "red", start: 39, homeColumn: 1, homeRow: 7 }
];

const track = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0]
];

const safeSquares = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const board = document.querySelector("#board");
const turnDisplay = document.querySelector("#turn");
const diceDisplay = document.querySelector("#dice");
const messageDisplay = document.querySelector("#message");
const rollButton = document.querySelector("#roll-button");
const newGameButton = document.querySelector("#new-game-button");

let currentPlayer = 0;
let diceRoll = null;
let movingPlayer = null;
let tokens = [];

function positionKey(row, column) {
  return `${row},${column}`;
}

function homeLane(player, step) {
  if (player === 0) return [7, step + 1];
  if (player === 1) return [step + 1, 7];
  if (player === 2) return [7, 13 - step];
  return [13 - step, 7];
}

function getTokenPosition(token, player) {
  if (token.progress === -1) return null;
  if (token.progress >= track.length) return homeLane(player, token.progress - track.length);
  return track[(colors[player].start + token.progress) % track.length];
}

function addCell(row, column, className = "") {
  const cell = document.createElement("div");
  cell.className = `cell${className ? ` ${className}` : ""}`;
  cell.style.gridRow = String(row + 1);
  cell.style.gridColumn = String(column + 1);
  cell.setAttribute("role", "gridcell");
  board.append(cell);
  return cell;
}

function createBoard() {
  board.replaceChildren();

  colors.forEach((color, player) => {
    const home = document.createElement("div");
    home.className = `home home-${color.className}`;
    home.style.gridRow = player < 2 ? "1 / span 6" : "10 / span 6";
    home.style.gridColumn = player === 0 || player === 3 ? "1 / span 6" : "10 / span 6";
    home.innerHTML = `<div class="yard"><div class="yard-tokens"></div></div>`;
    board.append(home);
  });

  const trackCells = new Map();
  track.forEach(([row, column], index) => {
    const cell = addCell(row, column, "track-cell");
    trackCells.set(positionKey(row, column), cell);
    if (safeSquares.has(index)) {
      cell.classList.add("safe");
      cell.textContent = "★";
      cell.setAttribute("aria-label", "Safe square");
    }
  });

  for (let step = 0; step < 6; step++) {
    colors.forEach((color, player) => {
      const [row, column] = homeLane(player, step);
      const cell = addCell(row, column, `lane lane-${color.className}`);
      trackCells.set(positionKey(row, column), cell);
    });
  }

  [[0, 7, "yellow"], [7, 14, "blue"], [14, 7, "red"], [7, 0, "green"]]
    .forEach(([row, column, color]) => {
      const cell = trackCells.get(positionKey(row, column));
      cell.classList.add("entry", `entry-${color}`);
      cell.textContent = color === "green" ? "▶" : color === "yellow" ? "▼" : color === "blue" ? "◀" : "▲";
    });

  const center = document.createElement("div");
  center.className = "center";
  center.style.gridRow = "7 / span 3";
  center.style.gridColumn = "7 / span 3";
  board.append(center);

  tokens = colors.map(() => Array.from({ length: 4 }, () => ({ progress: -1 })));
  return trackCells;
}

let cells = createBoard();

function renderTokens() {
  document.querySelectorAll(".yard-tokens").forEach((yard) => yard.replaceChildren());
  cells.forEach((cell) => {
    cell.querySelectorAll(".token").forEach((token) => token.remove());
  });

  const occupants = new Map();
  tokens.forEach((playerTokens, player) => {
    playerTokens.forEach((token, tokenIndex) => {
      const position = getTokenPosition(token, player);
      if (!position) {
        const yard = board.querySelector(`.home-${colors[player].className} .yard-tokens`);
        const piece = makeToken(player, tokenIndex);
        yard.append(piece);
        return;
      }

      const key = positionKey(position[0], position[1]);
      const cell = cells.get(key);
      if (!cell) return;
      const count = occupants.get(key) || 0;
      occupants.set(key, count + 1);
      const piece = makeToken(player, tokenIndex);
      if (count) piece.classList.add("stacked");
      cell.append(piece);
    });
  });
}

function makeToken(player, tokenIndex) {
  const piece = document.createElement("button");
  piece.type = "button";
  piece.className = `token token-${colors[player].className}`;
  piece.setAttribute("aria-label", `${colors[player].name} token ${tokenIndex + 1}`);
  piece.disabled = !(movingPlayer === player && isLegalMove(tokens[player][tokenIndex]));
  if (!piece.disabled) {
    piece.classList.add("selectable");
    piece.addEventListener("click", () => moveToken(player, tokenIndex));
  }
  return piece;
}

function isLegalMove(token) {
  if (diceRoll === null) return false;
  if (token.progress === -1) return diceRoll === 6;
  return token.progress + diceRoll <= track.length + 5;
}

function updateControls() {
  const player = colors[currentPlayer];
  turnDisplay.innerHTML = `Turn: <span class="turn-${player.className}">${player.name}</span>`;
  rollButton.disabled = diceRoll !== null;
}

function nextTurn() {
  diceRoll = null;
  movingPlayer = null;
  currentPlayer = (currentPlayer + 1) % colors.length;
  updateControls();
  renderTokens();
}

function rollDice() {
  if (diceRoll !== null) return;
  diceRoll = Math.floor(Math.random() * 6) + 1;
  diceDisplay.textContent = String(diceRoll);
  movingPlayer = currentPlayer;
  const availableTokens = tokens[currentPlayer].filter(isLegalMove);
  if (availableTokens.length === 0) {
    messageDisplay.textContent = `${colors[currentPlayer].name} rolled ${diceRoll}. No moves available.`;
    renderTokens();
    window.setTimeout(nextTurn, 1100);
    return;
  }
  messageDisplay.textContent = availableTokens.length === 1
    ? "Click the highlighted token to move it."
    : "Choose one of your highlighted tokens.";
  updateControls();
  renderTokens();
}

function moveToken(player, tokenIndex) {
  const token = tokens[player][tokenIndex];
  if (player !== currentPlayer || !isLegalMove(token)) return;

  token.progress = token.progress === -1 ? 0 : token.progress + diceRoll;
  const position = getTokenPosition(token, player);
  const finalStep = token.progress === track.length + 5;

  if (position && !finalStep) {
    const landingIndex = (colors[player].start + token.progress) % track.length;
    if (!safeSquares.has(landingIndex)) {
      tokens.forEach((otherTokens, otherPlayer) => {
        if (otherPlayer === player) return;
        otherTokens.forEach((otherToken) => {
          const otherPosition = getTokenPosition(otherToken, otherPlayer);
          if (otherPosition && positionKey(...otherPosition) === positionKey(...position)) {
            otherToken.progress = -1;
          }
        });
      });
    }
  }

  const won = tokens[player].every((piece) => piece.progress === track.length + 5);
  const getsAnotherTurn = diceRoll === 6;
  const result = won
    ? `${colors[player].name} wins! Start a new game to play again.`
    : finalStep
      ? "Token reached home!"
      : "Token moved.";
  messageDisplay.textContent = result;
  diceRoll = null;
  movingPlayer = null;
  updateControls();
  renderTokens();

  if (won) {
    rollButton.disabled = true;
    return;
  }
  if (!getsAnotherTurn) nextTurn();
}

function startNewGame() {
  currentPlayer = 0;
  diceRoll = null;
  movingPlayer = null;
  diceDisplay.textContent = "—";
  messageDisplay.textContent = "Roll a 6 to bring a token onto the board.";
  cells = createBoard();
  updateControls();
  renderTokens();
}

rollButton.addEventListener("click", rollDice);
newGameButton.addEventListener("click", startNewGame);
updateControls();
renderTokens();