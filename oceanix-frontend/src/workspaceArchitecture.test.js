import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (relativePath) => fs.readFileSync(path.join(here, relativePath), 'utf8')

test('ScenarioContext exposes shared operating location and canonical decision state', () => {
  const source = read('./context/ScenarioContext.jsx')
  for (const symbol of [
    'selectedOperatingLocation',
    'setSelectedOperatingLocation',
    'locationDecision',
    'setLocationDecision',
  ]) {
    assert.match(source, new RegExp(symbol))
  }
})

test('GIS publishes selection and location decision through ScenarioContext', () => {
  const source = read('./pages/GISMap.jsx')
  assert.match(source, /setSelectedOperatingLocation/)
  assert.match(source, /setLocationDecision/)
  assert.doesNotMatch(source, /const \[selectedOperatingLocation, setSelectedOperatingLocation\]/)
  assert.doesNotMatch(source, /const \[locationDecision, setLocationDecision\]/)
})

test('canonical decision consumers use shared location state and fail closed', () => {
  for (const page of ['./pages/SafetyBarometer.jsx', './pages/AgenticChat.jsx', './pages/AdvisoryBulletin.jsx']) {
    const source = read(page)
    assert.match(source, /selectedOperatingLocation/)
    assert.match(source, /locationDecision\?\.decision/)
    assert.match(source, /DATA_INSUFFICIENT/)
    assert.match(source, /safetyScore == null/)
  }
})

test('AI scenario controls cannot override a GIS-selected operating location', () => {
  const source = read('./pages/AgenticChat.jsx')
  assert.match(source, /if \(selectedOperatingLocation\) return/)
  assert.match(source, /Current operating location:/)
})

test('navigation labels and pathname-based active state are defined', () => {
  const source = read('./App.jsx')
  for (const label of ['HOME', 'AI ASSISTANT', 'COMMAND MAP', 'AGENT WORKFLOW', 'SAFETY STATUS', 'ADVISORY BULLETIN']) {
    assert.match(source, new RegExp(label))
  }
  assert.match(source, /useLocation/)
  assert.match(source, /pathname === to/)
})
