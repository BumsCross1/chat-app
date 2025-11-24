// Enhanced Chat Application - NextGen Chat PRO
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const logoutBtnChat = document.getElementById('logout-btn');
const roomNameH2 = document.getElementById('room-name');
const emojiBtn = document.getElementById('emoji-btn');
const imageBtn = document.getElementById('image-btn');
const voiceBtn = document.getElementById('voice-btn');
const fileBtn = document.getElementById('file-btn');
const gamesBtn = document.getElementById('games-btn');
const themeBtn = document.getElementById('theme-btn');
const emojiPicker = document.getElementById('emoji-picker');
const gamesMenu = document.getElementById('games-menu');
const rpsMenu = document.getElementById('rps-menu');
const voiceRecording = document.getElementById('voice-recording');
const fileModal = document.getElementById('file-modal');
const userProfileModal = document.getElementById('user-profile-modal');
const typingIndicator = document.getElementById('typing-indicator');
const pinnedMessage = document.getElementById('pinned-message');

// Room Daten
const roomId = localStorage.getItem('roomId');
const roomName = localStorage.getItem('roomName');

// Global Variables
let currentUserAvatar = null;
let selectedImage = null;
let selectedFile = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// Emoji Kategorien (erweitert)
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    nature: ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓', '🦌', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦔', '🦇', '🐻', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴'],
    objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🪛', '🧰', '🧲', '🪜', '⚗️', '🧪', '🧫', '🧬', '🔬', '🔭', '📡', '💉', '🩸', '💊', '🩹', '🩺', '🚪', '🪑', '🚽', '🚿', '🛁', '🪒', '🧴', '🧷', '🧹', '🧺', '🧻', '🚬'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳'],
    flags: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫']
};

// Smart Replies
const smartReplies = {
    'hallo': ['Hi!', 'Hallo!', 'Hey! 👋', 'Servus!', 'Moin!'],
    'danke': ['Gerne!', 'Kein Problem!', 'Immer doch! 😊', 'Nichts zu danken!'],
    'wie gehts': ['Gut, danke!', 'Super!', 'Alles bestens! 👍', 'Kann nicht klagen!'],
    'ok': ['Alles klar!', 'Verstanden!', '👍', 'Perfekt!'],
    'bye': ['Tschüss!', 'Bis bald!', 'Auf Wiedersehen! 👋'],
    'lol': ['😂', 'Haha!', 'Das ist lustig!', '🤣']
};

// Achievements System
const achievements = {
    firstMessage: { name: "Erste Nachricht", icon: "💬", earned: false },
    chatAddict: { name: "Chat-Süchtig", icon: "🔥", earned: false, condition: (msgs) => msgs >= 10 },
    popular: { name: "Beliebt", icon: "⭐", earned: false, condition: (reactions) => reactions >= 5 },
    earlyUser: { name: "Early User", icon: "🚀", earned: false },
    gamer: { name: "Spieler", icon: "🎮", earned: false, condition: (games) => games >= 3 }
};

// Initialize Chat
function initChat() {
    if (!roomId || !roomName) {
        alert('Raum nicht gefunden! Zurück zum Dashboard.');
        window.location.href = 'dashboard.html';
        return;
    }

    roomNameH2.textContent = roomName;
    loadCurrentUserAvatar();
    setupEventListeners();
    loadMessages();
    initEmojiPicker();
    setupOnlineStatus();
    loadPinnedMessage();
    setupReactionSystem();
}

