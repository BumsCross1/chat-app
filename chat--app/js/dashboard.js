// Enhanced Dashboard mit allen Features - COMPLETELY FIXED
const roomsList = document.getElementById('rooms-list');
const createRoomBtn = document.getElementById('create-room-btn');
const logoutBtn = document.getElementById('logout-btn');
const roomSearchInput = document.getElementById('room-search');

let currentUser = null;
let allRooms = [];
let allUsers = [];

// Enhanced Theme System for Dashboard
function initTheme() {
    const savedTheme = localStorage.getItem('chat-theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('chat-theme', theme);
    
    // Update theme icon
    const themeIcon = document.getElementById('dashboard-theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
    
    console.log('✅ Dashboard Theme geändert zu:', theme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showNotification(`Theme zu ${newTheme === 'light' ? '☀️ Light' : '🌙 Dark'} geändert`, 'success');
}

// Enhanced Initialization
function initDashboard() {
    currentUser = auth.currentUser;
    
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }
    
    console.log('🚀 Dashboard initialisiert für:', currentUser.email);
    
    // Theme initialisieren
    initTheme();
    
    loadUserInfo()
        .then(() => loadUserStats())
        .then(() => {
            initUserSearch();
            loadRooms();
            loadGlobalStats();
            initSpaceBackground();
            setupEventListeners();
            
            showSection('rooms');
            showNotification('🚀 Willkommen im Space Chat!', 'success');
        })
        .catch(error => {
            console.error('❌ Fehler bei Dashboard-Initialisierung:', error);
            showNotification('❌ Fehler beim Laden des Dashboards', 'error');
        });
}

// Enhanced User Info Loading
function loadUserInfo() {
    return new Promise((resolve, reject) => {
        const user = auth.currentUser;
        if (!user) {
            reject(new Error('Kein User'));
            return;
        }

        // User Daten aus Firebase laden
        db.ref(`users/${user.uid}`).once('value')
            .then((snapshot) => {
                const userData = snapshot.val() || {};
                
                console.log('📊 User Daten geladen:', userData);
                
                // UI aktualisieren
                const displayNameElement = document.getElementById('user-displayname');
                const userEmailElement = document.getElementById('user-email');
                const displayNameInput = document.getElementById('displayName');
                
                if (displayNameElement) {
                    displayNameElement.textContent = user.displayName || user.email || 'User';
                }
                if (userEmailElement) userEmailElement.value = user.email;
                if (displayNameInput) displayNameInput.value = user.displayName || '';
                
                // Mini Stats
                const miniMessages = document.getElementById('mini-messages');
                const miniRooms = document.getElementById('mini-rooms');
                if (miniMessages) miniMessages.textContent = userData.messageCount || '0';
                if (miniRooms) miniRooms.textContent = userData.roomsCreated || '0';
                
                // Main Stats
                const statMessages = document.getElementById('stat-messages');
                const statRooms = document.getElementById('stat-rooms');
                const statReactions = document.getElementById('stat-reactions');
                const statFriends = document.getElementById('stat-friends');
                
                if (statMessages) statMessages.textContent = userData.messageCount || '0';
                if (statRooms) statRooms.textContent = userData.roomsCreated || '0';
                if (statReactions) statReactions.textContent = userData.reactionsReceived || '0';
                if (statFriends) statFriends.textContent = userData.friendsCount || '0';
                
                return loadAvatar();
            })
            .then(() => resolve())
            .catch(error => {
                console.error('Fehler beim Laden der User-Info:', error);
                resolve();
            });
    });
}

// FIXED: Enhanced Avatar System with Immediate Persistence
function loadAvatar() {
    return new Promise((resolve) => {
        const user = auth.currentUser;
        if (!user) {
            console.log('❌ Kein User für Avatar-Load');
            resolve();
            return;
        }

        console.log('🔄 Lade Avatar für User:', user.uid);
        
        db.ref(`users/${user.uid}/avatar`).once('value')
            .then((snapshot) => {
                const avatarData = snapshot.val();
                console.log('📥 Avatar Daten empfangen:', avatarData ? 'Ja' : 'Nein');
                
                const userAvatar = document.getElementById('user-avatar');
                const profileAvatar = document.getElementById('profile-avatar');
                
                if (avatarData && avatarData !== 'null' && avatarData !== '') {
                    console.log('✅ Avatar aus Database geladen');
                    if (userAvatar) {
                        userAvatar.src = avatarData;
                        userAvatar.onerror = function() {
                            console.error('❌ Fehler beim Laden des Avatar-Bildes');
                            this.src = generateDefaultAvatar();
                        };
                    }
                    if (profileAvatar) {
                        profileAvatar.src = avatarData;
                        profileAvatar.onerror = function() {
                            console.error('❌ Fehler beim Laden des Profil-Avatar-Bildes');
                            this.src = generateDefaultAvatar();
                        };
                    }
                } else {
                    console.log('🔄 Kein Avatar gefunden, setze Default');
                    setDefaultAvatar();
                }
                resolve();
            })
            .catch((error) => {
                console.error('❌ Fehler beim Laden des Avatars:', error);
                setDefaultAvatar();
                resolve();
            });
    });
}

// FIXED: Avatar sofort speichern mit besserem Error Handling
function setupAvatarUpload() {
    const avatarUpload = document.getElementById('avatar-upload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                console.log('❌ Keine Datei ausgewählt');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                showNotification('❌ Bitte nur Bilder hochladen!', 'error');
                return;
            }
            
            if (file.size > 2 * 1024 * 1024) {
                showNotification('❌ Bild darf nicht größer als 2MB sein!', 'error');
                return;
            }
            
            console.log('🔄 Starte Avatar Upload...');
            
            try {
                const base64 = await fileToBase64(file);
                console.log('✅ Bild zu Base64 konvertiert, Länge:', base64.length);
                
                // Avatare in UI aktualisieren
                const userAvatar = document.getElementById('user-avatar');
                const profileAvatar = document.getElementById('profile-avatar');
                
                if (userAvatar) {
                    userAvatar.src = base64;
                    console.log('✅ User Avatar in UI aktualisiert');
                }
                if (profileAvatar) {
                    profileAvatar.src = base64;
                    console.log('✅ Profile Avatar in UI aktualisiert');
                }
                
                // SOFORT in Database speichern
                const user = auth.currentUser;
                if (user) {
                    console.log('💾 Speichere Avatar in Database...');
                    await db.ref(`users/${user.uid}/avatar`).set(base64);
                    console.log('✅ Avatar erfolgreich in Database gespeichert');
                    showNotification('✅ Avatar gespeichert!', 'success');
                } else {
                    console.error('❌ Kein User für Avatar-Speicherung');
                    showNotification('❌ Fehler: Nicht eingeloggt', 'error');
                }
                
            } catch (error) {
                console.error('❌ Fehler beim Hochladen des Avatars:', error);
                showNotification('❌ Fehler beim Hochladen des Avatars', 'error');
            }
        });
    } else {
        console.error('❌ Avatar Upload Element nicht gefunden');
    }
}

