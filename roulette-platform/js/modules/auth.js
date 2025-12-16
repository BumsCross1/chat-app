import { auth, database, ref, set, get } from '../config/firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

const ADMIN_EMAIL = "martinherklotzt02@gmail.com";

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            showTab(tabName);
        });
    });

    // Login
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    // Register
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', handleRegister);
    }
});

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('error-msg');

    if (!email || !password) {
        showError('Bitte fülle alle Felder aus');
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check if admin
        if (email === ADMIN_EMAIL) {
            await update(ref(database, `users/${user.uid}`), {
                isAdmin: true,
                role: 'admin',
                lastLogin: Date.now()
            });
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Login error:', error);
        switch(error.code) {
            case 'auth/invalid-email':
                showError('Ungültige E-Mail-Adresse');
                break;
            case 'auth/user-not-found':
                showError('Benutzer nicht gefunden');
                break;
            case 'auth/wrong-password':
                showError('Falsches Passwort');
                break;
            default:
                showError('Login fehlgeschlagen');
        }
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const errorMsg = document.getElementById('error-msg');

    if (!username || !email || !password) {
        showError('Bitte fülle alle Felder aus');
        return;
    }

    if (password.length < 6) {
        showError('Passwort muss mindestens 6 Zeichen haben');
        return;
    }

    if (username.length < 3) {
        showError('Benutzername muss mindestens 3 Zeichen haben');
        return;
    }

    try {
        // Check username availability
        const usernameSnapshot = await get(ref(database, `usernames/${username.toLowerCase()}`));
        if (usernameSnapshot.exists()) {
            showError('Benutzername bereits vergeben');
            return;
        }

        // Create user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if admin
        const isAdmin = email === ADMIN_EMAIL;

        // Create user data
        const userData = {
            uid: user.uid,
            username: username,
            email: email,
            chips: 10000,
            level: 1,
            xp: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            totalWinnings: 0,
            friendCount: 0,
            profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00ff88&color=000&size=256`,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            isAdmin: isAdmin,
            role: isAdmin ? 'admin' : 'user',
            isActive: true,
            lastDailyBonus: null,
            lastBonusTime: Date.now(),
            winStreak: 0,
            highestWin: 0
        };

        // Save to database
        await Promise.all([
            set(ref(database, `users/${user.uid}`), userData),
            set(ref(database, `usernames/${username.toLowerCase()}`), {
                uid: user.uid,
                createdAt: Date.now()
            })
        ]);

        showError('Registrierung erfolgreich!', 'success');
        
        // Redirect based on role
        setTimeout(() => {
            if (isAdmin) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 1500);

    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showError('E-Mail bereits registriert');
        } else if (error.code === 'auth/weak-password') {
            showError('Passwort zu schwach');
        } else {
            showError('Registrierung fehlgeschlagen');
        }
    }
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Show selected tab
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function showError(message, type = 'error') {
    const errorEl = document.getElementById('error-msg');
    if (!errorEl) return;
    
    errorEl.textContent = message;
    errorEl.className = type === 'success' ? 'success-message' : 'error-message';
    errorEl.style.display = 'block';
    
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}