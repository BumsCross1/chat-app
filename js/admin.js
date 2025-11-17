// js/admin.js
let usersRef = null;
let chatsRef = null;
let messagesRef = null;

function onUserReady(user) {
  // Nur Admin zulassen (einfacher Check: Email)
  if (user.email !== 'martinherklotzt02@gmail.com') {
    console.warn('Kein Admin, Weiterleitung zu Dashboard');
    window.location.href = 'dashboard.html';
    return;
  }

  const db = firebase.database();
  usersRef = db.ref('users');
  chatsRef = db.ref('chats');
  messagesRef = db.ref('messages');

  // Users live
  usersRef.on('value', snap => {
    const val = snap.val() || {};
    document.getElementById('totalUsers').textContent = Object.keys(val).length;
    renderUsersTable(val);
  });

  // Chats live
  chatsRef.on('value', snap => {
    const val = snap.val() || {};
    document.getElementById('totalChats').textContent = Object.keys(val).length;
    renderChatsTable(val);
  });

  // Messages count live
  messagesRef.on('value', snap => {
    const val = snap.val() || {};
    // messages: object per chat -> count all children
    let cnt = 0;
    Object.values(val).forEach(chatMsgs => {
      if (chatMsgs && typeof chatMsgs === 'object') cnt += Object.keys(chatMsgs).length;
    });
    document.getElementById('totalMessages').textContent = cnt;
  });

  // Simple online now (users with lastSeen within 60s)
  usersRef.on('value', snap => {
    const val = snap.val() || {};
    const now = Date.now();
    let online = 0;
    Object.values(val).forEach(u => {
      if (!u) return;
      if (u.lastSeen && (now - u.lastSeen) < 60_000) online++;
    });
    document.getElementById('onlineNow').textContent = online;
  });
}

function cleanupAdminListeners() {
  if (usersRef) usersRef.off();
  if (chatsRef) chatsRef.off();
  if (messagesRef) messagesRef.off();
}

// Renderers
function renderUsersTable(usersObj) {
  const tbody = document.getElementById('usersTable');
  tbody.innerHTML = '';
  Object.entries(usersObj || {}).forEach(([uid, u]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <img src="${u.photoURL || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.displayName||'User')}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">
          <div>
            <div style="font-weight:600">${u.displayName||u.email||'User'}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">${u.email||''}</div>
          </div>
        </div>
      </td>
      <td><span class="status-badge ${u.online ? 'status-online' : 'status-offline'}">${u.online ? 'Online' : 'Offline'}</span></td>
      <td>${u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openUserModal('${uid}')">Details</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser('${uid}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderChatsTable(chatsObj) {
  const tbody = document.getElementById('chatsTable');
  tbody.innerHTML = '';
  Object.entries(chatsObj || {}).forEach(([chatId, c]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name || chatId}</td>
      <td>${c.members ? Object.keys(c.members).length : 0}</td>
      <td>${c.createdBy || '-'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openChat(${JSON.stringify(chatId)})">Öffnen</button>
        <button class="btn btn-danger btn-sm" onclick="removeChat('${chatId}')">Löschen</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Modal / Actions
function openUserModal(uid) {
  const db = firebase.database();
  db.ref(`users/${uid}`).once('value').then(snap => {
    const u = snap.val() || {};
    const c = document.getElementById('userModalContent');
    c.innerHTML = `
      <div>
        <img src="${u.photoURL || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.displayName||'User')}" style="width:120px;height:120px;border-radius:12px;object-fit:cover">
        <h3 style="margin-top:1rem">${u.displayName||u.email||'User'}</h3>
        <p style="color:var(--text-secondary)">${u.email||''}</p>
        <pre style="background:rgba(255,255,255,0.02);padding:1rem;border-radius:8px;margin-top:1rem">${JSON.stringify(u, null, 2)}</pre>
      </div>
    `;
    document.getElementById('userModal').style.display = 'flex';
  });
}

function closeUserModal() {
  document.getElementById('userModal').style.display = 'none';
}

function deleteUser(uid) {
  if (!confirm('Benutzer wirklich löschen?')) return;
  firebase.database().ref(`users/${uid}`).remove()
    .then(() => alert('Benutzer gelöscht'))
    .catch(e => alert('Fehler: '+e.message));
}

function openChat(chatId) {
  window.location.href = `chat.html?chat=${encodeURIComponent(chatId)}`;
}

function removeChat(chatId) {
  if (!confirm('Chat wirklich löschen?')) return;
  firebase.database().ref(`chats/${chatId}`).remove()
    .then(() => alert('Chat gelöscht'))
    .catch(e => alert('Fehler: '+e.message));
}

// Quick admin actions
function clearLogs() {
  const ref = firebase.database().ref('systemLogs');
  ref.remove().then(() => alert('Logs gelöscht'));
}

function exportUsers() {
  firebase.database().ref('users').once('value').then(snap => {
    const users = snap.val() || {};
    const csv = Object.values(users).map(u => `${u.uid||''},${u.email||''},${u.displayName||''}`).join('\n');
    // einfache Download-Möglichkeit via Blob
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}
