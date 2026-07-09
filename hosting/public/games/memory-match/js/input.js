(() => {
const state = window.state;
const GameState = window.GameState;

window.InputHandler = class InputHandler {
  constructor(engine) {
    this.engine = engine;
    
    // Lazy Audio Activation on user gesture
    const initAudio = () => {
      if (window.soundSynth) {
        window.soundSynth.initContext();
      }
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);

    // Mute Button Handler
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      const updateMuteIcon = () => {
        const isMuted = window.soundSynth ? window.soundSynth.getMuteState() : false;
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.title = isMuted ? 'تفعيل الصوت' : 'كتم الصوت';
      };
      updateMuteIcon();
      
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.soundSynth) {
          const isNowMuted = window.soundSynth.toggleMute();
          updateMuteIcon();
          if (!isNowMuted) {
            window.soundSynth.playClick();
          }
        }
      });
    }

    // Preset Bet Buttons handler
    document.querySelectorAll('.bet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const chip = e.target.closest('.bet-btn');
        if (!chip) return;
        const bet = parseInt(chip.dataset.bet, 10);
        this.engine.selectBet(bet);
      });
    });

    // Custom Bet Submission handler
    const customBetSubmitBtn = document.getElementById('btn-submit-custom-bet');
    const customBetInput = document.getElementById('input-custom-bet');
    if (customBetSubmitBtn && customBetInput) {
      customBetSubmitBtn.addEventListener('click', () => {
        const customBetVal = parseInt(customBetInput.value, 10);
        this.engine.selectBet(customBetVal);
      });
      
      customBetInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const customBetVal = parseInt(customBetInput.value, 10);
          this.engine.selectBet(customBetVal);
        }
      });
    }
    
    // Card flipping board handler
    document.getElementById('game-board').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      
      const index = parseInt(card.dataset.index, 10);
      this.engine.flipCard(index);
    });
    
    // Home navigation handler
    document.getElementById('btn-home').addEventListener('click', () => {
      if (window.soundSynth) window.soundSynth.playClick();
      state.setState(GameState.BET_SELECT);
    });
  }
}
})();
