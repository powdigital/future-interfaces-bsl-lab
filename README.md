# Future of Interfaces BSL Lab

This is the maintainable application version of the hand-tracking experiment. The original standalone files are preserved in the sibling `standalone-v1` folder.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, start the camera, and allow webcam access.

## Verify

```bash
npm test
npm run build
```

## Architecture

- `src/core/hand-metrics.ts` converts MediaPipe landmarks into scale-relative finger evidence.
- `src/core/sign-bank.ts` contains versioned, seeded definitions.
- `src/core/sign-engine.ts` scores signs and builds evidence-weighted profiles.
- `src/core/chain-game.ts` contains the replaceable five-number checkpoint game rules.
- `src/core/training-store.ts` persists examples and learned profiles in IndexedDB.
- `src/main.js` currently owns browser interaction and will be migrated to typed interface modules incrementally.

Training data remains local to the browser until cloud synchronization is deliberately introduced. Exported JSON is the portable backup and review format.

The evidence policy stores normalized hand landmarks and derived measurements only. Raw webcam video, audio, and still images are not retained.

Guided training is the primary evidence workflow. Choose a number and complete five prompted correct variations followed by three sign-specific incorrect examples. Advanced manual calibration remains available for unusual failures found during later testing.

Training derives a learned finger-state pattern as well as continuous geometry ranges. Once five correct and three incorrect clips have established a profile, that local evidence overrides a conflicting provisional seed automatically. The Diagnostics report shows the learned state and confidence for every finger.

The current number library contains help overlays for 1 to 10. Numbers 1 to 9 can be trained as one-hand signs. Number 10 currently uses a provisional two-open-hand rule and is not included in calibration until the evidence format supports paired hands.
