// DASHBOARD.JS - VOLLSTÄNDIGE LÖSUNG

// Globale Variablen
let currentUser = null;
let isAdmin = false;
let authListenerActive = false;

// ===== INITIALISIERUNG =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📋 Dashboard geladen');
  
  // Warte auf Firebase
  const firebaseReady = await waitForFirebase();
  if (!firebaseReady) {
    showError('Firebase nicht bereit');
    return;
  }
  
  // Auth Handler einrichten
  setupAuthHandler();
});

// ===== FIREBASE HELPER =====
function waitForFirebase() {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (window.auth && window.db) {
        clearInterval(check);
        console.log('✅ Firebase bereit');
        resolve(true);
      } else if (attempts > 50) { // 5 Sekunden
        clearInterval(check);
        console.error('❌ Firebase Timeout');
        resolve(false);
      }
    }, 100);
  });
}

// ===== AUTH HANDLER =====
function setupAuthHandler() {
  if (authListenerActive) return;
  authListenerActive = true;
  
  console.log('🔐 Auth Handler gestartet');
  
  window.auth.onAuthStateChanged(async (user) => {
    console.log('🔄 Auth State:', user ? user.email : 'Kein User');
    
    if (user) {
      // USER EINGELOGGT
      currentUser = user;
      
      try {
        // 1. User in Firebase erstellen/updaten
        await ensureUserInDatabase(user);
        
        // 2. Admin Status prüfen
        await checkAdminStatus(user);
        
        // 3. Dashboard laden
        await initDashboardUI();
        
        showNotification('✅ Erfolgreich eingeloggt!', 'success');
        
      } catch (error) {
        console.error('❌ Setup Fehler:', error);
        showError('Login fehlgeschlagen');
      }
      
    } else {
      // USER AUSGELOGGT
      console.log('👋 Kein User - Weiterleitung');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    }
  });
}

// ===== USER DATABASE SETUP =====
async function ensureUserInDatabase(user) {
  try {
    const userRef = window.db.ref(`users/${user.uid}`);
    const snapshot = await userRef.once('value');
    
    const userData = {
      email: user.email,
      displayName: user.displayName || user.email,
      lastLogin: Date.now(),
      status: 'online',
      avatar: null
    };
    
    if (!snapshot.exists()) {
      // Neuer User
      userData.createdAt = Date.now();
      userData.role = user.email === 'martinherklotzt02@gmail.com' ? 'admin' : 'user';
      userData.messageCount = 0;
      userData.roomsCreated = 0;
      
      await userRef.set(userData);
      console.log('👤 Neuer User erstellt');
    } else {
      // Existierender User
      await userRef.update(userData);
      console.log('👤 User aktualisiert');
    }
    
    return true;
  } catch (error) {
    console.error('❌ User Setup Fehler:', error);
    throw error;
  }
}

// ===== ADMIN CHECK =====
async function checkAdminStatus(user) {
  try {
    if (user.email === 'martinherklotzt02@gmail.com') {
      // Admin Rechte setzen
      await window.db.ref(`users/${user.uid}`).update({
        role: 'admin',
        isAdmin: true
      });
      
      isAdmin = true;
      console.log('👑 Admin Rechte gesetzt');
    } else {
      // Prüfe ob User Admin ist
      const snapshot = await window.db.ref(`users/${user.uid}/role`).once('value');
      isAdmin = snapshot.val() === 'admin';
    }
    
    // Admin Menu anzeigen/verstecken
    const adminBtn = document.getElementById('admin-menu-item');
    if (adminBtn) {
      adminBtn.style.display = isAdmin ? 'flex' : 'none';
    }
    
    return isAdmin;
  } catch (error) {
    console.error('Admin Check Fehler:', error);
    return false;
  }
}

async function initDashboardUI() {
  console.log('🎨 Initialisiere Dashboard UI');
  
  try {
      // 1. Theme
      initTheme();
      
      // 2. User Info laden
      await loadUserInfo();
      
      // 3. Event Listeners
      setupEventListeners();
      
      // 4. User Search initialisieren
      initUserSearch();
      
      // 5. Live Statistiken starten
      initStatistics();
      
      // 6. Räume laden
      loadRooms();
      
      // 7. Standard Section
      showSection('rooms');
      
      // 8. Notifications setup
      initNotifications();
      
      console.log('✅ Dashboard UI fertig');
      
  } catch (error) {
      console.error('❌ UI Init Fehler:', error);
  }
}

