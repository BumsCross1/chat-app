import { 
    auth, database, onAuthStateChanged, signOut,
    ref, get, update, set, push, query, orderByChild, limitToLast, onValue, off
} from '../config/firebase.js';
import { formatNumber, showNotification } from '../utils.js';

let currentUser = null;
let userData = null;
let bonusInterval = null;
let listeners = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        setupEventListeners();
        setupRealTimeListeners();
        startBonusTimer();
        
        // Auto refresh every 30 seconds
        setInterval(updateDashboard, 30000);
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, 'users/' + currentUser.uid));
        
        if (snapshot.exists()) {
            userData = snapshot.val();
            updateUI();
            updateStats();
            checkDailyBonus();
        } else {
            // Create user if doesn't exist
            await createNewUser();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Fehler beim Laden der Daten', 'error');
    }
}

async function createNewUser() {
    const defaultData = {
        uid: currentUser.uid,
        username: currentUser.email.split('@')[0] || 'Spieler',
        email: currentUser.email,
        chips: 10000,
        level: 1,
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        totalWinnings: 0,
        friendCount: 0,
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email.split('@')[0] || 'User')}&background=00ff88&color=000&size=256`,
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
    
    await set(ref(database, 'users/' + currentUser.uid), defaultData);
    
    // Save username reference
    await set(ref(database, `usernames/${defaultData.username.toLowerCase()}`), {
        uid: currentUser.uid,
        createdAt: Date.now()
    });
    
    userData = defaultData;
    updateUI();
    showNotification('Profil erfolgreich erstellt!', 'success');
}

function updateUI() {
    if (!userData) return;
    
    // Update all UI elements
    updateElement('user-name', userData.username);
    updateElement('welcome-name', userData.username);
    updateElement('user-chips', formatNumber(userData.chips));
    updateElement('total-chips', formatNumber(userData.chips));
    
    // Update avatar
    const avatar = document.getElementById('user-avatar');
    if (avatar) {
        avatar.src = userData.profileImage || getDefaultAvatar(userData.username);
        avatar.onerror = () => {
            avatar.src = getDefaultAvatar(userData.username);
        };
    }
    
    // Update level
    const level = Math.floor((userData.xp || 0) / 1000) + 1;
    const levelBadge = document.querySelector('.level-badge span');
    if (levelBadge) levelBadge.textContent = `Level ${level}`;
}

function updateStats() {
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
    if (chips > 1000000) return '#1';
    if (chips > 500000) return '#2';
    if (chips > 250000) return '#3';
    if (chips > 100000) return '#10';
    if (chips > 50000) return '#25';
    if (chips > 25000) return '#50';
    if (chips > 10000) return '#100';
    return `#${Math.max(1000, Math.floor(chips / 100) * 100)}`;
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00ff88&color=000&bold=true`;
}

function startBonusTimer() {
    if (bonusInterval) clearInterval(bonusInterval);
    
    let timeLeft = 600;
    const timerElement = document.getElementById('bonus-timer');
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
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
        updateChipsDisplay(newChips);
        
        await update(ref(database, 'users/' + currentUser.uid), {
            chips: newChips,
            lastBonusTime: Date.now()
        });
        
        await addNotification('bonus', `+${bonusAmount} Bonus-Chips erhalten!`);
        showNotification(`🎁 +${bonusAmount} Bonus-Chips!`, 'success');
        
        // Log transaction
        await push(ref(database, 'transactions'), {
            userId: currentUser.uid,
            type: 'bonus',
            amount: bonusAmount,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Error granting bonus:', error);
    }
}

function updateChipsDisplay(chips) {
    updateElement('user-chips', formatNumber(chips));
    updateElement('total-chips', formatNumber(chips));
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
        console.error('Error adding notification:', error);
    }
}

function checkDailyBonus() {
    const dailyBonusBtn = document.getElementById('daily-bonus-btn');
    if (!dailyBonusBtn || !userData) return;
    
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
        console.error('Error claiming daily bonus:', error);
        showNotification('Fehler beim Abholen des Bonus', 'error');
    }
}

function setupRealTimeListeners() {
    // Listen for active tables
    const tablesRef = query(ref(database, 'tables'), orderByChild('status'), limitToLast(20));
    listeners.push(
        onValue(tablesRef, (snapshot) => {
            loadActiveTables(snapshot);
        })
    );
    
    // Listen for top players
    const usersRef = query(ref(database, 'users'), orderByChild('chips'), limitToLast(10));
    listeners.push(
        onValue(usersRef, (snapshot) => {
            loadTopPlayers(snapshot);
        })
    );
    
    // Listen for notifications
    const notificationsRef = ref(database, `notifications/${currentUser.uid}`);
    listeners.push(
        onValue(notificationsRef, (snapshot) => {
            loadNotifications(snapshot);
        })
    );
    
    // Listen for global chat
    const chatRef = ref(database, 'global_chat');
    listeners.push(
        onValue(chatRef, (snapshot) => {
            loadGlobalChat(snapshot);
        })
    );
    
    // Listen for recent games
    const gamesRef = query(ref(database, 'games'), orderByChild('timestamp'), limitToLast(10));
    listeners.push(
        onValue(gamesRef, (snapshot) => {
            loadRecentGames(snapshot);
        })
    );
}

function loadActiveTables(snapshot) {
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
        if (table.status === 'waiting' && !table.isPrivate) {
            tables.push({ id: child.key, ...table });
        }
    });
    
    if (tables.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-table"></i> Keine öffentlichen Tische</div>';
        return;
    }
    
    tables.forEach(table => {
        container.appendChild(createTableCard(table));
    });
}

function createTableCard(table) {
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

function loadTopPlayers(snapshot) {
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
        players.push({ id: child.key, ...player });
    });
    
    // Sort by chips (descending)
    players.sort((a, b) => (b.chips || 0) - (a.chips || 0));
    
    const top10 = players.slice(0, 10);
    
    top10.forEach((player, index) => {
        container.appendChild(createTopPlayerItem(player, index + 1));
    });
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

function loadNotifications(snapshot) {
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
    
    if (notifications.length === 0) {
        container.innerHTML = '<div class="no-notifications">Keine neuen Benachrichtigungen</div>';
        return;
    }
    
    notifications.sort((a, b) => b.timestamp - a.timestamp);
    
    notifications.forEach(notif => {
        container.appendChild(createNotificationItem(notif));
    });
    
    // Update badge
    const badge = document.querySelector('.nav-item a[href="profile.html"] .badge');
    if (badge) {
        badge.textContent = notifications.length;
        badge.style.display = notifications.length > 0 ? 'flex' : 'none';
    }
}

function createNotificationItem(notif) {
    const div = document.createElement('div');
    div.className = 'notification';
    
    const icon = getNotificationIcon(notif.type);
    const time = formatTime(notif.timestamp);
    
    div.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="notification-content">
            <div class="notification-message">${notif.message}</div>
            <div class="notification-time">${time}</div>
        </div>
        <button class="mark-read" data-id="${notif.id}">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add click handler for mark as read
    div.querySelector('.mark-read').addEventListener('click', async (e) => {
        e.stopPropagation();
        await markNotificationAsRead(notif.id);
    });
    
    return div;
}

function getNotificationIcon(type) {
    const icons = {
        'friend_request': 'fa-user-plus',
        'friend_accepted': 'fa-user-check',
        'game_invite': 'fa-gamepad',
        'bonus': 'fa-gift',
        'daily_bonus': 'fa-coins',
        'system': 'fa-info-circle',
        'win': 'fa-trophy',
        'loss': 'fa-times'
    };
    return icons[type] || 'fa-bell';
}

async function markNotificationAsRead(notificationId) {
    try {
        await update(ref(database, `notifications/${currentUser.uid}/${notificationId}`), {
            read: true
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

function loadGlobalChat(snapshot) {
    const container = document.getElementById('global-chat');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!snapshot.exists()) {
        container.innerHTML = '<div class="no-data">Keine Nachrichten</div>';
        return;
    }
    
    const messages = [];
    snapshot.forEach(child => {
        messages.push(child.val());
    });
    
    // Sort by timestamp and get last 15
    messages.sort((a, b) => a.timestamp - b.timestamp);
    const recentMessages = messages.slice(-15);
    
    recentMessages.forEach(msg => {
        const msgElement = createChatMessage(msg);
        container.appendChild(msgElement);
    });
    
    container.scrollTop = container.scrollHeight;
}

function createChatMessage(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.userId === currentUser.uid ? 'own' : ''}`;
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${msg.username}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${msg.text}</div>
    `;
    
    return div;
}

function loadRecentGames(snapshot) {
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
        if (game.userId === currentUser.uid) {
            games.push(game);
        }
    });
    
    if (games.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i> Noch keine Spiele</div>';
        return;
    }
    
    games.sort((a, b) => b.timestamp - a.timestamp);
    const recentGames = games.slice(0, 5);
    
    recentGames.forEach(game => {
        container.appendChild(createGameHistoryItem(game));
    });
}

function createGameHistoryItem(game) {
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

function formatTime(timestamp) {
    if (!timestamp) return 'Vor kurzem';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} T`;
    
    return new Date(timestamp).toLocaleDateString('de-DE');
}

