document.addEventListener('DOMContentLoaded', async () => {
  // --- Card definitions (Hearthstone-style minions) ---
  const CARD_POOL = [
    { id: 'm1', name: 'Wisp', cost: 0, attack: 1, health: 1 },
    { id: 'm2', name: 'Murloc', cost: 1, attack: 1, health: 2 },
    { id: 'm3', name: 'Riverpaw', cost: 2, attack: 2, health: 2 },
    { id: 'm4', name: 'Ogre', cost: 3, attack: 3, health: 3 },
    { id: 'm5', name: 'Chillwind', cost: 4, attack: 4, health: 5 },
    { id: 'm6', name: 'Boulderfist', cost: 6, attack: 6, health: 7 },
    { id: 'm7', name: 'Wolf Rider', cost: 3, attack: 3, health: 1 },
    { id: 'm8', name: 'Raid Leader', cost: 3, attack: 2, health: 2 },
    { id: 'm9', name: 'Spiteful Smith', cost: 5, attack: 4, health: 6 },
    { id: 'm10', name: 'Frostwolf', cost: 2, attack: 2, health: 2 },
  ];

  function createCard(cardDef) {
    return { ...cardDef, instanceId: cardDef.id + '-' + Math.random().toString(36).slice(2, 9) };
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // --- Game state ---
  let state = {
    turn: 'player', // 'player' | 'enemy'
    player: {
      deck: [],
      hand: [],
      board: [null, null, null, null, null],
      graveyard: [],
      mana: 0,
      maxMana: 0,
    },
    enemy: {
      deck: [],
      hand: [],
      board: [null, null, null, null, null],
      graveyard: [],
      mana: 0,
      maxMana: 0,
    },
    selectedCardIndex: null,
    selectedBoardSlot: null,
  };

  function getPlayer() {
    return state.turn === 'player' ? state.player : state.enemy;
  }

  function getEnemy() {
    return state.turn === 'player' ? state.enemy : state.player;
  }

  function initDecks() {
    const buildDeck = () => {
      const deck = [];
      for (let i = 0; i < 2; i++) {
        CARD_POOL.forEach((c) => deck.push(createCard(c)));
      }
      return shuffle(deck);
    };
    state.player.deck = buildDeck();
    state.enemy.deck = buildDeck();
  }

  function drawCard(side) {
    const p = side === 'player' ? state.player : state.enemy;
    if (p.deck.length === 0 || p.hand.length >= 5) return null;
    const card = p.deck.pop();
    p.hand.push(card);
    return card;
  }

  function playCard(side, handIndex, boardIndex) {
    const p = side === 'player' ? state.player : state.enemy;
    if (handIndex < 0 || handIndex >= p.hand.length) return false;
    if (boardIndex < 0 || boardIndex > 4 || p.board[boardIndex] !== null) return false;
    const card = p.hand[handIndex];
    if (card.cost > p.mana) return false;
    p.hand.splice(handIndex, 1);
    p.board[boardIndex] = { ...card };
    p.mana -= card.cost;
    return true;
  }

  function startTurn(side) {
    const p = side === 'player' ? state.player : state.enemy;
    p.maxMana = Math.min(10, p.maxMana + 1);
    p.mana = p.maxMana;
    drawCard(side);
  }

  function endTurn() {
    state.turn = state.turn === 'player' ? 'enemy' : 'player';
    state.selectedCardIndex = null;
    state.selectedBoardSlot = null;
    startTurn(state.turn);
    if (state.turn === 'enemy') setTimeout(enemyTurn, 600);
    render();
  }

  function enemyTurn() {
    const p = state.enemy;
    const handIndex = p.hand.findIndex((c) => c.cost <= p.mana);
    if (handIndex === -1) {
      endTurn();
      return;
    }
    const emptySlot = p.board.findIndex((m) => m === null);
    if (emptySlot === -1) {
      endTurn();
      return;
    }
    playCard('enemy', handIndex, emptySlot);
    render();
    setTimeout(() => endTurn(), 800);
  }

  // --- DOM refs ---
  const el = {
    playerDeck: document.querySelector('#player-resources .player-deck'),
    playerPool: document.querySelector('#player-resources .player-pool'),
    playerHand: document.getElementById('player-hand'),
    playerGraveyard: document.querySelector('#player-resources .player-graveyard'),
    playerBoard: document.getElementById('player-board'),
    enemyDeck: document.querySelector('#enemy-resources .enemy-deck'),
    enemyPool: document.querySelector('#enemy-resources .enemy-pool'),
    enemyHand: document.getElementById('enemy-hand'),
    enemyGraveyard: document.querySelector('#enemy-resources .enemy-graveyard'),
    enemyBoard: document.getElementById('enemy-board'),
    endTurnBtn: document.getElementById('end-turn-btn'),
  };

  function renderCardInHand(card, index, isPlayer) {
    const div = document.createElement('div');
    div.className = 'card card--in-hand' + (state.selectedCardIndex === index && isPlayer ? ' card--selected' : '');
    div.dataset.handIndex = index;
    div.innerHTML = `
      <span class="card__cost">${card.cost}</span>
      <span class="card__name">${card.name}</span>
      <span class="card__stats">${card.attack}/${card.health}</span>
    `;
    if (isPlayer && state.turn === 'player' && card.cost <= state.player.mana) {
      div.classList.add('card--playable');
      div.addEventListener('click', () => selectCard(index));
    }
    return div;
  }

  function renderEnemyCardBack() {
    const div = document.createElement('div');
    div.className = 'card card--back';
    div.innerHTML = '<span class="card__back-text">?</span>';
    return div;
  }

  function renderMinionOnBoard(minion, slotIndex, isPlayer) {
    const div = document.createElement('div');
    div.className = 'minion';
    div.dataset.slotIndex = slotIndex;
    div.innerHTML = `
      <span class="minion__name">${minion.name}</span>
      <span class="minion__attack">${minion.attack}</span>
      <span class="minion__health">${minion.health}</span>
    `;
    if (isPlayer && state.selectedCardIndex !== null) {
      div.classList.add('minion--drop-target');
      div.addEventListener('click', () => tryPlaySelectedToSlot(slotIndex));
    }
    return div;
  }

  function selectCard(handIndex) {
    state.selectedCardIndex = state.selectedCardIndex === handIndex ? null : handIndex;
    render();
  }

  function tryPlaySelectedToSlot(slotIndex) {
    if (state.selectedCardIndex === null || state.turn !== 'player') return;
    const ok = playCard('player', state.selectedCardIndex, slotIndex);
    if (ok) state.selectedCardIndex = null;
    render();
  }

  function render() {
    const isPlayerTurn = state.turn === 'player';

    // Deck counts
    el.playerDeck.textContent = state.player.deck.length;
    el.enemyDeck.textContent = state.enemy.deck.length;

    // Mana
    el.playerPool.textContent = `${state.player.mana}/${state.player.maxMana}`;
    el.enemyPool.textContent = `${state.enemy.mana}/${state.enemy.maxMana}`;

    // Graveyard counts
    el.playerGraveyard.textContent = state.player.graveyard.length;
    el.enemyGraveyard.textContent = state.enemy.graveyard.length;

    // Hands
    el.playerHand.innerHTML = '';
    state.player.hand.forEach((card, i) => el.playerHand.appendChild(renderCardInHand(card, i, true)));
    el.enemyHand.innerHTML = '';
    state.enemy.hand.forEach(() => el.enemyHand.appendChild(renderEnemyCardBack()));

    // Boards
    const playerSlots = el.playerBoard.querySelectorAll('.board-slot');
    const enemySlots = el.enemyBoard.querySelectorAll('.board-slot');
    state.player.board.forEach((minion, i) => {
      playerSlots[i].innerHTML = '';
      if (minion) playerSlots[i].appendChild(renderMinionOnBoard(minion, i, true));
    });
    state.enemy.board.forEach((minion, i) => {
      enemySlots[i].innerHTML = '';
      if (minion) enemySlots[i].appendChild(renderMinionOnBoard(minion, i, false));
    });

    // End Turn button
    el.endTurnBtn.disabled = !isPlayerTurn;
    el.endTurnBtn.textContent = isPlayerTurn ? 'End Turn' : "Enemy's Turn";
  }

  function initGame() {
    initDecks();
    state.player.hand = [];
    state.enemy.hand = [];
    state.player.board = [null, null, null, null, null];
    state.enemy.board = [null, null, null, null, null];
    state.player.mana = 0;
    state.player.maxMana = 0;
    state.enemy.mana = 0;
    state.enemy.maxMana = 0;
    state.turn = 'player';
    state.selectedCardIndex = null;
    // Player goes first: draw 3, then start turn draws 1 and gives mana
    for (let i = 0; i < 3; i++) drawCard('player');
    for (let i = 0; i < 4; i++) drawCard('enemy');
    startTurn('player');
    render();
  }

  el.endTurnBtn.addEventListener('click', endTurn);
  initGame();

  // --- Settings menu (Escape to open/close) ---
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsPanel = document.getElementById('settings-panel');
  const musicSettingsMenu = document.getElementById('music-settings-menu');
  const settingsMusicBtn = document.getElementById('settings-music-btn');
  const musicSettingsBack = document.getElementById('music-settings-back');
  const musicVolume = document.getElementById('music-volume');
  const musicVolumeValue = document.getElementById('music-volume-value');

  function openSettings() {
    settingsOverlay.hidden = false;
    settingsPanel.hidden = false;
    musicSettingsMenu.hidden = true;
  }

  function closeSettings() {
    settingsOverlay.hidden = true;
    settingsPanel.hidden = false;
    musicSettingsMenu.hidden = true;
  }

  function openMusicSettings() {
    settingsPanel.hidden = true;
    musicSettingsMenu.hidden = false;
  }

  function closeMusicSettings() {
    settingsPanel.hidden = false;
    musicSettingsMenu.hidden = true;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!musicSettingsMenu.hidden) {
      closeMusicSettings();
    } else if (!settingsOverlay.hidden) {
      closeSettings();
    } else {
      openSettings();
    }
  });

  settingsMusicBtn.addEventListener('click', openMusicSettings);
  musicSettingsBack.addEventListener('click', closeMusicSettings);

  const savedVolume = localStorage.getItem('musicVolume');
  if (savedVolume != null) {
    musicVolume.value = savedVolume;
    musicVolumeValue.textContent = savedVolume;
  }

  musicVolume.addEventListener('input', () => {
    const v = musicVolume.value;
    musicVolumeValue.textContent = v;
    localStorage.setItem('musicVolume', v);
  });
});
