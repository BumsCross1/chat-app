// js/login.js
// Einfacher Login-Handler für login.html
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return console.warn('loginForm nicht gefunden');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const email = (document.getElementById('email') || {}).value.trim();
    const password = (document.getElementById('password') || {}).value;
    if (!email || !password) {
      alert('Bitte Email und Passwort eingeben.');
      return;
    }
    if (btn) btn.disabled = true;
    console.log('🔄 Login startet für:', email);

    try {
      const res = await firebase.auth().signInWithEmailAndPassword(email, password);
      console.log('✅ signIn successful', res.user && res.user.email);
      // Weiterleitung/Seitenwechsel wird durch auth.onAuthStateChanged in auth.js gehandhabt
    } catch (err) {
      console.error('❌ signIn error', err);
      let msg = 'Login fehlgeschlagen: ' + (err.message || err.code || '');
      switch (err.code) {
        case 'auth/invalid-email': msg = 'Ungültige Email-Adresse.'; break;
        case 'auth/user-disabled': msg = 'Benutzerkonto wurde deaktiviert.'; break;
        case 'auth/user-not-found': msg = 'Konto nicht gefunden. Bitte registrieren.'; break;
        case 'auth/wrong-password': msg = 'Falsches Passwort.'; break;
        case 'auth/operation-not-allowed': msg = 'Anmelde-Methode ist nicht aktiviert (Firebase Console).' ; break;
        case 'auth/too-many-requests': msg = 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.'; break;
      }
      alert(msg);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});