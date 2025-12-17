import {
    auth,
    database,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    ref,
    set,
    get
} from '../config/firebase.js';

class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        // Tab-Switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Form Submission
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Password toggle
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const input = e.target.closest('.input-group').querySelector('input');
                const icon = e.target.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        });

        // Check auth state
        onAuthStateChanged(auth, (user) => {
            if (user && !window.location.pathname.includes('index.html')) {
                window.location.href = '/dashboard.html';
            }
        });
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');

        // Update active form
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${tabName}-form`).classList.add('active');

        // Clear messages
        this.showMessage('', '');
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const button = document.getElementById('login-form').querySelector('button[type="submit"]');

        if (!email || !password) {
            this.showMessage('Bitte alle Felder ausfüllen', 'error');
            return;
        }

        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Einloggen...';

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // Update last login
            await set(ref(database, `users/${userCredential.user.uid}/lastLogin`), Date.now());
            
            this.showMessage('Erfolgreich eingeloggt!', 'success');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            
            let message = 'Login fehlgeschlagen';
            if (error.code === 'auth/user-not-found') {
                message = 'Benutzer nicht gefunden';
            } else if (error.code === 'auth/wrong-password') {
                message = 'Falsches Passwort';
            } else if (error.code === 'auth/too-many-requests') {
                message = 'Zu viele Fehlversuche. Bitte später erneut versuchen.';
            }
            
            this.showMessage(message, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Einloggen';
        }
    }

    async handleRegister() {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;
        const button = document.getElementById('register-form').querySelector('button[type="submit"]');

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            this.showMessage('Bitte alle Felder ausfüllen', 'error');
            return;
        }

        if (username.length < 3) {
            this.showMessage('Benutzername muss mindestens 3 Zeichen haben', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Passwort muss mindestens 6 Zeichen haben', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwörter stimmen nicht überein', 'error');
            return;
        }

        try {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Konto wird erstellt...';

            // Check if username exists
            const usernameSnapshot = await get(ref(database, `usernames/${username.toLowerCase()}`));
            if (usernameSnapshot.exists()) {
                this.showMessage('Benutzername bereits vergeben', 'error');
                return;
            }

            // Create user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const userId = userCredential.user.uid;

            // Create user data
            const userData = {
                uid: userId,
                username: username,
                email: email,
                chips: 10000,
                level: 1,
                xp: 0,
                gamesPlayed: 0,
                gamesWon: 0,
                totalWinnings: 0,
                totalLosses: 0,
                winStreak: 0,
                highestWin: 0,
                profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4CAF50&color=fff&size=256`,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                lastBonus: null,
                isOnline: true,
                role: 'user'
            };

            // Save user data
            await set(ref(database, `users/${userId}`), userData);
            
            // Save username reference
            await set(ref(database, `usernames/${username.toLowerCase()}`), {
                uid: userId,
                createdAt: Date.now()
            });

            this.showMessage('Konto erfolgreich erstellt!', 'success');
            
            // Auto login
            setTimeout(() => {
                this.handleLogin();
            }, 1500);

        } catch (error) {
            console.error('Register error:', error);
            
            let message = 'Registrierung fehlgeschlagen';
            if (error.code === 'auth/email-already-in-use') {
                message = 'E-Mail bereits registriert';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Ungültige E-Mail-Adresse';
            } else if (error.code === 'auth/weak-password') {
                message = 'Passwort zu schwach';
            }
            
            this.showMessage(message, 'error');
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Konto erstellen';
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('auth-message');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');
        
        if (text) {
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }
}

// Initialize auth manager
new AuthManager();