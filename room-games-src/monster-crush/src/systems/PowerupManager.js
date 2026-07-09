import { GameConfig } from '../Config.js';

export default class PowerupManager {
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;
        this.powerups = { hammer: 0, bomb: 0, rowcol: 0, colorblast: 0 };
        this.powerupMode = null;
        this.powerupButtons = {};
        this.powerupOverlay = null;
        this.powerupHintText = null;
    }

    // --- Persistence ---

    load() {
        try {
            const saveData = localStorage.getItem('sugarSplash_save');
            if (saveData) {
                const parsed = JSON.parse(saveData);
                if (parsed.powerups) {
                    this.powerups = { ...this.powerups, ...parsed.powerups };
                }
            }
        } catch (e) {
            console.warn('Failed to load powerups:', e);
        }
    }

    save() {
        try {
            const saveKey = 'sugarSplash_save';
            let saveData = localStorage.getItem(saveKey);
            saveData = saveData ? JSON.parse(saveData) : { levels: {} };
            saveData.powerups = this.powerups;
            localStorage.setItem(saveKey, JSON.stringify(saveData));
        } catch (e) {
            console.warn('Failed to save powerups:', e);
        }
    }

    // --- UI Creation ---

    create(width, height) {
        const powerupTypes = ['hammer', 'bomb', 'rowcol', 'colorblast'];
        const barY = height - 52;
        const buttonSize = 48;
        const spacing = 10;
        const startX = 35;

        powerupTypes.forEach((type, index) => {
            const x = startX + index * (buttonSize + spacing) + buttonSize / 2;
            const config = GameConfig.POWERUPS[type];

            // Button background
            const bg = this.scene.add.graphics({ x, y: barY });
            bg.fillStyle(this.powerups[type] > 0 ? 0x4a4a6a : 0x2a2a3a, 0.9);
            bg.fillRoundedRect(-buttonSize / 2, -buttonSize / 2, buttonSize, buttonSize, 8);
            bg.setInteractive(
                new Phaser.Geom.Rectangle(-buttonSize / 2, -buttonSize / 2, buttonSize, buttonSize),
                Phaser.Geom.Rectangle.Contains
            );

            // Icon
            const icon = this.scene.add.text(x, barY - 4, config.icon, {
                fontSize: '24px'
            }).setOrigin(0.5);

            // Count badge
            const count = this.scene.add.text(x + 14, barY + 14, `${this.powerups[type]}`, {
                fontFamily: 'Arial Black',
                fontSize: '12px',
                color: this.powerups[type] > 0 ? '#ffffff' : '#666666',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            this.powerupButtons[type] = { bg, icon, count };

            // Click handler
            bg.on('pointerup', () => this.onClick(type));
            bg.on('pointerover', () => {
                if (this.powerups[type] > 0) {
                    this.scene.tweens.add({ targets: [bg, icon], scaleX: 1.1, scaleY: 1.1, duration: 100 });
                }
            });
            bg.on('pointerout', () => {
                if (this.powerupMode !== type) {
                    this.scene.tweens.add({ targets: [bg, icon], scaleX: 1, scaleY: 1, duration: 100 });
                }
            });
        });
    }

    // --- Selection Mode ---

    onClick(type) {
        if (this.scene.isGameOver || this.board.inputLocked) return;

        // Cancel if clicking same powerup
        if (this.powerupMode === type) {
            this.cancel();
            return;
        }

        // Check if player has this powerup
        if (this.powerups[type] <= 0) {
            const btn = this.powerupButtons[type];
            if (btn) {
                this.scene.tweens.add({
                    targets: btn.bg,
                    alpha: 0.5,
                    duration: 100,
                    yoyo: true,
                    repeat: 1
                });
            }
            return;
        }

        // Enter powerup mode
        this.powerupMode = type;
        if (this.scene.soundManager) this.scene.soundManager.play('select');

        // Highlight selected button
        const btn = this.powerupButtons[type];
        if (btn) {
            this.scene.tweens.add({ targets: [btn.bg, btn.icon], scaleX: 1.15, scaleY: 1.15, duration: 150 });
        }

        // Dim the board slightly
        if (!this.powerupOverlay) {
            this.powerupOverlay = this.scene.add.graphics();
        }
        this.powerupOverlay.clear();
        this.powerupOverlay.fillStyle(0x000000, 0.2);
        this.powerupOverlay.fillRect(0, 0, this.scene.cameras.main.width, this.scene.cameras.main.height);
        this.powerupOverlay.setDepth(5);

        // Show hint
        this.showHint(type);
    }

    showHint(type) {
        const config = GameConfig.POWERUPS[type];
        if (this.powerupHintText?.scene) {
            this.powerupHintText.destroy();
        }
        const hintY = this.board ? this.board.y - 25 : 160;
        this.powerupHintText = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            hintY,
            `Tap a candy to use ${config.name}`,
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: '20px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(10);
    }

    cancel() {
        if (!this.powerupMode) return;

        const btn = this.powerupButtons[this.powerupMode];
        if (btn) {
            this.scene.tweens.add({ targets: [btn.bg, btn.icon], scaleX: 1, scaleY: 1, duration: 150 });
        }

        this.powerupMode = null;

        if (this.powerupOverlay) {
            this.powerupOverlay.clear();
        }

        if (this.powerupHintText?.scene) {
            this.powerupHintText.destroy();
            this.powerupHintText = null;
        }
    }

    isInPowerupMode() {
        return this.powerupMode !== null;
    }

    getCurrentMode() {
        return this.powerupMode;
    }

    // --- Button Updates ---

    updateButton(type) {
        const btn = this.powerupButtons[type];
        if (!btn) return;

        btn.count.setText(`${this.powerups[type]}`);
        btn.count.setColor(this.powerups[type] > 0 ? '#ffffff' : '#666666');

        btn.bg.clear();
        btn.bg.fillStyle(this.powerups[type] > 0 ? 0x4a4a6a : 0x2a2a3a, 0.9);
        btn.bg.fillRoundedRect(-24, -24, 48, 48, 8);
    }

    // --- Activation ---

    async activate(type, row, col, candy) {
        // Use up the powerup
        this.powerups[type]--;
        this.updateButton(type);
        this.save();
        this.cancel();

        // Lock input during activation
        this.board.inputLocked = true;

        try {
            switch (type) {
                case 'hammer':
                    await this.activateHammer(row, col, candy);
                    break;
                case 'bomb':
                    await this.activateBomb(row, col);
                    break;
                case 'rowcol':
                    await this.activateRowCol(row, col);
                    break;
                case 'colorblast':
                    await this.activateColorBlast(row, col, candy);
                    break;
            }

            // Process cascades
            await this.board.applyGravity();
            await this.board.fillEmptySpaces();
            await this.board.processCascades();
            this.scene.events.emit('cascadeComplete');
        } finally {
            this.board.inputLocked = false;
        }
    }

    async activateHammer(row, col, candy) {
        if (!candy || !candy.active) return;

        const pos = this.board.gridToWorld(row, col);
        const hammer = this.scene.add.text(pos.x, pos.y - 60, '🔨', { fontSize: '48px' }).setOrigin(0.5).setDepth(100);

        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: hammer,
                y: pos.y,
                rotation: 0.3,
                duration: 200,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    this.scene.cameras.main.shake(100, 0.01);
                    if (this.scene.soundManager) this.scene.soundManager.play('bomb');

                    // Particles
                    if (this.scene.particleManager) {
                        this.scene.particleManager.emitAt(pos.x, pos.y, 15, candy.tint || 0xffffff);
                    } else if (this.scene.emitter) {
                        this.scene.emitter.setConfig({
                            speed: { min: 100, max: 200 },
                            scale: { start: 0.5, end: 0 },
                            lifespan: 400,
                            tint: candy.tint || 0xffffff
                        });
                        this.scene.emitter.emitParticleAt(pos.x, pos.y, 15);
                    }

                    hammer.destroy();
                    resolve();
                }
            });
        });

        this.board.handleJellyAt(row, col);
        await this.board.clearCandies([{ row, col }]);
    }

    async activateBomb(row, col) {
        const pos = this.board.gridToWorld(row, col);

        const ring = this.scene.add.graphics({ x: pos.x, y: pos.y });
        ring.fillStyle(0xff6600, 0.7);
        ring.fillCircle(0, 0, this.board.cellSize);

        this.scene.cameras.main.shake(200, 0.015);
        if (this.scene.soundManager) this.scene.soundManager.play('bomb');

        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: ring,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    ring.destroy();
                    resolve();
                }
            });
        });

        // Clear 3x3 area
        const cells = [];
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (this.board.isValidCell(r, c) && this.board.candies[r][c]) {
                    this.board.handleJellyAt(r, c);
                    cells.push({ row: r, col: c });
                }
            }
        }

        const score = this.board.calculateScore(cells.length, 1);
        this.scene.events.emit('scoreUpdate', score, 1);
        await this.board.clearCandies(cells);
    }

    async activateRowCol(row, col) {
        const pos = this.board.gridToWorld(row, col);
        const cells = [];

        // Row
        for (let c = 0; c < this.board.cols; c++) {
            if (this.board.candies[row][c]) {
                this.board.handleJellyAt(row, c);
                cells.push({ row, col: c });
            }
        }
        // Column (avoid duplicating center)
        for (let r = 0; r < this.board.rows; r++) {
            if (r !== row && this.board.candies[r][col]) {
                this.board.handleJellyAt(r, col);
                cells.push({ row: r, col });
            }
        }

        // Cross effect visual
        const h = this.scene.add.graphics()
            .fillStyle(0xffff00, 0.8)
            .fillRect(this.board.x, pos.y - 15, this.board.cols * this.board.cellSize, 30);
        const v = this.scene.add.graphics()
            .fillStyle(0xffff00, 0.8)
            .fillRect(pos.x - 15, this.board.y, 30, this.board.rows * this.board.cellSize);

        if (this.scene.soundManager) this.scene.soundManager.play('line');

        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: [h, v],
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    h.destroy();
                    v.destroy();
                    resolve();
                }
            });
        });

        const score = this.board.calculateScore(cells.length, 1);
        this.scene.events.emit('scoreUpdate', score, 1);
        await this.board.clearCandies(cells);
    }

    async activateColorBlast(row, col, candy) {
        if (!candy) return;

        const targetType = candy.candyType;
        const cells = [];

        // Find all candies of this color
        for (let r = 0; r < this.board.rows; r++) {
            for (let c = 0; c < this.board.cols; c++) {
                const cell = this.board.candies[r][c];
                if (cell && cell.candyType === targetType) {
                    this.board.handleJellyAt(r, c);
                    cells.push({ row: r, col: c });
                }
            }
        }

        // Rainbow effect - particles from each candy
        const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x8b00ff];

        for (const cell of cells) {
            const pos = this.board.gridToWorld(cell.row, cell.col);
            if (this.scene.particleManager) {
                this.scene.particleManager.emitAt(pos.x, pos.y, 5, colors[Math.floor(Math.random() * colors.length)]);
            } else if (this.scene.emitter) {
                this.scene.emitter.setConfig({
                    speed: { min: 50, max: 150 },
                    scale: { start: 0.4, end: 0 },
                    lifespan: 500,
                    tint: colors[Math.floor(Math.random() * colors.length)]
                });
                this.scene.emitter.emitParticleAt(pos.x, pos.y, 5);
            }
        }

        if (this.scene.soundManager) this.scene.soundManager.play('bomb');
        this.scene.cameras.main.shake(150, 0.01);

        await new Promise(r => setTimeout(r, 200));

        const score = this.board.calculateScore(cells.length, 1) + 100;
        this.scene.events.emit('scoreUpdate', score, 1);
        await this.board.clearCandies(cells);
    }

    // --- Rewards ---

    award(stars) {
        const awarded = [];

        // 1 star: 30% chance of 1 powerup
        // 2 stars: 1 random powerup guaranteed
        // 3 stars: 1 random powerup + 50% chance of second
        if (stars === 1) {
            if (Math.random() < 0.3) {
                awarded.push(this.selectRandom());
            }
        } else if (stars === 2) {
            awarded.push(this.selectRandom());
        } else if (stars >= 3) {
            awarded.push(this.selectRandom());
            if (Math.random() < 0.5) {
                awarded.push(this.selectRandom());
            }
        }

        // Add to inventory
        for (const type of awarded) {
            this.powerups[type]++;
            this.updateButton(type);
        }
        this.save();

        return awarded;
    }

    selectRandom() {
        const powerupConfig = GameConfig.POWERUPS;
        const types = Object.keys(powerupConfig);
        const totalWeight = types.reduce((sum, type) => sum + (powerupConfig[type].weight || 25), 0);

        let rand = Math.random() * totalWeight;
        for (const type of types) {
            rand -= (powerupConfig[type].weight || 25);
            if (rand <= 0) return type;
        }
        return types[0];
    }

    // --- Cleanup ---

    destroy() {
        this.cancel();

        // Destroy button graphics
        for (const type in this.powerupButtons) {
            const btn = this.powerupButtons[type];
            if (btn.bg) btn.bg.destroy();
            if (btn.icon) btn.icon.destroy();
            if (btn.count) btn.count.destroy();
        }
        this.powerupButtons = {};

        if (this.powerupOverlay) {
            this.powerupOverlay.destroy();
            this.powerupOverlay = null;
        }

        this.scene = null;
        this.board = null;
    }
}
