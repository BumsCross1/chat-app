// Dashboard Application - NextGen Chat
const roomsList = document.getElementById('rooms-list');
const createRoomBtn = document.getElementById('create-room-btn');
const roomNameInput = document.getElementById('room-name');
const roomPwInput = document.getElementById('room-password');
const roomDescriptionInput = document.getElementById('room-description');
const roomPrivateCheckbox = document.getElementById('room-private');
const logoutBtn = document.getElementById('logout-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const changePasswordBtn = document.getElementById('change-password-btn');
const displayNameInput = document.getElementById('displayName');
const userEmailInput = document.getElementById('user-email');
const roomSearchInput = document.getElementById('room-search');

// Navigation zwischen Sections
function showSection(sectionName) {
    console.log('Switching to section:', sectionName);
    
    // Alle Sections verstecken
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Alle Menu Items deaktivieren
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Gewünschte Section anzeigen
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Menu Item aktivieren
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
        if (userEmailInput) userEmailInput.value = user.email;
        if (displayNameInput) displayNameInput.value = user.displayName || '';
        
        // Avatar laden
        loadAvatar();
    }
}

// Avatar laden
async function loadAvatar() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const snapshot = await db.ref(`users/${user.uid}/avatar`).once('value');
        const avatarData = snapshot.val();
        
        if (avatarData) {
            document.getElementById('user-avatar').src = avatarData;
            document.getElementById('profile-avatar').src = avatarData;
            console.log('Avatar aus Database geladen');
        } else {
            setDefaultAvatar();
        }
    } catch (error) {
        console.log('Kein Avatar gefunden, verwende Default');
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

// Avatar hochladen (als Base64)
document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showMessage('Bitte nur Bilder hochladen!', 'error');
        return;
    }
    
    if (file.size > 0.5 * 1024 * 1024) { // 500KB Limit
        showMessage('Bild darf nicht größer als 500KB sein!', 'error');
        return;
    }
    
    try {
        const user = auth.currentUser;
        
        // Bild zu Base64 konvertieren
        const base64 = await fileToBase64(file);
        
        // Base64 in Database speichern
        await db.ref(`users/${user.uid}/avatar`).set(base64);
        
        // Avatar in UI aktualisieren
        document.getElementById('user-avatar').src = base64;
        document.getElementById('profile-avatar').src = base64;
        
        showMessage('Avatar erfolgreich aktualisiert!', 'success');
        
        // Formular zurücksetzen
        e.target.value = '';
        
    } catch (error) {
        console.error('Avatar Upload Fehler:', error);
        showMessage('Fehler beim Hochladen des Avatars: ' + error.message, 'error');
    }
});

// File zu Base64 Konverter
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Avatar entfernen
function removeAvatar() {
    const user = auth.currentUser;
    
    db.ref(`users/${user.uid}/avatar`).remove().then(() => {
        setDefaultAvatar();
        showMessage('Avatar entfernt!', 'success');
    }).catch((error) => {
        console.error('Avatar Löschen Fehler:', error);
        showMessage('Fehler beim Entfernen des Avatars', 'error');
    });
}

// Profil speichern
document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    try {
        const user = auth.currentUser;
        await user.updateProfile({
            displayName: document.getElementById('displayName').value
        });
        
        showMessage('Profil erfolgreich gespeichert!', 'success');
        loadUserInfo(); // UI aktualisieren
    } catch (error) {
        console.error('Profil Speichern Fehler:', error);
        showMessage(error.message, 'error');
    }
});

// Passwort ändern
document.getElementById('change-password-btn')?.addEventListener('click', async () => {
    const newPassword = prompt('Neues Passwort:');
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
        alert('Passwort muss mindestens 6 Zeichen lang sein!');
        return;
    }
    
    try {
        await auth.currentUser.updatePassword(newPassword);
        showMessage('Passwort erfolgreich geändert!', 'success');
    } catch (error) {
        console.error('Passwort Ändern Fehler:', error);
        showMessage(error.message, 'error');
    }
});

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

