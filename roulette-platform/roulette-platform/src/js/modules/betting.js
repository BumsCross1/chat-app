import gameEngine from '../core/game-engine.js';
import { CHIP_VALUES, BET_TYPES } from '../data/constants.js';
import { getNumberColor, formatNumber } from '../utils/helpers.js';
import { showNotification } from '../utils/notifications.js';

class BettingTable {
    constructor() {
        this.tableElement = null;
        this.outsideBetsElement = null;
        this.chipSelectorElement = null;
        this.selectedChip = 50;
        this.betChips = new Map(); // Map of betKey -> chip elements
        this.init();
    }

    init() {
        this.tableElement = document.getElementById('betting-table');
        this.outsideBetsElement = document.getElementById('outside-bets');
        this.chipSelectorElement = document.getElementById('chip-selector');
        
        if (this.tableElement) this.createTable();
        if (this.outsideBetsElement) this.createOutsideBets();
        if (this.chipSelectorElement) this.createChipSelector();
        
        this.setupEventListeners();
    }

    createTable() {
        // Clear existing table
        this.tableElement.innerHTML = '';
        
        // Create grid for numbers 1-36
        const grid = document.createElement('div');
        grid.className = 'table-grid';
        
        // European layout: bottom row = 1-12, middle = 13-24, top = 25-36
        for (let row = 2; row >= 0; row--) {
            for (let col = 0; col < 12; col++) {
                const number = (row * 12) + (col + 1);
                const cell = this.createNumberCell(number);
                grid.appendChild(cell);
            }
        }
        
        this.tableElement.appendChild(grid);
        
        // Zero row
        const zeroRow = document.createElement('div');
        zeroRow.style.cssText = `
            display: flex;
            justify-content: center;
            margin-top: 10px;
        `;
        
        const zeroCell = this.createNumberCell(0);
        zeroCell.classList.add('zero');
        zeroCell.style.cssText = `
            width: 80px;
            height: 80px;
            font-size: 24px;
        `;
        
        zeroRow.appendChild(zeroCell);
        this.tableElement.appendChild(zeroRow);
    }

    createNumberCell(number) {
        const cell = document.createElement('div');
        cell.className = `table-number ${getNumberColor(number)}`;
        cell.textContent = number;
        cell.dataset.number = number;
        cell.dataset.type = 'straight';
        
        // Create chip container
        const chipContainer = document.createElement('div');
        chipContainer.className = 'chip-container';
        chipContainer.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;
        
        cell.appendChild(chipContainer);
        
        // Click handler
        cell.addEventListener('click', () => {
            this.placeBet('straight', number.toString(), this.selectedChip);
        });
        
        // Hover effects
        cell.addEventListener('mouseenter', () => {
            if (!gameEngine.getGameState().isSpinning) {
                cell.style.transform = 'scale(1.05)';
                cell.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
            }
        });
        
        cell.addEventListener('mouseleave', () => {
            cell.style.transform = 'scale(1)';
            cell.style.boxShadow = 'none';
        });
        
        return cell;
    }

