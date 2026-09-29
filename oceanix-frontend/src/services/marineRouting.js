import {
  ACTIVITY_ROUTING_CONFIG,
  ROUTE_STATUS,
  RECOMMENDATION_STATE,
  getActivityRoutingConfig,
} from '../config/activityRouting.js'
import {
  CANONICAL_ACTIVITIES,
  AIVANA_INTENTS,
  detectAivanaIntent,
  resolveOperatingLocationFromText,
  extractTravelEndpoints,
  DESTINATION_CLARIFICATION_QUESTION,
} from './aivanaInterpreter.js'

const EARTH_RADIUS_NM = 3440.065

/**
 * Calculates Great Circle distance between two points in Nautical Miles.
 */
export function haversineNm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Calculates forward / initial azimuth bearing in degrees from point 1 to point 2 (0°–360°).
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const toDeg = (r) => (r * 180) / Math.PI
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  return Math.round(((toDeg(θ) + 360) % 360) * 10) / 10
}

/**
 * Converts degree bearing (0°–360°) to cardinal / intercardinal abbreviation.
 */
export function bearingToCardinal(deg) {
  if (!Number.isFinite(deg)) return ''
  const cardinals = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ]
  const index = Math.round(deg / 22.5) % 16
  return cardinals[index]
}

/**
 * Calculates the perpendicular or nearest point on a line segment to an origin point.
 * Both point, start, and end are [latitude, longitude].
 */
export function nearestPointOnSegment(point, start, end) {
  const latitudeScale = Math.cos((point[0] * Math.PI) / 180)
  const startX = (start[1] - point[1]) * latitudeScale
  const startY = start[0] - point[0]
  const endX = (end[1] - point[1]) * latitudeScale
  const endY = end[0] - point[0]
  const deltaX = endX - startX
  const deltaY = endY - startY
  const denominator = deltaX ** 2 + deltaY ** 2
  const ratio = denominator === 0
    ? 0
    : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / denominator))
  const candidate = [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ]
  return {
    point: [
      Math.round(candidate[0] * 100000) / 100000,
      Math.round(candidate[1] * 100000) / 100000,
    ],
    distanceNm: haversineNm(point[0], point[1], candidate[0], candidate[1]),
  }
}

/**
 * Extracts line segments [[startPt, endPt], ...] in [lat, lon] from a GeoJSON feature.
 */
export function extractSegmentsFromFeature(feature) {
  if (!feature) return []
  const geometry = feature.geometry || feature
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const coords = geometry.coordinates.map(([lon, lat]) => [Number(lat), Number(lon)])
    const segments = []
    for (let i = 1; i < coords.length; i++) {
      segments.push([coords[i - 1], coords[i]])
    }
    return segments
  }
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    const segments = []
    for (const line of geometry.coordinates) {
      if (Array.isArray(line)) {
        const coords = line.map(([lon, lat]) => [Number(lat), Number(lon)])
        for (let i = 1; i < coords.length; i++) {
          segments.push([coords[i - 1], coords[i]])
        }
      }
    }
    return segments
  }
  const pt = extractCoordinates(feature)
  if (pt) {
    return [[pt, pt]]
  }
  return []
}

/**
 * Extracts coordinate pair [latitude, longitude] from diverse location / target structures.
 */
export function extractCoordinates(entity) {
  if (!entity) return null

  // If array of numbers [lat, lon]
  if (Array.isArray(entity) && entity.length >= 2 && Number.isFinite(entity[0]) && Number.isFinite(entity[1])) {
    return [Number(entity[0]), Number(entity[1])]
  }

  // If object with latitude and longitude properties
  if (Number.isFinite(entity.latitude) && Number.isFinite(entity.longitude)) {
    return [Number(entity.latitude), Number(entity.longitude)]
  }

  // If object with lat and lng / lon
  if (Number.isFinite(entity.lat) && Number.isFinite(entity.lng ?? entity.lon)) {
    return [Number(entity.lat), Number(entity.lng ?? entity.lon)]
  }

  // If GeoJSON Point geometry
  if (entity.geometry?.type === 'Point' && Array.isArray(entity.geometry.coordinates)) {
    return [Number(entity.geometry.coordinates[1]), Number(entity.geometry.coordinates[0])]
  }

  // If GeoJSON LineString (centroid / midpoint)
  if (entity.geometry?.type === 'LineString' && Array.isArray(entity.geometry.coordinates) && entity.geometry.coordinates.length > 0) {
    const coords = entity.geometry.coordinates
    const midIndex = Math.floor(coords.length / 2)
    return [Number(coords[midIndex][1]), Number(coords[midIndex][0])]
  }

  // If GeoJSON MultiLineString (midpoint of first line)
  if (entity.geometry?.type === 'MultiLineString' && Array.isArray(entity.geometry.coordinates) && entity.geometry.coordinates[0]?.length > 0) {
    const coords = entity.geometry.coordinates[0]
    const midIndex = Math.floor(coords.length / 2)
    return [Number(coords[midIndex][1]), Number(coords[midIndex][0])]
  }

  return null
}

/**
 * Reusable Route Request Model
 *
 * @param {object} params
 * @param {string} params.activity
 * @param {string} [params.objective]
 * @param {object|string} [params.origin]
 * @param {object|string} [params.destination]
 * @param {object|string} [params.target]
 * @param {string[]} [params.constraints]
 * @param {string[]} [params.requiredEvidence]
 * @returns {object}
 */
export function createRouteRequest({
  activity = CANONICAL_ACTIVITIES.OTHER,
  objective = 'transit',
  origin = null,
  destination = null,
  target = null,
  constraints = [],
  requiredEvidence = [],
} = {}) {
  const config = getActivityRoutingConfig(activity)
  return Object.freeze({
    activity,
    objective,
    origin: origin ?? null,
    destination: destination ?? null,
    target: target ?? null,
    constraints: constraints.length > 0 ? Object.freeze([...constraints]) : Object.freeze([...config.relevantConstraints]),
    requiredEvidence: requiredEvidence.length > 0 ? Object.freeze([...requiredEvidence]) : Object.freeze([...config.relevantEvidence]),
    createdAt: new Date().toISOString(),
  })
}

