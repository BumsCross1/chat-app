
// Beispiel für seiten-spezifische Initialisierung
function initDashboardForUser(user) {
  // deine bestehende onUserReady Logik hierher verschieben
  if (!user) {
    console.warn('initDashboardForUser: kein user');
    return;
  }
  // real initialization...
  // z.B. document.getElementById('userName').textContent = user.displayName || user.email;
  onUserReady && typeof onUserReady === 'function' && onUserReady(user); // optional backward-compat
}

// wenn Event bereits gesendet wurde, nutze window.__currentUser
if (window.__currentUser) {
  initDashboardForUser(window.__currentUser);
}
// Registriere Listener (fängt künftige Events)
document.addEventListener('firebaseUserChanged', e => {
  initDashboardForUser(e.detail.user);
});

// js/dashboard.js
let chatsRefDashboard = null;

function onUserReady(user) {
  document.getElementById('userName').textContent = user.displayName || user.email || 'Benutzer';
  document.getElementById('userAvatar').src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||'User')}&background=64d2ff&color=071020`;

  const db = firebase.database();
  chatsRefDashboard = db.ref('chats');

  chatsRefDashboard.on('value', snap => {
    const val = snap.val() || {};
    renderChatsList(val);
  });

  // show online count
  db.ref('users').on('value', snap => {
    const val = snap.val() || {};
    const now = Date.now();
    let online = 0;
    Object.values(val).forEach(u => { if (u.lastSeen && (now - u.lastSeen) < 60_000) online++; });
    document.getElementById('onlineCount').textContent = online;
  });

  // create chat form
  const form = document.getElementById('createChatForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('chatName').value.trim();
      const password = document.getElementById('chatPassword').value;
      if (!name) return alert('Bitte Chatnamen eingeben');
      createChat(name, password);
    });
  }
}

function renderChatsList(chatsObj) {
  const container = document.getElementById('chatsList');
  container.innerHTML = '';
  if (!chatsObj || Object.keys(chatsObj).length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">💬</div>
        <h3 style="color: var(--text-secondary);">Noch keine Chats</h3>
        <p>Erstelle deinen ersten Chatraum und lade Freunde ein!</p>
      </div>
    `;
    return;
  }

  Object.entries(chatsObj).forEach(([id, c]) => {
    const card = document.createElement('div');
    card.className = 'chat-card';
    card.innerHTML = `
      <h3>${c.name || 'Chat'}</h3>
      <p style="color:var(--text-secondary)">Mitglieder: ${c.members ? Object.keys(c.members).length : 0}</p>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="joinChat('${id}')">Beitreten</button>
        <button class="btn btn-primary" onclick="openChatDirect('${id}')">Öffnen</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function createChat(name, password) {
  const db = firebase.database();
  const newRef = db.ref('chats').push();
  const chatData = {
    name,
    createdBy: window.__currentUser.uid,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    members: { [window.__currentUser.uid]: { uid: window.__currentUser.uid, email: window.__currentUser.email, joinedAt: firebase.database.ServerValue.TIMESTAMP } }
  };
  if (password) chatData.password = password; // einfache Handhabung - für produktiv: Hashing
  newRef.set(chatData).then(() => {
    closeCreateChatModal();
    window.location.href = `chat.html?chat=${encodeURIComponent(newRef.key)}`;
  }).catch(e => alert('Fehler beim Erstellen: ' + e.message));
}

function joinChat(id) {
  // Für öffentlichen Chat genügt redirect - member wird in chat.js gesetzt
  window.location.href = `chat.html?chat=${encodeURIComponent(id)}`;
}

function openChatDirect(id) {
  window.location.href = `chat.html?chat=${encodeURIComponent(id)}`;
}

// Modal helpers
function showCreateChatModal() { document.getElementById('createChatModal').style.display = 'flex'; }
function closeCreateChatModal() { document.getElementById('createChatModal').style.display = 'none'; }

function cleanupDashboardListeners() {
  if (chatsRefDashboard) chatsRefDashboard.off();
}
