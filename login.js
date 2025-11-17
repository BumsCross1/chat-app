// js/login.js (Debug-Version)
// Lädt direkt nach js/auth.js
console.log('login.js geladen');

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) {
    console.warn('loginForm nicht gefunden');
    return;
  }
  console.log('loginForm gefunden, handler wird registriert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('email')||{}).value.trim();
    const password = (document.getElementById('password')||{}).value;
    console.log('Login-Submit gedrückt für:', email);
    if (!email || !password) {
      alert('Bitte Email und Passwort eingeben.');
      return;
    }

    try {
      const res = await firebase.auth().signInWithEmailAndPassword(email, password);
      console.log('signInWithEmailAndPassword -> success', res && res.user && res.user.uid, res);
      alert('Erfolgreich eingeloggt: ' + (res.user && res.user.email));
    } catch (err) {
      console.error('signInWithEmailAndPassword -> ERROR', err);
      alert('Login fehlgeschlagen: ' + (err && (err.code + ' - ' + err.message) || JSON.stringify(err)));
    }
  });
});