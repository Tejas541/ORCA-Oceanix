import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'

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
 * Determines whether a query string represents a canonical operating location.
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

  // Ocean Exploration (general Indian Ocean queries without operational intent)
  if (
    query.includes('explore the indian ocean') ||
    query.includes('tell me about the indian ocean') ||
    query.includes('about the indian ocean') ||
    query.includes('indian ocean regions') ||
    query.includes('insights on regions') ||
    query.startsWith('explore the ocean') ||
    query === 'indian ocean'
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

  // Fishing Operations
  if (
    query.includes('fish') ||
    query.includes('pfz') ||
    query.includes('potential fishing zone') ||
    query.includes('tuna') ||
    query.includes('catch') ||
    query.includes('trawler') ||
    query.includes('fishing operation') ||
    query.includes('fishing trip')
  ) {
    return AIVANA_INTENTS.FISHING
  }

  // Port Movement / Port Conditions
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
    query.includes('plan route')
  ) {
    return AIVANA_INTENTS.TRAVEL
  }

  // Marine Safety / Alerts
  if (
    query.includes('safety') ||
    query.includes('stay safe') ||
    query.includes('safe at sea') ||
    query.includes('marine safety') ||
    query.includes('alert') ||
    query.includes('advisory') ||
    query.includes('hazard') ||
    query.includes('cyclone') ||
    query.includes('warning')
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
 * @returns {object} Structured Aivana task/interpretation result
 */
export function interpretAivanaRequest(query, explicitLocation = null, activeLocation = null) {
  // 1. Validate query
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      intent: AIVANA_INTENTS.OTHER,
      requiresOperatingLocation: false,
      explicitLocation: null,
      resolvedLocation: null,
      status: 'IDLE',
      clarificationQuestion: null,
    }
  }

  const trimmedQuery = query.trim()

  // 2. Classify intent
  const intent = detectAivanaIntent(trimmedQuery)
  const requiresOperatingLocation = requiresOperatingLocationForIntent(intent)

  // Special handling for Destination / Navigation requests:
  // Distinct from ORCA operating locations. Does NOT automatically treat destination as operating location.
  if (intent === AIVANA_INTENTS.DESTINATION_NAVIGATION) {
    const destinationLocation = resolveOperatingLocationFromText(trimmedQuery)
    return {
      intent,
      requiresOperatingLocation: false,
      destination: destinationLocation,
      explicitLocation: null,
      resolvedLocation: activeLocation ? normalizeOperatingLocation(activeLocation) : null,
      status: 'READY',
      clarificationQuestion: null,
    }
  }

  // Special handling for Nearby Ports discovery
  if (intent === AIVANA_INTENTS.NEARBY_PORTS) {
    return {
      intent,
      requiresOperatingLocation: false,
      destination: null,
      explicitLocation: null,
      resolvedLocation: activeLocation ? normalizeOperatingLocation(activeLocation) : null,
      status: 'READY',
      clarificationQuestion: null,
    }
  }

  // 3. Location Resolution Priority
  // Priority 1: Explicit location supplied separately by UI
  let normalizedExplicit = normalizeOperatingLocation(explicitLocation)
  let resolvedLocation = null
  let explicitSource = null

  if (normalizedExplicit) {
    resolvedLocation = normalizedExplicit
    explicitSource = normalizedExplicit
  }

  // Priority 2: Explicit location detected in user query
  if (!resolvedLocation) {
    const detectedInQuery = resolveOperatingLocationFromText(trimmedQuery)
    if (detectedInQuery) {
      resolvedLocation = detectedInQuery
      explicitSource = detectedInQuery
    }
  }

  // Priority 3: Active ScenarioContext location (only if valid canonical location exists)
  if (!resolvedLocation && activeLocation) {
    const normalizedActive = normalizeOperatingLocation(activeLocation)
    if (normalizedActive) {
      resolvedLocation = normalizedActive
    }
  }

  // 4. Determine status and clarification
  if (requiresOperatingLocation && !resolvedLocation) {
    return {
      intent,
      requiresOperatingLocation: true,
      explicitLocation: explicitSource,
      resolvedLocation: null,
      status: 'CLARIFICATION',
      clarificationQuestion: CLARIFICATION_QUESTION,
    }
  }

  return {
    intent,
    requiresOperatingLocation,
    explicitLocation: explicitSource,
    resolvedLocation,
    status: 'READY',
    clarificationQuestion: null,
  }
}
