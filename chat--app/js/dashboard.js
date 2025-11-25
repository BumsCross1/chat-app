// Dashboard mit User-Suche und Privaten Chats
const roomsList = document.getElementById('rooms-list');
const createRoomBtn = document.getElementById('create-room-btn');
const logoutBtn = document.getElementById('logout-btn');
const roomSearchInput = document.getElementById('room-search');

// User Search System
function initUserSearch() {
    const userSearchHTML = `
        <div class="search-container">
            <input type="text" id="user-search" class="modern-input" placeholder="🔍 Benutzer suchen...">
        </div>
        <div id="users-list" class="users-list"></div>
    `;
    
    const roomsSection = document.getElementById('rooms-section');
    const sectionHeader = roomsSection.querySelector('.section-header');
    sectionHeader.insertAdjacentHTML('afterend', userSearchHTML);
    
    // User Search Event
    document.getElementById('user-search').addEventListener('input', (e) => {
        searchUsers(e.target.value);
    });
}

async function searchUsers(searchTerm) {
    if (searchTerm.length < 2) {
        document.getElementById('users-list').innerHTML = '';
        return;
    }
    
    try {
        const usersSnapshot = await db.ref('users').once('value');
        const users = usersSnapshot.val() || {};
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        const currentUserId = auth.currentUser.uid;
        
        Object.entries(users).forEach(([userId, userData]) => {
            if (userId === currentUserId) return;
            
            const displayName = userData.displayName || userData.email;
            if (displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
                const userElement = document.createElement('div');
                userElement.className = 'user-card';
                userElement.innerHTML = `
                    <img src="${userData.avatar || generateDefaultAvatar(displayName)}" alt="Avatar" class="user-avatar">
                    <div class="user-info">
                        <div class="user-name">${displayName}</div>
                        <div class="user-email">${userData.email || ''}</div>
                    </div>
                    <button class="message-user-btn" onclick="startPrivateChat('${userId}', '${displayName}')">
                        💬 Nachricht
                    </button>
                `;
                usersList.appendChild(userElement);
            }
        });
    } catch (error) {
        console.error('User search error:', error);
    }
}

async function startPrivateChat(userId, userName) {
    const currentUser = auth.currentUser;
    
    // Erstelle einen privaten Chat Room
    const roomId = [currentUser.uid, userId].sort().join('_');
    const roomName = `Privat: ${currentUser.displayName} & ${userName}`;
    
    try {
        // Check if room already exists
        const roomSnapshot = await db.ref(`rooms/${roomId}`).once('value');
        
        if (!roomSnapshot.exists()) {
            // Create new private room
            await db.ref(`rooms/${roomId}`).set({
                id: roomId,
                name: roomName,
                description: `Privater Chat zwischen ${currentUser.displayName} und ${userName}`,
                isPrivate: true,
                participants: {
                    [currentUser.uid]: true,
                    [userId]: true
                },
                createdAt: Date.now(),
                createdBy: currentUser.uid
            });
        }
        
        // Join room
        localStorage.setItem('roomId', roomId);
        localStorage.setItem('roomName', roomName);
        window.location.href = 'chat.html';
        
    } catch (error) {
        console.error('Private chat creation error:', error);
        alert('Fehler beim Erstellen des privaten Chats');
    }
}

// Navigation
function showSection(sectionName) {
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

// User Info laden
function loadUserInfo() {
    const user = auth.currentUser;
    if (user) {
        document.getElementById('user-displayname').textContent = user.displayName || user.email;
        document.getElementById('user-email').value = user.email;
        document.getElementById('displayName').value = user.displayName || '';
        loadAvatar();
    }
}

async function loadAvatar() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const snapshot = await db.ref(`users/${user.uid}/avatar`).once('value');
        const avatarData = snapshot.val();
        
        if (avatarData) {
            document.getElementById('user-avatar').src = avatarData;
            document.getElementById('profile-avatar').src = avatarData;
        } else {
            setDefaultAvatar();
        }
    } catch (error) {
        setDefaultAvatar();
    }
}

function setDefaultAvatar() {
    const defaultAvatar = generateDefaultAvatar();
    const userAvatar = document.getElementById('user-avatar');
    const profileAvatar = document.getElementById('profile-avatar');
    
    if (userAvatar) userAvatar.src = defaultAvatar;
    if (profileAvatar) profileAvatar.src = defaultAvatar;
}

