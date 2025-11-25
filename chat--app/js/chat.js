// NextGen Chat PRO - Fixed Version
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

// Room Daten
const roomId = localStorage.getItem('roomId');
const roomName = localStorage.getItem('roomName');

// Fix für Mehrfach-Nachrichten
async function sendMessage() {
    if (isSending) return;
    
    const text = msgInput.value.trim();
    if (!text) return;

    const user = auth.currentUser;
    if (!user) return;

    isSending = true;
    
    // UI sperren
    msgInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('sending');
    sendBtn.textContent = 'Sending...';

    try {
        const messageData = {
            text: text,
            user: getUserData(),
            createdAt: Date.now(),
            type: 'text'
        };

        await db.ref(`messages/${roomId}`).push().set(messageData);
        msgInput.value = '';
        
        // Update typing status
        updateUserStatus(true, false);
        
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('Nachricht senden fehlgeschlagen:', error);
    } finally {
        // UI wieder freigeben
        isSending = false;
        msgInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('sending');
        sendBtn.textContent = 'Senden';
        msgInput.focus();
    }
}

// Emoji Kategorien (am Anfang der Datei hinzufügen)
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    nature: ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🐎', '🦄', '🦓', '🦌', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽'],
    objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🪛', '🧰']
};

// Emoji Picker Funktionen
function initEmojiPicker() {
    const emojiGrid = document.getElementById('emoji-grid');
    const categoryBtns = document.querySelectorAll('.emoji-category-btn');
    
    // Standard-Kategorie laden
    loadEmojiCategory('smileys');
    
    // Event Listener für Kategorie-Buttons
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Aktive Klasse setzen
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Emojis der Kategorie laden
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
                msgInput.value += emoji;
                msgInput.focus();
                // Emoji Picker schließen nach Auswahl
                document.getElementById('emoji-picker').classList.add('hidden');
            };
            emojiGrid.appendChild(emojiBtn);
        });
    }
}
// Füge diese Funktion hinzu:
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

function loadMessages() {
    db.ref(`messages/${roomId}`).on('value', (snap) => {
        const data = snap.val() || {};
        messagesDiv.innerHTML = '';

        const messages = Object.entries(data)
            .map(([key, message]) => ({
                id: key,
                ...message
            }))
            .sort((a, b) => a.createdAt - b.createdAt);

        messages.forEach(message => {
            displayMessage(message);
        });

        // AUTOMATISCH NACH UNTEN SCROLLEN - FIXED
        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 300); // Kurze Verzögerung für sichereres Scrollen
    });
}
// Und in initChat() aufrufen:
function initChat() {
    if (!roomId || !roomName) {
        alert('Raum nicht gefunden! Zurück zum Dashboard.');
        window.location.href = 'dashboard.html';
        return;
    }

    roomNameH2.textContent = roomName;
    loadCurrentUserAvatar(); // DIESE ZEILE HINZUFÜGEN
    setupEventListeners();
    loadMessages();
    initDropdown();
    initEmojiPicker(); // EMOJI PICKER INITIALISIEREN
}
// Dropdown Menu für Aktionen
function initDropdown() {
    const dropdownHTML = `
        <div class="chat-actions-dropdown">
            <button class="dropdown-btn">
                <span>🔧 Aktionen</span>
                <span>▼</span>
            </button>
            <div class="dropdown-content">
                <button class="dropdown-action" onclick="toggleTheme()">🌙 Theme</button>
                <button class="dropdown-action" onclick="toggleGamesMenu()">🎮 Sexspiele</button>
                <button class="dropdown-action" onclick="toggleVoiceRecording()">🎤 Voice</button>
                <button class="dropdown-action" onclick="toggleEmojiPicker()">😊 Juri</button>
                <button class="dropdown-action" onclick="openImageUpload()">🖼️ Bild</button>
                <button class="dropdown-action" onclick="openFileModal()">📎 Datei</button>
            </div>
        </div>
    `;
    
    const chatHeaderActions = document.querySelector('.chat-header-actions');
    
    // Entferne alte Buttons
    const oldButtons = chatHeaderActions.querySelectorAll('.chat-header-btn:not(.logout)');
    oldButtons.forEach(btn => btn.remove());
    
    // Füge Dropdown hinzu
    chatHeaderActions.insertAdjacentHTML('afterbegin', dropdownHTML);
    
    // Dropdown Toggle
    const dropdownBtn = document.querySelector('.dropdown-btn');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownContent.classList.toggle('show');
    });
    
    // Schließe Dropdown wenn außerhalb geklickt wird
    document.addEventListener('click', () => {
        dropdownContent.classList.remove('show');
    });
}

