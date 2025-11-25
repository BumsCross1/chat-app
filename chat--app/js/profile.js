const displayNameInput = document.getElementById('displayName');
const saveBtn = document.getElementById('save-btn');
const pwBtn = document.getElementById('pw-btn');
const backBtn = document.getElementById('back-btn');
const msgDiv = document.getElementById('msg');

displayNameInput.value = auth.currentUser.displayName || '';

saveBtn?.addEventListener('click', async ()=>{
  try{
    await auth.currentUser.updateProfile({ displayName: displayNameInput.value });
    msgDiv.textContent='Gespeichert!';
  } catch(e){ msgDiv.textContent=e.message; }
});

pwBtn?.addEventListener('click', async ()=>{
  const pw = prompt('Neues Passwort:');
  if(!pw) return;
  try{
    await auth.currentUser.updatePassword(pw);
    msgDiv.textContent='Passwort geändert!';
  } catch(e){ msgDiv.textContent=e.message; }
});

backBtn?.addEventListener('click', ()=>{
  window.location.href='dashboard.html';
});
