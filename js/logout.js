// js/logout.js
// Einfacher Sign-Out Helfer
function doLogout(redirect = 'index.html') {
  if (!firebase || !firebase.auth) {
    console.warn('Firebase Auth nicht verfügbar');
    window.location.href = redirect;
    return;
  }
  firebase.auth().signOut()
    .then(() => {
      console.log('✅ Abgemeldet');
      window.location.href = redirect;
    })
    .catch(err => {
      console.error('❌ signOut error', err);
      alert('Abmelden fehlgeschlagen: ' + (err.message || err.code || ''));
    });
}

// Optional: global verfügbar machen
window.doLogout = doLogout;