// ===== DASHBOARD.JS - ULTIMATIVE VERSION =====

// Globale Variablen
let currentUser = null;
let currentUserData = null;
let isAdmin = false;
let activeListeners = [];
let realtimeStats = {
    totalRooms: 0,
    activeRooms: 0,
    totalUsers: 0,
    onlineUsers: 0,
    totalMessages: 0,
    bannedUsers: 0
};

// ===== INITIALISIERUNG =====

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Dashboard wird gestartet...');
    
    try {
        await waitForFirebase();
        
        // Auth State Listener
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                await handleUserLogin(user);
            } else {
                handleLogout();
            }
        });
        
    } catch (error) {
        console.error('❌ Startfehler:', error);
        showNotification('❌ Systemfehler: ' + error.message, 'error');
    }
});

async function waitForFirebase() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.auth && window.db) {
                clearInterval(check);
                console.log('✅ Firebase bereit');
                resolve();
            }
        }, 100);
    });
}

// ===== AUTH HANDLING =====

async function handleUserLogin(user) {
    console.log('👤 User eingeloggt:', user.email);
    
    try {
        // 1. User-Daten laden/erstellen
        currentUserData = await loadOrCreateUserData(user);
        
        // 2. Admin-Status prüfen
        isAdmin = await checkAdminStatus(user);
        console.log(isAdmin ? '👑 Admin' : '👤 Normaler User');
        
        // 3. Ban/Timeout Check
        const canProceed = await checkUserRestrictions();
        if (!canProceed) return;
        
        // 4. UI initialisieren
        await initDashboard();
        
        // 5. Echtzeit-Listener starten
        startRealtimeListeners();
        
        showNotification('✅ Erfolgreich eingeloggt!', 'success');
        
    } catch (error) {
        console.error('❌ Login-Fehler:', error);
        showNotification('❌ Login fehlgeschlagen', 'error');
    }
}

async function loadOrCreateUserData(user) {
    try {
        const userRef = window.db.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        
        if (snapshot.exists()) {
            // Existierender User - Update
            const existingData = snapshot.val();
            const updates = {
                lastLogin: Date.now(),
                status: 'online',
                lastSeen: Date.now()
            };
            
            // DisplayName aktualisieren falls geändert
            if (user.displayName && user.displayName !== existingData.displayName) {
                updates.displayName = user.displayName;
            }
            
            await userRef.update(updates);
            return { ...existingData, ...updates };
            
        } else {
            // Neuer User
            const newUserData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                avatar: generateAvatar(user.email),
                createdAt: Date.now(),
                lastLogin: Date.now(),
                status: 'online',
                role: 'user',
                isAdmin: false,
                messageCount: 0,
                roomsCreated: 0,
                reactionsReceived: 0,
                friendsCount: 0,
                isBanned: false,
                isTimedOut: false,
                warnings: 0,
                lastSeen: Date.now()
            };
            
            await userRef.set(newUserData);
            return newUserData;
        }
    } catch (error) {
        console.error('❌ User-Daten Fehler:', error);
        throw error;
    }
}

async function checkAdminStatus(user) {
    try {
        // 1. Direkter Email-Check
        if (user.email === 'martinherklotzt02@gmail.com') {
            await window.db.ref('users/' + user.uid).update({
                role: 'admin',
                isAdmin: true,
                adminSince: Date.now()
            });
            return true;
        }
        
        // 2. Firebase-Check
        const snapshot = await window.db.ref('users/' + user.uid).once('value');
        const data = snapshot.val();
        return data ? (data.role === 'admin' || data.isAdmin === true) : false;
        
    } catch (error) {
        console.error('❌ Admin-Check Fehler:', error);
        return false;
    }
}

