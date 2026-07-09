import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LevelSelectScene from './scenes/LevelSelectScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 720,
    height: 1280,
    backgroundColor: '#FFB6C1', // Match game gradient top (pink)
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 320,
            height: 480
        },
        max: {
            width: 1440,
            height: 2560
        }
    },
    scene: [BootScene, MenuScene, LevelSelectScene, GameScene]
};

const game = new Phaser.Game(config);