/**
 * Determines whether an incoming query or operational context requires routing,
 * resolves required endpoints/targets, or identifies missing clarification details.
 *
 * @param {string|object} input User text query or structured context
 * @param {object} [options]
 * @param {object|null} [options.activityContext] Current activity context
 * @param {object|null} [options.operatingLocation] Current operating location
 * @param {object|null} [options.activePfz] Currently selected or nearby PFZ
 * @param {object|null} [options.customTarget] Explicit target
 * @returns {object} Routing requirement resolution
 */
export function resolveRoutingRequirement(
  input,
  {
    activityContext = null,
    operatingLocation = null,
    activePfz = null,
    customTarget = null,
  } = {}
) {
  const query = typeof input === 'string' ? input.trim().toLowerCase() : ''
  const detectedIntent = query ? detectAivanaIntent(query) : AIVANA_INTENTS.OTHER
  const effectiveActivity = activityContext?.activity || (
    detectedIntent === AIVANA_INTENTS.FISHING
      ? CANONICAL_ACTIVITIES.FISHING
      : detectedIntent === AIVANA_INTENTS.TRAVEL || detectedIntent === AIVANA_INTENTS.DESTINATION_NAVIGATION
      ? CANONICAL_ACTIVITIES.MARINE_TRAVEL
      : detectedIntent === AIVANA_INTENTS.PORT_MOVEMENT || query.includes('enter ') || query.includes('port')
      ? CANONICAL_ACTIVITIES.PORT_MOVEMENT
      : detectedIntent === AIVANA_INTENTS.OCEAN_EXPLORATION
      ? CANONICAL_ACTIVITIES.OCEAN_EXPLORATION
      : detectedIntent === AIVANA_INTENTS.MARINE_SAFETY
      ? CANONICAL_ACTIVITIES.MARINE_SAFETY
      : CANONICAL_ACTIVITIES.OTHER
  )

  const config = getActivityRoutingConfig(effectiveActivity)

  // 1. OBSERVATIONAL / NON-MOVEMENT QUERIES
  // e.g. "What is the sea condition here?", "Show sea conditions here", "Is it safe here?"
  const isTransitVerbPresent =
    query.includes('travel') ||
    query.includes('take me to') ||
    query.includes('route to') ||
    query.includes('route me') ||
    query.includes('navigate to') ||
    query.includes('sail to') ||
    query.includes('go to') ||
    query.includes('voyage to') ||
    query.includes('enter port') ||
    query.includes('enter jnpa') ||
    query.includes('enter ') ||
    query.includes('head to') ||
    query.includes('passage') ||
    query.includes('transit') ||
    /\bfrom\s+.+\s+to\s+.+/i.test(query)

  const isPureObservationQuery =
    query &&
    !isTransitVerbPresent &&
    (
      query.includes('sea condition') ||
      query.includes('ocean condition') ||
      query.includes('condition here') ||
      query.includes('weather here') ||
      query.includes('is it safe') ||
      query.includes('safe to operate') ||
      query.includes('safe here') ||
      query.includes('status here') ||
      query.includes('what can orca do') ||
      query.includes('capabilities') ||
      query.includes('explore this area') ||
      query.includes('insights on')
    )

  if (isPureObservationQuery || effectiveActivity === CANONICAL_ACTIVITIES.MARINE_SAFETY) {
    return {
      isRoutingRequired: false,
      status: ROUTE_STATUS.NO_ROUTING_REQUIRED,
      activity: effectiveActivity,
      objective: 'environmental_observation',
      origin: operatingLocation || activityContext?.operatingLocation || null,
      destination: null,
      target: null,
      routeRequest: null,
      clarificationQuestion: null,
      reason: 'Query is observational; no vessel transit requested.',
    }
  }

  // 2. MARINE TRAVEL ROUTING RESOLUTION
  if (effectiveActivity === CANONICAL_ACTIVITIES.MARINE_TRAVEL) {
    const endpoints = extractTravelEndpoints(query)
    const origin = endpoints.origin || activityContext?.origin || operatingLocation || activityContext?.operatingLocation || null
    const destination = endpoints.destination || activityContext?.destination || null

    // If destination is missing, ask for clarification
    if (!destination) {
      return {
        isRoutingRequired: true,
        status: ROUTE_STATUS.CLARIFICATION_REQUIRED,
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        objective: 'marine_voyage',
        origin,
        destination: null,
        target: null,
        routeRequest: null,
        clarificationQuestion: DESTINATION_CLARIFICATION_QUESTION,
        reason: 'Missing destination endpoint for marine travel.',
      }
    }

    // If origin is missing and no operating location is selected
    if (!origin) {
      return {
        isRoutingRequired: true,
        status: ROUTE_STATUS.CLARIFICATION_REQUIRED,
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        objective: 'marine_voyage',
        origin: null,
        destination,
        target: null,
        routeRequest: null,
        clarificationQuestion: 'Which departure port or location are you travelling from?',
        reason: 'Missing origin departure point for marine travel.',
      }
    }

    const routeRequest = createRouteRequest({
      activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
      objective: 'marine_voyage',
      origin,
      destination,
      constraints: config.relevantConstraints,
      requiredEvidence: config.relevantEvidence,
    })

    return {
      isRoutingRequired: true,
      status: 'READY',
      activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
      objective: 'marine_voyage',
      origin,
      destination,
      target: destination,
      routeRequest,
      clarificationQuestion: null,
      reason: 'Origin and destination endpoints resolved.',
    }
  }

  // 3. FISHING ROUTING RESOLUTION
  if (effectiveActivity === CANONICAL_ACTIVITIES.FISHING) {
    const origin = operatingLocation || activityContext?.operatingLocation || activityContext?.origin || null
    const target = customTarget || activePfz || activityContext?.destination || null

    // If user asked to go to PFZ, but target is null
    if (!target) {
      return {
        isRoutingRequired: true,
        status: ROUTE_STATUS.CLARIFICATION_REQUIRED,
        activity: CANONICAL_ACTIVITIES.FISHING,
        objective: 'pfz_transit',
        origin,
        destination: null,
        target: null,
        routeRequest: null,
        clarificationQuestion:
          'Which Potential Fishing Zone (PFZ) should I route to? Please select a PFZ on the map or specify target coordinates.',
        reason: 'Target Potential Fishing Zone (PFZ) not selected.',
      }
    }

    const routeRequest = createRouteRequest({
      activity: CANONICAL_ACTIVITIES.FISHING,
      objective: 'pfz_transit',
      origin,
      target,
      constraints: config.relevantConstraints,
      requiredEvidence: config.relevantEvidence,
    })

    return {
      isRoutingRequired: true,
      status: 'READY',
      activity: CANONICAL_ACTIVITIES.FISHING,
      objective: 'pfz_transit',
      origin,
      destination: null,
      target,
      routeRequest,
      clarificationQuestion: null,
      reason: 'Operating location and target PFZ resolved.',
    }
  }

  // 4. PORT MOVEMENT ROUTING RESOLUTION
  if (effectiveActivity === CANONICAL_ACTIVITIES.PORT_MOVEMENT) {
    const detectedLocation = resolveOperatingLocationFromText(query)
    const destination = detectedLocation || activityContext?.destination || operatingLocation || activityContext?.operatingLocation || null
    const origin = activityContext?.origin || (detectedLocation && operatingLocation && detectedLocation.id !== operatingLocation.id ? operatingLocation : null)

    if (!destination) {
      return {
        isRoutingRequired: true,
        status: ROUTE_STATUS.CLARIFICATION_REQUIRED,
        activity: CANONICAL_ACTIVITIES.PORT_MOVEMENT,
        objective: 'port_entry',
        origin,
        destination: null,
        target: null,
        routeRequest: null,
        clarificationQuestion: 'Which port or harbour are you entering?',
        reason: 'Missing target port for port movement.',
      }
    }

    const routeRequest = createRouteRequest({
      activity: CANONICAL_ACTIVITIES.PORT_MOVEMENT,
      objective: 'port_entry',
      origin: origin || { name: 'Approach Point', ...destination },
      destination,
      target: destination,
      constraints: config.relevantConstraints,
      requiredEvidence: config.relevantEvidence,
    })

    return {
      isRoutingRequired: true,
      status: 'READY',
      activity: CANONICAL_ACTIVITIES.PORT_MOVEMENT,
      objective: 'port_entry',
      origin,
      destination,
      target: destination,
      routeRequest,
      clarificationQuestion: null,
      reason: 'Port entry destination resolved.',
    }
  }

  // 5. OCEAN EXPLORATION ROUTING RESOLUTION
  if (effectiveActivity === CANONICAL_ACTIVITIES.OCEAN_EXPLORATION) {
    const target = customTarget || activityContext?.destination || null
    const origin = operatingLocation || activityContext?.operatingLocation || activityContext?.origin || null

    if (!target && (isTransitVerbPresent || query.includes('explore'))) {
      return {
        isRoutingRequired: true,
        status: ROUTE_STATUS.CLARIFICATION_REQUIRED,
        activity: CANONICAL_ACTIVITIES.OCEAN_EXPLORATION,
        objective: 'exploration_transit',
        origin,
        destination: null,
        target: null,
        routeRequest: null,
        clarificationQuestion:
          'Which ocean exploration area or coordinates should I route to? Please specify target coordinates or an ocean area.',
        reason: 'Exploration target coordinates not specified.',
      }
    }

    if (!target) {
      return {
        isRoutingRequired: false,
        status: ROUTE_STATUS.NO_ROUTING_REQUIRED,
        activity: CANONICAL_ACTIVITIES.OCEAN_EXPLORATION,
        objective: 'ocean_survey',
        origin,
        destination: null,
        target: null,
        routeRequest: null,
        clarificationQuestion: null,
        reason: 'General ocean exploration inquiry without transit requirement.',
      }
    }

    const routeRequest = createRouteRequest({
      activity: CANONICAL_ACTIVITIES.OCEAN_EXPLORATION,
      objective: 'exploration_transit',
      origin,
      target,
      constraints: config.relevantConstraints,
      requiredEvidence: config.relevantEvidence,
    })

    return {
      isRoutingRequired: true,
      status: 'READY',
      activity: CANONICAL_ACTIVITIES.OCEAN_EXPLORATION,
      objective: 'exploration_transit',
      origin,
      destination: null,
      target,
      routeRequest,
      clarificationQuestion: null,
      reason: 'Exploration origin and target area resolved.',
    }
  }

  // 6. OTHER ACTIVITIES
  if (isTransitVerbPresent) {
    const endpoints = extractTravelEndpoints(query)
    if (!endpoints.destination) {
      return {
        isRoutingRequired: true,
        status: ROUTE_STATUS.CLARIFICATION_REQUIRED,
        activity: CANONICAL_ACTIVITIES.OTHER,
        objective: 'transit',
        origin: endpoints.origin || operatingLocation,
        destination: null,
        target: null,
        routeRequest: null,
        clarificationQuestion: DESTINATION_CLARIFICATION_QUESTION,
        reason: 'Destination clarification required.',
      }
    }

    const routeRequest = createRouteRequest({
      activity: CANONICAL_ACTIVITIES.OTHER,
      objective: 'transit',
      origin: endpoints.origin || operatingLocation,
      destination: endpoints.destination,
      constraints: config.relevantConstraints,
      requiredEvidence: config.relevantEvidence,
    })

    return {
      isRoutingRequired: true,
      status: 'READY',
      activity: CANONICAL_ACTIVITIES.OTHER,
      objective: 'transit',
      origin: endpoints.origin || operatingLocation,
      destination: endpoints.destination,
      target: endpoints.destination,
      routeRequest,
      clarificationQuestion: null,
      reason: 'Endpoints resolved.',
    }
  }

  return {
    isRoutingRequired: false,
    status: ROUTE_STATUS.NO_ROUTING_REQUIRED,
    activity: effectiveActivity,
    objective: 'general',
    origin: operatingLocation,
    destination: null,
    target: null,
    routeRequest: null,
    clarificationQuestion: null,
    reason: 'No transit requested.',
  }
}

