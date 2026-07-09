// wallet.js - Balance Provider (Local Simulation)
// Replace LocalBalanceProvider with RemoteBalanceProvider for real money integration.

const RAKE_PERCENT = 0; // Configurable house edge

class LocalBalanceProvider {
    constructor() {
        this.balances = {
            // High local sandbox balance so challenge bets from app (10k+) never block gameplay UI.
            'p1': 100000000,
            'p2': 100000000
        };
    }

    getBalance(playerId) {
        return this.balances[playerId];
    }

    placeWager(playerId, amount) {
        if (this.balances[playerId] >= amount) {
            this.balances[playerId] -= amount;
            return true;
        }
        return false;
    }

    settle(winnerId, pot) {
        if (winnerId !== RESULTS.TIE) {
            const payout = pot * (1 - RAKE_PERCENT);
            this.balances[winnerId] += payout;
        } else {
            // Refund on tie
            this.balances['p1'] += pot / 2;
            this.balances['p2'] += pot / 2;
        }
    }
}

// Single instance
const wallet = new LocalBalanceProvider();
