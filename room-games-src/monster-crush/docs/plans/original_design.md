# Sugar Splash - Game Design Document

## Overview

**Sugar Splash** is a bright, colorful match-3 puzzle game for casual adults. Players swap adjacent candy tiles to create matches of 3 or more, clearing objectives within a limited number of moves.

### Core Loop

1. Player sees objective (e.g., "Clear all jelly in 20 moves")
2. Swap two adjacent candies to create matches
3. Matched candies disappear, tiles fall, new tiles spawn
4. Chain reactions multiply points
5. Complete objective → earn 1-3 stars based on moves remaining
6. Progress to next level

### Key Stats

- 20 levels at launch
- 8×8 default board
- 6 candy types (distinct colors + shapes)
- Move-limited gameplay (Gardenscapes style)
- Unlimited retries on failure
- Local save (progress + best stars per level)

### Tone

Relaxing but satisfying. No timers, no lives, no pressure. Bright candy visuals with moderate animation polish. Gentle challenge curve that introduces new mechanics gradually.

### Platform

Web browser, responsive (mobile + desktop), fluid scaling with minimum 48px touch targets.

---

## Technology Stack

### Framework

Phaser 3 (latest stable version)

### Language

JavaScript (ES6+)

### Project Structure

```
sugar-splash/
├── index.html
├── assets/
│   ├── images/
│   ├── audio/
│   └── fonts/
├── src/
│   ├── main.js              (Phaser config, entry point)
│   ├── scenes/
│   │   ├── BootScene.js
│   │   ├── MenuScene.js
│   │   ├── GameScene.js
│   │   └── LevelSelectScene.js
│   ├── objects/
│   │   ├── Candy.js
│   │   ├── Board.js
│   │   └── SpecialTile.js
│   ├── systems/
│   │   ├── MatchDetector.js
│   │   ├── BoardFiller.js
│   │   └── ScoreManager.js
│   └── data/
│       └── levels.json
└── README.md
```

### Phaser Scenes

- **BootScene** - Load assets, show loading bar
- **MenuScene** - Title screen, play button, mute toggle
- **LevelSelectScene** - Scrollable level grid with star ratings
- **GameScene** - Main gameplay, HUD, board, pause menu

### Dependencies

No external dependencies beyond Phaser. Vanilla JS, no build tools required (can open index.html directly or use simple local server).

---

## Gameplay Mechanics

### Tile Matching

- Player taps/clicks a candy, then an adjacent candy to swap
- Swap only executes if it creates a match of 3+ in a row/column
- Invalid swaps animate briefly then revert
- Matched tiles pop and disappear with satisfying feedback

### Gravity & Refill

- After matches clear, tiles above fall down (with bounce animation)
- Empty columns fill from top with new random candies
- Board algorithm ensures at least one valid move exists
- If somehow stuck, auto-reshuffle triggers seamlessly

### Chain Reactions (Cascades)

- Falling tiles can create new matches automatically
- Each cascade step adds combo multiplier to score
- Cascades continue until no new matches form
- Big cascades trigger subtle screen shake + particles

### Special Tiles

| Match | Creates | Effect |
|-------|---------|--------|
| 4 in a row | Line Clearer | Clears entire row OR column (based on match direction) |
| 5 in a row | Bomb | Clears 3×3 area around it |
| T or L shape | Bomb | Same as above |

### Special Tile Activation

- Swap the special tile deliberately to trigger it
- OR it triggers automatically if matched with regular candies
- Specials can chain-react with other specials for big clears

---

## Blockers & Objectives

### Blocker Types

| Blocker | Introduced | Behavior |
|---------|------------|----------|
| Jelly | Level 6 | Sits behind tiles. Clears when a match happens on that cell. |
| Double Jelly | Level 18 | Two layers - needs 2 matches on that cell to clear. |
| Locked Tile | Level 12 | Candy is caged. Make a match adjacent to it to unlock, then match normally. |

### Objective Types

