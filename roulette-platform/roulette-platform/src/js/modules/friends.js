import { 
    auth, database, onAuthStateChanged,
    ref, get, set, update, remove, push, query, orderByChild, equalTo, onValue, off
} from '../config/firebase.js';
import { formatNumber, showNotification } from '../utils.js';

let currentUser = null;
let userData = null;
let friends = [];
let friendRequests = [];
let privateTables = [];
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
        showTab('friends-list');
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, 'users/' + currentUser.uid));
        if (snapshot.exists()) {
            userData = snapshot.val();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Fehler beim Laden der Daten', 'error');
    }
}

function setupRealTimeListeners() {
    // Listen for friends
    const friendsRef = ref(database, `friends/${currentUser.uid}`);
    listeners.push(
        onValue(friendsRef, (snapshot) => {
            loadFriends(snapshot);
        })
    );
    
    // Listen for friend requests
    const requestsRef = query(ref(database, 'friend_requests'), orderByChild('to'), equalTo(currentUser.uid));
    listeners.push(
        onValue(requestsRef, (snapshot) => {
            loadFriendRequests(snapshot);
        })
    );
    
    // Listen for private tables
    const tablesRef = query(ref(database, 'tables'), orderByChild('owner'), equalTo(currentUser.uid));
    listeners.push(
        onValue(tablesRef, (snapshot) => {
            loadPrivateTables(snapshot);
        })
    );
}

async function loadFriends(snapshot) {
    const container = document.getElementById('friends-list');
    if (!container) return;
    
    container.innerHTML = '';
    friends = [];
    
    if (!snapshot.exists()) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-user-friends"></i>
                <p>Du hast noch keine Freunde</p>
                <button class="btn-action small" onclick="showTab('friend-requests')">
                    Freunde finden
                </button>
            </div>
        `;
        updateFriendCount(0);
        return;
    }
    
    const friendIds = Object.keys(snapshot.val());
    
    // Load friend details
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
}

function createFriendCard(friend) {
    const div = document.createElement('div');
    div.className = 'friend-card';
    
    const status = friend.isOnline ? 'online' : 'offline';
    const statusText = friend.isOnline ? 'Online' : 'Offline';
    const lastSeen = friend.lastSeen ? formatTime(friend.lastSeen) : '';
    
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
                <div class="friend-status ${status}" title="${lastSeen}">
                    <i class="fas fa-circle"></i>
                    ${statusText}
                </div>
            </div>
        </div>
        <div class="friend-actions">
            <button class="btn-action btn-invite" onclick="inviteToGame('${friend.uid}', '${friend.username}')">
                <i class="fas fa-gamepad"></i>
                Spielen
            </button>
            <button class="btn-action btn-chat" onclick="startChat('${friend.uid}')">
                <i class="fas fa-comment"></i>
                Chat
            </button>
            <button class="btn-action btn-remove" onclick="removeFriend('${friend.uid}', '${friend.username}')">
                <i class="fas fa-user-times"></i>
                Entfernen
            </button>
        </div>
    `;
    
    return div;
}

async function loadFriendRequests(snapshot) {
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
        if (request.status === 'pending') {
            requests.push({ id: child.key, ...request });
        }
    });
    
    friendRequests = requests;
    
    if (requests.length === 0) {
        container.innerHTML = '<div class="no-data">Keine ausstehenden Anfragen</div>';
        updateRequestsCount(0);
        return;
    }
    
    // Get sender details for each request
    for (const request of requests) {
        const userSnap = await get(ref(database, 'users/' + request.from));
        if (userSnap.exists()) {
            const sender = userSnap.val();
            container.appendChild(createRequestItem(request, sender));
        }
    }
    
    updateRequestsCount(requests.length);
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
        
        // Check pending requests
        const requestsRef = query(ref(database, 'friend_requests'), orderByChild('from'), equalTo(currentUser.uid));
        const requestsSnapshot = await get(requestsRef);
        const pendingRequests = [];
        
        if (requestsSnapshot.exists()) {
            requestsSnapshot.forEach(child => {
                const req = child.val();
                if (req.status === 'pending') {
                    pendingRequests.push(req.to);
                }
            });
        }
        
        searchResults.forEach(user => {
            const isFriend = friendIds.includes(user.uid);
            const isRequestSent = pendingRequests.includes(user.uid);
            
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
        console.error('Error searching users:', error);
        showNotification('Fehler bei der Suche', 'error');
    }
}

