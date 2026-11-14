/**
 * Transparent preliminary engineering models.
 * These are analytical estimates, not flight-qualified design tools.
 */
export const PHYSICS = Object.freeze({
  AU_M: 149_597_870_700,
  AU_KM: 149_597_870.7,
  SOLAR_IRRADIANCE_W_M2: 1361,
  BOLTZMANN: 1.380649e-23,
  C_M_S: 299_792_458,
  MU_SUN_M3_S2: 1.32712440018e20,
  MU_EARTH_M3_S2: 3.986004418e14,
  MU_MOON_M3_S2: 4.9048695e12,
  G0_M_S2: 9.80665
});

const DESTINATION_AU = { earth: 1.0, moon: 1.0, mars: 1.523679, jupiter: 5.2044 };
const DESTINATION_RANGE_KM = { earth: 2_000_000, moon: 384_400, mars: 225_000_000, jupiter: 778_000_000 };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finitePositive = (x, name) => {
  if (!Number.isFinite(x) || x <= 0) throw new RangeError(`${name} must be a finite positive number`);
  return x;
};
const log10 = x => Math.log(x) / Math.LN10;

export function defaultEngineeringInputs(destination = 'mars') {
  return {
    transfer: { departureAU: 1, arrivalAU: DESTINATION_AU[destination] ?? 1.523679, destination, propulsiveDeltaVKmS: 3.6, ispS: 320, dryMassKg: 500, propellantMassKg: 1000 },
    power: { arrayAreaM2: 4, cellEfficiency: 0.30, systemDerating: 0.77, incidenceDeg: 0, degradationPerYear: 0.02, missionYears: 2, eclipseFraction: 0.35, loadW: 180, batteryDoD: 0.30, batteryEfficiency: 0.90, eclipseHours: 0.7 },
    comms: { rangeKm: DESTINATION_RANGE_KM[destination] ?? 225_000_000, txPowerW: 20, frequencyGHz: 8.4, txGainDbi: 25, groundDishM: 34, groundEfficiency: 0.65, groundNoiseTempK: 25, miscLossDb: 3, bandwidthHz: 1_000_000, dataRateBps: 100_000, requiredEbN0Db: 3 },
    reliability: { missionHours: 17_520, mtbfHours: { power: 50_000, computer: 40_000, transmitter: 35_000, attitude: 30_000 }, redundancy: { power: 2, computer: 2, transmitter: 1, attitude: 2 }, detectionCoverage: 0.9, recoveryCoverage: 0.85 }
  };
}

/** Two-impulse, coplanar, circular-orbit Hohmann transfer around one central body. */
export function hohmannTransfer({ mu, r1, r2 }) {
  finitePositive(mu, 'mu'); finitePositive(r1, 'r1'); finitePositive(r2, 'r2');
  if (Math.abs(r1 - r2) < 1e-9) return { deltaV1: 0, deltaV2: 0, totalDeltaV: 0, transferTimeS: 0, transferSemiMajorAxis: r1, circularVelocity1: Math.sqrt(mu / r1), circularVelocity2: Math.sqrt(mu / r2) };
  const a = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
  const vt1 = Math.sqrt(mu * (2 / r1 - 1 / a));
  const vt2 = Math.sqrt(mu * (2 / r2 - 1 / a));
  const dv1 = Math.abs(vt1 - v1), dv2 = Math.abs(v2 - vt2);
  return { deltaV1: dv1, deltaV2: dv2, totalDeltaV: dv1 + dv2, transferTimeS: Math.PI * Math.sqrt(a ** 3 / mu), transferSemiMajorAxis: a, circularVelocity1: v1, circularVelocity2: v2 };
}

