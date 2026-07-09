import { GameConfig } from '../Config.js';
import C64Sequencer from '../systems/C64Sequencer.js';

export default class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super('LevelSelectScene');
        this.totalLevels = 40;
        this.columns = 4;
        this.levelsPerPage = 32;
        this.currentPage = 0;
        this.bossLevels = [10, 20, 30, 40]; // Boss levels with special visuals
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Initialize C64 Sequencer for menu music
        this.sequencer = new C64Sequencer(this);

        // Wait for interaction to start audio context (browser policy)
        if (this.sound.locked) {
            this.input.once('pointerdown', () => {
                this.sequencer.start();
            });
        } else {
            this.sequencer.start();
        }

        // Background
        this.createBackground(width, height);

        // Decorative animations (behind UI)
        this.createDecorations(width, height);

        // Header
        this.createHeader(width, height);

        // Level grid
        this.createLevelGrid(width, height);

        // Back button
        this.createBackButton(width, height);

        // Sound controls
        this.createSoundControls(width, height);

        // Powerups display at bottom
        this.createPowerupsDisplay(width, height);

        // Register shutdown handler
        this.events.on('shutdown', this.shutdown, this);
    }

    createBackground(width, height) {
        const graphics = this.add.graphics();
        graphics.setDepth(-10); // Behind everything
        const steps = 20;
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
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

    createDecorations(width, height) {
        const decorDepth = -5; // Above background, below UI (which is at 0)

        // --- Floating candies on edges ---
        const edgeCandies = [
            { x: -30, y: height * 0.3, type: 0 },
            { x: width + 30, y: height * 0.25, type: 1 },
            { x: -25, y: height * 0.6, type: 2 },
            { x: width + 25, y: height * 0.55, type: 3 }
        ];

        edgeCandies.forEach((pos, i) => {
            const candy = this.add.image(pos.x, pos.y, `candy_${pos.type}`)
                .setScale(1.0)
                .setAlpha(0.7)
                .setDepth(decorDepth);

            // Peek in and out from edges
            const peekIn = pos.x < 0 ? 50 : -50;
            this.tweens.add({
                targets: candy,
                x: pos.x + peekIn,
                y: pos.y + 40,
                angle: pos.x < 0 ? 20 : -20,
                duration: 2000 + i * 300,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        });

        // --- Bouncing candy across screen ---
        const createBouncingCandy = () => {
            const fromLeft = Phaser.Math.Between(0, 1) === 0;
            const type = Phaser.Math.Between(0, 5);
            const candy = this.add.image(
                fromLeft ? -60 : width + 60,
                height * 0.5,
                `candy_${type}`
            ).setScale(0.9).setAlpha(0.6).setDepth(decorDepth);

            const targetX = fromLeft ? width + 60 : -60;
            const duration = Phaser.Math.Between(4000, 5500);

            this.tweens.add({
                targets: candy,
                x: targetX,
                duration: duration,
                ease: 'Linear',
                onComplete: () => candy.destroy()
            });

            this.tweens.add({
                targets: candy,
                y: height * 0.25,
                duration: duration / 5,
                ease: 'Sine.easeOut',
                yoyo: true,
                repeat: 4
            });

            this.tweens.add({
                targets: candy,
                angle: fromLeft ? 540 : -540,
                duration: duration,
                ease: 'Linear'
            });
        };

        this.time.addEvent({ delay: 3000, loop: true, callback: createBouncingCandy });
        this.time.delayedCall(500, createBouncingCandy);

        // --- Rising bubbles/candies from bottom ---
        this.time.addEvent({
            delay: 800,
            loop: true,
            callback: () => {
                const type = Phaser.Math.Between(0, 5);
                const startX = Phaser.Math.Between(30, width - 30);
                const candy = this.add.image(startX, height + 40, `candy_${type}`)
                    .setScale(0.6)
                    .setAlpha(0.5)
                    .setDepth(decorDepth);

                this.tweens.add({
                    targets: candy,
                    y: -50,
                    x: startX + Phaser.Math.Between(-80, 80),
                    angle: Phaser.Math.Between(-180, 180),
                    alpha: 0.2,
                    duration: Phaser.Math.Between(5000, 7000),
                    ease: 'Sine.easeInOut',
                    onComplete: () => candy.destroy()
                });
            }
        });

        // --- Sparkle effects ---
        this.time.addEvent({
            delay: 350,
            loop: true,
            callback: () => {
                const x = Phaser.Math.Between(40, width - 40);
                const y = Phaser.Math.Between(100, height - 100);
                const star = this.add.text(x, y, '✦', {
                    fontSize: Phaser.Math.Between(14, 28) + 'px',
                    color: Phaser.Math.Between(0, 1) === 0 ? '#ffffff' : '#ffeb3b'
                }).setOrigin(0.5).setAlpha(0).setDepth(decorDepth);

                this.tweens.add({
                    targets: star,
                    alpha: 0.8,
                    scaleX: 1.8,
                    scaleY: 1.8,
                    angle: Phaser.Math.Between(-25, 25),
                    duration: 300,
                    yoyo: true,
                    ease: 'Quad.easeOut',
                    onComplete: () => star.destroy()
                });
            }
        });

        // --- Zooming candies ---
        this.time.addEvent({
            delay: 2200,
            loop: true,
            callback: () => {
                const type = Phaser.Math.Between(0, 5);
                const startY = Phaser.Math.Between(height * 0.15, height * 0.85);
                const fromLeft = Phaser.Math.Between(0, 1) === 0;

                const candy = this.add.image(
                    fromLeft ? -70 : width + 70,
                    startY,
                    `candy_${type}`
                ).setScale(1.2).setAlpha(0.5).setDepth(decorDepth);

                this.tweens.add({
                    targets: candy,
                    x: fromLeft ? width + 70 : -70,
                    scaleX: 0.6,
                    scaleY: 0.6,
                    angle: fromLeft ? 360 : -360,
                    duration: 1800,
                    ease: 'Cubic.easeIn',
                    onComplete: () => candy.destroy()
                });
            }
        });

        // --- Cursor candy trail ---
        this.input.on('pointermove', (pointer) => {
            if (Phaser.Math.Between(0, 3) === 0) {
                const type = Phaser.Math.Between(0, 5);
                const trail = this.add.image(pointer.x, pointer.y, `candy_${type}`)
                    .setScale(0.4)
                    .setAlpha(0.6)
                    .setDepth(200); // Trail on top

                this.tweens.add({
                    targets: trail,
                    scaleX: 0,
                    scaleY: 0,
                    alpha: 0,
                    y: pointer.y + 35,
                    angle: Phaser.Math.Between(-40, 40),
                    duration: 350,
                    ease: 'Power2',
                    onComplete: () => trail.destroy()
                });
            }
        });
    }

    createHeader(width, height) {
        // Title
        this.add.text(width / 2, 60, 'Select Level', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '42px',
            color: '#ff6b9d',
            stroke: '#ffffff',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Total stars display
        const saveData = this.getSaveData();
        const totalStars = this.calculateTotalStars(saveData);
        const maxStars = this.totalLevels * 3;

        this.add.image(width / 2 - 40, 110, 'star_filled').setScale(0.8);
        this.add.text(width / 2, 110, `${totalStars} / ${maxStars}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
    }

    createLevelGrid(width, height) {
        const saveData = this.getSaveData();

        // Layout constants
        const headerHeight = 140;
        const bottomBarHeight = 100;
        const paginationSpace = 60; // Extra space for pagination
        const gap = 14; // Gap between buttons

        // Available space
        const sidePadding = 30;
        const availableWidth = width - sidePadding * 2;
        const availableHeight = height - headerHeight - bottomBarHeight - paginationSpace;

        // Calculate rows needed
        const numRows = Math.ceil(this.levelsPerPage / this.columns);

        // Calculate button size to fill available space
        const maxButtonByWidth = Math.floor((availableWidth - (this.columns - 1) * gap) / this.columns);
        const maxButtonByHeight = Math.floor((availableHeight - (numRows - 1) * gap) / numRows);
        const buttonSize = Math.min(maxButtonByWidth, maxButtonByHeight); // Use full available space

        // Calculate actual grid dimensions
        const gridWidth = this.columns * buttonSize + (this.columns - 1) * gap;
        const gridHeight = numRows * buttonSize + (numRows - 1) * gap;

        // Center the grid horizontally and vertically
        const startX = (width - gridWidth) / 2 + buttonSize / 2;
        const startY = headerHeight + (availableHeight - gridHeight) / 2 + buttonSize / 2;

        // Calculate pagination
        const totalPages = Math.ceil(this.totalLevels / this.levelsPerPage);
        const startLevel = this.currentPage * this.levelsPerPage + 1;
        const endLevel = Math.min(startLevel + this.levelsPerPage - 1, this.totalLevels);
        const levelsOnPage = endLevel - startLevel + 1;

        // Store container reference for page switching
        if (this.levelContainer) {
            this.levelContainer.destroy();
        }

        // Create container for level buttons
        this.levelContainer = this.add.container(0, 0);

        for (let i = 0; i < levelsOnPage; i++) {
            const level = startLevel + i;
            const col = i % this.columns;
            const row = Math.floor(i / this.columns);

            const x = startX + col * (buttonSize + gap);
            const y = startY + row * (buttonSize + gap);

            const levelData = saveData.levels[level] || { completed: false, stars: 0 };
            // First 5 levels always unlocked, rest unlock when previous is completed
            // Also unlock if the level itself was ever played (has any data)
            const prevCompleted = saveData.levels[level - 1]?.completed || saveData.levels[String(level - 1)]?.completed;
            const selfPlayed = levelData.completed || levelData.stars > 0;
            const isUnlocked = level <= 5 || prevCompleted || selfPlayed;
            const isBoss = this.bossLevels.includes(level);

            this.createLevelButton(this.levelContainer, x, y, level, levelData, isUnlocked, buttonSize, isBoss);
        }

        // Create pagination controls if needed
        if (totalPages > 1) {
            this.createPaginationControls(width, height, totalPages);
        }

        // Enable scrolling if content exceeds screen
        const actualRows = Math.ceil(levelsOnPage / this.columns);
        const totalGridHeight = actualRows * (buttonSize + gap);
        const visibleHeight = availableHeight;

        // Remove old scroll listeners before adding new ones
        this.input.off('pointerdown');
        this.input.off('pointermove');
        this.input.off('pointerup');
        this.input.off('wheel');

        if (totalGridHeight > visibleHeight) {
            const minY = -(totalGridHeight - visibleHeight);
            const maxY = 0;

            // Track drag state
            let isDragging = false;
            let dragStartY = 0;
            let containerStartY = 0;

            this.input.on('pointerdown', (pointer) => {
                isDragging = true;
                dragStartY = pointer.y;
                containerStartY = this.levelContainer.y;
            });

            this.input.on('pointermove', (pointer) => {
                if (isDragging && pointer.isDown) {
                    const deltaY = pointer.y - dragStartY;
                    this.levelContainer.y = Phaser.Math.Clamp(containerStartY + deltaY, minY, maxY);
                }
            });

            this.input.on('pointerup', () => {
                isDragging = false;
            });

            // Mouse wheel support
            this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
                this.levelContainer.y = Phaser.Math.Clamp(this.levelContainer.y - deltaY * 0.5, minY, maxY);
            });
        }
    }

    createPaginationControls(width, height, totalPages) {
        const y = height - 115; // More space from bottom bar

        // Remove old pagination if exists
        if (this.paginationContainer) {
            this.paginationContainer.destroy();
        }

        this.paginationContainer = this.add.container(width / 2, y);

        // Page indicator
        const pageText = this.add.text(0, 0, `Page ${this.currentPage + 1} / ${totalPages}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this.paginationContainer.add(pageText);

        // Previous button
        if (this.currentPage > 0) {
            const prevBtn = this.add.text(-80, 0, '◀', {
                fontSize: '28px',
                color: '#ffffff',
                stroke: '#ff6b9d',
                strokeThickness: 3
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            prevBtn.on('pointerover', () => prevBtn.setScale(1.2));
            prevBtn.on('pointerout', () => prevBtn.setScale(1));
            prevBtn.on('pointerup', () => {
                this.currentPage--;
                this.createLevelGrid(width, height);
            });
            this.paginationContainer.add(prevBtn);
        }

        // Next button
        if (this.currentPage < totalPages - 1) {
            const nextBtn = this.add.text(80, 0, '▶', {
                fontSize: '28px',
                color: '#ffffff',
                stroke: '#ff6b9d',
                strokeThickness: 3
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            nextBtn.on('pointerover', () => nextBtn.setScale(1.2));
            nextBtn.on('pointerout', () => nextBtn.setScale(1));
            nextBtn.on('pointerup', () => {
                this.currentPage++;
                this.createLevelGrid(width, height);
            });
            this.paginationContainer.add(nextBtn);
        }
    }

    createLevelButton(container, x, y, level, levelData, isUnlocked, size, isBoss = false) {
        const radius = 12;
        const borderWidth = 5; // Much thicker white border

        // Button background
        const graphics = this.add.graphics();

        // Boss levels have gold/special styling
        const normalColor = 0xff6b9d;
        const bossColor = 0xFFD700;
        const lockedColor = 0x888888;
        const buttonColor = isBoss ? bossColor : normalColor;
        const hoverColor = isBoss ? 0xFFE44D : 0xff8fad;

        const drawButton = (bgAlpha, innerColor, strokeAlpha = 0) => {
            graphics.clear();
            // White border/background
            graphics.fillStyle(0xffffff, bgAlpha);
            graphics.fillRoundedRect(x - size/2, y - size/2, size, size, radius);
            // Inner colored area
            graphics.fillStyle(innerColor, 1);
            graphics.fillRoundedRect(x - size/2 + borderWidth, y - size/2 + borderWidth,
                                     size - borderWidth*2, size - borderWidth*2, radius - 3);
            // Extra stroke for boss levels
            if (isBoss && strokeAlpha > 0) {
                graphics.lineStyle(3, 0xFFFFFF, strokeAlpha);
                graphics.strokeRoundedRect(x - size/2, y - size/2, size, size, radius);
            }
        };

        if (isUnlocked) {
            drawButton(0.95, buttonColor, isBoss ? 0.8 : 0);
        } else {
            graphics.fillStyle(0xaaaaaa, 0.5);
            graphics.fillRoundedRect(x - size/2, y - size/2, size, size, radius);
            graphics.fillStyle(lockedColor, 0.6);
            graphics.fillRoundedRect(x - size/2 + borderWidth, y - size/2 + borderWidth,
                                     size - borderWidth*2, size - borderWidth*2, radius - 3);
        }

        container.add(graphics);

        if (isUnlocked) {
            // Crown for boss levels at TOP
            if (isBoss) {
                const crown = this.add.text(x, y - size/2 + 16, '👑', {
                    fontSize: '18px'
                }).setOrigin(0.5);
                container.add(crown);
            }

            // Level number - BIG and centered
            const levelText = this.add.text(x, y - 6, level.toString(), {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '32px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);
            container.add(levelText);

            // Stars at bottom - BIGGER
            const starScale = 0.5;
            const starSpacing = 18;
            const starY = y + size/2 - 16;

            for (let s = 0; s < 3; s++) {
                const starX = x + (s - 1) * starSpacing;
                const starTexture = s < levelData.stars ? 'star_filled' : 'star_empty';
                const star = this.add.image(starX, starY, starTexture).setScale(starScale);
                if (isBoss && s < levelData.stars) {
                    star.setTint(0xff6b9d);
                }
                container.add(star);
            }

            // Interactive hit area
            const hitArea = this.add.rectangle(x, y, size, size, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            container.add(hitArea);

            hitArea.on('pointerover', () => drawButton(1, hoverColor, isBoss ? 1 : 0));
            hitArea.on('pointerout', () => drawButton(0.95, buttonColor, isBoss ? 0.8 : 0));
            hitArea.on('pointerup', () => this.scene.start('GameScene', { level: level }));
        } else {
            // Locked: level number dimmed
            const levelText = this.add.text(x, y - 6, level.toString(), {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '26px',
                color: '#555555'
            }).setOrigin(0.5);
            container.add(levelText);

            // Lock icon below
            const lockText = this.add.text(x, y + size/2 - 18, '🔒', {
                fontSize: '20px'
            }).setOrigin(0.5).setAlpha(0.7);
            container.add(lockText);
        }
    }

    createBackButton(width, height) {
        const backBtn = this.add.text(60, 60, '←', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#ff6b9d',
            strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => backBtn.setScale(1.2));
        backBtn.on('pointerout', () => backBtn.setScale(1));
        backBtn.on('pointerup', () => this.scene.start('MenuScene'));
    }

    createSoundControls(width, height) {
        // Settings button (gear icon) - opens settings dialog
        const settingsBtnBg = this.add.graphics();
        settingsBtnBg.fillStyle(0x000000, 0.3);
        settingsBtnBg.fillRoundedRect(width - 70, 25, 50, 50, 12);

        const settingsBtn = this.add.text(width - 45, 50, '⚙️', {
            fontSize: '28px'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        settingsBtn.on('pointerover', () => {
            settingsBtn.setScale(1.1);
            settingsBtnBg.clear();
            settingsBtnBg.fillStyle(0x000000, 0.5);
            settingsBtnBg.fillRoundedRect(width - 70, 25, 50, 50, 12);
        });
        settingsBtn.on('pointerout', () => {
            settingsBtn.setScale(1);
            settingsBtnBg.clear();
            settingsBtnBg.fillStyle(0x000000, 0.3);
            settingsBtnBg.fillRoundedRect(width - 70, 25, 50, 50, 12);
        });
        settingsBtn.on('pointerup', () => {
            this.showSettingsDialog(width, height);
        });

        // Apply current mute state
        const soundOn = localStorage.getItem('sugarSplash_sound') !== 'false';
        this.sound.mute = !soundOn;
    }

    showSettingsDialog(width, height) {
        // Overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(500);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        // Container
        const container = this.add.container(width / 2, height / 2);
        container.setDepth(501);

        // Panel
        const panel = this.add.graphics();
        panel.fillStyle(0xffffff, 0.95);
        panel.fillRoundedRect(-150, -160, 300, 320, 20);
        container.add(panel);

        // Title
        const title = this.add.text(0, -115, 'Settings', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '32px',
            color: '#ff6b9d'
        }).setOrigin(0.5);
        container.add(title);

        // Music toggle
        const musicOn = localStorage.getItem('sugarSplash_music') !== 'false';
        const musicText = this.add.text(0, -30, musicOn ? '☑ Music' : '☐ Music', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            color: musicOn ? '#4ade80' : '#666666'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        container.add(musicText);

        musicText.on('pointerup', () => {
            const currentState = localStorage.getItem('sugarSplash_music') !== 'false';
            const newState = !currentState;
            localStorage.setItem('sugarSplash_music', newState.toString());
            musicText.setText(newState ? '☑ Music' : '☐ Music');
            musicText.setColor(newState ? '#4ade80' : '#666666');
            // Start/stop sequencer
            if (newState) {
                if (this.sequencer && !this.sequencer.isPlaying) {
                    this.sequencer.start();
                }
            } else {
                if (this.sequencer) {
                    this.sequencer.stop();
                }
            }
        });

        // Sound toggle
        const soundOn = localStorage.getItem('sugarSplash_sound') !== 'false';
        const soundText = this.add.text(0, 30, soundOn ? '☑ Sound' : '☐ Sound', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            color: soundOn ? '#4ade80' : '#666666'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        container.add(soundText);

        soundText.on('pointerup', () => {
            const currentState = localStorage.getItem('sugarSplash_sound') !== 'false';
            const newState = !currentState;
            localStorage.setItem('sugarSplash_sound', newState.toString());
            soundText.setText(newState ? '☑ Sound' : '☐ Sound');
            soundText.setColor(newState ? '#4ade80' : '#666666');
            this.sound.mute = !newState;
        });

        // Close button
        const closeBtn = this.add.image(0, 115, 'button').setScale(0.9).setInteractive({ useHandCursor: true });
        const closeBtnText = this.add.text(0, 115, 'Close', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '22px',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add(closeBtn);
        container.add(closeBtnText);

        closeBtn.on('pointerover', () => closeBtn.setScale(1));
        closeBtn.on('pointerout', () => closeBtn.setScale(0.9));
        closeBtn.on('pointerup', () => {
            overlay.destroy();
            container.destroy();
        });

        // Animate in
        container.setScale(0.5);
        container.setAlpha(0);
        this.tweens.add({
            targets: container,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    getSaveData() {
        const defaultData = {
            currentLevel: 1,
            levels: {},
            settings: { musicOn: true, sfxOn: true }
        };

        try {
            const saved = localStorage.getItem('sugarSplash_save');
            return saved ? JSON.parse(saved) : defaultData;
        } catch (e) {
            return defaultData;
        }
    }

    calculateTotalStars(saveData) {
        let total = 0;
        for (const level in saveData.levels) {
            total += saveData.levels[level].stars || 0;
        }
        return total;
    }

    getPowerups() {
        try {
            const saved = localStorage.getItem('sugarSplash_powerups');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    createPowerupsDisplay(width, height) {
        const powerups = this.getPowerups();
        const powerupTypes = ['hammer', 'bomb', 'rowcol', 'colorblast'];

        // Bottom bar background
        const bottomBar = this.add.graphics();
        bottomBar.fillStyle(0x000000, 0.4);
        bottomBar.fillRoundedRect(20, height - 85, width - 40, 70, 15);

        // Label
        this.add.text(40, height - 70, 'Powerups:', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });

        // Powerup icons with counts
        const startX = 150;
        const spacing = 80;

        powerupTypes.forEach((type, index) => {
            const config = GameConfig.POWERUPS[type];
            const count = powerups[type] || 0;
            const x = startX + index * spacing;

            // Icon
            this.add.text(x, height - 55, config.icon, {
                fontSize: '28px'
            }).setOrigin(0.5);

            // Count
            this.add.text(x + 18, height - 65, `×${count}`, {
                fontFamily: 'Arial Black',
                fontSize: '14px',
                color: count > 0 ? '#4ade80' : '#999999',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0, 0.5);
        });
    }

    shutdown() {
        // Stop C64 sequencer when leaving this scene
        if (this.sequencer) {
            this.sequencer.destroy();
            this.sequencer = null;
        }
        this.events.off('shutdown');
    }
}