async function sendFriendRequest(friendId) {
    try {
        // Check if request already exists
        const requestsRef = query(ref(database, 'friend_requests'), 
            orderByChild('from'), 
            equalTo(currentUser.uid));
        
        const snapshot = await get(requestsRef);
        let requestExists = false;
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const req = child.val();
                if (req.to === friendId && req.status === 'pending') {
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
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        showNotification('Fehler beim Senden der Anfrage', 'error');
    }
}

async function acceptFriendRequest(requestId, friendId) {
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
        await update(ref(database, `users/${currentUser.uid}`), {
            friendCount: friends.length + 1
        });
        
        const friendSnap = await get(ref(database, `users/${friendId}`));
        if (friendSnap.exists()) {
            const friend = friendSnap.val();
            await update(ref(database, `users/${friendId}`), {
                friendCount: (friend.friendCount || 0) + 1
            });
        }
        
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
        
    } catch (error) {
        console.error('Error accepting friend request:', error);
        showNotification('Fehler beim Akzeptieren', 'error');
    }
}

async function declineFriendRequest(requestId) {
    try {
        await update(ref(database, `friend_requests/${requestId}`), {
            status: 'declined',
            respondedAt: Date.now()
        });
        
        showNotification('Anfrage abgelehnt', 'info');
        
    } catch (error) {
        console.error('Error declining friend request:', error);
        showNotification('Fehler beim Ablehnen', 'error');
    }
}

async function removeFriend(friendId, friendName) {
    if (!confirm(`Freund ${friendName} wirklich entfernen?`)) return;
    
    try {
        await Promise.all([
            remove(ref(database, `friends/${currentUser.uid}/${friendId}`)),
            remove(ref(database, `friends/${friendId}/${currentUser.uid}`))
        ]);
        
        // Update friend counts
        await update(ref(database, `users/${currentUser.uid}`), {
            friendCount: Math.max(0, (userData.friendCount || 0) - 1)
        });
        
        const friendSnap = await get(ref(database, `users/${friendId}`));
        if (friendSnap.exists()) {
            const friend = friendSnap.val();
            await update(ref(database, `users/${friendId}`), {
                friendCount: Math.max(0, (friend.friendCount || 0) - 1)
            });
        }
        
        showNotification('Freund entfernt', 'info');
        
    } catch (error) {
        console.error('Error removing friend:', error);
        showNotification('Fehler beim Entfernen', 'error');
    }
}