/**
 * Evaluates candidate official INCOIS PFZ features against an origin coordinate.
 * Uses nearestPointOnSegment projection, Great Circle distance (NM), and initial bearing.
 *
 * ANTI-FABRICATION RULE:
 * PFZ is strictly supplemental intelligence.
 * No fish species, catch probability, fish abundance, or safety scores derived from PFZ.
 *
 * @param {Array|object} originCoords [latitude, longitude]
 * @param {Array|object} pfzFeaturesInput GeoJSON features array or FeatureCollection
 * @param {object} [evidenceContext] Environmental evidence and decision context
 * @returns {object} Evaluated candidates and selected target
 */
export function evaluatePfzCandidates(originCoords, pfzFeaturesInput, evidenceContext = {}) {
  const origin = extractCoordinates(originCoords)
  if (!origin) {
    return {
      candidates: [],
      selectedCandidate: null,
      status: ROUTE_STATUS.ROUTE_UNAVAILABLE,
      recommendationState: RECOMMENDATION_STATE.NOT_APPLICABLE,
      reason: 'Invalid origin coordinates for PFZ candidate evaluation.',
    }
  }

  const rawFeatures = Array.isArray(pfzFeaturesInput)
    ? pfzFeaturesInput
    : pfzFeaturesInput?.data?.features || pfzFeaturesInput?.features || []

  if (!rawFeatures || rawFeatures.length === 0) {
    return {
      candidates: [],
      selectedCandidate: null,
      status: ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT,
      recommendationState: RECOMMENDATION_STATE.DATA_INSUFFICIENT,
      reason: 'Official INCOIS PFZ features are unavailable in the operational area.',
      supplementalIntelligence: true,
      limitations: [
        'PFZ features not received from INCOIS WFS endpoint.',
        'No candidate fishing zones could be evaluated.',
      ],
    }
  }

  // 1. Calculate nearest point, distance, and bearing for each feature
  const candidates = []
  rawFeatures.forEach((feature, idx) => {
    const segments = extractSegmentsFromFeature(feature)
    if (segments.length === 0) return

    let closest = null
    for (const [start, end] of segments) {
      const result = nearestPointOnSegment(origin, start, end)
      if (!closest || result.distanceNm < closest.distanceNm) {
        closest = result
      }
    }

    if (!closest) return

    const bearingDeg = calculateBearing(origin[0], origin[1], closest.point[0], closest.point[1])
    const bearingCardinal = bearingToCardinal(bearingDeg)
    const props = feature.properties || {}
    const uid = props.UID ?? props.Uid ?? props.uid ?? props.Sno ?? null
    const name = props.Name || (uid ? `INCOIS PFZ Zone #${uid}` : `INCOIS PFZ Candidate ${idx + 1}`)
    const advisoryDate = props.advisoryDate || (props.Year && props.Julian_day ? `Day ${props.Julian_day}, ${props.Year}` : null)

    candidates.push({
      id: feature.id || (uid ? `pfz-wfs-${uid}` : `pfz-candidate-${idx + 1}`),
      uid,
      name,
      advisoryDate,
      coordinates: [
        Math.round(closest.point[0] * 10000) / 10000,
        Math.round(closest.point[1] * 10000) / 10000,
      ],
      distanceNm: Math.round(closest.distanceNm * 10) / 10,
      bearingDeg,
      bearingCardinal,
      feature,
      supplementalIntelligence: true,
    })
  })

  if (candidates.length === 0) {
    return {
      candidates: [],
      selectedCandidate: null,
      status: ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT,
      recommendationState: RECOMMENDATION_STATE.DATA_INSUFFICIENT,
      reason: 'No valid PFZ line geometry could be resolved from official INCOIS data.',
      supplementalIntelligence: true,
    }
  }

  // 2. Sort ascending by distance (NM)
  candidates.sort((a, b) => a.distanceNm - b.distanceNm)

  // 3. Take 3–5 candidates
  const topCandidates = candidates.slice(0, 5)

  // 4. Environmental Gate Check using canonical ORCA criteria
  const locationDecision = evidenceContext?.locationDecision?.decision || evidenceContext?.decision || null
  const evidenceList = Array.isArray(locationDecision?.evidence)
    ? locationDecision.evidence
    : Array.isArray(evidenceContext?.evidence)
    ? evidenceContext.evidence
    : []

  const waveEvidence = evidenceList.find((e) => e.parameter === 'waveHeight')
  const windEvidence = evidenceList.find((e) => e.parameter === 'windSpeed')
  const cycloneEvidence = evidenceList.find((e) => e.parameter === 'cyclone')

  const waveVal = Number(waveEvidence?.value)
  const windVal = Number(windEvidence?.value)

  const isOrcaDataInsufficient =
    locationDecision?.riskLevel === 'DATA_INSUFFICIENT' ||
    (evidenceContext?.dataStatus?.complete === false && evidenceContext?.dataStatus?.completeness === 0)

  const isSevereCyclone =
    locationDecision?.riskLevel === 'NO_VENTURE_SEVERE_CYCLONE' ||
    locationDecision?.severeCycloneOverrideApplied === true ||
    (cycloneEvidence?.status === 'available' && cycloneEvidence.value?.active && cycloneEvidence.value?.severity >= 2)

  const isSevereSea =
    (Number.isFinite(waveVal) && waveVal > 3.5) ||
    (Number.isFinite(windVal) && windVal > 17.2)

  const isMarginalSea =
    (Number.isFinite(waveVal) && waveVal > 2.2) ||
    (Number.isFinite(windVal) && windVal > 12.0)

  let overallStatus = ROUTE_STATUS.ROUTE_EVALUATED
  let recommendationState = RECOMMENDATION_STATE.RECOMMENDED
  let overallReason = ''

  if (isOrcaDataInsufficient) {
    overallStatus = ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT
    recommendationState = RECOMMENDATION_STATE.DATA_INSUFFICIENT
    overallReason = 'Environmental data insufficient to evaluate PFZ candidates.'
    topCandidates.forEach((c) => {
      c.state = RECOMMENDATION_STATE.DATA_INSUFFICIENT
      c.reason = 'Environmental data insufficient.'
    })
  } else if (isSevereCyclone) {
    overallStatus = ROUTE_STATUS.ROUTE_EVALUATED
    recommendationState = RECOMMENDATION_STATE.NOT_RECOMMENDED
    overallReason = 'PFZ transit not advised due to active severe cyclone advisory in the operational area.'
    topCandidates.forEach((c) => {
      c.state = RECOMMENDATION_STATE.NOT_RECOMMENDED
      c.reason = 'Active severe cyclone alert.'
    })
  } else if (isSevereSea) {
    overallStatus = ROUTE_STATUS.ROUTE_EVALUATED
    recommendationState = RECOMMENDATION_STATE.NOT_RECOMMENDED
    overallReason = 'PFZ transit not recommended due to rough sea conditions (wave height > 3.5m or gale wind).'
    topCandidates.forEach((c) => {
      c.state = RECOMMENDATION_STATE.NOT_RECOMMENDED
      c.reason = 'Rough sea conditions.'
    })
  } else if (isMarginalSea) {
    overallStatus = ROUTE_STATUS.ROUTE_PARTIALLY_EVALUATED
    recommendationState = RECOMMENDATION_STATE.CONDITIONAL
    overallReason = `Caution advised: marginal sea conditions (wave: ${Number.isFinite(waveVal) ? waveVal.toFixed(1) + 'm' : '—'}, wind: ${Number.isFinite(windVal) ? windVal.toFixed(1) + 'm/s' : '—'}).`
    topCandidates.forEach((c, i) => {
      c.state = RECOMMENDATION_STATE.CONDITIONAL
      c.reason = i === 0
        ? `Closest PFZ candidate at ${c.distanceNm} NM (bearing ${c.bearingDeg}° ${c.bearingCardinal}); marginal sea state.`
        : `Alternative PFZ candidate at ${c.distanceNm} NM (bearing ${c.bearingDeg}° ${c.bearingCardinal}); marginal sea state.`
    })
  } else {
    overallStatus = ROUTE_STATUS.ROUTE_EVALUATED
    recommendationState = RECOMMENDATION_STATE.RECOMMENDED
    overallReason = `Recommended closest official PFZ candidate at ${topCandidates[0].distanceNm} NM (bearing ${topCandidates[0].bearingDeg}° ${topCandidates[0].bearingCardinal}).`
    topCandidates.forEach((c, i) => {
      if (i === 0) {
        c.state = RECOMMENDATION_STATE.RECOMMENDED
        c.reason = `Closest official PFZ candidate at ${c.distanceNm} NM (bearing ${c.bearingDeg}° ${c.bearingCardinal}) with favorable sea state.`
      } else {
        c.state = 'ALTERNATIVE'
        c.reason = `Alternative official PFZ candidate at ${c.distanceNm} NM (bearing ${c.bearingDeg}° ${c.bearingCardinal}).`
      }
    })
  }

  const selectedCandidate = topCandidates[0]

  return {
    candidates: topCandidates,
    selectedCandidate,
    status: overallStatus,
    recommendationState,
    reason: overallReason,
    supplementalIntelligence: true,
    antiFabricationNotice:
      'PFZ geometry is supplemental intelligence only. No fish species, catch probability, or fish abundance is predicted. Safety calculations are governed exclusively by canonical ORCA environmental criteria.',
  }
}

