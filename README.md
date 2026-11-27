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

Number and letter rows share typography, separators, colours and status circles. Their left column remains an ordinal (01-20 or 01-26); pending letter recognition is explained at library level rather than with a different row design. Library tab fills use 20% alpha, including the highlighted dwell region, without stacking opaque backgrounds. Dwell progress uses a cubic ease-in-out for presentation only; selection requires 500 ms of observed interaction, with progress preserved through short interruptions. Reduced-motion users receive linear feedback. No extra animation dependency is required.

The top-left NUMBERS, LETTERS and WORDS buttons switch the right-side library. Hold the visible index-finger I label over a button to accumulate 500 ms of interaction, or click/use keyboard activation. Hover, keyboard focus and finger dwell use prominent outlines and glow without increasing the 20% background opacity. A completed selection flashes green for 250 ms, then retains green text and borders as the active state. The fill shows eased dwell progress. Initial entry must begin inside the visible button and remain deliberate for at least 100 ms before its visible interaction state is claimed. The entire button plus a retained halo of up to 24 px is valid, capped before adjacent buttons. Moving within it never resets progress. Leaving that region, a briefly folded/hidden index, poor lighting or changed hand identity pauses the same overlay for up to 500 ms instead of discarding it. Returning preserves accumulated progress, with at least 100 ms of confirmed return before completion; an absent pointer never triggers selection. A 500 ms absence discards the candidate. Unobserved frame gaps are not charged as dwell. Mouse-hover changes and manual click/keyboard selection also use the 100 ms intent threshold. Only current hand detections are eligible, never the retained skeleton. A completed hold clears the list immediately and repopulates it 100 ms later. Numbers show 1-20; Letters show A-Z as untrained entries. WORDS contains all 108 user-supplied placeholders in 12 labelled groups, numbered 01-108, defined in `src/core/word-library.ts`. The supplied list totals 108 rather than 100; toilet appears only once and outside is used under Places. Words and letters do not perform recognition yet. The dwell logic lives in `src/core/library-navigation.ts`.

Selector gaps are 58 px (50 px wider than the previous desktop gap); buttons wrap on narrow panes. After success, the reusable `src/components/point-gesture-reset.ts` locks the source group and marked control groups within 64 px for 500 ms. A single black mask covers them at 50% opacity for 150 ms, then fades away over 350 ms, while pointer, keyboard and gesture activation remain blocked. Current nearby marked groups include Diagnostics and the chain header. The successful finger hover stays latched so it cannot auto-repeat until it leaves its retained region for 500 ms. Future point-control groups use `data-point-gesture-group`, check `isBlocked`, and call `begin` after successful selection. Reduced-motion mode keeps the mask steady until unlock.

- `src/core/hand-metrics.ts` converts MediaPipe landmarks into scale-relative finger evidence.
- `src/core/sign-bank.ts` contains versioned, seeded definitions.
- `src/core/sign-engine.ts` scores signs and builds evidence-weighted profiles.
- `src/core/motion-engine.ts` extracts timestamped palm movement and pinch measurements.
- `src/core/target-motion.ts` runs one configured pinch or wave detector, never competing number candidates.
- `src/core/target-practice.ts` owns preparation, performance time, pauses and completion, using sign IDs rather than number arithmetic.
- `src/core/practice-library.ts` lists number targets and explicit pending A-Z slots. No missing letter is guessed from number rules.
- `src/core/hand-position.ts` classifies palm or back facing and snaps the displayed hand axis to four cardinal angles.
- `src/core/chain-game.ts` contains the replaceable five-number checkpoint game rules.
- `src/core/training-store.ts` persists examples and learned profiles in IndexedDB.
- `src/main.js` currently owns browser interaction and will be migrated to typed interface modules incrementally.

Training data remains local to the browser until cloud synchronization is deliberately introduced. Exported JSON is the portable backup and review format.

The evidence policy stores normalized hand landmarks and derived measurements only. Raw webcam video, audio, and still images are not retained.

