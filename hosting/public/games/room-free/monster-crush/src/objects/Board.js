import Candy from './Candy.js';
import MatchLogic from '../systems/MatchLogic.js';
import ActionProcessor from '../systems/ActionProcessor.js';
import { GameConfig } from '../Config.js';

export default class Board {
    constructor(scene, config) {
        this.scene = scene;
        this.rows = config.rows || 8;
        this.cols = config.cols || 8;
        this.x = config.x;
        this.y = config.y;
        this.cellSize = config.cellSize;
        this.candyTypes = config.candyTypes || 6;

        // Grid data (candy type per cell, -1 = empty)
        this.grid = [];

        // Sprite references
        this.candies = [];

        // Blocker data - existing
        this.jelly = [];
        this.jellySprites = [];
        this.locked = [];
        this.lockSprites = [];

        // Blocker data - new types
        this.ice = [];              // ice[row][col] = layer count (0, 1, 2)
        this.iceSprites = [];
        this.chains = [];           // chains[row][col] = layer count (0, 1, 2)
        this.chainSprites = [];
        this.stone = [];            // stone[row][col] = boolean
        this.stoneSprites = [];
        this.honey = [];            // honey[row][col] = boolean
        this.honeySprites = [];
        this.honeyMoveCounter = 0;  // Track moves for honey spread interval
        this.licorice = [];         // licorice[row][col] = { right: bool, bottom: bool }
        this.licoriceSprites = [];

        // Blocker data - World 7-8 types
        this.chocolate = [];        // chocolate[row][col] = boolean (blocks cell entirely)
        this.chocolateSprites = [];
        this.chocolateMoveCounter = 0;
        this.crate = [];            // crate[row][col] = layer count (0, 1, 2, 3)
        this.crateSprites = [];
        this.bombTimer = [];        // bombTimer[row][col] = countdown value (0 = none)
        this.bombTimerSprites = [];
        this.bombTimerTexts = [];   // Text objects showing countdown
        this.conveyor = [];         // conveyor[row][col] = direction string or null
        this.conveyorSprites = [];
        this.portals = [];          // Array of { entrance: {row, col}, exit: {row, col}, id }
        this.portalSprites = [];    // portalSprites[row][col] = { entrance: sprite, exit: sprite }

        // Level config for blockers
        this.levelConfig = config.levelConfig || null;

        // Selection state
        this.selectedCandy = null;
        this.lastClickTime = 0;
        this.lastClickCandy = null;

        // Drag/swipe state for mobile
        this.dragStartCandy = null;
        this.dragStartPoint = null;
        this.isDragging = false;
        this.swipeThreshold = this.cellSize * 0.3; // Swipe distance needed

        // Lock input during animations
        this.inputLocked = false;

        // Initialize Systems
        this.matchLogic = new MatchLogic(this);
        this.actionProcessor = new ActionProcessor(this);

        // Track cells being cleared to avoid double-clearing
        this.clearingCells = new Set();

        // Initialize the board
        this.initialize();
    }

    initialize() {
        // Create empty grid arrays
        for (let row = 0; row < this.rows; row++) {
            this.grid[row] = [];
            this.candies[row] = [];
            this.jelly[row] = [];
            this.jellySprites[row] = [];
            this.locked[row] = [];
            this.lockSprites[row] = [];
            this.ice[row] = [];
            this.iceSprites[row] = [];
            this.chains[row] = [];
            this.chainSprites[row] = [];
            this.stone[row] = [];
            this.stoneSprites[row] = [];
            this.honey[row] = [];
            this.honeySprites[row] = [];
            this.licorice[row] = [];
            this.licoriceSprites[row] = [];
            this.chocolate[row] = [];
            this.chocolateSprites[row] = [];
            this.crate[row] = [];
            this.crateSprites[row] = [];
            this.bombTimer[row] = [];
            this.bombTimerSprites[row] = [];
            this.bombTimerTexts[row] = [];
            this.conveyor[row] = [];
            this.conveyorSprites[row] = [];
            this.portalSprites[row] = [];

            for (let col = 0; col < this.cols; col++) {
                this.grid[row][col] = -1;
                this.candies[row][col] = null;
                this.jelly[row][col] = 0;
                this.jellySprites[row][col] = null;
                this.locked[row][col] = false;
                this.lockSprites[row][col] = null;
                this.ice[row][col] = 0;
                this.iceSprites[row][col] = null;
                this.chains[row][col] = 0;
                this.chainSprites[row][col] = null;
                this.stone[row][col] = false;
                this.stoneSprites[row][col] = null;
                this.honey[row][col] = false;
                this.honeySprites[row][col] = null;
                this.licorice[row][col] = { right: false, bottom: false };
                this.licoriceSprites[row][col] = null;
                this.chocolate[row][col] = false;
                this.chocolateSprites[row][col] = null;
                this.crate[row][col] = 0;
                this.crateSprites[row][col] = null;
                this.bombTimer[row][col] = 0;
                this.bombTimerSprites[row][col] = null;
                this.bombTimerTexts[row][col] = null;
                this.conveyor[row][col] = null;
                this.conveyorSprites[row][col] = null;
                this.portalSprites[row][col] = null;
            }
        }

        if (this.levelConfig) this.applyLevelBlockers();
        this.drawCellBackgrounds();
        this.drawJellyLayer();
        this.drawBlockerLayers();  // New: draw all blocker types
        this.fillBoard();
        this.drawLockOverlays();
        this.setupSwipeInput();
    }

    setupSwipeInput() {
        // Scene-level input handlers for swipe/drag detection
        this.scene.input.on('pointerup', (pointer) => {
            if (this.isDragging && this.dragStartCandy) {
                // Check if we should do a tap (no significant movement)
                const dx = pointer.x - this.dragStartPoint.x;
                const dy = pointer.y - this.dragStartPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.swipeThreshold) {
                    // It was a tap, not a swipe - handle as click
                    this.onCandyClick(this.dragStartCandy);
                }
                // If it was a swipe, it was already handled in pointermove
            }
            this.dragStartCandy = null;
            this.dragStartPoint = null;
            this.isDragging = false;
        });

