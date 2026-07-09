/**
 * BonusRoundManager - Handles the end-of-level bonus round
 * Converts remaining moves to specials and activates them for bonus points
 */
export default class BonusRoundManager {
    constructor(scene, board, soundManager) {
        this.scene = scene;
        this.board = board;
        this.soundManager = soundManager;
    }

    async play(movesRemaining, onMovesUpdate) {
        if (movesRemaining <= 0) return;

        // --- PHASE 0: Setup ---
        const bonusScoreStart = this.scene.score;
        this.board.inputLocked = true;

        // Show BONUS text with entrance animation
        const bonusText = this.scene.add.text(this.scene.cameras.main.width / 2, 180, 'BONUS!', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '52px',
            color: '#ffeb3b',
            stroke: '#ff6b00',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(100).setScale(0);

        this.scene.tweens.add({
            targets: bonusText,
            scaleX: 1,
            scaleY: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });

        // Live bonus counter
        const bonusCounter = this.scene.add.text(this.scene.cameras.main.width / 2, 230, 'Bonus: +0', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#333333',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100).setAlpha(0);

        this.scene.tweens.add({
            targets: bonusCounter,
            alpha: 1,
            duration: 200,
            delay: 200
        });

        await new Promise(r => setTimeout(r, 500));

        // --- PHASE 1: Convert moves to specials ---
        const specialWeights = { line_h: 30, line_v: 30, bomb: 35, color_bomb: 5 };
        const movesToConvert = Math.min(movesRemaining, 10);
        let currentMoves = movesRemaining;

        for (let i = 0; i < movesToConvert; i++) {
            // Find random normal candy
            const candidates = [];
            for (let r = 0; r < this.board.rows; r++) {
                for (let c = 0; c < this.board.cols; c++) {
                    const candy = this.board.candies[r][c];
                    if (candy && candy.active && !candy.isSpecial && !candy.isIngredient && !this.board.locked[r][c]) {
                        candidates.push(candy);
                    }
                }
            }

            if (candidates.length === 0) break;

            // Pick random candy and weighted random special type
            const candy = candidates[Math.floor(Math.random() * candidates.length)];
            const specialType = this.weightedRandomSpecial(specialWeights);
            candy.makeSpecial(specialType);

            // Sparkle particle effect at conversion
            if (this.scene.emitter) {
                const pos = this.board.gridToWorld(candy.row, candy.col);
                this.scene.emitter.setConfig({
                    speed: { min: 50, max: 150 },
                    scale: { start: 0.4, end: 0 },
                    lifespan: 400,
                    tint: 0xffff00
                });
                this.scene.emitter.emitParticleAt(pos.x, pos.y, 8);
            }

            // Sound
            if (this.soundManager) this.soundManager.play('select');

            // Update moves counter
            currentMoves--;
            if (onMovesUpdate) onMovesUpdate(currentMoves);

            await new Promise(r => setTimeout(r, 120));
        }

        await new Promise(r => setTimeout(r, 200));
        bonusText.destroy();

        // --- PHASE 2: Activate specials one by one until none remain ---
        let safetyCounter = 0;
        const maxIterations = 50;

        while (safetyCounter < maxIterations) {
            const allSpecials = this.getAllSpecialsOnBoard();
            if (allSpecials.length === 0) break;

            this.shuffleArray(allSpecials);
            safetyCounter++;

            for (const special of allSpecials) {
                if (!special.active) continue;

                // Highlight effect - flash before activation
                this.scene.tweens.add({
                    targets: special,
                    alpha: 0.3,
                    duration: 40,
                    yoyo: true,
                    repeat: 1
                });
                await new Promise(r => setTimeout(r, 80));

                // Play activation sound
                if (this.soundManager) {
                    this.soundManager.play(special.specialType === 'bomb' || special.specialType === 'color_bomb' ? 'bomb' : 'line');
                }

                // Activate and wait for cascades
                await this.board.activateSpecial(special);
                await this.board.applyGravity();
                await this.board.fillEmptySpaces();
                await this.board.processCascades();

                // Update live bonus counter
                const currentBonus = this.scene.score - bonusScoreStart;
                if (bonusCounter?.scene) {
                    bonusCounter.setText(`Bonus: +${currentBonus}`);
                    this.scene.tweens.add({
                        targets: bonusCounter,
                        scaleX: 1.15,
                        scaleY: 1.15,
                        duration: 80,
                        yoyo: true
                    });

                    // Coin bonanza at the bonus counter!
                    if (this.scene.particleManager) {
                        const intensity = Math.min(currentBonus / 500, 2); // Scale with bonus
                        this.scene.particleManager.emitCoins(
                            this.scene.cameras.main.width / 2,
                            bonusCounter.y + 30,
                            0.5 + intensity * 0.5
                        );
                    }
                }

                await new Promise(r => setTimeout(r, 100));
            }
        }

        // --- PHASE 3: Grand Finale ---
        const totalBonus = this.scene.score - bonusScoreStart;

        // Final bonus display
        if (bonusCounter?.scene) {
            bonusCounter.setText(`Bonus: +${totalBonus}`);
            this.scene.tweens.add({
                targets: bonusCounter,
                scaleX: 1.5,
                scaleY: 1.5,
                duration: 300,
                ease: 'Back.easeOut'
            });

            // MEGA coin bonanza for the finale!
            if (this.scene.particleManager && totalBonus > 0) {
                const width = this.scene.cameras.main.width;
                // Big burst from center
                this.scene.particleManager.emitCoins(width / 2, bonusCounter.y, 2);
                // Coin rain from top
                this.scene.particleManager.emitCoinRain(width, -20, Math.min(50, Math.floor(totalBonus / 100)));
            }
        }

        // Confetti burst!
        await this.showConfetti();

        await new Promise(r => setTimeout(r, 500));
        if (bonusCounter?.scene) bonusCounter.destroy();

        return currentMoves;
    }

    // Helper: Weighted random special selection
    weightedRandomSpecial(weights) {
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let rand = Math.random() * total;
        for (const [type, weight] of Object.entries(weights)) {
            rand -= weight;
            if (rand <= 0) return type;
        }
        return 'bomb';
    }

    // Helper: Get all special candies on board
    getAllSpecialsOnBoard() {
        const specials = [];
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const candy = this.board.candies[r][c];
                if (candy && candy.active && candy.isSpecial) {
                    specials.push(candy);
                }
            }
        }
        return specials;
    }

