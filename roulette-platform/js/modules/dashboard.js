import { 
    auth, database, onAuthStateChanged, signOut,
    ref, get, update, set, push, queryData, onValue, off
} from '../config/firebase.js';

let currentUser = null;
let userData = null;
let bonusInterval = null;
let chatListener = null;
let notificationsListener = null;
let topPlayersListener = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await initializeDashboard();
        setupEventListeners();
        
        // Regelmäßige Updates
        setInterval(() => updateUI(), 30000);
    });
});

async function initializeDashboard() {
    await loadUserData();
    startBonusTimer();
    loadActiveTables();
    loadRecentGames();
    loadTopPlayers();
    loadFriendsActivity();
    setupGlobalChat();
    loadNotifications();
    checkDailyBonus();
}

async function loadUserData() {
    try {
        const userSnapshot = await get(ref(database, 'users/' + currentUser.uid));
        
        if (userSnapshot.exists()) {
            userData = userSnapshot.val();
            updateUI();
            calculateUserStats();
            saveLocalData();
        } else {
            await createNewUser();
        }
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        loadLocalData();
    }
}

async function createNewUser() {
    const defaultData = {
        uid: currentUser.uid,
        username: currentUser.email?.split('@')[0] || 'Spieler',
        email: currentUser.email,
        chips: 10000,
        level: 1,
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        totalWinnings: 0,
        friendCount: 0,
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email?.split('@')[0] || 'User')}&background=00ff88&color=000&size=128`,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        lastDailyBonus: null,
        lastBonusTime: Date.now(),
        winStreak: 0,
        highestWin: 0,
        achievements: []
    };
    
    await Promise.all([
        set(ref(database, 'users/' + currentUser.uid), defaultData),
        set(ref(database, 'usernames/' + defaultData.username.toLowerCase()), {
            uid: currentUser.uid,
            createdAt: Date.now()
        })
    ]);
    
    userData = defaultData;
    updateUI();
    showNotification('Neues Profil erstellt!', 'success');
}

function updateUI() {
    if (!userData) return;
    
    // Update all UI elements
    updateElement('user-name', userData.username);
    updateElement('welcome-name', userData.username);
    updateElement('user-chips', formatNumber(userData.chips));
    updateElement('total-chips', formatNumber(userData.chips));
    
    const avatar = document.getElementById('user-avatar');
    if (avatar) {
        avatar.src = userData.profileImage || getDefaultAvatar(userData.username);
        avatar.onerror = () => {
            avatar.src = getDefaultAvatar(userData.username);
        };
    }
    
    // Update level badge
    const level = Math.floor((userData.xp || 0) / 1000) + 1;
    const levelBadge = document.querySelector('.level-badge span');
    if (levelBadge) levelBadge.textContent = `Level ${level}`;
}

function calculateUserStats() {
    if (!userData) return;
    
    const gamesPlayed = userData.gamesPlayed || 0;
    const gamesWon = userData.gamesWon || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    
    updateElement('games-won', gamesWon);
    updateElement('win-streak', userData.winStreak || 0);
    updateElement('win-rate', `${winRate}%`);
    updateElement('user-rank', calculateRank(userData.chips));
    updateElement('friend-count', userData.friendCount || 0);
}

function calculateRank(chips) {
    if (chips > 100000) return '#1';
    if (chips > 50000) return '#2';
    if (chips > 25000) return '#3';
    if (chips > 10000) return '#4';
    if (chips > 5000) return '#5';
    return `#${Math.floor(chips / 1000) || 1}`;
}

function startBonusTimer() {
    if (bonusInterval) clearInterval(bonusInterval);
    
    let timeLeft = 600;
    const timerElement = document.getElementById('bonus-timer');
    if (!timerElement) return;
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            grantBonusChips();
            timeLeft = 600;
        } else {
            timeLeft--;
        }
    }
    
    updateTimer();
    bonusInterval = setInterval(updateTimer, 1000);
}

