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
- `src/core/training-store.ts` persists examples and learned profiles in IndexedDB.
- `src/main.js` currently owns browser interaction and will be migrated to typed interface modules incrementally.

Training data remains local to the browser until cloud synchronization is deliberately introduced. Exported JSON is the portable backup and review format.

The evidence policy stores normalized hand landmarks and derived measurements only. Raw webcam video, audio, and still images are not retained.
