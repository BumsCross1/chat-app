// /js/modules/auth.js
import { auth, db, doc, setDoc, getDoc, serverTimestamp } from '../config/firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const errorMsg = document.getElementById('error-msg');
    const tabs = document.querySelectorAll('.tab');

    // Tab-Wechsel
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Tabs aktualisieren
            tabs.forEach(t => {
                t.classList.remove('active');
                document.getElementById(`${t.getAttribute('data-tab')}-tab`).classList.add('hidden');
            });
            
            tab.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');
        });
    });

    // Login
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showError('Bitte alle Felder ausfüllen');
                return;
            }
            
            try {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Einloggen...';
                
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Weiterleitung
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Einloggen';
                
                switch(error.code) {
                    case 'auth/invalid-email':
                        showError('Ungültige E-Mail');
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
        });
    }

    // Registrierung
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = document.getElementById('register-username').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            
            if (!username || !email || !password) {
                showError('Bitte alle Felder ausfüllen');
                return;
            }
            
            if (password.length < 6) {
                showError('Passwort muss mindestens 6 Zeichen haben');
                return;
            }
            
            try {
                registerBtn.disabled = true;
                registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registriere...';
                
                // 1. Username prüfen
                const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
                if (usernameDoc.exists()) {
                    throw new Error('Benutzername bereits vergeben');
                }
                
                // 2. Benutzer erstellen
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // 3. Benutzerdaten speichern
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
                    profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00ff88&color=000`,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    lastDailyBonus: null,
                    lastBonusTime: Date.now()
                };
                
                await setDoc(doc(db, 'users', user.uid), userData);
                await setDoc(doc(db, 'usernames', username.toLowerCase()), { 
                    uid: user.uid,
                    createdAt: serverTimestamp()
                });
                
                // Weiterleitung
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                registerBtn.disabled = false;
                registerBtn.innerHTML = 'Registrieren';
                
                if (error.message === 'Benutzername bereits vergeben') {
                    showError(error.message);
                } else if (error.code === 'auth/email-already-in-use') {
                    showError('E-Mail bereits registriert');
                } else {
                    showError('Registrierung fehlgeschlagen');
                }
            }
        });
    }

    function showError(message) {
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
    }
});