// Event Listeners setup
function setupEventListeners() {
    // Logout
    logoutBtnChat?.addEventListener('click', async () => {
        await updateUserStatus(false, false);
        await auth.signOut();
        window.location.href = 'index.html';
    });


    // Füge diesen Code in setupEventListeners() hinzu:
document.addEventListener('click', (e) => {
    // Schließe User Profile Modal wenn außerhalb geklickt wird
    if (userProfileModal && !userProfileModal.contains(e.target) && 
        !e.target.closest('.message-avatar') && 
        !e.target.closest('.message-sender')) {
        userProfileModal.classList.add('hidden');
    }
    
    // Schließe Modals mit Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            userProfileModal.classList.add('hidden');
            fileModal.classList.add('hidden');
            imageModal.classList.add('hidden');
        }
    });
});
    // Emoji Picker
    emojiBtn?.addEventListener('click', toggleEmojiPicker);

    // Games Menu
    gamesBtn?.addEventListener('click', toggleGamesMenu);

    // Voice Recording
    voiceBtn?.addEventListener('click', toggleVoiceRecording);

    // File Upload
    fileBtn?.addEventListener('click', () => {
        fileModal.classList.remove('hidden');
    });

    // Image Upload - FIXED
imageBtn?.addEventListener('click', () => {
    // Create file input if it doesn't exist
    let fileInput = document.getElementById('image-upload');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'image-upload';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', handleImageSelect);
        document.body.appendChild(fileInput);
    }
    fileInput.click();
});

// Image Select Handler - FIXED
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Bitte nur Bilder auswählen!');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Bild darf nicht größer als 5MB sein!');
            return;
        }
        selectedImage = file;
        sendImage();
        
        // Reset the input
        e.target.value = '';
    }
}

// Send Image Function - FIXED
async function sendImage() {
    if (!selectedImage) {
        console.error('Kein Bild ausgewählt');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert('Bitte einloggen!');
        return;
    }

    try {
        const base64 = await fileToBase64(selectedImage);
        
        const messageData = {
            type: 'image',
            imageUrl: base64,
            user: getUserData(),
            createdAt: Date.now(),
            fileName: selectedImage.name
        };

        await db.ref(`messages/${roomId}`).push().set(messageData);
        console.log('Bild erfolgreich gesendet');
        
    } catch (error) {
        console.error('Bild senden fehlgeschlagen:', error);
        alert('Fehler beim Senden des Bildes: ' + error.message);
    } finally {
        selectedImage = null;
    }
}

    // Send Message on Button Click
    sendBtn?.addEventListener('click', sendMessage);

    // Send Message on Enter Key
    msgInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Typing Indicator
    let typingTimeout;
    msgInput?.addEventListener('input', () => {
        updateUserStatus(true, true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            updateUserStatus(true, false);
        }, 2000);
    });

    // File Upload Handler
    document.getElementById('file-upload')?.addEventListener('change', handleFileSelect);
    document.getElementById('image-upload')?.addEventListener('change', handleImageSelect);

    // Voice Recording Click to Stop
    voiceRecording?.addEventListener('click', stopVoiceRecording);

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.add('hidden');
        }
        if (!gamesMenu.contains(e.target) && e.target !== gamesBtn && !rpsMenu.contains(e.target)) {
            gamesMenu.classList.add('hidden');
            rpsMenu.classList.add('hidden');
        }
        if (!fileModal.contains(e.target) && e.target !== fileBtn) {
            closeFileModal();
        }
    });

    // Focus input on load
    setTimeout(() => {
        msgInput?.focus();
    }, 1000);
}

// ==================== EMOJI SYSTEM ====================
function initEmojiPicker() {
    const emojiGrid = document.getElementById('emoji-grid');
    const categoryBtns = document.querySelectorAll('.emoji-category-btn');
    
    loadEmojiCategory('smileys');
    
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
    
    emojiCategories[category].forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-btn';
        emojiBtn.textContent = emoji;
        emojiBtn.onclick = () => {
            msgInput.value += emoji;
            msgInput.focus();
        };
        emojiGrid.appendChild(emojiBtn);
    });
}

function toggleEmojiPicker() {
    emojiPicker.classList.toggle('hidden');
    gamesMenu.classList.add('hidden');
    rpsMenu.classList.add('hidden');
}

