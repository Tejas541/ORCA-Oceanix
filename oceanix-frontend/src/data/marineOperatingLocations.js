import {
  createMarineOperatingLocation,
  dmsToDecimalDegrees,
} from '../../../shared/marineOperatingLocation.js'

export const OFFICIAL_MARINE_LOCATION_SOURCES = Object.freeze([
  {
    id: 'mopsw-port-statistics',
    name: 'Ministry of Ports, Shipping and Waterways — port information and Basic Port Statistics',
    sourceVersion: 'Basic Port Statistics of India 2024-25',
    sourceUrl: 'https://shipmin.gov.in/en/publication/annual-reports-ports',
    supportedTypes: ['major_port', 'non_major_port'],
    coordinateStatus: 'verified for major-port records in Table 1.3, p. 45',
    notes: 'The imported MVP records use only explicit latitude/longitude entries from the publication.',
  },
  {
    id: 'department-of-fisheries-pmmsy',
    name: 'Department of Fisheries — PMMSY harbour and fish-landing information',
    sourceUrl: 'https://pmmsy.dof.gov.in/',
    supportedTypes: ['fishing_harbour', 'fish_landing_centre'],
    coordinateStatus: 'not confirmed in repository',
    notes: 'Provides fisheries infrastructure identity material; coordinate coverage must be verified per record before import.',
  },
])

const SOURCE = 'Ministry of Ports, Shipping and Waterways'
const SOURCE_VERSION = 'Basic Port Statistics of India 2024-25'
const SOURCE_URL = 'https://shipmin.gov.in/en/content/basic-port-statistics-india-2024-25'

function majorPort({ id, name, state, district, latitude, longitude }) {
  return createMarineOperatingLocation({
    id,
    name,
    type: 'major_port',
    latitude,
    longitude,
    state,
    district,
    source: SOURCE,
    sourceVersion: SOURCE_VERSION,
    sourceUrl: SOURCE_URL,
    status: 'operational',
  })
}

export const MARINE_OPERATING_LOCATIONS = Object.freeze([
  // Table 1.3, p. 45: 23°01'N, 70°13'E.
  majorPort({
    id: 'major-port-deendayal',
    name: 'Deendayal Port Authority',
    state: 'Gujarat',
    district: 'Kachchh',
    latitude: dmsToDecimalDegrees({ degrees: 23, minutes: 1, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 70, minutes: 13, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: first listed Mumbai Port Authority location,
  // 18°55'05"N, 72°51'57"E.
  majorPort({
    id: 'major-port-mumbai',
    name: 'Mumbai Port Authority',
    state: 'Maharashtra',
    district: 'Mumbai City',
    latitude: dmsToDecimalDegrees({ degrees: 18, minutes: 55, seconds: 5, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 72, minutes: 51, seconds: 57, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 18°56'43"N, 72°56'24"E.
  majorPort({
    id: 'major-port-jawaharlal-nehru',
    name: 'Jawaharlal Nehru Port Authority',
    state: 'Maharashtra',
    district: 'Raigad',
    latitude: dmsToDecimalDegrees({ degrees: 18, minutes: 56, seconds: 43, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 72, minutes: 56, seconds: 24, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 15°25'46"N, 73°47'11"E.
  majorPort({
    id: 'major-port-mormugao',
    name: 'Mormugao Port Authority',
    state: 'Goa',
    district: 'South Goa',
    latitude: dmsToDecimalDegrees({ degrees: 15, minutes: 25, seconds: 46, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 73, minutes: 47, seconds: 11, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 12°56'N, 74°49'E.
  majorPort({
    id: 'major-port-new-mangalore',
    name: 'New Mangalore Port Authority',
    state: 'Karnataka',
    district: 'Dakshina Kannada',
    latitude: dmsToDecimalDegrees({ degrees: 12, minutes: 56, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 74, minutes: 49, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 9°58.2'N, 76°15.5'E.
  majorPort({
    id: 'major-port-cochin',
    name: 'Cochin Port Authority',
    state: 'Kerala',
    district: 'Ernakulam',
    latitude: dmsToDecimalDegrees({ degrees: 9, minutes: 58.2, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 76, minutes: 15.5, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 8°45'N, 78°13'E.
  majorPort({
    id: 'major-port-voc',
    name: 'V.O. Chidambaranar Port Authority',
    state: 'Tamil Nadu',
    district: 'Thoothukudi',
    latitude: dmsToDecimalDegrees({ degrees: 8, minutes: 45, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 78, minutes: 13, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 13°06'N, 80°18'E.
  majorPort({
    id: 'major-port-chennai',
    name: 'Chennai Port Authority',
    state: 'Tamil Nadu',
    district: 'Chennai',
    latitude: dmsToDecimalDegrees({ degrees: 13, minutes: 6, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 80, minutes: 18, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 13°15'5.9"N, 80°19'36.59"E.
  majorPort({
    id: 'major-port-kamarajar',
    name: 'Kamarajar Port Limited',
    state: 'Tamil Nadu',
    district: 'Tiruvallur',
    latitude: dmsToDecimalDegrees({ degrees: 13, minutes: 15, seconds: 5.9, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 80, minutes: 19, seconds: 36.59, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: Visakhapatnam entrance location 17°41'N, 83°17'E.
  majorPort({
    id: 'major-port-visakhapatnam',
    name: 'Visakhapatnam Port Authority',
    state: 'Andhra Pradesh',
    district: 'Visakhapatnam',
    latitude: dmsToDecimalDegrees({ degrees: 17, minutes: 41, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 83, minutes: 17, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: 20°15'58.63"N, 86°40'27.34"E.
  majorPort({
    id: 'major-port-paradip',
    name: 'Paradip Port Authority',
    state: 'Odisha',
    district: 'Jagatsinghpur',
    latitude: dmsToDecimalDegrees({ degrees: 20, minutes: 15, seconds: 58.63, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 86, minutes: 40, seconds: 27.34, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: Kolkata Dock System 22°33'N, 88°18'E.
  majorPort({
    id: 'major-port-kolkata',
    name: 'SMPA Kolkata Dock System',
    state: 'West Bengal',
    district: 'Kolkata',
    latitude: dmsToDecimalDegrees({ degrees: 22, minutes: 33, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 88, minutes: 18, hemisphere: 'E' }),
  }),
  // Table 1.3, p. 45: Haldia Dock Complex 22°02'N, 88°06'E.
  majorPort({
    id: 'major-port-haldia',
    name: 'SMPA Haldia Dock Complex',
    state: 'West Bengal',
    district: 'Purba Medinipur',
    latitude: dmsToDecimalDegrees({ degrees: 22, minutes: 2, hemisphere: 'N' }),
    longitude: dmsToDecimalDegrees({ degrees: 88, minutes: 6, hemisphere: 'E' }),
  }),
])

export function addVerifiedMarineOperatingLocation(record) {
  return createMarineOperatingLocation(record)
}
