// /js/modules/user.js - REALTIME DATABASE VERSION
import { 
    auth, database,
    onAuthStateChanged, signOut,
    ref, get, update, remove, set
} from '../config/firebase.js';

// Lokale Variablen
let currentUser = null;
let userData = null;
let bonusInterval = null;

// Hilfsfunktionen
function formatNumber(num) {
    return num.toLocaleString('de-DE');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `floating-notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Hauptinitialisierung
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
            return;
        }
        
        currentUser = user;
        await loadUserData();
        setupEventListeners();
        
        // Bonus Timer starten
        startBonusTimer();
    });
});

async function loadUserData() {
    try {
        const userSnapshot = await get(ref(database, 'users/' + currentUser.uid));
        
        if (userSnapshot.exists()) {
            userData = userSnapshot.val();
            // Lokal speichern für Offline-Modus
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('lastSync', Date.now().toString());
            updateUI();
        } else {
            // Benutzerdokument erstellen falls nicht existiert
            const defaultData = {
                uid: currentUser.uid,
                username: currentUser.email?.split('@')[0] || 'Spieler',
                email: currentUser.email,
                chips: 10000,
                level: 1,
                xp: 0,
                gamesPlayed: 0,
                gamesWon: 0,
                totalWinnings: 0,
                friendCount: 0,
                profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email?.split('@')[0] || 'User')}&background=00ff88&color=000`,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                lastDailyBonus: null,
                lastBonusTime: Date.now()
            };
            
            try {
                await set(ref(database, 'users/' + currentUser.uid), defaultData);
                userData = defaultData;
                localStorage.setItem('userData', JSON.stringify(userData));
                updateUI();
                showNotification('Profil erfolgreich erstellt!', 'success');
            } catch (error) {
                console.error('Fehler beim Erstellen des Profils:', error);
                // Offline-Fallback
                userData = defaultData;
                updateUI();
                showNotification('Offline-Modus: Lokales Profil geladen', 'warning');
            }
        }
    } catch (error) {
        console.error('Fehler beim Laden der Benutzerdaten:', error);
        
        // Offline-Fallback: Lade lokale Daten
        const savedData = localStorage.getItem('userData');
        if (savedData) {
            userData = JSON.parse(savedData);
            updateUI();
            showNotification('Offline-Modus: Lokale Daten geladen', 'warning');
        } else {
            // Notfall-Daten
            userData = {
                username: 'Spieler',
                chips: 10000,
                level: 1
            };
            updateUI();
            showNotification('Verwende Standarddaten', 'info');
        }
    }
}