// ==================== GAMES SYSTEM ====================
function toggleGamesMenu() {
    gamesMenu.classList.toggle('hidden');
    emojiPicker.classList.add('hidden');
    rpsMenu.classList.add('hidden');
}

function showRpsMenu() {
    rpsMenu.classList.remove('hidden');
    gamesMenu.classList.add('hidden');
}

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
            let outcome = 'Unentschieden!';
            
            if ((choice === '✊' && botChoice === '✌️') ||
                (choice === '✋' && botChoice === '✊') ||
                (choice === '✌️' && botChoice === '✋')) {
                outcome = 'Gewonnen! 🏆';
            } else if (choice !== botChoice) {
                outcome = 'Verloren! 😢';
            }
            
            result = `🎮 ${user.displayName}: ${choice} vs Bot: ${botChoice} - ${outcome}`;
            break;
            
        default:
            result = `❌ Unbekanntes Spiel: ${game}`;
    }

    // Send game result as message
    const messageData = {
        text: result,
        user: getUserData(),
        createdAt: Date.now(),
        type: 'game'
    };

    db.ref(`messages/${roomId}`).push().set(messageData);
    
    // Close game menus
    gamesMenu.classList.add('hidden');
    rpsMenu.classList.add('hidden');
    
    // Update achievements
    updateAchievement('gamer', 1);
}



// ==================== VOICE MESSAGES ====================
async function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        await startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await sendVoiceMessage(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        voiceRecording.classList.remove('hidden');
        voiceBtn.style.background = 'var(--error)';
        voiceBtn.textContent = '⏹️';
        
    } catch (error) {
        console.error('Mikrofon Zugriff fehlgeschlagen:', error);
        alert('Mikrofon Zugriff wurde verweigert!');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        voiceRecording.classList.add('hidden');
        voiceBtn.style.background = '';
        voiceBtn.textContent = '🎤';
    }
}

async function sendVoiceMessage(audioBlob) {
    const user = auth.currentUser;
    const base64 = await fileToBase64(audioBlob);
    
    const messageData = {
        type: 'voice',
        audioUrl: base64,
        user: getUserData(),
        createdAt: Date.now(),
        duration: Math.round(audioBlob.size / 16000) // Rough estimate
    };

    await db.ref(`messages/${roomId}`).push().set(messageData);
}

