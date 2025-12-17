// Roulette constants
export const ROULETTE_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
    11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
    22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// Bet types and multipliers
export const BET_TYPES = {
    STRAIGHT: { multiplier: 35, label: 'Einfache Chance' },
    SPLIT: { multiplier: 17, label: 'Split' },
    STREET: { multiplier: 11, label: 'Street' },
    CORNER: { multiplier: 8, label: 'Corner' },
    LINE: { multiplier: 5, label: 'Line' },
    DOZEN: { multiplier: 2, label: 'Dutzend' },
    COLUMN: { multiplier: 2, label: 'Kolonne' },
    RED: { multiplier: 1, label: 'Rot' },
    BLACK: { multiplier: 1, label: 'Schwarz' },
    EVEN: { multiplier: 1, label: 'Gerade' },
    ODD: { multiplier: 1, label: 'Ungerade' },
    LOW: { multiplier: 1, label: '1-18' },
    HIGH: { multiplier: 1, label: '19-36' }
};

// Chip values
export const CHIP_VALUES = [10, 25, 50, 100, 500, 1000];

// Game constants
export const BETTING_TIME = 30; // seconds
export const MIN_BET = 10;
export const MAX_BET = 10000;

// Level progression
export const LEVEL_THRESHOLDS = [
    0,      // Level 1
    1000,   // Level 2
    3000,   // Level 3
    6000,   // Level 4
    10000,  // Level 5
    15000,  // Level 6
    21000,  // Level 7
    28000,  // Level 8
    36000,  // Level 9
    45000   // Level 10
];

// Bonus system
export const BONUS_CONFIG = {
    REGULAR: { amount: 250, interval: 600 }, // 10 minutes
    DAILY: { amount: 1000 },
    WELCOME: { amount: 5000 }
};