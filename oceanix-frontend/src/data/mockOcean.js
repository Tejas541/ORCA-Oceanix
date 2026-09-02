/**
 * =============================================================================
 * OCEANIX / BLUE ORBIT — DEMO OCEAN STATE (SINGLE SOURCE OF TRUTH)
 * =============================================================================
 *
 * ALL VALUES IN THIS FILE ARE SIMULATED / HARDCODED FOR THE EDIL DEMO.
 *
 * They are NOT live ISRO satellite products (Oceansat-3, INSAT-3DR, etc.).
 * They are NOT live INCOIS PFZ, IMBL, or cyclone advisories.
 * They are NOT official hydrographic, EEZ, or maritime-boundary coordinates.
 *
 * Geometry (PFZ, IMBL, MPA, cyclone track, trawler route) is positioned so
 * the existing Kochi-centred GIS demo can later toggle layers and animate a
 * vessel. Distances and scores are internally consistent within each scenario
 * but are fictional.
 *
 * Do not treat this module as an API client. Replace it later with real feeds.
 * =============================================================================
 */

/** Shared disclaimer for UI copy if a page needs to label simulated data. */
export const DEMO_DISCLAIMER =
  'Simulated EDIL demo data — not live ISRO / INCOIS observations or official maritime boundaries.'

const META = {
  source: 'simulated-edil-demo',
  isLive: false,
  generatedFor: 'EDIL review',
  bulletinId: 'INC-O3-9821',
  bulletinDate: '2026-08-31',
  disclaimer: DEMO_DISCLAIMER,
}

/**
 * Leaflet-style [latitude, longitude] (WGS84).
 * Nautical miles used for IMBL buffer / vessel-to-boundary distance.
 */

