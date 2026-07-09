class SequenceEngine {
  constructor() {
    this.originalSequence = []; // Array of tile instances: { uniqueId, colorId, hex, label, name }
    this.shuffledPool = [];     // Shuffled version of originalSequence for the reconstruct phase
    this.currentBet = 0;
  }

  /**
   * Generates a new game sequence based on the bet amount.
   * Each tile in the sequence is given a uniqueId so it can be uniquely tracked.
   */
  generateSequence(bet) {
    this.currentBet = bet;
    const length = typeof getSequenceLengthForBet === 'function'
      ? getSequenceLengthForBet(bet)
      : (SEQUENCE_LENGTH_BY_BET[bet] || 8);
    this.originalSequence = [];

    for (let i = 0; i < length; i++) {
      // Pick a random color from the COLORS palette
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.originalSequence.push({
        uniqueId: `tile_${i}_${Math.random().toString(36).substr(2, 9)}`,
        colorId: randomColor.id,
        hex: randomColor.hex,
        label: randomColor.label,
        name: randomColor.name
      });
    }

    // Shuffle the pool for reconstruction
    this.shuffledPool = this._shuffle([...this.originalSequence]);
    
    return {
      sequence: this.originalSequence,
      pool: this.shuffledPool
    };
  }

  /**
   * Fisher-Yates shuffle algorithm to randomize tile order.
   */
  _shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Validates if the player's reconstructed sequence matches the original sequence exactly.
   * Player's answer list is an array of tile instances.
   */
  validateAnswer(playerAnswer) {
    if (playerAnswer.length !== this.originalSequence.length) {
      return false;
    }

    for (let i = 0; i < this.originalSequence.length; i++) {
      if (playerAnswer[i].colorId !== this.originalSequence[i].colorId) {
        return false;
      }
    }
    return true;
  }
}
