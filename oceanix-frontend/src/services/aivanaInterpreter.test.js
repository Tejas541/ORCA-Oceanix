import test from 'node:test'
import assert from 'node:assert/strict'
import {
  interpretAivanaRequest,
  AIVANA_INTENTS,
  CLARIFICATION_QUESTION,
  resolveOperatingLocationFromText,
} from './aivanaInterpreter.js'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'

const JNPA = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-jawaharlal-nehru')
const COCHIN = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-cochin')
const MUMBAI = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-mumbai')
const CHENNAI = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-chennai')

test('1. Fishing request without location → CLARIFICATION', () => {
  const result = interpretAivanaRequest('I want to plan a fishing operation')
  assert.equal(result.intent, AIVANA_INTENTS.FISHING)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.explicitLocation, null)
  assert.equal(result.resolvedLocation, null)
  assert.equal(result.status, 'CLARIFICATION')
  assert.equal(result.clarificationQuestion, CLARIFICATION_QUESTION)
})

test('2. Fishing request with JNPA → READY + JNPA', () => {
  const result = interpretAivanaRequest('Plan a fishing trip from JNPA')
  assert.equal(result.intent, AIVANA_INTENTS.FISHING)
  assert.equal(result.requiresOperatingLocation, true)
  assert.ok(result.resolvedLocation)
  assert.equal(result.resolvedLocation.id, JNPA.id)
  assert.equal(result.resolvedLocation.name, JNPA.name)
  assert.equal(result.status, 'READY')
  assert.equal(result.clarificationQuestion, null)
})

test('3. Kochi/Cochin alias resolution', () => {
  const resultKochi = interpretAivanaRequest('Plan a fishing operation from Kochi')
  assert.equal(resultKochi.intent, AIVANA_INTENTS.FISHING)
  assert.equal(resultKochi.status, 'READY')
  assert.equal(resultKochi.resolvedLocation.id, COCHIN.id)

  const resultCochin = interpretAivanaRequest('Check port conditions at Cochin')
  assert.equal(resultCochin.intent, AIVANA_INTENTS.PORT_MOVEMENT)
  assert.equal(resultCochin.status, 'READY')
  assert.equal(resultCochin.resolvedLocation.id, COCHIN.id)
})

test('4. Port movement with explicit location', () => {
  const result = interpretAivanaRequest('Check conditions at Kochi port')
  assert.equal(result.intent, AIVANA_INTENTS.PORT_MOVEMENT)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.status, 'READY')
  assert.equal(result.resolvedLocation.id, COCHIN.id)
  assert.equal(result.clarificationQuestion, null)
})

test('5. Travel without location → CLARIFICATION', () => {
  const result = interpretAivanaRequest('Is it safe to travel by sea?')
  assert.equal(result.intent, AIVANA_INTENTS.TRAVEL)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.resolvedLocation, null)
  assert.equal(result.status, 'CLARIFICATION')
  assert.equal(result.clarificationQuestion, CLARIFICATION_QUESTION)
})

test('6. Marine safety with explicit location', () => {
  const result = interpretAivanaRequest('Stay safe at sea near Mumbai')
  assert.equal(result.intent, AIVANA_INTENTS.MARINE_SAFETY)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.status, 'READY')
  assert.equal(result.resolvedLocation.id, MUMBAI.id)
  assert.equal(result.clarificationQuestion, null)
})

test('7. "What can ORCA do?" → no location required', () => {
  const result = interpretAivanaRequest('What can ORCA do?')
  assert.equal(result.intent, AIVANA_INTENTS.ORCA_CAPABILITIES)
  assert.equal(result.requiresOperatingLocation, false)
  assert.equal(result.resolvedLocation, null)
  assert.equal(result.status, 'READY')
  assert.equal(result.clarificationQuestion, null)
})

test('8. Ocean exploration → no location required', () => {
  const result = interpretAivanaRequest('Tell me about the Indian Ocean')
  assert.equal(result.intent, AIVANA_INTENTS.OCEAN_EXPLORATION)
  assert.equal(result.requiresOperatingLocation, false)
  assert.equal(result.resolvedLocation, null)
  assert.equal(result.status, 'READY')
  assert.equal(result.clarificationQuestion, null)
})

test('9. Explicit UI location takes priority', () => {
  // Query mentions Mumbai, but UI explicitly passed Chennai
  const result = interpretAivanaRequest('Plan a fishing trip near Mumbai', CHENNAI)
  assert.equal(result.intent, AIVANA_INTENTS.FISHING)
  assert.equal(result.status, 'READY')
  assert.equal(result.resolvedLocation.id, CHENNAI.id)
})

test('10. Active Context location is used only when no explicit location exists', () => {
  // Query does NOT mention any location, but active context has Cochin
  const resultWithActive = interpretAivanaRequest(
    'I want to plan a fishing operation',
    null,
    COCHIN
  )
  assert.equal(resultWithActive.intent, AIVANA_INTENTS.FISHING)
  assert.equal(resultWithActive.status, 'READY')
  assert.equal(resultWithActive.resolvedLocation.id, COCHIN.id)

  // When query has explicit location (Mumbai), active context (Cochin) is overridden
  const resultOverridden = interpretAivanaRequest(
    'Plan a fishing operation from Mumbai',
    null,
    COCHIN
  )
  assert.equal(resultOverridden.status, 'READY')
  assert.equal(resultOverridden.resolvedLocation.id, MUMBAI.id)
})

test('11. No GPS fallback', () => {
  // Simulated GPS or coordinate query without official operating location
  const result = interpretAivanaRequest('Plan a fishing operation at 18.9°N, 72.8°E')
  assert.equal(result.intent, AIVANA_INTENTS.FISHING)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.resolvedLocation, null)
  assert.equal(result.status, 'CLARIFICATION')
  assert.equal(result.clarificationQuestion, CLARIFICATION_QUESTION)
})

test('12. No nearest-port fallback', () => {
  // An unanchored operational request must NEVER default to any port
  const result = interpretAivanaRequest('Assess sea travel conditions for my vessel')
  assert.equal(result.intent, AIVANA_INTENTS.TRAVEL)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.resolvedLocation, null)
  assert.notEqual(result.status, 'READY')
  assert.equal(result.status, 'CLARIFICATION')
})

test('13. Unknown location does not silently resolve', () => {
  const result = interpretAivanaRequest('Plan a fishing operation near Atlantis Fantasia')
  assert.equal(result.intent, AIVANA_INTENTS.FISHING)
  assert.equal(result.requiresOperatingLocation, true)
  assert.equal(result.resolvedLocation, null)
  assert.equal(result.status, 'CLARIFICATION')
  assert.equal(result.clarificationQuestion, CLARIFICATION_QUESTION)
})

test('14. Empty/invalid query handled safely', () => {
  const emptyResult = interpretAivanaRequest('')
  assert.equal(emptyResult.status, 'IDLE')
  assert.equal(emptyResult.requiresOperatingLocation, false)
  assert.equal(emptyResult.resolvedLocation, null)

  const whitespaceResult = interpretAivanaRequest('   ')
  assert.equal(whitespaceResult.status, 'IDLE')

  const nullResult = interpretAivanaRequest(null)
  assert.equal(nullResult.status, 'IDLE')

  const undefinedResult = interpretAivanaRequest(undefined)
  assert.equal(undefinedResult.status, 'IDLE')

  const numericResult = interpretAivanaRequest(12345)
  assert.equal(numericResult.status, 'IDLE')
})
