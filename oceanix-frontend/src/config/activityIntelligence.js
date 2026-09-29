import { CANONICAL_ACTIVITIES } from '../services/aivanaInterpreter.js'

/**
 * Centralized Activity Intelligence Configuration for ORCA
 *
 * Defines which marine intelligence parameters, GIS layers, and UI sections
 * are relevant and prioritized for each canonical marine activity.
 *
 * IMPORTANT: ORCA decision formulas, evidence weights, and deterministic
 * safety calculations are protected and MUST NOT be modified here.
 */
export const ACTIVITY_INTELLIGENCE_CONFIG = Object.freeze({
  [CANONICAL_ACTIVITIES.FISHING]: Object.freeze({
    id: 'fishing',
    label: 'Fishing Operation',
    tagline: 'Prioritizing PFZ intelligence, ocean conditions, and fishing safety',
    relevantData: ['waveHeight', 'windSpeed', 'visibility', 'cyclone', 'pfz', 'sst', 'chlorophyll'],
    relevantLayers: ['OFFICIAL_PFZ', 'PFZ', 'CYCLONE', 'IMBL', 'MPA'],
    relevantSections: ['safetyAssessment', 'pfzIntelligence', 'weatherHazards', 'geofenceAlerts'],
    priorities: ['pfzIntelligence', 'safetyAssessment', 'weatherHazards', 'geofenceAlerts'],
    showPfz: true,
    showVoyageEndpoints: false,
    guidance: 'PFZ geometry is supplemental intelligence and does not alter ORCA deterministic safety calculations.',
  }),

  [CANONICAL_ACTIVITIES.MARINE_TRAVEL]: Object.freeze({
    id: 'marine_travel',
    label: 'Marine Travel',
    tagline: 'Prioritizing origin/destination endpoints, route weather, and navigational hazards',
    relevantData: ['waveHeight', 'windSpeed', 'visibility', 'cyclone', 'lightningRiskPercent'],
    relevantLayers: ['CYCLONE', 'IMBL', 'MPA'],
    relevantSections: ['voyageContext', 'safetyAssessment', 'weatherHazards', 'geofenceAlerts'],
    priorities: ['voyageContext', 'safetyAssessment', 'weatherHazards', 'geofenceAlerts'],
    showPfz: false,
    showVoyageEndpoints: true,
    guidance: 'Voyage endpoints established. Automated waypoint route generation is deferred to nautical routing engines.',
  }),

  [CANONICAL_ACTIVITIES.PORT_MOVEMENT]: Object.freeze({
    id: 'port_movement',
    label: 'Port Movement',
    tagline: 'Prioritizing harbour approach, local weather, visibility, and vessel maneuvering',
    relevantData: ['waveHeight', 'windSpeed', 'visibility', 'cyclone'],
    relevantLayers: ['CYCLONE', 'MPA'],
    relevantSections: ['portContext', 'safetyAssessment', 'weatherHazards'],
    priorities: ['portContext', 'safetyAssessment', 'weatherHazards'],
    showPfz: false,
    showVoyageEndpoints: false,
    guidance: 'Monitoring harbour entrance conditions, wind vectors, and local wave state for safe movement.',
  }),

  [CANONICAL_ACTIVITIES.MARINE_SAFETY]: Object.freeze({
    id: 'marine_safety',
    label: 'Marine Safety Assessment',
    tagline: 'Prioritizing deterministic safety score, evidence completeness, and hazard caps',
    relevantData: ['waveHeight', 'windSpeed', 'visibility', 'lightningRiskPercent', 'cyclone'],
    relevantLayers: ['CYCLONE', 'IMBL', 'MPA'],
    relevantSections: ['safetyAssessment', 'weatherHazards', 'evidenceCompleteness', 'geofenceAlerts'],
    priorities: ['safetyAssessment', 'evidenceCompleteness', 'weatherHazards', 'geofenceAlerts'],
    showPfz: false,
    showVoyageEndpoints: false,
    guidance: 'Evaluating canonical evidence completeness and fail-closed deterministic decision criteria.',
  }),

  [CANONICAL_ACTIVITIES.OCEAN_EXPLORATION]: Object.freeze({
    id: 'ocean_exploration',
    label: 'Ocean Exploration',
    tagline: 'Prioritizing regional ocean observations (SST, Chlorophyll), environmental layers, and conditions',
    relevantData: ['sst', 'chlorophyll', 'waveHeight', 'windSpeed', 'visibility', 'cyclone'],
    relevantLayers: ['INCOIS_SST', 'INCOIS_CHL', 'CYCLONE', 'MPA'],
    relevantSections: ['oceanographicContext', 'weatherHazards', 'safetyAssessment'],
    priorities: ['oceanographicContext', 'weatherHazards', 'safetyAssessment'],
    showPfz: false,
    showVoyageEndpoints: false,
    guidance: 'Surfacing official INCOIS satellite-derived SST and chlorophyll layers alongside ocean physical state.',
  }),

  [CANONICAL_ACTIVITIES.OTHER]: Object.freeze({
    id: 'other',
    label: 'General Marine Operations',
    tagline: 'Standard marine intelligence and deterministic safety assessment',
    relevantData: ['waveHeight', 'windSpeed', 'visibility', 'cyclone', 'lightningRiskPercent'],
    relevantLayers: ['CYCLONE', 'IMBL', 'MPA'],
    relevantSections: ['safetyAssessment', 'weatherHazards'],
    priorities: ['safetyAssessment', 'weatherHazards'],
    showPfz: false,
    showVoyageEndpoints: false,
    guidance: 'Observing canonical marine parameters and regional weather guidance.',
  }),
})

export function getActivityIntelligence(activity) {
  if (!activity) {
    return ACTIVITY_INTELLIGENCE_CONFIG[CANONICAL_ACTIVITIES.OTHER]
  }
  return (
    ACTIVITY_INTELLIGENCE_CONFIG[activity] ||
    ACTIVITY_INTELLIGENCE_CONFIG[CANONICAL_ACTIVITIES.OTHER]
  )
}

export function isDataRelevant(activity, parameter) {
  const config = getActivityIntelligence(activity)
  return config.relevantData.includes(parameter)
}

export function isLayerRelevant(activity, layerId) {
  const config = getActivityIntelligence(activity)
  return config.relevantLayers.includes(layerId)
}

export function isSectionRelevant(activity, sectionId) {
  const config = getActivityIntelligence(activity)
  return config.relevantSections.includes(sectionId)
}
