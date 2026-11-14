import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, defaultDesign, simulate } from '../src/engine.js';

test('starter mission passes core constraints and science target', () => {
  const result = calculate(defaultDesign());
  assert.equal(result.hardPass, true);
  assert.equal(result.sciencePass, true);
  assert.ok(result.mass < result.payloadCapacity);
  assert.ok(result.powerMargin > 0);
  assert.equal(result.dataReturnRatio, 1);
});

test('solar power follows inverse-square scaling with heliocentric distance', () => {
  const earth = calculate(defaultDesign());
  const marsDesign = { ...defaultDesign(), objective: 'marsClimate', destination: 'mars', orbit: 'marsOrbit', power: 'compactSolar', communications: 'high', instruments: ['camera', 'spectrometer', 'particle'] };
  const mars = calculate(marsDesign);
  assert.ok(Math.abs(mars.powerGenerated / earth.powerGenerated - (1 / (1.52 ** 2))) < 0.001);
});

test('objective/orbit mismatch is explicitly rejected', () => {
  const result = calculate({ ...defaultDesign(), destination: 'mars', orbit: 'marsOrbit' });
  assert.equal(result.checks.find(x => x.id === 'objective').pass, false);
  assert.equal(result.hardPass, false);
});

test('surface mission requires a lander and lander is rejected in orbit-only mode', () => {
  const surfaceWithoutLander = calculate({ ...defaultDesign(), objective: 'lunarIce', destination: 'moon', orbit: 'lunarSurface', instruments: ['camera', 'spectrometer'] });
  assert.equal(surfaceWithoutLander.checks.find(x => x.id === 'lander').pass, false);
  const landerInOrbit = calculate({ ...defaultDesign(), objective: 'lunarIce', destination: 'moon', orbit: 'lunar', instruments: ['camera', 'lander'] });
  assert.equal(landerInOrbit.checks.find(x => x.id === 'lander').pass, false);
});

test('high data-volume payload can fail data-return constraint', () => {
  const result = calculate({ ...defaultDesign(), objective: 'marsClimate', destination: 'mars', orbit: 'marsOrbit', communications: 'low', instruments: ['camera', 'radar', 'spectrometer'] });
  assert.equal(result.checks.find(x => x.id === 'data').pass, false);
});

test('simulation is reproducible for an identical design', () => {
  const design = defaultDesign();
  assert.deepEqual(simulate(design), simulate(design));
});

test('simulation reports success only when modeled constraints and science target pass', () => {
  const result = simulate(defaultDesign());
  assert.equal(result.hardPass, true);
  assert.equal(result.sciencePass, true);
  assert.equal(result.success, true);
});
