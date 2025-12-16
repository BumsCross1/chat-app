import { 
    auth, database, onAuthStateChanged,
    ref, get, update, set, push, onValue, off, remove
} from '../config/firebase.js';
import { formatNumber, getNumberColor, showNotification } from '../utils.js';

// Game State
let currentUser = null;
let userData = null;
let tableId = null;
let tableData = null;
let gameState = {
    bets: {},
    totalBet: 0,
    isSpinning: false,
    winningNumber: null,
    selectedChip: 50,
    players: {},
    chatMessages: []
};

// DOM Elements
let spinBtn, clearBtn, chatInput, sendBtn, resultModal;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        
        // Get table ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        tableId = urlParams.get('table') || 'solo';
        
        if (tableId !== 'solo') {
            await joinTable(tableId);
        }
        
        setupGame();
        setupEventListeners();
        startBonusTimer();
        setupTableListener();
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, 'users/' + currentUser.uid));
        if (snapshot.exists()) {
            userData = snapshot.val();
            gameState.chips = userData.chips || 1000;
            updateChipsDisplay();
            updateAvatar();
        }
    } catch (error) {
        console.log('Offline mode - using local chips');
        gameState.chips = 1000;
        updateChipsDisplay();
    }
}

async function joinTable(tableId) {
    try {
        const tableRef = ref(database, `tables/${tableId}`);
        const snapshot = await get(tableRef);
        
        if (!snapshot.exists()) {
            showNotification('Tisch nicht gefunden', 'error');
            window.location.href = 'dashboard.html';
            return;
        }
        
        tableData = snapshot.val();
        
        // Update table info
        document.getElementById('table-id').textContent = tableData.name;
        document.getElementById('players-count').textContent = 
            tableData.players ? Object.keys(tableData.players).length : 1;
        
        // Add player to table if not already
        if (tableData.players && !tableData.players[currentUser.uid]) {
            const players = { ...tableData.players };
            players[currentUser.uid] = {
                name: userData.username,
                chips: userData.chips,
                avatar: userData.profileImage,
                joinedAt: Date.now(),
                bets: {},
                totalBet: 0
            };
            
            await update(tableRef, {
                players: players,
                playerCount: Object.keys(players).length
            });
        }
        
    } catch (error) {
        console.error('Error joining table:', error);
        showNotification('Fehler beim Beitritt zum Tisch', 'error');
    }
}

function setupTableListener() {
    if (tableId === 'solo') return;
    
    const tableRef = ref(database, `tables/${tableId}`);
    
    onValue(tableRef, (snapshot) => {
        if (!snapshot.exists()) return;
        
        const table = snapshot.val();
        tableData = table;
        
        // Update players display
        updatePlayersList(table.players || {});
        
        // Update player count
        document.getElementById('players-count').textContent = 
            Object.keys(table.players || {}).length;
        
        // Handle game state
        if (table.status === 'spinning' && !gameState.isSpinning) {
            startWheelAnimation(table.winningNumber || getRandomNumber());
        }
        
        if (table.status === 'result' && table.winningNumber) {
            showResult(table.winningNumber, table.results || {});
        }
        
        // Update chat
        if (table.chat) {
            updateChat(Object.values(table.chat));
        }
    });
}

function setupGame() {
    // Get DOM elements
    spinBtn = document.getElementById('spin-btn');
    clearBtn = document.getElementById('clear-btn');
    chatInput = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');
    resultModal = document.getElementById('result-modal');
    
    // Create wheel
    createWheel();
    
    // Create betting table
    createBettingTable();
    
    // Setup chips
    setupChips();
    
    // Initial UI update
    updateChipsDisplay();
    updateBetDisplay();
}

