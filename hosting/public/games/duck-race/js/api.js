// api.js - The database seam: balance + provably-fair RNG.

function isEmbedded() {
    return !!(window.CasinoBridge && CasinoBridge.isEmbedded());
}

const api = {
    getBalance() {
        if (isEmbedded()) return CasinoBridge.getBalance();
        let bal = localStorage.getItem('duck_race_balance');
        if (bal === null) {
            bal = 1000;
            localStorage.setItem('duck_race_balance', bal);
        }
        return parseInt(bal);
    },

    // Save the player's balance
    saveBalance(balance) {
        localStorage.setItem('duck_race_balance', balance);
        return balance;
    },

    // Recharge the balance back to 1000
    rechargeBalance() {
        return this.saveBalance(1000);
    },

    // Generates the race results using a provably-fair RNG.
    // In a live system, this function runs on the secure backend server.
    generateRace(bet, pickedDuck) {
        const embedded = isEmbedded();
        const balance = embedded ? CasinoBridge.getBalance() : this.getBalance();
        if (!embedded && bet > balance) {
            throw new Error("Insufficient balance");
        }

        // 1. Provably Fair Seeds Generation
        const serverSeed = Math.random().toString(36).substring(2, 15);
        // Simple hash of server seed for the client to verify later
        const serverHash = this.sha256(serverSeed);
        const clientSeed = localStorage.getItem('duck_race_client_seed') || Math.random().toString(36).substring(2, 15);
        localStorage.setItem('duck_race_client_seed', clientSeed);
        
        let nonce = parseInt(localStorage.getItem('duck_race_nonce') || '0');
        nonce++;
        localStorage.setItem('duck_race_nonce', nonce);

        // 2. Generate deterministic finish times using a combined hash (Hmac style)
        const rawTimes = [];
        const wobAmp = [];
        const wobFreq = [];
        const wobPhase = [];

        for (let i = 0; i < 10; i++) {
            // Generate a unique hash for each lane based on seeds and nonce
            const hash = this.sha256(`${serverSeed}-${clientSeed}-${nonce}-${i}`);
            
            // Convert first 8 characters of hash to a number between 0 and 1
            const randVal = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
            rawTimes.push({ index: i, randVal });

            // Wobble physics random values derived from seeds deterministically
            const ampHash = this.sha256(`${serverSeed}-${clientSeed}-${nonce}-amp-${i}`);
            const freqHash = this.sha256(`${serverSeed}-${clientSeed}-${nonce}-freq-${i}`);
            const phaseHash = this.sha256(`${serverSeed}-${clientSeed}-${nonce}-phase-${i}`);

            const rAmp = parseInt(ampHash.substring(0, 8), 16) / 0xffffffff;
            const rFreq = parseInt(freqHash.substring(0, 8), 16) / 0xffffffff;
            const rPhase = parseInt(phaseHash.substring(0, 8), 16) / 0xffffffff;

            wobAmp.push(0.04 + rAmp * 0.06);
            wobFreq.push(2 + rFreq * 2.5);
            wobPhase.push(rPhase * Math.PI * 2);
        }

        // Sort by randVal to assign spaced out finish times
        const sortedDucks = [...rawTimes].sort((a, b) => a.randVal - b.randVal);

        const finishTimes = new Array(10);
        const minSpacing = 0.25; // minimum 0.25 seconds between each duck
        
        sortedDucks.forEach((item, idx) => {
            // Space out each time: 5.0 + (idx * minSpacing) + (small random noise)
            const spacingOffset = idx * minSpacing;
            const smallRandom = item.randVal * 0.08;
            finishTimes[item.index] = 5.0 + spacingOffset + smallRandom;
        });

        // Determine rankings and outcomes
        const order = finishTimes
            .map((ft, i) => ({ ft, n: i + 1 }))
            .sort((a, b) => a.ft - b.ft)
            .map(o => o.n);

        const place = order.indexOf(pickedDuck) + 1;

        let payout = 0;
        if (place === 1) payout = bet * 2;
        else if (place === 2) payout = bet * 0.5;
        else if (place === 3) payout = bet * 0.25;

        const net = payout - bet;
        const newBalance = embedded ? balance + net : balance + net;

        if (!embedded) {
            this.saveBalance(newBalance);
        }

        return {
            finishTimes,
            wobAmp,
            wobFreq,
            wobPhase,
            order,
            place,
            payout,
            net,
            newBalance,
            provablyFair: {
                serverHash,
                serverSeed,
                clientSeed,
                nonce
            }
        };
    },

    // Simple SHA-256 implementation in pure JS (since Web Crypto API is async)
    sha256(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        
        var mathPow = Math.pow;
        var maxWord = mathPow(2, 32);
        var lengthProperty = 'length';
        var i, j; // Used as a loop index.
        var result = '';

        var words = [];
        var asciiLength = ascii[lengthProperty] * 8;
        
        var hash = [], k = [];
        var primeCounter = 0;

        var isPrime = function(n) {
            for (var factor = 2; factor * factor <= n; factor++) {
                if (n % factor === 0) return false;
            }
            return true;
        };

        for (var candidate = 2; primeCounter < 64; candidate++) {
            if (isPrime(candidate)) {
                if (primeCounter < 8) {
                    hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
                }
                k[primeCounter] = (mathPow(candidate, 1/3) * maxWord) | 0;
                primeCounter++;
            }
        }
        
        ascii += '\x80'; // Append Ƶ
        while (ascii[lengthProperty] % 64 - 56) ascii += '\x00'; // Zero pad
        for (i = 0; i < ascii[lengthProperty]; i++) {
            j = ascii.charCodeAt(i);
            if (j >> 8) return; // ASCII only
            words[i >> 2] |= j << (24 - (i % 4) * 8);
        }
        words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
        words[words[lengthProperty]] = (asciiLength);
        
        for (j = 0; j < words[lengthProperty];) {
            var w = words.slice(j, j += 16); // The message is expanded into 64 words as part of the iteration
            var oldHash = hash.slice(0);
            
            hash = hash.slice(0, 8);
            
            for (i = 0; i < 64; i++) {
                var wItem = w[i];
                if (i >= 16) {
                    var s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                    var s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                    wItem = w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
                }
                
                var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
                var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
                var a0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
                var a1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
                
                var temp1 = (hash[7] + a1 + ch + k[i] + wItem) | 0;
                var temp2 = (a0 + maj) | 0;
                
                hash = [(temp1 + temp2) | 0].concat(hash); // hash[0]
                hash[4] = (hash[4] + temp1) | 0;
            }
            
            for (i = 0; i < 8; i++) {
                hash[i] = (hash[i] + oldHash[i]) | 0;
            }
        }
        
        for (i = 0; i < 8; i++) {
            var val = hash[i];
            if (val < 0) val += maxWord;
            var hex = val.toString(16);
            while (hex[lengthProperty] < 8) hex = '0' + hex;
            result += hex;
        }
        return result;
    }
};
window.api = api;
