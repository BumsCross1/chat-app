// ULTIMATIVE CHAT.JS - COMPLETELY FIXED VERSION
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtnChat = document.getElementById('logout-btn');
const roomNameH2 = document.getElementById('room-name');

// Global Variables
let currentUserAvatar = null;
let selectedImage = null;
let selectedFile = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isSending = false;
let currentRoomData = null;
let userTypingTimeout = null;
let chatInitialized = false;

// Enhanced Emoji Categories
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    nature: ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓', '🦌', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽'],
    food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷'],
    objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🪛', '🧰'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️'],
    flags: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇩🇪', '🇺🇸', '🇬🇧', '🇫🇷', '🇮🇹', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇧🇷', '🇷🇺', '🇨🇦', '🇦🇺', '🇪🇸', '🇵🇹', '🇳🇱', '🇨🇭', '🇸🇪']
};

// Reaction System
const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '🤔', '👀', '🙏', '💩'];

// ===== ENHANCED INPUT HANDLING =====
function enhanceChatInput() {
    if (!msgInput) {
        console.error('❌ Chat Input nicht gefunden');
        return;
    }

    // Enhanced Avatar Persistence
async function saveUserAvatar(avatarData) {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        await db.ref(`users/${user.uid}/avatar`).set(avatarData);
        currentUserAvatar = avatarData;
        console.log('✅ Avatar gespeichert:', avatarData.substring(0, 50) + '...');
    } catch (error) {
        console.error('❌ Fehler beim Speichern des Avatars:', error);
    }
}

// Avatar aus Dashboard übernehmen
function syncAvatarFromDashboard() {
    const user = auth.currentUser;
    if (!user) return;
    
    db.ref(`users/${user.uid}/avatar`).on('value', (snapshot) => {
        const avatarData = snapshot.val();
        if (avatarData && avatarData !== 'null' && avatarData !== '') {
            currentUserAvatar = avatarData;
            updateUserAvatarInUI();
            console.log('✅ Avatar synchronisiert');
        }
    });
}
    // Auto-resize input
    msgInput.addEventListener('input', function() {
        // Zeige Zeichenanzahl an
        const charCount = this.value.length;
        const maxLength = 1000;
        
        if (charCount > maxLength * 0.8) {
            this.style.borderColor = 'var(--warning)';
        } else {
            this.style.borderColor = '';
        }
        
        // Update placeholder basierend auf Inhalt
        if (this.value.length > 0) {
            this.setAttribute('data-has-content', 'true');
        } else {
            this.removeAttribute('data-has-content');
        }
    });

    // Enter zum Senden, Shift+Enter für neue Zeile
    msgInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Paste handling für Bilder
    msgInput.addEventListener('paste', function(e) {
        const items = e.clipboardData?.items;
        if (items) {
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        selectedImage = file;
                        sendImage();
                    }
                    break;
                }
            }
        }
    });

    // Drag and drop für Dateien
    msgInput.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderColor = 'var(--primary)';
        this.style.background = 'rgba(99, 102, 241, 0.1)';
    });

    msgInput.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.style.borderColor = '';
        this.style.background = '';
    });

    msgInput.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = '';
        this.style.background = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                selectedImage = file;
                sendImage();
            } else {
                selectedFile = file;
                openFileModal();
            }
        }
    });
}

// Enhanced Theme System
function initTheme() {
    const savedTheme = localStorage.getItem('chat-theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('chat-theme', theme);
    
    // Update theme icon
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
    
    // Update button text if exists
    const themeButtons = document.querySelectorAll('.dropdown-action[onclick*="toggleTheme"]');
    themeButtons.forEach(btn => {
        const textSpan = btn.querySelector('span');
        if (textSpan) {
            textSpan.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    });
    
    console.log('✅ Theme geändert zu:', theme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showNotification(`Theme zu ${newTheme === 'light' ? '☀️ Light' : '🌙 Dark'} geändert`, 'success');
}

// In der initChat() Funktion hinzufügen:
async function initChat() {
    if (chatInitialized) return;
    chatInitialized = true;

    // Theme initialisieren
    initTheme();
    
    // Rest der Initialisierung...
}

// Enhanced Send Button UI
function enhanceSendButton() {
    if (!sendBtn) return;

    const btnText = sendBtn.querySelector('.btn-text');
    const btnLoading = sendBtn.querySelector('.btn-loading');

    if (!btnText || !btnLoading) {
        console.error('❌ Button Elemente nicht gefunden');
        return;
    }

    // Update Button Text basierend auf Input
    msgInput?.addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            btnText.textContent = '🚀 Senden';
            sendBtn.disabled = false;
        } else {
            btnText.textContent = '💬 Schreiben...';
            sendBtn.disabled = true;
        }
    });

    // Loading State
    window.showSendLoading = function(show) {
        if (show) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            sendBtn.disabled = true;
        } else {
            btnText.style.display = 'flex';
            btnLoading.style.display = 'none';
            sendBtn.disabled = msgInput.value.trim().length === 0;
        }
    };
}