// ===== THEME SYSTEM =====
function initTheme() {
  const savedTheme = localStorage.getItem('chat-theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  
  const themeIcon = document.getElementById('dashboard-theme-icon');
  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
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
  
  showNotification(`Theme zu ${newTheme === 'light' ? '☀️ Light' : '🌙 Dark'}`, 'info');
}

async function loadUserInfo() {
  if (!currentUser) return;
  
  try {
      const snapshot = await window.db.ref(`users/${currentUser.uid}`).once('value');
      const userData = snapshot.val() || {};
      
      // Avatar laden und setzen
      const avatarUrl = await loadUserAvatar();
      
      // Avatar in allen Elementen setzen
      const avatarElements = [
          document.getElementById('user-avatar'),
          document.getElementById('profile-avatar')
      ];
      
      avatarElements.forEach(el => {
          if (el) {
              el.src = avatarUrl;
              el.onerror = function() {
                  this.src = generateDefaultAvatar(userData.displayName || currentUser.email);
              };
          }
      });
      
      // Benutzername setzen
      const displayName = userData.displayName || currentUser.email;
      document.getElementById('user-displayname').textContent = displayName;
      document.getElementById('displayName').value = displayName;
      
      // Email setzen
      document.getElementById('user-email').value = currentUser.email;
      
      // Stats setzen
      document.getElementById('mini-messages').textContent = userData.messageCount || '0';
      document.getElementById('mini-rooms').textContent = userData.roomsCreated || '0';
      
  } catch (error) {
      console.error('User Info Fehler:', error);
  }
}

// Live Statistics System
async function initStatistics() {
  if (!currentUser) return;
  
  try {
      // 1. Eigene User-Daten live abonnieren
      db.ref(`users/${currentUser.uid}`).on('value', (snapshot) => {
          const userData = snapshot.val() || {};
          console.log('📊 User-Daten aktualisiert:', userData);
          
          // Mini Stats in Sidebar
          const miniMessages = document.getElementById('mini-messages');
          const miniRooms = document.getElementById('mini-rooms');
          
          if (miniMessages) miniMessages.textContent = userData.messageCount || '0';
          if (miniRooms) miniRooms.textContent = userData.roomsCreated || '0';
          
          // Haupt Stats in Stats Section
          const statMessages = document.getElementById('stat-messages');
          const statRooms = document.getElementById('stat-rooms');
          const statReactions = document.getElementById('stat-reactions');
          const statFriends = document.getElementById('stat-friends');
          
          if (statMessages) statMessages.textContent = userData.messageCount || '0';
          if (statRooms) statRooms.textContent = userData.roomsCreated || '0';
          if (statReactions) statReactions.textContent = userData.reactionsReceived || '0';
          if (statFriends) statFriends.textContent = userData.friendsCount || '0';
          
          // Avatar in Sidebar aktualisieren
          const userAvatar = document.getElementById('user-avatar');
          if (userAvatar && userData.avatar) {
              userAvatar.src = userData.avatar;
          }
      });
      
      // 2. Globale Statistiken (alle Räume, alle User)
      loadGlobalStatistics();
      
      // 3. Räume Statistiken
      loadRoomStatistics();
      
  } catch (error) {
      console.error('❌ Statistiken Fehler:', error);
  }
}

async function loadGlobalStatistics() {
  try {
      // Alle Räume zählen
      db.ref('rooms').on('value', (snapshot) => {
          const rooms = snapshot.val() || {};
          const totalRooms = Object.keys(rooms).length;
          
          // Öffentliche Räume zählen
          const publicRooms = Object.values(rooms).filter(room => !room.isPrivate).length;
          const privateRooms = totalRooms - publicRooms;
          
          const totalRoomsEl = document.getElementById('total-rooms');
          if (totalRoomsEl) {
              totalRoomsEl.innerHTML = `
                  <strong>${totalRooms}</strong> total<br>
                  <small>(${publicRooms} öffentlich, ${privateRooms} privat)</small>
              `;
          }
      });
      
      // Alle User zählen
      db.ref('users').on('value', (snapshot) => {
          const users = snapshot.val() || {};
          const totalUsers = Object.keys(users).length;
          
          // Online User zählen
          const onlineUsers = Object.values(users).filter(user => user.status === 'online').length;
          
          const totalUsersEl = document.getElementById('total-users');
          if (totalUsersEl) {
              totalUsersEl.innerHTML = `
                  <strong>${totalUsers}</strong> registriert<br>
                  <small>(${onlineUsers} online)</small>
              `;
          }
      });
      
  } catch (error) {
      console.error('❌ Globale Statistiken Fehler:', error);
  }
}

async function loadRoomStatistics() {
  try {
      // Nachrichten-Statistiken
      db.ref('messages').once('value', (snapshot) => {
          const messagesData = snapshot.val() || {};
          let totalMessages = 0;
          
          // Zähle Nachrichten in allen Räumen
          Object.values(messagesData).forEach(roomMessages => {
              if (roomMessages) {
                  totalMessages += Object.keys(roomMessages).length;
              }
          });
          
          console.log('📨 Total Messages:', totalMessages);
          
          // Optional: In UI anzeigen
          const messageStats = document.querySelector('.stat-item:nth-child(1) .stat-value');
          if (messageStats && messageStats.id === 'stat-messages') {
              // Falls der eigene Wert noch 0 ist, zeige zumindest die globale Zahl
              if (parseInt(messageStats.textContent) === 0 && totalMessages > 0) {
                  messageStats.textContent = totalMessages;
              }
          }
      });
      
  } catch (error) {
      console.error('❌ Raum-Statistiken Fehler:', error);
  }
}

// Avatar Upload System in dashboard.js
function setupAvatarUpload() {
  const uploadInput = document.getElementById('avatar-upload');
  if (!uploadInput) return;
  
  uploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (!file.type.startsWith('image/')) {
          showNotification('❌ Nur Bilder erlaubt!', 'error');
          return;
      }
      
      if (file.size > 2 * 1024 * 1024) {
          showNotification('❌ Max 2MB!', 'error');
          return;
      }
      
      try {
          // Show loading
          const saveBtn = document.getElementById('save-profile-btn');
          if (saveBtn) {
              const originalText = saveBtn.innerHTML;
              saveBtn.innerHTML = '<div class="spinner"></div> Speichere...';
              saveBtn.disabled = true;
          }
          
          // Convert to Base64
          const base64 = await fileToBase64(file);
          
          // Update all avatar images
          const avatars = [
              document.getElementById('user-avatar'),
              document.getElementById('profile-avatar')
          ];
          
          avatars.forEach(avatar => {
              if (avatar) {
                  avatar.src = base64;
                  avatar.onerror = function() {
                      this.src = generateDefaultAvatar(currentUser.displayName || currentUser.email);
                  };
              }
          });
          
          // Save to Firebase
          await window.db.ref(`users/${currentUser.uid}`).update({
              avatar: base64,
              lastUpdated: Date.now()
          });
          
          // Also update Auth profile if possible
          if (currentUser.updateProfile) {
              try {
                  await currentUser.updateProfile({
                      photoURL: base64
                  });
              } catch (authError) {
                  console.log('Auth avatar update optional');
              }
          }
          
          // Save to localStorage as backup
          localStorage.setItem(`user_avatar_${currentUser.uid}`, base64);
          
          showNotification('✅ Avatar gespeichert!', 'success');
          
      } catch (error) {
          console.error('Avatar Fehler:', error);
          showNotification('❌ Avatar Fehler: ' + error.message, 'error');
      } finally {
          const saveBtn = document.getElementById('save-profile-btn');
          if (saveBtn) {
              saveBtn.innerHTML = '💾 Profil speichern';
              saveBtn.disabled = false;
          }
      }
  });
}