    // Helper: Fisher-Yates shuffle
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Helper: Confetti particle burst
    async showConfetti() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        const colors = [0xff4757, 0x3742fa, 0x2ed573, 0xffa502, 0xa55eea, 0xff7f50, 0xffeb3b];

        // Create multiple confetti bursts (faster, fewer pieces)
        for (let burst = 0; burst < 2; burst++) {
            for (let i = 0; i < 15; i++) {
                const x = Math.random() * width;
                const color = colors[Math.floor(Math.random() * colors.length)];

                const confetti = this.scene.add.graphics({ x, y: -20 });
                confetti.fillStyle(color, 1);
                confetti.fillRect(-4, -4, 8, 8);
                confetti.setDepth(150);

                this.scene.tweens.add({
                    targets: confetti,
                    y: height + 50,
                    x: x + (Math.random() - 0.5) * 200,
                    rotation: Math.random() * 10,
                    duration: 1000 + Math.random() * 500,
                    ease: 'Quad.easeIn',
                    delay: burst * 100 + Math.random() * 50,
                    onComplete: () => confetti.destroy()
                });
            }

            if (this.soundManager && burst === 0) this.soundManager.play('win');
        }

        // Camera shake for impact
        this.scene.cameras.main.shake(200, 0.01);

        await new Promise(r => setTimeout(r, 600));
    }

    destroy() {
        this.scene = null;
        this.board = null;
        this.soundManager = null;
    }
}