// FIXED: Avatar entfernen mit besserem Feedback
function removeAvatar() {
    const user = auth.currentUser;
    if (!user) {
        showNotification('❌ Nicht eingeloggt', 'error');
        return;
    }
    
    console.log('🗑️ Entferne Avatar...');
    
    // Setze Default Avatar in UI
    setDefaultAvatar();
    
    // Entferne Avatar aus Firebase
    db.ref(`users/${user.uid}/avatar`).remove()
        .then(() => {
            console.log('✅ Avatar aus Database entfernt');
            showNotification('🗑️ Avatar entfernt!', 'success');
        })
        .catch(error => {
            console.error('❌ Fehler beim Entfernen des Avatars:', error);
            showNotification('❌ Fehler beim Entfernen des Avatars', 'error');
        });
}

// FIXED: Utility function for file conversion with error handling
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                console.log('✅ FileReader erfolgreich');
                resolve(reader.result);
            };
            reader.onerror = (error) => {
                console.error('❌ FileReader Fehler:', error);
                reject(error);
            };
            reader.onabort = () => {
                console.error('❌ FileReader abgebrochen');
                reject(new Error('Upload abgebrochen'));
            };
        } catch (error) {
            console.error('❌ Fehler in fileToBase64:', error);
            reject(error);
        }
    });
}

function setDefaultAvatar() {
    const defaultAvatar = generateDefaultAvatar();
    const avatars = [
        document.getElementById('user-avatar'),
        document.getElementById('profile-avatar')
    ];
    
    avatars.forEach(avatar => {
        if (avatar) {
            avatar.src = defaultAvatar;
            avatar.onerror = function() {
                this.src = generateDefaultAvatar();
            };
        }
    });
}

function generateDefaultAvatar(name) {
    const user = auth.currentUser;
    const displayName = name || user?.displayName || user?.email || 'User';
    const initial = displayName.charAt(0).toUpperCase();
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const color = colors[initial.charCodeAt(0) % colors.length];
    
    const svg = `
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="60" fill="${color}"/>
            <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="48" font-weight="bold">${initial}</text>
        </svg>
    `;
    
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// FIXED: Avatar sofort speichern
function setupAvatarUpload() {
    const avatarUpload = document.getElementById('avatar-upload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                showNotification('❌ Bitte nur Bilder hochladen!', 'error');
                return;
            }
            
            if (file.size > 2 * 1024 * 1024) {
                showNotification('❌ Bild darf nicht größer als 2MB sein!', 'error');
                return;
            }
            
            try {
                const base64 = await fileToBase64(file);
                
                // Avatare in UI aktualisieren
                const userAvatar = document.getElementById('user-avatar');
                const profileAvatar = document.getElementById('profile-avatar');
                
                if (userAvatar) userAvatar.src = base64;
                if (profileAvatar) profileAvatar.src = base64;
                
                // SOFORT in Database speichern
                const user = auth.currentUser;
                if (user) {
                    await db.ref(`users/${user.uid}/avatar`).set(base64);
                    showNotification('✅ Avatar gespeichert!', 'success');
                    console.log('✅ Avatar in Database gespeichert');
                }
                
            } catch (error) {
                console.error('❌ Fehler beim Hochladen des Avatars:', error);
                showNotification('❌ Fehler beim Hochladen des Avatars', 'error');
            }
        });
    }
}

