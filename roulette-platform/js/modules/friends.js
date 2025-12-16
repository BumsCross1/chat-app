import { 
    auth, database, onAuthStateChanged,
    ref, get, set, update, push, remove, query, orderByChild, equalTo, limitToLast
} from '../config/firebase.js';

let currentUser = null;
let userData = null;
let friends = [];
let friendRequests = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        await loadFriends();
        await loadFriendRequests();
        await loadPrivateTables();
        
        setupEventListeners();
        showTab('friends-list');
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, 'users/' + currentUser.uid));
        if (snapshot.exists()) {
            userData = snapshot.val();
            updateFriendCount();
        }
    } catch (error) {
        console.error('Benutzerdaten Fehler:', error);
    }
}

async function loadFriends() {
    try {
        // In Realtime Database speichern wir Freundschaften unter /friends/userId/friendId
        const friendsRef = ref(database, `friends/${currentUser.uid}`);
        const snapshot = await get(friendsRef);
        
        const container = document.getElementById('friends-list');
        if (!container) return;
        
        container.innerHTML = '';
        friends = [];
        
        if (!snapshot.exists()) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-user-friends"></i>
                    <p>Du hast noch keine Freunde</p>
                    <button class="btn-action small" onclick="showTab('search')">
                        Freunde finden
                    </button>
                </div>
            `;
            updateFriendCount(0);
            return;
        }
        
        const friendIds = Object.keys(snapshot.val());
        const friendPromises = friendIds.map(id => get(ref(database, 'users/' + id)));
        const friendSnapshots = await Promise.all(friendPromises);
        
        friendSnapshots.forEach((friendSnap, index) => {
            if (friendSnap.exists()) {
                const friend = friendSnap.val();
                friends.push(friend);
                container.appendChild(createFriendCard(friend));
            }
        });
        
        updateFriendCount(friends.length);
        
    } catch (error) {
        console.error('Freunde laden Fehler:', error);
        showNotification('Fehler beim Laden der Freunde', 'error');
    }
}

function createFriendCard(friend) {
    const div = document.createElement('div');
    div.className = 'friend-card';
    div.innerHTML = `
        <div class="friend-header">
            <img src="${friend.profileImage || getDefaultAvatar(friend.username)}" 
                 alt="${friend.username}" class="friend-avatar">
            <div class="friend-info">
                <h4>${friend.username}</h4>
                <div class="friend-stats">
                    <span><i class="fas fa-coins"></i> ${formatNumber(friend.chips || 0)}</span>
                    <span><i class="fas fa-trophy"></i> Level ${Math.floor((friend.xp || 0) / 1000) + 1}</span>
                    <span><i class="fas fa-gamepad"></i> ${friend.gamesPlayed || 0}</span>
                </div>
                <div class="friend-status ${friend.isOnline ? 'online' : 'offline'}">
                    <i class="fas fa-circle"></i>
                    ${friend.isOnline ? 'Online' : 'Offline'}
                </div>
            </div>
        </div>
        <div class="friend-actions">
            <button class="btn-action btn-invite" onclick="inviteToGame('${friend.uid}')">
                <i class="fas fa-gamepad"></i>
                Zum Spiel
            </button>
            <button class="btn-action btn-chat" onclick="startChat('${friend.uid}')">
                <i class="fas fa-comment"></i>
                Chat
            </button>
            <button class="btn-action btn-remove" onclick="removeFriend('${friend.uid}')">
                <i class="fas fa-user-times"></i>
                Entfernen
            </button>
        </div>
    `;
    return div;
}

async function searchUsers() {
    const searchInput = document.getElementById('friend-search');
    if (!searchInput) return;
    
    const queryText = searchInput.value.trim().toLowerCase();
    if (!queryText) {
        showNotification('Bitte Suchbegriff eingeben', 'warning');
        return;
    }
    
    try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        const resultsContainer = document.getElementById('search-results');
        
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Suche...</div>';
        
        if (!snapshot.exists()) {
            resultsContainer.innerHTML = '<div class="no-data">Keine Spieler gefunden</div>';
            return;
        }
        
        const allUsers = [];
        snapshot.forEach(child => {
            const user = child.val();
            if (user.uid !== currentUser.uid) {
                allUsers.push(user);
            }
        });
        
        // Filter by username
        const searchResults = allUsers.filter(user => 
            user.username.toLowerCase().includes(queryText)
        );
        
        resultsContainer.innerHTML = '';
        
        if (searchResults.length === 0) {
            resultsContainer.innerHTML = '<div class="no-data">Keine Spieler gefunden</div>';
            return;
        }
        
        // Check which users are already friends
        const friendsRef = ref(database, `friends/${currentUser.uid}`);
        const friendsSnapshot = await get(friendsRef);
        const friendIds = friendsSnapshot.exists() ? Object.keys(friendsSnapshot.val()) : [];
        
        searchResults.forEach(user => {
            const isFriend = friendIds.includes(user.uid);
            const isRequestSent = friendRequests.some(req => req.to === user.uid);
            
            const resultDiv = document.createElement('div');
            resultDiv.className = 'search-result-item';
            resultDiv.innerHTML = `
                <div class="search-result-info">
                    <img src="${user.profileImage || getDefaultAvatar(user.username)}" 
                         alt="${user.username}" class="search-result-avatar">
                    <div class="search-result-details">
                        <h4>${user.username}</h4>
                        <p><i class="fas fa-coins"></i> ${formatNumber(user.chips || 0)} Chips</p>
                        <p><i class="fas fa-trophy"></i> Level ${Math.floor((user.xp || 0) / 1000) + 1}</p>
                    </div>
                </div>
                <div class="search-result-actions">
                    ${isFriend ? 
                        '<span class="already-friend"><i class="fas fa-check"></i> Bereits befreundet</span>' : 
                        isRequestSent ?
                        '<span class="request-sent"><i class="fas fa-clock"></i> Anfrage gesendet</span>' :
                        `<button class="btn-accept" onclick="sendFriendRequest('${user.uid}')">
                            <i class="fas fa-user-plus"></i>
                            Freund hinzufügen
                        </button>`
                    }
                </div>
            `;
            
            resultsContainer.appendChild(resultDiv);
        });
        
    } catch (error) {
        console.error('Suche Fehler:', error);
        showNotification('Fehler bei der Suche', 'error');
    }
}

window.sendFriendRequest = async function(friendId) {
    try {
        // Check if request already exists
        const requestsRef = ref(database, 'friend_requests');
        const snapshot = await get(requestsRef);
        
        let requestExists = false;
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const req = child.val();
                if (req.from === currentUser.uid && req.to === friendId && req.status === 'pending') {
                    requestExists = true;
                }
            });
        }
        
        if (requestExists) {
            showNotification('Anfrage bereits gesendet', 'warning');
            return;
        }
        
        // Create request
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const requestData = {
            id: requestId,
            from: currentUser.uid,
            fromName: userData.username,
            to: friendId,
            status: 'pending',
            timestamp: Date.now()
        };
        
        await set(ref(database, `friend_requests/${requestId}`), requestData);
        
        // Add notification for friend
        await push(ref(database, `notifications/${friendId}`), {
            type: 'friend_request',
            message: `${userData.username} möchte dich als Freund hinzufügen`,
            data: {
                from: currentUser.uid,
                fromName: userData.username,
                requestId: requestId
            },
            timestamp: Date.now(),
            read: false
        });
        
        showNotification('Freundesanfrage gesendet!', 'success');
        
        // Reload requests
        await loadFriendRequests();
        
    } catch (error) {
        console.error('Anfrage senden Fehler:', error);
        showNotification('Fehler beim Senden der Anfrage', 'error');
    }
};

async function loadFriendRequests() {
    try {
        const requestsRef = ref(database, 'friend_requests');
        const snapshot = await get(requestsRef);
        
        const container = document.getElementById('friend-requests');
        if (!container) return;
        
        container.innerHTML = '';
        friendRequests = [];
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data">Keine ausstehenden Anfragen</div>';
            updateRequestsCount(0);
            return;
        }
        
        const requests = [];
        snapshot.forEach(child => {
            const request = child.val();
            if (request.to === currentUser.uid && request.status === 'pending') {
                requests.push(request);
            }
        });
        
        friendRequests = requests;
        
        if (requests.length === 0) {
            container.innerHTML = '<div class="no-data">Keine ausstehenden Anfragen</div>';
            updateRequestsCount(0);
            return;
        }
        
        // Get sender details
        for (const request of requests) {
            const userSnap = await get(ref(database, 'users/' + request.from));
            if (userSnap.exists()) {
                const sender = userSnap.val();
                container.appendChild(createRequestItem(request, sender));
            }
        }
        
        updateRequestsCount(requests.length);
        
    } catch (error) {
        console.error('Anfragen laden Fehler:', error);
    }
}

function createRequestItem(request, sender) {
    const div = document.createElement('div');
    div.className = 'request-item';
    div.innerHTML = `
        <div class="request-info">
            <img src="${sender.profileImage || getDefaultAvatar(sender.username)}" 
                 alt="${sender.username}" class="request-avatar">
            <div class="request-details">
                <h4>${sender.username}</h4>
                <p>Möchte dich als Freund hinzufügen</p>
                <small><i class="fas fa-clock"></i> ${formatTime(request.timestamp)}</small>
            </div>
        </div>
        <div class="request-actions">
            <button class="btn-accept" onclick="acceptFriendRequest('${request.id}', '${sender.uid}')">
                <i class="fas fa-check"></i>
                Akzeptieren
            </button>
            <button class="btn-decline" onclick="declineFriendRequest('${request.id}')">
                <i class="fas fa-times"></i>
                Ablehnen
            </button>
        </div>
    `;
    return div;
}

window.acceptFriendRequest = async function(requestId, friendId) {
    try {
        // Add friendship for both users
        const timestamp = Date.now();
        
        await Promise.all([
            // Add friend to current user's list
            set(ref(database, `friends/${currentUser.uid}/${friendId}`), {
                since: timestamp,
                status: 'accepted'
            }),
            // Add current user to friend's list
            set(ref(database, `friends/${friendId}/${currentUser.uid}`), {
                since: timestamp,
                status: 'accepted'
            }),
            // Update request status
            update(ref(database, `friend_requests/${requestId}`), {
                status: 'accepted',
                respondedAt: timestamp
            })
        ]);
        
        // Update friend counts
        await updateFriendCounts(currentUser.uid, friendId);
        
        // Add notifications
        await Promise.all([
            push(ref(database, `notifications/${friendId}`), {
                type: 'friend_accepted',
                message: `${userData.username} hat deine Freundesanfrage akzeptiert`,
                timestamp: Date.now(),
                read: false
            }),
            push(ref(database, `notifications/${currentUser.uid}`), {
                type: 'friend_added',
                message: `Du bist jetzt mit ${userData.username} befreundet`,
                timestamp: Date.now(),
                read: false
            })
        ]);
        
        showNotification('Freund hinzugefügt!', 'success');
        
        // Reload data
        await loadFriends();
        await loadFriendRequests();
        
    } catch (error) {
        console.error('Anfrage akzeptieren Fehler:', error);
        showNotification('Fehler beim Akzeptieren', 'error');
    }
};

window.declineFriendRequest = async function(requestId) {
    try {
        await update(ref(database, `friend_requests/${requestId}`), {
            status: 'declined',
            respondedAt: Date.now()
        });
        
        showNotification('Anfrage abgelehnt', 'info');
        await loadFriendRequests();
        
    } catch (error) {
        console.error('Anfrage ablehnen Fehler:', error);
        showNotification('Fehler beim Ablehnen', 'error');
    }
};

window.removeFriend = async function(friendId) {
    if (!confirm('Freund wirklich entfernen?')) return;
    
    try {
        await Promise.all([
            remove(ref(database, `friends/${currentUser.uid}/${friendId}`)),
            remove(ref(database, `friends/${friendId}/${currentUser.uid}`))
        ]);
        
        // Update friend counts
        await updateFriendCounts(currentUser.uid, friendId);
        
        showNotification('Freund entfernt', 'info');
        await loadFriends();
        
    } catch (error) {
        console.error('Freund entfernen Fehler:', error);
        showNotification('Fehler beim Entfernen', 'error');
    }
};

async function updateFriendCounts(userId1, userId2) {
    try {
        const [snap1, snap2] = await Promise.all([
            get(ref(database, `friends/${userId1}`)),
            get(ref(database, `friends/${userId2}`))
        ]);
        
        const count1 = snap1.exists() ? Object.keys(snap1.val()).length : 0;
        const count2 = snap2.exists() ? Object.keys(snap2.val()).length : 0;
        
        await Promise.all([
            update(ref(database, `users/${userId1}`), { friendCount: count1 }),
            update(ref(database, `users/${userId2}`), { friendCount: count2 })
        ]);
        
    } catch (error) {
        console.error('Freundeszahlen aktualisieren Fehler:', error);
    }
}

function updateFriendCount(count) {
    const countElement = document.getElementById('friends-count');
    if (countElement) {
        countElement.textContent = count || 0;
    }
}

function updateRequestsCount(count) {
    const countElement = document.getElementById('requests-count');
    if (countElement) {
        countElement.textContent = count || 0;
        countElement.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Private Tables
async function loadPrivateTables() {
    try {
        const tablesRef = ref(database, 'tables');
        const snapshot = await get(tablesRef);
        
        const container = document.getElementById('private-tables');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data">Noch keine privaten Tische</div>';
            return;
        }
        
        const privateTables = [];
        snapshot.forEach(child => {
            const table = child.val();
            if (table.isPrivate && table.owner === currentUser.uid) {
                privateTables.push({ id: child.key, ...table });
            }
        });
        
        if (privateTables.length === 0) {
            container.innerHTML = '<div class="no-data">Noch keine privaten Tische</div>';
            return;
        }
        
        privateTables.forEach(table => {
            container.appendChild(createPrivateTableCard(table));
        });
        
    } catch (error) {
        console.error('Private Tische Fehler:', error);
    }
}

window.createPrivateTable = async function() {
    try {
        const tableId = 'private_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const tableData = {
            id: tableId,
            name: `${userData.username}'s Privater Tisch`,
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
            invitedFriends: [], // Array of friend IDs
            maxPlayers: 4,
            minBet: 50,
            isPrivate: true,
            password: null, // Optional password
            status: 'waiting',
            createdAt: Date.now()
        };
        
        await set(ref(database, 'tables/' + tableId), tableData);
        
        showNotification('🔒 Privater Tisch erstellt!', 'success');
        
        // Open invite modal
        openInviteModal(tableId);
        
    } catch (error) {
        console.error('Privater Tisch Fehler:', error);
        showNotification('Fehler beim Erstellen', 'error');
    }
};

