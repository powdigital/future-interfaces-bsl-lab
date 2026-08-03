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
