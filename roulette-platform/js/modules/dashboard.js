let currentUser = null;
let userData = null;
let bonusInterval;
let chatListener;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        startBonusTimer();
        loadActiveTables();
        loadRecentGames();
        loadTopPlayers();
        loadFriendsActivity();
        setupGlobalChat();
        loadNotifications();
        
        // Update user chips every 30 seconds
        setInterval(loadUserData, 30000);
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    // Daily bonus button
    document.getElementById('daily-bonus-btn')?.addEventListener('click', claimDailyBonus);
});

async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            
            // Update UI
            document.getElementById('user-name').textContent = userData.username || 'Spieler';
            document.getElementById('welcome-name').textContent = userData.username || 'Spieler';
            document.getElementById('user-chips').textContent = formatNumber(userData.chips || 0);
            document.getElementById('total-chips').textContent = formatNumber(userData.chips || 0);
            
            // Update avatar
            if (userData.profileImage) {
                document.getElementById('user-avatar').src = userData.profileImage;
            } else {
                const name = userData.username || 'User';
                document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00ff88&color=000`;
            }
            
            // Calculate and display stats
            calculateUserStats();
            
            // Update friend count
            updateFriendCount();
            
            // Check for daily bonus
            checkDailyBonus();
        } else {
            // Create user document if it doesn't exist
            await db.collection('users').doc(currentUser.uid).set({
                username: currentUser.email.split('@')[0],
                email: currentUser.email,
                chips: 10000,
                level: 1,
                xp: 0,
                gamesPlayed: 0,
                gamesWon: 0,
                totalWinnings: 0,
                friendCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                lastDailyBonus: null,
                lastBonusTime: Date.now()
            });
            
            loadUserData(); // Reload after creation
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Fehler beim Laden der Daten', 'error');
    }
}

function calculateUserStats() {
    const gamesPlayed = userData.gamesPlayed || 0;
    const gamesWon = userData.gamesWon || 0;
    const winStreak = userData.winStreak || 0;
    
    document.getElementById('games-won').textContent = gamesWon;
    document.getElementById('win-streak').textContent = winStreak;
    
    // Calculate win rate
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    document.getElementById('win-rate').textContent = `${winRate}%`;
    
    // Calculate level based on XP
    const xp = userData.xp || 0;
    const level = Math.floor(xp / 1000) + 1;
    document.getElementById('user-level').textContent = level;
}

async function updateFriendCount() {
    try {
        const friendsSnapshot = await db.collection('friends')
            .where('users', 'array-contains', currentUser.uid)
            .get();
        
        const count = friendsSnapshot.size;
        document.getElementById('friend-count').textContent = count;
        userData.friendCount = count;
    } catch (error) {
        console.error('Error loading friend count:', error);
    }
}

function startBonusTimer() {
    let timeLeft = 600; // 10 minutes in seconds
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('bonus-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            grantBonusChips();
            timeLeft = 600; // Reset to 10 minutes
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
        
        await db.collection('users').doc(currentUser.uid).update({
            chips: newChips,
            lastBonusTime: Date.now()
        });
        
        userData.chips = newChips;
        document.getElementById('user-chips').textContent = formatNumber(newChips);
        document.getElementById('total-chips').textContent = formatNumber(newChips);
        
        // Add notification
        addNotification('bonus', `+${bonusAmount} Bonus-Chips erhalten!`);
        showNotification(`Du hast ${bonusAmount} Bonus-Chips erhalten!`, 'success');
        
        // Log bonus transaction
        await db.collection('transactions').add({
            userId: currentUser.uid,
            type: 'bonus',
            amount: bonusAmount,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error granting bonus chips:', error);
    }
}

async function checkDailyBonus() {
    const today = new Date().toDateString();
    const lastBonus = userData.lastDailyBonus;
    
    if (lastBonus && new Date(lastBonus.seconds * 1000).toDateString() === today) {
        document.getElementById('daily-bonus-btn').disabled = true;
        document.getElementById('daily-bonus-btn').innerHTML = '<i class="fas fa-check"></i><span>Täglicher Bonus bereits abgeholt</span>';
    }
}

async function claimDailyBonus() {
    try {
        const today = new Date().toDateString();
        const lastBonus = userData.lastDailyBonus;
        
        if (lastBonus && new Date(lastBonus.seconds * 1000).toDateString() === today) {
            showNotification('Täglicher Bonus wurde bereits abgeholt!', 'warning');
            return;
        }
        
        // Daily bonus: 1000 chips
        const bonusAmount = 1000;
        const newChips = (userData.chips || 0) + bonusAmount;
        
        await db.collection('users').doc(currentUser.uid).update({
            chips: newChips,
            lastDailyBonus: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        userData.chips = newChips;
        document.getElementById('user-chips').textContent = formatNumber(newChips);
        document.getElementById('total-chips').textContent = formatNumber(newChips);
        
        // Update button
        document.getElementById('daily-bonus-btn').disabled = true;
        document.getElementById('daily-bonus-btn').innerHTML = '<i class="fas fa-check"></i><span>Täglicher Bonus abgeholt</span>';
        
        addNotification('daily_bonus', `+${bonusAmount} tägliche Bonus-Chips!`);
        showNotification(`Täglicher Bonus: ${bonusAmount} Chips erhalten!`, 'success');
        
        // Log transaction
        await db.collection('transactions').add({
            userId: currentUser.uid,
            type: 'daily_bonus',
            amount: bonusAmount,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error claiming daily bonus:', error);
        showNotification('Fehler beim Abholen des täglichen Bonus', 'error');
    }
}

async function loadActiveTables() {
    try {
        const tablesSnapshot = await db.collection('tables')
            .where('status', '==', 'active')
            .where('isPrivate', '==', false)
            .limit(6)
            .get();
        
        const tablesContainer = document.getElementById('active-tables');
        tablesContainer.innerHTML = '';
        
        if (tablesSnapshot.empty) {
            tablesContainer.innerHTML = '<div class="no-data">Keine aktiven Tische verfügbar</div>';
            return;
        }
        
        tablesSnapshot.forEach(doc => {
            const table = doc.data();
            const tableElement = createTableCard(table, doc.id);
            tablesContainer.appendChild(tableElement);
        });
    } catch (error) {
        console.error('Error loading active tables:', error);
    }
}

function createTableCard(table, tableId) {
    const div = document.createElement('div');
    div.className = 'table-card';
    div.innerHTML = `
        <div class="table-header">
            <h4>${table.name || 'Unbenannter Tisch'}</h4>
            <span class="players-count">${table.players ? table.players.length : 0}/${table.maxPlayers || 4}</span>
        </div>
        <div class="table-info">
            <div class="table-detail">
                <i class="fas fa-user"></i>
                <span>Besitzer: ${table.ownerName || 'Unbekannt'}</span>
            </div>
            <div class="table-detail">
                <i class="fas fa-coins"></i>
                <span>Min. Einsatz: ${table.minBet || 10}</span>
            </div>
            <div class="table-detail">
                <i class="fas fa-clock"></i>
                <span>Runde: ${table.currentRound || 1}</span>
            </div>
        </div>
        <button class="btn-join" onclick="joinTable('${tableId}')">Beitreten</button>
    `;
    
    return div;
}

async function joinTable(tableId) {
    try {
        const tableDoc = await db.collection('tables').doc(tableId).get();
        if (!tableDoc.exists) {
            showNotification('Tisch nicht gefunden', 'error');
            return;
        }
        
        const table = tableDoc.data();
        if (table.players && table.players.length >= table.maxPlayers) {
            showNotification('Tisch ist bereits voll', 'warning');
            return;
        }
        
        window.location.href = `game.html?table=${tableId}`;
    } catch (error) {
        console.error('Error joining table:', error);
        showNotification('Fehler beim Beitritt', 'error');
    }
}

async function loadRecentGames() {
    try {
        const gamesSnapshot = await db.collection('games')
            .where('players', 'array-contains', currentUser.uid)
            .orderBy('endedAt', 'desc')
            .limit(5)
            .get();
        
        const gamesContainer = document.getElementById('recent-games');
        gamesContainer.innerHTML = '';
        
        if (gamesSnapshot.empty) {
            gamesContainer.innerHTML = '<div class="no-data">Noch keine Spiele gespielt</div>';
            return;
        }
        
        gamesSnapshot.forEach(doc => {
            const game = doc.data();
            const gameElement = createGameHistoryItem(game, doc.id);
            gamesContainer.appendChild(gameElement);
        });
    } catch (error) {
        console.error('Error loading recent games:', error);
    }
}

function createGameHistoryItem(game, gameId) {
    const div = document.createElement('div');
    div.className = 'game-history-item';
    
    const result = game.winner === currentUser.uid ? 'win' : 'loss';
    const resultText = result === 'win' ? 'Gewonnen' : 'Verloren';
    const resultClass = result === 'win' ? 'result-win' : 'result-loss';
    const resultIcon = result === 'win' ? 'fa-trophy' : 'fa-times';
    
    const profit = game.profits ? (game.profits[currentUser.uid] || 0) : 0;
    const profitText = profit > 0 ? `+${profit}` : profit;
    
    div.innerHTML = `
        <div class="game-info">
            <div class="game-mode">${game.mode || 'Solo'}</div>
            <div class="game-time">${formatTime(game.endedAt?.seconds * 1000 || Date.now())}</div>
        </div>
        <div class="game-result">
            <div class="result ${resultClass}">
                <i class="fas ${resultIcon}"></i>
                <span>${resultText}</span>
            </div>
            <div class="game-profit ${profit > 0 ? 'profit-positive' : 'profit-negative'}">
                ${profitText} Chips
            </div>
        </div>
    `;
    
    return div;
}

async function loadTopPlayers() {
    try {
        const playersSnapshot = await db.collection('users')
            .orderBy('chips', 'desc')
            .limit(10)
            .get();
        
        const playersContainer = document.getElementById('top-players');
        playersContainer.innerHTML = '';
        
        playersSnapshot.forEach((doc, index) => {
            const player = doc.data();
            const playerElement = createTopPlayerItem(player, doc.id, index + 1);
            playersContainer.appendChild(playerElement);
        });
    } catch (error) {
        console.error('Error loading top players:', error);
    }
}

function createTopPlayerItem(player, playerId, rank) {
    const div = document.createElement('div');
    div.className = 'player-item';
    
    let rankClass = '';
    if (rank === 1) rankClass = 'rank-gold';
    else if (rank === 2) rankClass = 'rank-silver';
    else if (rank === 3) rankClass = 'rank-bronze';
    
    div.innerHTML = `
        <div class="player-rank ${rankClass}">${rank}</div>
        <img src="${player.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.username || 'User')}&background=00ff88&color=000`}" 
             alt="Avatar" class="player-avatar">
        <div class="player-details">
            <div class="player-name">${player.username || 'Unbekannt'}</div>
            <div class="player-stats">
                <span class="player-chips">${formatNumber(player.chips || 0)} Chips</span>
                <span class="player-level">Level ${Math.floor((player.xp || 0) / 1000) + 1}</span>
            </div>
        </div>
    `;
    
    return div;
}

async function loadFriendsActivity() {
    try {
        // First get friends list
        const friendsSnapshot = await db.collection('friends')
            .where('users', 'array-contains', currentUser.uid)
            .get();
        
        const friendsContainer = document.getElementById('friends-activity');
        friendsContainer.innerHTML = '';
        
        if (friendsSnapshot.empty) {
            friendsContainer.innerHTML = '<div class="no-data">Füge Freunde hinzu, um ihre Aktivitäten zu sehen</div>';
            return;
        }
        
        // Get friend IDs
        const friendIds = [];
        friendsSnapshot.forEach(doc => {
            const users = doc.data().users;
            const friendId = users.find(id => id !== currentUser.uid);
            if (friendId) friendIds.push(friendId);
        });
        
        if (friendIds.length === 0) {
            friendsContainer.innerHTML = '<div class="no-data">Keine Freundesaktivitäten</div>';
            return;
        }
        
        // Get recent games of friends
        const gamesSnapshot = await db.collection('games')
            .where('players', 'in', [friendIds])
            .orderBy('endedAt', 'desc')
            .limit(5)
            .get();
        
        if (gamesSnapshot.empty) {
            friendsContainer.innerHTML = '<div class="no-data">Deine Freunde haben noch nicht gespielt</div>';
            return;
        }
        
        // Get user data for friend names
        const userPromises = friendIds.map(id => db.collection('users').doc(id).get());
        const userDocs = await Promise.all(userPromises);
        const usersMap = {};
        userDocs.forEach(doc => {
            if (doc.exists) {
                usersMap[doc.id] = doc.data();
            }
        });
        
        gamesSnapshot.forEach(doc => {
            const game = doc.data();
            const friendId = game.players.find(id => id !== currentUser.uid && friendIds.includes(id));
            const friend = usersMap[friendId];
            
            if (friend) {
                const activityElement = createFriendActivityItem(friend, game);
                friendsContainer.appendChild(activityElement);
            }
        });
    } catch (error) {
        console.error('Error loading friends activity:', error);
    }
}

function createFriendActivityItem(friend, game) {
    const div = document.createElement('div');
    div.className = 'friend-activity-item';
    
    const result = game.winner === friend.uid ? 'Gewonnen' : 'Verloren';
    const profit = game.profits ? (game.profits[friend.uid] || 0) : 0;
    
    div.innerHTML = `
        <img src="${friend.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || 'Friend')}&background=00ff88&color=000`}" 
             alt="Avatar" class="friend-avatar">
        <div class="activity-details">
            <div class="friend-name">${friend.username}</div>
            <div class="activity-text">hat ${result.toLowerCase()} (${profit > 0 ? '+' : ''}${profit} Chips)</div>
            <div class="activity-time">${formatTime(game.endedAt?.seconds * 1000 || Date.now())}</div>
        </div>
    `;
    
    return div;
}

function setupGlobalChat() {
    const chatContainer = document.getElementById('global-chat');
    
    // Listen for global chat messages
    chatListener = db.collection('global_chat')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
            chatContainer.innerHTML = '';
            
            const messages = [];
            snapshot.forEach(doc => {
                messages.push(doc.data());
            });
            
            // Reverse to show newest at bottom
            messages.reverse().forEach(message => {
                const messageElement = createChatMessage(message);
                chatContainer.appendChild(messageElement);
            });
            
            // Scroll to bottom
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, error => {
            console.error('Error listening to chat:', error);
        });
}

function createChatMessage(message) {
    const div = document.createElement('div');
    div.className = `message ${message.userId === currentUser.uid ? 'own' : ''}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-sender">${message.username}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${message.text}</div>
    `;
    
    return div;
}

async function sendGlobalMessage() {
    const input = document.getElementById('global-chat-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    try {
        await db.collection('global_chat').add({
            userId: currentUser.uid,
            username: userData.username,
            text: text,
            timestamp: Date.now()
        });
        
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Fehler beim Senden der Nachricht', 'error');
    }
}

async function loadNotifications() {
    try {
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', currentUser.uid)
            .where('read', '==', false)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        const notificationsContainer = document.getElementById('notifications-list');
        notificationsContainer.innerHTML = '';
        
        if (notificationsSnapshot.empty) {
            notificationsContainer.innerHTML = '<div class="no-notifications">Keine neuen Benachrichtigungen</div>';
            return;
        }
        
        notificationsSnapshot.forEach(doc => {
            const notification = doc.data();
            const notificationElement = createNotificationItem(notification);
            notificationsContainer.appendChild(notificationElement);
        });
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function createNotificationItem(notification) {
    const div = document.createElement('div');
    div.className = 'notification';
    
    let icon = 'fa-info-circle';
    if (notification.type === 'friend_request') icon = 'fa-user-plus';
    else if (notification.type === 'game_invite') icon = 'fa-gamepad';
    else if (notification.type === 'bonus') icon = 'fa-gift';
    else if (notification.type === 'level_up') icon = 'fa-trophy';
    
    div.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${notification.message}</span>
    `;
    
    return div;
}

