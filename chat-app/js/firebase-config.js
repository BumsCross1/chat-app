// js/firebase-config.js
// Ersetze die Platzhalter mit deinen echten Firebase-Projektwerten
const firebaseConfig = {
    apiKey: "AIzaSyADnEf86hwyA9zShMnl0FlGLuA4Y5YBMbA",
    authDomain: "admin-7d641.firebaseapp.com",
    databaseURL: "https://admin-7d641-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "admin-7d641",
    storageBucket: "admin-7d641.firebasestorage.app",
    messagingSenderId: "900778327004",
    appId: "1:900778327004:web:cdfe1d609753094e72ed19"
  };
  
  if (!window.firebaseAppsInitialized) {
    firebase.initializeApp(firebaseConfig);
    window.firebaseAppsInitialized = true;
    console.log('Firebase initialisiert');
  } else {
    console.log('Firebase bereits initialisiert');
  }
  