// Enhanced Chat Initialization
async function initChat() {
    if (chatInitialized) {
        console.log('🚫 Chat bereits initialisiert - skip');
        return;
    }
    chatInitialized = true;

    const roomId = localStorage.getItem('roomId');
    const roomName = localStorage.getItem('roomName');
    
    console.log('🚀 Initialisiere Chat...', { roomId, roomName });

    if (!roomId || !roomName) {
        console.error('❌ Raum nicht gefunden im localStorage:', { roomId, roomName });
        showNotification('❌ Raum nicht gefunden! Zurück zum Dashboard.', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 3000);
        return;
    }

    try {
        roomNameH2.textContent = roomName;
        
        await loadCurrentUserAvatar();
        setupEventListeners();
        
        // ENHANCED: Input Handling verbessern
        enhanceChatInput();
        enhanceSendButton();
        
        loadMessages();
        initDropdown();
        initEmojiPicker();
        initReactionSystem();
        initSpaceBackground();
        initTypingIndicator();
        
        requestNotificationPermission();
        showNotification(`🚀 Willkommen im Raum "${roomName}"`, 'success');
        
        // Fokus auf Input setzen
        setTimeout(() => {
            if (msgInput) {
                msgInput.focus();
                showNotification('💡 Tipp: Drücke Enter zum Senden, Shift+Enter für neue Zeile', 'info');
            }
        }, 1000);
        
        console.log('✅ Chat erfolgreich initialisiert');
        
    } catch (error) {
        console.error('❌ Fehler bei Chat-Initialisierung:', error);
        showNotification('❌ Fehler beim Laden des Chats', 'error');
    }
}

// Enhanced User Avatar Loading
async function loadCurrentUserAvatar() {
    const user = auth.currentUser;
    if (!user) {
        currentUserAvatar = generateDefaultAvatar('User');
        return;
    }

    try {
        const snapshot = await db.ref(`users/${user.uid}/avatar`).once('value');
        const avatarUrl = snapshot.val();
        
        if (avatarUrl && avatarUrl !== '') {
            currentUserAvatar = avatarUrl;
        } else {
            const displayName = user.displayName || user.email || 'User';
            currentUserAvatar = generateDefaultAvatar(displayName);
        }
    } catch (error) {
        console.error('Fehler beim Laden des Avatars:', error);
        const displayName = user.displayName || user.email || 'User';
        currentUserAvatar = generateDefaultAvatar(displayName);
    }
    
    updateUserAvatarInUI();
}

function updateUserAvatarInUI() {
    const ownMessages = document.querySelectorAll('.message.own .message-avatar');
    ownMessages.forEach(avatar => {
        if (avatar.src !== currentUserAvatar) {
            avatar.src = currentUserAvatar;
        }
    });
}

// Enhanced Message Display
function displayMessage(message) {
    const existingMessage = document.getElementById(`message-${message.id}`);
    if (existingMessage) {
        updateMessageReactions(message);
        return;
    }

    const messageDiv = document.createElement('div');
    const isOwnMessage = message.user.uid === auth.currentUser.uid;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    messageDiv.id = `message-${message.id}`;

    const timestamp = new Date(message.createdAt);
    const timeString = timestamp.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const avatarSrc = isOwnMessage ? 
        currentUserAvatar : 
        (message.user.avatar || generateDefaultAvatar(message.user.displayName));

    let messageContent = '';
    
    switch(message.type) {
        case 'image':
            messageContent = `
                <div class="message-image">
                    <img src="${message.imageUrl}" alt="Gesendetes Bild" class="sent-image" 
                         onclick="openImageModal('${message.imageUrl}')">
                    ${message.text ? `<div class="image-caption">${formatMessageText(message.text)}</div>` : ''}
                </div>
            `;
            break;
            
        case 'voice':
            messageContent = `
                <div class="voice-message">
                    <button class="play-voice-btn" onclick="playVoiceMessage('${message.audioUrl}', this)">
                        🎤 Sprachnachricht (${message.duration || 0}s)
                    </button>
                </div>
            `;
            break;
            
        case 'file':
            messageContent = `
                <div class="file-message">
                    <a href="${message.fileUrl}" download="${message.fileName}" class="file-download">
                        📎 ${escapeHtml(message.fileName)} (${formatFileSize(message.fileSize)})
                    </a>
                </div>
            `;
            break;
            
        case 'game':
            messageContent = `<div class="game-message">🎮 ${formatMessageText(message.text)}</div>`;
            break;
            
        case 'system':
            messageContent = `<div class="system-message">🔔 ${formatMessageText(message.text)}</div>`;
            break;
            
        default:
            messageContent = `<div class="message-text">${formatMessageText(message.text)}</div>`;
    }

    // Reactions anzeigen
    let reactionsHTML = '';
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        reactionsHTML = `
            <div class="message-reactions">
                ${Object.entries(message.reactions).map(([emoji, users]) => `
                    <span class="message-reaction" onclick="addReaction('${message.id}', '${emoji}')" 
                          title="${Object.values(users).map(u => u.user).join(', ')}">
                        ${emoji} ${Object.keys(users).length}
                    </span>
                `).join('')}
            </div>
        `;
    }

    const messageHTML = `
        <img src="${avatarSrc}" 
             alt="Avatar" class="message-avatar"
             onerror="this.src='${generateDefaultAvatar(message.user.displayName)}'"
             onclick="showUserProfile('${message.user.uid}')">
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender" onclick="showUserProfile('${message.user.uid}')">
                    ${escapeHtml(message.user.displayName)}
                </span>
                <span class="message-time">${timeString}</span>
            </div>
            ${messageContent}
            ${reactionsHTML}
        </div>
    `;

    messageDiv.innerHTML = messageHTML;
    messagesDiv.appendChild(messageDiv);

    // Animation
    const messages = messagesDiv.children;
    const index = Array.from(messages).indexOf(messageDiv);
    const delay = Math.min(index * 50, 300);
    
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }, delay);

    // Auto-Scroll nur wenn unten
    if (isNearBottom()) {
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);
    }

    // Moderation Actions hinzufügen
    addModerationActions(messageDiv, message, isOwnMessage);
}