// ==================== FILE UPLOAD ====================
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) {
            alert('Datei zu groß! Max. 10MB');
            return;
        }
        selectedFile = file;
        document.getElementById('file-info').textContent = `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    }
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            alert('Bitte nur Bilder auswählen!');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Bild darf nicht größer als 5MB sein!');
            return;
        }
        selectedImage = file;
        sendImage();
    }
}

function closeFileModal() {
    fileModal.classList.add('hidden');
    selectedFile = null;
    document.getElementById('file-upload').value = '';
    document.getElementById('file-info').textContent = '';
}

async function sendFile() {
    if (!selectedFile) {
        alert('Bitte wähle zuerst eine Datei aus!');
        return;
    }

    const base64 = await fileToBase64(selectedFile);
    
    const messageData = {
        type: 'file',
        fileUrl: base64,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        user: getUserData(),
        createdAt: Date.now()
    };

    await db.ref(`messages/${roomId}`).push().set(messageData);
    closeFileModal();
}

async function sendImage() {
    if (!selectedImage) return;

    const base64 = await fileToBase64(selectedImage);
    
    const messageData = {
        type: 'image',
        imageUrl: base64,
        user: getUserData(),
        createdAt: Date.now(),
        fileName: selectedImage.name
    };

    await db.ref(`messages/${roomId}`).push().set(messageData);
    selectedImage = null;
    document.getElementById('image-upload').value = '';
}

// ==================== REACTION SYSTEM ====================
function setupReactionSystem() {
    document.addEventListener('contextmenu', (e) => {
        const messageElement = e.target.closest('.message');
        if (messageElement && !e.target.closest('.reaction-menu')) {
            e.preventDefault();
            showReactionMenu(e.pageX, e.pageY, messageElement.id.replace('message-', ''));
        }
    });
}

function showReactionMenu(x, y, messageId) {
    // Remove existing menu
    const existingMenu = document.querySelector('.reaction-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'reaction-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    menu.innerHTML = reactions.map(emoji => 
        `<button class="reaction-btn" onclick="addReaction('${messageId}', '${emoji}')">${emoji}</button>`
    ).join('');
    
    document.body.appendChild(menu);
    
    setTimeout(() => menu.remove(), 3000);
}

async function addReaction(messageId, emoji) {
    const user = auth.currentUser;
    const reactionRef = db.ref(`messages/${roomId}/${messageId}/reactions/${user.uid}`);
    
    // Toggle reaction
    const snapshot = await reactionRef.once('value');
    if (snapshot.val() === emoji) {
        // Remove reaction
        await reactionRef.remove();
    } else {
        // Add/change reaction
        await reactionRef.set(emoji);
    }
    
    // Update achievements
    updateAchievement('popular', 1);
}

// ==================== ONLINE STATUS & TYPING ====================
async function updateUserStatus(online, typing) {
    const userStatusRef = db.ref(`status/${roomId}/${auth.currentUser.uid}`);
    await userStatusRef.set({
        online: online,
        typing: typing,
        lastSeen: Date.now(),
        user: getUserData()
    });
}

function setupOnlineStatus() {
    // Set initial status
    updateUserStatus(true, false);
    
    // Listen for other users' status
    db.ref(`status/${roomId}`).on('value', (snap) => {
        const statuses = snap.val() || {};
        const typingUsers = [];
        
        Object.values(statuses).forEach(status => {
            if (status.typing && status.user.uid !== auth.currentUser.uid) {
                typingUsers.push(status.user.displayName);
            }
        });
        
        if (typingUsers.length > 0) {
            const names = typingUsers.slice(0, 2).join(', ');
            const more = typingUsers.length > 2 ? ` und ${typingUsers.length - 2} weitere` : '';
            typingIndicator.textContent = `${names}${more} schreibt...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    });
    
    // Update status when leaving
    window.addEventListener('beforeunload', () => {
        updateUserStatus(false, false);
    });
}

// ==================== PINNED MESSAGES ====================
async function loadPinnedMessage() {
    db.ref(`rooms/${roomId}/pinned`).on('value', async (snap) => {
        const pinnedId = snap.val();
        if (pinnedId) {
            const messageSnap = await db.ref(`messages/${roomId}/${pinnedId}`).once('value');
            const message = messageSnap.val();
            if (message) {
                document.getElementById('pinned-text').textContent = 
                    `${message.user.displayName}: ${message.text || '📎 Datei'}`;
                pinnedMessage.classList.remove('hidden');
            }
        } else {
            pinnedMessage.classList.add('hidden');
        }
    });
}

function pinMessage(messageId) {
    db.ref(`rooms/${roomId}/pinned`).set(messageId);
}

function unpinMessage() {
    db.ref(`rooms/${roomId}/pinned`).remove();
    pinnedMessage.classList.add('hidden');
}

// ==================== USER PROFILES & ACHIEVEMENTS ====================
async function showUserProfile(user) {
    try {
        // Load user data
        const userSnapshot = await db.ref(`users/${user.uid}`).once('value');
        const userData = userSnapshot.val() || {};
        
        // Count user messages
        const messagesSnapshot = await db.ref(`messages/${roomId}`).once('value');
        const messages = messagesSnapshot.val() || {};
        const userMessages = Object.values(messages).filter(m => m.user.uid === user.uid).length;
        
        // Count reactions
        let reactionCount = 0;
        Object.values(messages).forEach(msg => {
            if (msg.reactions && msg.user.uid === user.uid) {
                reactionCount += Object.keys(msg.reactions).length;
            }
        });
        
        // Set modal content
        document.getElementById('profile-modal-avatar').src = userData.avatar || generateDefaultAvatar(user.displayName);
        document.getElementById('profile-modal-name').textContent = user.displayName;
        document.getElementById('profile-modal-email').textContent = user.email;
        document.getElementById('profile-message-count').textContent = userMessages;
        document.getElementById('profile-reaction-count').textContent = reactionCount;
        
        // Load achievements
        loadAchievements(user.uid, userMessages, reactionCount);
        
        userProfileModal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Fehler beim Laden des Profils:', error);
    }
}

