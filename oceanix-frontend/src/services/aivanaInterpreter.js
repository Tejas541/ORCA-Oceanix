import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'

export const CANONICAL_ACTIVITIES = Object.freeze({
  FISHING: 'fishing',
  MARINE_TRAVEL: 'marine_travel',
  PORT_MOVEMENT: 'port_movement',
  MARINE_SAFETY: 'marine_safety',
  OCEAN_EXPLORATION: 'ocean_exploration',
  OTHER: 'other',
})

export const DEFAULT_ACTIVITY_CONTEXT = Object.freeze({
  activity: null,
  objective: null,
  origin: null,
  destination: null,
  operatingLocation: null,
})

export function createActivityContext({
  activity = null,
  objective = null,
  origin = null,
  destination = null,
  operatingLocation = null,
} = {}) {
  return Object.freeze({
    activity,
    objective,
    origin,
    destination,
    operatingLocation,
  })
}

export const AIVANA_INTENTS = Object.freeze({
  FISHING: 'fishing',
  TRAVEL: 'travel',
  PORT_MOVEMENT: 'port_movement',
  MARINE_SAFETY: 'marine_safety',
  ORCA_CAPABILITIES: 'orca_capabilities',
  OCEAN_EXPLORATION: 'ocean_exploration',
  DESTINATION_NAVIGATION: 'destination_navigation',
  NEARBY_PORTS: 'nearby_ports',
  OTHER: 'other',
})

export const CLARIFICATION_QUESTION = 'Which operating area or port should I analyze?'
export const DESTINATION_CLARIFICATION_QUESTION = 'Which destination are you travelling to?'
export const ACTIVITY_CLARIFICATION_QUESTION =
  'Could you clarify what marine activity you want to perform? (e.g., fishing, marine travel, port movement, safety assessment, or ocean exploration)'

/**
 * Mapping of canonical operating location IDs to recognition aliases.
 * All resolved locations return the canonical record from marineOperatingLocations.js.
 */
const LOCATION_ALIAS_MAP = [
  {
    id: 'major-port-jawaharlal-nehru',
    aliases: ['jnpa', 'jawaharlal nehru', 'jawaharlal nehru port authority', 'nhava sheva'],
  },
  {
    id: 'major-port-cochin',
    aliases: ['cochin', 'kochi', 'cochin port authority', 'ernakulam'],
  },
  {
    id: 'major-port-mumbai',
    aliases: ['mumbai', 'mumbai port authority', 'bombay'],
  },
  {
    id: 'major-port-chennai',
    aliases: ['chennai', 'chennai port authority', 'madras'],
  },
  {
    id: 'major-port-deendayal',
    aliases: ['deendayal', 'deendayal port authority', 'kandla'],
  },
  {
    id: 'major-port-mormugao',
    aliases: ['mormugao', 'mormugao port authority', 'goa', 'marmagao'],
  },
  {
    id: 'major-port-new-mangalore',
    aliases: ['new mangalore', 'mangalore', 'new mangalore port authority'],
  },
  {
    id: 'major-port-voc',
    aliases: [
      'v.o. chidambaranar',
      'voc',
      'v.o.c',
      'v o c',
      'chidambaranar',
      'tuticorin',
      'thoothukudi',
    ],
  },
  {
    id: 'major-port-kamarajar',
    aliases: ['kamarajar', 'ennore', 'kamarajar port limited'],
  },
  {
    id: 'major-port-visakhapatnam',
    aliases: ['visakhapatnam', 'vizag', 'visakhapatnam port authority'],
  },
  {
    id: 'major-port-paradip',
    aliases: ['paradip', 'paradeep', 'paradip port authority'],
  },
  {
    id: 'major-port-kolkata',
    aliases: ['kolkata', 'calcutta', 'smpa kolkata', 'kolkata dock system'],
  },
  {
    id: 'major-port-haldia',
    aliases: ['haldia', 'smpa haldia', 'haldia dock complex'],
  },
]

/**
 * Resolves a canonical marine operating location object from text, alias, or ID.
 *
 * @param {string} text
 * @returns {object|null} Canonical location object or null
 */
