import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVITY_ROUTING_CONFIG,
  ROUTE_STATUS,
  RECOMMENDATION_STATE,
  getActivityRoutingConfig,
} from './activityRouting.js'
import {
  createRouteRequest,
  resolveRoutingRequirement,
  planMarineRoute,
  extractCoordinates,
  calculateBearing,
  bearingToCardinal,
  nearestPointOnSegment,
  evaluatePfzCandidates,
  evaluateEndpointConditions,
} from '../services/marineRouting.js'
import { CANONICAL_ACTIVITIES } from '../services/aivanaInterpreter.js'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'

const mumbaiPort = MARINE_OPERATING_LOCATIONS.find((loc) => loc.id === 'major-port-mumbai')
const chennaiPort = MARINE_OPERATING_LOCATIONS.find((loc) => loc.id === 'major-port-chennai')
const jnpaPort = MARINE_OPERATING_LOCATIONS.find((loc) => loc.id === 'major-port-jawaharlal-nehru')

test('A. No routing required for purely observational or safety assessment queries', () => {
  const result1 = resolveRoutingRequirement('Show sea conditions here', {
    operatingLocation: mumbaiPort,
  })
  assert.equal(result1.isRoutingRequired, false)
  assert.equal(result1.status, ROUTE_STATUS.NO_ROUTING_REQUIRED)
  assert.equal(result1.routeRequest, null)

  const result2 = resolveRoutingRequirement('Is it safe here?', {
    operatingLocation: mumbaiPort,
  })
  assert.equal(result2.isRoutingRequired, false)
  assert.equal(result2.status, ROUTE_STATUS.NO_ROUTING_REQUIRED)
})

test('B. Marine travel: Mumbai to Chennai forms valid RouteRequest and plans provisional corridor', () => {
  const requirement = resolveRoutingRequirement('I want to travel from Mumbai to Chennai')
  assert.equal(requirement.isRoutingRequired, true)
  assert.equal(requirement.status, 'READY')
  assert.equal(requirement.activity, CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  assert.equal(requirement.origin.id, mumbaiPort.id)
  assert.equal(requirement.destination.id, chennaiPort.id)

  const routePlan = planMarineRoute(requirement.routeRequest)
  assert.equal(routePlan.status, ROUTE_STATUS.ROUTE_EVALUATED)
  assert.ok(routePlan.geometry.distanceNm > 0)
  assert.equal(routePlan.geometry.isAuthoritativeNauticalRoute, false)
  assert.equal(routePlan.geometry.type, 'provisional_corridor')
  assert.ok(routePlan.limitations.length > 0)
})

test('C. Fishing: JNPA to PFZ target forms valid RouteRequest', () => {
  const mockPfz = {
    id: 'pfz-zone-test',
    name: 'Kochi-Goa Tuna PFZ',
    latitude: 18.5,
    longitude: 72.3,
  }

  const requirement = resolveRoutingRequirement('Take me to this PFZ', {
    operatingLocation: jnpaPort,
    activePfz: mockPfz,
  })

  assert.equal(requirement.isRoutingRequired, true)
  assert.equal(requirement.status, 'READY')
  assert.equal(requirement.activity, CANONICAL_ACTIVITIES.FISHING)
  assert.equal(requirement.target.id, mockPfz.id)

  const routePlan = planMarineRoute(requirement.routeRequest)
  assert.equal(routePlan.status, ROUTE_STATUS.ROUTE_EVALUATED)
  assert.equal(routePlan.geometry.type, 'provisional_corridor')
  assert.equal(routePlan.geometry.isAuthoritativeNauticalRoute, false)
})

test('D. Port movement: entering port target resolved', () => {
  const requirement = resolveRoutingRequirement('I need to enter JNPA', {
    operatingLocation: mumbaiPort,
  })
  assert.equal(requirement.isRoutingRequired, true)
  assert.equal(requirement.status, 'READY')
  assert.equal(requirement.activity, CANONICAL_ACTIVITIES.PORT_MOVEMENT)
  assert.equal(requirement.destination.id, jnpaPort.id)

  const routePlan = planMarineRoute(requirement.routeRequest)
  assert.ok(routePlan.geometry)
  assert.equal(routePlan.geometry.isAuthoritativeNauticalRoute, false)
})

test('E. Ocean exploration: origin to exploration target', () => {
  const explorationTarget = {
    latitude: 12.0,
    longitude: 75.0,
    name: 'Arabian Sea Chlorophyll Bloom Study Area',
  }

  const requirement = resolveRoutingRequirement('Take me to this exploration area', {
    operatingLocation: mumbaiPort,
    customTarget: explorationTarget,
  })

  assert.equal(requirement.isRoutingRequired, true)
  assert.equal(requirement.status, 'READY')
  assert.equal(requirement.activity, CANONICAL_ACTIVITIES.OCEAN_EXPLORATION)

  const routePlan = planMarineRoute(requirement.routeRequest)
  assert.equal(routePlan.status, ROUTE_STATUS.ROUTE_EVALUATED)
  assert.equal(routePlan.geometry.type, 'provisional_corridor')
})

test('F. Missing destination requires clarification and does NOT infer destination', () => {
  const requirement = resolveRoutingRequirement('I want to travel from Mumbai')
  assert.equal(requirement.isRoutingRequired, true)
  assert.equal(requirement.status, ROUTE_STATUS.CLARIFICATION_REQUIRED)
  assert.equal(requirement.routeRequest, null)
  assert.ok(requirement.clarificationQuestion.includes('destination'))
})

test('G. Missing target for fishing requires clarification and does NOT guess a PFZ', () => {
  const requirement = resolveRoutingRequirement('Take me to the PFZ', {
    operatingLocation: mumbaiPort,
    activePfz: null,
  })
  assert.equal(requirement.isRoutingRequired, true)
  assert.equal(requirement.status, ROUTE_STATUS.CLARIFICATION_REQUIRED)
  assert.equal(requirement.routeRequest, null)
  assert.ok(requirement.clarificationQuestion.includes('PFZ'))
})

test('H. Insufficient evidence marks route status as ROUTE_DATA_INSUFFICIENT and avoids recommendation', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    origin: mumbaiPort,
    destination: chennaiPort,
  })

  const routePlan = planMarineRoute(request, {
    locationDecision: {
      decision: {
        riskLevel: 'DATA_INSUFFICIENT',
        evidence: [],
      },
    },
  })

  assert.equal(routePlan.status, ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT)
  assert.equal(routePlan.recommendation.recommended, false)
  assert.equal(routePlan.recommendation.state, RECOMMENDATION_STATE.DATA_INSUFFICIENT)
})