function updateMessageReactions(message) {
    const messageElement = document.getElementById(`message-${message.id}`);
    if (!messageElement) return;

    const reactionsContainer = messageElement.querySelector('.message-reactions');
    if (!reactionsContainer) return;

    reactionsContainer.innerHTML = '';

    if (message.reactions && Object.keys(message.reactions).length > 0) {
        Object.entries(message.reactions).forEach(([emoji, users]) => {
            const reactionElement = document.createElement('span');
            reactionElement.className = 'message-reaction';
            reactionElement.innerHTML = `${emoji} ${Object.keys(users).length}`;
            reactionElement.onclick = () => addReaction(message.id, emoji);
            reactionElement.title = Object.values(users).map(u => u.user).join(', ');
            reactionsContainer.appendChild(reactionElement);
        });
    }
}

// Enhanced Message Loading
function loadMessages() {
    const roomId = localStorage.getItem('roomId');
    console.log('📥 Lade Nachrichten für Raum:', roomId);
    
    db.ref(`messages/${roomId}`).on('value', (snap) => {
        const data = snap.val() || {};
        console.log('📨 Empfangene Nachrichten:', Object.keys(data).length);
        
        const messages = Object.entries(data)
            .map(([key, message]) => ({
                id: key,
                ...message
            }))
            .sort((a, b) => a.createdAt - b.createdAt);

        let hasNewMessages = false;
        
        messages.forEach(message => {
            if (!document.getElementById(`message-${message.id}`)) {
                displayMessage(message);
                hasNewMessages = true;
                
                if (!isOwnMessage(message) && document.hidden) {
                    showPushNotification(message);
                }
            } else {
                updateMessageReactions(message);
            }
        });

        if (hasNewMessages && isNearBottom()) {
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 100);
        }
    }, (error) => {
        console.error('❌ Fehler beim Laden der Nachrichten:', error);
        showNotification('❌ Fehler beim Laden der Nachrichten', 'error');
    });
}

function isOwnMessage(message) {
    return message.user.uid === auth.currentUser.uid;
}

function isNearBottom() {
    const threshold = 100;
    return messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - threshold;
}

// Enhanced Message Sending with better UI
async function sendMessage() {
    if (isSending) return;
    
    const text = msgInput?.value.trim();
    if (!text) {
        showNotification('❌ Bitte gib eine Nachricht ein', 'error');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        showNotification('❌ Nicht eingeloggt', 'error');
        return;
    }

    isSending = true;
    
    // UI sperren mit besserem Feedback
    if (msgInput) {
        msgInput.disabled = true;
        msgInput.style.opacity = '0.7';
    }
    
    if (sendBtn) {
        sendBtn.classList.add('sending');
        if (window.showSendLoading) {
            window.showSendLoading(true);
        }
    }

    try {
        const roomId = localStorage.getItem('roomId');
        const messageData = {
            text: text,
            user: getUserData(),
            createdAt: Date.now(),
            type: 'text'
        };

        console.log('📤 Sende Nachricht:', messageData);
        await db.ref(`messages/${roomId}`).push().set(messageData);
        
        // Erfolgreich gesendet - UI zurücksetzen
        if (msgInput) {
            msgInput.value = '';
            msgInput.style.opacity = '1';
        }
        
        // User Stats aktualisieren
        await db.ref(`users/${user.uid}/messageCount`).transaction((current) => (current || 0) + 1);
        
        // Typing Status zurücksetzen
        updateUserStatus(true, false);

        // Erfolgs-Animation
        if (sendBtn) {
            sendBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                sendBtn.style.transform = '';
            }, 150);
        }

        showNotification('✅ Nachricht gesendet', 'success');

    } catch (error) {
        console.error('❌ Nachricht senden fehlgeschlagen:', error);
        showNotification('❌ Fehler beim Senden: ' + error.message, 'error');
        
        // Fehler-Animation
        if (sendBtn) {
            sendBtn.style.animation = 'shake 0.5s ease';
            setTimeout(() => {
                sendBtn.style.animation = '';
            }, 500);
        }
    } finally {
        // UI wieder freigeben
        isSending = false;
        
        if (msgInput) {
            msgInput.disabled = false;
            msgInput.style.opacity = '1';
            setTimeout(() => msgInput?.focus(), 100);
        }
        
        if (sendBtn) {
            sendBtn.classList.remove('sending');
            if (window.showSendLoading) {
                window.showSendLoading(false);
            }
        }
    }
}

