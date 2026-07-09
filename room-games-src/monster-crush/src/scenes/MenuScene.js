import C64Sequencer from '../systems/C64Sequencer.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
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

        // Background gradient
        this.createBackground(width, height);

        // Game title
        this.createTitle(width, height);

        // Play button
        this.createPlayButton(width, height);

        // Sound toggle
        this.createSoundToggle(width, height);

        // Floating candies decoration
        this.createFloatingCandies(width, height);
    }

    createBackground(width, height) {
        // Create gradient background
        const graphics = this.add.graphics();

        // Draw gradient manually with rectangles
        const steps = 20;
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 255, g: 182, b: 193 },  // Light pink
                { r: 173, g: 216, b: 230 },  // Light blue
                steps,
                i
            );
            graphics.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
            graphics.fillRect(0, (height / steps) * i, width, height / steps + 1);
        }
    }

    createTitle(width, height) {
        // Shadow
        this.add.text(width / 2 + 4, height * 0.2 + 4, 'Sugar Splash', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '64px',
            color: '#000000',
            align: 'center'
        }).setOrigin(0.5).setAlpha(0.3);

        // Main title
        const title = this.add.text(width / 2, height * 0.2, 'Sugar Splash', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '64px',
            color: '#ff6b9d',
            align: 'center',
            stroke: '#ffffff',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Title animation
        this.tweens.add({
            targets: title,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });
    }

    createPlayButton(width, height) {
        // Button container
        const buttonY = height * 0.55;

        // Button background
        const button = this.add.image(width / 2, buttonY, 'button')
            .setInteractive({ useHandCursor: true })
            .setScale(1.5)
            .setDepth(100);

        // Button text
        const buttonText = this.add.text(width / 2, buttonY, 'PLAY', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '36px',
            color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        // Button hover effects
        button.on('pointerover', () => {
            this.tweens.add({
                targets: [button, buttonText],
                scaleX: 1.6,
                scaleY: 1.6,
                duration: 100,
                ease: 'Power2'
            });
        });

        button.on('pointerout', () => {
            this.tweens.add({
                targets: [button, buttonText],
                scaleX: 1.5,
                scaleY: 1.5,
                duration: 100,
                ease: 'Power2'
            });
        });

        button.on('pointerdown', () => {
            this.tweens.add({
                targets: [button, buttonText],
                scaleX: 1.4,
                scaleY: 1.4,
                duration: 50,
                ease: 'Power2'
            });
        });

        button.on('pointerup', () => {
            this.tweens.add({
                targets: [button, buttonText],
                scaleX: 1.5,
                scaleY: 1.5,
                duration: 50,
                ease: 'Power2',
                onComplete: () => {
                    this.scene.start('LevelSelectScene');
                }
            });
        });
    }

    createSoundToggle(width, height) {
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

        // Apply saved sound state
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

    createFloatingCandies(width, height) {
        // --- Large swinging candies on the sides ---
        const swingingCandies = [
            { x: width * 0.08, y: height * 0.4, type: 0 },
            { x: width * 0.92, y: height * 0.35, type: 1 },
            { x: width * 0.05, y: height * 0.7, type: 2 },
            { x: width * 0.95, y: height * 0.65, type: 3 }
        ];

        swingingCandies.forEach((pos, i) => {
            const candy = this.add.image(pos.x, pos.y, `candy_${pos.type}`)
                .setScale(1.2)
                .setAlpha(0.9);

            // Big swinging arc motion
            const startAngle = i % 2 === 0 ? -30 : 30;
            this.tweens.add({
                targets: candy,
                angle: { from: startAngle, to: -startAngle },
                y: pos.y + 60,
                duration: 1800 + i * 200,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        });

        // --- Bouncing candy that travels across screen ---
        const createBouncingCandy = () => {
            const fromLeft = Phaser.Math.Between(0, 1) === 0;
            const type = Phaser.Math.Between(0, 5);
            const candy = this.add.image(
                fromLeft ? -60 : width + 60,
                height * 0.6,
                `candy_${type}`
            ).setScale(1.0).setAlpha(0.85);

            const targetX = fromLeft ? width + 60 : -60;
            const duration = Phaser.Math.Between(3000, 4500);

            // Horizontal movement
            this.tweens.add({
                targets: candy,
                x: targetX,
                duration: duration,
                ease: 'Linear',
                onComplete: () => candy.destroy()
            });

            // Bouncing up and down
            this.tweens.add({
                targets: candy,
                y: height * 0.3,
                duration: duration / 6,
                ease: 'Sine.easeOut',
                yoyo: true,
                repeat: 5
            });

            // Spinning while moving
            this.tweens.add({
                targets: candy,
                angle: fromLeft ? 720 : -720,
                duration: duration,
                ease: 'Linear'
            });
        };

        this.time.addEvent({ delay: 2500, loop: true, callback: createBouncingCandy });
        createBouncingCandy(); // Start one immediately

        // --- Candy fountain from bottom center ---
        this.time.addEvent({
            delay: 600,
            loop: true,
            callback: () => {
                const type = Phaser.Math.Between(0, 5);
                const candy = this.add.image(width / 2, height + 30, `candy_${type}`)
                    .setScale(0.9)
                    .setAlpha(0.8);

                const targetX = width / 2 + Phaser.Math.Between(-200, 200);
                const peakY = Phaser.Math.Between(height * 0.3, height * 0.5);

                // Arc up
                this.tweens.add({
                    targets: candy,
                    x: targetX,
                    y: peakY,
                    angle: Phaser.Math.Between(-180, 180),
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 1000,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        // Fall back down
                        this.tweens.add({
                            targets: candy,
                            y: height + 50,
                            angle: candy.angle + Phaser.Math.Between(-90, 90),
                            scaleX: 0.6,
                            scaleY: 0.6,
                            alpha: 0.4,
                            duration: 1200,
                            ease: 'Sine.easeIn',
                            onComplete: () => candy.destroy()
                        });
                    }
                });
            }
        });

        // --- Zooming candies across screen ---
        this.time.addEvent({
            delay: 1800,
            loop: true,
            callback: () => {
                const type = Phaser.Math.Between(0, 5);
                const startY = Phaser.Math.Between(height * 0.2, height * 0.8);
                const fromLeft = Phaser.Math.Between(0, 1) === 0;

                const candy = this.add.image(
                    fromLeft ? -80 : width + 80,
                    startY,
                    `candy_${type}`
                ).setScale(1.4).setAlpha(0.7);

                this.tweens.add({
                    targets: candy,
                    x: fromLeft ? width + 80 : -80,
                    scaleX: 0.8,
                    scaleY: 0.8,
                    angle: fromLeft ? 360 : -360,
                    duration: 1500,
                    ease: 'Cubic.easeIn',
                    onComplete: () => candy.destroy()
                });
            }
        });

        // --- Orbiting candy pairs ---
        const orbitCenters = [
            { x: width * 0.2, y: height * 0.85 },
            { x: width * 0.8, y: height * 0.85 }
        ];

        orbitCenters.forEach((center, ci) => {
            const radius = 50;
            const candies = [];

            for (let i = 0; i < 3; i++) {
                const candy = this.add.image(center.x, center.y, `candy_${(ci * 3 + i) % 6}`)
                    .setScale(0.8)
                    .setAlpha(0.85);
                candies.push({ candy, angle: (i * Math.PI * 2) / 3 });
            }

            this.time.addEvent({
                delay: 20,
                loop: true,
                callback: () => {
                    candies.forEach(c => {
                        c.angle += 0.04;
                        c.candy.x = center.x + Math.cos(c.angle) * radius;
                        c.candy.y = center.y + Math.sin(c.angle) * radius * 0.5; // Elliptical
                        c.candy.setScale(0.7 + Math.sin(c.angle) * 0.2);
                    });
                }
            });
        });

        // --- Sparkle bursts ---
        this.time.addEvent({
            delay: 300,
            loop: true,
            callback: () => {
                const x = Phaser.Math.Between(50, width - 50);
                const y = Phaser.Math.Between(50, height - 50);
                const star = this.add.text(x, y, '✦', {
                    fontSize: Phaser.Math.Between(16, 32) + 'px',
                    color: Phaser.Math.Between(0, 1) === 0 ? '#ffffff' : '#ffeb3b'
                }).setOrigin(0.5).setAlpha(0);

                this.tweens.add({
                    targets: star,
                    alpha: 1,
                    scaleX: 2,
                    scaleY: 2,
                    angle: Phaser.Math.Between(-30, 30),
                    duration: 250,
                    yoyo: true,
                    ease: 'Quad.easeOut',
                    onComplete: () => star.destroy()
                });
            }
        });

        // --- Candy trail behind cursor ---
        this.input.on('pointermove', (pointer) => {
            if (Phaser.Math.Between(0, 2) === 0) {
                const type = Phaser.Math.Between(0, 5);
                const trail = this.add.image(pointer.x, pointer.y, `candy_${type}`)
                    .setScale(0.5)
                    .setAlpha(0.7);

                this.tweens.add({
                    targets: trail,
                    scaleX: 0,
                    scaleY: 0,
                    alpha: 0,
                    y: pointer.y + 40,
                    angle: Phaser.Math.Between(-45, 45),
                    duration: 400,
                    ease: 'Power2',
                    onComplete: () => trail.destroy()
                });
            }
        });

        // Register shutdown handler
        this.events.on('shutdown', this.shutdown, this);
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
