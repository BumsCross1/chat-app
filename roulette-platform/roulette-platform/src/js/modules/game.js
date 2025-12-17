// Importiere Firebase direkt (ohne ../)
import { 
    auth, database, onAuthStateChanged,
    ref, get, update, push
} from './firebase.js';

// Game State
let currentUser = null;
let userData = null;
let gameState = {
    chips: 1000,
    bets: {},
    totalBet: 0,
    isSpinning: false,
    winningNumber: null,
    selectedChip: 50,
    history: []
};

// Hilfsfunktionen
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('de-DE').format(num);
}

function getNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(parseInt(number)) ? 'red' : 'black';
}

function showNotification(message, type = 'info') {
    // Entferne existierende Notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Styling
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(0, 255, 136, 0.9)' : 
                    type === 'error' ? 'rgba(255, 68, 68, 0.9)' : 
                    'rgba(0, 168, 255, 0.9)'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        min-width: 200px;
    `;
    
    // Animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Auto remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Hauptinitialisierung
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        initGame();
        setupEventListeners();
        startBonusTimer();
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, `users/${currentUser.uid}`));
        if (snapshot.exists()) {
            userData = snapshot.val();
            gameState.chips = userData.chips || 1000;
            updateChipsDisplay();
            updateAvatar();
        }
    } catch (error) {
        console.log('Using default chips');
        gameState.chips = 1000;
        updateChipsDisplay();
    }
}

function initGame() {
    // Create wheel - FIXED!
    createWheel();
    
    // Create betting table - FIXED!
    createBettingTable();
    
    // Setup chips
    setupChips();
    
    // Initial UI update
    updateChipsDisplay();
    updateBetDisplay();
    
    // Load game history
    loadGameHistory();
}

function createWheel() {
    const wheelInner = document.getElementById('wheel-inner');
    if (!wheelInner) return;
    
    wheelInner.innerHTML = '';
    wheelInner.style.position = 'relative';
    wheelInner.style.width = '300px';
    wheelInner.style.height = '300px';
    
    // Europäische Roulette Zahlen in korrekter Reihenfolge
    const numbers = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 
        11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 
        22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    
    const radius = 120;
    const centerX = 150;
    const centerY = 150;
    
    numbers.forEach((number, index) => {
        const angle = (index * (360 / numbers.length)) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        const segment = document.createElement('div');
        segment.className = `wheel-segment ${getNumberColor(number)}`;
        segment.textContent = number;
        segment.dataset.number = number;
        
        // Positionierung FIXED!
        segment.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            transform: translate(-50%, -50%);
            z-index: 2;
            border: 2px solid white;
            font-size: 14px;
        `;
        
        // Farben FIXED!
        if (getNumberColor(number) === 'red') {
            segment.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
        } else if (getNumberColor(number) === 'black') {
            segment.style.background = 'linear-gradient(135deg, #333, #000)';
        } else {
            segment.style.background = 'linear-gradient(135deg, #00aa00, #008800)';
        }
        
        wheelInner.appendChild(segment);
    });
    
    // Center hinzufügen
    const center = document.createElement('div');
    center.className = 'wheel-center';
    center.textContent = '0';
    center.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: #1e1e1e;
        border: 5px solid #00ff88;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        color: #00ff88;
        z-index: 10;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    `;
    wheelInner.appendChild(center);
}

function createBettingTable() {
    const bettingTable = document.getElementById('betting-table');
    if (!bettingTable) return;
    
    bettingTable.innerHTML = '';
    
    // Main grid for numbers 1-36 - FIXED LAYOUT!
    const grid = document.createElement('div');
    grid.className = 'table-grid';
    grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        grid-template-rows: repeat(3, 1fr);
        gap: 2px;
        margin-bottom: 10px;
    `;
    
    // Zahlen 1-36 in korrekter Roulette-Anordnung
    // Roulette Layout: Bottom row = 1-12, Middle = 13-24, Top = 25-36
    for (let row = 2; row >= 0; row--) {
        for (let col = 0; col < 12; col++) {
            const number = (row * 12) + (col + 1);
            const cell = createNumberCell(number);
            grid.appendChild(cell);
        }
    }
    
    bettingTable.appendChild(grid);
    
    // Zero row
    const zeroRow = document.createElement('div');
    zeroRow.style.cssText = `
        display: flex;
        justify-content: center;
        margin-bottom: 10px;
    `;
    
    const zeroCell = createNumberCell(0);
    zeroCell.classList.add('zero');
    zeroCell.style.cssText = `
        width: 80px;
        height: 80px;
        font-size: 24px;
        margin: 0 auto;
    `;
    zeroRow.appendChild(zeroCell);
    bettingTable.appendChild(zeroRow);
    
    // Outside bets - FIXED!
    createOutsideBets(bettingTable);
}