test('I. Anti-fabrication: system does NOT present straight line as an authoritative nautical route', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    origin: mumbaiPort,
    destination: chennaiPort,
  })
  const routePlan = planMarineRoute(request)

  assert.equal(routePlan.geometry.isAuthoritativeNauticalRoute, false)
  assert.equal(routePlan.geometry.type, 'provisional_corridor')
  assert.match(routePlan.geometry.disclaimer, /Provisional reference corridor only/i)
  assert.match(routePlan.geometry.disclaimer, /Not certified for vessel navigation/i)
  assert.ok(routePlan.limitations.some((lim) => lim.includes('Automated nautical waypoints deferred')))
})

test('J. Activity switching changes routing requirements and target types accordingly', () => {
  const fishingConfig = getActivityRoutingConfig(CANONICAL_ACTIVITIES.FISHING)
  const travelConfig = getActivityRoutingConfig(CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  const safetyConfig = getActivityRoutingConfig(CANONICAL_ACTIVITIES.MARINE_SAFETY)

  assert.equal(fishingConfig.targetType, 'pfz')
  assert.equal(travelConfig.targetType, 'destination')
  assert.equal(safetyConfig.targetType, 'none')
  assert.equal(safetyConfig.requiresDestinationOrTarget, false)
})

// ==========================================
// PHASE 5B FOCUSED UNIT TESTS (A THROUGH H)
// ==========================================

const mockPfzFeatures = [
  {
    type: 'Feature',
    id: 'incois-pfz-line-101',
    properties: {
      UID: '101',
      Name: 'Ratnagiri-Devgad Tuna PFZ Line',
      Year: 2026,
      Julian_day: 268,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [72.3, 18.5],
        [72.4, 18.3],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'incois-pfz-line-102',
    properties: {
      UID: '102',
      Name: 'Goa Offshore PFZ Zone',
      Year: 2026,
      Julian_day: 268,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [71.5, 17.5],
        [71.7, 17.3],
      ],
    },
  },
  {
    type: 'Feature',
    id: 'incois-pfz-line-103',
    properties: {
      UID: '103',
      Name: 'Mumbai High Coastal PFZ Strip',
      Year: 2026,
      Julian_day: 268,
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [72.6, 18.8],
        [72.7, 18.7],
      ],
    },
  },
]

