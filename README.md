# Mission Forge — Spacecraft Mission Engineering Workbench

Mission Forge is an open-source, browser-based **preliminary spacecraft mission analysis and design workbench**. It combines a mission architecture trade study with transparent analytical calculators, a numerical two-body orbit demonstrator, a single-node thermal equilibrium estimator, reliability screening, fault-tree logic, FMEA prioritization, fault-injection walkthroughs, and optional multi-user collaboration.

> **Engineering and safety boundary:** Mission Forge is not flight-qualified, not a certified spacecraft design tool, and not a substitute for a professional mission-analysis toolchain or independent engineering review. It must not be used as the sole basis for a real mission, safety, procurement, launch, or flight decision. Several models are intentionally idealized. Every result is conditional on the entered assumptions and omitted physics listed below.

## What the application does

### 1. Mission architecture trade study

- Configure science objective, destination, orbit/operating location, launcher class, power subsystem, communications subsystem, radiation mitigation option, and payload instruments.
- Track the legacy trade-study estimates for cost, mass, power, data, science score, and mission constraints.
- Save a configuration locally, share a static design snapshot, compare against a baseline, and export a JSON engineering package.

**Data quality note:** Legacy cost, launcher capacity, science score, radiation index, and selected subsystem catalog values are illustrative project assumptions. They are not vendor quotes, certified component data, or mission-validated performance values.

### 2. Analytical engineering calculators

| Module | Implemented model | Outputs | Not included |
|---|---|---|---|
| Hohmann transfer | Two-body, coplanar, circular orbit transfer about a selected central-body parameter | Ideal two-impulse Δv, transfer semi-major axis, transfer time | Planetary departure/arrival, launch windows, inclination changes, patched conics, n-body effects |
| Propulsion | Ideal Tsiolkovsky rocket equation | Ideal Δv, ideal propellant requirement and margin | Gravity/steering losses, finite burns, tankage, residuals, pressurization, staging and feed-system design |
| Solar array | Inverse-square solar flux, projected-area cosine, efficiency, derating and exponential degradation | Incident flux and array output | Full attitude timeline, cell temperature, detailed shadow geometry, array string design and battery electrochemistry |
| RF downlink | Friis free-space path loss, ideal parabolic ground-dish gain, thermal noise density and Eb/N₀ | EIRP, received power, C/N₀, Eb/N₀ margin, Shannon upper bound | Complete DSN schedule/link budget, coding/modulation implementation, pointing, polarization, atmospheric and operational availability losses |
| Reliability | Constant-rate exponential model and independent identical parallel units | Component and series reliability estimates | Part-specific distributions, common-cause failures, repair logistics, dependence, uncertainty and verified vendor data |

### 3. Numerical orbit visualization

The Advanced Analysis panel contains an **Earth-centred two-body propagator**:

- Cartesian initial state `[x, y, vx, vy]` in SI units.
- Earth point-mass gravitational parameter.
- Classical fixed-step fourth-order Runge–Kutta (RK4) integration.
- Circular-orbit initial conditions generated from selected altitude.
- SVG visualization of the propagated path, Earth reference sphere and final spacecraft state.
- Circular speed, orbital period, sample count and relative specific orbital-energy drift diagnostic.
- Guardrails for invalid states, Earth-intersecting trajectories and excessive sample counts.

Governing equation:

`r_ddot = -mu * r_vector / |r_vector|^3`

**Model boundary:** This is a 2D inertial point-mass demonstration. It does not include Earth J2/higher harmonics, atmospheric drag, third-body gravity, solar-radiation pressure, thrust, eclipse geometry, attitude dynamics, Earth orientation, a defined mission reference frame such as a complete ICRF/J2000 implementation, or ephemerides. Fixed-step RK4 is not an adaptive high-fidelity flight propagator. The energy-drift number is an integration diagnostic, not a bound on total physical trajectory error.

### 4. Thermal engineering screening

A single-node steady-state energy balance estimates equilibrium temperature from:

- absorbed direct solar power;
- internal dissipated heat;
- radiating area, infrared emissivity and a deep-space view-factor input;
- Stefan–Boltzmann radiation.

`T_eq = ((alpha * S0 / d_AU^2 * A_projected + Q_internal) / (epsilon * sigma * A_radiating * F_space))^(1/4)`

The UI displays Kelvin and Celsius and lists assumptions. It omits Earth/Moon albedo, planetary infrared, multi-node conduction, thermal capacitance, transient eclipse response, heaters/thermostats, temperature-dependent properties, geometry/view-factor networks and detailed surface optical-property data. It is a first-pass screening calculation, not a thermal design or qualification model.

### 5. Reliability, fault tree, FMEA and FDIR screening

- Editable MTBF assumptions and parallel-unit counts for selected critical subsystems.
- Series reliability estimate under the stated independent exponential model.
- A simplified FDIR-adjusted estimate kept separate from baseline reliability.
- FMEA-style detection, isolation and recovery prompts.
- Deterministic single-primary-fault walkthrough for selected subsystems.
- A simple independent-event fault tree with OR/AND gate calculations.
- FMEA screening worksheet using `RPN = Severity × Occurrence × Detectability`, each rated 1–10.

**Important:** FMEA examples and ratings in the UI are starter examples, not a completed mission FMEA. RPN is a prioritization heuristic, not a probability. The fault-tree example assumes independent basic events over the same mission interval. Common-cause failures, dependencies, latent faults, repair, test coverage evidence and hardware/software timing are not represented. FDIR walkthroughs are logic demonstrations, not predictions of flight hardware behavior.