// Enhanced Reaction System
function initReactionSystem() {
    document.addEventListener('contextmenu', function(e) {
        const messageElement = e.target.closest('.message');
        if (messageElement) {
            e.preventDefault();
            const messageId = messageElement.id.replace('message-', '');
            showReactionMenu(e.clientX, e.clientY, messageId);
        }
    });

    // Mobile Touch Support
    document.addEventListener('touchstart', function(e) {
        const messageElement = e.target.closest('.message');
        if (messageElement && e.touches.length === 1) {
            const touch = e.touches[0];
            const messageId = messageElement.id.replace('message-', '');
            
            // Long press detection
            const timer = setTimeout(() => {
                showReactionMenu(touch.clientX, touch.clientY, messageId);
            }, 500);
            
            const cancelTouch = () => {
                clearTimeout(timer);
                document.removeEventListener('touchmove', cancelTouch);
                document.removeEventListener('touchend', cancelTouch);
            };
            
            document.addEventListener('touchmove', cancelTouch);
            document.addEventListener('touchend', cancelTouch);
        }
    });
}

function showReactionMenu(x, y, messageId) {
    // Altes Menu entfernen
    const oldMenu = document.querySelector('.reaction-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'reaction-menu';
    menu.style.left = (x - 100) + 'px';
    menu.style.top = (y - 50) + 'px';
    
    availableReactions.forEach(reaction => {
        const btn = document.createElement('button');
        btn.className = 'reaction-option';
        btn.textContent = reaction;
        btn.onclick = () => {
            addReaction(messageId, reaction);
            menu.remove();
        };
        menu.appendChild(btn);
    });
    
    document.body.appendChild(menu);

    // Menu schließen bei Klick außerhalb
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);

    // Auto-close nach 5 Sekunden
    setTimeout(() => menu.remove(), 5000);
}

async function addReaction(messageId, reaction) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const roomId = localStorage.getItem('roomId');
        const reactionRef = db.ref(`messages/${roomId}/${messageId}/reactions/${reaction}/${user.uid}`);
        const snapshot = await reactionRef.once('value');
        
        if (snapshot.exists()) {
            // Reaction entfernen wenn bereits vorhanden
            await reactionRef.remove();
        } else {
            // Reaction hinzufügen
            await reactionRef.set({
                user: user.displayName || user.email,
                timestamp: Date.now()
            });
        }
        
    } catch (error) {
        console.error('Fehler beim Hinzufügen der Reaction:', error);
        showNotification('❌ Fehler beim Hinzufügen der Reaction', 'error');
    }
}

// Enhanced Moderation System
async function addModerationActions(messageElement, message, isOwnMessage) {
    const rights = await checkModerationRights();
    if (!rights) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    
    actionsDiv.innerHTML = `
        <button class="message-action-btn" onclick="deleteMessage('${message.id}')" title="Nachricht löschen">🗑️</button>
        <button class="message-action-btn" onclick="pinMessage('${message.id}')" title="Nachricht anpinnen">📌</button>
        ${rights === 'owner' && !isOwnMessage ? `
            <button class="message-action-btn" onclick="toggleUserRole('${message.user.uid}')" title="User Rolle ändern">👑</button>
        ` : ''}
    `;

    messageElement.querySelector('.message-content').appendChild(actionsDiv);
}

async function checkModerationRights() {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const roomId = localStorage.getItem('roomId');
        const roomSnapshot = await db.ref(`rooms/${roomId}`).once('value');
        currentRoomData = roomSnapshot.val();
        
        if (currentRoomData) {
            // Room Ersteller hat immer Rechte
            if (currentRoomData.ownerId === user.uid) {
                return 'owner';
            }
            
            // Moderator Check
            const modSnapshot = await db.ref(`roomModerators/${roomId}/${user.uid}`).once('value');
            if (modSnapshot.exists()) {
                return 'moderator';
            }
        }
        return false;
    } catch (error) {
        console.error('Fehler beim Prüfen der Moderation-Rechte:', error);
        return false;
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Möchtest du diese Nachricht wirklich löschen?')) return;
    
    try {
        const roomId = localStorage.getItem('roomId');
        await db.ref(`messages/${roomId}/${messageId}`).remove();
        showNotification('✅ Nachricht gelöscht', 'success');
    } catch (error) {
        console.error('Fehler beim Löschen der Nachricht:', error);
        showNotification('❌ Fehler beim Löschen', 'error');
    }
}

