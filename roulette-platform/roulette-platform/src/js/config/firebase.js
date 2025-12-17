// Firebase-Konfiguration
const firebaseConfig = {
    apiKey: "AIzaSyC4RhJZ2wQ7V7XqY4Q2q2Q2q2Q2q2Q2q2Q2q",
    authDomain: "premium-roulette.firebaseapp.com",
    projectId: "premium-roulette",
    storageBucket: "premium-roulette.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    set,
    get,
    update,
    child,
    push,
    onValue,
    query,
    orderByChild,
    limitToLast
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export {
    auth,
    database,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    ref,
    set,
    get,
    update,
    child,
    push,
    onValue,
    query,
    orderByChild,
    limitToLast
};