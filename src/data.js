// All component prices, masses and performance ratings are game-design assumptions.
// Solar scaling uses the physical inverse-square relationship documented by NASA/JPL.
export const CONSTANTS = {
  solarIrradianceEarth: 1361, // W/m², approximate total solar irradiance at 1 AU
  lightMinutesPerAU: 8.316,
  operationsCostPerMonth: 2.5,
  bus: { name: 'Standard spacecraft bus', cost: 28, mass: 95, power: 55, data: 0 },
  budget: { relaxed: 700, standard: 500, constrained: 350 }
};

export const DESTINATIONS = {
  earth: { name: 'Earth', au: 1.0, distanceAu: 0.000003, transferFactor: 1, radiation: 1, commAvailability: 0.92, description: 'Frequent contact opportunities and abundant sunlight.' },
  moon: { name: 'Moon', au: 1.0, distanceAu: 0.00257, transferFactor: 0.42, radiation: 1.35, commAvailability: 0.72, description: 'Cislunar operations with intermittent line-of-sight constraints.' },
  mars: { name: 'Mars', au: 1.52, distanceAu: 1.5, transferFactor: 0.18, radiation: 2.1, commAvailability: 0.58, description: 'Long communication delay, reduced solar flux and deep-space exposure.' },
  jupiter: { name: 'Jupiter', au: 5.2, distanceAu: 5.2, transferFactor: 0.055, radiation: 4.5, commAvailability: 0.46, description: 'Very weak sunlight and a demanding radiation environment.' }
};

export const ORBITS = {
  leo: { name: 'Low Earth orbit', destinations: ['earth'], capacityFactor: 1, scienceBonus: 1.0, description: 'Low-altitude Earth mapping and frequent ground contact.' },
  sso: { name: 'Sun-synchronous orbit', destinations: ['earth'], capacityFactor: 0.88, scienceBonus: 1.12, description: 'Consistent local solar time for repeatable Earth observations.' },
  lunar: { name: 'Low lunar orbit', destinations: ['moon'], capacityFactor: 1, scienceBonus: 1.05, description: 'Global lunar mapping from orbit.' },
  lunarSurface: { name: 'Lunar surface', destinations: ['moon'], capacityFactor: 0.78, scienceBonus: 1.22, description: 'In-situ measurements; requires a lander package.' },
  marsOrbit: { name: 'Mars orbit', destinations: ['mars'], capacityFactor: 1, scienceBonus: 1.08, description: 'Global mapping and atmospheric observation.' },
  marsSurface: { name: 'Mars surface', destinations: ['mars'], capacityFactor: 0.72, scienceBonus: 1.25, description: 'In-situ science; requires a lander package.' },
  jupiterOrbit: { name: 'Jupiter orbit', destinations: ['jupiter'], capacityFactor: 1, scienceBonus: 1.1, description: 'Remote sensing in a high-radiation environment.' }
};

export const LAUNCHERS = {
  small: { name: 'Small launch vehicle', cost: 42, leoKg: 650, description: 'Low-cost option for compact near-Earth spacecraft.' },
  medium: { name: 'Medium launch vehicle', cost: 95, leoKg: 5200, description: 'Balanced payload capability for larger science missions.' },
  heavy: { name: 'Heavy-lift launch vehicle', cost: 185, leoKg: 18000, description: 'High payload capacity with a substantial cost premium.' }
};

export const POWER = {
  compactSolar: { name: 'Compact solar array', cost: 18, mass: 38, wattsAt1Au: 260, kind: 'solar', reliability: 0.94, description: 'Low mass and cost; output falls with the square of solar distance.' },
  largeSolar: { name: 'Deployable solar wings', cost: 58, mass: 145, wattsAt1Au: 1050, kind: 'solar', reliability: 0.96, description: 'High output at the cost of mass and deployment complexity.' },
  rtg: { name: 'Radioisotope power system', cost: 125, mass: 210, wattsAt1Au: 520, kind: 'rtg', reliability: 0.98, description: 'Steady power independent of sunlight; expensive and mass-intensive.' }
};

