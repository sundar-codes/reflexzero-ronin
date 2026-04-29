// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(frequency, type, duration, vol=0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}
function playSlash() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 0.2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    const noise = audioCtx.createBufferSource(); noise.buffer = buffer;
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    playTone(2500, 'triangle', 0.1, 0.1);
    noise.connect(gainNode); gainNode.connect(audioCtx.destination); noise.start();
}

// --- DYNAMIC BACKGROUND KANJI ---
const KANJI_WORDS = [
    { char: "無<br>心", meaning: '"NO MIND"' },
    { char: "一<br>撃", meaning: '"ONE STRIKE"' },
    { char: "神<br>速", meaning: '"GOD SPEED"' },
    { char: "必<br>殺", meaning: '"CERTAIN KILL"' },
    { char: "残<br>心", meaning: '"AWARENESS"' }
];
const KANJI_COLORS = ['color-red', 'color-gold', 'color-silver', 'color-white'];

// --- ROGUELIKE ACHIEVEMENTS SYSTEM ---
const ACHIEVEMENTS = [
    { id: 'strk_1', title: 'FIRST BLOOD', desc: 'Reach a streak of 1', req: 1 },
    { id: 'strk_5', title: 'UNSTOPPABLE', desc: 'Reach a streak of 5', req: 5 },
    { id: 'strk_10', title: 'SWORD SAINT', desc: 'Reach a streak of 10', req: 10 },
    { id: 'strk_15', title: 'DEMON SLAYER', desc: 'Reach a streak of 15', req: 15 },
    { id: 'strk_20', title: 'NO MIND', desc: 'Reach a streak of 20', req: 20 }
];

let unlockedAchievements = []; // Wipes clean every match

function renderAchievements() {
    const list = document.getElementById('achievement-list');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach(ach => {
        const isUnlocked = unlockedAchievements.includes(ach.id);
        const li = document.createElement('li');
        li.className = `ach-item ${isUnlocked ? 'unlocked' : ''}`;
        li.innerHTML = `
            <span class="ach-title">${ach.title}</span>
            <span class="ach-desc">${isUnlocked ? ach.desc : '???'}</span>
        `;
        list.appendChild(li);
    });
}

function resetAchievements() {
    unlockedAchievements = [];
    renderAchievements();
}

function checkAchievements(currentStreak) {
    ACHIEVEMENTS.forEach(ach => {
        if (currentStreak >= ach.req && !unlockedAchievements.includes(ach.id)) {
            unlockedAchievements.push(ach.id);
            showToast('ACHIEVEMENT UNLOCKED', ach.title);
            renderAchievements();
            playTone(800, 'sine', 0.5, 0.1); 
            playTone(1200, 'sine', 0.6, 0.1); 
        }
    });
}

function showToast(title, desc) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-desc">${desc}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3500);
}

// --- GAME STATE & SETTINGS ---
const STATES = { IDLE: 'idle', WAITING: 'waiting', FEINT: 'feint', READY: 'ready', RESULT: 'result', DEAD: 'dead' };
const MODES = {
    easy: { enemyTime: 400, feintChance: 0.1, name: "WANDERER" },
    medium: { enemyTime: 280, feintChance: 0.3, name: "WARRIOR" },
    hard: { enemyTime: 200, feintChance: 0.5, name: "DEMON" }
};

let currentDifficulty = 'medium';
let currentState = STATES.IDLE;
let timeoutId = null;
let autoRestartId = null; 
let startTime = 0;
let isGameActive = false; 

// Lobby Stat
let highestStreak = parseInt(localStorage.getItem('samuraiHighestStreak')) || 0;
let streak = 0;

// --- DOM ELEMENTS ---
const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const lobbyBest = document.getElementById('lobby-best');
const modeBtns = document.querySelectorAll('.mode-btn');
const btnLeave = document.getElementById('btn-leave');
const currentPathText = document.getElementById('current-path');
const bgKanji = document.getElementById('bg-kanji');

const pad = document.getElementById('game-pad');
const mainText = document.getElementById('main-text');
const subText = document.getElementById('sub-text');
const streakEl = document.getElementById('streak-count');
const container = document.getElementById('main-container');
const slashLine = document.getElementById('slash-line');
const flashOverlay = document.getElementById('flash-overlay');
const btnRestart = document.getElementById('btn-restart');

const btnAbout = document.getElementById('btn-about');
const aboutModal = document.getElementById('about-modal');
const closeAbout = document.getElementById('close-about');

// --- INITIALIZATION ---
function init() {
    renderAchievements(); 
    lobbyBest.textContent = highestStreak;

    btnAbout.addEventListener('click', () => aboutModal.classList.remove('hidden'));
    closeAbout.addEventListener('click', () => aboutModal.classList.add('hidden'));

    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentDifficulty = btn.dataset.mode;
            enterGame();
        });
    });

    btnLeave.addEventListener('click', exitToLobby);
    btnRestart.addEventListener('click', () => {
        btnRestart.classList.add('hidden');
        resetAchievements(); // Clear achievements when starting a new life
        startStaredown();
    });

    pad.addEventListener('pointerdown', handleInput);
    document.addEventListener('keydown', handleInput);
}