async function pinMessage(messageId) {
    try {
        const roomId = localStorage.getItem('roomId');
        const messageSnapshot = await db.ref(`messages/${roomId}/${messageId}`).once('value');
        const message = messageSnapshot.val();
        
        if (message) {
            const pinnedMessageDiv = document.getElementById('pinned-message');
            const pinnedText = document.getElementById('pinned-text');
            
            pinnedText.textContent = `${message.user.displayName}: ${message.text}`;
            pinnedMessageDiv.classList.remove('hidden');
            
            showNotification('📌 Nachricht angepinnt', 'success');
        }
    } catch (error) {
        console.error('Fehler beim Anpinnen der Nachricht:', error);
        showNotification('❌ Fehler beim Anpinnen', 'error');
    }
}

function unpinMessage() {
    document.getElementById('pinned-message').classList.add('hidden');
}

async function toggleUserRole(userId) {
    const rights = await checkModerationRights();
    if (rights !== 'owner') return;
    
    try {
        const roomId = localStorage.getItem('roomId');
        const modRef = db.ref(`roomModerators/${roomId}/${userId}`);
        const snapshot = await modRef.once('value');
        
        if (snapshot.exists()) {
            await modRef.remove();
            showNotification('🔧 Moderator-Rechte entfernt', 'success');
        } else {
            await modRef.set({
                appointedBy: auth.currentUser.uid,
                appointedAt: Date.now()
            });
            showNotification('👑 User zum Moderator ernannt', 'success');
        }
    } catch (error) {
        console.error('Fehler beim Ändern der User-Rolle:', error);
        showNotification('❌ Fehler beim Ändern der Rolle', 'error');
    }
}

// Enhanced Dropdown System
function initDropdown() {
    const chatHeaderActions = document.querySelector('.chat-header-actions');
    if (!chatHeaderActions) {
        console.error('❌ Chat header actions nicht gefunden');
        return;
    }

    // Entferne alte Buttons
    const oldButtons = chatHeaderActions.querySelectorAll('.chat-header-btn:not(.logout)');
    oldButtons.forEach(btn => btn.remove());
    
    const dropdownHTML = `
        <div class="chat-actions-dropdown">
            <button class="dropdown-btn">
                <span>⚡ Aktionen</span>
                <span>▼</span>
            </button>
            <div class="dropdown-content">
                <button class="dropdown-action" onclick="toggleTheme()">🌙 Theme</button>
                <button class="dropdown-action" onclick="toggleGamesMenu()">🎮 Spiele</button>
                <button class="dropdown-action" onclick="toggleVoiceRecording()">🎤 Voice</button>
                <button class="dropdown-action" onclick="toggleEmojiPicker()">😊 Emoji</button>
                <button class="dropdown-action" onclick="openImageUpload()">🖼️ Bild</button>
                <button class="dropdown-action" onclick="openFileModal()">📎 Datei</button>
                <button class="dropdown-action" onclick="showRoomManagement()">🔧 Raum</button>
                <button class="dropdown-action" onclick="exportChat()">📤 Export</button>
            </div>
        </div>
    `;
    
    // Füge Dropdown hinzu
    chatHeaderActions.insertAdjacentHTML('afterbegin', dropdownHTML);
    
    // Dropdown Toggle
    const dropdownBtn = document.querySelector('.dropdown-btn');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });
        
        // Schließe Dropdown wenn außerhalb geklickt wird
        document.addEventListener('click', () => {
            dropdownContent.classList.remove('show');
        });
    }
}

// Enhanced Games System
function playGame(game, choice = null) {
    const user = auth.currentUser;
    let result = '';

    switch(game) {
        case 'dice':
            const roll = Math.floor(Math.random() * 6) + 1;
            result = `🎲 ${user.displayName} würfelt eine ${roll}!`;
            break;
            
        case 'coin':
            const coinResult = Math.random() > 0.5 ? 'Kopf' : 'Zahl';
            result = `🪙 ${user.displayName} wirft ${coinResult}!`;
            break;
            
        case 'rps':
            const choices = ['✊', '✋', '✌️'];
            const botChoice = choices[Math.floor(Math.random() * 3)];
            let outcome = 'Unentschieden! 🤝';
            
            if ((choice === '✊' && botChoice === '✌️') ||
                (choice === '✋' && botChoice === '✊') ||
                (choice === '✌️' && botChoice === '✋')) {
                outcome = 'Gewonnen! 🏆';
            } else if (choice !== botChoice) {
                outcome = 'Verloren! 😢';
            }
            
            result = `🎮 ${user.displayName}: ${choice} vs Bot: ${botChoice} - ${outcome}`;
            break;

        case 'quiz':
            const questions = [
                { q: "Wie viele Planeten hat unser Sonnensystem?", a: "8" },
                { q: "Welches ist der größte Planet?", a: "Jupiter" }
            ];
            const randomQ = questions[Math.floor(Math.random() * questions.length)];
            result = `🧠 ${user.displayName} startet ein Quiz: ${randomQ.q}`;
            break;
    }

    const roomId = localStorage.getItem('roomId');
    const messageData = {
        text: result,
        user: getUserData(),
        createdAt: Date.now(),
        type: 'game'
    };

    db.ref(`messages/${roomId}`).push().set(messageData);
    
    // Close game menus
    document.getElementById('games-menu').classList.add('hidden');
    document.getElementById('rps-menu').classList.add('hidden');
}