function createWheel() {
    const wheel = document.getElementById('roulette-wheel');
    if (!wheel) return;
    
    wheel.innerHTML = '';
    
    const wheelInner = document.createElement('div');
    wheelInner.className = 'wheel-inner';
    wheelInner.id = 'wheel-inner';
    
    // European roulette numbers in correct order
    const numbers = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 
        11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 
        22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    
    const angle = 360 / numbers.length;
    
    numbers.forEach((num, index) => {
        const segment = document.createElement('div');
        segment.className = `wheel-segment ${getNumberColor(num)}`;
        segment.textContent = num;
        segment.style.transform = `rotate(${index * angle}deg)`;
        segment.style.transformOrigin = 'center';
        wheelInner.appendChild(segment);
    });
    
    wheel.appendChild(wheelInner);
    
    // Create ball
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'roulette-ball';
    wheel.appendChild(ball);
}

function createBettingTable() {
    const table = document.getElementById('betting-table');
    if (!table) return;
    
    table.innerHTML = '';
    
    // Main grid for numbers 1-36
    const grid = document.createElement('div');
    grid.className = 'table-grid';
    
    // Add zero
    const zeroCell = createNumberCell(0);
    zeroCell.classList.add('zero');
    grid.appendChild(zeroCell);
    
    // Add numbers 1-36 in rows of 3
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 12; col++) {
            const number = 3 * col + row + 1;
            const cell = createNumberCell(number);
            grid.appendChild(cell);
        }
    }
    
    table.appendChild(grid);
    
    // Outside bets
    createOutsideBets(table);
}

function createNumberCell(number) {
    const cell = document.createElement('div');
    cell.className = `table-number ${getNumberColor(number)}`;
    cell.textContent = number;
    cell.dataset.number = number;
    cell.dataset.type = 'number';
    
    cell.addEventListener('click', () => {
        placeBet(number.toString(), 'number', 35);
    });
    
    return cell;
}

function createOutsideBets(container) {
    const outside = document.createElement('div');
    outside.className = 'outside-bets';
    
    // 1-18, 19-36
    const ranges = [
        { label: '1-18', type: 'low', mult: 1 },
        { label: '19-36', type: 'high', mult: 1 }
    ];
    
    ranges.forEach(range => {
        const bet = document.createElement('div');
        bet.className = 'outside-bet';
        bet.textContent = range.label;
        bet.dataset.type = range.type;
        bet.dataset.multiplier = range.mult;
        
        bet.addEventListener('click', () => {
            placeBet(range.type, range.type, range.mult);
        });
        
        outside.appendChild(bet);
    });
    
    // Red/Black
    const colors = [
        { label: 'RED', type: 'red', mult: 1 },
        { label: 'BLACK', type: 'black', mult: 1 }
    ];
    
    colors.forEach(color => {
        const bet = document.createElement('div');
        bet.className = `outside-bet ${color.type}`;
        bet.textContent = color.label;
        bet.dataset.type = color.type;
        bet.dataset.multiplier = color.mult;
        
        bet.addEventListener('click', () => {
            placeBet(color.type, 'color', color.mult);
        });
        
        outside.appendChild(bet);
    });
    
    // Even/Odd
    const evenOdd = [
        { label: 'EVEN', type: 'even', mult: 1 },
        { label: 'ODD', type: 'odd', mult: 1 }
    ];
    
    evenOdd.forEach(eo => {
        const bet = document.createElement('div');
        bet.className = 'outside-bet';
        bet.textContent = eo.label;
        bet.dataset.type = eo.type;
        bet.dataset.multiplier = eo.mult;
        
        bet.addEventListener('click', () => {
            placeBet(eo.type, 'evenodd', eo.mult);
        });
        
        outside.appendChild(bet);
    });
    
    // Dozens
    const dozens = [
        { label: '1st 12', type: 'dozen1', mult: 2 },
        { label: '2nd 12', type: 'dozen2', mult: 2 },
        { label: '3rd 12', type: 'dozen3', mult: 2 }
    ];
    
    dozens.forEach(dozen => {
        const bet = document.createElement('div');
        bet.className = 'outside-bet';
        bet.textContent = dozen.label;
        bet.dataset.type = dozen.type;
        bet.dataset.multiplier = dozen.mult;
        
        bet.addEventListener('click', () => {
            placeBet(dozen.type, 'dozen', dozen.mult);
        });
        
        outside.appendChild(bet);
    });
    
    container.appendChild(outside);
}