// FIXED: Avatar entfernen
function removeAvatar() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Setze Default Avatar in UI
    setDefaultAvatar();
    
    // Entferne Avatar aus Firebase
    db.ref(`users/${user.uid}/avatar`).remove()
        .then(() => {
            showNotification('🗑️ Avatar entfernt!', 'success');
            console.log('✅ Avatar aus Database entfernt');
        })
        .catch(error => {
            console.error('❌ Fehler beim Entfernen des Avatars:', error);
            showNotification('❌ Fehler beim Entfernen des Avatars', 'error');
        });
}

// Utility function for file conversion
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Enhanced User Search System - FIXED
function initUserSearch() {
    console.log('🔍 Initialisiere User-Suche...');
    
    const userSearchInput = document.getElementById('user-search');
    if (userSearchInput) {
        let searchTimeout;
        userSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            
            searchTimeout = setTimeout(() => {
                console.log('🔍 Suche nach:', searchTerm);
                searchUsers(searchTerm);
            }, 300);
        });
    }
}

function searchUsers(searchTerm) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    console.log('🔍 Starte Suche:', searchTerm);
    
    if (searchTerm.length < 2) {
        usersList.innerHTML = '<div class="info-text">🔍 Gib mindestens 2 Zeichen ein um User zu suchen</div>';
        return;
    }
    
    usersList.innerHTML = '<div class="loading">👥 Lade User...</div>';
    
    // Versuche alle User zu laden
    db.ref('users').once('value')
        .then((snapshot) => {
            const data = snapshot.val() || {};
            allUsers = Object.entries(data).map(([uid, userData]) => ({
                uid,
                ...userData
            }));
            
            console.log('👥 User geladen:', allUsers.length);
            
            const currentUserId = auth.currentUser.uid;
            const filteredUsers = allUsers.filter(user => 
                user.uid !== currentUserId &&
                (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            
            console.log('✅ Gefundene User:', filteredUsers.length);
            
            usersList.innerHTML = '';
            
            if (filteredUsers.length === 0) {
                usersList.innerHTML = '<div class="no-results">🔍 Keine User gefunden</div>';
                return;
            }
            
            filteredUsers.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'user-card';
                
                const userAvatar = user.avatar || generateDefaultAvatar(user.displayName);
                
                userElement.innerHTML = `
                    <img src="${userAvatar}" alt="Avatar" class="user-avatar" 
                         onerror="this.src='${generateDefaultAvatar(user.displayName)}'">
                    <div class="user-info">
                        <span class="user-name">${escapeHtml(user.displayName || 'Unbekannt')}</span>
                        <span class="user-email">${user.email || ''}</span>
                        <span class="user-status">${user.status === 'online' ? '🟢 Online' : '⚫ Offline'}</span>
                    </div>
                    <button class="message-user-btn" onclick="startPrivateChat('${user.uid}', '${escapeHtml(user.displayName || user.email)}')">
                        💬 Chat
                    </button>
                `;
                usersList.appendChild(userElement);
            });
        })
        .catch(error => {
            console.error('❌ Fehler beim Laden der User:', error);
            usersList.innerHTML = `
                <div class="no-results">
                    ❌ Fehler beim Laden der User
                    <br><small>Bitte überprüfe die Firebase Database Rules</small>
                </div>
            `;
        });
}

