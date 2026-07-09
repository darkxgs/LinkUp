// =============================================================================
// rules.js — Pure Standard 8-Ball rule engine ("call shot").
//
// No rendering, no input, no physics. It is given:
//   - the table state BEFORE the shot (groups, whose turn, which balls were on),
//   - the shot OUTCOME from physics.js (what was potted, first contact, scratch),
//   - and (for an 8-ball attempt) the pocket the shooter CALLED.
//
// It returns a verdict describing fouls, group assignment, whether the shooter
// continues, and win/loss. state.js applies the verdict; rules.js never mutates.
// =============================================================================

const Group = { SOLID: 'solid', STRIPE: 'stripe', EIGHT: 'eight', CUE: 'cue' };

// Map a ball number to its group.
function groupOf(num) {
  if (num === 0) return Group.CUE;
  if (num === 8) return Group.EIGHT;
  return num < 8 ? Group.SOLID : Group.STRIPE;
}

// -----------------------------------------------------------------------------
// evaluateShot(pre, outcome)
//
//  pre = {
//    shooter: 0|1,
//    groups: { 0: 'solid'|'stripe'|null, 1: ... },   // null while table is open
//    isBreak: bool,
//    ballsOnTable: [ {id, num, potted:false}, ... ]   // BEFORE this shot
//    eightCall: { player, pocketId } | null           // pocket called this shot
//  }
//
//  outcome = {
//    pottedOrder: [ids...],          // resolved by physics, in order
//    firstContact: id | null,        // first ball cue touched
//    finalBalls: [ {id,num,potted,pocket}, ... ]
//  }
//
//  Returns verdict = {
//    foul: bool, foulReason: string|null,
//    assignedGroups: {0,1} | null,   // set when table closes this shot
//    continueTurn: bool,             // shooter shoots again?
//    ballInHand: bool,               // opponent gets ball-in-hand
//    gameOver: bool, winner: 0|1|null,
//    pottedThisShot: [ {id,num,pocket}... ],
//    messages: [string...]
//  }
// -----------------------------------------------------------------------------
function evaluateShot(pre, outcome) {
  const v = {
    foul: false, foulReason: null,
    assignedGroups: null,
    continueTurn: false,
    ballInHand: false,
    gameOver: false, winner: null,
    pottedThisShot: [],
    messages: [],
  };

  const shooter = pre.shooter;
  const opponent = shooter === 0 ? 1 : 0;
  const byId = Object.fromEntries(outcome.finalBalls.map((b) => [b.id, b]));

  // Resolve potted ball details in pocket order.
  const potted = outcome.pottedOrder.map((id) => {
    const b = byId[id];
    return { id, num: b.num, group: groupOf(b.num), pocket: b.pocket };
  });
  v.pottedThisShot = potted;

  const cueScratched = potted.some((p) => p.num === 0);
  const eightPotted = potted.some((p) => p.num === 8);
  const firstContactNum = outcome.firstContact != null
    ? byId[outcome.firstContact]?.num ?? null
    : null;
  const firstContactGroup = firstContactNum != null ? groupOf(firstContactNum) : null;

  const shooterGroup = pre.groups[shooter]; // may be null (open table)

  // Which of the shooter's own group balls were potted this shot?
  const pottedOwn = potted.filter((p) =>
    p.num !== 0 && p.num !== 8 &&
    (shooterGroup ? p.group === shooterGroup : true)
  );

  // ---- Determine whether the shooter has cleared their group (pre-shot) ------
  const groupCleared = (g) =>
    g != null &&
    !pre.ballsOnTable.some((b) => !b.potted && groupOf(b.num) === g);

  // =========================================================================
  // 1) 8-BALL OUTCOMES (highest priority — can decide the game)
  // =========================================================================
  if (eightPotted) {
    const clearedBefore = groupCleared(shooterGroup);
    const call = pre.eightCall;
    const eightBall = potted.find((p) => p.num === 8);

    // 8-ball sunk before clearing your group → immediate loss.
    if (!shooterGroup || !clearedBefore) {
      v.gameOver = true; v.winner = opponent;
      v.messages.push('i18n:billEightEarly');
      return v;
    }
    // Must have called a pocket, and it must match.
    if (!call || call.player !== shooter) {
      v.gameOver = true; v.winner = opponent;
      v.messages.push('i18n:billNoPocketCalled');
      return v;
    }
    if (eightBall.pocket !== call.pocketId) {
      v.gameOver = true; v.winner = opponent;
      v.messages.push('i18n:billWrongPocket');
      return v;
    }
    // Scratch on the winning 8-ball shot → loss.
    if (cueScratched) {
      v.gameOver = true; v.winner = opponent;
      v.messages.push('i18n:billScratchEight');
      return v;
    }
    // Legal 8-ball in the called pocket → win.
    v.gameOver = true; v.winner = shooter;
    v.messages.push('i18n:billEightWin');
    return v;
  }

  // =========================================================================
  // 2) FOUL DETECTION (non-8-ball-ending shots)
  // =========================================================================
  // (a) Cue contacts nothing.
  if (outcome.firstContact == null) {
    v.foul = true; v.foulReason = 'foulNoBallHit';
  }
  // (b) Wrong first contact once groups are assigned.
  else if (shooterGroup) {
    const groupAllCleared = groupCleared(shooterGroup);
    if (firstContactGroup === Group.EIGHT && !groupAllCleared) {
      v.foul = true; v.foulReason = 'foulEightFirst';
    } else if (firstContactGroup !== shooterGroup && firstContactGroup !== Group.EIGHT) {
      v.foul = true; v.foulReason = 'foulWrongGroup';
    }
  }
  // (c) Cue scratch is always a foul.
  if (cueScratched) {
    v.foul = true;
    v.foulReason = v.foulReason || 'foulCueScratch';
  }

  // =========================================================================
  // 3) GROUP ASSIGNMENT (table closes on a legal pot while open)
  // =========================================================================
  if (!pre.groups[shooter] && !pre.groups[opponent] && !v.foul && !pre.isBreak) {
    // Open table: assign based on what the shooter legally potted.
    const solidsPotted = potted.filter((p) => p.group === Group.SOLID).length;
    const stripesPotted = potted.filter((p) => p.group === Group.STRIPE).length;
    if (solidsPotted > 0 || stripesPotted > 0) {
      // If both were potted, the first-potted non-8 ball decides the group.
      const firstColor = potted.find((p) => p.group === Group.SOLID || p.group === Group.STRIPE);
      const myGroup = firstColor.group;
      const oppGroup = myGroup === Group.SOLID ? Group.STRIPE : Group.SOLID;
      v.assignedGroups = { [shooter]: myGroup, [opponent]: oppGroup };
      v.messages.push(myGroup === Group.SOLID
        ? `i18n:billPlayerSolids|${shooter}`
        : `i18n:billPlayerStripes|${shooter}`);
    }
  }

  // =========================================================================
  // 4) TURN CONTINUATION
  // =========================================================================
  if (v.foul) {
    v.ballInHand = true;
    v.continueTurn = false;
    v.messages.unshift(`i18n:billFoulBallInHand|${v.foulReason}`);
    return v;
  }

  // Decide if the shooter pocketed at least one of their OWN balls.
  // On the break (still open) any potted color counts to keep shooting.
  const myEffectiveGroup = v.assignedGroups ? v.assignedGroups[shooter] : shooterGroup;
  let legalOwnPot;
  if (myEffectiveGroup) {
    legalOwnPot = potted.some((p) => p.group === myEffectiveGroup);
  } else {
    // Still open (e.g. break with no color potted, or open table no pot).
    legalOwnPot = potted.some((p) => p.num !== 0 && p.num !== 8);
  }

  if (legalOwnPot) {
    v.continueTurn = true;
    v.messages.push('i18n:billLegalPot');
  } else {
    v.continueTurn = false;
  }

  return v;
}