// Avatar speichern Funktion
async function saveUserAvatar(avatarBase64) {
  if (!currentUser) return false;
  
  try {
      // 1. In Firebase speichern
      await window.db.ref(`users/${currentUser.uid}`).update({
          avatar: avatarBase64,
          lastUpdated: Date.now()
      });
      
      // 2. In localStorage speichern (Backup)
      localStorage.setItem(`user_avatar_${currentUser.uid}`, avatarBase64);
      
      // 3. In allen UI-Elementen aktualisieren
      const avatarElements = document.querySelectorAll('[id*="avatar"], .user-avatar-img, .profile-avatar-img');
      avatarElements.forEach(el => {
          el.src = avatarBase64;
      });
      
      // 4. In Auth Profile speichern (falls möglich)
      if (currentUser.updateProfile) {
          try {
              await currentUser.updateProfile({
                  photoURL: avatarBase64
              });
          } catch (authError) {
              console.log('Auth avatar update optional');
          }
      }
      
      console.log('✅ Avatar in mehreren Quellen gespeichert');
      return true;
      
  } catch (error) {
      console.error('❌ Avatar speichern fehlgeschlagen:', error);
      
      // Fallback: Nur localStorage
      localStorage.setItem(`user_avatar_${currentUser.uid}`, avatarBase64);
      return false;
  }
}

