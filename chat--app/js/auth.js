// Warte auf Firebase Initialisierung
function waitForFirebase() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (typeof firebase !== 'undefined' && 
                firebase.auth && 
                firebase.database && 
                window.db) {
                console.log('✅ Firebase vollständig geladen');
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

// DOM Elemente
let loginBtn, registerBtn, loginEmail, loginPassword;
let registerEmail, registerPassword, registerDisplayname, errorMsg;

// Initialize Auth System
async function initAuth() {
    console.log('🔧 Initialisiere Auth System...');
    
    // Warte auf Firebase
    await waitForFirebase();
    
    // Elemente finden
    loginBtn = document.getElementById('login-btn');
    registerBtn = document.getElementById('register-btn');
    loginEmail = document.getElementById('login-email');
    loginPassword = document.getElementById('login-password');
    registerEmail = document.getElementById('register-email');
    registerPassword = document.getElementById('register-password');
    registerDisplayname = document.getElementById('register-displayname');
    errorMsg = document.getElementById('error-msg');
    
    console.log('🔍 Gefundene Elemente:', {
        loginBtn: !!loginBtn,
        registerBtn: !!registerBtn,
        loginEmail: !!loginEmail,
        loginPassword: !!loginPassword,
        registerEmail: !!registerEmail,
        registerPassword: !!registerPassword,
        registerDisplayname: !!registerDisplayname
    });
    
    // Event Listener setzen
    setupEventListeners();
    
    // Prüfe ob User bereits eingeloggt ist
    checkExistingUser();
    
    console.log('✅ Auth System initialisiert');
}

// Event Listeners
function setupEventListeners() {
    // Login Button
    if (loginBtn) {
        console.log('➕ Login Button Event Listener');
        loginBtn.addEventListener('click', handleLogin);
    } else {
        console.error('❌ Login Button nicht gefunden');
    }
    
    // Register Button
    if (registerBtn) {
        console.log('➕ Register Button Event Listener');
        registerBtn.addEventListener('click', handleRegister);
    } else {
        console.error('❌ Register Button nicht gefunden');
    }
    
    // Enter Taste Support
    setupEnterKeySupport();
    
    // Password Toggle
    initPasswordToggle();
}

// Login Handler
async function handleLogin() {
    console.log('🚀 Login gestartet...');
    
    if (!loginEmail || !loginPassword) {
        showError('❌ Login-Felder nicht gefunden');
        return;
    }
    
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    
    // Validierung
    if (!email) {
        showError('Bitte Email eingeben');
        return;
    }
    
    if (!password) {
        showError('Bitte Passwort eingeben');
        return;
    }
    
    // UI Feedback
    const originalText = loginBtn.textContent;
    loginBtn.innerHTML = '<div class="spinner"></div> Wird geladen...';
    loginBtn.disabled = true;
    
    try {
        console.log('📤 Login versuch:', email);
        
        // Firebase Login
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('✅ Login erfolgreich:', user.email);
        
        // User in Database erstellen/updaten
        await createOrUpdateUserInDatabase(user);
        
        showSuccess('🚀 Login erfolgreich!');
        
        // Weiterleitung nach kurzer Verzögerung
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
        
    } catch(error) {
        console.error('❌ Login Fehler:', error);
        
        let errorMessage = 'Login fehlgeschlagen! ';
        
        switch(error.code) {
            case 'auth/invalid-email':
                errorMessage += 'Ungültige Email-Adresse.';
                break;
            case 'auth/user-disabled':
                errorMessage += 'Dieser Account wurde deaktiviert.';
                break;
            case 'auth/user-not-found':
                errorMessage += 'Kein Account mit dieser Email gefunden.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Falsches Passwort.';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Zu viele fehlgeschlagene Versuche. Bitte später erneut versuchen.';
                break;
            default:
                errorMessage += error.message;
        }
        
        showError(errorMessage);
        
        // Button zurücksetzen
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
}

// Register Handler
async function handleRegister() {
    console.log('🚀 Registrierung gestartet...');
    
    if (!registerEmail || !registerPassword || !registerDisplayname) {
        showError('❌ Registrierungs-Felder nicht gefunden');
        return;
    }
    
    const email = registerEmail.value.trim();
    const password = registerPassword.value;
    const displayName = registerDisplayname.value.trim();
    
    // Validierung
    if (!email) {
        showError('Bitte Email eingeben');
        return;
    }
    
    if (!password) {
        showError('Bitte Passwort eingeben');
        return;
    }
    
    if (password.length < 6) {
        showError('Passwort muss mindestens 6 Zeichen lang sein');
        return;
    }
    
    if (!displayName) {
        showError('Bitte Anzeigenamen eingeben');
        return;
    }
    
    // UI Feedback
    const originalText = registerBtn.textContent;
    registerBtn.innerHTML = '<div class="spinner"></div> Wird erstellt...';
    registerBtn.disabled = true;
    
    try {
        console.log('📤 Registrierungs versuch:', email);
        
        // 1. Firebase Account erstellen
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('✅ Firebase Account erstellt:', user.uid);
        
        // 2. Display Name setzen
        await user.updateProfile({
            displayName: displayName
        });
        
        console.log('✅ Display Name gesetzt:', displayName);
        
        // 3. User in Database erstellen
        await createOrUpdateUserInDatabase(user, displayName);
        
        showSuccess('🎉 Account erfolgreich erstellt!');
        
        // Weiterleitung nach kurzer Verzögerung
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch(error) {
        console.error('❌ Registrierungs Fehler:', error);
        
        let errorMessage = 'Registrierung fehlgeschlagen! ';
        
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Diese Email wird bereits verwendet.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Ungültige Email-Adresse.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage += 'Registrierung ist momentan nicht möglich.';
                break;
            case 'auth/weak-password':
                errorMessage += 'Passwort ist zu schwach.';
                break;
            case 'auth/network-request-failed':
                errorMessage += 'Netzwerkfehler. Bitte Internetverbindung prüfen.';
                break;
            default:
                errorMessage += error.message;
        }
        
        showError(errorMessage);
        
        // Button zurücksetzen
        registerBtn.textContent = originalText;
        registerBtn.disabled = false;
    }
}

// User in Firebase Database erstellen/updaten
async function createOrUpdateUserInDatabase(user, customDisplayName = null) {
    console.log('💾 Speichere User in Database:', user.email);
    
    try {
        const userData = {
            email: user.email,
            displayName: customDisplayName || user.displayName || user.email,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            lastUpdated: Date.now(),
            status: 'online',
            avatar: null,
            messageCount: 0,
            roomsCreated: 0,
            reactionsReceived: 0,
            friendsCount: 0
        };
        
        // Schreibe in Firebase Database
        await firebase.database().ref('users/' + user.uid).set(userData);
        
        console.log('✅ User in Database gespeichert');
        return true;
        
    } catch (error) {
        console.error('❌ Fehler beim Speichern in Database:', error);
        
        // Versuche Alternative falls db nicht verfügbar
        try {
            // Alternative: Local Storage als Backup
            localStorage.setItem(`user_${user.uid}`, JSON.stringify({
                email: user.email,
                displayName: customDisplayName || user.displayName || user.email,
                createdAt: Date.now()
            }));
            console.log('⚠️ User in LocalStorage gespeichert (Fallback)');
            return true;
        } catch (e) {
            console.error('❌ Auch LocalStorage Fehler:', e);
            return false;
        }
    }
}

// Check if user is already logged in
function checkExistingUser() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('👤 User bereits eingeloggt:', user.email);
            
            // Automatisch zum Dashboard weiterleiten wenn bereits eingeloggt
            setTimeout(() => {
                if (window.location.pathname.includes('index.html')) {
                    window.location.href = 'dashboard.html';
                }
            }, 1000);
        } else {
            console.log('👋 Kein User eingeloggt');
        }
    });
}

