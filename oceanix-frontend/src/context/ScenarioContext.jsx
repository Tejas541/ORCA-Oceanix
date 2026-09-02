import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_SCENARIO_ID, getScenario } from '../data/mockOcean'

const ScenarioContext = createContext(null)

export function ScenarioProvider({ children }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(DEFAULT_SCENARIO_ID)
  const selectedScenario = useMemo(
    () => getScenario(selectedScenarioId),
    [selectedScenarioId]
  )

  const value = useMemo(
    () => ({ selectedScenarioId, selectedScenario, setSelectedScenarioId }),
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
