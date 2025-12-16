import { 
    auth, database, onAuthStateChanged,
    ref, get, update, set, push
} from '../config/firebase.js';

// Game State
let currentUser = null;
let userData = null;
let gameState = {
    bets: [],
    totalBet: 0,
    isSpinning: false,
    winningNumber: null,
    chips: 1000,
    selectedChip: 50
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        setupGame();
        startBonusTimer();
        setupEventListeners();
    });
});

async function loadUserData() {
    try {
        const userRef = ref(database, 'users/' + currentUser.uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            userData = snapshot.val();
            gameState.chips = userData.chips || 1000;
            updateChipsDisplay();
        } else {
            // Create user if doesn't exist
            const defaultData = {
                username: currentUser.email.split('@')[0],
                chips: 1000,
                createdAt: Date.now()
            };
            await set(userRef, defaultData);
            userData = defaultData;
        }
    } catch (error) {
        console.log('Offline mode - using local chips');
        gameState.chips = 1000;
        updateChipsDisplay();
    }
}

function setupGame() {
    createWheel();
    createBettingTable();
    setupChips();
    updateChipsDisplay();
}

function createWheel() {
    const wheel = document.getElementById('roulette-wheel');
    if (!wheel) return;
    
    wheel.innerHTML = '';
    
    const wheelInner = document.createElement('div');
    wheelInner.className = 'wheel-inner';
    
    // Roulette numbers in order (European)
    const numbers = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
        24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    
    numbers.forEach((num, index) => {
        const segment = document.createElement('div');
        segment.className = `wheel-segment ${getNumberColor(num)}`;
        segment.textContent = num;
        segment.style.transform = `rotate(${index * (360 / numbers.length)}deg)`;
        wheelInner.appendChild(segment);
    });
    
    wheel.appendChild(wheelInner);
    
    // Add ball
    const ball = document.createElement('div');
    ball.className = 'ball';
    ball.id = 'roulette-ball';
    wheel.appendChild(ball);
}

function createBettingTable() {
    const table = document.getElementById('betting-table');
    if (!table) return;
    
    table.innerHTML = '';
    
    // Create main number grid
    const grid = document.createElement('div');
    grid.className = 'number-grid';
    
    // Add zero
    const zero = createNumberCell(0);
    grid.appendChild(zero);
    
    // Add numbers 1-36
    for (let i = 1; i <= 36; i++) {
        const cell = createNumberCell(i);
        grid.appendChild(cell);
    }
    
    table.appendChild(grid);
    
    // Add outside bets
    createOutsideBets(table);
}

function createNumberCell(number) {
    const cell = document.createElement('div');
    cell.className = `number-cell ${getNumberColor(number)}`;
    cell.textContent = number;
    cell.dataset.number = number;
    
    cell.addEventListener('click', () => {
        placeBet(number, 'number', 35);
    });
    
    return cell;
}

