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

  const CARD_BY_ID = Object.fromEntries(CARD_POOL.map((c) => [c.id, c]));

  // Decklists: array of card ids (20 cards each). Player = aggressive curve; Enemy = midrange.
  const PLAYER_DECKLIST = [
    'm1', 'm1', 'm2', 'm2', 'm2', 'm2', 'm3', 'm3', 'm10', 'm10',
    'm7', 'm7', 'm4', 'm4', 'm8', 'm8', 'm5', 'm5', 'm9', 'm6',
  ];
  const ENEMY_DECKLIST = [
    'm2', 'm2', 'm3', 'm3', 'm4', 'm4', 'm4', 'm5', 'm5', 'm5',
    'm8', 'm8', 'm9', 'm9', 'm6', 'm6', 'm7', 'm10', 'm1', 'm1',
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

  const HERO_MAX_HEALTH = 30;

  // --- Game state ---
  let state = {
    turn: 'player',
    gameOver: null, // null | 'player' | 'enemy' (winner)
    player: {
      deck: [],
      hand: [],
      board: [null, null, null, null, null],
      graveyard: [],
      mana: 0,
      maxMana: 0,
      heroHealth: HERO_MAX_HEALTH,
    },
    enemy: {
      deck: [],
      hand: [],
      board: [null, null, null, null, null],
      graveyard: [],
      mana: 0,
      maxMana: 0,
      heroHealth: HERO_MAX_HEALTH,
    },
    selectedCardIndex: null,
    selectedBoardSlot: null,
    selectedAttackerSlot: null, // player board slot index when choosing attack target
  };

  function getPlayer() {
    return state.turn === 'player' ? state.player : state.enemy;
  }

  function getEnemy() {
    return state.turn === 'player' ? state.enemy : state.player;
  }

  function initDecks() {
    function buildDeckFromList(decklist) {
      const deck = decklist.map((id) => createCard(CARD_BY_ID[id]));
      return shuffle(deck);
    }
    state.player.deck = buildDeckFromList(PLAYER_DECKLIST);
    state.enemy.deck = buildDeckFromList(ENEMY_DECKLIST);
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
    console.log('[playCard] side=', side, 'handIndex=', handIndex, 'boardIndex=', boardIndex, 'hand.length=', p.hand.length, 'board[slot]=', p.board[boardIndex], 'mana=', p.mana);
    if (handIndex < 0 || handIndex >= p.hand.length) {
      console.log('[playCard] invalid handIndex');
      return false;
    }
    if (boardIndex < 0 || boardIndex > 4 || p.board[boardIndex] !== null) {
      console.log('[playCard] invalid or occupied board slot');
      return false;
    }
    const card = p.hand[handIndex];
    if (card.cost > p.mana) {
      console.log('[playCard] not enough mana', card.cost, '>', p.mana);
      return false;
    }
    p.hand.splice(handIndex, 1);
    p.board[boardIndex] = { ...card, canAttack: false };
    p.mana -= card.cost;
    console.log('[playCard] ok, played', card.name, 'to slot', boardIndex);
    return true;
  }

  function resolveDeaths(side) {
    const p = side === 'player' ? state.player : state.enemy;
    for (let i = 0; i < p.board.length; i++) {
      if (p.board[i] && p.board[i].health <= 0) {
        p.graveyard.push(p.board[i]);
        p.board[i] = null;
      }
    }
  }

  function attack(attackerSide, attackerSlotIndex, targetSide, targetSlotOrFace) {
    const attacker = attackerSide === 'player' ? state.player : state.enemy;
    const targetP = targetSide === 'player' ? state.player : state.enemy;
    const minion = attacker.board[attackerSlotIndex];
    if (!minion || !minion.canAttack || minion.attack <= 0) return false;

    if (targetSlotOrFace === 'face') {
      targetP.heroHealth = Math.max(0, targetP.heroHealth - minion.attack);
      minion.canAttack = false;
      if (targetP.heroHealth <= 0) state.gameOver = attackerSide;
      return true;
    }

    const targetMinion = targetP.board[targetSlotOrFace];
    if (!targetMinion) return false;
    targetMinion.health -= minion.attack;
    minion.health -= targetMinion.attack;
    minion.canAttack = false;
    resolveDeaths('player');
    resolveDeaths('enemy');
    if (state.player.heroHealth <= 0) state.gameOver = 'enemy';
    if (state.enemy.heroHealth <= 0) state.gameOver = 'player';
    return true;
  }

  function startTurn(side, skipDraw = false) {
    const p = side === 'player' ? state.player : state.enemy;
    p.maxMana = Math.min(10, p.maxMana + 1);
    p.mana = p.maxMana;
    p.board.forEach((m) => {
      if (m) m.canAttack = true;
    });
    if (!skipDraw) drawCard(side);
  }

  function endTurn() {
    if (state.gameOver) return;
    state.turn = state.turn === 'player' ? 'enemy' : 'player';
    state.selectedCardIndex = null;
    state.selectedAttackerSlot = null;
    startTurn(state.turn);
    if (state.turn === 'enemy') setTimeout(enemyTurn, 600);
    render();
  }

  function enemyTurn() {
    if (state.gameOver) return;
    const p = state.enemy;
    const handIndex = p.hand.findIndex((c) => c.cost <= p.mana);
    if (handIndex !== -1) {
      const emptySlot = p.board.findIndex((m) => m === null);
      if (emptySlot !== -1) {
        playCard('enemy', handIndex, emptySlot);
        render();
      }
    }
    setTimeout(() => {
      p.board.forEach((minion, slotIndex) => {
        if (minion && minion.canAttack && minion.attack > 0 && state.player.heroHealth > 0) {
          attack('enemy', slotIndex, 'player', 'face');
          render();
        }
      });
      if (!state.gameOver) setTimeout(() => endTurn(), 600);
      else render();
    }, 800);
  }

  // --- DOM refs ---
  const el = {
    playerDeck: document.querySelector('#player-resources .player-deck'),
    playerPool: document.querySelector('#player-resources .player-pool'),
    playerHand: document.getElementById('player-hand'),
    playerGraveyard: document.querySelector('#player-resources .player-graveyard'),
    playerBoard: document.getElementById('player-board'),
    playerHero: document.getElementById('player-hero'),
    enemyDeck: document.querySelector('#enemy-resources .enemy-deck'),
    enemyPool: document.querySelector('#enemy-resources .enemy-pool'),
    enemyHand: document.getElementById('enemy-hand'),
    enemyGraveyard: document.querySelector('#enemy-resources .enemy-graveyard'),
    enemyBoard: document.getElementById('enemy-board'),
    enemyHero: document.getElementById('enemy-hero'),
    endTurnBtn: document.getElementById('end-turn-btn'),
    gameOverOverlay: document.getElementById('game-over-overlay'),
    gameOverTitle: document.getElementById('game-over-title'),
    playAgainBtn: document.getElementById('play-again-btn'),
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
    if (isPlayer && state.turn === 'player' && !state.gameOver && card.cost <= state.player.mana) {
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
    if (minion.health <= 0) div.classList.add('minion--dead');
    div.dataset.slotIndex = slotIndex;
    div.innerHTML = `
      <span class="minion__name">${minion.name}</span>
      <span class="minion__attack">${minion.attack}</span>
      <span class="minion__health">${minion.health}</span>
    `;
    if (state.gameOver) return div;
    if (isPlayer) {
      if (state.selectedCardIndex !== null) {
        div.classList.add('minion--drop-target');
        div.addEventListener('click', () => tryPlaySelectedToSlot(slotIndex));
      } else if (state.turn === 'player' && minion.canAttack && minion.attack > 0) {
        div.classList.add('minion--can-attack');
        div.addEventListener('click', () => selectAttacker(slotIndex));
      }
      if (state.selectedAttackerSlot === slotIndex) div.classList.add('minion--selected-attacker');
    } else {
      if (state.selectedAttackerSlot !== null) {
        div.classList.add('minion--attack-target');
        div.addEventListener('click', () => tryAttackMinion(slotIndex));
      }
    }
    return div;
  }

  function selectAttacker(slotIndex) {
    state.selectedAttackerSlot = state.selectedAttackerSlot === slotIndex ? null : slotIndex;
    state.selectedCardIndex = null;
    render();
  }

  function tryAttackMinion(enemySlotIndex) {
    if (state.selectedAttackerSlot === null || state.turn !== 'player') return;
    attack('player', state.selectedAttackerSlot, 'enemy', enemySlotIndex);
    state.selectedAttackerSlot = null;
    render();
  }

  function tryAttackFace() {
    if (state.selectedAttackerSlot === null || state.turn !== 'player') return;
    attack('player', state.selectedAttackerSlot, 'enemy', 'face');
    state.selectedAttackerSlot = null;
    render();
  }

  function selectCard(handIndex) {
    state.selectedCardIndex = state.selectedCardIndex === handIndex ? null : handIndex;
    state.selectedAttackerSlot = null;
    console.log('[selectCard] handIndex=', handIndex, 'selectedCardIndex=', state.selectedCardIndex);
    render();
  }

  function tryPlaySelectedToSlot(slotIndex) {
    console.log('[tryPlaySelectedToSlot] slotIndex=', slotIndex, 'selectedCardIndex=', state.selectedCardIndex, 'turn=', state.turn);
    if (state.selectedCardIndex === null || state.turn !== 'player') {
      console.log('[tryPlaySelectedToSlot] early return (no card selected or not your turn)');
      return;
    }
    const ok = playCard('player', state.selectedCardIndex, slotIndex);
    console.log('[tryPlaySelectedToSlot] playCard result=', ok);
    if (ok) state.selectedCardIndex = null;
    render();
  }

  function render() {
    const isPlayerTurn = state.turn === 'player';

    // Hero health
    el.playerHero.textContent = `Hero: ${state.player.heroHealth}`;
    el.enemyHero.textContent = `Hero: ${state.enemy.heroHealth}`;
    el.enemyHero.className = 'enemy-hero' + (state.selectedAttackerSlot !== null && state.turn === 'player' ? ' enemy-hero--attack-target' : '');
    el.enemyHero.onclick = state.selectedAttackerSlot !== null && state.turn === 'player' ? tryAttackFace : null;

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
      playerSlots[i].classList.remove('board-slot--drop-target');
      playerSlots[i].onclick = null;
      if (minion && minion.health > 0) {
        playerSlots[i].appendChild(renderMinionOnBoard(minion, i, true));
      } else if (state.selectedCardIndex !== null && state.turn === 'player' && !state.gameOver) {
        playerSlots[i].classList.add('board-slot--drop-target');
        playerSlots[i].onclick = () => {
          console.log('[board-slot click] empty slot', i);
          tryPlaySelectedToSlot(i);
        };
      }
    });
    state.enemy.board.forEach((minion, i) => {
      enemySlots[i].innerHTML = '';
      if (minion && minion.health > 0) enemySlots[i].appendChild(renderMinionOnBoard(minion, i, false));
    });

    // End Turn button
    el.endTurnBtn.disabled = !isPlayerTurn || state.gameOver !== null;
    el.endTurnBtn.textContent = state.gameOver ? 'Game Over' : isPlayerTurn ? 'End Turn' : "Enemy's Turn";

    // Game over overlay
    if (state.gameOver) {
      el.gameOverOverlay.hidden = false;
      el.gameOverTitle.textContent = state.gameOver === 'player' ? 'You Win!' : 'You Lose!';
    } else {
      el.gameOverOverlay.hidden = true;
    }
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
    state.player.heroHealth = HERO_MAX_HEALTH;
    state.enemy.heroHealth = HERO_MAX_HEALTH;
    state.turn = 'player';
    state.gameOver = null;
    state.selectedCardIndex = null;
    state.selectedAttackerSlot = null;
    for (let i = 0; i < 4; i++) drawCard('player');
    for (let i = 0; i < 4; i++) drawCard('enemy');
    startTurn('player', true);
    el.gameOverOverlay.hidden = true;
    render();
  }

  el.endTurnBtn.addEventListener('click', endTurn);
  el.playAgainBtn.addEventListener('click', initGame);
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
