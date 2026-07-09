// rules.js - Pure functions for game logic

const ROUNDS_TO_WIN = 2; // Best of 3

const CHOICES = {
    ROCK: 'rock',
    PAPER: 'paper',
    SCISSORS: 'scissors'
};

const RESULTS = {
    P1: 'p1',
    P2: 'p2',
    TIE: 'tie'
};

// Given two picks, returns 'p1', 'p2', or 'tie'
function resolveRound(p1Pick, p2Pick) {
    if (p1Pick === p2Pick) return RESULTS.TIE;

    if (
        (p1Pick === CHOICES.ROCK && p2Pick === CHOICES.SCISSORS) ||
        (p1Pick === CHOICES.SCISSORS && p2Pick === CHOICES.PAPER) ||
        (p1Pick === CHOICES.PAPER && p2Pick === CHOICES.ROCK)
    ) {
        return RESULTS.P1;
    }

    return RESULTS.P2;
}

function checkMatchWinner(winsP1, winsP2) {
    if (winsP1 >= ROUNDS_TO_WIN) return RESULTS.P1;
    if (winsP2 >= ROUNDS_TO_WIN) return RESULTS.P2;
    return null;
}
