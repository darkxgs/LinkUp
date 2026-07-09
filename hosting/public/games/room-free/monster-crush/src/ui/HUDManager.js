/**
 * HUDManager - Handles all HUD elements (top bar, bottom bar, progress, objectives)
 */
export default class HUDManager {
    constructor(scene, levelConfig) {
        this.scene = scene;
        this.levelConfig = levelConfig;

        // UI Elements
        this.movesText = null;
        this.scoreText = null;
        this.objectiveText = null;
        this.progressBar = null;
        this.progressBarBg = null;
        this.comboText = null;

        // Progress bar state
        this.currentProgress = 0;
        this.progressBarColor = 0x4ade80;
        this.progressTween = null;

        // Score animation state
        this.displayedScore = 0;
        this.targetScore = 0;
        this.scoreTween = null;

        // Callbacks
        this.onPause = null;
    }

    create(width, height, currentLevel, movesRemaining, objectives, status, score) {
        this.objectives = objectives;
        this.status = status;

        // Background
        this.createBackground(width, height);

        // Top bar
        this.createTopBar(width, height, currentLevel, movesRemaining);

        // Objectives display
        this.createObjectivesDisplay(width, score);

        // Progress bar
        this.createProgressBar(width);

        // Bottom bar
        this.createBottomBar(width, height, score);

        // Combo text
        this.createComboText(width);
    }