function createNumberCell(number) {
    const cell = document.createElement('div');
    cell.className = `table-number ${getNumberColor(number)}`;
    cell.textContent = number;
    cell.dataset.number = number;
    cell.dataset.type = 'number';
    
    cell.style.cssText = `
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border-radius: 4px;
        cursor: pointer;
        position: relative;
        transition: all 0.2s;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        user-select: none;
    `;
    
    // Farben FIXED!
    if (getNumberColor(number) === 'red') {
        cell.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
    } else if (getNumberColor(number) === 'black') {
        cell.style.background = 'linear-gradient(135deg, #333, #000)';
    } else {
        cell.style.background = 'linear-gradient(135deg, #00aa00, #008800)';
    }
    
    cell.addEventListener('click', () => {
        placeBet(number.toString(), 'number', 35);
    });
    
    cell.addEventListener('mouseenter', () => {
        cell.style.transform = 'scale(1.05)';
        cell.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.3)';
    });
    
    cell.addEventListener('mouseleave', () => {
        cell.style.transform = 'scale(1)';
        cell.style.boxShadow = 'none';
    });
    
    // Chip area
    const chipArea = document.createElement('div');
    chipArea.className = 'chip-area';
    chipArea.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
    `;
    cell.appendChild(chipArea);
    
    return cell;
}

function createOutsideBets(container) {
    const outsideBets = document.createElement('div');
    outsideBets.className = 'outside-bets';
    outsideBets.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
        margin-top: 10px;
    `;
    
    const betGroups = [
        { label: '1-18', type: 'low', multiplier: 1, className: '' },
        { label: '19-36', type: 'high', multiplier: 1, className: '' },
        { label: 'ROT', type: 'red', multiplier: 1, className: 'red' },
        { label: 'SCHWARZ', type: 'black', multiplier: 1, className: 'black' },
        { label: 'GERADE', type: 'even', multiplier: 1, className: '' },
        { label: 'UNGERADE', type: 'odd', multiplier: 1, className: '' },
        { label: '1st 12', type: 'dozen1', multiplier: 2, className: '' },
        { label: '2nd 12', type: 'dozen2', multiplier: 2, className: '' },
        { label: '3rd 12', type: 'dozen3', multiplier: 2, className: '' }
    ];
    
    betGroups.forEach(bet => {
        const betElement = document.createElement('div');
        betElement.className = `outside-bet ${bet.className}`;
        betElement.textContent = bet.label;
        betElement.dataset.type = bet.type;
        betElement.dataset.multiplier = bet.multiplier;
        
        betElement.style.cssText = `
            padding: 15px 5px;
            text-align: center;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            user-select: none;
        `;
        
        // Farben FIXED!
        if (bet.className === 'red') {
            betElement.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)';
        } else if (bet.className === 'black') {
            betElement.style.background = 'linear-gradient(135deg, #333, #000)';
        } else {
            betElement.style.background = 'rgba(255, 255, 255, 0.1)';
        }
        
        betElement.addEventListener('click', () => {
            placeBet(bet.type, bet.type, bet.multiplier);
        });
        
        betElement.addEventListener('mouseenter', () => {
            betElement.style.transform = 'translateY(-2px)';
            betElement.style.boxShadow = '0 5px 10px rgba(0, 0, 0, 0.2)';
        });
        
        betElement.addEventListener('mouseleave', () => {
            betElement.style.transform = 'translateY(0)';
            betElement.style.boxShadow = 'none';
        });
        
        // Chip area
        const chipArea = document.createElement('div');
        chipArea.className = 'chip-area';
        chipArea.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            pointer-events: none;
        `;
        betElement.appendChild(chipArea);
        
        outsideBets.appendChild(betElement);
    });
    
    container.appendChild(outsideBets);
}

function setupChips() {
    const chipContainer = document.querySelector('.chip-values');
    if (!chipContainer) return;
    
    chipContainer.innerHTML = '';
    
    const chipValues = [10, 25, 50, 100, 500];
    
    chipValues.forEach(value => {
        const chipBtn = document.createElement('button');
        chipBtn.className = 'chip-btn';
        chipBtn.innerHTML = `
            <div class="chip chip-${value}" data-value="${value}">
                ${value}
            </div>
        `;
        
        chipBtn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            transition: transform 0.3s;
        `;
        
        chipBtn.addEventListener('click', () => selectChip(value));
        
        // Chip styling
        const chip = chipBtn.querySelector('.chip');
        chip.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: #000;
            border: 3px solid #fff;
            cursor: pointer;
            box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
            transition: all 0.3s;
        `;
        
        // Chip colors
        const chipColors = {
            10: 'radial-gradient(circle at 30% 30%, #fff, #ff4444)',
            25: 'radial-gradient(circle at 30% 30%, #fff, #00a8ff)',
            50: 'radial-gradient(circle at 30% 30%, #fff, #00ff88)',
            100: 'radial-gradient(circle at 30% 30%, #fff, #ffd700)',
            500: 'radial-gradient(circle at 30% 30%, #fff, #9b59b6)'
        };
        
        chip.style.background = chipColors[value] || chipColors[50];
        
        chipContainer.appendChild(chipBtn);
    });
    
    selectChip(50);
}

function selectChip(value) {
    gameState.selectedChip = value;
    
    // Update display
    const currentBet = document.getElementById('current-bet');
    if (currentBet) {
        currentBet.textContent = value;
    }
    
    // Highlight selected chip
    document.querySelectorAll('.chip').forEach(chip => {
        chip.classList.remove('selected');
        chip.style.transform = 'scale(1)';
        chip.style.boxShadow = '0 5px 10px rgba(0, 0, 0, 0.2)';
    });
    
    const selectedChip = document.querySelector(`.chip[data-value="${value}"]`);
    if (selectedChip) {
        selectedChip.classList.add('selected');
        selectedChip.style.transform = 'scale(1.2)';
        selectedChip.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.5)';
    }
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
            multiplier: multiplier,
            wins: 0
        };
    }
    
    // Update bet amount
    gameState.bets[betKey].amount += gameState.selectedChip;
    gameState.totalBet += gameState.selectedChip;
    gameState.chips -= gameState.selectedChip;
    
    // Update UI
    updateChipsDisplay();
    updateBetDisplay();
    
    // Show chip on table
    showChipOnTable(betValue, betType, gameState.selectedChip);
    
    // Notification
    const betLabel = getBetLabel(betValue, betType);
    showNotification(`${gameState.selectedChip} Chips auf ${betLabel} gesetzt`, 'info');
}

function getBetLabel(value, type) {
    const labels = {
        'number': `Zahl ${value}`,
        'red': 'Rot',
        'black': 'Schwarz',
        'even': 'Gerade',
        'odd': 'Ungerade',
        'low': '1-18',
        'high': '19-36',
        'dozen1': '1. Dutzend',
        'dozen2': '2. Dutzend',
        'dozen3': '3. Dutzend'
    };
    return labels[type] || value;
}

function showChipOnTable(betValue, betType, amount) {
    let selector;
    
    if (betType === 'number') {
        selector = `.table-number[data-number="${betValue}"]`;
    } else {
        selector = `.outside-bet[data-type="${betValue}"]`;
    }
    
    const betElement = document.querySelector(selector);
    if (!betElement) return;
    
    const chipArea = betElement.querySelector('.chip-area');
    if (!chipArea) return;
    
    // Check if chip already exists
    let chipElement = chipArea.querySelector(`[data-bet="${betValue}_${betType}"]`);
    
    if (!chipElement) {
        chipElement = document.createElement('div');
        chipElement.className = 'placed-chip';
        chipElement.dataset.bet = `${betValue}_${betType}`;
        chipElement.dataset.amount = amount;
        
        // Chip color based on amount
        let chipClass = 'chip-50';
        if (amount <= 10) chipClass = 'chip-10';
        else if (amount <= 25) chipClass = 'chip-25';
        else if (amount <= 100) chipClass = 'chip-100';
        else if (amount <= 500) chipClass = 'chip-500';
        
        chipElement.classList.add(chipClass);
        
        chipElement.style.cssText = `
            position: absolute;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: #000;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            z-index: 10;
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
            animation: chipDrop 0.3s ease-out forwards;
        `;
        
        // Chip color
        const chipColors = {
            'chip-10': 'radial-gradient(circle at 30% 30%, #fff, #ff4444)',
            'chip-25': 'radial-gradient(circle at 30% 30%, #fff, #00a8ff)',
            'chip-50': 'radial-gradient(circle at 30% 30%, #fff, #00ff88)',
            'chip-100': 'radial-gradient(circle at 30% 30%, #fff, #ffd700)',
            'chip-500': 'radial-gradient(circle at 30% 30%, #fff, #9b59b6)'
        };
        
        chipElement.style.background = chipColors[chipClass];
        
        chipArea.appendChild(chipElement);
    }
    
    // Update chip value
    const currentAmount = parseInt(chipElement.dataset.amount) || 0;
    const newAmount = currentAmount + amount;
    chipElement.dataset.amount = newAmount;
    chipElement.textContent = newAmount;
}

function spinWheel() {
    if (gameState.isSpinning) {
        showNotification('Bitte warten, das Rad dreht sich bereits!', 'warning');
        return;
    }
    
    if (gameState.totalBet === 0) {
        showNotification('Bitte zuerst Chips setzen!', 'warning');
        return;
    }
    
    gameState.isSpinning = true;
    const spinBtn = document.getElementById('spin-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    if (spinBtn) spinBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    
    // Generate winning number
    const winningNumber = Math.floor(Math.random() * 37);
    gameState.winningNumber = winningNumber;
    
    // Add chat message
    addChatMessage('System', '🎡 Das Rad dreht sich...');
    
    // Start animation
    startWheelAnimation(winningNumber);
    
    // Calculate result after animation
    setTimeout(async () => {
        const result = calculateResult();
        showResult(winningNumber, result);
        await saveGameResult(winningNumber, result);
        resetBets();
        
        // Enable controls after a delay
        setTimeout(() => {
            gameState.isSpinning = false;
            if (spinBtn) spinBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
        }, 3000);
    }, 4000);
}

function startWheelAnimation(winningNumber) {
    const wheelInner = document.getElementById('wheel-inner');
    if (!wheelInner) return;
    
    // Calculate total rotation
    const spins = 5;
    const numbers = 37;
    const anglePerNumber = 360 / numbers;
    
    // Find winning number's position
    const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 
                       11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 
                       22, 18, 29, 7, 28, 12, 35, 3, 26];
    
    const winningIndex = wheelOrder.indexOf(winningNumber);
    const targetAngle = (spins * 360) + (winningIndex * anglePerNumber);
    
    // Animate wheel
    wheelInner.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
    wheelInner.style.transform = `rotate(${-targetAngle}deg)`;
    
    // Animate ball
    const ball = document.getElementById('roulette-ball');
    if (ball) {
        ball.style.transition = 'all 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
        ball.style.transform = `rotate(${targetAngle * 0.8}deg) translate(120px)`;
    }
}

function calculateResult() {
    const winningNumber = gameState.winningNumber;
    const winningColor = getNumberColor(winningNumber);
    let totalWin = 0;
    const winningBets = [];
    
    // Check each bet
    Object.values(gameState.bets).forEach(bet => {
        if (checkBetWin(bet, winningNumber, winningColor)) {
            const winAmount = bet.amount * bet.multiplier;
            totalWin += winAmount;
            
            winningBets.push({
                bet: getBetLabel(bet.value, bet.type),
                amount: bet.amount,
                multiplier: bet.multiplier,
                win: winAmount
            });
        }
    });
    
    // Update chips
    if (totalWin > 0) {
        gameState.chips += totalWin;
    }
    
    return {
        totalWin,
        winningBets,
        winningNumber,
        winningColor
    };
}

function checkBetWin(bet, winningNumber, winningColor) {
    switch(bet.type) {
        case 'number':
            return parseInt(bet.value) === winningNumber;
        case 'red':
            return winningColor === 'red';
        case 'black':
            return winningColor === 'black';
        case 'even':
            return winningNumber !== 0 && winningNumber % 2 === 0;
        case 'odd':
            return winningNumber !== 0 && winningNumber % 2 === 1;
        case 'low':
            return winningNumber >= 1 && winningNumber <= 18;
        case 'high':
            return winningNumber >= 19 && winningNumber <= 36;
        case 'dozen1':
            return winningNumber >= 1 && winningNumber <= 12;
        case 'dozen2':
            return winningNumber >= 13 && winningNumber <= 24;
        case 'dozen3':
            return winningNumber >= 25 && winningNumber <= 36;
        default:
            return false;
    }
}

function showResult(winningNumber, result) {
    const modal = document.getElementById('result-modal');
    if (!modal) return;
    
    // Update content
    const resultNumber = document.getElementById('result-number');
    const resultColor = document.getElementById('result-color');
    const resultMessage = document.getElementById('result-message');
    const winAmountEl = document.getElementById('win-amount');
    
    if (resultNumber) {
        resultNumber.textContent = winningNumber;
        resultNumber.className = `result-number ${getNumberColor(winningNumber)}`;
    }
    
    if (resultColor) {
        const colorText = getNumberColor(winningNumber) === 'green' ? 'Grün' : 
                         getNumberColor(winningNumber) === 'red' ? 'Rot' : 'Schwarz';
        resultColor.textContent = colorText;
        resultColor.className = `result-color ${getNumberColor(winningNumber)}`;
    }
    
    if (winAmountEl) {
        winAmountEl.textContent = formatNumber(result.totalWin);
    }
    
    if (resultMessage) {
        if (result.totalWin > 0) {
            resultMessage.innerHTML = '<div class="win-message"><i class="fas fa-trophy"></i> Gewonnen!</div>';
            showNotification(`🎉 ${result.totalWin} Chips gewonnen!`, 'success');
            addChatMessage('System', `🎉 Gewonnen! Zahl: ${winningNumber} - ${result.totalWin} Chips`);
        } else {
            resultMessage.innerHTML = '<div class="lose-message"><i class="fas fa-times"></i> Verloren</div>';
            showNotification('😢 Kein Gewinn diesmal', 'warning');
            addChatMessage('System', `😢 Verloren! Zahl: ${winningNumber}`);
        }
    }
    
    // Update chips display
    updateChipsDisplay();
    
    // Add to history
    gameState.history.unshift({
        number: winningNumber,
        win: result.totalWin,
        time: new Date().toLocaleTimeString()
    });
    
    // Keep only last 50
    if (gameState.history.length > 50) {
        gameState.history = gameState.history.slice(0, 50);
    }
    
    updateHistoryDisplay();
    
    // Show modal
    modal.style.display = 'flex';
    
    // Auto close after 5 seconds
    setTimeout(() => {
        modal.style.display = 'none';
    }, 5000);
}

async function saveGameResult(winningNumber, result) {
    try {
        // Update user stats
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        const user = snapshot.val();
        
        const updates = {
            chips: gameState.chips,
            gamesPlayed: (user.gamesPlayed || 0) + 1,
            lastPlayed: Date.now()
        };
        
        if (result.totalWin > 0) {
            updates.gamesWon = (user.gamesWon || 0) + 1;
            updates.totalWinnings = (user.totalWinnings || 0) + result.totalWin;
            updates.winStreak = (user.winStreak || 0) + 1;
            
            if (result.totalWin > (user.highestWin || 0)) {
                updates.highestWin = result.totalWin;
            }
        } else {
            updates.winStreak = 0;
        }
        
        await update(userRef, updates);
        
        // Save game to history
        const gameData = {
            userId: currentUser.uid,
            winningNumber: winningNumber,
            bet: gameState.totalBet,
            win: result.totalWin,
            timestamp: Date.now(),
            mode: 'solo'
        };
        
        await push(ref(database, 'games'), gameData);
        
        // Update local user data
        userData = { ...userData, ...updates };
        
    } catch (error) {
        console.error('Error saving game result:', error);
    }
}

function resetBets() {
    gameState.bets = {};
    gameState.totalBet = 0;
    
    // Remove chips from table
    document.querySelectorAll('.chip-area').forEach(area => {
        area.innerHTML = '';
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
    resetBets();
    
    updateChipsDisplay();
    showNotification('Alle Einsätze zurückgenommen', 'info');
}

function updateChipsDisplay() {
    const playerChips = document.getElementById('player-chips');
    const sidebarChips = document.getElementById('sidebar-chips');
    
    if (playerChips) playerChips.textContent = formatNumber(gameState.chips);
    if (sidebarChips) sidebarChips.textContent = `${formatNumber(gameState.chips)} Chips`;
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
        avatar.src = userData.profileImage || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username || 'User')}&background=00ff88&color=000`;
    }
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
    if (userData) {
        update(ref(database, `users/${currentUser.uid}`), {
            chips: gameState.chips,
            lastBonus: Date.now()
        }).catch(() => {});
    }
    
    showNotification(`🎁 +${bonus} Bonus-Chips erhalten!`, 'success');
    addChatMessage('System', `🎁 +${bonus} Bonus-Chips für alle!`);
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

