import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS, hohmannTransfer, rocketEquation, solarArrayPower, downlinkBudget, reliabilityAnalysis, defaultEngineeringInputs, analyzeEngineering, injectSingleFault } from '../src/engineering.js';

test('Hohmann transfer is symmetric in total delta-v when radii are swapped', () => {
  const a = hohmannTransfer({ mu: PHYSICS.MU_SUN_M3_S2, r1: PHYSICS.AU_M, r2: 1.523679 * PHYSICS.AU_M });
  const b = hohmannTransfer({ mu: PHYSICS.MU_SUN_M3_S2, r1: 1.523679 * PHYSICS.AU_M, r2: PHYSICS.AU_M });
  assert.ok(a.totalDeltaV > 0);
  assert.ok(Math.abs(a.totalDeltaV - b.totalDeltaV) < 1e-8);
  assert.ok(a.transferTimeS > 0);
});

test('ideal rocket equation reports positive propellant margin for a generous tank', () => {
  const r = rocketEquation({ deltaVKmS: 3.5, ispS: 320, dryMassKg: 500, propellantMassKg: 1200 });
  assert.equal(r.feasibleIdeal, true);
  assert.ok(r.requiredPropellantKg > 0);
});

test('solar array follows inverse-square law and incidence cosine', () => {
  const a = solarArrayPower({ distanceAU: 1, areaM2: 1, efficiency: 1, derating: 1 });
  const b = solarArrayPower({ distanceAU: 2, areaM2: 1, efficiency: 1, derating: 1 });
  const c = solarArrayPower({ distanceAU: 1, areaM2: 1, efficiency: 1, derating: 1, incidenceDeg: 60 });
  assert.ok(Math.abs(a.outputW / b.outputW - 4) < 1e-12);
  assert.ok(Math.abs(c.outputW / a.outputW - 0.5) < 1e-12);
});

test('downlink margin increases with transmitter power', () => {
  const inputs = defaultEngineeringInputs('mars').comms;
  const a = downlinkBudget(inputs);
  const b = downlinkBudget({ ...inputs, txPowerW: inputs.txPowerW * 10 });
  assert.ok(Math.abs((b.marginDb - a.marginDb) - 10) < 1e-9);
});

test('independent parallel redundancy improves modeled reliability', () => {
  const base = { missionHours: 1000, mtbfHours: { power: 5000 }, redundancy: { power: 1 }, detectionCoverage: 0.9, recoveryCoverage: 0.9 };
  const one = reliabilityAnalysis(base).components[0].functionReliability;
  const two = reliabilityAnalysis({ ...base, redundancy: { power: 2 } }).components[0].functionReliability;
  assert.ok(two > one);
});

test('analysis returns explicit fault review and model findings', () => {
  const result = analyzeEngineering({ destination: 'mars' });
  assert.equal(result.faults.length, 4);
  assert.ok(Array.isArray(result.findings));
  assert.ok(result.comms.cn0DbHz > 0);
});

test('fault injection reports switchover when redundant unit exists', () => {
  const rel = reliabilityAnalysis({ missionHours: 100, mtbfHours: { power: 10000 }, redundancy: { power: 2 }, detectionCoverage: 1, recoveryCoverage: 1 });
  const result = injectSingleFault(rel, 'power');
  assert.equal(result.recovered, true);
  assert.ok(result.timeline.some(x => x.phase === 'SWITCHOVER'));
});

test('Earth-to-Mars-radius Hohmann reference case is in the expected analytical range', () => {
  const r = hohmannTransfer({ mu: PHYSICS.MU_SUN_M3_S2, r1: PHYSICS.AU_M, r2: 1.523679 * PHYSICS.AU_M });
  assert.ok(Math.abs(r.totalDeltaV / 1000 - 5.594) < 0.01);
  assert.ok(Math.abs(r.transferTimeS / 86400 - 258.87) < 0.2);
});
