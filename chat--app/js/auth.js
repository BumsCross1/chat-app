// Enhanced Auth System - OHNE DEMO ACCOUNT
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const registerEmail = document.getElementById('register-email');
const registerPassword = document.getElementById('register-password');
const registerDisplayname = document.getElementById('register-displayname');
const errorMsg = document.getElementById('error-msg');

function showError(message) {
    if (!errorMsg) return;
    
    errorMsg.textContent = message;
    errorMsg.className = 'error-message';
    errorMsg.style.display = 'block';
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    if (!errorMsg) return;
    
    errorMsg.textContent = message;
    errorMsg.className = 'success-message';
    errorMsg.style.display = 'block';
    
    setTimeout(() => {
        errorMsg.style.display = 'none';
    }, 3000);
}

function showLoading(button) {
    const originalText = button.textContent;
    button.innerHTML = '<div class="spinner"></div> Wird geladen...';
    button.disabled = true;
    return () => {
        button.textContent = originalText;
        button.disabled = false;
    };
}

loginBtn?.addEventListener('click', async () => {
    const resetButton = showLoading(loginBtn);
    
    try { 
        const userCredential = await auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value);
        const user = userCredential.user;
        
        // User Daten in Firebase aktualisieren
        await db.ref('users/' + user.uid).update({
            lastLogin: Date.now(),
            status: 'online'
        });
        
        showSuccess('🚀 Login erfolgreich!');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
        
    } catch(error){ 
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
            default:
                errorMessage += error.message;
        }
        
        showError(errorMessage);
        resetButton();
    }
});

registerBtn?.addEventListener('click', async () => {
    const resetButton = showLoading(registerBtn);
    
    if (registerPassword.value.length < 6) {
        showError('Passwort muss mindestens 6 Zeichen lang sein!');
        resetButton();
        return;
    }
    
    if (!registerEmail.value) {
        showError('Bitte Email-Adresse eingeben!');
        resetButton();
        return;
    }
    
    try { 
        const userCredential = await auth.createUserWithEmailAndPassword(registerEmail.value, registerPassword.value);
        const user = userCredential.user;
        
        // Display Name setzen falls angegeben
        if (registerDisplayname.value) {
            await user.updateProfile({
                displayName: registerDisplayname.value
            });
        }
        
        // User in Firebase Database speichern
        await db.ref('users/' + user.uid).set({
            email: user.email,
            displayName: registerDisplayname.value || user.email,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            status: 'online',
            avatar: null
        });
        
        showSuccess('🎉 Account erfolgreich erstellt!');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch(error){ 
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
            default:
                errorMessage += error.message;
        }
        
        showError(errorMessage);
        resetButton();
    }
});

// Enter Taste Support
[loginEmail, loginPassword, registerEmail, registerPassword, registerDisplayname].forEach(input => {
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (input.id.includes('login')) {
                loginBtn.click();
            } else {
                registerBtn.click();
            }
        }
    });
});

// Passwort Sichtbarkeit Toggle
function initPasswordToggle() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    
    passwordInputs.forEach(input => {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.innerHTML = '👁️';
        toggle.style.cssText = `
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.1rem;
        `;
        
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
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
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggle();
    
    // Prüfen ob User bereits eingeloggt ist
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Automatisch zum Dashboard weiterleiten wenn bereits eingeloggt
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    });
});