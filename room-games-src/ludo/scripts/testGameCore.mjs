import { GameCore } from '../src/server/GameCore.js';

const game = new GameCore();
// console.log('initial turn', game.turn);
// console.log('eligible first', game.getEligiblePieces('P1'));

// game.diceValue = 6;
// game.state = 'DICE_ROLLED';
// console.log('eligible after setting dice 6', game.getEligiblePieces('P1'));
// const result = game.movePiece('P1', 0);
// console.log('move result keys', Object.keys(result));

game.runbubbleSortLeaderboardTest();