export const COMMUNICATIONS = {
  low: { name: 'Low-gain antenna', cost: 12, mass: 12, watts: 8, rateAt1Au: 0.8, description: 'Robust and light, but low data throughput.' },
  medium: { name: 'Medium-gain antenna', cost: 32, mass: 34, watts: 18, rateAt1Au: 8, description: 'A compromise between mass, power and throughput.' },
  high: { name: 'High-gain radio dish', cost: 68, mass: 92, watts: 38, rateAt1Au: 55, description: 'Higher throughput with pointing and power demands.' },
  optical: { name: 'Optical communications demo', cost: 92, mass: 48, watts: 65, rateAt1Au: 180, description: 'High potential data rate; game model applies a weather/pointing availability penalty.' }
};

export const INSTRUMENTS = {
  camera: { name: 'Multispectral imager', cost: 42, mass: 34, watts: 42, dataGbDay: 5.2, science: 74, tags: ['earth', 'moon', 'mars'], description: 'Maps surface features and spectral signatures.' },
  spectrometer: { name: 'Imaging spectrometer', cost: 62, mass: 48, watts: 78, dataGbDay: 2.8, science: 92, tags: ['earth', 'moon', 'mars', 'jupiter'], description: 'Identifies minerals, gases and material composition.' },
  radar: { name: 'Synthetic aperture radar', cost: 88, mass: 105, watts: 190, dataGbDay: 12, science: 105, tags: ['earth', 'moon', 'mars'], description: 'Observes surfaces through clouds and in darkness; high power and data demand.' },
  magnetometer: { name: 'Magnetometer', cost: 26, mass: 16, watts: 12, dataGbDay: 0.15, science: 45, tags: ['earth', 'moon', 'mars', 'jupiter'], description: 'Measures magnetic fields with a small data footprint.' },
  particle: { name: 'Particle detector', cost: 38, mass: 24, watts: 24, dataGbDay: 0.6, science: 58, tags: ['earth', 'moon', 'mars', 'jupiter'], description: 'Studies charged particles and the local space environment.' },
  lander: { name: 'Robotic lander package', cost: 105, mass: 185, watts: 115, dataGbDay: 1.4, science: 118, tags: ['moon', 'mars'], requiresSurface: true, description: 'Enables surface science; only compatible with a surface mission.' }
};

export const OBJECTIVES = {
  climate: { name: 'Climate & weather', destination: 'earth', orbit: ['leo', 'sso'], minMonths: 24, scienceTarget: 130, preferred: ['camera', 'radar', 'spectrometer'], description: 'Measure changing atmospheric and surface conditions over time.' },
  lunarIce: { name: 'Lunar water & geology', destination: 'moon', orbit: ['lunar', 'lunarSurface'], minMonths: 12, scienceTarget: 125, preferred: ['spectrometer', 'camera', 'lander'], description: 'Characterize lunar materials and identify resources of scientific interest.' },
  marsClimate: { name: 'Mars climate & geology', destination: 'mars', orbit: ['marsOrbit', 'marsSurface'], minMonths: 24, scienceTarget: 155, preferred: ['spectrometer', 'camera', 'particle'], description: 'Study the Martian surface, atmosphere and near-space environment.' },
  outerSpace: { name: 'Outer-planet environment', destination: 'jupiter', orbit: ['jupiterOrbit'], minMonths: 18, scienceTarget: 120, preferred: ['magnetometer', 'particle', 'spectrometer'], description: 'Investigate a giant planet’s energetic particle and magnetic environment.' }
};

export const SCENARIOS = {
  explorer: { name: 'First Mission', difficulty: 'relaxed', budget: 700, hint: 'Learn the trade-offs with a generous budget.' },
  balanced: { name: 'Agency Challenge', difficulty: 'standard', budget: 500, hint: 'Deliver useful science while keeping a sensible reserve.' },
  austerity: { name: 'Tight Budget', difficulty: 'constrained', budget: 350, hint: 'Prioritize carefully. You cannot maximize every subsystem.' }
};

export const CREW_ROLES = {
  planner: { name: 'Mission Architect', controls: ['objective', 'destination', 'orbit', 'launcher', 'scenario'] },
  engineer: { name: 'Spacecraft Engineer', controls: ['power', 'communications', 'shield'] },
  scientist: { name: 'Science Lead', controls: ['instruments'] },
  operations: { name: 'Flight Operations', controls: ['lifetime'] }
};