test('11. (A) Multiple PFZ candidate evaluation: candidates are ranked deterministically by distance', () => {
  const origin = [jnpaPort.latitude, jnpaPort.longitude]
  const evalResult = evaluatePfzCandidates(origin, mockPfzFeatures)

  assert.equal(evalResult.status, ROUTE_STATUS.ROUTE_EVALUATED)
  assert.equal(evalResult.candidates.length, 3)
  assert.ok(evalResult.candidates[0].distanceNm <= evalResult.candidates[1].distanceNm)
  assert.ok(evalResult.candidates[1].distanceNm <= evalResult.candidates[2].distanceNm)
  assert.equal(evalResult.selectedCandidate.id, evalResult.candidates[0].id)
  assert.equal(evalResult.selectedCandidate.uid, '103') // Line 103 is closest to JNPA (18.95, 72.95)
})

test('12. (B) Distance, initial bearing, and cardinal direction calculations are deterministic', () => {
  const bearing = calculateBearing(18.94, 72.84, 18.5, 72.0)
  assert.ok(bearing >= 230 && bearing <= 250)

  const cardinal = bearingToCardinal(bearing)
  assert.ok(['SW', 'WSW', 'W'].includes(cardinal))

  const origin = [18.95, 72.95]
  const segmentStart = [18.8, 72.6]
  const segmentEnd = [18.7, 72.7]
  const proj = nearestPointOnSegment(origin, segmentStart, segmentEnd)
  assert.ok(Number.isFinite(proj.distanceNm))
  assert.ok(proj.distanceNm > 0)
  assert.ok(proj.point[0] >= 18.7 && proj.point[0] <= 18.8)
})

test('13. (C) PFZ environmental gating: benign sea state produces RECOMMENDED candidate state', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.FISHING,
    origin: jnpaPort,
  })

  const evidenceContext = {
    locationDecision: {
      decision: {
        riskLevel: 'VENTURE_BENIGN',
        evidence: [
          { parameter: 'waveHeight', value: 1.2, status: 'available' },
          { parameter: 'windSpeed', value: 6.0, status: 'available' },
          { parameter: 'cyclone', value: { active: false }, status: 'available' },
        ],
      },
    },
    officialPfz: {
      data: {
        features: mockPfzFeatures,
      },
    },
  }

  const routePlan = planMarineRoute(request, evidenceContext)
  assert.equal(routePlan.status, ROUTE_STATUS.ROUTE_EVALUATED)
  assert.equal(routePlan.recommendation.state, RECOMMENDATION_STATE.RECOMMENDED)
  assert.equal(routePlan.recommendation.recommended, true)
  assert.equal(routePlan.selectedPfz.state, RECOMMENDATION_STATE.RECOMMENDED)
  assert.equal(routePlan.pfzCandidates[1].state, 'ALTERNATIVE')
})

