// wallet.js - Balance Provider (local demo + LinkUp WebView bridge)

const RAKE_PERCENT = 0;

function isEmbedded() {
    return !!(window.CasinoBridge && CasinoBridge.isEmbedded());
}

class LocalBalanceProvider {
    constructor() {
        this.balances = { p1: 1000, p2: 1000 };
        this.embeddedBetPaid = false;
    }

    getBalance(playerId) {
        if (isEmbedded()) {
            if (playerId === 'p1') return CasinoBridge.getBalance();
            return 999999;
        }
        return this.balances[playerId];
    }

    placeWager(playerId, amount) {
        if (isEmbedded()) {
            if (playerId !== 'p1') return true;
            if (this.embeddedBetPaid) return true;
            return true;
        }
        if (this.balances[playerId] >= amount) {
            this.balances[playerId] -= amount;
            return true;
        }
        return false;
    }

    async placeEmbeddedWager(amount) {
        await CasinoBridge.placeBet(amount);
        this.embeddedBetPaid = true;
        return true;
    }

    settle(winnerId, pot) {
        if (isEmbedded()) {
            const stake = pot / 2;
            const isWin = winnerId === 'p1' || winnerId === RESULTS.P1;
            const winAmount = isWin ? pot : 0;
            CasinoBridge.reportGameResult({
                isWin: isWin,
                stake: stake,
                winAmount: winAmount,
                multiplier: isWin ? 2 : 0,
            });
            this.embeddedBetPaid = false;
            return winAmount;
        }
        if (winnerId !== RESULTS.TIE) {
            const payout = pot * (1 - RAKE_PERCENT);
            this.balances[winnerId] += payout;
            return payout;
        }
        this.balances['p1'] += pot / 2;
        this.balances['p2'] += pot / 2;
        return 0;
    }

    resetEmbedded() {
        this.embeddedBetPaid = false;
    }
}

const wallet = new LocalBalanceProvider();