function showRpsMenu() {
    document.getElementById('rps-menu').classList.remove('hidden');
    document.getElementById('games-menu').classList.add('hidden');
}

function startQuiz() {
    playGame('quiz');
}

// Enhanced File & Image Handling
function openImageUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleImageSelect);
    document.body.appendChild(fileInput);
    fileInput.click();
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            showNotification('❌ Bitte nur Bilder auswählen!', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showNotification('❌ Bild darf nicht größer als 5MB sein!', 'error');
            return;
        }
        selectedImage = file;
        sendImage();
    }
}

async function sendImage() {
    if (!selectedImage) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
        const base64 = await fileToBase64(selectedImage);
        
        const caption = prompt('Bildunterschrift (optional):') || '';
        
        const roomId = localStorage.getItem('roomId');
        const messageData = {
            type: 'image',
            imageUrl: base64,
            text: caption,
            user: getUserData(),
            createdAt: Date.now(),
            fileName: selectedImage.name,
            fileSize: selectedImage.size
        };

        await db.ref(`messages/${roomId}`).push().set(messageData);
        showNotification('🖼️ Bild gesendet!', 'success');
        
    } catch (error) {
        console.error('Bild senden fehlgeschlagen:', error);
        showNotification('❌ Fehler beim Senden des Bildes', 'error');
    } finally {
        selectedImage = null;
    }
}

function openFileModal() {
    document.getElementById('file-modal').classList.remove('hidden');
}

function closeFileModal() {
    document.getElementById('file-modal').classList.add('hidden');
    selectedFile = null;
    document.getElementById('file-upload').value = '';
    document.getElementById('file-info').textContent = '';
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) {
            showNotification('❌ Datei zu groß! Max. 10MB', 'error');
            return;
        }
        selectedFile = file;
        document.getElementById('file-info').textContent = 
            `📄 ${file.name} (${formatFileSize(file.size)})`;
    }
}

async function sendFile() {
    if (!selectedFile) {
        showNotification('❌ Bitte wähle zuerst eine Datei aus!', 'error');
        return;
    }

    try {
        const base64 = await fileToBase64(selectedFile);
        
        const roomId = localStorage.getItem('roomId');
        const messageData = {
            type: 'file',
            fileUrl: base64,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            user: getUserData(),
            createdAt: Date.now()
        };

        await db.ref(`messages/${roomId}`).push().set(messageData);
        showNotification('📎 Datei gesendet!', 'success');
        closeFileModal();
        
    } catch (error) {
        console.error('Datei senden fehlgeschlagen:', error);
        showNotification('❌ Fehler beim Senden der Datei', 'error');
    }
}

// Enhanced Voice Recording
async function startVoiceRecording() {
    if (!navigator.mediaDevices) {
        showNotification('❌ Mikrofon wird nicht unterstützt', 'error');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await sendVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(100);
        isRecording = true;
        
        document.getElementById('voice-recording').classList.remove('hidden');
        showNotification('🎤 Aufnahme gestartet...', 'success');
        
    } catch (error) {
        console.error('Mikrofon Zugriff fehlgeschlagen:', error);
        showNotification('❌ Mikrofon Zugriff verweigert!', 'error');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('voice-recording').classList.add('hidden');
        showNotification('✅ Aufnahme beendet', 'success');
    }
}

async function sendVoiceMessage(audioBlob) {
    try {
        const base64 = await fileToBase64(audioBlob);
        const duration = Math.round(audioBlob.size / 16000);
        
        const roomId = localStorage.getItem('roomId');
        const messageData = {
            type: 'voice',
            audioUrl: base64,
            user: getUserData(),
            createdAt: Date.now(),
            duration: duration
        };

        await db.ref(`messages/${roomId}`).push().set(messageData);
        showNotification('🎤 Sprachnachricht gesendet!', 'success');
        
    } catch (error) {
        console.error('Sprachnachricht senden fehlgeschlagen:', error);
        showNotification('❌ Fehler beim Senden der Sprachnachricht', 'error');
    }
}

function playVoiceMessage(audioUrl, button) {
    const audio = new Audio(audioUrl);
    const originalText = button.textContent;
    
    button.textContent = '🔊 Wiedergabe...';
    button.disabled = true;
    
    audio.play().then(() => {
        button.textContent = '⏸️ Pause';
        button.disabled = false;
        
        audio.onended = () => {
            button.textContent = originalText;
            button.disabled = false;
        };
        
        button.onclick = () => {
            if (audio.paused) {
                audio.play();
                button.textContent = '⏸️ Pause';
            } else {
                audio.pause();
                button.textContent = '▶️ Fortsetzen';
            }
        };
    }).catch(error => {
        console.error('Audio playback failed:', error);
        button.textContent = '❌ Fehler';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    });
}

