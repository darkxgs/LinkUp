// =============================================================================
// physics.js — Pure 2D pool simulation.
//
// This module knows NOTHING about players, turns, wagers, or UI. It only knows
// circles (balls), a flat table with cushions, and pockets.
//
// DETERMINISM CONTRACT (important for future networked multiplayer):
//   Given identical input ball positions and an identical Shot {angle, power},
//   simulate() advances the world on a FIXED TIMESTEP and always produces the
//   exact same outcome. No Math.random(), no wall-clock time, no requestAnimation
//   -dependent steps inside the simulation. Because of this, a future online
//   version only needs to transmit the Shot parameters — every client can replay
//   the physics locally and arrive at the identical end state.
//
//   render.js animates a *replay* of the recorded frames, but the authoritative
//   result is computed here, up front, in one deterministic pass.
// =============================================================================

const PHYS = {
  FIXED_DT: 1 / 240,        // fixed simulation timestep (seconds)
  FRICTION: 0.993,          // rolling resistance (slightly more glide)
  STOP_SPEED: 4,            // snap to rest
  CUSHION_RESTITUTION: 0.85,// highly bouncy cushions
  BALL_RESTITUTION: 0.92,   // balls are slightly less bouncy
  MAX_STEPS: 12000,
  MAX_POWER_SPEED: 4500,    // extremely strong hit possible
};

// ---- Geometry constants (in table-local pixel units; render.js scales these) -
const TABLE = {
  WIDTH: 1673,
  HEIGHT: 940,
  BALL_RADIUS: 20,
  POCKET_RADIUS: 46,        // visual radius
  POCKET_CAPTURE_RADIUS: 85 // mathematical capture radius to account for cushions
};

// Playfield bounds (inside the cushions).
function playfield() {
  return {
    left: 112 + TABLE.BALL_RADIUS,
    right: 1673 - 112 - TABLE.BALL_RADIUS,
    top: 106 + TABLE.BALL_RADIUS,
    bottom: 940 - 106 - TABLE.BALL_RADIUS,
  };
}

// Six pocket centers: 4 corners + 2 sides.
function pockets() {
  return [
    { id: 'TL', x: 74, y: 74 },
    { id: 'TM', x: 836.5, y: 48 },
    { id: 'TR', x: 1599, y: 74 },
    { id: 'BL', x: 74, y: 866 },
    { id: 'BM', x: 836.5, y: 892 },
    { id: 'BR', x: 1599, y: 866 },
  ];
}

// A ball: { id, num, group, x, y, vx, vy, potted }
//   num: 0 = cue, 1..15 numbered.  group: 'solid' | 'stripe' | 'eight' | 'cue'