function startPrivateChat(userId, userName) {
    const currentUser = auth.currentUser;
    
    // Private Room ID generieren
    const roomId = [currentUser.uid, userId].sort().join('_');
    const roomName = `Privat: ${currentUser.displayName} & ${userName}`;
    
    showNotification('💬 Erstelle privaten Chat...', 'info');
    
    db.ref(`rooms/${roomId}`).once('value')
        .then(roomSnapshot => {
            if (!roomSnapshot.exists()) {
                // Neuen privaten Raum erstellen
                return db.ref(`rooms/${roomId}`).set({
                    id: roomId,
                    name: roomName,
                    description: `Privater Chat zwischen ${currentUser.displayName} und ${userName}`,
                    isPrivate: true,
                    ownerId: currentUser.uid,
                    ownerName: currentUser.displayName,
                    createdAt: Date.now(),
                    memberCount: 2,
                    settings: {
                        allowImages: true,
                        allowFiles: true,
                        allowVoice: true,
                        maxFileSize: 10
                    },
                    members: {
                        [currentUser.uid]: {
                            joinedAt: Date.now(),
                            role: 'owner'
                        },
                        [userId]: {
                            joinedAt: Date.now(),
                            role: 'member'
                        }
                    }
                });
            }
        })
        .then(() => {
            // 🔴 CRITICAL FIX: localStorage SICHER setzen
            localStorage.setItem('roomId', roomId);
            localStorage.setItem('roomName', roomName);
            
            console.log('✅ Privater Chat erstellt:', { roomId, roomName });
            
            showNotification('💬 Privater Chat gestartet!', 'success');
            
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1000);
        })
        .catch(error => {
            console.error('Private chat creation error:', error);
            showNotification('❌ Fehler beim Erstellen des privaten Chats', 'error');
        });
}

// Enhanced Profile Management
function setupProfileSaveListener() {
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const user = auth.currentUser;
            const displayNameInput = document.getElementById('displayName');
            
            if (!displayNameInput) {
                showNotification('❌ DisplayName Input nicht gefunden', 'error');
                return;
            }
            
            const displayName = displayNameInput.value.trim();
            
            if (!displayName) {
                showNotification('Bitte einen Anzeigenamen eingeben', 'error');
                return;
            }
            
            // UI Feedback
            saveProfileBtn.disabled = true;
            saveProfileBtn.innerHTML = '<div class="spinner"></div> Speichern...';
            
            user.updateProfile({
                displayName: displayName
            })
            .then(() => {
                // User Daten in Firebase aktualisieren
                return db.ref(`users/${user.uid}`).update({
                    displayName: displayName,
                    lastUpdated: Date.now()
                });
            })
            .then(() => {
                // Avatar speichern falls geändert
                const profileAvatar = document.getElementById('profile-avatar');
                if (profileAvatar && !profileAvatar.src.includes('data:image/svg+xml')) {
                    return db.ref(`users/${user.uid}/avatar`).set(profileAvatar.src);
                }
            })
            .then(() => {
                showNotification('💾 Profil erfolgreich gespeichert!', 'success');
                loadUserInfo(); // UI aktualisieren
            })
            .catch(error => {
                showNotification('❌ Fehler: ' + error.message, 'error');
            })
            .finally(() => {
                saveProfileBtn.disabled = false;
                saveProfileBtn.textContent = '💾 Profil speichern';
            });
        });
    }
}

// Enhanced Room Creation
function createEnhancedRoom() {
    const nameInput = document.getElementById('room-name');
    const descriptionInput = document.getElementById('room-description');
    const passwordInput = document.getElementById('room-password');
    
    if (!nameInput || !descriptionInput || !passwordInput) {
        showNotification('❌ Raum-Formular nicht gefunden', 'error');
        return;
    }
    
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    const password = passwordInput.value;
    
    if (!name) {
        showNotification('Bitte Raumname eingeben', 'error');
        return;
    }
    
    if (name.length < 3) {
        showNotification('Raumname muss mindestens 3 Zeichen lang sein', 'error');
        return;
    }
    
    // UI Feedback
    const createBtn = document.getElementById('create-room-btn');
    createBtn.disabled = true;
    createBtn.innerHTML = '<div class="spinner"></div> Erstelle Raum...';
    
    // Password hashing
    if (password) {
        createRoomInFirebase(name, description, password);
    } else {
        createRoomInFirebase(name, description, null);
    }
}

function createRoomInFirebase(name, description, password) {
    const user = auth.currentUser;
    const roomRef = db.ref('rooms').push();
    const roomId = roomRef.key;
    
    const roomData = {
        id: roomId,
        name: name,
        description: description,
        passwordHash: password,
        isPrivate: !!password,
        ownerId: user.uid,
        ownerName: user.displayName || user.email,
        createdAt: Date.now(),
        memberCount: 1,
        settings: {
            allowImages: true,
            allowFiles: true,
            allowVoice: true,
            maxFileSize: 10
        },
        members: {
            [user.uid]: {
                joinedAt: Date.now(),
                role: 'owner'
            }
        }
    };
    
    roomRef.set(roomData)
        .then(() => {
            // User Stats aktualisieren
            return db.ref(`users/${user.uid}/roomsCreated`).transaction((current) => (current || 0) + 1);
        })
        .then(() => {
            // Formular zurücksetzen
            document.getElementById('room-name').value = '';
            document.getElementById('room-description').value = '';
            document.getElementById('room-password').value = '';
            
            // UI zurücksetzen
            const createBtn = document.getElementById('create-room-btn');
            createBtn.disabled = false;
            createBtn.textContent = '🚀 Raum erstellen';
            
            showSection('rooms');
            showNotification('🚀 Raum erfolgreich erstellt!', 'success');
        })
        .catch(error => {
            showNotification('❌ Fehler beim Erstellen des Raums: ' + error.message, 'error');
            
            // UI zurücksetzen
            const createBtn = document.getElementById('create-room-btn');
            createBtn.disabled = false;
            createBtn.textContent = '🚀 Raum erstellen';
        });
}

