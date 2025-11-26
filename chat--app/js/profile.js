// Enhanced Profile Management
const displayNameInput = document.getElementById('displayName');
const saveBtn = document.getElementById('save-btn');
const backBtn = document.getElementById('back-btn');
const msgDiv = document.getElementById('msg');

// Initialize profile data
async function initProfile() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    displayNameInput.value = user.displayName || '';
    
    // Load user stats
    try {
        const snapshot = await db.ref(`users/${user.uid}`).once('value');
        const userData = snapshot.val() || {};
        
        document.getElementById('stat-messages').textContent = userData.messageCount || '0';
        document.getElementById('stat-rooms').textContent = userData.roomsCreated || '0';
        
        // Load avatar
        if (userData.avatar) {
            document.getElementById('profile-avatar').src = userData.avatar;
        }
    } catch (error) {
        console.error('Error loading profile data:', error);
    }
}

saveBtn?.addEventListener('click', async () => {
    try {
        const user = auth.currentUser;
        const displayName = displayNameInput.value.trim();
        
        if (!displayName) {
            showMessage('Bitte einen Anzeigenamen eingeben', 'error');
            return;
        }
        
        await user.updateProfile({
            displayName: displayName
        });
        
        // Update in Firebase Database
        await db.ref(`users/${user.uid}`).update({
            displayName: displayName,
            lastUpdated: Date.now()
        });
        
        showMessage('✅ Profil erfolgreich gespeichert!', 'success');
        
    } catch(error) { 
        showMessage('❌ Fehler: ' + error.message, 'error');
    }
});

backBtn?.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
});

// Avatar upload handling
document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showMessage('❌ Bitte nur Bilder hochladen!', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showMessage('❌ Bild darf nicht größer als 2MB sein!', 'error');
        return;
    }
    
    try {
        const base64 = await fileToBase64(file);
        document.getElementById('profile-avatar').src = base64;
        
        // Save to Firebase
        const user = auth.currentUser;
        await db.ref(`users/${user.uid}/avatar`).set(base64);
        
        showMessage('✅ Avatar erfolgreich aktualisiert!', 'success');
        e.target.value = '';
        
    } catch (error) {
        showMessage('❌ Fehler beim Hochladen: ' + error.message, 'error');
    }
});

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function showMessage(text, type = 'info') {
    if (!msgDiv) return;
    
    msgDiv.textContent = text;
    msgDiv.className = `notification notification-${type}`;
    msgDiv.style.display = 'block';
    
    setTimeout(() => {
        msgDiv.style.display = 'none';
    }, 5000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            initProfile();
        } else {
            window.location.href = 'index.html';
        }
    });
});