async function addNotification(type, message) {
    try {
        await db.collection('notifications').add({
            userId: currentUser.uid,
            type: type,
            message: message,
            read: false,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `floating-notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function createQuickTable() {
    openModal('create-table-modal');
}

async function createPrivateTable() {
    const name = document.getElementById('table-name').value.trim() || 'Privater Tisch';
    const password = document.getElementById('table-password').value.trim();
    const maxPlayers = parseInt(document.getElementById('max-players').value);
    const minBet = parseInt(document.getElementById('min-bet').value);
    
    try {
        const tableId = generateTableId();
        
        await db.collection('tables').doc(tableId).set({
            id: tableId,
            name: name,
            owner: currentUser.uid,
            ownerName: userData.username,
            players: [currentUser.uid],
            maxPlayers: maxPlayers,
            minBet: minBet,
            isPrivate: password.length > 0,
            password: password,
            status: 'waiting',
            currentRound: 0,
            createdAt: Date.now(),
            chat: []
        });
        
        closeModal('create-table-modal');
        showNotification('Privater Tisch erstellt!', 'success');
        
        // Redirect to the table
        setTimeout(() => {
            window.location.href = `game.html?table=${tableId}`;
        }, 1000);
        
    } catch (error) {
        console.error('Error creating table:', error);
        showNotification('Fehler beim Erstellen des Tisches', 'error');
    }
}

function generateTableId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function formatNumber(num) {
    return num.toLocaleString('de-DE');
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    
    return new Date(timestamp).toLocaleDateString('de-DE');
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (bonusInterval) clearInterval(bonusInterval);
    if (chatListener) chatListener();
});