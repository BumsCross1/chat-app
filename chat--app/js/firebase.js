// Firebase Konfiguration
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

// Firebase Initialisierung
try {
  // Prüfe ob Firebase bereits initialisiert wurde
  if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
  }
  
  // Globale Instanzen
  window.auth = firebase.auth();
  window.db = firebase.database();
  
  console.log('✅ Firebase erfolgreich initialisiert');
  
  // Auto-Login Check
  window.auth.onAuthStateChanged((user) => {
      if (user) {
          console.log('👤 Auto-Login User:', user.email);
          // Optional: User in Database sicherstellen
          if (window.db) {
              window.db.ref('users/' + user.uid).once('value').then(snapshot => {
                  if (!snapshot.exists()) {
                      window.db.ref('users/' + user.uid).set({
                          email: user.email,
                          displayName: user.displayName || user.email,
                          createdAt: Date.now(),
                          lastLogin: Date.now(),
                          status: 'online'
                      });
                  }
              });
          }
      }
  });
  
} catch (error) {
  console.error('❌ Firebase Initialisierung fehlgeschlagen:', error);
}