async function grantBonusChips() {
    try {
        const bonusAmount = 250;
        const newChips = (userData.chips || 0) + bonusAmount;
        
        userData.chips = newChips;
        userData.lastBonusTime = Date.now();
        
        updateChipsDisplay(newChips);
        
        await update(ref(database, 'users/' + currentUser.uid), {
            chips: newChips,
            lastBonusTime: Date.now()
        });
        
        await addNotification('bonus', `+${bonusAmount} Bonus-Chips erhalten!`);
        showNotification(`🎁 +${bonusAmount} Bonus-Chips!`, 'success');
        
        await push(ref(database, 'transactions'), {
            userId: currentUser.uid,
            type: 'bonus',
            amount: bonusAmount,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Bonus-Fehler:', error);
        showNotification('Bonus konnte nicht vergeben werden', 'error');
    }
}

function checkDailyBonus() {
    if (!userData) return;
    
    const dailyBonusBtn = document.getElementById('daily-bonus-btn');
    if (!dailyBonusBtn) return;
    
    const today = new Date().toDateString();
    const lastBonus = userData.lastDailyBonus ? new Date(userData.lastDailyBonus).toDateString() : null;
    
    if (lastBonus === today) {
        dailyBonusBtn.disabled = true;
        dailyBonusBtn.innerHTML = '<i class="fas fa-check-circle"></i> Bonus bereits abgeholt';
        dailyBonusBtn.classList.add('disabled');
    }
}

async function claimDailyBonus() {
    try {
        const today = new Date().toDateString();
        const lastBonus = userData.lastDailyBonus;
        
        if (lastBonus && new Date(lastBonus).toDateString() === today) {
            showNotification('Bonus wurde bereits heute abgeholt!', 'warning');
            return;
        }
        
        const bonusAmount = 1000;
        const newChips = (userData.chips || 0) + bonusAmount;
        
        userData.chips = newChips;
        userData.lastDailyBonus = Date.now();
        
        updateChipsDisplay(newChips);
        
        const dailyBonusBtn = document.getElementById('daily-bonus-btn');
        if (dailyBonusBtn) {
            dailyBonusBtn.disabled = true;
            dailyBonusBtn.innerHTML = '<i class="fas fa-check-circle"></i> Bonus abgeholt';
            dailyBonusBtn.classList.add('disabled');
        }
        
        await update(ref(database, 'users/' + currentUser.uid), {
            chips: newChips,
            lastDailyBonus: Date.now()
        });
        
        await addNotification('daily_bonus', `+${bonusAmount} tägliche Bonus-Chips!`);
        showNotification(`🎉 Täglicher Bonus: ${bonusAmount} Chips!`, 'success');
        
        await push(ref(database, 'transactions'), {
            userId: currentUser.uid,
            type: 'daily_bonus',
            amount: bonusAmount,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Daily Bonus Fehler:', error);
        showNotification('Fehler beim Bonus', 'error');
    }
}

// Load Active Tables
async function loadActiveTables() {
    try {
        const tablesRef = queryData('tables', 'status', {key: 'status', value: 'waiting'});
        const snapshot = await get(tablesRef);
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
            if (!table.isPrivate) {
                tables.push({ id: child.key, ...table });
            }
        });
        
        if (tables.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-table"></i> Alle Tische sind privat</div>';
            return;
        }
        
        tables.forEach(table => {
            container.appendChild(createTableCard(table));
        });
        
    } catch (error) {
        console.error('Tabellen-Fehler:', error);
    }
}

function createTableCard(table) {
    const div = document.createElement('div');
    div.className = 'table-card';
    div.innerHTML = `
        <div class="table-header">
            <h4><i class="fas fa-dice"></i> ${table.name || 'Roulette Tisch'}</h4>
            <span class="players-count">
                <i class="fas fa-users"></i>
                ${table.players ? Object.keys(table.players).length : 0}/${table.maxPlayers || 6}
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
        
        if (players[currentUser.uid]) {
            showNotification('Du bist bereits an diesem Tisch', 'info');
            return;
        }
        
        // Add player to table
        players[currentUser.uid] = {
            name: userData.username,
            chips: userData.chips,
            joinedAt: Date.now(),
            avatar: userData.profileImage
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
        console.error('Beitritts-Fehler:', error);
        showNotification('Fehler beim Beitritt', 'error');
    }
};

// Load Recent Games
async function loadRecentGames() {
    try {
        const gamesRef = ref(database, 'games');
        const snapshot = await get(gamesRef);
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
            if (game.players && game.players[currentUser.uid]) {
                games.push({ id: child.key, ...game });
            }
        });
        
        games.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
        
        const recentGames = games.slice(0, 5);
        
        if (recentGames.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i> Noch keine Spiele</div>';
            return;
        }
        
        recentGames.forEach(game => {
            container.appendChild(createGameHistoryItem(game));
        });
        
    } catch (error) {
        console.error('Spiele-Fehler:', error);
    }
}

function createGameHistoryItem(game) {
    const div = document.createElement('div');
    div.className = 'game-history-item';
    
    const profit = game.profits?.[currentUser.uid] || 0;
    const result = profit > 0 ? 'win' : (profit < 0 ? 'loss' : 'draw');
    
    div.innerHTML = `
        <div class="game-info">
            <div class="game-mode">
                <i class="fas fa-${game.mode === 'multiplayer' ? 'users' : 'user'}"></i>
                ${game.mode === 'multiplayer' ? 'Multiplayer' : 'Solo'}
            </div>
            <div class="game-time">${formatTime(game.endedAt)}</div>
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

// Load Top Players
async function loadTopPlayers() {
    try {
        const usersRef = ref(database, 'users');
        
        if (topPlayersListener) off(usersRef, topPlayersListener);
        
        topPlayersListener = onValue(usersRef, (snapshot) => {
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
                if (player.chips !== undefined) {
                    players.push({ id: child.key, ...player });
                }
            });
            
            players.sort((a, b) => (b.chips || 0) - (a.chips || 0));
            
            const top10 = players.slice(0, 10);
            
            top10.forEach((player, index) => {
                container.appendChild(createTopPlayerItem(player, index + 1));
            });
        });
        
    } catch (error) {
        console.error('Top-Spieler-Fehler:', error);
    }
}

function createTopPlayerItem(player, rank) {
    const div = document.createElement('div');
    div.className = 'player-item';
    
    let rankClass = '';
    if (rank === 1) rankClass = 'rank-gold';
    else if (rank === 2) rankClass = 'rank-silver';
    else if (rank === 3) rankClass = 'rank-bronze';
    
    const isCurrentUser = player.id === currentUser.uid;
    
    div.innerHTML = `
        <div class="player-rank ${rankClass}">${rank}</div>
        <img src="${player.profileImage || getDefaultAvatar(player.username)}" 
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
                    Level ${Math.floor((player.xp || 0) / 1000) + 1}
                </span>
            </div>
        </div>
    `;
    return div;
}

// Friend Functions
async function loadFriendsActivity() {
    try {
        // This is a placeholder - implement actual friend system
        const container = document.getElementById('friends-activity');
        if (!container) return;
        
        container.innerHTML = `
            <div class="friends-info">
                <i class="fas fa-user-friends"></i>
                <p>Besuche den Freunde-Bereich, um Freunde hinzuzufügen und ihre Aktivitäten zu sehen!</p>
                <button class="btn-action small" onclick="window.location.href='friends.html'">
                    <i class="fas fa-user-plus"></i> Zu Freunden
                </button>
            </div>
        `;
        
    } catch (error) {
        console.error('Freunde-Fehler:', error);
    }
}

// Chat Functions
function setupGlobalChat() {
    const chatContainer = document.getElementById('global-chat');
    if (!chatContainer) return;
    
    if (chatListener) off(ref(database, 'global_chat'), chatListener);
    
    chatListener = onValue(ref(database, 'global_chat'), (snapshot) => {
        chatContainer.innerHTML = '';
        
        if (!snapshot.exists()) {
            chatContainer.innerHTML = '<div class="no-data">Keine Nachrichten</div>';
            return;
        }
        
        const messages = [];
        snapshot.forEach(child => {
            messages.push({ id: child.key, ...child.val() });
        });
        
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        const recentMessages = messages.slice(-15);
        
        recentMessages.forEach(msg => {
            const msgElement = createChatMessage(msg);
            chatContainer.appendChild(msgElement);
        });
        
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

window.sendGlobalMessage = async function() {
    const input = document.getElementById('global-chat-input');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text || text.length > 200) {
        showNotification('Nachricht zu lang oder leer', 'warning');
        return;
    }
    
    try {
        await push(ref(database, 'global_chat'), {
            userId: currentUser.uid,
            username: userData.username,
            text: text,
            timestamp: Date.now(),
            avatar: userData.profileImage
        });
        
        input.value = '';
        input.focus();
        
    } catch (error) {
        console.error('Chat-Fehler:', error);
        showNotification('Nachricht konnte nicht gesendet werden', 'error');
    }
};

// Notification Functions
async function loadNotifications() {
    try {
        const notifRef = ref(database, `notifications/${currentUser.uid}`);
        
        if (notificationsListener) off(notifRef, notificationsListener);
        
        notificationsListener = onValue(notifRef, (snapshot) => {
            const container = document.getElementById('notifications-list');
            if (!container) return;
            
            container.innerHTML = '';
            
            if (!snapshot.exists()) {
                container.innerHTML = '<div class="no-notifications">Keine Benachrichtigungen</div>';
                return;
            }
            
            const notifications = [];
            snapshot.forEach(child => {
                const notif = child.val();
                if (!notif.read) {
                    notifications.push({ id: child.key, ...notif });
                }
            });
            
            notifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            if (notifications.length === 0) {
                container.innerHTML = '<div class="no-notifications">Keine neuen Benachrichtigungen</div>';
                return;
            }
            
            notifications.forEach(notif => {
                container.appendChild(createNotificationItem(notif));
            });
            
            // Update badge count
            const badge = document.querySelector('.nav-item a[href="profile.html"] .badge');
            if (badge) {
                badge.textContent = notifications.length;
                badge.style.display = notifications.length > 0 ? 'flex' : 'none';
            }
        });
        
    } catch (error) {
        console.error('Benachrichtigungs-Fehler:', error);
    }
}

async function addNotification(type, message) {
    try {
        await push(ref(database, `notifications/${currentUser.uid}`), {
            type: type,
            message: message,
            read: false,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Benachrichtigung hinzufügen fehlgeschlagen:', error);
    }
}

// Utility Functions
function updateChipsDisplay(chips) {
    updateElement('user-chips', formatNumber(chips));
    updateElement('total-chips', formatNumber(chips));
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatNumber(num) {
    return new Intl.NumberFormat('de-DE').format(num || 0);
}

function formatTime(timestamp) {
    if (!timestamp) return 'Vor kurzem';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} T`;
    
    return new Date(timestamp).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit'
    });
}

function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00ff88&color=000&bold=true&size=128`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `floating-notification ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="close-notif"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    // Close button
    notification.querySelector('.close-notif').addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Local Storage Functions
function saveLocalData() {
    try {
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('lastSync', Date.now().toString());
    } catch (e) {
        console.error('Speichern lokal fehlgeschlagen:', e);
    }
}

function loadLocalData() {
    try {
        const saved = localStorage.getItem('userData');
        if (saved) {
            userData = JSON.parse(saved);
            updateUI();
            showNotification('📴 Offline-Modus: Lokale Daten geladen', 'warning');
            return true;
        }
    } catch (e) {
        console.error('Laden lokal fehlgeschlagen:', e);
    }
    return false;
}

// Event Listeners
function setupEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Wirklich abmelden?')) {
                // Clean up listeners
                [bonusInterval, chatListener, notificationsListener, topPlayersListener]
                    .forEach(item => item && (clearInterval?.(item) || off?.(item)));
                
                await signOut(auth);
                window.location.href = 'index.html';
            }
        });
    }
    
    // Daily Bonus
    const dailyBonusBtn = document.getElementById('daily-bonus-btn');
    if (dailyBonusBtn) {
        dailyBonusBtn.addEventListener('click', claimDailyBonus);
    }
    
    // Quick Table
    const quickTableBtn = document.getElementById('quick-table-btn');
    if (quickTableBtn) {
        quickTableBtn.addEventListener('click', createQuickTable);
    }
    
    // Chat
    const chatInput = document.getElementById('global-chat-input');
    const chatSendBtn = document.getElementById('global-chat-send');
    
    if (chatInput && chatSendBtn) {
        chatSendBtn.addEventListener('click', sendGlobalMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGlobalMessage();
            }
        });
    }
}

window.createQuickTable = async function() {
    try {
        const tableId = 'table_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const tableData = {
            id: tableId,
            name: `${userData.username}'s Tisch`,
            owner: currentUser.uid,
            ownerName: userData.username,
            players: {
                [currentUser.uid]: {
                    name: userData.username,
                    chips: userData.chips,
                    avatar: userData.profileImage,
                    joinedAt: Date.now()
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
        console.error('Tisch erstellen fehlgeschlagen:', error);
        showNotification('Fehler beim Erstellen des Tisches', 'error');
    }
};

// Clean up
window.addEventListener('beforeunload', () => {
    if (bonusInterval) clearInterval(bonusInterval);
    if (chatListener) off(ref(database, 'global_chat'), chatListener);
    if (notificationsListener) off(ref(database, 'notifications/' + currentUser.uid), notificationsListener);
    if (topPlayersListener) off(ref(database, 'users'), topPlayersListener);
});

// Make functions globally available
window.claimDailyBonus = claimDailyBonus;
window.joinTable = window.joinTable;