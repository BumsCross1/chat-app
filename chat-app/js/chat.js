// js/chat.js
let chatRef = null;
let messagesRef = null;
let membersRef = null;
let currentChatId = null;

function onUserReady(user) {
  // chat id aus querystring lesen
  const params = new URLSearchParams(location.search);
  currentChatId = params.get('chat');
  if (!currentChatId) {
    console.warn('Keine chat id in URL');
    return;
  }

  const db = firebase.database();
  chatRef = db.ref(`chats/${currentChatId}`);
  messagesRef = db.ref(`messages/${currentChatId}`);
  membersRef = chatRef.child('members');

  // Chat meta
  chatRef.on('value', snap => {
    const data = snap.val();
    if (!data) {
      document.getElementById('chatName').textContent = 'Unbekannter Chat';
      return;
    }
    document.getElementById('chatName').textContent = data.name || 'Chat';
    document.getElementById('chatInfo').textContent = `Mitglieder: ${data.members ? Object.keys(data.members).length : 0}`;
    renderMembers(data.members || {});
  });

  // Messages
  messagesRef.limitToLast(200).on('child_added', snap => {
    appendMessageToDOM(snap.key, snap.val());
  });

  // Add user as member
  membersRef.child(user.uid).set({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    joinedAt: firebase.database.ServerValue.TIMESTAMP
  });

  // markiere user online in users root (optional)
  firebase.database().ref(`users/${user.uid}`).update({
    displayName: user.displayName || '',
    email: user.email,
    lastSeen: Date.now(),
    online: true
  });

  // setup send button
  const sendBtn = document.getElementById('sendButton');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  const msgInput = document.getElementById('messageInput');
  if (msgInput) {
    msgInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') sendMessage();
    });
  }
}

function appendMessageToDOM(id, msg) {
  const messages = document.getElementById('messages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = 'message' + ((msg.uid && window.__currentUser && msg.uid === window.__currentUser.uid) ? ' own' : '');
  div.innerHTML = `
    <div class="message-header">
      <div class="message-user">${msg.displayName || msg.email || 'User'}</div>
      <div class="message-time">${msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''}</div>
    </div>
    <div class="message-text">${escapeHtml(msg.text || '')}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  if (!messagesRef || !window.__currentUser) return alert('Nicht verbunden oder nicht eingeloggt');

  messagesRef.push({
    uid: window.__currentUser.uid,
    displayName: window.__currentUser.displayName || window.__currentUser.email || 'User',
    text,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  }).then(() => {
    input.value = '';
  }).catch(e => {
    console.error('message push error', e);
    alert('Nachricht konnte nicht gesendet werden');
  });
}

function renderMembers(membersObj) {
  const container = document.getElementById('userList');
  if (!container) return;
  container.innerHTML = '';
  Object.values(membersObj || {}).forEach(m => {
    const el = document.createElement('div');
    el.className = 'user-item';
    el.innerHTML = `
      <div style="width:10px;height:10px;border-radius:50%;background:${m.online ? 'var(--success)' : 'var(--text-muted)'};margin-right:0.75rem"></div>
      <div class="user-name">${m.displayName || m.email || 'User'}</div>
    `;
    container.appendChild(el);
  });
}

function cleanupChatListeners() {
  if (chatRef) chatRef.off();
  if (messagesRef) messagesRef.off();
  if (membersRef) membersRef.off();
  // mark user offline timestamp
  if (window.__currentUser) {
    firebase.database().ref(`users/${window.__currentUser.uid}`).update({
      lastSeen: Date.now(),
      online: false
    }).catch(()=>{});
  }
}

// small helper to escape HTML in messages
function escapeHtml(str) {
  return str.replace(/[&<>"'`]/g, s => {
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#x60;'};
    return map[s] || s;
  });
}