### 6. Team collaboration (optional Supabase configuration)

- Supabase Auth accounts, teams, role-labelled invitations and expiring invite tokens.
- Team-scoped database records with Row Level Security.
- Shared design persistence and Realtime updates after a teammate saves.

The current collaboration implementation is a basic shared-document workflow. It does not yet provide conflict-free simultaneous editing, full audit history, presence/typing indicators, or secure per-subsystem authorization. Team roles in the UI must not be treated as a complete security boundary. Review the SQL migration and deployment policies before exposing a deployment publicly.

## Repository layout

```text
mission-forge/
├── index.html
├── package.json
├── .env.example
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── docs/
│   └── ORIGINAL_PROJECT_REVIEW.md
├── src/
│   ├── main.js             # UI, state and visualizations
│   ├── data.js             # mission catalog and legacy assumptions
│   ├── engine.js           # legacy trade-study / scenario engine
│   ├── engineering.js      # Hohmann, rocket, solar, RF, reliability
│   ├── advanced.js         # RK4 orbit, thermal, fault tree, FMEA
│   ├── collaboration.js    # Supabase Auth, database and Realtime
│   └── styles.css
├── supabase/
│   └── migrations/
│       └── 001_mission_collaboration.sql
└── tests/
    ├── engine.test.js
    ├── engineering.test.js
    └── advanced.test.js
```

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm test
npm run dev
```

Open the local URL printed by Vite. To create a production bundle:

```bash
npm run build
npm run preview
```

The Node test suite uses the built-in `node:test` runner. The application build requires Vite and dependencies to be installed successfully.

## Enable Supabase collaboration

1. Create a Supabase project.
2. Run `supabase/migrations/001_mission_collaboration.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Set the project URL and public anon/publishable key.
5. Configure Auth site and redirect URLs for local development and your deployed domain.
6. Restart Vite, create an account, create a team and generate an invitation.
7. Send the invite URL privately to the teammate. The invitee must authenticate with the invited email address.

Never put a Supabase service-role key in browser code or any `VITE_` variable. Only the public anon/publishable key belongs in the browser. Keep RLS enabled and independently review the policies before deployment.

## Verification

Automated tests cover:

- mission-trade constraints and deterministic legacy simulation;
- Hohmann transfer symmetry and a reference Earth-to-Mars-radius case;
- rocket equation behavior;
- solar inverse-square and incidence-angle scaling;
- Friis/Eb/N₀ response to transmitter power;
- reliability behavior under the independent parallel-redundancy assumption;
- FDIR walkthrough behavior;
- 400 km circular Earth-orbit speed and period sanity range;
- RK4 two-body specific-energy drift and near-period radius return;
- propagation guardrails;
- thermal steady-state energy closure and solar-distance trend;
- independent fault-tree OR/AND gates;
- FMEA RPN ordering.

A passing unit test means the implementation satisfies the tested mathematical properties and regression cases. It does **not** establish model validation against flight data, numerical convergence over all possible inputs, operational suitability, or software certification.

## Scientific references and model provenance

The equations and model boundaries are documented so that engineers can audit assumptions and improve the implementation. Useful primary references include:

- NASA, *Passive Thermal Control Engineering Guidebook*, Revision 5.1 (2024): [NASA NTRS PDF](https://ntrs.nasa.gov/api/citations/20220006584/downloads/NASAPassiveThermalGuidebookv5%201Public.pdf). Includes two-body orbit fundamentals and spacecraft thermal-environment considerations.
- NASA, *Thermal Control Engineering Guidebook*: [NASA NTRS PDF](https://ntrs.nasa.gov/api/citations/20230013900/downloads/NASA%20Thermal%20Control%20Engineering%20Guidebook%20v4.pdf?attachment=true).
- NASA, *High-Speed Solution of Spacecraft Trajectory Problems Using Taylor Series Integration*: [NASA NTRS record](https://ntrs.nasa.gov/citations/20110016047). Describes high-fidelity propagation force models and higher-order variable-step integration approaches beyond this app's two-body RK4 demonstrator.
- NASA, *Guidelines for Thermal Analysis of Spacecraft Hardware*: [NASA KSC PDF](https://extapps.ksc.nasa.gov/reliability/Documents/Preferred_Practices/2302.pdf). Describes multi-node thermal balance terms and analysis considerations.

These references inform the equations and limitations; they do not validate Mission Forge itself.

## Roadmap before any real mission engineering use

1. Validated ephemeris/time-scale and reference-frame handling.
2. Adaptive high-order numerical propagation with convergence studies and J2, third-body, drag and SRP force models.
3. Lambert targeting, patched-conic departure/arrival, launch-window search and independent reference-case validation.
4. Multi-node transient thermal network with orbit-dependent solar/albedo/planetary-IR fluxes and material-property sources.
5. Battery state-of-charge, eclipse timeline, degradation and thermal coupling.
6. Complete communications link budget with modulation/coding, station-specific antenna data, pointing and availability.
7. Radiation environment and dose/shielding transport using traceable models and datasets.
8. Mission-specific FMEA/FMECA, fault trees with common-cause/dependency analysis, verified component data and test evidence.
9. Server-enforced subsystem authorization, audit trail, concurrent-edit conflict handling and presence.
10. Independent verification, validation, code review, numerical convergence tests and documented engineering sign-off.

## License

MIT. See [LICENSE](LICENSE).