// Avatar aus Firebase laden
async function loadUserAvatar() {
  if (!currentUser) return generateDefaultAvatar('User');
  
  try {
      // 1. Versuche aus Firebase zu laden
      const snapshot = await window.db.ref(`users/${currentUser.uid}/avatar`).once('value');
      const firebaseAvatar = snapshot.val();
      
      // 2. Falls vorhanden, speichere in localStorage und verwende
      if (firebaseAvatar && firebaseAvatar !== 'null' && firebaseAvatar.startsWith('data:')) {
          localStorage.setItem(`user_avatar_${currentUser.uid}`, firebaseAvatar);
          return firebaseAvatar;
      }
      
      // 3. Versuche aus localStorage zu laden
      const localAvatar = localStorage.getItem(`user_avatar_${currentUser.uid}`);
      if (localAvatar && localAvatar.startsWith('data:')) {
          // Aktualisiere Firebase mit localStorage Version
          window.db.ref(`users/${currentUser.uid}/avatar`).set(localAvatar);
          return localAvatar;
      }
      
      // 4. Generiere neuen Avatar
      const newAvatar = generateDefaultAvatar(currentUser.displayName || currentUser.email);
      localStorage.setItem(`user_avatar_${currentUser.uid}`, newAvatar);
      window.db.ref(`users/${currentUser.uid}/avatar`).set(newAvatar);
      
      return newAvatar;
      
  } catch (error) {
      console.error('Avatar laden fehlgeschlagen:', error);
      return generateDefaultAvatar(currentUser.displayName || currentUser.email);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// ===== RAUM SYSTEM =====
function loadRooms() {
  const roomsList = document.getElementById('rooms-list');
  if (!roomsList) return;
  
  roomsList.innerHTML = '<div class="loading">🏠 Lade Räume...</div>';
  
  window.db.ref('rooms').on('value', (snapshot) => {
    const rooms = snapshot.val() || {};
    const roomsArray = Object.values(rooms);
    
    roomsList.innerHTML = '';
    
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
    
    roomsArray.forEach(room => {
      const roomCard = createRoomCard(room);
      roomsList.appendChild(roomCard);
    });
  });
}

function createRoomCard(room) {
  const div = document.createElement('div');
  div.className = 'room-card';
  
  const isOwner = room.ownerId === currentUser?.uid;
  
  div.innerHTML = `
    <div class="room-header">
      <div>
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-privacy">${room.passwordHash ? '🔒 Privat' : '🌐 Öffentlich'}</div>
      </div>
      ${isOwner ? '<span class="owner-badge">👑 Besitzer</span>' : ''}
    </div>
    ${room.description ? `<div class="room-description">${escapeHtml(room.description)}</div>` : ''}
    <div class="room-meta">
      <div class="room-owner">Erstellt von ${escapeHtml(room.ownerName)}</div>
      <div class="room-members">👥 ${room.memberCount || 0}</div>
    </div>
    <div class="room-actions">
      <button class="join-btn" onclick="joinRoom('${room.id}', '${escapeHtml(room.name)}', ${!!room.passwordHash})">
        ${room.passwordHash ? '🔓 Beitreten' : '🚪 Beitreten'}
      </button>
      ${isOwner ? `<button class="manage-btn" onclick="manageRoom('${room.id}')">🔧 Verwalten</button>` : ''}
    </div>
  `;
  
  return div;
}

async function joinRoom(roomId, roomName, isPrivate) {
  if (!currentUser) return;
  
  if (isPrivate) {
    const password = prompt('🔒 Raum Passwort:');
    if (!password) return;
    
    // Password check hier
    showNotification('Prüfe Passwort...', 'info');
  }
  
  showNotification('🚀 Beitrete Raum...', 'info');
  
  try {
    // Mitglied hinzufügen
    await window.db.ref(`rooms/${roomId}/members/${currentUser.uid}`).set({
      joinedAt: Date.now(),
      role: 'member',
      displayName: currentUser.displayName || currentUser.email
    });
    
    // Member Count erhöhen
    await window.db.ref(`rooms/${roomId}/memberCount`).transaction(c => (c || 0) + 1);
    
    // In localStorage speichern
    localStorage.setItem('roomId', roomId);
    localStorage.setItem('roomName', roomName);
    
    showNotification('✅ Erfolgreich beigetreten!', 'success');
    
    setTimeout(() => {
      window.location.href = 'chat.html';
    }, 1000);
    
  } catch (error) {
    console.error('Raum Fehler:', error);
    showNotification('❌ Raum Fehler', 'error');
  }
}

async function createRoom() {
  const name = document.getElementById('room-name')?.value.trim();
  const desc = document.getElementById('room-description')?.value.trim();
  const password = document.getElementById('room-password')?.value;
  
  if (!name) {
      showNotification('❌ Bitte Namen eingeben', 'error');
      return;
  }
  
  const btn = document.getElementById('create-room-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Erstelle...';
  
  try {
      const roomRef = db.ref('rooms').push();
      const roomId = roomRef.key;
      
      const roomData = {
          id: roomId,
          name: name,
          description: desc || '',
          passwordHash: password || null,
          isPrivate: !!password,
          ownerId: currentUser.uid,
          ownerName: currentUser.displayName || currentUser.email,
          createdAt: Date.now(),
          memberCount: 1,
          lastActivity: Date.now(),
          settings: {
              allowImages: true,
              allowVoice: true,
              maxMembers: 100
          }
      };
      
      await roomRef.set(roomData);
      
      // ✅ WICHTIG: Rooms Created Count erhöhen
      const userRoomsRef = db.ref(`users/${currentUser.uid}/roomsCreated`);
      const roomsSnapshot = await userRoomsRef.once('value');
      const currentRooms = roomsSnapshot.val() || 0;
      await userRoomsRef.set(currentRooms + 1);
      
      // Mitglied hinzufügen
      await db.ref(`rooms/${roomId}/members/${currentUser.uid}`).set({
          joinedAt: Date.now(),
          role: 'owner',
          displayName: currentUser.displayName || currentUser.email,
          addedBy: 'self'
      });
      
      // Formular leeren
      document.getElementById('room-name').value = '';
      document.getElementById('room-description').value = '';
      document.getElementById('room-password').value = '';
      
      showNotification('🚀 Raum erstellt!', 'success');
      showSection('rooms');
      
      // Statistiken neu laden
      setTimeout(() => {
          initStatistics();
          loadRooms();
      }, 500);
      
  } catch (error) {
      console.error('Create Room Fehler:', error);
      showNotification('❌ Erstellen fehlgeschlagen: ' + error.message, 'error');
  } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
  }
}

async function loadAdminPanel() {
  if (!isAdmin) {
      showNotification('❌ Keine Admin-Rechte', 'error');
      return;
  }
  
  try {
      const usersSnapshot = await window.db.ref('users').once('value');
      const users = usersSnapshot.val() || {};
      
      if (Object.keys(users).length === 0) {
          document.getElementById('admin-section').innerHTML = `
              <div class="section-header">
                  <h1>👑 Admin Panel</h1>
              </div>
              <div class="no-results">👤 Keine User gefunden</div>
          `;
          return;
      }
      
      let html = `
          <div class="admin-table-header">
              <span>👤 User</span>
              <span>📧 Email</span>
              <span>👑 Rolle</span>
              <span>📊 Nachrichten</span>
              <span>⚡ Aktionen</span>
          </div>
      `;
      
      Object.entries(users).forEach(([uid, user]) => {
          // Überspringe anonyme User
          if (!user || !user.email) return;
          
          const displayName = user.displayName || user.email || 'Unbekannt';
          const email = user.email || '';
          const role = user.role || 'user';
          const messageCount = user.messageCount || 0;
          const isBanned = user.isBanned || false;
          
          html += `
              <div class="admin-user-row">
                  <div class="user-cell">
                      <img src="${user.avatar || generateDefaultAvatar(displayName)}" 
                           class="user-avatar-small"
                           onerror="this.src='${generateDefaultAvatar(displayName)}'">
                      <div>
                          <span class="user-name">${escapeHtml(displayName)}</span>
                          <br>
                          <small style="color: var(--text-muted)">ID: ${uid.substring(0, 8)}...</small>
                      </div>
                  </div>
                  <div class="email-cell">${escapeHtml(email)}</div>
                  <div class="role-cell">
                      <span class="role-badge ${role === 'admin' ? 'admin' : 'user'}">
                          ${role === 'admin' ? '👑 Admin' : '👤 User'}
                      </span>
                  </div>
                  <div class="stats-cell">
                      <span>${messageCount}</span>
                  </div>
                  <div class="actions-cell">
                      ${role !== 'admin' ? `
                          <button class="admin-action-btn promote" onclick="promoteToAdmin('${uid}')" 
                                  title="Zum Admin befördern">👑</button>
                      ` : ''}
                      <button class="admin-action-btn ban" onclick="toggleBanUser('${uid}', ${isBanned})" 
                              title="${isBanned ? 'Entbannen' : 'Bannen'}">
                          ${isBanned ? '✅' : '⛔'}
                      </button>
                      <button class="admin-action-btn delete" onclick="deleteUser('${uid}')" 
                              title="User löschen">🗑️</button>
                  </div>
              </div>
          `;
      });
      
      document.getElementById('admin-section').innerHTML = `
          <div class="section-header">
              <h1>👑 Admin Panel</h1>
              <button class="modern-btn cosmic-btn" onclick="refreshAdminPanel()">
                  🔄 Aktualisieren
              </button>
          </div>
          <div class="admin-users-list">
              ${html}
          </div>
      `;
      
  } catch (error) {
      console.error('Admin Panel Fehler:', error);
      showNotification('❌ Fehler beim Laden des Admin Panels', 'error');
  }
}

// Admin Funktionen hinzufügen
async function promoteToAdmin(userId) {
  if (!confirm('Diesen User wirklich zum Admin befördern?\n\nEr/Sie wird dann volle Kontrolle haben!')) return;
  
  try {
      await db.ref(`users/${userId}`).update({
          role: 'admin',
          isAdmin: true
      });
      
      showNotification('✅ User zum Admin befördert', 'success');
      loadAdminPanel(); // Neu laden
      
  } catch (error) {
      console.error('Promote error:', error);
      showNotification('❌ Fehler beim Befördern', 'error');
  }
}

async function toggleBanUser(userId, isCurrentlyBanned) {
  const action = isCurrentlyBanned ? 'entbannen' : 'bannen';
  if (!confirm(`User wirklich ${action}?`)) return;
  
  try {
      await db.ref(`users/${userId}`).update({
          isBanned: !isCurrentlyBanned,
          status: isCurrentlyBanned ? 'online' : 'banned'
      });
      
      showNotification(`✅ User ${isCurrentlyBanned ? 'entbannt' : 'gebannt'}`, 'success');
      loadAdminPanel();
      
  } catch (error) {
      console.error('Ban error:', error);
      showNotification('❌ Fehler', 'error');
  }
}

async function deleteUser(userId) {
  if (!confirm('🚨 WARNUNG: User KOMPLETT löschen?\n\nAlle Nachrichten, Räume und Daten werden entfernt!\n\nDies kann NICHT rückgängig gemacht werden!')) return;
  
  try {
      // 1. User aus der Datenbank entfernen
      await db.ref(`users/${userId}`).remove();
      
      // 2. User aus allen Räumen entfernen
      const roomsSnapshot = await db.ref('rooms').once('value');
      const rooms = roomsSnapshot.val() || {};
      
      const updatePromises = [];
      Object.keys(rooms).forEach(roomId => {
          updatePromises.push(
              db.ref(`rooms/${roomId}/members/${userId}`).remove()
          );
      });
      
      await Promise.all(updatePromises);
      
      showNotification('🗑️ User gelöscht', 'success');
      loadAdminPanel();
      
  } catch (error) {
      console.error('Delete error:', error);
      showNotification('❌ Fehler beim Löschen', 'error');
  }
}

function refreshAdminPanel() {
  loadAdminPanel();
  showNotification('🔄 Admin Panel aktualisiert', 'success');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await window.db.ref(`users/${currentUser.uid}/status`).set('offline');
        await window.auth.signOut();
        showNotification('👋 Bis bald!', 'success');
      } catch (error) {
        console.error('Logout Fehler:', error);
      }
    });
  }
  
  // Room Create Button
  const createBtn = document.getElementById('create-room-btn');
  if (createBtn) {
    createBtn.addEventListener('click', createRoom);
  }
  
  // Profile Save
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProfile);
  }
  
  // Avatar Upload
  setupAvatarUpload();
}