// Enhanced Emoji Picker
function initEmojiPicker() {
    const emojiGrid = document.getElementById('emoji-grid');
    const categoryBtns = document.querySelectorAll('.emoji-category-btn');
    
    if (!emojiGrid) {
        console.error('❌ Emoji Grid nicht gefunden');
        return;
    }
    
    // Standard-Kategorie laden
    loadEmojiCategory('smileys');
    
    // Event Listener für Kategorie-Buttons
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadEmojiCategory(btn.dataset.category);
        });
    });
}

function loadEmojiCategory(category) {
    const emojiGrid = document.getElementById('emoji-grid');
    emojiGrid.innerHTML = '';
    
    if (emojiCategories[category]) {
        emojiCategories[category].forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-btn';
            emojiBtn.textContent = emoji;
            emojiBtn.onclick = () => {
                if (msgInput) {
                    msgInput.value += emoji;
                    msgInput.focus();
                }
                document.getElementById('emoji-picker').classList.add('hidden');
            };
            emojiGrid.appendChild(emojiBtn);
        });
    }
}

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    emojiPicker.classList.toggle('hidden');
    document.getElementById('games-menu').classList.add('hidden');
}

function toggleGamesMenu() {
    const gamesMenu = document.getElementById('games-menu');
    gamesMenu.classList.toggle('hidden');
    document.getElementById('emoji-picker').classList.add('hidden');
}

function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

// Enhanced Typing Indicator
function initTypingIndicator() {
    if (!msgInput) return;
    
    let typing = false;
    
    msgInput.addEventListener('input', () => {
        if (!typing) {
            typing = true;
            updateUserStatus(false, true);
        }
        
        clearTimeout(userTypingTimeout);
        userTypingTimeout = setTimeout(() => {
            typing = false;
            updateUserStatus(false, false);
        }, 1000);
    });
}

function updateUserStatus(sentMessage = false, isTyping = false) {
    const user = auth.currentUser;
    if (!user) return;

    const roomId = localStorage.getItem('roomId');
    const typingRef = db.ref(`rooms/${roomId}/typing/${user.uid}`);
    
    if (sentMessage || !isTyping) {
        typingRef.remove();
    } else {
        typingRef.set({
            user: user.displayName,
            timestamp: Date.now()
        });
    }
}

// Raum Management
function showRoomManagement() {
    showNotification('🔧 Raum-Verwaltung wird geladen...', 'info');
}

function exportChat() {
    const messages = Array.from(document.querySelectorAll('.message'));
    const chatText = messages.map(msg => {
        const sender = msg.querySelector('.message-sender').textContent;
        const time = msg.querySelector('.message-time').textContent;
        const text = msg.querySelector('.message-text')?.textContent || 
                    msg.querySelector('.game-message')?.textContent ||
                    '[Mediennachricht]';
        return `[${time}] ${sender}: ${text}`;
    }).join('\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${localStorage.getItem('roomName')}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('📤 Chat exportiert!', 'success');
}

// Theme Toggle
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const theme = document.body.classList.contains('light-theme') ? '🌙 Dark' : '☀️ Light';
    showNotification(`Theme zu ${theme} gewechselt`, 'success');
}

