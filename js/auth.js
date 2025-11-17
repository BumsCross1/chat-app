// js/auth.js  -- robustere Version mit sicherer Admin-Prüfung
const auth = firebase.auth();

// Persistenz setzen
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log('Auth Persistence: LOCAL'))
  .catch(err => console.error('setPersistence error', err));

/**
 * Hilfsfunktion: basename der aktuellen Seite
 */
function currentBasename() {
  const p = location.pathname.split('/').pop();
  return p === '' ? '' : p;
}

/**
 * Event emitten, damit Seiten reagieren können
 */
function emitUserEvent(user) {
  window.__currentUser = user || null;
  const ev = new CustomEvent('firebaseUserChanged', { detail: { user } });
  document.dispatchEvent(ev);
}

// Adminprüfung per Email-Liste (case-insensitive)
// Langfristig besser: Admins in der Realtime DB oder mittels Custom Claims verwalten
function isAdminByEmail(user) {
  if (!user || !user.email) return false;
  const email = (user.email || '').toLowerCase().trim();
  const adminEmails = [
    'martinherklotzt02@gmail.com',
    'martinherold02@gmail.com'
  ].map(e => e.toLowerCase().trim());
  return adminEmails.includes(email);
}

// Zentraler Listener
auth.onAuthStateChanged(async user => {
  console.log('onAuthStateChanged ->', user ? user.email : null, user ? user.uid : null);

  // Token laden zur Kontrolle (optional)
  if (user) {
    user.getIdToken()
      .then(t => console.log('ID Token OK length', t.length))
      .catch(e => console.warn('Token error', e));
  }

  // Event sofort senden
  emitUserEvent(user);

  const basename = currentBasename();
  const publicPages = ['', 'index.html', 'login.html', 'register.html'];
  const protectedPages = ['dashboard.html', 'chat.html', 'admin.html', 'profile.html'];

  if (!user) {
    // Nicht eingeloggt: auf Login zurück, aber nur wenn geschützte Seite
    if (protectedPages.includes(basename)) {
      setTimeout(() => { location.href = 'login.html'; }, 150);
    }
    return;
  }

  // Eingeloggt: nur wenn wir uns gerade auf einer öffentlichen Seite befinden, redirect
  if (publicPages.includes(basename)) {
    const admin = isAdminByEmail(user);
    if (admin) {
      console.log('Admin erkannt, redirect zu admin.html');
      location.href = 'admin.html';
    } else {
      console.log('Kein Admin, redirect zu dashboard.html');
      location.href = 'dashboard.html';
    }
    return;
  }

  // Sonst: auf geschützten Seiten nichts weiter tun
});