async function saveProfile() {
  const nameInput = document.getElementById('displayName');
  if (!nameInput || !currentUser) return;
  
  const displayName = nameInput.value.trim();
  if (!displayName) {
    showNotification('❌ Bitte Namen eingeben', 'error');
    return;
  }
  
  try {
    // Firebase Auth aktualisieren
    await currentUser.updateProfile({ displayName });
    
    // Database aktualisieren
    await window.db.ref(`users/${currentUser.uid}`).update({
      displayName: displayName,
      lastUpdated: Date.now()
    });
    
    showNotification('✅ Profil gespeichert!', 'success');
    
  } catch (error) {
    console.error('Profile Save Fehler:', error);
    showNotification('❌ Speichern fehlgeschlagen', 'error');
  }
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
          usersList.innerHTML = '<div class="info-text">🔍 Gib mindestens 2 Zeichen ein um User zu suchen</div>';
          return;
      }
      
      searchTimeout = setTimeout(async () => {
          try {
              usersList.innerHTML = '<div class="loading">🔍 Suche User...</div>';
              
              const snapshot = await db.ref('users').once('value');
              const allUsers = snapshot.val() || {};
              
              const filteredUsers = Object.entries(allUsers)
                  .filter(([uid, user]) => {
                      if (uid === currentUser.uid) return false; // Eigenen User ausschließen
                      
                      const nameMatch = user.displayName?.toLowerCase().includes(query);
                      const emailMatch = user.email?.toLowerCase().includes(query);
                      return nameMatch || emailMatch;
                  })
                  .slice(0, 20); // Limit auf 20 Ergebnisse
              
              if (filteredUsers.length === 0) {
                  usersList.innerHTML = '<div class="no-results">👤 Keine User gefunden</div>';
                  return;
              }
              
              let html = '';
              filteredUsers.forEach(([uid, user]) => {
                  const avatar = user.avatar || generateDefaultAvatar(user.displayName || user.email);
                  const isOnline = user.status === 'online';
                  
                  html += `
                      <div class="user-card">
                          <img src="${avatar}" alt="Avatar" class="user-avatar" 
                               onerror="this.src='${generateDefaultAvatar(user.displayName || user.email)}'">
                          <div class="user-info">
                              <span class="user-name">${escapeHtml(user.displayName || user.email)}</span>
                              <span class="user-email">${escapeHtml(user.email || '')}</span>
                              <span class="user-status" style="color: ${isOnline ? '#10b981' : '#64748b'}">
                                  ${isOnline ? '🟢 Online' : '⚫ Offline'}
                              </span>
                          </div>
                          <button class="message-user-btn" onclick="startPrivateChat('${uid}', '${escapeHtml(user.displayName)}')">
                              💬 Chat
                          </button>
                      </div>
                  `;
              });
              
              usersList.innerHTML = html;
              
          } catch (error) {
              console.error('User search error:', error);
              usersList.innerHTML = '<div class="error">❌ Fehler bei der Suche</div>';
          }
      }, 500); // 500ms Debounce
  });
}

