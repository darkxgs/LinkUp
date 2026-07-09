export const LevelData = {
    // === WORLD 1: BASICS (Levels 1-5) ===
    // Very easy intro levels - players should win on first try
    1: {
        moves: 40,
        objective: 'score',
        targetScore: 500,
        rows: 8, cols: 8,
        candyTypes: 4,  // Easy - only 4 colors
        tutorial: {
            title: 'Welcome!',
            text: 'Swap candies to match 3 or more.\nReach the target score to win!',
            icon: '🍬'
        }
    },
    2: {
        moves: 40,
        objective: 'score',
        targetScore: 800,
        rows: 8, cols: 8,
        candyTypes: 4
    },
    3: {
        moves: 40,
        objective: 'score',
        targetScore: 1000,
        rows: 8, cols: 8,
        candyTypes: 4  // Keep 4 colors for now
    },
    4: {
        moves: 45,
        objective: 'score',
        targetScore: 1200,
        rows: 8, cols: 8,
        candyTypes: 5,  // Introduce 5th color
        // Just 2 decorative locked tiles
        locked: [
            { row: 3, col: 3 }, { row: 3, col: 4 }
        ]
    },
    5: {
        moves: 45,
        objective: 'score',
        targetScore: 1500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Corner locks - don't affect gameplay much
        locked: [
            { row: 0, col: 0 }, { row: 0, col: 7 },
            { row: 7, col: 0 }, { row: 7, col: 7 }
        ]
    },

    // === WORLD 2: JELLY INTRO (Levels 6-10) ===
    // Gentle intro to jelly mechanics
    6: {
        moves: 45,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 4,  // Keep it easy for jelly intro
        // Just 4 jelly tiles in center - very easy
        jelly: [
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 }
        ],
        tutorial: {
            title: 'New: Jelly Tiles!',
            text: 'Match candies on pink tiles\nto clear the jelly!',
            icon: '🍮'
        }
    },
    7: {
        moves: 45,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 4,  // Keep 4 colors
        // 6 jelly tiles in a small pattern
        jelly: [
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 },
            { row: 3, col: 5 }, { row: 4, col: 5 }
        ]
    },
    8: {
        moves: 50,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // 8 jelly tiles - cross pattern
        jelly: [
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 },
            { row: 2, col: 3 }, { row: 2, col: 4 },
            { row: 5, col: 3 }, { row: 5, col: 4 }
        ]
    },
    9: {
        moves: 50,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // 4 corner jellies - spread out for variety
        jelly: [
            { row: 2, col: 2 }, { row: 2, col: 5 },
            { row: 5, col: 2 }, { row: 5, col: 5 }
        ]
    },
    10: {
        moves: 50,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // Double layer intro - only 2 double-layer tiles
        jelly: [
            { row: 3, col: 3, layers: 2 }, { row: 3, col: 4, layers: 2 },
            { row: 4, col: 3 }, { row: 4, col: 4 }
        ]
    },

    // === WORLD 3: NEW MECHANICS (Levels 11-15) ===
    // Introduce new objective types gently
    11: {
        moves: 50,
        objective: 'drop',
        drop: 2,  // Just 2 ingredients
        rows: 8, cols: 8,
        candyTypes: 4,  // Easier with 4 colors
        tutorial: {
            title: 'New: Ingredients!',
            text: 'Drop the cherries 🍒 to the\nbottom of the board!',
            icon: '🍒'
        }
    },
    12: {
        moves: 50,
        objective: 'collect',
        collect: { 0: 15, 1: 15 },  // Red and Blue - very achievable
        rows: 8, cols: 8,
        candyTypes: 5,
        tutorial: {
            title: 'New: Collection!',
            text: 'Match specific colors to\nreach the target!',
            icon: '🔴🔵'
        }
    },
    13: {
        moves: 50,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // 8 jelly tiles in a compact ring
        jelly: [
            { row: 2, col: 3 }, { row: 2, col: 4 },
            { row: 3, col: 2 }, { row: 3, col: 5 },
            { row: 4, col: 2 }, { row: 4, col: 5 },
            { row: 5, col: 3 }, { row: 5, col: 4 }
        ]
    },
    14: {
        moves: 55,
        objective: 'drop',
        drop: 3,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Just one locked tile in the way
        locked: [
            { row: 4, col: 3 }
        ]
    },
    15: {
        moves: 55,
        objective: 'collect',
        collect: { 2: 18, 3: 18 },  // Green and Yellow
        rows: 8, cols: 8,
        candyTypes: 5
        // No jelly - pure collection level
    },

    // === WORLD 4: CHALLENGE (Levels 16-20) ===
    // Slightly harder but still very beatable
    16: {
        moves: 55,
        objective: 'score',
        targetScore: 3000,
        rows: 8, cols: 8,
        candyTypes: 5,  // Still 5 colors
        locked: [
            { row: 3, col: 3 }, { row: 3, col: 4 }
        ]
    },
    17: {
        moves: 55,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // 8 jelly tiles, 4 with double layers
        jelly: [
            { row: 2, col: 3, layers: 2 }, { row: 2, col: 4, layers: 2 },
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 },
            { row: 5, col: 3, layers: 2 }, { row: 5, col: 4, layers: 2 }
        ]
    },
    18: {
        moves: 60,
        objective: 'mixed',
        drop: 2,  // Just 2 ingredients
        jelly: [
            { row: 6, col: 3 }, { row: 6, col: 4 },
            { row: 7, col: 3 }, { row: 7, col: 4 }
        ],
        rows: 8, cols: 8,
        candyTypes: 5
    },
    19: {
        moves: 60,
        objective: 'mixed',
        collect: { 4: 20 },  // Purple - reduced
        jelly: [
            { row: 2, col: 2 }, { row: 2, col: 5 },
            { row: 5, col: 2 }, { row: 5, col: 5 }
        ],
        rows: 8, cols: 8,
        candyTypes: 5
    },
    20: {
        moves: 70,
        objective: 'ultimate',
        targetScore: 5000,  // Reduced
        jelly: [
            { row: 3, col: 3, layers: 2 }, { row: 3, col: 4, layers: 2 },
            { row: 4, col: 3, layers: 2 }, { row: 4, col: 4, layers: 2 }
        ],
        drop: 2,
        collect: { 0: 15, 1: 15 },  // Reduced
        rows: 8, cols: 8,
        candyTypes: 5  // Keep 5 colors even for final level
    },

    // === WORLD 5: NEW BLOCKERS (Levels 21-25) ===
    // Introduce ice, chains, and stone blockers

    21: {
        moves: 35,
        objective: 'score',
        targetScore: 3000,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Ice introduction - 4 single-layer ice tiles
        ice: [
            { row: 3, col: 2, layers: 1 }, { row: 3, col: 5, layers: 1 },
            { row: 4, col: 2, layers: 1 }, { row: 4, col: 5, layers: 1 }
        ],
        tutorial: {
            title: 'New: Ice!',
            text: 'Frozen candies can\'t be swapped!\nMatch them to break the ice.',
            icon: '🧊'
        }
    },
    22: {
        moves: 40,
        objective: 'score',
        targetScore: 3500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Mix of 1-layer and 2-layer ice
        ice: [
            { row: 2, col: 2, layers: 2 }, { row: 2, col: 5, layers: 2 },
            { row: 3, col: 3, layers: 1 }, { row: 3, col: 4, layers: 1 },
            { row: 4, col: 3, layers: 1 }, { row: 4, col: 4, layers: 1 },
            { row: 5, col: 2, layers: 2 }, { row: 5, col: 5, layers: 2 }
        ]
    },
    23: {
        moves: 35,
        objective: 'score',
        targetScore: 3500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Chains introduction - candies can match through chains
        chains: [
            { row: 3, col: 2, layers: 1 }, { row: 3, col: 5, layers: 1 },
            { row: 4, col: 2, layers: 1 }, { row: 4, col: 5, layers: 1 },
            { row: 3, col: 3, layers: 1 }, { row: 4, col: 4, layers: 1 }
        ],
        tutorial: {
            title: 'New: Chains!',
            text: 'Chained candies can\'t move,\nbut can still match through!',
            icon: '⛓️'
        }
    },
    24: {
        moves: 45,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // Ice + Chains + Jelly combo
        jelly: [
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 },
            { row: 5, col: 3 }, { row: 5, col: 4 }
        ],
        ice: [
            { row: 2, col: 3, layers: 1 }, { row: 2, col: 4, layers: 1 }
        ],
        chains: [
            { row: 3, col: 2, layers: 1 }, { row: 4, col: 5, layers: 1 }
        ]
    },
    25: {
        moves: 40,
        objective: 'drop',
        drop: 3,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Stone introduction - creates maze for ingredients
        stone: [
            { row: 3, col: 2 }, { row: 3, col: 5 },
            { row: 5, col: 3 }, { row: 5, col: 4 }
        ],
        tutorial: {
            title: 'New: Stone Blocks!',
            text: 'Stone can\'t be cleared.\nCandies fall around it!',
            icon: '🪨'
        }
    },

    // === WORLD 6: HONEY & LICORICE (Levels 26-30) ===
    // Introduce spreading honey and licorice walls

    26: {
        moves: 40,
        objective: 'score',
        targetScore: 2500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Honey introduction - spreads over time!
        honey: [
            { row: 3, col: 3 }
        ],
        tutorial: {
            title: 'Warning: Honey!',
            text: 'Honey spreads over time!\nMatch on it to clear.',
            icon: '🍯'
        }
    },
    27: {
        moves: 45,
        objective: 'score',
        targetScore: 3500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Honey + Stone to contain it
        honey: [
            { row: 3, col: 3 }, { row: 4, col: 4 }
        ],
        stone: [
            { row: 2, col: 2 }, { row: 2, col: 5 },
            { row: 5, col: 2 }, { row: 5, col: 5 }
        ]
    },
    28: {
        moves: 45,
        objective: 'collect',
        collect: { 0: 20, 1: 20 },  // Red and Blue
        rows: 8, cols: 8,
        candyTypes: 5,
        // Licorice walls divide the board
        licorice: [
            { row: 0, col: 3, side: 'right' },
            { row: 1, col: 3, side: 'right' },
            { row: 2, col: 3, side: 'right' },
            { row: 5, col: 3, side: 'right' },
            { row: 6, col: 3, side: 'right' },
            { row: 7, col: 3, side: 'right' }
        ],
        tutorial: {
            title: 'New: Licorice Walls!',
            text: 'Licorice blocks swaps,\nbut not matches or gravity!',
            icon: '🖤'
        }
    },
    29: {
        moves: 50,
        objective: 'mixed',
        drop: 2,
        jelly: [
            { row: 5, col: 2 }, { row: 5, col: 3 },
            { row: 5, col: 4 }, { row: 5, col: 5 },
            { row: 6, col: 2 }, { row: 6, col: 3 },
            { row: 6, col: 4 }, { row: 6, col: 5 }
        ],
        rows: 8, cols: 8,
        candyTypes: 5,
        // Mixed Mayhem - Ice, Chains, Stone, Jelly
        ice: [
            { row: 2, col: 2, layers: 2 }, { row: 2, col: 5, layers: 2 }
        ],
        chains: [
            { row: 3, col: 3, layers: 1 }, { row: 3, col: 4, layers: 1 }
        ],
        stone: [
            { row: 4, col: 0 }, { row: 4, col: 7 }
        ]
    },
    30: {
        moves: 70,
        objective: 'ultimate',
        targetScore: 4000,
        drop: 2,
        collect: { 0: 12, 1: 12 },  // Red and Blue (reduced)
        jelly: [
            { row: 4, col: 3, layers: 2 }, { row: 4, col: 4, layers: 2 },
            { row: 5, col: 3 }, { row: 5, col: 4 }
        ],
        rows: 8, cols: 8,
        candyTypes: 5,  // Keep 5 colors for balance
        // Ultimate Challenge - mix of blocker types (no honey to reduce difficulty)
        ice: [
            { row: 1, col: 1, layers: 1 }, { row: 1, col: 6, layers: 1 }
        ],
        chains: [
            { row: 2, col: 3, layers: 1 }, { row: 2, col: 4, layers: 1 }
        ],
        stone: [
            { row: 3, col: 0 }, { row: 3, col: 7 }
        ],
        licorice: [
            { row: 3, col: 3, side: 'bottom' },
            { row: 3, col: 4, side: 'bottom' }
        ]
    },

    // === WORLD 7: CHOCOLATE & CRATES (Levels 31-35) ===
    // Introduce chocolate spreader and crate boxes

    31: {
        moves: 45,
        objective: 'score',
        targetScore: 2500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Chocolate introduction - single tile that spreads
        chocolate: [
            { row: 3, col: 3 }
        ],
        tutorial: {
            title: 'Warning: Chocolate!',
            text: "Chocolate spreads sometimes!\nMatch NEXT TO it to clear.",
            icon: '🍫'
        }
    },
    32: {
        moves: 50,
        objective: 'score',
        targetScore: 3500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Multiple chocolate tiles
        chocolate: [
            { row: 2, col: 2 }, { row: 5, col: 5 }
        ],
        // Stone to slow spread
        stone: [
            { row: 3, col: 3 }, { row: 4, col: 4 }
        ]
    },
    33: {
        moves: 40,
        objective: 'score',
        targetScore: 3500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Crate introduction - single layer
        crate: [
            { row: 3, col: 3, layers: 1 }, { row: 3, col: 4, layers: 1 },
            { row: 4, col: 3, layers: 1 }, { row: 4, col: 4, layers: 1 }
        ],
        tutorial: {
            title: 'New: Crates!',
            text: "Candies in crates can match\nbut can't be swapped!",
            icon: '📦'
        }
    },
    34: {
        moves: 45,
        objective: 'clearJelly',
        rows: 8, cols: 8,
        candyTypes: 5,
        // Crate + Ice combo
        jelly: [
            { row: 3, col: 3 }, { row: 3, col: 4 },
            { row: 4, col: 3 }, { row: 4, col: 4 },
            { row: 5, col: 3 }, { row: 5, col: 4 }
        ],
        crate: [
            { row: 2, col: 3, layers: 2 }, { row: 2, col: 4, layers: 2 }
        ],
        ice: [
            { row: 3, col: 2, layers: 1 }, { row: 4, col: 5, layers: 1 }
        ]
    },
    35: {
        moves: 30,
        objective: 'score',
        targetScore: 4000,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Bomb Timer introduction - must clear before timer runs out
        bombTimer: [
            { row: 3, col: 3, moves: 15 }, { row: 4, col: 4, moves: 15 }
        ],
        tutorial: {
            title: 'Danger: Bomb Timers!',
            text: "Clear bombs before they\nexplode or you lose!",
            icon: '💣'
        }
    },

    // === WORLD 8: CONVEYORS & PORTALS (Levels 36-40) ===
    // Introduce movement mechanics

    36: {
        moves: 35,
        objective: 'score',
        targetScore: 4500,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Multiple bomb timers with different countdowns
        bombTimer: [
            { row: 2, col: 2, moves: 12 },
            { row: 2, col: 5, moves: 18 },
            { row: 5, col: 3, moves: 10 }
        ],
        // Some crates to add challenge
        crate: [
            { row: 3, col: 3, layers: 1 }, { row: 3, col: 4, layers: 1 }
        ]
    },
    37: {
        moves: 40,
        objective: 'drop',
        drop: 4,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Conveyor introduction - helps ingredients fall
        conveyor: [
            { row: 3, col: 3, direction: 'down' },
            { row: 3, col: 4, direction: 'down' },
            { row: 4, col: 3, direction: 'down' },
            { row: 4, col: 4, direction: 'down' }
        ],
        tutorial: {
            title: 'New: Conveyors!',
            text: "Conveyors move candies\nin the arrow direction!",
            icon: '➡️'
        }
    },
    38: {
        moves: 45,
        objective: 'collect',
        collect: { 0: 25, 1: 25 },  // Red and Blue
        rows: 8, cols: 8,
        candyTypes: 5,
        // Conveyor loop pattern
        conveyor: [
            { row: 2, col: 2, direction: 'right' },
            { row: 2, col: 3, direction: 'right' },
            { row: 2, col: 4, direction: 'down' },
            { row: 3, col: 4, direction: 'down' },
            { row: 4, col: 4, direction: 'left' },
            { row: 4, col: 3, direction: 'left' },
            { row: 4, col: 2, direction: 'up' },
            { row: 3, col: 2, direction: 'up' }
        ],
        // Some chocolate in the middle
        chocolate: [
            { row: 3, col: 3 }
        ]
    },
    39: {
        moves: 45,
        objective: 'drop',
        drop: 5,
        rows: 8, cols: 8,
        candyTypes: 5,
        // Portal introduction - teleport candies
        portals: [
            { entrance: { row: 3, col: 1 }, exit: { row: 0, col: 6 } },
            { entrance: { row: 3, col: 6 }, exit: { row: 0, col: 1 } }
        ],
        // Stone blocks creating maze
        stone: [
            { row: 4, col: 3 }, { row: 4, col: 4 }
        ],
        tutorial: {
            title: 'New: Portals!',
            text: "Candies teleport through\npurple to green portals!",
            icon: '🌀'
        }
    },
    40: {
        moves: 60,
        objective: 'ultimate',
        targetScore: 6000,
        drop: 3,
        collect: { 0: 15, 1: 15 },
        jelly: [
            { row: 5, col: 3, layers: 2 }, { row: 5, col: 4, layers: 2 },
            { row: 6, col: 3 }, { row: 6, col: 4 }
        ],
        rows: 8, cols: 8,
        candyTypes: 5,
        // Ultimate challenge - mix of new mechanics
        chocolate: [
            { row: 2, col: 2 }
        ],
        crate: [
            { row: 3, col: 3, layers: 2 }, { row: 3, col: 4, layers: 2 }
        ],
        bombTimer: [
            { row: 1, col: 1, moves: 25 }, { row: 1, col: 6, moves: 25 }
        ],
        conveyor: [
            { row: 4, col: 2, direction: 'right' },
            { row: 4, col: 3, direction: 'right' },
            { row: 4, col: 4, direction: 'right' },
            { row: 4, col: 5, direction: 'right' }
        ],
        portals: [
            { entrance: { row: 7, col: 0 }, exit: { row: 0, col: 7 } }
        ],
        stone: [
            { row: 0, col: 0 }, { row: 7, col: 7 }
        ]
    }
};
