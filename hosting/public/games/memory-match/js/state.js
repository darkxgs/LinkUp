window.GameState = {
  INIT: 'INIT',
  BLOCKED_UNTIL_TOMORROW: 'BLOCKED_UNTIL_TOMORROW',
  BET_SELECT: 'BET_SELECT',
  MEMORIZE_PHASE: 'MEMORIZE_PHASE',
  SHUFFLE_PHASE: 'SHUFFLE_PHASE',
  MATCHING_PHASE: 'MATCHING_PHASE',
  RESULT: 'RESULT'
};

class StateMachine {
  constructor() {
    this.currentState = window.GameState.INIT;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  setState(newState, payload = {}) {
    if (this.currentState === newState && Object.keys(payload).length === 0) return;
    const oldState = this.currentState;
    this.currentState = newState;
    this.listeners.forEach(listener => listener(newState, oldState, payload));
  }

  getState() {
    return this.currentState;
  }
}

window.state = new StateMachine();