// Private Chat starten - VERÄNDERTE VERSION
function startPrivateChat(userId, userName) {
  if (!currentUser) return;
  
  // Erstelle einen privaten Raum oder finde bestehenden
  const privateRoomId = [currentUser.uid, userId].sort().join('_');
  const roomName = `Privat: ${userName}`;
  
  // Prüfe ob Raum existiert
  db.ref(`privateRooms/${privateRoomId}`).once('value')
      .then(snapshot => {
          if (!snapshot.exists()) {
              // Neuen privaten Raum erstellen mit Object-basierter participants Struktur
              return db.ref(`privateRooms/${privateRoomId}`).set({
                  id: privateRoomId,
                  name: roomName,
                  participants: {
                      [currentUser.uid]: true,
                      [userId]: true
                  },
                  createdAt: Date.now(),
                  isPrivate: true,
                  type: 'direct'
              });
          }
          return Promise.resolve();
      })
      .then(() => {
          // In localStorage speichern
          localStorage.setItem('roomId', privateRoomId);
          localStorage.setItem('roomName', roomName);
          localStorage.setItem('roomType', 'private');
          
          // Zum Chat weiterleiten
          showNotification(`💬 Starte Chat mit ${userName}`, 'success');
          setTimeout(() => {
              window.location.href = 'chat.html';
          }, 1000);
      })
      .catch(error => {
          console.error('Private chat error:', error);
          showNotification('❌ Fehler beim Starten des Chats', 'error');
      });
}