export function resolveOperatingLocationFromText(text) {
  if (!text || typeof text !== 'string') return null
  const normalized = text.trim().toLowerCase()
  if (!normalized) return null

  // 1. Check exact ID match against canonical locations
  const exactIdMatch = MARINE_OPERATING_LOCATIONS.find((loc) => loc.id === normalized)
  if (exactIdMatch) return exactIdMatch

  // 2. Search alias entries using word boundary matching to prevent partial matches
  for (const entry of LOCATION_ALIAS_MAP) {
    for (const alias of entry.aliases) {
      // Escape special regex characters in alias
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(^|\\b|[^a-zA-Z0-9])${escaped}($|\\b|[^a-zA-Z0-9])`, 'i')
      if (regex.test(normalized)) {
        return (
          MARINE_OPERATING_LOCATIONS.find((loc) => loc.id === entry.id) ?? null
        )
      }
    }
  }

  // 3. Search canonical location names and districts
  for (const loc of MARINE_OPERATING_LOCATIONS) {
    const locName = loc.name.toLowerCase()
    const district = (loc.district || '').toLowerCase()
    if (normalized.includes(locName) || (district && normalized.includes(district))) {
      return loc
    }
  }

  return null
}

/**
 * Cleans extracted endpoint candidate strings of trailing punctuation and marine transport filler words.
 *
 * @param {string} str
 * @returns {string}
 */
function cleanLocationCandidate(str) {
  if (!str) return ''
  return str
    .replace(/\b(?:by\s+sea|by\s+boat|by\s+ship|by\s+water|by\s+vessel)\b/gi, '')
    .replace(/[.,!?;:]+$/, '')
    .trim()
}

/**
 * Extracts travel origin and destination endpoints from marine travel queries.
 *
 * @param {string} rawQuery
 * @returns {{ origin: object|null, destination: object|null, rawOrigin: string|null, rawDestination: string|null }}
 */
export function extractTravelEndpoints(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return { origin: null, destination: null, rawOrigin: null, rawDestination: null }
  }
  const query = rawQuery.trim()

  // Pattern 1: from <origin> to <destination>
  // e.g. "travel from Mumbai to Goa", "from Mumbai to Goa by sea"
  const fromToMatch = query.match(
    /\bfrom\s+([^,.\n]+?)\s+to\s+([^,.\n]+?)(?:\s+(?:by\s+sea|by\s+boat|by\s+ship|by\s+vessel)|\b|[.?!]|$)/i
  )
  if (fromToMatch) {
    const rawOrigin = cleanLocationCandidate(fromToMatch[1])
    const rawDestination = cleanLocationCandidate(fromToMatch[2])
    const origin = resolveOperatingLocationFromText(rawOrigin)
    const destination = resolveOperatingLocationFromText(rawDestination)
    return { origin, destination, rawOrigin, rawDestination }
  }

  // Pattern 2: to <destination> from <origin>
  const toFromMatch = query.match(
    /\bto\s+([^,.\n]+?)\s+from\s+([^,.\n]+?)(?:\s+(?:by\s+sea|by\s+boat|by\s+ship|by\s+vessel)|\b|[.?!]|$)/i
  )
  if (toFromMatch) {
    const rawDestination = cleanLocationCandidate(toFromMatch[1])
    const rawOrigin = cleanLocationCandidate(toFromMatch[2])
    const destination = resolveOperatingLocationFromText(rawDestination)
    const origin = resolveOperatingLocationFromText(rawOrigin)
    return { origin, destination, rawOrigin, rawDestination }
  }

  // Pattern 3: to <destination> (without origin)
  // e.g. "travelling to Goa", "travel to Goa", "navigate to Goa", "sail to Goa", "conditions for travelling to Goa"
  const toMatch = query.match(
    /\b(?:travel(?:l?ing)?|go(?:ing)?|voyage|passage|transit|sail(?:ing)?|route|head(?:ing)?|navigate|take me)\s+to\s+([^,.\n]+?)(?:\s+(?:by\s+sea|by\s+boat|by\s+ship|by\s+vessel)|\b|[.?!]|$)/i
  )
  if (toMatch) {
    const rawDestination = cleanLocationCandidate(toMatch[1])
    const destination = resolveOperatingLocationFromText(rawDestination)
    return { origin: null, destination, rawOrigin: null, rawDestination }
  }

  // Pattern 4: from <origin> (without destination)
  // e.g. "travel from Mumbai", "sail from Kochi"
  const fromMatch = query.match(
    /\b(?:travel(?:l?ing)?|go(?:ing)?|voyage|passage|transit|sail(?:ing)?|route|head(?:ing)?|navigate)\s+from\s+([^,.\n]+?)(?:\s+(?:by\s+sea|by\s+boat|by\s+ship|by\s+vessel)|\b|[.?!]|$)/i
  )
  if (fromMatch) {
    const rawOrigin = cleanLocationCandidate(fromMatch[1])
    const origin = resolveOperatingLocationFromText(rawOrigin)
    return { origin, destination: null, rawOrigin, rawDestination: null }
  }

  return { origin: null, destination: null, rawOrigin: null, rawDestination: null }
}

/**
 * Determines whether an input represents a canonical operating location record.
 *
 * @param {object|string|null} locationInput
 * @returns {object|null}
 */
export function normalizeOperatingLocation(locationInput) {
  if (!locationInput) return null

  // If already a canonical location record
  if (typeof locationInput === 'object' && locationInput.id) {
    const canonical = MARINE_OPERATING_LOCATIONS.find((loc) => loc.id === locationInput.id)
    return canonical || locationInput
  }

  if (typeof locationInput === 'string') {
    return resolveOperatingLocationFromText(locationInput)
  }

  return null
}

/**
 * Classifies the intent of an incoming user query.
 * Deterministic rules ensure predictability and strict testability.
 *
 * @param {string} rawQuery
 * @returns {string} One of AIVANA_INTENTS
 */
export function detectAivanaIntent(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return AIVANA_INTENTS.OTHER
  }

  const query = rawQuery.trim().toLowerCase()
  if (!query) return AIVANA_INTENTS.OTHER

  // ORCA Capabilities
  if (
    query.includes('what can orca do') ||
    query.includes('explain capabilities') ||
    query.includes('orca capabilities') ||
    query.includes('what is orca') ||
    query.includes('how does orca work') ||
    query.includes('what are orca') ||
    query.includes('help me understand orca') ||
    query.includes('about orca')
  ) {
    return AIVANA_INTENTS.ORCA_CAPABILITIES
  }

  // Ocean Exploration (general Indian Ocean queries or exploration requests)
  if (
    query.includes('explore the indian ocean') ||
    query.includes('tell me about the indian ocean') ||
    query.includes('about the indian ocean') ||
    query.includes('indian ocean regions') ||
    query.includes('insights on regions') ||
    query.startsWith('explore the ocean') ||
    query === 'indian ocean' ||
    query.includes('explore this area') ||
    query.includes('ocean conditions') ||
    query.includes('sea conditions') ||
    query.includes('explore') ||
    query.includes('exploration')
  ) {
    return AIVANA_INTENTS.OCEAN_EXPLORATION
  }

  // Nearby Ports Discovery
  if (
    query.includes('nearby port') ||
    query.includes('ports nearby') ||
    query.includes('nearest port') ||
    query.includes('suggest port') ||
    query.includes('nearby operating location') ||
    query === 'show me nearby ports' ||
    query.includes('what ports are nearby')
  ) {
    return AIVANA_INTENTS.NEARBY_PORTS
  }

  // Fishing Operations
  if (
    query.includes('fish') ||
    query.includes('pfz') ||
    query.includes('potential fishing zone') ||
    query.includes('tuna') ||
    query.includes('catch') ||
    query.includes('trawler') ||
    query.includes('fishing operation') ||
    query.includes('fishing trip') ||
    query.includes('fishing conditions')
  ) {
    return AIVANA_INTENTS.FISHING
  }

  // Destination / Navigation requests (distinct from ORCA operating location)
  if (
    query.startsWith('take me to') ||
    query.startsWith('navigate to') ||
    query.startsWith('sail to') ||
    query.startsWith('head to') ||
    query.startsWith('go to') ||
    query.startsWith('route to')
  ) {
    return AIVANA_INTENTS.DESTINATION_NAVIGATION
  }

  // Port Movement / Port Conditions / Berth / Dock / Port Entry
  if (
    query.includes('port condition') ||
    query.includes('port movement') ||
    query.includes('harbour condition') ||
    query.includes('harbor condition') ||
    query.includes('berth') ||
    query.includes('dock condition') ||
    query.includes('at the port') ||
    query.includes('port weather') ||
    query.includes('check port') ||
    query.includes('port entry') ||
    query.includes('harbour entry') ||
    query.includes('harbor entry') ||
    query.includes('entering') ||
    query.includes('moving my vessel') ||
    query.includes('move my vessel') ||
    query.includes('vessel into') ||
    query.includes('enter port') ||
    query.includes('enter ') ||
    query.includes('into port') ||
    /\bconditions at .* port\b/.test(query)
  ) {
    return AIVANA_INTENTS.PORT_MOVEMENT
  }

  // Sea Travel / Voyage
  if (
    query.includes('travel') ||
    query.includes('voyage') ||
    query.includes('sea travel') ||
    query.includes('sail') ||
    query.includes('sailing') ||
    query.includes('passage') ||
    query.includes('transit') ||
    query.includes('route risk') ||
    query.includes('plan route') ||
    query.includes('by sea') ||
    /\bgo from\b.*\bto\b/.test(query)
  ) {
    return AIVANA_INTENTS.TRAVEL
  }

  // Marine Safety / Alerts / Safe to operate
  if (
    query.includes('safety') ||
    query.includes('stay safe') ||
    query.includes('safe at sea') ||
    query.includes('marine safety') ||
    query.includes('alert') ||
    query.includes('advisory') ||
    query.includes('hazard') ||
    query.includes('cyclone') ||
    query.includes('warning') ||
    query.includes('safe to operate') ||
    query.includes('safely operate') ||
    query.includes('is it safe') ||
    query.includes('can i operate safely') ||
    query.includes('safe here')
  ) {
    return AIVANA_INTENTS.MARINE_SAFETY
  }

  return AIVANA_INTENTS.OTHER
}

/**
 * Checks if a given intent requires an operating location.
 *
 * @param {string} intent
 * @returns {boolean}
 */
export function requiresOperatingLocationForIntent(intent) {
  switch (intent) {
    case AIVANA_INTENTS.FISHING:
    case AIVANA_INTENTS.TRAVEL:
    case AIVANA_INTENTS.PORT_MOVEMENT:
    case AIVANA_INTENTS.MARINE_SAFETY:
      return true
    case AIVANA_INTENTS.ORCA_CAPABILITIES:
    case AIVANA_INTENTS.OCEAN_EXPLORATION:
    case AIVANA_INTENTS.OTHER:
    default:
      return false
  }
}

/**
 * Deterministic Aivana request interpretation layer.
 *
 * Location Resolution Priority:
 * 1. Explicit location supplied separately by the UI (explicitLocation)
 * 2. Explicit location detected in the user's query
 * 3. Existing active ScenarioContext location (activeLocation)
 * 4. Otherwise CLARIFICATION (if required by intent)
 *
 * Strictly NO GPS fallback, NO nearest port default, NO JNPA default.
 *
 * @param {string} query User query (voice transcript or text input)
 * @param {object|string|null} [explicitLocation] Explicit location provided by UI
 * @param {object|null} [activeLocation] Current ScenarioContext selectedOperatingLocation
 * @returns {object} Structured Aivana task/interpretation result including canonical activityContext
 */
export function interpretAivanaRequest(query, explicitLocation = null, activeLocation = null) {
  // 1. Validate query
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      intent: AIVANA_INTENTS.OTHER,
      requiresOperatingLocation: false,
      explicitLocation: null,
      resolvedLocation: null,
      origin: null,
      destination: null,
      status: 'IDLE',
      clarificationQuestion: null,
      activityContext: { ...DEFAULT_ACTIVITY_CONTEXT },
    }
  }

  const trimmedQuery = query.trim()

  // 2. Classify intent
  const intent = detectAivanaIntent(trimmedQuery)

  // 3. Location Resolution Priority helpers
  let normalizedExplicit = normalizeOperatingLocation(explicitLocation)
  let resolvedLocation = null
  let explicitSource = null

  if (normalizedExplicit) {
    resolvedLocation = normalizedExplicit
    explicitSource = normalizedExplicit
  }

  // Query-level location resolution (used by fishing, port movement, marine safety)
  if (!resolvedLocation) {
    const detectedInQuery = resolveOperatingLocationFromText(trimmedQuery)
    if (detectedInQuery) {
      resolvedLocation = detectedInQuery
      explicitSource = detectedInQuery
    }
  }

  // Active location fallback
  if (!resolvedLocation && activeLocation) {
    const normalizedActive = normalizeOperatingLocation(activeLocation)
    if (normalizedActive) {
      resolvedLocation = normalizedActive
    }
  }

  // --- SPECIAL HANDLING: TRAVEL / DESTINATION NAVIGATION ---
  if (intent === AIVANA_INTENTS.TRAVEL || intent === AIVANA_INTENTS.DESTINATION_NAVIGATION) {
    const endpoints = extractTravelEndpoints(trimmedQuery)
    const destinationLocation =
      endpoints.destination || (intent === AIVANA_INTENTS.DESTINATION_NAVIGATION ? resolveOperatingLocationFromText(trimmedQuery) : null)
    const originLocation = endpoints.origin

    // Case A: Both origin and destination are present
    if (originLocation && destinationLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        objective: 'travel',
        origin: originLocation,
        destination: destinationLocation,
        operatingLocation: null,
      })
      return {
        intent: AIVANA_INTENTS.TRAVEL,
        requiresOperatingLocation: false,
        origin: originLocation,
        destination: destinationLocation,
        explicitLocation: explicitSource,
        resolvedLocation: null,
        status: 'READY',
        clarificationQuestion: null,
        activityContext,
      }
    }

    // Case B: Destination is present, origin is null
    if (destinationLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        objective: 'travel',
        origin: null,
        destination: destinationLocation,
        operatingLocation: null,
      })
      return {
        intent: intent === AIVANA_INTENTS.DESTINATION_NAVIGATION ? AIVANA_INTENTS.DESTINATION_NAVIGATION : AIVANA_INTENTS.TRAVEL,
        requiresOperatingLocation: false,
        origin: null,
        destination: destinationLocation,
        explicitLocation: explicitSource,
        resolvedLocation: null,
        status: 'READY',
        clarificationQuestion: null,
        activityContext,
      }
    }

    // Case C: Origin is present but destination is missing
    if (originLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        objective: 'travel',
        origin: originLocation,
        destination: null,
        operatingLocation: null,
      })
      return {
        intent: AIVANA_INTENTS.TRAVEL,
        requiresOperatingLocation: true,
        origin: originLocation,
        destination: null,
        explicitLocation: explicitSource,
        resolvedLocation: null,
        status: 'CLARIFICATION',
        clarificationQuestion: DESTINATION_CLARIFICATION_QUESTION,
        activityContext,
      }
    }

    // Case D: General travel request with resolved single location (e.g. activeLocation)
    if (resolvedLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
        objective: 'travel',
        origin: null,
        destination: null,
        operatingLocation: resolvedLocation,
      })
      return {
        intent: AIVANA_INTENTS.TRAVEL,
        requiresOperatingLocation: true,
        origin: null,
        destination: null,
        explicitLocation: explicitSource,
        resolvedLocation,
        status: 'READY',
        clarificationQuestion: null,
        activityContext,
      }
    }

    // Case E: General travel request without any location or destination -> CLARIFICATION
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
      objective: 'travel',
      origin: null,
      destination: null,
      operatingLocation: null,
    })
    return {
      intent: AIVANA_INTENTS.TRAVEL,
      requiresOperatingLocation: true,
      origin: null,
      destination: null,
      explicitLocation: null,
      resolvedLocation: null,
      status: 'CLARIFICATION',
      clarificationQuestion: CLARIFICATION_QUESTION,
      activityContext,
    }
  }

  // --- SPECIAL HANDLING: NEARBY PORTS ---
  if (intent === AIVANA_INTENTS.NEARBY_PORTS) {
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.OTHER,
      objective: 'nearby ports discovery',
      origin: null,
      destination: null,
      operatingLocation: activeLocation ? normalizeOperatingLocation(activeLocation) : null,
    })
    return {
      intent,
      requiresOperatingLocation: false,
      origin: null,
      destination: null,
      explicitLocation: null,
      resolvedLocation: activeLocation ? normalizeOperatingLocation(activeLocation) : null,
      status: 'READY',
      clarificationQuestion: null,
      activityContext,
    }
  }

  // --- SPECIAL HANDLING: ORCA CAPABILITIES ---
  if (intent === AIVANA_INTENTS.ORCA_CAPABILITIES) {
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.OTHER,
      objective: 'orca capabilities',
      origin: null,
      destination: null,
      operatingLocation: null,
    })
    return {
      intent,
      requiresOperatingLocation: false,
      origin: null,
      destination: null,
      explicitLocation: null,
      resolvedLocation: null,
      status: 'READY',
      clarificationQuestion: null,
      activityContext,
    }
  }

  // --- SPECIAL HANDLING: OCEAN EXPLORATION ---
  if (intent === AIVANA_INTENTS.OCEAN_EXPLORATION) {
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.OCEAN_EXPLORATION,
      objective: 'ocean exploration',
      origin: null,
      destination: null,
      operatingLocation: resolvedLocation || null,
    })
    return {
      intent,
      requiresOperatingLocation: false,
      origin: null,
      destination: null,
      explicitLocation: explicitSource,
      resolvedLocation: resolvedLocation || null,
      status: 'READY',
      clarificationQuestion: null,
      activityContext,
    }
  }

  // --- SPECIAL HANDLING: FISHING ---
  if (intent === AIVANA_INTENTS.FISHING) {
    if (resolvedLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.FISHING,
        objective: 'fishing',
        origin: null,
        destination: null,
        operatingLocation: resolvedLocation,
      })
      return {
        intent,
        requiresOperatingLocation: true,
        origin: null,
        destination: null,
        explicitLocation: explicitSource,
        resolvedLocation,
        status: 'READY',
        clarificationQuestion: null,
        activityContext,
      }
    }
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.FISHING,
      objective: 'fishing',
      origin: null,
      destination: null,
      operatingLocation: null,
    })
    return {
      intent,
      requiresOperatingLocation: true,
      origin: null,
      destination: null,
      explicitLocation: explicitSource,
      resolvedLocation: null,
      status: 'CLARIFICATION',
      clarificationQuestion: CLARIFICATION_QUESTION,
      activityContext,
    }
  }

  // --- SPECIAL HANDLING: PORT MOVEMENT ---
  if (intent === AIVANA_INTENTS.PORT_MOVEMENT) {
    if (resolvedLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.PORT_MOVEMENT,
        objective: 'port movement',
        origin: null,
        destination: null,
        operatingLocation: resolvedLocation,
      })
      return {
        intent,
        requiresOperatingLocation: true,
        origin: null,
        destination: null,
        explicitLocation: explicitSource,
        resolvedLocation,
        status: 'READY',
        clarificationQuestion: null,
        activityContext,
      }
    }
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.PORT_MOVEMENT,
      objective: 'port movement',
      origin: null,
      destination: null,
      operatingLocation: null,
    })
    return {
      intent,
      requiresOperatingLocation: true,
      origin: null,
      destination: null,
      explicitLocation: explicitSource,
      resolvedLocation: null,
      status: 'CLARIFICATION',
      clarificationQuestion: CLARIFICATION_QUESTION,
      activityContext,
    }
  }

  // --- SPECIAL HANDLING: MARINE SAFETY ---
  if (intent === AIVANA_INTENTS.MARINE_SAFETY) {
    if (resolvedLocation) {
      const activityContext = createActivityContext({
        activity: CANONICAL_ACTIVITIES.MARINE_SAFETY,
        objective: 'safety assessment',
        origin: null,
        destination: null,
        operatingLocation: resolvedLocation,
      })
      return {
        intent,
        requiresOperatingLocation: true,
        origin: null,
        destination: null,
        explicitLocation: explicitSource,
        resolvedLocation,
        status: 'READY',
        clarificationQuestion: null,
        activityContext,
      }
    }
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.MARINE_SAFETY,
      objective: 'safety assessment',
      origin: null,
      destination: null,
      operatingLocation: null,
    })
    return {
      intent,
      requiresOperatingLocation: true,
      origin: null,
      destination: null,
      explicitLocation: explicitSource,
      resolvedLocation: null,
      status: 'CLARIFICATION',
      clarificationQuestion: CLARIFICATION_QUESTION,
      activityContext,
    }
  }

  // Explicit location selection without distinct operational activity (e.g. "Use JNPA", "Select Chennai")
  if (resolvedLocation) {
    const activityContext = createActivityContext({
      activity: CANONICAL_ACTIVITIES.OTHER,
      objective: 'location selection',
      origin: null,
      destination: null,
      operatingLocation: resolvedLocation,
    })
    return {
      intent: AIVANA_INTENTS.OTHER,
      requiresOperatingLocation: false,
      origin: null,
      destination: null,
      explicitLocation: explicitSource,
      resolvedLocation,
      status: 'READY',
      clarificationQuestion: null,
      activityContext,
    }
  }

  // --- UNKNOWN / UNCLEAR ACTIVITY ---
  // "If the activity is unclear, do not guess. Return a clarification request."
  return {
    intent: AIVANA_INTENTS.OTHER,
    requiresOperatingLocation: false,
    origin: null,
    destination: null,
    explicitLocation: null,
    resolvedLocation: null,
    status: 'CLARIFICATION',
    clarificationQuestion: ACTIVITY_CLARIFICATION_QUESTION,
    activityContext: { ...DEFAULT_ACTIVITY_CONTEXT },
  }
}
