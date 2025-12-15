// /js/modules/friends.js
import { auth, db, currentUser, userData, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from '../config/firebase.js';

let friends = [];
let selectedFriends = [];

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
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
    });
});

async function loadUserData() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
        }
    } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
    }
}

async function loadFriends() {
    try {
        const friendsQuery = query(
            collection(db, 'friends'),
            where('users', 'array-contains', currentUser.uid)
        );
        
        const snapshot = await getDocs(friendsQuery);
        friends = [];
        const container = document.getElementById('friends-list');
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-data">Du hast noch keine Freunde</div>';
            updateFriendCount(0);
            return;
        }
        
        // Freundesdaten laden
        const friendPromises = [];
        snapshot.forEach(docSnap => {
            const friendship = docSnap.data();
            const friendId = friendship.users.find(id => id !== currentUser.uid);
            if (friendId) {
                friendPromises.push(getDoc(doc(db, 'users', friendId)));
            }
        });
        
        const friendDocs = await Promise.all(friendPromises);
        container.innerHTML = '';
        
        friendDocs.forEach(docSnap => {
            if (docSnap.exists()) {
                const friend = docSnap.data();
                friends.push(friend);
                container.appendChild(createFriendCard(friend));
            }
        });
        
        updateFriendCount(friends.length);
        
    } catch (error) {
        console.error('Fehler beim Laden der Freunde:', error);
        showNotification('Fehler beim Laden der Freunde', 'error');
    }
}