/** Ideal rocket equation. Structural mass, residuals, gravity and steering losses are not inferred. */
export function rocketEquation({ deltaVKmS, ispS, dryMassKg, propellantMassKg }) {
  for (const [v, n] of [[deltaVKmS, 'deltaVKmS'], [ispS, 'ispS'], [dryMassKg, 'dryMassKg'], [propellantMassKg, 'propellantMassKg']]) finitePositive(v, n);
  const ve = ispS * PHYSICS.G0_M_S2;
  const massRatio = (dryMassKg + propellantMassKg) / dryMassKg;
  const idealDeltaVKmS = ve * Math.log(massRatio) / 1000;
  const requiredMassRatio = Math.exp(deltaVKmS * 1000 / ve);
  const requiredPropellantKg = dryMassKg * (requiredMassRatio - 1);
  return { idealDeltaVKmS, requiredPropellantKg, propellantMarginKg: propellantMassKg - requiredPropellantKg, feasibleIdeal: idealDeltaVKmS >= deltaVKmS };
}

/** Solar array output with distance, incidence, system derating and exponential degradation. */
export function solarArrayPower({ distanceAU, areaM2, efficiency, derating, incidenceDeg = 0, degradationPerYear = 0, years = 0 }) {
  finitePositive(distanceAU, 'distanceAU'); finitePositive(areaM2, 'areaM2');
  if (efficiency < 0 || efficiency > 1 || derating < 0 || derating > 1 || degradationPerYear < 0 || degradationPerYear >= 1) throw new RangeError('Efficiency, derating and degradation must be within physical bounds');
  const cosine = Math.max(0, Math.cos(incidenceDeg * Math.PI / 180));
  const flux = PHYSICS.SOLAR_IRRADIANCE_W_M2 / distanceAU ** 2;
  const degradationFactor = (1 - degradationPerYear) ** years;
  return { solarFluxWm2: flux, outputW: flux * areaM2 * efficiency * derating * cosine * degradationFactor, cosineIncidenceFactor: cosine, degradationFactor };
}

/** Friis free-space downlink budget + Eb/N0. Positive margin is not a complete link qualification. */
export function downlinkBudget(x) {
  const rangeM = finitePositive(x.rangeKm, 'rangeKm') * 1000;
  const frequencyHz = finitePositive(x.frequencyGHz, 'frequencyGHz') * 1e9;
  const txPowerW = finitePositive(x.txPowerW, 'txPowerW');
  const dishM = finitePositive(x.groundDishM, 'groundDishM');
  const efficiency = x.groundEfficiency;
  if (!(efficiency > 0 && efficiency <= 1)) throw new RangeError('groundEfficiency must be in (0, 1]');
  const wavelength = PHYSICS.C_M_S / frequencyHz;
  const groundGainLinear = efficiency * (Math.PI * dishM / wavelength) ** 2;
  const groundGainDbi = 10 * log10(groundGainLinear);
  const fsplDb = 20 * log10(4 * Math.PI * rangeM / wavelength);
  const eirpDbw = 10 * log10(txPowerW) + x.txGainDbi;
  const receivedDbw = eirpDbw + groundGainDbi - fsplDb - x.miscLossDb;
  const noiseDensityDbwHz = 10 * log10(PHYSICS.BOLTZMANN * finitePositive(x.groundNoiseTempK, 'groundNoiseTempK'));
  const cn0DbHz = receivedDbw - noiseDensityDbwHz;
  const dataRateBps = finitePositive(x.dataRateBps, 'dataRateBps');
  const ebn0Db = cn0DbHz - 10 * log10(dataRateBps);
  const marginDb = ebn0Db - x.requiredEbN0Db;
  const bandwidthHz = finitePositive(x.bandwidthHz, 'bandwidthHz');
  const snrLinear = 10 ** ((cn0DbHz - 10 * log10(bandwidthHz)) / 10);
  const shannonCapacityBps = bandwidthHz * Math.log2(1 + snrLinear);
  return { wavelengthM: wavelength, groundGainDbi, fsplDb, eirpDbw, receivedDbw, cn0DbHz, ebn0Db, marginDb, shannonCapacityBps, passesEbN0: marginDb >= 0 };
}

