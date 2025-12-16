import { 
    auth, database, onAuthStateChanged, signOut,
    ref, get, update, remove, set, push, query, orderByChild, equalTo, onValue, off
} from '../config/firebase.js';

let currentUser = null;
let userData = null;
let currentEditingUserId = null;

// Chart.js for statistics
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        
        // Check if user is admin
        if (!userData || userData.role !== 'admin') {
            alert('Zugriff verweigert! Nur Administratoren können diese Seite aufrufen.');
            window.location.href = 'dashboard.html';
            return;
        }
        
        setupAdminPanel();
        setupEventListeners();
        loadAllUsers();
        loadActiveTables();
        loadGamesHistory();
        loadStatistics();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            if (document.querySelector('.tab-content.active').id === 'users-tab') {
                loadAllUsers();
            } else if (document.querySelector('.tab-content.active').id === 'tables-tab') {
                loadActiveTables();
            }
        }, 30000);
    });
});

async function loadUserData() {
    try {
        const snapshot = await get(ref(database, `users/${currentUser.uid}`));
        if (snapshot.exists()) {
            userData = snapshot.val();
            updateAdminUI();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function updateAdminUI() {
    if (!userData) return;
    
    const adminAvatar = document.getElementById('admin-avatar');
    const adminName = document.getElementById('admin-name');
    
    if (adminAvatar) {
        adminAvatar.src = userData.profileImage || getDefaultAvatar(userData.username);
    }
    
    if (adminName) {
        adminName.textContent = userData.username + ' (Admin)';
    }
}

function setupAdminPanel() {
    // Setup tab switching
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    // Update active menu button
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.menu-btn[data-tab="${tabName}"]`).classList.add('active');
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function loadAllUsers() {
    try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        const tbody = document.getElementById('users-table-body');
        
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="9">Keine Benutzer gefunden</td></tr>';
            return;
        }
        
        const users = [];
        snapshot.forEach(child => {
            users.push({ id: child.key, ...child.val() });
        });
        
        // Sort by creation date (newest first)
        users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            // Determine status badge
            let statusBadge = '<span class="status-badge active">Aktiv</span>';
            if (user.isBanned) {
                statusBadge = '<span class="status-badge banned">Gebannt</span>';
            } else if (user.isSuspended) {
                statusBadge = '<span class="status-badge suspended">Suspendiert</span>';
            }
            
            row.innerHTML = `
                <td>${user.uid.substring(0, 8)}...</td>
                <td>
                    <div class="user-cell">
                        <img src="${user.profileImage || getDefaultAvatar(user.username)}" 
                             alt="${user.username}" class="user-avatar-small">
                        <span>${user.username}</span>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td>${formatNumber(user.chips || 0)}</td>
                <td>Level ${Math.floor((user.xp || 0) / 1000) + 1}</td>
                <td>${user.gamesPlayed || 0}</td>
                <td>${statusBadge}</td>
                <td>
                    <span class="role-badge ${user.role || 'user'}">
                        ${user.role === 'admin' ? 'Admin' : user.role === 'moderator' ? 'Moderator' : 'Benutzer'}
                    </span>
                </td>
                <td>
                    <div class="user-actions">
                        <button class="action-btn edit-btn" onclick="openEditUserModal('${user.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn chips-btn" onclick="openChipsModal('${user.id}', '${user.username}')">
                            <i class="fas fa-coins"></i>
                        </button>
                        <button class="action-btn ban-btn" onclick="toggleUserStatus('${user.id}', ${!user.isBanned})">
                            <i class="fas ${user.isBanned ? 'fa-unlock' : 'fa-ban'}"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Fehler beim Laden der Benutzer', 'error');
    }
}

async function loadActiveTables() {
    try {
        const tablesRef = ref(database, 'tables');
        const snapshot = await get(tablesRef);
        const container = document.getElementById('active-tables-grid');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data">Keine aktiven Tische</div>';
            return;
        }
        
        const tables = [];
        snapshot.forEach(child => {
            const table = child.val();
            if (table.status !== 'ended') {
                tables.push({ id: child.key, ...table });
            }
        });
        
        if (tables.length === 0) {
            container.innerHTML = '<div class="no-data">Keine aktiven Tische</div>';
            return;
        }
        
        tables.forEach(table => {
            const card = document.createElement('div');
            card.className = 'table-card';
            
            const playerCount = table.players ? Object.keys(table.players).length : 0;
            const maxPlayers = table.maxPlayers || 6;
            
            let statusClass = 'status-waiting';
            let statusText = 'Wartend';
            
            if (table.status === 'active') {
                statusClass = 'status-active';
                statusText = 'Aktiv';
            } else if (table.isPrivate) {
                statusClass = 'status-private';
                statusText = 'Privat';
            }
            
            card.innerHTML = `
                <div class="table-card-header">
                    <h4><i class="fas fa-table"></i> ${table.name || 'Unbenannter Tisch'}</h4>
                    <span class="table-status ${statusClass}">${statusText}</span>
                </div>
                <div class="table-details">
                    <div class="table-detail">
                        <i class="fas fa-user-crown"></i>
                        <span>Besitzer: ${table.ownerName || 'Unbekannt'}</span>
                    </div>
                    <div class="table-detail">
                        <i class="fas fa-users"></i>
                        <span>Spieler: ${playerCount}/${maxPlayers}</span>
                    </div>
                    <div class="table-detail">
                        <i class="fas fa-coins"></i>
                        <span>Min. Einsatz: ${formatNumber(table.minBet || 10)} Chips</span>
                    </div>
                    <div class="table-detail">
                        <i class="fas fa-clock"></i>
                        <span>Erstellt: ${formatTime(table.createdAt)}</span>
                    </div>
                </div>
                <div class="table-actions">
                    <button class="btn-secondary" onclick="viewTableDetails('${table.id}')">
                        <i class="fas fa-eye"></i> Ansehen
                    </button>
                    <button class="btn-danger" onclick="deleteTable('${table.id}')">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading tables:', error);
        showNotification('Fehler beim Laden der Tische', 'error');
    }
}

async function loadGamesHistory() {
    try {
        const gamesRef = query(ref(database, 'games'), orderByChild('timestamp'), limitToLast(50));
        const snapshot = await get(gamesRef);
        const container = document.getElementById('games-history');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = '<div class="no-data">Keine Spiele gefunden</div>';
            return;
        }
        
        const games = [];
        snapshot.forEach(child => {
            games.push({ id: child.key, ...child.val() });
        });
        
        // Reverse to show newest first
        games.reverse();
        
        games.forEach(game => {
            const gameElement = document.createElement('div');
            gameElement.className = 'game-item';
            
            const color = getNumberColor(game.winningNumber);
            const colorClass = `color-${color}`;
            const colorText = color === 'red' ? 'Rot' : color === 'black' ? 'Schwarz' : 'Grün';
            
            gameElement.innerHTML = `
                <div class="game-info">
                    <div>
                        <span class="game-number">${game.winningNumber}</span>
                        <span class="game-color ${colorClass}">${colorText}</span>
                    </div>
                    <div class="game-players">
                        ${game.playerCount || 1} Spieler | Tisch: ${game.tableId ? game.tableId.substring(0, 8) + '...' : 'Solo'}
                    </div>
                </div>
                <div class="game-result">
                    <div class="game-profit ${game.totalWin > 0 ? 'profit-positive' : 'profit-negative'}">
                        ${game.totalWin > 0 ? '+' : ''}${formatNumber(game.totalWin || 0)} Chips
                    </div>
                    <div class="game-time">${formatTime(game.timestamp)}</div>
                </div>
            `;
            
            container.appendChild(gameElement);
        });
        
    } catch (error) {
        console.error('Error loading games:', error);
        showNotification('Fehler beim Laden des Spielverlaufs', 'error');
    }
}

async function loadStatistics() {
    try {
        // Load total users
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        const totalUsers = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;
        document.getElementById('total-users').textContent = totalUsers;
        
        // Load total games
        const gamesRef = ref(database, 'games');
        const gamesSnapshot = await get(gamesRef);
        const totalGames = gamesSnapshot.exists() ? Object.keys(gamesSnapshot.val()).length : 0;
        document.getElementById('total-games').textContent = totalGames;
        
        // Calculate total chips and wins
        let totalChips = 0;
        let totalWins = 0;
        
        if (usersSnapshot.exists()) {
            usersSnapshot.forEach(child => {
                const user = child.val();
                totalChips += user.chips || 0;
                totalWins += user.totalWinnings || 0;
            });
        }
        
        document.getElementById('total-chips').textContent = formatNumber(totalChips);
        document.getElementById('total-wins').textContent = formatNumber(totalWins);
        
        // Load data for charts
        await loadChartsData();
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadChartsData() {
    try {
        // Load games for the last 7 days
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const gamesRef = query(ref(database, 'games'), orderByChild('timestamp'), limitToLast(100));
        const snapshot = await get(gamesRef);
        
        if (!snapshot.exists()) return;
        
        const dailyGames = {};
        const gameTypes = { 'red': 0, 'black': 0, 'green': 0 };
        
        snapshot.forEach(child => {
            const game = child.val();
            const date = new Date(game.timestamp).toLocaleDateString('de-DE');
            
            // Count by day
            dailyGames[date] = (dailyGames[date] || 0) + 1;
            
            // Count by color
            const color = getNumberColor(game.winningNumber);
            gameTypes[color] = (gameTypes[color] || 0) + 1;
        });
        
        // Activity chart
        const activityCtx = document.getElementById('activity-chart').getContext('2d');
        const dates = Object.keys(dailyGames).slice(-7); // Last 7 days
        const counts = dates.map(date => dailyGames[date] || 0);
        
        new Chart(activityCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Spiele pro Tag',
                    data: counts,
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#aaa' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#aaa' }
                    }
                }
            }
        });
        
        // Games distribution chart
        const gamesCtx = document.getElementById('games-chart').getContext('2d');
        new Chart(gamesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Rot', 'Schwarz', 'Grün'],
                datasets: [{
                    data: [gameTypes.red, gameTypes.black, gameTypes.green],
                    backgroundColor: [
                        'rgba(255, 71, 87, 0.8)',
                        'rgba(255, 255, 255, 0.8)',
                        'rgba(0, 255, 136, 0.8)'
                    ],
                    borderColor: [
                        'rgba(255, 71, 87, 1)',
                        'rgba(255, 255, 255, 1)',
                        'rgba(0, 255, 136, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#fff' }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading charts data:', error);
    }
}

// User Management Functions
window.openEditUserModal = async function(userId) {
    try {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            showNotification('Benutzer nicht gefunden', 'error');
            return;
        }
        
        const user = snapshot.val();
        currentEditingUserId = userId;
        
        // Fill modal with user data
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-chips').value = user.chips || 0;
        document.getElementById('edit-level').value = Math.floor((user.xp || 0) / 1000) + 1;
        document.getElementById('edit-role').value = user.role || 'user';
        document.getElementById('edit-status').value = user.isBanned ? 'banned' : 
                                                     user.isSuspended ? 'suspended' : 'active';
        
        // Show modal
        document.getElementById('edit-user-modal').classList.add('active');
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showNotification('Fehler beim Laden der Benutzerdaten', 'error');
    }
};

window.openChipsModal = function(userId, username) {
    const amount = prompt(`Chips für ${username} ändern:\n(Positive Zahl: hinzufügen, Negative: entfernen)`, "1000");
    
    if (amount === null) return;
    
    const chipsAmount = parseInt(amount);
    if (isNaN(chipsAmount)) {
        showNotification('Ungültige Anzahl', 'error');
        return;
    }
    
    updateUserChips(userId, chipsAmount);
};

async function updateUserChips(userId, amount) {
    try {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (!snapshot.exists()) {
            showNotification('Benutzer nicht gefunden', 'error');
            return;
        }
        
        const user = snapshot.val();
        const newChips = Math.max(0, (user.chips || 0) + amount);
        
        await update(userRef, {
            chips: newChips,
            lastAdminEdit: {
                adminId: currentUser.uid,
                adminName: userData.username,
                amount: amount,
                timestamp: Date.now()
            }
        });
        
        // Log the transaction
        await push(ref(database, 'admin_logs'), {
            type: 'chips_edit',
            adminId: currentUser.uid,
            adminName: userData.username,
            userId: userId,
            userName: user.username,
            amount: amount,
            oldChips: user.chips || 0,
            newChips: newChips,
            timestamp: Date.now()
        });
        
        showNotification(`${amount >= 0 ? '+' : ''}${amount} Chips für ${user.username}`, 'success');
        loadAllUsers();
        
    } catch (error) {
        console.error('Error updating chips:', error);
        showNotification('Fehler beim Aktualisieren der Chips', 'error');
    }
}

window.toggleUserStatus = async function(userId, ban) {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
        showNotification('Benutzer nicht gefunden', 'error');
        return;
    }
    
    const user = snapshot.val();
    const action = ban ? 'bannen' : 'entbannen';
    
    if (!confirm(`${user.username} wirklich ${action}?`)) return;
    
    try {
        await update(userRef, {
            isBanned: ban,
            isSuspended: false,
            banReason: ban ? 'Von Administrator gesperrt' : null,
            banDate: ban ? Date.now() : null,
            bannedBy: ban ? currentUser.uid : null
        });
        
        // Log the action
        await push(ref(database, 'admin_logs'), {
            type: ban ? 'user_banned' : 'user_unbanned',
            adminId: currentUser.uid,
            adminName: userData.username,
            userId: userId,
            userName: user.username,
            timestamp: Date.now()
        });
        
        showNotification(`Benutzer ${user.username} wurde ${ban ? 'gebannt' : 'entbannt'}`, 'success');
        loadAllUsers();
        
    } catch (error) {
        console.error('Error toggling user status:', error);
        showNotification('Fehler beim Ändern des Status', 'error');
    }
};

// Table Management Functions
window.viewTableDetails = async function(tableId) {
    try {
        const tableRef = ref(database, `tables/${tableId}`);
        const snapshot = await get(tableRef);
        
        if (!snapshot.exists()) {
            showNotification('Tisch nicht gefunden', 'error');
            return;
        }
        
        const table = snapshot.val();
        const players = table.players ? Object.values(table.players) : [];
        
        let details = `Tisch: ${table.name || 'Unbenannt'}\n`;
        details += `Status: ${table.status || 'Unbekannt'}\n`;
        details += `Spieler: ${players.length}\n`;
        details += `Min. Einsatz: ${table.minBet || 10} Chips\n`;
        details += `Erstellt: ${new Date(table.createdAt).toLocaleString('de-DE')}\n\n`;
        details += 'Spieler am Tisch:\n';
        
        players.forEach(player => {
            details += `- ${player.name}: ${player.chips} Chips\n`;
        });
        
        alert(details);
        
    } catch (error) {
        console.error('Error viewing table details:', error);
        showNotification('Fehler beim Anzeigen der Tischdetails', 'error');
    }
};

window.deleteTable = async function(tableId) {
    if (!confirm('Tisch wirklich löschen? Alle Spieler werden entfernt.')) return;
    
    try {
        await remove(ref(database, `tables/${tableId}`));
        
        // Log the action
        await push(ref(database, 'admin_logs'), {
            type: 'table_deleted',
            adminId: currentUser.uid,
            adminName: userData.username,
            tableId: tableId,
            timestamp: Date.now()
        });
        
        showNotification('Tisch erfolgreich gelöscht', 'success');
        loadActiveTables();
        
    } catch (error) {
        console.error('Error deleting table:', error);
        showNotification('Fehler beim Löschen des Tisches', 'error');
    }
};

// Save user edits
document.getElementById('save-user-btn')?.addEventListener('click', async () => {
    if (!currentEditingUserId) return;
    
    const username = document.getElementById('edit-username').value.trim();
    const chips = parseInt(document.getElementById('edit-chips').value);
    const level = parseInt(document.getElementById('edit-level').value);
    const role = document.getElementById('edit-role').value;
    const status = document.getElementById('edit-status').value;
    
    if (!username || username.length < 3) {
        showNotification('Benutzername muss mindestens 3 Zeichen haben', 'error');
        return;
    }
    
    if (isNaN(chips) || chips < 0) {
        showNotification('Ungültige Chip-Anzahl', 'error');
        return;
    }
    
    try {
        const updates = {
            username: username,
            chips: chips,
            xp: (level - 1) * 1000,
            role: role,
            isBanned: status === 'banned',
            isSuspended: status === 'suspended',
            lastAdminEdit: {
                adminId: currentUser.uid,
                adminName: userData.username,
                timestamp: Date.now()
            }
        };
        
        await update(ref(database, `users/${currentEditingUserId}`), updates);
        
        // Log the action
        await push(ref(database, 'admin_logs'), {
            type: 'user_edited',
            adminId: currentUser.uid,
            adminName: userData.username,
            userId: currentEditingUserId,
            changes: updates,
            timestamp: Date.now()
        });
        
        showNotification('Benutzer erfolgreich aktualisiert', 'success');
        closeModal();
        loadAllUsers();
        
    } catch (error) {
        console.error('Error saving user edits:', error);
        showNotification('Fehler beim Speichern der Änderungen', 'error');
    }
});

// Delete user
document.getElementById('delete-user-btn')?.addEventListener('click', async () => {
    if (!currentEditingUserId) return;
    
    if (!confirm('Benutzer wirklich LÖSCHEN? Diese Aktion kann nicht rückgängig gemacht werden!')) {
        return;
    }
    
    try {
        // Get user data first for logging
        const userRef = ref(database, `users/${currentEditingUserId}`);
        const snapshot = await get(userRef);
        const user = snapshot.exists() ? snapshot.val() : null;
        
        // Delete user
        await remove(userRef);
        
        // Delete username reference
        if (user && user.username) {
            await remove(ref(database, `usernames/${user.username.toLowerCase()}`));
        }
        
        // Log the action
        await push(ref(database, 'admin_logs'), {
            type: 'user_deleted',
            adminId: currentUser.uid,
            adminName: userData.username,
            userId: currentEditingUserId,
            userName: user?.username || 'Unbekannt',
            timestamp: Date.now()
        });
        
        showNotification('Benutzer erfolgreich gelöscht', 'success');
        closeModal();
        loadAllUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Fehler beim Löschen des Benutzers', 'error');
    }
});

// Cleanup inactive tables
document.getElementById('cleanup-tables')?.addEventListener('click', async () => {
    if (!confirm('Alle inaktiven Tische (älter als 1 Stunde) löschen?')) return;
    
    try {
        const tablesRef = ref(database, 'tables');
        const snapshot = await get(tablesRef);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        if (!snapshot.exists()) {
            showNotification('Keine Tische gefunden', 'info');
            return;
        }
        
        let deletedCount = 0;
        const promises = [];
        
        snapshot.forEach(child => {
            const table = child.val();
            // Delete tables older than 1 hour and not active
            if (table.createdAt < oneHourAgo && table.status !== 'active') {
                promises.push(remove(ref(database, `tables/${child.key}`)));
                deletedCount++;
            }
        });
        
        await Promise.all(promises);
        
        // Log the action
        await push(ref(database, 'admin_logs'), {
            type: 'tables_cleanup',
            adminId: currentUser.uid,
            adminName: userData.username,
            deletedCount: deletedCount,
            timestamp: Date.now()
        });
        
        showNotification(`${deletedCount} inaktive Tische gelöscht`, 'success');
        loadActiveTables();
        
    } catch (error) {
        console.error('Error cleaning up tables:', error);
        showNotification('Fehler beim Bereinigen der Tische', 'error');
    }
});

// System settings
document.getElementById('save-chip-settings')?.addEventListener('click', async () => {
    const startChips = parseInt(document.getElementById('start-chips').value);
    const bonusChips = parseInt(document.getElementById('bonus-chips').value);
    const dailyBonus = parseInt(document.getElementById('daily-bonus').value);
    
    if (isNaN(startChips) || isNaN(bonusChips) || isNaN(dailyBonus)) {
        showNotification('Ungültige Werte', 'error');
        return;
    }
    
    try {
        await set(ref(database, 'system_settings/chips'), {
            startChips: startChips,
            bonusChips: bonusChips,
            dailyBonus: dailyBonus,
            lastUpdated: Date.now(),
            updatedBy: currentUser.uid
        });
        
        showNotification('Chip-Einstellungen gespeichert', 'success');
        
    } catch (error) {
        console.error('Error saving chip settings:', error);
        showNotification('Fehler beim Speichern', 'error');
    }
});

// Toggle maintenance mode
document.getElementById('toggle-maintenance')?.addEventListener('click', async () => {
    const maintenanceMode = document.getElementById('maintenance-mode').checked;
    const message = document.getElementById('maintenance-message').value;
    
    try {
        await set(ref(database, 'system_settings/maintenance'), {
            enabled: maintenanceMode,
            message: message,
            activatedAt: maintenanceMode ? Date.now() : null,
            activatedBy: maintenanceMode ? currentUser.uid : null
        });
        
        showNotification(`Wartungsmodus ${maintenanceMode ? 'aktiviert' : 'deaktiviert'}`, 'success');
        
    } catch (error) {
        console.error('Error toggling maintenance mode:', error);
        showNotification('Fehler beim Umschalten des Wartungsmodus', 'error');
    }
});

// Utility Functions
function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=ff4757&color=fff&bold=true`;
}

function formatNumber(num) {
    return new Intl.NumberFormat('de-DE').format(num || 0);
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Gerade eben';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
    
    return new Date(timestamp).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
}

function showNotification(message, type = 'info') {
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
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 3000);
}

function setupEventListeners() {
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        if (confirm('Wirklich abmelden?')) {
            await signOut(auth);
            window.location.href = 'index.html';
        }
    });
    
    // Refresh users
    document.getElementById('refresh-users')?.addEventListener('click', loadAllUsers);
    
    // Close modal buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    });
    
    // Filter games by date
    document.getElementById('game-date-filter')?.addEventListener('change', (e) => {
        // Implement date filtering here
        console.log('Date filter changed:', e.target.value);
    });
    
    // Filter games by type
    document.getElementById('game-type-filter')?.addEventListener('change', (e) => {
        // Implement type filtering here
        console.log('Type filter changed:', e.target.value);
    });
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    currentEditingUserId = null;
}

// Make functions globally available
window.formatNumber = formatNumber;
window.formatTime = formatTime;
window.getNumberColor = getNumberColor;
window.showNotification = showNotification;