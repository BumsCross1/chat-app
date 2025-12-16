import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { 
    getDatabase,
    ref,
    set,
    get,
    update,
    remove,
    push,
    query,
    orderByChild,
    equalTo,
    limitToLast,
    onValue,
    off
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyDNV7fVoK7wOW26oE6cPotaKsct0SWekI8",
    authDomain: "pentest-chat-aed38.firebaseapp.com",
    databaseURL: "https://pentest-chat-aed38-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "pentest-chat-aed38",
    storageBucket: "pentest-chat-aed38.firebasestorage.app",
    messagingSenderId: "233888459532",
    appId: "1:233888459532:web:440e6ec8b99d9304ac3729"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { 
    app, auth, database,
    onAuthStateChanged, signOut,
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    ref, set, get, update, remove, push,
    query, orderByChild, equalTo, limitToLast,
    onValue, off
};