// /js/modules/user.js
import { auth, db, currentUser, userData, doc, getDoc, updateDoc, serverTimestamp } from '../config/firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserProfile();
        setupEventListeners();
    });
});

async function loadUserProfile() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
            userData = userDoc.data();
            
            // UI aktualisieren
            document.getElementById('user-name').textContent = userData.username || 'Benutzer';
            document.getElementById('welcome-name').textContent = userData.username || 'Benutzer';
            document.getElementById('user-chips').textContent = formatNumber(userData.chips || 0);
            document.getElementById('total-chips').textContent = formatNumber(userData.chips || 0);
            
            // Avatar
            const avatar = document.getElementById('user-avatar');
            if (userData.profileImage) {
                avatar.src = userData.profileImage;
            } else {
                avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username || 'User')}&background=00ff88&color=000`;
            }
            
            // Bonus Timer starten
            startBonusTimer();
        }
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        showNotification('Fehler beim Laden der Benutzerdaten', 'error');
    }
}

function setupEventListeners() {
    // Logout Button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
    
    // Daily Bonus Button
    document.getElementById('daily-bonus-btn')?.addEventListener('click', claimDailyBonus);
}

function startBonusTimer() {
    let timeLeft = 600; // 10 Minuten
    
    function updateTimer() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const timerElement = document.getElementById('bonus-timer');
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            grantBonusChips();
            timeLeft = 600;
        } else {
            timeLeft--;
            setTimeout(updateTimer, 1000);
        }
    }
    
    updateTimer();
}

async function grantBonusChips() {
    try {
        const bonusAmount = 250;
        const newChips = (userData.chips || 0) + bonusAmount;
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            chips: newChips,
            lastBonusTime: Date.now()
        });
        
        userData.chips = newChips;
        updateChipsDisplay(newChips);
        showNotification(`+${bonusAmount} Bonus-Chips erhalten!`, 'success');
        
    } catch (error) {
        console.error('Fehler beim Bonus:', error);
    }
}

async function claimDailyBonus() {
    try {
        const today = new Date().toDateString();
        const lastBonus = userData.lastDailyBonus;
        
        if (lastBonus && new Date(lastBonus.seconds * 1000).toDateString() === today) {
            showNotification('Täglicher Bonus bereits abgeholt', 'warning');
            return;
        }
        
        const bonusAmount = 1000;
        const newChips = (userData.chips || 0) + bonusAmount;
        
        await updateDoc(doc(db, 'users', currentUser.uid), {
            chips: newChips,
            lastDailyBonus: serverTimestamp()
        });
        
        userData.chips = newChips;
        updateChipsDisplay(newChips);
        
        const bonusBtn = document.getElementById('daily-bonus-btn');
        if (bonusBtn) {
            bonusBtn.disabled = true;
            bonusBtn.innerHTML = '<i class="fas fa-check"></i> Bonus abgeholt';
        }
        
        showNotification(`Täglicher Bonus: +${bonusAmount} Chips!`, 'success');
        
    } catch (error) {
        console.error('Fehler beim täglichen Bonus:', error);
        showNotification('Fehler beim Abholen', 'error');
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
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Globale Funktionen verfügbar machen
window.updateChipsDisplay = updateChipsDisplay;
window.formatNumber = formatNumber;
window.showNotification = showNotification;