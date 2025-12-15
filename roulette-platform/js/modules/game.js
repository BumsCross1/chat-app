// /js/modules/game.js
import { auth, db, currentUser, userData, doc, getDoc, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs, addDoc, onSnapshot, serverTimestamp } from '../config/firebase.js';

let gameState = {
    currentBets: {},
    totalBetAmount: 0,
    isSpinning: false,
    winningNumber: null,
    userChips: 10000
};

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        initializeGame();
        setupEventListeners();
    });
});

async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
            gameState.userChips = userData.chips || 10000;
            updateChipsDisplay();
        }
    } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
    }
}

function initializeGame() {
    createWheel();
    createBettingTable();
    setupChipControls();
    updateChipsDisplay();
    
    // Bonus Timer starten
    startBonusTimer();
}

function createWheel() {
    const wheelInner = document.querySelector('.wheel-inner');
    if (!wheelInner) return;
    
    const numbers = [
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
        24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    
    wheelInner.innerHTML = '';
    const totalNumbers = numbers.length;
    const angleStep = 360 / totalNumbers;
    
    for (let i = 0; i < totalNumbers; i++) {
        const number = numbers[i];
        const segment = document.createElement('div');
        segment.className = `wheel-segment ${getNumberColor(number)}`;
        segment.dataset.number = number;
        
        const angle = i * angleStep;
        segment.style.transform = `rotate(${angle}deg) translateX(140px) rotate(-${angle}deg)`;
        
        const numberSpan = document.createElement('span');
        numberSpan.className = 'wheel-number';
        numberSpan.textContent = number;
        segment.appendChild(numberSpan);
        
        wheelInner.appendChild(segment);
    }
    
    const center = document.createElement('div');
    center.className = 'wheel-center';
    center.innerHTML = '<i class="fas fa-dice"></i>';
    wheelInner.appendChild(center);
}

function createBettingTable() {
    const bettingTable = document.getElementById('betting-table');
    if (!bettingTable) return;
    
    bettingTable.innerHTML = '';
    
    // Europäisches Layout
    const layout = [
        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
    ];
    
    const tableGrid = document.createElement('div');
    tableGrid.className = 'table-grid';
    
    // Null-Feld
    const zeroCell = createTableCell(0, 'green', 'zero');
    zeroCell.style.gridRow = '1 / span 3';
    tableGrid.appendChild(zeroCell);
    
    // Zahlen-Felder
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 12; col++) {
            const number = layout[row][col];
            const cell = createTableCell(number, getNumberColor(number));
            cell.style.gridRow = row + 1;
            cell.style.gridColumn = col + 2;
            tableGrid.appendChild(cell);
        }
    }
    
    bettingTable.appendChild(tableGrid);
    createOutsideBets();
}

function createTableCell(number, color, extraClass = '') {
    const cell = document.createElement('div');
    cell.className = `table-number ${color} ${extraClass}`;
    cell.dataset.number = number;
    cell.dataset.type = 'straight';
    cell.textContent = number;
    
    cell.addEventListener('click', () => placeBet({
        type: 'straight',
        value: number.toString(),
        multiplier: 35
    }));
    
    const chipArea = document.createElement('div');
    chipArea.className = 'chip-area';
    chipArea.dataset.betId = `number-${number}`;
    cell.appendChild(chipArea);
    
    return cell;
}