function setupChips() {
    const container = document.querySelector('.chip-values');
    if (!container) return;
    
    const chips = [10, 25, 50, 100, 500];
    
    chips.forEach(chipValue => {
        const chipBtn = document.createElement('button');
        chipBtn.className = 'chip-btn';
        chipBtn.innerHTML = `
            <div class="chip chip-${chipValue}">
                ${chipValue}
            </div>
        `;
        
        chipBtn.addEventListener('click', () => {
            selectChip(chipValue);
        });
        
        container.appendChild(chipBtn);
    });
    
    selectChip(50);
}

function selectChip(value) {
    gameState.selectedChip = value;
    
    // Update display
    const currentBet = document.getElementById('current-bet');
    if (currentBet) currentBet.textContent = value;
    
    // Highlight selected chip
    document.querySelectorAll('.chip-btn .chip').forEach(chip => {
        chip.classList.remove('selected');
    });
    
    const selectedChip = document.querySelector(`.chip-${value}`);
    if (selectedChip) selectedChip.classList.add('selected');
}

function placeBet(betValue, betType, multiplier) {
    if (gameState.isSpinning) {
        showNotification('Das Rad dreht sich bereits!', 'warning');
        return;
    }
    
    if (gameState.selectedChip > gameState.chips) {
        showNotification('Nicht genug Chips!', 'error');
        return;
    }
    
    // Create bet key
    const betKey = `${betType}_${betValue}`;
    
    // Add to bets
    if (!gameState.bets[betKey]) {
        gameState.bets[betKey] = {
            value: betValue,
            type: betType,
            amount: 0,
            multiplier: multiplier
        };
    }
    
    gameState.bets[betKey].amount += gameState.selectedChip;
    gameState.totalBet += gameState.selectedChip;
    gameState.chips -= gameState.selectedChip;
    
    // Update database if multiplayer
    if (tableId !== 'solo' && tableData) {
        updatePlayerBets();
    }
    
    updateChipsDisplay();
    updateBetDisplay();
    showChipOnTable(betValue, betType);
    
    showNotification(`${gameState.selectedChip} Chips auf ${betValue} gesetzt`, 'info');
}

function updatePlayerBets() {
    const playerRef = ref(database, `tables/${tableId}/players/${currentUser.uid}`);
    
    update(playerRef, {
        bets: gameState.bets,
        totalBet: gameState.totalBet,
        lastBet: Date.now()
    });
}

function showChipOnTable(betValue, betType) {
    let selector;
    
    if (betType === 'number') {
        selector = `.table-number[data-number="${betValue}"]`;
    } else {
        selector = `.outside-bet[data-type="${betValue}"]`;
    }
    
    const betElement = document.querySelector(selector);
    if (!betElement) return;
    
    // Check if chip already exists
    let chipElement = betElement.querySelector('.placed-chip');
    
    if (!chipElement) {
        chipElement = document.createElement('div');
        chipElement.className = `placed-chip chip-${gameState.selectedChip}`;
        betElement.appendChild(chipElement);
    }
    
    // Update chip value
    const currentAmount = parseInt(chipElement.textContent) || 0;
    chipElement.textContent = currentAmount + gameState.selectedChip;
    
    // Add animation
    chipElement.style.animation = 'none';
    setTimeout(() => {
        chipElement.style.animation = 'chipDrop 0.3s ease-out';
    }, 10);
}