async function loadPrivateTables(snapshot) {
    const container = document.getElementById('private-tables');
    if (!container) return;
    
    container.innerHTML = '';
    privateTables = [];
    
    if (!snapshot.exists()) {
        container.innerHTML = '<div class="no-data">Noch keine privaten Tische</div>';
        return;
    }
    
    snapshot.forEach(child => {
        const table = child.val();
        if (table.isPrivate) {
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
}

function createPrivateTableCard(table) {
    const div = document.createElement('div');
    div.className = 'private-table-card';
    
    const playerCount = table.players ? Object.keys(table.players).length : 0;
    const maxPlayers = table.maxPlayers || 4;
    const status = table.status || 'waiting';
    
    div.innerHTML = `
        <div class="table-header">
            <h4><i class="fas fa-lock"></i> ${table.name}</h4>
            <span class="table-status ${status}">${status === 'waiting' ? 'Wartend' : 'Aktiv'}</span>
        </div>
        <div class="table-info">
            <div class="table-detail">
                <i class="fas fa-users"></i>
                <span>Spieler: ${playerCount}/${maxPlayers}</span>
            </div>
            <div class="table-detail">
                <i class="fas fa-coins"></i>
                <span>Min. Einsatz: ${formatNumber(table.minBet || 50)}</span>
            </div>
            <div class="table-detail">
                <i class="fas fa-clock"></i>
                <span>Erstellt: ${formatTime(table.createdAt)}</span>
            </div>
        </div>
        <div class="table-actions">
            <button class="btn-action" onclick="joinPrivateTable('${table.id}')">
                <i class="fas fa-door-open"></i> Beitreten
            </button>
            <button class="btn-danger" onclick="deletePrivateTable('${table.id}')">
                <i class="fas fa-trash"></i> Löschen
            </button>
        </div>
    `;
    
    return div;
}

async function createPrivateTable() {
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
            invitedFriends: [],
            maxPlayers: 4,
            minBet: 50,
            isPrivate: true,
            password: null,
            status: 'waiting',
            createdAt: Date.now()
        };
        
        await set(ref(database, 'tables/' + tableId), tableData);
        
        showNotification('🔒 Privater Tisch erstellt!', 'success');
        
        // Open invite modal
        openInviteModal(tableId);
        
    } catch (error) {
        console.error('Error creating private table:', error);
        showNotification('Fehler beim Erstellen', 'error');
    }
}

function openInviteModal(tableId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'invite-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> Freunde einladen</h3>
                <button class="close-modal" onclick="closeInviteModal()">×</button>
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
                                       data-friend-id="${friend.uid}">
                            </div>
                        `).join('')
                    }
                </div>
                <div class="modal-actions">
                    <button class="btn-action" onclick="sendTableInvites('${tableId}')">
                        <i class="fas fa-paper-plane"></i>
                        Einladungen senden
                    </button>
                    <button class="btn-secondary" onclick="joinPrivateTable('${tableId}')">
                        <i class="fas fa-play"></i>
                        Direkt starten
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function sendTableInvites(tableId) {
    const checkboxes = document.querySelectorAll('#invite-friends-list input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        showNotification('Keine Freunde ausgewählt', 'warning');
        return;
    }
    
    const friendIds = Array.from(checkboxes).map(cb => cb.dataset.friendId);
    
    try {
        // Update table with invited friends
        await update(ref(database, `tables/${tableId}`), {
            invitedFriends: friendIds
        });
        
        // Send notifications to friends
        const invitePromises = friendIds.map(friendId => 
            push(ref(database, `notifications/${friendId}`), {
                type: 'game_invite',
                message: `${userData.username} lädt dich zu einem privaten Roulette-Tisch ein`,
                data: {
                    tableId: tableId,
                    from: currentUser.uid,
                    fromName: userData.username
                },
                timestamp: Date.now(),
                read: false
            })
        );
        
        await Promise.all(invitePromises);
        
        showNotification(`${friendIds.length} Einladungen gesendet!`, 'success');
        closeInviteModal();
        
    } catch (error) {
        console.error('Error sending invites:', error);
        showNotification('Fehler beim Senden der Einladungen', 'error');
    }
}

async function joinPrivateTable(tableId) {
    window.location.href = `game.html?table=${tableId}`;
}

async function deletePrivateTable(tableId) {
    if (!confirm('Privaten Tisch wirklich löschen?')) return;
    
    try {
        await remove(ref(database, `tables/${tableId}`));
        showNotification('Tisch gelöscht', 'success');
    } catch (error) {
        console.error('Error deleting table:', error);
        showNotification('Fehler beim Löschen', 'error');
    }
}

async function inviteToGame(friendId, friendName) {
    try {
        // Create a private table first
        const tableId = 'invite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const tableData = {
            id: tableId,
            name: `${userData.username} vs ${friendName}`,
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
            invitedFriends: [friendId],
            maxPlayers: 2,
            minBet: 10,
            isPrivate: true,
            status: 'waiting',
            createdAt: Date.now()
        };
        
        await set(ref(database, 'tables/' + tableId), tableData);
        
        // Send notification
        await push(ref(database, `notifications/${friendId}`), {
            type: 'game_invite',
            message: `${userData.username} fordert dich zu einem Roulette-Duell heraus!`,
            data: {
                tableId: tableId,
                from: currentUser.uid,
                fromName: userData.username
            },
            timestamp: Date.now(),
            read: false
        });
        
        showNotification(`Spieleinladung an ${friendName} gesendet!`, 'success');
        
    } catch (error) {
        console.error('Error inviting to game:', error);
        showNotification('Fehler beim Senden der Einladung', 'error');
    }
}

async function startChat(friendId) {
    // Open chat modal or redirect to chat page
    showNotification('Chat-Funktion kommt bald!', 'info');
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

function formatTime(timestamp) {
    if (!timestamp) return 'Vor kurzem';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    
    return new Date(timestamp).toLocaleDateString('de-DE');
}

function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00ff88&color=000&bold=true`;
}

function showTab(tabId) {
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
}

function closeInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (modal) modal.remove();
}

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
    const createTableBtn = document.querySelector('.tables-controls .btn-primary');
    if (createTableBtn) {
        createTableBtn.addEventListener('click', createPrivateTable);
    }
}

// Clean up listeners
window.addEventListener('beforeunload', () => {
    listeners.forEach(listener => off(listener));
});

// Make functions globally available
window.searchUsers = searchUsers;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.removeFriend = removeFriend;
window.showTab = showTab;
window.createPrivateTable = createPrivateTable;
window.joinPrivateTable = joinPrivateTable;
window.deletePrivateTable = deletePrivateTable;
window.inviteToGame = inviteToGame;
window.startChat = startChat;
window.closeInviteModal = closeInviteModal;
window.sendTableInvites = sendTableInvites;