function loadGameHistory() {
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyContainer = document.getElementById('history-list');
    if (!historyContainer) return;
    
    historyContainer.innerHTML = '';
    
    // Show last 10 results
    const recentHistory = gameState.history.slice(0, 10);
    
    if (recentHistory.length === 0) {
        historyContainer.innerHTML = '<div class="no-history">Noch keine Spiele</div>';
        return;
    }
    
    recentHistory.forEach(game => {
        const historyItem = document.createElement('div');
        historyItem.className = `history-item ${getNumberColor(game.number)}`;
        
        historyItem.innerHTML = `
            <div class="history-number">${game.number}</div>
            <div class="history-win ${game.win > 0 ? 'win' : 'loss'}">
                ${game.win > 0 ? '+' : ''}${game.win}
            </div>
        `;
        
        historyContainer.appendChild(historyItem);
    });
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
    
    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', () => sendChatMessage());
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
        if (e.code === 'Escape' && !gameState.isSpinning) {
            clearBets();
        }
        
        // Number keys 1-5 for chips
        if (e.code.startsWith('Digit')) {
            const num = parseInt(e.code.replace('Digit', ''));
            const chips = [10, 25, 50, 100, 500];
            if (num >= 1 && num <= 5) {
                selectChip(chips[num - 1]);
            }
        }
    });
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const text = chatInput.value.trim();
    if (!text || text.length > 200) return;
    
    addChatMessage(userData?.username || 'Spieler', text);
    chatInput.value = '';
}

// Make functions globally available
window.spinWheel = spinWheel;
window.clearBets = clearBets;