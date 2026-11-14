import './styles.css';
import { CONSTANTS, DESTINATIONS, ORBITS, LAUNCHERS, POWER, COMMUNICATIONS, INSTRUMENTS, OBJECTIVES, SCENARIOS, CREW_ROLES } from './data.js';
import { defaultDesign, calculate, simulate } from './engine.js';
import { analyzeEngineering, defaultEngineeringInputs, injectSingleFault } from './engineering.js';
import { ADVANCED_CONSTANTS, circularEarthOrbit, propagateTwoBody, singleNodeThermalEquilibrium, evaluateFaultTree, scoreFmea } from './advanced.js';
import { isCollaborationConfigured, signUp, signIn, signOut, currentUser, createTeam, createInvite, joinTeam, myTeams, loadMission, saveMission, subscribeMission, teamMembers } from './collaboration.js';

const $ = (q) => document.querySelector(q);
const clone = (x) => JSON.parse(JSON.stringify(x));
const state = { design: defaultDesign(), mode: 'solo', role: 'planner', approvals: {}, report: null, toast: '', engineering: defaultEngineeringInputs('mars'), advanced: { altitudeKm: 400, stepS: 30, thermal: { solarDistanceAU: 1, projectedAreaM2: 1.2, radiatingAreaM2: 2.4, solarAbsorptivity: 0.6, infraredEmissivity: 0.82, internalHeatW: 45, viewFactorToDeepSpace: 1 } }, user: null, teams: [], activeTeam: null, unsubscribeMission: null, inviteLink: '' };
const bestKey = 'mission-forge-pro-best-v2';
async function refreshTeamsAndRedeemInvite() {
  state.user = await currentUser();
  let joinedTeamId = null;
  if (state.pendingInvite && state.user) { try { joinedTeamId = await joinTeam(state.pendingInvite); state.pendingInvite = null; history.replaceState(null, '', location.pathname); } catch (error) { state.pendingInvite = null; history.replaceState(null, '', location.pathname); notify(error.message); } }
  state.teams = await myTeams();
  if (joinedTeamId) state.activeTeam = state.teams.find(t => t.id === joinedTeamId) || null;
  if (state.teams.length && !state.activeTeam) state.activeTeam = state.teams[0];
  if (state.activeTeam) { state.members = await teamMembers(state.activeTeam.id); const row = await loadMission(state.activeTeam.id); if(row?.design && Object.keys(row.design).length) state.design={...defaultDesign(),...row.design}; if(state.unsubscribeMission) state.unsubscribeMission(); state.unsubscribeMission=subscribeMission(state.activeTeam.id,row=>{ if(row?.design){state.design={...defaultDesign(),...row.design}; render(); notify('Shared mission updated by a teammate.');} }); }
}
const saveKey = 'mission-forge-pro-design-v2';

function loadShared() {
  try {
    const raw = new URLSearchParams(location.hash.slice(1)).get('design');
    if (raw) state.design = { ...defaultDesign(), ...JSON.parse(decodeURIComponent(escape(atob(raw)))) };
  } catch { /* Ignore invalid share payloads and start with the default design. */ }
}
const sharedDesignPresent = new URLSearchParams(location.hash.slice(1)).has('design');