function openInviteModal(tableId) {
    // Create modal for inviting friends
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> Freunde einladen</h3>
                <button class="close-modal" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="modal-body">
                <p>Lade Freunde zu deinem privaten Tisch ein:</p>
                <div id="invite-friends-list" class="friends-selector">
                    ${friends.length === 0 ? 
                        '<div class="no-data">Keine Freunde zum Einladen</div>' : 
                        friends.map(friend => `
                            <div class="friend-checkbox">
                                <div class="friend-checkbox-info">
                                    <img src="${friend.profileImage || getDefaultAvatar(friend.username)}" 
                                         alt="${friend.username}" class="checkbox-avatar">
                                    <span>${friend.username}</span>
                                </div>
                                <input type="checkbox" id="invite-${friend.uid}" 
                                       onchange="toggleFriendInvite('${friend.uid}')">
                            </div>
                        `).join('')
                    }
                </div>
                <div class="modal-actions">
                    <button class="btn-action" onclick="sendTableInvites('${tableId}')">
                        <i class="fas fa-paper-plane"></i>
                        Einladungen senden
                    </button>
                    <button class="btn-secondary" onclick="window.location.href='game.html?table=${tableId}'">
                        <i class="fas fa-play"></i>
                        Direkt starten
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Utility Functions
function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00ff88&color=000&bold=true`;
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
    
    return new Date(timestamp).toLocaleDateString('de-DE');
}

function showNotification(message, type = 'info') {
    // Same implementation as in dashboard.js
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
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 3000);
}

window.showTab = function(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.friends-tabs .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const tabContent = document.getElementById(tabId + '-tab');
    const tabButton = document.querySelector(`.friends-tabs .tab[onclick*="${tabId}"]`);
    
    if (tabContent) tabContent.classList.add('active');
    if (tabButton) tabButton.classList.add('active');
};

function setupEventListeners() {
    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchUsers);
    }
    
    // Search input Enter key
    const searchInput = document.getElementById('friend-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchUsers();
        });
    }
    
    // Create private table button
    const createTableBtn = document.getElementById('create-private-table-btn');
    if (createTableBtn) {
        createTableBtn.addEventListener('click', createPrivateTable);
    }
}

// Make functions globally available
window.searchUsers = searchUsers;
window.sendFriendRequest = window.sendFriendRequest;
window.acceptFriendRequest = window.acceptFriendRequest;
window.declineFriendRequest = window.declineFriendRequest;
window.removeFriend = window.removeFriend;
window.showTab = showTab;
window.createPrivateTable = createPrivateTable;