    createOutsideBets() {
        const outsideBets = [
            // Dozens
            { label: '1st 12', type: 'dozen', value: '1', className: '' },
            { label: '2nd 12', type: 'dozen', value: '2', className: '' },
            { label: '3rd 12', type: 'dozen', value: '3', className: '' },
            
            // Columns
            { label: '2:1', type: 'column', value: '1', className: '' },
            { label: '2:1', type: 'column', value: '2', className: '' },
            { label: '2:1', type: 'column', value: '3', className: '' },
            
            // 1-18 / 19-36
            { label: '1-18', type: 'low', value: 'low', className: '' },
            { label: '19-36', type: 'high', value: 'high', className: '' },
            
            // Even/Odd
            { label: 'EVEN', type: 'even', value: 'even', className: '' },
            { label: 'ODD', type: 'odd', value: 'odd', className: '' },
            
            // Red/Black
            { label: 'RED', type: 'red', value: 'red', className: 'red' },
            { label: 'BLACK', type: 'black', value: 'black', className: 'black' }
        ];
        
        outsideBets.forEach(bet => {
            const betElement = document.createElement('div');
            betElement.className = `outside-bet ${bet.className}`;
            betElement.textContent = bet.label;
            betElement.dataset.type = bet.type;
            betElement.dataset.value = bet.value;
            
            // Create chip container
            const chipContainer = document.createElement('div');
            chipContainer.className = 'chip-container';
            chipContainer.style.cssText = `
                position: absolute;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 5;
            `;
            
            betElement.appendChild(chipContainer);
            
            // Click handler
            betElement.addEventListener('click', () => {
                this.placeBet(bet.type, bet.value, this.selectedChip);
            });
            
            // Hover effects
            betElement.addEventListener('mouseenter', () => {
                if (!gameEngine.getGameState().isSpinning) {
                    betElement.style.transform = 'translateY(-2px)';
                    betElement.style.boxShadow = '0 5px 10px rgba(0, 0, 0, 0.2)';
                }
            });
            
            betElement.addEventListener('mouseleave', () => {
                betElement.style.transform = 'translateY(0)';
                betElement.style.boxShadow = 'none';
            });
            
            this.outsideBetsElement.appendChild(betElement);
        });
    }