/** Independent exponential failure model; parallel redundancy assumes independent identical units. */
export function reliabilityAnalysis({ missionHours, mtbfHours, redundancy, detectionCoverage, recoveryCoverage }) {
  finitePositive(missionHours, 'missionHours');
  const components = Object.entries(mtbfHours).map(([name, mtbf]) => {
    finitePositive(mtbf, `${name} MTBF`);
    const n = Math.max(1, Math.floor(redundancy[name] ?? 1));
    const singleReliability = Math.exp(-missionHours / mtbf);
    const functionReliability = 1 - (1 - singleReliability) ** n;
    const residualFailureProbability = 1 - functionReliability;
    const fdirCoverage = clamp(detectionCoverage, 0, 1) * clamp(recoveryCoverage, 0, 1);
    const mitigatedFailureProbability = residualFailureProbability * (1 - fdirCoverage);
    return { name, mtbfHours: mtbf, redundancy: n, singleReliability, functionReliability, residualFailureProbability, mitigatedFailureProbability, fdirCoverage };
  });
  const seriesReliability = components.reduce((r, c) => r * c.functionReliability, 1);
  const seriesWithFdirEstimate = components.reduce((r, c) => r * (1 - c.mitigatedFailureProbability), 1);
  return { components, seriesReliability, seriesWithFdirEstimate, assumptions: ['Constant exponential failure rate', 'Statistically independent redundant units', 'No common-cause failures', 'No repair unless represented by the simplified FDIR coverage factor', 'Component MTBF values are user assumptions, not certified part data'] };
}

export function faultReview(reliability) {
  const labels = { power: 'Electrical power', computer: 'Command and data handling', transmitter: 'Downlink transmitter', attitude: 'Attitude determination and control' };
  const mitigations = {
    power: ['Detect undervoltage and bus anomalies', 'Isolate failed power channel; switch to independent string if available', 'Enter power-safe mode and shed non-essential loads'],
    computer: ['Use watchdog, memory checks and heartbeat monitoring', 'Isolate failed processor lane', 'Reset or switch to a verified redundant computer; preserve safe mode'],
    transmitter: ['Detect missing carrier / RF output and telemetry timeout', 'Isolate failed RF chain', 'Switch to redundant transmitter or low-rate safe-mode beacon'],
    attitude: ['Cross-check sensors and monitor attitude error', 'Isolate suspect sensor/actuator channel', 'Use alternate sensor/actuator set and enter safe attitude']
  };
  return reliability.components.map(c => ({ subsystem: labels[c.name] ?? c.name, redundancy: c.redundancy, reliability: c.functionReliability, risk: c.residualFailureProbability, severity: c.redundancy === 1 ? 'Single-string exposure' : 'Redundancy modeled', detection: mitigations[c.name]?.[0] ?? 'Define independent fault monitors', isolation: mitigations[c.name]?.[1] ?? 'Define fault-containment boundaries', recovery: mitigations[c.name]?.[2] ?? 'Define safe-state recovery action', recommendation: c.redundancy === 1 ? 'Evaluate an independent redundant path, graceful degradation, or a justified single-string risk acceptance.' : 'Verify independence, common-cause controls, switching logic and end-to-end recovery by test.' }));
}

