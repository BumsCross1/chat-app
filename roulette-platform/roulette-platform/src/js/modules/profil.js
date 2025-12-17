import { 
    auth, database, storage, onAuthStateChanged,
    ref, get, update, uploadBytes, getDownloadURL
} from '../../config/firebase.js';
import { 
    updateEmail, updatePassword, reauthenticateWithCredential, 
    EmailAuthProvider 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { formatNumber, showNotification, isValidEmail, getDefaultAvatar } from '../../utils.js';

class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.init();
    }
    
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    window.location.href = 'index.html';
                    return;
                }
                
                this.currentUser = user;
                await this.loadUserData();
                this.setupEventListeners();
                this.loadUserStats();
            });
        });
    }
    
    async loadUserData() {
        try {
            const snapshot = await get(ref(database, 'users/' + this.currentUser.uid));
            if (snapshot.exists()) {
                this.userData = snapshot.val();
                this.updateProfileUI();
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            showNotification('Profil konnte nicht geladen werden', 'error');
        }
    }
    
    updateProfileUI() {
        if (!this.userData) return;
        
        // Basic info
        const updateElement = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        updateElement('user-name', this.userData.username);
        updateElement('user-email', this.userData.email);
        
        // Avatar
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            profileAvatar.src = this.userData.profileImage || getDefaultAvatar(this.userData.username);
            profileAvatar.onerror = () => {
                profileAvatar.src = getDefaultAvatar(this.userData.username);
            };
        }
        
        // Stats
        updateElement('profile-chips', formatNumber(this.userData.chips || 0));
        
        const level = Math.floor((this.userData.xp || 0) / 1000) + 1;
        updateElement('profile-level', `Level ${level}`);
        
        updateElement('profile-games', this.userData.gamesPlayed || 0);
        updateElement('profile-wins', this.userData.gamesWon || 0);
        
        const winRate = this.userData.gamesPlayed > 0 
            ? Math.round((this.userData.gamesWon / this.userData.gamesPlayed) * 100) 
            : 0;
        updateElement('profile-winrate', `${winRate}%`);
        
        // Form values
        const usernameInput = document.getElementById('new-username');
        if (usernameInput) {
            usernameInput.value = this.userData.username;
            usernameInput.placeholder = this.userData.username;
        }
        
        const bioInput = document.getElementById('user-bio');
        if (bioInput) {
            bioInput.value = this.userData.bio || '';
            bioInput.placeholder = 'Erzähle etwas über dich...';
        }
        
        const emailInput = document.getElementById('user-email-input');
        if (emailInput) {
            emailInput.value = this.userData.email || '';
        }
    }
    
    async saveProfile() {
        const usernameInput = document.getElementById('new-username');
        const bioInput = document.getElementById('user-bio');
        const emailInput = document.getElementById('user-email-input');
        const passwordInput = document.getElementById('new-password');
        const avatarInput = document.getElementById('profile-pic');
        
        if (!usernameInput) return;
        
        const newUsername = usernameInput.value.trim();
        const newBio = bioInput?.value.trim() || '';
        const newEmail = emailInput?.value.trim() || '';
        const newPassword = passwordInput?.value || '';
        
        let hasChanges = false;
        const updates = {};
        
        // Validate username
        if (newUsername && newUsername !== this.userData.username) {
            if (newUsername.length < 3) {
                showNotification('Benutzername muss mindestens 3 Zeichen haben', 'error');
                return;
            }
            
            // Check if username is available
            const usernameSnap = await get(ref(database, 'usernames/' + newUsername.toLowerCase()));
            if (usernameSnap.exists() && usernameSnap.val().uid !== this.currentUser.uid) {
                showNotification('Benutzername bereits vergeben', 'error');
                return;
            }
            
            // Remove old username reference
            await update(ref(database, 'usernames/' + this.userData.username.toLowerCase()), null);
            
            // Add new username reference
            await update(ref(database, 'usernames/' + newUsername.toLowerCase()), {
                uid: this.currentUser.uid,
                updatedAt: Date.now()
            });
            
            updates.username = newUsername;
            hasChanges = true;
        }
        
        // Update bio
        if (newBio !== (this.userData.bio || '')) {
            updates.bio = newBio;
            hasChanges = true;
        }
        
        // Handle avatar upload
        if (avatarInput?.files?.[0]) {
            const avatarUrl = await this.uploadProfileImage(avatarInput.files[0]);
            if (avatarUrl) {
                updates.profileImage = avatarUrl;
                hasChanges = true;
            }
        }
        
        // Handle email change
        if (newEmail && newEmail !== this.userData.email) {
            if (!isValidEmail(newEmail)) {
                showNotification('Ungültige E-Mail-Adresse', 'error');
                return;
            }
            
            try {
                await updateEmail(auth.currentUser, newEmail);
                updates.email = newEmail;
                hasChanges = true;
                showNotification('E-Mail wurde aktualisiert', 'success');
            } catch (error) {
                console.error('Error updating email:', error);
                showNotification('Fehler beim Aktualisieren der E-Mail', 'error');
                return;
            }
        }
        
        // Handle password change
        if (newPassword) {
            if (newPassword.length < 6) {
                showNotification('Passwort muss mindestens 6 Zeichen haben', 'error');
                return;
            }
            
            try {
                await updatePassword(auth.currentUser, newPassword);
                showNotification('Passwort wurde aktualisiert', 'success');
                if (passwordInput) passwordInput.value = '';
            } catch (error) {
                console.error('Error updating password:', error);
                if (error.code === 'auth/requires-recent-login') {
                    showNotification('Bitte melde dich erneut an, um das Passwort zu ändern', 'warning');
                } else {
                    showNotification('Fehler beim Aktualisieren des Passworts', 'error');
                }
                return;
            }
        }
        
        // Save updates
        if (hasChanges) {
            try {
                await update(ref(database, 'users/' + this.currentUser.uid), updates);
                
                // Update local data
                this.userData = { ...this.userData, ...updates };
                
                // Update UI
                this.updateProfileUI();
                
                showNotification('Profil erfolgreich aktualisiert!', 'success');
                
                // Reload if username changed
                if (updates.username) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
                
            } catch (error) {
                console.error('Error saving profile:', error);
                showNotification('Fehler beim Speichern des Profils', 'error');
            }
        } else {
            showNotification('Keine Änderungen erkannt', 'info');
        }
    }
    
    async uploadProfileImage(file) {
        try {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Bild zu groß (max. 5MB)', 'error');
                return null;
            }
            
            // Check file type
            if (!file.type.match('image.*')) {
                showNotification('Nur Bilddateien erlaubt', 'error');
                return null;
            }
            
            showNotification('Bild wird hochgeladen...', 'info');
            
            // Create storage reference
            const imageRef = storageRef(storage, `profile_images/${this.currentUser.uid}/${Date.now()}_${file.name}`);
            
            // Upload file
            const snapshot = await uploadBytes(imageRef, file);
            
            // Get download URL
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            showNotification('Bild erfolgreich hochgeladen!', 'success');
            
            return downloadURL;
            
        } catch (error) {
            console.error('Error uploading image:', error);
            showNotification('Fehler beim Hochladen des Bildes', 'error');
            return null;
        }
    }
    
    async loadUserStats() {
        try {
            // Load recent games
            const gamesRef = ref(database, 'games');
            const snapshot = await get(gamesRef);
            
            if (!snapshot.exists()) return;
            
            const games = [];
            snapshot.forEach(child => {
                const game = child.val();
                if (game.userId === this.currentUser.uid) {
                    games.push(game);
                }
            });
            
            // Sort by date
            games.sort((a, b) => b.timestamp - a.timestamp);
            
            // Update stats display
            this.updateStatsDisplay(games);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    updateStatsDisplay(games) {
        const container = document.getElementById('recent-games-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (games.length === 0) {
            container.innerHTML = '<div class="no-data">Noch keine Spiele gespielt</div>';
            return;
        }
        
        const recentGames = games.slice(0, 10);
        
        recentGames.forEach(game => {
            const profit = game.win || 0;
            
            const gameElement = document.createElement('div');
            gameElement.className = 'stat-game-item';
            
            gameElement.innerHTML = `
                <div class="game-stat-info">
                    <div class="game-stat-mode">
                        <i class="fas fa-${game.mode === 'multiplayer' ? 'users' : 'user'}"></i>
                        ${game.mode === 'multiplayer' ? 'Multiplayer' : 'Solo'}
                    </div>
                    <div class="game-stat-time">${this.formatTime(game.timestamp)}</div>
                </div>
                <div class="game-stat-result">
                    <span class="game-stat-number ${this.getNumberColor(game.winningNumber)}">
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
    
    formatTime(timestamp) {
        if (!timestamp) return 'Vor kurzem';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Gerade eben';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
        
        return new Date(timestamp).toLocaleDateString('de-DE');
    }
    
    getNumberColor(number) {
        if (number === 0) return 'green';
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        return redNumbers.includes(number) ? 'red' : 'black';
    }
    
    setupEventListeners() {
        // Save profile button
        const saveBtn = document.getElementById('save-profile-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveProfile());
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
        const avatarPreview = document.getElementById('profile-avatar');
        
        if (avatarInput && avatarPreview) {
            avatarInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    // Preview image
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        avatarPreview.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // Delete account button (with safety confirmation)
        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('ACHTUNG: Account wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
                    const password = prompt('Bitte bestätige mit deinem Passwort:');
                    if (!password) return;
                    
                    try {
                        // Re-authenticate user
                        const credential = EmailAuthProvider.credential(
                            auth.currentUser.email, 
                            password
                        );
                        
                        await reauthenticateWithCredential(auth.currentUser, credential);
                        
                        // Mark as deleted (soft delete)
                        await update(ref(database, `users/${this.currentUser.uid}`), {
                            isDeleted: true,
                            deletedAt: Date.now(),
                            username: `Gelöschter Benutzer_${this.currentUser.uid.substring(0, 8)}`,
                            email: null,
                            profileImage: null,
                            isActive: false
                        });
                        
                        // Delete from usernames
                        if (this.userData.username) {
                            await update(ref(database, `usernames/${this.userData.username.toLowerCase()}`), null);
                        }
                        
                        // Sign out
                        await auth.signOut();
                        
                        showNotification('Account erfolgreich gelöscht', 'success');
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 2000);
                        
                    } catch (error) {
                        console.error('Error deleting account:', error);
                        if (error.code === 'auth/wrong-password') {
                            showNotification('Falsches Passwort', 'error');
                        } else {
                            showNotification('Fehler beim Löschen des Accounts', 'error');
                        }
                    }
                }
            });
        }
    }
}

// Initialize profile manager
const profileManager = new ProfileManager();

// Make functions globally available
window.saveProfile = () => profileManager.saveProfile();