// --- LOBBY FLOW ---
function enterGame() {
    isGameActive = true;
    document.body.classList.add('in-game'); 
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    currentPathText.textContent = `PATH: ${MODES[currentDifficulty].name}`;
    btnRestart.classList.add('hidden');
    
    streak = 0;
    streakEl.textContent = streak;
    resetAchievements(); // Clean slate
    
    startStaredown();
}

function exitToLobby() {
    isGameActive = false;
    document.body.classList.remove('in-game'); 
    clearTimeout(timeoutId);
    clearTimeout(autoRestartId);
    gameView.classList.add('hidden');
    lobbyView.classList.remove('hidden');
    lobbyBest.textContent = highestStreak;
    bgKanji.className = 'side-panel right-panel atmospheric-kanji'; // Hide Kanji
}

function setUI(stateClass, mainMessage, subMessage) {
    pad.className = `pad state-${stateClass}`;
    mainText.textContent = mainMessage;
    subText.textContent = subMessage;
}

// --- CORE GAMEPLAY ---
function handleInput(e) {
    if (!isGameActive) return;
    if (e.type === 'keydown' && e.code !== 'Space') return;
    if (e.type === 'keydown' && e.repeat) return;
    if (e.target.tagName === 'BUTTON') return; 

    switch (currentState) {
        case STATES.WAITING:
            playerFailed("DISHONORED", "Drew too early.");
            break;
        case STATES.FEINT:
            playerFailed("FOOLED", "Attacked a shadow.");
            break;
        case STATES.READY:
            recordStrike();
            break;
    }
}

function startStaredown() {
    if (!isGameActive) return;
    clearTimeout(autoRestartId);
    
    // Hide and prep the Kanji
    bgKanji.className = 'side-panel right-panel atmospheric-kanji';
    const randomKanji = KANJI_WORDS[Math.floor(Math.random() * KANJI_WORDS.length)];
    bgKanji.innerHTML = `${randomKanji.char}<span class="kanji-sub">${randomKanji.meaning}</span>`;
    
    currentState = STATES.WAITING;
    setUI(STATES.WAITING, '...', 'Steady');
    playTone(100, 'sine', 0.5, 0.05);

    const delay = Math.floor(Math.random() * 2500) + 1500;
    const settings = MODES[currentDifficulty];
    const willFeint = Math.random() < settings.feintChance;

    if (willFeint) {
        timeoutId = setTimeout(() => executeFeint(), delay - 600);
    } else {
        timeoutId = setTimeout(() => triggerDraw(), delay);
    }
}

function executeFeint() {
    if (!isGameActive) return;
    currentState = STATES.FEINT;
    playTone(600, 'sawtooth', 0.1, 0.05);
    setUI(STATES.FEINT, '?', '');
    
    timeoutId = setTimeout(() => {
        currentState = STATES.WAITING;
        setUI(STATES.WAITING, '...', '');
        timeoutId = setTimeout(() => triggerDraw(), Math.random() * 1500 + 1000);
    }, 400); 
}

function triggerDraw() {
    if (!isGameActive) return;
    currentState = STATES.READY;
    playTone(2000, 'square', 0.15, 0.1);
    setUI(STATES.READY, '!', '');
    startTime = performance.now();

    const enemySpeed = MODES[currentDifficulty].enemyTime;

    timeoutId = setTimeout(() => {
        if (currentState === STATES.READY) {
            playerFailed("SLAIN", `Enemy drew in ${enemySpeed}ms`);
        }
    }, enemySpeed); 
}

function recordStrike() {
    clearTimeout(timeoutId);
    const endTime = performance.now();
    const reactionTime = Math.round(endTime - startTime);
    currentState = STATES.RESULT;

    streak++;
    streakEl.textContent = streak;
    
    // Track Highest Honor
    if (streak > highestStreak) {
        highestStreak = streak;
        localStorage.setItem('samuraiHighestStreak', highestStreak);
    }

    checkAchievements(streak);
    triggerJuice('shake-heavy', false, true);
    
    // Reveal Kanji with random color
    const randomColor = KANJI_COLORS[Math.floor(Math.random() * KANJI_COLORS.length)];
    bgKanji.className = `side-panel right-panel atmospheric-kanji reveal ${randomColor}`;
    
    setUI(STATES.RESULT, `${reactionTime} ms`, `Next round starting...`);
    autoRestartId = setTimeout(startStaredown, 1500);
}

function playerFailed(mainTitle, subTitle) {
    clearTimeout(timeoutId);
    clearTimeout(autoRestartId);
    currentState = STATES.DEAD;
    
    streak = 0;
    streakEl.textContent = streak;
    
    // Hide Kanji on death
    bgKanji.className = 'side-panel right-panel atmospheric-kanji';
    
    playTone(150, 'sawtooth', 0.5, 0.2);
    triggerJuice('shake-violent', true, false); 
    
    setUI(STATES.DEAD, mainTitle, subTitle);
    btnRestart.classList.remove('hidden');
}

function triggerJuice(shakeClass, isBlood = false, slash = false) {
    container.className = 'app-container';
    flashOverlay.className = '';
    slashLine.className = '';
    void container.offsetWidth; 

    if (shakeClass) container.classList.add(shakeClass);
    if (slash) { slashLine.classList.add('slash-active'); playSlash(); }
    if (isBlood) flashOverlay.classList.add('blood-flash');
    else flashOverlay.classList.add('flash-active');
}

// Boot
init();