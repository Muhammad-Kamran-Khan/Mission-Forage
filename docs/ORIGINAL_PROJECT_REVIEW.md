# Review of the submitted `space-mission-design-game.zip`

## Executive assessment

The submitted project is a promising prototype. It has a clear game loop, an understandable dashboard, a visual component picker, three mission objectives, a local leaderboard, difficulty budgets and a role-based crew interface. It is more feature-rich than a bare first prototype.

However, its mission-readiness gate does not enforce all the requirements that are checked later in the flight report. This is the most important correctness problem: the Launch button can become available even when the selected orbit is incompatible with the objective, the mission is too short, or the downlink cannot return the generated data. That makes the central promise of a mission-design game less trustworthy.

The submitted version is best described as a **feature-rich prototype with a simplified and partly inconsistent validation model**, not yet a robust mission-design learning tool.

## What the submitted version already did well

- No framework or backend was needed to open the original page.
- The UI presented mass, cost, power, data and science in one dashboard.
- Players could select instruments and see their combined subsystem demands.
- Difficulty budgets, four named team roles, approvals and a local top-five leaderboard gave the game a useful structure.
- Flight events attempted to connect design margins to mission outcomes.
- The README identified some model values as simplified teaching values.

## Findings and why they matter

| Area | Submitted implementation | Problem / risk | Mission Forge 2.0 response |
|---|---|---|---|
| Launch readiness | `hardOk` checked only budget, mass and power. | Orbit mismatch, lifetime and data-return failures could still be launched. | Seven explicit pre-flight checks gate simulation. Science target is reported separately as mission outcome. |
| Orbit/objective validation | Checked in `fly()` after launch. | The player receives a failed mission only after being allowed to launch an incompatible design. | Compatibility is visible in the live readiness panel before simulation. |
| Solar power | `P.w * o.sun`, with hand-entered orbit multipliers. | No general distance law; outer solar-system missions are not represented. | Solar generation uses `rated_output / heliocentric_distance²`, with the assumption explained in the UI and README. |
| Communications | Fixed orbit multiplier such as `link: 0.08`. | Distance behavior is opaque and cannot be generalized to new destinations. | Uses an explicitly labelled inverse-square distance proxy and contact availability factor. It is not represented as a real link budget. |
| Launch capacity | `launcher.leo * orbit.k`. | Destination and transfer demands are not modeled separately; no delta-v or trajectory calculation exists. | Separates destination transfer and orbit-profile teaching factors, with explicit non-physical caveats. |
| Surface payload | No dedicated lander compatibility constraint. | A surface mission can be configured without a lander package. | Surface missions require the lander; the lander is rejected for orbit-only profiles. |
| Simulation repeatability | Randomly sorts events using `Math.random()`. | Outcomes vary between runs; random comparator sorting is biased and makes comparisons hard to reproduce. | Seeded deterministic event selection: same configuration, same report. |
| Event text | Success state and displayed text use separate random draws. | An event could be marked successful while displaying its failure message, or vice versa. | One random outcome determines both status and message. |
| Team workflow | Roles are switched in the same browser; share link serializes the current state. | This is not synchronized multiplayer or identity-based access control. The README could be read as stronger collaboration than the code provides. | Renamed to Crew Review; README explicitly says local/pass-the-device workflow and snapshot sharing, not live multiplayer. |
| Team role boundaries | UI disables controls based on the selected role. | This is a usability convention, not a security boundary; anyone with the device can switch roles. | Kept as a local educational workflow and documented honestly. |
| Testing | No automated test suite. | Core engineering rules can regress unnoticed. | Added seven Node tests for baseline feasibility, solar scaling, compatibility, lander rules, data return and deterministic simulation. |
| Architecture | Most calculations, state, UI and simulation live in one `app.js`. | Harder to test and extend independently. | Split into `data.js`, `engine.js` and `main.js`, with a dedicated test directory. |
| Documentation | Short setup and feature summary. | Model assumptions, limitations, test coverage and demo narrative were not sufficiently detailed. | Replaced with a full README covering architecture, equations, limitations, demo walkthrough, validation and references. |

## Important source-level observations

1. In the original `js/app.js`, `hardOk` was computed from `c.hard`, which contains only budget, mass and power checks. The objective/orbit check is computed separately and only included in the flight report.
2. The original `fly()` function checks orbit compatibility, lifetime and science after the Launch action has already been enabled. Data-return ratio affects science potential, but it is not itself a hard pre-flight requirement.
3. The original `js/data.js` uses hand-authored solar and link multipliers per orbit. These are acceptable as game knobs, but the README did not explain their physical basis or distinguish them from engineering-grade models.
4. The original event list is shuffled with `.sort(() => Math.random() - .5)`. Random comparators do not provide a sound shuffle, and the event outcome and event description are selected using independent random values.
5. The original share link contains a snapshot of the design. It does not synchronize separate users, provide a server-side room, or authenticate role permissions.

## Scope of the 2.0 redesign

The redesign focuses on making the game **more consistent, explainable, testable and honest about fidelity**. It does not claim to replace mission-analysis tools or calculate a flight-ready spacecraft. The physics-inspired relationships are limited to concepts that can be explained at this educational level; all game-balance values remain labelled assumptions.
