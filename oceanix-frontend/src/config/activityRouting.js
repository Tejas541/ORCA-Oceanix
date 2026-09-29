import { CANONICAL_ACTIVITIES } from '../services/aivanaInterpreter.js'

/**
 * Universal Route Evaluation Statuses
 * Follows deterministic, fail-closed principles.
 */
export const ROUTE_STATUS = Object.freeze({
  ROUTE_EVALUATED: 'ROUTE_EVALUATED',
  ROUTE_PARTIALLY_EVALUATED: 'ROUTE_PARTIALLY_EVALUATED',
  ROUTE_DATA_INSUFFICIENT: 'ROUTE_DATA_INSUFFICIENT',
  ROUTE_UNAVAILABLE: 'ROUTE_UNAVAILABLE',
  CLARIFICATION_REQUIRED: 'CLARIFICATION_REQUIRED',
  NO_ROUTING_REQUIRED: 'NO_ROUTING_REQUIRED',
})

/**
 * Transparent Route Recommendation States
 * Never claims 'best route'; based solely on available authoritative evidence.
 */
export const RECOMMENDATION_STATE = Object.freeze({
  RECOMMENDED: 'RECOMMENDED',
  CONDITIONAL: 'CONDITIONAL',
  NOT_RECOMMENDED: 'NOT_RECOMMENDED',
  DATA_INSUFFICIENT: 'DATA_INSUFFICIENT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
})

/**
 * Universal Activity Routing Configuration
 *
 * Defines per-activity routing requirements, supported target types,
 * relevant constraints, relevant environmental evidence, and explicit limitations.
 * Reusable across any marine activity requiring spatial movement or wayfinding.
 */
export const ACTIVITY_ROUTING_CONFIG = Object.freeze({
  [CANONICAL_ACTIVITIES.FISHING]: Object.freeze({
    id: 'fishing',
    label: 'Fishing Route',
    targetType: 'pfz',
    requiresOrigin: true,
    requiresDestinationOrTarget: true,
    routingRequiredWhen: [
      'pfz_transit',
      'fish_at_zone',
      'reach_pfz',
      'navigate_to_pfz',
      'goto_pfz',
    ],
    relevantConstraints: [
      'cyclone_avoidance',
      'high_wind_wave_hazard',
      'restricted_zones',
    ],
    relevantEvidence: ['waveHeight', 'windSpeed', 'visibility', 'cyclone', 'pfz'],
    unsupportedConstraints: [
      'nautical_fairway_waypoints',
      'bathymetric_depth_clearance',
      'vessel_draft_limits',
      'species_catch_probability',
    ],
    guidance:
      'PFZ geometry is supplemental intelligence. Corridors provide direct reference to fishing zones without altering ORCA deterministic safety calculations.',
  }),

  [CANONICAL_ACTIVITIES.MARINE_TRAVEL]: Object.freeze({
    id: 'marine_travel',
    label: 'Marine Travel Voyage',
    targetType: 'destination',
    requiresOrigin: true,
    requiresDestinationOrTarget: true,
    routingRequiredWhen: [
      'passage_planning',
      'travel_between_ports',
      'voyage',
      'destination_transit',
      'sail_to_port',
    ],
    relevantConstraints: [
      'cyclone_avoidance',
      'high_wind_wave_hazard',
      'surface_visibility',
    ],
    relevantEvidence: ['waveHeight', 'windSpeed', 'visibility', 'cyclone'],
    unsupportedConstraints: [
      'nautical_fairway_waypoints',
      'bathymetric_depth_clearance',
      'vessel_draft_limits',
      'tidal_stream_currents',
      'vessel_traffic_separation',
    ],
    guidance:
      'Voyage corridors provide linear spatial reference between ports. Official nautical charts and certified routing systems must be used for certified vessel navigation.',
  }),

  [CANONICAL_ACTIVITIES.PORT_MOVEMENT]: Object.freeze({
    id: 'port_movement',
    label: 'Port Movement Corridor',
    targetType: 'port',
    requiresOrigin: true,
    requiresDestinationOrTarget: true,
    routingRequiredWhen: [
      'port_entry',
      'harbour_transit',
      'berth_approach',
      'enter_port',
    ],
    relevantConstraints: [
      'cyclone_avoidance',
      'high_wind_hazard',
      'harbour_visibility',
    ],
    relevantEvidence: ['waveHeight', 'windSpeed', 'visibility', 'cyclone'],
    unsupportedConstraints: [
      'berth_level_channels',
      'pilotage_guidance',
      'inner_harbour_bathymetry',
      'tug_assistance_channels',
    ],
    guidance:
      'Port approach corridor monitors external harbour approach conditions. Berth-level piloting and vessel traffic management are not supported.',
  }),

  [CANONICAL_ACTIVITIES.MARINE_SAFETY]: Object.freeze({
    id: 'marine_safety',
    label: 'Safety Assessment',
    targetType: 'none',
    requiresOrigin: false,
    requiresDestinationOrTarget: false,
    routingRequiredWhen: [],
    relevantConstraints: ['cyclone_avoidance', 'severe_sea_cap'],
    relevantEvidence: ['waveHeight', 'windSpeed', 'visibility', 'cyclone', 'lightningRiskPercent'],
    unsupportedConstraints: ['vessel_routing'],
    guidance:
      'Marine safety assesses situational and deterministic safety criteria for the operating location. No routing required.',
  }),

  [CANONICAL_ACTIVITIES.OCEAN_EXPLORATION]: Object.freeze({
    id: 'ocean_exploration',
    label: 'Ocean Exploration Corridor',
    targetType: 'exploration_area',
    requiresOrigin: true,
    requiresDestinationOrTarget: true,
    routingRequiredWhen: [
      'exploration_transit',
      'access_ocean_feature',
      'survey_area',
    ],
    relevantConstraints: ['cyclone_avoidance', 'severe_sea_hazard'],
    relevantEvidence: ['sst', 'chlorophyll', 'waveHeight', 'windSpeed', 'visibility', 'cyclone'],
    unsupportedConstraints: [
      'subsurface_bathymetry',
      'ocean_current_drift',
      'research_corridor_authorization',
    ],
    guidance:
      'Exploration corridors guide spatial approach to oceanographic areas of interest. Does not replace research cruise planning or certified pilotage.',
  }),

  [CANONICAL_ACTIVITIES.OTHER]: Object.freeze({
    id: 'other',
    label: 'General Maritime Corridor',
    targetType: 'destination',
    requiresOrigin: true,
    requiresDestinationOrTarget: true,
    routingRequiredWhen: ['general_transit'],
    relevantConstraints: ['cyclone_avoidance', 'severe_sea_hazard'],
    relevantEvidence: ['waveHeight', 'windSpeed', 'visibility', 'cyclone'],
    unsupportedConstraints: ['nautical_fairway_waypoints'],
    guidance:
      'General maritime reference corridor based on available environmental evidence.',
  }),
})

/**
 * Returns activity routing configuration for a given canonical activity.
 *
 * @param {string} activity
 * @returns {object}
 */
export function getActivityRoutingConfig(activity) {
  if (!activity) {
    return ACTIVITY_ROUTING_CONFIG[CANONICAL_ACTIVITIES.OTHER]
  }
  return (
    ACTIVITY_ROUTING_CONFIG[activity] ||
    ACTIVITY_ROUTING_CONFIG[CANONICAL_ACTIVITIES.OTHER]
  )
}