| Objective | Example | Introduced |
|-----------|---------|------------|
| Score Target | "Reach 5,000 points" | Level 1 |
| Collect Candies | "Collect 20 blue candies" | Level 6 |
| Clear Jelly | "Clear all jelly" | Level 6 |
| Drop Items | "Bring 3 cherries to the bottom" | Level 11 |

### Level Objective Progression

- **Levels 1-5:** Score targets only (pure matching tutorial)
- **Levels 6-10:** Introduce jelly + collect candies objectives
- **Levels 11-15:** Introduce drop items, mix objectives
- **Levels 16-20:** Locked tiles, double jelly, combined objectives

### Move Limits

- Every level has a set number of moves
- Displayed prominently in HUD
- Running out = fail, instant retry available (no penalty)

---

## Scoring & Progression

### Scoring System

- Base: 10 points per tile cleared
- Combo multiplier: cascade depth × 1.5 (e.g., 3rd cascade = 1.5³ = 3.4× multiplier)
- Special tile clears: 50 bonus points per tile cleared by special
- Bonus points for moves remaining at level end

### Star Ratings

- ⭐ Complete the objective
- ⭐⭐ Complete with 5+ moves remaining
- ⭐⭐⭐ Complete with 10+ moves remaining
- (Thresholds tuned per level in level data)

### Level Progression

- Completing a level unlocks the next
- Stars are saved per level (best attempt)
- Level select shows: level number, star rating (0-3), locked/unlocked state
- Total stars displayed on level select screen

### Save System (localStorage)

```json
{
  "currentLevel": 8,
  "levels": {
    "1": { "completed": true, "stars": 3, "bestScore": 12500 },
    "2": { "completed": true, "stars": 2, "bestScore": 8200 }
  },
  "settings": { "musicOn": true, "sfxOn": true }
}
```

No punishment for failure - retry instantly, keep trying until you win.

---

## UI & Controls

### Main Menu (MenuScene)

- Game title: "Sugar Splash" (large, playful font)
- "Play" button → goes to Level Select
- Sound toggle (music + SFX mute/unmute)
- Simple abstract gradient background

### Level Select (LevelSelectScene)

- Scrollable grid of level buttons (4 columns on mobile, 5 on desktop)
- Each button shows: level number + star rating (0-3 stars)
- Locked levels appear dimmed with lock icon
- Total stars counter at top
- Back button to menu

### Gameplay HUD (GameScene)

- **Top bar:** Level number, objective display (icon + count), moves remaining
- **Board:** Centered, 8×8 grid, fluid scaling
- **Bottom bar:** Score counter, pause button
- **Pause menu overlay:** Resume, Restart, Quit to Level Select, Sound toggle

### Controls

- **Desktop:** Click candy, click adjacent candy to swap (or click-drag)
- **Mobile:** Tap candy, tap adjacent to swap (or swipe)
- Invalid swaps: tiles nudge toward each other, then bounce back
- Minimum touch target: 48×48px

### Feedback Moments

- Match: tiles pop with particle burst
- Cascade: combo counter appears briefly ("×2!", "×3!")
- Level complete: star animation, "Well done!" banner, next level button
- Level fail: "Out of moves!" message, retry button

---

## Audio Design

### Music

- One looping background track - calm, cheerful, not intrusive
- Fades in on menu, continues through gameplay
- Placeholder: royalty-free casual game music (or simple generated loop)

### Sound Effects

| Action | Sound Style |
|--------|-------------|
| Tile select | Soft click/pop |
| Valid swap | Whoosh |
| Invalid swap | Gentle thud/buzz |
| Match (3) | Satisfying pop |
| Match (4+) | Higher-pitched pop + sparkle |
| Cascade combo | Rising pitch per cascade step |
| Special tile create | Magical shimmer |
| Special tile activate | Explosion/whoosh (based on type) |
| Tiles falling | Soft patter |
| Level complete | Cheerful jingle + star chimes |
| Level fail | Gentle "aww" descending tone |
| Button click | UI click |

### Audio Controls

- Single mute toggle on menu (affects both music + SFX)
- Separate toggles in pause menu (optional enhancement)
- Setting persists in localStorage