function spinWheel() {
    if (gameState.isSpinning) {
        showNotification('Bitte warten...', 'warning');
        return;
    }
    
    if (gameState.totalBet === 0) {
        showNotification('Bitte zuerst setzen!', 'warning');
        return;
    }
    
    gameState.isSpinning = true;
    spinBtn.disabled = true;
    clearBtn.disabled = true;
    
    // Generate winning number
    const winningNumber = getRandomNumber();
    gameState.winningNumber = winningNumber;
    
    if (tableId === 'solo') {
        // Solo game
        startWheelAnimation(winningNumber);
        setTimeout(() => {
            calculateResult();
            resetGame();
        }, 5000);
    } else {
        // Multiplayer - update table state
        update(ref(database, `tables/${tableId}`), {
            status: 'spinning',
            winningNumber: winningNumber,
            spinStartedAt: Date.now()
        });
    }
    
    // Add chat message
    addChatMessage('System', 'Das Rad dreht sich... 🎡');
}

function getRandomNumber() {
    return Math.floor(Math.random() * 37);
}

function startWheelAnimation(winningNumber) {
    const wheelInner = document.getElementById('wheel-inner');
    const ball = document.getElementById('roulette-ball');
    
    if (!wheelInner || !ball) return;
    
    // Calculate total rotation (5 full spins + offset to winning number)
    const spins = 5;
    const numbers = 37;
    const anglePerNumber = 360 / numbers;
    
    // Find the winning number's position in wheel order
    const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 
                       11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 
                       22, 18, 29, 7, 28, 12, 35, 3, 26];
    
    const winningIndex = wheelOrder.indexOf(winningNumber);
    const targetAngle = (spins * 360) + (winningIndex * anglePerNumber);
    
    // Animate wheel
    wheelInner.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
    wheelInner.style.transform = `rotate(${-targetAngle}deg)`;
    
    // Add ball animation
    ball.style.transition = 'all 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
    ball.style.transform = `rotate(${targetAngle * 0.7}deg) translate(120px)`;
}

function calculateResult() {
    const winningNumber = gameState.winningNumber;
    const winningColor = getNumberColor(winningNumber);
    let totalWin = 0;
    
    // Check each bet
    Object.values(gameState.bets).forEach(bet => {
        if (checkBetWin(bet, winningNumber, winningColor)) {
            const winAmount = bet.amount * bet.multiplier;
            totalWin += winAmount;
        }
    });
    
    // Update chips
    if (totalWin > 0) {
        gameState.chips += totalWin + gameState.totalBet; // Return bet + winnings
    } else {
        gameState.chips += gameState.totalBet; // Return only bet if no win
    }
    
    // Save result
    saveGameResult(totalWin);
    
    // Show result modal
    showResultModal(winningNumber, winningColor, totalWin);
    
    // Update display
    updateChipsDisplay();
    
    // Add chat message
    const message = totalWin > 0 
        ? `🎉 Gewonnen! Zahl: ${winningNumber} (${winningColor}) - ${totalWin} Chips gewonnen!`
        : `😢 Verloren! Zahl: ${winningNumber} (${winningColor})`;
    
    addChatMessage('System', message);
    
    return totalWin;
}

function checkBetWin(bet, winningNumber, winningColor) {
    switch(bet.type) {
        case 'number':
            return parseInt(bet.value) === winningNumber;
        case 'color':
            return bet.value === winningColor;
        case 'evenodd':
            if (winningNumber === 0) return false;
            return bet.value === 'even' ? winningNumber % 2 === 0 : winningNumber % 2 === 1;
        case 'dozen':
            const dozenNum = parseInt(bet.value.replace('dozen', ''));
            const start = (dozenNum - 1) * 12 + 1;
            const end = dozenNum * 12;
            return winningNumber >= start && winningNumber <= end;
        case 'low':
            return winningNumber >= 1 && winningNumber <= 18;
        case 'high':
            return winningNumber >= 19 && winningNumber <= 36;
        default:
            return false;
    }
}