async function updateDashboard() {
    // Refresh user data
    await loadUserData();
}

function setupEventListeners() {
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Wirklich abmelden?')) {
                // Clean up listeners
                listeners.forEach(listener => off(listener));
                if (bonusInterval) clearInterval(bonusInterval);
                
                // Set offline status
                await update(ref(database, 'users/' + currentUser.uid), {
                    isOnline: false,
                    lastSeen: Date.now()
                });
                
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
    
    // Chat send
    const chatInput = document.getElementById('global-chat-input');
    const chatSendBtn = document.getElementById('global-chat-send');
    
    if (chatSendBtn && chatInput) {
        chatSendBtn.addEventListener('click', sendGlobalMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGlobalMessage();
            }
        });
    }
}

async function sendGlobalMessage() {
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
        console.error('Error sending message:', error);
        showNotification('Nachricht konnte nicht gesendet werden', 'error');
    }
}

async function createQuickTable() {
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
            window.location.href = `game.html?table=${tableId}`;
            return;
        }
        
        // Add player to table
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
        
        showNotification('Tisch beigetreten!', 'success');
        setTimeout(() => {
            window.location.href = `game.html?table=${tableId}`;
        }, 1000);
        
    } catch (error) {
        console.error('Error joining table:', error);
        showNotification('Fehler beim Beitritt', 'error');
    }
};

// Clean up on page unload
window.addEventListener('beforeunload', async () => {
    // Clean up listeners
    listeners.forEach(listener => off(listener));
    if (bonusInterval) clearInterval(bonusInterval);
    
    // Set offline status
    if (currentUser) {
        try {
            await update(ref(database, 'users/' + currentUser.uid), {
                isOnline: false,
                lastSeen: Date.now()
            });
        } catch (error) {
            console.error('Error updating offline status:', error);
        }
    }
});

// Make functions globally available
window.claimDailyBonus = claimDailyBonus;
window.createQuickTable = createQuickTable;