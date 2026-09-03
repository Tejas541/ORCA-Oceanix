import { createContext, useContext, useMemo, useState } from 'react'
import {
  getDefaultScenarioId,
  getMarineScenario,
  listMarineScenariosMap,
} from '../services/marineDataService'

const ScenarioContext = createContext(null)

const marineScenarios = listMarineScenariosMap()
const defaultScenarioId = getDefaultScenarioId()

export function ScenarioProvider({ children }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenarioId)
  const selectedScenario = useMemo(
    () => getMarineScenario(selectedScenarioId),
    [selectedScenarioId]
  )

  const value = useMemo(
    () => ({
      selectedScenarioId,
      selectedScenario,
      setSelectedScenarioId,
      scenarios: marineScenarios,
      defaultScenarioId,
    }),
    [selectedScenarioId, selectedScenario]
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