function createFriendCard(friend) {
    const div = document.createElement('div');
    div.className = 'friend-card';
    div.innerHTML = `
        <div class="friend-header">
            <img src="${friend.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username)}&background=00ff88&color=000`}" 
                 alt="Avatar" class="friend-avatar">
            <div class="friend-info">
                <h4>${friend.username}</h4>
                <div class="friend-stats">
                    <span><i class="fas fa-coins"></i> ${formatNumber(friend.chips || 0)} Chips</span>
                    <span><i class="fas fa-trophy"></i> Level ${Math.floor((friend.xp || 0) / 1000) + 1}</span>
                </div>
            </div>
        </div>
        <div class="friend-actions">
            <button class="btn-action btn-invite" onclick="inviteToTable('${friend.uid}')">
                <i class="fas fa-gamepad"></i>
                Zum Spiel einladen
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
    const queryInput = document.getElementById('friend-search').value.trim();
    
    if (!queryInput) {
        showNotification('Bitte Suchbegriff eingeben', 'warning');
        return;
    }
    
    try {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<div class="loading">Suche...</div>';
        
        const usersQuery = query(
            collection(db, 'users'),
            where('username', '>=', queryInput),
            where('username', '<=', queryInput + '\uf8ff'),
            limit(20)
        );
        
        const snapshot = await getDocs(usersQuery);
        resultsContainer.innerHTML = '';
        
        if (snapshot.empty) {
            resultsContainer.innerHTML = '<div class="no-data">Keine Spieler gefunden</div>';
            return;
        }
        
        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            if (docSnap.id === currentUser.uid) return;
            
            const isFriend = friends.some(f => f.uid === docSnap.id);
            
            const resultDiv = document.createElement('div');
            resultDiv.className = 'search-result-item';
            resultDiv.innerHTML = `
                <div class="search-result-info">
                    <img src="${user.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=00ff88&color=000`}" 
                         alt="Avatar" class="search-result-avatar">
                    <div class="search-result-details">
                        <h4>${user.username}</h4>
                        <p>${formatNumber(user.chips || 0)} Chips • Level ${Math.floor((user.xp || 0) / 1000) + 1}</p>
                    </div>
                </div>
                <div class="search-result-actions">
                    ${isFriend ? 
                        '<span class="already-friend">Bereits befreundet</span>' : 
                        `<button class="btn-accept" onclick="sendFriendRequest('${docSnap.id}')">
                            <i class="fas fa-user-plus"></i>
                            Freund hinzufügen
                        </button>`
                    }
                </div>
            `;
            
            resultsContainer.appendChild(resultDiv);
        });
        
    } catch (error) {
        console.error('Fehler bei der Suche:', error);
        showNotification('Fehler bei der Suche', 'error');
    }
}

async function sendFriendRequest(friendId) {
    try {
        // Prüfen ob Anfrage bereits existiert
        const existingRequestsQuery = query(
            collection(db, 'friend_requests'),
            where('from', '==', currentUser.uid),
            where('to', '==', friendId),
            where('status', '==', 'pending')
        );
        
        const existingRequests = await getDocs(existingRequestsQuery);
        if (!existingRequests.empty) {
            showNotification('Anfrage bereits gesendet', 'warning');
            return;
        }
        
        // Anfrage erstellen
        await addDoc(collection(db, 'friend_requests'), {
            from: currentUser.uid,
            to: friendId,
            status: 'pending',
            timestamp: Date.now()
        });
        
        // Benachrichtigung senden
        await addDoc(collection(db, 'notifications'), {
            userId: friendId,
            type: 'friend_request',
            message: `${userData.username} möchte dich als Freund hinzufügen`,
            read: false,
            timestamp: Date.now(),
            data: {
                from: currentUser.uid,
                fromName: userData.username
            }
        });
        
        showNotification('Freundesanfrage gesendet!', 'success');
        
    } catch (error) {
        console.error('Fehler beim Senden der Anfrage:', error);
        showNotification('Fehler beim Senden', 'error');
    }
}

async function loadFriendRequests() {
    try {
        const requestsQuery = query(
            collection(db, 'friend_requests'),
            where('to', '==', currentUser.uid),
            where('status', '==', 'pending'),
            orderBy('timestamp', 'desc')
        );
        
        const snapshot = await getDocs(requestsQuery);
        const container = document.getElementById('friend-requests');
        container.innerHTML = '';
        
        document.getElementById('requests-count').textContent = snapshot.size;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-data">Keine ausstehenden Anfragen</div>';
            return;
        }
        
        for (const docSnap of snapshot.docs) {
            const request = docSnap.data();
            const userDoc = await getDoc(doc(db, 'users', request.from));
            
            if (userDoc.exists()) {
                const user = userDoc.data();
                container.appendChild(createRequestItem(docSnap.id, request, user));
            }
        }
        
    } catch (error) {
        console.error('Fehler beim Laden der Anfragen:', error);
    }
}

function createRequestItem(requestId, request, sender) {
    const div = document.createElement('div');
    div.className = 'request-item';
    div.innerHTML = `
        <div class="request-info">
            <img src="${sender.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(sender.username)}&background=00ff88&color=000`}" 
                 alt="Avatar" class="request-avatar">
            <div class="request-details">
                <h4>${sender.username}</h4>
                <p>Möchte dich als Freund hinzufügen</p>
                <small>${formatTime(request.timestamp)}</small>
            </div>
        </div>
        <div class="request-actions">
            <button class="btn-accept" onclick="acceptFriendRequest('${requestId}', '${sender.uid}')">
                <i class="fas fa-check"></i>
                Akzeptieren
            </button>
            <button class="btn-decline" onclick="declineFriendRequest('${requestId}')">
                <i class="fas fa-times"></i>
                Ablehnen
            </button>
        </div>
    `;
    return div;
}

async function acceptFriendRequest(requestId, friendId) {
    try {
        // Freundschaft erstellen
        await addDoc(collection(db, 'friends'), {
            users: [currentUser.uid, friendId],
            createdAt: Date.now()
        });
        
        // Anfrage aktualisieren
        await updateDoc(doc(db, 'friend_requests', requestId), {
            status: 'accepted',
            respondedAt: Date.now()
        });
        
        // Freundeszahlen aktualisieren
        await updateFriendCounts(currentUser.uid, friendId);
        
        showNotification('Freund hinzugefügt!', 'success');
        
        // Neu laden
        await loadFriends();
        await loadFriendRequests();
        
    } catch (error) {
        console.error('Fehler beim Akzeptieren:', error);
        showNotification('Fehler beim Akzeptieren', 'error');
    }
}

async function declineFriendRequest(requestId) {
    try {
        await updateDoc(doc(db, 'friend_requests', requestId), {
            status: 'declined',
            respondedAt: Date.now()
        });
        
        showNotification('Anfrage abgelehnt', 'info');
        await loadFriendRequests();
        
    } catch (error) {
        console.error('Fehler beim Ablehnen:', error);
        showNotification('Fehler beim Ablehnen', 'error');
    }
}

async function removeFriend(friendId) {
    if (!confirm('Freund wirklich entfernen?')) return;
    
    try {
        const friendshipQuery = query(
            collection(db, 'friends'),
            where('users', 'array-contains', currentUser.uid)
        );
        
        const snapshot = await getDocs(friendshipQuery);
        
        snapshot.forEach(async (docSnap) => {
            const friendship = docSnap.data();
            if (friendship.users.includes(friendId)) {
                await deleteDoc(doc(db, 'friends', docSnap.id));
            }
        });
        
        await updateFriendCounts(currentUser.uid, friendId);
        showNotification('Freund entfernt', 'info');
        await loadFriends();
        
    } catch (error) {
        console.error('Fehler beim Entfernen:', error);
        showNotification('Fehler beim Entfernen', 'error');
    }
}

async function updateFriendCounts(userId1, userId2) {
    try {
        const countQuery1 = query(
            collection(db, 'friends'),
            where('users', 'array-contains', userId1)
        );
        const countQuery2 = query(
            collection(db, 'friends'),
            where('users', 'array-contains', userId2)
        );
        
        const [snapshot1, snapshot2] = await Promise.all([
            getDocs(countQuery1),
            getDocs(countQuery2)
        ]);
        
        await Promise.all([
            updateDoc(doc(db, 'users', userId1), {
                friendCount: snapshot1.size
            }),
            updateDoc(doc(db, 'users', userId2), {
                friendCount: snapshot2.size
            })
        ]);
        
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Freundeszahlen:', error);
    }
}

function updateFriendCount(count) {
    const countElement = document.getElementById('friends-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    
    return new Date(timestamp).toLocaleDateString('de-DE');
}

function setupEventListeners() {
    document.getElementById('search-btn')?.addEventListener('click', searchUsers);
    document.getElementById('friend-search')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });
    
    document.getElementById('create-private-table-btn')?.addEventListener('click', createPrivateTable);
}

function showTab(tabId) {
    // Tabs verstecken
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.friends-tabs .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Ausgewählten Tab anzeigen
    document.getElementById(`${tabId}-tab`).classList.add('active');
    document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
}

// Globale Funktionen
window.searchUsers = searchUsers;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.removeFriend = removeFriend;
window.showTab = showTab;
window.createPrivateTable = createPrivateTable;