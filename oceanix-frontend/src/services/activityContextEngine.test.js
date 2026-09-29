import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  interpretAivanaRequest,
  CANONICAL_ACTIVITIES,
  DEFAULT_ACTIVITY_CONTEXT,
  createActivityContext,
  CLARIFICATION_QUESTION,
  DESTINATION_CLARIFICATION_QUESTION,
  extractTravelEndpoints,
} from './aivanaInterpreter.js'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (relativePath) => fs.readFileSync(path.join(here, relativePath), 'utf8')

const JNPA = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-jawaharlal-nehru')
const COCHIN = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-cochin')
const MUMBAI = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-mumbai')
const CHENNAI = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-chennai')
const MORMUGAO = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-mormugao')
const DEENDAYAL = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-deendayal')

// 1. Fishing activity extraction
test('1. Fishing activity extraction', () => {
  // A) "I want to go fishing near JNPA."
  const resultJnpa = interpretAivanaRequest('I want to go fishing near JNPA.')
  assert.equal(resultJnpa.status, 'READY')
  assert.equal(resultJnpa.activityContext.activity, CANONICAL_ACTIVITIES.FISHING)
  assert.equal(resultJnpa.activityContext.objective, 'fishing')
  assert.equal(resultJnpa.activityContext.operatingLocation?.id, JNPA.id)
  assert.equal(resultJnpa.activityContext.origin, null)
  assert.equal(resultJnpa.activityContext.destination, null)

  // B) "Show me fishing conditions." with activeLocation
  const resultConditions = interpretAivanaRequest('Show me fishing conditions.', null, COCHIN)
  assert.equal(resultConditions.status, 'READY')
  assert.equal(resultConditions.activityContext.activity, CANONICAL_ACTIVITIES.FISHING)
  assert.equal(resultConditions.activityContext.operatingLocation?.id, COCHIN.id)

  // C) "I want to fish here." with explicitLocation
  const resultHere = interpretAivanaRequest('I want to fish here.', CHENNAI)
  assert.equal(resultHere.status, 'READY')
  assert.equal(resultHere.activityContext.activity, CANONICAL_ACTIVITIES.FISHING)
  assert.equal(resultHere.activityContext.operatingLocation?.id, CHENNAI.id)
})