async function checkUserRestrictions() {
    try {
        const snapshot = await window.db.ref('users/' + currentUser.uid).once('value');
        const data = snapshot.val();
        
        if (!data) return true;
        
        // Ban Check
        if (data.isBanned === true) {
            await handleBan(data);
            return false;
        }
        
        // Timeout Check
        if (data.isTimedOut === true && data.timeoutUntil > Date.now()) {
            const minutes = Math.ceil((data.timeoutUntil - Date.now()) / 60000);
            alert(`⏰ Account für ${minutes} Minuten gesperrt!\nGrund: ${data.timeoutReason || 'Timeout'}`);
            await window.auth.signOut();
            return false;
        } else if (data.isTimedOut === true && data.timeoutUntil <= Date.now()) {
            // Timeout abgelaufen - entfernen
            await window.db.ref('users/' + currentUser.uid).update({
                isTimedOut: false,
                timeoutUntil: null,
                timeoutReason: null
            });
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Restriction Check:', error);
        return true;
    }
}

async function handleBan(userData) {
    localStorage.clear();
    sessionStorage.clear();
    
    alert(`🚫 Account gesperrt!\nGrund: ${userData.banReason || 'Verstoß gegen Regeln'}`);
    
    await window.auth.signOut();
    window.location.href = 'index.html';
}

// ===== DASHBOARD INIT =====

async function initDashboard() {
    console.log('🎨 Dashboard wird initialisiert...');
    
    try {
        // Theme setzen
        initTheme();
        
        // User-Info laden
        await loadUserInfo();
        
        // Event Listener
        setupEventListeners();
        
        // User-Search initialisieren
        initUserSearch();
        
        // Räume laden
        loadRooms();
        
        // Standard-Sektion zeigen
        showSection('rooms');
        
        // Echtzeit-Statistiken
        initRealtimeStats();
        
        // Admin-Panel falls Admin
        if (isAdmin) {
            document.getElementById('admin-menu-item').style.display = 'flex';
            initAdminSystem();
        }
        
        console.log('✅ Dashboard bereit');
        
    } catch (error) {
        console.error('❌ Dashboard Init Fehler:', error);
        showNotification('❌ Dashboard konnte nicht geladen werden', 'error');
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('chat-theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.getElementById('dashboard-theme-icon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    }
}

async function loadUserInfo() {
    try {
        // Avatar laden
        const avatar = await loadAvatar();
        const avatarElements = document.querySelectorAll('#user-avatar, #profile-avatar');
        avatarElements.forEach(el => {
            if (el) {
                el.src = avatar;
                el.onerror = () => el.src = generateAvatar(currentUserData.displayName);
            }
        });
        
        // Display Name
        const displayName = currentUserData.displayName || currentUser.email;
        document.getElementById('user-displayname').textContent = displayName;
        document.getElementById('displayName').value = displayName;
        
        // Email
        document.getElementById('user-email').value = currentUser.email;
        
        // Mini-Stats
        updateMiniStats();
        
    } catch (error) {
        console.error('❌ User-Info Fehler:', error);
    }
}

async function loadAvatar() {
    try {
        // 1. localStorage
        const cached = localStorage.getItem(`user_avatar_${currentUser.uid}`);
        if (cached) return cached;
        
        // 2. Firebase
        const snapshot = await window.db.ref(`users/${currentUser.uid}/avatar`).once('value');
        const avatar = snapshot.val();
        
        if (avatar) {
            localStorage.setItem(`user_avatar_${currentUser.uid}`, avatar);
            return avatar;
        }
        
        // 3. Generieren
        return generateAvatar(currentUserData.displayName || currentUser.email);
        
    } catch (error) {
        return generateAvatar(currentUserData.displayName || currentUser.email);
    }
}

// ===== RAUM SYSTEM - KOMPLETT ÜBERARBEITET =====

async function loadRooms() {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    
    roomsList.innerHTML = '<div class="loading">🏠 Räume werden geladen...</div>';
    
    // Listener für Räume
    const roomsListener = window.db.ref('rooms').on('value', async (snapshot) => {
        const rooms = snapshot.val() || {};
        await displayRoomsWithOnlineCount(rooms);
    }, (error) => {
        console.error('❌ Räume laden Fehler:', error);
        roomsList.innerHTML = '<div class="error">❌ Räume konnten nicht geladen werden</div>';
    });
    
    activeListeners.push({ ref: 'rooms', listener: roomsListener });
}

async function displayRoomsWithOnlineCount(rooms) {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    
    const roomsArray = Object.entries(rooms)
        .filter(([id, room]) => room && !room.isDeleted)
        .map(([id, room]) => ({ id, ...room }));
    
    if (roomsArray.length === 0) {
        roomsList.innerHTML = `
            <div class="no-rooms">
                <h3>🌌 Noch keine Räume</h3>
                <button onclick="showSection('create')" class="modern-btn cosmic-btn">
                    🚀 Ersten Raum erstellen
                </button>
            </div>
        `;
        return;
    }
    
    // Für jeden Raum die Online-User zählen
    const roomsWithOnlineCount = await Promise.all(
        roomsArray.map(async (room) => {
            try {
                // Online-User für diesen Raum zählen
                const onlineSnapshot = await window.db.ref(`roomOnline/${room.id}`).once('value');
                const onlineUsers = onlineSnapshot.val() || {};
                const onlineCount = Object.values(onlineUsers).filter(u => u.isOnline).length;
                
                return {
                    ...room,
                    onlineCount: onlineCount
                };
            } catch (error) {
                return { ...room, onlineCount: 0 };
            }
        })
    );
    
    displayRooms(roomsWithOnlineCount);
}

function displayRooms(rooms) {
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    
    roomsList.innerHTML = '';
    
    rooms.forEach(room => {
        if (!room) return;
        
        const roomCard = createRoomCard(room);
        roomsList.appendChild(roomCard);
    });
}

function createRoomCard(room) {
    const div = document.createElement('div');
    div.className = 'room-card';
    
    const isOwner = room.ownerId === currentUser?.uid;
    const isMember = room.members && room.members[currentUser?.uid];
    const isPrivate = room.isPrivate || room.passwordHash;
    const onlineCount = room.onlineCount || 0;
    const totalMembers = room.memberCount || 0; // Nur noch für interne Logik
    
    // Berechne Aktivitätsstatus
    const lastActivity = room.lastActivity || room.createdAt;
    const activityStatus = getActivityStatus(lastActivity);
    
    div.innerHTML = `
        <div class="room-header">
            <div>
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-privacy">
                    ${isPrivate ? '🔒 Privat' : '🌐 Öffentlich'}
                    ${activityStatus}
                </div>
            </div>
            <div class="room-badges">
                ${isOwner ? '<span class="owner-badge">👑 Besitzer</span>' : ''}
                ${isMember ? '<span class="member-badge">⭐ Mitglied</span>' : ''}
            </div>
        </div>
        
        ${room.description ? `<div class="room-description">${escapeHtml(room.description)}</div>` : ''}
        
        <div class="room-stats">
            <div class="room-stat">
                <span class="stat-icon">👥</span>
                <!-- GEÄNDERT: Nur onlineCount anzeigen, nicht das Verhältnis -->
                <span class="stat-value">${onlineCount}</span>
                <span class="stat-label">online</span>
            </div>
            <div class="room-stat">
                <span class="stat-icon">💬</span>
                <span class="stat-value">${room.messageCount || 0}</span>
                <span class="stat-label">Nachrichten</span>
            </div>
            <div class="room-stat">
                <span class="stat-icon">🕒</span>
                <span class="stat-value">${formatRelativeTime(lastActivity)}</span>
            </div>
        </div>
        
        <div class="room-meta">
            <div class="room-owner">
                <img src="${room.ownerAvatar || generateAvatar(room.ownerName)}" 
                     class="meta-avatar"
                     onerror="this.src='${generateAvatar(room.ownerName)}'">
                <span>${escapeHtml(room.ownerName)}</span>
            </div>
            <div class="room-created">
                Erstellt: ${new Date(room.createdAt).toLocaleDateString()}
            </div>
        </div>
        
        <div class="room-actions">
            <button class="join-btn" onclick="joinRoom('${room.id}', '${escapeHtml(room.name)}', ${isPrivate})">
                ${isPrivate ? '🔓 Beitreten' : '🚪 Raum betreten'}
            </button>
            ${isOwner || isAdmin ? `
                <button class="manage-btn" onclick="openRoomManagement('${room.id}')">
                    🔧 Verwalten
                </button>
            ` : ''}
        </div>
    `;
    
    return div;
}

function getActivityStatus(lastActivity) {
    const now = Date.now();
    const diff = now - lastActivity;
    
    if (diff < 300000) { // 5 Minuten
        return '<span class="activity-dot active"></span>';
    } else if (diff < 3600000) { // 1 Stunde
        return '<span class="activity-dot idle"></span>';
    } else {
        return '<span class="activity-dot inactive"></span>';
    }
}

async function joinRoom(roomId, roomName, isPrivate) {
    if (!currentUser) return;
    
    // Restriction Check
    const canJoin = await checkUserRestrictions();
    if (!canJoin) return;
    
    if (isPrivate) {
        const password = prompt('🔒 Bitte Passwort eingeben:');
        if (!password) {
            showNotification('❌ Passwort benötigt', 'error');
            return;
        }
        
        // Passwort validieren (vereinfacht - in Produktion hashen!)
        showNotification('🔐 Prüfe Passwort...', 'info');
        // Hier müsste Passwort-Validation implementiert werden
    }
    
    try {
        // Prüfe ob User bereits Mitglied ist
        const memberRef = window.db.ref(`rooms/${roomId}/members/${currentUser.uid}`);
        const snapshot = await memberRef.once('value');
        
        if (!snapshot.exists()) {
            // Als Mitglied hinzufügen
            await memberRef.set({
                joinedAt: Date.now(),
                role: 'member',
                displayName: currentUserData.displayName,
                avatar: currentUserData.avatar,
                addedBy: 'self'
            });
            
            // Member Count erhöhen
            const countRef = window.db.ref(`rooms/${roomId}/memberCount`);
            const countSnapshot = await countRef.once('value');
            const currentCount = countSnapshot.val() || 0;
            await countRef.set(currentCount + 1);
        }
        
        // Für chat.html speichern
        localStorage.setItem('currentRoomId', roomId);
        localStorage.setItem('currentRoomName', roomName);
        localStorage.setItem('roomIsPrivate', isPrivate);
        
        showNotification(`🚀 Betrete Raum: ${roomName}`, 'success');
        
        // Weiterleitung mit kurzer Verzögerung
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 800);
        
    } catch (error) {
        console.error('❌ Join Room Error:', error);
        showNotification('❌ Beitreten fehlgeschlagen', 'error');
    }
}

async function createRoom() {
    const nameInput = document.getElementById('room-name');
    const descInput = document.getElementById('room-description');
    const passwordInput = document.getElementById('room-password');
    
    if (!nameInput || !descInput || !passwordInput) return;
    
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const password = passwordInput.value;
    
    if (!name) {
        showNotification('❌ Bitte Raumnamen eingeben', 'error');
        return;
    }
    
    // Restriction Check
    const canCreate = await checkUserRestrictions();
    if (!canCreate) return;
    
    const btn = document.getElementById('create-room-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Raum wird erstellt...';
    
    try {
        const roomRef = window.db.ref('rooms').push();
        const roomId = roomRef.key;
        
        const roomData = {
            id: roomId,
            name: name,
            description: description,
            passwordHash: password || null,
            isPrivate: !!password,
            ownerId: currentUser.uid,
            ownerName: currentUserData.displayName,
            ownerAvatar: currentUserData.avatar,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            memberCount: 1,
            messageCount: 0,
            settings: {
                allowImages: true,
                allowVoice: true,
                allowFiles: true,
                maxMembers: 100,
                slowMode: false,
                slowModeDelay: 5,
                allowInvites: true
            },
            members: {
                [currentUser.uid]: {
                    joinedAt: Date.now(),
                    role: 'owner',
                    displayName: currentUserData.displayName,
                    avatar: currentUserData.avatar,
                    addedBy: 'self'
                }
            }
        };
        
        await roomRef.set(roomData);
        
        // User-Statistik
        const userRoomsRef = window.db.ref(`users/${currentUser.uid}/roomsCreated`);
        const roomsSnapshot = await userRoomsRef.once('value');
        const currentRooms = roomsSnapshot.val() || 0;
        await userRoomsRef.set(currentRooms + 1);
        
        // Formular zurücksetzen
        nameInput.value = '';
        descInput.value = '';
        passwordInput.value = '';
        
        showNotification(`🚀 Raum "${name}" erstellt!`, 'success');
        
        // Direkt beitreten
        setTimeout(() => {
            joinRoom(roomId, name, !!password);
        }, 1500);
        
    } catch (error) {
        console.error('❌ Create Room Error:', error);
        showNotification('❌ Raum erstellen fehlgeschlagen', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function openRoomManagement(roomId) {
    try {
        // Lade Raum-Daten
        const roomRef = window.db.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.once('value');
        const room = snapshot.val();
        
        if (!room) {
            showNotification('❌ Raum nicht gefunden', 'error');
            return;
        }
        
        // Prüfe Berechtigung
        if (room.ownerId !== currentUser.uid && !isAdmin) {
            showNotification('❌ Nur der Besitzer kann den Raum verwalten', 'error');
            return;
        }
        
        // Modal erstellen
        const modalHTML = `
            <div class="modal" id="room-management-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🔧 Raum verwalten</h2>
                        <button class="close-btn" onclick="closeModal()">×</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="management-tabs">
                            <button class="tab-btn active" onclick="switchRoomManagementTab('settings')" data-tab="settings">
                                ⚙️ Einstellungen
                            </button>
                            <button class="tab-btn" onclick="switchRoomManagementTab('members')" data-tab="members">
                                👥 Mitglieder (${room.memberCount || 1})
                            </button>
                            <button class="tab-btn" onclick="switchRoomManagementTab('danger')" data-tab="danger">
                                ⚠️ Gefahrenzone
                            </button>
                        </div>
                        
                        <!-- TAB 1: EINSTELLUNGEN -->
                        <div id="management-settings" class="management-tab active">
                            <div class="tab-content-inner">
                                <div class="form-group">
                                    <label>Raum Name</label>
                                    <input type="text" id="manage-room-name" 
                                           value="${escapeHtml(room.name)}" 
                                           class="modern-input"
                                           placeholder="Raum Name">
                                </div>
                                
                                <div class="form-group">
                                    <label>Beschreibung</label>
                                    <textarea id="manage-room-desc" 
                                              class="modern-input"
                                              rows="3"
                                              placeholder="Raum Beschreibung">${escapeHtml(room.description || '')}</textarea>
                                </div>
                                
                                <div class="form-group">
                                    <label>Passwort (leer lassen um zu entfernen)</label>
                                    <input type="password" id="manage-room-password" 
                                           class="modern-input"
                                           placeholder="Neues Passwort...">
                                    <small>${room.isPrivate ? '🔒 Der Raum ist aktuell privat' : '🌐 Der Raum ist aktuell öffentlich'}</small>
                                </div>
                                
                                <div class="form-group">
                                    <label>Maximale Mitglieder</label>
                                    <input type="number" id="manage-room-maxmembers" 
                                           value="${room.settings?.maxMembers || 100}"
                                           min="2" max="500"
                                           class="modern-input">
                                </div>
                                
                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="manage-room-allowimages" 
                                               ${room.settings?.allowImages ? 'checked' : ''}>
                                        Bilder erlauben
                                    </label>
                                    
                                    <label>
                                        <input type="checkbox" id="manage-room-allowfiles" 
                                               ${room.settings?.allowFiles ? 'checked' : ''}>
                                        Dateien erlauben
                                    </label>
                                    
                                    <label>
                                        <input type="checkbox" id="manage-room-slowmode" 
                                               ${room.settings?.slowMode ? 'checked' : ''}>
                                        Slow Mode
                                    </label>
                                </div>
                                
                                <button class="modern-btn cosmic-btn full-width" 
                                        onclick="saveRoomSettings('${roomId}')">
                                    💾 Änderungen speichern
                                </button>
                            </div>
                        </div>
                        
                        <!-- TAB 2: MITGLIEDER -->
                        <div id="management-members" class="management-tab" style="display: none;">
                            <div class="tab-content-inner">
                                <div class="members-header">
                                    <h3>👥 Raummitglieder (${Object.keys(room.members || {}).length} total)</h3>
                                    <button class="modern-btn secondary-btn" 
                                            onclick="refreshRoomMembers('${roomId}')">
                                        🔄 Aktualisieren
                                    </button>
                                </div>
                                
                                <div id="members-list" class="members-list">
                                    Lade Mitglieder...
                                </div>
                            </div>
                        </div>
                        
                        <!-- TAB 3: GEFAHRENZONE -->
                        <div id="management-danger" class="management-tab" style="display: none;">
                            <div class="tab-content-inner">
                                <div class="danger-zone">
                                    <h3>⚠️ Gefahrenzone</h3>
                                    <p>Diese Aktionen können nicht rückgängig gemacht werden!</p>
                                    
                                    <div class="danger-actions">
                                        <button class="danger-btn delete" 
                                                onclick="deleteRoom('${roomId}')">
                                            🗑️ Raum löschen
                                        </button>
                                        
                                        <button class="danger-btn transfer" 
                                                onclick="transferRoomOwnership('${roomId}')">
                                            👑 Besitz übertragen
                                        </button>
                                        
                                        ${isAdmin ? `
                                            <button class="danger-btn archive" 
                                                    onclick="archiveRoom('${roomId}')">
                                                📁 Archivieren
                                            </button>
                                            
                                            <button class="danger-btn clear" 
                                                    onclick="clearRoomMessages('${roomId}')">
                                                💬 Nachrichten löschen
                                            </button>
                                        ` : ''}
                                    </div>
                                    
                                    <div class="danger-info">
                                        <small>⚠️ Achtung: Gelöschte Räume können nicht wiederhergestellt werden!</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="modern-btn secondary-btn" onclick="closeModal()">
                            Schließen
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Modal einfügen
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // Füge Event-Listener für Tabs hinzu
        setTimeout(() => {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const tabName = this.getAttribute('data-tab');
                    switchRoomManagementTab(tabName);
                });
            });
        }, 100);
        
    } catch (error) {
        console.error('❌ Room Management Error:', error);
        showNotification('❌ Raumverwaltung konnte nicht geöffnet werden', 'error');
    }
}

async function loadRoomMembers(roomId) {
    try {
        const membersList = document.getElementById('members-list');
        if (!membersList) return;
        
        membersList.innerHTML = '<div class="loading">👥 Lade Mitglieder...</div>';
        
        // Lade Mitglieder
        const membersRef = window.db.ref(`rooms/${roomId}/members`);
        const snapshot = await membersRef.once('value');
        const members = snapshot.val() || {};
        
        // Lade zusätzlich Online-Status
        const onlineRef = window.db.ref(`roomOnline/${roomId}`);
        const onlineSnapshot = await onlineRef.once('value');
        const onlineUsers = onlineSnapshot.val() || {};
        
        let html = '';
        
        for (const [userId, memberData] of Object.entries(members)) {
            // Lade User-Details
            const userRef = window.db.ref(`users/${userId}`);
            const userSnapshot = await userRef.once('value');
            const user = userSnapshot.val() || {};
            
            const isOnline = !!onlineUsers[userId];
            const isOwner = memberData.role === 'owner';
            const isCurrentUser = userId === currentUser.uid;
            
            html += `
                <div class="member-item ${isOnline ? 'online' : 'offline'}">
                    <div class="member-avatar">
                        <img src="${user.avatar || generateAvatar(user.displayName)}" 
                             alt="${user.displayName}"
                             onerror="this.src='${generateAvatar(user.displayName)}'">
                        <span class="online-dot ${isOnline ? 'active' : ''}"></span>
                    </div>
                    
                    <div class="member-info">
                        <div class="member-name">
                            ${escapeHtml(user.displayName || 'Unbekannt')}
                            ${isOwner ? '<span class="role-badge owner">👑 Besitzer</span>' : ''}
                            ${isCurrentUser ? '<span class="role-badge you">(Du)</span>' : ''}
                        </div>
                        <div class="member-details">
                            <span class="member-status">${isOnline ? '🟢 Online' : '⚫ Offline'}</span>
                            <span class="member-joined">Beigetreten: ${new Date(memberData.joinedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <div class="member-actions">
                        ${!isOwner && (isAdmin || currentUser.uid === userId) ? `
                            <button class="action-btn kick" 
                                    onclick="kickMember('${roomId}', '${userId}')"
                                    title="Aus Raum entfernen">
                                🚫
                            </button>
                        ` : ''}
                        
                        ${!isOwner && isAdmin ? `
                            <button class="action-btn promote" 
                                    onclick="promoteMember('${roomId}', '${userId}')"
                                    title="Zum Besitzer machen">
                                👑
                            </button>
                        ` : ''}
                        
                        ${isCurrentUser && !isOwner ? `
                            <button class="action-btn leave" 
                                    onclick="leaveRoom('${roomId}')"
                                    title="Raum verlassen">
                                🚪
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        membersList.innerHTML = html || '<div class="no-members">Keine Mitglieder gefunden</div>';
        
    } catch (error) {
        console.error('❌ Load Members Error:', error);
        document.getElementById('members-list').innerHTML = 
            '<div class="error">❌ Mitglieder konnten nicht geladen werden</div>';
    }
}

async function saveRoomSettings(roomId) {
    try {
        const name = document.getElementById('manage-room-name').value.trim();
        const description = document.getElementById('manage-room-desc').value.trim();
        const password = document.getElementById('manage-room-password').value;
        const maxMembers = parseInt(document.getElementById('manage-room-maxmembers').value) || 100;
        const allowImages = document.getElementById('manage-room-allowimages').checked;
        const allowFiles = document.getElementById('manage-room-allowfiles').checked;
        const slowMode = document.getElementById('manage-room-slowmode').checked;
        
        if (!name) {
            showNotification('❌ Raumname darf nicht leer sein', 'error');
            return;
        }
        
        if (maxMembers < 2 || maxMembers > 500) {
            showNotification('❌ Maximale Mitglieder muss zwischen 2 und 500 liegen', 'error');
            return;
        }
        
        // FALSCH (mit Punkt):
        // 'settings.maxMembers': maxMembers,    ← DAS IST DER FEHLER!
        
        // RICHTIG (ganzes settings Objekt):
        const updates = {
            name: name,
            description: description,
            lastUpdated: Date.now(),
            settings: {
                maxMembers: maxMembers,
                allowImages: allowImages,
                allowFiles: allowFiles,
                slowMode: slowMode
            }
        };
        
        // Passwort verarbeiten
        if (password) {
            updates.passwordHash = password;
            updates.isPrivate = true;
        } else {
            // Wenn Passwortfeld leer ist, prüfen ob wir es entfernen sollen
            const roomRef = window.db.ref(`rooms/${roomId}`);
            const snapshot = await roomRef.once('value');
            const room = snapshot.val();
            
            if (room.passwordHash) {
                updates.passwordHash = null;
                updates.isPrivate = false;
            }
        }
        
        console.log('📤 Sende Update:', updates); // Debug-Ausgabe
        
        // Update durchführen
        await window.db.ref(`rooms/${roomId}`).update(updates);
        
        showNotification('✅ Raum-Einstellungen gespeichert!', 'success');
        
        // Räume neu laden
        loadRooms();
        
    } catch (error) {
        console.error('❌ Save Settings Error:', error);
        showNotification('❌ Fehler beim Speichern: ' + error.message, 'error');
    }
}

async function deleteRoom(roomId) {
    if (!confirm('🚨 RAUM VOLLSTÄNDIG LÖSCHEN?\n\n• Alle Nachrichten werden gelöscht\n• Alle Mitglieder werden entfernt\n• Dieser Vorgang kann NICHT rückgängig gemacht werden!\n\nBist du wirklich sicher?')) {
        return;
    }
    
    try {
        // Raum markieren als gelöscht (soft delete)
        await window.db.ref(`rooms/${roomId}`).update({
            isDeleted: true,
            deletedAt: Date.now(),
            deletedBy: currentUser.uid
        });
        
        // Optional: Nachrichten löschen
        await window.db.ref(`rooms/${roomId}/messages`).remove();
        
        showNotification('✅ Raum wurde gelöscht', 'success');
        closeModal();
        loadRooms();
        
    } catch (error) {
        console.error('❌ Delete Room Error:', error);
        showNotification('❌ Löschen fehlgeschlagen', 'error');
    }
}

async function kickMember(roomId, userId) {
    if (!confirm('Mitglied wirklich aus dem Raum entfernen?')) {
        return;
    }
    
    try {
        // Mitglied entfernen
        await window.db.ref(`rooms/${roomId}/members/${userId}`).remove();
        
        // Count verringern
        const countRef = window.db.ref(`rooms/${roomId}/memberCount`);
        const snapshot = await countRef.once('value');
        const currentCount = snapshot.val() || 1;
        await countRef.set(Math.max(0, currentCount - 1));
        
        showNotification('✅ Mitglied entfernt', 'success');
        await loadRoomMembers(roomId);
        
    } catch (error) {
        console.error('❌ Kick Member Error:', error);
        showNotification('❌ Entfernen fehlgeschlagen', 'error');
    }
}

async function promoteMember(roomId, userId) {
    if (!confirm('Dieses Mitglied zum Raum-Besitzer machen?\n\nEr/sie erhält dann alle Rechte zur Raumverwaltung!')) {
        return;
    }
    
    try {
        // Alten Besitzer zu Mitglied machen
        const roomRef = window.db.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.once('value');
        const room = snapshot.val();
        
        if (room.ownerId) {
            await window.db.ref(`rooms/${roomId}/members/${room.ownerId}`).update({
                role: 'member'
            });
        }
        
        // Neuen Besitzer setzen
        await window.db.ref(`rooms/${roomId}/members/${userId}`).update({
            role: 'owner'
        });
        
        // Raum-Daten aktualisieren
        const userRef = window.db.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');
        const user = userSnapshot.val();
        
        await roomRef.update({
            ownerId: userId,
            ownerName: user.displayName,
            ownerAvatar: user.avatar
        });
        
        showNotification('✅ Besitz erfolgreich übertragen', 'success');
        await loadRoomMembers(roomId);
        
    } catch (error) {
        console.error('❌ Promote Member Error:', error);
        showNotification('❌ Übertragung fehlgeschlagen', 'error');
    }
}

async function leaveRoom(roomId) {
    if (!confirm('Möchtest du diesen Raum wirklich verlassen?')) {
        return;
    }
    
    try {
        // Prüfe ob Besitzer
        const roomRef = window.db.ref(`rooms/${roomId}`);
        const snapshot = await roomRef.once('value');
        const room = snapshot.val();
        
        if (room.ownerId === currentUser.uid) {
            showNotification('❌ Als Besitzer kannst du den Raum nicht verlassen', 'error');
            return;
        }
        
        // Aus Raum entfernen
        await window.db.ref(`rooms/${roomId}/members/${currentUser.uid}`).remove();
        
        // Count verringern
        const countRef = window.db.ref(`rooms/${roomId}/memberCount`);
        const countSnapshot = await countRef.once('value');
        const currentCount = countSnapshot.val() || 1;
        await countRef.set(Math.max(0, currentCount - 1));
        
        showNotification('✅ Du hast den Raum verlassen', 'success');
        closeModal();
        loadRooms();
        
    } catch (error) {
        console.error('❌ Leave Room Error:', error);
        showNotification('❌ Verlassen fehlgeschlagen', 'error');
    }
}

async function transferRoomOwnership(roomId) {
    const newOwnerId = prompt('Bitte die User-ID des neuen Besitzers eingeben:');
    
    if (!newOwnerId) return;
    
    try {
        // Prüfe ob User existiert
        const userRef = window.db.ref(`users/${newOwnerId}`);
        const userSnapshot = await userRef.once('value');
        const user = userSnapshot.val();
        
        if (!user) {
            showNotification('❌ User nicht gefunden', 'error');
            return;
        }
        
        // Prüfe ob User Mitglied ist
        const memberRef = window.db.ref(`rooms/${roomId}/members/${newOwnerId}`);
        const memberSnapshot = await memberRef.once('value');
        
        if (!memberSnapshot.exists()) {
            showNotification('❌ User ist kein Mitglied dieses Raums', 'error');
            return;
        }
        
        // Übertragung durchführen
        await promoteMember(roomId, newOwnerId);
        
    } catch (error) {
        console.error('❌ Transfer Ownership Error:', error);
        showNotification('❌ Übertragung fehlgeschlagen', 'error');
    }
}

async function archiveRoom(roomId) {
    if (!isAdmin) return;
    
    if (!confirm('Raum archivieren?\n\n• Der Raum wird für neue Mitglieder gesperrt\n• Bestehende Mitglieder können weiter chatten\n• Der Raum verschwindet aus der öffentlichen Liste')) {
        return;
    }
    
    try {
        await window.db.ref(`rooms/${roomId}`).update({
            isArchived: true,
            archivedAt: Date.now(),
            archivedBy: currentUser.uid
        });
        
        showNotification('✅ Raum wurde archiviert', 'success');
        closeModal();
        loadRooms();
        
    } catch (error) {
        console.error('❌ Archive Room Error:', error);
        showNotification('❌ Archivieren fehlgeschlagen', 'error');
    }
}

async function clearRoomMessages(roomId) {
    if (!isAdmin) return;
    
    if (!confirm('ALLE NACHRICHTEN DIESES RAUMS LÖSCHEN?\n\nDiese Aktion kann nicht rückgängig gemacht werden!')) {
        return;
    }
    
    try {
        await window.db.ref(`rooms/${roomId}/messages`).remove();
        showNotification('✅ Alle Nachrichten wurden gelöscht', 'success');
        
    } catch (error) {
        console.error('❌ Clear Messages Error:', error);
        showNotification('❌ Löschen fehlgeschlagen', 'error');
    }
}

function refreshRoomMembers(roomId) {
    loadRoomMembers(roomId);
    showNotification('👥 Mitglieder aktualisiert', 'info');
}

function switchManagementTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Alle Tabs ausblenden
    document.querySelectorAll('.management-tab').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Alle Tab-Buttons deaktivieren
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Gewählten Tab anzeigen
    const activeTab = document.getElementById(`management-${tabName}`);
    if (activeTab) {
        activeTab.style.display = 'flex';
        activeTab.classList.add('active');
        
        // Wenn Mitglieder-Tab, dann Mitglieder laden
        if (tabName === 'members') {
            loadRoomMembers(window.currentRoomId || getRoomIdFromModal());
        }
    }
    
    // Gewählten Button aktivieren
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function getRoomIdFromModal() {
    // Extrahiere roomId aus dem Modal
    const modal = document.getElementById('room-management-modal');
    if (!modal) return null;
    
    // Suche nach buttons mit onclick-Handlern, die roomId enthalten
    const buttons = modal.querySelectorAll('button[onclick]');
    for (let btn of buttons) {
        const onclick = btn.getAttribute('onclick') || '';
        const match = onclick.match(/'([^']+)'/);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// ===== USER SEARCH SYSTEM =====

function initUserSearch() {
    const searchInput = document.getElementById('user-search');
    const usersList = document.getElementById('users-list');
    
    if (!searchInput || !usersList) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            usersList.innerHTML = '<div class="info-text">🔍 Gib mindestens 2 Zeichen ein</div>';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                usersList.innerHTML = '<div class="loading">👤 Suche User...</div>';
                
                const snapshot = await window.db.ref('users').once('value');
                const allUsers = snapshot.val() || {};
                
                const filteredUsers = Object.entries(allUsers)
                    .filter(([uid, user]) => {
                        if (!user || uid === currentUser.uid || user.isDeleted || user.isBanned) return false;
                        
                        const nameMatch = user.displayName?.toLowerCase().includes(query);
                        const emailMatch = user.email?.toLowerCase().includes(query);
                        return nameMatch || emailMatch;
                    })
                    .slice(0, 20);
                
                if (filteredUsers.length === 0) {
                    usersList.innerHTML = '<div class="no-results">👤 Keine User gefunden</div>';
                    return;
                }
                
                await displaySearchResults(filteredUsers, usersList);
                
            } catch (error) {
                console.error('❌ User Search Error:', error);
                usersList.innerHTML = '<div class="error">❌ Suche fehlgeschlagen</div>';
            }
        }, 300);
    });
}

async function displaySearchResults(users, container) {
    let html = '';
    
    for (const [uid, user] of users) {
        // Lade Online-Status für jeden User
        let isOnline = false;
        try {
            // Prüfe ob User in irgendeinem Raum online ist
            const onlineRoomsRef = window.db.ref('roomOnline');
            const onlineSnapshot = await onlineRoomsRef.once('value');
            const onlineRooms = onlineSnapshot.val() || {};
            
            isOnline = Object.values(onlineRooms).some(room => 
                room && room[uid] && room[uid].isOnline
            );
        } catch (error) {
            console.error('Online check error:', error);
        }
        
        const avatar = user.avatar || generateAvatar(user.displayName);
        const isAdminUser = user.role === 'admin' || user.isAdmin === true;
        
        html += `
            <div class="user-card">
                <div class="user-card-header">
                    <img src="${avatar}" 
                         alt="Avatar" 
                         class="user-avatar"
                         onerror="this.src='${generateAvatar(user.displayName)}'"
                         onclick="showUserProfileModal('${uid}')">
                    
                    <div class="user-badges">
                        ${isOnline ? '<span class="online-badge" title="Online">🟢</span>' : ''}
                        ${isAdminUser ? '<span class="admin-badge" title="Admin">👑</span>' : ''}
                        ${user.isBanned ? '<span class="banned-badge" title="Gebannt">⛔</span>' : ''}
                    </div>
                </div>
                
                <div class="user-info">
                    <span class="user-name" onclick="showUserProfileModal('${uid}')">
                        ${escapeHtml(user.displayName || 'Unbekannt')}
                    </span>
                    
                    <span class="user-email">
                        ${escapeHtml(user.email || '')}
                    </span>
                    
                    <div class="user-stats">
                        <span class="user-stat" title="Nachrichten">
                            💬 ${user.messageCount || 0}
                        </span>
                        <span class="user-stat" title="Räume">
                            🏠 ${user.roomsCreated || 0}
                        </span>
                        <span class="user-stat" title="Reaktionen">
                            ❤️ ${user.reactionsReceived || 0}
                        </span>
                    </div>
                </div>
                
                <div class="user-actions">
                    <button class="action-btn chat" 
                            onclick="startPrivateChat('${uid}', '${escapeHtml(user.displayName)}')"
                            title="Privatchat starten">
                        💬 Chat
                    </button>
                    
                    <button class="action-btn profile" 
                            onclick="showUserProfileModal('${uid}')"
                            title="Profil anzeigen">
                        👁️ Profil
                    </button>
                    
                    ${isAdmin && !isAdminUser ? `
                        <button class="action-btn admin" 
                                onclick="promoteToAdmin('${uid}')"
                                title="Zum Admin machen">
                            👑
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ===== PROFIL MODAL SYSTEM =====

async function showUserProfileModal(userId) {
    try {
        // Lade Profil
        const userRef = window.db.ref('users/' + userId);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (!userData) {
            showNotification('❌ User nicht gefunden', 'error');
            return;
        }
        
        // Lade Online-Status
        let isOnline = false;
        try {
            const onlineRoomsRef = window.db.ref('roomOnline');
            const onlineSnapshot = await onlineRoomsRef.once('value');
            const onlineRooms = onlineSnapshot.val() || {};
            
            isOnline = Object.values(onlineRooms).some(room => 
                room && room[userId] && room[userId].isOnline
            );
        } catch (error) {
            console.error('Online status error:', error);
        }
        
        // Modal HTML
        const modalHTML = `
            <div class="modal" id="user-profile-modal">
                <div class="modal-content profile-modal">
                    <button class="close-btn" onclick="closeUserProfileModal()">×</button>
                    
                    <div class="profile-header">
                        <img src="${userData.avatar || generateAvatar(userData.displayName)}" 
                             alt="Avatar" 
                             class="profile-avatar-large"
                             onerror="this.src='${generateAvatar(userData.displayName)}'">
                        
                        <div class="profile-header-info">
                            <h2>${escapeHtml(userData.displayName || 'Unbekannt')}</h2>
                            <p class="profile-email">${escapeHtml(userData.email || '')}</p>
                            
                            <div class="profile-status">
                                <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                                <span>${isOnline ? '🟢 Online' : '⚫ Offline'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="profile-stats">
                        <div class="stat-item">
                            <div class="stat-value">${userData.messageCount || 0}</div>
                            <div class="stat-label">Nachrichten</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${userData.roomsCreated || 0}</div>
                            <div class="stat-label">Räume</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${userData.reactionsReceived || 0}</div>
                            <div class="stat-label">Reaktionen</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${userData.friendsCount || 0}</div>
                            <div class="stat-label">Freunde</div>
                        </div>
                    </div>
                    
                    <div class="profile-details">
                        <h3>📋 Account Details</h3>
                        
                        <div class="detail-item">
                            <span class="detail-label">User ID:</span>
                            <span class="detail-value"><code>${userId.substring(0, 8)}...</code></span>
                        </div>
                        
                        <div class="detail-item">
                            <span class="detail-label">Rolle:</span>
                            <span class="detail-value">
                                ${userData.role === 'admin' ? '👑 Admin' : '👤 User'}
                            </span>
                        </div>
                        
                        ${userData.createdAt ? `
                            <div class="detail-item">
                                <span class="detail-label">Registriert:</span>
                                <span class="detail-value">
                                    ${new Date(userData.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        ` : ''}
                        
                        ${userData.lastLogin ? `
                            <div class="detail-item">
                                <span class="detail-label">Letzter Login:</span>
                                <span class="detail-value">
                                    ${new Date(userData.lastLogin).toLocaleString()}
                                </span>
                            </div>
                        ` : ''}
                        
                        ${userData.isBanned ? `
                            <div class="detail-item warning">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value">⛔ Gebannt</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="profile-actions">
                        <button class="modern-btn cosmic-btn" 
                                onclick="startPrivateChat('${userId}', '${escapeHtml(userData.displayName)}')">
                            💬 Privatchat starten
                        </button>
                        
                        ${isAdmin && userId !== currentUser.uid ? `
                            <button class="modern-btn secondary-btn" 
                                    onclick="toggleBanUser('${userId}', ${userData.isBanned || false})">
                                ${userData.isBanned ? '✅ Entbannen' : '⛔ Bannen'}
                            </button>
                            
                            <button class="modern-btn secondary-btn" 
                                    onclick="timeoutUser('${userId}')">
                                ⏰ Timeout
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Modal einfügen
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        console.error('❌ Profile Modal Error:', error);
        showNotification('❌ Profil konnte nicht geladen werden', 'error');
    }
}

async function resetPassword() {
    const email = currentUser.email;
    
    try {
        await window.auth.sendPasswordResetEmail(email);
        showNotification('📧 Passwort-Reset Email wurde gesendet', 'success');
    } catch (error) {
        showNotification('❌ Fehler beim Senden der Reset-Email', 'error');
    }
}

function closeUserProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) modal.remove();
}

// ===== PRIVATE CHAT SYSTEM =====

async function startPrivateChat(userId, userName) {
    if (!currentUser || userId === currentUser.uid) {
        showNotification('❌ Kann nicht mit sich selbst chatten', 'error');
        return;
    }
    
    try {
        // Eindeutige Room-ID erstellen (sortiert für Konsistenz)
        const participants = [currentUser.uid, userId].sort();
        const roomId = `private_${participants[0]}_${participants[1]}`;
        const roomName = `Privat mit ${userName}`;
        
        // Prüfe ob privater Chat existiert
        const roomRef = window.db.ref(`privateChats/${roomId}`);
        const snapshot = await roomRef.once('value');
        
        if (!snapshot.exists()) {
            // NEU: Prüfe ob der andere User existiert
            const otherUserRef = window.db.ref(`users/${userId}`);
            const otherUserSnap = await otherUserRef.once('value');
            
            if (!otherUserSnap.exists()) {
                showNotification('❌ User nicht gefunden', 'error');
                return;
            }
            
            const otherUserData = otherUserSnap.val();
            
            // Neuen privaten Chat erstellen
            await roomRef.set({
                id: roomId,
                name: roomName,
                participants: {
                    [currentUser.uid]: true,
                    [userId]: true
                },
                participantNames: {
                    [currentUser.uid]: currentUserData.displayName,
                    [userId]: otherUserData.displayName
                },
                participantAvatars: {
                    [currentUser.uid]: currentUserData.avatar,
                    [userId]: otherUserData.avatar || generateAvatar(otherUserData.displayName)
                },
                createdAt: Date.now(),
                lastActivity: Date.now(),
                type: 'private',
                isPrivate: true,
                lastMessage: '',
                lastMessageTime: Date.now(),
                unreadCount: {
                    [currentUser.uid]: 0,
                    [userId]: 0
                }
            });
            
            // Für beide User speichern
            await Promise.all([
                window.db.ref(`users/${currentUser.uid}/privateChats/${roomId}`).set({
                    with: userId,
                    withName: otherUserData.displayName,
                    withAvatar: otherUserData.avatar,
                    roomId: roomId,
                    joinedAt: Date.now(),
                    lastSeen: Date.now(),
                    isMuted: false
                }),
                window.db.ref(`users/${userId}/privateChats/${roomId}`).set({
                    with: currentUser.uid,
                    withName: currentUserData.displayName,
                    withAvatar: currentUserData.avatar,
                    roomId: roomId,
                    joinedAt: Date.now(),
                    lastSeen: 0,
                    isMuted: false
                })
            ]);
        } else {
            // Chat existiert bereits - aktualisiere lastSeen
            await window.db.ref(`users/${currentUser.uid}/privateChats/${roomId}/lastSeen`).set(Date.now());
        }
        
        // Weiterleitung vorbereiten
        localStorage.setItem('currentRoomId', roomId);
        localStorage.setItem('currentRoomName', roomName);
        localStorage.setItem('roomType', 'private');
        localStorage.setItem('privateChatWith', userId);
        localStorage.setItem('privateChatWithName', userName);
        
        showNotification(`💬 Chat mit ${userName} gestartet`, 'success');
        
        // Weiterleitung
        setTimeout(() => {
            window.location.href = 'chat.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Private Chat Error:', error);
        showNotification('❌ Chat konnte nicht gestartet werden', 'error');
    }
}

// ===== PROFILE MANAGEMENT =====

async function saveProfile() {
    const nameInput = document.getElementById('displayName');
    if (!nameInput || !currentUser) return;
    
    const displayName = nameInput.value.trim();
    if (!displayName) {
        showNotification('❌ Bitte Namen eingeben', 'error');
        return;
    }
    
    try {
        // Update Firebase Auth
        await currentUser.updateProfile({ displayName: displayName });
        
        // Update Database
        await window.db.ref(`users/${currentUser.uid}`).update({
            displayName: displayName,
            lastUpdated: Date.now()
        });
        
        // Update UI
        currentUserData.displayName = displayName;
        document.getElementById('user-displayname').textContent = displayName;
        
        showNotification('✅ Profil gespeichert!', 'success');
        
    } catch (error) {
        console.error('❌ Save Profile Error:', error);
        showNotification('❌ Speichern fehlgeschlagen', 'error');
    }
}

async function updateAvatar() {
    const input = document.getElementById('avatar-upload');
    if (!input.files.length) return;
    
    const file = input.files[0];
    
    // Validierung
    if (!file.type.startsWith('image/')) {
        showNotification('❌ Nur Bilder erlaubt', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('❌ Maximal 5MB', 'error');
        return;
    }
    
    try {
        // Base64 konvertieren
        const base64 = await fileToBase64(file);
        
        // In Firebase speichern
        await window.db.ref(`users/${currentUser.uid}`).update({
            avatar: base64,
            lastUpdated: Date.now()
        });
        
        // In localStorage speichern
        localStorage.setItem(`user_avatar_${currentUser.uid}`, base64);
        
        // UI aktualisieren
        currentUserData.avatar = base64;
        const avatars = document.querySelectorAll('#user-avatar, #profile-avatar');
        avatars.forEach(avatar => avatar.src = base64);
        
        showNotification('✅ Avatar gespeichert!', 'success');
        
    } catch (error) {
        console.error('❌ Avatar Upload Error:', error);
        showNotification('❌ Avatar konnte nicht gespeichert werden', 'error');
    }
}

function removeAvatar() {
    if (!confirm('Avatar wirklich entfernen?')) return;
    
    try {
        // Standard-Avatar generieren
        const defaultAvatar = generateAvatar(currentUserData.displayName || currentUser.email);
        
        // In Firebase aktualisieren
        window.db.ref(`users/${currentUser.uid}/avatar`).remove();
        
        // Aus localStorage entfernen
        localStorage.removeItem(`user_avatar_${currentUser.uid}`);
        
        // UI aktualisieren
        currentUserData.avatar = defaultAvatar;
        const avatars = document.querySelectorAll('#user-avatar, #profile-avatar');
        avatars.forEach(avatar => avatar.src = defaultAvatar);
        
        showNotification('🗑️ Avatar entfernt', 'info');
        
    } catch (error) {
        console.error('❌ Remove Avatar Error:', error);
        showNotification('❌ Avatar konnte nicht entfernt werden', 'error');
    }
}

// ===== ADMIN SYSTEM =====

function initAdminSystem() {
    console.log('👑 Admin System initialisiert');
    // Hier könnte man Admin-spezifische Listener starten
}

async function toggleBanUser(userId, isCurrentlyBanned) {
    if (!isAdmin || userId === currentUser.uid) {
        showNotification('❌ Keine Berechtigung', 'error');
        return;
    }
    
    const action = isCurrentlyBanned ? 'entbannen' : 'bannen';
    const reason = prompt(`Grund für ${action} (optional):`, 'Verstoß gegen Regeln');
    
    if (reason === null) return;
    
    try {
        const updates = {};
        
        if (!isCurrentlyBanned) {
            // Bannen
            updates[`users/${userId}/isBanned`] = true;
            updates[`users/${userId}/banTime`] = Date.now();
            updates[`users/${userId}/bannedBy`] = currentUser.uid;
            updates[`users/${userId}/banReason`] = reason;
            updates[`users/${userId}/status`] = 'banned';
            
            showNotification('✅ User wurde gebannt', 'success');
        } else {
            // Entbannen
            updates[`users/${userId}/isBanned`] = false;
            updates[`users/${userId}/banLiftTime`] = Date.now();
            updates[`users/${userId}/banLiftedBy`] = currentUser.uid;
            updates[`users/${userId}/status`] = 'offline';
            
            showNotification('✅ User wurde entbannt', 'success');
        }
        
        await window.db.ref().update(updates);
        
        // Admin Panel neu laden falls offen
        if (document.getElementById('admin-section').innerHTML.includes('Admin Panel')) {
            loadAdminPanel();
        }
        
    } catch (error) {
        console.error('❌ Ban Error:', error);
        showNotification('❌ Aktion fehlgeschlagen', 'error');
    }
}

async function timeoutUser(userId) {
    if (!isAdmin) return;
    
    const minutes = parseInt(prompt('Timeout Dauer in Minuten (1-1440):', '60'));
    if (!minutes || minutes < 1 || minutes > 1440) {
        showNotification('❌ Ungültige Zeitangabe', 'error');
        return;
    }
    
    const reason = prompt('Grund für Timeout (optional):', '');
    
    try {
        await window.db.ref(`users/${userId}`).update({
            isTimedOut: true,
            timeoutUntil: Date.now() + (minutes * 60000),
            timeoutReason: reason || 'Timeout durch Admin',
            timeoutBy: currentUser.uid,
            timeoutAt: Date.now()
        });
        
        showNotification(`⏰ User für ${minutes} Minuten getimed-out`, 'success');
        
    } catch (error) {
        console.error('❌ Timeout Error:', error);
        showNotification('❌ Timeout fehlgeschlagen', 'error');
    }
}

// ===== REALTIME STATISTIKEN =====

function initRealtimeStats() {
    // User Stats Listener
    const userStatsListener = window.db.ref('users/' + currentUser.uid).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateMiniStats(data);
            updateMainStats(data);
        }
    });
    activeListeners.push({ ref: 'users/' + currentUser.uid, listener: userStatsListener });
    
    // Global Stats
    const globalStatsListener = window.db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        realtimeStats.totalUsers = Object.keys(users).length;
        realtimeStats.onlineUsers = Object.values(users).filter(u => u.status === 'online').length;
        realtimeStats.bannedUsers = Object.values(users).filter(u => u.isBanned === true).length;
        
        updateGlobalStatsDisplay();
    });
    activeListeners.push({ ref: 'users', listener: globalStatsListener });
    
    // Room Stats
    const roomStatsListener = window.db.ref('rooms').on('value', (snapshot) => {
        const rooms = snapshot.val() || {};
        realtimeStats.totalRooms = Object.keys(rooms).length;
        realtimeStats.activeRooms = Object.values(rooms).filter(r => !r.isDeleted && !r.isArchived).length;
        
        updateGlobalStatsDisplay();
    });
    activeListeners.push({ ref: 'rooms', listener: roomStatsListener });
}

function updateMiniStats(userData = currentUserData) {
    // FALLBACK FÜR UNDEFINED
    const data = userData || { messageCount: 0, roomsCreated: 0 };
    
    const miniMessages = document.getElementById('mini-messages');
    const miniRooms = document.getElementById('mini-rooms');
    
    if (miniMessages) miniMessages.textContent = data.messageCount || 0;
    if (miniRooms) miniRooms.textContent = data.roomsCreated || 0;
}

function updateMainStats(userData) {
    const statMessages = document.getElementById('stat-messages');
    const statRooms = document.getElementById('stat-rooms');
    const statReactions = document.getElementById('stat-reactions');
    const statFriends = document.getElementById('stat-friends');
    
    if (statMessages) statMessages.textContent = userData.messageCount || 0;
    if (statRooms) statRooms.textContent = userData.roomsCreated || 0;
    if (statReactions) statReactions.textContent = userData.reactionsReceived || 0;
    if (statFriends) statFriends.textContent = userData.friendsCount || 0;
}

function updateGlobalStatsDisplay() {
    const totalRoomsEl = document.getElementById('total-rooms');
    const totalUsersEl = document.getElementById('total-users');
    
    if (totalRoomsEl) {
        totalRoomsEl.innerHTML = `
            <strong>${realtimeStats.totalRooms}</strong> Räume<br>
            <small>${realtimeStats.activeRooms} aktiv</small>
        `;
    }
    
    if (totalUsersEl) {
        totalUsersEl.innerHTML = `
            <strong>${realtimeStats.totalUsers}</strong> User<br>
            <small>${realtimeStats.onlineUsers} online</small>
        `;
    }
}

// ===== EVENT LISTENER SETUP =====

function setupEventListeners() {
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    // Room Create
    document.getElementById('create-room-btn')?.addEventListener('click', createRoom);
    
    // Profile Save
    document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);
    
    // Avatar Upload
    document.getElementById('avatar-upload')?.addEventListener('change', updateAvatar);
    
    // Room Search
    document.getElementById('room-search')?.addEventListener('input', filterRooms);
    
    // Theme Toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

    // Passwort ändern
    document.getElementById('change-password-btn')?.addEventListener('click', changePassword);

  // Passwort-Enter-Taste unterstützen
    document.getElementById('confirm-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            changePassword();
        }
    });
}

async function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('❌ Bitte alle Felder ausfüllen', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('❌ Die neuen Passwörter stimmen nicht überein', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('❌ Das Passwort muss mindestens 6 Zeichen lang sein', 'error');
        return;
    }
    
    try {
        const user = window.auth.currentUser;
        
        // Re-authenticate user
        const credential = window.firebase.auth.EmailAuthProvider.credential(
            user.email, 
            currentPassword
        );
        
        await user.reauthenticateWithCredential(credential);
        
        // Update password
        await user.updatePassword(newPassword);
        
        // Felder leeren
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        // Password change log in database
        await window.db.ref(`users/${user.uid}/passwordChanges`).push({
            changedAt: Date.now(),
            ip: await getClientIP(),
            userAgent: navigator.userAgent
        });
        
        showNotification('✅ Passwort erfolgreich geändert!', 'success');
        
        // Automatisch ausloggen nach Passwortänderung (Sicherheit)
        setTimeout(() => {
            showNotification('🔒 Aus Sicherheitsgründen wirst du abgemeldet...', 'info');
            setTimeout(() => logout(), 2000);
        }, 3000);
        
    } catch (error) {
        console.error('❌ Passwort ändern Fehler:', error);
        
        switch(error.code) {
            case 'auth/wrong-password':
                showNotification('❌ Das aktuelle Passwort ist falsch', 'error');
                break;
            case 'auth/requires-recent-login':
                showNotification('❌ Bitte melde dich erneut an, um dein Passwort zu ändern', 'error');
                break;
            case 'auth/weak-password':
                showNotification('❌ Das Passwort ist zu schwach. Verwende mindestens 6 Zeichen', 'error');
                break;
            default:
                showNotification('❌ Fehler beim Ändern des Passworts: ' + error.message, 'error');
        }
    }
}

// Hilfsfunktion für Client IP (näherungsweise)
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}

function filterRooms() {
    const searchInput = document.getElementById('room-search');
    const roomsList = document.getElementById('rooms-list');
    
    if (!searchInput || !roomsList) return;
    
    const query = searchInput.value.toLowerCase().trim();
    const roomCards = roomsList.querySelectorAll('.room-card');
    
    if (!query) {
        roomCards.forEach(card => card.style.display = 'block');
        return;
    }
    
    roomCards.forEach(card => {
        const roomName = card.querySelector('.room-name')?.textContent.toLowerCase() || '';
        const roomDesc = card.querySelector('.room-description')?.textContent.toLowerCase() || '';
        const owner = card.querySelector('.room-owner span')?.textContent.toLowerCase() || '';
        
        if (roomName.includes(query) || roomDesc.includes(query) || owner.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ===== HELPER FUNCTIONS =====

function showSection(section) {
    // Alle Sektionen ausblenden
    document.querySelectorAll('.content-section').forEach(el => {
        el.classList.remove('active');
    });
    
    // Alle Menu Items deaktivieren
    document.querySelectorAll('.menu-item').forEach(el => {
        el.classList.remove('active');
    });
    
    // Gewählte Sektion zeigen
    const target = document.getElementById(`${section}-section`);
    if (target) target.classList.add('active');
    
    // Gewähltes Menu Item aktivieren
    const menuItem = document.querySelector(`.menu-item[onclick*="${section}"]`);
    if (menuItem) menuItem.classList.add('active');
    
    // Spezielle Aktionen
    if (section === 'admin' && isAdmin) {
        loadAdminPanel();
    }
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('chat-theme', newTheme);
    
    const themeIcon = document.getElementById('dashboard-theme-icon');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'light' ? '🌙' : '☀️';
    }
    
    showNotification(`🌓 Theme: ${newTheme === 'light' ? 'Light' : 'Dark'}`, 'info');
}

function refreshRooms() {
    loadRooms();
    showNotification('🔄 Räume aktualisiert', 'success');
}

function logout() {
    if (!confirm('Wirklich ausloggen?')) return;
    
    try {
        // Online-Status entfernen
        if (currentUser) {
            window.db.ref('users/' + currentUser.uid).update({
                status: 'offline',
                lastSeen: Date.now()
            });
        }
        
        // Listener stoppen
        stopAllListeners();
        
        // Firebase ausloggen
        window.auth.signOut();
        
        showNotification('👋 Bis bald!', 'success');
        
        // Weiterleitung
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Logout Error:', error);
        showNotification('❌ Logout fehlgeschlagen', 'error');
    }
}

function startRealtimeListeners() {
    // User status on disconnect
    if (currentUser) {
        window.db.ref(`users/${currentUser.uid}/status`).onDisconnect().set('offline');
    }
}

function stopAllListeners() {
    activeListeners.forEach(({ ref, listener }) => {
        if (listener) {
            window.db.ref(ref).off('value', listener);
        }
    });
    activeListeners = [];
}

function closeModal() {
    const modal = document.getElementById('room-management-modal');
    if (modal) modal.remove();
}

function handleLogout() {
    stopAllListeners();
    window.location.href = 'index.html';
}

function showNotification(message, type = 'info') {
    // Container erstellen falls nicht existiert
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">${message}</div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateAvatar(name) {
    if (!name) name = 'User';
    const initials = name.charAt(0).toUpperCase();
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const color = colors[initials.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
        <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="${color}"/>
            <text x="50" y="55" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text>
        </svg>
    `)}`;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Nie';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    
    return new Date(timestamp).toLocaleDateString();
}

// ===== ADMIN PANEL FUNCTIONS =====

async function loadAdminPanel() {
    if (!isAdmin) return;
    
    try {
        // Lade alle User
        const usersSnapshot = await window.db.ref('users').once('value');
        const users = usersSnapshot.val() || {};
        
        // Admin Panel HTML generieren
        const adminHTML = generateAdminPanelHTML(users);
        document.getElementById('admin-section').innerHTML = adminHTML;
        
    } catch (error) {
        console.error('❌ Admin Panel Error:', error);
        document.getElementById('admin-section').innerHTML = `
            <div class="error">❌ Admin Panel konnte nicht geladen werden</div>
        `;
    }
}

function generateAdminPanelHTML(users) {
    // Zähle verschiedene User-Typen
    const totalUsers = Object.keys(users).length;
    const onlineUsers = Object.values(users).filter(u => u.status === 'online').length;
    const bannedUsers = Object.values(users).filter(u => u.isBanned === true).length;
    const adminUsers = Object.values(users).filter(u => u.role === 'admin' || u.isAdmin === true).length;
    
    let userRowsHTML = '';
    Object.entries(users).forEach(([userId, user]) => {
        if (!user || user.isDeleted) return;
        
        userRowsHTML += `
            <tr class="user-row">
                <td>
                    <div class="user-cell">
                        <img src="${user.avatar || generateAvatar(user.displayName)}" 
                             class="user-avatar-small"
                             onerror="this.src='${generateAvatar(user.displayName)}'">
                        <div>
                            <strong>${escapeHtml(user.displayName || 'Unbekannt')}</strong><br>
                            <small>${user.email || ''}</small>
                        </div>
                    </div>
                </td>
                <td>${user.role === 'admin' ? '👑 Admin' : '👤 User'}</td>
                <td>
                    <span class="status-badge ${user.status === 'online' ? 'online' : 'offline'}">
                        ${user.status === 'online' ? '🟢 Online' : '⚫ Offline'}
                    </span>
                </td>
                <td>
                    ${user.isBanned ? '⛔ Gebannt' : '✅ Aktiv'}
                    ${user.isTimedOut && user.timeoutUntil > Date.now() ? '<br><small>⏰ Timeout</small>' : ''}
                </td>
                <td>
                    <div class="admin-actions">
                        <button class="admin-btn view" onclick="showUserProfileModal('${userId}')">
                            👁️
                        </button>
                        <button class="admin-btn chat" onclick="startPrivateChat('${userId}', '${escapeHtml(user.displayName)}')">
                            💬
                        </button>
                        ${userId !== currentUser.uid ? `
                            ${user.role !== 'admin' ? `
                                <button class="admin-btn promote" onclick="promoteToAdmin('${userId}')">
                                    👑
                                </button>
                            ` : ''}
                            <button class="admin-btn ${user.isBanned ? 'unban' : 'ban'}" 
                                    onclick="toggleBanUser('${userId}', ${user.isBanned || false})">
                                ${user.isBanned ? '✅' : '⛔'}
                            </button>
                            <button class="admin-btn timeout" onclick="timeoutUser('${userId}')">
                                ⏰
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    return `
        <div class="section-header">
            <h1>👑 Admin Control Panel</h1>
            <div class="header-actions">
                <button class="modern-btn cosmic-btn" onclick="loadAdminPanel()">
                    🔄 Aktualisieren
                </button>
            </div>
        </div>
        
        <div class="admin-stats-grid">
            <div class="stat-card">
                <div class="stat-value">${totalUsers}</div>
                <div class="stat-label">👤 Gesamt User</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${onlineUsers}</div>
                <div class="stat-label">🟢 Online</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${bannedUsers}</div>
                <div class="stat-label">⛔ Gebannt</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${adminUsers}</div>
                <div class="stat-label">👑 Admins</div>
            </div>
        </div>
        
        <div class="admin-content">
            <h3>👥 User Management</h3>
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Rolle</th>
                            <th>Status</th>
                            <th>Account</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${userRowsHTML || '<tr><td colspan="5" class="no-data">Keine User gefunden</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function promoteToAdmin(userId) {
    if (!isAdmin || userId === currentUser.uid) return;
    
    if (!confirm('Diesen User wirklich zum Admin befördern?\n\nEr/sie erhält volle Admin-Rechte!')) {
        return;
    }
    
    try {
        await window.db.ref(`users/${userId}`).update({
            role: 'admin',
            isAdmin: true,
            promotedAt: Date.now(),
            promotedBy: currentUser.uid
        });
        
        showNotification('✅ User zum Admin befördert', 'success');
        loadAdminPanel();
        
    } catch (error) {
        console.error('❌ Promote Error:', error);
        showNotification('❌ Beförderung fehlgeschlagen', 'error');
    }
}


// ===== ROOM MANAGEMENT TAB FUNCTION =====
function switchRoomManagementTab(tabName) {
    console.log('Wechsel zu Tab:', tabName);
    
    // Verstecke alle Tabs
    document.querySelectorAll('.management-tab').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Entferne 'active' Klasse von allen Tab-Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Zeige den gewählten Tab
    const activeTab = document.getElementById(`management-${tabName}`);
    if (activeTab) {
        activeTab.style.display = 'block';
    }
    
    // Aktiviere den gewählten Button
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Lade Mitglieder wenn nötig
    if (tabName === 'members') {
        // Extrahiere roomId aus dem Modal
        const deleteBtn = document.querySelector('.danger-btn.delete[onclick]');
        if (deleteBtn) {
            const onclickText = deleteBtn.getAttribute('onclick');
            const roomIdMatch = onclickText.match(/'([^']+)'/);
            if (roomIdMatch && roomIdMatch[1]) {
                loadRoomMembers(roomIdMatch[1]);
            }
        }
    }
}

// Ersetze die alte Funktion
window.switchManagementTab = switchRoomManagementTab;
// ===== GLOBALE FUNKTIONEN EXPORT =====

window.showSection = showSection;
window.toggleTheme = toggleTheme;
window.removeAvatar = removeAvatar;
window.refreshRooms = refreshRooms;
window.changePassword = changePassword;
window.openRoomManagement = openRoomManagement;
window.saveRoomSettings = saveRoomSettings;
window.deleteRoom = deleteRoom;
window.transferRoomOwnership = transferRoomOwnership;
window.kickMember = kickMember;
window.leaveRoom = leaveRoom;
window.promoteMember = promoteMember;
window.refreshRoomMembers = refreshRoomMembers;
window.switchManagementTab = switchManagementTab;
window.closeModal = closeModal;
window.archiveRoom = archiveRoom;
window.clearRoomMessages = clearRoomMessages;
window.showUserProfileModal = showUserProfileModal;
window.closeUserProfileModal = closeUserProfileModal;
window.startPrivateChat = startPrivateChat;
window.toggleBanUser = toggleBanUser;
window.timeoutUser = timeoutUser;
window.promoteToAdmin = promoteToAdmin;
window.loadAdminPanel = loadAdminPanel;
window.filterRooms = filterRooms;
window.joinRoom = joinRoom;
window.createRoom = createRoom;
window.logout = logout;


console.log('✅ Dashboard.js vollständig geladen');
console.log('🔄 Dashboard.js Version: 2.0 - ' + new Date().toISOString());