test('14. (C) PFZ environmental gating: severe cyclone or rough sea produces NOT_RECOMMENDED', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.FISHING,
    origin: jnpaPort,
  })

  // Cyclone test
  const cycloneContext = {
    locationDecision: {
      decision: {
        riskLevel: 'NO_VENTURE_SEVERE_CYCLONE',
        evidence: [
          { parameter: 'cyclone', value: { active: true, severity: 3 }, status: 'available' },
        ],
      },
    },
    officialPfz: { data: { features: mockPfzFeatures } },
  }
  const cyclonePlan = planMarineRoute(request, cycloneContext)
  assert.equal(cyclonePlan.recommendation.state, RECOMMENDATION_STATE.NOT_RECOMMENDED)
  assert.equal(cyclonePlan.recommendation.recommended, false)
  assert.equal(cyclonePlan.selectedPfz.state, RECOMMENDATION_STATE.NOT_RECOMMENDED)

  // Rough sea test (wave > 3.5m)
  const roughSeaContext = {
    locationDecision: {
      decision: {
        riskLevel: 'VENTURE_BENIGN',
        evidence: [
          { parameter: 'waveHeight', value: 4.2, status: 'available' },
          { parameter: 'windSpeed', value: 18.5, status: 'available' },
        ],
      },
    },
    officialPfz: { data: { features: mockPfzFeatures } },
  }
  const roughSeaPlan = planMarineRoute(request, roughSeaContext)
  assert.equal(roughSeaPlan.recommendation.state, RECOMMENDATION_STATE.NOT_RECOMMENDED)
  assert.equal(roughSeaPlan.recommendation.recommended, false)
})

test('15. (C) PFZ environmental gating: marginal sea produces CONDITIONAL recommendation', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.FISHING,
    origin: jnpaPort,
  })

  const marginalContext = {
    locationDecision: {
      decision: {
        riskLevel: 'VENTURE_BENIGN',
        evidence: [
          { parameter: 'waveHeight', value: 2.6, status: 'available' },
          { parameter: 'windSpeed', value: 13.0, status: 'available' },
        ],
      },
    },
    officialPfz: { data: { features: mockPfzFeatures } },
  }
  const marginalPlan = planMarineRoute(request, marginalContext)
  assert.equal(marginalPlan.recommendation.state, RECOMMENDATION_STATE.CONDITIONAL)
  assert.equal(marginalPlan.recommendation.recommended, true)
  assert.equal(marginalPlan.selectedPfz.state, RECOMMENDATION_STATE.CONDITIONAL)
})

test('16. (D) Missing PFZ data produces transparent DATA_INSUFFICIENT without fabricated candidates', () => {
  const evalResult = evaluatePfzCandidates([18.95, 72.95], [])
  assert.equal(evalResult.status, ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT)
  assert.equal(evalResult.recommendationState, RECOMMENDATION_STATE.DATA_INSUFFICIENT)
  assert.equal(evalResult.candidates.length, 0)
  assert.equal(evalResult.selectedCandidate, null)
  assert.equal(evalResult.supplementalIntelligence, true)
  assert.match(evalResult.reason, /PFZ features are unavailable/i)
})

test('17. (E) Marine travel: dual-endpoint conditions are both evaluated', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    origin: mumbaiPort,
    destination: chennaiPort,
  })

  // Origin safe, destination has severe rough sea
  const dualContext = {
    originDecision: {
      decision: {
        riskLevel: 'VENTURE_BENIGN',
        evidence: [
          { parameter: 'waveHeight', value: 1.2, status: 'available' },
          { parameter: 'windSpeed', value: 5.5, status: 'available' },
        ],
      },
    },
    destinationDecision: {
      decision: {
        riskLevel: 'VENTURE_BENIGN',
        evidence: [
          { parameter: 'waveHeight', value: 4.5, status: 'available' }, // severe > 3.5m
          { parameter: 'windSpeed', value: 10.0, status: 'available' },
        ],
      },
    },
  }

  const routePlan = planMarineRoute(request, dualContext)
  assert.equal(routePlan.recommendation.state, RECOMMENDATION_STATE.NOT_RECOMMENDED)
  assert.equal(routePlan.recommendation.recommended, false)
  assert.match(routePlan.recommendation.reason, /rough sea conditions/i)
  assert.ok(routePlan.endpointAssessment.origin)
  assert.ok(routePlan.endpointAssessment.destination)
})

test('18. (E) Marine travel: missing destination weather evidence is represented honestly', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    origin: mumbaiPort,
    destination: chennaiPort,
  })

  // Origin safe, destination has NO weather data loaded
  const partialContext = {
    originDecision: {
      decision: {
        riskLevel: 'VENTURE_BENIGN',
        evidence: [
          { parameter: 'waveHeight', value: 1.2, status: 'available' },
          { parameter: 'windSpeed', value: 5.5, status: 'available' },
        ],
      },
    },
    destinationDecision: null,
  }

  const routePlan = planMarineRoute(request, partialContext)
  assert.equal(routePlan.status, ROUTE_STATUS.ROUTE_PARTIALLY_EVALUATED)
  assert.equal(routePlan.recommendation.state, RECOMMENDATION_STATE.CONDITIONAL)
  assert.match(routePlan.recommendation.reason, /Destination weather data is not currently loaded/i)
})