async function loadAchievements(userId, messageCount, reactionCount) {
    const achievementsList = document.getElementById('achievements-list');
    achievementsList.innerHTML = '';
    
    // Check and display achievements
    const userAchievements = await db.ref(`users/${userId}/achievements`).once('value');
    const earnedAchievements = userAchievements.val() || {};
    
    Object.entries(achievements).forEach(([key, achievement]) => {
        const earned = earnedAchievements[key] || 
                     (achievement.condition && achievement.condition(
                         key === 'chatAddict' ? messageCount : 
                         key === 'popular' ? reactionCount : 0
                     ));
        
        if (earned) {
            const achievementEl = document.createElement('div');
            achievementEl.className = 'achievement earned';
            achievementEl.innerHTML = `
                <span class="achievement-icon">${achievement.icon}</span>
                <span class="achievement-name">${achievement.name}</span>
            `;
            achievementsList.appendChild(achievementEl);
        }
    });
}

async function updateAchievement(achievementKey, value = 1) {
    const user = auth.currentUser;
    const achievementRef = db.ref(`users/${user.uid}/achievements/${achievementKey}`);
    
    if (achievements[achievementKey].condition) {
        const current = (await achievementRef.once('value')).val() || 0;
        await achievementRef.set(current + value);
    } else {
        await achievementRef.set(true);
    }
}

// ==================== SMART REPLIES ====================
function getSmartReply(message) {
    const lowerMsg = message.toLowerCase();
    for (const [trigger, replies] of Object.entries(smartReplies)) {
        if (lowerMsg.includes(trigger)) {
            return replies[Math.floor(Math.random() * replies.length)];
        }
    }
    return null;
}

// ==================== MESSAGE SYSTEM ====================
async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const user = auth.currentUser;
    if (!user) return;

    // Check for commands first
    const commandResult = handleCommands(text);
    if (commandResult) {
        msgInput.value = '';
        return;
    }

    // Disable input while sending
    msgInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="spinner"></div>';

    try {
        const messageData = {
            text: text,
            user: getUserData(),
            createdAt: Date.now(),
            type: 'text'
        };

        await db.ref(`messages/${roomId}`).push().set(messageData);
        msgInput.value = '';
        msgInput.style.height = 'auto';
        
        // Update achievements
        if (!localStorage.getItem('firstMessageSent')) {
            updateAchievement('firstMessage');
            localStorage.setItem('firstMessageSent', 'true');
        }
        updateAchievement('chatAddict', 1);
        
        // Update typing status
        updateUserStatus(true, false);
        
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('Nachricht senden fehlgeschlagen:', error);
    } finally {
        msgInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Senden';
        msgInput.focus();
    }
}

function handleCommands(text) {
    const commands = {
        '/würfel': () => playGame('dice'),
        '/münze': () => playGame('coin'),
        '/ssp': (args) => playGame('rps', args[0]),
        '/pin': (args) => pinMessage(args[0])
    };
    
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    
    if (commands[command]) {
        commands[command](parts.slice(1));
        msgInput.value = '';
        return true;
    }
    
    return false;
}

