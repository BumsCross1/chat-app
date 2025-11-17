// js/register.js
// Einfache Registrierung für register.html
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (!form) return console.warn('registerForm nicht gefunden');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const username = (document.getElementById('username') || {}).value.trim();
    const email = (document.getElementById('email') || {}).value.trim();
    const password = (document.getElementById('password') || {}).value;
    if (!username || !email || !password) {
      alert('Bitte Nutzername, Email und Passwort eingeben.');
      return;
    }
    if (btn) btn.disabled = true;
    console.log('🔄 Registrierung startet für:', email);

    try {
      const res = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = res.user;
      if (!user) throw new Error('User-Objekt nicht vorhanden');

      // DisplayName setzen
      await user.updateProfile({ displayName: username });
      console.log('✅ displayName gesetzt:', username);

      // Optional: kleines Profil in Realtime DB anlegen (nützlich später)
      try {
        const db = firebase.database();
        await db.ref(`users/${user.uid}`).set({
          uid: user.uid,
          email: user.email,
          displayName: username,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        console.log('✅ Profil in Realtime DB angelegt');
      } catch (dbErr) {
        console.warn('Profil-DB Write fehlgeschlagen', dbErr);
      }

      alert('Registrierung erfolgreich! Du wirst weitergeleitet.');
      // Weiterleitung/Seitenwechsel wird durch auth.onAuthStateChanged in auth.js gehandhabt

    } catch (err) {
      console.error('❌ register error', err);
      let msg = 'Registrierung fehlgeschlagen: ' + (err.message || err.code || '');
      switch (err.code) {
        case 'auth/email-already-in-use': msg = 'Diese Email wird bereits verwendet.'; break;
        case 'auth/invalid-email': msg = 'Ungültige Email-Adresse.'; break;
        case 'auth/weak-password': msg = 'Passwort zu schwach (mind. 6 Zeichen).'; break;
      }
      alert(msg);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});