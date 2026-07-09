import { GameConfig } from '../Config.js';

/**
 * ParticleManager - Handles all particle effects in the game
 * Supports multiple particle types and textures for variety
 */
export default class ParticleManager {
    constructor(scene, board) {
        this.scene = scene;
        this.board = board;
        this.emitters = {};
    }

    create() {
        // Create emitters for different particle types
        const particleTypes = [
            'star_filled',      // Default stars
            'particle_circle',  // Soft circles
            'particle_spark',   // Sharp sparks
            'particle_shard',   // Ice shards
            'particle_square',  // Squares
            'particle_ring',    // Rings
            'particle_chip',    // Wood chips
            'particle_swirl',   // Magic swirls
            'particle_link',    // Chain links
            'particle_coin'     // Golden coins
        ];

        particleTypes.forEach(type => {
            this.emitters[type] = this.scene.add.particles(0, 0, type, {
                speed: { min: 50, max: 200 },
                scale: { start: 0.5, end: 0 },
                alpha: { start: 1, end: 0 },
                lifespan: 600,
                blendMode: 'ADD',
                emitting: false
            });
            this.emitters[type].setDepth(100);
        });

        // Keep reference to default emitter for backward compatibility
        this.emitter = this.emitters['star_filled'];
    }

    // Emit particles when a candy is cleared
    emitCandy(row, col, type) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const colors = GameConfig.COLORS;
        const color = colors[type] || 0xffffff;
        const count = GameConfig.PARTICLES.CANDY_COUNT;

