// ===== CHAT SYSTEM - VOLLSTÄNDIG ÜBERARBEITET =====

// Globale Variablen
let currentUser = null;
let currentUserProfile = null;
let currentRoom = null;
let messagesRef = null;
let onlineUsersRef = null;
let userProfiles = {};
let isLoadingMore = false;
let oldestMessageTimestamp = null;
let hasMoreMessages = true;

// ===== INITIALISIERUNG =====

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Chat wird gestartet...');
    
    try {
        await waitForFirebase();
        await initChat();
        initEventListeners();
        loadEmojiCategories();
        
        console.log('✅ Chat bereit');
    } catch (error) {
        console.error('❌ Startfehler:', error);
        showNotification('❌ Fehler beim Starten', 'error');
    }
});

async function waitForFirebase() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (window.firebase && window.auth && window.db) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });
}

async function initChat() {
    return new Promise((resolve) => {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                console.log('👤 Eingeloggt:', user.email);
                
                // Lade User-Profil mit Avatar
                await loadCurrentUserProfile();
                
                // Raum laden
                const roomId = localStorage.getItem('currentRoomId');
                const roomName = localStorage.getItem('currentRoomName');
                
                if (!roomId || !roomName) {
                    window.location.href = 'dashboard.html';
                    return;
                }
                
                currentRoom = { id: roomId, name: roomName };
                document.getElementById('room-name').textContent = roomName;
                
                // Theme setzen
                const theme = localStorage.getItem('theme') || 'dark';
                document.body.setAttribute('data-theme', theme);
                updateThemeIcon(theme);
                
                // Chat starten
                await startChat();
                
                resolve();
            } else {
                window.location.href = 'index.html';
            }
        });
    });
}

async function loadCurrentUserProfile() {
    try {
        // Lade Profil aus Firebase
        const userRef = window.db.ref('users/' + currentUser.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        // Avatar-Logik
        let avatar = null;
        
        // 1. Check localStorage
        const cachedAvatar = localStorage.getItem(`user_avatar_${currentUser.uid}`);
        if (cachedAvatar) {
            avatar = cachedAvatar;
        }
        // 2. Check Firebase
        else if (userData && userData.avatar) {
            avatar = userData.avatar;
            localStorage.setItem(`user_avatar_${currentUser.uid}`, avatar);
        }
        // 3. Generate default
        else {
            avatar = generateAvatar(currentUser.displayName || currentUser.email);
            // Speichere generierten Avatar
            await userRef.update({ avatar: avatar });
            localStorage.setItem(`user_avatar_${currentUser.uid}`, avatar);
        }
        
        currentUserProfile = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || (userData ? userData.displayName : currentUser.email.split('@')[0]),
            avatar: avatar,
            messageCount: userData ? userData.messageCount || 0 : 0,
            roomsCreated: userData ? userData.roomsCreated || 0 : 0
        };
        
        // Profil in userProfiles cache speichern
        userProfiles[currentUser.uid] = currentUserProfile;
        
        // Stelle sicher, dass das Profil in Firebase existiert
        await userRef.update({
            displayName: currentUserProfile.displayName,
            email: currentUser.email,
            lastSeen: Date.now(),
            isOnline: true
        });
        
    } catch (error) {
        console.error('Profil-Ladefehler:', error);
        currentUserProfile = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            avatar: generateAvatar(currentUser.email),
            messageCount: 0,
            roomsCreated: 0
        };
    }
}

async function startChat() {
    try {
        // Online-User System
        await setupOnlineUsers();
        
        // Nachrichten laden
        await loadMessages();
        
        // Realtime Listener
        setupMessageListener();
        
        // Fokus auf Input
        setTimeout(() => {
            const input = document.getElementById('message-input');
            if (input) input.focus();
        }, 500);
        
    } catch (error) {
        console.error('Chat-Start Fehler:', error);
    }
}

// ===== ONLINE USER SYSTEM =====

async function setupOnlineUsers() {
    if (!currentRoom || !currentUser) return;
    
    try {
        const onlinePath = `roomOnline/${currentRoom.id}`;
        onlineUsersRef = window.db.ref(onlinePath);
        
        // Setze User als online
        await onlineUsersRef.child(currentUser.uid).set({
            uid: currentUser.uid,
            name: currentUserProfile.displayName,
            avatar: currentUserProfile.avatar,
            isOnline: true,
            onlineAt: Date.now()
        });
        
        // Listener für Online-User
        onlineUsersRef.on('value', (snapshot) => {
            const users = snapshot.val() || {};
            updateOnlineUsers(users);
        });
        
        // Bei Disconnect entfernen
        onlineUsersRef.child(currentUser.uid).onDisconnect().remove();
        
    } catch (error) {
        console.error('Online-User Fehler:', error);
    }
}