// Load and display messages
function loadMessages() {
    db.ref(`messages/${roomId}`).on('value', async (snap) => {
        const data = snap.val() || {};
        messagesDiv.innerHTML = '';

        const messages = Object.entries(data)
            .map(([key, message]) => ({
                id: key,
                ...message
            }))
            .sort((a, b) => a.createdAt - b.createdAt);

        for (const message of messages) {
            await displayMessage(message);
        }

        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);
    });
}

// Display a single message
async function displayMessage(message) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = message.user.uid === auth.currentUser.uid;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    messageDiv.id = `message-${message.id}`;

    // Get avatar
    let avatarUrl = isOwnMessage ? currentUserAvatar : await getUserAvatar(message.user.uid, message.user.displayName);

    // Format timestamp
    const timestamp = new Date(message.createdAt);
    const timeString = timestamp.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Create message HTML based on type
    let messageHTML = '';
    let messageContent = '';
    
    switch(message.type) {
        case 'image':
            messageContent = `
                <div class="message-image">
                    <img src="${message.imageUrl}" alt="Gesendetes Bild" class="sent-image" 
                         onclick="openImageModal('${message.imageUrl}')">
                </div>
            `;
            break;
            
        case 'voice':
            messageContent = `
                <div class="voice-message">
                    <button class="play-voice-btn" onclick="playVoiceMessage('${message.audioUrl}')">
                        🔈 Sprachnachricht (${message.duration || 0}s)
                    </button>
                </div>
            `;
            break;
            
        case 'file':
            messageContent = `
                <div class="file-message">
                    <a href="${message.fileUrl}" download="${message.fileName}" class="file-download">
                        📎 ${message.fileName} (${(message.fileSize / 1024 / 1024).toFixed(2)} MB)
                    </a>
                </div>
            `;
            break;
            
        case 'game':
            messageContent = `<div class="game-message">${formatMessageText(message.text)}</div>`;
            break;
            
        default:
            messageContent = `<div class="message-text">${formatMessageText(message.text)}</div>`;
    }

    // Add reactions
    let reactionsHTML = '';
    if (message.reactions) {
        const reactionCounts = {};
        Object.values(message.reactions).forEach(reaction => {
            reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
        });
        
        reactionsHTML = Object.entries(reactionCounts)
            .map(([emoji, count]) => `<span class="message-reaction">${emoji} ${count}</span>`)
            .join('');
    }

    messageHTML = `
        <img src="${avatarUrl}" alt="Avatar" class="message-avatar" 
             onerror="this.src='${generateDefaultAvatar(message.user.displayName)}'">
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(message.user.displayName)}</span>
                <span class="message-time">${timeString}</span>
            </div>
            ${messageContent}
            ${reactionsHTML ? `<div class="message-reactions">${reactionsHTML}</div>` : ''}
        </div>
    `;

    messageDiv.innerHTML = messageHTML;
    messagesDiv.appendChild(messageDiv);

    // Add click event for user profile
    const avatarImg = messageDiv.querySelector('.message-avatar');
    const senderName = messageDiv.querySelector('.message-sender');
    
    [avatarImg, senderName].forEach(element => {
        element.style.cursor = 'pointer';
        element.addEventListener('click', () => {
            showUserProfile(message.user);
        });
    });

    // Add right-click for reactions
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showReactionMenu(e.pageX, e.pageY, message.id);
    });

    // Add animation
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }, 10);
}

// ==================== UTILITY FUNCTIONS ====================
function getUserData() {
    const user = auth.currentUser;
    return {
        uid: user.uid,
        displayName: user.displayName || user.email,
        email: user.email
    };
}

async function loadCurrentUserAvatar() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const snapshot = await db.ref(`users/${user.uid}/avatar`).once('value');
        currentUserAvatar = snapshot.val();
    } catch (error) {
        console.log('Avatar nicht geladen, verwende Default');
    }

    if (!currentUserAvatar) {
        currentUserAvatar = generateDefaultAvatar(user.displayName || user.email);
    }
}

