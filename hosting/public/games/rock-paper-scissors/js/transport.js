// transport.js - Networking layer stub
// Replace LocalTransport with SocketTransport for real multiplayer.

class LocalTransport {
    constructor() {
        this.onRoundReadyCallback = null;
    }

    // Set the callback to fire when both picks are in
    onRoundReady(callback) {
        this.onRoundReadyCallback = callback;
    }

    // Submit a pick
    submitPick(playerId, choice) {
        if (playerId === 'p1') {
            GameState.p1Pick = choice;
            // Move to waiting for opponent locally
            GameState.currentState = STATES.WAITING_FOR_OPPONENT;
            if (window.updateUI) window.updateUI();

            // MOCK: Simulate network delay and opponent's pick
            setTimeout(() => {
                const choices = ['rock', 'paper', 'scissors'];
                const p2Choice = choices[Math.floor(Math.random() * choices.length)];
                this.submitPick('p2', p2Choice);
            }, 1500);

        } else if (playerId === 'p2') {
            GameState.p2Pick = choice;
            // Both picks are in, fire callback
            if (this.onRoundReadyCallback) {
                this.onRoundReadyCallback(GameState.p1Pick, GameState.p2Pick);
            }
        }
    }
}

// Single instance
const transport = new LocalTransport();