// dashboard.js - RAUMVERWALTUNG ERGÄNZEN
function showRoomManagement(roomId = null) {
    console.log('🔧 Zeige Raumverwaltung für:', roomId);
    
    if (!roomId) {
        const currentRoomId = localStorage.getItem('roomId');
        if (currentRoomId) {
            roomId = currentRoomId;
        } else {
            showNotification('❌ Kein Raum ausgewählt', 'error');
            return;
        }
    }
    
    // Hole Raumdaten
    db.ref(`rooms/${roomId}`).once('value')
        .then(roomSnapshot => {
            const room = roomSnapshot.val();
            if (!room) {
                showNotification('❌ Raum nicht gefunden', 'error');
                return;
            }
            
            // Prüfe ob User Besitzer ist
            if (room.ownerId !== auth.currentUser.uid) {
                showNotification('❌ Nur der Raum-Besitzer kann diesen Raum verwalten', 'error');
                return;
            }
            
            // Zeige Management Modal
            showRoomManagementModal(room);
        })
        .catch(error => {
            console.error('Fehler beim Laden der Raumdaten:', error);
            showNotification('❌ Fehler beim Laden', 'error');
        });
}

function showRoomManagementModal(room) {
    // Erstelle oder finde Modal
    let modal = document.getElementById('room-management-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'room-management-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    // Hole aktuelle Mitglieder
    db.ref(`rooms/${room.id}/members`).once('value')
        .then(membersSnapshot => {
            const members = membersSnapshot.val() || {};
            const membersList = Object.entries(members).map(([uid, data]) => ({ uid, ...data }));
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <h2>🔧 Raumverwaltung: ${escapeHtml(room.name)}</h2>
                    
                    <div class="management-section">
                        <h3>👥 Mitglieder (${membersList.length})</h3>
                        <div class="members-list" id="room-members-list">
                            ${membersList.map(member => `
                                <div class="member-item" data-uid="${member.uid}">
                                    <span class="member-name">${member.displayName || 'Unbekannt'}</span>
                                    <span class="member-role">${member.role || 'Mitglied'}</span>
                                    <div class="member-actions">
                                        <button class="action-btn" onclick="kickUser('${room.id}', '${member.uid}')">🚫 Rauswerfen</button>
                                        <button class="action-btn" onclick="banUser('${room.id}', '${member.uid}')">⛔ Bannen</button>
                                        ${member.role !== 'moderator' ? 
                                            `<button class="action-btn" onclick="promoteToModerator('${room.id}', '${member.uid}')">👑 Zum Moderator ernennen</button>` : 
                                            `<button class="action-btn" onclick="demoteFromModerator('${room.id}', '${member.uid}')">👤 Moderator entfernen</button>`
                                        }
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="management-section">
                        <h3>⚙️ Raumeinstellungen</h3>
                        <div class="settings-grid">
                            <label class="checkbox-group">
                                <input type="checkbox" id="allow-images" ${room.settings?.allowImages ? 'checked' : ''}>
                                <span>🖼️ Bilder erlauben</span>
                            </label>
                            <label class="checkbox-group">
                                <input type="checkbox" id="allow-files" ${room.settings?.allowFiles ? 'checked' : ''}>
                                <span>📎 Dateien erlauben</span>
                            </label>
                            <label class="checkbox-group">
                                <input type="checkbox" id="allow-voice" ${room.settings?.allowVoice ? 'checked' : ''}>
                                <span>🎤 Sprachnachrichten erlauben</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="management-section danger-zone">
                        <h3 style="color: var(--error);">⚠️ Gefahrenzone</h3>
                        <div class="danger-actions">
                            <button class="danger-btn" onclick="deleteRoom('${room.id}')">🗑️ Raum löschen</button>
                            <button class="danger-btn" onclick="clearRoomMessages('${room.id}')">🗑️ Alle Nachrichten löschen</button>
                            <button class="danger-btn" onclick="resetRoomPassword('${room.id}')">🔑 Passwort zurücksetzen</button>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="modern-btn secondary-btn" onclick="closeModal('room-management-modal')">Schließen</button>
                        <button class="modern-btn" onclick="saveRoomSettings('${room.id}')">💾 Einstellungen speichern</button>
                    </div>
                </div>
            `;
            
            modal.classList.remove('hidden');
        });
}

// Verwaltungsfunktionen
function kickUser(roomId, userId) {
    if (confirm(`Willst du diesen User wirklich aus dem Raum werfen?`)) {
        db.ref(`rooms/${roomId}/members/${userId}`).remove()
            .then(() => {
                showNotification('👢 User wurde aus dem Raum geworfen', 'success');
                // Member Count anpassen
                db.ref(`rooms/${roomId}/memberCount`).transaction((current) => Math.max(0, (current || 1) - 1));
            })
            .catch(error => {
                console.error('Fehler beim Kicken:', error);
                showNotification('❌ Fehler beim Kicken', 'error');
            });
    }
}

function banUser(roomId, userId) {
    if (confirm(`Willst du diesen User wirklich aus dem Raum bannen?`)) {
        // Zu gebannten Usern hinzufügen
        db.ref(`rooms/${roomId}/banned/${userId}`).set({
            bannedAt: Date.now(),
            bannedBy: auth.currentUser.uid
        })
        .then(() => kickUser(roomId, userId))
        .then(() => {
            showNotification('⛔ User wurde gebannt', 'success');
        })
        .catch(error => {
            console.error('Fehler beim Bannen:', error);
            showNotification('❌ Fehler beim Bannen', 'error');
        });
    }
}

function promoteToModerator(roomId, userId) {
    db.ref(`rooms/${roomId}/members/${userId}/role`).set('moderator')
        .then(() => {
            showNotification('👑 User zum Moderator ernannt', 'success');
        })
        .catch(error => {
            console.error('Fehler beim Befördern:', error);
            showNotification('❌ Fehler beim Befördern', 'error');
        });
}

function demoteFromModerator(roomId, userId) {
    db.ref(`rooms/${roomId}/members/${userId}/role`).set('member')
        .then(() => {
            showNotification('👤 User ist jetzt nur noch Mitglied', 'success');
        })
        .catch(error => {
            console.error('Fehler beim Zurückstufen:', error);
            showNotification('❌ Fehler beim Zurückstufen', 'error');
        });
}

function deleteRoom(roomId) {
    if (confirm('⚠️ Willst du diesen Raum wirklich LÖSCHEN?\n\nDiese Aktion kann NICHT rückgängig gemacht werden!')) {
        // 1. Alle Nachrichten des Raums löschen
        db.ref(`messages/${roomId}`).remove()
            .then(() => {
                // 2. Raum selbst löschen
                return db.ref(`rooms/${roomId}`).remove();
            })
            .then(() => {
                showNotification('🗑️ Raum erfolgreich gelöscht', 'success');
                closeModal('room-management-modal');
                loadRooms(); // Liste aktualisieren
                
                // Wenn wir im gelöschten Raum waren, zum Dashboard zurück
                const currentRoomId = localStorage.getItem('roomId');
                if (currentRoomId === roomId) {
                    localStorage.removeItem('roomId');
                    localStorage.removeItem('roomName');
                    window.location.href = 'dashboard.html';
                }
            })
            .catch(error => {
                console.error('Fehler beim Löschen des Raums:', error);
                showNotification('❌ Fehler beim Löschen', 'error');
            });
    }
}

function saveRoomSettings(roomId) {
    const settings = {
        allowImages: document.getElementById('allow-images').checked,
        allowFiles: document.getElementById('allow-files').checked,
        allowVoice: document.getElementById('allow-voice').checked,
        maxFileSize: 10
    };
    
    db.ref(`rooms/${roomId}/settings`).set(settings)
        .then(() => {
            showNotification('✅ Raumeinstellungen gespeichert', 'success');
        })
        .catch(error => {
            console.error('Fehler beim Speichern:', error);
            showNotification('❌ Fehler beim Speichern', 'error');
        });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}


// dashboard.js - FIX für private Chats
function loadRooms() {
    if (!roomsList) {
        console.error('❌ roomsList element nicht gefunden');
        return;
    }
    
    roomsList.innerHTML = '<div class="loading">🏠 Lade Räume...</div>';
    
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    db.ref('rooms').on('value', (snap) => {
        const data = snap.val() || {};
        const allRooms = Object.values(data);
        
        console.log('📥 Geladene Räume (alle):', allRooms.length);
        
        // Filtere private Räume, wo User nicht Mitglied ist
        const visibleRooms = allRooms.filter(room => {
            if (!room.isPrivate) return true; // Öffentliche Räume immer anzeigen
            if (room.ownerId === currentUser.uid) return true; // Eigene private Räume
            if (room.members && room.members[currentUser.uid]) return true; // Mitglied in privatem Raum
            return false; // Private Räume ohne Zugriff ausblenden
        });
        
        console.log('👁️ Sichtbare Räume:', visibleRooms.length);
        
        roomsList.innerHTML = '';
        
        if (visibleRooms.length === 0) {
            roomsList.innerHTML = `
                <div class="no-rooms">
                    <h3>🌌 Noch keine Räume vorhanden</h3>
                    <p>Erstelle den ersten Raum und starte das Abenteuer!</p>
                    <button class="modern-btn cosmic-btn" onclick="showSection('create')">
                        🚀 Ersten Raum erstellen
                    </button>
                </div>
            `;
            return;
        }
        
        // Räume sortieren (neueste zuerst)
        const sortedRooms = visibleRooms.sort((a, b) => b.createdAt - a.createdAt);
        
        sortedRooms.forEach(room => {
            const roomCard = createRoomCard(room);
            roomsList.appendChild(roomCard);
        });
        
        // Search functionality
        if (roomSearchInput) {
            roomSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredRooms = visibleRooms.filter(room => 
                    room.name.toLowerCase().includes(searchTerm) ||
                    room.description?.toLowerCase().includes(searchTerm)
                );
                
                roomsList.innerHTML = '';
                filteredRooms.forEach(room => {
                    roomsList.appendChild(createRoomCard(room));
                });
            });
        }
    }, (error) => {
        console.error('❌ Fehler beim Laden der Räume:', error);
        roomsList.innerHTML = '<div class="no-rooms">❌ Fehler beim Laden der Räume</div>';
    });
}

function createRoomCard(room) {
    const roomCard = document.createElement('div');
    roomCard.className = 'room-card';
    
    const isOwner = room.ownerId === auth.currentUser?.uid;
    const isMember = room.members && room.members[auth.currentUser?.uid];
    
    roomCard.innerHTML = `
        <div class="room-header">
            <div>
                <div class="room-name">${escapeHtml(room.name)}</div>
                <div class="room-privacy">${room.passwordHash ? '🔒 Privat' : '🌐 Öffentlich'}</div>
            </div>
            ${isOwner ? `<span class="owner-badge">👑 Besitzer</span>` : ''}
        </div>
        ${room.description ? `<div class="room-description">${escapeHtml(room.description)}</div>` : ''}
        <div class="room-meta">
            <div class="room-owner">
                <span>Erstellt von ${escapeHtml(room.ownerName)}</span>
            </div>
            <div class="room-members">👥 ${room.memberCount || 0}</div>
        </div>
        <div class="room-actions">
            <button class="join-btn" data-room-id="${room.id}" data-room-name="${escapeHtml(room.name)}" data-room-private="${!!room.passwordHash}">
                ${isMember ? '🚪 Betreten' : room.passwordHash ? '🔓 Beitreten' : '🚪 Beitreten'}
            </button>
            ${isOwner ? `
                <button class="manage-btn" onclick="showRoomManagement('${room.id}')">
                    🔧 Verwalten
                </button>
            ` : ''}
        </div>
    `;
    
    return roomCard;
}

// FIXED Room Joining
function setupRoomJoinListeners() {
    document.addEventListener('click', (e) => {
        const joinButton = e.target.closest('.join-btn');
        if (joinButton) {
            const roomId = joinButton.dataset.roomId;
            const roomName = joinButton.dataset.roomName;
            const isPrivate = joinButton.dataset.roomPrivate === 'true';
            
            console.log('🚀 Beitreten Raum:', { roomId, roomName, isPrivate });

            if (isPrivate) {
                const password = prompt('🔒 Bitte Raum-Passwort eingeben:');
                if (!password) {
                    showNotification('❌ Passwort erforderlich', 'error');
                    return;
                }
                
                joinRoom(roomId, roomName, password);
            } else {
                joinRoom(roomId, roomName);
            }
        }
    });
}

function joinRoom(roomId, roomName, password = null) {
    const user = auth.currentUser;
    
    showNotification('🚀 Beitrete Raum...', 'info');
    
    // Zuerst Raum-Daten prüfen
    db.ref(`rooms/${roomId}`).once('value')
        .then(roomSnapshot => {
            const room = roomSnapshot.val();
            
            if (!room) {
                throw new Error('Raum existiert nicht mehr');
            }
            
            if (password && room.passwordHash !== password) {
                throw new Error('Falsches Passwort');
            }
            
            // Mitglied hinzufügen
            return db.ref(`rooms/${roomId}/members/${user.uid}`).set({
                joinedAt: Date.now(),
                role: 'member'
            });
        })
        .then(() => {
            // Member Count erhöhen
            return db.ref(`rooms/${roomId}/memberCount`).transaction((current) => (current || 0) + 1);
        })
        .then(() => {
            // 🔴 CRITICAL FIX: localStorage SICHER setzen
            localStorage.setItem('roomId', roomId);
            localStorage.setItem('roomName', roomName);
            
            console.log('✅ Raum beigetreten, weiterleitung...', { 
                roomId, 
                roomName,
                storedRoomId: localStorage.getItem('roomId'),
                storedRoomName: localStorage.getItem('roomName')
            });
            
            showNotification('🚀 Raum beigetreten! Weiterleitung...', 'success');
            
            // Kurze Verzögerung für die Notification
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1500);
        })
        .catch(error => {
            console.error('❌ Fehler beim Raum-Beitritt:', error);
            showNotification('❌ ' + error.message, 'error');
        });
}

