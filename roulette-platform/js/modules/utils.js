// Utility functions for the entire application

// Format number with thousands separator
export function formatNumber(num) {
  return new Intl.NumberFormat('de-DE').format(num || 0);
}

// Get color of roulette number
export function getNumberColor(number) {
  if (number === 0) return 'green';
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
  if (redNumbers.includes(number)) return 'red';
  if (blackNumbers.includes(number)) return 'black';
  return null;
}

// Check if bet wins
export function checkBetWin(betType, betValue, winningNumber) {
  const color = getNumberColor(winningNumber);
  
  switch(betType) {
      case 'number':
          return parseInt(betValue) === winningNumber;
      case 'color':
          return betValue === color;
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
      case 'column1':
          return winningNumber % 3 === 1;
      case 'column2':
          return winningNumber % 3 === 2;
      case 'column3':
          return winningNumber % 3 === 0 && winningNumber !== 0;
      default:
          return false;
  }
}

// Get payout multiplier for bet type
export function getPayoutMultiplier(betType) {
  const multipliers = {
      'number': 35,
      'color': 1,
      'even': 1,
      'odd': 1,
      'low': 1,
      'high': 1,
      'dozen1': 2,
      'dozen2': 2,
      'dozen3': 2,
      'column1': 2,
      'column2': 2,
      'column3': 2
  };
  return multipliers[betType] || 0;
}

// Generate random roulette number (0-36)
export function getRandomRouletteNumber() {
  return Math.floor(Math.random() * 37);
}

// Format time difference
export function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Vor kurzem';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (diff < 60000) return 'Gerade eben';
  if (diff < 3600000) return `${minutes} min`;
  if (diff < 86400000) return `${hours} h`;
  if (diff < 604800000) return `${days} T`;
  
  return new Date(timestamp).toLocaleDateString('de-DE');
}

// Create notification
export function showNotification(message, type = 'info') {
  // Remove existing notifications
  document.querySelectorAll('.floating-notification').forEach(n => n.remove());
  
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
      <button class="close-notif"><i class="fas fa-times"></i></button>
  `;
  
  document.body.appendChild(notification);
  
  // Close button
  notification.querySelector('.close-notif').addEventListener('click', () => {
      notification.remove();
  });
  
  // Auto remove after 5 seconds
  setTimeout(() => {
      if (notification.parentNode) {
          notification.style.opacity = '0';
          setTimeout(() => notification.remove(), 300);
      }
  }, 5000);
}

// Debounce function for search inputs
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

// Validate email
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Generate unique ID
export function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get default avatar URL
export function getDefaultAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00ff88&color=000&bold=true`;
}

// Calculate level from XP
export function calculateLevel(xp) {
  return Math.floor(xp / 1000) + 1;
}

// Calculate XP needed for next level
export function getXpForNextLevel(currentLevel) {
  return currentLevel * 1000;
}