        this.scene.input.on('pointermove', (pointer) => {
            if (!this.isDragging || !this.dragStartCandy || this.inputLocked) return;
            if (!pointer.isDown) return;

            const dx = pointer.x - this.dragStartPoint.x;
            const dy = pointer.y - this.dragStartPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if we've moved enough to trigger a swipe
            if (distance >= this.swipeThreshold) {
                // Determine swipe direction (cardinal only)
                let targetRow = this.dragStartCandy.row;
                let targetCol = this.dragStartCandy.col;

                if (Math.abs(dx) > Math.abs(dy)) {
                    // Horizontal swipe
                    targetCol += (dx > 0) ? 1 : -1;
                } else {
                    // Vertical swipe
                    targetRow += (dy > 0) ? 1 : -1;
                }

                // Check if target is valid and has a candy
                if (this.isValidCell(targetRow, targetCol)) {
                    const targetCandy = this.candies[targetRow][targetCol];
                    if (targetCandy && targetCandy.active) {
                        // Check if source candy can be swapped
                        if (!this.canSwapAt(this.dragStartCandy.row, this.dragStartCandy.col)) {
                            this.showBlockedFeedback(this.dragStartCandy);
                        }
                        // Check if target candy can be swapped
                        else if (!this.canSwapAt(targetRow, targetCol)) {
                            this.showBlockedFeedback(targetCandy);
                        }
                        // Check for licorice wall between candies
                        else if (this.hasLicoriceWall(this.dragStartCandy.row, this.dragStartCandy.col, targetRow, targetCol)) {
                            this.showLicoriceBlockFeedback(this.dragStartCandy, targetCandy);
                        }
                        else {
                            // Execute the swap
                            this.deselectCandy();
                            this.trySwap(this.dragStartCandy, targetCandy);
                        }
                    }
                } else {
                    // Invalid swipe target (edge of board) - treat as tap instead
                    this.onCandyClick(this.dragStartCandy);
                }

                // Clear drag state to prevent multiple swaps (always clear after threshold reached)
                this.dragStartCandy = null;
                this.dragStartPoint = null;
                this.isDragging = false;
            }
        });
    }

    applyLevelBlockers() {
        // Existing blockers
        if (this.levelConfig.jelly) {
            for (const cell of this.levelConfig.jelly) {
                if (this.isValidCell(cell.row, cell.col)) this.jelly[cell.row][cell.col] = cell.layers || 1;
            }
        }
        if (this.levelConfig.locked) {
            for (const cell of this.levelConfig.locked) {
                if (this.isValidCell(cell.row, cell.col)) this.locked[cell.row][cell.col] = true;
            }
        }

        // New blockers - Ice (frozen candy)
        if (this.levelConfig.ice) {
            for (const cell of this.levelConfig.ice) {
                if (this.isValidCell(cell.row, cell.col)) this.ice[cell.row][cell.col] = cell.layers || 1;
            }
        }

        // Chains (locked in place but can match through)
        if (this.levelConfig.chains) {
            for (const cell of this.levelConfig.chains) {
                if (this.isValidCell(cell.row, cell.col)) this.chains[cell.row][cell.col] = cell.layers || 1;
            }
        }

        // Stone (permanent obstacle - no candy here)
        if (this.levelConfig.stone) {
            for (const cell of this.levelConfig.stone) {
                if (this.isValidCell(cell.row, cell.col)) this.stone[cell.row][cell.col] = true;
            }
        }

        // Honey (spreading hazard)
        if (this.levelConfig.honey) {
            for (const cell of this.levelConfig.honey) {
                if (this.isValidCell(cell.row, cell.col)) this.honey[cell.row][cell.col] = true;
            }
        }

        // Licorice (walls between cells)
        if (this.levelConfig.licorice) {
            for (const wall of this.levelConfig.licorice) {
                if (this.isValidCell(wall.row, wall.col)) {
                    if (wall.side === 'right') this.licorice[wall.row][wall.col].right = true;
                    if (wall.side === 'bottom') this.licorice[wall.row][wall.col].bottom = true;
                }
            }
        }

        // Chocolate (spreading blocker - blocks cell entirely)
        if (this.levelConfig.chocolate) {
            for (const cell of this.levelConfig.chocolate) {
                if (this.isValidCell(cell.row, cell.col)) this.chocolate[cell.row][cell.col] = true;
            }
        }

        // Crate (multi-layer box around candy)
        if (this.levelConfig.crate) {
            for (const cell of this.levelConfig.crate) {
                if (this.isValidCell(cell.row, cell.col)) this.crate[cell.row][cell.col] = cell.layers || 1;
            }
        }

        // Bomb Timer (countdown candy)
        if (this.levelConfig.bombTimer) {
            for (const cell of this.levelConfig.bombTimer) {
                if (this.isValidCell(cell.row, cell.col)) this.bombTimer[cell.row][cell.col] = cell.moves || 10;
            }
        }

        // Conveyor (directional movement)
        if (this.levelConfig.conveyor) {
            for (const cell of this.levelConfig.conveyor) {
                if (this.isValidCell(cell.row, cell.col)) this.conveyor[cell.row][cell.col] = cell.direction;
            }
        }

        // Portals (paired teleporters)
        if (this.levelConfig.portals) {
            this.portals = this.levelConfig.portals.map((p, i) => ({
                entrance: p.entrance,
                exit: p.exit,
                id: i
            }));
        }
    }

    // --- Delegation Methods ---

    findMatches() { return this.matchLogic.findMatches(); }
    hasValidMoves() { return this.matchLogic.hasValidMoves(); }
    findValidMove() { return this.matchLogic.findValidMove(); }

    async processBoardState(matches) { return this.actionProcessor.processBoardState(matches); }
    async processMatches(matches) { return this.actionProcessor.processBoardState(matches); }
    async processCascades() { return this.actionProcessor.processBoardState(); }
    async activateSpecial(candy, target) { return this.actionProcessor.activateSpecial(candy, target); }

    // --- Input & Board State Management ---

    onCandyClick(candy) {
        if (this.inputLocked) return;

        // Check if scene is in powerup mode
        if (this.scene.powerupManager?.isInPowerupMode()) {
            this.scene.powerupManager.activate(this.scene.powerupManager.getCurrentMode(), candy.row, candy.col, candy);
            return;
        }

        if (this.selectedCandy && !this.selectedCandy.active) {
            this.selectedCandy = null;
        }

        // Check all blockers that prevent swapping (ice, chains, honey, locked)
        if (!this.canSwapAt(candy.row, candy.col)) {
            this.showBlockedFeedback(candy);
            return;
        }

        const now = Date.now();
        if (this.lastClickCandy === candy && now - this.lastClickTime < 300) {
            if (candy.isSpecial) {
                this.activateTap(candy);
                this.lastClickCandy = null;
                this.lastClickTime = 0;
                return;
            }
        }
        this.lastClickCandy = candy;
        this.lastClickTime = now;

        if (this.selectedCandy === null) {
            this.scene.soundManager.play('select');
            this.selectCandy(candy);
        } else if (this.selectedCandy === candy) {
            this.scene.soundManager.play('click');
            this.deselectCandy();
        } else if (this.isAdjacent(this.selectedCandy.row, this.selectedCandy.col, candy.row, candy.col)) {
            // Check if target candy is blocked
            if (!this.canSwapAt(candy.row, candy.col)) {
                this.showBlockedFeedback(candy);
                this.deselectCandy();
                return;
            }
            // Check for licorice wall between the two candies
            if (this.hasLicoriceWall(this.selectedCandy.row, this.selectedCandy.col, candy.row, candy.col)) {
                this.showLicoriceBlockFeedback(this.selectedCandy, candy);
                this.deselectCandy();
                return;
            }
            this.trySwap(this.selectedCandy, candy);
        } else {
            this.deselectCandy();
            this.selectCandy(candy);
        }
    }

    selectCandy(candy) {
        this.selectedCandy = candy;
        candy.select();
    }

    deselectCandy() {
        if (this.selectedCandy) {
            this.selectedCandy.deselect();
            this.selectedCandy = null;
        }
    }

    showLockedFeedback(candy) {
        const lock = this.lockSprites[candy.row][candy.col];
        const target = lock || candy;
        const originalX = target.x;
        this.scene.tweens.add({
            targets: target,
            x: originalX + 5,
            duration: 50,
            yoyo: true,
            repeat: 3,
            onComplete: () => { target.x = originalX; }
        });
    }

    showBlockedFeedback(candy) {
        // Generic feedback for any blocked candy (ice, chains, honey, locked)
        const row = candy.row;
        const col = candy.col;

        // Find the appropriate blocker sprite
        let blockerSprite = null;
        if (this.ice[row][col] > 0) blockerSprite = this.iceSprites[row][col];
        else if (this.chains[row][col] > 0) blockerSprite = this.chainSprites[row][col];
        else if (this.honey[row][col]) blockerSprite = this.honeySprites[row][col];
        else if (this.locked[row][col]) blockerSprite = this.lockSprites[row][col];

        const target = blockerSprite || candy;
        const originalX = target.x;

        this.scene.soundManager.play('invalid');
        this.scene.tweens.add({
            targets: target,
            x: originalX + 5,
            duration: 50,
            yoyo: true,
            repeat: 3,
            onComplete: () => { target.x = originalX; }
        });
    }

    showLicoriceBlockFeedback(candy1, candy2) {
        // Flash the licorice wall between two candies
        const row1 = candy1.row, col1 = candy1.col;
        const row2 = candy2.row, col2 = candy2.col;

        let licoriceSprite = null;
        if (row1 === row2) {
            // Horizontal neighbors - wall is on the right of the left candy
            const leftCol = Math.min(col1, col2);
            licoriceSprite = this.licoriceSprites[row1][leftCol]?.right;
        } else if (col1 === col2) {
            // Vertical neighbors - wall is on the bottom of the top candy
            const topRow = Math.min(row1, row2);
            licoriceSprite = this.licoriceSprites[topRow][col1]?.bottom;
        }

        this.scene.soundManager.play('invalid');

        if (licoriceSprite) {
            // Flash the licorice wall
            this.scene.tweens.add({
                targets: licoriceSprite,
                alpha: 0.3,
                duration: 100,
                yoyo: true,
                repeat: 2
            });
        }

        // Also shake both candies slightly
        [candy1, candy2].forEach(candy => {
            const originalX = candy.x;
            this.scene.tweens.add({
                targets: candy,
                x: originalX + 3,
                duration: 40,
                yoyo: true,
                repeat: 2,
                onComplete: () => { candy.x = originalX; }
            });
        });
    }

    async activateTap(candy) {
        this.inputLocked = true;
        this.deselectCandy();
        try {
            this.scene.events.emit('validSwap');
            await this.activateSpecial(candy);
            await this.applyGravity();
            await this.fillEmptySpaces();
            await this.processCascades();
            this.scene.events.emit('cascadeComplete');
        } finally {
            this.inputLocked = false;
        }
    }

    async trySwap(candy1, candy2) {
        this.inputLocked = true;
        this.deselectCandy();
        try {
            const bothSpecial = candy1.isSpecial && candy2.isSpecial;
            const oneSpecial = candy1.isSpecial || candy2.isSpecial;

            await this.swapCandies(candy1, candy2);

            if (bothSpecial) {
                this.scene.events.emit('validSwap');
                await this.activateSpecialCombo(candy1, candy2);
                await this.applyGravity();
                await this.fillEmptySpaces();
                await this.processCascades();
                this.scene.events.emit('cascadeComplete');
                return;
            }

            const matches = this.findMatches();
            if (matches.length > 0) {
                this.scene.events.emit('validSwap');
                await this.processMatches(matches);
                this.scene.events.emit('cascadeComplete');
            } else if (oneSpecial) {
                const specialCandy = candy1.isSpecial ? candy1 : candy2;
                this.scene.events.emit('validSwap');
                await this.activateSpecial(specialCandy, candy1 === specialCandy ? candy2 : candy1);
                await this.applyGravity();
                await this.fillEmptySpaces();
                await this.processCascades();
                this.scene.events.emit('cascadeComplete');
            } else {
                // Swap back with a shake effect
                await this.swapCandiesWithShake(candy1, candy2);
                this.scene.events.emit('invalidSwap');
            }
        } finally {
            this.inputLocked = false;
        }
    }

    // --- Animation & Grid Logic ---

    swapCandies(candy1, candy2) {
        return new Promise((resolve) => {
            const tempType = this.grid[candy1.row][candy1.col];
            this.grid[candy1.row][candy1.col] = this.grid[candy2.row][candy2.col];
            this.grid[candy2.row][candy2.col] = tempType;

            this.candies[candy1.row][candy1.col] = candy2;
            this.candies[candy2.row][candy2.col] = candy1;

            const tempRow = candy1.row;
            const tempCol = candy1.col;
            candy1.row = candy2.row;
            candy1.col = candy2.col;
            candy2.row = tempRow;
            candy2.col = tempCol;

            const pos1 = this.gridToWorld(candy1.row, candy1.col);
            const pos2 = this.gridToWorld(candy2.row, candy2.col);
            const duration = GameConfig?.BOARD?.ANIMATION_SPEED?.SWAP || 150;

            this.scene.tweens.add({ targets: candy1, x: pos1.x, y: pos1.y, duration, ease: 'Back.easeOut' });
            this.scene.tweens.add({ targets: candy2, x: pos2.x, y: pos2.y, duration, ease: 'Back.easeOut', onComplete: resolve });
        });
    }

    swapCandiesWithShake(candy1, candy2) {
        return new Promise((resolve) => {
            const tempType = this.grid[candy1.row][candy1.col];
            this.grid[candy1.row][candy1.col] = this.grid[candy2.row][candy2.col];
            this.grid[candy2.row][candy2.col] = tempType;

            this.candies[candy1.row][candy1.col] = candy2;
            this.candies[candy2.row][candy2.col] = candy1;

            const tempRow = candy1.row;
            const tempCol = candy1.col;
            candy1.row = candy2.row;
            candy1.col = candy2.col;
            candy2.row = tempRow;
            candy2.col = tempCol;

            const pos1 = this.gridToWorld(candy1.row, candy1.col);
            const pos2 = this.gridToWorld(candy2.row, candy2.col);
            const duration = GameConfig?.BOARD?.ANIMATION_SPEED?.SWAP || 150;

            // Swap back with elastic overshoot then shake
            this.scene.tweens.add({
                targets: candy1,
                x: pos1.x,
                y: pos1.y,
                duration,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Shake horizontally
                    this.scene.tweens.add({
                        targets: candy1,
                        x: pos1.x + 8,
                        duration: 40,
                        yoyo: true,
                        repeat: 3,
                        ease: 'Sine.easeInOut',
                        onComplete: () => { candy1.x = pos1.x; }
                    });
                }
            });
            this.scene.tweens.add({
                targets: candy2,
                x: pos2.x,
                y: pos2.y,
                duration,
                ease: 'Back.easeOut',
                onComplete: () => {
                    // Shake horizontally
                    this.scene.tweens.add({
                        targets: candy2,
                        x: pos2.x + 8,
                        duration: 40,
                        yoyo: true,
                        repeat: 3,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            candy2.x = pos2.x;
                            resolve();
                        }
                    });
                }
            });

            // Flash red tint briefly
            candy1.setTint(0xff6666);
            candy2.setTint(0xff6666);
            this.scene.time.delayedCall(300, () => {
                if (candy1.active) candy1.clearTint();
                if (candy2.active) candy2.clearTint();
            });
        });
    }

    async activateSpecialCombo(candy1, candy2) {
        const type1 = candy1.specialType;
        const type2 = candy2.specialType;
        let cells = [];

        if (type1 === 'color_bomb' && type2 === 'color_bomb') {
            for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.candies[r][c]) cells.push({ row: r, col: c });
            await this.showBigExplosion(candy1.row, candy1.col);
        } else if (type1 === 'color_bomb' || type2 === 'color_bomb') {
            const colorBomb = type1 === 'color_bomb' ? candy1 : candy2;
            const other = type1 === 'color_bomb' ? candy2 : candy1;
            const targetColor = other.candyType;
            const targetSpecial = other.specialType === 'bomb' ? 'bomb' : (Math.random() > 0.5 ? 'line_h' : 'line_v');

            const targets = [];
            for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === targetColor && this.candies[r][c]) targets.push(this.candies[r][c]);

            for (const target of targets) {
                target.makeSpecial(targetSpecial);
                await new Promise(r => this.scene.time.delayedCall(20, r));
            }
            await Promise.all(targets.map(t => this.activateSpecial(t)));
            cells.push({ row: candy1.row, col: candy1.col }, { row: candy2.row, col: candy2.col });
        } else {
            const row = candy1.row;
            const col = candy1.col;
            if (type1.startsWith('line') && type2.startsWith('line')) {
                for (let c = 0; c < this.cols; c++) if (this.candies[row][c]) cells.push({ row, col: c });
                for (let r = 0; r < this.rows; r++) if (this.candies[r][col] && r !== row) cells.push({ row: r, col });
                await this.showCrossEffect(row, col);
            } else if (type1 === 'bomb' && type2 === 'bomb') {
                for (let r = row - 2; r <= row + 2; r++) for (let c = col - 2; c <= col + 2; c++) if (this.isValidCell(r, c) && this.candies[r][c]) cells.push({ row: r, col: c });
                await this.showBigExplosion(row, col);
            } else {
                const line = type1.startsWith('line') ? candy1 : candy2;
                const bomb = type1 === 'bomb' ? candy1 : candy2;
                if (line.specialType === 'line_h') {
                    for (let r = bomb.row - 1; r <= bomb.row + 1; r++) if (r >= 0 && r < this.rows) for (let c = 0; c < this.cols; c++) if (this.candies[r][c]) cells.push({ row: r, col: c });
                } else {
                    for (let c = bomb.col - 1; c <= bomb.col + 1; c++) if (c >= 0 && c < this.cols) for (let r = 0; r < this.rows; r++) if (this.candies[r][c]) cells.push({ row: r, col: c });
                }
                await this.showBigExplosion(bomb.row, bomb.col);
            }
        }

        const adjacentCells = new Set();
        const specialsToActivate = [];
        const cellsToClear = [];

        for (const cell of cells) {
            this.getAdjacentCells(cell.row, cell.col).forEach(adj => adjacentCells.add(`${adj.row},${adj.col}`));
            const target = this.candies[cell.row][cell.col];
            if (target && target.isSpecial && target !== candy1 && target !== candy2) {
                specialsToActivate.push(target);
            } else {
                cellsToClear.push(cell);
            }
        }
        await this.unlockAdjacentTiles(adjacentCells);
        this.scene.events.emit('scoreUpdate', this.calculateScore(cells.length, 1) + 100, 1);
        
        await this.clearCandies(cellsToClear);
        
        if (specialsToActivate.length > 0) {
            await Promise.all(specialsToActivate.map(s => this.activateSpecial(s)));
        }
    }

    async detonateAllSpecials() {
        const specials = [];
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.candies[r][c] && this.candies[r][c].isSpecial) specials.push(this.candies[r][c]);
        if (specials.length > 0) {
            await Promise.all(specials.map(s => s.scene ? this.activateSpecial(s) : Promise.resolve()));
            await this.applyGravity();
            await this.fillEmptySpaces();
            await this.processCascades();
        }
    }

    // --- Helper Visual Methods ---

    gridToWorld(row, col) { return { x: this.x + col * this.cellSize + this.cellSize / 2, y: this.y + row * this.cellSize + this.cellSize / 2 }; }
    isValidCell(row, col) { return row >= 0 && row < this.rows && col >= 0 && col < this.cols; }
    isAdjacent(r1, c1, r2, c2) { return (Math.abs(r1 - r2) === 1 && c1 === c2) || (Math.abs(c1 - c2) === 1 && r1 === r2); }

    drawCellBackgrounds() {
        const graphics = this.scene.add.graphics();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const { x, y } = this.gridToWorld(r, c);
                graphics.fillStyle(0xffffff, (r + c) % 2 === 0 ? 0.1 : 0.15);
                graphics.fillRoundedRect(x - this.cellSize / 2 + 2, y - this.cellSize / 2 + 2, this.cellSize - 4, this.cellSize - 4, 8);
            }
        }
    }

    drawJellyLayer() {
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.jelly[r][c] > 0) this.createJellySprite(r, c);
    }

    createJellySprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const layers = this.jelly[row][col];
        if (this.jellySprites[row][col]) this.jellySprites[row][col].destroy();
        
        // Position graphics at the center of the cell
        const graphics = this.scene.add.graphics({ x, y }).setDepth(0.5);
        graphics.fillStyle(layers === 2 ? 0xff1493 : 0xff69b4, layers === 2 ? 0.8 : 0.6);
        
        // Draw relative to center (0,0)
        graphics.fillRoundedRect(-this.cellSize / 2 + 2, -this.cellSize / 2 + 2, this.cellSize - 4, this.cellSize - 4, 12);
        
        if (layers === 2) {
            graphics.lineStyle(4, 0xffffff, 0.8);
            graphics.strokeRoundedRect(-this.cellSize / 2 + 2, -this.cellSize / 2 + 2, this.cellSize - 4, this.cellSize - 4, 12);
        }
        this.jellySprites[row][col] = graphics;

        // Add breathing animation
        this.scene.tweens.add({
            targets: graphics,
            scaleX: 1.05,
            scaleY: 1.05,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    drawLockOverlays() {
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.locked[r][c]) this.createLockSprite(r, c);
    }

    createLockSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        if (this.lockSprites[row][col]) this.lockSprites[row][col].destroy();
        const graphics = this.scene.add.graphics().setDepth(2);
        const size = this.cellSize - 8;
        const left = x - size / 2, top = y - size / 2;
        graphics.lineStyle(3, 0x87ceeb, 0.9);
        for (let i = 0; i <= 3; i++) {
            graphics.lineBetween(left + (size / 3) * i, top, left + (size / 3) * i, top + size);
            graphics.lineBetween(left, top + (size / 3) * i, left + size, top + (size / 3) * i);
        }
        this.lockSprites[row][col] = graphics;
        if (this.candies[row][col]) this.candies[row][col].disableInteractive();
    }

    removeLockSprite(row, col) {
        if (this.lockSprites[row][col]) {
            const sprite = this.lockSprites[row][col];
            this.scene.tweens.add({ targets: sprite, alpha: 0, scaleX: 1.3, scaleY: 1.3, duration: 300, onComplete: () => sprite.destroy() });
            this.lockSprites[row][col] = null;
        }
        if (this.candies[row][col]) this.candies[row][col].setInteractive({ useHandCursor: true });
        this.scene.events.emit('lockBroken', row, col);
    }

    // --- New Blocker Rendering ---

    drawBlockerLayers() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // Conveyor goes under everything (it's a cell modifier)
                if (this.conveyor[r][c]) this.createConveyorSprite(r, c);
                if (this.stone[r][c]) this.createStoneSprite(r, c);
                if (this.chocolate[r][c]) this.createChocolateSprite(r, c);
                if (this.ice[r][c] > 0) this.createIceSprite(r, c);
                if (this.chains[r][c] > 0) this.createChainSprite(r, c);
                if (this.crate[r][c] > 0) this.createCrateSprite(r, c);
                if (this.honey[r][c]) this.createHoneySprite(r, c);
                if (this.bombTimer[r][c] > 0) this.createBombTimerSprite(r, c);
                if (this.licorice[r][c].right) this.createLicoriceSprite(r, c, 'right');
                if (this.licorice[r][c].bottom) this.createLicoriceSprite(r, c, 'bottom');
            }
        }
        // Draw portals after other blockers
        for (const portal of this.portals) {
            this.createPortalSprite(portal.entrance.row, portal.entrance.col, 'entrance', portal.id);
            this.createPortalSprite(portal.exit.row, portal.exit.col, 'exit', portal.id);
        }
    }

    createIceSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const layers = this.ice[row][col];
        if (this.iceSprites[row][col]) this.iceSprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(1.5);
        const padding = cfg.ICE_PADDING;
        const size = this.cellSize - padding * 2;
        const half = this.cellSize / 2;

        // Ice background
        const iceColor = layers === 2 ? cfg.ICE_DOUBLE_COLOR : cfg.ICE_SINGLE_COLOR;
        const alpha = layers === 2 ? cfg.ICE_DOUBLE_ALPHA : cfg.ICE_SINGLE_ALPHA;
        graphics.fillStyle(iceColor, alpha);
        graphics.fillRoundedRect(-half + padding, -half + padding, size, size, cfg.ICE_CORNER_RADIUS);

        // Ice border
        const borderWidth = layers === 2 ? cfg.ICE_BORDER_DOUBLE : cfg.ICE_BORDER_SINGLE;
        graphics.lineStyle(borderWidth, cfg.ICE_HIGHLIGHT, 0.8);
        graphics.strokeRoundedRect(-half + padding, -half + padding, size, size, cfg.ICE_CORNER_RADIUS);

        // Frost crystals/sparkle effect
        graphics.fillStyle(cfg.ICE_HIGHLIGHT, 0.6);
        graphics.fillCircle(-8, -8, cfg.ICE_SPARKLE_RADIUS[0]);
        graphics.fillCircle(10, -5, cfg.ICE_SPARKLE_RADIUS[1]);
        graphics.fillCircle(-5, 10, cfg.ICE_SPARKLE_RADIUS[2]);

        this.iceSprites[row][col] = graphics;

        // Shimmer animation
        this.scene.tweens.add({
            targets: graphics,
            alpha: cfg.ICE_DOUBLE_ALPHA,
            duration: cfg.SHIMMER_DURATION,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createChainSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const layers = this.chains[row][col];
        if (this.chainSprites[row][col]) this.chainSprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(1.6);

        // Draw chain links around the candy
        const linkSize = cfg.CHAIN_LINK_SIZE;
        const offset = this.cellSize * cfg.CHAIN_OFFSET_RATIO - 6;
        const lineWidth = layers === 2 ? cfg.CHAIN_DOUBLE_WIDTH : cfg.CHAIN_SINGLE_WIDTH;

        graphics.lineStyle(lineWidth, cfg.CHAIN_COLOR, 1);

        // Top chain
        for (let i = -1; i <= 1; i++) {
            graphics.strokeEllipse(i * linkSize, -offset, linkSize, linkSize / 2);
        }
        // Bottom chain
        for (let i = -1; i <= 1; i++) {
            graphics.strokeEllipse(i * linkSize, offset, linkSize, linkSize / 2);
        }
        // Left chain
        graphics.strokeEllipse(-offset, 0, linkSize / 2, linkSize);
        // Right chain
        graphics.strokeEllipse(offset, 0, linkSize / 2, linkSize);

        // Highlight
        graphics.lineStyle(1, cfg.CHAIN_HIGHLIGHT, 0.5);
        graphics.strokeEllipse(0, -offset, linkSize, linkSize / 2);

        this.chainSprites[row][col] = graphics;

        // Subtle rattle animation
        this.scene.tweens.add({
            targets: graphics,
            x: x + 1,
            duration: cfg.CHAIN_RATTLE_DURATION,
            yoyo: true,
            repeat: -1,
            repeatDelay: cfg.CHAIN_RATTLE_DELAY,
            ease: 'Sine.easeInOut'
        });
    }

    createStoneSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        if (this.stoneSprites[row][col]) this.stoneSprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(1);
        const size = this.cellSize - cfg.STONE_PADDING;
        const half = size / 2;

        // Main stone body
        graphics.fillStyle(cfg.STONE_COLOR, 1);
        graphics.fillRoundedRect(-half, -half, size, size, cfg.STONE_CORNER_RADIUS);

        // Darker cracks
        graphics.lineStyle(cfg.STONE_CRACK_WIDTH, cfg.STONE_CRACK_COLOR, 0.8);
        graphics.beginPath();
        graphics.moveTo(-size / 4, -size / 3);
        graphics.lineTo(0, 0);
        graphics.lineTo(size / 5, size / 4);
        graphics.strokePath();

        graphics.beginPath();
        graphics.moveTo(size / 3, -size / 4);
        graphics.lineTo(size / 6, size / 6);
        graphics.strokePath();

        // Top-left highlight
        graphics.lineStyle(cfg.STONE_HIGHLIGHT_WIDTH, cfg.STONE_HIGHLIGHT, 0.5);
        graphics.beginPath();
        graphics.moveTo(-half + 4, -half + 8);
        graphics.lineTo(-half + 4, -half + 4);
        graphics.lineTo(-half + 12, -half + 4);
        graphics.strokePath();

        this.stoneSprites[row][col] = graphics;
    }

    createHoneySprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        if (this.honeySprites[row][col]) this.honeySprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(0.6);
        const size = this.cellSize - cfg.HONEY_PADDING;
        const half = size / 2;

        // Honey blob (rounded rectangle with drip effect)
        graphics.fillStyle(cfg.HONEY_COLOR, cfg.HONEY_ALPHA);
        graphics.fillRoundedRect(-half, -half, size, size, cfg.HONEY_CORNER_RADIUS);

        // Drip shapes at bottom
        graphics.fillStyle(cfg.HONEY_DRIP_COLOR, 0.7);
        graphics.fillCircle(-size / 4, half - 2, cfg.HONEY_DRIP_RADII[0]);
        graphics.fillCircle(size / 5, half, cfg.HONEY_DRIP_RADII[1]);
        graphics.fillCircle(0, half + 3, cfg.HONEY_DRIP_RADII[2]);

        // Highlight bubbles
        graphics.fillStyle(cfg.HONEY_HIGHLIGHT, 0.6);
        graphics.fillCircle(-size / 4, -size / 4, cfg.HONEY_HIGHLIGHT_RADII[0]);
        graphics.fillCircle(-size / 4 + 8, -size / 4 + 4, cfg.HONEY_HIGHLIGHT_RADII[1]);

        this.honeySprites[row][col] = graphics;

        // Drip animation
        this.scene.tweens.add({
            targets: graphics,
            scaleY: 1.03,
            duration: cfg.HONEY_DRIP_DURATION,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createLicoriceSprite(row, col, side) {
        const { x, y } = this.gridToWorld(row, col);

        // Store in a flat structure for licorice
        if (!this.licoriceSprites[row][col]) this.licoriceSprites[row][col] = {};
        if (this.licoriceSprites[row][col][side]) this.licoriceSprites[row][col][side].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics().setDepth(3);
        const half = this.cellSize / 2;
        const thickness = cfg.LICORICE_THICKNESS;
        const highlightWidth = cfg.LICORICE_HIGHLIGHT_WIDTH;

        if (side === 'right') {
            // Vertical wall on right edge
            graphics.fillStyle(cfg.LICORICE_COLOR, 1);
            graphics.fillRect(x + half - thickness / 2, y - half, thickness, this.cellSize);
            // Highlight stripe
            graphics.fillStyle(cfg.LICORICE_HIGHLIGHT, 0.4);
            graphics.fillRect(x + half - thickness / 2, y - half, highlightWidth, this.cellSize);
        } else if (side === 'bottom') {
            // Horizontal wall on bottom edge
            graphics.fillStyle(cfg.LICORICE_COLOR, 1);
            graphics.fillRect(x - half, y + half - thickness / 2, this.cellSize, thickness);
            // Highlight stripe
            graphics.fillStyle(cfg.LICORICE_HIGHLIGHT, 0.4);
            graphics.fillRect(x - half, y + half - thickness / 2, this.cellSize, highlightWidth);
        }

        this.licoriceSprites[row][col][side] = graphics;
    }

    // --- New World 7-8 Blocker Sprites ---

    createChocolateSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        if (this.chocolateSprites[row][col]) this.chocolateSprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(1);
        const size = this.cellSize - cfg.CHOCOLATE_PADDING;
        const half = size / 2;

        // Main chocolate body
        graphics.fillStyle(cfg.CHOCOLATE_COLOR, cfg.CHOCOLATE_ALPHA);
        graphics.fillRoundedRect(-half, -half, size, size, cfg.CHOCOLATE_CORNER_RADIUS);

        // Dark chocolate swirls
        graphics.fillStyle(cfg.CHOCOLATE_SWIRL_COLOR, 0.6);
        graphics.fillCircle(-size / 4, -size / 4, 8);
        graphics.fillCircle(size / 5, size / 6, 6);
        graphics.fillCircle(-size / 6, size / 4, 5);

        // Highlight
        graphics.fillStyle(cfg.CHOCOLATE_HIGHLIGHT, 0.4);
        graphics.fillCircle(-size / 3, -size / 3, 6);
        graphics.fillCircle(-size / 3 + 8, -size / 3 + 4, 3);

        this.chocolateSprites[row][col] = graphics;

        // Bubbling animation
        this.scene.tweens.add({
            targets: graphics,
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createCrateSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const layers = this.crate[row][col];
        if (this.crateSprites[row][col]) this.crateSprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(1.7);
        const size = this.cellSize - cfg.CRATE_PADDING * 2;
        const half = size / 2;

        // Darker color for more layers
        const baseColor = layers >= 3 ? cfg.CRATE_DARK : layers >= 2 ? cfg.CRATE_COLOR : cfg.CRATE_HIGHLIGHT;

        // Wooden frame
        graphics.fillStyle(baseColor, 0.95);
        graphics.fillRoundedRect(-half, -half, size, size, cfg.CRATE_CORNER_RADIUS);

        // Planks
        graphics.lineStyle(cfg.CRATE_PLANK_WIDTH, cfg.CRATE_DARK, 0.7);
        graphics.lineBetween(-half, 0, half, 0);
        if (layers >= 2) {
            graphics.lineBetween(0, -half, 0, half);
        }
        if (layers >= 3) {
            graphics.lineBetween(-half, -half / 2, half, -half / 2);
            graphics.lineBetween(-half, half / 2, half, half / 2);
        }

        // Corner nails
        graphics.fillStyle(cfg.CRATE_NAIL_COLOR, 1);
        const nailOffset = half - 6;
        graphics.fillCircle(-nailOffset, -nailOffset, 3);
        graphics.fillCircle(nailOffset, -nailOffset, 3);
        graphics.fillCircle(-nailOffset, nailOffset, 3);
        graphics.fillCircle(nailOffset, nailOffset, 3);

        this.crateSprites[row][col] = graphics;
    }

    createBombTimerSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const moves = this.bombTimer[row][col];
        if (this.bombTimerSprites[row][col]) this.bombTimerSprites[row][col].destroy();
        if (this.bombTimerTexts[row][col]) this.bombTimerTexts[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(2.5);
        const size = this.cellSize * 0.4;

        // Bomb body (positioned top-right of cell)
        const offsetX = this.cellSize / 3;
        const offsetY = -this.cellSize / 3;

        graphics.fillStyle(cfg.BOMB_TIMER_BG_COLOR, 0.9);
        graphics.fillCircle(offsetX, offsetY, size / 2);

        // Fuse
        graphics.lineStyle(3, cfg.BOMB_TIMER_FUSE_COLOR, 1);
        graphics.beginPath();
        graphics.moveTo(offsetX, offsetY - size / 2);
        graphics.lineTo(offsetX + 5, offsetY - size / 2 - 8);
        graphics.strokePath();

        // Spark
        graphics.fillStyle(0xFFFF00, 1);
        graphics.fillCircle(offsetX + 5, offsetY - size / 2 - 10, 4);

        this.bombTimerSprites[row][col] = graphics;

        // Countdown text
        const isDanger = moves <= cfg.BOMB_TIMER_DANGER_THRESHOLD;
        const text = this.scene.add.text(x + offsetX, y + offsetY, moves.toString(), {
            fontFamily: 'Arial Black',
            fontSize: '16px',
            color: isDanger ? '#FF0000' : '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(2.6);

        this.bombTimerTexts[row][col] = text;

        // Pulsing animation for danger
        if (isDanger) {
            this.scene.tweens.add({
                targets: [graphics, text],
                scaleX: 1.2,
                scaleY: 1.2,
                duration: cfg.BOMB_TIMER_PULSE_DURATION,
                yoyo: true,
                repeat: -1
            });
        }
    }

    createConveyorSprite(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const direction = this.conveyor[row][col];
        if (this.conveyorSprites[row][col]) this.conveyorSprites[row][col].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(0.3);
        const size = this.cellSize - cfg.CONVEYOR_PADDING * 2;
        const half = size / 2;

        // Belt background
        graphics.fillStyle(cfg.CONVEYOR_COLOR, 0.8);
        graphics.fillRoundedRect(-half, -half, size, size, 4);

        // Moving stripes (visual pattern)
        graphics.fillStyle(cfg.CONVEYOR_STRIPE_COLOR, 0.6);
        for (let i = -2; i <= 2; i++) {
            if (direction === 'up' || direction === 'down') {
                graphics.fillRect(-half + 4, i * 12, size - 8, 4);
            } else {
                graphics.fillRect(i * 12, -half + 4, 4, size - 8);
            }
        }

        // Direction arrow
        graphics.fillStyle(cfg.CONVEYOR_ARROW_COLOR, 0.9);
        const arrowSize = 12;
        const arrowPoints = this.getArrowPoints(direction, arrowSize);
        graphics.fillTriangle(
            arrowPoints[0].x, arrowPoints[0].y,
            arrowPoints[1].x, arrowPoints[1].y,
            arrowPoints[2].x, arrowPoints[2].y
        );

        this.conveyorSprites[row][col] = graphics;

        // Animate the stripes moving
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0.9,
            duration: cfg.CONVEYOR_ANIMATION_SPEED,
            yoyo: true,
            repeat: -1
        });
    }

    getArrowPoints(direction, size) {
        switch (direction) {
            case 'up':
                return [{ x: 0, y: -size }, { x: -size / 2, y: 0 }, { x: size / 2, y: 0 }];
            case 'down':
                return [{ x: 0, y: size }, { x: -size / 2, y: 0 }, { x: size / 2, y: 0 }];
            case 'left':
                return [{ x: -size, y: 0 }, { x: 0, y: -size / 2 }, { x: 0, y: size / 2 }];
            case 'right':
                return [{ x: size, y: 0 }, { x: 0, y: -size / 2 }, { x: 0, y: size / 2 }];
            default:
                return [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
        }
    }

    createPortalSprite(row, col, type, portalId) {
        const { x, y } = this.gridToWorld(row, col);

        if (!this.portalSprites[row][col]) this.portalSprites[row][col] = {};
        if (this.portalSprites[row][col][type]) this.portalSprites[row][col][type].destroy();

        const cfg = GameConfig.BLOCKERS;
        const graphics = this.scene.add.graphics({ x, y }).setDepth(0.4);
        const size = this.cellSize * cfg.PORTAL_SIZE_RATIO;

        const color = type === 'entrance' ? cfg.PORTAL_ENTRANCE_COLOR : cfg.PORTAL_EXIT_COLOR;

        // Outer glow
        graphics.fillStyle(color, cfg.PORTAL_GLOW_ALPHA * 0.3);
        graphics.fillCircle(0, 0, size / 2 + 6);

        // Main portal ring
        graphics.lineStyle(4, color, cfg.PORTAL_GLOW_ALPHA);
        graphics.strokeCircle(0, 0, size / 2);

        // Inner ring
        graphics.lineStyle(2, cfg.PORTAL_RING_COLOR, 0.8);
        graphics.strokeCircle(0, 0, size / 3);

        // Center swirl indicator
        graphics.fillStyle(color, 0.8);
        graphics.fillCircle(0, 0, size / 6);

        // Portal ID indicator (small number)
        const idText = this.scene.add.text(x, y + size / 2 + 8, (portalId + 1).toString(), {
            fontFamily: 'Arial',
            fontSize: '10px',
            color: type === 'entrance' ? '#7C4DFF' : '#00E676'
        }).setOrigin(0.5).setDepth(0.5);

        // Store reference (we'll need to clean up the text too)
        graphics.idText = idText;
        this.portalSprites[row][col][type] = graphics;

        // Spinning animation
        this.scene.tweens.add({
            targets: graphics,
            angle: 360,
            duration: cfg.PORTAL_SPIN_DURATION,
            repeat: -1,
            ease: 'Linear'
        });
    }

    // --- Blocker Handlers ---

    handleIceAt(row, col) {
        if (this.ice[row][col] > 0) {
            this.ice[row][col]--;
            if (this.ice[row][col] === 0) {
                if (this.iceSprites[row][col]) {
                    const sprite = this.iceSprites[row][col];
                    this.scene.tweens.add({
                        targets: sprite,
                        alpha: 0, scaleX: 1.3, scaleY: 1.3,
                        duration: 200,
                        onComplete: () => sprite.destroy()
                    });
                    this.iceSprites[row][col] = null;
                }
                this.scene.events.emit('iceCleared', row, col);
            } else {
                this.createIceSprite(row, col);
                this.scene.events.emit('iceHit', row, col);
            }
        }
    }

    handleChainAt(row, col) {
        if (this.chains[row][col] > 0) {
            this.chains[row][col]--;
            if (this.chains[row][col] === 0) {
                if (this.chainSprites[row][col]) {
                    const sprite = this.chainSprites[row][col];
                    this.scene.tweens.add({
                        targets: sprite,
                        alpha: 0, scaleX: 1.2, scaleY: 1.2,
                        duration: 200,
                        onComplete: () => sprite.destroy()
                    });
                    this.chainSprites[row][col] = null;
                }
                this.scene.events.emit('chainBroken', row, col);
            } else {
                this.createChainSprite(row, col);
                this.scene.events.emit('chainHit', row, col);
            }
        }
    }

    handleHoneyAt(row, col) {
        if (this.honey[row][col]) {
            this.honey[row][col] = false;
            if (this.honeySprites[row][col]) {
                const sprite = this.honeySprites[row][col];
                this.scene.tweens.add({
                    targets: sprite,
                    alpha: 0, scaleY: 0.5,
                    duration: 200,
                    onComplete: () => sprite.destroy()
                });
                this.honeySprites[row][col] = null;
            }
            this.scene.events.emit('honeyCleared', row, col);
        }
    }

    spreadHoney() {
        // Collect all honey positions
        const honeyPositions = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.honey[r][c]) honeyPositions.push({ row: r, col: c });
            }
        }

        if (honeyPositions.length === 0) return false;

        // Check if it's time to spread (based on move interval)
        this.honeyMoveCounter++;
        const cfg = GameConfig.BLOCKERS;
        if (this.honeyMoveCounter < cfg.HONEY_SPREAD_INTERVAL) {
            return false; // Not time to spread yet
        }
        this.honeyMoveCounter = 0; // Reset counter

        let spread = false;
        for (const pos of honeyPositions) {
            // Each honey tile has a chance to spread
            if (Math.random() > cfg.HONEY_SPREAD_CHANCE) continue;

            const adjacent = this.getAdjacentCells(pos.row, pos.col);
            const validTargets = adjacent.filter(adj =>
                !this.honey[adj.row][adj.col] &&
                !this.stone[adj.row][adj.col] &&
                this.candies[adj.row][adj.col]
            );

            if (validTargets.length > 0) {
                const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                this.honey[target.row][target.col] = true;
                this.createHoneySprite(target.row, target.col);
                spread = true;
            }
        }

        if (spread) {
            this.scene.events.emit('honeySpread');
        }

        return spread;
    }

    // --- New World 7-8 Blocker Handlers ---

    handleChocolateAt(row, col) {
        // Chocolate is cleared by adjacent matches, not direct matches
        // This is called when a candy ADJACENT to chocolate is cleared
        if (this.chocolate[row][col]) {
            this.chocolate[row][col] = false;
            if (this.chocolateSprites[row][col]) {
                const sprite = this.chocolateSprites[row][col];
                this.scene.tweens.add({
                    targets: sprite,
                    alpha: 0, scaleX: 0.5, scaleY: 0.5,
                    duration: 200,
                    onComplete: () => sprite.destroy()
                });
                this.chocolateSprites[row][col] = null;
            }
            this.scene.events.emit('chocolateCleared', row, col);
        }
    }

    spreadChocolate() {
        // Collect all chocolate positions
        const chocolatePositions = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.chocolate[r][c]) chocolatePositions.push({ row: r, col: c });
            }
        }

        if (chocolatePositions.length === 0) return false;

        // Check if it's time to spread
        this.chocolateMoveCounter++;
        const cfg = GameConfig.BLOCKERS;
        if (this.chocolateMoveCounter < cfg.CHOCOLATE_SPREAD_INTERVAL) {
            return false;
        }
        this.chocolateMoveCounter = 0;

        let spread = false;
        for (const pos of chocolatePositions) {
            if (Math.random() > cfg.CHOCOLATE_SPREAD_CHANCE) continue;

            const adjacent = this.getAdjacentCells(pos.row, pos.col);
            const validTargets = adjacent.filter(adj =>
                !this.chocolate[adj.row][adj.col] &&
                !this.stone[adj.row][adj.col] &&
                this.candies[adj.row][adj.col] &&
                !this.candies[adj.row][adj.col].isSpecial // Don't spread onto specials
            );

            if (validTargets.length > 0) {
                const target = validTargets[Math.floor(Math.random() * validTargets.length)];
                // Chocolate destroys the candy and takes over the cell
                const candy = this.candies[target.row][target.col];
                if (candy && candy.active) {
                    candy.destroy();
                    this.candies[target.row][target.col] = null;
                    this.grid[target.row][target.col] = -1;
                }
                this.chocolate[target.row][target.col] = true;
                this.createChocolateSprite(target.row, target.col);
                spread = true;
            }
        }

        if (spread) {
            this.scene.events.emit('chocolateSpread');
        }

        return spread;
    }

    clearAdjacentChocolate(row, col) {
        // Called when a candy at (row, col) is cleared - check for adjacent chocolate
        const adjacent = this.getAdjacentCells(row, col);
        for (const adj of adjacent) {
            if (this.chocolate[adj.row][adj.col]) {
                this.handleChocolateAt(adj.row, adj.col);
            }
        }
    }

    handleCrateAt(row, col) {
        if (this.crate[row][col] > 0) {
            this.crate[row][col]--;
            if (this.crate[row][col] === 0) {
                if (this.crateSprites[row][col]) {
                    const sprite = this.crateSprites[row][col];
                    this.scene.tweens.add({
                        targets: sprite,
                        alpha: 0, scaleX: 1.2, scaleY: 1.2,
                        duration: 200,
                        onComplete: () => sprite.destroy()
                    });
                    this.crateSprites[row][col] = null;
                }
                this.scene.events.emit('crateBroken', row, col);
            } else {
                this.createCrateSprite(row, col);
                this.scene.events.emit('crateHit', row, col);
            }
        }
    }

    decrementBombTimers() {
        let hasExpired = false;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.bombTimer[r][c] > 0) {
                    this.bombTimer[r][c]--;
                    if (this.bombTimer[r][c] === 0) {
                        hasExpired = true;
                        this.scene.events.emit('bombTimerExpired', r, c);
                    } else {
                        // Update the visual
                        this.createBombTimerSprite(r, c);
                    }
                }
            }
        }
        return hasExpired;
    }

    clearBombTimerAt(row, col) {
        if (this.bombTimer[row][col] > 0) {
            this.bombTimer[row][col] = 0;
            if (this.bombTimerSprites[row][col]) {
                const sprite = this.bombTimerSprites[row][col];
                this.scene.tweens.add({
                    targets: sprite,
                    alpha: 0, scaleX: 1.5, scaleY: 1.5,
                    duration: 200,
                    onComplete: () => sprite.destroy()
                });
                this.bombTimerSprites[row][col] = null;
            }
            if (this.bombTimerTexts[row][col]) {
                const text = this.bombTimerTexts[row][col];
                this.scene.tweens.add({
                    targets: text,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => text.destroy()
                });
                this.bombTimerTexts[row][col] = null;
            }
            this.scene.events.emit('bombTimerCleared', row, col);
        }
    }

    async processConveyors() {
        // Collect all candies on conveyors and their target positions
        const moves = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const dir = this.conveyor[r][c];
                if (!dir) continue;

                const candy = this.candies[r][c];
                if (!candy) continue;

                let targetRow = r, targetCol = c;
                switch (dir) {
                    case 'up': targetRow--; break;
                    case 'down': targetRow++; break;
                    case 'left': targetCol--; break;
                    case 'right': targetCol++; break;
                }

                // Check if target is valid and not blocked
                if (this.isValidCell(targetRow, targetCol) &&
                    !this.stone[targetRow][targetCol] &&
                    !this.chocolate[targetRow][targetCol]) {
                    moves.push({
                        from: { row: r, col: c },
                        to: { row: targetRow, col: targetCol },
                        candy: candy
                    });
                }
            }
        }

        if (moves.length === 0) return false;

        // Execute moves (swap candies)
        // Note: This is simplified - a full implementation would handle chains of moves
        const tweens = [];
        for (const move of moves) {
            const { from, to, candy } = move;
            const targetCandy = this.candies[to.row][to.col];

            // Swap grid data
            const tempGrid = this.grid[from.row][from.col];
            this.grid[from.row][from.col] = this.grid[to.row][to.col];
            this.grid[to.row][to.col] = tempGrid;

            // Swap candy references
            this.candies[from.row][from.col] = targetCandy;
            this.candies[to.row][to.col] = candy;

            // Update candy positions
            candy.row = to.row;
            candy.col = to.col;
            if (targetCandy) {
                targetCandy.row = from.row;
                targetCandy.col = from.col;
            }

            // Animate
            const pos = this.gridToWorld(to.row, to.col);
            tweens.push(new Promise(res => {
                this.scene.tweens.add({
                    targets: candy,
                    x: pos.x,
                    y: pos.y,
                    duration: 150,
                    ease: 'Power2',
                    onComplete: res
                });
            }));

            if (targetCandy) {
                const pos2 = this.gridToWorld(from.row, from.col);
                tweens.push(new Promise(res => {
                    this.scene.tweens.add({
                        targets: targetCandy,
                        x: pos2.x,
                        y: pos2.y,
                        duration: 150,
                        ease: 'Power2',
                        onComplete: res
                    });
                }));
            }
        }

        if (tweens.length > 0) {
            await Promise.all(tweens);
            this.scene.events.emit('conveyorMoved');
            return true;
        }
        return false;
    }

    getPortalExit(row, col) {
        // Check if this cell is a portal entrance and return the exit
        for (const portal of this.portals) {
            if (portal.entrance.row === row && portal.entrance.col === col) {
                return portal.exit;
            }
        }
        return null;
    }

    // Check if cell blocks candy placement (stone, chocolate)
    isBlockedCell(row, col) {
        return this.stone[row][col] || this.chocolate[row][col];
    }

    // Check if candy can be swapped (ice, chains, honey, crate block swaps)
    canSwapAt(row, col) {
        if (this.ice[row][col] > 0) return false;
        if (this.chains[row][col] > 0) return false;
        if (this.honey[row][col]) return false;
        if (this.crate[row][col] > 0) return false;
        if (this.locked[row][col]) return false;
        return true;
    }

    // Check if licorice wall blocks swap between two cells
    hasLicoriceWall(row1, col1, row2, col2) {
        // Check if there's a wall between cell1 and cell2
        if (row1 === row2) {
            // Horizontal neighbors
            const leftCol = Math.min(col1, col2);
            const leftRow = row1;
            return this.licorice[leftRow][leftCol].right;
        } else if (col1 === col2) {
            // Vertical neighbors
            const topRow = Math.min(row1, row2);
            const topCol = col1;
            return this.licorice[topRow][topCol].bottom;
        }
        return false;
    }

    fillBoard() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // Skip stone cells - they can't have candies
                if (this.stone[r][c]) continue;

                if (this.grid[r][c] === -1) {
                    const type = this.getValidCandyType(r, c);
                    this.createCandy(r, c, type);
                    if (this.locked[r][c]) this.candies[r][c].disableInteractive();
                }
            }
        }
    }

    getValidCandyType(row, col) {
        const invalid = new Set();
        if (col >= 2 && this.grid[row][col - 1] === this.grid[row][col - 2]) invalid.add(this.grid[row][col - 1]);
        if (row >= 2 && this.grid[row - 1][col] === this.grid[row - 2][col]) invalid.add(this.grid[row - 1][col]);
        const valid = [];
        for (let i = 0; i < this.candyTypes; i++) if (!invalid.has(i)) valid.push(i);
        return Phaser.Utils.Array.GetRandom(valid.length ? valid : [0]);
    }

    createCandy(row, col, type, animated = false) {
        const { x, y } = this.gridToWorld(row, col);
        const candy = new Candy(this.scene, x, y, type, row, col);
        candy.setDisplaySize(this.cellSize - 12, this.cellSize - 12).setDepth(1);

        // Use pointerdown to start drag tracking (mobile swipe support)
        candy.on('pointerdown', (pointer) => this.onCandyPointerDown(candy, pointer));

        this.grid[row][col] = type;
        this.candies[row][col] = candy;
        if (animated) {
            candy.y = this.y - this.cellSize;
            this.scene.tweens.add({ targets: candy, y: y, alpha: 1, duration: 200 + row * 50, ease: 'Bounce.easeOut' });
        }
        return candy;
    }

    onCandyPointerDown(candy, pointer) {
        if (this.inputLocked) return;

        // Start drag tracking
        this.dragStartCandy = candy;
        this.dragStartPoint = { x: pointer.x, y: pointer.y };
        this.isDragging = true;
    }

    // --- Action Methods ---

    async checkIngredientCollection() {
        const bottomRow = this.rows - 1;
        const toCollect = [];
        
        for (let col = 0; col < this.cols; col++) {
            const type = this.grid[bottomRow][col];
            if (type >= 100) {
                toCollect.push({ row: bottomRow, col: col });
            }
        }

        if (toCollect.length > 0) {
            await this.clearCandies(toCollect);
            await this.applyGravity();
            await this.fillEmptySpaces();
            await this.checkIngredientCollection(); // Recursive check if more fell down
        }
    }

    async applyGravity() {
        const tweens = [];
        for (let c = 0; c < this.cols; c++) {
            let emptyRow = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                // Stone and chocolate blocks act as floor - candies can't fall through
                if (this.stone[r][c] || this.chocolate[r][c]) {
                    emptyRow = r - 1; // Next empty spot is above the blocker
                    continue;
                }

                if (this.grid[r][c] !== -1) {
                    if (r !== emptyRow) {
                        const candy = this.candies[r][c];
                        this.grid[emptyRow][c] = this.grid[r][c];
                        this.grid[r][c] = -1;
                        this.candies[emptyRow][c] = candy;
                        this.candies[r][c] = null;
                        candy.row = emptyRow;
                        const target = this.gridToWorld(emptyRow, c);
                        tweens.push({
                            targets: candy,
                            y: target.y,
                            duration: 150 + (emptyRow - r) * 50,
                            ease: 'Bounce.easeOut',
                            onComplete: () => {
                                // Landing juice squash
                                this.scene.tweens.add({
                                    targets: candy,
                                    scaleX: 1.1,
                                    scaleY: 0.9,
                                    duration: 100,
                                    yoyo: true,
                                    ease: 'Sine.easeOut'
                                });
                            }
                        });
                    }
                    emptyRow--;
                }
            }
        }
        if (tweens.length === 0) return;
        await Promise.all(tweens.map(t => new Promise(res => this.scene.tweens.add({ ...t, onComplete: () => { if (t.onComplete) t.onComplete(); res(); } }))));
    }

    countIngredients() {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] >= 100) count++;
            }
        }
        return count;
    }

    async fillEmptySpaces() {
        const tweens = [];
        const scene = this.scene;
        const needsDrop = scene.objectives.drop > 0 &&
                         (scene.status.drop + this.countIngredients()) < scene.objectives.drop;

        for (let c = 0; c < this.cols; c++) {
            let emptyCount = 0;
            for (let r = 0; r < this.rows; r++) {
                // Don't count stone cells as empty
                if (!this.stone[r][c] && this.grid[r][c] === -1) emptyCount++;
            }
            for (let r = 0; r < this.rows; r++) {
                // Skip stone cells - they can't have candies
                if (this.stone[r][c]) continue;

                if (this.grid[r][c] === -1) {
                    let type = this.getValidCandyType(r, c);
                    
                    // Small chance to spawn ingredient if needed
                    if (needsDrop && Math.random() < 0.1 && this.countIngredients() < 2) {
                        type = 100; // Cherry
                    }

                    const { x, y } = this.gridToWorld(r, c);
                    const candy = new Candy(this.scene, x, this.y - this.cellSize * (emptyCount - r), type, r, c);
                    candy.setDisplaySize(this.cellSize - 12, this.cellSize - 12).setDepth(1);
                    candy.on('pointerdown', (pointer) => this.onCandyPointerDown(candy, pointer));
                    this.grid[r][c] = type;
                    this.candies[r][c] = candy;
                    tweens.push({ 
                        targets: candy, 
                        y: y, 
                        duration: 300 + r * 50, 
                        ease: 'Bounce.easeOut',
                        onComplete: () => {
                            this.scene.tweens.add({
                                targets: candy,
                                scaleX: 1.1,
                                scaleY: 0.9,
                                duration: 100,
                                yoyo: true,
                                ease: 'Sine.easeOut'
                            });
                        }
                    });
                }
            }
        }
        if (tweens.length === 0) return;
        await Promise.all(tweens.map(t => new Promise(res => this.scene.tweens.add({ ...t, onComplete: () => { if (t.onComplete) t.onComplete(); res(); } }))));
    }

    async clearCandiesWithSpecials(cells, specialsToCreate) {
        const specialPos = new Set(specialsToCreate.map(s => `${s.position.row},${s.position.col}`));
        const toClear = cells.filter(c => !specialPos.has(`${c.row},${c.col}`));

        const promises = toClear.map((cell, i) => {
            const key = `${cell.row},${cell.col}`;
            // Skip if already being cleared
            if (this.clearingCells.has(key)) return Promise.resolve();
            this.clearingCells.add(key);

            // Always handle blockers, even if no candy at this position
            // (e.g., candy might have been cleared by another effect in same cascade)
            this.handleJellyAt(cell.row, cell.col);
            this.handleIceAt(cell.row, cell.col);
            this.handleChainAt(cell.row, cell.col);
            this.handleHoneyAt(cell.row, cell.col);
            this.handleCrateAt(cell.row, cell.col);
            this.clearBombTimerAt(cell.row, cell.col);
            this.clearAdjacentChocolate(cell.row, cell.col);

            const candy = this.candies[cell.row][cell.col];
            if (candy && candy.active) {
                this.grid[cell.row][cell.col] = -1;
                this.candies[cell.row][cell.col] = null;
                const candyType = candy.candyType;
                this.scene.events.emit('candyCleared', cell.row, cell.col, candyType);
                return new Promise(res => this.scene.tweens.add({
                    targets: candy,
                    scaleX: 0, scaleY: 0, alpha: 0,
                    duration: 200,
                    delay: i * 20,
                    onComplete: () => {
                        if (candy.active) candy.destroy();
                        this.clearingCells.delete(key);
                        res();
                    }
                }));
            }
            this.clearingCells.delete(key);
            return Promise.resolve();
        });

        const specialPromises = specialsToCreate.map(special => {
            const { row, col } = special.position;
            const old = this.candies[row][col];
            // Handle all blocker types at special creation position
            this.handleJellyAt(row, col);
            this.handleIceAt(row, col);
            this.handleChainAt(row, col);
            this.handleHoneyAt(row, col);
            this.handleCrateAt(row, col);
            this.clearBombTimerAt(row, col);
            this.clearAdjacentChocolate(row, col);
            if (old && old.active) {
                return new Promise(res => this.scene.tweens.add({
                    targets: old,
                    scaleX: 1.3, scaleY: 1.3,
                    duration: 150,
                    yoyo: true,
                    onComplete: () => {
                        if (old.active) old.makeSpecial(special.type);
                        res();
                    }
                }));
            } else {
                const candy = this.createCandy(row, col, special.candyType);
                candy.makeSpecial(special.type);
                candy.setScale(0);
                return new Promise(res => this.scene.tweens.add({ targets: candy, scaleX: 1, scaleY: 1, duration: 200, onComplete: res }));
            }
        });

        await Promise.all([...promises, ...specialPromises]);
    }

    async clearCandies(cells) {
        const promises = cells.map((cell, i) => {
            const key = `${cell.row},${cell.col}`;
            // Skip if already being cleared
            if (this.clearingCells.has(key)) return Promise.resolve();
            this.clearingCells.add(key);

            // Always handle blockers, even if no candy at this position
            this.handleJellyAt(cell.row, cell.col);
            this.handleIceAt(cell.row, cell.col);
            this.handleChainAt(cell.row, cell.col);
            this.handleHoneyAt(cell.row, cell.col);
            this.handleCrateAt(cell.row, cell.col);
            this.clearBombTimerAt(cell.row, cell.col);
            this.clearAdjacentChocolate(cell.row, cell.col);

            // Handle locked tiles
            if (this.locked[cell.row][cell.col]) {
                this.locked[cell.row][cell.col] = false;
                this.removeLockSprite(cell.row, cell.col);
            }

            const candy = this.candies[cell.row][cell.col];
            if (candy && candy.active) {
                this.grid[cell.row][cell.col] = -1;
                this.candies[cell.row][cell.col] = null;
                const candyType = candy.candyType;
                this.scene.events.emit('candyCleared', cell.row, cell.col, candyType);
                return new Promise(res => this.scene.tweens.add({
                    targets: candy,
                    scaleX: 0, scaleY: 0, alpha: 0,
                    duration: 200,
                    delay: i * 20,
                    onComplete: () => {
                        if (candy.active) candy.destroy();
                        this.clearingCells.delete(key);
                        res();
                    }
                }));
            }
            this.clearingCells.delete(key);
            return Promise.resolve();
        });
        await Promise.all(promises);
    }

    handleJellyAt(row, col) {
        if (this.jelly[row][col] > 0) {
            this.jelly[row][col]--;
            if (this.jelly[row][col] === 0) {
                if (this.jellySprites[row][col]) {
                    const sprite = this.jellySprites[row][col];
                    this.scene.tweens.add({ targets: sprite, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 200, onComplete: () => sprite.destroy() });
                }
                this.scene.events.emit('jellyCleared', row, col);
            } else {
                this.createJellySprite(row, col);
                this.scene.events.emit('jellyHit', row, col);
            }
        }
    }

    calculateScore(tiles, cascade) { return Math.floor(10 * tiles * Math.pow(1.5, cascade - 1)); }

    async showSpecialActivation(candy, targetCells = null) {
        const { x, y } = this.gridToWorld(candy.row, candy.col);
        const graphics = this.scene.add.graphics();
        if (candy.specialType === 'line_h') {
            graphics.fillStyle(0xffffff, 0.8).fillRect(this.x, y - 10, this.cols * this.cellSize, 20);
        } else if (candy.specialType === 'line_v') {
            graphics.fillStyle(0xffffff, 0.8).fillRect(x - 10, this.y, 20, this.rows * this.cellSize);
        } else if (candy.specialType === 'bomb') {
            graphics.setPosition(x, y);
            graphics.fillStyle(0xffff00, 0.6).fillCircle(0, 0, this.cellSize * 1.5);
            return new Promise(res => {
                this.scene.tweens.add({
                    targets: graphics,
                    alpha: 0,
                    scaleX: 2,
                    scaleY: 2,
                    duration: 300,
                    onComplete: () => { graphics.destroy(); res(); }
                });
            });
        } else if (candy.specialType === 'color_bomb') {
            graphics.destroy(); // Don't need the default graphics
            return this.showColorBombLasers(candy, targetCells);
        }
        return new Promise(res => this.scene.tweens.add({ targets: graphics, alpha: 0, duration: 300, onComplete: () => { graphics.destroy(); res(); } }));
    }

    async showColorBombLasers(candy, targetCells) {
        const pos = this.gridToWorld(candy.row, candy.col);
        const beams = [];

        // Filter out the color bomb itself from targets
        const targets = (targetCells || []).filter(c => !(c.row === candy.row && c.col === candy.col));

        if (targets.length === 0) {
            // No targets - just show a simple effect
            const ring = this.scene.add.graphics({ x: pos.x, y: pos.y });
            ring.lineStyle(4, 0xffffff, 1).strokeCircle(0, 0, this.cellSize * 2);
            return new Promise(res => {
                this.scene.tweens.add({
                    targets: ring,
                    alpha: 0,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    duration: 300,
                    onComplete: () => { ring.destroy(); res(); }
                });
            });
        }

        // Get candy color for beam tint
        const targetCandy = this.candies[targets[0].row][targets[0].col];
        const beamColor = targetCandy ? this.getCandyColor(targetCandy.candyType) : 0xffffff;

        // Create pulsing glow around color bomb
        const glow = this.scene.add.graphics({ x: pos.x, y: pos.y }).setDepth(9);
        glow.fillStyle(beamColor, 0.4);
        glow.fillCircle(0, 0, this.cellSize * 0.8);
        this.scene.tweens.add({
            targets: glow,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.6,
            duration: 150,
            yoyo: true,
            repeat: -1
        });

        // Create laser beams one by one
        for (let i = 0; i < targets.length; i++) {
            const cell = targets[i];
            const targetPos = this.gridToWorld(cell.row, cell.col);

            // Create beam graphic
            const beam = this.scene.add.graphics().setDepth(10);

            // Draw laser beam with glow effect
            beam.lineStyle(6, beamColor, 0.3);
            beam.beginPath();
            beam.moveTo(pos.x, pos.y);
            beam.lineTo(targetPos.x, targetPos.y);
            beam.strokePath();

            beam.lineStyle(3, 0xffffff, 0.9);
            beam.beginPath();
            beam.moveTo(pos.x, pos.y);
            beam.lineTo(targetPos.x, targetPos.y);
            beam.strokePath();

            beams.push(beam);

            // Add impact spark at target
            const spark = this.scene.add.graphics({ x: targetPos.x, y: targetPos.y }).setDepth(11);
            spark.fillStyle(0xffffff, 1);
            spark.fillCircle(0, 0, 8);
            beams.push(spark);

            // Flash the target candy
            const targetCandySprite = this.candies[cell.row][cell.col];
            if (targetCandySprite && targetCandySprite.active) {
                this.scene.tweens.add({
                    targets: targetCandySprite,
                    alpha: 0.5,
                    duration: 30,
                    yoyo: true
                });
            }

            // Quick delay between beams
            await new Promise(r => setTimeout(r, 25));
        }

        // All beams visible - brief dramatic pause
        await new Promise(r => setTimeout(r, 150));

        // Stop glow pulsing
        this.scene.tweens.killTweensOf(glow);

        // Color bomb explosion effect
        const explosion = this.scene.add.graphics({ x: pos.x, y: pos.y }).setDepth(12);
        explosion.fillStyle(beamColor, 0.8);
        explosion.fillCircle(0, 0, this.cellSize);

        // Expand and fade explosion + beams + glow
        await new Promise(res => {
            this.scene.tweens.add({
                targets: explosion,
                scaleX: 2,
                scaleY: 2,
                alpha: 0,
                duration: 200,
                ease: 'Quad.easeOut'
            });

            this.scene.tweens.add({
                targets: [...beams, glow],
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    beams.forEach(b => b.destroy());
                    glow.destroy();
                    explosion.destroy();
                    res();
                }
            });
        });
    }

    getCandyColor(candyType) {
        const colors = [
            0xff4757, // Red
            0x3742fa, // Blue
            0x2ed573, // Green
            0xffa502, // Orange
            0xa55eea, // Purple
            0xffeb3b  // Yellow
        ];
        return colors[candyType] || 0xffffff;
    }

    async showCrossEffect(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        const h = this.scene.add.graphics().fillStyle(0xffffff, 0.8).fillRect(this.x, y - 15, this.cols * this.cellSize, 30);
        const v = this.scene.add.graphics().fillStyle(0xffffff, 0.8).fillRect(x - 15, this.y, 30, this.rows * this.cellSize);
        return new Promise(res => this.scene.tweens.add({ targets: [h, v], alpha: 0, duration: 400, onComplete: () => { h.destroy(); v.destroy(); res(); } }));
    }

    async showBigExplosion(row, col) {
        const { x, y } = this.gridToWorld(row, col);
        
        // Shockwave ring
        const ring = this.scene.add.graphics({ x, y });
        ring.lineStyle(6, 0xffffff, 1);
        ring.strokeCircle(0, 0, this.cellSize);
        this.scene.tweens.add({
            targets: ring,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 500,
            onComplete: () => ring.destroy()
        });

        const c = this.scene.add.graphics({ x, y });
        c.fillStyle(0xff6600, 0.7).fillCircle(0, 0, this.cellSize * 2.5);
        this.scene.cameras.main.shake(200, 0.01);
        return new Promise(res => this.scene.tweens.add({ targets: c, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 400, onComplete: () => { c.destroy(); res(); } }));
    }

    async shuffle() {
        if (this.inputLocked) return;
        this.inputLocked = true;

        // Show "NO MOVES" message
        const text = this.scene.add.text(this.scene.cameras.main.width / 2, this.scene.cameras.main.height / 2, 'NO MOVES!', {
            fontFamily: 'Arial Black', fontSize: '64px', color: '#ffffff', stroke: '#ff4757', strokeThickness: 8
        }).setOrigin(0.5).setDepth(1000).setScale(0);

        this.scene.soundManager.play('invalid');

        await new Promise(res => {
            this.scene.tweens.add({
                targets: text, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeOut',
                yoyo: true, hold: 500, onComplete: () => { text.destroy(); res(); }
            });
        });

        // Collect all non-special, non-locked candies
        const all = [];
        const targets = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== -1 && !this.candies[r][c].isSpecial && !this.locked[r][c]) {
                    all.push(this.grid[r][c]);
                    targets.push(this.candies[r][c]);
                }
            }
        }

        // Animation: Scale down all candies
        await Promise.all(targets.map(candy => new Promise(res => {
            this.scene.tweens.add({ targets: candy, scaleX: 0, scaleY: 0, duration: 200, onComplete: res });
        })));

        Phaser.Utils.Array.Shuffle(all);
        
        // Reassign types and textures
        targets.forEach((candy, idx) => {
            const type = all[idx];
            this.grid[candy.row][candy.col] = type;
            candy.candyType = type;
            candy.setTexture(`candy_${type}`);
        });

        // Animation: Scale back up
        await Promise.all(targets.map(candy => new Promise(res => {
            this.scene.tweens.add({ targets: candy, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut', onComplete: res });
        })));

        await new Promise(r => this.scene.time.delayedCall(200, r));

        // If still no moves, shuffle again (recursive safety)
        if (!this.hasValidMoves()) {
            this.inputLocked = false; // Temporarily unlock to allow recursive call
            await this.shuffle();
        } else {
            this.inputLocked = false;
        }
    }

    getAdjacentCells(row, col) {
        const adj = [];
        [[ -1, 0 ], [ 1, 0 ], [ 0, -1 ], [ 0, 1 ]].forEach(([ dr, dc ]) => {
            if (this.isValidCell(row + dr, col + dc)) adj.push({ row: row + dr, col: col + dc });
        });
        return adj;
    }

    async unlockAdjacentTiles(keys) {
        for (const key of keys) {
            const [ r, c ] = key.split(',').map(Number);
            if (this.locked[r][c]) { this.locked[r][c] = false; this.removeLockSprite(r, c); }
        }
    }

    destroy() {
        // Clean up input handlers
        this.scene.input.off('pointerup');
        this.scene.input.off('pointermove');

        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
            if (this.candies[r][c]) this.candies[r][c].destroy();
            if (this.jellySprites[r][c]) this.jellySprites[r][c].destroy();
            if (this.lockSprites[r][c]) this.lockSprites[r][c].destroy();
        }
    }
}