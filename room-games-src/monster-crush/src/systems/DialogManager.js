import { GameConfig } from '../Config.js';

/**
 * DialogManager - Handles modal dialogs and overlays
 * Provides reusable dialog patterns for win/lose/pause screens
 */
export default class DialogManager {
    constructor(scene) {
        this.scene = scene;
        this.currentOverlay = null;
        this.currentContainer = null;
    }

    // --- Core Dialog Creation ---

    createOverlay(depth = 500) {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(depth);
        overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        this.currentOverlay = overlay;
        return overlay;
    }

    createContainer(depth = 501) {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        const container = this.scene.add.container(width / 2, height / 2);
        container.setDepth(depth);

        this.currentContainer = container;
        return container;
    }

    createPanel(container, width, height, radius = 25) {
        const panel = this.scene.add.graphics();
        panel.fillStyle(0xffffff, 0.95);
        panel.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        container.add(panel);
        return panel;
    }

    createButton(container, x, y, text, callback, scale = 1) {
        const btn = this.scene.add.image(x, y, 'button').setScale(scale).setInteractive({ useHandCursor: true });
        const btnText = this.scene.add.text(x, y, text, {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: scale < 1 ? '20px' : '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        container.add(btn);
        container.add(btnText);

        btn.on('pointerover', () => btn.setScale(scale * 1.1));
        btn.on('pointerout', () => btn.setScale(scale));
        btn.on('pointerup', callback);

        return { btn, btnText };
    }

    animateIn(container, duration = 400) {
        container.setScale(0.5);
        container.setAlpha(0);
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: container,
                scaleX: 1,
                scaleY: 1,
                alpha: 1,
                duration,
                ease: 'Back.easeOut',
                onComplete: resolve
            });
        });
    }

    // --- Pre-built Dialogs ---

    showTutorial(tutorial, onDismiss) {
        if (!tutorial) return;

        const seenKey = `sugarSplash_tutorial_${this.scene.currentLevel}`;
        if (localStorage.getItem(seenKey)) return;

        const overlay = this.createOverlay(100);
        const container = this.createContainer(101);

        this.createPanel(container, 340, 300, 20);

        // Icon
        const icon = this.scene.add.text(0, -100, tutorial.icon, { fontSize: '48px' }).setOrigin(0.5);
        container.add(icon);

        // Title
        const title = this.scene.add.text(0, -45, tutorial.title, {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '26px',
            color: '#ff6b9d'
        }).setOrigin(0.5);
        container.add(title);

        // Description - with word wrap
        const desc = this.scene.add.text(0, 20, tutorial.text, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#333333',
            align: 'center',
            wordWrap: { width: 300 },
            lineSpacing: 4
        }).setOrigin(0.5);
        container.add(desc);

        // Got it button
        this.createButton(container, 0, 115, 'Got it!', () => {
            localStorage.setItem(seenKey, 'true');
            overlay.destroy();
            container.destroy();
            if (onDismiss) onDismiss();
        });

        this.animateIn(container, 300);
    }

    showLose(onRetry, onLevelSelect) {
        const overlay = this.createOverlay();
        const container = this.createContainer();

        this.createPanel(container, 360, 320, 25);

        // Title
        const title = this.scene.add.text(0, -110, 'Out of Moves!', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '36px',
            color: '#ff4757'
        }).setOrigin(0.5);
        container.add(title);

        // Status
        const status = this.scene.add.text(0, -30, 'Objective not met.', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color: '#333333'
        }).setOrigin(0.5);
        container.add(status);

        // Buttons
        this.createButton(container, 0, 30, 'Try Again', onRetry);
        this.createButton(container, 0, 100, 'Level Select', onLevelSelect);

        this.animateIn(container);
    }

    showWin(config) {
        const { score, stars, awardedPowerups, currentLevel, onNext, onReplay, onLevelSelect, soundManager } = config;

        const overlay = this.createOverlay();
        const container = this.createContainer();

        const panelHeight = awardedPowerups.length > 0 ? 480 : 400;
        this.createPanel(container, 360, panelHeight, 25);

        // Title
        const title = this.scene.add.text(0, -panelHeight / 2 + 40, 'Level Complete!', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '36px',
            color: '#4ade80'
        }).setOrigin(0.5);
        container.add(title);

        // Stars
        for (let i = 0; i < 3; i++) {
            const star = this.scene.add.image(-60 + i * 60, -panelHeight / 2 + 105, i < stars ? 'star_filled' : 'star_empty');
            star.setScale(0);
            container.add(star);
            this.scene.tweens.add({
                targets: star,
                scaleX: 1.5,
                scaleY: 1.5,
                duration: 300,
                delay: 200 + i * 200,
                ease: 'Back.easeOut'
            });
        }

        // Score
        const scoreText = this.scene.add.text(0, -panelHeight / 2 + 160, `Score: ${score}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            color: '#333333'
        }).setOrigin(0.5);
        container.add(scoreText);

        // Calculate button area start
        let buttonStartY;

        // Powerup rewards
        if (awardedPowerups.length > 0) {
            const rewardLabel = this.scene.add.text(0, -panelHeight / 2 + 200, 'Rewards:', {
                fontFamily: 'Arial, sans-serif',
                fontSize: '18px',
                color: '#666666'
            }).setOrigin(0.5);
            container.add(rewardLabel);

            const spacing = 55;
            const startX = -((awardedPowerups.length - 1) * spacing) / 2;

            awardedPowerups.forEach((type, index) => {
                const powerupConfig = GameConfig.POWERUPS[type];
                const iconX = startX + index * spacing;

                const rewardIcon = this.scene.add.text(iconX, -panelHeight / 2 + 235, powerupConfig.icon, {
                    fontSize: '36px'
                }).setOrigin(0.5).setScale(0);
                container.add(rewardIcon);

                this.scene.tweens.add({
                    targets: rewardIcon,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 400,
                    delay: 800 + index * 200,
                    ease: 'Back.easeOut',
                    onStart: () => {
                        if (soundManager) soundManager.play('select');
                    }
                });

                const plusOne = this.scene.add.text(iconX + 22, -panelHeight / 2 + 215, '+1', {
                    fontFamily: 'Arial Black',
                    fontSize: '14px',
                    color: '#4ade80',
                    stroke: '#ffffff',
                    strokeThickness: 2
                }).setOrigin(0.5).setAlpha(0);
                container.add(plusOne);

                this.scene.tweens.add({
                    targets: plusOne,
                    alpha: 1,
                    duration: 300,
                    delay: 1000 + index * 200,
                    ease: 'Power2'
                });
            });
            buttonStartY = -panelHeight / 2 + 295;
        } else {
            buttonStartY = -panelHeight / 2 + 210;
        }

        // Buttons (65px spacing for comfortable touch targets)
        const buttonSpacing = 65;

        if (currentLevel < 40) {
            this.createButton(container, 0, buttonStartY, 'Next Level', onNext);
        } else {
            this.createButton(container, 0, buttonStartY, 'Main Menu', onNext);
        }

        this.createButton(container, 0, buttonStartY + buttonSpacing, 'Replay', onReplay);
        this.createButton(container, 0, buttonStartY + buttonSpacing * 2, 'Level Select', onLevelSelect);

        this.animateIn(container);
    }

    showPause(config) {
        const { onResume, onRestart, onQuit, soundManager } = config;

        const overlay = this.createOverlay();
        const container = this.createContainer();

        this.createPanel(container, 300, 440, 20);

        // Title
        const title = this.scene.add.text(0, -160, 'PAUSED', {
            fontFamily: 'Arial Black, Arial, sans-serif',
            fontSize: '36px',
            color: '#ff6b9d'
        }).setOrigin(0.5);
        container.add(title);

        // Buttons
        this.createButton(container, 0, -80, 'Resume', () => {
            this.close();
            onResume();
        });

        this.createButton(container, 0, -10, 'Restart', onRestart);
        this.createButton(container, 0, 60, 'Quit', onQuit);

        // Music toggle - consistent checkbox style
        const musicOn = localStorage.getItem('sugarSplash_music') !== 'false';
        const musicText = this.scene.add.text(0, 135, musicOn ? '☑ Music' : '☐ Music', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: musicOn ? '#4ade80' : '#999999'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        container.add(musicText);

        musicText.on('pointerup', () => {
            const currentState = localStorage.getItem('sugarSplash_music') !== 'false';
            const newState = !currentState;
            localStorage.setItem('sugarSplash_music', newState.toString());
            musicText.setText(newState ? '☑ Music' : '☐ Music');
            musicText.setColor(newState ? '#4ade80' : '#999999');
            if (newState) {
                soundManager?.startMusic();
            } else {
                soundManager?.stopMusic();
            }
        });

        // Sound toggle - consistent checkbox style
        const soundOn = localStorage.getItem('sugarSplash_sound') !== 'false';
        const soundText = this.scene.add.text(0, 175, soundOn ? '☑ Sound' : '☐ Sound', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: soundOn ? '#4ade80' : '#999999'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        container.add(soundText);

        soundText.on('pointerup', () => {
            const currentState = localStorage.getItem('sugarSplash_sound') !== 'false';
            const newState = !currentState;
            localStorage.setItem('sugarSplash_sound', newState.toString());
            soundText.setText(newState ? '☑ Sound' : '☐ Sound');
            soundText.setColor(newState ? '#4ade80' : '#999999');
            this.scene.sound.mute = !newState;
        });

        return { overlay, container };
    }

    showConfirmation(message, onYes, onNo) {
        const container = this.createContainer(600);

        this.createPanel(container, 280, 200, 20);

        // Icon
        const icon = this.scene.add.text(0, -60, '⚠️', { fontSize: '36px' }).setOrigin(0.5);
        container.add(icon);

        // Message
        const msg = this.scene.add.text(0, -15, message, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#333333',
            align: 'center'
        }).setOrigin(0.5);
        container.add(msg);

        // Buttons
        this.createButton(container, -60, 60, 'Yes', () => {
            container.destroy();
            onYes();
        }, 0.7);

        this.createButton(container, 60, 60, 'No', () => {
            container.destroy();
            onNo();
        }, 0.7);

        this.animateIn(container, 200);
        return container;
    }

    // --- Utility ---

    close() {
        if (this.currentOverlay) {
            this.currentOverlay.destroy();
            this.currentOverlay = null;
        }
        if (this.currentContainer) {
            this.currentContainer.destroy();
            this.currentContainer = null;
        }
    }

    destroy() {
        this.close();
        this.scene = null;
    }
}
