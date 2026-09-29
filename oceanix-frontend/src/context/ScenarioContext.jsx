import { createContext, useContext, useMemo, useState } from 'react'
import {
  getDefaultScenarioId,
  getMarineScenario,
  listMarineScenariosMap,
} from '../services/marineDataService'

const ScenarioContext = createContext(null)
const marineScenarios = listMarineScenariosMap()
const defaultScenarioId = getDefaultScenarioId()

export const CANONICAL_ACTIVITIES = Object.freeze({
  FISHING: 'fishing',
  MARINE_TRAVEL: 'marine_travel',
  PORT_MOVEMENT: 'port_movement',
  MARINE_SAFETY: 'marine_safety',
  OCEAN_EXPLORATION: 'ocean_exploration',
  OTHER: 'other',
})

export const DEFAULT_ACTIVITY_CONTEXT = Object.freeze({
  activity: null,
  objective: null,
  origin: null,
  destination: null,
  operatingLocation: null,
})

export function createActivityContext({
  activity = null,
  objective = null,
  origin = null,
  destination = null,
  operatingLocation = null,
} = {}) {
  return Object.freeze({
    activity,
    objective,
    origin,
    destination,
    operatingLocation,
  })
}

export function ScenarioProvider({ children }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenarioId)
  const [selectedOperatingLocation, setSelectedOperatingLocation] = useState(null)
  const [locationDecision, setLocationDecision] = useState(null)
  const [userCoordinates, setUserCoordinates] = useState(null)
  const [activityContext, setActivityContext] = useState(DEFAULT_ACTIVITY_CONTEXT)
  const [assistantTask, setAssistantTask] = useState(null)
  const [assistantConversation, setAssistantConversation] = useState([])
  const [routeRequest, setRouteRequest] = useState(null)
  const [routePlan, setRoutePlan] = useState(null)
  const [officialPfz, setOfficialPfz] = useState(null)

  const selectedScenario = useMemo(
    () => getMarineScenario(selectedScenarioId),
    [selectedScenarioId]
  )

  const clearRoutePlan = () => {
    setRouteRequest(null)
    setRoutePlan(null)
  }

  const updateActivityContext = (patchOrUpdater) => {
    setActivityContext((prev) => {
      const next = typeof patchOrUpdater === 'function' ? patchOrUpdater(prev) : { ...prev, ...patchOrUpdater }
      const canonical = createActivityContext(next)
      if (canonical.operatingLocation && (!selectedOperatingLocation || selectedOperatingLocation.id !== canonical.operatingLocation.id)) {
        setSelectedOperatingLocation(canonical.operatingLocation)
      }
      return canonical
    })
  }

  const handleSetSelectedOperatingLocation = (loc) => {
    setSelectedOperatingLocation(loc)
    setActivityContext((prev) => ({
      ...prev,
      operatingLocation: loc,
    }))
  }

  const value = useMemo(
    () => ({
      selectedScenarioId,
      selectedScenario,
      selectedDecision: selectedScenario?.decision ?? null,
      setSelectedScenarioId,
      selectedOperatingLocation,
      setSelectedOperatingLocation: handleSetSelectedOperatingLocation,
      locationDecision,
      setLocationDecision,
      userCoordinates,
      setUserCoordinates,
      activityContext,
      setActivityContext,
      updateActivityContext,
      assistantTask,
      setAssistantTask,
      assistantConversation,
      setAssistantConversation,
      routeRequest,
      setRouteRequest,
      routePlan,
      setRoutePlan,
      clearRoutePlan,
      officialPfz,
      setOfficialPfz,
      scenarios: marineScenarios,
      defaultScenarioId,
    }),
    [
      selectedScenarioId,
      selectedScenario,
      selectedOperatingLocation,
      locationDecision,
      userCoordinates,
      activityContext,
      assistantTask,
      assistantConversation,
      routeRequest,
      routePlan,
      officialPfz,
    ]
  )

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}

// A hook is intentionally co-located with its provider to keep the shared-state API cohesive.
// eslint-disable-next-line react-refresh/only-export-components
export function useScenario() {
  const context = useContext(ScenarioContext)
  if (!context) {
    throw new Error('useScenario must be used within a ScenarioProvider')
  }
  return context
}