function createOutsideBets(container) {
    const outside = document.createElement('div');
    outside.className = 'outside-bets';
    
    // Dozens
    const dozens = ['1-12', '13-24', '25-36'];
    dozens.forEach(dozen => {
        const bet = document.createElement('div');
        bet.className = 'outside-bet';
        bet.textContent = dozen;
        bet.dataset.bet = dozen;
        bet.addEventListener('click', () => {
            placeBet(dozen, 'dozen', 2);
        });
        outside.appendChild(bet);
    });
    
    // Even/Odd
    ['EVEN', 'ODD'].forEach(type => {
        const bet = document.createElement('div');
        bet.className = 'outside-bet';
        bet.textContent = type;
        bet.dataset.bet = type;
        bet.addEventListener('click', () => {
            placeBet(type, 'evenodd', 1);
        });
        outside.appendChild(bet);
    });
    
    // Red/Black
    ['RED', 'BLACK'].forEach(color => {
        const bet = document.createElement('div');
        bet.className = `outside-bet ${color.toLowerCase()}`;
        bet.textContent = color;
        bet.dataset.bet = color;
        bet.addEventListener('click', () => {
            placeBet(color, 'color', 1);
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
    
    // Select default chip
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

function placeBet(value, type, multiplier) {
    if (gameState.isSpinning) {
        alert('Das Rad dreht sich bereits!');
        return;
    }
    
    if (gameState.selectedChip > gameState.chips) {
        alert('Nicht genug Chips!');
        return;
    }
    
    // Add bet
    gameState.bets.push({
        value: value,
        type: type,
        chip: gameState.selectedChip,
        multiplier: multiplier
    });
    
    gameState.totalBet += gameState.selectedChip;
    gameState.chips -= gameState.selectedChip;
    
    updateChipsDisplay();
    updateBetDisplay();
    
    // Visual feedback
    showChipOnTable(value);
}

function showChipOnTable(betValue) {
    // Find the bet element
    let betElement;
    
    if (typeof betValue === 'number') {
        betElement = document.querySelector(`[data-number="${betValue}"]`);
    } else {
        betElement = document.querySelector(`[data-bet="${betValue}"]`);
    }
    
    if (betElement) {
        const chip = document.createElement('div');
        chip.className = `placed-chip chip-${gameState.selectedChip}`;
        chip.textContent = gameState.selectedChip;
        
        // Random position
        const x = Math.random() * 60 + 20;
        const y = Math.random() * 60 + 20;
        chip.style.left = `${x}%`;
        chip.style.top = `${y}%`;
        
        betElement.appendChild(chip);
    }
}

function spinWheel() {
    if (gameState.isSpinning) {
        alert('Bitte warten...');
        return;
    }
    
    if (gameState.bets.length === 0) {
        alert('Bitte zuerst setzen!');
        return;
    }
    
    gameState.isSpinning = true;
    
    // Disable buttons
    const spinBtn = document.getElementById('spin-btn');
    const clearBtn = document.getElementById('clear-btn');
    if (spinBtn) spinBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    
    // Generate winning number
    gameState.winningNumber = Math.floor(Math.random() * 37);
    
    // Animate wheel
    animateWheel();
    
    // Show result after animation
    setTimeout(() => {
        calculateResult();
        gameState.isSpinning = false;
        
        // Re-enable buttons
        if (spinBtn) spinBtn.disabled = false;
        if (clearBtn) clearBtn.disabled = false;
    }, 4000);
}

function animateWheel() {
    const wheelInner = document.querySelector('.wheel-inner');
    const ball = document.getElementById('roulette-ball');
    
    if (!wheelInner || !ball) return;
    
    // Calculate spins (5 full rotations + random)
    const spins = 5;
    const randomOffset = Math.random() * 360;
    const totalRotation = spins * 360 + randomOffset;
    
    // Animate
    wheelInner.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
    wheelInner.style.transform = `rotate(${totalRotation}deg)`;
    
    // Add chat message
    addChatMessage('System', 'Das Rad dreht sich...');
}

function calculateResult() {
    const winningColor = getNumberColor(gameState.winningNumber);
    let winAmount = 0;
    
    // Check each bet
    gameState.bets.forEach(bet => {
        if (checkBetWin(bet, gameState.winningNumber, winningColor)) {
            winAmount += bet.chip * bet.multiplier;
        }
    });
    
    // Add winnings to chips
    if (winAmount > 0) {
        gameState.chips += winAmount + gameState.totalBet; // Return bet + winnings
    }
    
    // Save to database
    saveGameResult(winAmount);
    
    // Show result
    showResult(winAmount);
    
    // Clear bets for next round
    gameState.bets = [];
    gameState.totalBet = 0;
    
    // Remove visual chips
    document.querySelectorAll('.placed-chip').forEach(chip => {
        chip.remove();
    });
    
    updateChipsDisplay();
    updateBetDisplay();
    
    // Add chat message
    const resultMsg = winAmount > 0 
        ? `🏆 Gewinn: ${gameState.winningNumber} (${winningColor}) - ${winAmount} Chips gewonnen!`
        : `💸 Gewinn: ${gameState.winningNumber} (${winningColor}) - Kein Gewinn`;
    
    addChatMessage('System', resultMsg);
}

function checkBetWin(bet, winningNumber, winningColor) {
    switch(bet.type) {
        case 'number':
            return bet.value === winningNumber;
        case 'color':
            return bet.value.toLowerCase() === winningColor;
        case 'evenodd':
            if (winningNumber === 0) return false;
            if (bet.value === 'EVEN') return winningNumber % 2 === 0;
            return winningNumber % 2 === 1;
        case 'dozen':
            const range = bet.value.split('-').map(Number);
            return winningNumber >= range[0] && winningNumber <= range[1];
        default:
            return false;
    }
}

function getNumberColor(number) {
    if (number === 0) return 'green';
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
}

function showResult(winAmount) {
    const modal = document.getElementById('result-modal');
    if (!modal) return;
    
    const winningColor = getNumberColor(gameState.winningNumber);
    
    document.getElementById('result-number').textContent = gameState.winningNumber;
    document.getElementById('result-number').className = `result-number ${winningColor}`;
    
    const colorText = winningColor === 'green' ? 'Grün' : 
                     winningColor === 'red' ? 'Rot' : 'Schwarz';
    document.getElementById('result-color').textContent = colorText;
    
    document.getElementById('win-amount').textContent = winAmount;
    
    const message = document.getElementById('result-message');
    if (winAmount > 0) {
        message.innerHTML = `<div style="color:#00ff88; font-size:1.2em;">🎉 Gewonnen!</div>`;
    } else {
        message.innerHTML = `<div style="color:#ff4444;">Kein Gewinn</div>`;
    }
    
    modal.style.display = 'flex';
}

async function saveGameResult(winAmount) {
    try {
        // Update user chips
        await update(ref(database, 'users/' + currentUser.uid), {
            chips: gameState.chips,
            gamesPlayed: (userData.gamesPlayed || 0) + 1,
            gamesWon: winAmount > 0 ? (userData.gamesWon || 0) + 1 : (userData.gamesWon || 0),
            lastPlayed: Date.now()
        });
        
        // Save game history
        await push(ref(database, 'games'), {
            userId: currentUser.uid,
            winningNumber: gameState.winningNumber,
            bets: gameState.totalBet,
            win: winAmount,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.log('Game result not saved (offline)');
    }
}

function updateChipsDisplay() {
    const chipsElement = document.getElementById('player-chips');
    const sidebarChips = document.getElementById('sidebar-chips');
    
    if (chipsElement) chipsElement.textContent = gameState.chips;
    if (sidebarChips) sidebarChips.textContent = gameState.chips + ' Chips';
}

function updateBetDisplay() {
    const totalBet = document.getElementById('total-bet');
    const playerBet = document.getElementById('player-total-bet');
    
    if (totalBet) totalBet.textContent = gameState.totalBet;
    if (playerBet) playerBet.textContent = gameState.totalBet;
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
    if (currentUser) {
        update(ref(database, 'users/' + currentUser.uid), {
            chips: gameState.chips,
            lastBonus: Date.now()
        }).catch(() => {});
    }
    
    addChatMessage('System', `🎁 +${bonus} Bonus-Chips erhalten!`);
}

function addChatMessage(sender, text) {
    const chat = document.getElementById('chat-messages');
    if (!chat) return;
    
    const message = document.createElement('div');
    message.className = 'message';
    
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    message.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${sender}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${text}</div>
    `;
    
    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
}

function setupEventListeners() {
    // Spin button
    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) {
        spinBtn.addEventListener('click', spinWheel);
    }
    
    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearBets);
    }
    
    // Chat send
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChat);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChat();
        });
    }
    
    // Modal close
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('result-modal');
            if (modal) modal.style.display = 'none';
        });
    });
}

function clearBets() {
    if (gameState.isSpinning) {
        alert('Während des Drehens nicht möglich');
        return;
    }
    
    // Return chips
    gameState.chips += gameState.totalBet;
    gameState.bets = [];
    gameState.totalBet = 0;
    
    // Remove chips from table
    document.querySelectorAll('.placed-chip').forEach(chip => {
        chip.remove();
    });
    
    updateChipsDisplay();
    updateBetDisplay();
}

function sendChat() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    addChatMessage(userData.username || 'Spieler', text);
    input.value = '';
}

// Make functions available globally
window.spinWheel = spinWheel;
window.clearBets = clearBets;
window.sendChat = sendChat;