/**
 * Evaluates environmental evidence for a specific port or coastal endpoint.
 *
 * @param {Array} evidenceList
 * @param {string|null} riskLevel
 * @param {string} endpointName
 * @returns {object}
 */
export function evaluateEndpointConditions(evidenceList, riskLevel, endpointName = 'Endpoint') {
  const list = Array.isArray(evidenceList) ? evidenceList : []
  const waveEvidence = list.find((e) => e.parameter === 'waveHeight')
  const windEvidence = list.find((e) => e.parameter === 'windSpeed')
  const visEvidence = list.find((e) => e.parameter === 'visibility')
  const cycloneEvidence = list.find((e) => e.parameter === 'cyclone')

  const waveVal = Number(waveEvidence?.value)
  const windVal = Number(windEvidence?.value)
  const visVal = Number(visEvidence?.value)

  const isSevereCyclone =
    riskLevel === 'NO_VENTURE_SEVERE_CYCLONE' ||
    (cycloneEvidence?.status === 'available' && cycloneEvidence.value?.active && cycloneEvidence.value?.severity >= 2)

  const isSevereSea =
    (Number.isFinite(waveVal) && waveVal > 3.5) ||
    (Number.isFinite(windVal) && windVal > 17.2)

  const isMarginalSea =
    (Number.isFinite(waveVal) && waveVal > 2.2) ||
    (Number.isFinite(windVal) && windVal > 12.0)

  const hasData = list.length > 0
  const isDataInsufficient = riskLevel === 'DATA_INSUFFICIENT' || (!hasData && riskLevel != null)

  let assessment = 'SAFE'
  let summary = 'Safe sea state'
  if (!hasData && riskLevel == null) {
    assessment = 'UNAVAILABLE'
    summary = 'Weather evidence not loaded'
  } else if (isDataInsufficient) {
    assessment = 'DATA_INSUFFICIENT'
    summary = 'Weather evidence insufficient'
  } else if (isSevereCyclone) {
    assessment = 'SEVERE_CYCLONE'
    summary = 'Active severe cyclone alert'
  } else if (isSevereSea) {
    assessment = 'SEVERE_SEA'
    summary = `Rough sea (wave: ${waveVal.toFixed(1)}m, wind: ${windVal.toFixed(1)}m/s)`
  } else if (isMarginalSea) {
    assessment = 'MARGINAL'
    summary = `Marginal sea (wave: ${Number.isFinite(waveVal) ? waveVal.toFixed(1) + 'm' : '—'}, wind: ${Number.isFinite(windVal) ? windVal.toFixed(1) + 'm/s' : '—'})`
  } else {
    summary = `Favorable conditions (wave: ${Number.isFinite(waveVal) ? waveVal.toFixed(1) + 'm' : '—'}, wind: ${Number.isFinite(windVal) ? windVal.toFixed(1) + 'm/s' : '—'})`
  }

  return {
    name: endpointName,
    assessment,
    summary,
    waveVal: Number.isFinite(waveVal) ? waveVal : null,
    windVal: Number.isFinite(windVal) ? windVal : null,
    visVal: Number.isFinite(visVal) ? visVal : null,
    isSevereCyclone,
    isSevereSea,
    isMarginalSea,
    isDataInsufficient,
    hasData,
  }
}

