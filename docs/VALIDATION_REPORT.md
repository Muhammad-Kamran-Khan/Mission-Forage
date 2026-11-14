# Mission Forge 2.1.0 — Local Verification Record

## Verification performed in the development container

- `node --check src/main.js` — passed.
- `node --check src/advanced.js` — passed.
- `npm test` — **22 tests passed, 0 failed**.
- The suite includes regression tests for the existing mission and analytical modules plus seven new advanced-model tests.

## New model test coverage

1. 400 km circular Earth orbit speed and period fall within reference sanity ranges.
2. RK4 two-body integration maintains specific orbital energy within the tested tolerance for a one-period 400 km circular orbit with a 10 s step.
3. Propagation rejects excessive sample counts and an initial state inside the central body.
4. Single-node thermal equilibrium closes the steady-state energy balance numerically.
5. Thermal equilibrium temperature decreases when solar distance increases, for the tested inputs.
6. Independent OR and AND fault-tree gate probabilities match their analytical expressions.
7. FMEA RPN calculation and priority ordering behave as specified.

## Verification not completed

`npm install --no-audit --no-fund` did not complete before the execution environment timed out. Consequently `vite build`, browser-level interaction tests, and a deployed Supabase end-to-end test were **not verified** in this environment. The source syntax and Node test suite pass, but this is not evidence of a successful production build or full browser runtime.

## Scientific validation status

The tests validate selected mathematical properties and software behavior. They do not constitute independent scientific validation, comparison against flight telemetry, numerical convergence qualification across the full input space, or flight-software certification. See the root README for the complete assumptions and omitted force/thermal/reliability models.