// ---------------------------------------------------------------------------
// Scenario: Kochi (Arabian Sea / Kerala) — primary GIS + bulletin demo
// ---------------------------------------------------------------------------
export const kochiScenario = {
  id: 'kochi',
  label: 'Kochi Fishing Harbour',
  region: 'Arabian Sea — Southwest India',
  harbour: {
    name: 'Kochi Fishing Harbour',
    coordinates: [9.9312, 76.2673],
  },
  meta: { ...META, scenario: 'kochi' },

  oceanConditions: {
    waveHeight: 1.03, // metres — SIMULATED
    windSpeed: 14.9, // knots — SIMULATED
    windDirection: 'WNW', // SIMULATED
    seaState: 'Moderate', // SIMULATED (Douglas / descriptive)
    visibility: 8, // nautical miles — SIMULATED
    lightningRiskPercent: 24.9, // SIMULATED
  },

  oceanParameters: {
    sst: 27.72, // °C — SIMULATED stand-in for INSAT-3DR TIR
    chlorophyll: 2.73, // mg/m³ — SIMULATED stand-in for Oceansat-3 OCM-3
    sstGradient: 0.98, // °C / 10 km — SIMULATED
    currentSpeed: 0.45, // knots — SIMULATED
    currentDirection: 'NNW', // SIMULATED
    cloudCoverPercent: 33.0, // SIMULATED
  },

  risk: {
    safetyScore: 74.2, // 0–100 — SIMULATED composite, not a certified index
    riskLevel: 'SAFE_FOR_VENTURE',
    ventureStatusLabel: 'SAFE FOR VENTURE',
    officialDirective:
      'Normal fishing and coastal navigation permitted. (Simulated directive for demo only.)',
    riskFactors: [
      { id: 'waves', label: 'Wave height', severity: 'low', note: '1.03 m — within artisanal operating range (simulated).' },
      { id: 'wind', label: 'Wind speed', severity: 'moderate', note: '14.9 kts WNW (simulated).' },
      { id: 'lightning', label: 'Lightning risk', severity: 'moderate', note: '24.9% (simulated).' },
      { id: 'imbl', label: 'IMBL proximity', severity: 'low', note: 'Vessel remains outside the demo buffer if the route is followed (simulated).' },
    ],
  },

  pfz: {
    name: 'Alleppey Thermal Front / Off Kochi',
    targetSpecies: 'Oil Sardine / Mackerel',
    coordinates: [10.51, 75.82], // [lat, lng] — SIMULATED PFZ centroid
    radius: 20000, // metres — SIMULATED advisory radius
    depthMeters: 45,
    confidence: 98.2, // percent — SIMULATED
    bearingFromHarbourDeg: 257,
    distanceFromHarbourKm: 69.9,
    reason:
      'Simulated SST–chlorophyll frontal coincidence west of Kochi; high suitability for oil sardine (demo only).',
    additionalZones: [
      {
        name: 'Off Kannur shelf',
        targetSpecies: 'Yellowfin Tuna',
        coordinates: [11.12, 74.95],
        radius: 15000,
        depthMeters: 60,
        confidence: 89.4,
        reason: 'Simulated secondary PFZ for bulletin table (demo only).',
      },
    ],
  },

  /**
   * DEMO IMBL polyline placed west of Kerala so the trawler route can
   * approach a buffer in GIS. This is NOT the official India–Sri Lanka
   * or India–Maldives maritime boundary.
   */
  imbl: {
    name: 'Demo IMBL segment (Arabian Sea — not official geometry)',
    bufferNm: 15, // nautical miles — matches bulletin copy; SIMULATED
    distanceFromHarbourNm: 176.25, // harbour to line — SIMULATED
    coordinates: [
      [11.4, 75.15],
      [10.8, 75.22],
      [10.3, 75.28],
      [9.7, 75.35],
      [9.2, 75.42],
    ],
    restrictedAccess: true,
    alertMessage: 'Warning: Approaching IMBL Buffer Zone (simulated geofence).',
  },

  mpa: {
    name: 'Demo Kochi Shelf Eco Reserve',
    description:
      'Simulated marine protected area south-west of Kochi for GIS layer toggle. Not a notified MoEFCC / state MPA boundary.',
    coordinates: [
      [9.55, 76.05],
      [9.55, 76.28],
      [9.38, 76.28],
      [9.38, 76.05],
    ],
  },

  cyclone: {
    name: 'Demo Cyclone ARMAAN',
    category: 'Depression (sim.)',
    basin: 'Arabian Sea',
    status: 'distant-watch',
    active: false,
    note: 'Placed well west of the fishing grounds so Kochi remains SAFE_FOR_VENTURE in this scenario.',
    track: [
      [14.2, 68.1],
      [13.6, 67.4],
      [13.1, 66.8],
      [12.5, 66.2],
    ],
  },

  trawlerRoute: {
    vesselId: 'BlueFin-01',
    status: 'Navigating to PFZ',
    start: [9.9312, 76.2673],
    destination: [10.51, 75.82],
    coordinates: [
      [9.9312, 76.2673],
      [10.02, 76.05],
      [10.1, 75.8],
      [10.22, 75.62],
      [10.3, 75.5],
      [10.4, 75.62],
      [10.51, 75.82],
    ],
  },

  advisory: {
    languageDefault: 'English',
    summaryEn:
      'Simulated five-stage demo summary: At Kochi Fishing Harbour (9.9312°N, 76.2673°E), the sea conditions are moderate with waves of 1.03m and a wind speed of 14.9 kts. The safety score for sea-venture is 74.2/100 (SAFE). The Alleppey Thermal Front is approximately 69.9 km away, bearing 257° (WSW), which indicates high suitability for Oil Sardine fishing. You are currently 176.25 NM away from the demo IMBL line, maintaining safe operational compliance. (All figures simulated.)',
    queryHints: [
      'What are the sea conditions, PFZ suitability, and IMBL distance today?',
      'Nearest Tuna PFZ (Kochi)',
    ],
  },

  satelliteHealth: {
    oceansat3: { title: 'ISRO Oceansat-3 (OCM-3)', latency: '42 min', health: '98.4%' },
    insat3dr: { title: 'ISRO INSAT-3DR (TIR)', latency: '12 min', health: '99.1%' },
    sentinel3: { title: 'Copernicus Sentinel-3', latency: '88 min', health: '96.8%' },
  },
}

