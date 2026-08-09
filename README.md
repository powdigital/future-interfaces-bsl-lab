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
- `src/core/motion-engine.ts` recognizes bounded, single-cycle temporal gestures from timestamped landmarks.
- `src/core/hand-position.ts` classifies palm or back facing and snaps the displayed hand axis to four cardinal angles.
- `src/core/chain-game.ts` contains the replaceable five-number checkpoint game rules.
- `src/core/training-store.ts` persists examples and learned profiles in IndexedDB.
- `src/main.js` currently owns browser interaction and will be migrated to typed interface modules incrementally.

Training data remains local to the browser until cloud synchronization is deliberately introduced. Exported JSON is the portable backup and review format.

The evidence policy stores normalized hand landmarks and derived measurements only. Raw webcam video, audio, and still images are not retained.

Guided training is the primary evidence workflow. Choose a number and complete five prompted correct variations followed by three sign-specific incorrect examples. Advanced manual calibration remains available for unusual failures found during later testing.

Training derives a learned finger-state pattern as well as continuous geometry ranges. Once five correct and three incorrect clips have established a profile, that local evidence overrides a conflicting provisional seed automatically. The Diagnostics report shows the learned state and confidence for every finger.

Established profiles retain the seeded definition as a fallback for valid natural variations outside narrow learned ranges, while trained negative evidence can still veto known false matches. Diagnostics also shows live selected-sign, top-candidate, threshold, and margin scores.

Palm-axis orientation is measured from the wrist to the middle-finger base. It is both a seeded foundation rule and a learned continuous feature, allowing otherwise similar finger shapes such as Numbers 4 and 9 to be separated by hand rotation.

The current number library contains help overlays for 1 to 20. Numbers 1 to 9 can be trained as one-hand static signs. Number 10 currently uses a provisional two-open-hand rule and is not included in calibration until the evidence format supports paired hands.

Number 11 is the first active motion sign. Its recognizer requires an open start followed by one complete closing pinch between 120 and 1800 milliseconds. Recognition happens at closure, then the detector waits for release before it can trigger again. A held pinch, an incomplete pinch, a very rapid twitch, and motion dominated by moving the whole hand are rejected. Motion mode can be selected manually or by selecting Number 11 in the rail.

Recognition feedback and gamification are independent. Every confidently recognized sign displays its response immediately. The default block mode progresses through 1 to 5 and then 6 to 10. Completing a block makes it a safe checkpoint and deprioritizes those five signs. During the second block, only Numbers 6 to 10 compete for static recognition, preventing a completed Number 4 from being selected instead of Number 9.

A backward recognition wipes the current block and returns to the previous five-number checkpoint. A forward number is still identified and displayed but does not change ordered progress. Free-practice and strict ordered modes remain available as replaceable difficulty rules in `src/core/chain-game.ts`.

Camera sessions begin with an initialization gate. The Number 1 diagram remains visible until Number 1 is confidently recognized in its required upright position. Normal progression and hand-position reporting begin only after that confirmation.

After initialization, hand-position indicators update at a fixed 500 millisecond interval. Each detected hand is classified independently as front, back, or unknown using MediaPipe handedness and palm landmark winding. Direction uses a palm coordinate frame built from the wrist, the centre of all four knuckles, and the perpendicular of the index-to-pinky knuckle line. Those two directional signals are combined and snapped to `-90°`, `0°`, `90°`, or `180°`. The supplied front and back hand icons flick immediately to the new angle with no transition animation. An edge-on, unclassified, or low-confidence palm frame is reported as unknown instead of being assigned an unreliable icon.

Static recognition uses a staged spatial gate before finger scoring. The exact number of visible hands first removes all incompatible signs. Known orientation requirements then remove incompatible rotations. Finger state and continuous finger geometry are scored only for the remaining candidates. Dynamic motion rules remain the final stage. Facing is measured now but is not yet a hard sign gate until positive and negative facing evidence has been collected for each sign.

Numbers 12 to 20 are registered as single-cycle motion signs with their help overlays, but are deliberately marked as training required. Their movement paths and start and end pose constraints must be captured and validated before recognition is activated. Number 20 is registered as a two-hand motion sign.

Static and temporal evidence are kept separate. The existing calibration selector therefore lists static one-hand signs only. The next database milestone is a timestamped motion-clip schema that stores landmark sequences, phase boundaries, speed variation, and negative motion examples without storing video.
