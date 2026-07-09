import Phaser from 'phaser';

import CONFIG from '../../config/game';
import GameScene from '../game/GameScene';
import { casinoAsset } from '../../../../../config/assets.js';

/**
 * Boot game scene
 * @class BootScene
 * @extends {Phaser.Scene}
 */
class BootScene extends Phaser.Scene {
  static CONFIG = CONFIG.SCENES.BOOT;

  /**
   * Creates an instance of BootScene
   */
  constructor() {
    super(BootScene.CONFIG.NAME);
  }

  preload() {
    this.load.atlas(
      'dino',
      casinoAsset('/dino-assets/sprites/dino-atlas.png'),
      casinoAsset('/dino-assets/sprites/dino-atlas.json'),
    );

    this.load.bitmapFont(
      'joystix',
      casinoAsset('/dino-assets/fonts/joystix_monospace.png'),
      casinoAsset('/dino-assets/fonts/joystix_monospace.fnt'),
    );

    this.load.audio('player-action', casinoAsset('/dino-assets/sounds/player-action.mp3'));
    this.load.audio('achievement', casinoAsset('/dino-assets/sounds/achievement.mp3'));
    this.load.audio('gameover', casinoAsset('/dino-assets/sounds/gameover.mp3'));
  }

  create() {
    this.scene.start(GameScene.CONFIG.NAME);
  }
}

export default BootScene;
