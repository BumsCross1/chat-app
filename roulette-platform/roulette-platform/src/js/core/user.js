import {
    auth,
    database,
    signOut,
    onAuthStateChanged,
    ref,
    get,
    update,
    onValue,
    query,
    orderByChild,
    limitToLast
} from '../config/firebase.js';
import { showNotification } from '../utils/notifications.js';

class UserManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.bonusInterval = null;
        this.listeners = [];
        this.init();
    }

    init() {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                if (!window.location.pathname.includes('index.html')) {
                    window.location.href = '/index.html';
                }
                return;
            }

            this.currentUser = user;
            await this.loadUserData();
            this.setupEventListeners();
            this.startBonusTimer();
            this.setupRealTimeListeners();
            this.checkDailyBonus();
        });
    }

    async loadUserData() {
        try {
            const snapshot = await get(ref(database, `users/${this.currentUser.uid}`));
            
            if (snapshot.exists()) {
                this.userData = snapshot.val();
                this.updateUI();
                this.updateOnlineStatus(true);
            } else {
                await this.createNewUser();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Fehler beim Laden der Benutzerdaten', 'error');
        }
    }

    async createNewUser() {
        const username = this.currentUser.email?.split('@')[0] || 'Spieler';
        const userData = {
            uid: this.currentUser.uid,
            username: username,
            email: this.currentUser.email,
            chips: 10000,
            level: 1,
            xp: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            totalWinnings: 0,
            totalLosses: 0,
            winStreak: 0,
            highestWin: 0,
            profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4CAF50&color=fff&size=256`,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            lastBonus: null,
            lastDailyBonus: null,
            isOnline: true,
            role: 'user'
        };

        await Promise.all([
            set(ref(database, `users/${this.currentUser.uid}`), userData),
            set(ref(database, `usernames/${username.toLowerCase()}`), {
                uid: this.currentUser.uid,
                createdAt: Date.now()
            })
        ]);

        this.userData = userData;
        this.updateUI();
        showNotification('Willkommen bei Premium Roulette!', 'success');
    }

    updateUI() {
        if (!this.userData) return;

        // Update user info
        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        updateElement('username', this.userData.username);
        updateElement('welcome-name', this.userData.username);
        updateElement('user-chips', this.formatNumber(this.userData.chips) + ' Chips');
        updateElement('total-chips', this.formatNumber(this.userData.chips));

        // Update avatar
        const avatar = document.getElementById('user-avatar');
        if (avatar && this.userData.profileImage) {
            avatar.src = this.userData.profileImage;
        }

        // Update statistics
        this.updateStatistics();
    }

    updateStatistics() {
        if (!this.userData) return;

        const gamesPlayed = this.userData.gamesPlayed || 0;
        const gamesWon = this.userData.gamesWon || 0;
        const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        updateElement('games-won', gamesWon);
        updateElement('win-rate', `${winRate}%`);
        updateElement('win-streak', this.userData.winStreak || 0);

        // Update rank
        this.updateUserRank();
    }

    async updateUserRank() {
        try {
            const usersSnapshot = await get(ref(database, 'users'));
            if (!usersSnapshot.exists()) return;

            const users = [];
            usersSnapshot.forEach(child => {
                const user = child.val();
                if (user.chips !== undefined) {
                    users.push({
                        uid: child.key,
                        chips: user.chips || 0
                    });
                }
            });

            users.sort((a, b) => b.chips - a.chips);
            const rank = users.findIndex(user => user.uid === this.currentUser.uid) + 1;
            
            const rankElement = document.getElementById('user-rank');
            if (rankElement) {
                rankElement.textContent = `#${rank}`;
            }
        } catch (error) {
            console.error('Error updating rank:', error);
        }
    }

    formatNumber(num) {
        return new Intl.NumberFormat('de-DE').format(num || 0);
    }

    async updateOnlineStatus(isOnline) {
        try {
            await update(ref(database, `users/${this.currentUser.uid}`), {
                isOnline: isOnline,
                lastSeen: isOnline ? null : Date.now()
            });
        } catch (error) {
            console.error('Error updating online status:', error);
        }
    }

    startBonusTimer() {
        if (this.bonusInterval) clearInterval(this.bonusInterval);

        let timeLeft = 600; // 10 minutes
        const timerElement = document.getElementById('bonus-timer');

        const updateTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;

            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            if (timeLeft <= 0) {
                this.grantBonusChips();
                timeLeft = 600;
            } else {
                timeLeft--;
                setTimeout(updateTimer, 1000);
            }
        };

        updateTimer();
    }

    async grantBonusChips() {
        try {
            const bonusAmount = 250;
            const newChips = (this.userData.chips || 0) + bonusAmount;
            
            this.userData.chips = newChips;
            this.updateUI();

            await update(ref(database, `users/${this.currentUser.uid}`), {
                chips: newChips,
                lastBonus: Date.now()
            });

            showNotification(`🎁 +${bonusAmount} Bonus-Chips erhalten!`, 'success');

            // Log transaction
            await push(ref(database, 'transactions'), {
                userId: this.currentUser.uid,
                type: 'bonus',
                amount: bonusAmount,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Error granting bonus:', error);
            showNotification('Fehler beim Bonus', 'error');
        }
    }

    checkDailyBonus() {
        const dailyBonusBtn = document.getElementById('daily-bonus-btn');
        if (!dailyBonusBtn || !this.userData) return;

        const today = new Date().toDateString();
        const lastBonus = this.userData.lastDailyBonus ? 
            new Date(this.userData.lastDailyBonus).toDateString() : null;

        if (lastBonus === today) {
            dailyBonusBtn.disabled = true;
            dailyBonusBtn.innerHTML = '<i class="fas fa-check-circle"></i> Bereits abgeholt';
            dailyBonusBtn.classList.add('disabled');
        }
    }

    async claimDailyBonus() {
        try {
            const today = new Date().toDateString();
            const lastBonus = this.userData.lastDailyBonus;

            if (lastBonus && new Date(lastBonus).toDateString() === today) {
                showNotification('Täglicher Bonus bereits abgeholt!', 'warning');
                return;
            }

            const bonusAmount = 1000;
            const newChips = (this.userData.chips || 0) + bonusAmount;
            
            this.userData.chips = newChips;
            this.userData.lastDailyBonus = Date.now();
            
            this.updateUI();

            const dailyBonusBtn = document.getElementById('daily-bonus-btn');
            if (dailyBonusBtn) {
                dailyBonusBtn.disabled = true;
                dailyBonusBtn.innerHTML = '<i class="fas fa-check-circle"></i> Abgeholt';
                dailyBonusBtn.classList.add('disabled');
            }

            await update(ref(database, `users/${this.currentUser.uid}`), {
                chips: newChips,
                lastDailyBonus: Date.now()
            });

            showNotification(`🎉 Täglicher Bonus: ${bonusAmount} Chips!`, 'success');

            await push(ref(database, 'transactions'), {
                userId: this.currentUser.uid,
                type: 'daily_bonus',
                amount: bonusAmount,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Error claiming daily bonus:', error);
            showNotification('Fehler beim Abholen des Bonus', 'error');
        }
    }

    setupRealTimeListeners() {
        // Listen for top players
        const topPlayersQuery = query(ref(database, 'users'), orderByChild('chips'), limitToLast(10));
        const topPlayersListener = onValue(topPlayersQuery, (snapshot) => {
            this.updateTopPlayers(snapshot);
        });
        this.listeners.push(topPlayersListener);

        // Listen for recent games
        const gamesQuery = query(ref(database, 'games'), orderByChild('timestamp'), limitToLast(10));
        const gamesListener = onValue(gamesQuery, (snapshot) => {
            this.updateRecentGames(snapshot);
        });
        this.listeners.push(gamesListener);
    }

    updateTopPlayers(snapshot) {
        const container = document.getElementById('top-players');
        if (!container) return;

        container.innerHTML = '';

        if (!snapshot.exists()) {
            container.innerHTML = '<div class="loading">Keine Spieler gefunden</div>';
            return;
        }

        const players = [];
        snapshot.forEach(child => {
            const player = child.val();
            if (player && player.username && player.chips !== undefined) {
                players.push({ id: child.key, ...player });
            }
        });

        // Sort by chips (descending)
        players.sort((a, b) => b.chips - a.chips);

        if (players.length === 0) {
            container.innerHTML = '<div class="loading">Keine Spieler gefunden</div>';
            return;
        }

        players.forEach((player, index) => {
            const playerRow = document.createElement('div');
            playerRow.className = 'player-row';

            const rank = index + 1;
            const rankClass = `rank-${rank <= 3 ? rank : 'other'}`;

            playerRow.innerHTML = `
                <div class="player-rank ${rankClass}">${rank}</div>
                <img src="${player.profileImage || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(player.username)}&background=4CAF50&color=fff`}" 
                     alt="${player.username}" class="player-avatar-small">
                <div class="player-info">
                    <div class="player-name">
                        ${player.username}
                        ${player.id === this.currentUser?.uid ? ' (Du)' : ''}
                    </div>
                    <div class="player-chips">${this.formatNumber(player.chips)} Chips</div>
                </div>
            `;

            container.appendChild(playerRow);
        });
    }

    updateRecentGames(snapshot) {
        const container = document.getElementById('recent-games');
        if (!container) return;

        container.innerHTML = '';

        if (!snapshot.exists()) {
            container.innerHTML = '<div class="loading">Noch keine Spiele</div>';
            return;
        }

        const games = [];
        snapshot.forEach(child => {
            const game = child.val();
            if (game.userId === this.currentUser?.uid) {
                games.push(game);
            }
        });

        if (games.length === 0) {
            container.innerHTML = '<div class="loading">Noch keine Spiele</div>';
            return;
        }

        // Sort by timestamp (newest first)
        games.sort((a, b) => b.timestamp - a.timestamp);

        games.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'game-item';

            const profit = game.win || 0;
            const profitClass = profit > 0 ? 'positive' : profit < 0 ? 'negative' : '';
            const color = this.getNumberColor(game.winningNumber);
            const colorText = color === 'red' ? 'Rot' : color === 'black' ? 'Schwarz' : 'Grün';

            gameItem.innerHTML = `
                <div class="game-details">
                    <div class="game-number">${game.winningNumber}</div>
                    <div class="game-color ${color}">${colorText}</div>
                </div>
                <div class="game-result">
                    <div class="game-profit ${profitClass}">
                        ${profit > 0 ? '+' : ''}${this.formatNumber(profit)} Chips
                    </div>
                    <div class="game-time">${this.formatTime(game.timestamp)}</div>
                </div>
            `;

            container.appendChild(gameItem);
        });
    }

    getNumberColor(number) {
        if (number === 0) return 'green';
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        return redNumbers.includes(parseInt(number)) ? 'red' : 'black';
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Gerade eben';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
        
        return new Date(timestamp).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setupEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Wirklich abmelden?')) {
                    // Clean up listeners
                    this.listeners.forEach(listener => listener());
                    if (this.bonusInterval) clearInterval(this.bonusInterval);
                    
                    // Set offline
                    await this.updateOnlineStatus(false);
                    
                    await signOut(auth);
                    window.location.href = '/index.html';
                }
            });
        }

        // Daily Bonus
        const dailyBonusBtn = document.getElementById('daily-bonus-btn');
        if (dailyBonusBtn) {
            dailyBonusBtn.addEventListener('click', () => this.claimDailyBonus());
        }
    }
}

// Initialize user manager
const userManager = new UserManager();

// Global function for daily bonus
window.claimDailyBonus = () => userManager.claimDailyBonus();