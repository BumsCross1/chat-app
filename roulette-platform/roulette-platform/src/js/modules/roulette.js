import gameEngine from '../core/game-engine.js';
import { ROULETTE_NUMBERS, getNumberColor } from '../utils/helpers.js';
import { showNotification } from '../utils/notifications.js';

class RouletteWheel {
    constructor() {
        this.wheelElement = null;
        this.wheelInner = null;
        this.ballElement = null;
        this.isAnimating = false;
        this.rotation = 0;
        this.init();
    }

    init() {
        this.wheelElement = document.getElementById('roulette-wheel');
        this.wheelInner = document.getElementById('wheel-inner');
        this.ballElement = document.getElementById('roulette-ball');
        
        this.createWheel();
    }

    createWheel() {
        if (!this.wheelInner) return;

        this.wheelInner.innerHTML = '';
        
        const radius = 180;
        const centerX = 200;
        const centerY = 200;
        const totalNumbers = ROULETTE_NUMBERS.length;
        const angleStep = (2 * Math.PI) / totalNumbers;

        ROULETTE_NUMBERS.forEach((number, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const numberElement = document.createElement('div');
            numberElement.className = `wheel-number ${getNumberColor(number)}`;
            numberElement.textContent = number;
            numberElement.dataset.number = number;

            // Position calculation
            const rotation = (index * (360 / totalNumbers));
            numberElement.style.transform = `rotate(${rotation}deg) translate(${radius}px) rotate(-${rotation}deg)`;
            numberElement.style.position = 'absolute';
            numberElement.style.left = '0';
            numberElement.style.top = '0';
            numberElement.style.transformOrigin = 'center center';

            this.wheelInner.appendChild(numberElement);
        });
    }

    spin(winningNumber) {
        if (this.isAnimating) return Promise.reject('Wheel is already spinning');

        return new Promise((resolve) => {
            this.isAnimating = true;
            
            // Calculate total rotation (5 full spins + offset to winning number)
            const totalNumbers = ROULETTE_NUMBERS.length;
            const winningIndex = ROULETTE_NUMBERS.indexOf(winningNumber);
            const targetRotation = 1800 + (winningIndex * (360 / totalNumbers));
            
            // Animate wheel
            this.wheelInner.style.transition = 'transform 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
            this.wheelInner.style.transform = `rotate(${-targetRotation}deg)`;
            
            // Animate ball
            this.ballElement.style.transition = 'all 4s cubic-bezier(0.1, 0.8, 0.2, 1)';
            
            // Calculate ball path
            const ballRotation = targetRotation * 0.8;
            const ballDistance = 170;
            this.ballElement.style.transform = `rotate(${ballRotation}deg) translate(${ballDistance}px)`;
            
            // After animation completes
            setTimeout(() => {
                this.isAnimating = false;
                resolve();
            }, 4000);
        });
    }

    reset() {
        this.wheelInner.style.transition = 'none';
        this.wheelInner.style.transform = 'rotate(0deg)';
        
        this.ballElement.style.transition = 'none';
        this.ballElement.style.transform = 'rotate(0deg) translate(0px)';
        
        // Force reflow
        void this.wheelInner.offsetWidth;
        void this.ballElement.offsetWidth;
    }

    highlightNumber(number) {
        const numberElement = this.wheelInner.querySelector(`[data-number="${number}"]`);
        if (numberElement) {
            // Add highlight class
            numberElement.classList.add('highlight');
            
            // Remove highlight after delay
            setTimeout(() => {
                numberElement.classList.remove('highlight');
            }, 3000);
        }
    }
}

class ResultDisplay {
    constructor() {
        this.modal = null;
        this.init();
    }

    init() {
        this.modal = document.getElementById('result-modal');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const closeBtn = document.getElementById('close-modal');
        const continueBtn = document.getElementById('continue-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.hide());
        }

        // Close modal on background click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.hide();
                }
            });
        }
    }

    show(winningNumber, result) {
        if (!this.modal) return;

        const numberElement = document.getElementById('result-number');
        const colorElement = document.getElementById('result-color');
        const messageElement = document.getElementById('result-message');
        const betElement = document.getElementById('result-bet');
        const winElement = document.getElementById('result-win');
        const balanceElement = document.getElementById('result-balance');

        if (numberElement) {
            numberElement.textContent = winningNumber;
            numberElement.className = `result-number ${getNumberColor(winningNumber)}`;
        }

        if (colorElement) {
            const colorText = getNumberColor(winningNumber) === 'green' ? 'Grün' : 
                            getNumberColor(winningNumber) === 'red' ? 'Rot' : 'Schwarz';
            colorElement.textContent = colorText;
            colorElement.className = `result-color ${getNumberColor(winningNumber)}`;
        }

        if (betElement) {
            betElement.textContent = formatNumber(result.bet || 0);
        }

        if (winElement) {
            winElement.textContent = formatNumber(result.totalWin || 0);
            winElement.className = result.totalWin > 0 ? 'profit-positive' : 'profit-negative';
        }

        if (balanceElement) {
            balanceElement.textContent = formatNumber(gameEngine.getChips());
        }

        if (messageElement) {
            if (result.totalWin > 0) {
                messageElement.innerHTML = `
                    <div class="win-message">
                        <i class="fas fa-trophy"></i>
                        <span>Gewonnen! +${formatNumber(result.totalWin)} Chips</span>
                    </div>
                `;
                showNotification(`🎉 ${result.totalWin} Chips gewonnen!`, 'success');
            } else {
                messageElement.innerHTML = `
                    <div class="lose-message">
                        <i class="fas fa-times"></i>
                        <span>Kein Gewinn diesmal</span>
                    </div>
                `;
                showNotification('😢 Kein Gewinn diesmal', 'warning');
            }
        }

        this.modal.classList.add('active');
    }

    hide() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    }
}