Guided training is the primary evidence workflow. Choose a number and complete five prompted correct variations followed by three sign-specific incorrect examples. Advanced manual calibration remains available for unusual failures found during later testing.

Training derives a learned finger-state pattern as well as continuous geometry ranges. Once five correct and three incorrect clips have established a profile, that local evidence overrides a conflicting provisional seed automatically. The Diagnostics report shows the learned state and confidence for every finger.

Established profiles retain the seeded definition as a fallback for valid natural variations outside narrow learned ranges, while trained negative evidence can still veto known false matches. Diagnostics also shows live selected-sign, top-candidate, threshold, and margin scores.

Palm-axis orientation is measured from the wrist and knuckle line. Numbers 1 to 5 require an upright hand. Number 9 uses the same angle-independent base checks and score threshold as 8, with the ring finger extended: thumb, index, middle and ring extended, pinky folded. Saved Number 9 profiles with a different digit pattern remain stored but are ignored during recognition; compatible new calibration can still fine-tune the geometry.

The current number library contains help overlays for 1 to 20. Numbers 1 to 9 can be trained as one-hand static signs. Number 10 currently uses a provisional two-open-hand rule and is not included in calibration until the evidence format supports paired hands.

Practice evaluates only the next target in the right-column sequence, including 11 to 20 after 10. The obsolete individual-practice dropdown and its alternate recognition path have been removed. Clicking a row still shows help only and never awards progress.

- Number 11 uses one thumb-to-index pinch, beginning open and confirming contact for 80 ms. The thumb is unrestricted and the index may curl during closure. Number 20 is never evaluated alongside it.
- Number 12 requires thumb contact with both index and middle fingertips during the same pinch.
- Numbers 13 to 15 retain the corresponding 3 to 5 finger pose through two horizontal palm movements, not wrist rotation alone.
- Numbers 16 to 19 retain the corresponding 6 to 9 finger pose through two vertical palm movements.
- Number 20 uses two quick thumb-to-index pinches.

Wave direction is independent. Two waves currently mean four alternating travel legs, allowing either starting direction. Horizontal travel uses 0.4 starting-palm widths per leg; vertical travel uses 0.32. Normalization uses a fixed starting scale so zoom/size changes do not invent sideways movement. Every required digit must pass individually. Brief shape noise is tolerated for up to 300 ms, but missing tracking resets the partial movement. Detector duration, cycles, amplitude and dropout limits live in the sign definitions. These are provisional, personal-lab thresholds, not validated language-wide rules. Existing 16-20 movement definitions are retained pending live review.

The gentle policy has unlimited preparation, with the correct starting shape stable for 180 ms before the attempt begins. Static targets then get a 2-second window and require a continuous 500 ms steady hold. Motion targets get 4 seconds. Non-target poses cause no immediate penalty and can be corrected within the window. Camera/lighting loss, manual capture and long inference gaps pause time, discard partial movements and require re-preparation on recovery. The remaining budget is preserved. Each sign can override the common policy through its optional practice parameters; no checkpoint speed bonus is needed with unlimited preparation.

At checkpoints 5, 10, and 15, two simultaneous thumbs-up poses enter Learning Mode. Its label occupies a fixed strip across the top. The prompted sign remains visible until the hand approaches the expected pose, then the ordinary success flash confirms recognition. Learning uses the same prepare-then-perform timing but retries the same target without a chain penalty on timeout. After five correct prompts, play returns to the secured checkpoint. The two-thumbs-up control is the sole intentional non-target gesture during the number sequence.

Recognition feedback and gamification are separate: the target controller submits only a completed requested sign. There is no fallback to the whole sign bank. The default sequence progresses through 1 to 5, 6 to 10, 11 to 15, and 16 to 20. Completing each block secures that checkpoint.

Only an expired active attempt resets the current block to its secured checkpoint. Signing a different number neither triggers feedback nor breaks progress early. Alternative game policies remain separate in `src/core/chain-game.ts`.

