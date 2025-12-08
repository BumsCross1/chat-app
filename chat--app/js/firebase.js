const firebaseConfig = {
    apiKey: "AIzaSyADnEf86hwyA9zShMnl0FlGLuA4Y5YBMbA",
    authDomain: "admin-7d641.firebaseapp.com",
    databaseURL: "https://admin-7d641-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "admin-7d641",
    storageBucket: "admin-7d641.firebasestorage.app",
    messagingSenderId: "900778327004",
    appId: "1:900778327004:web:cdfe1d609753094e72ed19",
    measurementId: "G-FM2YWSRFGD"
};

// Initialisierung
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    window.firebaseApp = firebase.app();
    window.auth = firebase.auth();
    window.db = firebase.database();
    
    console.log('🔥 Firebase initialisiert');
    
    // Avatar Generator
    window.generateAvatar = function(name) {
        if (!name) name = 'User';
        const initials = name.charAt(0).toUpperCase();
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
        const color = colors[initials.charCodeAt(0) % colors.length];
        
        const svg = `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${color}"/><text x="50" y="55" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    };
    
} catch (error) {
    console.error('❌ Firebase Fehler:', error);
}
// Am Ende der firebase.js Datei, füge hinzu:

// Auth Helper Funktionen
window.loginUser = async function(email, password) {
    try {
        const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

window.registerUser = async function(email, password, displayName) {
    try {
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.updateProfile({ displayName: displayName });
        
        await window.db.ref('users/' + user.uid).set({
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            avatar: window.generateAvatar(displayName),
            createdAt: Date.now(),
            lastLogin: Date.now(),
            status: 'online',
            role: 'user',
            messageCount: 0,
            roomsCreated: 0
        });
        
        return user;
    } catch (error) {
        console.error('Register error:', error);
        throw error;
    }
};

window.logoutUser = async function() {
    try {
        await window.auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
};

console.log('✅ Firebase Auth Helper geladen');