function createOutsideBets() {
    const outsideBets = document.createElement('div');
    outsideBets.className = 'outside-bets';
    
    const betRows = [
        { class: '', bets: ['1-18', 'Even', 'Red', 'Black', 'Odd', '19-36'] },
        { class: 'column', bets: ['2:1', '2:1', '2:1'] }
    ];
    
    betRows.forEach((row, rowIndex) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `outside-bet-row ${row.class}`;
        
        row.bets.forEach((bet, index) => {
            const betCell = document.createElement('div');
            betCell.className = 'outside-bet';
            betCell.textContent = bet;
            
            if (bet === 'Red') betCell.classList.add('red');
            if (bet === 'Black') betCell.classList.add('black');
            
            // Bet-Info basierend auf Text
            let betInfo = {};
            if (bet === '1-18') betInfo = { type: 'lowhigh', value: '1-18', multiplier: 1 };
            else if (bet === '19-36') betInfo = { type: 'lowhigh', value: '19-36', multiplier: 1 };
            else if (bet === 'Even') betInfo = { type: 'evenodd', value: 'even', multiplier: 1 };
            else if (bet === 'Odd') betInfo = { type: 'evenodd', value: 'odd', multiplier: 1 };
            else if (bet === 'Red') betInfo = { type: 'color', value: 'red', multiplier: 1 };
            else if (bet === 'Black') betInfo = { type: 'color', value: 'black', multiplier: 1 };
            else if (bet === '2:1') betInfo = { type: 'column', value: ['1st', '2nd', '3rd'][index], multiplier: 2 };
            
            betCell.addEventListener('click', () => placeBet(betInfo));
            
            const chipArea = document.createElement('div');
            chipArea.className = 'chip-area';
            chipArea.dataset.betId = `${betInfo.type}-${betInfo.value}`;
            betCell.appendChild(chipArea);
            
            rowDiv.appendChild(betCell);
        });
        
        outsideBets.appendChild(rowDiv);
    });
    
    document.getElementById('betting-table').appendChild(outsideBets);
}

function setupChipControls() {
    const chipControls = document.querySelector('.chip-values');
    if (!chipControls) return;
    
    const chipValues = [10, 25, 50, 100, 500];
    
    chipControls.innerHTML = '';
    chipValues.forEach(value => {
        const chipBtn = document.createElement('button');
        chipBtn.className = 'chip-btn';
        chipBtn.dataset.value = value;
        
        const chip = document.createElement('div');
        chip.className = `chip chip-${value}`;
        chip.textContent = value;
        
        chipBtn.appendChild(chip);
        chipBtn.addEventListener('click', () => setBetAmount(value));
        
        chipControls.appendChild(chipBtn);
    });
}

function setBetAmount(amount) {
    const currentBetElement = document.getElementById('current-bet');
    if (currentBetElement) {
        currentBetElement.textContent = formatNumber(amount);
    }
    
    // Chip-Highlighting
    document.querySelectorAll('.chip-btn').forEach(btn => {
        const chip = btn.querySelector('.chip');
        if (parseInt(btn.dataset.value) === amount) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });
}

function placeBet(betInfo) {
    const currentBetElement = document.getElementById('current-bet');
    const currentBetAmount = parseInt(currentBetElement?.textContent.replace(/\./g, '') || '0');
    
    if (currentBetAmount === 0) {
        showNotification('Wähle zuerst einen Einsatz', 'warning');
        return;
    }
    
    if (gameState.isSpinning) {
        showNotification('Das Rad dreht sich bereits!', 'warning');
        return;
    }
    
    if (currentBetAmount > gameState.userChips) {
        showNotification('Nicht genügend Chips', 'error');
        return;
    }
    
    const betId = `${betInfo.type}-${betInfo.value}`;
    
    if (!gameState.currentBets[betId]) {
        gameState.currentBets[betId] = {
            amount: 0,
            multiplier: betInfo.multiplier,
            type: betInfo.type,
            value: betInfo.value
        };
    }
    
    gameState.currentBets[betId].amount += currentBetAmount;
    gameState.totalBetAmount += currentBetAmount;
    gameState.userChips -= currentBetAmount;
    
    updateChipsDisplay();
    updateTotalBetDisplay();
    placeChipVisual(betId, gameState.currentBets[betId].amount);
    
    showNotification(`${currentBetAmount} Chips gesetzt`, 'success');
}

function placeChipVisual(betId, amount) {
    const chipArea = document.querySelector(`[data-bet-id="${betId}"]`);
    if (!chipArea) return;
    
    const chip = document.createElement('div');
    chip.className = 'placed-chip';
    chip.dataset.value = amount;
    chip.style.backgroundColor = getChipColor(amount);
    
    const chipValue = document.createElement('span');
    chipValue.className = 'chip-value';
    chipValue.textContent = amount;
    chip.appendChild(chipValue);
    
    const x = Math.random() * 70 + 15;
    const y = Math.random() * 70 + 15;
    chip.style.left = `${x}%`;
    chip.style.top = `${y}%`;
    
    chipArea.appendChild(chip);
}

function getChipColor(amount) {
    const colors = {
        10: '#ff4444',
        25: '#00a8ff',
        50: '#00ff88',
        100: '#ffd700',
        500: '#9b59b6'
    };
    return colors[amount] || '#ffffff';
}