// Raum erstellen - FIXED
document.getElementById('create-room-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('room-name').value;
    const description = document.getElementById('room-description').value;
    const password = document.getElementById('room-password').value;
    const isPrivate = document.getElementById('room-private')?.checked || false;
    
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
            console.error('Password hashing error:', error);
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
            isPrivate: !!passwordHash || isPrivate,
            ownerId: auth.currentUser.uid,
            ownerName: auth.currentUser.displayName || auth.currentUser.email,
            createdAt: Date.now(),
            memberCount: 0
        });
        
        // Formular zurücksetzen
        document.getElementById('room-name').value = '';
        document.getElementById('room-description').value = '';
        document.getElementById('room-password').value = '';
        if (document.getElementById('room-private')) {
            document.getElementById('room-private').checked = false;
        }
        
        showSection('rooms');
        showMessage('Raum erfolgreich erstellt!', 'success');
    } catch (error) {
        console.error('Raum Erstellen Fehler:', error);
        showMessage('Fehler beim Erstellen des Raums: ' + error.message, 'error');
    }
});
        
  // Checkbox Fix für Raum erstellen
function initCheckbox() {
    const checkbox = document.getElementById('private-checkbox');
    const realCheckbox = document.getElementById('room-private');
    
    if (checkbox && realCheckbox) {
        // Sync initial state
        if (realCheckbox.checked) {
            checkbox.classList.add('checked');
        }
        
        // Update real checkbox when visual checkbox is clicked
        checkbox.addEventListener('click', function() {
            this.classList.toggle('checked');
            realCheckbox.checked = this.classList.contains('checked');
        });
        
        // Update visual checkbox when real checkbox changes
        realCheckbox.addEventListener('change', function() {
            if (this.checked) {
                checkbox.classList.add('checked');
            } else {
                checkbox.classList.remove('checked');
            }
        });
    }
}

// Und rufe die Funktion in DOMContentLoaded auf:
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');
    
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log('User logged in:', user.email);
            loadUserInfo();
            loadStats();
            initCheckbox(); // DIESE ZEILE HINZUFÜGEN
            
            // Standardmäßig Räume Section anzeigen
            setTimeout(() => {
                showSection('rooms');
            }, 100);
            
        } else {
            console.log('No user, redirecting to login...');
            window.location.href = 'index.html';
        }
    });
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

// Raum Suche
document.getElementById('room-search')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const roomCards = document.querySelectorAll('.room-card');
    
    roomCards.forEach(card => {
        const roomName = card.querySelector('.room-name').textContent.toLowerCase();
        const roomDescription = card.querySelector('.room-description')?.textContent.toLowerCase() || '';
        
        if (roomName.includes(searchTerm) || roomDescription.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
});

// Statistiken laden
function loadStats() {
    // Raum Anzahl
    db.ref('rooms').once('value').then(snap => {
        const totalRooms = document.getElementById('total-rooms');
        if (totalRooms) totalRooms.textContent = Object.keys(snap.val() || {}).length;
    });
    
    // User Anzahl (vereinfacht)
    db.ref('users').once('value').then(snap => {
        const totalUsers = document.getElementById('total-users');
        if (totalUsers) totalUsers.textContent = Object.keys(snap.val() || {}).length || '50+';
    });
    
    // Nachrichten Anzahl
    let totalMessages = 0;
    db.ref('messages').once('value').then(snap => {
        const messages = snap.val() || {};
        Object.values(messages).forEach(roomMessages => {
            totalMessages += Object.keys(roomMessages || {}).length;
        });
        const totalMessagesEl = document.getElementById('total-messages');
        if (totalMessagesEl) totalMessagesEl.textContent = totalMessages;
    });
}

// Logout
document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
});

// Init wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');
    
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log('User logged in:', user.email);
            loadUserInfo();
            loadStats();
            
            // Standardmäßig Räume Section anzeigen
            setTimeout(() => {
                showSection('rooms');
            }, 100);
            
        } else {
            console.log('No user, redirecting to login...');
            window.location.href = 'index.html';
        }
    });
});

// Globale Funktionen für HTML onclick
window.showSection = showSection;
window.removeAvatar = removeAvatar;

// Checkbox Toggle
function toggleCheckbox(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    checkbox.classList.toggle('checked');
    
    // Update the actual checkbox if it exists
    const realCheckbox = document.getElementById('room-private');
    if (realCheckbox) {
      realCheckbox.checked = checkbox.classList.contains('checked');
    }
  }
  
  // Make function global
  window.toggleCheckbox = toggleCheckbox;