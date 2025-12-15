// /js/config/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, query, where, getDocs, orderBy, limit, deleteDoc, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyDw8x8aTBnYb0Ih2A7IFp9GF_MhNVdSA4Y",
    authDomain: "roullette-9f446.firebaseapp.com",
    projectId: "roullette-9f446",
    storageBucket: "roullette-9f446.appspot.com",
    messagingSenderId: "735945976482",
    appId: "1:735945976482:web:e2f3f0f62aa736fd7a45fb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globale Variablen
let currentUser = null;
let userData = null;

// Funktionen exportieren
export { 
    app, auth, db, 
    currentUser, userData,
    onAuthStateChanged,
    collection, doc, setDoc, getDoc, updateDoc,
    query, where, getDocs, orderBy, limit,
    deleteDoc, addDoc, serverTimestamp
};