export default class ActionProcessor {
    constructor(board) {
        this.board = board;
        this.scene = board.scene;
        this.isProcessing = false;
    }

    async processBoardState(initialMatches = []) {
        // Prevent re-entrant processing
        if (this.isProcessing) {
            console.warn('ActionProcessor: Already processing, skipping re-entrant call');
            return;
        }

        this.isProcessing = true;

        try {
            let matches = initialMatches.length > 0 ? initialMatches : this.board.matchLogic.findMatches();
            let cascadeLevel = 0;

            while (matches.length > 0) {
                cascadeLevel++;
                if (cascadeLevel > 20) {
                    console.warn('ActionProcessor: Infinite loop detected in cascade - triggering reshuffle');
                    // Instead of just breaking, try to recover by reshuffling
                    await this.board.shuffle();
                    break;
                }

                try {
                    const processingQueue = [];
                    const cellsToClear = new Map();
                    const specialsToCreate = [];
                    const adjacentToUnlock = new Set();
                    const specialsToAnimate = new Map(); // candy -> cells

                    for (const match of matches) {
                        if (match.specialToCreate && match.specialPosition) {
                            specialsToCreate.push({
                                type: match.specialToCreate,
                                position: match.specialPosition,
                                candyType: match.type
                            });
                        }
                        for (const cell of match.cells) {
                            processingQueue.push({ type: 'match_clear', row: cell.row, col: cell.col });
                        }
                    }

                    const processedCells = new Set();
                    while (processingQueue.length > 0) {
                        const action = processingQueue.shift();

                        if (!this.board.isValidCell(action.row, action.col)) continue;

                        const key = `${action.row},${action.col}`;
                        if (processedCells.has(key)) continue;
                        processedCells.add(key);

                        const candy = this.board.candies[action.row][action.col];
                        if (!cellsToClear.has(key)) cellsToClear.set(key, { row: action.row, col: action.col });

                        this.board.getAdjacentCells(action.row, action.col).forEach(adj => {
                            adjacentToUnlock.add(`${adj.row},${adj.col}`);
                        });

                        if (candy && candy.isSpecial) {
                            const affectedCells = await this.getSpecialActivationCells(candy);
                            specialsToAnimate.set(candy, affectedCells);
                            for (const cell of affectedCells) {
                                processingQueue.push({ type: 'special_hit', row: cell.row, col: cell.col });
                            }
                            this.scene.events.emit('specialActivated', candy.specialType, candy.row, candy.col);
                        }
                    }

                    const animatePromises = Array.from(specialsToAnimate.entries()).map(([s, cells]) =>
                        this.safeAwait(this.board.showSpecialActivation(s, cells))
                    );
                    if (animatePromises.length > 0) await Promise.all(animatePromises);

                    await this.safeAwait(this.board.unlockAdjacentTiles(adjacentToUnlock));

                    const score = this.board.calculateScore(cellsToClear.size, cascadeLevel);
                    this.scene.events.emit('scoreUpdate', score, cascadeLevel);

                    await this.safeAwait(this.board.clearCandiesWithSpecials(Array.from(cellsToClear.values()), specialsToCreate));
                    await this.safeAwait(this.board.applyGravity());
                    await this.safeAwait(this.board.fillEmptySpaces());
                    await this.safeAwait(this.board.checkIngredientCollection());

                    matches = this.board.matchLogic.findMatches();
                } catch (cascadeError) {
                    console.error('ActionProcessor: Error during cascade step:', cascadeError);
                    // Continue to next iteration or break if critical
                    matches = [];
                }
            }

            // Final check: Is the board stuck?
            if (!this.board.hasValidMoves()) {
                await this.safeAwait(this.board.shuffle());
            }
        } catch (error) {
            console.error('ActionProcessor: Critical error in processBoardState:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    // Helper to safely await promises with error handling
    async safeAwait(promise) {
        try {
            return await promise;
        } catch (error) {
            console.error('ActionProcessor: Promise rejected:', error);
            return null;
        }
    }

    async getSpecialActivationCells(candy, targetCandy = null) {
        const cells = [];
        const { row, col, specialType, candyType } = candy;
        const { rows, cols, grid, candies } = this.board;

        if (specialType === 'line_h') {
            for (let c = 0; c < cols; c++) if (candies[row][c]) cells.push({ row, col: c });
        } else if (specialType === 'line_v') {
            for (let r = 0; r < rows; r++) if (candies[r][col]) cells.push({ row: r, col });
        } else if (specialType === 'bomb') {
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = col - 1; c <= col + 1; c++) {
                    if (this.board.isValidCell(r, c) && candies[r][c]) cells.push({ row: r, col: c });
                }
            }
        } else if (specialType === 'color_bomb') {
            let targetType = targetCandy ? targetCandy.candyType : -1;
            if (targetType === -1) {
                const available = [];
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] >= 0) available.push(grid[r][c]);
                if (available.length > 0) targetType = Phaser.Utils.Array.GetRandom(available);
            }
            if (targetType !== -1) {
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        if (grid[r][c] === targetType && candies[r][c]) cells.push({ row: r, col: c });
                    }
                }
            }
            cells.push({ row, col });
        }
        return cells;
    }

    async activateSpecial(candy, targetCandy = null) {
        try {
            const cells = await this.getSpecialActivationCells(candy, targetCandy);
            this.scene.events.emit('specialActivated', candy.specialType, candy.row, candy.col);
            await this.safeAwait(this.board.showSpecialActivation(candy, cells));

            const adjacentCells = new Set();
            const specialsToActivate = [];
            const cellsToClear = [];

            for (const cell of cells) {
                this.board.getAdjacentCells(cell.row, cell.col).forEach(adj => adjacentCells.add(`${adj.row},${adj.col}`));
                const target = this.board.candies[cell.row][cell.col];
                if (target && target.isSpecial && target !== candy) {
                    specialsToActivate.push(target);
                } else {
                    cellsToClear.push(cell);
                }
            }
            await this.safeAwait(this.board.unlockAdjacentTiles(adjacentCells));

            const score = this.board.calculateScore(cells.length, 1) + 50;
            this.scene.events.emit('scoreUpdate', score, 1);

            await this.safeAwait(this.board.clearCandies(cellsToClear));

            if (specialsToActivate.length > 0) {
                await Promise.all(specialsToActivate.map(s => this.safeAwait(this.activateSpecial(s))));
            }
        } catch (error) {
            console.error('ActionProcessor: Error in activateSpecial:', error);
        }
    }
}