// -----------------------------------------------------------------------------
// simulate(balls, shot)
//   balls : array of live ball objects (only non-potted ones matter)
//   shot  : { angle (radians), power (0..1) }
//
// Returns {
//   frames       : array of position snapshots for animated replay,
//   pottedOrder  : ball ids in the order they were pocketed,
//   firstContact : ball id the cue first touched (or null),
//   finalBalls   : deep copy of balls at rest (authoritative end state)
// }
// -----------------------------------------------------------------------------
function simulate(balls, shot) {
  // Work on a private copy so callers' state is untouched until they commit.
  const world = balls.map((b) => ({ ...b }));
  const cue = world.find((b) => b.num === 0 && !b.potted);

  if (cue) {
    const speed = shot.power * PHYS.MAX_POWER_SPEED;
    cue.vx = Math.cos(shot.angle) * speed;
    cue.vy = Math.sin(shot.angle) * speed;
  }

  const frames = [];
  const events = [];
  const pottedOrder = [];
  let firstContact = null;
  const pocketList = pockets();
  const pf = playfield();

  let steps = 0;
  const RECORD_EVERY = 4; // record every 4th sim step (240Hz) → ~60fps replay

  while (steps < PHYS.MAX_STEPS) {
    let anyMoving = false;

    // Integrate motion + cushion bounces.
    for (const b of world) {
      if (b.potted) continue;
      if (b.vx === 0 && b.vy === 0) continue;
      anyMoving = true;

      b.x += b.vx * PHYS.FIXED_DT;
      b.y += b.vy * PHYS.FIXED_DT;

      // Cushion reflection (axis-aligned rails).
      let bounced = false;
      let bounceVel = 0;
      if (b.x < pf.left) { b.x = pf.left; bounceVel = Math.abs(b.vx); b.vx = -b.vx * PHYS.CUSHION_RESTITUTION; bounced = true; }
      else if (b.x > pf.right) { b.x = pf.right; bounceVel = Math.abs(b.vx); b.vx = -b.vx * PHYS.CUSHION_RESTITUTION; bounced = true; }
      if (b.y < pf.top) { b.y = pf.top; bounceVel = Math.max(bounceVel, Math.abs(b.vy)); b.vy = -b.vy * PHYS.CUSHION_RESTITUTION; bounced = true; }
      else if (b.y > pf.bottom) { b.y = pf.bottom; bounceVel = Math.max(bounceVel, Math.abs(b.vy)); b.vy = -b.vy * PHYS.CUSHION_RESTITUTION; bounced = true; }

      if (bounced && bounceVel > 50) {
        events.push({ frame: frames.length, type: 'collide', vol: Math.min(1, bounceVel / 1500) });
      }

      // Friction.
      b.vx *= PHYS.FRICTION;
      b.vy *= PHYS.FRICTION;
      if (Math.hypot(b.vx, b.vy) < PHYS.STOP_SPEED) { b.vx = 0; b.vy = 0; }
    }

    // Ball-ball collisions (pairwise, resolve once per step).
    for (let i = 0; i < world.length; i++) {
      const a = world[i];
      if (a.potted) continue;
      for (let j = i + 1; j < world.length; j++) {
        const b = world[j];
        if (b.potted) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = TABLE.BALL_RADIUS * 2;
        if (dist > 0 && dist < min) {
          const impact = resolveBallCollision(a, b, dx, dy, dist, min);
          if (impact > 50) {
             events.push({ frame: frames.length, type: 'collide', vol: Math.min(1, impact / 1500) });
          }
          // Record first cue contact for the rules engine.
          if (firstContact === null && (a.num === 0 || b.num === 0)) {
            firstContact = a.num === 0 ? b.id : a.id;
          }
        }
      }
    }

    // Pocket capture.
    for (const b of world) {
      if (b.potted) continue;
      for (const p of pocketList) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < TABLE.POCKET_CAPTURE_RADIUS) {
          b.potted = true;
          b.vx = 0; b.vy = 0;
          b.pocket = p.id; // which pocket it fell into (needed for 8-ball call)
          pottedOrder.push(b.id);
          events.push({ frame: frames.length, type: 'hole', vol: 1 });
          break;
        }
      }
    }

    if (steps % RECORD_EVERY === 0) {
      frames.push(world.map((b) => ({ id: b.id, x: b.x, y: b.y, potted: b.potted, pocket: b.pocket })));
    }

    steps++;
    if (!anyMoving) break;
  }

  // Always record a final resting frame.
  frames.push(world.map((b) => ({ id: b.id, x: b.x, y: b.y, potted: b.potted, pocket: b.pocket })));

  return { frames, events, pottedOrder, firstContact, finalBalls: world };
}

// Elastic-ish collision between two equal-mass circles.
function resolveBallCollision(a, b, dx, dy, dist, min) {
  const nx = dx / dist, ny = dy / dist;

  // Separate the overlap so they don't stick.
  const overlap = (min - dist) / 2;
  a.x -= nx * overlap; a.y -= ny * overlap;
  b.x += nx * overlap; b.y += ny * overlap;

  // Relative velocity along the normal.
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal > 0) return 0; // already separating

  // Equal mass impulse.
  const impulse = -(1 + PHYS.BALL_RESTITUTION) * velAlongNormal / 2;
  const ix = impulse * nx, iy = impulse * ny;
  a.vx -= ix; a.vy -= iy;
  b.vx += ix; b.vy += iy;
  
  return Math.abs(velAlongNormal);
}