    createBackground(width, height) {
        const graphics = this.scene.add.graphics();
        const steps = 20;
        for (let i = 0; i < steps; i++) {
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 255, g: 182, b: 193 },
                { r: 173, g: 216, b: 230 },
                steps,
                i
            );
            graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
            graphics.fillRect(0, (height / steps) * i, width, height / steps + 1);
        }
    }

    createTopBar(width, height, currentLevel, movesRemaining) {
        // Top bar background
        const topBar = this.scene.add.graphics();
        topBar.fillStyle(0x000000, 0.3);
        topBar.fillRoundedRect(20, 20, width - 40, 120, 15);

        // Level number
        this.scene.add.text(40, 35, `Level ${currentLevel}`, {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });

        // Pause button (top right corner, with margin from edge)
        const pauseBtnBg = this.scene.add.graphics();
        pauseBtnBg.fillStyle(0xffffff, 0.3);
        pauseBtnBg.fillRoundedRect(width - 85, 28, 50, 40, 10);

        const pauseBtn = this.scene.add.text(width - 60, 48, '| |', {
            fontFamily: 'Arial Black',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        pauseBtn.on('pointerover', () => {
            pauseBtn.setScale(1.1);
            pauseBtnBg.clear();
            pauseBtnBg.fillStyle(0xffffff, 0.5);
            pauseBtnBg.fillRoundedRect(width - 85, 28, 50, 40, 10);
        });
        pauseBtn.on('pointerout', () => {
            pauseBtn.setScale(1);
            pauseBtnBg.clear();
            pauseBtnBg.fillStyle(0xffffff, 0.3);
            pauseBtnBg.fillRoundedRect(width - 85, 28, 50, 40, 10);
        });
        pauseBtn.on('pointerup', () => {
            if (this.onPause) this.onPause();
        });

        // Moves counter (with spacing from pause button)
        this.movesText = this.scene.add.text(width - 100, 35, `Moves: ${movesRemaining}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 0);
    }

    createObjectivesDisplay(width, score) {
        const objectives = [];

        if (this.objectives.jelly > 0) {
            const remaining = Math.max(0, this.objectives.jelly - this.status.jelly);
            const display = remaining === 0 ? '✓' : remaining;
            objectives.push(`🍮 ${display}`);
        }

        if (this.objectives.drop > 0) {
            const remaining = Math.max(0, this.objectives.drop - this.status.drop);
            const display = remaining === 0 ? '✓' : remaining;
            objectives.push(`🍒 ${display}`);
        }

        for (const type in this.objectives.collect) {
            const icons = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
            const remaining = Math.max(0, this.objectives.collect[type] - (this.status.collect[type] || 0));
            const display = remaining === 0 ? '✓' : remaining;
            objectives.push(`${icons[type] || '🍬'} ${display}`);
        }

        // Always show score target when it exists
        if (this.objectives.score > 0) {
            const display = score >= this.objectives.score ? '✓' : `${score}/${this.objectives.score}`;
            objectives.push(`🎯 ${display}`);
        }

        const text = objectives.join('   ');

        if (this.objectiveText && this.objectiveText.scene) {
            this.objectiveText.setText(text);
        } else {
            this.objectiveText = this.scene.add.text(width / 2, 80, text, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '26px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);
        }
    }

    createProgressBar(width) {
        const progressBarWidth = width - 100;
        const progressBarX = 50;
        const progressBarY = 115;

        this.progressBarBg = this.scene.add.graphics();
        this.progressBarBg.fillStyle(0x000000, 0.5);
        this.progressBarBg.fillRoundedRect(progressBarX, progressBarY, progressBarWidth, 16, 8);

        this.progressBar = this.scene.add.graphics();
    }

    createBottomBar(width, height, score) {
        // Bottom bar - taller to fit powerups and score
        const bottomBar = this.scene.add.graphics();
        bottomBar.fillStyle(0x000000, 0.3);
        bottomBar.fillRoundedRect(20, height - 90, width - 40, 75, 15);

        // Initialize score tracking
        this.displayedScore = score;
        this.targetScore = score;

        // Score display - positioned on the right side to leave room for powerups
        this.scoreText = this.scene.add.text(width - 40, height - 52, `${score}`, {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '26px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(1, 0.5);

        // Score label
        this.scene.add.text(width - 40, height - 75, 'Score', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            color: '#cccccc'
        }).setOrigin(1, 0.5);
    }

    createComboText(width) {
        this.comboText = this.scene.add.text(width / 2, 155, '', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '42px',
            color: '#ffeb3b',
            stroke: '#ff6b9d',
            strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0).setDepth(50);
    }

    // --- Update Methods ---

    setMoves(moves) {
        if (this.movesText?.scene) {
            this.movesText.setText(`Moves: ${moves}`);
        }
    }

    animateMoves() {
        if (this.movesText?.scene) {
            this.scene.tweens.add({
                targets: this.movesText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true
            });
        }
    }

    setMovesWarning() {
        if (this.movesText?.scene) {
            this.movesText.setColor('#ff4757');
        }
    }

    setScore(score) {
        if (!this.scoreText?.scene) return;

        const previousTarget = this.targetScore;
        this.targetScore = score;

        // If score increased, animate the counting
        if (score > previousTarget) {
            // Kill existing tween
            if (this.scoreTween) {
                this.scoreTween.stop();
            }

            // Calculate duration based on score difference (faster for small gains)
            const diff = score - this.displayedScore;
            const duration = Math.min(Math.max(diff * 2, 200), 800);

            // Animate the displayed score counting up
            this.scoreTween = this.scene.tweens.add({
                targets: this,
                displayedScore: score,
                duration: duration,
                ease: 'Power2',
                onUpdate: () => {
                    const displayValue = Math.floor(this.displayedScore);
                    this.scoreText.setText(`${displayValue}`);
                },
                onComplete: () => {
                    this.scoreText.setText(`${score}`);
                    this.displayedScore = score;
                }
            });

            // Pop effect on the score text
            this.scene.tweens.add({
                targets: this.scoreText,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 100,
                yoyo: true,
                ease: 'Back.easeOut'
            });

            // Flash color effect (white -> yellow -> white)
            this.scoreText.setColor('#ffeb3b');
            this.scene.time.delayedCall(200, () => {
                if (this.scoreText?.scene) {
                    this.scoreText.setColor('#ffffff');
                }
            });
        } else {
            // Just set directly for same/lower score
            this.displayedScore = score;
            this.scoreText.setText(`${score}`);
        }
    }

    updateObjectives(width, score) {
        this.createObjectivesDisplay(width, score);
    }

    animateObjectives() {
        if (this.objectiveText?.scene) {
            this.scene.tweens.add({
                targets: this.objectiveText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true
            });
        }
    }

    updateProgressBar(score) {
        const width = this.scene.cameras.main.width;
        const progressBarWidth = width - 100;
        const progressBarX = 50;
        const progressBarY = 115;

        let targetProgress = 0;
        let color = 0x4ade80; // Default green

        // Calculate aggregate progress of all objectives
        let totalGoals = 0;
        let totalCurrent = 0;

        if (this.objectives.jelly > 0) {
            totalGoals += this.objectives.jelly;
            totalCurrent += this.status.jelly;
            color = 0xff69b4;
        }

        if (this.objectives.drop > 0) {
            totalGoals += this.objectives.drop;
            totalCurrent += this.status.drop;
            color = 0xd63031;
        }

        for (const type in this.objectives.collect) {
            totalGoals += this.objectives.collect[type];
            totalCurrent += this.status.collect[type];
        }

        if (totalGoals > 0) {
            targetProgress = Math.min(totalCurrent / totalGoals, 1);
        } else if (this.objectives.score > 0) {
            targetProgress = Math.min(score / this.objectives.score, 1);
        }

        // Kill any existing progress tween
        if (this.progressTween) {
            this.progressTween.stop();
        }

        this.progressBarColor = color;

        this.progressTween = this.scene.tweens.add({
            targets: this,
            currentProgress: targetProgress,
            duration: 300,
            ease: 'Power2',
            onUpdate: () => {
                this.redrawProgressBar(progressBarX, progressBarY, progressBarWidth);
            }
        });
    }

    redrawProgressBar(x, y, maxWidth) {
        this.progressBar.clear();
        if (this.currentProgress > 0) {
            this.progressBar.fillStyle(this.progressBarColor, 1);
            this.progressBar.fillRoundedRect(x, y, maxWidth * this.currentProgress, 16, 8);
        }
    }

    showCombo(combo) {
        if (!this.comboText?.scene) return;

        this.comboText.setText(`${combo}x COMBO!`);
        this.comboText.setAlpha(1);
        this.comboText.setScale(0.5);
        this.comboText.y = 155;

        this.scene.tweens.add({
            targets: this.comboText,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0,
            y: 100,
            duration: 1000,
            ease: 'Power2'
        });
    }

    // --- Utility ---

    setPauseCallback(callback) {
        this.onPause = callback;
    }

    destroy() {
        if (this.progressTween) {
            this.progressTween.stop();
            this.progressTween = null;
        }

        if (this.scoreTween) {
            this.scoreTween.stop();
            this.scoreTween = null;
        }

        this.movesText = null;
        this.scoreText = null;
        this.objectiveText = null;
        this.progressBar = null;
        this.progressBarBg = null;
        this.comboText = null;
        this.scene = null;
    }
}
