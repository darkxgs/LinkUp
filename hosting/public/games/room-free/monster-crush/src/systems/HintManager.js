/**
 * HintManager - Handles the hint system that shows valid moves after inactivity
 * Shows both candies that can be swapped with a clear visual indicator
 */
export default class HintManager {
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;

        this.hintTimer = null;
        this.hintElements = []; // All hint graphics
        this.hintDelay = 5000; // 5 seconds of inactivity before showing hint
        this.hintVisible = false;
        this.cycleTimer = null;
        this.currentMove = null;
        this.candyTweens = []; // Track candy bounce tweens
    }

    start() {
        this.hintTimer = this.scene.time.addEvent({
            delay: this.hintDelay,
            callback: this.startHintCycle,
            callbackScope: this,
            loop: false
        });

        // Reset hint on any pointer interaction
        this.scene.input.on('pointerdown', () => this.reset());
    }

    reset() {
        this.clear();
        if (this.hintTimer) {
            this.hintTimer.reset({
                delay: this.hintDelay,
                callback: this.startHintCycle,
                callbackScope: this,
                loop: false
            });
        }
    }

    clear() {
        // Stop cycle timer
        if (this.cycleTimer) {
            this.cycleTimer.remove();
            this.cycleTimer = null;
        }

        // Stop candy bounce tweens and reset positions
        this.candyTweens.forEach(tween => {
            if (tween && tween.stop) tween.stop();
        });
        this.candyTweens = [];

        // Destroy all hint elements
        this.hintElements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.hintElements = [];
        this.hintVisible = false;
        this.currentMove = null;
    }

    startHintCycle() {
        // Don't show hints during game over or when input is locked
        if (this.scene.isGameOver || this.board.inputLocked) {
            // Try again later
            this.hintTimer = this.scene.time.addEvent({
                delay: 1000,
                callback: this.startHintCycle,
                callbackScope: this,
                loop: false
            });
            return;
        }

        const move = this.board.findValidMove();
        if (!move || move.length < 2) return;

        this.currentMove = move;
        this.showHint();

        // Cycle: show for 2.5s, hide for 2s, repeat
        this.cycleTimer = this.scene.time.addEvent({
            delay: 2500,
            callback: this.toggleHint,
            callbackScope: this,
            loop: true
        });
    }

    toggleHint() {
        if (this.scene.isGameOver || this.board.inputLocked) return;

        if (this.hintVisible) {
            this.hideHintElements();
        } else {
            this.showHint();
        }
    }

    hideHintElements() {
        this.hintElements.forEach(el => {
            if (el && el.scene) {
                this.scene.tweens.add({
                    targets: el,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        if (el && el.destroy) el.destroy();
                    }
                });
            }
        });
        this.hintElements = [];
        this.hintVisible = false;

        // Schedule reappearance after 2 seconds
        this.scene.time.delayedCall(2000, () => {
            if (this.cycleTimer && !this.scene.isGameOver && !this.board.inputLocked) {
                this.showHint();
            }
        });
    }

    showHint() {
        if (this.scene.isGameOver || this.board.inputLocked) return;

        // Re-find move in case board changed
        const move = this.board.findValidMove();
        if (!move || move.length < 2) return;

        // Clear any existing elements
        this.hintElements.forEach(el => {
            if (el && el.destroy) el.destroy();
        });
        this.hintElements = [];

        const cell1 = move[0];
        const cell2 = move[1];
        const candy1 = this.board.candies[cell1.row][cell1.col];
        const candy2 = this.board.candies[cell2.row][cell2.col];

        if (!candy1 || !candy2) return;

        // Create glowing rings around BOTH candies
        const ring1 = this.createGlowRing(candy1.x, candy1.y);
        const ring2 = this.createGlowRing(candy2.x, candy2.y);
        this.hintElements.push(ring1, ring2);

        // Create swap indicator between them
        const midX = (candy1.x + candy2.x) / 2;
        const midY = (candy1.y + candy2.y) / 2;
        const swapIndicator = this.createSwapIndicator(midX, midY, candy1, candy2);
        this.hintElements.push(...swapIndicator);

        // Animate candies bouncing toward each other slightly
        this.animateCandyBounce(candy1, candy2);

        this.hintVisible = true;
    }

    createGlowRing(x, y) {
        const cellSize = this.board.cellSize;
        const ring = this.scene.add.graphics({ x, y });
        ring.setDepth(10);

        // Draw pulsing ring
        ring.lineStyle(4, 0xffeb3b, 1);
        ring.strokeCircle(0, 0, cellSize / 2 - 4);

        // Add outer glow
        ring.lineStyle(8, 0xffeb3b, 0.3);
        ring.strokeCircle(0, 0, cellSize / 2);

        // Pulse animation
        ring.setScale(0.8);
        ring.setAlpha(0);
        this.scene.tweens.add({
            targets: ring,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });

        this.scene.tweens.add({
            targets: ring,
            scaleX: 1.1,
            scaleY: 1.1,
            alpha: 0.7,
            duration: 600,
            yoyo: true,
            repeat: -1,
            delay: 300,
            ease: 'Sine.easeInOut'
        });

        return ring;
    }

    createSwapIndicator(x, y, candy1, candy2) {
        const elements = [];

        // Determine if horizontal or vertical swap
        const isHorizontal = candy1.row === candy2.row;

        // Create swap arrows (⇄ or ⇅ style)
        const arrow1 = this.scene.add.graphics({ x, y });
        const arrow2 = this.scene.add.graphics({ x, y });
        arrow1.setDepth(11);
        arrow2.setDepth(11);

        const arrowSize = 12;
        const offset = 8;

        if (isHorizontal) {
            // Left arrow
            arrow1.fillStyle(0xffffff, 1);
            arrow1.beginPath();
            arrow1.moveTo(-offset - arrowSize, 0);
            arrow1.lineTo(-offset, -arrowSize / 2);
            arrow1.lineTo(-offset, arrowSize / 2);
            arrow1.closePath();
            arrow1.fill();

            // Right arrow
            arrow2.fillStyle(0xffffff, 1);
            arrow2.beginPath();
            arrow2.moveTo(offset + arrowSize, 0);
            arrow2.lineTo(offset, -arrowSize / 2);
            arrow2.lineTo(offset, arrowSize / 2);
            arrow2.closePath();
            arrow2.fill();
        } else {
            // Up arrow
            arrow1.fillStyle(0xffffff, 1);
            arrow1.beginPath();
            arrow1.moveTo(0, -offset - arrowSize);
            arrow1.lineTo(-arrowSize / 2, -offset);
            arrow1.lineTo(arrowSize / 2, -offset);
            arrow1.closePath();
            arrow1.fill();

            // Down arrow
            arrow2.fillStyle(0xffffff, 1);
            arrow2.beginPath();
            arrow2.moveTo(0, offset + arrowSize);
            arrow2.lineTo(-arrowSize / 2, offset);
            arrow2.lineTo(arrowSize / 2, offset);
            arrow2.closePath();
            arrow2.fill();
        }

        // Add stroke for visibility
        arrow1.lineStyle(2, 0x000000, 0.5);
        arrow2.lineStyle(2, 0x000000, 0.5);

        // Animate arrows bouncing toward each other
        const bounceOffset = isHorizontal ? { x: 5, y: 0 } : { x: 0, y: 5 };

        arrow1.setAlpha(0);
        arrow2.setAlpha(0);

        this.scene.tweens.add({
            targets: arrow1,
            alpha: 1,
            duration: 200
        });
        this.scene.tweens.add({
            targets: arrow2,
            alpha: 1,
            duration: 200
        });

        this.scene.tweens.add({
            targets: arrow1,
            x: x + bounceOffset.x,
            y: y + bounceOffset.y,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.scene.tweens.add({
            targets: arrow2,
            x: x - bounceOffset.x,
            y: y - bounceOffset.y,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        elements.push(arrow1, arrow2);
        return elements;
    }

    animateCandyBounce(candy1, candy2) {
        if (!candy1?.scene || !candy2?.scene) return;

        // Stop any existing candy tweens first
        this.candyTweens.forEach(tween => {
            if (tween && tween.stop) tween.stop();
        });
        this.candyTweens = [];

        const originalX1 = candy1.x;
        const originalY1 = candy1.y;
        const originalX2 = candy2.x;
        const originalY2 = candy2.y;

        // Calculate direction
        const dx = (candy2.x - candy1.x) * 0.08;
        const dy = (candy2.y - candy1.y) * 0.08;

        // Bounce candy1 toward candy2
        const tween1 = this.scene.tweens.add({
            targets: candy1,
            x: originalX1 + dx,
            y: originalY1 + dy,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onStop: () => {
                if (candy1?.scene) {
                    candy1.x = originalX1;
                    candy1.y = originalY1;
                }
            }
        });

        // Bounce candy2 toward candy1
        const tween2 = this.scene.tweens.add({
            targets: candy2,
            x: originalX2 - dx,
            y: originalY2 - dy,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onStop: () => {
                if (candy2?.scene) {
                    candy2.x = originalX2;
                    candy2.y = originalY2;
                }
            }
        });

        this.candyTweens.push(tween1, tween2);
    }

    destroy() {
        if (this.hintTimer) {
            this.hintTimer.remove();
            this.hintTimer = null;
        }
        this.clear();
        this.scene = null;
        this.board = null;
    }
}
