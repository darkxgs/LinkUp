# LinkUp Backend

Firebase backend for the whole platform. Holds Cloud Functions (`functions/`), Firestore/Storage/RTDB security rules & indexes, the casino-games web build (`casino-games/`), the realtime multiplayer room-game servers (`room-games-server/`, deployed to Cloud Run), and their per-game source (`room-games-src/`). `hosting/` is the static hosting target.

## Files
- `.firebaserc`
- `.gitignore`
- `DEPLOY_AND_TEST.md`
- `database.rules.json`
- `deploy_batches.sh`
- `firebase.json`
- `firestore.indexes.json`
- `firestore.rules`
- `package-lock.json`
- `package.json`
- `storage.rules`

## Subfolders
- `casino-games/` — see `casino-games/_INDEX.md`
- `functions/` — see `functions/_INDEX.md`
- `hosting/` — see `hosting/_INDEX.md`
- `room-games-server/` — see `room-games-server/_INDEX.md`
- `room-games-src/` — see `room-games-src/_INDEX.md`
- `scripts/` — see `scripts/_INDEX.md`

