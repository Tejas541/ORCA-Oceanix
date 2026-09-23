import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretAssistantRequest } from './assistantIntentService.js'

const selected = { id: 'jnpa', name: 'JNPA', latitude: 18.95, longitude: 72.95, type: 'port' }

test('parses fishing intent and asks for location when none is selected', () => {
  const task = interpretAssistantRequest({ text: 'I want to plan a fishing operation.' })
  assert.equal(task.intent, 'fishing')
  assert.equal(task.status, 'NEEDS_CLARIFICATION')
  assert.deepEqual(task.missingFields, ['operatingLocation'])
  assert.equal(task.operatingArea, null)
})

test('propagates selected operating location without inventing one', () => {
  const task = interpretAssistantRequest({ text: 'I want to plan a fishing operation.', context: { selectedOperatingLocation: selected } })
  assert.equal(task.intent, 'fishing')
  assert.equal(task.status, 'READY')
  assert.equal(task.operatingArea, 'JNPA')
  assert.equal(task.context.selectedOperatingLocation.name, 'JNPA')
})

test('parses travel origin and destination', () => {
  const task = interpretAssistantRequest({ text: 'I need to travel by sea from Mumbai to Kochi' })
  assert.equal(task.intent, 'travel')
  assert.equal(task.status, 'READY')
  assert.equal(task.origin, 'Mumbai')
  assert.equal(task.destination, 'Kochi')
})

test('parses port movement origin and destination', () => {
  const task = interpretAssistantRequest({ text: 'I want to move a vessel from JNPA to Kochi' })
  assert.equal(task.intent, 'port_movement')
  assert.equal(task.status, 'READY')
  assert.equal(task.origin, 'JNPA')
  assert.equal(task.destination, 'Kochi')
})

test('classifies general capability questions as other', () => {
  const task = interpretAssistantRequest({ text: 'What can ORCA do?' })
  assert.equal(task.intent, 'other')
  assert.equal(task.status, 'READY')
})

test('does not claim LLM reasoning or confidence', () => {
  const task = interpretAssistantRequest({ text: 'I want to go fishing' })
  assert.equal(task.parser.llm, false)
  assert.equal(task.execution, 'deferred')
  assert.equal('confidence' in task, false)
})