// Enhanced Statistics
function loadUserStats() {
    return new Promise((resolve) => {
        const user = auth.currentUser;
        if (!user) {
            resolve();
            return;
        }

        db.ref(`users/${user.uid}`).once('value')
            .then((userSnapshot) => {
                const userData = userSnapshot.val() || {};
                
                // UI aktualisieren
                document.getElementById('stat-messages').textContent = userData.messageCount || '0';
                document.getElementById('stat-rooms').textContent = userData.roomsCreated || '0';
                document.getElementById('mini-messages').textContent = userData.messageCount || '0';
                document.getElementById('mini-rooms').textContent = userData.roomsCreated || '0';
                
                resolve();
            })
            .catch(error => {
                console.error('Fehler beim Laden der Statistiken:', error);
                resolve();
            });
    });
}

// Global Stats
function loadGlobalStats() {
    db.ref('rooms').once('value')
        .then(roomsSnapshot => {
            const roomsData = roomsSnapshot.val() || {};
            const roomsCount = Object.keys(roomsData).length;
            
            const totalRooms = document.getElementById('total-rooms');
            const totalUsers = document.getElementById('total-users');
            
            if (totalRooms) totalRooms.textContent = roomsCount;
            if (totalUsers) {
                // Versuche User zu zählen
                db.ref('users').once('value')
                    .then(usersSnapshot => {
                        const usersData = usersSnapshot.val() || {};
                        const usersCount = Object.keys(usersData).length;
                        totalUsers.textContent = usersCount;
                    })
                    .catch(() => {
                        totalUsers.textContent = '?';
                    });
            }
        })
        .catch(error => {
            console.error('Fehler beim Laden der Global Stats:', error);
        });
}