function generateDefaultAvatar() {
    const user = auth.currentUser;
    const displayName = user?.displayName || user?.email || 'User';
    const initial = displayName.charAt(0).toUpperCase();
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const color = colors[initial.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="60" fill="${color}"/>
            <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="48" font-weight="bold">${initial}</text>
        </svg>
    `)}`;
}

// Raum erstellen
document.getElementById('create-room-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('room-name').value;
    const description = document.getElementById('room-description').value;
    const password = document.getElementById('room-password').value;
    
    if (!name) {
        showMessage('Bitte Raumname eingeben', 'error');
        return;
    }
    
    let passwordHash = null;
    if (password) {
        try {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
            passwordHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            showMessage('Fehler beim Hashen des Passworts', 'error');
            return;
        }
    }
    
    try {
        const roomRef = db.ref('rooms').push();
        await roomRef.set({
            id: roomRef.key,
            name: name,
            description: description,
            passwordHash: passwordHash,
            isPrivate: !!passwordHash,
            ownerId: auth.currentUser.uid,
            ownerName: auth.currentUser.displayName || auth.currentUser.email,
            createdAt: Date.now(),
            memberCount: 0
        });
        
        // Formular zurücksetzen
        document.getElementById('room-name').value = '';
        document.getElementById('room-description').value = '';
        document.getElementById('room-password').value = '';
        
        showSection('rooms');
        showMessage('Raum erfolgreich erstellt!', 'success');
    } catch (error) {
        showMessage('Fehler beim Erstellen des Raums: ' + error.message, 'error');
    }
});

// Räume laden
db.ref('rooms').on('value', snap => {
    const data = snap.val() || {};
    const roomsList = document.getElementById('rooms-list');
    if (!roomsList) return;
    
    roomsList.innerHTML = '';
    
    Object.values(data).forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.innerHTML = `
            <div class="room-header">
                <div>
                    <div class="room-name">${room.name}</div>
                    <div class="room-privacy">${room.passwordHash ? '🔒 Privat' : '🌐 Öffentlich'}</div>
                </div>
            </div>
            ${room.description ? `<div class="room-description">${room.description}</div>` : ''}
            <div class="room-meta">
                <div class="room-owner">
                    <span>Erstellt von ${room.ownerName}</span>
                </div>
                <div class="room-members">👥 ${room.memberCount || 0}</div>
            </div>
            <button class="join-btn" data-room-id="${room.id}" data-room-name="${room.name}" data-room-private="${!!room.passwordHash}">
                ${room.passwordHash ? '🔓 Beitreten' : '🚪 Beitreten'}
            </button>
        `;
        
        roomsList.appendChild(roomCard);
    });
    
    // Event Listener für Join Buttons
    document.querySelectorAll('.join-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const roomId = e.target.dataset.roomId;
            const roomName = e.target.dataset.roomName;
            const isPrivate = e.target.dataset.roomPrivate === 'true';
            
            if (isPrivate) {
                const password = prompt('Raum Passwort:');
                if (!password) return;
                
                const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
                const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
                
                // Passwort verifizieren
                const roomSnapshot = await db.ref(`rooms/${roomId}`).once('value');
                const room = roomSnapshot.val();
                
                if (room.passwordHash !== hash) {
                    alert('Falsches Passwort!');
                    return;
                }
            }
            
            localStorage.setItem('roomId', roomId);
            localStorage.setItem('roomName', roomName);
            window.location.href = 'chat.html';
        });
    });
});

// Profil speichern
document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    try {
        const user = auth.currentUser;
        await user.updateProfile({
            displayName: document.getElementById('displayName').value
        });
        
        // Avatar in Database speichern
        const avatar = document.getElementById('profile-avatar').src;
        if (avatar && !avatar.includes('data:image/svg+xml')) {
            await db.ref(`users/${user.uid}/avatar`).set(avatar);
        }
        
        showMessage('Profil erfolgreich gespeichert!', 'success');
        loadUserInfo();
    } catch (error) {
        showMessage(error.message, 'error');
    }
});

// Avatar Upload
document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showMessage('Bitte nur Bilder hochladen!', 'error');
        return;
    }
    
    if (file.size > 0.5 * 1024 * 1024) {
        showMessage('Bild darf nicht größer als 500KB sein!', 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        const base64 = await fileToBase64(file);
        
        document.getElementById('user-avatar').src = base64;
        document.getElementById('profile-avatar').src = base64;
        
        showMessage('Avatar erfolgreich aktualisiert!', 'success');
        e.target.value = '';
        
    } catch (error) {
        showMessage('Fehler beim Hochladen des Avatars: ' + error.message, 'error');
    }
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function removeAvatar() {
    setDefaultAvatar();
    showMessage('Avatar entfernt!', 'success');
}

// Nachricht anzeigen
function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('profile-message');
    if (!messageDiv) return;
    
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Logout
logoutBtn?.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(user => {
        if (user) {
            loadUserInfo();
            initUserSearch();
            showSection('rooms');
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Globale Funktionen
window.showSection = showSection;
window.removeAvatar = removeAvatar;
window.startPrivateChat = startPrivateChat;