/**
 * Universal Marine Route Engine
 *
 * Evaluates candidate route requests against available authoritative environmental evidence,
 * generates provisional reference corridors, and provides transparent recommendations.
 *
 * CRITICAL ANTI-FABRICATION RULE:
 * This engine does NOT create fake straight-line nautical routes and call them nautical routes.
 * Corridors are marked isAuthoritativeNauticalRoute: false, and explicit limitations are attached.
 *
 * @param {object} routeRequest Reusable RouteRequest object
 * @param {object} [evidenceContext] Current environmental evidence & ORCA decision context
 * @returns {object} Evaluated RoutePlan
 */
export function planMarineRoute(routeRequest, evidenceContext = {}) {
  // 1. Validate route request
  if (!routeRequest || typeof routeRequest !== 'object') {
    return {
      status: ROUTE_STATUS.ROUTE_UNAVAILABLE,
      recommendation: {
        state: RECOMMENDATION_STATE.NOT_APPLICABLE,
        recommended: false,
        reason: 'Invalid or missing route request.',
      },
      geometry: null,
      limitations: ['Route request must be a valid structured request object.'],
      provenance: null,
    }
  }

  const { activity, origin, destination, target } = routeRequest
  const destinationOrTarget = target || destination
  const config = getActivityRoutingConfig(activity)

  // 2. Validate coordinates
  const originCoords = extractCoordinates(origin)
  const targetCoords = extractCoordinates(destinationOrTarget)

  if (!originCoords && activity !== CANONICAL_ACTIVITIES.FISHING) {
    return {
      status: ROUTE_STATUS.ROUTE_UNAVAILABLE,
      recommendation: {
        state: RECOMMENDATION_STATE.NOT_APPLICABLE,
        recommended: false,
        reason: 'Origin departure point could not be resolved.',
      },
      geometry: null,
      origin,
      destination,
      target,
      constraintsApplied: [],
      constraintsUnavailable: config.unsupportedConstraints,
      limitations: [
        'Origin departure point must resolve to valid geographic coordinates.',
      ],
      provenance: {
        engine: 'ORCA Universal Marine Route Engine v1',
        activity,
        generatedAt: new Date().toISOString(),
      },
    }
  }

  // 3. ACTIVITY-AWARE EVALUATION

  // ==========================================
  // ACTIVITY A: FISHING (MULTI-PFZ CANDIDATES)
  // ==========================================
  if (activity === CANONICAL_ACTIVITIES.FISHING) {
    const pfzFeaturesInput =
      evidenceContext?.officialPfz?.data?.features ||
      evidenceContext?.officialPfz?.features ||
      evidenceContext?.pfzFeatures ||
      evidenceContext?.pfzData ||
      (Array.isArray(routeRequest?.pfzFeatures) ? routeRequest.pfzFeatures : null)

    if (pfzFeaturesInput && (Array.isArray(pfzFeaturesInput) ? pfzFeaturesInput.length > 0 : pfzFeaturesInput?.length > 0)) {
      const candidateEval = evaluatePfzCandidates(originCoords, pfzFeaturesInput, evidenceContext)

      if (candidateEval.candidates.length > 0) {
        const selectedCandidate = candidateEval.selectedCandidate
        const bearingDeg = selectedCandidate.bearingDeg
        const bearingCardinal = selectedCandidate.bearingCardinal

        const geometry = {
          type: 'provisional_corridor',
          coordinates: [originCoords, selectedCandidate.coordinates],
          distanceNm: selectedCandidate.distanceNm,
          bearingDeg,
          bearingCardinal,
          isAuthoritativeNauticalRoute: false,
          disclaimer:
            'Provisional corridor — not certified nautical navigation. Certified bridge navigation systems must be used.',
        }

        const limitations = [
          'Provisional corridor — not certified nautical navigation.',
          'PFZ geometry is supplemental intelligence; safety is governed by ORCA environmental criteria.',
          'Fish species, catch probability, and fish abundance are not modelled or predicted.',
          'Bathymetric depth clearance, vessel draft limits, and local channel pilotage are unavailable.',
        ]

        return {
          routeRequest,
          origin,
          destination: null,
          target: selectedCandidate,
          geometry,
          status: candidateEval.status,
          recommendation: {
            state: candidateEval.recommendationState,
            recommended:
              candidateEval.recommendationState === RECOMMENDATION_STATE.RECOMMENDED ||
              candidateEval.recommendationState === RECOMMENDATION_STATE.CONDITIONAL,
            reason: candidateEval.reason,
          },
          evaluation: {
            status: candidateEval.status,
            distanceNm: selectedCandidate.distanceNm,
            bearingDeg,
            bearingCardinal,
            targetCandidateId: selectedCandidate.id,
          },
          pfzCandidates: candidateEval.candidates,
          selectedPfz: selectedCandidate,
          supplementalIntelligence: true,
          constraintsApplied: [
            'cyclone_hazard_check',
            'marine_wind_wave_check',
            'pfz_wfs_feature_proximity',
            'seaward_bearing_ranking',
          ],
          constraintsUnavailable: [
            'nautical_fairway_waypoints',
            'bathymetric_depth_clearance',
            'vessel_draft_limits',
            'species_catch_probability',
          ],
          limitations,
          provenance: {
            engine: 'ORCA Universal Marine Route Engine v1',
            activity: CANONICAL_ACTIVITIES.FISHING,
            isAuthoritativeNauticalRoute: false,
            generatedAt: new Date().toISOString(),
          },
        }
      }
    }
  }

  // If target coordinates are missing for non-fishing or fishing fallback
  if (!originCoords || !targetCoords) {
    return {
      status: ROUTE_STATUS.ROUTE_UNAVAILABLE,
      recommendation: {
        state: RECOMMENDATION_STATE.NOT_APPLICABLE,
        recommended: false,
        reason: 'Origin or destination coordinates could not be resolved.',
      },
      geometry: null,
      origin,
      destination,
      target,
      constraintsApplied: [],
      constraintsUnavailable: config.unsupportedConstraints,
      limitations: [
        'Both origin departure point and target destination must resolve to valid geographic coordinates.',
      ],
      provenance: {
        engine: 'ORCA Universal Marine Route Engine v1',
        activity,
        generatedAt: new Date().toISOString(),
      },
    }
  }

  // 4. Compute Great Circle Distance and Initial Bearing
  const distanceNm = haversineNm(
    originCoords[0],
    originCoords[1],
    targetCoords[0],
    targetCoords[1]
  )
  const bearingDeg = calculateBearing(
    originCoords[0],
    originCoords[1],
    targetCoords[0],
    targetCoords[1]
  )
  const bearingCardinal = bearingToCardinal(bearingDeg)

  // 5. Generate candidate provisional corridor geometry
  const geometry = {
    type: 'provisional_corridor',
    coordinates: [originCoords, targetCoords],
    distanceNm: Math.round(distanceNm * 100) / 100,
    bearingDeg,
    bearingCardinal,
    isAuthoritativeNauticalRoute: false,
    disclaimer:
      activity === CANONICAL_ACTIVITIES.MARINE_TRAVEL
        ? 'Provisional reference corridor only — not certified for vessel navigation. Straight line does not avoid landmasses.'
        : activity === CANONICAL_ACTIVITIES.FISHING
        ? 'Provisional corridor — not certified nautical navigation. Certified bridge navigation systems must be used.'
        : 'Provisional reference corridor only. Not certified for vessel navigation. Waypoint and bathymetric navigation must be provided by official nautical charts/routing engines.',
  }

  // ==========================================
  // ACTIVITY B: MARINE TRAVEL (DUAL ENDPOINTS)
  // ==========================================
  if (activity === CANONICAL_ACTIVITIES.MARINE_TRAVEL) {
    const originEvidence =
      evidenceContext?.originDecision?.evidence ||
      evidenceContext?.originDecision?.decision?.evidence ||
      evidenceContext?.locationDecision?.evidence ||
      evidenceContext?.locationDecision?.decision?.evidence ||
      evidenceContext?.evidence ||
      []
    const originRiskLevel =
      evidenceContext?.originDecision?.decision?.riskLevel ||
      evidenceContext?.locationDecision?.decision?.riskLevel ||
      null

    const destEvidence =
      evidenceContext?.destinationDecision?.evidence ||
      evidenceContext?.destinationDecision?.decision?.evidence ||
      evidenceContext?.endpoints?.destination?.evidence ||
      []
    const destRiskLevel =
      evidenceContext?.destinationDecision?.decision?.riskLevel ||
      evidenceContext?.endpoints?.destination?.decision?.riskLevel ||
      null

    const originAssessment = evaluateEndpointConditions(
      originEvidence,
      originRiskLevel,
      origin?.name || 'Origin Port'
    )
    const destAssessment = evaluateEndpointConditions(
      destEvidence,
      destRiskLevel,
      destination?.name || 'Destination Port'
    )

    let status = ROUTE_STATUS.ROUTE_EVALUATED
    let recommendation = {
      state: RECOMMENDATION_STATE.RECOMMENDED,
      recommended: true,
      reason: `Evaluated available environmental conditions at ${originAssessment.name} and ${destAssessment.name}. Both endpoints report safe sea state.`,
    }

    if (originAssessment.isSevereCyclone || destAssessment.isSevereCyclone) {
      status = ROUTE_STATUS.ROUTE_EVALUATED
      recommendation = {
        state: RECOMMENDATION_STATE.NOT_RECOMMENDED,
        recommended: false,
        reason: `Transit not recommended: active severe cyclone advisory at ${
          originAssessment.isSevereCyclone ? originAssessment.name : destAssessment.name
        }.`,
      }
    } else if (originAssessment.isSevereSea || destAssessment.isSevereSea) {
      status = ROUTE_STATUS.ROUTE_EVALUATED
      recommendation = {
        state: RECOMMENDATION_STATE.NOT_RECOMMENDED,
        recommended: false,
        reason: `Transit not recommended: rough sea conditions at ${
          originAssessment.isSevereSea ? originAssessment.name : destAssessment.name
        }.`,
      }
    } else if (originAssessment.isDataInsufficient || (destAssessment.hasData && destAssessment.isDataInsufficient)) {
      status = ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT
      recommendation = {
        state: RECOMMENDATION_STATE.DATA_INSUFFICIENT,
        recommended: false,
        reason: 'Route recommendation unavailable because required endpoint weather evidence is insufficient.',
      }
    } else if (!destAssessment.hasData && !originAssessment.hasData) {
      status = ROUTE_STATUS.ROUTE_EVALUATED
      recommendation = {
        state: RECOMMENDATION_STATE.RECOMMENDED,
        recommended: true,
        reason: 'Recommended provisional reference corridor. Route-level weather and certified water-only navigation unavailable.',
      }
    } else if (!destAssessment.hasData) {
      if (originAssessment.isMarginalSea) {
        status = ROUTE_STATUS.ROUTE_PARTIALLY_EVALUATED
        recommendation = {
          state: RECOMMENDATION_STATE.CONDITIONAL,
          recommended: true,
          reason: `Caution advised: marginal conditions at ${originAssessment.name}. Destination weather data not loaded.`,
        }
      } else if (originAssessment.isDataInsufficient) {
        status = ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT
        recommendation = {
          state: RECOMMENDATION_STATE.DATA_INSUFFICIENT,
          recommended: false,
          reason: 'Route recommendation unavailable because origin weather evidence is insufficient.',
        }
      } else {
        status = ROUTE_STATUS.ROUTE_PARTIALLY_EVALUATED
        recommendation = {
          state: RECOMMENDATION_STATE.CONDITIONAL,
          recommended: true,
          reason: `Origin endpoint (${originAssessment.name}) reports safe conditions. Destination weather data is not currently loaded; route evaluated with origin conditions only.`,
        }
      }
    } else if (originAssessment.isMarginalSea || destAssessment.isMarginalSea) {
      status = ROUTE_STATUS.ROUTE_PARTIALLY_EVALUATED
      recommendation = {
        state: RECOMMENDATION_STATE.CONDITIONAL,
        recommended: true,
        reason: `Conditional transit reference corridor; caution advised due to marginal conditions at ${
          originAssessment.isMarginalSea ? originAssessment.name : destAssessment.name
        }.`,
      }
    }

    const limitations = [
      'Provisional reference corridor only — not certified for vessel navigation.',
      'Automated nautical waypoints deferred to certified navigation systems.',
      'Certified water-only navigation route cannot be generated with current data (straight-line corridor does not avoid landmasses or follow maritime fairways).',
      'Route-level en-route spatial weather grid is unavailable; only terminal endpoints evaluated.',
      'Bathymetric depth clearance, vessel draft limits, and tidal stream currents are unavailable.',
      'Do not claim safe route, best route, ETA, or navigational clearance.',
    ]

    return {
      routeRequest,
      origin,
      destination,
      target: destinationOrTarget,
      geometry,
      status,
      endpointAssessment: {
        origin: originAssessment,
        destination: destAssessment,
      },
      evaluation: {
        status,
        distanceNm: geometry.distanceNm,
        bearingDeg,
        bearingCardinal,
        originAssessment,
        destAssessment,
      },
      recommendation,
      constraintsApplied: [
        'origin_endpoint_environmental_check',
        'destination_endpoint_environmental_check',
        'endpoint_cyclone_screening',
      ],
      constraintsUnavailable: [
        'coastline_land_avoidance',
        'nautical_fairway_waypoints',
        'route_level_spatial_weather_grid',
        'bathymetric_depth_clearance',
        'vessel_draft_limits',
        'tidal_stream_currents',
        'vessel_traffic_separation',
      ],
      limitations,
      provenance: {
        generatedAt: new Date().toISOString(),
        engine: 'ORCA Universal Marine Route Engine v1',
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        isAuthoritativeNauticalRoute: false,
      },
    }
  }

  // ==========================================
  // ACTIVITY C: PORT MOVEMENT & OTHER
  // ==========================================
  const locationDecision = evidenceContext?.locationDecision?.decision || evidenceContext?.decision || null
  const evidenceList = Array.isArray(locationDecision?.evidence)
    ? locationDecision.evidence
    : Array.isArray(evidenceContext?.evidence)
    ? evidenceContext.evidence
    : []

  const isOrcaDataInsufficient =
    locationDecision?.riskLevel === 'DATA_INSUFFICIENT' ||
    (evidenceContext?.dataStatus?.complete === false && evidenceContext?.dataStatus?.completeness === 0)

  const cycloneEvidence = evidenceList.find((e) => e.parameter === 'cyclone')
  const isSevereCyclone =
    locationDecision?.riskLevel === 'NO_VENTURE_SEVERE_CYCLONE' ||
    locationDecision?.severeCycloneOverrideApplied === true ||
    (cycloneEvidence?.status === 'available' && cycloneEvidence.value?.active && cycloneEvidence.value?.severity >= 2)

  const waveEvidence = evidenceList.find((e) => e.parameter === 'waveHeight')
  const windEvidence = evidenceList.find((e) => e.parameter === 'windSpeed')
  const waveVal = Number(waveEvidence?.value)
  const windVal = Number(windEvidence?.value)

  const isSevereSea =
    (Number.isFinite(waveVal) && waveVal > 3.5) ||
    (Number.isFinite(windVal) && windVal > 17.2)

  const isMarginalSea =
    (Number.isFinite(waveVal) && waveVal > 2.2) ||
    (Number.isFinite(windVal) && windVal > 12.0)

  let status = ROUTE_STATUS.ROUTE_EVALUATED
  let recommendation = {
    state: RECOMMENDATION_STATE.RECOMMENDED,
    recommended: true,
    reason:
      activity === CANONICAL_ACTIVITIES.PORT_MOVEMENT
        ? 'Outer approach corridor evaluated against harbour entrance environmental conditions.'
        : 'Recommended provisional corridor based on available environmental evidence.',
  }

  if (isOrcaDataInsufficient) {
    status = ROUTE_STATUS.ROUTE_DATA_INSUFFICIENT
    recommendation = {
      state: RECOMMENDATION_STATE.DATA_INSUFFICIENT,
      recommended: false,
      reason: 'Route recommendation unavailable because required route evidence is insufficient.',
    }
  } else if (isSevereCyclone) {
    status = ROUTE_STATUS.ROUTE_EVALUATED
    recommendation = {
      state: RECOMMENDATION_STATE.NOT_RECOMMENDED,
      recommended: false,
      reason: 'Transit not advised due to active severe cyclone advisory in the operational area.',
    }
  } else if (isSevereSea) {
    status = ROUTE_STATUS.ROUTE_EVALUATED
    recommendation = {
      state: RECOMMENDATION_STATE.NOT_RECOMMENDED,
      recommended: false,
      reason: 'Transit not recommended due to rough sea conditions (wave height > 3.5m or gale wind).',
    }
  } else if (isMarginalSea) {
    status = ROUTE_STATUS.ROUTE_PARTIALLY_EVALUATED
    recommendation = {
      state: RECOMMENDATION_STATE.CONDITIONAL,
      recommended: true,
      reason: 'Conditional transit corridor; exercise caution for marginal sea state.',
    }
  }

  const limitations =
    activity === CANONICAL_ACTIVITIES.PORT_MOVEMENT
      ? [
          'Berth-level piloting, inner-harbour channels, tug assistance, and docking clearance are unavailable.',
          'Corridor applies strictly to outer roadstead / harbour approach context.',
          'Do not draw or navigate inner-harbour channels without certified pilotage.',
        ]
      : activity === CANONICAL_ACTIVITIES.FISHING
      ? [
          'Provisional corridor — not certified nautical navigation.',
          'PFZ geometry is supplemental intelligence; safety is governed by ORCA environmental criteria.',
          'Fish species, catch probability, and fish abundance are not modelled or predicted.',
          'Bathymetric depth clearance and local channel pilotage are unavailable.',
        ]
      : activity === CANONICAL_ACTIVITIES.OCEAN_EXPLORATION
      ? [
          'Exploration corridor provides linear spatial reference only.',
          'Does not replace research cruise planning, bathymetric clearance, or certified pilotage.',
          'Ocean current drift vectors and subsurface depth clearance are unavailable.',
        ]
      : [
          'Automated nautical waypoints deferred to certified navigation systems.',
          'Bathymetric depth clearance and vessel draft limits are unavailable.',
          'Tidal stream currents and vessel traffic separation schemes are not evaluated.',
          'Corridor is a provisional geometric reference and must not be used for pilotage or auto-steering.',
        ]

  return {
    routeRequest,
    origin,
    destination,
    target: destinationOrTarget,
    geometry,
    status,
    evaluation: {
      status,
      isOrcaDataInsufficient,
      isSevereCyclone,
      waveVal: Number.isFinite(waveVal) ? waveVal : null,
      windVal: Number.isFinite(windVal) ? windVal : null,
      distanceNm: geometry.distanceNm,
      bearingDeg,
      bearingCardinal,
    },
    recommendation,
    constraintsApplied: [
      'cyclone_hazard_check',
      'marine_wind_wave_check',
      'environmental_evidence_completeness',
    ],
    constraintsUnavailable: [...config.unsupportedConstraints],
    limitations,
    provenance: {
      generatedAt: new Date().toISOString(),
      engine: 'ORCA Universal Marine Route Engine v1',
      activity,
      isAuthoritativeNauticalRoute: false,
    },
  }
}