// Utility function for formatting numbers
function formatNumber(num) {
    return new Intl.NumberFormat('de-DE').format(num || 0);
}

// Initialize components when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const rouletteWheel = new RouletteWheel();
    const resultDisplay = new ResultDisplay();

    // Spin button
    const spinBtn = document.getElementById('spin-btn');
    if (spinBtn) {
        spinBtn.addEventListener('click', async () => {
            if (gameEngine.getGameState().isSpinning) {
                showNotification('Das Rad dreht sich bereits!', 'warning');
                return;
            }

            // Start spin animation with random number
            const winningNumber = gameEngine.spin();
            if (!winningNumber) return;

            // Disable controls
            spinBtn.disabled = true;
            
            try {
                // Start wheel animation
                await rouletteWheel.spin(winningNumber);
                
                // Process result
                const result = await gameEngine.processResult(winningNumber);
                
                // Show result
                resultDisplay.show(winningNumber, {
                    ...result,
                    bet: gameEngine.getGameState().totalBet
                });
                
                // Highlight winning number
                rouletteWheel.highlightNumber(winningNumber);
                
            } catch (error) {
                console.error('Spin error:', error);
                showNotification('Fehler beim Drehen', 'error');
            } finally {
                // Re-enable controls
                spinBtn.disabled = false;
            }
        });
    }

    // Clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const returned = gameEngine.clearBets();
            if (returned > 0) {
                showNotification(`${formatNumber(returned)} Chips zurückerhalten`, 'info');
            }
        });
    }

    // Double button (Martingale system)
    const doubleBtn = document.getElementById('double-btn');
    if (doubleBtn) {
        doubleBtn.addEventListener('click', () => {
            const bets = Array.from(gameEngine.getGameState().bets.values());
            if (bets.length === 0) {
                showNotification('Keine Einsätze zum Verdoppeln', 'warning');
                return;
            }

            const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
            const newBet = totalBet * 2;

            if (newBet > gameEngine.getChips()) {
                showNotification('Nicht genug Chips zum Verdoppeln', 'error');
                return;
            }

            // Clear existing bets
            gameEngine.clearBets();
            
            // Place doubled bets
            bets.forEach(bet => {
                gameEngine.placeBet(bet.type, bet.value, bet.amount * 2);
            });

            showNotification(`Einsätze verdoppelt auf ${formatNumber(newBet)} Chips`, 'info');
        });
    }

    // Update UI with game state
    function updateGameUI() {
        const gameState = gameEngine.getGameState();
        
        // Update chip display
        const chipsElement = document.getElementById('game-chips');
        if (chipsElement) {
            chipsElement.textContent = formatNumber(gameEngine.getChips());
        }
        
        // Update total bet display
        const totalBetElement = document.getElementById('total-bet');
        if (totalBetElement) {
            totalBetElement.textContent = formatNumber(gameState.totalBet);
        }
        
        // Update potential win
        const potentialWinElement = document.getElementById('potential-win');
        if (potentialWinElement) {
            const summary = gameEngine.getBetSummary();
            potentialWinElement.textContent = formatNumber(summary.potentialWin);
        }
        
        // Update game status
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            if (gameState.isSpinning) {
                statusElement.innerHTML = '<i class="fas fa-sync fa-spin"></i><span>Rad dreht sich...</span>';
            } else {
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i><span>Bereit zum Setzen</span>';
            }
        }
    }

    // Update UI every second
    setInterval(updateGameUI, 1000);
    updateGameUI(); // Initial update

    // Export for debugging
    window.rouletteWheel = rouletteWheel;
    window.resultDisplay = resultDisplay;
});

export { RouletteWheel, ResultDisplay };