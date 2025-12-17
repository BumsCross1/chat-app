import { 
    auth,
    database,
    ref,
    get,
    update,
    push,
    onValue,
    off
} from '../config/firebase.js';
import { ROULETTE_NUMBERS, RED_NUMBERS, BET_TYPES } from '../data/constants.js';
import { getNumberColor, formatNumber } from '../utils/helpers.js';
import { showNotification } from '../utils/notifications.js';

class GameEngine {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.gameState = {
            isSpinning: false,
            winningNumber: null,
            selectedChip: 50,
            bets: new Map(),
            totalBet: 0,
            history: [],
            statistics: {
                totalGames: 0,
                totalWon: 0,
                totalLost: 0,
                winStreak: 0,
                highestWin: 0
            }
        };
        
        this.wheelNumbers = ROULETTE_NUMBERS;
        this.init();
    }

    async init() {
        // Wait for auth
        return new Promise((resolve) => {
            const unsubscribe = onValue(ref(database, '.info/connected'), async (snapshot) => {
                if (snapshot.val() === true) {
                    this.currentUser = auth.currentUser;
                    if (this.currentUser) {
                        await this.loadUserData();
                        await this.loadGameHistory();
                        resolve();
                    }
                }
            });
        });
    }

    async loadUserData() {
        try {
            const snapshot = await get(ref(database, `users/${this.currentUser.uid}`));
            if (snapshot.exists()) {
                this.userData = snapshot.val();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Fehler beim Laden der Benutzerdaten', 'error');
        }
    }

    async loadGameHistory() {
        try {
            const snapshot = await get(ref(database, `games/${this.currentUser.uid}`));
            if (snapshot.exists()) {
                this.gameState.history = Object.values(snapshot.val());
                this.updateStatistics();
            }
        } catch (error) {
            console.error('Error loading game history:', error);
        }
    }

    updateStatistics() {
        const stats = {
            totalGames: this.gameState.history.length,
            totalWon: 0,
            totalLost: 0,
            winStreak: 0,
            currentStreak: 0,
            highestWin: 0
        };

        this.gameState.history.forEach(game => {
            if (game.win > 0) {
                stats.totalWon += game.win;
                stats.currentStreak++;
                stats.winStreak = Math.max(stats.winStreak, stats.currentStreak);
                stats.highestWin = Math.max(stats.highestWin, game.win);
            } else {
                stats.totalLost += Math.abs(game.win);
                stats.currentStreak = 0;
            }
        });

        this.gameState.statistics = stats;
    }

    placeBet(betType, betValue, amount) {
        if (this.gameState.isSpinning) {
            showNotification('Das Rad dreht sich bereits!', 'warning');
            return false;
        }

        if (amount > (this.userData?.chips || 0)) {
            showNotification('Nicht genug Chips!', 'error');
            return false;
        }

        const betKey = `${betType}_${betValue}`;
        const existingBet = this.gameState.bets.get(betKey);

        if (existingBet) {
            existingBet.amount += amount;
        } else {
            this.gameState.bets.set(betKey, {
                type: betType,
                value: betValue,
                amount: amount,
                multiplier: this.getMultiplier(betType),
                placedAt: Date.now()
            });
        }

        this.gameState.totalBet += amount;
        
        if (this.userData) {
            this.userData.chips -= amount;
        }

        return true;
    }

    removeBet(betKey) {
        const bet = this.gameState.bets.get(betKey);
        if (bet) {
            this.gameState.totalBet -= bet.amount;
            
            if (this.userData) {
                this.userData.chips += bet.amount;
            }
            
            this.gameState.bets.delete(betKey);
            return bet.amount;
        }
        return 0;
    }

    clearBets() {
        if (this.gameState.isSpinning) {
            showNotification('Während des Drehens nicht möglich', 'warning');
            return false;
        }

        const totalReturned = Array.from(this.gameState.bets.values())
            .reduce((sum, bet) => sum + bet.amount, 0);

        if (this.userData) {
            this.userData.chips += totalReturned;
        }

        this.gameState.bets.clear();
        this.gameState.totalBet = 0;

        return totalReturned;
    }

    getMultiplier(betType) {
        const multipliers = {
            'straight': 35,    // Einfache Chance
            'split': 17,       // Geteilt
            'street': 11,      // Straße
            'corner': 8,       // Ecke
            'line': 5,         // Linie
            'dozen': 2,        // Dutzend
            'column': 2,       // Kolonne
            'red': 1,          // Rot
            'black': 1,        // Schwarz
            'even': 1,         // Gerade
            'odd': 1,          // Ungerade
            'low': 1,          // 1-18
            'high': 1          // 19-36
        };

        return multipliers[betType] || 1;
    }

    calculateWin(bet, winningNumber) {
        if (!this.isWinningBet(bet, winningNumber)) {
            return 0;
        }

        return bet.amount * bet.multiplier;
    }

    isWinningBet(bet, winningNumber) {
        const number = parseInt(winningNumber);
        const betValue = bet.value;

        switch (bet.type) {
            case 'straight':
                return parseInt(betValue) === number;

            case 'split':
                const splitNumbers = betValue.split(',').map(n => parseInt(n));
                return splitNumbers.includes(number);

            case 'street':
                const streetStart = parseInt(betValue);
                return number >= streetStart && number <= streetStart + 2;

            case 'dozen':
                const dozen = parseInt(betValue);
                if (dozen === 1) return number >= 1 && number <= 12;
                if (dozen === 2) return number >= 13 && number <= 24;
                if (dozen === 3) return number >= 25 && number <= 36;
                return false;

            case 'column':
                const column = parseInt(betValue);
                const columnNumbers = [
                    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
                    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
                    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
                ];
                return columnNumbers[column - 1]?.includes(number) || false;

            case 'red':
                return RED_NUMBERS.includes(number);

            case 'black':
                return number !== 0 && !RED_NUMBERS.includes(number);

            case 'even':
                return number !== 0 && number % 2 === 0;

            case 'odd':
                return number !== 0 && number % 2 === 1;

            case 'low':
                return number >= 1 && number <= 18;

            case 'high':
                return number >= 19 && number <= 36;

            default:
                return false;
        }
    }

    spin() {
        if (this.gameState.isSpinning) {
            showNotification('Das Rad dreht sich bereits!', 'warning');
            return null;
        }

        if (this.gameState.bets.size === 0) {
            showNotification('Bitte zuerst Chips setzen!', 'warning');
            return null;
        }

        this.gameState.isSpinning = true;
        
        // Generate random winning number (0-36)
        const winningNumber = Math.floor(Math.random() * 37);
        this.gameState.winningNumber = winningNumber;

        return winningNumber;
    }

    async processResult(winningNumber) {
        let totalWin = 0;
        const winningBets = [];

        // Calculate wins for each bet
        for (const [key, bet] of this.gameState.bets) {
            const win = this.calculateWin(bet, winningNumber);
            
            if (win > 0) {
                totalWin += win;
                winningBets.push({
                    ...bet,
                    win: win
                });
            }
        }

        // Update chips
        if (this.userData) {
            this.userData.chips += totalWin;
        }

        // Save game result
        await this.saveGameResult(winningNumber, totalWin);

        // Clear bets for next round
        this.gameState.bets.clear();
        this.gameState.totalBet = 0;
        this.gameState.isSpinning = false;

        return {
            winningNumber,
            totalWin,
            winningBets,
            color: getNumberColor(winningNumber)
        };
    }

    async saveGameResult(winningNumber, winAmount) {
        try {
            const gameData = {
                userId: this.currentUser.uid,
                winningNumber,
                bet: this.gameState.totalBet,
                win: winAmount,
                timestamp: Date.now(),
                mode: 'solo'
            };

            // Save to games history
            await push(ref(database, `games/${this.currentUser.uid}`), gameData);

            // Update user statistics
            const updates = {
                chips: this.userData.chips,
                gamesPlayed: (this.userData.gamesPlayed || 0) + 1,
                lastPlayed: Date.now()
            };

            if (winAmount > 0) {
                updates.gamesWon = (this.userData.gamesWon || 0) + 1;
                updates.totalWinnings = (this.userData.totalWinnings || 0) + winAmount;
                updates.winStreak = (this.userData.winStreak || 0) + 1;
                
                if (winAmount > (this.userData.highestWin || 0)) {
                    updates.highestWin = winAmount;
                }
            } else {
                updates.winStreak = 0;
            }

            await update(ref(database, `users/${this.currentUser.uid}`), updates);

            // Update local user data
            Object.assign(this.userData, updates);

            // Add to local history
            this.gameState.history.unshift(gameData);
            this.updateStatistics();

            return true;
        } catch (error) {
            console.error('Error saving game result:', error);
            showNotification('Fehler beim Speichern des Spielergebnisses', 'error');
            return false;
        }
    }

    getBetSummary() {
        const summary = {
            totalBet: this.gameState.totalBet,
            totalBets: this.gameState.bets.size,
            potentialWin: 0
        };

        // Calculate maximum potential win
        for (const bet of this.gameState.bets.values()) {
            summary.potentialWin += bet.amount * bet.multiplier;
        }

        return summary;
    }

    getHistory() {
        return this.gameState.history.slice(0, 20); // Last 20 games
    }

    getStatistics() {
        return this.gameState.statistics;
    }

    updateSelectedChip(value) {
        this.gameState.selectedChip = value;
        return value;
    }

    getSelectedChip() {
        return this.gameState.selectedChip;
    }

    getChips() {
        return this.userData?.chips || 0;
    }

    getUserData() {
        return this.userData;
    }

    getGameState() {
        return {
            ...this.gameState,
            chips: this.getChips(),
            userData: this.userData
        };
    }

    resetGame() {
        this.gameState.bets.clear();
        this.gameState.totalBet = 0;
        this.gameState.isSpinning = false;
        this.gameState.winningNumber = null;
        
        // Return chips to user
        const totalBets = Array.from(this.gameState.bets.values())
            .reduce((sum, bet) => sum + bet.amount, 0);
            
        if (this.userData && totalBets > 0) {
            this.userData.chips += totalBets;
        }
    }
}

// Export singleton instance
const gameEngine = new GameEngine();
export default gameEngine;