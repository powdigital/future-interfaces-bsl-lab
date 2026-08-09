# Project decisions

This log records choices that should remain visible as the BSL Lab grows.

## 2026-08-03: Personal research lab first

The initial product is a local personal research lab with one primary researcher. It will perfect numbers and individual letters before introducing shared contributors or a hosted database.

The primary researcher normally signs one-handed gestures with the right hand. New personal examples therefore record right-handed provenance by default. Handedness remains a per-example field so deliberate left-handed recordings can be added later.

Consequences:

- camera inference remains local;
- IndexedDB is the working evidence store;
- JSON export is the portable backup and review format;
- every new example includes researcher, session, application version, and handedness provenance;
- unknown information remains explicitly unknown rather than inferred;
- the schema keeps identity fields so multi-contributor work can be introduced later.

## Evidence principles

- Foundation rules and learned profiles are separate.
- Calibration adds evidence instead of silently rewriting stable rules.
- Correct and incorrect examples are both required.
- Rules remain provisional until supported by multiple clips.
- Established describes evidence quantity, not scientific validation.
- A shared rule should eventually be tested on held-out examples and additional signers.
- Failed recognition is treated as useful evidence and should be capturable from the interface.

## 2026-08-03: Landmarks and measurements only

The personal lab stores MediaPipe's 21 normalized hand landmarks and the derived finger measurements for each calibration frame. It does not retain webcam video, audio, or still images.

Consequences:

- examples remain small enough for local storage and JSON export;
- future feature extractors can be rerun against the saved landmarks;
- the dataset cannot reconstruct the original camera image;
- recognition remains local and does not transmit webcam media;
- raw video can only be introduced through a future explicit policy decision and schema version.

## Development principles

- Preserve working milestones before structural changes.
- Keep recognition logic independent from the interface.
- Add automated tests for each accepted sign and known confusion.
- Version database exports and accept older formats through explicit migrations.
- Avoid introducing cloud services until synchronization, collaboration, or review requires them.

## 2026-08-03: Guided training is primary

Each number begins with an eight-step guided session containing five correct variations and three sign-specific incorrect examples. Correct variations cover natural distance and modest wrist rotation. Incorrect examples target neighboring numbers and known ambiguous hand poses.

Manual positive and negative capture remains available as an advanced tool for failures discovered outside the guided session.

The primary calibration panel also exposes **Capture false match**. When an incorrect pose is recognized as the selected sign, the researcher can hold that pose and add it directly to the negative evidence set.

## 2026-08-04: Five-number game checkpoints

The first number game uses two replaceable five-number stages: 1 to 5 and 6 to 10. Correct numbers must be recognized in order. Completing a stage flashes its five rows and shows a reward over the number rail.

A confidently recognized wrong number breaks only the current five-number stage. A mistake during 1 to 5 resets progress to zero. A mistake during 6 to 10 returns progress to checkpoint 5. The rules live in `src/core/chain-game.ts`, independently from recognition and interface animation, so a later difficulty mode can replace them.

Numbers 6 to 9 begin as provisional one-hand patterns and are available to the existing evidence workflow. Number 10 is provisionally recognized from two open hands. Two-hand calibration needs its own evidence schema before it is added to guided training.

## 2026-08-04: Established training overrides provisional seeds

Each learned profile now derives both continuous geometry rules and a five-digit state pattern from its correct examples. The calibration report displays the resulting state and confidence for every digit.

A provisional profile continues to blend learned evidence with the seeded definition. After five correct clips and three incorrect clips, the profile becomes established and learned evidence becomes authoritative for that researcher. This lets training correct a mistaken seed automatically while preventing a single accidental recording from replacing the rule.

Number 9 provided the first correction. The recorded pattern is an ambiguous thumb with strongly negative reach and four extended fingers. Number 4 is its most important negative neighbor because its four fingers are also extended but its thumb occupies a different range.

Established profiles use a guarded decision rule. Positive evidence can override an incorrect provisional seed, and negative evidence can veto a known false match. When learned ranges are simply uncertain about a natural variation, the valid seed remains available as a fallback instead of being blocked.

Diagnostics displays the selected sign score, required threshold, current top candidate, and recognition margin live. This makes recognition failures inspectable during local training without exporting screenshots.

## 2026-08-05: Palm orientation is a foundation feature

Finger states do not uniquely identify a sign. The system now measures palm-axis roll from the wrist to the middle-finger base. Zero degrees represents an upright hand and 90 degrees represents a horizontal hand.

Numbers 1 to 5 require an upright palm axis within a broad provisional range of 0 to 35 degrees. Number 9 requires a horizontal palm axis from 55 to 125 degrees. Orientation acts as a major score gate, so matching finger geometry cannot compensate for a clearly incorrect orientation.

Orientation is derived from the landmarks already stored with every recording. It therefore becomes a learned continuous feature when profiles are rebuilt, without storing any additional camera media or requiring a database migration.

## 2026-08-05: Dynamic numbers use one complete motion cycle

Numbers 11 to 20 are temporal signs. They must not be reduced to a static frame or triggered by an intermediate pose. Every definition represents one complete movement with a start phase, one motion cycle, and a settled completion phase.

Number 11 is the first active motion recognizer. It requires an open thumb and index followed by one close into the pinch. Recognition happens at closure. The release resets the detector for a later attempt but is not part of the recognized motion. The detector uses thumb-to-index distance normalized by palm width, a bounded duration, a whole-hand drift limit, and a cooldown that prevents one movement from being counted twice.

Numbers 12 to 20 are present in the sign bank and help rail but remain marked as training required. Their detector families are registered as horizontal, vertical, pinch, or two-hand movement. They will only become active after each sign has positive speed and distance variations, incomplete-motion negatives, repeated-motion negatives, neighboring-sign negatives, and held-out validation.

Static pose profiles and temporal motion profiles remain separate evidence types. Existing static training must not silently create a motion rule. A later motion database schema will store timestamped landmark sequences and phase boundaries while preserving the no-video policy.

## 2026-08-05: Recognition feedback does not depend on game order

The recognizer and the game are separate concerns. A valid recognition must always display its sign response even when it is not the next number in an optional sequence.

Recognition and game progress remain independent. The default interface now uses checkpointed block mode. Numbers progress in order through 1 to 5 and then 6 to 10. A forward recognition is displayed without changing progress. A backward recognition resets only the current block to its previous checkpoint.

Completing a block changes recognition priority. After 1 to 5 are complete, those signs are excluded from active static matching while 6 to 10 are in focus. This prevents visually similar completed signs, particularly Number 4, from competing with Number 9. Strict ordered and free-practice behaviors remain isolated configurations for later difficulty controls.
