import Board from '../objects/Board.js';
import SoundManager from '../systems/SoundManager.js';
import PowerupManager from '../systems/PowerupManager.js';
import DialogManager from '../systems/DialogManager.js';
import BonusRoundManager from '../systems/BonusRoundManager.js';
import HintManager from '../systems/HintManager.js';
import ParticleManager from '../systems/ParticleManager.js';
import HUDManager from '../ui/HUDManager.js';
import { LevelData } from '../data/LevelData.js';
import { GameConfig } from '../Config.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.score = 0;
        this.movesRemaining = 0;
        this.isGameOver = false;
        this.isPaused = false;

        // Multi-objective state
        this.objectives = {
            score: 0,
            jelly: 0,
            collect: {}, // { type: count }
            drop: 0
        };

        this.status = {
            jelly: 0,
            collect: {},
            drop: 0
        };

        // Managers will be created in create()
        this.powerupManager = null;
        this.dialogManager = null;
        this.bonusRoundManager = null;
        this.hudManager = null;
        this.hintManager = null;
        this.particleManager = null;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Initialize Sound Manager with level-specific sound palette
        this.soundManager = new SoundManager(this, this.currentLevel);
        
        // Apply saved mute states
        const soundOn = localStorage.getItem('sugarSplash_sound') !== 'false';
        this.sound.mute = !soundOn;

        // Only start music if music is enabled
        const musicOn = localStorage.getItem('sugarSplash_music') !== 'false';
        if (musicOn) {
            this.soundManager.startMusic();
        }

        // Load level data
        this.loadLevel(this.currentLevel);

        // Create the game board
        this.createBoard(width, height);

        // HUD Manager (includes background, top bar, bottom bar, progress)
        this.hudManager = new HUDManager(this, this.levelConfig);
        this.hudManager.create(width, height, this.currentLevel, this.movesRemaining, this.objectives, this.status, this.score);
        this.hudManager.setPauseCallback(() => {
            if (!this.isGameOver && !this.board.inputLocked) {
                this.isPaused = true;
                this.showPauseMenu();
            }
        });

        // Powerup system
        this.powerupManager = new PowerupManager(this, this.board);
        this.powerupManager.load();
        this.powerupManager.create(width, height);

        // Dialog system
        this.dialogManager = new DialogManager(this);

        // Bonus round system
        this.bonusRoundManager = new BonusRoundManager(this, this.board, this.soundManager);

        // Particle system
        this.particleManager = new ParticleManager(this, this.board);
        this.particleManager.create();
        this.emitter = this.particleManager.getEmitter(); // For backward compatibility with BonusRoundManager

        // Hint system
        this.hintManager = new HintManager(this, this.board);
        this.hintManager.start();

        // Set up event listeners
        this.setupEvents();

        // Show tutorial for new mechanics
        this.showTutorialIfNeeded();

        // Register shutdown handler for cleanup
        this.events.on('shutdown', this.shutdown, this);
    }

    showTutorialIfNeeded() {
        const tutorial = this.levelConfig.tutorial;
        if (!tutorial) return;

        // Check if tutorial was already seen before locking input
        const seenKey = `sugarSplash_tutorial_${this.currentLevel}`;
        if (localStorage.getItem(seenKey)) return;

        this.board.inputLocked = true;
        this.dialogManager.showTutorial(tutorial, () => {
            this.board.inputLocked = false;
            this.hintManager.reset();
        });
    }

    loadLevel(levelNum) {
        const level = LevelData[levelNum] || LevelData[1];
        this.levelConfig = level;
        this.movesRemaining = level.moves;
        
        // Reset objectives
        this.objectives = {
            score: level.targetScore || 0,
            jelly: 0,
            collect: level.collect || {},
            drop: level.drop || 0
        };

        this.status = {
            jelly: 0,
            collect: {},
            drop: 0
        };

        // Initialize collect status
        for (const type in this.objectives.collect) {
            this.status.collect[type] = 0;
        }

        // Calculate jelly target
        if (level.jelly) {
            this.objectives.jelly = level.jelly.reduce((sum, cell) => sum + (cell.layers || 1), 0);
        }
    }

    setupEvents() {
        // Score update from board
        this.events.on('scoreUpdate', (points, cascadeLevel) => {
            this.score += points;
            this.hudManager.setScore(this.score);

            // Play sound
            if (this.soundManager) this.soundManager.play(cascadeLevel > 1 ? 'cascade' : 'match');

            this.hudManager.updateObjectives(this.cameras.main.width, this.score);
            this.hudManager.updateProgressBar(this.score);

            // Show combo text for cascades
            if (cascadeLevel > 1) {
                this.hudManager.showCombo(cascadeLevel);
            }

            // Reset hint timer
            this.hintManager.reset();
        });

        // Special activated event
        this.events.on('specialActivated', (type, row, col) => {
            if (this.soundManager) this.soundManager.play(type === 'bomb' || type === 'color_bomb' ? 'bomb' : 'line');

            // Screen shake based on type
            if (type === 'bomb' || type === 'color_bomb') {
                this.cameras.main.shake(200, 0.015);
            } else {
                this.cameras.main.shake(100, 0.005);
            }

            // Emit some extra particles at the activation point
            this.particleManager.emitSpecial(row, col, type);
        });

        // Jelly cleared event
        this.events.on('jellyCleared', (row, col) => {
            this.status.jelly++;
            if (this.soundManager) this.soundManager.play('line');
            this.hudManager.updateObjectives(this.cameras.main.width, this.score);
            this.hudManager.updateProgressBar(this.score);

            // Jelly-specific particles
            this.particleManager.emitJelly(row, col);

            // Animate objective text
            this.hudManager.animateObjectives();
        });

        // Jelly hit (double->single) event
        this.events.on('jellyHit', (row, col) => {
            this.status.jelly++;
            if (this.soundManager) this.soundManager.play('click');
            this.hudManager.updateObjectives(this.cameras.main.width, this.score);
            this.hudManager.updateProgressBar(this.score);
        });

        // Lock broken event
        this.events.on('lockBroken', (row, col) => {
            if (this.soundManager) this.soundManager.play('line');
            // Visual feedback - screen flash
            this.cameras.main.flash(100, 135, 206, 235, false);
        });

        // Ice cleared event
        this.events.on('iceCleared', (row, col) => {
            if (this.soundManager) this.soundManager.play('line');
            this.cameras.main.flash(100, 135, 206, 250, false); // Light blue flash
            this.particleManager.emitIce(row, col, 1);
        });

        // Ice hit (2-layer to 1-layer)
        this.events.on('iceHit', (row, col) => {
            if (this.soundManager) this.soundManager.play('click');
            this.particleManager.emitIce(row, col, 0.5); // Smaller burst for hit
        });

        // Chain broken event
        this.events.on('chainBroken', (row, col) => {
            if (this.soundManager) this.soundManager.play('line');
            this.cameras.main.flash(100, 158, 158, 158, false); // Gray flash
            this.particleManager.emitChain(row, col, 1);
        });

        // Chain hit
        this.events.on('chainHit', (row, col) => {
            if (this.soundManager) this.soundManager.play('click');
            this.particleManager.emitChain(row, col, 0.5);
        });

        // Honey cleared event
        this.events.on('honeyCleared', (row, col) => {
            if (this.soundManager) this.soundManager.play('match');
        });

        // Honey spread event
        this.events.on('honeySpread', () => {
            if (this.soundManager) this.soundManager.play('invalid');
        });

        // Chocolate cleared event
        this.events.on('chocolateCleared', (row, col) => {
            if (this.soundManager) this.soundManager.play('match');
            this.cameras.main.flash(100, 93, 64, 55, false); // Brown flash
            this.particleManager.emitChocolate(row, col);
        });

        // Chocolate spread event
        this.events.on('chocolateSpread', () => {
            if (this.soundManager) this.soundManager.play('invalid');
            this.cameras.main.shake(100, 0.003);
        });

        // Crate broken event
        this.events.on('crateBroken', (row, col) => {
            if (this.soundManager) this.soundManager.play('line');
            this.cameras.main.flash(100, 215, 168, 110, false); // Wooden color flash
            this.particleManager.emitCrate(row, col, 1);
        });

        // Crate hit event
        this.events.on('crateHit', (row, col) => {
            if (this.soundManager) this.soundManager.play('click');
            this.particleManager.emitCrate(row, col, 0.5);
        });

        // Bomb timer cleared (defused) event
        this.events.on('bombTimerCleared', (row, col) => {
            if (this.soundManager) this.soundManager.play('win');
            this.cameras.main.flash(100, 255, 235, 59, false); // Yellow flash - safe!
            this.particleManager.emitBombTimerCleared(row, col);
        });

        // Bomb timer expired - LOSE!
        this.events.on('bombTimerExpired', (row, col) => {
            if (this.soundManager) this.soundManager.play('levelFail');
            this.cameras.main.shake(500, 0.05);
            this.showLoseScreen();
        });

        // Conveyor moved event
        this.events.on('conveyorMoved', () => {
            if (this.soundManager) this.soundManager.play('swap');
        });

        // Valid swap - decrement moves
        this.events.on('validSwap', () => {
            if (this.soundManager) this.soundManager.play('swap');
            this.movesRemaining--;
            this.hudManager.setMoves(this.movesRemaining);

            // Animate moves text when low
            if (this.movesRemaining <= 5) {
                this.hudManager.animateMoves();
                this.hudManager.setMovesWarning();
            }

            // Reset hint timer
            this.hintManager.reset();
        });

        // Cascade complete - check win/lose conditions
        this.events.on('cascadeComplete', async () => {
            if (this.isGameOver) return;

            // Spread honey after each completed cascade (if level has honey)
            if (this.board.spreadHoney()) {
                // Check if board is covered in honey (lose condition)
                let honeyCount = 0;
                let candyCount = 0;
                for (let r = 0; r < this.board.rows; r++) {
                    for (let c = 0; c < this.board.cols; c++) {
                        if (this.board.candies[r][c]) candyCount++;
                        if (this.board.honey[r][c]) honeyCount++;
                    }
                }
                const threshold = GameConfig.BLOCKERS.HONEY_COVERAGE_LOSE_THRESHOLD;
                if (honeyCount >= candyCount * threshold) {
                    // Almost all covered in honey - lose!
                    this.showLoseScreen();
                    return;
                }
            }

            // Spread chocolate after each move (more aggressive than honey)
            if (this.board.spreadChocolate()) {
                // Check if chocolate has taken over
                let chocolateCount = 0;
                let totalCells = 0;
                for (let r = 0; r < this.board.rows; r++) {
                    for (let c = 0; c < this.board.cols; c++) {
                        if (!this.board.stone[r][c]) totalCells++;
                        if (this.board.chocolate[r][c]) chocolateCount++;
                    }
                }
                const threshold = GameConfig.BLOCKERS.CHOCOLATE_COVERAGE_LOSE_THRESHOLD;
                if (chocolateCount >= totalCells * threshold) {
                    this.showLoseScreen();
                    return;
                }
            }

            // Decrement bomb timers - if any expire, it's game over
            if (this.board.decrementBombTimers()) {
                return; // bombTimerExpired event will trigger showLoseScreen
            }

            // Process conveyors (move candies)
            await this.board.processConveyors();

            if (this.checkWinCondition()) {
                this.showWinScreen();
                return;
            }

            // Check lose condition
            if (this.movesRemaining <= 0) {
                this.showLoseScreen();
            }
        });

        // Invalid swap feedback
        this.events.on('invalidSwap', () => {
            if (this.soundManager) this.soundManager.play('invalid');
            this.hintManager.reset();
        });

        // Candy cleared
        this.events.on('candyCleared', (row, col, type) => {
            this.particleManager.emitCandy(row, col, type);

            // Check for collect objective
            if (this.objectives.collect[type] !== undefined) {
                this.status.collect[type]++;
                this.hudManager.updateObjectives(this.cameras.main.width, this.score);
                this.hudManager.updateProgressBar(this.score);
            }

            // Check for ingredient collect (type >= 100)
            if (type >= 100) {
                this.status.drop++;
                if (this.soundManager) this.soundManager.play('win'); // special sound for ingredient
                this.hudManager.updateObjectives(this.cameras.main.width, this.score);
                this.hudManager.updateProgressBar(this.score);
            }
        });
    }

    checkWinCondition() {
        if (this.isGameOver) return false;

        // Check score
        if (this.objectives.score > 0 && this.score < this.objectives.score) return false;

        // Check jelly
        if (this.status.jelly < this.objectives.jelly) return false;

        // Check drop items
        if (this.status.drop < this.objectives.drop) return false;

        // Check collect candies
        for (const type in this.objectives.collect) {
            if ((this.status.collect[type] || 0) < this.objectives.collect[type]) return false;
        }

        return true;
    }

    showLoseScreen() {
        this.isGameOver = true;
        if (this.soundManager) this.soundManager.play('levelFail');
        this.board.inputLocked = true;
        this.hintManager.clear();

        this.dialogManager.showLose(
            () => this.scene.restart({ level: this.currentLevel }),
            () => this.scene.start('LevelSelectScene')
        );
    }

    async showWinScreen() {
        this.isGameOver = true;
        this.board.inputLocked = true;
        this.hintManager.clear();

        // Play Bonus Round if moves remaining
        if (this.movesRemaining > 0) {
            this.movesRemaining = await this.bonusRoundManager.play(
                this.movesRemaining,
                (moves) => {
                    this.movesRemaining = moves;
                    this.hudManager.setMoves(moves);
                    this.hudManager.animateMoves();
                }
            );
        }

        if (this.soundManager) this.soundManager.play('win');

        // Calculate stars
        let stars = 1;
        if (this.movesRemaining > 5) stars = 2;
        if (this.movesRemaining > 10) stars = 3;

        this.saveProgress(stars);

        // Award powerups based on stars
        const awardedPowerups = this.powerupManager.award(stars);

        // Show win dialog
        this.dialogManager.showWin({
            score: this.score,
            stars,
            awardedPowerups,
            currentLevel: this.currentLevel,
            onNext: () => this.currentLevel < 40
                ? this.scene.restart({ level: this.currentLevel + 1 })
                : this.scene.start('MenuScene'),
            onReplay: () => this.scene.restart({ level: this.currentLevel }),
            onLevelSelect: () => this.scene.start('LevelSelectScene'),
            soundManager: this.soundManager
        });
    }

    saveProgress(stars) {
        try {
            const saveKey = 'sugarSplash_save';
            let saveData = localStorage.getItem(saveKey);
            saveData = saveData ? JSON.parse(saveData) : { levels: {} };

            // Update level data
            const existingData = saveData.levels[this.currentLevel] || { completed: false, stars: 0, bestScore: 0 };
            saveData.levels[this.currentLevel] = {
                completed: true,
                stars: Math.max(existingData.stars, stars),
                bestScore: Math.max(existingData.bestScore, this.score)
            };

            localStorage.setItem(saveKey, JSON.stringify(saveData));
        } catch (e) {
            console.warn('Failed to save progress:', e);
        }
    }

    showPauseMenu() {
        if (this.isGameOver || !this.isPaused) return;

        this.board.inputLocked = true;
        this.hintManager.clear();

        const { overlay, container: pauseContainer } = this.dialogManager.showPause({
            onResume: () => {
                this.board.inputLocked = false;
                this.isPaused = false;
                this.hintManager.reset();
            },
            onRestart: () => this.scene.restart({ level: this.currentLevel }),
            onQuit: () => this.showQuitConfirmation(overlay, pauseContainer),
            soundManager: this.soundManager
        });
    }

    showQuitConfirmation(pauseOverlay, pauseMenu) {
        pauseMenu.setVisible(false);

        this.dialogManager.showConfirmation(
            'Quit this level?\nProgress will be lost.',
            () => this.scene.start('LevelSelectScene'),
            () => pauseMenu.setVisible(true)
        );
    }

    update(time, delta) {
        // Watchdog for input lock - last resort safety net
        // ActionProcessor now handles errors properly, so this should rarely trigger
        // Don't trigger during pause or game over states
        if (this.board && this.board.inputLocked && !this.isGameOver && !this.isPaused) {
            this.lockTimer = (this.lockTimer || 0) + delta;
            if (this.lockTimer > 10000) { // 10 seconds - extended timeout as backup only
                console.warn('Input lock watchdog triggered after 10s - forcing unlock (this indicates a bug)');
                this.board.inputLocked = false;
                if (this.board.actionProcessor) {
                    this.board.actionProcessor.isProcessing = false;
                }
                this.lockTimer = 0;
            }
        } else {
            this.lockTimer = 0;
        }
    }

    createBoard(width, height) {
        const cols = GameConfig.BOARD.COLS;
        const rows = GameConfig.BOARD.ROWS;

        // Layout constants
        const topBarHeight = 140;
        const bottomBarHeight = 95; // Taller bottom bar for powerups + score

        // Calculate cell size to fit the board within the screen with some padding
        const availableWidth = width * 0.95;
        const availableHeight = height - topBarHeight - bottomBarHeight - 20; // 20px padding

        const sizeByWidth = availableWidth / cols;
        const sizeByHeight = availableHeight / rows;

        const cellSize = Math.floor(Math.min(sizeByWidth, sizeByHeight));

        // Center the board
        const boardWidth = cols * cellSize;
        const boardHeight = rows * cellSize;

        const x = (width - boardWidth) / 2;
        const y = topBarHeight + (height - topBarHeight - bottomBarHeight - boardHeight) / 2;

        this.board = new Board(this, {
            rows: rows,
            cols: cols,
            x: x,
            y: y,
            cellSize: cellSize,
            candyTypes: 6,
            levelConfig: this.levelConfig
        });
    }

    shutdown() {
        // Stop music first and destroy sound manager
        if (this.soundManager) {
            this.soundManager.destroy();
            this.soundManager = null;
        }

        // Destroy powerup manager
        if (this.powerupManager) {
            this.powerupManager.destroy();
            this.powerupManager = null;
        }

        // Destroy dialog manager
        if (this.dialogManager) {
            this.dialogManager.destroy();
            this.dialogManager = null;
        }

        // Destroy bonus round manager
        if (this.bonusRoundManager) {
            this.bonusRoundManager.destroy();
            this.bonusRoundManager = null;
        }

        // Destroy HUD manager
        if (this.hudManager) {
            this.hudManager.destroy();
            this.hudManager = null;
        }

        // Destroy hint manager
        if (this.hintManager) {
            this.hintManager.destroy();
            this.hintManager = null;
        }

        // Destroy particle manager
        if (this.particleManager) {
            this.particleManager.destroy();
            this.particleManager = null;
        }

        // Clean up event listeners to prevent memory leaks
        this.events.off('scoreUpdate');
        this.events.off('jellyCleared');
        this.events.off('jellyHit');
        this.events.off('lockBroken');
        this.events.off('iceCleared');
        this.events.off('iceHit');
        this.events.off('chainBroken');
        this.events.off('chainHit');
        this.events.off('honeyCleared');
        this.events.off('honeySpread');
        this.events.off('validSwap');
        this.events.off('cascadeComplete');
        this.events.off('invalidSwap');
        this.events.off('candyCleared');
        this.events.off('specialActivated');
        this.events.off('shutdown');

        // Clean up board
        if (this.board) {
            this.board.destroy();
            this.board = null;
        }

        // Null out particle emitter reference
        this.emitter = null;
    }
}