function updateUI() {
    if (!userData) return;
    
    // Name
    const usernameElements = [
        document.getElementById('user-name'),
        document.getElementById('welcome-name')
    ];
    usernameElements.forEach(el => {
        if (el) el.textContent = userData.username || 'Spieler';
    });
    
    // Chips
    const chipsElements = [
        document.getElementById('user-chips'),
        document.getElementById('total-chips'),
        document.getElementById('player-chips')
    ];
    chipsElements.forEach(el => {
        if (el) el.textContent = formatNumber(userData.chips || 0);
    });
    
    // Avatar
    const avatar = document.getElementById('user-avatar');
    if (avatar) {
        avatar.src = userData.profileImage || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username || 'User')}&background=00ff88&color=000`;
    }
    
    // Level
    const levelElement = document.getElementById('user-level');
    if (levelElement) {
        levelElement.textContent = Math.floor((userData.xp || 0) / 1000) + 1;
    }
}

function setupEventListeners() {
    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (bonusInterval) clearInterval(bonusInterval);
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            });
        });
    }
    
    // Daily Bonus Button
    const dailyBonusBtn = document.getElementById('daily-bonus-btn');
    if (dailyBonusBtn) {
        dailyBonusBtn.addEventListener('click', claimDailyBonus);
    }
}

function startBonusTimer() {
    if (bonusInterval) clearInterval(bonusInterval);
    
    let timeLeft = 600;
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const timerElement = document.getElementById('bonus-timer');
        if (timerElement) {
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            grantBonusChips();
            timeLeft = 600;
        } else {
            timeLeft--;
        }
    }
    
    updateTimer();
    bonusInterval = setInterval(updateTimer, 1000);
}

async function grantBonusChips() {
    try {
        const bonusAmount = 250;
        const newChips = (userData.chips || 0) + bonusAmount;
        userData.chips = newChips;
        
        updateChipsDisplay(newChips);
        showNotification(`+${bonusAmount} Bonus-Chips erhalten!`, 'success');
        
        // Online speichern
        if (navigator.onLine) {
            await update(ref(database, 'users/' + currentUser.uid), {
                chips: newChips,
                lastBonusTime: Date.now()
            });
        } else {
            // Lokal speichern für späteren Sync
            localStorage.setItem('pendingBonus', JSON.stringify({
                amount: bonusAmount,
                timestamp: Date.now()
            }));
        }
        
    } catch (error) {
        console.error('Fehler beim Bonus:', error);
        showNotification('Bonus konnte nicht gespeichert werden', 'warning');
    }
}

function updateChipsDisplay(chips) {
    const elements = [
        document.getElementById('user-chips'),
        document.getElementById('total-chips'),
        document.getElementById('player-chips')
    ];
    
    elements.forEach(el => {
        if (el) el.textContent = formatNumber(chips);
    });
}

async function claimDailyBonus() {
    try {
        const today = new Date().toDateString();
        const lastBonus = userData.lastDailyBonus;
        
        if (lastBonus && new Date(lastBonus).toDateString() === today) {
            showNotification('Täglicher Bonus wurde bereits abgeholt!', 'warning');
            return;
        }
        
        const bonusAmount = 1000;
        const newChips = (userData.chips || 0) + bonusAmount;
        userData.chips = newChips;
        userData.lastDailyBonus = Date.now();
        
        updateChipsDisplay(newChips);
        
        const dailyBonusBtn = document.getElementById('daily-bonus-btn');
        if (dailyBonusBtn) {
            dailyBonusBtn.disabled = true;
            dailyBonusBtn.innerHTML = '<i class="fas fa-check"></i> Bonus abgeholt';
        }
        
        showNotification(`Täglicher Bonus: +${bonusAmount} Chips!`, 'success');
        
        // Online speichern
        if (navigator.onLine) {
            await update(ref(database, 'users/' + currentUser.uid), {
                chips: newChips,
                lastDailyBonus: Date.now()
            });
        } else {
            // Lokal speichern
            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('pendingDailyBonus', 'true');
        }
        
    } catch (error) {
        console.error('Fehler beim täglichen Bonus:', error);
        showNotification('Fehler beim Abholen des Bonus', 'error');
    }
}

// Sync-Funktion für offline Änderungen
async function syncOfflineChanges() {
    if (!navigator.onLine || !currentUser) return;
    
    try {
        const pendingBonus = localStorage.getItem('pendingBonus');
        const pendingDailyBonus = localStorage.getItem('pendingDailyBonus');
        
        if (pendingBonus) {
            const bonusData = JSON.parse(pendingBonus);
            await update(ref(database, 'users/' + currentUser.uid), {
                chips: userData.chips,
                lastBonusTime: bonusData.timestamp
            });
            localStorage.removeItem('pendingBonus');
        }
        
        if (pendingDailyBonus) {
            await update(ref(database, 'users/' + currentUser.uid), {
                chips: userData.chips,
                lastDailyBonus: userData.lastDailyBonus
            });
            localStorage.removeItem('pendingDailyBonus');
        }
        
        // Speichere aktuelle Daten
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('lastSync', Date.now().toString());
        
    } catch (error) {
        console.error('Fehler beim Synchronisieren:', error);
    }
}

// Automatische Sync bei Netzwerkverbindung
window.addEventListener('online', syncOfflineChanges);

// Globale Funktionen
window.formatNumber = formatNumber;
window.showNotification = showNotification;
window.updateChipsDisplay = updateChipsDisplay;
window.claimDailyBonus = claimDailyBonus;