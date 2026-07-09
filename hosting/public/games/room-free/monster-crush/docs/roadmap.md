# Sugar Splash Roadmap

## Completed

### Core Gameplay
- [x] Match-3 mechanics with swap validation
- [x] Cascades with combo multipliers
- [x] Special candies (Line, Bomb, Color Bomb)
- [x] Special + Special combo effects
- [x] Blockers (Jelly, Locked, Ice, Chains, Stone, Honey, Licorice, Chocolate, Crate, Bomb Timer, Conveyor, Portal)
- [x] Multiple objective types (Score, Jelly, Collect, Drop, Mixed, Ultimate)
- [x] 40 levels with progressive difficulty across 8 worlds

### Systems
- [x] ActionProcessor with error recovery
- [x] Config centralization in Config.js
- [x] Procedural WebAudio (music + SFX)
- [x] C64Sequencer for menu chiptune music
- [x] Powerup system with rewards
- [x] Bonus round (moves to specials)
- [x] Hint system with dual-candy highlighting
- [x] Tutorial overlays
- [x] Settings dialogs (Menu & Level Select)

### Architecture (Refactored Dec 2025)
- [x] GameScene split into focused managers
- [x] PowerupManager - powerup UI & activation
- [x] DialogManager - win/lose/pause/tutorial dialogs
- [x] BonusRoundManager - end-of-level bonus
- [x] HUDManager - score, moves, progress
- [x] HintManager - idle hint display
- [x] ParticleManager - particle effects

### Polish
- [x] Particle effects (candy colors, jelly, specials)
- [x] Invalid swap shake + red tint
- [x] Mobile swipe controls
- [x] Sound/music toggles
- [x] Scene lifecycle cleanup
- [x] Color bomb laser beam effect
- [x] Score counter animation (counting up with pop effect)
- [x] Animated menu/level select screens
- [x] Hint system cycles visibility (show/hide)

---

## Future Enhancements

### Features
- [x] More levels (31-40) - Added chocolate, crate, bomb timer, conveyor, portal mechanics
- [ ] More levels (41-50)
- [ ] Daily challenges
- [ ] High score leaderboards (local)

### Polish
- [ ] Improved in-game music quality (less repetitive)
- [x] More particle variety (blocker-specific particles, coin bonanza during bonus)
- [x] Screen shake on special effects
- [x] Smart hint system (prioritizes objectives, blockers, bomb timers)

### Low Priority
- [ ] Level data externalization to JSON
- [ ] Accessibility improvements (more colorblind patterns)
