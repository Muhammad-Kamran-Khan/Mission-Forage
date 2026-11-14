import { CONSTANTS, DESTINATIONS, ORBITS, LAUNCHERS, POWER, COMMUNICATIONS, INSTRUMENTS, OBJECTIVES, SCENARIOS } from './data.js';

export function defaultDesign() {
  return { objective: 'climate', destination: 'earth', orbit: 'sso', launcher: 'medium', scenario: 'balanced', power: 'compactSolar', communications: 'medium', instruments: ['camera', 'spectrometer'], shield: false, lifetime: 24 };
}

export function calculate(design) {
  const objective = OBJECTIVES[design.objective];
  const destination = DESTINATIONS[design.destination];
  const orbit = ORBITS[design.orbit];
  const launcher = LAUNCHERS[design.launcher];
  const powerSystem = POWER[design.power];
  const comms = COMMUNICATIONS[design.communications];
  const instruments = design.instruments.map(id => INSTRUMENTS[id]).filter(Boolean);
  const scenario = SCENARIOS[design.scenario];
  const instrumentMass = instruments.reduce((n, x) => n + x.mass, 0);
  const instrumentCost = instruments.reduce((n, x) => n + x.cost, 0);
  const instrumentPower = instruments.reduce((n, x) => n + x.watts, 0);
  const dataGenerated = instruments.reduce((n, x) => n + x.dataGbDay, 0);
  const mass = CONSTANTS.bus.mass + powerSystem.mass + comms.mass + instrumentMass + (design.shield ? 42 : 0);
  const cost = CONSTANTS.bus.cost + launcher.cost + powerSystem.cost + comms.cost + instrumentCost + (design.shield ? 24 : 0) + design.lifetime * CONSTANTS.operationsCostPerMonth;
  const payloadCapacity = launcher.leoKg * destination.transferFactor * orbit.capacityFactor;
  const solarFluxFactor = 1 / (destination.au ** 2);
  const powerGenerated = powerSystem.kind === 'solar' ? powerSystem.wattsAt1Au * solarFluxFactor : powerSystem.wattsAt1Au;
  const powerUsed = CONSTANTS.bus.power + comms.watts + instrumentPower;
  const powerMargin = powerGenerated - powerUsed;
  // A transparent educational link-budget proxy: rate scales approximately with 1/r².
  // It is NOT a radio link-budget calculation and excludes frequency, coding, EIRP, G/T, etc.
  const distanceAu = Math.max(0.000003, destination.distanceAu);
  const rawDownlink = comms.rateAt1Au / (distanceAu ** 2);
  const downlinkCapacity = Math.min(500, rawDownlink) * destination.commAvailability;
  const dataReturnRatio = dataGenerated === 0 ? 1 : Math.min(1, downlinkCapacity / dataGenerated);
  const oneWayLightTimeMin = destination.distanceAu * CONSTANTS.lightMinutesPerAU;
  const objectiveFit = design.destination === objective.destination && objective.orbit.includes(design.orbit);
  const instrumentFit = instruments.reduce((n, x) => n + (x.tags.includes(design.destination) ? x.science : x.science * 0.18), 0);
  const preferredBonus = design.instruments.reduce((n, id) => n + (objective.preferred.includes(id) ? 12 : 0), 0);
  const durationFactor = Math.min(1.2, design.lifetime / objective.minMonths);
  const sciencePotential = Math.round((instrumentFit + preferredBonus) * ORBITS[design.orbit].scienceBonus * dataReturnRatio * durationFactor);
  const hasSurfaceLander = !['lunarSurface', 'marsSurface'].includes(design.orbit) || design.instruments.includes('lander');
  const hasNoSurfaceOnlyInstrumentInOrbit = !design.instruments.includes('lander') || ['lunarSurface', 'marsSurface'].includes(design.orbit);
  const radiationRisk = Math.min(95, Math.round(destination.radiation * (design.shield ? 9 : 19) + (design.destination === 'jupiter' ? 18 : 0)));
  const checks = [
    { id: 'objective', label: 'Objective and orbit compatibility', pass: objectiveFit, detail: objectiveFit ? 'The selected destination and orbit match the objective.' : 'The selected destination or orbit does not satisfy the objective.' },
    { id: 'budget', label: 'Program budget', pass: cost <= scenario.budget, detail: `$${cost}M estimated against a $${scenario.budget}M scenario budget.` },
    { id: 'mass', label: 'Launch mass capacity', pass: mass <= payloadCapacity, detail: `${mass.toFixed(0)} kg spacecraft against ${payloadCapacity.toFixed(0)} kg game-model capacity.` },
    { id: 'power', label: 'Power balance', pass: powerMargin >= 0, detail: `${powerGenerated.toFixed(0)} W generated and ${powerUsed.toFixed(0)} W required.` },
    { id: 'data', label: 'Science data return', pass: dataReturnRatio >= 0.9, detail: `${Math.round(dataReturnRatio * 100)}% of generated daily data can be returned in this proxy model.` },
    { id: 'lifetime', label: 'Mission lifetime', pass: design.lifetime >= objective.minMonths, detail: `${design.lifetime} months selected; ${objective.minMonths} months required.` },
    { id: 'lander', label: 'Surface payload compatibility', pass: hasSurfaceLander && hasNoSurfaceOnlyInstrumentInOrbit, detail: hasSurfaceLander && hasNoSurfaceOnlyInstrumentInOrbit ? 'Surface payload selection is compatible.' : 'Surface missions need a lander; landers cannot be selected for orbit-only missions.' }
  ];
  const sciencePass = sciencePotential >= objective.scienceTarget;
  const hardPass = checks.every(x => x.pass);
  const scienceScore = Math.min(100, sciencePotential / objective.scienceTarget * 100);
  const budgetScore = Math.max(0, 100 - Math.max(0, cost - scenario.budget * 0.72) / scenario.budget * 100);
  const marginScore = Math.max(0, Math.min(100, 50 + powerMargin / Math.max(1, powerGenerated) * 100));
  const dataScore = dataReturnRatio * 100;
  const riskScore = 100 - radiationRisk;
  const score = Math.round(scienceScore * 0.35 + budgetScore * 0.15 + marginScore * 0.15 + dataScore * 0.2 + riskScore * 0.15);
  return {
    objective, destination, orbit, launcher, powerSystem, comms, instruments, scenario,
    mass, cost, payloadCapacity, solarFluxFactor, powerGenerated, powerUsed, powerMargin,
    dataGenerated, downlinkCapacity, dataReturnRatio, oneWayLightTimeMin,
    sciencePotential, sciencePass, radiationRisk, score, hardPass, checks,
    objectiveFit, hasSurfaceLander
  };
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seeded(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

export function simulate(design) {
  const result = calculate(design);
  const random = seeded(hashString(JSON.stringify(design)));
  const events = [
    { name: 'Solar activity spike', probability: 0.55, risk: result.radiationRisk / 100, good: 'Radiation mitigation kept the spacecraft within the simplified risk envelope.', bad: 'The event increased spacecraft risk; shielding reduces but does not eliminate exposure.' },
    { name: 'Ground network scheduling conflict', probability: 0.65, risk: 1 - result.dataReturnRatio, good: 'The communications plan had enough margin for the missed contact window.', bad: 'A missed contact window increased the onboard data backlog.' },
    { name: 'Power subsystem degradation', probability: 0.6, risk: result.powerMargin < result.powerGenerated * 0.15 ? 0.7 : 0.2, good: 'The power margin absorbed the simulated degradation.', bad: 'A small power margin forced reduced instrument operations.' },
    { name: 'Nominal science operations', probability: 0.8, risk: 0.15, good: 'The spacecraft completed a productive observation cycle.', bad: 'Operations were less productive than planned.' }
  ];
  const occurred = events.filter(e => random() < e.probability).map(e => { const success = random() >= e.risk; return { name: e.name, success, text: success ? e.good : e.bad }; });
  const eventPenalty = occurred.filter(e => !e.success).length * 7;
  const success = result.hardPass && result.sciencePass && occurred.filter(e => !e.success).length <= 1;
  const finalScore = Math.max(0, Math.min(100, result.score - eventPenalty + (success ? 5 : 0)));
  const recommendations = [];
  for (const check of result.checks.filter(x => !x.pass)) recommendations.push(check.detail);
  if (!result.sciencePass) recommendations.push('Increase objective-relevant instrument capability or extend the mission lifetime.');
  if (result.powerMargin < result.powerGenerated * 0.15) recommendations.push('Target a larger power margin; degradation and peak loads can reduce available instrument time.');
  if (result.dataReturnRatio < 1) recommendations.push('Reduce instrument data volume or increase communications capacity.');
  if (!design.shield && result.radiationRisk > 20) recommendations.push('Consider a radiation mitigation strategy; shielding is a risk-reduction proxy, not a guarantee.');
  return { ...result, events: occurred, success, finalScore, recommendations };
}