function updateChipsDisplay() {
    const chipsElement = document.getElementById('player-chips');
    if (chipsElement) {
        chipsElement.textContent = formatNumber(gameState.userChips);
    }
}

function updateTotalBetDisplay() {
    const totalBetElement = document.getElementById('total-bet');
    if (totalBetElement) {
        totalBetElement.textContent = formatNumber(gameState.totalBetAmount);
    }
}

function spinWheel() {
    if (gameState.isSpinning) {
        showNotification('Das Rad dreht sich bereits', 'warning');
        return;
    }
    
    if (gameState.totalBetAmount === 0) {
        showNotification('Bitte zuerst Einsätze platzieren', 'warning');
        return;
    }
    
    gameState.isSpinning = true;
    
    const spinBtn = document.getElementById('spin-btn');
    const clearBtn = document.getElementById('clear-btn');
    if (spinBtn) spinBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    
    // Gewinnzahl generieren
    const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
        24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    gameState.winningNumber = numbers[Math.floor(Math.random() * numbers.length)];
    
    // Animation
    const wheelInner = document.querySelector('.wheel-inner');
    const ball = document.getElementById('roulette-ball');
    
    if (wheelInner && ball) {
        const numberIndex = numbers.indexOf(gameState.winningNumber);
        const anglePerNumber = 360 / numbers.length;
        const targetRotation = 360 * 5 + (numberIndex * anglePerNumber);
        
        wheelInner.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
        wheelInner.style.transform = `rotate(${targetRotation}deg)`;
        
        ball.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
        ball.style.transform = `translate(-50%, -50%) rotate(-${targetRotation}deg)`;
    }
    
    // Chat-Nachricht
    addChatMessage({
        userId: 'system',
        username: 'System',
        text: 'Das Rad dreht sich...',
        timestamp: Date.now()
    });
    
    // Ergebnis berechnen nach Animation
    setTimeout(() => {
        calculateResults();
    }, 5000);
}

function calculateResults() {
    const winningColor = getNumberColor(gameState.winningNumber);
    let totalWin = 0;
    let winningBets = [];
    
    // Gewinne berechnen
    Object.entries(gameState.currentBets).forEach(([betId, bet]) => {
        if (checkBetWin(bet, gameState.winningNumber, winningColor)) {
            const winAmount = bet.amount * bet.multiplier;
            totalWin += winAmount;
            winningBets.push({
                bet: bet,
                winAmount: winAmount
            });
            gameState.userChips += winAmount;
        }
    });
    
    // Ursprüngliche Einsätze zurückgeben
    gameState.userChips += gameState.totalBetAmount;
    
    // Chips in Firebase aktualisieren
    updateUserChipsInFirebase();
    
    // Ergebnis anzeigen
    showResults(totalWin, winningBets);
    
    // Zurücksetzen
    gameState.isSpinning = false;
    gameState.currentBets = {};
    gameState.totalBetAmount = 0;
    
    const spinBtn = document.getElementById('spin-btn');
    const clearBtn = document.getElementById('clear-btn');
    if (spinBtn) spinBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    
    // Visuelle Chips entfernen
    document.querySelectorAll('.placed-chip').forEach(chip => chip.remove());
    
    updateChipsDisplay();
    updateTotalBetDisplay();
}