// Error/Message Handling
function showError(message) {
    console.error('❌ Fehler:', message);
    
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.className = 'error-message';
        errorMsg.style.display = 'block';
        
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 5000);
    } else {
        // Fallback: Alert
        alert(message);
    }
}

function showSuccess(message) {
    console.log('✅ Erfolg:', message);
    
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.className = 'success-message';
        errorMsg.style.display = 'block';
        
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 3000);
    }
}

// Enter Key Support
function setupEnterKeySupport() {
    const inputs = [
        loginEmail, loginPassword, 
        registerEmail, registerPassword, registerDisplayname
    ];
    
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    
                    if (input.id.includes('login')) {
                        if (loginBtn) loginBtn.click();
                    } else {
                        if (registerBtn) registerBtn.click();
                    }
                }
            });
        }
    });
}

// Password Toggle
function initPasswordToggle() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    passwordInputs.forEach(input => {
        if (!input.parentElement.classList.contains('password-toggle-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'password-toggle-wrapper';
            wrapper.style.position = 'relative';
            
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.innerHTML = '👁️';
            toggle.className = 'password-toggle-btn';
            
            toggle.style.cssText = `
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                cursor: pointer;
                font-size: 1.1rem;
                padding: 4px;
                z-index: 10;
            `;
            
            // Wrap input with toggle button
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);
            wrapper.appendChild(toggle);
            
            toggle.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.innerHTML = '🔒';
                } else {
                    input.type = 'password';
                    toggle.innerHTML = '👁️';
                }
            });
        }
    });
}

// Tab Switching
function showTab(tabName) {
    console.log('📱 Wechsel zu Tab:', tabName);
    
    // Tabs aktivieren/deaktivieren
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Tab Content anzeigen/verstecken
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Aktiven Tab setzen
    const activeTab = document.querySelector(`.tab:nth-child(${tabName === 'login' ? 1 : 2})`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Content anzeigen
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 DOM geladen, starte Auth Initialisierung...');
    
    // Setze Tab Funktion global
    window.showTab = showTab;
    
    // Starte Auth System
    initAuth().catch(error => {
        console.error('❌ Kritischer Fehler bei Auth Initialisierung:', error);
        showError('Systemfehler: ' + error.message);
    });
});