// Utility Functions
function showSection(sectionName) {
    console.log('📱 Zeige Section:', sectionName);
    
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    const menuItem = document.querySelector(`.menu-item[onclick="showSection('${sectionName}')"]`);
    if (menuItem) {
        menuItem.classList.add('active');
    }
}

function showNotification(message, type = 'info') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Space Background
function initSpaceBackground() {
    const stars = document.querySelector('.stars');
    const planets = document.querySelector('.planets');
    const asteroids = document.querySelector('.asteroids');
    const comets = document.querySelector('.comets');
    
    if (!stars) return;
    
    // Create stars
    for (let i = 0; i < 120; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 5 + 's';
        stars.appendChild(star);
    }
    
    // Create planets
    const planetClasses = ['planet-1', 'planet-2', 'planet-3', 'planet-4'];
    planetClasses.forEach(planetClass => {
        const planet = document.createElement('div');
        planet.className = `planet ${planetClass}`;
        planets.appendChild(planet);
    });
    
    // Create asteroids
    for (let i = 0; i < 8; i++) {
        const asteroid = document.createElement('div');
        asteroid.className = 'asteroid';
        asteroid.style.top = Math.random() * 100 + '%';
        asteroid.style.animationDelay = Math.random() * 20 + 's';
        asteroids.appendChild(asteroid);
    }
    
    // Create comets
    for (let i = 0; i < 2; i++) {
        const comet = document.createElement('div');
        comet.className = 'comet';
        comet.style.top = Math.random() * 100 + '%';
        comet.style.animationDelay = Math.random() * 15 + 's';
        comets.appendChild(comet);
    }
}