function esc(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
function money(n) { return `$${Math.round(n)}M`; }
function meter(label, value, max, unit = '', inverse = false) {
  const ratio = max > 0 ? value / max : 0;
  const width = Math.max(0, Math.min(100, ratio * 100));
  const bad = inverse ? ratio > 1 : ratio < 1;
  return `<div class="meter ${bad ? 'bad' : 'good'}"><div class="meter-head"><span>${label}</span><b>${value.toFixed(1)}${unit} / ${max.toFixed(1)}${unit}</b></div><div class="track"><i style="width:${width}%"></i></div></div>`;
}
function allowed(control) {
  return state.mode !== 'crew' || CREW_ROLES[state.role].controls.includes(control);
}
function locked(control) { return false; }
function cardGroup(title, control, entries, selected, line, multi = false) {
  const disabled = locked(control);
  return `<section class="panel ${disabled ? 'is-locked' : ''}"><div class="section-head"><div><p class="eyebrow">CONFIGURATION</p><h2>${title}</h2></div><span class="owner">${state.mode === 'crew' ? esc(Object.values(CREW_ROLES).find(r => r.controls.includes(control))?.name || 'Crew') : 'Mission design'}</span></div><div class="choice-grid">${Object.entries(entries).map(([id, item]) => {
    const active = multi ? selected.includes(id) : selected === id;
    return `<button class="choice ${active ? 'selected' : ''}" data-control="${control}" data-value="${id}" data-multi="${multi}" ${disabled ? 'disabled' : ''} aria-pressed="${active}"><span class="choice-title">${esc(item.name)}</span><span class="choice-meta">${esc(line(item))}</span><span class="choice-desc">${esc(item.description || '')}</span></button>`;
  }).join('')}</div></section>`;
}
function selectField(label, control, entries, selected) {
  return `<label class="field"><span>${label}</span><select data-control="${control}" ${locked(control) ? 'disabled' : ''}>${Object.entries(entries).map(([id, item]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>`;
}
function engineeringPanel() {
  let a; try { a = analyzeEngineering(state.design, state.engineering); } catch (error) { return `<section class="panel engineering-panel"><h2>Engineering input needs correction</h2><p class="muted">${esc(error.message)}. Restore the last valid value and try again.</p></section>`; }
  const inp = state.engineering;
  const number = (label, path, value, step = 'any', min = '0.000001', max = '') => `<label class="eng-field"><span>${label}</span><input type="number" min="${min}" ${max!==''?`max="${max}"`:''} step="${step}" data-eng="${path}" value="${value}"></label>`;
  const metric = (label, value, unit) => `<div class="eng-metric"><small>${label}</small><b>${value} ${unit}</b></div>`;
  return `<section class="panel engineering-panel"><div class="section-head"><div><p class="eyebrow">PRELIMINARY ENGINEERING ANALYSIS</p><h2>Physics, budgets & reliability</h2></div><span class="owner">Transparent analytical models</span></div>
    <p class="muted">Inputs are editable. Results use stated equations and assumptions; they are not flight-qualified predictions.</p>
    <div class="engineering-grid">
      <div class="eng-card"><h3>Orbital transfer · Hohmann</h3><p>Coplanar circular heliocentric orbit approximation</p>${number('Departure radius (AU)','transfer.departureAU',inp.transfer.departureAU,0.0001)}${number('Arrival radius (AU)','transfer.arrivalAU',inp.transfer.arrivalAU,0.0001)}${number('Mission propulsion Δv budget (km/s)','transfer.propulsiveDeltaVKmS',inp.transfer.propulsiveDeltaVKmS,0.01)}${number('Engine specific impulse (s)','transfer.ispS',inp.transfer.ispS,1)}${number('Dry mass (kg)','transfer.dryMassKg',inp.transfer.dryMassKg,1)}${number('Propellant available (kg)','transfer.propellantMassKg',inp.transfer.propellantMassKg,1)}<div class="eng-results">${metric('Ideal Hohmann Δv',a.transfer.totalDeltaV.toFixed(3),'km/s')}${metric('Transfer time',(a.transfer.transferTimeS/86400).toFixed(1),'days')}${metric('Ideal propellant needed',a.propulsion.requiredPropellantKg.toFixed(1),'kg')}</div><p class="muted">Rocket equation budget: ${a.propulsion.feasibleIdeal?'ideal propellant mass is sufficient':'ideal propellant mass is insufficient'} (before losses and reserves).</p><small class="muted">Does not include planetary injection/capture, inclination, launch window or n-body perturbations.</small></div>
      <div class="eng-card"><h3>Electrical power</h3><p>Solar flux, array orientation, degradation and eclipse battery sizing</p>${number('Array area (m²)','power.arrayAreaM2',inp.power.arrayAreaM2,0.1)}${number('Cell efficiency (0–1)','power.cellEfficiency',inp.power.cellEfficiency,0.01,'0','1')}${number('System derating (0–1)','power.systemDerating',inp.power.systemDerating,0.01,'0','1')}${number('Incidence angle (deg)','power.incidenceDeg',inp.power.incidenceDeg,1,'-90','90')}${number('Array degradation / year (0–1)','power.degradationPerYear',inp.power.degradationPerYear,0.001,'0','0.99')}${number('Mission age (years)','power.missionYears',inp.power.missionYears,0.1,'0')}${number('Load (W)','power.loadW',inp.power.loadW,1)}${number('Eclipse fraction (0–1)','power.eclipseFraction',inp.power.eclipseFraction,0.01,'0','0.99')}${number('Eclipse duration (h)','power.eclipseHours',inp.power.eclipseHours,0.1)}${number('Battery depth of discharge (0–1)','power.batteryDoD',inp.power.batteryDoD,0.01,'0.01','1')}${number('Battery efficiency (0–1)','power.batteryEfficiency',inp.power.batteryEfficiency,0.01,'0.01','1')}<div class="eng-results">${metric('Array output',a.solar.outputW.toFixed(1),'W')}${metric('Power margin',a.power.marginW.toFixed(1),'W')}${metric('Battery energy',a.power.batteryRequiredWh.toFixed(1),'Wh')}</div></div>
      <div class="eng-card"><h3>RF downlink · Friis + Eb/N₀</h3><p>Ideal free-space link estimate; add mission-specific losses and verified ground-station data.</p>${number('Range (km)','comms.rangeKm',inp.comms.rangeKm,1000)}${number('RF power (W)','comms.txPowerW',inp.comms.txPowerW,1)}${number('Frequency (GHz)','comms.frequencyGHz',inp.comms.frequencyGHz,0.1)}${number('Spacecraft antenna gain (dBi)','comms.txGainDbi',inp.comms.txGainDbi,0.1,'-20')}${number('Ground dish diameter (m)','comms.groundDishM',inp.comms.groundDishM,0.1)}${number('Ground efficiency (0–1)','comms.groundEfficiency',inp.comms.groundEfficiency,0.01,'0.01','1')}${number('Ground noise temperature (K)','comms.groundNoiseTempK',inp.comms.groundNoiseTempK,1)}${number('Miscellaneous losses (dB)','comms.miscLossDb',inp.comms.miscLossDb,0.1,'0')}${number('Bandwidth (Hz)','comms.bandwidthHz',inp.comms.bandwidthHz,100)}${number('Data rate (bit/s)','comms.dataRateBps',inp.comms.dataRateBps,100)}${number('Required Eb/N₀ (dB)','comms.requiredEbN0Db',inp.comms.requiredEbN0Db,0.1,'-20')}<div class="eng-results">${metric('C/N₀',a.comms.cn0DbHz.toFixed(1),'dB-Hz')}${metric('Eb/N₀ margin',a.comms.marginDb.toFixed(2),'dB')}${metric('FSPL',a.comms.fsplDb.toFixed(1),'dB')}</div><small class="muted">Not a complete DSN link budget: pointing, polarization, atmospheric, implementation, coding and availability losses need mission data.</small></div>
      <div class="eng-card"><h3>Reliability & FDIR review</h3><p>Exponential failure model; MTBF and redundancy are editable assumptions.</p>${Object.keys(inp.reliability.mtbfHours).map(k=>`${number(`${k} MTBF (h)`,`reliability.mtbfHours.${k}`,inp.reliability.mtbfHours[k],100)}${number(`${k} parallel units`,`reliability.redundancy.${k}`,inp.reliability.redundancy[k],1,'1')}`).join('')}${number('Fault detection coverage (0–1)','reliability.detectionCoverage',inp.reliability.detectionCoverage,0.01,'0','1')}${number('Recovery coverage (0–1)','reliability.recoveryCoverage',inp.reliability.recoveryCoverage,0.01,'0','1')}<div class="eng-results">${metric('Series reliability',(a.reliability.seriesReliability*100).toFixed(3),'%')}${metric('With FDIR estimate',(a.reliability.seriesWithFdirEstimate*100).toFixed(3),'%')}</div><div class="fmea-list">${a.faults.map(f=>`<article class="fmea-item"><b>${f.subsystem}</b><span class="${f.redundancy===1?'text-bad':'text-good'}">${f.redundancy===1?'Single string':'Redundant ×'+f.redundancy}</span><small>Detect: ${f.detection}</small><small>Isolate: ${f.isolation}</small><small>Recover: ${f.recovery}</small><small class="muted">Action: ${f.recommendation}</small></article>`).join('')}</div></div>
    </div>
    <div class="finding-list"><h3>Fault injection test</h3><div class="team-actions"><label class="eng-field"><span>Inject primary failure</span><select id="fault-subsystem"><option value="power">Power</option><option value="computer">Computer</option><option value="transmitter">Transmitter</option><option value="attitude">Attitude control</option></select></label><button class="ghost small" data-action="fault-inject">Run FDIR walkthrough</button></div></div><div class="finding-list"><h3>Automated engineering findings</h3>${a.findings.map(f=>`<div class="finding ${f.severity}"><b>${f.severity.toUpperCase()} · ${f.title}</b><small>${f.detail}</small></div>`).join('')}</div>
  </section>`;
}

function advancedEngineeringPanel() {
  const orbit = circularEarthOrbit(state.advanced.altitudeKm);
  const duration = orbit.periodS * 1.5;
  let propagation;
  try { propagation = propagateTwoBody({ initialState: orbit.initialState, durationS: duration, stepS: state.advanced.stepS, maxPoints: 3000 }); }
  catch (e) { return `<section class="panel advanced-panel"><h2>Orbit propagation input error</h2><p class="muted">${esc(e.message)}</p></section>`; }
  const points = propagation.points;
  const maxR = Math.max(...points.map(p=>Math.hypot(p.x,p.y)), orbit.radiusM) * 1.08;
  const scale = 145 / maxR;
  const path = points.map((p,i)=>`${i?'L':'M'} ${(180+p.x*scale).toFixed(2)} ${(180-p.y*scale).toFixed(2)}`).join(' ');
  const craft = points.at(-1);
  const thermal = singleNodeThermalEquilibrium(state.advanced.thermal);
  const eng = analyzeEngineering(state.design,state.engineering);
  const faultTree = evaluateFaultTree({ gate:'OR', probabilities:eng.reliability.components.map(c=>c.residualFailureProbability) });
  const fmea = scoreFmea([
    {failureMode:'Primary power channel failure',effect:'Loss of bus power',severity:9,occurrence:4,detectability:3,mitigation:'Independent power string; undervoltage monitor; load shedding'},
    {failureMode:'Flight computer reset',effect:'Loss of command execution',severity:8,occurrence:3,detectability:2,mitigation:'Watchdog, redundant lane and verified safe mode'},
    {failureMode:'Downlink transmitter failure',effect:'Loss of science data return',severity:7,occurrence:4,detectability:4,mitigation:'Redundant RF chain and low-rate beacon'}
  ]);
  const metric = (label,value,unit) => `<div class="eng-metric"><small>${label}</small><b>${value} ${unit}</b></div>`;
  const n = (label,key,value,step,min='0.0001',max='') => `<label class="eng-field"><span>${label}</span><input type="number" min="${min}" ${max!==''?`max="${max}"`:''} step="${step}" data-adv="${key}" value="${value}"></label>`;
  return `<section class="panel advanced-panel"><div class="section-head"><div><p class="eyebrow">ADVANCED ANALYSIS WORKBENCH</p><h2>Orbit, thermal & failure engineering</h2></div><span class="owner">Numerical models · SI units</span></div>
    <p class="muted">These are transparent preliminary models. The orbit propagator integrates a point-mass, Earth-centred two-body equation with fixed-step RK4. It does not include J2, drag, third bodies, SRP, attitude dynamics or ephemerides.</p>
    <div class="advanced-grid">
      <div class="eng-card orbit-card"><h3>Earth orbit propagator · RK4</h3><p>Set a circular-orbit altitude and integration step. The trajectory is integrated from the Cartesian initial state and drawn below.</p>${n('Altitude above mean Earth radius (km)','altitudeKm',state.advanced.altitudeKm,10,'100','100000')}${n('Integrator step (s)','stepS',state.advanced.stepS,1,'0.1','300')}
        <div class="orbit-visual"><svg viewBox="0 0 360 360" role="img" aria-label="Numerically propagated Earth-centred spacecraft orbit"><defs><radialGradient id="earthGrad"><stop offset="0%" stop-color="#3f9bc2"/><stop offset="100%" stop-color="#123c67"/></radialGradient></defs><circle cx="180" cy="180" r="${(ADVANCED_CONSTANTS.EARTH_MEAN_RADIUS_M*scale).toFixed(2)}" fill="url(#earthGrad)" stroke="#5ba8c8" stroke-width="1.5"/><circle cx="180" cy="180" r="${(orbit.radiusM*scale).toFixed(2)}" fill="none" stroke="#46617d" stroke-dasharray="3 5"/><path d="${path}" fill="none" stroke="#69e7c6" stroke-width="2.5"/><circle cx="${(180+craft.x*scale).toFixed(2)}" cy="${(180-craft.y*scale).toFixed(2)}" r="5" fill="#ffe08a" stroke="#fff" stroke-width="1.5"/><text x="180" y="184" text-anchor="middle" fill="#d6efff" font-size="10">EARTH</text></svg><div class="orbit-legend"><span><i class="legend-earth"></i> Earth reference sphere</span><span><i class="legend-path"></i> RK4 propagated path</span><span><i class="legend-craft"></i> Final spacecraft state</span></div></div>
        <div class="eng-results">${metric('Circular speed',(orbit.circularSpeedMps/1000).toFixed(3),'km/s')}${metric('Orbital period',orbit.periodMinutes.toFixed(2),'min')}${metric('Samples',String(propagation.samples),'points')}</div><div class="finding ${propagation.relativeSpecificEnergyDrift<1e-7?'info':'warning'}"><b>Numerical energy drift</b><small>${propagation.relativeSpecificEnergyDrift.toExponential(3)} relative specific-energy drift over ${((duration/3600)).toFixed(2)} h. This is a numerical diagnostic, not total orbit accuracy.</small></div>
      </div>
      <div class="eng-card"><h3>Single-node thermal equilibrium</h3><p>Steady-state balance: absorbed solar + internal dissipation = emitted infrared radiation.</p>${n('Solar distance (AU)','thermal.solarDistanceAU',state.advanced.thermal.solarDistanceAU,0.01)}${n('Projected solar area (m²)','thermal.projectedAreaM2',state.advanced.thermal.projectedAreaM2,0.1)}${n('Radiating area (m²)','thermal.radiatingAreaM2',state.advanced.thermal.radiatingAreaM2,0.1)}${n('Solar absorptivity (0–1)','thermal.solarAbsorptivity',state.advanced.thermal.solarAbsorptivity,0.01,'0.01','1')}${n('IR emissivity (0–1)','thermal.infraredEmissivity',state.advanced.thermal.infraredEmissivity,0.01,'0.01','1')}${n('Internal dissipation (W)','thermal.internalHeatW',state.advanced.thermal.internalHeatW,1)}${n('View factor to deep space (0–1)','thermal.viewFactorToDeepSpace',state.advanced.thermal.viewFactorToDeepSpace,0.01,'0.01','1')}<div class="eng-results">${metric('Equilibrium temperature',thermal.equilibriumK.toFixed(1),'K')}${metric('Temperature',thermal.equilibriumC.toFixed(1),'°C')}${metric('Absorbed solar',thermal.absorbedSolarW.toFixed(1),'W')}</div><p class="muted">${thermal.assumptions.join(' · ')}. Not a multi-node thermal network or flight thermal qualification.</p></div>
      <div class="eng-card"><h3>Fault tree · top-event probability</h3><p>Illustrative OR gate: top event occurs if any modeled subsystem failure occurs. Assumes independent events over the same mission interval.</p><div class="eng-results">${metric('Top-event probability',(faultTree.topEventProbability*100).toFixed(3),'%')}${metric('Basic events',String(faultTree.basicEventProbabilities.length),'subsystems')}${metric('Gate',faultTree.gate,'logic')}</div><div class="fault-tree"><div class="fault-top">TOP EVENT · Mission-critical function loss</div><div class="fault-connector"></div><div class="fault-gate">OR</div><div class="fault-branches">${eng.reliability.components.map(c=>`<div><b>${esc(c.name)}</b><small>${(c.residualFailureProbability*100).toFixed(2)}% probability</small></div>`).join('')}</div></div><p class="muted">This is a simple independent-event gate, not a complete fault tree. Shared power, software, environment and common-cause events are not modeled.</p></div>
      <div class="eng-card"><h3>FMEA screening worksheet</h3><p>Severity × occurrence × detectability (1–10). RPN ranks review priority; it is not a failure probability.</p><div class="fmea-list">${fmea.map(f=>`<article class="fmea-item"><b>${esc(f.failureMode)}</b><span class="${f.priority==='High'?'text-bad':f.priority==='Medium'?'text-warn':'text-good'}">RPN ${f.rpn} · ${f.priority} priority</span><small>Effect: ${esc(f.effect)}</small><small>Mitigation: ${esc(f.mitigation)}</small></article>`).join('')}</div><p class="muted">Screening examples only. Engineering team must replace ratings with documented, reviewed mission-specific values.</p></div>
    </div>
  </section>`;
}

function collaborationPanel() {
  const teamOptions = state.teams.map(t=>`<option value="${t.id}" ${state.activeTeam?.id===t.id?'selected':''}>${esc(t.name)} · ${esc(t.role)}</option>`).join('');
  return `<section class="panel collaboration-panel"><div class="section-head"><div><p class="eyebrow">REAL MULTI-USER WORKSPACE</p><h2>Mission team collaboration</h2></div><span class="owner">${isCollaborationConfigured?'':'Setup required'}</span></div>
    ${!isCollaborationConfigured?``:`${state.user?`<div class="team-auth"><span class="muted">Signed in as ${esc(state.user.email||'account')}</span><button class="ghost" data-action="team-signout">Sign out</button></div><div class="team-actions"><label class="eng-field"><span>Team name</span><input id="team-name" placeholder="e.g. Europa Science Team"></label><button class="primary small" data-action="team-create">Create team</button><label class="eng-field"><span>Your teams</span><select id="active-team">${teamOptions||'<option value="">No teams yet</option>'}</select></label><button class="ghost small" data-action="team-load">Open team</button></div>${state.activeTeam?`<div class="team-roster"><b>Team members (${state.members?.length||0})</b>${(state.members||[]).map(m=>`<div class="team-member"><span>${esc(m.profile?.display_name||m.profile?.email||m.user_id.slice(0,8))}</span><small>${esc(m.role.replaceAll('_',' '))} · ${esc(m.profile?.email||'')}</small></div>`).join('')}</div><div class="team-actions"><label class="eng-field"><span>Invitee email address</span><input id="invite-email" type="email" placeholder="teammate@example.com"></label><label class="eng-field"><span>Invite role</span><select id="invite-role"><option value="spacecraft_engineer">Spacecraft Engineer</option><option value="science_lead">Science Lead</option><option value="flight_operations">Flight Operations</option><option value="mission_architect">Mission Architect</option></select></label><button class="primary small" data-action="team-invite">Generate invite link</button></div>${state.inviteLink?`<div class="invite-output"><input readonly value="${esc(state.inviteLink)}"><button class="ghost" data-action="copy-invite">Copy invite</button></div>`:''}<p class="muted">Active team: ${esc(state.activeTeam.name)} · Changes sync to team members after save.</p><button class="primary small" data-action="team-save">Save current design to shared workspace</button>`:''}`:`<div class="auth-grid"><label class="eng-field"><span>Email</span><input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com"></label><label class="eng-field"><span>Password</span><input id="auth-password" type="password" autocomplete="current-password" minlength="8" placeholder="At least 8 characters"></label><label class="eng-field"><span>Display name (sign-up)</span><input id="auth-name" placeholder="Your name"></label></div><div class="team-actions"><button class="primary small" data-action="team-signin">Sign in</button><button class="ghost small" data-action="team-signup">Create account</button></div>`}`}
    </section>`;
}

function render() {
  const d = state.design;
  const c = calculate(d);
  const passCount = c.checks.filter(x => x.pass).length;
  $('#app').innerHTML = `
    <header class="topbar"><a class="brand" href="#"><span class="brand-mark">MF</span><span>MISSION FORGE<small>SPACE MISSION DESIGN LAB</small></span></a><div class="top-actions"><span class="status"><i></i> DESIGN ENVIRONMENT</span><button class="ghost" data-action="save">Save design</button><button class="ghost" data-action="share">Share design</button></div></header>
    <main class="layout">
      <section class="workspace">
        <div class="hero"><div><p class="eyebrow">MISSION ARCHITECTURE WORKBENCH</p><h1>Build a mission.<br><em>Balance every trade-off.</em></h1><p class="hero-copy">Design a spacecraft around a scientific objective. Every instrument changes mass, power demand, data volume, risk and cost.</p></div><div class="hero-orbit" aria-hidden="true"><div class="planet"></div><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><span class="satellite">✦</span></div></div>
        <div class="toolbar"><div><span class="eyebrow">MISSION SCENARIO</span><strong>${esc(SCENARIOS[d.scenario].name)}</strong><small>${esc(SCENARIOS[d.scenario].hint)}</small></div><div class="toolbar-fields">${selectField('Scenario', 'scenario', SCENARIOS, d.scenario)}<label class="field"><span>Mission lifetime</span><select data-control="lifetime" ${locked('lifetime') ? 'disabled' : ''}>${[6,12,18,24,30,36,42,48].map(n => `<option value="${n}" ${d.lifetime === n ? 'selected' : ''}>${n} months</option>`).join('')}</select></label></div></div>
        ${cardGroup('Scientific objective', 'objective', OBJECTIVES, d.objective, x => `${DESTINATIONS[x.destination].name} · ${x.minMonths}+ months`)}
        ${cardGroup('Destination', 'destination', DESTINATIONS, d.destination, x => `${x.au.toFixed(2)} AU from Sun · ${x.radiation}× environment`)}
        ${cardGroup('Orbit / operating location', 'orbit', ORBITS, d.orbit, x => `${Math.round(x.capacityFactor * 100)}% game payload factor · ${x.scienceBonus.toFixed(2)}× science factor`)}
        ${cardGroup('Launch vehicle', 'launcher', LAUNCHERS, d.launcher, x => `${money(x.cost)} · ${x.leoKg.toLocaleString()} kg to reference orbit`)}
        ${cardGroup('Power subsystem', 'power', POWER, d.power, x => `${money(x.cost)} · ${x.mass} kg · ${x.wattsAt1Au} W at 1 AU`)}
        ${cardGroup('Communications subsystem', 'communications', COMMUNICATIONS, d.communications, x => `${money(x.cost)} · ${x.mass} kg · ${x.rateAt1Au} Gb/day at 1 AU (proxy)`)}
        <section class="panel ${locked('shield') ? 'is-locked' : ''}"><div class="section-head"><div><p class="eyebrow">ENGINEERING MITIGATION</p><h2>Radiation protection</h2></div><span class="owner">Spacecraft Engineer</span></div><button class="toggle-card ${d.shield ? 'selected' : ''}" data-control="shield" ${locked('shield') ? 'disabled' : ''}><span><b>${d.shield ? 'Shield package installed' : 'No additional shield package'}</b><small>Game assumption: +42 kg, +$24M. Reduces modeled risk; does not eliminate radiation exposure.</small></span><span class="switch">${d.shield ? 'ON' : 'OFF'}</span></button></section>
        ${cardGroup('Science payload', 'instruments', INSTRUMENTS, d.instruments, x => `${money(x.cost)} · ${x.mass} kg · ${x.watts} W · ${x.dataGbDay} Gb/day`, true)}
        ${engineeringPanel()}
        ${advancedEngineeringPanel()}
        ${collaborationPanel()}
        <div class="bottom-actions"><button class="ghost" data-action="reset">Reset design</button><button class="primary launch" data-action="simulate" ${(!c.hardPass || (state.mode === 'crew' && Object.keys(CREW_ROLES).some(k => !state.approvals[k]))) ? 'disabled' : ''}>Run game scenario simulation <span>↗</span></button></div>
      </section>
      <aside class="sidebar">
        <section class="dash-card"><div class="dash-head"><div><p class="eyebrow">LIVE TELEMETRY</p><h2>Mission health</h2></div><span class="score-badge">${c.score}<small>/100</small></span></div><div class="health-line"><span>${passCount} of ${c.checks.length} constraints passed</span><b>${c.hardPass ? 'READY CHECK' : 'ACTION REQUIRED'}</b></div><div class="progress"><i style="width:${passCount / c.checks.length * 100}%"></i></div>
          ${meter('Program cost', c.cost, c.scenario.budget, 'M', true)}${meter('Spacecraft mass', c.mass, c.payloadCapacity, ' kg', true)}${meter('Power generated', c.powerGenerated, c.powerUsed, ' W')}${meter('Data return capacity', c.downlinkCapacity, c.dataGenerated, ' Gb/day')}${meter('Science potential', c.sciencePotential, c.objective.scienceTarget, ' pts')}
          <div class="stat-grid"><div><small>ONE-WAY LIGHT TIME</small><b>${c.oneWayLightTimeMin < 1 ? `${(c.oneWayLightTimeMin * 60).toFixed(1)} sec` : `${c.oneWayLightTimeMin.toFixed(1)} min`}</b></div><div><small>RADIATION RISK INDEX</small><b>${c.radiationRisk}/100</b></div><div><small>POWER MARGIN</small><b>${c.powerMargin.toFixed(0)} W</b></div><div><small>DATA GENERATED</small><b>${c.dataGenerated.toFixed(2)} Gb/day</b></div></div>
        </section>
        <section class="dash-card"><p class="eyebrow">FLIGHT READINESS REVIEW</p><h2>Constraint checks</h2><div class="checks">${c.checks.map(x => `<div class="check ${x.pass ? 'pass' : 'fail'}"><span>${x.pass ? '✓' : '!'}</span><div><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div></div>`).join('')}</div></section>
        <section class="dash-card insight"><p class="eyebrow">ENGINEERING NOTE</p><h2>Why this matters</h2><p>${esc(OBJECTIVES[d.objective].description)}</p><p class="muted">${esc(DESTINATIONS[d.destination].description)}</p><div class="formula">Solar output ∝ 1 / distance²</div><small class="muted">The solar-distance relationship follows the inverse-square law. Other values are explicitly simplified game-model estimates.</small></section>
        <section class="dash-card"><p class="eyebrow">DESIGN TOOLS</p><div class="tool-buttons"><button class="ghost full" data-action="export">Export design JSON</button><button class="ghost full" data-action="report">Preview engineering report</button><button class="ghost full" data-action="compare">Compare with baseline</button></div></section>
      </aside>
    </main>
    <div id="modal-root"></div><div class="toast ${state.toast ? 'show' : ''}">${esc(state.toast)}</div>
    <footer>MISSION FORGE <span>PRELIMINARY ANALYSIS · NOT FLIGHT-QUALIFIED ENGINEERING SOFTWARE</span></footer>`;
}

function invalidateApprovals() { state.approvals = {}; state.report = null; }
function setControl(control, value, multi) {
  if (control === 'mode') { state.mode = value; invalidateApprovals(); return; }
  if (control === 'role') { state.role = value; return; }
  if (state.mode === 'crew' && !allowed(control)) { notify('This subsystem is assigned to another crew role.'); return; }
  if (multi) {
    const set = new Set(state.design.instruments);
    set.has(value) ? set.delete(value) : set.add(value);
    state.design.instruments = [...set];
  } else if (control === 'shield') state.design.shield = !state.design.shield;
  else if (control === 'lifetime') state.design.lifetime = Number(value);
  else state.design[control] = value;
  if (control === 'destination') { const defaults = defaultEngineeringInputs(value); state.engineering.transfer.arrivalAU = defaults.transfer.arrivalAU; state.engineering.comms.rangeKm = defaults.comms.rangeKm; }
  invalidateApprovals();
}
function notify(message) { state.toast = message; render(); setTimeout(() => { state.toast = ''; const t = $('.toast'); if (t) t.classList.remove('show'); }, 2400); }
function persist() { localStorage.setItem(saveKey, JSON.stringify({ design: state.design, mode: state.mode, engineering: state.engineering, advanced: state.advanced })); }
function exportFile(filename, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function reportText(r) {
  const eng = analyzeEngineering(state.design,state.engineering);
  return `MISSION FORGE — PRELIMINARY ENGINEERING REVIEW
Generated: ${new Date().toISOString()}

MISSION CONFIGURATION
Objective: ${r.objective.name}
Destination: ${r.destination.name}
Orbit: ${r.orbit.name}
Mission lifetime: ${state.design.lifetime} months

LEGACY TRADE-STUDY LAYER (ILLUSTRATIVE)
Estimated cost: $${r.cost}M
Scenario budget: $${r.scenario.budget}M
Spacecraft mass: ${r.mass.toFixed(1)} kg
Modeled payload capacity: ${r.payloadCapacity.toFixed(1)} kg
Legacy science score: ${r.sciencePotential} / ${r.objective.scienceTarget}

ANALYTICAL MODEL RESULTS
Heliocentric Hohmann Δv: ${eng.transfer.totalDeltaV.toFixed(4)} km/s (ideal two-body model)
Hohmann transfer time: ${(eng.transfer.transferTimeS/86400).toFixed(2)} days
Ideal rocket-equation propellant required: ${eng.propulsion.requiredPropellantKg.toFixed(2)} kg
Solar array output: ${eng.solar.outputW.toFixed(2)} W
Solar power margin: ${eng.power.marginW.toFixed(2)} W
Battery energy estimate: ${eng.power.batteryRequiredWh.toFixed(2)} Wh
Downlink Eb/N0 margin: ${eng.comms.marginDb.toFixed(2)} dB
Series reliability estimate: ${(eng.reliability.seriesReliability*100).toFixed(4)}%
Simplified FDIR-adjusted estimate: ${(eng.reliability.seriesWithFdirEstimate*100).toFixed(4)}%

ADVANCED ANALYSIS (PRELIMINARY)
Earth circular orbit altitude: ${state.advanced.altitudeKm.toFixed(1)} km
RK4 step: ${state.advanced.stepS.toFixed(2)} s
Circular orbital speed: ${(circularEarthOrbit(state.advanced.altitudeKm).circularSpeedMps/1000).toFixed(5)} km/s
Circular orbital period: ${(circularEarthOrbit(state.advanced.altitudeKm).periodMinutes).toFixed(4)} min
Single-node equilibrium temperature: ${singleNodeThermalEquilibrium(state.advanced.thermal).equilibriumK.toFixed(2)} K

FAULT REVIEW
${eng.faults.map(f=>`${f.subsystem}: ${f.redundancy} parallel unit(s); ${f.recommendation}`).join('\n')}

LEGACY CONSTRAINTS
${r.checks.map(x => `${x.pass ? 'PASS' : 'FAIL'} — ${x.label}: ${x.detail}`).join('\n')}

MODEL LIMITATIONS
The legacy score, costs, launcher capacities, science points and radiation index remain game assumptions. The analytical modules implement idealized two-body Hohmann transfer, ideal Tsiolkovsky rocket equation, first-order solar-array power, Friis free-space downlink and exponential reliability. Results depend on user-supplied assumptions. They omit mission-specific perturbations, planetary ephemerides, launch windows, finite-burn and propulsion losses, battery aging and thermal constraints, complete RF link budgets, common-cause failures, verified component reliability data and validated FDIR hardware/software. This project is for preliminary studies and education; it is not flight-qualified and must not be used as the sole basis for a real spacecraft design or safety decision.
`;
}
function openModal(title, body) { $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="modal-close" data-action="close-modal" aria-label="Close">×</button><p class="eyebrow">MISSION FORGE</p><h2>${esc(title)}</h2>${body}</section></div>`; }
function runSimulation() {
  const r = simulate(state.design); state.report = r;
  let scores = []; try { scores = JSON.parse(localStorage.getItem(bestKey) || '[]'); } catch { scores = []; }
  scores.push({ score: r.finalScore, objective: r.objective.name, success: r.success, date: new Date().toISOString() });
  scores.sort((a,b) => b.score - a.score); scores = scores.slice(0, 5); localStorage.setItem(bestKey, JSON.stringify(scores));
  const events = r.events.map(e => `<div class="event ${e.success ? 'pass' : 'fail'}"><b>${e.success ? '✓' : '×'} ${esc(e.name)}</b><p>${esc(e.text)}</p></div>`).join('') || '<p class="muted">No major events were triggered in this run.</p>';
  const recommendations = r.recommendations.length ? `<h3>Recommended redesign actions</h3><ul>${r.recommendations.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="success-note">All modeled constraints and the science target were achieved.</p>';
  openModal('Mission simulation report', `<div class="report-score"><strong>${r.finalScore}</strong><span>/100</span><b class="${r.success ? 'text-good' : 'text-bad'}">${r.success ? 'MISSION SUCCESS' : 'MISSION NEEDS REDESIGN'}</b></div><p>${r.success ? 'The mission met the modeled requirements and completed the simulated flight review.' : 'The design did not meet all modeled mission success conditions. Review the findings and iterate.'}</p><h3>Flight events</h3>${events}<h3>Mission constraints</h3><div class="checks">${r.checks.map(x => `<div class="check ${x.pass ? 'pass' : 'fail'}"><span>${x.pass ? '✓' : '!'}</span><div><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div></div>`).join('')}</div>${recommendations}<div class="modal-actions"><button class="ghost" data-action="download-report">Download report</button><button class="primary" data-action="close-modal">Return to design</button></div><p class="fine-print">Simulation is deterministic for an identical design. Event outcomes are illustrative, not predictions of actual spacecraft behavior.</p>`);
}
function baselineComparison() {
  const baseline = defaultDesign(); const a = calculate(baseline); const b = calculate(state.design);
  const rows = [['Cost', money(a.cost), money(b.cost)], ['Mass', `${a.mass} kg`, `${b.mass} kg`], ['Power balance', `${a.powerMargin.toFixed(0)} W`, `${b.powerMargin.toFixed(0)} W`], ['Data return', `${Math.round(a.dataReturnRatio*100)}%`, `${Math.round(b.dataReturnRatio*100)}%`], ['Science potential', `${a.sciencePotential} pts`, `${b.sciencePotential} pts`], ['Readiness checks', `${a.checks.filter(x=>x.pass).length}/${a.checks.length}`, `${b.checks.filter(x=>x.pass).length}/${b.checks.length}`]];
  openModal('Design comparison', `<p class="muted">Your current configuration compared with the default starter mission.</p><table class="compare-table"><thead><tr><th>Metric</th><th>Starter design</th><th>Current design</th></tr></thead><tbody>${rows.map(row => `<tr>${row.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="modal-actions"><button class="primary" data-action="close-modal">Close comparison</button></div>`);
}

$('#app').addEventListener('click', (event) => {
  const control = event.target.closest('[data-control]');
  const action = event.target.closest('[data-action]');
  if (control) {
    const key = control.dataset.control;
    if (key === 'shield') setControl(key);
    else if (key === 'instruments') setControl(key, control.dataset.value, true);
    else if (control.tagName === 'BUTTON') setControl(key, control.dataset.value, control.dataset.multi === 'true');
    else return;
    render(); return;
  }
  if (!action) return;
  const runAsyncAction = async () => {
  switch (action.dataset.action) {
    case 'fault-inject': { const result=injectSingleFault(analyzeEngineering(state.design,state.engineering).reliability,$('#fault-subsystem').value); const timeline=result.timeline.map(x=>`<div class="check ${result.recovered?'pass':'fail'}"><span>•</span><div><b>${esc(x.phase)}</b><small>${esc(x.action)}</small></div></div>`).join(''); openModal('Fault injection walkthrough', `<p class="muted">Deterministic logic walkthrough, not a prediction of actual flight hardware behavior.</p><div class="checks">${timeline}</div><p class="${result.recovered?'success-note':'text-bad'}">${result.recovered?'Modeled recovery succeeded with reduced redundancy.':'Modeled recovery did not restore the failed function.'}</p><div class="modal-actions"><button class="primary" data-action="close-modal">Close</button></div>`); break; }
    case 'team-signup': {
      try { await signUp($('#auth-email').value.trim(), $('#auth-password').value, $('#auth-name').value.trim()); await refreshTeamsAndRedeemInvite(); notify('Account created. Check your email if confirmation is enabled.'); render(); } catch(e) { notify(e.message); } break;
    }
    case 'team-signin': {
      try { await signIn($('#auth-email').value.trim(), $('#auth-password').value); await refreshTeamsAndRedeemInvite(); render(); } catch(e) { notify(e.message); } break;
    }
    case 'team-signout': {
      try { if(state.unsubscribeMission) state.unsubscribeMission(); await signOut(); state.user=null; state.teams=[]; state.members=[]; state.activeTeam=null; state.inviteLink=''; render(); } catch(e) { notify(e.message); } break;
    }
    case 'team-create': {
      try { const id=await createTeam($('#team-name').value.trim()); state.teams=await myTeams(); state.activeTeam=state.teams.find(t=>t.id===id)||state.teams[0]; state.members=await teamMembers(id); await loadMission(id); if(state.unsubscribeMission) state.unsubscribeMission(); state.unsubscribeMission=subscribeMission(id,row=>{if(row?.design){state.design={...defaultDesign(),...row.design};render();notify('Shared mission updated by a teammate.');}}); render(); notify('Team created.'); } catch(e) { notify(e.message); } break;
    }
    case 'team-load': {
      try { const id=$('#active-team').value; state.activeTeam=state.teams.find(t=>t.id===id)||null; if(state.activeTeam){ state.members=await teamMembers(id); const row=await loadMission(id); if(row?.design && Object.keys(row.design).length) state.design={...defaultDesign(),...row.design}; if(state.unsubscribeMission) state.unsubscribeMission(); state.unsubscribeMission=subscribeMission(id,row=>{ if(row?.design){state.design={...defaultDesign(),...row.design}; render(); notify('Shared mission updated by a teammate.');} }); render(); } } catch(e) { notify(e.message); } break;
    }
    case 'team-invite': {
      try { const token=await createInvite(state.activeTeam.id,$('#invite-role').value,$('#invite-email').value.trim()); state.inviteLink=`${location.origin}${location.pathname}?join=${token}`; render(); } catch(e) { notify(e.message); } break;
    }
    case 'copy-invite': { await navigator.clipboard.writeText(state.inviteLink); notify('Invite link copied.'); break; }
    case 'team-save': {
      try { await saveMission(state.activeTeam.id,state.design); notify('Mission synchronized to the team workspace.'); } catch(e) { notify(e.message); } break;
    }
    case 'save': persist(); notify('Design saved in this browser.'); break;
    case 'share': {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(state.design))));
      const url = `${location.origin}${location.pathname}#design=${payload}`;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => notify('Share link copied.')).catch(() => openModal('Share link', `<textarea readonly>${esc(url)}</textarea>`));
      else openModal('Share link', `<textarea readonly>${esc(url)}</textarea>`);
      break;
    }
    case 'reset': state.design = defaultDesign(); invalidateApprovals(); render(); break;
    case 'approve': state.approvals[state.role] = !state.approvals[state.role]; render(); break;
    case 'simulate': runSimulation(); break;
    case 'export': exportFile('mission-forge-design.json', JSON.stringify({ design: state.design, legacyTradeStudy: calculate(state.design), engineeringInputs: state.engineering, engineeringAnalysis: analyzeEngineering(state.design,state.engineering), advancedInputs: state.advanced, advancedAnalysis: { orbit: propagateTwoBody({ initialState:circularEarthOrbit(state.advanced.altitudeKm).initialState, durationS:circularEarthOrbit(state.advanced.altitudeKm).periodS, stepS:state.advanced.stepS }), thermal: singleNodeThermalEquilibrium(state.advanced.thermal), faultTree: evaluateFaultTree({gate:'OR',probabilities:analyzeEngineering(state.design,state.engineering).reliability.components.map(c=>c.residualFailureProbability)}) } }, null, 2), 'application/json'); break;
    case 'report': { const r = calculate(state.design); openModal('Pre-flight engineering report', `<pre class="report-pre">${esc(reportText(r))}</pre><div class="modal-actions"><button class="ghost" data-action="download-report">Download report</button><button class="primary" data-action="close-modal">Close</button></div>`); break; }
    case 'download-report': exportFile('mission-forge-engineering-report.txt', reportText(state.report || calculate(state.design)), 'text/plain'); break;
    case 'compare': baselineComparison(); break;
    case 'close-modal': $('#modal-root').innerHTML = ''; break;
  }
  };
  runAsyncAction();
});
$('#app').addEventListener('change', (event) => {
  const adv = event.target.dataset.adv;
  if (adv) { const value=Number(event.target.value); if(!Number.isFinite(value)||!event.target.checkValidity()){render();return;} const parts=adv.split('.'); if(parts[0]==='thermal') state.advanced.thermal[parts[1]]=value; else state.advanced[parts[0]]=value; render(); return; }
  const eng = event.target.dataset.eng;
  if (eng) {
    const [group, key, subkey] = eng.split('.');
    const value = Number(event.target.value);
    if (Number.isFinite(value)) {
      if (!event.target.checkValidity()) { render(); return; }
      if (subkey) state.engineering[group][key][subkey] = value;
      else state.engineering[group][key] = value;
      render();
    }
    return;
  }
  if (event.target.id === 'active-team') return;
  const control = event.target.dataset.control;
  if (!control) return;
  setControl(control, event.target.value, false);
  render();
});
try { const saved = JSON.parse(localStorage.getItem(saveKey) || 'null'); if (saved?.design && !sharedDesignPresent) state.design = { ...defaultDesign(), ...saved.design }; if(saved?.engineering) state.engineering=saved.engineering; if(saved?.advanced) state.advanced=saved.advanced; } catch { /* ignore invalid local state */ }
if (sharedDesignPresent) loadShared();
render();
if (isCollaborationConfigured) {
  currentUser().then(async user => { if(user){ await refreshTeamsAndRedeemInvite(); render(); } }).catch(()=>{});
  const joinToken = new URLSearchParams(location.search).get('join');
  if (joinToken) { state.pendingInvite=joinToken; }
}