function generateDefaultAvatar(name) {
    const initial = name ? name.charAt(0).toUpperCase() : 'U';
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
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

async function getUserAvatar(uid, displayName) {
    try {
        const snapshot = await db.ref(`users/${uid}/avatar`).once('value');
        const avatar = snapshot.val();
        return avatar || generateDefaultAvatar(displayName);
    } catch (error) {
        return generateDefaultAvatar(displayName);
    }
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
    formatted = formatted.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener" class="message-link">$1</a>'
    );
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

function playVoiceMessage(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play();
}

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

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            initChat();
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Make functions global
window.closeFileModal = closeFileModal;
window.sendFile = sendFile;
window.sendImage = sendImage;
window.openImageModal = openImageModal;
window.showUserProfile = showUserProfile;
window.closeUserProfile = closeUserProfile;
window.playGame = playGame;
window.showRpsMenu = showRpsMenu;
window.toggleVoiceRecording = toggleVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.addReaction = addReaction;
window.pinMessage = pinMessage;
window.unpinMessage = unpinMessage;
window.playVoiceMessage = playVoiceMessage;

function closeUserProfile() {
    const userProfileModal = document.getElementById('user-profile-modal');
    if (userProfileModal) {
        userProfileModal.classList.add('hidden');
    }
}

// Und stelle sicher dass die Funktion global ist:
window.closeUserProfile = closeUserProfile;
// ==================== LIGHT THEME TOGGLE ====================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('light-theme', savedTheme === 'light');
    themeBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

themeBtn?.addEventListener('click', function() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    this.textContent = isLight ? '🌙' : '☀️';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// ==================== MESSAGE SEARCH & FILTER ====================
function initMessageSearch() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '🔍 Nachrichten durchsuchen...';
    searchInput.className = 'modern-input message-search';
    searchInput.style.margin = '10px 20px';
    searchInput.style.width = 'calc(100% - 40px)';
    
    document.querySelector('.chat-header-info').appendChild(searchInput);
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const messages = document.querySelectorAll('.message');
        
        messages.forEach(msg => {
            const text = msg.textContent.toLowerCase();
            msg.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });
}

// ==================== AUTO-SCROLL & NEW MESSAGE INDICATOR ====================
let autoScroll = true;
let newMessages = 0;

function initAutoScroll() {
    messagesDiv.addEventListener('scroll', () => {
        const isAtBottom = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 100;
        autoScroll = isAtBottom;
        
        if (!autoScroll && newMessages === 0) {
            showNewMessageIndicator();
        }
    });
}

function showNewMessageIndicator() {
    newMessages++;
    let indicator = document.getElementById('new-messages-indicator');
    
    if (!indicator) {
        indicator = document.createElement('button');
        indicator.id = 'new-messages-indicator';
        indicator.className = 'new-messages-indicator';
        indicator.innerHTML = `📨 ${newMessages} neue Nachricht(en)`;
        indicator.onclick = () => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            newMessages = 0;
            indicator.remove();
        };
        document.querySelector('.chat-container').appendChild(indicator);
    } else {
        indicator.innerHTML = `📨 ${newMessages} neue Nachricht(en)`;
    }
}

// ==================== MESSAGE SUGGESTIONS ====================
function initMessageSuggestions() {
    const suggestions = document.createElement('div');
    suggestions.id = 'message-suggestions';
    suggestions.className = 'message-suggestions hidden';
    
    msgInput.addEventListener('input', (e) => {
        const text = e.target.value.toLowerCase();
        const smartReply = getSmartReply(text);
        
        if (smartReply && text.length > 3) {
            suggestions.innerHTML = `
                <button class="suggestion-btn" onclick="useSuggestion('${smartReply}')">
                    💡 "${smartReply}"
                </button>
            `;
            suggestions.classList.remove('hidden');
        } else {
            suggestions.classList.add('hidden');
        }
    });
    
    document.querySelector('.chat-input-container').appendChild(suggestions);
}

