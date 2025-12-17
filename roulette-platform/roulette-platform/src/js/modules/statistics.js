import {
    database,
    ref,
    get,
    query,
    orderByChild,
    limitToLast
} from '../config/firebase.js';
import { formatNumber } from '../utils/helpers.js';

class StatisticsManager {
    constructor(userId) {
        this.userId = userId;
    }

    async getUserStats() {
        try {
            const snapshot = await get(ref(database, `users/${this.userId}`));
            if (!snapshot.exists()) return null;

            const user = snapshot.val();
            const gamesPlayed = user.gamesPlayed || 0;
            const gamesWon = user.gamesWon || 0;
            const totalWinnings = user.totalWinnings || 0;
            const totalLosses = user.totalLosses || 0;

            return {
                gamesPlayed,
                gamesWon,
                winRate: gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0,
                totalWinnings,
                totalLosses,
                netProfit: totalWinnings - totalLosses,
                winStreak: user.winStreak || 0,
                highestWin: user.highestWin || 0,
                averageBet: user.totalBet ? (user.totalBet / gamesPlayed) : 0
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    async getLeaderboard(limit = 10) {
        try {
            const usersQuery = query(ref(database, 'users'), orderByChild('chips'), limitToLast(limit));
            const snapshot = await get(usersQuery);
            
            if (!snapshot.exists()) return [];

            const leaders = [];
            snapshot.forEach(child => {
                const user = child.val();
                if (user.username && user.chips !== undefined) {
                    leaders.push({
                        rank: 0, // Will be set later
                        username: user.username,
                        chips: user.chips || 0,
                        level: Math.floor((user.xp || 0) / 1000) + 1,
                        gamesPlayed: user.gamesPlayed || 0,
                        gamesWon: user.gamesWon || 0,
                        winRate: user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed) * 100 : 0,
                        isCurrentUser: child.key === this.userId
                    });
                }
            });

            // Sort by chips and assign ranks
            leaders.sort((a, b) => b.chips - a.chips);
            leaders.forEach((leader, index) => {
                leader.rank = index + 1;
            });

            return leaders;
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return [];
        }
    }

    async getGameHistory(limit = 20) {
        try {
            const gamesQuery = query(
                ref(database, 'games'),
                orderByChild('timestamp'),
                limitToLast(limit)
            );
            
            const snapshot = await get(gamesQuery);
            if (!snapshot.exists()) return [];

            const games = [];
            snapshot.forEach(child => {
                const game = child.val();
                if (game.userId === this.userId) {
                    games.push({
                        id: child.key,
                        winningNumber: game.winningNumber,
                        win: game.win || 0,
                        bet: game.bet || 0,
                        timestamp: game.timestamp,
                        mode: game.mode || 'solo',
                        tableId: game.tableId || null
                    });
                }
            });

            // Sort by timestamp (newest first)
            games.sort((a, b) => b.timestamp - a.timestamp);
            return games;
        } catch (error) {
            console.error('Error getting game history:', error);
            return [];
        }
    }

    async getHourlyActivity() {
        try {
            const now = Date.now();
            const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
            
            const gamesQuery = query(
                ref(database, 'games'),
                orderByChild('timestamp')
                // Note: Firebase doesn't support range queries with startAt AND endAt directly
                // In production, you'd need a more sophisticated approach
            );
            
            const snapshot = await get(gamesQuery);
            if (!snapshot.exists()) return [];

            // Group games by hour
            const hourlyData = new Array(24).fill(0);
            
            snapshot.forEach(child => {
                const game = child.val();
                if (game.userId === this.userId && game.timestamp >= twentyFourHoursAgo) {
                    const hour = new Date(game.timestamp).getHours();
                    hourlyData[hour]++;
                }
            });

            return hourlyData;
        } catch (error) {
            console.error('Error getting hourly activity:', error);
            return new Array(24).fill(0);
        }
    }

    async getFavoriteNumbers() {
        try {
            const gamesQuery = query(ref(database, 'games'), orderByChild('timestamp'), limitToLast(100));
            const snapshot = await get(gamesQuery);
            
            if (!snapshot.exists()) return {};

            const numberCounts = {};
            let totalGames = 0;

            snapshot.forEach(child => {
                const game = child.val();
                if (game.userId === this.userId) {
                    const number = game.winningNumber;
                    numberCounts[number] = (numberCounts[number] || 0) + 1;
                    totalGames++;
                }
            });

            // Calculate percentages
            const percentages = {};
            Object.keys(numberCounts).forEach(number => {
                percentages[number] = (numberCounts[number] / totalGames) * 100;
            });

            return {
                counts: numberCounts,
                percentages,
                totalGames
            };
        } catch (error) {
            console.error('Error getting favorite numbers:', error);
            return {};
        }
    }

    formatStatsForDisplay(stats) {
        if (!stats) return {};

        return {
            gamesPlayed: formatNumber(stats.gamesPlayed),
            gamesWon: formatNumber(stats.gamesWon),
            winRate: `${stats.winRate.toFixed(1)}%`,
            totalWinnings: formatNumber(stats.totalWinnings),
            totalLosses: formatNumber(stats.totalLosses),
            netProfit: formatNumber(stats.netProfit),
            winStreak: formatNumber(stats.winStreak),
            highestWin: formatNumber(stats.highestWin),
            averageBet: formatNumber(Math.round(stats.averageBet))
        };
    }
}

export default StatisticsManager;