// -----------------------------------------------------------------------------
// predictAim(balls, angle) — the 8-Ball-Pool style aiming guide.
//
// Casts a ray from the cue ball along `angle` and returns the visual guide:
//   {
//     cuePath:  [ {x,y}, ... ]     // cue-ball center path (with cushion bounces)
//     ghost:    {x,y} | null       // ghost-ball position at first contact
//     targetDir:[ {x,y},{x,y} ] | null  // predicted line the struck ball travels
//     hitBallId: id | null
//   }
// Pure geometry, no mutation — render.js draws it, nobody else needs it.
// -----------------------------------------------------------------------------
function predictAim(balls, angle) {
  const cue = balls.find((b) => b.num === 0 && !b.potted);
  if (!cue) return { cuePath: [], ghost: null, targetDir: null, hitBallId: null };

  const R = TABLE.BALL_RADIUS;
  const pf = playfield();
  let ox = cue.x, oy = cue.y;
  let dx = Math.cos(angle), dy = Math.sin(angle);
  const others = balls.filter((b) => !b.potted && b.num !== 0);

  const cuePath = [{ x: ox, y: oy }];
  let ghost = null, targetDir = null, hitBallId = null;
  const MAX_BOUNCES = 2;

  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
    // Nearest ball hit along this ray segment.
    let bestT = Infinity, bestBall = null;
    for (const b of others) {
      const fx = ox - b.x, fy = oy - b.y;
      const bb = 2 * (fx * dx + fy * dy);
      const cc = fx * fx + fy * fy - (2 * R) * (2 * R);
      const disc = bb * bb - 4 * cc;
      if (disc < 0) continue;
      const t = (-bb - Math.sqrt(disc)) / 2;
      if (t > 0.01 && t < bestT) { bestT = t; bestBall = b; }
    }

    // Nearest cushion hit along this ray segment.
    let cushT = Infinity, axis = null;
    if (dx > 0) { const t = (pf.right - ox) / dx; if (t > 0.01 && t < cushT) { cushT = t; axis = 'x'; } }
    if (dx < 0) { const t = (pf.left - ox) / dx; if (t > 0.01 && t < cushT) { cushT = t; axis = 'x'; } }
    if (dy > 0) { const t = (pf.bottom - oy) / dy; if (t > 0.01 && t < cushT) { cushT = t; axis = 'y'; } }
    if (dy < 0) { const t = (pf.top - oy) / dy; if (t > 0.01 && t < cushT) { cushT = t; axis = 'y'; } }

    if (bestBall && bestT <= cushT) {
      // Cue stops as a ghost ball touching the target; show target's direction.
      const gx = ox + dx * bestT, gy = oy + dy * bestT;
      ghost = { x: gx, y: gy };
      hitBallId = bestBall.id;
      const nx = bestBall.x - gx, ny = bestBall.y - gy;
      const nlen = Math.hypot(nx, ny) || 1;
      const ux = nx / nlen, uy = ny / nlen;
      const tlen = 90;
      targetDir = [
        { x: bestBall.x, y: bestBall.y },
        { x: bestBall.x + ux * tlen, y: bestBall.y + uy * tlen },
      ];
      cuePath.push({ x: gx, y: gy });
      return { cuePath, ghost, targetDir, hitBallId };
    }

    // Otherwise bounce off the cushion and continue.
    const hx = ox + dx * cushT, hy = oy + dy * cushT;
    cuePath.push({ x: hx, y: hy });
    ox = hx; oy = hy;
    if (axis === 'x') dx = -dx; else dy = -dy;
  }

  return { cuePath, ghost, targetDir, hitBallId };
}
