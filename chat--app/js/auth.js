const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const registerEmail = document.getElementById('register-email');
const registerPassword = document.getElementById('register-password');
const registerDisplayname = document.getElementById('register-displayname');
const errorMsg = document.getElementById('error-msg');

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  setTimeout(() => {
    errorMsg.style.display = 'none';
  }, 5000);
}

function showLoading(button) {
  const originalText = button.textContent;
  button.innerHTML = '<div class="spinner"></div> Wird geladen...';
  button.disabled = true;
  return () => {
    button.textContent = originalText;
    button.disabled = false;
  };
}

loginBtn?.addEventListener('click', async ()=>{
  const resetButton = showLoading(loginBtn);
  
  try { 
    await auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value); 
    window.location.href = 'dashboard.html';
  } catch(e){ 
    showError(e.message);
    resetButton();
  }
});

registerBtn?.addEventListener('click', async ()=>{
  const resetButton = showLoading(registerBtn);
  
  if (registerPassword.value.length < 6) {
    showError('Passwort muss mindestens 6 Zeichen lang sein!');
    resetButton();
    return;
  }
  
  try { 
    const userCredential = await auth.createUserWithEmailAndPassword(registerEmail.value, registerPassword.value);
    
    // Display Name setzen
    if (registerDisplayname.value) {
      await userCredential.user.updateProfile({
        displayName: registerDisplayname.value
      });
    }
    
    window.location.href = 'dashboard.html';
  } catch(e){ 
    showError(e.message);
    resetButton();
  }
});

// Enter Taste support
[loginEmail, loginPassword, registerEmail, registerPassword, registerDisplayname].forEach(input => {
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (input.id.includes('login')) {
        loginBtn.click();
      } else {
        registerBtn.click();
      }
    }
  });
});