(function () {
  "use strict";

  const WORD_LENGTH = 5;
  const MAX_ATTEMPTS = 6;
  const STORAGE_KEY = "neon-lexicon-profiles-v1";
  const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const LETTER_RE = /^[a-z]$/;
  const RANK = { absent: 1, present: 2, correct: 3 };
  const WIN_LABELS = {
    1: "Insanity!!",
    2: "Einstein!",
    3: "Stupendous!",
    4: "Not bad!",
    5: "That was a close one!",
    6: "Last gasp!",
  };
  const XP_BY_ATTEMPT = { 1: 250, 2: 200, 3: 160, 4: 120, 5: 90, 6: 70 };
  const RANKS = [
    { level: 1, name: "Rookie" },
    { level: 3, name: "Word Tinkerer" },
    { level: 6, name: "Letter Sleuth" },
    { level: 10, name: "Grid Master" },
    { level: 15, name: "Lexicon Legend" },
    { level: 22, name: "Word Royalty" },
  ];
  const BADGES = [
    { id: "win_one", name: "Insanity!!", description: "Guess a word in one." },
    { id: "win_two", name: "Einstein!", description: "Guess a word in two." },
    { id: "win_three", name: "Stupendous!", description: "Guess a word in three." },
    { id: "win_four", name: "Not bad!", description: "Guess a word in four." },
    { id: "win_five", name: "Close One", description: "Guess a word in five." },
    { id: "all_green", name: "Green Sweep", description: "Submit a guess with only greens." },
    { id: "all_yellow", name: "Golden Row", description: "Submit a guess with only yellows." },
    { id: "streak_three", name: "Hot Streak", description: "Win three games in a row." },
  ];

  const board = document.querySelector("#board");
  const keyboard = document.querySelector("#keyboard");
  const message = document.querySelector("#message");
  const newGameButton = document.querySelector("#new-game");
  const profileMenuButton = document.querySelector("#profile-menu");
  const profileName = document.querySelector("#profile-name");
  const profileRank = document.querySelector("#profile-rank");
  const profileLevel = document.querySelector("#profile-level");
  const profileStreak = document.querySelector("#profile-streak");
  const xpBar = document.querySelector("#xp-bar");
  const winSound = document.querySelector("#win-sound");
  const loseSound = document.querySelector("#lose-sound");
  const fireworksCanvas = document.querySelector("#fireworks");
  const resultModal = document.querySelector("#result-modal");
  const resultKicker = document.querySelector("#result-kicker");
  const resultTitle = document.querySelector("#result-title");
  const resultCopy = document.querySelector("#result-copy");
  const earnedBadges = document.querySelector("#earned-badges");
  const resultPlayAgain = document.querySelector("#result-play-again");
  const resultClose = document.querySelector("#result-close");
  const profileModal = document.querySelector("#profile-modal");
  const profileList = document.querySelector("#profile-list");
  const profileForm = document.querySelector("#profile-form");
  const newProfileName = document.querySelector("#new-profile-name");
  const badgeList = document.querySelector("#badge-list");
  const wipeProfileButton = document.querySelector("#wipe-profile");
  const profileClose = document.querySelector("#profile-close");
  const aboutButton = document.querySelector("#about-button");
  const aboutModal = document.querySelector("#about-modal");
  const aboutClose = document.querySelector("#about-close");

  let answer = "";
  let currentGuess = "";
  let currentRow = 0;
  let gameOver = false;
  let isRevealing = false;
  let revealId = 0;
  let keyStates = {};
  let answerWords = [];
  let allowedWords = new Set();
  let store = { activeId: "", profiles: [] };
  let roundHadOnlyYellows = false;
  let audioPrimed = false;

  function normaliseWords(words) {
    return [...new Set(words.map((word) => word.trim().toLowerCase()).filter((word) => /^[a-z]{5}$/.test(word)))];
  }

  function loadWords() {
    const bundledAnswers = Array.isArray(window.NEON_LEXICON_ANSWERS) ? window.NEON_LEXICON_ANSWERS : [];
    const bundledGuesses = Array.isArray(window.NEON_LEXICON_ALLOWED_GUESSES) ? window.NEON_LEXICON_ALLOWED_GUESSES : [];

    answerWords = normaliseWords(bundledAnswers);
    allowedWords = new Set(normaliseWords([...bundledGuesses, ...answerWords]));

    if (answerWords.length === 0) {
      answerWords = ["crane", "plant", "shore", "light", "brave", "fresh", "stone", "grace"];
      allowedWords = new Set(answerWords);
      showMessage("Starter words loaded. Check words-data.js if you expected the full list.", true);
    }
  }

  function loadProfiles() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.profiles)) {
        store = saved;
      }
    } catch (error) {
      store = { activeId: "", profiles: [] };
    }

    store.profiles = store.profiles.map(normaliseProfile);
    if (!getActiveProfile() && store.profiles.length > 0) {
      store.activeId = store.profiles[0].id;
    }
    saveProfiles();
  }

  function normaliseProfile(profile) {
    return {
      id: profile.id || makeId(),
      name: String(profile.name || "Player").slice(0, 18),
      xp: Number(profile.xp) || 0,
      streak: Number(profile.streak) || 0,
      bestStreak: Number(profile.bestStreak) || 0,
      played: Number(profile.played) || 0,
      wins: Number(profile.wins) || 0,
      badges: Array.isArray(profile.badges) ? profile.badges : [],
    };
  }

  function saveProfiles() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getActiveProfile() {
    return store.profiles.find((profile) => profile.id === store.activeId) || null;
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function buildBoard() {
    board.innerHTML = "";
    for (let rowIndex = 0; rowIndex < MAX_ATTEMPTS; rowIndex += 1) {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.row = String(rowIndex);

      for (let columnIndex = 0; columnIndex < WORD_LENGTH; columnIndex += 1) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.setAttribute("aria-label", `Row ${rowIndex + 1}, letter ${columnIndex + 1}`);
        row.appendChild(tile);
      }

      board.appendChild(row);
    }
  }

  function buildKeyboard() {
    keyboard.innerHTML = "";

    KEY_ROWS.forEach((letters, rowIndex) => {
      const row = document.createElement("div");
      row.className = "key-row";

      if (rowIndex === 2) {
        row.appendChild(makeKey("Enter", "Enter", true));
      }

      [...letters].forEach((letter) => {
        row.appendChild(makeKey(letter, letter));
      });

      if (rowIndex === 2) {
        row.appendChild(makeKey("Backspace", "Del", true));
      }

      keyboard.appendChild(row);
    });
  }

  function makeKey(value, label, wide = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = wide ? "key wide" : "key";
    button.textContent = label;
    button.dataset.key = value;
    button.setAttribute("aria-label", value === "Backspace" ? "Delete letter" : value);
    button.addEventListener("click", () => handleInput(value));
    return button;
  }

  function startGame() {
    hideModal(resultModal);
    stopFireworks();
    if (!getActiveProfile()) {
      buildBoard();
      buildKeyboard();
      renderProfileSummary();
      showMessage("Create a profile to start playing.", true);
      showProfileModal();
      return;
    }

    answer = answerWords[Math.floor(Math.random() * answerWords.length)];
    currentGuess = "";
    currentRow = 0;
    gameOver = false;
    isRevealing = false;
    revealId += 1;
    keyStates = {};
    roundHadOnlyYellows = false;
    buildBoard();
    buildKeyboard();
    renderProfileSummary();
    showMessage("Guess the five-letter word.");
  }

  function handleInput(key) {
    if (gameOver || isRevealing || !getActiveProfile()) {
      return;
    }

    if (key === "Enter") {
      submitGuess();
      return;
    }

    if (key === "Backspace") {
      removeLetter();
      return;
    }

    const letter = key.toLowerCase();
    if (LETTER_RE.test(letter)) {
      addLetter(letter);
    }
  }

  function addLetter(letter) {
    if (currentGuess.length >= WORD_LENGTH) {
      return;
    }

    currentGuess += letter;
    const tile = getTile(currentRow, currentGuess.length - 1);
    tile.textContent = letter;
    tile.classList.add("filled", "pop");
    tile.addEventListener("animationend", () => tile.classList.remove("pop"), { once: true });
  }

  function removeLetter() {
    if (currentGuess.length === 0) {
      return;
    }

    const tile = getTile(currentRow, currentGuess.length - 1);
    tile.textContent = "";
    tile.className = "tile";
    currentGuess = currentGuess.slice(0, -1);
  }

  async function submitGuess() {
    if (currentGuess.length !== WORD_LENGTH) {
      showMessage("Use exactly five letters.", true);
      shakeRow();
      return;
    }

    if (!allowedWords.has(currentGuess)) {
      showMessage("That word is not in the list.", true);
      shakeRow();
      return;
    }

    const submittedGuess = currentGuess;
    const result = evaluateGuess(currentGuess, answer);
    roundHadOnlyYellows = roundHadOnlyYellows || result.every((item) => item.state === "present");
    const activeRevealId = revealId;
    isRevealing = true;
    showMessage("");
    await revealResult(result, activeRevealId);

    if (activeRevealId !== revealId) {
      return;
    }

    updateKeyboard(result);
    isRevealing = false;

    if (submittedGuess === answer) {
      gameOver = true;
      handleWin(currentRow + 1, result);
      return;
    }

    currentRow += 1;
    currentGuess = "";

    if (currentRow === MAX_ATTEMPTS) {
      gameOver = true;
      handleLoss();
      return;
    }

    showMessage("Keep going.");
  }

  function evaluateGuess(guess, target) {
    const result = Array.from(guess, (letter, index) => ({ letter, state: "absent", index }));
    const remaining = {};

    for (let index = 0; index < WORD_LENGTH; index += 1) {
      if (guess[index] === target[index]) {
        result[index].state = "correct";
      } else {
        remaining[target[index]] = (remaining[target[index]] || 0) + 1;
      }
    }

    for (let index = 0; index < WORD_LENGTH; index += 1) {
      const letter = guess[index];
      if (result[index].state === "correct") {
        continue;
      }

      if (remaining[letter] > 0) {
        result[index].state = "present";
        remaining[letter] -= 1;
      }
    }

    return result;
  }

  async function revealResult(result, activeRevealId) {
    const rowToReveal = currentRow;
    const flipDuration = 430;
    const pauseBetweenFlips = 15;

    for (const { letter, state, index } of result) {
      if (activeRevealId !== revealId) {
        return;
      }

      await flipTile(getTile(rowToReveal, index), letter, state, flipDuration, activeRevealId);
      await wait(pauseBetweenFlips);
    }
  }

  function flipTile(tile, letter, state, flipDuration, activeRevealId) {
    return new Promise((resolve) => {
      let didResolve = false;
      const finish = () => {
        if (didResolve) {
          return;
        }

        didResolve = true;
        tile.removeEventListener("animationend", finish);
        if (activeRevealId === revealId) {
          tile.className = `tile ${state}`;
        }
        resolve();
      };

      tile.textContent = letter;
      tile.className = "tile reveal";
      tile.style.setProperty("--flip-duration", `${flipDuration}ms`);
      tile.addEventListener("animationend", finish);

      window.setTimeout(() => {
        if (activeRevealId === revealId) {
          tile.classList.add(state);
        }
      }, flipDuration / 2);

      window.setTimeout(finish, flipDuration + 80);
    });
  }

  function handleWin(attempts, finalResult) {
    playSound(winSound);
    const profile = getActiveProfile();
    const beforeLevel = getLevel(profile.xp);
    const newBadges = awardWinBadges(profile, attempts, finalResult);
    const streakBonus = Math.min(profile.streak * 10, 100);
    const xpEarned = XP_BY_ATTEMPT[attempts] + streakBonus + newBadges.length * 40;

    profile.played += 1;
    profile.wins += 1;
    profile.streak += 1;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
    profile.xp += xpEarned;
    if (profile.streak >= 3) {
      addBadge(profile, "streak_three", newBadges);
    }

    saveProfiles();
    renderProfileSummary();
    glowWinningRow();
    startFireworks();
    showMessage(WIN_LABELS[attempts]);

    const afterLevel = getLevel(profile.xp);
    const levelText = afterLevel > beforeLevel ? ` Level up! You are now Level ${afterLevel}.` : "";
    showResultModal({
      won: true,
      kicker: WIN_LABELS[attempts],
      title: "You won! Play again?",
      copy: `${answer.toUpperCase()} in ${attempts}. +${xpEarned} EXP.${levelText}`,
      badges: newBadges,
    });
  }

  function handleLoss() {
    const profile = getActiveProfile();
    playSound(loseSound);
    profile.played += 1;
    profile.streak = 0;
    saveProfiles();
    renderProfileSummary();
    document.body.classList.add("loss-drama");
    window.setTimeout(() => document.body.classList.remove("loss-drama"), 900);
    showMessage(`The word was ${answer.toUpperCase()}.`, true);
    showResultModal({
      won: false,
      kicker: "So close",
      title: "You lost! Play again?",
      copy: `The word was ${answer.toUpperCase()}. Streak reset, but glory remains available.`,
      badges: [],
    });
  }

  function awardWinBadges(profile, attempts, finalResult) {
    const newBadges = [];
    const attemptBadges = { 1: "win_one", 2: "win_two", 3: "win_three", 4: "win_four", 5: "win_five" };
    if (attemptBadges[attempts]) {
      addBadge(profile, attemptBadges[attempts], newBadges);
    }
    if (finalResult.every((item) => item.state === "correct")) {
      addBadge(profile, "all_green", newBadges);
    }
    if (roundHadOnlyYellows) {
      addBadge(profile, "all_yellow", newBadges);
    }
    return newBadges;
  }

  function addBadge(profile, badgeId, newBadges) {
    if (profile.badges.includes(badgeId)) {
      return;
    }

    profile.badges.push(badgeId);
    newBadges.push(getBadge(badgeId));
  }

  function getBadge(badgeId) {
    return BADGES.find((badge) => badge.id === badgeId);
  }

  function getLevel(xp) {
    return Math.floor(Math.sqrt(xp / 90)) + 1;
  }

  function getNextLevelXp(level) {
    return level * level * 90;
  }

  function getRank(level) {
    return RANKS.reduce((current, rank) => (level >= rank.level ? rank : current), RANKS[0]).name;
  }

  function renderProfileSummary() {
    const profile = getActiveProfile();
    if (!profile) {
      profileName.textContent = "No profile";
      profileRank.textContent = "Create a profile";
      profileLevel.textContent = "Level 1";
      profileStreak.textContent = "Streak 0";
      xpBar.style.width = "0%";
      return;
    }

    const level = getLevel(profile.xp);
    const previousXp = getNextLevelXp(level - 1);
    const nextXp = getNextLevelXp(level);
    const progress = Math.round(((profile.xp - previousXp) / (nextXp - previousXp)) * 100);
    profileName.textContent = profile.name;
    profileRank.textContent = getRank(level);
    profileLevel.textContent = `Level ${level}`;
    profileStreak.textContent = `Streak ${profile.streak}`;
    xpBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }

  function renderProfileModal() {
    const activeProfile = getActiveProfile();
    profileList.innerHTML = "";

    if (store.profiles.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Add a player profile to start earning EXP and badges.";
      profileList.appendChild(empty);
    }

    store.profiles.forEach((profile) => {
      const level = getLevel(profile.xp);
      const button = document.createElement("button");
      button.type = "button";
      button.className = profile.id === store.activeId ? "profile-option active" : "profile-option";
      button.innerHTML = `<strong>${escapeHtml(profile.name)}</strong><span>Level ${level} ${getRank(level)} | Streak ${profile.streak} | ${profile.badges.length} badges</span>`;
      button.addEventListener("click", () => {
        store.activeId = profile.id;
        saveProfiles();
        renderProfileSummary();
        renderProfileModal();
        hideModal(profileModal);
        startGame();
      });
      profileList.appendChild(button);
    });

    badgeList.innerHTML = "";
    BADGES.forEach((badge) => {
      const earned = activeProfile && activeProfile.badges.includes(badge.id);
      const item = document.createElement("div");
      item.className = earned ? "badge earned" : "badge";
      item.innerHTML = `<strong>${escapeHtml(badge.name)}</strong><span>${escapeHtml(badge.description)}</span>`;
      badgeList.appendChild(item);
    });
  }

  function showProfileModal() {
    renderProfileModal();
    showModal(profileModal);
    window.setTimeout(() => newProfileName.focus(), 50);
  }

  function showResultModal(result) {
    resultModal.classList.toggle("won", result.won);
    resultModal.classList.toggle("lost", !result.won);
    resultKicker.textContent = result.kicker;
    resultTitle.textContent = result.title;
    resultCopy.textContent = result.copy;
    earnedBadges.innerHTML = "";

    result.badges.forEach((badge) => {
      if (!badge) {
        return;
      }
      const item = document.createElement("div");
      item.className = "earned-badge";
      item.innerHTML = `<strong>${escapeHtml(badge.name)}</strong><span>${escapeHtml(badge.description)}</span>`;
      earnedBadges.appendChild(item);
    });

    showModal(resultModal);
  }

  function showModal(modal) {
    modal.classList.remove("hidden");
  }

  function hideModal(modal) {
    modal.classList.add("hidden");
  }

  function glowWinningRow() {
    const row = board.children[currentRow];
    if (row) {
      row.classList.add("winning-word");
    }
  }

  function startFireworks() {
    const context = fireworksCanvas.getContext("2d");
    const particles = [];
    const colors = ["#f9d35c", "#ff6b6b", "#7bdff2", "#8ee08e", "#b794f4"];
    const endTime = performance.now() + 2800;

    function resize() {
      fireworksCanvas.width = window.innerWidth * window.devicePixelRatio;
      fireworksCanvas.height = window.innerHeight * window.devicePixelRatio;
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    }

    function burst() {
      const x = 60 + Math.random() * Math.max(1, window.innerWidth - 120);
      const y = 60 + Math.random() * Math.min(260, window.innerHeight * 0.45);
      for (let index = 0; index < 34; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 42 + Math.random() * 18,
          age: 0,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }

    function draw() {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (performance.now() < endTime && Math.random() < 0.14) {
        burst();
      }

      particles.forEach((particle) => {
        particle.age += 1;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.045;
        const alpha = Math.max(0, 1 - particle.age / particle.life);
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        context.fill();
      });

      context.globalAlpha = 1;
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        if (particles[index].age >= particles[index].life) {
          particles.splice(index, 1);
        }
      }

      if (performance.now() < endTime || particles.length > 0) {
        fireworksCanvas.dataset.frame = String(requestAnimationFrame(draw));
      } else {
        stopFireworks();
      }
    }

    stopFireworks();
    fireworksCanvas.classList.add("active");
    resize();
    burst();
    burst();
    fireworksCanvas.dataset.frame = String(requestAnimationFrame(draw));
  }

  function stopFireworks() {
    const frame = Number(fireworksCanvas.dataset.frame);
    if (frame) {
      cancelAnimationFrame(frame);
    }
    fireworksCanvas.classList.remove("active");
    fireworksCanvas.getContext("2d").clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    fireworksCanvas.dataset.frame = "";
  }

  function primeAudio() {
    if (audioPrimed) {
      return;
    }

    audioPrimed = true;
    [winSound, loseSound].forEach((sound) => {
      if (!sound) {
        return;
      }

      sound.load();
      sound.muted = true;
      const playAttempt = sound.play();
      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt.then(() => {
          sound.pause();
          sound.currentTime = 0;
          sound.muted = false;
        }).catch(() => {
          sound.muted = false;
        });
      } else {
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
      }
    });
  }

  function playSound(sound) {
    if (!sound) {
      return;
    }

    sound.pause();
    sound.currentTime = 0;
    const playAttempt = sound.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }
  }

  function updateKeyboard(result) {
    result.forEach(({ letter, state }) => {
      if ((RANK[state] || 0) <= (RANK[keyStates[letter]] || 0)) {
        return;
      }

      keyStates[letter] = state;
      const key = keyboard.querySelector(`[data-key="${letter}"]`);
      if (key) {
        key.classList.remove("absent", "present", "correct");
        key.classList.add(state);
      }
    });
  }

  function getTile(row, column) {
    return board.children[row].children[column];
  }

  function shakeRow() {
    const row = board.children[currentRow];
    row.querySelectorAll(".tile").forEach((tile) => {
      tile.classList.add("shake");
      tile.addEventListener("animationend", () => tile.classList.remove("shake"), { once: true });
    });
  }

  function showMessage(text, urgent = false) {
    message.textContent = text;
    message.classList.toggle("urgent", urgent);
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }


  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;",
    }[character]));
  }

  function runScoringChecks() {
    const compact = (guess, target) => evaluateGuess(guess, target).map((item) => item.state[0]).join("");
    const checks = [
      ["allee", "apple", "cpaac"],
      ["eerie", "serve", "accac"],
      ["sassy", "class", "ppaca"],
      ["cocoa", "cacao", "cpcap"],
    ];

    checks.forEach(([guess, target, expected]) => {
      const actual = compact(guess, target);
      if (actual !== expected) {
        throw new Error(`Scoring check failed for ${guess}/${target}: expected ${expected}, got ${actual}`);
      }
    });
  }

  document.addEventListener("pointerdown", primeAudio, { once: true });
  document.addEventListener("touchstart", primeAudio, { once: true, passive: true });
  document.addEventListener("keydown", primeAudio, { once: true });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input")) {
      return;
    }
    if (!profileModal.classList.contains("hidden") || !resultModal.classList.contains("hidden") || !aboutModal.classList.contains("hidden")) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Enter" || event.key === "Backspace" || LETTER_RE.test(event.key.toLowerCase())) {
      event.preventDefault();
      handleInput(event.key);
    }
  });


  newGameButton.addEventListener("click", startGame);
  profileMenuButton.addEventListener("click", showProfileModal);
  profileClose.addEventListener("click", () => hideModal(profileModal));
  resultClose.addEventListener("click", () => hideModal(resultModal));
  resultPlayAgain.addEventListener("click", startGame);
  aboutButton.addEventListener("click", () => showModal(aboutModal));
  aboutClose.addEventListener("click", () => hideModal(aboutModal));

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = newProfileName.value.trim();
    if (!name) {
      newProfileName.focus();
      return;
    }

    const profile = normaliseProfile({ id: makeId(), name, badges: [] });
    store.profiles.push(profile);
    store.activeId = profile.id;
    newProfileName.value = "";
    saveProfiles();
    hideModal(profileModal);
    startGame();
  });

  wipeProfileButton.addEventListener("click", () => {
    const profile = getActiveProfile();
    if (!profile) {
      return;
    }

    const okay = window.confirm(`Wipe all progress for ${profile.name}? This keeps the profile name but resets EXP, streaks, and badges.`);
    if (!okay) {
      return;
    }

    profile.xp = 0;
    profile.streak = 0;
    profile.bestStreak = 0;
    profile.played = 0;
    profile.wins = 0;
    profile.badges = [];
    saveProfiles();
    renderProfileSummary();
    renderProfileModal();
  });

  window.NeonLexicon = { evaluateGuess, startGame };

  loadWords();
  loadProfiles();
  runScoringChecks();
  startGame();
})();
