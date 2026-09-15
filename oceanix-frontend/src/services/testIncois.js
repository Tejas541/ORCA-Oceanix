import { getMarineScenarioWithIncois } from './marineDataService.js'

const result = await getMarineScenarioWithIncois('kochi')

console.log('========== ORCA INCOIS SERVICE TEST ==========')
console.log('Scenario:', result.name)
console.log('Wind speed:', result.oceanConditions.windSpeed, 'knots')
console.log('INCOIS data:', result.externalData?.incois)
console.log('===============================================')