// ---------------------------------------------------------------------------
// Scenario: Chennai (Bay of Bengal / Tamil Nadu) — safety-focused demo
// ---------------------------------------------------------------------------
export const chennaiScenario = {
  id: 'chennai',
  label: 'Chennai Fishing Harbour',
  region: 'Bay of Bengal — Southeast India',
  harbour: {
    name: 'Chennai Fishing Harbour',
    coordinates: [13.124, 80.297],
  },
  meta: { ...META, scenario: 'chennai', bulletinId: 'INC-O3-7740' },

  oceanConditions: {
    waveHeight: 1.85,
    windSpeed: 18.4,
    windDirection: 'ENE',
    seaState: 'Moderate to Rough',
    visibility: 5,
    lightningRiskPercent: 41.0,
  },

  oceanParameters: {
    sst: 28.4,
    chlorophyll: 1.12,
    sstGradient: 0.41,
    currentSpeed: 0.72,
    currentDirection: 'NNE',
    cloudCoverPercent: 48.0,
  },

  risk: {
    safetyScore: 61.5,
    riskLevel: 'CAUTION',
    ventureStatusLabel: 'CAUTION — SHORT TRIPS ONLY',
    officialDirective:
      'Simulated caution: elevated wind and lightning. Daylight coastal operations only. (Demo only.)',
    riskFactors: [
      { id: 'waves', label: 'Wave height', severity: 'moderate', note: '1.85 m (simulated).' },
      { id: 'wind', label: 'Wind speed', severity: 'elevated', note: '18.4 kts ENE (simulated).' },
      { id: 'lightning', label: 'Lightning risk', severity: 'elevated', note: '41.0% (simulated).' },
      { id: 'imbl', label: 'IMBL proximity', severity: 'moderate', note: 'Closer to the demo Palk-adjacent IMBL line than Kochi (simulated).' },
    ],
  },

  pfz: {
    name: 'Off Pulicat Shelf Front',
    targetSpecies: 'Oil Sardine / Anchovy',
    coordinates: [13.48, 80.62],
    radius: 18000,
    depthMeters: 38,
    confidence: 81.0,
    bearingFromHarbourDeg: 52,
    distanceFromHarbourKm: 48.0,
    reason: 'Simulated weaker SST gradient north of Chennai; moderate PFZ confidence (demo only).',
    additionalZones: [
      {
        name: 'Off Mahabalipuram',
        targetSpecies: 'Seer fish',
        coordinates: [12.62, 80.55],
        radius: 12000,
        depthMeters: 42,
        confidence: 74.5,
        reason: 'Simulated secondary inshore zone (demo only).',
      },
    ],
  },

  imbl: {
    name: 'Demo IMBL segment (approaching Palk Strait — not official geometry)',
    bufferNm: 15,
    distanceFromHarbourNm: 92.0,
    coordinates: [
      [10.6, 80.05],
      [10.2, 80.15],
      [9.8, 80.22],
      [9.4, 80.18],
      [9.1, 79.85],
    ],
    restrictedAccess: true,
    alertMessage: 'Warning: Approaching IMBL Buffer Zone (simulated geofence).',
  },

  mpa: {
    name: 'Demo Pulicat–Ennore Coastal Reserve',
    description:
      'Simulated MPA polygon north of Chennai harbour for GIS layer toggle. Not an official sanctuary boundary.',
    coordinates: [
      [13.35, 80.32],
      [13.42, 80.38],
      [13.38, 80.45],
      [13.28, 80.4],
    ],
  },

  cyclone: {
    name: 'Demo Cyclone BAYYA',
    category: 'Cyclonic Storm (sim.)',
    basin: 'Bay of Bengal',
    status: 'watch',
    active: true,
    note: 'Track stays offshore; Chennai is under caution, not harbour closure, in this simulated scenario.',
    track: [
      [16.8, 88.2],
      [16.1, 86.9],
      [15.4, 85.6],
      [14.8, 84.4],
    ],
  },

  trawlerRoute: {
    vesselId: 'BlueFin-07',
    status: 'Coastal transit — caution',
    start: [13.124, 80.297],
    destination: [13.48, 80.62],
    coordinates: [
      [13.124, 80.297],
      [13.18, 80.38],
      [13.26, 80.46],
      [13.34, 80.53],
      [13.42, 80.58],
      [13.48, 80.62],
    ],
  },

  advisory: {
    languageDefault: 'English',
    summaryEn:
      'Simulated Chennai advisory: sea-venture score 61.5/100 (CAUTION). Waves 1.85 m, wind 18.4 kts ENE, lightning risk 41%. Nearest simulated PFZ is Off Pulicat Shelf Front, ~48 km. Remain outside the 15 NM demo IMBL buffer toward Palk Strait. (Not live INCOIS data.)',
    queryHints: ['Sea Venture Safety (Chennai)'],
  },

  satelliteHealth: {
    oceansat3: { title: 'ISRO Oceansat-3 (OCM-3)', latency: '51 min', health: '97.1%' },
    insat3dr: { title: 'ISRO INSAT-3DR (TIR)', latency: '18 min', health: '98.6%' },
    sentinel3: { title: 'Copernicus Sentinel-3', latency: '102 min', health: '95.4%' },
  },
}

