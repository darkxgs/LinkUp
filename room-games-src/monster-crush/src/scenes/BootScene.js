export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Loading text
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Progress bar background
        const progressBarBg = this.add.graphics();
        progressBarBg.fillStyle(0x222222, 0.8);
        progressBarBg.fillRoundedRect(width / 2 - 160, height / 2, 320, 30, 15);

        // Progress bar fill
        const progressBar = this.add.graphics();

        // Update progress bar as assets load
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xff6b9d, 1);
            progressBar.fillRoundedRect(width / 2 - 155, height / 2 + 5, 310 * value, 20, 10);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBarBg.destroy();
            loadingText.destroy();
        });

        // Load game assets
        this.loadAssets();
    }

    loadAssets() {
        // Generate candy textures programmatically
        this.createCandyTextures();

        // Load any external assets here
        // this.load.image('key', 'path');
        // this.load.audio('key', 'path');
    }

    createCandyTextures() {
        const candySize = 64;
        const colors = [
            0xff4757, // Red
            0x3742fa, // Blue
            0x2ed573, // Green
            0xffa502, // Yellow/Orange
            0xa55eea, // Purple
            0xff7f50  // Orange/Coral
        ];

        // Create each candy type
        colors.forEach((color, index) => {
            const graphics = this.add.graphics();

            switch (index) {
                case 0: // Circle (Red)
                    this.drawCircleCandy(graphics, candySize, color);
                    break;
                case 1: // Square (Blue)
                    this.drawSquareCandy(graphics, candySize, color);
                    break;
                case 2: // Diamond (Green)
                    this.drawDiamondCandy(graphics, candySize, color);
                    break;
                case 3: // Star (Yellow)
                    this.drawStarCandy(graphics, candySize, color);
                    break;
                case 4: // Triangle (Purple)
                    this.drawTriangleCandy(graphics, candySize, color);
                    break;
                case 5: // Hexagon (Orange)
                    this.drawHexagonCandy(graphics, candySize, color);
                    break;
            }

            graphics.generateTexture(`candy_${index}`, candySize, candySize);
            graphics.destroy();
        });

        // Create Ingredient texture (Cherry) for Drop Items
        const cherryGraphics = this.add.graphics();
        this.drawCherry(cherryGraphics, candySize);
        cherryGraphics.generateTexture('ingredient_0', candySize, candySize);
        cherryGraphics.destroy();

        // Create special tile textures
        this.createSpecialTextures(candySize, colors);

        // Create UI textures
        this.createUITextures();

        // Create particle textures
        this.createParticleTextures();
    }

    drawCircleCandy(graphics, size, color) {
        const center = size / 2;
        const radius = size / 2 - 4;

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(center + 2, center + 2, radius);

        // Main shape
        graphics.fillStyle(color, 1);
        graphics.fillCircle(center, center, radius);

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(center - radius * 0.3, center - radius * 0.3, radius * 0.3);
    }

    drawSquareCandy(graphics, size, color) {
        const padding = 4;
        const cornerRadius = 8;

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillRoundedRect(padding + 2, padding + 2, size - padding * 2, size - padding * 2, cornerRadius);

        // Main shape
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(padding, padding, size - padding * 2, size - padding * 2, cornerRadius);

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillRoundedRect(padding + 6, padding + 6, 12, 12, 4);
    }

    drawDiamondCandy(graphics, size, color) {
        const center = size / 2;
        const halfSize = size / 2 - 6;

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillPoints([
            { x: center + 2, y: 6 + 2 },
            { x: size - 6 + 2, y: center + 2 },
            { x: center + 2, y: size - 6 + 2 },
            { x: 6 + 2, y: center + 2 }
        ], true);

        // Main shape
        graphics.fillStyle(color, 1);
        graphics.fillPoints([
            { x: center, y: 6 },
            { x: size - 6, y: center },
            { x: center, y: size - 6 },
            { x: 6, y: center }
        ], true);

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillPoints([
            { x: center, y: 12 },
            { x: center + 10, y: center - 6 },
            { x: center, y: center - 2 },
            { x: center - 10, y: center - 6 }
        ], true);
    }

    drawStarCandy(graphics, size, color) {
        const center = size / 2;
        const outerRadius = size / 2 - 4;
        const innerRadius = outerRadius * 0.5;
        const points = this.createStarPoints(center, center, 5, outerRadius, innerRadius);

        // Shadow
        const shadowPoints = this.createStarPoints(center + 2, center + 2, 5, outerRadius, innerRadius);
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillPoints(shadowPoints, true);

        // Main shape
        graphics.fillStyle(color, 1);
        graphics.fillPoints(points, true);

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(center - 5, center - 8, 6);
    }

    drawTriangleCandy(graphics, size, color) {
        const center = size / 2;
        const padding = 6;

        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillTriangle(
            center + 2, padding + 2,
            size - padding + 2, size - padding + 2,
            padding + 2, size - padding + 2
        );

        // Main shape
        graphics.fillStyle(color, 1);
        graphics.fillTriangle(
            center, padding,
            size - padding, size - padding,
            padding, size - padding
        );

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillTriangle(
            center, padding + 8,
            center + 8, center,
            center - 8, center
        );
    }

    drawHexagonCandy(graphics, size, color) {
        const center = size / 2;
        const radius = size / 2 - 4;
        const points = this.createHexagonPoints(center, center, radius);

        // Shadow
        const shadowPoints = this.createHexagonPoints(center + 2, center + 2, radius);
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillPoints(shadowPoints, true);

        // Main shape
        graphics.fillStyle(color, 1);
        graphics.fillPoints(points, true);

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(center - 6, center - 8, 7);
    }

    drawCherry(graphics, size) {
        const center = size / 2;
        
        // Shadow
        graphics.fillStyle(0x000000, 0.3);
        graphics.fillCircle(center + 2, center + 6, size / 3);

        // Fruit
        graphics.fillStyle(0xd63031, 1);
        graphics.fillCircle(center, center + 4, size / 3);

        // Highlight
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(center - 8, center, 8);

        // Stem
        graphics.lineStyle(4, 0x2d3436, 1);
        
        const path = new Phaser.Curves.Path(center, center - 10);
        // quadraticBezierTo(controlX, controlY, endX, endY)
        path.quadraticBezierTo(center, center - 25, center + 15, center - 20);
        path.draw(graphics);

        // Leaf
        graphics.fillStyle(0x2ed573, 1);
        graphics.fillEllipse(center + 15, center - 20, 10, 5);
    }

    createStarPoints(cx, cy, spikes, outerRadius, innerRadius) {
        const points = [];
        const step = Math.PI / spikes;
        let rotation = -Math.PI / 2;

        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            points.push({
                x: cx + Math.cos(rotation) * radius,
                y: cy + Math.sin(rotation) * radius
            });
            rotation += step;
        }

        return points;
    }

    createHexagonPoints(cx, cy, radius) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }
        return points;
    }

    createSpecialTextures(size, colors) {
        // Line clearer (horizontal stripe)
        colors.forEach((color, index) => {
            const graphics = this.add.graphics();

            // Draw base candy shape
            graphics.fillStyle(color, 1);
            graphics.fillCircle(size / 2, size / 2, size / 2 - 4);

            // Draw horizontal stripe
            graphics.fillStyle(0xffffff, 0.8);
            graphics.fillRect(4, size / 2 - 4, size - 8, 8);

            graphics.generateTexture(`candy_${index}_line_h`, size, size);
            graphics.destroy();
        });

        // Line clearer (vertical stripe)
        colors.forEach((color, index) => {
            const graphics = this.add.graphics();

            graphics.fillStyle(color, 1);
            graphics.fillCircle(size / 2, size / 2, size / 2 - 4);

            graphics.fillStyle(0xffffff, 0.8);
            graphics.fillRect(size / 2 - 4, 4, 8, size - 8);

            graphics.generateTexture(`candy_${index}_line_v`, size, size);
            graphics.destroy();
        });

        // Bomb (wrapped candy)
        colors.forEach((color, index) => {
            const graphics = this.add.graphics();

            // Outer glow
            graphics.fillStyle(0xffffff, 0.3);
            graphics.fillCircle(size / 2, size / 2, size / 2 - 2);

            // Main candy
            graphics.fillStyle(color, 1);
            graphics.fillCircle(size / 2, size / 2, size / 2 - 6);

            // Cross pattern
            graphics.lineStyle(3, 0xffffff, 0.8);
            graphics.strokeCircle(size / 2, size / 2, size / 2 - 10);

            graphics.generateTexture(`candy_${index}_bomb`, size, size);
            graphics.destroy();
        });

        // Color Bomb (Multi-colored "Sprinkle" Bomb)
        const cbGraphics = this.add.graphics();
        this.drawColorBomb(cbGraphics, size);
        cbGraphics.generateTexture('candy_color_bomb', size, size);
        cbGraphics.destroy();
    }

    drawColorBomb(graphics, size) {
        const center = size / 2;
        const radius = size / 2 - 4;

        // Dark background
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(center, center, radius);

        // White border/glow
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(center, center, radius);

        // Colorful sprinkles
        const colors = [0xff4757, 0x3742fa, 0x2ed573, 0xffa502, 0xa55eea, 0xff7f50];
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = radius * 0.6;
            const x = center + Math.cos(angle) * dist;
            const y = center + Math.sin(angle) * dist;
            
            graphics.fillStyle(colors[i % colors.length], 1);
            graphics.fillCircle(x, y, 5);
        }
        
        // Center dot
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(center, center, 6);
    }

    createUITextures() {
        // Button texture
        const btnWidth = 200;
        const btnHeight = 60;
        const btnGraphics = this.add.graphics();

        btnGraphics.fillStyle(0xff6b9d, 1);
        btnGraphics.fillRoundedRect(0, 0, btnWidth, btnHeight, 15);
        btnGraphics.fillStyle(0xffffff, 0.2);
        btnGraphics.fillRoundedRect(4, 4, btnWidth - 8, btnHeight / 2 - 4, 12);

        btnGraphics.generateTexture('button', btnWidth, btnHeight);
        btnGraphics.destroy();

        // Star textures (empty and filled)
        const starSize = 40;

        // Empty star
        const emptyStarGraphics = this.add.graphics();
        const emptyStarPoints = this.createStarPoints(starSize / 2, starSize / 2, 5, starSize / 2 - 2, (starSize / 2 - 2) * 0.5);
        emptyStarGraphics.fillStyle(0x444444, 1);
        emptyStarGraphics.fillPoints(emptyStarPoints, true);
        emptyStarGraphics.generateTexture('star_empty', starSize, starSize);
        emptyStarGraphics.destroy();

        // Filled star
        const filledStarGraphics = this.add.graphics();
        const filledStarPoints = this.createStarPoints(starSize / 2, starSize / 2, 5, starSize / 2 - 2, (starSize / 2 - 2) * 0.5);
        filledStarGraphics.fillStyle(0xffd700, 1);
        filledStarGraphics.fillPoints(filledStarPoints, true);
        filledStarGraphics.generateTexture('star_filled', starSize, starSize);
        filledStarGraphics.destroy();

        // Jelly overlay
        const jellyGraphics = this.add.graphics();
        jellyGraphics.fillStyle(0xff69b4, 0.4);
        jellyGraphics.fillRoundedRect(2, 2, 60, 60, 8);
        jellyGraphics.generateTexture('jelly', 64, 64);
        jellyGraphics.destroy();

        // Lock overlay
        const lockGraphics = this.add.graphics();
        lockGraphics.lineStyle(4, 0x888888, 1);
        lockGraphics.strokeRect(8, 8, 48, 48);
        lockGraphics.strokeRect(16, 16, 32, 32);
        lockGraphics.lineBetween(8, 8, 56, 56);
        lockGraphics.lineBetween(56, 8, 8, 56);
        lockGraphics.generateTexture('lock', 64, 64);
        lockGraphics.destroy();

        // Arrow Cursor (for hints) - pointing RIGHT
        const arrowGraphics = this.add.graphics();
        arrowGraphics.fillStyle(0xffffff, 1);
        
        // Simple triangle arrow pointing right
        const arrowPoly = new Phaser.Geom.Polygon([
            10, 20,  // Top Left
            54, 32,  // Tip (Right)
            10, 44   // Bottom Left
        ]);
        
        arrowGraphics.fillPoints(arrowPoly.points, true);
        
        arrowGraphics.generateTexture('arrow', 64, 64);
        arrowGraphics.destroy();

        // Glow texture (soft radial gradient)
        const glowGraphics = this.add.graphics();
        glowGraphics.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.8, 0.8, 0, 0);
        glowGraphics.fillCircle(32, 32, 32);
        glowGraphics.generateTexture('glow', 64, 64);
        glowGraphics.destroy();
    }

    createParticleTextures() {
        const size = 16;

        // Soft circle particle (default)
        const circleGfx = this.add.graphics();
        circleGfx.fillStyle(0xffffff, 1);
        circleGfx.fillCircle(size / 2, size / 2, size / 2 - 1);
        circleGfx.generateTexture('particle_circle', size, size);
        circleGfx.destroy();

        // Spark particle (4-pointed star)
        const sparkGfx = this.add.graphics();
        sparkGfx.fillStyle(0xffffff, 1);
        const sparkPoints = this.createStarPoints(size / 2, size / 2, 4, size / 2 - 1, 2);
        sparkGfx.fillPoints(sparkPoints, true);
        sparkGfx.generateTexture('particle_spark', size, size);
        sparkGfx.destroy();

        // Ice shard particle (elongated diamond)
        const shardGfx = this.add.graphics();
        shardGfx.fillStyle(0xffffff, 1);
        shardGfx.fillPoints([
            { x: size / 2, y: 1 },
            { x: size / 2 + 3, y: size / 2 },
            { x: size / 2, y: size - 1 },
            { x: size / 2 - 3, y: size / 2 }
        ], true);
        shardGfx.generateTexture('particle_shard', size, size);
        shardGfx.destroy();

        // Small square particle
        const squareGfx = this.add.graphics();
        squareGfx.fillStyle(0xffffff, 1);
        squareGfx.fillRect(3, 3, size - 6, size - 6);
        squareGfx.generateTexture('particle_square', size, size);
        squareGfx.destroy();

        // Ring particle (hollow circle)
        const ringGfx = this.add.graphics();
        ringGfx.lineStyle(2, 0xffffff, 1);
        ringGfx.strokeCircle(size / 2, size / 2, size / 2 - 2);
        ringGfx.generateTexture('particle_ring', size, size);
        ringGfx.destroy();

        // Wood chip particle (irregular polygon)
        const chipGfx = this.add.graphics();
        chipGfx.fillStyle(0xffffff, 1);
        chipGfx.fillPoints([
            { x: 2, y: size / 2 - 2 },
            { x: size / 2, y: 2 },
            { x: size - 2, y: size / 2 },
            { x: size / 2 + 2, y: size - 3 },
            { x: 4, y: size - 4 }
        ], true);
        chipGfx.generateTexture('particle_chip', size, size);
        chipGfx.destroy();

        // Swirl particle (curved arc)
        const swirlGfx = this.add.graphics();
        swirlGfx.lineStyle(3, 0xffffff, 1);
        swirlGfx.beginPath();
        swirlGfx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 1.5);
        swirlGfx.strokePath();
        swirlGfx.generateTexture('particle_swirl', size, size);
        swirlGfx.destroy();

        // Chain link particle (small link shape)
        const linkGfx = this.add.graphics();
        linkGfx.lineStyle(2, 0xffffff, 1);
        linkGfx.strokeRoundedRect(3, 5, size - 6, size - 10, 3);
        linkGfx.generateTexture('particle_link', size, size);
        linkGfx.destroy();

        // Coin particle (golden circle with shine)
        const coinSize = 20;
        const coinGfx = this.add.graphics();
        // Gold fill
        coinGfx.fillStyle(0xFFD700, 1);
        coinGfx.fillCircle(coinSize / 2, coinSize / 2, coinSize / 2 - 1);
        // Darker edge
        coinGfx.lineStyle(2, 0xDAA520, 1);
        coinGfx.strokeCircle(coinSize / 2, coinSize / 2, coinSize / 2 - 2);
        // Shine highlight
        coinGfx.fillStyle(0xFFFFFF, 0.6);
        coinGfx.fillCircle(coinSize / 2 - 3, coinSize / 2 - 3, 4);
        coinGfx.generateTexture('particle_coin', coinSize, coinSize);
        coinGfx.destroy();
    }

    create() {
        // Transition to menu scene
        this.scene.start('MenuScene');
    }
}
