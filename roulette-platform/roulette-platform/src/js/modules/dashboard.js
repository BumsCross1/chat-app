import { 
    auth, database, onAuthStateChanged, signOut,
    ref, get, update, push, query, orderByChild, limitToLast, onValue, off
} from '../../config/firebase.js';
import { formatNumber, showNotification, formatTime } from '../../utils.js';

class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.bonusInterval = null;
        this.listeners = [];
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                
                this.currentUser = user;
                await this.loadUserData();
                this.setupEventListeners();
                this.setupRealTimeListeners();
                this.startBonusTimer();
                this.checkDailyBonus();
            });
        });
    }
    
    async loadUserData() {
        try {
            const snapshot = await get(ref(database, 'users/' + this.currentUser.uid));
            
            if (snapshot.exists()) {
                this.userData = snapshot.val();
                this.updateUI();
                this.updateStats();
            } else {
                await this.createNewUser();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Fehler beim Laden der Daten', 'error');
        }
    }
    
    async createNewUser() {
        const defaultData = {
            uid: this.currentUser.uid,
            username: this.currentUser.email?.split('@')[0] || 'Spieler',
            email: this.currentUser.email,
            chips: 10000,
            level: 1,
            xp: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            totalWinnings: 0,
            totalLosses: 0,
            friendCount: 0,
            profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.email?.split('@')[0] || 'User')}&background=00ff88&color=000&size=256`,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            lastDailyBonus: null,
            lastBonusTime: Date.now(),
            winStreak: 0,
            highestWin: 0,
            achievements: [],
            isOnline: true,
            role: 'user'
        };
        
        await set(ref(database, 'users/' + this.currentUser.uid), defaultData);
        
        // Save username reference
        await set(ref(database, `usernames/${defaultData.username.toLowerCase()}`), {
            uid: this.currentUser.uid,
            createdAt: Date.now()
        });
        
        this.userData = defaultData;
        this.updateUI();
        showNotification('Profil erfolgreich erstellt!', 'success');
    }
    
    updateUI() {
        if (!this.userData) return;
        
        // Update user info
        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        updateElement('user-name', this.userData.username);
        updateElement('welcome-name', this.userData.username);
        updateElement('user-chips', formatNumber(this.userData.chips));
        updateElement('total-chips', formatNumber(this.userData.chips));
        
        // Update avatar
        const avatar = document.getElementById('user-avatar');
        if (avatar) {
            avatar.src = this.userData.profileImage || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userData.username)}&background=00ff88&color=000`;
        }
        
        // Update level
        const level = Math.floor((this.userData.xp || 0) / 1000) + 1;
        const levelBadge = document.querySelector('.level-badge span');
        if (levelBadge) levelBadge.textContent = `Level ${level}`;
    }
    
    updateStats() {
        if (!this.userData) return;
        
        const gamesPlayed = this.userData.gamesPlayed || 0;
        const gamesWon = this.userData.gamesWon || 0;
        const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
        
        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        updateElement('games-won', gamesWon);
        updateElement('win-streak', this.userData.winStreak || 0);
        updateElement('win-rate', `${winRate}%`);
        updateElement('user-rank', this.calculateRank());
        updateElement('friend-count', this.userData.friendCount || 0);
    }
    
    calculateRank() {
        if (!this.userData) return '#1000';
        
        const chips = this.userData.chips || 0;
        
        if (chips > 1000000) return '#1';
        if (chips > 500000) return '#2';
        if (chips > 250000) return '#3';
        if (chips > 100000) return '#10';
        if (chips > 50000) return '#25';
        if (chips > 25000) return '#50';
        if (chips > 10000) return '#100';
        
        return `#${Math.max(1000, Math.floor(10000 / Math.max(1, chips)))}`;
    }
    
    startBonusTimer() {
        if (this.bonusInterval) clearInterval(this.bonusInterval);
        
        let timeLeft = 600;
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
            this.updateChipsDisplay(newChips);
            
            await update(ref(database, 'users/' + this.currentUser.uid), {
                chips: newChips,
                lastBonusTime: Date.now()
            });
            
            await this.addNotification('bonus', `+${bonusAmount} Bonus-Chips erhalten!`);
            showNotification(`🎁 +${bonusAmount} Bonus-Chips!`, 'success');
            
            // Log transaction
            await push(ref(database, 'transactions'), {
                userId: this.currentUser.uid,
                type: 'bonus',
                amount: bonusAmount,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('Error granting bonus:', error);
        }
    }
    
    updateChipsDisplay(chips) {
        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        updateElement('user-chips', formatNumber(chips));
        updateElement('total-chips', formatNumber(chips));
    }
    
    async addNotification(type, message) {
        try {
            await push(ref(database, `notifications/${this.currentUser.uid}`), {
                type: type,
                message: message,
                read: false,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error adding notification:', error);
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
            dailyBonusBtn.innerHTML = '<i class="fas fa-check-circle"></i> Bonus bereits abgeholt';
            dailyBonusBtn.classList.add('disabled');
        }
    }
    
    async claimDailyBonus() {
        try {
            const today = new Date().toDateString();
            const lastBonus = this.userData.lastDailyBonus;
            
            if (lastBonus && new Date(lastBonus).toDateString() === today) {
                showNotification('Bonus wurde bereits heute abgeholt!', 'warning');
                return;
            }
            
            const bonusAmount = 1000;
            const newChips = (this.userData.chips || 0) + bonusAmount;
            
            this.userData.chips = newChips;
            this.userData.lastDailyBonus = Date.now();
            
            this.updateChipsDisplay(newChips);
            
            const dailyBonusBtn = document.getElementById('daily-bonus-btn');
            if (dailyBonusBtn) {
                dailyBonusBtn.disabled = true;
                dailyBonusBtn.innerHTML = '<i class="fas fa-check-circle"></i> Bonus abgeholt';
                dailyBonusBtn.classList.add('disabled');
            }
            
            await update(ref(database, 'users/' + this.currentUser.uid), {
                chips: newChips,
                lastDailyBonus: Date.now()
            });
            
            await this.addNotification('daily_bonus', `+${bonusAmount} tägliche Bonus-Chips!`);
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
        // Listen for top players (sorted by chips)
        const usersRef = ref(database, 'users');
        const topPlayersListener = onValue(usersRef, (snapshot) => {
            this.loadTopPlayers(snapshot);
        });
        this.listeners.push(topPlayersListener);
        
        // Listen for recent games
        const gamesRef = query(ref(database, 'games'), orderByChild('timestamp'), limitToLast(10));
        const gamesListener = onValue(gamesRef, (snapshot) => {
            this.loadRecentGames(snapshot);
        });
        this.listeners.push(gamesListener);
        
        // Listen for active tables
        const tablesRef = ref(database, 'tables');
        const tablesListener = onValue(tablesRef, (snapshot) => {
            this.loadActiveTables(snapshot);
        });
        this.listeners.push(tablesListener);
    }
    
    loadTopPlayers(snapshot) {
        const container = document.getElementById('top-players');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data">Keine Spieler gefunden</div>';
            return;
        }
        
        const players = [];
        snapshot.forEach(child => {
            const player = child.val();
            if (player && player.username && player.chips !== undefined) {
                players.push({ id: child.key, ...player });
            }
        });
        
        // Sort by chips (descending) and take top 10
        players.sort((a, b) => (b.chips || 0) - (a.chips || 0));
        const top10 = players.slice(0, 10);
        
        if (top10.length === 0) {
            container.innerHTML = '<div class="no-data">Keine Spieler gefunden</div>';
            return;
        }
        
        top10.forEach((player, index) => {
            container.appendChild(this.createTopPlayerItem(player, index + 1));
        });
    }
    
    createTopPlayerItem(player, rank) {
        const div = document.createElement('div');
        div.className = 'player-item';
        
        let rankClass = '';
        if (rank === 1) rankClass = 'rank-gold';
        else if (rank === 2) rankClass = 'rank-silver';
        else if (rank === 3) rankClass = 'rank-bronze';
        
        const isCurrentUser = player.id === this.currentUser?.uid;
        
        const level = Math.floor((player.xp || 0) / 1000) + 1;
        
        div.innerHTML = `
            <div class="player-rank ${rankClass}">${rank}</div>
            <img src="${player.profileImage || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(player.username)}&background=00ff88&color=000`}" 
                 alt="${player.username}" class="player-avatar ${isCurrentUser ? 'current-user' : ''}">
            <div class="player-details">
                <div class="player-name">
                    ${player.username || 'Unbekannt'}
                    ${isCurrentUser ? ' (Du)' : ''}
                </div>
                <div class="player-stats">
                    <span class="player-chips">
                        <i class="fas fa-coins"></i>
                        ${formatNumber(player.chips || 0)} Chips
                    </span>
                    <span class="player-level">
                        <i class="fas fa-trophy"></i>
                        Level ${level}
                    </span>
                </div>
            </div>
        `;
        
        return div;
    }
    
    loadRecentGames(snapshot) {
        const container = document.getElementById('recent-games');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i> Noch keine Spiele</div>';
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
            container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i> Noch keine Spiele</div>';
            return;
        }
        
        // Sort by timestamp (newest first)
        games.sort((a, b) => b.timestamp - a.timestamp);
        const recentGames = games.slice(0, 5);
        
        recentGames.forEach(game => {
            container.appendChild(this.createGameHistoryItem(game));
        });
    }
    
    createGameHistoryItem(game) {
        const div = document.createElement('div');
        div.className = 'game-history-item';
        
        const profit = game.win || 0;
        const result = profit > 0 ? 'win' : (profit < 0 ? 'loss' : 'draw');
        
        div.innerHTML = `
            <div class="game-info">
                <div class="game-mode">
                    <i class="fas fa-${game.mode === 'multiplayer' ? 'users' : 'user'}"></i>
                    ${game.mode === 'multiplayer' ? 'Multiplayer' : 'Solo'}
                </div>
                <div class="game-time">${formatTime(game.timestamp)}</div>
            </div>
            <div class="game-result">
                <div class="result result-${result}">
                    <i class="fas fa-${result === 'win' ? 'trophy' : result === 'loss' ? 'times' : 'equals'}"></i>
                    <span>${result === 'win' ? 'Gewonnen' : result === 'loss' ? 'Verloren' : 'Unentschieden'}</span>
                </div>
                <div class="game-profit ${profit > 0 ? 'profit-positive' : profit < 0 ? 'profit-negative' : 'profit-neutral'}">
                    ${profit > 0 ? '+' : ''}${formatNumber(profit)} Chips
                </div>
            </div>
        `;
        
        return div;
    }
    
    loadActiveTables(snapshot) {
        const container = document.getElementById('active-tables');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-table"></i> Keine aktiven Tische</div>';
            return;
        }
        
        const tables = [];
        snapshot.forEach(child => {
            const table = child.val();
            if (table && table.status === 'waiting' && !table.isPrivate) {
                tables.push({ id: child.key, ...table });
            }
        });
        
        if (tables.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-table"></i> Keine öffentlichen Tische</div>';
            return;
        }
        
        tables.forEach(table => {
            container.appendChild(this.createTableCard(table));
        });
    }
    
    createTableCard(table) {
        const div = document.createElement('div');
        div.className = 'table-card';
        
        const playerCount = table.players ? Object.keys(table.players).length : 0;
        const maxPlayers = table.maxPlayers || 6;
        
        div.innerHTML = `
            <div class="table-header">
                <h4><i class="fas fa-dice"></i> ${table.name || 'Roulette Tisch'}</h4>
                <span class="players-count">
                    <i class="fas fa-users"></i>
                    ${playerCount}/${maxPlayers}
                </span>
            </div>
            <div class="table-info">
                <div class="table-detail">
                    <i class="fas fa-user-crown"></i>
                    <span>${table.ownerName || 'Unbekannt'}</span>
                </div>
                <div class="table-detail">
                    <i class="fas fa-coins"></i>
                    <span>Min: ${formatNumber(table.minBet || 10)} Chips</span>
                </div>
                <div class="table-detail">
                    <i class="fas fa-clock"></i>
                    <span>Erstellt: ${formatTime(table.createdAt)}</span>
                </div>
            </div>
            <button class="btn-join" onclick="joinTable('${table.id}')">
                <i class="fas fa-door-open"></i> Beitreten
            </button>
        `;
        
        return div;
    }
    
    setupEventListeners() {
        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (confirm('Wirklich abmelden?')) {
                    // Clean up listeners
                    this.listeners.forEach(listener => off(listener));
                    if (this.bonusInterval) clearInterval(this.bonusInterval);
                    
                    // Set offline status
                    if (this.currentUser) {
                        try {
                            await update(ref(database, 'users/' + this.currentUser.uid), {
                                isOnline: false,
                                lastSeen: Date.now()
                            });
                        } catch (error) {
                            console.error('Error updating offline status:', error);
                        }
                    }
                    
                    await signOut(auth);
                    window.location.href = 'index.html';
                }
            });
        }
        
        // Daily Bonus
        const dailyBonusBtn = document.getElementById('daily-bonus-btn');
        if (dailyBonusBtn) {
            dailyBonusBtn.addEventListener('click', () => this.claimDailyBonus());
        }
        
        // Quick Table
        const quickTableBtn = document.getElementById('quick-table-btn');
        if (quickTableBtn) {
            quickTableBtn.addEventListener('click', () => this.createQuickTable());
        }
    }
    
    async createQuickTable() {
        try {
            if (!this.userData) {
                showNotification('Bitte erst einloggen', 'error');
                return;
            }
            
            const tableId = 'table_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            const tableData = {
                id: tableId,
                name: `${this.userData.username}'s Tisch`,
                owner: this.currentUser.uid,
                ownerName: this.userData.username,
                players: {
                    [this.currentUser.uid]: {
                        name: this.userData.username,
                        chips: this.userData.chips,
                        avatar: this.userData.profileImage,
                        joinedAt: Date.now(),
                        bets: {},
                        totalBet: 0
                    }
                },
                maxPlayers: 6,
                minBet: 10,
                isPrivate: false,
                status: 'waiting',
                currentRound: 0,
                chat: {},
                settings: {
                    autoStart: true,
                    bettingTime: 30,
                    minChips: 100
                },
                createdAt: Date.now()
            };
            
            await set(ref(database, 'tables/' + tableId), tableData);
            
            showNotification('🎲 Tisch erstellt! Weiterleitung...', 'success');
            
            setTimeout(() => {
                window.location.href = `game.html?table=${tableId}`;
            }, 1500);
            
        } catch (error) {
            console.error('Error creating table:', error);
            showNotification('Fehler beim Erstellen des Tisches', 'error');
        }
    }
}

