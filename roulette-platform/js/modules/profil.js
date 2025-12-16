import { 
    auth, database, onAuthStateChanged,
    ref, get, update, set
} from '../config/firebase.js';

let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        setupEventListeners();
        loadUserStats();
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, 'users/' + currentUser.uid));
        if (snapshot.exists()) {
            userData = snapshot.val();
            updateProfileUI();
        }
    } catch (error) {
        console.error('Profil laden Fehler:', error);
        showNotification('Profil konnte nicht geladen werden', 'error');
    }
}

function updateProfileUI() {
    if (!userData) return;
    
    // Basic info
    document.getElementById('user-name').textContent = userData.username;
    document.getElementById('user-email').textContent = userData.email;
    document.getElementById('profile-avatar').src = userData.profileImage || getDefaultAvatar(userData.username);
    
    // Stats
    document.getElementById('profile-chips').textContent = formatNumber(userData.chips || 0);
    document.getElementById('profile-level').textContent = `Level ${Math.floor((userData.xp || 0) / 1000) + 1}`;
    document.getElementById('profile-games').textContent = userData.gamesPlayed || 0;
    document.getElementById('profile-wins').textContent = userData.gamesWon || 0;
    
    // Form values
    const usernameInput = document.getElementById('new-username');
    if (usernameInput) {
        usernameInput.value = userData.username;
        usernameInput.placeholder = userData.username;
    }
    
    // Fill other form fields if they exist
    const bioInput = document.getElementById('user-bio');
    if (bioInput && userData.bio) {
        bioInput.value = userData.bio;
    }
}

async function saveProfile() {
    const usernameInput = document.getElementById('new-username');
    const bioInput = document.getElementById('user-bio');
    const avatarInput = document.getElementById('profile-pic');
    
    if (!usernameInput) return;
    
    const newUsername = usernameInput.value.trim();
    const newBio = bioInput?.value.trim() || '';
    
    if (!newUsername) {
        showNotification('Benutzername darf nicht leer sein', 'error');
        return;
    }
    
    if (newUsername === userData.username && newBio === (userData.bio || '') && !avatarInput.files[0]) {
        showNotification('Keine Änderungen erkannt', 'info');
        return;
    }
    
    try {
        const updates = {};
        let usernameChanged = false;
        
        // Check if username changed
        if (newUsername !== userData.username) {
            // Check if username is available
            const usernameSnap = await get(ref(database, 'usernames/' + newUsername.toLowerCase()));
            if (usernameSnap.exists() && usernameSnap.val().uid !== currentUser.uid) {
                showNotification('Benutzername bereits vergeben', 'error');
                return;
            }
            
            // Update username references
            await Promise.all([
                // Remove old username reference
                set(ref(database, 'usernames/' + userData.username.toLowerCase()), null),
                // Add new username reference
                set(ref(database, 'usernames/' + newUsername.toLowerCase()), {
                    uid: currentUser.uid,
                    updatedAt: Date.now()
                })
            ]);
            
            updates.username = newUsername;
            usernameChanged = true;
        }
        
        // Update bio if changed
        if (newBio !== (userData.bio || '')) {
            updates.bio = newBio;
        }
        
        // Handle avatar upload (simplified - using URL)
        if (avatarInput.files[0]) {
            // In a real app, you would upload to Firebase Storage
            // For now, we'll use a placeholder or keep the existing
            showNotification('Avatar-Upload in Entwicklung', 'info');
        }
        
        // If there are updates, save them
        if (Object.keys(updates).length > 0) {
            await update(ref(database, 'users/' + currentUser.uid), updates);
            
            // Update local data
            userData = { ...userData, ...updates };
            
            showNotification('Profil erfolgreich aktualisiert!', 'success');
            
            // If username changed, update in realtime
            if (usernameChanged) {
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        }
        
    } catch (error) {
        console.error('Profil speichern Fehler:', error);
        showNotification('Fehler beim Speichern', 'error');
    }
}

async function loadUserStats() {
    try {
        // Load recent games
        const gamesRef = ref(database, 'games');
        const snapshot = await get(gamesRef);
        
        if (!snapshot.exists()) return;
        
        const games = [];
        snapshot.forEach(child => {
            const game = child.val();
            if (game.players && game.players[currentUser.uid]) {
                games.push(game);
            }
        });
        
        // Sort by date
        games.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
        
        // Update stats
        updateStatsDisplay(games);
        
    } catch (error) {
        console.error('Stats laden Fehler:', error);
    }
}

function updateStatsDisplay(games) {
    const container = document.getElementById('recent-games-list');
    if (!container || games.length === 0) return;
    
    container.innerHTML = '';
    
    const recentGames = games.slice(0, 10);
    
    recentGames.forEach(game => {
        const profit = game.profits?.[currentUser.uid] || 0;
        const result = profit > 0 ? 'win' : (profit < 0 ? 'loss' : 'draw');
        
        const gameElement = document.createElement('div');
        gameElement.className = 'stat-game-item';
        gameElement.innerHTML = `
            <div class="game-stat-info">
                <div class="game-stat-mode">
                    <i class="fas fa-${game.mode === 'multiplayer' ? 'users' : 'user'}"></i>
                    ${game.mode === 'multiplayer' ? 'Multiplayer' : 'Solo'}
                </div>
                <div class="game-stat-time">${formatTime(game.endedAt)}</div>
            </div>
            <div class="game-stat-result">
                <span class="game-stat-number ${getNumberColor(game.winningNumber)}">
                    ${game.winningNumber}
                </span>
                <span class="game-stat-profit ${profit > 0 ? 'positive' : 'negative'}">
                    ${profit > 0 ? '+' : ''}${formatNumber(profit)}
                </span>
            </div>
        `;
        
        container.appendChild(gameElement);
    });
}

function setupEventListeners() {
    // Save profile button
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Wirklich abmelden?')) {
                await auth.signOut();
                window.location.href = 'index.html';
            }
        });
    }
    
    // Avatar preview
    const avatarInput = document.getElementById('profile-pic');
    if (avatarInput) {
        avatarInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('profile-avatar').src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// Utility Functions
function formatNumber(num) {
    return new Intl.NumberFormat('de-DE').format(num || 0);
}

function formatTime(timestamp) {
    if (!timestamp) return 'Vor kurzem';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    
    return new Date(timestamp).toLocaleDateString('de-DE');
}

function getNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
}

function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00ff88&color=000&bold=true&size=256`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `floating-notification ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 3000);
}

// Make functions available globally
window.saveProfile = saveProfile;