export function analyzeEngineering(design, inputs = defaultEngineeringInputs(design.destination)) {
  const destinationAU = DESTINATION_AU[design.destination] ?? 1.523679;
  const transfer = hohmannTransfer({ mu: PHYSICS.MU_SUN_M3_S2, r1: inputs.transfer.departureAU * PHYSICS.AU_M, r2: inputs.transfer.arrivalAU * PHYSICS.AU_M });
  const propulsion = rocketEquation({ deltaVKmS: inputs.transfer.propulsiveDeltaVKmS, ispS: inputs.transfer.ispS, dryMassKg: inputs.transfer.dryMassKg, propellantMassKg: inputs.transfer.propellantMassKg });
  const solar = solarArrayPower({ distanceAU: destinationAU, areaM2: inputs.power.arrayAreaM2, efficiency: inputs.power.cellEfficiency, derating: inputs.power.systemDerating, incidenceDeg: inputs.power.incidenceDeg, degradationPerYear: inputs.power.degradationPerYear, years: inputs.power.missionYears });
  if (!(inputs.power.eclipseFraction >= 0 && inputs.power.eclipseFraction < 1)) throw new RangeError('eclipseFraction must be in [0, 1)');
  if (!(inputs.power.batteryDoD > 0 && inputs.power.batteryDoD <= 1 && inputs.power.batteryEfficiency > 0 && inputs.power.batteryEfficiency <= 1)) throw new RangeError('Battery DoD and efficiency must be in (0, 1]');
  const sunlightHours = 24 * (1 - inputs.power.eclipseFraction);
  const batteryRequiredWh = inputs.power.loadW * inputs.power.eclipseHours / (inputs.power.batteryDoD * inputs.power.batteryEfficiency);
  const comms = downlinkBudget(inputs.comms);
  const reliability = reliabilityAnalysis(inputs.reliability);
  const faults = faultReview(reliability);
  const powerMarginW = solar.outputW - inputs.power.loadW;
  const findings = [];
  if (powerMarginW < 0) findings.push({ severity: 'critical', title: 'Insufficient sunlit power', detail: `Array output is ${solar.outputW.toFixed(1)} W against ${inputs.power.loadW.toFixed(1)} W load. Reduce loads or increase array capability.` });
  if (comms.marginDb < 0) findings.push({ severity: 'critical', title: 'Downlink Eb/N0 margin is negative', detail: `Calculated margin is ${comms.marginDb.toFixed(2)} dB. Review range, RF power, antenna gains, losses, receiver temperature and data rate.` });
  if (faults.some(f => f.redundancy === 1)) findings.push({ severity: 'warning', title: 'Single-string subsystem exposure', detail: 'At least one modeled critical subsystem has no parallel redundant unit.' });
  if (inputs.power.eclipseFraction > 0 && batteryRequiredWh > 0) findings.push({ severity: 'info', title: 'Battery energy requirement', detail: `Idealized minimum usable-energy sizing estimate: ${batteryRequiredWh.toFixed(1)} Wh before temperature, aging, peak-load and design margins.` });
  if (design.destination === 'earth' || design.destination === 'moon') findings.push({ severity: 'info', title: 'Transfer interpretation', detail: 'The displayed heliocentric transfer is a selectable-radius mathematical example, not an Earth-to-Moon or launch-vehicle trajectory.' });
  return { transfer, propulsion, solar, power: { loadW: inputs.power.loadW, marginW: powerMarginW, sunlightHoursPerDay: sunlightHours, batteryRequiredWh }, comms, reliability, faults, findings, provenance: { equations: ['Vis-viva / two-body Hohmann transfer', 'Ideal Tsiolkovsky rocket equation', 'Solar inverse-square and cosine-incidence model', 'Friis free-space transmission equation and Eb/N0', 'Exponential reliability with independent parallel redundancy'], inputsAreUserSupplied: true } };
}

/** Deterministic FDIR logic walkthrough for one injected primary-unit fault. Not hardware behavior prediction. */
export function injectSingleFault(reliability, subsystem = 'power') {
  const item = reliability.components.find(c => c.name === subsystem);
  if (!item) throw new RangeError(`Unknown subsystem: ${subsystem}`);
  const timeline = [
    { phase: 'FAULT INJECTED', action: `Primary ${subsystem} unit declared failed by test harness.` },
    { phase: 'DETECT', action: item.fdirCoverage > 0 ? 'Monitor threshold / heartbeat declares an anomaly.' : 'No modeled detection coverage; fault remains latent.' }
  ];
  if (item.fdirCoverage <= 0) { timeline.push({ phase: 'OUTCOME', action: 'Fault is not detected; no autonomous recovery is credited.' }); return { subsystem, recovered: false, degraded: true, timeline }; }
  timeline.push({ phase: 'ISOLATE', action: 'Fault-containment boundary isolates the failed unit from the active path.' });
  if (item.redundancy >= 2) { timeline.push({ phase: 'SWITCHOVER', action: 'A modeled independent redundant unit is selected.' }); timeline.push({ phase: 'RECOVER', action: 'Subsystem returns to an operational state; remaining redundancy is reduced.' }); return { subsystem, recovered: true, degraded: true, timeline }; }
  timeline.push({ phase: 'SAFE MODE', action: 'No redundant unit is available; shed non-essential loads and preserve command/telemetry where possible.' });
  return { subsystem, recovered: false, degraded: true, timeline };
}