// 2. Marine travel extraction
test('2. Marine travel extraction', () => {
  // A) "I want to travel from Mumbai to Goa."
  const result1 = interpretAivanaRequest('I want to travel from Mumbai to Goa.')
  assert.equal(result1.status, 'READY')
  assert.equal(result1.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  assert.equal(result1.activityContext.objective, 'travel')

  // B) "I want to go from Mumbai to Goa by sea."
  const result2 = interpretAivanaRequest('I want to go from Mumbai to Goa by sea.')
  assert.equal(result2.status, 'READY')
  assert.equal(result2.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  assert.equal(result2.activityContext.objective, 'travel')

  // C) "Show me conditions for travelling to Goa."
  const result3 = interpretAivanaRequest('Show me conditions for travelling to Goa.')
  assert.equal(result3.status, 'READY')
  assert.equal(result3.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  assert.equal(result3.activityContext.objective, 'travel')
})

// 3. Port movement extraction
test('3. Port movement extraction', () => {
  // A) "I am entering JNPA."
  const result1 = interpretAivanaRequest('I am entering JNPA.')
  assert.equal(result1.status, 'READY')
  assert.equal(result1.activityContext.activity, CANONICAL_ACTIVITIES.PORT_MOVEMENT)
  assert.equal(result1.activityContext.objective, 'port movement')
  assert.equal(result1.activityContext.operatingLocation?.id, JNPA.id)

  // B) "I want to move my vessel into JNPA."
  const result2 = interpretAivanaRequest("I'm moving my vessel into JNPA.")
  assert.equal(result2.status, 'READY')
  assert.equal(result2.activityContext.activity, CANONICAL_ACTIVITIES.PORT_MOVEMENT)
  assert.equal(result2.activityContext.operatingLocation?.id, JNPA.id)

  // C) "Check conditions for port entry." with activeLocation
  const result3 = interpretAivanaRequest('Check conditions for port entry.', null, COCHIN)
  assert.equal(result3.status, 'READY')
  assert.equal(result3.activityContext.activity, CANONICAL_ACTIVITIES.PORT_MOVEMENT)
  assert.equal(result3.activityContext.operatingLocation?.id, COCHIN.id)
})

// 4. Marine safety extraction
test('4. Marine safety extraction', () => {
  // A) "Is it safe to operate here?" with activeLocation
  const result1 = interpretAivanaRequest('Is it safe to operate here?', null, MUMBAI)
  assert.equal(result1.status, 'READY')
  assert.equal(result1.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_SAFETY)
  assert.equal(result1.activityContext.objective, 'safety assessment')
  assert.equal(result1.activityContext.operatingLocation?.id, MUMBAI.id)

  // B) "Check marine safety near Chennai."
  const result2 = interpretAivanaRequest('Check marine safety near Chennai.')
  assert.equal(result2.status, 'READY')
  assert.equal(result2.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_SAFETY)
  assert.equal(result2.activityContext.operatingLocation?.id, CHENNAI.id)

  // C) "Can I safely operate in this area?" with activeLocation
  const result3 = interpretAivanaRequest('Can I safely operate in this area?', null, DEENDAYAL)
  assert.equal(result3.status, 'READY')
  assert.equal(result3.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_SAFETY)
  assert.equal(result3.activityContext.operatingLocation?.id, DEENDAYAL.id)
})

// 5. Ocean exploration extraction
test('5. Ocean exploration extraction', () => {
  // A) "I want to explore this area."
  const result1 = interpretAivanaRequest('I want to explore this area.')
  assert.equal(result1.status, 'READY')
  assert.equal(result1.activityContext.activity, CANONICAL_ACTIVITIES.OCEAN_EXPLORATION)
  assert.equal(result1.activityContext.objective, 'ocean exploration')

  // B) "Show me ocean conditions here."
  const result2 = interpretAivanaRequest('Show me ocean conditions here.')
  assert.equal(result2.status, 'READY')
  assert.equal(result2.activityContext.activity, CANONICAL_ACTIVITIES.OCEAN_EXPLORATION)
  assert.equal(result2.activityContext.objective, 'ocean exploration')
})

// 6. Origin / destination extraction
test('6. Origin / destination extraction', () => {
  // A) "I want to travel from Mumbai to Goa."
  const result1 = interpretAivanaRequest('I want to travel from Mumbai to Goa.')
  assert.ok(result1.activityContext.origin, 'Origin should be resolved')
  assert.equal(result1.activityContext.origin.id, MUMBAI.id)
  assert.ok(result1.activityContext.destination, 'Destination should be resolved')
  assert.equal(result1.activityContext.destination.id, MORMUGAO.id)
  assert.equal(result1.activityContext.operatingLocation, null)

  // B) "I want to go from Mumbai to Goa by sea."
  const result2 = interpretAivanaRequest('I want to go from Mumbai to Goa by sea.')
  assert.equal(result2.activityContext.origin.id, MUMBAI.id)
  assert.equal(result2.activityContext.destination.id, MORMUGAO.id)

  // C) Direct endpoint helper extraction
  const endpoints = extractTravelEndpoints('Travel from Cochin to Chennai by vessel')
  assert.equal(endpoints.origin?.id, COCHIN.id)
  assert.equal(endpoints.destination?.id, CHENNAI.id)
})

// 7. Operating-location extraction
test('7. Operating-location extraction', () => {
  const result = interpretAivanaRequest('I want to go fishing near JNPA.')
  assert.equal(result.activityContext.operatingLocation?.id, JNPA.id)
  assert.equal(result.activityContext.origin, null)
  assert.equal(result.activityContext.destination, null)

  const resultEntry = interpretAivanaRequest('I am entering JNPA.')
  assert.equal(resultEntry.activityContext.operatingLocation?.id, JNPA.id)
})

// 8. Missing destination clarification
test('8. Missing destination clarification', () => {
  // User says travel from Mumbai without destination
  const result = interpretAivanaRequest('I want to travel from Mumbai')
  assert.equal(result.status, 'CLARIFICATION')
  assert.equal(result.clarificationQuestion, DESTINATION_CLARIFICATION_QUESTION)
  assert.equal(result.activityContext.activity, CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  assert.equal(result.activityContext.origin?.id, MUMBAI.id)
  assert.equal(result.activityContext.destination, null)
  assert.equal(result.activityContext.operatingLocation, null)
  // Ensures system does NOT invent a destination
  assert.equal(result.destination, null)
})

// 9. Missing operating-location clarification where required
test('9. Missing operating-location clarification where required', () => {
  // Fishing without location
  const resultFish = interpretAivanaRequest('I want to go fishing')
  assert.equal(resultFish.status, 'CLARIFICATION')
  assert.equal(resultFish.clarificationQuestion, CLARIFICATION_QUESTION)
  assert.equal(resultFish.activityContext.operatingLocation, null)

  // Port movement without location
  const resultPort = interpretAivanaRequest("I'm moving my vessel into port")
  assert.equal(resultPort.status, 'CLARIFICATION')
  assert.equal(resultPort.clarificationQuestion, CLARIFICATION_QUESTION)
  assert.equal(resultPort.activityContext.operatingLocation, null)

  // Marine safety without location
  const resultSafety = interpretAivanaRequest('Is it safe to operate here?')
  assert.equal(resultSafety.status, 'CLARIFICATION')
  assert.equal(resultSafety.clarificationQuestion, CLARIFICATION_QUESTION)
  assert.equal(resultSafety.activityContext.operatingLocation, null)
})

// 10. GPS denial still allows manual activity/location selection
test('10. GPS denial still allows manual activity/location selection', () => {
  // Manual explicit location selection works independently of GPS
  const manualResult = interpretAivanaRequest('Plan a fishing operation', JNPA)
  assert.equal(manualResult.status, 'READY')
  assert.equal(manualResult.activityContext.activity, CANONICAL_ACTIVITIES.FISHING)
  assert.equal(manualResult.activityContext.operatingLocation.id, JNPA.id)

  // GPS coordinates are never silently used as operating location
  const gpsSimulatedQuery = interpretAivanaRequest('Plan a fishing operation near 18.9°N, 72.8°E')
  assert.equal(gpsSimulatedQuery.status, 'CLARIFICATION')
  assert.equal(gpsSimulatedQuery.activityContext.operatingLocation, null)
})

// 11. Activity context is shared through ScenarioContext
test('11. Activity context is shared through ScenarioContext', () => {
  assert.deepEqual(DEFAULT_ACTIVITY_CONTEXT, {
    activity: null,
    objective: null,
    origin: null,
    destination: null,
    operatingLocation: null,
  })

  const source = read('../context/ScenarioContext.jsx')
  for (const symbol of [
    'activityContext',
    'setActivityContext',
    'updateActivityContext',
    'assistantTask',
    'setAssistantTask',
    'assistantConversation',
    'setAssistantConversation',
    'DEFAULT_ACTIVITY_CONTEXT',
    'CANONICAL_ACTIVITIES',
    'createActivityContext',
  ]) {
    assert.match(source, new RegExp(symbol))
  }

  const created = createActivityContext({
    activity: CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    objective: 'travel',
    origin: MUMBAI,
    destination: MORMUGAO,
    operatingLocation: null,
  })

  assert.equal(created.activity, 'marine_travel')
  assert.equal(created.origin.id, MUMBAI.id)
  assert.equal(created.destination.id, MORMUGAO.id)
  assert.equal(created.operatingLocation, null)
})

// 12. Existing assistantTask behavior remains intact
test('12. Existing assistantTask behavior remains intact', () => {
  const result = interpretAivanaRequest('I want to go fishing near JNPA.')
  const task = {
    query: 'I want to go fishing near JNPA.',
    intent: result.intent,
    activity: result.activityContext.activity,
    objective: result.activityContext.objective,
    origin: result.activityContext.origin,
    destination: result.activityContext.destination,
    operatingLocation: result.resolvedLocation || result.activityContext.operatingLocation,
    status: result.status,
    clarificationQuestion: result.clarificationQuestion,
    timestamp: Date.now(),
  }

  assert.equal(task.intent, 'fishing')
  assert.equal(task.activity, 'fishing')
  assert.equal(task.operatingLocation.id, JNPA.id)
  assert.equal(task.status, 'READY')
  assert.equal(task.clarificationQuestion, null)
})
