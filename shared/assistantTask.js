export const ASSISTANT_INTENTS = Object.freeze({
  FISHING: 'fishing',
  TRAVEL: 'travel',
  PORT_MOVEMENT: 'port_movement',
  OTHER: 'other',
})

export const ASSISTANT_STATUSES = Object.freeze({
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
  READY: 'READY',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
})

export const PARSER_METADATA = Object.freeze({
  parser: 'deterministic-assistant-intent-parser',
  version: '1.0.0',
  llm: false,
})

const text = (value) => (typeof value === 'string' ? value.trim() : '')

function placeAfter(value, word) {
  const pattern = word === 'from'
    ? /\bfrom\s+(.+?)(?=\s+to\s+|$)/i
    : /.*\bto\s+(.+?)$/i
  const match = value.match(pattern)
  return match?.[1]?.trim().replace(/[.,!?]+$/, '') || null
}

function inferIntent(value) {
  if (/\b(fish|fishing|fishery|fisheries)\b/i.test(value)) return ASSISTANT_INTENTS.FISHING
  if (/\b(move|transfer|relocate)\b/i.test(value) && /\b(vessel|ship|boat|port)\b/i.test(value)) return ASSISTANT_INTENTS.PORT_MOVEMENT
  if (/\b(travel|journey|go)\b/i.test(value) && /\b(sea|maritime|port|ship|vessel|boat)\b/i.test(value)) return ASSISTANT_INTENTS.TRAVEL
  return ASSISTANT_INTENTS.OTHER
}

function normalizeLocation(context) {
  const location = context?.selectedOperatingLocation
  if (!location || typeof location !== 'object') return null
  const latitude = Number(location.latitude)
  const longitude = Number(location.longitude)
  return {
    id: location.id ?? null,
    name: text(location.name) || null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    type: text(location.type) || null,
  }
}

export function createAssistantTask({ text: input, context = {}, now = new Date().toISOString() } = {}) {
  const originalRequest = text(input)
  const intent = inferIntent(originalRequest)
  const selectedLocation = normalizeLocation(context)
  const explicitOrigin = placeAfter(originalRequest, 'from')
  const destination = placeAfter(originalRequest, 'to')
  const origin = explicitOrigin || selectedLocation?.name || null
  const operatingArea = selectedLocation?.name || (intent === ASSISTANT_INTENTS.FISHING ? explicitOrigin : null)
  const missingFields = []

  if (intent === ASSISTANT_INTENTS.FISHING && !operatingArea) missingFields.push('operatingLocation')
  if ([ASSISTANT_INTENTS.TRAVEL, ASSISTANT_INTENTS.PORT_MOVEMENT].includes(intent)) {
    if (!origin) missingFields.push('origin')
    if (!destination) missingFields.push('destination')
  }

  return {
    intent,
    origin,
    destination,
    operatingArea,
    requestedInformation: [...missingFields],
    originalRequest,
    status: missingFields.length ? ASSISTANT_STATUSES.NEEDS_CLARIFICATION : ASSISTANT_STATUSES.READY,
    missingFields,
    createdAt: now,
    parser: { ...PARSER_METADATA },
    context: {
      selectedOperatingLocation: selectedLocation,
      coordinateRole: text(context?.coordinateRole) || null,
    },
  }
}

export function clarificationForTask(task) {
  const field = task?.missingFields?.[0]
  if (field === 'operatingLocation') return 'Which operating location should I use?'
  if (field === 'origin') return 'What is the origin for this task?'
  if (field === 'destination') return 'What is the destination for this task?'
  return 'I have enough information to continue.'
}

export function getAssistantParserMetadata() {
  return { ...PARSER_METADATA }
}

export function isAssistantTask(value) {
  return Boolean(value && typeof value === 'object' && Object.values(ASSISTANT_INTENTS).includes(value.intent))
}

export default createAssistantTask

export const __testOnly = Object.freeze({ inferIntent, normalizeLocation, placeAfter })

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('assistantTask.js')) {
  console.log(JSON.stringify(createAssistantTask({ text: process.argv.slice(2).join(' ') }), null, 2))
}
