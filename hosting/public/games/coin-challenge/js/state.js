// state.js - Single source of truth for the game state

const STATES = {
    WAGER: 'WAGER',
    P1_PICKING: 'P1_PICKING',
    WAITING_FOR_OPPONENT: 'WAITING_FOR_OPPONENT',
    REVEALING: 'REVEALING',
    ROUND_RESULT: 'ROUND_RESULT',
    MATCH_OVER: 'MATCH_OVER'
};

const GameState = {
    currentState: STATES.WAGER,
    
    // Opponent details
    opponentConnected: false,
    opponentName: 'Finding...',
    opponentAvatarSeed: 'Opponent',
    
    // Wager tracking
    betAmount: 50,
    pot: 0,
    p1Ready: false,
    p2Ready: false,

    // Match tracking
    p1Wins: 0,
    p2Wins: 0,
    
    // Round tracking
    p1Pick: null,
    p2Pick: null,
    lastRoundResult: null,
    
    resetMatch() {
        this.currentState = STATES.WAGER;
        this.pot = 0;
        this.p1Ready = false;
        this.p2Ready = false;
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.resetRound();
    },
    
    resetRound() {
        this.p1Pick = null;
        this.p2Pick = null;
        this.lastRoundResult = null;
    }
};
