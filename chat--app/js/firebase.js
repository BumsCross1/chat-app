// Firebase Konfiguration - FIXED VERSION
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

// Firebase Initialisierung - STORAGE ENTFERNT
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
// storage entfernt - wir verwenden Base64 für Dateien

// Firebase Auth State Listener
auth.onAuthStateChanged((user) => {
  if (user) {
      console.log('🚀 User eingeloggt:', user.email);
      // User Daten in Firebase speichern
      db.ref('users/' + user.uid).set({
          email: user.email,
          displayName: user.displayName || user.email,
          lastLogin: Date.now(),
          avatar: user.photoURL || null
      });
  } else {
      console.log('👋 User ausgeloggt');
  }
});