test('19. (E & H) Marine travel unavailable route constraints (route-level weather, coastline avoidance, fairways)', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    origin: mumbaiPort,
    destination: chennaiPort,
  })
  const routePlan = planMarineRoute(request)

  const unavailable = routePlan.constraintsUnavailable
  assert.ok(unavailable.includes('coastline_land_avoidance'))
  assert.ok(unavailable.includes('nautical_fairway_waypoints'))
  assert.ok(unavailable.includes('route_level_spatial_weather_grid'))
  assert.ok(unavailable.includes('bathymetric_depth_clearance'))

  assert.ok(
    routePlan.limitations.some((lim) =>
      lim.includes('Certified water-only navigation route cannot be generated with current data')
    )
  )
})

test('20. (F) Port movement: outer approach evaluated, inner-harbour / berth navigation unavailable', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.PORT_MOVEMENT,
    origin: mumbaiPort,
    destination: jnpaPort,
  })
  const routePlan = planMarineRoute(request)

  assert.ok(routePlan.constraintsUnavailable.includes('berth_level_channels'))
  assert.ok(routePlan.constraintsUnavailable.includes('pilotage_guidance'))
  assert.ok(routePlan.constraintsUnavailable.includes('inner_harbour_bathymetry'))
  assert.ok(
    routePlan.limitations.some((lim) =>
      lim.includes('Berth-level piloting, inner-harbour channels, tug assistance, and docking clearance are unavailable')
    )
  )
})

test('21. (G) Ocean exploration: vague request requires clarification; specific target gets provisional corridor', () => {
  // Vague exploration query
  const vagueReq = resolveRoutingRequirement('I want to explore the sea')
  assert.equal(vagueReq.status, ROUTE_STATUS.CLARIFICATION_REQUIRED)
  assert.equal(vagueReq.routeRequest, null)
  assert.match(vagueReq.clarificationQuestion, /exploration area/i)

  // Explicit target area
  const targetArea = { latitude: 15.0, longitude: 71.0, name: 'Central Arabian Sea Survey Area' }
  const specificReq = resolveRoutingRequirement('Explore target area', {
    operatingLocation: mumbaiPort,
    customTarget: targetArea,
  })
  assert.equal(specificReq.status, 'READY')
  assert.equal(specificReq.target.name, targetArea.name)

  const plan = planMarineRoute(specificReq.routeRequest)
  assert.equal(plan.geometry.isAuthoritativeNauticalRoute, false)
  assert.ok(plan.limitations.some((lim) => lim.includes('Does not replace research cruise planning')))
})

test('22. (H) Anti-fabrication: zero catch probability, zero fish species, zero fake nautical waypoints', () => {
  const request = createRouteRequest({
    activity: CANONICAL_ACTIVITIES.FISHING,
    origin: jnpaPort,
  })
  const plan = planMarineRoute(request, {
    officialPfz: { data: { features: mockPfzFeatures } },
  })

  // Geometry checks
  assert.equal(plan.geometry.isAuthoritativeNauticalRoute, false)
  assert.equal(plan.geometry.type, 'provisional_corridor')

  // Zero fabrication checks
  assert.equal(plan.geometry.waypoints, undefined)
  assert.equal(plan.geometry.eta, undefined)
  assert.equal(plan.geometry.bathymetricSafeDepth, undefined)
  assert.equal(plan.geometry.aisCollisionRisk, undefined)

  // PFZ candidate zero-fabrication checks
  for (const candidate of plan.pfzCandidates) {
    assert.equal(candidate.catchProbability, undefined)
    assert.equal(candidate.fishSpecies, undefined)
    assert.equal(candidate.fishAbundance, undefined)
    assert.equal(candidate.safetyScore, undefined)
    assert.equal(candidate.supplementalIntelligence, true)
  }
})