    createChipSelector() {
        CHIP_VALUES.forEach(value => {
            const chipElement = document.createElement('div');
            chipElement.className = `chip chip-${value}`;
            chipElement.textContent = value;
            chipElement.dataset.value = value;
            
            if (value === this.selectedChip) {
                chipElement.classList.add('active');
            }
            
            chipElement.addEventListener('click', () => {
                this.selectChip(value);
            });
            
            this.chipSelectorElement.appendChild(chipElement);
        });
        
        // Quick bet buttons
        const quickButtons = document.querySelectorAll('.quick-btn');
        quickButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const betAmount = parseInt(e.target.dataset.bet);
                this.selectChip(betAmount);
                showNotification(`Chip auf ${formatNumber(betAmount)} gesetzt`, 'info');
            });
        });
    }

    selectChip(value) {
        this.selectedChip = value;
        
        // Update UI
        const chips = this.chipSelectorElement.querySelectorAll('.chip');
        chips.forEach(chip => {
            chip.classList.remove('active');
            if (parseInt(chip.dataset.value) === value) {
                chip.classList.add('active');
            }
        });
        
        // Update current chip display
        const currentChipElement = document.getElementById('current-chip');
        if (currentChipElement) {
            currentChipElement.textContent = formatNumber(value);
        }
    }

    placeBet(betType, betValue, amount) {
        if (gameEngine.getGameState().isSpinning) {
            showNotification('Während des Drehens nicht möglich', 'warning');
            return;
        }
        
        const success = gameEngine.placeBet(betType, betValue, amount);
        
        if (success) {
            this.addBetChip(betType, betValue, amount);
            this.updateBetDisplay();
            
            // Show notification
            const betLabel = this.getBetLabel(betType, betValue);
            showNotification(`${formatNumber(amount)} auf ${betLabel} gesetzt`, 'info');
        }
    }

    addBetChip(betType, betValue, amount) {
        const betKey = `${betType}_${betValue}`;
        let chipContainer;
        
        // Find the right container
        if (betType === 'straight') {
            const cell = this.tableElement.querySelector(`[data-number="${betValue}"]`);
            chipContainer = cell?.querySelector('.chip-container');
        } else {
            const betElement = this.outsideBetsElement.querySelector(`[data-type="${betType}"][data-value="${betValue}"]`);
            chipContainer = betElement?.querySelector('.chip-container');
        }
        
        if (!chipContainer) return;
        
        // Check if chip already exists
        let chipElement = this.betChips.get(betKey);
        
        if (!chipElement) {
            // Create new chip
            chipElement = document.createElement('div');
            chipElement.className = 'bet-chip';
            chipElement.dataset.betKey = betKey;
            
            // Set chip color based on amount
            let chipClass = 'chip-50';
            if (amount <= 10) chipClass = 'chip-10';
            else if (amount <= 25) chipClass = 'chip-25';
            else if (amount <= 100) chipClass = 'chip-100';
            else if (amount <= 500) chipClass = 'chip-500';
            else chipClass = 'chip-1000';
            
            chipElement.classList.add(chipClass);
            chipContainer.appendChild(chipElement);
            
            this.betChips.set(betKey, chipElement);
        }
        
        // Update chip amount display
        const currentAmount = parseInt(chipElement.textContent) || 0;
        const newAmount = currentAmount + amount;
        chipElement.textContent = newAmount > 999 ? '999+' : newAmount.toString();
        
        // Add scale animation
        chipElement.style.animation = 'none';
        setTimeout(() => {
            chipElement.style.animation = 'chip-drop 0.3s ease-out';
        }, 10);
    }

    removeBetChip(betKey) {
        const chipElement = this.betChips.get(betKey);
        if (chipElement) {
            chipElement.remove();
            this.betChips.delete(betKey);
        }
    }

    clearBetChips() {
        this.betChips.forEach(chip => chip.remove());
        this.betChips.clear();
    }

    updateBetDisplay() {
        const gameState = gameEngine.getGameState();
        const summary = gameEngine.getBetSummary();
        
        // Update total bet display
        const totalBetElement = document.getElementById('total-bet');
        if (totalBetElement) {
            totalBetElement.textContent = formatNumber(gameState.totalBet);
        }
        
        // Update potential win
        const potentialWinElement = document.getElementById('potential-win');
        if (potentialWinElement) {
            potentialWinElement.textContent = formatNumber(summary.potentialWin);
        }
        
        // Update chip balance
        const chipsElement = document.getElementById('game-chips');
        if (chipsElement) {
            chipsElement.textContent = formatNumber(gameEngine.getChips());
        }
    }

    getBetLabel(betType, betValue) {
        const labels = {
            'straight': `Zahl ${betValue}`,
            'split': `Split ${betValue}`,
            'street': `Street ${betValue}`,
            'corner': `Corner ${betValue}`,
            'line': `Line ${betValue}`,
            'dozen': `${betValue}. Dutzend`,
            'column': `${betValue}. Kolonne`,
            'red': 'Rot',
            'black': 'Schwarz',
            'even': 'Gerade',
            'odd': 'Ungerade',
            'low': '1-18',
            'high': '19-36'
        };
        
        return labels[betType] || betValue;
    }

    setupEventListeners() {
        // Right-click to remove bet
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            const chipElement = e.target.closest('.bet-chip');
            if (chipElement) {
                const betKey = chipElement.dataset.betKey;
                if (betKey) {
                    const returned = gameEngine.removeBet(betKey);
                    if (returned > 0) {
                        this.removeBetChip(betKey);
                        this.updateBetDisplay();
                        showNotification(`${formatNumber(returned)} Chips zurückerhalten`, 'info');
                    }
                }
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Number keys 1-6 for chips
            if (e.key >= '1' && e.key <= '6') {
                const index = parseInt(e.key) - 1;
                if (index < CHIP_VALUES.length) {
                    this.selectChip(CHIP_VALUES[index]);
                }
            }
            
            // Space to spin
            if (e.code === 'Space' && !gameEngine.getGameState().isSpinning) {
                e.preventDefault();
                document.getElementById('spin-btn')?.click();
            }
            
            // Escape to clear bets
            if (e.code === 'Escape') {
                document.getElementById('clear-btn')?.click();
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const bettingTable = new BettingTable();
    
    // Export for debugging
    window.bettingTable = bettingTable;
});

export default BettingTable;