function useSuggestion(text) {
    msgInput.value = text;
    document.getElementById('message-suggestions').classList.add('hidden');
    msgInput.focus();
}

// ==================== CHAT STATISTICS ====================
function initChatStats() {
    const statsBtn = document.createElement('button');
    statsBtn.className = 'chat-header-btn';
    statsBtn.innerHTML = '📊';
    statsBtn.title = 'Chat Statistiken';
    statsBtn.onclick = showChatStats;
    
    document.querySelector('.chat-header-actions').prepend(statsBtn);
}

async function showChatStats() {
    const messagesSnapshot = await db.ref(`messages/${roomId}`).once('value');
    const messages = messagesSnapshot.val() || {};
    
    const messageCount = Object.keys(messages).length;
    const users = new Set();
    const messageTypes = {};
    let totalReactions = 0;
    
    Object.values(messages).forEach(msg => {
        users.add(msg.user.uid);
        messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
        if (msg.reactions) {
            totalReactions += Object.keys(msg.reactions).length;
        }
    });
    
    const statsHTML = `
        <div class="modal-content">
            <h3>📊 Chat Statistiken</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${messageCount}</div>
                    <div class="stat-label">Nachrichten</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${users.size}</div>
                    <div class="stat-label">User</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalReactions}</div>
                    <div class="stat-label">Reactions</div>
                </div>
            </div>
            <div class="message-type-stats">
                <h4>Nachrichten Typen:</h4>
                ${Object.entries(messageTypes).map(([type, count]) => `
                    <div class="type-stat">
                        <span class="type-name">${getTypeName(type)}</span>
                        <span class="type-count">${count}</span>
                    </div>
                `).join('')}
            </div>
            <button class="modern-btn secondary-btn" onclick="this.closest('.modal').remove()">Schließen</button>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = statsHTML;
    document.body.appendChild(modal);
}

function getTypeName(type) {
    const names = {
        'text': '📝 Text',
        'image': '🖼️ Bilder',
        'voice': '🎤 Sprachnachrichten',
        'file': '📎 Dateien',
        'game': '🎮 Spiele'
    };
    return names[type] || type;
}

// ==================== ENHANCED INITIALIZATION ====================
function enhancedInit() {
    initTheme();
    initMessageSearch();
    initAutoScroll();
    initMessageSuggestions();
    initChatStats();
    
    // Add right-click menu for messages
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.message')) {
            e.preventDefault();
            showMessageContextMenu(e.pageX, e.pageY, e.target.closest('.message'));
        }
    });
}

function showMessageContextMenu(x, y, messageElement) {
    const messageId = messageElement.id.replace('message-', '');
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    menu.innerHTML = `
        <button class="context-menu-btn" onclick="pinMessage('${messageId}')">📌 Pin</button>
        <button class="context-menu-btn" onclick="copyMessageText('${messageId}')">📋 Kopieren</button>
        <button class="context-menu-btn" onclick="replyToMessage('${messageId}')">↩️ Antworten</button>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => menu.remove(), 3000);
}

function copyMessageText(messageId) {
    const messageElement = document.getElementById(`message-${messageId}`);
    const text = messageElement.querySelector('.message-text')?.textContent || '';
    navigator.clipboard.writeText(text);
}

function replyToMessage(messageId) {
    const messageElement = document.getElementById(`message-${messageId}`);
    const sender = messageElement.querySelector('.message-sender').textContent;
    const text = messageElement.querySelector('.message-text')?.textContent || '';
    
    msgInput.value = `@${sender} ${text} `;
    msgInput.focus();
}

// ==================== FINAL INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            initChat();
            enhancedInit();
        } else {
            window.location.href = 'index.html';
        }
    });
});

// Export für globale Nutzung
window.copyMessageText = copyMessageText;
window.replyToMessage = replyToMessage;
window.useSuggestion = useSuggestion;
window.showChatStats = showChatStats;