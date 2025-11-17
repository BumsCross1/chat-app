// js/auth.js  -- ersetze komplette Datei
const auth = firebase.auth();

// Persistenz setzen
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(()=>console.log('Auth Persistence: LOCAL'))
  .catch(err=>console.error('setPersistence error', err));

/**
 * Hilfsfunktion: sichere Pfadprüfung
 * returns basename like "login.html" or "" for root
 */
function currentBasename() {
  const p = location.pathname.split('/').pop();
  return p === '' ? '' : p;
}

/**
 * Dispatch eines Events so dass jede Seite zuhören kann
 * detail: { user: FirebaseUser|null }
 */
function emitUserEvent(user) {
  window.__currentUser = user || null;
  const ev = new CustomEvent('firebaseUserChanged', { detail: { user } });
  document.dispatchEvent(ev);
}

// zentraler listener
auth.onAuthStateChanged(user => {
  console.log('onAuthStateChanged ->', user ? user.email : null, user ? user.uid : null);

  // wenn user vorhanden: lade token kurz zur Kontrolle
  if (user) {
    user.getIdToken().then(t => console.log('ID Token OK length', t.length)).catch(e=>console.warn('Token error', e));
  }

  // Emit Event sofort damit jede Seite reagieren kann
  emitUserEvent(user);

  // Redirect-Logik: nur wenn wir auf einer geschützten Seite sind
  const basename = currentBasename();
  const publicPages = ['', 'index.html', 'login.html', 'register.html'];
  const protectedPages = ['dashboard.html', 'chat.html', 'admin.html', 'profile.html'];

  if (!user) {
    // Nicht eingeloggt: auf Login zurück, aber nur wenn aktuell geschützte Seite
    if (protectedPages.includes(basename)) {
      // Verzögere leicht, damit Event empfangen werden kann
      setTimeout(()=> { location.href = 'login.html'; }, 150);
    }
    return;
  }

  // Eingeloggt: wenn auf öffentlichen Start/Login/Index -> redirect auf Dashboard/Admin
  if (publicPages.includes(basename)) {
    // Entscheide Admin anhand Email (anpassbar)
    if (user.email === 'martinherklotzt02@gmail.com' || user.email === 'martinherold02@gmail.com') {
      location.href = 'admin.html';
    } else {
      location.href = 'dashboard.html';
    }
    return;
  }

  // Wenn eingeloggt und auf einer geschützten Seite: nichts weiter tun (Seite sollte das Event verarbeiten)
});