// Event Listeners
function setupEventListeners() {
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // User Status auf offline setzen
            const user = auth.currentUser;
            if (user) {
                db.ref(`users/${user.uid}/status`).set('offline');
            }
            
            auth.signOut()
                .then(() => {
                    showNotification('👋 Bis bald!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                })
                .catch(error => {
                    console.error('Logout error:', error);
                });
        });
    }
    
    // Room Creation
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', createEnhancedRoom);
    }
    
    // Room Join Listeners
    setupRoomJoinListeners();
    
    // Profile Save
    setupProfileSaveListener();
    
    // Avatar Upload
    setupAvatarUpload();
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 Dashboard DOM geladen');
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('👤 User authentifiziert:', user.email);
            initDashboard();
        } else {
            console.log('👋 Kein User, weiterleitung zu index.html');
            window.location.href = 'index.html';
        }
    });
});

// Global Functions
window.showSection = showSection;
window.toggleTheme = toggleTheme;
window.removeAvatar = removeAvatar;
window.startPrivateChat = startPrivateChat;
window.refreshRooms = function() {
    showNotification('🔄 Räume aktualisieren!', 'success');
    loadRooms();
};
window.showRoomManagement = function(roomId) {
    showNotification('🔧 Raumverwaltung für: ' + roomId, 'info');
};