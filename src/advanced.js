/**
 * Advanced preliminary-analysis models for Mission Forge.
 * Units are SI unless a function explicitly says otherwise.
 * Two-body RK4 propagation and single-node thermal balance are educational/preliminary models.
 */
export const ADVANCED_CONSTANTS = Object.freeze({
  MU_EARTH_M3_S2: 3.986004418e14,
  EARTH_MEAN_RADIUS_M: 6_371_000,
  SIGMA_W_M2_K4: 5.670374419e-8,
  SOLAR_CONSTANT_W_M2: 1361,
  AU_M: 149_597_870_700
});

const positive = (v, n) => {
  if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${n} must be finite and > 0`);
  return v;
};
const finite = (v, n) => {
  if (!Number.isFinite(v)) throw new RangeError(`${n} must be finite`);
  return v;
};

function acceleration(x, y, mu) {
  const r2 = x*x + y*y;
  const r = Math.sqrt(r2);
  if (r <= 0) throw new RangeError('Spacecraft radius must be non-zero');
  const factor = -mu / (r2 * r);
  return [factor*x, factor*y];
}
function derivative(s, mu) {
  const [x,y,vx,vy] = s;
  const [ax,ay] = acceleration(x,y,mu);
  return [vx,vy,ax,ay];
}
function addScaled(a,b,k) { return a.map((v,i)=>v+k*b[i]); }
function rk4Step(s, dt, mu) {
  const k1 = derivative(s,mu);
  const k2 = derivative(addScaled(s,k1,dt/2),mu);
  const k3 = derivative(addScaled(s,k2,dt/2),mu);
  const k4 = derivative(addScaled(s,k3,dt),mu);
  return s.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
}

/** Cartesian inertial two-body propagation using fixed-step classical RK4. */
export function propagateTwoBody({ mu = ADVANCED_CONSTANTS.MU_EARTH_M3_S2, initialState, durationS, stepS = 30, maxPoints = 20000 }) {
  positive(mu,'mu'); positive(durationS,'durationS'); positive(stepS,'stepS');
  if (!Array.isArray(initialState) || initialState.length !== 4 || initialState.some(v=>!Number.isFinite(v))) throw new TypeError('initialState must be [x, y, vx, vy] with finite SI values');
  const initialRadius = Math.hypot(initialState[0],initialState[1]);
  if (initialRadius < ADVANCED_CONSTANTS.EARTH_MEAN_RADIUS_M * 0.5) throw new RangeError('Initial position is inside the central body');
  const count = Math.ceil(durationS/stepS);
  if (count + 1 > maxPoints) throw new RangeError(`Requested propagation exceeds ${maxPoints} samples; increase stepS or reduce durationS`);
  const points = [{ t:0, x:initialState[0], y:initialState[1], vx:initialState[2], vy:initialState[3] }];
  let s = [...initialState], t = 0;
  for (let i=0;i<count;i++) {
    const dt = Math.min(stepS,durationS-t);
    s = rk4Step(s,dt,mu); t += dt;
    const radius = Math.hypot(s[0],s[1]);
    if (!Number.isFinite(radius) || radius < ADVANCED_CONSTANTS.EARTH_MEAN_RADIUS_M) throw new Error('Propagated trajectory intersects the Earth reference sphere; propagation stopped.');
    points.push({t,x:s[0],y:s[1],vx:s[2],vy:s[3]});
  }
  const r0 = initialRadius, v0 = Math.hypot(initialState[2],initialState[3]);
  const energy0 = v0*v0/2-mu/r0;
  const final = points.at(-1), rf = Math.hypot(final.x,final.y), vf = Math.hypot(final.vx,final.vy);
  const energyF = vf*vf/2-mu/rf;
  const relEnergyDrift = Math.abs((energyF-energy0)/energy0);
  return { points, initialRadiusM:r0, finalRadiusM:rf, initialSpeedMps:v0, finalSpeedMps:vf, relativeSpecificEnergyDrift:relEnergyDrift, samples:points.length, model:'Earth-centered inertial two-body point-mass gravity; fixed-step RK4' };
}

/** Single-node equilibrium temperature from absorbed solar + internal heat = emitted IR. */
export function singleNodeThermalEquilibrium({ solarDistanceAU=1, projectedAreaM2=1, radiatingAreaM2=2, solarAbsorptivity=0.6, infraredEmissivity=0.8, internalHeatW=30, viewFactorToDeepSpace=1 }) {
  positive(solarDistanceAU,'solarDistanceAU'); positive(projectedAreaM2,'projectedAreaM2'); positive(radiatingAreaM2,'radiatingAreaM2');
  positive(internalHeatW,'internalHeatW');
  for (const [v,n] of [[solarAbsorptivity,'solarAbsorptivity'],[infraredEmissivity,'infraredEmissivity'],[viewFactorToDeepSpace,'viewFactorToDeepSpace']]) if (!(v>0 && v<=1)) throw new RangeError(`${n} must be in (0,1]`);
  const incidentSolar = ADVANCED_CONSTANTS.SOLAR_CONSTANT_W_M2/(solarDistanceAU**2);
  const absorbedSolarW = incidentSolar*projectedAreaM2*solarAbsorptivity;
  const totalHeatW = absorbedSolarW+internalHeatW;
  const denominator = infraredEmissivity*ADVANCED_CONSTANTS.SIGMA_W_M2_K4*radiatingAreaM2*viewFactorToDeepSpace;
  const equilibriumK = (totalHeatW/denominator)**0.25;
  return { incidentSolarWm2:incidentSolar, absorbedSolarW, internalHeatW, totalHeatW, equilibriumK, equilibriumC:equilibriumK-273.15, emittedPowerW:denominator*equilibriumK**4, assumptions:['Single isothermal node','Radiation to deep space only','No Earth/Moon albedo or planetary infrared','No conduction between nodes','Constant optical properties','Steady-state equilibrium; no thermal capacitance or transient response'] };
}

/** Independent basic-event fault tree. OR = at least one event; AND = all events. */
export function evaluateFaultTree({ gate='OR', probabilities }) {
  if (!Array.isArray(probabilities) || probabilities.length < 2) throw new RangeError('Provide at least two basic-event probabilities');
  if (probabilities.some(p=>!Number.isFinite(p)||p<0||p>1)) throw new RangeError('Each event probability must be in [0,1]');
  if (!['OR','AND'].includes(gate)) throw new RangeError('Gate must be OR or AND');
  const topEventProbability = gate==='OR' ? 1-probabilities.reduce((p,q)=>p*(1-q),1) : probabilities.reduce((p,q)=>p*q,1);
  return { gate, basicEventProbabilities:[...probabilities], topEventProbability, assumptions:['Basic events are statistically independent','Probabilities refer to the same defined mission interval','No common-cause or dependent failures are represented'] };
}

/** Simple FMEA worksheet: RPN = severity × occurrence × detectability (1–10 scales). */
export function scoreFmea(rows) {
  return rows.map((r,index)=>{
    const values=[r.severity,r.occurrence,r.detectability];
    if(values.some(v=>!Number.isInteger(v)||v<1||v>10)) throw new RangeError('FMEA severity, occurrence and detectability must be integers from 1 to 10');
    const rpn=values.reduce((a,b)=>a*b,1);
    return {...r,id:r.id??`FMEA-${String(index+1).padStart(3,'0')}`,rpn,priority:rpn>=200?'High':rpn>=100?'Medium':'Low'};
  }).sort((a,b)=>b.rpn-a.rpn);
}

export function circularEarthOrbit(altitudeKm=400) {
  positive(altitudeKm,'altitudeKm');
  const r=ADVANCED_CONSTANTS.EARTH_MEAN_RADIUS_M+altitudeKm*1000;
  const v=Math.sqrt(ADVANCED_CONSTANTS.MU_EARTH_M3_S2/r);
  const period=2*Math.PI*Math.sqrt(r**3/ADVANCED_CONSTANTS.MU_EARTH_M3_S2);
  return { radiusM:r, circularSpeedMps:v, periodS:period, periodMinutes:period/60, initialState:[r,0,0,v] };
}
