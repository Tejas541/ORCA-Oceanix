import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSISTANT_STATUSES, createAssistantTask, clarificationForTask } from '../../shared/assistantTask.js'

test('shared task requires an operating location for fishing when none is selected', () => {
  const task = createAssistantTask({ text: 'I want to plan a fishing operation' })
  assert.equal(task.status, ASSISTANT_STATUSES.NEEDS_CLARIFICATION)
  assert.deepEqual(task.missingFields, ['operatingLocation'])
  assert.equal(task.operatingArea, null)
  assert.equal(clarificationForTask(task), 'Which operating location should I use?')
})

test('shared task carries the actually selected operating location', () => {
  const task = createAssistantTask({
    text: 'I want to plan a fishing operation',
    context: { selectedOperatingLocation: { id: 'jnpa', name: 'JNPA', latitude: 18.95, longitude: 72.95 } },
  })
  assert.equal(task.status, ASSISTANT_STATUSES.READY)
  assert.equal(task.operatingArea, 'JNPA')
  assert.equal(task.context.selectedOperatingLocation.name, 'JNPA')
})

test('shared parser supports travel and port movement', () => {
  assert.equal(createAssistantTask({ text: 'travel by sea from Mumbai to Kochi' }).intent, 'travel')
  assert.equal(createAssistantTask({ text: 'move a vessel from JNPA to Kochi' }).intent, 'port_movement')
  assert.equal(createAssistantTask({ text: 'What can ORCA do?' }).intent, 'other')
})