function updateOnlineUsers(users) {
    const container = document.getElementById('online-users');
    const countElement = document.getElementById('online-count');
    const headerCount = document.getElementById('user-count');
    
    if (!container) return;
    
    const usersArray = Object.values(users).filter(user => user.isOnline);
    const onlineCount = usersArray.length;
    
    if (countElement) countElement.textContent = onlineCount;
    if (headerCount) headerCount.textContent = `👥 ${onlineCount} online`;
    
    if (usersArray.length === 0) {
        container.innerHTML = '<div class="no-users">Keine User online</div>';
        return;
    }
    
    let html = '';
    usersArray.forEach(user => {
        html += `
            <div class="online-user" onclick="showUserProfile('${user.uid}')">
                <span class="online-dot online"></span>
                <img src="${user.avatar}" 
                     alt="${user.name}" 
                     class="user-avatar-small"
                     onerror="this.src='${generateAvatar(user.name)}'">
                <span class="user-name">${escapeHtml(user.name)}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ===== NACHRICHTEN SYSTEM =====

async function loadMessages() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    try {
        container.innerHTML = '<div class="loading">📨 Lade Nachrichten...</div>';
        
        messagesRef = window.db.ref(`rooms/${currentRoom.id}/messages`);
        
        // Lade die letzten 30 Nachrichten
        const snapshot = await messagesRef
            .orderByChild('timestamp')
            .limitToLast(30)
            .once('value');
        
        const messages = snapshot.val();
        
        if (!messages || Object.keys(messages).length === 0) {
            container.innerHTML = `
                <div class="no-messages">
                    <h3>📭 Noch keine Nachrichten</h3>
                    <p>Sei der Erste, der etwas schreibt!</p>
                </div>
            `;
            return;
        }
        
        // Nachrichten sortieren
        const messagesArray = Object.entries(messages).map(([id, msg]) => ({
            id,
            ...msg
        }));
        
        messagesArray.sort((a, b) => a.timestamp - b.timestamp);
        
        // Speichere älteste Nachricht für Pagination
        if (messagesArray.length > 0) {
            oldestMessageTimestamp = messagesArray[0].timestamp;
        }
        
        // Prüfe ob es mehr Nachrichten gibt
        hasMoreMessages = messagesArray.length >= 30;
        
        // Lade User-Profile für alle Nachrichten
        await loadUserProfilesForMessages(messagesArray);
        
        // Zeige Nachrichten an
        displayMessages(messagesArray);
        
        // Füge "Mehr laden" Button hinzu wenn nötig
        if (hasMoreMessages) {
            addLoadMoreButton();
        }
        
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        container.innerHTML = `
            <div class="error">
                <h3>❌ Fehler</h3>
                <p>Nachrichten konnten nicht geladen werden</p>
                <button onclick="loadMessages()">Erneut versuchen</button>
            </div>
        `;
    }
}

async function loadUserProfilesForMessages(messages) {
    const uniqueUserIds = [...new Set(messages.map(msg => msg.userId).filter(id => id))];
    
    for (const userId of uniqueUserIds) {
        if (!userProfiles[userId]) {
            await loadUserProfileFromFirebase(userId);
        }
    }
}

async function loadUserProfileFromFirebase(userId) {
    try {
        // Check localStorage first
        const cachedAvatar = localStorage.getItem(`user_avatar_${userId}`);
        const cachedName = localStorage.getItem(`user_name_${userId}`);
        
        if (cachedAvatar && cachedName) {
            userProfiles[userId] = {
                displayName: cachedName,
                avatar: cachedAvatar
            };
            return;
        }
        
        // Load from Firebase
        const userRef = window.db.ref('users/' + userId);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData) {
            const avatar = userData.avatar || generateAvatar(userData.displayName || 'User');
            const displayName = userData.displayName || 'Unbekannter User';
            
            // Cache in localStorage
            localStorage.setItem(`user_avatar_${userId}`, avatar);
            localStorage.setItem(`user_name_${userId}`, displayName);
            
            userProfiles[userId] = {
                displayName: displayName,
                avatar: avatar,
                email: userData.email || 'unbekannt@example.com',
                messageCount: userData.messageCount || 0,
                roomsCreated: userData.roomsCreated || 0
            };
        } else {
            // Fallback für unbekannte User
            const avatar = generateAvatar('UU');
            userProfiles[userId] = {
                displayName: 'Unbekannter User',
                avatar: avatar,
                email: 'unbekannt@example.com'
            };
        }
    } catch (error) {
        console.error('Profil-Ladefehler:', error);
        userProfiles[userId] = {
            displayName: 'Unbekannt',
            avatar: generateAvatar('U'),
            email: 'error@example.com'
        };
    }
}

function displayMessages(messagesArray) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    let html = '';
    let lastTimeSeparator = null;
    let lastUserId = null;
    
    messagesArray.forEach(msg => {
        const userProfile = userProfiles[msg.userId] || {
            displayName: msg.userName || 'Unbekannt',
            avatar: msg.avatar || generateAvatar('U')
        };
        
        const isOwn = msg.userId === currentUser?.uid;
        const showAvatar = lastUserId !== msg.userId;
        
        // Zeit-Separator hinzufügen
        const messageDate = new Date(msg.timestamp);
        const timeSeparator = messageDate.toLocaleDateString();
        
        if (timeSeparator !== lastTimeSeparator) {
            html += `<div class="time-separator"><span>${timeSeparator}</span></div>`;
            lastTimeSeparator = timeSeparator;
        }
        
        html += createMessageHTML(msg, userProfile, isOwn, showAvatar);
        lastUserId = msg.userId;
    });
    
    container.innerHTML = html;
    
    // Scroll nach unten
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

function createMessageHTML(message, userProfile, isOwn, showAvatar) {
    const time = formatTime(message.timestamp);
    
    // Avatar HTML
    const avatarHTML = showAvatar ? 
        `<img src="${userProfile.avatar}" 
              alt="${userProfile.displayName}" 
              class="message-avatar"
              onerror="this.src='${generateAvatar(userProfile.displayName)}'"
              onclick="showUserProfile('${message.userId}')">` :
        '<div class="avatar-spacer"></div>';
    
    // Nachrichteninhalt basierend auf Typ
    let contentHTML = '';
    if (message.type === 'image' && message.imageUrl) {
        contentHTML = `
            <div class="message-image">
                <img src="${message.imageUrl}" alt="Bild" 
                     class="chat-image"
                     onclick="openImageLightbox('${message.imageUrl}')">
                ${message.text && message.text !== message.fileName ? 
                    `<div class="image-caption">${escapeHtml(message.text)}</div>` : ''}
            </div>
        `;
    } else if (message.type === 'video' && message.videoUrl) {
        contentHTML = `
            <div class="message-video">
                <video controls src="${message.videoUrl}" 
                       class="chat-video"></video>
                ${message.text && message.text !== message.fileName ? 
                    `<div class="image-caption">${escapeHtml(message.text)}</div>` : ''}
            </div>
        `;
    } else if (message.type === 'file' && message.fileUrl) {
        contentHTML = `
            <div class="message-file">
                <div class="file-icon">📎</div>
                <div class="file-info">
                    <span class="file-name">${escapeHtml(message.fileName || 'Datei')}</span>
                    <span class="file-size">${formatFileSize(message.fileSize)}</span>
                    ${message.text ? `<div class="file-caption">${escapeHtml(message.text)}</div>` : ''}
                </div>
                <a href="${message.fileUrl}" download="${message.fileName}" class="file-download-btn">
                    📥 Download
                </a>
            </div>
        `;
    } else if (message.type === 'game') {
        contentHTML = `<div class="game-message">${escapeHtml(message.text)}</div>`;
    } else {
        contentHTML = `<div class="message-text">${escapeHtml(message.text)}</div>`;
    }
    
    return `
        <div class="message ${isOwn ? 'own' : 'other'}" data-message-id="${message.id}">
            ${avatarHTML}
            <div class="message-content">
                ${showAvatar ? `
                    <div class="message-header">
                        <span class="message-sender" onclick="showUserProfile('${message.userId}')">
                            ${escapeHtml(userProfile.displayName)}
                            ${isOwn ? ' (Du)' : ''}
                        </span>
                        <span class="message-time">${time}</span>
                    </div>
                ` : `
                    <div class="message-header compact">
                        <span class="message-time">${time}</span>
                    </div>
                `}
                
                ${contentHTML}
                
                <div class="message-actions">
                    <button class="action-btn" onclick="showReactionMenu('${message.id}', event)">
                        ❤️
                    </button>
                    ${isOwn ? `
                        <button class="action-btn delete" onclick="deleteMessage('${message.id}')">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function setupMessageListener() {
    if (!messagesRef) return;
    
    messagesRef
        .orderByChild('timestamp')
        .startAt(Date.now())
        .on('child_added', async (snapshot) => {
            const message = snapshot.val();
            const messageId = snapshot.key;
            
            // Überspringe wenn bereits angezeigt
            if (document.querySelector(`[data-message-id="${messageId}"]`)) return;
            
            // Lade User-Profil wenn nötig
            if (!userProfiles[message.userId]) {
                await loadUserProfileFromFirebase(message.userId);
            }
            
            appendMessage(messageId, message);
        });
}

function appendMessage(messageId, messageData) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    // Entferne "Keine Nachrichten" falls vorhanden
    const noMessages = container.querySelector('.no-messages');
    if (noMessages) container.innerHTML = '';
    
    const userProfile = userProfiles[messageData.userId] || {
        displayName: messageData.userName || 'Unbekannt',
        avatar: messageData.avatar || generateAvatar('U')
    };
    
    // Prüfe ob der vorherige Nachrichten-Sender gleich ist
    const lastMessage = container.lastChild;
    const showAvatar = !lastMessage || 
        !lastMessage.classList || 
        !lastMessage.classList.contains('other') || 
        lastMessage.querySelector('.message-sender')?.textContent !== userProfile.displayName;
    
    const isOwn = messageData.userId === currentUser?.uid;
    const messageHTML = createMessageHTML(
        { id: messageId, ...messageData },
        userProfile,
        isOwn,
        showAvatar
    );
    
    container.innerHTML += messageHTML;
    
    // Scroll nach unten
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// ===== NACHICHTEN SENDEN =====

async function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (!text) {
        showNotification('❌ Nachricht darf nicht leer sein', 'error');
        return;
    }
    
    try {
        const messageId = Date.now().toString();
        const messageData = {
            text: text,
            userId: currentUser.uid,
            userName: currentUserProfile.displayName,
            avatar: currentUserProfile.avatar,
            timestamp: Date.now(),
            type: 'text'
        };
        
        const messagePath = `rooms/${currentRoom.id}/messages/${messageId}`;
        await window.db.ref(messagePath).set(messageData);
        
        // Nachrichtenzähler erhöhen
        await incrementMessageCount();
        
        showNotification('✅ Nachricht gesendet', 'success');
        input.value = '';
        input.focus();
        
    } catch (error) {
        console.error('Sende-Fehler:', error);
        showNotification('❌ Fehler beim Senden', 'error');
    }
}

async function incrementMessageCount() {
    try {
        const userRef = window.db.ref('users/' + currentUser.uid + '/messageCount');
        const snapshot = await userRef.once('value');
        const currentCount = snapshot.val() || 0;
        await userRef.set(currentCount + 1);
        
        // Update lokal
        if (currentUserProfile) {
            currentUserProfile.messageCount = currentCount + 1;
        }
    } catch (error) {
        console.error('Fehler beim Erhöhen des Nachrichtenzählers:', error);
    }
}

// ===== DATEI/BILD UPLOAD =====

function showImageUpload() {
    document.getElementById('image-modal').classList.remove('hidden');
    document.getElementById('file-input').value = '';
    document.getElementById('upload-preview').innerHTML = '';
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('file-caption').value = '';
}

function closeImageModal() {
    document.getElementById('image-modal').classList.add('hidden');
    document.getElementById('file-input').value = '';
    document.getElementById('upload-preview').innerHTML = '';
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('file-caption').value = '';
}

function previewFile() {
    const input = document.getElementById('file-input');
    const preview = document.getElementById('upload-preview');
    
    if (!input.files.length) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        let previewHTML = '';
        
        if (file.type.startsWith('image/')) {
            previewHTML = `<img src="${e.target.result}" alt="Vorschau" class="upload-preview-img">`;
        } else if (file.type.startsWith('video/')) {
            previewHTML = `<video controls src="${e.target.result}" class="upload-preview-video"></video>`;
        } else if (file.type.startsWith('audio/')) {
            previewHTML = `<audio controls src="${e.target.result}" class="upload-preview-audio"></audio>`;
        } else {
            previewHTML = `
                <div class="file-preview">
                    <div class="file-icon-large">📎</div>
                    <div>${escapeHtml(file.name)}</div>
                </div>
            `;
        }
        
        previewHTML += `
            <div class="file-info">
                <span class="file-name">${escapeHtml(file.name)}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
        `;
        
        preview.innerHTML = previewHTML;
        preview.classList.remove('hidden');
    };
    
    reader.readAsDataURL(file);
}

async function uploadFile() {
    const input = document.getElementById('file-input');
    const caption = document.getElementById('file-caption').value.trim();
    
    if (!input.files.length) {
        showNotification('❌ Bitte wähle eine Datei aus', 'error');
        return;
    }
    
    const file = input.files[0];
    
    try {
        const messageId = Date.now().toString();
        
        // Base64 konvertieren
        const base64 = await fileToBase64(file);
        
        // Dateityp bestimmen
        let type = 'file';
        let fileData = {
            fileName: file.name,
            fileSize: file.size
        };
        
        if (file.type.startsWith('image/')) {
            type = 'image';
            fileData.imageUrl = base64;
        } else if (file.type.startsWith('video/')) {
            type = 'video';
            fileData.videoUrl = base64;
        } else if (file.type.startsWith('audio/')) {
            type = 'audio';
            fileData.audioUrl = base64;
        } else {
            fileData.fileUrl = base64;
        }
        
        const messageData = {
            text: caption || (type === 'image' ? '📷 Bild' : file.name),
            userId: currentUser.uid,
            userName: currentUserProfile.displayName,
            avatar: currentUserProfile.avatar,
            timestamp: Date.now(),
            type: type,
            ...fileData
        };
        
        const messagePath = `rooms/${currentRoom.id}/messages/${messageId}`;
        await window.db.ref(messagePath).set(messageData);
        
        // Nachrichtenzähler erhöhen
        await incrementMessageCount();
        
        showNotification('✅ Datei gesendet', 'success');
        closeImageModal();
        
    } catch (error) {
        console.error('Upload-Fehler:', error);
        showNotification('❌ Fehler beim Senden', 'error');
    }
}

// ===== ÄLTERE NACHRICHTEN LADEN =====

function addLoadMoreButton() {
    const container = document.getElementById('messages');
    if (!container) return;
    
    // Entferne existierenden Button
    const oldButton = container.querySelector('.load-more-btn');
    if (oldButton) oldButton.remove();
    
    const button = document.createElement('button');
    button.className = 'load-more-btn';
    button.innerHTML = '<span class="spinner-btn"></span> 📜 Ältere Nachrichten laden';
    button.onclick = loadOlderMessages;
    
    container.insertBefore(button, container.firstChild);
}

async function loadOlderMessages() {
    if (isLoadingMore || !oldestMessageTimestamp || !hasMoreMessages) return;
    
    isLoadingMore = true;
    const container = document.getElementById('messages');
    const loadBtn = container.querySelector('.load-more-btn');
    
    try {
        if (loadBtn) {
            loadBtn.innerHTML = '<span class="spinner-btn active"></span> Lade ältere Nachrichten...';
            loadBtn.disabled = true;
        }
        
        const snapshot = await messagesRef
            .orderByChild('timestamp')
            .endAt(oldestMessageTimestamp - 1)
            .limitToLast(20)
            .once('value');
        
        const messages = snapshot.val();
        
        if (!messages || Object.keys(messages).length === 0) {
            hasMoreMessages = false;
            if (loadBtn) {
                loadBtn.innerHTML = '📜 Keine älteren Nachrichten';
                setTimeout(() => loadBtn.remove(), 2000);
            }
            return;
        }
        
        const messagesArray = Object.entries(messages).map(([id, msg]) => ({
            id,
            ...msg
        }));
        
        messagesArray.sort((a, b) => a.timestamp - b.timestamp);
        
        // Update oldestMessageTimestamp
        if (messagesArray.length > 0) {
            oldestMessageTimestamp = messagesArray[0].timestamp;
        }
        
        // Check if there are more messages
        hasMoreMessages = messagesArray.length >= 20;
        
        // Load user profiles
        await loadUserProfilesForMessages(messagesArray);
        
        // Prepend messages at the top
        prependMessages(messagesArray, container);
        
        // Update or remove button
        if (!hasMoreMessages) {
            if (loadBtn) {
                loadBtn.innerHTML = '📜 Alle Nachrichten geladen';
                setTimeout(() => loadBtn.remove(), 2000);
            }
        } else if (loadBtn) {
            loadBtn.innerHTML = '<span class="spinner-btn"></span> 📜 Ältere Nachrichten laden';
            loadBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('Fehler beim Laden älterer Nachrichten:', error);
        showNotification('❌ Fehler beim Laden', 'error');
        
        if (loadBtn) {
            loadBtn.innerHTML = '<span class="spinner-btn"></span> 📜 Ältere Nachrichten laden';
            loadBtn.disabled = false;
        }
    } finally {
        isLoadingMore = false;
    }
}

function prependMessages(messagesArray, container) {
    let html = '';
    let lastTimeSeparator = null;
    let lastUserId = null;
    
    // Durch Nachrichten von alt zu neu gehen
    for (let i = messagesArray.length - 1; i >= 0; i--) {
        const msg = messagesArray[i];
        const userProfile = userProfiles[msg.userId] || {
            displayName: msg.userName || 'Unbekannt',
            avatar: msg.avatar || generateAvatar('U')
        };
        
        const isOwn = msg.userId === currentUser?.uid;
        const showAvatar = lastUserId !== msg.userId;
        lastUserId = msg.userId;
        
        // Zeit-Separator
        const messageDate = new Date(msg.timestamp);
        const timeSeparator = messageDate.toLocaleDateString();
        
        if (timeSeparator !== lastTimeSeparator) {
            html = `<div class="time-separator"><span>${timeSeparator}</span></div>` + html;
            lastTimeSeparator = timeSeparator;
        }
        
        const messageHTML = createMessageHTML(msg, userProfile, isOwn, showAvatar);
        html = messageHTML + html;
    }
    
    // Aktuelle Scroll-Position speichern
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;
    
    // Temporäres Div erstellen und Nachrichten einfügen
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const firstChild = container.firstChild;
    while (tempDiv.firstChild) {
        container.insertBefore(tempDiv.firstChild, firstChild);
    }
    
    // Scroll-Position anpassen
    const newScrollHeight = container.scrollHeight;
    container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
}

// ===== PROFIL FUNKTIONEN =====

async function showUserProfile(userId) {
    try {
        // Lade Profil
        const userProfile = await loadUserProfileWithDetails(userId);
        
        // Setze Profildaten
        document.getElementById('profile-name').textContent = userProfile.displayName;
        document.getElementById('profile-email').textContent = userProfile.email || 'Keine Email';
        
        // Avatar setzen mit Fallback
        const avatarImg = document.getElementById('profile-avatar');
        avatarImg.src = userProfile.avatar;
        avatarImg.onerror = () => {
            avatarImg.src = generateAvatar(userProfile.displayName);
        };
        
        // Online-Status prüfen
        const isOnline = await checkIfUserIsOnline(userId);
        const statusDot = document.getElementById('profile-status-dot');
        const statusText = document.getElementById('profile-status-text');
        
        if (statusDot) {
            statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        }
        if (statusText) {
            statusText.textContent = isOnline ? '🟢 Online' : '⚫ Offline';
        }
        
        // Statistiken
        document.getElementById('stat-msg-count').textContent = userProfile.messageCount || 0;
        document.getElementById('stat-room-count').textContent = userProfile.roomsCreated || 0;
        
        // Profil anzeigen
        document.getElementById('profile-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Profil-Fehler:', error);
        showNotification('❌ Profil konnte nicht geladen werden', 'error');
    }
}

async function loadUserProfileWithDetails(userId) {
    // Check cache first
    if (userProfiles[userId]) {
        return userProfiles[userId];
    }
    
    // Load from Firebase
    try {
        const userRef = window.db.ref('users/' + userId);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData) {
            const profile = {
                displayName: userData.displayName || 'Unbekannt',
                avatar: userData.avatar || generateAvatar(userData.displayName || 'User'),
                email: userData.email || 'Keine Email',
                messageCount: userData.messageCount || 0,
                roomsCreated: userData.roomsCreated || 0,
                lastSeen: userData.lastSeen || null
            };
            
            // Cache speichern
            userProfiles[userId] = profile;
            return profile;
        }
    } catch (error) {
        console.error('Fehler beim Laden des Profils:', error);
    }
    
    // Fallback
    return {
        displayName: 'Unbekannt',
        avatar: generateAvatar('U'),
        email: 'unbekannt@example.com',
        messageCount: 0,
        roomsCreated: 0
    };
}

async function checkIfUserIsOnline(userId) {
    if (!currentRoom) return false;
    
    try {
        const onlineRef = window.db.ref(`roomOnline/${currentRoom.id}/${userId}`);
        const snapshot = await onlineRef.once('value');
        return snapshot.exists();
    } catch (error) {
        return false;
    }
}

function closeProfile() {
    document.getElementById('profile-modal').classList.add('hidden');
}

// ===== BILD LIGHTBOX =====

function openImageLightbox(imageUrl) {
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    
    if (!lightbox || !lightboxImage) {
        // Lightbox existiert nicht, erstelle sie
        createImageLightbox();
        // Warte kurz und öffne dann
        setTimeout(() => openImageLightbox(imageUrl), 100);
        return;
    }
    
    lightboxImage.src = imageUrl;
    lightbox.classList.remove('hidden');
}

function closeImageLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (lightbox) {
        lightbox.classList.add('hidden');
    }
}

function createImageLightbox() {
    const lightboxHTML = `
        <div id="image-lightbox" class="modal hidden">
            <div class="modal-content lightbox-content">
                <button class="close-btn" onclick="closeImageLightbox()">×</button>
                <img id="lightbox-image" src="" alt="Vergrößertes Bild" class="lightbox-image">
                <div class="lightbox-controls">
                    <button class="lightbox-btn" onclick="zoomInImage()">🔍+</button>
                    <button class="lightbox-btn" onclick="zoomOutImage()">🔍-</button>
                    <button class="lightbox-btn" onclick="downloadImage()">📥</button>
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = lightboxHTML;
    document.body.appendChild(div);
}

function zoomInImage() {
    const img = document.getElementById('lightbox-image');
    if (img) {
        const currentWidth = img.offsetWidth;
        img.style.width = (currentWidth * 1.2) + 'px';
    }
}

function zoomOutImage() {
    const img = document.getElementById('lightbox-image');
    if (img) {
        const currentWidth = img.offsetWidth;
        img.style.width = (currentWidth * 0.8) + 'px';
    }
}

function downloadImage() {
    const img = document.getElementById('lightbox-image');
    if (img && img.src) {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'chat-bild-' + Date.now() + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ===== EMOJI SYSTEM =====

const emojiCategories = {
    smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠'],
    people: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👣','👂','🦻','👃','🧠','🦷','🦴','👀','👁','👅','👄','💋','🩸'],
    nature: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔','🐾','🐉','🐲']
};

function loadEmojiCategories() {
    changeEmojiCategory('smileys');
}

function changeEmojiCategory(category) {
    const emojiGrid = document.getElementById('emoji-grid');
    if (!emojiGrid) return;
    
    // Aktiviere Button
    document.querySelectorAll('.emoji-cat-btn').forEach(btn => btn.classList.remove('active'));
    
    const buttons = document.querySelectorAll('.emoji-cat-btn');
    buttons.forEach(btn => {
        if (btn.textContent === getEmojiForCategory(category)) {
            btn.classList.add('active');
        }
    });
    
    // Lade Emojis
    const emojis = emojiCategories[category] || emojiCategories.smileys;
    emojiGrid.innerHTML = '';
    
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.onclick = () => insertEmoji(emoji);
        emojiGrid.appendChild(btn);
    });
}

function getEmojiForCategory(category) {
    const categoryEmojis = {
        'smileys': '😊',
        'people': '👋',
        'nature': '🐱',
        'objects': '⌚',
        'symbols': '❤️'
    };
    return categoryEmojis[category] || '😊';
}

function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    input.value += emoji;
    input.focus();
}

// ===== SPIELE =====

function toggleGamesMenu() {
    const menu = document.getElementById('games-menu');
    menu.classList.toggle('hidden');
}

function playGame(type) {
    let result = '';
    
    if (type === 'dice') {
        result = `🎲 Würfel: ${Math.floor(Math.random() * 6) + 1}`;
    } else if (type === 'coin') {
        result = `🪙 Münzwurf: ${Math.random() > 0.5 ? 'Kopf' : 'Zahl'}`;
    }
    
    sendGameMessage(result);
    toggleGamesMenu();
}

function playRPS() {
    const menu = document.getElementById('rps-menu');
    menu.classList.toggle('hidden');
}

function playRPSChoice(choice) {
    const choices = ['✊', '✋', '✌️'];
    const botChoice = choices[Math.floor(Math.random() * 3)];
    
    let result = '';
    if (choice === botChoice) {
        result = `Unentschieden! ${choice} vs ${botChoice}`;
    } else if (
        (choice === '✊' && botChoice === '✌️') ||
        (choice === '✋' && botChoice === '✊') ||
        (choice === '✌️' && botChoice === '✋')
    ) {
        result = `Du gewinnst! ${choice} vs ${botChoice}`;
    } else {
        result = `Bot gewinnt! ${choice} vs ${botChoice}`;
    }
    
    sendGameMessage(`🎮 ${result}`);
    document.getElementById('rps-menu').classList.add('hidden');
}

async function sendGameMessage(text) {
    try {
        const messageId = Date.now().toString();
        const messageData = {
            text: text,
            userId: currentUser.uid,
            userName: currentUserProfile.displayName,
            avatar: currentUserProfile.avatar,
            timestamp: Date.now(),
            type: 'game'
        };
        
        const messagePath = `rooms/${currentRoom.id}/messages/${messageId}`;
        await window.db.ref(messagePath).set(messageData);
        
        await incrementMessageCount();
        
    } catch (error) {
        console.error('Spiel-Fehler:', error);
    }
}

// ===== HILFSFUNKTIONEN =====

function formatTime(timestamp) {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Container erstellen falls nicht existiert
    let container = document.getElementById('notifications');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifications';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-text">${message}</div>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 3000);
}

// ===== DASHBOARD.JS - RAUMVERWALTUNG KORRIGIERT =====

// Füge diese Funktionen zu dashboard.js hinzu:

// Raumverwaltung speichern
async function saveRoomSettings(roomId) {
    try {
        console.log('🔧 START saveRoomSettings für Raum:', roomId);
        
        // Alle Inputs holen
        const name = document.getElementById('manage-room-name')?.value.trim();
        const description = document.getElementById('manage-room-desc')?.value.trim();
        const password = document.getElementById('manage-room-password')?.value;
        const maxMembersEl = document.getElementById('manage-room-maxmembers');
        const allowImagesEl = document.getElementById('manage-room-allowimages');
        const allowFilesEl = document.getElementById('manage-room-allowfiles');
        const slowModeEl = document.getElementById('manage-room-slowmode');
        
        // Debug: Alle Elemente prüfen
        console.log('📋 Gefundene Elemente:', {
            nameInput: !!document.getElementById('manage-room-name'),
            descriptionInput: !!document.getElementById('manage-room-desc'),
            maxMembersInput: !!maxMembersEl,
            allowImagesCheckbox: !!allowImagesEl,
            allowFilesCheckbox: !!allowFilesEl,
            slowModeCheckbox: !!slowModeEl
        });
        
        // Validierung
        if (!name) {
            showNotification('❌ Raumname darf nicht leer sein', 'error');
            return;
        }
        
        const maxMembers = maxMembersEl ? parseInt(maxMembersEl.value) || 100 : 100;
        const allowImages = allowImagesEl ? allowImagesEl.checked : true;
        const allowFiles = allowFilesEl ? allowFilesEl.checked : true;
        const slowMode = slowModeEl ? slowModeEl.checked : false;
        
        if (maxMembers < 2 || maxMembers > 500) {
            showNotification('❌ Maximale Mitglieder muss zwischen 2 und 500 liegen', 'error');
            return;
        }
        
        console.log('📝 Eingabewerte:', {
            name,
            description,
            maxMembers,
            allowImages,
            allowFiles,
            slowMode,
            hasPassword: !!password
        });
        
        // Richtig: Komplettes Objekt verwenden - KEINE PUNKTE in Keys!
        const updates = {
            name: name,
            description: description,
            lastUpdated: Date.now()
        };
        
        // Richtig: settings als komplettes verschachteltes Objekt
        updates['settings'] = {
            maxMembers: maxMembers,
            allowImages: allowImages,
            allowFiles: allowFiles,
            slowMode: slowMode
        };
        
        // Passwort Logik
        if (password) {
            updates.passwordHash = password;
            updates.isPrivate = true;
        }
        
        console.log('📤 Firebase Update-Objekt:', JSON.stringify(updates, null, 2));
        
        // Update senden
        await window.db.ref(`rooms/${roomId}`).update(updates);
        
        console.log('✅ Update erfolgreich gesendet');
        showNotification('✅ Raum-Einstellungen gespeichert!', 'success');
        
        // Modal schließen
        closeModal();
        
        // Räume neu laden
        setTimeout(() => {
            loadRooms();
        }, 1000);
        
    } catch (error) {
        console.error('❌ KRITISCHER Fehler in saveRoomSettings:', error);
        console.error('❌ Fehlermeldung:', error.message);
        console.error('❌ Fehler-Stack:', error.stack);
        showNotification(`❌ Fehler: ${error.message}`, 'error');
    }
}

// Raumverwaltung schließen
function closeRoomManagement() {
    const modal = document.getElementById('room-management-modal');
    if (modal) {
        modal.remove();
    }
}

// Raum löschen
async function deleteRoom(roomId) {
    if (!confirm('⚠️ Bist du sicher, dass du diesen Raum löschen möchtest?\n\nAlle Nachrichten und Mitglieder werden entfernt!\nDiese Aktion kann nicht rückgängig gemacht werden.')) {
        return;
    }
    
    try {
        // Lösche den Raum
        await window.db.ref('rooms/' + roomId).remove();
        
        // Lösche alle Nachrichten des Raums
        await window.db.ref('rooms/' + roomId + '/messages').remove();
        
        showNotification('✅ Raum erfolgreich gelöscht', 'success');
        closeRoomManagement();
        loadRooms();
        
    } catch (error) {
        console.error('Fehler beim Löschen des Raums:', error);
        showNotification('❌ Fehler beim Löschen: ' + error.message, 'error');
    }
}

// Raum-Besitz übertragen
async function transferRoomOwnership(roomId) {
    const newOwnerId = prompt('Bitte die User-ID des neuen Besitzers eingeben:');
    
    if (!newOwnerId) {
        return;
    }
    
    try {
        // Prüfe ob der User existiert
        const userSnapshot = await window.db.ref('users/' + newOwnerId).once('value');
        const userData = userSnapshot.val();
        
        if (!userData) {
            showNotification('❌ User nicht gefunden', 'error');
            return;
        }
        
        // Update Raum-Besitzer
        await window.db.ref('rooms/' + roomId).update({
            ownerId: newOwnerId,
            ownerName: userData.displayName || 'Unbekannt',
            lastUpdated: Date.now()
        });
        
        // Update Mitglieder-Rolle
        await window.db.ref('rooms/' + roomId + '/members/' + newOwnerId).update({
            role: 'owner'
        });
        
        // Alten Besitzer auf Mitglied setzen
        await window.db.ref('rooms/' + roomId + '/members/' + currentUser.uid).update({
            role: 'member'
        });
        
        showNotification(`✅ Raum-Besitz an ${userData.displayName} übertragen`, 'success');
        closeRoomManagement();
        
    } catch (error) {
        console.error('Fehler beim Übertragen des Besitzes:', error);
        showNotification('❌ Fehler beim Übertragen: ' + error.message, 'error');
    }
}

// Mitglied entfernen
async function kickMember(roomId, userId) {
    if (!confirm('Mitglied wirklich aus dem Raum entfernen?')) {
        return;
    }
    
    try {
        // Entferne Mitglied
        await window.db.ref('rooms/' + roomId + '/members/' + userId).remove();
        
        // Verringere Mitgliederzähler
        const memberCountRef = window.db.ref('rooms/' + roomId + '/memberCount');
        const snapshot = await memberCountRef.once('value');
        const currentCount = snapshot.val() || 1;
        await memberCountRef.set(Math.max(0, currentCount - 1));
        
        showNotification('✅ Mitglied entfernt', 'success');
        refreshRoomMembers(roomId);
        
    } catch (error) {
        console.error('Fehler beim Entfernen des Mitglieds:', error);
        showNotification('❌ Fehler beim Entfernen', 'error');
    }
}

// Raum verlassen
async function leaveRoom(roomId) {
    if (!confirm('Möchtest du diesen Raum wirklich verlassen?')) {
        return;
    }
    
    try {
        // Prüfe ob du der Besitzer bist
        const roomSnapshot = await window.db.ref('rooms/' + roomId).once('value');
        const roomData = roomSnapshot.val();
        
        if (roomData.ownerId === currentUser.uid) {
            showNotification('❌ Als Besitzer kannst du den Raum nicht verlassen. Übertrage zuerst den Besitz.', 'error');
            return;
        }
        
        // Entferne dich als Mitglied
        await window.db.ref('rooms/' + roomId + '/members/' + currentUser.uid).remove();
        
        // Verringere Mitgliederzähler
        const memberCountRef = window.db.ref('rooms/' + roomId + '/memberCount');
        const snapshot = await memberCountRef.once('value');
        const currentCount = snapshot.val() || 1;
        await memberCountRef.set(Math.max(0, currentCount - 1));
        
        showNotification('✅ Du hast den Raum verlassen', 'success');
        closeRoomManagement();
        loadRooms();
        
    } catch (error) {
        console.error('Fehler beim Verlassen des Raums:', error);
        showNotification('❌ Fehler beim Verlassen', 'error');
    }
}

// Raum-Mitglieder aktualisieren
async function refreshRoomMembers(roomId) {
    await loadRoomMembers(roomId);
    showNotification('👥 Mitglieder aktualisiert', 'info');
}

// ===== USER PROFIL FUNKTIONEN =====

// User-Profil anzeigen (für Klick auf Profil in Suche)
async function viewUserProfile(userId) {
    try {
        // Lade Profil
        const userRef = window.db.ref('users/' + userId);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (!userData) {
            showNotification('❌ User nicht gefunden', 'error');
            return;
        }
        
        // Modal HTML erstellen
        const modalHTML = `
            <div class="modal" id="user-profile-modal">
                <div class="modal-content" style="max-width: 500px;">
                    <button class="close-btn" onclick="closeUserProfileModal()">×</button>
                    
                    <div class="profile-header" style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
                        <img src="${userData.avatar || generateAvatar(userData.displayName)}" 
                             alt="Avatar" 
                             style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--primary);"
                             onerror="this.src='${generateAvatar(userData.displayName)}'">
                        
                        <div>
                            <h2 style="margin: 0 0 5px 0; color: var(--text);">${escapeHtml(userData.displayName || 'Unbekannt')}</h2>
                            <p style="margin: 0; color: var(--text-muted);">${escapeHtml(userData.email || 'Keine Email')}</p>
                            
                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px;">
                                <span class="status-dot ${userData.status === 'online' ? 'online' : 'offline'}"></span>
                                <span style="color: var(--text-muted); font-size: 0.9rem;">
                                    ${userData.status === 'online' ? '🟢 Online' : '⚫ Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
                        <div style="background: var(--bg-input); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 1.8rem; font-weight: bold; color: var(--primary);">
                                ${userData.messageCount || 0}
                            </div>
                            <div style="color: var(--text-muted); font-size: 0.9rem;">Nachrichten</div>
                        </div>
                        
                        <div style="background: var(--bg-input); padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="font-size: 1.8rem; font-weight: bold; color: var(--primary);">
                                ${userData.roomsCreated || 0}
                            </div>
                            <div style="color: var(--text-muted); font-size: 0.9rem;">Räume</div>
                        </div>
                    </div>
                    
                    <div style="background: var(--bg-input); padding: 15px; border-radius: 10px; margin: 20px 0;">
                        <h4 style="margin-top: 0; color: var(--text);">📋 Account Details</h4>
                        
                        <div style="display: grid; gap: 10px;">
                            <div>
                                <span style="font-weight: 600; color: var(--text-muted);">User ID:</span>
                                <div style="font-family: monospace; font-size: 0.8rem; color: var(--text); background: rgba(0,0,0,0.1); padding: 5px; border-radius: 5px; overflow: hidden; text-overflow: ellipsis;">
                                    ${userId}
                                </div>
                            </div>
                            
                            <div>
                                <span style="font-weight: 600; color: var(--text-muted);">Rolle:</span>
                                <span style="color: var(--text); margin-left: 10px;">
                                    ${userData.role === 'admin' ? '👑 Admin' : '👤 User'}
                                </span>
                            </div>
                            
                            ${userData.createdAt ? `
                                <div>
                                    <span style="font-weight: 600; color: var(--text-muted);">Registriert:</span>
                                    <span style="color: var(--text); margin-left: 10px;">
                                        ${new Date(userData.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ` : ''}
                            
                            ${userData.lastLogin ? `
                                <div>
                                    <span style="font-weight: 600; color: var(--text-muted);">Letzter Login:</span>
                                    <span style="color: var(--text); margin-left: 10px;">
                                        ${new Date(userData.lastLogin).toLocaleString()}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button onclick="startPrivateChat('${userId}', '${escapeHtml(userData.displayName || 'User')}')"
                                style="flex: 1; background: var(--primary); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            💬 Chat starten
                        </button>
                        
                        <button onclick="closeUserProfileModal()"
                                style="flex: 1; background: var(--bg-input); color: var(--text); border: 1px solid var(--border); padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            Schließen
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Modal hinzufügen
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
    } catch (error) {
        console.error('Fehler beim Laden des Profils:', error);
        showNotification('❌ Profil konnte nicht geladen werden', 'error');
    }
}

// User-Profil Modal schließen
function closeUserProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.remove();
    }
}

// ===== AVATAR FUNKTIONEN =====

// Avatar speichern (korrigiert)
async function saveAvatar(base64Image) {
    if (!currentUser) return;
    
    try {
        // In Firebase speichern
        await window.db.ref('users/' + currentUser.uid).update({
            avatar: base64Image,
            lastUpdated: Date.now()
        });
        
        // In localStorage speichern
        localStorage.setItem(`user_avatar_${currentUser.uid}`, base64Image);
        
        // Aktuelle User-Daten aktualisieren
        if (userData) {
            userData.avatar = base64Image;
        }
        
        // Alle Avatar-Bilder auf der Seite aktualisieren
        updateAllAvatars(base64Image);
        
        showNotification('✅ Avatar gespeichert!', 'success');
        
    } catch (error) {
        console.error('Avatar-Speicherfehler:', error);
        showNotification('❌ Avatar konnte nicht gespeichert werden', 'error');
    }
}

function updateAllAvatars(avatarUrl) {
    // Dashboard Avatars
    const dashAvatar = document.getElementById('user-avatar');
    const profileAvatar = document.getElementById('profile-avatar');
    
    if (dashAvatar) dashAvatar.src = avatarUrl;
    if (profileAvatar) profileAvatar.src = avatarUrl;
    
    // Chat Avatars (wenn wir im Chat sind)
    const chatAvatars = document.querySelectorAll('.message-avatar');
    chatAvatars.forEach(avatar => {
        if (avatar.alt === currentUserProfile?.displayName || avatar.alt.includes('Du')) {
            avatar.src = avatarUrl;
        }
    });
}

// ===== GLOBALE FUNKTIONEN EXPORT =====

window.saveRoomSettings = saveRoomSettings;
window.closeRoomManagement = closeRoomManagement;
window.deleteRoom = deleteRoom;
window.transferRoomOwnership = transferRoomOwnership;
window.kickMember = kickMember;
window.leaveRoom = leaveRoom;
window.refreshRoomMembers = refreshRoomMembers;
window.viewUserProfile = viewUserProfile;
window.closeUserProfileModal = closeUserProfileModal;

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('hidden');
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    showNotification(`Theme: ${newTheme === 'light' ? 'Light' : 'Dark'}`, 'info');
}

function toggleOnlineUsers() {
    const sidebar = document.querySelector('.online-users-sidebar');
    if (sidebar) {
        if (window.innerWidth <= 768) {
            sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
        }
    }
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

function logout() {
    if (confirm('Möchtest du dich wirklich ausloggen?')) {
        // User als offline setzen
        if (onlineUsersRef && currentUser) {
            onlineUsersRef.child(currentUser.uid).remove();
        }
        
        // Status auf offline setzen
        if (currentUser) {
            window.db.ref('users/' + currentUser.uid).update({
                status: 'offline',
                lastSeen: Date.now()
            });
        }
        
        window.auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    }
}

function exportChat() {
    showNotification('📤 Export wird vorbereitet...', 'info');
}

function showReactionMenu(messageId, event) {
    if (event) {
        event.stopPropagation();
    }
    showNotification('❤️ Reaktionen kommen bald!', 'info');
}

function deleteMessage(messageId) {
    if (confirm('Nachricht wirklich löschen?')) {
        const messageRef = window.db.ref(`rooms/${currentRoom.id}/messages/${messageId}`);
        messageRef.remove();
        showNotification('✅ Nachricht gelöscht', 'success');
    }
}

function sendPrivateMessage() {
    showNotification('💬 Private Nachrichten kommen bald!', 'info');
}

function addFriend() {
    showNotification('👥 Freund hinzufügen kommt bald!', 'info');
}

function closeReactionModal() {
    document.getElementById('reaction-modal').classList.add('hidden');
}

function addReaction(emoji) {
    console.log('Reaktion:', emoji);
    closeReactionModal();
}

// ===== FILE TO BASE64 =====

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ===== AVATAR GENERATOR =====

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

// ===== EVENT LISTENER =====

function initEventListeners() {
    console.log('🎯 Initialisiere Event-Listener...');
    
    // Enter-Taste für Nachrichten
    const input = document.getElementById('message-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Dropdown Menüs
    const dropdownBtn = document.querySelector('.dropdown-btn');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });
        
        // Schließe bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-btn') && !e.target.closest('.dropdown-content')) {
                dropdownContent.classList.remove('show');
            }
        });
    }
    
    // Datei Preview
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', previewFile);
    }
    
    // Schließe alle offenen Menüs bei Klick außerhalb
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#emoji-picker') && !e.target.closest('.input-action-btn')) {
            const picker = document.getElementById('emoji-picker');
            if (picker) picker.classList.add('hidden');
        }
        
        if (!e.target.closest('#games-menu') && !e.target.closest('.dropdown-action')) {
            const gamesMenu = document.getElementById('games-menu');
            if (gamesMenu) gamesMenu.classList.add('hidden');
        }
        
        if (!e.target.closest('#rps-menu') && !e.target.closest('.game-btn')) {
            const rpsMenu = document.getElementById('rps-menu');
            if (rpsMenu) rpsMenu.classList.add('hidden');
        }
    });
    
    // Lightbox schließen mit Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageLightbox();
            closeProfile();
        }
    });
    
    console.log('✅ Event-Listener initialisiert');
}

// ===== GLOBALE FUNKTIONEN =====

window.showImageUpload = showImageUpload;
window.closeImageModal = closeImageModal;
window.uploadFile = uploadFile;
window.toggleEmojiPicker = toggleEmojiPicker;
window.changeEmojiCategory = changeEmojiCategory;
window.toggleGamesMenu = toggleGamesMenu;
window.playGame = playGame;
window.playRPS = playRPS;
window.playRPSChoice = playRPSChoice;
window.toggleOnlineUsers = toggleOnlineUsers;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.goToDashboard = goToDashboard;
window.exportChat = exportChat;
window.showUserProfile = showUserProfile;
window.closeProfile = closeProfile;
window.closeReactionModal = closeReactionModal;
window.showReactionMenu = showReactionMenu;
window.addReaction = addReaction;
window.openImage = openImageLightbox;
window.deleteMessage = deleteMessage;
window.sendPrivateMessage = sendPrivateMessage;
window.addFriend = addFriend;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.zoomInImage = zoomInImage;
window.zoomOutImage = zoomOutImage;
window.downloadImage = downloadImage;

console.log('✅ Chat-System komplett geladen!');