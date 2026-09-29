import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVITY_INTELLIGENCE_CONFIG,
  getActivityIntelligence,
  isDataRelevant,
  isLayerRelevant,
  isSectionRelevant,
} from './activityIntelligence.js'
import { CANONICAL_ACTIVITIES } from '../services/aivanaInterpreter.js'

test('1. Activity Intelligence Configuration exposes all canonical activities', () => {
  for (const activity of [
    CANONICAL_ACTIVITIES.FISHING,
    CANONICAL_ACTIVITIES.MARINE_TRAVEL,
    CANONICAL_ACTIVITIES.PORT_MOVEMENT,
    CANONICAL_ACTIVITIES.MARINE_SAFETY,
    CANONICAL_ACTIVITIES.OCEAN_EXPLORATION,
    CANONICAL_ACTIVITIES.OTHER,
  ]) {
    const config = ACTIVITY_INTELLIGENCE_CONFIG[activity]
    assert.ok(config, `Config should exist for ${activity}`)
    assert.ok(Array.isArray(config.relevantData), `${activity} relevantData should be an array`)
    assert.ok(Array.isArray(config.relevantLayers), `${activity} relevantLayers should be an array`)
    assert.ok(Array.isArray(config.relevantSections), `${activity} relevantSections should be an array`)
    assert.ok(Array.isArray(config.priorities), `${activity} priorities should be an array`)
  }
})

test('2. Fishing activity prioritizes PFZ and marks showPfz true', () => {
  const config = getActivityIntelligence(CANONICAL_ACTIVITIES.FISHING)
  assert.equal(config.showPfz, true)
  assert.equal(isLayerRelevant(CANONICAL_ACTIVITIES.FISHING, 'OFFICIAL_PFZ'), true)
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.FISHING, 'pfzIntelligence'), true)
  assert.equal(config.priorities[0], 'pfzIntelligence')
})

test('3. Ocean Exploration suppresses PFZ and prioritizes oceanographic context', () => {
  const config = getActivityIntelligence(CANONICAL_ACTIVITIES.OCEAN_EXPLORATION)
  assert.equal(config.showPfz, false, 'Ocean Exploration must suppress PFZ')
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.OCEAN_EXPLORATION, 'pfzIntelligence'), false)
  assert.equal(isLayerRelevant(CANONICAL_ACTIVITIES.OCEAN_EXPLORATION, 'INCOIS_SST'), true)
  assert.equal(isLayerRelevant(CANONICAL_ACTIVITIES.OCEAN_EXPLORATION, 'INCOIS_CHL'), true)
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.OCEAN_EXPLORATION, 'oceanographicContext'), true)
  assert.equal(config.priorities[0], 'oceanographicContext')
})

test('4. Marine Travel prioritizes voyage context and suppresses fake routes', () => {
  const config = getActivityIntelligence(CANONICAL_ACTIVITIES.MARINE_TRAVEL)
  assert.equal(config.showPfz, false)
  assert.equal(config.showVoyageEndpoints, true)
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.MARINE_TRAVEL, 'voyageContext'), true)
  assert.equal(config.priorities[0], 'voyageContext')
})

test('5. Port Movement prioritizes port and harbour context', () => {
  const config = getActivityIntelligence(CANONICAL_ACTIVITIES.PORT_MOVEMENT)
  assert.equal(config.showPfz, false)
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.PORT_MOVEMENT, 'portContext'), true)
  assert.equal(config.priorities[0], 'portContext')
})

test('6. Marine Safety prioritizes deterministic safety score and evidence completeness', () => {
  const config = getActivityIntelligence(CANONICAL_ACTIVITIES.MARINE_SAFETY)
  assert.equal(config.showPfz, false)
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.MARINE_SAFETY, 'safetyAssessment'), true)
  assert.equal(isSectionRelevant(CANONICAL_ACTIVITIES.MARINE_SAFETY, 'evidenceCompleteness'), true)
  assert.equal(config.priorities[0], 'safetyAssessment')
})

test('7. Fallback to other/general operations on unknown or null activity', () => {
  const nullConfig = getActivityIntelligence(null)
  assert.equal(nullConfig.id, 'other')
  const unknownConfig = getActivityIntelligence('space_travel')
  assert.equal(unknownConfig.id, 'other')
  assert.equal(isDataRelevant('space_travel', 'waveHeight'), true)
})