function checkBetWin(bet, winningNumber, winningColor) {
    switch (bet.type) {
        case 'straight':
            return parseInt(bet.value) === winningNumber;
        case 'color':
            return bet.value === winningColor;
        case 'evenodd':
            if (winningNumber === 0) return false;
            return bet.value === 'even' ? winningNumber % 2 === 0 : winningNumber % 2 === 1;
        case 'lowhigh':
            if (winningNumber === 0) return false;
            return bet.value === '1-18' ? winningNumber <= 18 : winningNumber >= 19;
        case 'column':
            const columnMap = { '1st': [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
                              '2nd': [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
                              '3rd': [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36] };
            return columnMap[bet.value]?.includes(winningNumber);
        default:
            return false;
    }
}

function getNumberColor(number) {
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return number === 0 ? 'green' : redNumbers.includes(number) ? 'red' : 'black';
}

function showResults(totalWin, winningBets) {
    const modal = document.getElementById('result-modal');
    const resultNumber = document.getElementById('result-number');
    const resultColor = document.getElementById('result-color');
    const winAmount = document.getElementById('win-amount');
    const resultMessage = document.getElementById('result-message');
    
    if (resultNumber) {
        resultNumber.textContent = gameState.winningNumber;
        resultNumber.className = `result-number ${getNumberColor(gameState.winningNumber)}`;
    }
    
    if (resultColor) {
        const colorText = getNumberColor(gameState.winningNumber) === 'green' ? 'Grün' : 
                         getNumberColor(gameState.winningNumber) === 'red' ? 'Rot' : 'Schwarz';
        resultColor.textContent = colorText;
        resultColor.className = `result-color ${getNumberColor(gameState.winningNumber)}`;
    }
    
    if (winAmount) {
        winAmount.textContent = formatNumber(totalWin);
    }
    
    if (resultMessage) {
        if (totalWin > 0) {
            resultMessage.innerHTML = `
                <div class="win-message">
                    <i class="fas fa-trophy"></i>
                    <span>Gewonnen!</span>
                </div>
                <div class="win-details">
                    ${winningBets.map(bet => `
                        <div class="win-bet">
                            Gewinn: ${formatNumber(bet.winAmount)} Chips
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            resultMessage.innerHTML = `
                <div class="lose-message">
                    <i class="fas fa-times"></i>
                    <span>Kein Gewinn</span>
                </div>
            `;
        }
    }
    
    if (modal) {
        modal.style.display = 'flex';
    }
    
    // Chat-Nachricht
    const resultMessageText = totalWin > 0 ? 
        `Gewinnzahl: ${gameState.winningNumber} - Gewonnen ${formatNumber(totalWin)} Chips! 🎉` :
        `Gewinnzahl: ${gameState.winningNumber} - Kein Gewinn`;
    
    addChatMessage({
        userId: 'system',
        username: 'System',
        text: resultMessageText,
        timestamp: Date.now()
    });
}

async function updateUserChipsInFirebase() {
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            chips: gameState.userChips,
            lastPlayed: Date.now()
        });
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Chips:', error);
    }
}

function startBonusTimer() {
    let timeLeft = 600;
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const bonusTimer = document.getElementById('bonus-timer');
        if (bonusTimer) {
            bonusTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            grantBonusChips();
            timeLeft = 600;
        } else {
            timeLeft--;
            setTimeout(updateTimer, 1000);
        }
    }
    
    updateTimer();
}

async function grantBonusChips() {
    try {
        const bonusAmount = 250;
        gameState.userChips += bonusAmount;
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            chips: gameState.userChips,
            lastBonusTime: Date.now()
        });
        
        updateChipsDisplay();
        showNotification(`+${bonusAmount} Bonus-Chips erhalten!`, 'success');
        
        addChatMessage({
            userId: 'system',
            username: 'System',
            text: `Bonus erhalten: +${bonusAmount} Chips!`,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Fehler beim Bonus:', error);
    }
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.userId === currentUser?.uid ? 'own' : ''}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageElement.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${message.username}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${message.text}</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupEventListeners() {
    // Spin Button
    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) {
        spinBtn.addEventListener('click', spinWheel);
    }
    
    // Clear Button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllBets);
    }
    
    // Chat
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    // Modal schließen
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('result-modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
}

function clearAllBets() {
    if (gameState.isSpinning) {
        showNotification('Kann während des Drehens nicht löschen', 'warning');
        return;
    }
    
    gameState.userChips += gameState.totalBetAmount;
    gameState.currentBets = {};
    gameState.totalBetAmount = 0;
    
    document.querySelectorAll('.placed-chip').forEach(chip => chip.remove());
    updateChipsDisplay();
    updateTotalBetDisplay();
    
    showNotification('Alle Einsätze gelöscht', 'info');
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const text = chatInput.value.trim();
    if (!text) return;
    
    addChatMessage({
        userId: currentUser?.uid || 'user',
        username: userData?.username || 'Spieler',
        text: text,
        timestamp: Date.now()
    });
    
    chatInput.value = '';
}

// Globale Funktionen
window.spinWheel = spinWheel;
window.clearAllBets = clearAllBets;
window.sendChatMessage = sendChatMessage;
window.setBetAmount = setBetAmount;
window.placeBet = placeBet;