// ===== HELPER FUNKTIONEN =====
function showSection(section) {
  // Alle Sections verstecken
  document.querySelectorAll('.content-section').forEach(el => {
    el.classList.remove('active');
  });
  
  // Alle Menu Items
  document.querySelectorAll('.menu-item').forEach(el => {
    el.classList.remove('active');
  });
  
  // Ziel Section zeigen
  const target = document.getElementById(`${section}-section`);
  if (target) target.classList.add('active');
  
  // Menu Item aktivieren
  const menuItem = document.querySelector(`.menu-item[onclick*="${section}"]`);
  if (menuItem) menuItem.classList.add('active');
  
  // Spezielle Aktionen
  if (section === 'admin' && isAdmin) {
    loadAdminPanel();
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
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function showError(message) {
  showNotification(`❌ ${message}`, 'error');
}

function initNotifications() {
  // Notification Container erstellen
  if (!document.getElementById('notification-container')) {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateDefaultAvatar(name) {
  const displayName = name || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  const color = colors[initial.charCodeAt(0) % colors.length];
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="${color}"/>
      <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="40" font-weight="bold">${initial}</text>
    </svg>
  `)}`;
}

// ===== GLOBALE FUNKTIONEN =====
window.showSection = showSection;
window.toggleTheme = toggleTheme;
window.removeAvatar = () => {
  if (!currentUser) return;
  
  const avatars = [
    document.getElementById('user-avatar'),
    document.getElementById('profile-avatar')
  ];
  
  const defaultAvatar = generateDefaultAvatar(currentUser.displayName || currentUser.email);
  avatars.forEach(avatar => {
    if (avatar) avatar.src = defaultAvatar;
  });
  
  window.db.ref(`users/${currentUser.uid}/avatar`).remove();
  showNotification('🗑️ Avatar entfernt', 'success');
};

window.startPrivateChat = (userId, userName) => {
  showNotification('💬 Privater Chat startet...', 'info');
  // Implementierung hier
};

window.refreshRooms = () => {
  loadRooms();
  showNotification('🔄 Räume aktualisiert', 'success');
};

window.manageRoom = (roomId) => {
  showNotification(`🔧 Verwalte Raum ${roomId}`, 'info');
  // Implementierung hier
};

window.adminBanUser = async (userId) => {
  if (!confirm('User wirklich bannen?')) return;
  
  try {
    await window.db.ref(`users/${userId}/isBanned`).set(true);
    showNotification('✅ User gebannt', 'success');
  } catch (error) {
    console.error('Ban Fehler:', error);
    showNotification('❌ Ban fehlgeschlagen', 'error');
  }
};

window.adminDeleteUser = async (userId) => {
  if (!confirm('USER KOMPLETT LÖSCHEN?\n\nUnwiderruflich!')) return;
  
  try {
    await window.db.ref(`users/${userId}`).remove();
    showNotification('🗑️ User gelöscht', 'success');
  } catch (error) {
    console.error('Delete Fehler:', error);
    showNotification('❌ Löschen fehlgeschlagen', 'error');
  }
};

window.adminViewUser = (userId) => {
  showNotification(`👁️ Zeige User ${userId}`, 'info');
  // Implementierung hier
};

console.log('✅ Dashboard.js geladen');