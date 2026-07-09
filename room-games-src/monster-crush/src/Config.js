export const GameConfig = {
    // Particle settings
    PARTICLES: {
        CANDY_COUNT: 20,
        JELLY_COUNT: 30,
        SPECIAL_COUNT: 45,
        COLOR_BOMB_COUNT: 80,
        ICE_COUNT: 25,
        CHAIN_COUNT: 20,
        CHOCOLATE_COUNT: 30,
        CRATE_COUNT: 28,
        BOMB_TIMER_COUNT: 40,
        PORTAL_COUNT: 35
    },

    // Board Settings
    BOARD: {
        ROWS: 8,
        COLS: 8,
        PADDING: 15,
        ANIMATION_SPEED: {
            SWAP: 150,
            FALL: 200,
            DESTROY: 200,
            GRAVITY_BASE: 150,
            GRAVITY_PER_ROW: 50,
            FILL_BASE: 300,
            FILL_PER_ROW: 50,
            SPECIAL_ACTIVATION: 300,
            EXPLOSION: 400,
            CROSS_EFFECT: 400,
            SHUFFLE_SCALE: 200,
            JELLY_CLEAR: 200,
            LOCK_BREAK: 300,
            LANDING_SQUASH: 100
        }
    },

    // Candy Colors (Palette)
    COLORS: [
        0xff4757, // Red
        0x3742fa, // Blue
        0x2ed573, // Green
        0xffa502, // Yellow/Orange
        0xa55eea, // Purple
        0xff7f50  // Orange/Coral
    ],

    // UI Colors
    UI: {
        BACKGROUND_GRADIENT_START: { r: 255, g: 182, b: 193 },
        BACKGROUND_GRADIENT_END: { r: 173, g: 216, b: 230 },
        SCORE_TEXT: '#ffffff',
        OBJECTIVE_TEXT_SCORE: '#ffeb3b',
        OBJECTIVE_TEXT_JELLY: '#ff69b4',
        PROGRESS_BAR_BG: 0x000000,
        PROGRESS_BAR_FILL_SCORE: 0x4ade80,
        PROGRESS_BAR_FILL_JELLY: 0xff69b4
    },

    // Special Tile Visuals
    SPECIALS: {
        LINE_STRIPE_COLOR: 0xffffff,
        BOMB_GLOW_COLOR: 0xffffff,
        JELLY_SINGLE_COLOR: 0xff69b4,
        JELLY_DOUBLE_COLOR: 0xff1493,
        LOCK_COLOR: 0x87ceeb
    },

    // Blocker Visuals
    BLOCKERS: {
        // Ice - frozen candy overlay
        ICE_SINGLE_COLOR: 0x87CEEB,
        ICE_DOUBLE_COLOR: 0x4FC3F7,
        ICE_HIGHLIGHT: 0xFFFFFF,
        ICE_SINGLE_ALPHA: 0.5,
        ICE_DOUBLE_ALPHA: 0.7,
        ICE_BORDER_SINGLE: 2,
        ICE_BORDER_DOUBLE: 3,
        ICE_PADDING: 4,
        ICE_CORNER_RADIUS: 8,
        ICE_SPARKLE_RADIUS: [3, 2, 2],

        // Chains - metal links
        CHAIN_COLOR: 0x9E9E9E,
        CHAIN_HIGHLIGHT: 0xBDBDBD,
        CHAIN_LINK_SIZE: 8,
        CHAIN_SINGLE_WIDTH: 3,
        CHAIN_DOUBLE_WIDTH: 4,
        CHAIN_OFFSET_RATIO: 0.5,  // Offset from center as ratio of cellSize/2

        // Stone - indestructible obstacle
        STONE_COLOR: 0x757575,
        STONE_CRACK_COLOR: 0x424242,
        STONE_HIGHLIGHT: 0x9E9E9E,
        STONE_PADDING: 4,
        STONE_CORNER_RADIUS: 6,
        STONE_CRACK_WIDTH: 2,
        STONE_HIGHLIGHT_WIDTH: 2,

        // Honey - spreading hazard
        HONEY_COLOR: 0xFFB300,
        HONEY_DRIP_COLOR: 0xFFC107,
        HONEY_HIGHLIGHT: 0xFFE082,
        HONEY_ALPHA: 0.75,
        HONEY_PADDING: 6,
        HONEY_CORNER_RADIUS: 12,
        HONEY_DRIP_RADII: [8, 6, 5],
        HONEY_HIGHLIGHT_RADII: [6, 3],
        HONEY_SPREAD_INTERVAL: 2,        // Spread every N moves (1 = every move)
        HONEY_SPREAD_CHANCE: 0.5,         // Chance each honey tile spreads (0-1)
        HONEY_COVERAGE_LOSE_THRESHOLD: 0.85,

        // Licorice - wall barrier
        LICORICE_COLOR: 0x212121,
        LICORICE_HIGHLIGHT: 0x424242,
        LICORICE_THICKNESS: 8,
        LICORICE_HIGHLIGHT_WIDTH: 2,

        // Animation durations
        CLEAR_DURATION: 200,
        SHIMMER_DURATION: 1500,
        CHAIN_RATTLE_DURATION: 100,
        CHAIN_RATTLE_DELAY: 2000,
        HONEY_DRIP_DURATION: 800,

        // Chocolate - spreader blocker, blocks cell, cleared by adjacent match
        CHOCOLATE_COLOR: 0x5D4037,
        CHOCOLATE_DARK: 0x3E2723,
        CHOCOLATE_HIGHLIGHT: 0x8D6E63,
        CHOCOLATE_SWIRL_COLOR: 0x4E342E,
        CHOCOLATE_ALPHA: 0.95,
        CHOCOLATE_PADDING: 2,
        CHOCOLATE_CORNER_RADIUS: 10,
        CHOCOLATE_SPREAD_INTERVAL: 2,     // Spreads every 2 moves
        CHOCOLATE_SPREAD_CHANCE: 0.35,    // 35% chance each tile spreads
        CHOCOLATE_COVERAGE_LOSE_THRESHOLD: 0.75,

        // Crate - wooden box around candy (1-3 layers)
        CRATE_COLOR: 0xD7A86E,
        CRATE_DARK: 0xA67C52,
        CRATE_HIGHLIGHT: 0xE8C07D,
        CRATE_NAIL_COLOR: 0x757575,
        CRATE_PADDING: 3,
        CRATE_CORNER_RADIUS: 4,
        CRATE_PLANK_WIDTH: 3,

        // Bomb Timer - countdown candy that must be cleared
        BOMB_TIMER_BG_COLOR: 0x1A1A1A,
        BOMB_TIMER_FUSE_COLOR: 0xFF5722,
        BOMB_TIMER_WARNING_COLOR: 0xFF0000,
        BOMB_TIMER_TEXT_COLOR: 0xFFFFFF,
        BOMB_TIMER_DANGER_THRESHOLD: 3,   // Flash red when <= 3 moves
        BOMB_TIMER_PULSE_DURATION: 300,

        // Conveyor Belt - moves candies in direction
        CONVEYOR_COLOR: 0x607D8B,
        CONVEYOR_STRIPE_COLOR: 0x455A64,
        CONVEYOR_ARROW_COLOR: 0xFFEB3B,
        CONVEYOR_PADDING: 2,
        CONVEYOR_ANIMATION_SPEED: 1000,

        // Portal - paired teleporters
        PORTAL_ENTRANCE_COLOR: 0x7C4DFF,
        PORTAL_EXIT_COLOR: 0x00E676,
        PORTAL_RING_COLOR: 0xFFFFFF,
        PORTAL_GLOW_ALPHA: 0.6,
        PORTAL_SIZE_RATIO: 0.7,
        PORTAL_SPIN_DURATION: 2000
    },

    // Powerup System
    POWERUPS: {
        hammer: {
            name: 'Hammer',
            icon: '🔨',
            description: 'Destroy any single tile',
            weight: 40  // Drop weight for rewards
        },
        bomb: {
            name: 'Bomb',
            icon: '💣',
            description: 'Explode a 3x3 area',
            weight: 30
        },
        rowcol: {
            name: 'Lightning',
            icon: '⚡',
            description: 'Clear entire row or column',
            weight: 20
        },
        colorblast: {
            name: 'Rainbow',
            icon: '🌈',
            description: 'Remove all of one color',
            weight: 10
        }
    },

    // Audio Configuration
    AUDIO: {
        MASTER_VOLUME: 0.3,
        MUSIC_VOLUME_MULTIPLIER: 0.4,

        // Music Settings - Happy C Major Chiptune (no percussion)
        // Structure: A-B-C-A with arpeggio variations
        MUSIC: {
            TEMPO: 80, // Gentle tempo for puzzle game

            // C Major chord progression: I - vi - IV - V (happy, classic)
            // Each chord has multiple arpeggio patterns for variation
            CHORDS: [
                {
                    bass: 130.81,  // C2
                    arp: [261.63, 329.63, 392.00],       // C-E-G (up)
                    arp_alt: [392.00, 329.63, 261.63],   // G-E-C (down)
                    arp_bounce: [261.63, 392.00, 329.63] // C-G-E (bounce)
                },
                {
                    bass: 110.00,  // A2
                    arp: [261.63, 329.63, 440.00],       // C-E-A (up)
                    arp_alt: [440.00, 329.63, 261.63],   // A-E-C (down)
                    arp_bounce: [261.63, 440.00, 329.63] // C-A-E (bounce)
                },
                {
                    bass: 174.61,  // F2
                    arp: [261.63, 349.23, 440.00],       // C-F-A (up)
                    arp_alt: [440.00, 349.23, 261.63],   // A-F-C (down)
                    arp_bounce: [261.63, 440.00, 349.23] // C-A-F (bounce)
                },
                {
                    bass: 196.00,  // G2
                    arp: [293.66, 392.00, 493.88],       // D-G-B (up)
                    arp_alt: [493.88, 392.00, 293.66],   // B-G-D (down)
                    arp_bounce: [293.66, 493.88, 392.00] // D-B-G (bounce)
                }
            ],

            // Section A - Main melody (bright, ascending feel)
            MELODY_A: [
                523.25, 659.25, 783.99, 659.25,  // C5 E5 G5 E5
                587.33, 783.99, 880.00, 783.99,  // D5 G5 A5 G5
                523.25, 880.00, 783.99, 659.25,  // C5 A5 G5 E5
                659.25, 587.33, 523.25, -1       // E5 D5 C5 rest
            ],

            // Section B - Variation (descending, call-and-response)
            MELODY_B: [
                783.99, 659.25, 523.25, -1,      // G5 E5 C5 rest
                880.00, 783.99, 659.25, 587.33,  // A5 G5 E5 D5
                523.25, 587.33, 659.25, 783.99,  // C5 D5 E5 G5 (ascending answer)
                880.00, 783.99, 659.25, 523.25   // A5 G5 E5 C5 (resolve down)
            ],

            // Section C - New variation (playful, skippy rhythm)
            MELODY_C: [
                659.25, -1, 783.99, 659.25,      // E5 rest G5 E5
                523.25, 659.25, 587.33, -1,      // C5 E5 D5 rest
                783.99, 880.00, 783.99, 659.25,  // G5 A5 G5 E5
                587.33, 523.25, -1, -1           // D5 C5 rest rest (breathing room)
            ],

            // Section D - Gentle resolution (calm, floaty)
            // Note: Keep all melody notes in C5+ range to avoid clashing with arpeggios (C4-B4 range)
            MELODY_D: [
                523.25, -1, 659.25, -1,          // C5 rest E5 rest (spacious)
                783.99, -1, 659.25, 523.25,      // G5 rest E5 C5
                587.33, 659.25, 523.25, -1,      // D5 E5 C5 rest
                783.99, 523.25, -1, -1           // G5 C5 rest rest (resolve with fifth)
            ],

            // Structure: A-B-C-A-D-A (theme, variation, playful, theme, calm, theme)
            SECTIONS: ['A', 'B', 'C', 'A', 'D', 'A'],
            MEASURES_PER_SECTION: 4,  // Each section plays for 4 chord cycles

            // Sound palettes for different levels - defines instrument timbres
            // Each palette creates a distinct mood while using the same melodies
            PALETTES: {
                // Soft & Gentle - early levels (sine-heavy, mellow)
                gentle: {
                    bass: { type: 'sine', vol: 0.9 },
                    arp: { type: 'triangle', vol: 0.35 },
                    melody: { type: 'triangle', vol: 0.7 }
                },
                // Classic Chiptune - bright and crisp
                chiptune: {
                    bass: { type: 'triangle', vol: 0.8 },
                    arp: { type: 'square', vol: 0.3 },
                    melody: { type: 'square', vol: 0.6 }
                },
                // Warm & Rich - fuller sound with sawtooth
                warm: {
                    bass: { type: 'triangle', vol: 0.85 },
                    arp: { type: 'triangle', vol: 0.25 },
                    melody: { type: 'sawtooth', vol: 0.45 }
                },
                // Dreamy - soft sine tones, spacious
                dreamy: {
                    bass: { type: 'sine', vol: 0.7 },
                    arp: { type: 'sine', vol: 0.4 },
                    melody: { type: 'triangle', vol: 0.65 }
                },
                // Punchy - more aggressive, game-like
                punchy: {
                    bass: { type: 'sawtooth', vol: 0.6 },
                    arp: { type: 'square', vol: 0.25 },
                    melody: { type: 'square', vol: 0.55 }
                },
                // Crystal - bright and shimmery
                crystal: {
                    bass: { type: 'triangle', vol: 0.75 },
                    arp: { type: 'sine', vol: 0.45 },
                    melody: { type: 'sine', vol: 0.8 }
                }
            },

            // Level to palette mapping - each level sounds distinct
            LEVEL_PALETTES: {
                1: 'gentle',      // Easy intro - soft sounds
                2: 'crystal',     // Bright progression
                3: 'chiptune',    // Classic game feel
                4: 'dreamy',      // Soft variety
                5: 'warm',        // Richer as difficulty increases
                6: 'gentle',      // Jelly intro - calm
                7: 'crystal',     // Clear and bright
                8: 'punchy',      // Energetic middle
                9: 'dreamy',      // Ethereal
                10: 'chiptune',   // Classic milestone
                11: 'warm',       // New mechanics - rich
                12: 'punchy',     // Energetic
                13: 'crystal',    // Bright
                14: 'gentle',     // Calm before storm
                15: 'chiptune',   // Classic
                16: 'punchy',     // Challenge levels - intense
                17: 'dreamy',     // Contrast
                18: 'warm',       // Rich
                19: 'crystal',    // Penultimate - bright
                20: 'punchy',     // World 4 finale
                21: 'gentle',     // World 5 - Ice intro
                22: 'crystal',    // Ice layers - cold feel
                23: 'chiptune',   // Chains intro
                24: 'warm',       // Mixed blockers
                25: 'punchy',     // Stone intro
                26: 'dreamy',     // Honey intro - sticky
                27: 'warm',       // Honey + Stone
                28: 'chiptune',   // Licorice walls
                29: 'punchy',     // Mixed mayhem
                30: 'crystal',    // World 6 finale
                31: 'gentle',     // World 7 - Chocolate intro
                32: 'warm',       // Chocolate spread
                33: 'punchy',     // Crate intro
                34: 'crystal',    // Crate + Ice
                35: 'chiptune',   // Bomb timer intro
                36: 'punchy',     // Bomb timer danger
                37: 'dreamy',     // Conveyor intro
                38: 'warm',       // Conveyor + blockers
                39: 'crystal',    // Portal intro
                40: 'punchy'      // World 8 finale - all mechanics
            }
        },

        // Sound Effect Definitions
        SOUNDS: {
            // UI / Interaction
            select: {
                type: 'sine',
                freqStart: 880,
                freqEnd: 1200,
                duration: 0.05,
                attack: 0.01,
                decay: 0.04
            },
            click: {
                type: 'square',
                freqStart: 400,
                freqEnd: 600,
                duration: 0.05,
                vol: 0.1
            },

            // Gameplay - Basic
            swap: {
                type: 'triangle',
                freqStart: 300,
                freqEnd: 600,
                duration: 0.15,
                slide: true
            },
            invalid: {
                type: 'sawtooth',
                freqStart: 150,
                freqEnd: 80,
                duration: 0.2,
                vol: 0.15
            },
            match: {
                type: 'sine',
                freqStart: 523.25,  // C5
                freqEnd: 1046.50,   // C6
                duration: 0.15,
                vol: 0.25
            },
            cascade: {
                type: 'sine',
                freqStart: 1046.50, // C6
                freqEnd: 2093.00,   // C7
                duration: 0.2,
                vol: 0.25
            },

            // Gameplay - Specials
            bomb: {
                type: 'noise',
                duration: 0.4,
                vol: 0.4
            },
            line: {
                type: 'sawtooth',
                freqStart: 800,
                freqEnd: 200,
                duration: 0.3,
                vol: 0.15,
                slide: true
            },

            // Jingles (Sequences)
            win: {
                type: 'sequence',
                instrument: 'triangle',
                notes: [
                    { freq: 523.25, dur: 0.1, time: 0 },    // C5
                    { freq: 659.25, dur: 0.1, time: 0.1 },  // E5
                    { freq: 783.99, dur: 0.1, time: 0.2 },  // G5
                    { freq: 1046.50, dur: 0.4, time: 0.3 }  // C6
                ],
                vol: 0.2
            },
            levelFail: {
                type: 'sequence',
                instrument: 'sawtooth',
                notes: [
                    { freq: 392.00, dur: 0.2, time: 0 },    // G4
                    { freq: 311.13, dur: 0.2, time: 0.2 },  // Eb4
                    { freq: 261.63, dur: 0.6, time: 0.4 }   // C4
                ],
                vol: 0.15
            }
        }
    }
};