// ---------------------------------------------------------------------------
// Scenario: Bay of Bengal cyclone — hazard-focused demo
// ---------------------------------------------------------------------------
export const bayOfBengalScenario = {
  id: 'bay-of-bengal',
  label: 'Bay of Bengal — Cyclone corridor',
  region: 'Central / Western Bay of Bengal',
  harbour: {
    name: 'Reference: Visakhapatnam (demo origin)',
    coordinates: [17.6868, 83.2185],
  },
  meta: { ...META, scenario: 'bay-of-bengal', bulletinId: 'INC-O3-5512' },

  oceanConditions: {
    waveHeight: 3.4,
    windSpeed: 34.0,
    windDirection: 'NNE',
    seaState: 'Very Rough',
    visibility: 2,
    lightningRiskPercent: 68.0,
  },

  oceanParameters: {
    sst: 29.1,
    chlorophyll: 0.64,
    sstGradient: 0.22,
    currentSpeed: 1.35,
    currentDirection: 'W',
    cloudCoverPercent: 82.0,
  },

  risk: {
    safetyScore: 28.0,
    riskLevel: 'UNSAFE_NO_VENTURE',
    ventureStatusLabel: 'NO VENTURE — CYCLONE HAZARD',
    officialDirective:
      'Simulated prohibition: do not proceed to sea. Return to harbour. (Demo only — not an IMD bulletin.)',
    riskFactors: [
      { id: 'cyclone', label: 'Cyclone track', severity: 'critical', note: 'Demo cyclone MIZAN on a west-northwest track (simulated).' },
      { id: 'waves', label: 'Wave height', severity: 'high', note: '3.4 m (simulated).' },
      { id: 'wind', label: 'Wind speed', severity: 'high', note: '34 kts NNE (simulated).' },
      { id: 'visibility', label: 'Visibility', severity: 'high', note: '2 NM (simulated).' },
    ],
  },

  pfz: {
    name: 'PFZ withheld — cyclone override',
    targetSpecies: 'N/A',
    coordinates: [17.2, 84.1],
    radius: 25000,
    depthMeters: 55,
    confidence: 12.0,
    bearingFromHarbourDeg: 110,
    distanceFromHarbourKm: 95.0,
    reason:
      'Simulated: PFZ products are suppressed while cyclone hazard dominates. Do not fish this zone in the demo narrative.',
    additionalZones: [],
  },

  imbl: {
    name: 'Demo IMBL segment (northern Bay — not official geometry)',
    bufferNm: 15,
    distanceFromHarbourNm: 210.0,
    coordinates: [
      [20.8, 89.2],
      [20.2, 89.0],
      [19.6, 88.7],
      [19.0, 88.4],
    ],
    restrictedAccess: true,
    alertMessage: 'IMBL geofence is secondary; cyclone hazard is primary (simulated).',
  },

  mpa: {
    name: 'Demo Coringa–Godavari Estuarine Reserve',
    description:
      'Simulated coastal MPA near the Andhra delta for GIS context. Not official sanctuary coordinates.',
    coordinates: [
      [16.72, 82.28],
      [16.82, 82.42],
      [16.7, 82.52],
      [16.58, 82.38],
    ],
  },

  cyclone: {
    name: 'Demo Cyclone MIZAN',
    category: 'Severe Cyclonic Storm (sim.)',
    basin: 'Bay of Bengal',
    status: 'warning',
    active: true,
    note: 'Primary driver of UNSAFE_NO_VENTURE in this scenario. Track is fictional.',
    track: [
      [14.5, 90.8],
      [15.2, 89.1],
      [15.9, 87.4],
      [16.5, 85.8],
      [17.0, 84.5],
    ],
  },

  trawlerRoute: {
    vesselId: 'BlueFin-19',
    status: 'Return-to-harbour (abort)',
    start: [17.1, 84.2],
    destination: [17.6868, 83.2185],
    coordinates: [
      [17.1, 84.2],
      [17.18, 84.0],
      [17.28, 83.78],
      [17.4, 83.55],
      [17.52, 83.38],
      [17.6868, 83.2185],
    ],
  },

  advisory: {
    languageDefault: 'English',
    summaryEn:
      'Simulated Bay of Bengal advisory: sea-venture score 28/100 (NO VENTURE). Demo Cyclone MIZAN is a severe cyclonic storm analogue. Waves 3.4 m, winds 34 kts, visibility 2 NM. PFZ recommendations are withheld. Return to Visakhapatnam. (Not an IMD / INCOIS warning.)',
    queryHints: ['Cyclone Warnings (Bay of Bengal)'],
  },

  satelliteHealth: {
    oceansat3: { title: 'ISRO Oceansat-3 (OCM-3)', latency: '96 min', health: '91.2%' },
    insat3dr: { title: 'ISRO INSAT-3DR (TIR)', latency: '22 min', health: '97.8%' },
    sentinel3: { title: 'Copernicus Sentinel-3', latency: '140 min', health: '88.0%' },
  },
}

/** Map of all demo scenarios. Keys match the requested scenario ids. */
export const scenarios = {
  kochi: kochiScenario,
  chennai: chennaiScenario,
  'bay-of-bengal': bayOfBengalScenario,
}

export const DEFAULT_SCENARIO_ID = 'kochi'

/**
 * @param {string} [id]
 * @returns {typeof kochiScenario}
 */
export function getScenario(id = DEFAULT_SCENARIO_ID) {
  return scenarios[id] ?? kochiScenario
}

/**
 * Default export: Kochi as the active demo, plus accessors for the other
 * scenarios. Pages should import this (or `getScenario`) instead of
 * duplicating numbers.
 */
const mockOcean = {
  meta: META,
  defaultScenarioId: DEFAULT_SCENARIO_ID,
  active: kochiScenario,
  scenarios,
  getScenario,
}

export default mockOcean
