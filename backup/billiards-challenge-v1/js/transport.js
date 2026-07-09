// =============================================================================
// transport.js — THE multiplayer seam.
//
// A shot is the ONLY thing that needs to travel between players, because
// physics.js is deterministic (same {angle, power} → same outcome on every
// client). So the network surface area is tiny: send a Shot, receive a Shot.
//
//   interface GameTransport {
//     sendShot(shot)                 // called by the local player when they shoot
//     onShotReceived(callback)       // register handler: (shot) => void
//   }
//
// Today we ship LocalTransport: "sending" a shot immediately feeds it back into
// the same local game (hot-seat — both players are on this device).
//
// ►► TO GO ONLINE: implement SocketTransport / FirebaseTransport / WebRTCTransport
//    with the SAME two methods. sendShot() pushes {angle, power} to the wire;
//    the network 'message' handler calls the registered callback. state.js,
//    rules.js, and physics.js never change. A sketch is at the bottom.
// =============================================================================

class LocalTransport {
  constructor() {
    this._handler = null;
  }

  // Register the callback that consumes an incoming shot.
  onShotReceived(callback) {
    this._handler = callback;
  }

  // In hot-seat mode the "remote" player is the same machine, so we just hand
  // the shot straight back. Wrapped in a microtask to mirror the async nature
  // of a real network round-trip (keeps call sites identical when you swap in
  // a real transport that resolves later).
  sendShot(shot) {
    Promise.resolve().then(() => {
      if (this._handler) this._handler(shot);
    });
  }
}

// -----------------------------------------------------------------------------
// FUTURE: real online transport. Drop-in replacement for LocalTransport.
//
// export class SocketTransport {
//   constructor(socket, opponentId) {
//     this._socket = socket;
//     this._handler = null;
//     // Remote shots arrive here and flow through the identical callback path.
//     socket.on('shot', (shot) => this._handler && this._handler(shot));
//   }
//   onShotReceived(cb) { this._handler = cb; }
//   sendShot(shot)     { this._socket.emit('shot', shot); }
// }
//
// In main.js this is the entire wiring change:
//   const transport = IS_LOCAL_HOTSEAT
//     ? new LocalTransport()
//     : new SocketTransport(io(), opponentId);
// -----------------------------------------------------------------------------