        // Mix of circles and stars for candy
        this.emitters['particle_circle'].setConfig({
            tint: color,
            speed: { min: 80, max: 250 },
            scale: { start: 0.6, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.6));

        this.emitters['star_filled'].setConfig({
            tint: color,
            speed: { min: 100, max: 300 },
            scale: { start: 0.4, end: 0 },
            lifespan: 400,
            angle: { min: 0, max: 360 }
        });
        this.emitters['star_filled'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.4));
    }

    // Emit particles when jelly is cleared
    emitJelly(row, col) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.JELLY_COUNT;

        // Pink circles and rings for jelly
        this.emitters['particle_circle'].setConfig({
            tint: 0xff69b4,
            speed: { min: 100, max: 300 },
            scale: { start: 0.8, end: 0 },
            lifespan: 700,
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0.3 }
        });
        this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.6));

        this.emitters['particle_ring'].setConfig({
            tint: 0xff1493,
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0.2 },
            lifespan: 600,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_ring'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.4));
    }

    // Emit particles when a special candy is activated
    emitSpecial(row, col, type) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = type === 'color_bomb'
            ? GameConfig.PARTICLES.COLOR_BOMB_COUNT
            : GameConfig.PARTICLES.SPECIAL_COUNT;

        if (type === 'bomb' || type === 'color_bomb') {
            // Explosive sparks and circles
            this.emitters['particle_spark'].setConfig({
                tint: 0xffaa00,
                speed: { min: 200, max: 400 },
                scale: { start: 1.2, end: 0 },
                lifespan: 800,
                angle: { min: 0, max: 360 }
            });
            this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));

            this.emitters['particle_circle'].setConfig({
                tint: 0xff6600,
                speed: { min: 150, max: 350 },
                scale: { start: 1, end: 0 },
                lifespan: 600,
                angle: { min: 0, max: 360 }
            });
            this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));

            this.emitters['particle_ring'].setConfig({
                tint: 0xffff00,
                speed: { min: 100, max: 200 },
                scale: { start: 1.5, end: 0 },
                lifespan: 500,
                angle: { min: 0, max: 360 }
            });
            this.emitters['particle_ring'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.2));

        } else if (type === 'line_h' || type === 'line_v') {
            // Cyan streaks for line clears
            const isHorizontal = type === 'line_h';
            this.emitters['particle_spark'].setConfig({
                tint: 0x00ffff,
                speed: { min: 150, max: 350 },
                scale: { start: 0.8, end: 0 },
                lifespan: 500,
                angle: isHorizontal ? { min: -30, max: 30 } : { min: 60, max: 120 }
            });
            this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));

            this.emitters['particle_circle'].setConfig({
                tint: 0x00ccff,
                speed: { min: 100, max: 250 },
                scale: { start: 0.6, end: 0 },
                lifespan: 400,
                angle: { min: 0, max: 360 }
            });
            this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));
        }
    }

    // Emit particles when ice is broken
    emitIce(row, col, layers = 1) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.ICE_COUNT * layers;

        // Crystalline shards and sparkles
        this.emitters['particle_shard'].setConfig({
            tint: 0x87CEEB,
            speed: { min: 150, max: 350 },
            scale: { start: 0.8, end: 0 },
            lifespan: 600,
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 360 }
        });
        this.emitters['particle_shard'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));

        this.emitters['particle_spark'].setConfig({
            tint: 0xffffff,
            speed: { min: 100, max: 250 },
            scale: { start: 0.5, end: 0 },
            lifespan: 400,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));

        this.emitters['particle_circle'].setConfig({
            tint: 0x4FC3F7,
            speed: { min: 50, max: 150 },
            scale: { start: 0.4, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.2));
    }

    // Emit particles when chain is broken
    emitChain(row, col, layers = 1) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.CHAIN_COUNT * layers;

        // Metallic links and sparks
        this.emitters['particle_link'].setConfig({
            tint: 0x9E9E9E,
            speed: { min: 100, max: 250 },
            scale: { start: 0.7, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 360 }
        });
        this.emitters['particle_link'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));

        this.emitters['particle_spark'].setConfig({
            tint: 0xBDBDBD,
            speed: { min: 150, max: 300 },
            scale: { start: 0.6, end: 0 },
            lifespan: 400,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));
    }

    // Emit particles when chocolate is cleared
    emitChocolate(row, col) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.CHOCOLATE_COUNT;

        // Brown splatter effect
        this.emitters['particle_circle'].setConfig({
            tint: 0x5D4037,
            speed: { min: 80, max: 200 },
            scale: { start: 0.9, end: 0.2 },
            lifespan: 600,
            angle: { min: 0, max: 360 },
            gravityY: 100
        });
        this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.6));

        this.emitters['particle_square'].setConfig({
            tint: 0x8D6E63,
            speed: { min: 100, max: 250 },
            scale: { start: 0.6, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 360 }
        });
        this.emitters['particle_square'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.4));
    }

    // Emit particles when crate is broken
    emitCrate(row, col, layers = 1) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.CRATE_COUNT * layers;

        // Wood chips and splinters
        this.emitters['particle_chip'].setConfig({
            tint: 0xD7A86E,
            speed: { min: 100, max: 300 },
            scale: { start: 0.8, end: 0 },
            lifespan: 700,
            angle: { min: 0, max: 360 },
            rotate: { min: -360, max: 360 },
            gravityY: 150
        });
        this.emitters['particle_chip'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.5));

        this.emitters['particle_square'].setConfig({
            tint: 0xA67C52,
            speed: { min: 80, max: 200 },
            scale: { start: 0.5, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 180 }
        });
        this.emitters['particle_square'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));

        this.emitters['particle_spark'].setConfig({
            tint: 0x757575,  // Nail sparks
            speed: { min: 150, max: 350 },
            scale: { start: 0.4, end: 0 },
            lifespan: 300,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.2));
    }

    // Emit particles when bomb timer is cleared (celebration)
    emitBombTimerCleared(row, col) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.BOMB_TIMER_COUNT;

        // Yellow/orange celebration sparks
        this.emitters['particle_spark'].setConfig({
            tint: 0xFFEB3B,
            speed: { min: 200, max: 400 },
            scale: { start: 1, end: 0 },
            lifespan: 800,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.4));

        this.emitters['star_filled'].setConfig({
            tint: 0xFF9800,
            speed: { min: 150, max: 300 },
            scale: { start: 0.8, end: 0 },
            lifespan: 600,
            angle: { min: 0, max: 360 }
        });
        this.emitters['star_filled'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));

        this.emitters['particle_ring'].setConfig({
            tint: 0xFFFFFF,
            speed: { min: 50, max: 150 },
            scale: { start: 1.2, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_ring'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));
    }

    // Emit particles for portal teleportation
    emitPortal(row, col, isEntrance = true) {
        if (!this.board) return;
        const pos = this.board.gridToWorld(row, col);
        const count = GameConfig.PARTICLES.PORTAL_COUNT;
        const color = isEntrance ? 0x7C4DFF : 0x00E676;

        // Magic swirls and sparkles
        this.emitters['particle_swirl'].setConfig({
            tint: color,
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            lifespan: 800,
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 720 }
        });
        this.emitters['particle_swirl'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.4));

        this.emitters['particle_spark'].setConfig({
            tint: 0xffffff,
            speed: { min: 100, max: 250 },
            scale: { start: 0.6, end: 0 },
            lifespan: 500,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_spark'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));

        this.emitters['particle_circle'].setConfig({
            tint: color,
            speed: { min: 30, max: 100 },
            scale: { start: 0.8, end: 0 },
            lifespan: 600,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_circle'].emitParticleAt(pos.x, pos.y, Math.floor(count * 0.3));
    }

    // Emit combo celebration particles
    emitCombo(x, y, multiplier) {
        const count = Math.min(multiplier * 8, 50);

        // Rainbow celebration
        const colors = GameConfig.COLORS;
        colors.forEach((color, i) => {
            this.emitters['star_filled'].setConfig({
                tint: color,
                speed: { min: 100, max: 300 },
                scale: { start: 0.6, end: 0 },
                lifespan: 600,
                angle: { min: i * 60, max: i * 60 + 60 }
            });
            this.emitters['star_filled'].emitParticleAt(x, y, Math.floor(count / colors.length));
        });
    }

    // Emit coins bonanza for bonus phase score increases
    emitCoins(x, y, intensity = 1) {
        const baseCount = 25;
        const count = Math.floor(baseCount * intensity);

        // Golden coins fountain going upward
        this.emitters['particle_coin'].setConfig({
            speed: { min: 150, max: 400 },
            scale: { start: 1, end: 0.3 },
            lifespan: 1200,
            angle: { min: 230, max: 310 }, // Upward spray
            gravityY: 300, // Fall back down
            rotate: { min: -360, max: 360 }
        });
        this.emitters['particle_coin'].emitParticleAt(x, y, Math.floor(count * 0.6));

        // Sparkles around the coins
        this.emitters['particle_spark'].setConfig({
            tint: 0xFFD700,
            speed: { min: 100, max: 250 },
            scale: { start: 0.8, end: 0 },
            lifespan: 600,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_spark'].emitParticleAt(x, y, Math.floor(count * 0.3));

        // Stars mixed in
        this.emitters['star_filled'].setConfig({
            tint: 0xFFEB3B,
            speed: { min: 80, max: 200 },
            scale: { start: 0.5, end: 0 },
            lifespan: 800,
            angle: { min: 0, max: 360 }
        });
        this.emitters['star_filled'].emitParticleAt(x, y, Math.floor(count * 0.2));
    }

    // Emit continuous coin rain across width (for big bonuses)
    emitCoinRain(width, y, count = 30) {
        for (let i = 0; i < count; i++) {
            const x = Math.random() * width;
            const delay = Math.random() * 300;

            this.scene.time.delayedCall(delay, () => {
                this.emitters['particle_coin'].setConfig({
                    speed: { min: 50, max: 150 },
                    scale: { start: 0.8, end: 0.4 },
                    lifespan: 1500,
                    angle: { min: 80, max: 100 }, // Downward
                    gravityY: 200,
                    rotate: { min: -180, max: 180 }
                });
                this.emitters['particle_coin'].emitParticleAt(x, y, 1);
            });
        }
    }

    // General purpose emit at position with color
    emitAt(x, y, count, tint = 0xffffff) {
        this.emitters['particle_circle'].setConfig({
            tint: tint,
            speed: { min: 100, max: 200 },
            scale: { start: 0.5, end: 0 },
            lifespan: 400,
            angle: { min: 0, max: 360 }
        });
        this.emitters['particle_circle'].emitParticleAt(x, y, count);
    }

    // Get the raw emitter for external use (backward compatibility)
    getEmitter() {
        return this.emitter;
    }

    destroy() {
        this.emitters = {};
        this.emitter = null;
        this.scene = null;
        this.board = null;
    }
}
