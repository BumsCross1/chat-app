// js/profile.js
function onUserReady(user) {
    const uid = user.uid;
    const db = firebase.database();
    const userRef = db.ref(`users/${uid}`);
  
    // populate UI
    userRef.once('value').then(snap => {
      const u = snap.val() || {};
      document.getElementById('profileAvatar').src = u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName||'User')}&background=64d2ff&color=071020`;
      document.getElementById('profileUsername').textContent = u.displayName || user.displayName || 'Benutzername';
      document.getElementById('profileEmail').textContent = user.email || '';
      document.getElementById('username').value = u.displayName || user.displayName || '';
      document.getElementById('email').value = user.email || '';
      document.getElementById('chatsCount').textContent = u.chatsCount || 0;
      document.getElementById('messagesCount').textContent = u.messagesCount || 0;
      document.getElementById('joinDate').textContent = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-';
    });
  
    // Save profile
    window.saveProfile = function saveProfile() {
      const displayName = document.getElementById('username').value.trim();
      const avatar = document.getElementById('profileAvatar').src;
      // update firebase auth profile
      user.updateProfile({ displayName, photoURL: avatar }).then(() => {
        return db.ref(`users/${uid}`).update({ displayName, photoURL: avatar });
      }).then(() => {
        alert('Profil gespeichert');
        location.reload();
      }).catch(e => {
        console.error('saveProfile error', e);
        alert('Speichern fehlgeschlagen: ' + e.message);
      });
    };
  
    // change password
    window.changePassword = function changePassword() {
      const current = document.getElementById('currentPassword').value;
      const nw = document.getElementById('newPassword').value;
      const confirm = document.getElementById('confirmPassword').value;
      if (!current || !nw || !confirm) return alert('Bitte alle Felder ausfüllen');
      if (nw.length < 6) return alert('Neues Passwort zu kurz');
      if (nw !== confirm) return alert('Passwörter stimmen nicht überein');
  
      // Reauthenticate then update
      const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
      user.reauthenticateWithCredential(cred).then(() => {
        return user.updatePassword(nw);
      }).then(() => {
        alert('Passwort geändert');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
      }).catch(e => {
        console.error('changePassword error', e);
        alert('Fehler: ' + e.message);
      });
    };
  
    window.selectAvatar = function selectAvatar(src) {
      document.getElementById('profileAvatar').src = src;
    };
  
    window.exportData = function exportData() {
      // simple export of user node
      userRef.once('value').then(snap => {
        const data = JSON.stringify(snap.val() || {}, null, 2);
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `profile_${uid}.json`; document.body.appendChild(a);
        a.click(); a.remove(); URL.revokeObjectURL(url);
      });
    };
  
    window.deleteAccount = function deleteAccount() {
      if (!confirm('Account wirklich löschen? Dies ist unwiderruflich.')) return;
      // reauth required by firebase in many cases; for simplicity: attempt delete
      user.delete().then(() => {
        alert('Account gelöscht');
        window.location.href = 'index.html';
      }).catch(e => {
        console.error('deleteAccount error', e);
        alert('Löschen fehlgeschlagen: ' + e.message);
      });
    };
  }
  