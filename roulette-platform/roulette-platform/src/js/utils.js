// Utility functions for the entire application

// Format number with thousands separator
export function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('de-DE').format(num);
}

// Get color of roulette number (European)
export function getNumberColor(number) {
  if (number === 0) return 'green';
  
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
  
  if (redNumbers.includes(parseInt(number))) return 'red';
  if (blackNumbers.includes(parseInt(number))) return 'black';
  return 'green';
}

// Create notification
export function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifs = document.querySelectorAll('.floating-notification');
  existingNotifs.forEach(n => {
      if (n.parentNode) {
          n.style.opacity = '0';
          setTimeout(() => n.remove(), 300);
      }
  });
  
  const notification = document.createElement('div');
  notification.className = `floating-notification ${type}`;
  
  const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
  };
  
  notification.innerHTML = `
      <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
      <span>${message}</span>
      <button class="close-notif">&times;</button>
  `;
  
  document.body.appendChild(notification);
  
  // Position and style
  notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(30, 30, 46, 0.95);
      border-left: 4px solid ${type === 'success' ? '#00ff88' : 
                             type === 'error' ? '#ff4444' : 
                             type === 'warning' ? '#ffaa00' : '#00a8ff'};
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease;
  `;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
      @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
      }
  `;
  document.head.appendChild(style);
  
  // Close button
  notification.querySelector('.close-notif').addEventListener('click', () => {
      notification.remove();
  });
  
  // Auto remove after 5 seconds
  setTimeout(() => {
      if (notification.parentNode) {
          notification.style.opacity = '0';
          notification.style.transform = 'translateX(100%)';
          setTimeout(() => {
              if (notification.parentNode) notification.remove();
          }, 300);
      }
  }, 5000);
}

// Get payout multiplier
export function getPayoutMultiplier(betType) {
  const multipliers = {
      'number': 35,
      'red': 1,
      'black': 1,
      'even': 1,
      'odd': 1,
      'low': 1,
      'high': 1,
      'dozen1': 2,
      'dozen2': 2,
      'dozen3': 2
  };
  return multipliers[betType] || 0;
}

// Validate email
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Generate random roulette number (0-36)
export function getRandomRouletteNumber() {
  return Math.floor(Math.random() * 37);
}

// Format time difference
export function formatTime(timestamp) {
  if (!timestamp) return 'Vor kurzem';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Gerade eben';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} T`;
  
  return new Date(timestamp).toLocaleDateString('de-DE');
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
      const later = () => {
          clearTimeout(timeout);
          func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
  };
}

// Get default avatar
export function getDefaultAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00ff88&color=000&bold=true`;
}

// Check bet win
export function checkBetWin(bet, winningNumber) {
  const winningColor = getNumberColor(winningNumber);
  
  switch(bet.type) {
      case 'number':
          return parseInt(bet.value) === winningNumber;
      case 'red':
          return winningColor === 'red';
      case 'black':
          return winningColor === 'black';
      case 'even':
          return winningNumber !== 0 && winningNumber % 2 === 0;
      case 'odd':
          return winningNumber !== 0 && winningNumber % 2 === 1;
      case 'low':
          return winningNumber >= 1 && winningNumber <= 18;
      case 'high':
          return winningNumber >= 19 && winningNumber <= 36;
      case 'dozen1':
          return winningNumber >= 1 && winningNumber <= 12;
      case 'dozen2':
          return winningNumber >= 13 && winningNumber <= 24;
      case 'dozen3':
          return winningNumber >= 25 && winningNumber <= 36;
      default:
          return false;
  }
}