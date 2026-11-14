import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVANCED_CONSTANTS, circularEarthOrbit, propagateTwoBody, singleNodeThermalEquilibrium, evaluateFaultTree, scoreFmea } from '../src/advanced.js';

test('400 km circular Earth orbit has plausible speed and period',()=>{
  const o=circularEarthOrbit(400);
  assert.ok(o.circularSpeedMps>7600 && o.circularSpeedMps<7800);
  assert.ok(o.periodMinutes>90 && o.periodMinutes<95);
});

test('RK4 two-body propagation conserves specific orbital energy within a tight step-size tolerance',()=>{
  const o=circularEarthOrbit(400);
  const p=propagateTwoBody({initialState:o.initialState,durationS:o.periodS,stepS:10});
  assert.ok(p.relativeSpecificEnergyDrift<1e-8,`energy drift ${p.relativeSpecificEnergyDrift}`);
  assert.ok(Math.abs(p.finalRadiusM-p.initialRadiusM)<2);
});

test('propagator rejects excessive sample counts and Earth-intersecting initial state',()=>{
  const o=circularEarthOrbit(400);
  assert.throws(()=>propagateTwoBody({initialState:o.initialState,durationS:10000,stepS:0.01,maxPoints:1000}),/exceeds/);
  assert.throws(()=>propagateTwoBody({initialState:[1,0,0,1],durationS:10}),/inside/);
});

test('single-node thermal equilibrium closes the steady-state heat balance',()=>{
  const t=singleNodeThermalEquilibrium({solarDistanceAU:1,projectedAreaM2:1,radiatingAreaM2:2,solarAbsorptivity:0.5,infraredEmissivity:0.8,internalHeatW:20});
  assert.ok(t.equilibriumK>150 && t.equilibriumK<400);
  assert.ok(Math.abs(t.emittedPowerW-t.totalHeatW)<1e-8);
});

test('thermal equilibrium temperature decreases with increased solar distance',()=>{
  const a=singleNodeThermalEquilibrium({solarDistanceAU:1});
  const b=singleNodeThermalEquilibrium({solarDistanceAU:2});
  assert.ok(b.equilibriumK<a.equilibriumK);
});

test('independent fault tree OR and AND gates evaluate correctly',()=>{
  const or=evaluateFaultTree({gate:'OR',probabilities:[0.1,0.2]});
  const and=evaluateFaultTree({gate:'AND',probabilities:[0.1,0.2]});
  assert.ok(Math.abs(or.topEventProbability-0.28)<1e-12);
  assert.ok(Math.abs(and.topEventProbability-0.02)<1e-12);
});

test('FMEA RPN ranks highest risk first',()=>{
  const rows=scoreFmea([{failureMode:'A',severity:10,occurrence:5,detectability:5},{failureMode:'B',severity:2,occurrence:2,detectability:2}]);
  assert.equal(rows[0].rpn,250);
  assert.equal(rows[0].priority,'High');
  assert.equal(rows[1].rpn,8);
});
