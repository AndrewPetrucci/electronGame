import { CARD_POOL } from './cards/index.js';

document.addEventListener('DOMContentLoaded', async () => {
  const CARD_BY_ID = Object.fromEntries(CARD_POOL.map((c) => [c.id, c]));

  // Decklists: array of card ids (20 cards each). Include minions + spells.
  const PLAYER_DECKLIST = [
    'm1', 'm2', 'm2', 'm3', 's1', 's1', 's4', 's5',
    'm7', 'm4', 'm8', 'm5', 's2', 's6', 'm6',
  ];
  const ENEMY_DECKLIST = [
    'm2', 'm3', 'm4', 'm4', 'm5', 's1', 's2', 's4',
    'm8', 'm6', 's3', 's5', 's6', 'm7', 'm1',
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
    declaredAttackers: [], // player board slot indices declaring attack this turn
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

  function isMinion(card) {
    return card.type === 'minion' || (!card.type && card.attack != null);
  }

  function playCard(side, handIndex, boardIndex) {
    const p = side === 'player' ? state.player : state.enemy;
    if (handIndex < 0 || handIndex >= p.hand.length) return false;
    const card = p.hand[handIndex];
    if (!isMinion(card)) return false;
    if (boardIndex < 0 || boardIndex > 4 || p.board[boardIndex] !== null) return false;
    if (card.cost > p.mana) return false;
    p.hand.splice(handIndex, 1);
    p.board[boardIndex] = { ...card, canAttack: false };
    p.mana -= card.cost;
    return true;
  }

  function playSpell(side, handIndex, target) {
    const p = side === 'player' ? state.player : state.enemy;
    const enemy = side === 'player' ? state.enemy : state.player;
    if (handIndex < 0 || handIndex >= p.hand.length) return false;
    const card = p.hand[handIndex];
    if (card.type !== 'spell') return false;
    if (card.cost > p.mana) return false;
    if (card.target === 'none' && target !== null) return false;
    if (card.target !== 'none' && target == null) return false;
    if (card.target === 'enemy_minion' && (target.type !== 'enemy_minion' || enemy.board[target.slotIndex] == null)) return false;
    if (card.target === 'enemy_hero' && target.type !== 'enemy_hero') return false;
    if (card.target === 'enemy_any' && target.type !== 'enemy_minion' && target.type !== 'enemy_hero') return false;
    if (card.target === 'friendly_minion' && (target.type !== 'friendly_minion' || p.board[target.slotIndex] == null)) return false;

    p.hand.splice(handIndex, 1);
    p.mana -= card.cost;
    p.graveyard.push(card);

    if (card.effect === 'deal_damage') {
      const dmg = card.value || 0;
      if (target.type === 'enemy_hero') {
        enemy.heroHealth = Math.max(0, enemy.heroHealth - dmg);
        if (enemy.heroHealth <= 0) state.gameOver = side;
      } else if (target.type === 'enemy_minion') {
        const m = enemy.board[target.slotIndex];
        if (m) {
          m.health -= dmg;
          resolveDeaths('player');
          resolveDeaths('enemy');
        }
      }
    } else if (card.effect === 'heal_hero') {
      p.heroHealth = Math.min(HERO_MAX_HEALTH, p.heroHealth + (card.value || 0));
    } else if (card.effect === 'buff' && target.type === 'friendly_minion') {
      const m = p.board[target.slotIndex];
      if (m) {
        m.attack = (m.attack || 0) + (card.attack || 0);
        m.health = (m.health || 0) + (card.health || 0);
      }
    }
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

  // Resolve all declared attacks: each attacker in slot i hits enemy slot i (minion) or enemy face (empty).
  function resolveDeclaredAttacks() {
    if (state.turn !== 'player' || state.declaredAttackers.length === 0) return;
    const player = state.player;
    const enemy = state.enemy;
    for (const slotIndex of state.declaredAttackers) {
      const attacker = player.board[slotIndex];
      if (!attacker || !attacker.canAttack || attacker.attack <= 0) continue;
      const targetMinion = enemy.board[slotIndex];
      if (targetMinion && targetMinion.health > 0) {
        targetMinion.health -= attacker.attack;
        attacker.health -= targetMinion.attack;
      } else {
        enemy.heroHealth = Math.max(0, enemy.heroHealth - attacker.attack);
        if (enemy.heroHealth <= 0) state.gameOver = 'player';
      }
      attacker.canAttack = false;
    }
    resolveDeaths('player');
    resolveDeaths('enemy');
    if (state.player.heroHealth <= 0) state.gameOver = 'enemy';
    if (state.enemy.heroHealth <= 0) state.gameOver = 'player';
    state.declaredAttackers = [];
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
    state.declaredAttackers = [];
    startTurn(state.turn);
    if (state.turn === 'enemy') setTimeout(enemyTurn, 600);
    render();
  }

  function enemyTurn() {
    if (state.gameOver) return;
    const p = state.enemy;
    let played = false;
    let spellPlayedWithAnimation = false;

    function runEnemyAttackPhase() {
      const enemy = state.enemy;
      const player = state.player;
      const attacks = [];
      for (let slotIndex = 0; slotIndex < enemy.board.length; slotIndex++) {
        const attacker = enemy.board[slotIndex];
        if (attacker && attacker.canAttack && attacker.attack > 0) attacks.push(slotIndex);
      }
      function resolveEnemyAttacks() {
        for (const slotIndex of attacks) {
          const attacker = enemy.board[slotIndex];
          if (!attacker || !attacker.canAttack || attacker.attack <= 0) continue;
          const targetMinion = player.board[slotIndex];
          if (targetMinion && targetMinion.health > 0) {
            targetMinion.health -= attacker.attack;
            attacker.health -= targetMinion.attack;
          } else {
            player.heroHealth = Math.max(0, player.heroHealth - attacker.attack);
            if (player.heroHealth <= 0) state.gameOver = 'enemy';
          }
          attacker.canAttack = false;
        }
        resolveDeaths('player');
        resolveDeaths('enemy');
        if (state.player.heroHealth <= 0) state.gameOver = 'enemy';
        if (state.enemy.heroHealth <= 0) state.gameOver = 'player';
        render();
        if (!state.gameOver) setTimeout(() => endTurn(), 600);
        else render();
      }
      if (attacks.length === 0) {
        resolveEnemyAttacks();
        return;
      }
      const enemySlots = el.enemyBoard.querySelectorAll('.board-slot');
      const playerSlots = el.playerBoard.querySelectorAll('.board-slot');
      let index = 0;
      function runNext() {
        if (index >= attacks.length) {
          resolveEnemyAttacks();
          return;
        }
        const slotIndex = attacks[index++];
        const fromEl = enemySlots[slotIndex];
        const targetMinion = player.board[slotIndex];
        const toEl = (targetMinion && targetMinion.health > 0)
          ? playerSlots[slotIndex]
          : el.playerHero;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        playOverlayAnimation(
          { fromRect, toRect, durationMs: 380 },
          runNext
        );
      }
      runNext();
    }

    for (let hi = 0; hi < p.hand.length; hi++) {
      const c = p.hand[hi];
      if (c.cost > p.mana) continue;
      if (isMinion(c)) {
        const emptySlot = p.board.findIndex((m) => m === null);
        if (emptySlot !== -1) {
          playCard('enemy', hi, emptySlot);
          played = true;
          break;
        }
      } else if (c.type === 'spell') {
        if (c.target === 'none') {
          playSpellWithAnimation('enemy', hi, null, () => {
            render();
            setTimeout(runEnemyAttackPhase, 400);
          });
          played = true;
          spellPlayedWithAnimation = true;
          break;
        }
        if (c.target === 'enemy_hero' || c.target === 'enemy_any') {
          playSpellWithAnimation('enemy', hi, { type: 'enemy_hero' }, () => {
            render();
            setTimeout(runEnemyAttackPhase, 400);
          });
          played = true;
          spellPlayedWithAnimation = true;
          break;
        }
        if ((c.target === 'enemy_minion' || c.target === 'enemy_any') && state.player.board.some((m) => m && m.health > 0)) {
          const idx = state.player.board.findIndex((m) => m && m.health > 0);
          if (idx !== -1) {
            playSpellWithAnimation('enemy', hi, { type: 'enemy_minion', slotIndex: idx }, () => {
              render();
              setTimeout(runEnemyAttackPhase, 400);
            });
            played = true;
            spellPlayedWithAnimation = true;
            break;
          }
        }
        if (c.target === 'friendly_minion' && p.board.some((m) => m && m.health > 0)) {
          const idx = p.board.findIndex((m) => m && m.health > 0);
          if (idx !== -1) {
            playSpellWithAnimation('enemy', hi, { type: 'friendly_minion', slotIndex: idx }, () => {
              render();
              setTimeout(runEnemyAttackPhase, 400);
            });
            played = true;
            spellPlayedWithAnimation = true;
            break;
          }
        }
      }
    }
    if (played && !spellPlayedWithAnimation) {
      render();
      setTimeout(runEnemyAttackPhase, 800);
    }
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
    attackBtn: document.getElementById('attack-btn'),
    endTurnBtn: document.getElementById('end-turn-btn'),
    gameOverOverlay: document.getElementById('game-over-overlay'),
    gameOverTitle: document.getElementById('game-over-title'),
    playAgainBtn: document.getElementById('play-again-btn'),
    animationOverlay: document.getElementById('animation-overlay'),
  };

  /** Play a CSS animation on the overlay. Options: { animationClass, durationMs, fromRect, toRect, customProps }. Calls onEnd when done. */
  function playOverlayAnimation(options, onEnd) {
    const {
      animationClass = 'anim-slam',
      durationMs = 350,
      fromRect,
      toRect,
      customProps = {},
    } = options;
    const node = document.createElement('div');
    node.className = animationClass + ' anim-overlay-node';
    if (fromRect && toRect) {
      const fromCx = fromRect.left + fromRect.width / 2;
      const fromCy = fromRect.top + fromRect.height / 2;
      const toCx = toRect.left + toRect.width / 2;
      const toCy = toRect.top + toRect.height / 2;
      node.style.setProperty('--from-x', fromCx + 'px');
      node.style.setProperty('--from-y', fromCy + 'px');
      node.style.setProperty('--to-x', toCx + 'px');
      node.style.setProperty('--to-y', toCy + 'px');
      const dur = (durationMs / 1000) + 's';
      node.style.setProperty('--slam-duration', dur);
      node.style.setProperty('--spell-duration', dur);
    }
    Object.entries(customProps).forEach(([key, value]) => node.style.setProperty(key, value));
    const done = () => {
      node.remove();
      onEnd?.();
    };
    node.addEventListener('animationend', done, { once: true });
    el.animationOverlay.appendChild(node);
  }

  /** Return the DOM element that is the spell target (for getBoundingClientRect). */
  function getSpellTargetElement(side, target) {
    if (!target || target === null) {
      return side === 'player' ? el.playerHero : el.enemyHero;
    }
    if (target.type === 'enemy_hero') {
      return side === 'player' ? el.enemyHero : el.playerHero;
    }
    if (target.type === 'enemy_minion' && target.slotIndex != null) {
      const board = side === 'player' ? el.enemyBoard : el.playerBoard;
      return board.querySelectorAll('.board-slot')[target.slotIndex];
    }
    if (target.type === 'friendly_minion' && target.slotIndex != null) {
      const board = side === 'player' ? el.playerBoard : el.enemyBoard;
      return board.querySelectorAll('.board-slot')[target.slotIndex];
    }
    return side === 'player' ? el.playerHero : el.enemyHero;
  }

  /** Play spell with projectile animation, then resolve spell and render. Calls onDone(ok) with playSpell result. */
  function playSpellWithAnimation(side, handIndex, target, onDone) {
    const heroEl = side === 'player' ? el.playerHero : el.enemyHero;
    const toEl = getSpellTargetElement(side, target);
    if (!toEl) {
      const ok = playSpell(side, handIndex, target);
      onDone?.(ok);
      render();
      return;
    }
    const fromRect = heroEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    playOverlayAnimation(
      {
        animationClass: 'anim-spell',
        durationMs: 400,
        fromRect,
        toRect,
      },
      () => {
        const ok = playSpell(side, handIndex, target);
        onDone?.(ok);
        render();
      }
    );
  }

  function getSpellText(card) {
    if (card.effect === 'deal_damage') return `Deal ${card.value}`;
    if (card.effect === 'heal_hero') return `Heal ${card.value}`;
    if (card.effect === 'buff') return `+${card.attack || 0}/+${card.health || 0}`;
    return 'Spell';
  }

  function renderCardInHand(card, index, isPlayer) {
    const div = document.createElement('div');
    div.className = 'card card--in-hand' + (state.selectedCardIndex === index && isPlayer ? ' card--selected' : '');
    if (card.type === 'spell') div.classList.add('card--spell');
    div.dataset.handIndex = index;
    const artHtml = (card.img || card.alt_img) ? `
      <div class="card__art">
        ${card.img ? `<img class="card__img" src="${card.img}" alt="">` : ''}
        ${card.alt_img ? `<img class="card__img card__img--alt" src="${card.alt_img}" alt="">` : ''}
      </div>
    ` : '<div class="card__art"></div>';
    const ptText = card.type === 'spell' ? '' : `${card.attack}/${card.health}`;
    const rulesText = card.type === 'spell' ? getSpellText(card) : '';
    div.innerHTML = `
      <div class="card__header">
        <span class="card__cost"><span class="card__cost-inner">${card.cost}</span></span>
        <span class="card__name">${card.name}</span>
        <span class="card__pt">${ptText}</span>
      </div>
      <div class="card__spacer"></div>
      ${artHtml}
      <div class="card__rules">${rulesText}</div>
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
    const artHtml = (minion.img || minion.alt_img) ? `
      <div class="minion__art">
        ${minion.img ? `<img class="minion__img" src="${minion.img}" alt="">` : ''}
        ${minion.alt_img ? `<img class="minion__img minion__img--alt" src="${minion.alt_img}" alt="">` : ''}
      </div>
    ` : '<div class="minion__art"></div>';
    div.innerHTML = `
      <div class="minion__header">
        <span class="minion__name">${minion.name}</span>
        <span class="minion__pt">${minion.attack}/${minion.health}</span>
      </div>
      <div class="minion__spacer"></div>
      ${artHtml}
      <div class="minion__rules"></div>
    `;
    if (state.gameOver) return div;
    if (isPlayer) {
      const sel = state.selectedCardIndex != null ? state.player.hand[state.selectedCardIndex] : null;
      const isSpellTargetingFriendly = sel && sel.type === 'spell' && sel.target === 'friendly_minion';
      if (state.selectedCardIndex !== null && sel && isMinion(sel)) {
        div.classList.add('minion--drop-target');
        div.addEventListener('click', () => tryPlaySelectedToSlot(slotIndex));
      } else if (state.turn === 'player' && minion.canAttack && minion.attack > 0 && !isSpellTargetingFriendly) {
        div.classList.add('minion--can-attack');
        div.addEventListener('click', () => toggleDeclareAttacker(slotIndex));
      }
      if (state.declaredAttackers.includes(slotIndex)) div.classList.add('minion--declared-attacker');
    }
    return div;
  }

  function toggleDeclareAttacker(slotIndex) {
    if (state.turn !== 'player') return;
    const idx = state.declaredAttackers.indexOf(slotIndex);
    if (idx === -1) state.declaredAttackers.push(slotIndex);
    else state.declaredAttackers.splice(idx, 1);
    render();
  }

  function selectCard(handIndex) {
    const card = state.player.hand[handIndex];
    if (card && card.type === 'spell' && card.target === 'none') {
      if (card.cost <= state.player.mana) {
        playSpellWithAnimation('player', handIndex, null);
      }
      return;
    }
    state.selectedCardIndex = state.selectedCardIndex === handIndex ? null : handIndex;
    state.declaredAttackers = [];
    render();
  }

  function tryPlaySpellWithTarget(target) {
    if (state.selectedCardIndex === null || state.turn !== 'player') return;
    const card = state.player.hand[state.selectedCardIndex];
    if (!card || card.type !== 'spell') return;
    if (card.cost > state.player.mana) return;
    const handIndex = state.selectedCardIndex;
    playSpellWithAnimation('player', handIndex, target, (ok) => {
      if (ok) state.selectedCardIndex = null;
    });
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
    const selectedCard = state.selectedCardIndex != null ? state.player.hand[state.selectedCardIndex] : null;
    const selectedIsMinion = selectedCard && isMinion(selectedCard);
    const selectedSpell = selectedCard && selectedCard.type === 'spell' ? selectedCard : null;

    state.player.board.forEach((minion, i) => {
      playerSlots[i].innerHTML = '';
      playerSlots[i].classList.remove('board-slot--drop-target', 'board-slot--spell-target');
      playerSlots[i].onclick = null;
      if (minion && minion.health > 0) {
        const slotEl = playerSlots[i].appendChild(renderMinionOnBoard(minion, i, true));
        if (selectedSpell && selectedSpell.target === 'friendly_minion' && state.turn === 'player' && !state.gameOver) {
          slotEl.classList.add('minion--spell-target');
          slotEl.addEventListener('click', (e) => {
            e.stopPropagation();
            tryPlaySpellWithTarget({ type: 'friendly_minion', slotIndex: i });
          });
        }
      } else if (selectedIsMinion && state.turn === 'player' && !state.gameOver) {
        playerSlots[i].classList.add('board-slot--drop-target');
        playerSlots[i].onclick = () => tryPlaySelectedToSlot(i);
      }
    });
    state.enemy.board.forEach((minion, i) => {
      enemySlots[i].innerHTML = '';
      enemySlots[i].classList.remove('board-slot--spell-target');
      enemySlots[i].onclick = null;
      if (minion && minion.health > 0) {
        const slotEl = enemySlots[i].appendChild(renderMinionOnBoard(minion, i, false));
        if (selectedSpell && (selectedSpell.target === 'enemy_minion' || selectedSpell.target === 'enemy_any') && state.turn === 'player' && !state.gameOver) {
          slotEl.classList.add('minion--spell-target');
          slotEl.addEventListener('click', (e) => {
            e.stopPropagation();
            tryPlaySpellWithTarget({ type: 'enemy_minion', slotIndex: i });
          });
        }
      }
    });

    if (selectedSpell && (selectedSpell.target === 'enemy_hero' || selectedSpell.target === 'enemy_any') && state.turn === 'player' && !state.gameOver) {
      el.enemyHero.classList.add('enemy-hero--spell-target');
      el.enemyHero.onclick = () => tryPlaySpellWithTarget({ type: 'enemy_hero' });
    } else {
      el.enemyHero.classList.remove('enemy-hero--spell-target');
      el.enemyHero.onclick = null;
    }

    // Attack button (resolve declared attackers)
    if (el.attackBtn) {
      el.attackBtn.hidden = state.turn !== 'player' || state.gameOver;
      el.attackBtn.disabled = state.declaredAttackers.length === 0;
      el.attackBtn.textContent = state.declaredAttackers.length > 0 ? `Attack (${state.declaredAttackers.length})` : 'Attack';
    }

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
    state.declaredAttackers = [];
    for (let i = 0; i < 4; i++) drawCard('player');
    for (let i = 0; i < 4; i++) drawCard('enemy');
    startTurn('player', true);
    el.gameOverOverlay.hidden = true;
    render();
  }

  el.attackBtn.addEventListener('click', () => {
    if (state.turn !== 'player' || state.declaredAttackers.length === 0) return;
    const player = state.player;
    const enemy = state.enemy;
    const attacks = state.declaredAttackers.filter((slotIndex) => {
      const attacker = player.board[slotIndex];
      return attacker && attacker.canAttack && attacker.attack > 0;
    });
    if (attacks.length === 0) {
      resolveDeclaredAttacks();
      render();
      return;
    }
    const playerSlots = el.playerBoard.querySelectorAll('.board-slot');
    const enemySlots = el.enemyBoard.querySelectorAll('.board-slot');
    let index = 0;
    function runNext() {
      if (index >= attacks.length) {
        resolveDeclaredAttacks();
        render();
        return;
      }
      const slotIndex = attacks[index++];
      const fromEl = playerSlots[slotIndex];
      const targetMinion = enemy.board[slotIndex];
      const toEl = (targetMinion && targetMinion.health > 0)
        ? enemySlots[slotIndex]
        : el.enemyHero;
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      playOverlayAnimation(
        { fromRect, toRect, durationMs: 380 },
        runNext
      );
    }
    runNext();
  });
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