// Initialize dashboard
const dashboardManager = new DashboardManager();

// Global function for joining tables
window.joinTable = async function(tableId) {
    try {
        const tableRef = ref(database, 'tables/' + tableId);
        const snapshot = await get(tableRef);
        
        if (!snapshot.exists()) {
            showNotification('Tisch nicht gefunden', 'error');
            return;
        }
        
        const table = snapshot.val();
        const players = table.players || {};
        
        if (Object.keys(players).length >= (table.maxPlayers || 6)) {
            showNotification('Tisch ist voll!', 'warning');
            return;
        }
        
        // Check if user is already at this table
        if (players[dashboardManager.currentUser?.uid]) {
            showNotification('Du bist bereits an diesem Tisch', 'info');
            window.location.href = `game.html?table=${tableId}`;
            return;
        }
        
        // Add player to table
        players[dashboardManager.currentUser?.uid] = {
            name: dashboardManager.userData?.username,
            chips: dashboardManager.userData?.chips,
            avatar: dashboardManager.userData?.profileImage,
            joinedAt: Date.now(),
            bets: {},
            totalBet: 0
        };
        
        await update(tableRef, {
            players: players,
            playerCount: Object.keys(players).length
        });
        
        showNotification('Tisch beigetreten!', 'success');
        setTimeout(() => {
            window.location.href = `game.html?table=${tableId}`;
        }, 1000);
        
    } catch (error) {
        console.error('Error joining table:', error);
        showNotification('Fehler beim Beitritt', 'error');
    }
};

// Make functions globally available
window.claimDailyBonus = () => dashboardManager.claimDailyBonus();
window.createQuickTable = () => dashboardManager.createQuickTable();