### Implementation

- Phaser's built-in audio system
- Web Audio API with HTML5 Audio fallback
- Preload all sounds in BootScene

---

## Visual Style & Assets

### Color Palette (Bright & Vibrant)

- Background: Soft gradient (light pink to light blue)
- UI elements: White with colored accents
- Board: Subtle grid lines, slightly rounded cell backgrounds

### 6 Candy Types (Color + Shape)

| Candy | Color | Shape |
|-------|-------|-------|
| 1 | Red | Circle |
| 2 | Blue | Square |
| 3 | Green | Diamond |
| 4 | Yellow | Star |
| 5 | Purple | Triangle |
| 6 | Orange | Hexagon |

All candies have glossy/shiny appearance with subtle highlight.

### Special Tile Visuals

- Line Clearer: Candy with horizontal or vertical stripe through it
- Bomb: Candy wrapped in glowing aura or rainbow border

### Blocker Visuals

- Jelly: Translucent colored layer behind candy
- Double Jelly: Darker/thicker jelly layer
- Locked Tile: Metal cage/chains overlay on candy

### Placeholder Assets

- Simple vector shapes (can create in-code with Phaser Graphics)
- Or basic PNGs created with free tools
- Designed to be easily replaced with polished art later

### Animation Specs

- Swap: 150ms tween
- Fall: 100ms per cell, ease-out bounce
- Match pop: 200ms scale down + fade
- Cascade: 50ms stagger between matches

---

## Hints & Accessibility

### Hint System (Contextual Tutorial Hints)

- Auto-highlights a valid move after 5 seconds of idle
- Only active on levels introducing new mechanics:
  - Levels 1-2: Hints on (teaching basic matching)
  - Level 6: Hints on (first jelly level)
  - Level 11: Hints on (first drop items level)
  - Level 12: Hints on (first locked tiles level)
- Hint visual: Subtle pulsing glow on two swappable candies
- Hints disabled on all other levels to encourage player skill

### Accessibility Features

- Distinct shapes per candy type (colorblind-friendly)
- Large touch targets (minimum 48×48px)
- High contrast UI text
- No flashing/strobing effects
- No time pressure mechanics
- Clear visual feedback for all interactions

---

## Performance & Technical

### Target Performance

- 60 FPS on modern mobile devices
- Smooth animations even during cascades
- Fast input response (<100ms feedback)

### Optimization Strategies

- Object pooling for candies (reuse sprites, don't create/destroy)
- Texture atlas for all candy sprites (single draw call)
- Limit particles (cap at ~50 active particles)
- Efficient match detection (only check affected rows/columns after swap)
- Throttle cascade checks (batch per frame, not per tile)

### Responsive Scaling

- Phaser Scale Manager with `Phaser.Scale.FIT` mode
- Minimum resolution: 320×480
- Maximum resolution: 1920×1080
- Board scales to fit with padding for UI

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Android)
- No IE11 support needed

---

## Level Design Guidelines

### Difficulty Curve

Relaxed progression - early levels should feel easy and satisfying.

### Level Breakdown

| Levels | Mechanics | Objectives | Moves | Difficulty |
|--------|-----------|------------|-------|------------|
| 1-2 | Basic matching only | Score target | 30+ | Tutorial |
| 3-5 | Basic matching, hints off | Score target | 25-30 | Easy |
| 6-7 | Jelly introduced | Clear jelly, collect candies | 25-30 | Easy |
| 8-10 | Jelly patterns | Mixed objectives | 20-25 | Medium |
| 11-13 | Drop items introduced | Drop items, clear jelly | 20-25 | Medium |
| 14-17 | Locked tiles introduced | Mixed objectives | 18-22 | Medium |
| 18-20 | Double jelly, all mechanics | Combined objectives | 15-20 | Medium-Hard |

### Design Principles

- No unwinnable boards - always ensure at least one valid move
- Avoid punishing RNG - player skill should matter more than luck
- Gradual introduction - one new mechanic at a time
- Breathing room - don't make every level at max difficulty