The reusable `src/components/chain-score.ts` component is mounted once at the very top of the right column, outside the replaceable list. Every library keeps the same chain score and red reset control. `src/core/library-games.ts` holds game objects by library ID. Its default reset-on-switch policy clears ALL game progress, checkpoints and completed items when changing category, without deleting stored training evidence or repeating camera calibration. Selecting the already-active tab does not count as a category change. This policy can be configured later. The red reset clears the selected library's progress and active attempt/feedback. Letters and words remain untrained and show 00. Library footer messages are full white and remain visible on narrow screens.

Camera sessions begin with framing calibration instead of a Number 1 sign gate. Place your head in the centre target and one hand in each side target, then hold the complete arrangement for 1.5 seconds. Live guidance requests moving back, forward, or adjusting head/hand position. Calibration requires a working face tracker and adequate lighting; no sign recognition, game rewards or training capture can run before it completes. Completion leaves the score at zero and the first game number still unearned. No chest or waist tracking is performed. The approximate head outline uses facial landmarks and eye separation, stays axis-aligned, and redraws every 500 ms with a 20%-opacity green border, including after calibration. Lost head tracking removes the outline on the next update.

Lighting checks sample original camera pixels every 250 ms, independently of the display's opacity, using detected face/hand regions or a central fallback region. A mean luminance below 35/255 blocks calibration, resets the hold and shows LIGHTING TOO LOW. Dark captures are cancelled without saving their unfinished samples; game recognition and its countdown pause until lighting returns. This adjustable heuristic is not a calibrated light meter. Images and face landmarks are processed in memory only, not saved or uploaded. Thresholds, target boxes and timing live in `src/core/camera-calibration.ts`.

After initialization, hand-position indicators update at a fixed 500 millisecond interval. Each detected hand is classified independently as front, back, or unknown using MediaPipe handedness and palm landmark winding. Direction uses a palm coordinate frame built from the wrist, the centre of all four knuckles, and the perpendicular of the index-to-pinky knuckle line. Those two directional signals are combined and snapped to `-90°`, `0°`, `90°`, or `180°`. The supplied front and back hand icons flick immediately to the new angle with no transition animation. An edge-on, unclassified, or low-confidence palm frame is reported as unknown instead of being assigned an unreliable icon.

After calibration, framing is checked every three seconds with alerts lasting two seconds. MOVE BACK takes priority when either hand enters the outer 20% of the visible camera area, when its width or height exceeds 50% of that area, or when its palm span exceeds 24%. The wrist, knuckles and fingertips are checked after the same cover-crop transform used by the display, excluding the number rail. MOVE CLOSER is reserved for palms below 6%, allowing more upper-body space. These adjustable thresholds live in `src/core/spatial-safety.ts`. A face landmark model samples eye positions at 10 Hz and excludes hand candidates whose palm centre overlaps the eye-derived face region. If the face model is unavailable, the startup calibration cannot complete and requests a reload.

The tracking overlay also renders the continuous signed palm angle beneath the white wrist landmark. Upright is `0°`, matching the Number 1 reference position. Tilting toward either side produces a negative or positive reading, mirrored to match the displayed webcam image.

Static recognition uses a staged spatial gate before finger scoring. The exact number of visible hands first removes all incompatible signs. Known orientation requirements then remove incompatible rotations. Finger state and continuous finger geometry are scored only for the remaining candidates. Dynamic motion rules remain the final stage. Facing is measured now but is not yet a hard sign gate until positive and negative facing evidence has been collected for each sign.

Static and temporal evidence are kept separate. The existing calibration selector therefore lists static one-hand signs only. The next database milestone is a timestamped motion-clip schema that stores landmark sequences, phase boundaries, speed variation, and negative motion examples without storing video.

A-Z are listed as unavailable, not implemented recognizers. Activating letters requires reviewed diagrams and per-letter shape, two-hand relationship, contact and movement detectors as applicable. The practice controller is reusable for those detectors, but the current symmetric two-hand number-10 scorer is not an adequate general letter classifier. Current automated tests verify synthetic geometry and timing, not real-world recognition accuracy. Review Numbers 11, 12 and 13 as the sequence reaches them, and record live failures before tuning thresholds or claiming letter coverage.