// Dropdown Actions
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const themeBtn = document.querySelector('.dropdown-action[onclick="toggleTheme()"]');
    themeBtn.textContent = document.body.classList.contains('light-theme') ? '🌙 Dark' : '☀️ Light';
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

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    emojiPicker.classList.toggle('hidden');
    document.getElementById('games-menu').classList.add('hidden');
}

function openImageUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleImageSelect);
    document.body.appendChild(fileInput);
    fileInput.click();
}

function openFileModal() {
    document.getElementById('file-modal').classList.remove('hidden');
}

// Image Upload
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

async function sendImage() {
    if (!selectedImage) return;

    const user = auth.currentUser;
    if (!user) return;

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
        
    } catch (error) {
        console.error('Bild senden fehlgeschlagen:', error);
        alert('Fehler beim Senden des Bildes: ' + error.message);
    } finally {
        selectedImage = null;
    }
}

// File Upload
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

function closeFileModal() {
    document.getElementById('file-modal').classList.add('hidden');
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

// Games System
function showRpsMenu() {
    document.getElementById('rps-menu').classList.remove('hidden');
    document.getElementById('games-menu').classList.add('hidden');
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
    }

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

// Voice Recording
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
        document.getElementById('voice-recording').classList.remove('hidden');
        
    } catch (error) {
        console.error('Mikrofon Zugriff fehlgeschlagen:', error);
        alert('Mikrofon Zugriff wurde verweigert!');
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        isRecording = false;
        document.getElementById('voice-recording').classList.add('hidden');
    }
}

async function sendVoiceMessage(audioBlob) {
    const base64 = await fileToBase64(audioBlob);
    
    const messageData = {
        type: 'voice',
        audioUrl: base64,
        user: getUserData(),
        createdAt: Date.now(),
        duration: Math.round(audioBlob.size / 16000)
    };

    await db.ref(`messages/${roomId}`).push().set(messageData);
}

// Message System
function loadMessages() {
    db.ref(`messages/${roomId}`).on('value', (snap) => {
        const data = snap.val() || {};
        messagesDiv.innerHTML = '';

        const messages = Object.entries(data)
            .map(([key, message]) => ({
                id: key,
                ...message
            }))
            .sort((a, b) => a.createdAt - b.createdAt);

        messages.forEach(message => {
            displayMessage(message);
        });

        setTimeout(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);
    });
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = message.user.uid === auth.currentUser.uid;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    messageDiv.id = `message-${message.id}`;

    const timestamp = new Date(message.createdAt);
    const timeString = timestamp.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
    });

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

    const messageHTML = `
        <img src="${isOwnMessage ? currentUserAvatar : generateDefaultAvatar(message.user.displayName)}" 
             alt="Avatar" class="message-avatar">
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(message.user.displayName)}</span>
                <span class="message-time">${timeString}</span>
            </div>
            ${messageContent}
        </div>
    `;

    messageDiv.innerHTML = messageHTML;
    messagesDiv.appendChild(messageDiv);

    // Animation
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }, 10);
}

// Utility Functions
function getUserData() {
    const user = auth.currentUser;
    return {
        uid: user.uid,
        displayName: user.displayName || user.email,
        email: user.email
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

function generateDefaultAvatar(name) {
    const initial = name ? name.charAt(0).toUpperCase() : 'U';
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

// Initialize Chat
function initChat() {
    if (!roomId || !roomName) {
        alert('Raum nicht gefunden! Zurück zum Dashboard.');
        window.location.href = 'dashboard.html';
        return;
    }

    roomNameH2.textContent = roomName;
    setupEventListeners();
    loadMessages();
    initDropdown();
}

function setupEventListeners() {
    // Logout
    logoutBtnChat?.addEventListener('click', async () => {
        await auth.signOut();
        window.location.href = 'index.html';
    });

    // Send Message
    sendBtn?.addEventListener('click', sendMessage);

    // Enter Key
    msgInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-content') && !e.target.closest('.dropdown-btn')) {
            document.querySelector('.dropdown-content')?.classList.remove('show');
        }
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.dropdown-action[onclick*="emoji"]')) {
            document.getElementById('emoji-picker')?.classList.add('hidden');
        }
        if (!e.target.closest('.games-menu') && !e.target.closest('.dropdown-action[onclick*="Games"]')) {
            document.getElementById('games-menu')?.classList.add('hidden');
            document.getElementById('rps-menu')?.classList.add('hidden');
        }
    });
}

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

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            initChat();
        } else {
            window.location.href = 'index.html';
        }
    });
});