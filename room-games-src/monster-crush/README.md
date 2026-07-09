# Sugar Splash

A polished match-3 puzzle game built with Phaser 3.

## Quick Start

<https://tomcoolpxl.github.io/sugar-splat/>

## Features

### Core Gameplay
- 8x8 match-3 board with 6 candy types
- Swap adjacent candies to create matches of 3+
- Chain reactions (cascades) with combo multipliers
- Move-limited levels with varied objectives
- 40 levels with progressive difficulty across 8 worlds

### Special Candies
| Match Pattern | Creates | Effect |
|---------------|---------|--------|
| 4 in a row | Line Clearer | Clears entire row or column |
| 5 in a row | Color Bomb | Clears all candies of one color |
| T or L shape | Bomb | Clears 3x3 area |

### Special Combos
| Combo | Effect |
|-------|--------|
| Line + Line | Cross clear (row + column) |
| Bomb + Bomb | Large 5x5 explosion |
| Bomb + Line | 3 rows or 3 columns cleared |
| Color Bomb + Any | All of that color become specials |

### Blockers
| Type | Behavior |
|------|----------|
| Jelly (Single) | Clears when match occurs on cell |
| Jelly (Double) | Requires 2 matches to clear |
| Locked Tile | Unlocks when adjacent match occurs |
| Ice (1-2 layers) | Frozen candy can't swap; match it to break ice |
| Chains (1-2 layers) | Chained candy can't swap but can match through |
| Stone | Permanent obstacle; candies fall around it |
| Honey | Spreads each turn! Match on honey to clear it |
| Licorice Walls | Blocks swaps between cells (not matches) |
| Chocolate | Spreads to adjacent cells; match next to it to clear |
| Crate (1-3 layers) | Wooden box around candy; match to break layers |
| Bomb Timer | Countdown bomb; must clear before it explodes! |
| Conveyor Belt | Moves candies in direction each turn |
| Portal | Teleports candies between paired locations |

### Objectives
- Score targets
- Clear all jelly
- Collect specific candy colors
- Drop ingredients to bottom row

### Powerups
Earn powerups by completing levels with stars:
- **Hammer** - Clear single candy
- **Bomb** - 3x3 explosion
- **Row/Col** - Clear cross pattern
- **Color Blast** - Clear all of one color

### Polish
- Procedural audio (WebAudio synth music & SFX)
- C64-style chiptune music for menus
- Particle effects for matches and specials
- Color bomb laser beam effect (beams to all targets)
- Score counter animation (counts up smoothly)
- Bonus round converts remaining moves to points
- Hint system with pulsing rings on both swap candies
- Animated menu screens with floating candies
- Star ratings (1-3 based on moves remaining)
- Local save (localStorage)

## Project Structure

```
sugar-splash/
├── index.html
├── src/
│   ├── main.js                 # Phaser configuration
│   ├── Config.js               # Centralized game config
│   ├── data/
│   │   └── LevelData.js        # Level definitions (40 levels)
│   ├── scenes/
│   │   ├── BootScene.js        # Asset generation
│   │   ├── MenuScene.js        # Title screen
│   │   ├── LevelSelectScene.js # Level grid
│   │   └── GameScene.js        # Main gameplay orchestration
│   ├── objects/
│   │   ├── Board.js            # Grid logic, input handling
│   │   └── Candy.js            # Individual candy sprites
│   ├── systems/
│   │   ├── ActionProcessor.js  # Cascade/match processing
│   │   ├── MatchLogic.js       # Match detection algorithms
│   │   ├── SoundManager.js     # WebAudio procedural audio
│   │   ├── C64Sequencer.js     # C64-style chiptune music
│   │   ├── PowerupManager.js   # Powerup UI & activation
│   │   ├── DialogManager.js    # Win/lose/pause dialogs
│   │   ├── BonusRoundManager.js# End-of-level bonus round
│   │   ├── HintManager.js      # Idle hint system
│   │   └── ParticleManager.js  # Particle effects
│   └── ui/
│       └── HUDManager.js       # Score, moves, progress bar
└── docs/
    ├── roadmap.md              # Current status & future plans
    └── code_review.md          # Technical architecture notes
```

## Controls

- **Click/tap** a candy to select it
- **Click/tap** an adjacent candy to swap
- **Swipe** on mobile for quick swaps
- Invalid swaps animate and revert

## Technical Notes

- Phaser 3.80.1 (CDN)
- No build tools required
- Assets generated procedurally (Graphics API)
- Audio generated with WebAudio API
- Responsive scaling (mobile-first 720x1280)
- Touch-friendly with swipe support