function showResultModal(winningNumber, winningColor, winAmount) {
    const modal = document.getElementById('result-modal');
    const resultNumber = document.getElementById('result-number');
    const resultColor = document.getElementById('result-color');
    const resultMessage = document.getElementById('result-message');
    const winAmountEl = document.getElementById('win-amount');
    
    if (!modal) return;
    
    // Update content
    resultNumber.textContent = winningNumber;
    resultNumber.className = `result-number ${winningColor}`;
    
    const colorText = winningColor === 'green' ? 'Grün' : 
                     winningColor === 'red' ? 'Rot' : 'Schwarz';
    resultColor.textContent = colorText;
    resultColor.className = `result-color ${winningColor}`;
    
    winAmountEl.textContent = formatNumber(winAmount);
    
    if (winAmount > 0) {
        resultMessage.innerHTML = '<div class="win-message"><i class="fas fa-trophy"></i> Gewonnen!</div>';
    } else {
        resultMessage.innerHTML = '<div class="lose-message"><i class="fas fa-times"></i> Verloren</div>';
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    // Auto close after 5 seconds
    setTimeout(() => {
        modal.style.display = 'none';
    }, 5000);
}

async function saveGameResult(winAmount) {
    try {
        // Update user chips and stats
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        const user = snapshot.val();
        
        const updates = {
            chips: gameState.chips,
            gamesPlayed: (user.gamesPlayed || 0) + 1,
            lastPlayed: Date.now()
        };
        
        if (winAmount > 0) {
            updates.gamesWon = (user.gamesWon || 0) + 1;
            updates.totalWinnings = (user.totalWinnings || 0) + winAmount;
            updates.winStreak = (user.winStreak || 0) + 1;
            
            if (winAmount > (user.highestWin || 0)) {
                updates.highestWin = winAmount;
            }
        } else {
            updates.winStreak = 0;
        }
        
        await update(userRef, updates);
        
        // Save game to history
        const gameData = {
            userId: currentUser.uid,
            tableId: tableId,
            winningNumber: gameState.winningNumber,
            bets: gameState.totalBet,
            win: winAmount,
            timestamp: Date.now(),
            mode: tableId === 'solo' ? 'solo' : 'multiplayer'
        };
        
        await push(ref(database, 'games'), gameData);
        
    } catch (error) {
        console.error('Error saving game result:', error);
    }
}

function resetGame() {
    gameState.bets = {};
    gameState.totalBet = 0;
    gameState.isSpinning = false;
    
    spinBtn.disabled = false;
    clearBtn.disabled = false;
    
    // Remove chips from table
    document.querySelectorAll('.placed-chip').forEach(chip => {
        chip.remove();
    });
    
    updateBetDisplay();
}

function clearBets() {
    if (gameState.isSpinning) {
        showNotification('Während des Drehens nicht möglich', 'warning');
        return;
    }
    
    // Return chips
    gameState.chips += gameState.totalBet;
    gameState.bets = {};
    gameState.totalBet = 0;
    
    // Update database if multiplayer
    if (tableId !== 'solo') {
        const playerRef = ref(database, `tables/${tableId}/players/${currentUser.uid}`);
        update(playerRef, {
            bets: {},
            totalBet: 0
        });
    }
    
    // Remove chips from table
    document.querySelectorAll('.placed-chip').forEach(chip => {
        chip.remove();
    });
    
    updateChipsDisplay();
    updateBetDisplay();
    
    showNotification('Einsätze zurückgenommen', 'info');
}

function updateChipsDisplay() {
    const chipsElement = document.getElementById('player-chips');
    const sidebarChips = document.getElementById('sidebar-chips');
    
    if (chipsElement) chipsElement.textContent = formatNumber(gameState.chips);
    if (sidebarChips) sidebarChips.textContent = formatNumber(gameState.chips) + ' Chips';
}

function updateBetDisplay() {
    const totalBet = document.getElementById('total-bet');
    const playerBet = document.getElementById('player-total-bet');
    
    if (totalBet) totalBet.textContent = formatNumber(gameState.totalBet);
    if (playerBet) playerBet.textContent = formatNumber(gameState.totalBet);
}

function updateAvatar() {
    const avatar = document.getElementById('user-avatar');
    if (avatar && userData) {
        avatar.src = userData.profileImage || getDefaultAvatar(userData.username);
    }
}

function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00ff88&color=000&bold=true`;
}

function startBonusTimer() {
    let timeLeft = 600;
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const timer = document.getElementById('bonus-timer');
        if (timer) {
            timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            giveBonus();
            timeLeft = 600;
        } else {
            timeLeft--;
            setTimeout(updateTimer, 1000);
        }
    }
    
    updateTimer();
}

function giveBonus() {
    const bonus = 250;
    gameState.chips += bonus;
    updateChipsDisplay();
    
    // Save to database
    update(ref(database, `users/${currentUser.uid}`), {
        chips: gameState.chips,
        lastBonus: Date.now()
    }).catch(() => {});
    
    addChatMessage('System', `🎁 +${bonus} Bonus-Chips erhalten!`);
}

function updatePlayersList(players) {
    const container = document.getElementById('game-players');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(players).forEach(([uid, player]) => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player';
        
        const isCurrentUser = uid === currentUser.uid;
        
        playerElement.innerHTML = `
            <img src="${player.avatar || getDefaultAvatar(player.name)}" 
                 alt="${player.name}" class="player-avatar">
            <div class="player-details">
                <div class="player-name">
                    ${player.name} ${isCurrentUser ? '(Du)' : ''}
                </div>
                <div class="player-chips">${formatNumber(player.chips)} Chips</div>
                <div class="player-bet">Einsatz: <span>${formatNumber(player.totalBet || 0)}</span></div>
            </div>
        `;
        
        container.appendChild(playerElement);
    });
}

function updateChat(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    // Keep last 20 messages
    const recentMessages = messages.slice(-20);
    
    container.innerHTML = '';
    
    recentMessages.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${msg.userId === currentUser.uid ? 'own' : ''}`;
        
        const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${msg.username}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${msg.text}</div>
        `;
        
        container.appendChild(messageElement);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function addChatMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message system';
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${sender}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${text}</div>
    `;
    
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    if (!chatInput) return;
    
    const text = chatInput.value.trim();
    if (!text || text.length > 200) return;
    
    if (tableId === 'solo') {
        // Local chat for solo
        addChatMessage(userData.username, text);
    } else {
        // Save to database for multiplayer
        const chatRef = ref(database, `tables/${tableId}/chat`);
        await push(chatRef, {
            userId: currentUser.uid,
            username: userData.username,
            text: text,
            timestamp: Date.now()
        });
    }
    
    chatInput.value = '';
}

function setupEventListeners() {
    // Spin button
    if (spinBtn) {
        spinBtn.addEventListener('click', spinWheel);
    }
    
    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', clearBets);
    }
    
    // Chat send
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    // Chat input enter key
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    // Modal close
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('result-modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    // Close modal on background click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('result-modal');
        if (modal && e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Space to spin
        if (e.code === 'Space' && !gameState.isSpinning) {
            e.preventDefault();
            spinWheel();
        }
        
        // Escape to clear bets
        if (e.code === 'Escape') {
            clearBets();
        }
        
        // Number keys for chips
        if (e.code.startsWith('Digit')) {
            const num = parseInt(e.code.replace('Digit', ''));
            const chips = [10, 25, 50, 100, 500];
            if (num >= 1 && num <= 5) {
                selectChip(chips[num - 1]);
            }
        }
    });
}

// Make functions globally available
window.spinWheel = spinWheel;
window.clearBets = clearBets;