// Utility Functions
function getUserData() {
    const user = auth.currentUser;
    if (!user) {
        return {
            uid: 'unknown',
            displayName: 'Unbekannter User',
            email: ''
        };
    }

    return {
        uid: user.uid,
        displayName: user.displayName || user.email,
        email: user.email,
        avatar: currentUserAvatar
    };
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function formatMessageText(text) {
    let formatted = escapeHtml(text);
    
    // URLs in Links umwandeln
    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener" class="message-link">$1</a>'
    );
    
    // Emojis vergrößern
    formatted = formatted.replace(
        /(\p{Emoji_Presentation})/gu,
        '<span class="emoji">$1</span>'
    );
    
    // Zeilenumbrüche erhalten
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function generateDefaultAvatar(name) {
    const displayName = name || 'User';
    const initial = displayName.charAt(0).toUpperCase();
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const color = colors[initial.charCodeAt(0) % colors.length];
    
    return `data:image/svg+xml;base64,${btoa(`
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="${color}"/>
            <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" 
                  fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">
                ${initial}
            </text>
        </svg>
    `)}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Enhanced Notification System
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

function showPushNotification(message) {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
        new Notification(`💬 ${localStorage.getItem('roomName')}`, {
            body: `${message.user.displayName}: ${message.text.substring(0, 50)}...`,
            icon: currentUserAvatar,
            tag: 'chat-message'
        });
    }
}

function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "default") {
        Notification.requestPermission();
    }
}

// Enhanced Space Background
function initSpaceBackground() {
    const stars = document.querySelector('.stars');
    const planets = document.querySelector('.planets');
    const asteroids = document.querySelector('.asteroids');
    const comets = document.querySelector('.comets');
    
    if (!stars) return;
    
    // Create enhanced stars
    for (let i = 0; i < 180; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        const size = Math.random() * 3 + 1;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const duration = Math.random() * 4 + 2;
        const delay = Math.random() * 5;
        
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${posX}%`;
        star.style.top = `${posY}%`;
        star.style.animationDelay = `${delay}s`;
        star.style.animationDuration = `${duration}s`;
        
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
    for (let i = 0; i < 12; i++) {
        const asteroid = document.createElement('div');
        asteroid.className = 'asteroid';
        
        const size = Math.random() * 4 + 2;
        const posY = Math.random() * 100;
        const duration = Math.random() * 10 + 15;
        const delay = Math.random() * 20;
        
        asteroid.style.width = `${size}px`;
        asteroid.style.height = `${size}px`;
        asteroid.style.top = `${posY}%`;
        asteroid.style.animationDelay = `${delay}s`;
        asteroid.style.animationDuration = `${duration}s`;
        
        asteroids.appendChild(asteroid);
    }
    
    // Create comets
    for (let i = 0; i < 3; i++) {
        const comet = document.createElement('div');
        comet.className = 'comet';
        
        const posY = Math.random() * 100;
        const delay = Math.random() * 15;
        
        comet.style.top = `${posY}%`;
        comet.style.animationDelay = `${delay}s`;
        
        comets.appendChild(comet);
    }
}

// Enhanced Event Listeners
function setupEventListeners() {
    // Logout
    if (logoutBtnChat) {
        logoutBtnChat.addEventListener('click', async () => {
            try {
                await auth.signOut();
                showNotification('👋 Bis bald!', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }

    // Send Message
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Enter Key
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // File Upload Handler
    const fileUpload = document.getElementById('file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('change', handleFileSelect);
    }

    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-content') && !e.target.closest('.dropdown-btn')) {
            const dropdownContent = document.querySelector('.dropdown-content');
            if (dropdownContent) dropdownContent.classList.remove('show');
        }
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.dropdown-action[onclick*="emoji"]')) {
            const emojiPicker = document.getElementById('emoji-picker');
            if (emojiPicker) emojiPicker.classList.add('hidden');
        }
        if (!e.target.closest('.games-menu') && !e.target.closest('.dropdown-action[onclick*="Games"]')) {
            const gamesMenu = document.getElementById('games-menu');
            const rpsMenu = document.getElementById('rps-menu');
            if (gamesMenu) gamesMenu.classList.add('hidden');
            if (rpsMenu) rpsMenu.classList.add('hidden');
        }
        if (!e.target.closest('.modal-content') && e.target.closest('.modal')) {
            e.target.closest('.modal').classList.add('hidden');
        }
    });

    // Voice Recording Click Handler
    const voiceRecording = document.getElementById('voice-recording');
    if (voiceRecording) {
        voiceRecording.addEventListener('click', stopVoiceRecording);
    }

    // Prevent context menu on certain elements
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.dropdown-btn') || 
            e.target.closest('.emoji-picker') ||
            e.target.closest('.games-menu')) {
            e.preventDefault();
        }
    });
}

// Image Modal
function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal image-preview-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            <img src="${imageUrl}" alt="Bild Vorschau" class="image-preview">
        </div>
    `;
    document.body.appendChild(modal);
}

// User Profile Modal
function showUserProfile(userId) {
    showNotification('👤 User-Profil wird geladen...', 'info');
}

function closeUserProfile() {
    document.getElementById('user-profile-modal').classList.add('hidden');
}

// Initialize Chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('💬 Chat DOM geladen');
    
    // DEBUG: Zeige localStorage Inhalt
    console.log('🔍 localStorage roomId:', localStorage.getItem('roomId'));
    console.log('🔍 localStorage roomName:', localStorage.getItem('roomName'));
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('👤 User authentifiziert für Chat:', user.email);
            initChat();
        } else {
            console.log('👋 Kein User, weiterleitung zu index.html');
            window.location.href = 'index.html';
        }
    });
});

// Global Functions
window.toggleTheme = toggleTheme;
window.toggleGamesMenu = toggleGamesMenu;
window.toggleVoiceRecording = toggleVoiceRecording;
window.toggleEmojiPicker = toggleEmojiPicker;
window.openImageUpload = openImageUpload;
window.openFileModal = openFileModal;
window.showRpsMenu = showRpsMenu;
window.playGame = playGame;
window.stopVoiceRecording = stopVoiceRecording;
window.closeFileModal = closeFileModal;
window.sendFile = sendFile;
window.openImageModal = openImageModal;
window.playVoiceMessage = playVoiceMessage;
window.addReaction = addReaction;
window.deleteMessage = deleteMessage;
window.pinMessage = pinMessage;
window.unpinMessage = unpinMessage;
window.toggleUserRole = toggleUserRole;
window.showRoomManagement = showRoomManagement;
window.exportChat = exportChat;
window.showUserProfile = showUserProfile;
window.closeUserProfile = closeUserProfile;