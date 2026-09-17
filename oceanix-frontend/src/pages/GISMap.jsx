import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, WMSTileLayer, Circle, CircleMarker, Polyline, Polygon, Popup, Marker, useMap, useMapEvents } from 'react-leaflet'
import { Layers, Play, Pause, RotateCcw, MessageSquare, Target, ShieldAlert, Anchor, Send, MapPin, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'
import { useScenario } from '../context/ScenarioContext'
import {
  createForecastRequestContext,
  fetchIncoisPfz,
  fetchIncoisWave,
  fetchIncoisWind,
  fetchIncoisOrcaDecision,
} from '../services/incoisService'
import { getBrowserLocationErrorMessage, requestBrowserLocation } from '../utils/browserGeolocation'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations'
import {
  formatMarineOperatingLocationDistance,
  getOperatingLocationConnection,
  getNearbyMarineOperatingLocations,
} from '../utils/marineOperatingLocationUi'

const trawlerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2942/2942940.png',
  iconSize: [32, 32],
})

const pinIcon = new L.DivIcon({
  className: 'custom-inspection-pin',
  html: `<div style="background-color:#2563eb;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(37,99,235,0.9);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const EARTH_RADIUS_NM = 3440.065
const NM_TO_METERS = 1852
const STEP_MS = 800
const INCOIS_PFZ_WMS_URL = 'https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms'
const INCOIS_PFZ_WMS_CAPABILITIES_URL =
  `${INCOIS_PFZ_WMS_URL}?SERVICE=WMS&VERSION=1.1.0&REQUEST=GetCapabilities`

function geoJsonLinePositions(feature) {
  const geometry = feature?.geometry
  if (geometry?.type === 'LineString') {
    return [geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude])]
  }
  if (geometry?.type === 'MultiLineString') {
    return geometry.coordinates.map((line) =>
      line.map(([longitude, latitude]) => [latitude, longitude])
    )
  }
  return []
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function toDeg(rad) {
  return (rad * 180) / Math.PI
}

function haversineNm(a, b) {
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function destinationPoint(lat, lng, bearingDeg, distNm) {
  const brng = toRad(bearingDeg)
  const lat1 = toRad(lat)
  const lon1 = toRad(lng)
  const ang = distNm / EARTH_RADIUS_NM
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brng)
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2)
    )
  return [toDeg(lat2), toDeg(lon2)]
}

function initialBearing(a, b) {
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const dLon = toRad(b[1] - a[1])
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function pointToSegmentNm(p, a, b) {
  const dx = b[1] - a[1]
  const dy = b[0] - a[0]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return haversineNm(p, a)
  let t = ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const proj = [a[0] + t * dy, a[1] + t * dx]
  return haversineNm(p, proj)
}

function distanceToPolylineNm(point, line) {
  if (!line || line.length === 0) return Infinity
  if (line.length === 1) return haversineNm(point, line[0])
  let min = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    min = Math.min(min, pointToSegmentNm(point, line[i], line[i + 1]))
  }
  return min
}

function imblBufferPolygon(line, bufferNm) {
  if (!line || line.length < 2) return []
  const left = []
  const right = []
  for (let i = 0; i < line.length - 1; i++) {
    const brng = initialBearing(line[i], line[i + 1])
    left.push(destinationPoint(line[i][0], line[i][1], brng - 90, bufferNm))
    right.push(destinationPoint(line[i][0], line[i][1], brng + 90, bufferNm))
  }
  const last = line[line.length - 1]
  const brng = initialBearing(line[line.length - 2], last)
  left.push(destinationPoint(last[0], last[1], brng - 90, bufferNm))
  right.push(destinationPoint(last[0], last[1], brng + 90, bufferNm))
  return [...left, ...right.reverse()]
}

function MapRecenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 })
  }, [center, zoom, map])
  return null
}

function MapOperatingLocationView({ userCoordinates, selectedOperatingLocation }) {
  const map = useMap()

  useEffect(() => {
    if (!userCoordinates) return

    if (!selectedOperatingLocation) {
      map.flyTo([userCoordinates.latitude, userCoordinates.longitude], 11, {
        duration: 0.8,
      })
      return
    }

    const connection = getOperatingLocationConnection(
      userCoordinates,
      selectedOperatingLocation
    )
    map.fitBounds(connection, {
      padding: [80, 120],
      maxZoom: 11,
      animate: true,
      duration: 0.8,
    })
  }, [map, userCoordinates, selectedOperatingLocation])

  return null
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function GISMap() {
  const { selectedScenario: scenario } = useScenario()

  const route = scenario.trawlerRoute.coordinates
  const imblLine = scenario.imbl.coordinates
  const bufferNm = scenario.imbl.bufferNm
  const bufferRing = imblBufferPolygon(imblLine, bufferNm)

  const [activeLayers, setActiveLayers] = useState([
    'PFZ',
    'INCOIS_SST',
    'INCOIS_CHL',
    'IMBL',
    'MPA',
    'CYCLONE',
  ])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [boatPosition, setBoatPosition] = useState(route[0])
  const [routeIndex, setRouteIndex] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [officialPfz, setOfficialPfz] = useState(null)
  const [officialWave, setOfficialWave] = useState(null)
  const [officialWind, setOfficialWind] = useState(null)
  const [locationStatus, setLocationStatus] = useState('loading')
  const [locationError, setLocationError] = useState('')
  const [userCoordinates, setUserCoordinates] = useState(null)
  const [selectedOperatingLocation, setSelectedOperatingLocation] = useState(null)
  const [isOperatingLocationOpen, setIsOperatingLocationOpen] = useState(false)
  const [locationDecision, setLocationDecision] = useState(null)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [isLayersOpen, setIsLayersOpen] = useState(true)
  const [clickedLocation, setClickedLocation] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: scenario.advisory.summaryEn,
      time: 'Just now',
    },
  ])

  const requestLocation = useCallback(async () => {
    setLocationStatus('loading')
    setLocationError('')
    setUserCoordinates(null)
    setSelectedOperatingLocation(null)
    setIsOperatingLocationOpen(false)
    setLocationDecision(null)

    try {
      const coordinates = await requestBrowserLocation()
      setUserCoordinates(coordinates)
      setLocationStatus('available')
    } catch (error) {
      setLocationStatus('error')
      setLocationError(getBrowserLocationErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  const mapCenter = userCoordinates
    ? [userCoordinates.latitude, userCoordinates.longitude]
    : null
  const nearbyOperatingLocations = useMemo(
    () => getNearbyMarineOperatingLocations(userCoordinates, MARINE_OPERATING_LOCATIONS),
    [userCoordinates]
  )
  const selectedOperatingLocationDistance = selectedOperatingLocation
    ? nearbyOperatingLocations.find(
      ({ location }) => location.id === selectedOperatingLocation.id
    )?.distanceKm
    : null
  const operatingLocationConnection = getOperatingLocationConnection(
    userCoordinates,
    selectedOperatingLocation
  )
  const forecastRequestContext = useMemo(
    () => createForecastRequestContext({ userCoordinates, selectedOperatingLocation }),
    [userCoordinates, selectedOperatingLocation]
  )

  useEffect(() => {
    let active = true
    fetchIncoisPfz()
      .then((result) => {
        if (active) setOfficialPfz(result)
      })
      .catch(() => {
        if (active) {
          setOfficialPfz({
            status: 'unavailable',
            isLive: false,
            source: { provider: 'INCOIS' },
            provenance: { provider: 'INCOIS' },
            reason: 'source_unavailable',
            data: null,
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!userCoordinates) return undefined
    const requestContext = forecastRequestContext
    setOfficialWave(null)
    fetchIncoisWave({ requestContext })
      .then((result) => {
        if (active) setOfficialWave(result)
      })
      .catch(() => {
        if (active) {
          setOfficialWave({
            status: 'unavailable',
            source: { provider: 'INCOIS' },
            provenance: { sourceDataStatus: 'unavailable' },
            data: null,
            reason: 'source_unavailable',
          })
        }
      })

    return () => {
      active = false
    }
  }, [userCoordinates, forecastRequestContext])

  useEffect(() => {
    let active = true
    if (!userCoordinates) return undefined
    const requestContext = forecastRequestContext
    setOfficialWind(null)
    fetchIncoisWind({ requestContext })
      .then((result) => {
        if (active) setOfficialWind(result)
      })
      .catch(() => {
        if (active) {
          setOfficialWind({
            status: 'unavailable',
            isLive: false,
            source: { provider: 'INCOIS' },
            provenance: { sourceDataStatus: 'unavailable' },
            data: null,
            reason: 'source_unavailable',
          })
        }
      })

    return () => {
      active = false
    }
  }, [userCoordinates, forecastRequestContext])

  useEffect(() => {
    let active = true
    if (!userCoordinates) return undefined

    const requestContext = forecastRequestContext
    fetchIncoisOrcaDecision({ requestContext })
      .then((result) => {
        if (active) setLocationDecision(result)
      })
      .catch(() => {
        if (active) setLocationDecision(null)
      })

    return () => {
      active = false
    }
  }, [userCoordinates, forecastRequestContext])

  const officialPfzLines = useMemo(() => {
    if (officialPfz?.status !== 'available') return []
    return officialPfz.data.features.flatMap((feature) =>
      geoJsonLinePositions(feature)
    )
  }, [officialPfz])

  const chatEndRef = useRef(null)
  const chatScrollRef = useRef(null)
  const timerRef = useRef(null)

  // Reset simulation state when the legacy simulated scenario changes.
  useEffect(() => {
    clearTimer()
    setIsSimulating(false)
    setIsAnimating(false)
    setBoatPosition(scenario.trawlerRoute.coordinates[0])
    setRouteIndex(0)
    setNotifications([])
    setClickedLocation(null)
    setChatMessages([
      {
        id: Date.now(),
        sender: 'assistant',
        text: scenario.advisory.summaryEn,
        time: 'Just now',
      },
    ])
  }, [scenario])

  useEffect(() => {
    const chatScrollContainer = chatScrollRef.current
    if (chatScrollContainer) {
      chatScrollContainer.scrollTo({
        top: chatScrollContainer.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [chatMessages])

  const liveImblNm = isSimulating
    ? distanceToPolylineNm(boatPosition, imblLine)
    : scenario.imbl.distanceFromHarbourNm

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const triggerGeofence = () => {
    clearTimer()
    setIsAnimating(false)
    setNotifications([
      {
        id: Date.now(),
        type: 'IMBL',
        message: scenario.imbl.alertMessage,
      },
    ])
  }

  const triggerSimulation = () => {
    clearTimer()
    setNotifications([])
    setBoatPosition(route[0])
    setRouteIndex(0)
    setIsSimulating(true)
    setIsAnimating(true)
  }

  const pauseSimulation = () => {
    clearTimer()
    setIsAnimating(false)
  }

  const resetSimulation = () => {
    clearTimer()
    setIsSimulating(false)
    setIsAnimating(false)
    setBoatPosition(route[0])
    setRouteIndex(0)
    setNotifications([])
  }

  useEffect(() => {
    if (!isAnimating || !isSimulating) return undefined

    const distNm = distanceToPolylineNm(boatPosition, imblLine)
    if (distNm <= bufferNm) {
      triggerGeofence()
      return undefined
    }

    if (routeIndex >= route.length - 1) {
      setIsAnimating(false)
      return undefined
    }

    timerRef.current = setTimeout(() => {
      const nextIndex = routeIndex + 1
      setRouteIndex(nextIndex)
      setBoatPosition(route[nextIndex])
    }, STEP_MS)

    return () => clearTimer()
  }, [isAnimating, isSimulating, routeIndex, boatPosition, imblLine, bufferNm, route])

  useEffect(() => () => clearTimer(), [])

  // Helper for generating dynamic AI chat responses grounded in active scenario
  const handleUserQuery = useCallback((queryText) => {
    if (!queryText.trim()) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    let responseText = ''
    const q = queryText.toLowerCase()

    if (q.includes('condition') || q.includes('sea') || q.includes('wave') || q.includes('wind')) {
      responseText = `At ${scenario.harbour.name}, sea state is ${scenario.oceanConditions.seaState} with wave height of ${scenario.oceanConditions.waveHeight}m and wind speed of ${scenario.oceanConditions.windSpeed} kts (${scenario.oceanConditions.windDirection}). Visibility: ${scenario.oceanConditions.visibility} NM. Lightning risk: ${scenario.oceanConditions.lightningRiskPercent}%.`
    } else if (q.includes('pfz') || q.includes('fish') || q.includes('sardine') || q.includes('tuna') || q.includes('zone')) {
      responseText = `Primary PFZ: ${scenario.pfz.name} targeting ${scenario.pfz.targetSpecies} at coordinates [${scenario.pfz.coordinates.join(', ')}] (${scenario.pfz.distanceFromHarbourKm} km from harbour). Confidence: ${scenario.pfz.confidence}%. ${scenario.pfz.reason}`
    } else if (q.includes('imbl') || q.includes('border') || q.includes('geofence') || q.includes('buffer')) {
      responseText = `Demo IMBL boundary is ${scenario.imbl.distanceFromHarbourNm} NM from harbour. Active vessel distance: ${liveImblNm.toFixed(1)} NM. Status: ${liveImblNm <= scenario.imbl.bufferNm ? '⚠️ INSIDE BUFFER ZONE' : '✅ SAFE COMPLIANCE'}.`
    } else if (q.includes('safety') || q.includes('score') || q.includes('venture') || q.includes('risk')) {
      responseText = locationDecision?.decision
        ? `Location-specific Safety Index: ${locationDecision.decision.safetyScore}/100 (${locationDecision.decision.riskLevel}). Status: ${locationDecision.decision.ventureStatusLabel}. Directive: ${locationDecision.decision.officialDirective}`
        : 'Location-specific safety decision is unavailable until usable marine evidence is available.'
    } else {
      responseText = `[${scenario.region}] ${scenario.advisory.summaryEn}`
    }

    const aiMsg = {
      id: Date.now() + 1,
      sender: 'assistant',
      text: responseText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setChatMessages(prev => [...prev, userMsg, aiMsg])
    setChatInput('')
  }, [scenario, liveImblNm, locationDecision])

  // Handle map click inspection
  const handleMapClick = useCallback((coords) => {
    if (!userCoordinates) return
    setClickedLocation(coords)
    const distUser = haversineNm(coords, [userCoordinates.latitude, userCoordinates.longitude])
    const distImbl = distanceToPolylineNm(coords, imblLine)

    const locMsgText = `Inspecting Location [${coords[0].toFixed(4)}°N, ${coords[1].toFixed(4)}°E]: ${distUser.toFixed(1)} NM from Your Location, ${distImbl.toFixed(1)} NM from demo IMBL.`

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: `📍 Clicked Map: [${coords[0].toFixed(4)}°N, ${coords[1].toFixed(4)}°E]`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const aiMsg = {
      id: Date.now() + 1,
      sender: 'assistant',
      text: locMsgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setChatMessages(prev => [...prev, userMsg, aiMsg])
  }, [userCoordinates, imblLine])

  return (
    <div className="h-screen w-full relative bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. Left Sidebar: Map Layers & Controls */}
      <div className={`absolute top-20 bottom-24 left-6 z-[1000] glass-panel rounded-3xl shadow-2xl border border-white/50 flex flex-col min-h-0 transition-all duration-200 ${
        isLayersOpen ? 'w-72 p-5' : 'w-12 p-2'
      }`}>
        <div className="flex items-center justify-between mb-4">
          {isLayersOpen && (
            <>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers size={14} /> Map Layers
              </h3>
              <span className="text-[9px] font-mono text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded">DEMO L3</span>
            </>
          )}
          <button
            onClick={() => setIsLayersOpen((open) => !open)}
            className="ml-auto p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label={isLayersOpen ? 'Collapse map layers' : 'Expand map layers'}
            title={isLayersOpen ? 'Collapse map layers' : 'Expand map layers'}
          >
            {isLayersOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>

        {isLayersOpen ? <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="mb-4 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg text-center">
            DEMO LAYERS ARE SIMULATED
          </div>

          <div className="mb-4 text-[9px] leading-relaxed text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-2 rounded-lg">
            <div className="font-black uppercase tracking-widest">Official INCOIS WMS</div>
            <div className="mt-1">Raster context only: SST and chlorophyll layers. It does not provide point SST, wave, or current values.</div>
            <a
                href={INCOIS_PFZ_WMS_CAPABILITIES_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block font-bold underline"
            >
                View GetCapabilities provenance
            </a>
          </div>

          <div className="mb-4 text-[9px] leading-relaxed text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-2 rounded-lg">
            <div className="font-black uppercase tracking-widest">Official INCOIS PFZ</div>
            <div className="mt-1">
                {officialPfz?.status === 'available'
                  ? `Advisory geometry available${officialPfz.advisoryDate ? ` for ${officialPfz.advisoryDate}` : ''}.`
                  : 'PFZ advisory unavailable; no demo fallback is used.'}
            </div>
          </div>

          <div className="mb-4 text-[9px] leading-relaxed text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-2 rounded-lg">
            <div className="font-black uppercase tracking-widest">
                Official INCOIS Significant Wave Height
            </div>
            <div className="mt-1">
                {officialWave?.status === 'available' && officialWave.data
                  ? `${officialWave.data.waveHeight} ${officialWave.data.unit} forecast for ${officialWave.data.forecastTime}.`
                  : 'Wave forecast unavailable; no demo fallback is used.'}
            </div>
            <div className="mt-1 text-violet-600">
                Forecast source data is separate from simulated demo layers.
            </div>
          </div>

          <div className="mb-4 text-[9px] leading-relaxed text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-2 rounded-lg">
            <div className="font-black uppercase tracking-widest">
                Official INCOIS Wind Forecast
            </div>
            <div className="mt-1">
                {officialWind?.status === 'available' && officialWind.data
                  ? `${officialWind.data.windSpeed} ${officialWind.data.unit} forecast for ${officialWind.data.forecastTime}.`
                  : 'Wind forecast unavailable; no demo fallback is used.'}
            </div>
            <div className="mt-1 text-indigo-600">
                Forecast • not live observation
            </div>
          </div>

          <div className="space-y-2">
            {[
                { id: 'PFZ', label: 'Simulated PFZ Fishing Zones', color: 'bg-emerald-500', icon: <Target size={14}/> },
                { id: 'OFFICIAL_PFZ', label: 'Official INCOIS PFZ Geometry', color: 'bg-violet-500', icon: <Target size={14}/> },
                { id: 'INCOIS_SST', label: 'Official INCOIS WMS — SST', color: 'bg-cyan-500', icon: <Layers size={14}/> },
                { id: 'INCOIS_CHL', label: 'Official INCOIS WMS — Chlorophyll', color: 'bg-sky-500', icon: <Layers size={14}/> },
                { id: 'IMBL', label: 'IMBL Border Buffer', color: 'bg-rose-500', icon: <ShieldAlert size={14}/> },
                { id: 'MPA', label: 'MPA Eco Reserves', color: 'bg-orange-400', icon: <Anchor size={14}/> },
                { id: 'CYCLONE', label: 'Cyclone Track', color: 'bg-blue-600', icon: <Layers size={14}/> }
            ].map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayers(prev => prev.includes(layer.id) ? prev.filter(i => i !== layer.id) : [...prev, layer.id])}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all border ${activeLayers.includes(layer.id) ? 'bg-white border-slate-200 shadow-sm' : 'bg-transparent border-transparent opacity-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${layer.color}`} />
                    <span className="text-xs font-bold text-slate-700">{layer.label}</span>
                  </div>
                  <div className="text-slate-400">{layer.icon}</div>
                </button>
            ))}
          </div>

          {/* Simulation Control Section */}
          <div className="mt-6 pt-4 border-t border-slate-200/60">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Trawler Simulation</span>
                <span className="text-slate-500 font-mono">{scenario.trawlerRoute.vesselId}</span>
            </div>

            {!isSimulating ? (
                <button
                  onClick={triggerSimulation}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-md active:scale-98"
                >
                  <Play size={13} fill="white" /> Start Trawler Route
                </button>
            ) : (
                <div className="flex gap-2">
                  {isAnimating ? (
                    <button
                      onClick={pauseSimulation}
                      className="flex-1 bg-amber-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all"
                    >
                      <Pause size={13} /> Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsAnimating(true)}
                      className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-all"
                    >
                      <Play size={13} fill="white" /> Resume
                    </button>
                  )}
                  <button
                    onClick={resetSimulation}
                    className="bg-slate-200 text-slate-700 p-2 rounded-xl hover:bg-slate-300 transition-all"
                    title="Reset Route"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
            )}
          </div>
        </div> : null}
      </div>

      {/* 2. Floating AI Assistant */}
      {isAssistantOpen ? (
        <div className="absolute z-[1100] right-4 bottom-24 w-[min(24rem,calc(100vw-2rem))] h-[min(70vh,38rem)] max-h-[calc(100vh-6rem)] glass-panel rounded-[2rem] shadow-2xl border border-white/50 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/70 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="font-bold text-sm text-slate-800 tracking-tight flex items-center gap-1.5">
                  Blue Orbit Assistant <Sparkles size={14} className="text-blue-500" />
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold bg-slate-900 text-white px-2 py-1 rounded-md">SIMULATED ASSISTANT</span>
                <button
                  onClick={() => setIsAssistantOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close AI assistant"
                >
                  <X size={15} />
                </button>
            </div>
          </div>

          {/* Chat History Area */}
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs font-medium">
            {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[85%] p-3.5 rounded-2xl shadow-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-br-none'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Query Hints Chips */}
          <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-1.5 shrink-0">
            {scenario.advisory.queryHints.map((hint, idx) => (
                <button
                  key={idx}
                  onClick={() => handleUserQuery(hint)}
                  className="text-[9px] font-bold bg-white text-blue-600 border border-blue-100 hover:bg-blue-50 px-2.5 py-1 rounded-full transition-all text-left"
                >
                  {hint}
                </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white/90 border-t border-slate-100 shrink-0">
            <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleUserQuery(chatInput)
                }}
                className="relative"
            >
                <input
                  className="w-full bg-slate-100 border-none rounded-2xl pl-4 pr-11 py-3 text-xs outline-none focus:ring-2 ring-blue-500/20 text-slate-800 placeholder-slate-400"
                  placeholder="Ask AI about PFZ, wave risk, IMBL..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-900 rounded-xl flex items-center justify-center text-white hover:bg-black transition-all"
                >
                  <Send size={12} />
                </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="absolute right-4 bottom-6 z-[1100] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/40 flex items-center gap-2 hover:bg-black transition-all"
          aria-label="Open AI assistant"
        >
          <MessageSquare size={16} />
          <span className="text-xs font-black">AI Assistant</span>
        </button>
      )}

      {/* 3. Bottom Stats Bar */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-6 py-3 rounded-2xl flex gap-6 items-center border border-white/50 shadow-xl max-w-2xl overflow-x-auto">
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Wave Height</span>
          <span className="text-xs font-black text-slate-800">
            {officialWave?.status === 'available' && officialWave.data
              ? `${officialWave.data.waveHeight}${officialWave.data.unit}`
              : 'Unavailable'}
          </span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Wind</span>
          <span className="text-xs font-black text-slate-800">
            {officialWind?.status === 'available' && officialWind.data
              ? `${officialWind.data.windSpeed}${officialWind.data.unit}`
              : 'Unavailable'}
          </span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Safety Index</span>
          <span className="text-xs font-black text-slate-800">
            {locationDecision?.decision?.safetyScore != null
              ? `${locationDecision.decision.safetyScore}/100`
              : 'Data insufficient'}
          </span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">SST</span>
          <span className="text-xs font-black text-slate-800">Unavailable</span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Chlorophyll</span>
          <span className="text-xs font-black text-slate-800">Unavailable</span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">IMBL Dist</span>
          <span className="text-xs font-black text-slate-800">{liveImblNm.toFixed(1)} NM</span>
        </div>
      </div>

      {/* 4. The Leaflet Map */}
      {mapCenter ? <MapContainer
        center={mapCenter}
        zoom={11}
        keyboard={false}
        className="absolute top-16 bottom-0 left-0 right-0 z-0"
        zoomControl={false}
      >
        <MapRecenter center={mapCenter} zoom={11} />
        <MapOperatingLocationView
          userCoordinates={userCoordinates}
          selectedOperatingLocation={selectedOperatingLocation}
        />
        <MapClickHandler onMapClick={handleMapClick} />

        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {activeLayers.includes('INCOIS_SST') && (
          <WMSTileLayer
            url={INCOIS_PFZ_WMS_URL}
            layers="sst"
            format="image/png"
            transparent
            version="1.1.0"
            opacity={0.45}
            attribution="INCOIS PFZ-TUNA-SST-CHL WMS — sst"
          />
        )}

        {activeLayers.includes('INCOIS_CHL') && (
          <WMSTileLayer
            url={INCOIS_PFZ_WMS_URL}
            layers="chl"
            format="image/png"
            transparent
            version="1.1.0"
            opacity={0.45}
            attribution="INCOIS PFZ-TUNA-SST-CHL WMS — chl"
          />
        )}

        {/* Browser Geolocation Marker */}
        <Marker position={mapCenter}>
          <Popup>
            <div className="p-1 space-y-1">
              <strong className="text-sm font-bold text-slate-900">Your Location</strong>
              <div className="text-xs text-slate-600">
                {userCoordinates.latitude.toFixed(5)}°N, {userCoordinates.longitude.toFixed(5)}°E
              </div>
              <div className="text-[10px] text-blue-600 font-bold">Browser Geolocation</div>
            </div>
          </Popup>
        </Marker>

        {selectedOperatingLocation && (
          <CircleMarker
            center={[
              selectedOperatingLocation.latitude,
              selectedOperatingLocation.longitude,
            ]}
            radius={10}
            pathOptions={{
              color: '#7c3aed',
              fillColor: '#8b5cf6',
              fillOpacity: 0.95,
              weight: 3,
            }}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <strong className="text-sm font-bold text-slate-900">
                  Operating Location
                </strong>
                <div className="text-xs font-semibold text-violet-700">
                  {selectedOperatingLocation.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {selectedOperatingLocation.type.replaceAll('_', ' ')}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {operatingLocationConnection && selectedOperatingLocationDistance != null && (
          <Polyline
            positions={operatingLocationConnection}
            pathOptions={{
              color: '#7c3aed',
              weight: 3,
              opacity: 0.8,
              dashArray: '8, 8',
            }}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <strong className="text-sm font-bold text-violet-700">
                  Route to operating location
                </strong>
                <div className="text-xs text-slate-600">
                  {formatMarineOperatingLocationDistance(selectedOperatingLocationDistance)} from your current location
                </div>
              </div>
            </Popup>
          </Polyline>
        )}

        {/* Inspection Click Pin */}
        {clickedLocation && (
          <Marker position={clickedLocation} icon={pinIcon}>
            <Popup>
              <div className="p-1 space-y-1">
                <div className="font-bold text-xs text-blue-600 uppercase flex items-center gap-1">
                  <MapPin size={12} /> Clicked Inspection Point
                </div>
                <div className="text-xs font-mono">
                  {clickedLocation[0].toFixed(4)}°N, {clickedLocation[1].toFixed(4)}°E
                </div>
                <div className="text-[10px] text-slate-500">
                  {haversineNm(clickedLocation, mapCenter).toFixed(1)} NM from Your Location
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* PFZ Fishing Zones */}
        {activeLayers.includes('PFZ') && (
          <>
            {/* Primary PFZ Zone */}
            <Circle
              center={scenario.pfz.coordinates}
              radius={scenario.pfz.radius}
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2, weight: 2 }}
            >
              <Popup>
                <div className="p-1 space-y-1">
                  <div className="font-bold text-emerald-600 text-xs uppercase">Simulated Primary PFZ Zone</div>
                  <strong className="text-sm">{scenario.pfz.name}</strong>
                  <div className="text-xs text-slate-600">Target Species: <span className="font-semibold">{scenario.pfz.targetSpecies}</span></div>
                  <div className="text-xs text-slate-600">Depth: {scenario.pfz.depthMeters} m | Confidence: <span className="font-bold text-emerald-600">{scenario.pfz.confidence}%</span></div>
                  <div className="text-[10px] text-amber-600 font-bold">Source: simulated mockOcean data</div>
                  <div className="text-[10px] text-slate-500 italic mt-1">{scenario.pfz.reason}</div>
                </div>
              </Popup>
            </Circle>

            {/* Additional PFZ Zones */}
            {scenario.pfz.additionalZones && scenario.pfz.additionalZones.map((zone, idx) => (
              <Circle
                key={`add-pfz-${idx}`}
                center={zone.coordinates}
                radius={zone.radius}
                pathOptions={{ color: '#059669', fillColor: '#34d399', fillOpacity: 0.25, weight: 2, dashArray: '4, 4' }}
              >
                <Popup>
                  <div className="p-1 space-y-1">
                    <div className="font-bold text-teal-600 text-xs uppercase">Simulated Secondary PFZ Zone</div>
                    <strong className="text-sm">{zone.name}</strong>
                    <div className="text-xs text-slate-600">Target Species: <span className="font-semibold">{zone.targetSpecies}</span></div>
                    <div className="text-xs text-slate-600">Depth: {zone.depthMeters} m | Confidence: <span className="font-bold text-teal-600">{zone.confidence}%</span></div>
                    <div className="text-[10px] text-slate-500 italic mt-1">{zone.reason}</div>
                  </div>
                </Popup>
              </Circle>
            ))}
          </>
        )}

        {activeLayers.includes('OFFICIAL_PFZ') && officialPfzLines.map((line, index) => (
          <Polyline
            key={`official-pfz-${index}`}
            positions={line}
            pathOptions={{ color: '#7c3aed', weight: 2.5, opacity: 0.85 }}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <div className="font-bold text-violet-600 text-xs uppercase">Official INCOIS PFZ Geometry</div>
                <div className="text-xs text-slate-600">
                  Advisory date: {officialPfz.advisoryDate ?? 'not provided'}
                </div>
                <div className="text-[10px] text-slate-500">
                  Source: {officialPfz.source.name} (WFS)
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* IMBL Border & Buffer */}
        {activeLayers.includes('IMBL') && (
          <>
            {bufferRing.length > 0 && (
              <Polygon
                positions={bufferRing}
                pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.1, weight: 1 }}
              />
            )}
            <Polyline
              positions={imblLine}
              pathOptions={{ color: '#e11d48', weight: 4 }}
            >
              <Popup>
                <div className="p-1 space-y-1">
                  <div className="font-bold text-rose-600 text-xs uppercase">Demo IMBL Boundary</div>
                  <strong className="text-sm">{scenario.imbl.name}</strong>
                  <div className="text-xs text-slate-600">Buffer Zone: {bufferNm} NM (Simulated Geofence)</div>
                  <div className="text-[10px] text-slate-500 italic">Not an official maritime boundary.</div>
                </div>
              </Popup>
            </Polyline>
            {imblLine.map((pt, i) => (
              <Circle
                key={`imbl-cap-${i}`}
                center={pt}
                radius={bufferNm * NM_TO_METERS}
                pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.04, weight: 0 }}
              />
            ))}
          </>
        )}

        {/* Marine Protected Areas */}
        {activeLayers.includes('MPA') && (
          <Polygon
            positions={scenario.mpa.coordinates}
            pathOptions={{ color: '#fb923c', fillColor: '#fb923c', fillOpacity: 0.25, weight: 2 }}
          >
            <Popup>
              <div className="p-1 space-y-1">
                <div className="font-bold text-orange-600 text-xs uppercase">Marine Protected Area</div>
                <strong className="text-sm">{scenario.mpa.name}</strong>
                <div className="text-xs text-slate-600">{scenario.mpa.description}</div>
              </div>
            </Popup>
          </Polygon>
        )}

        {/* Cyclone Track */}
        {activeLayers.includes('CYCLONE') && scenario.cyclone.track.length > 0 && (
          <>
            <Polyline
              positions={scenario.cyclone.track}
              pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6, 8' }}
            >
              <Popup>
                <div className="p-1 space-y-1">
                  <strong className="text-sm font-bold text-blue-700">{scenario.cyclone.name}</strong>
                  <div className="text-xs text-slate-600">Category: {scenario.cyclone.category}</div>
                  <div className="text-xs text-slate-600">Status: {scenario.cyclone.status}</div>
                </div>
              </Popup>
            </Polyline>
            <CircleMarker
              center={scenario.cyclone.track[scenario.cyclone.track.length - 1]}
              radius={9}
              pathOptions={{ color: '#1d4ed8', fillColor: '#2563eb', fillOpacity: 0.9 }}
            >
              <Popup>
                <div className="p-1 space-y-1">
                  <strong className="text-sm font-bold text-blue-700">{scenario.cyclone.name}</strong>
                  <div className="text-xs text-slate-600">Category: {scenario.cyclone.category}</div>
                  <div className="text-xs text-slate-600">Status: {scenario.cyclone.status}</div>
                  <div className="text-[10px] text-slate-500 italic">{scenario.cyclone.note}</div>
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Trawler Active Simulation Route */}
        {isSimulating && (
          <Polyline
            positions={route}
            pathOptions={{ color: '#2563eb', weight: 4, dashArray: '10, 10' }}
          />
        )}

        {/* Animated Trawler Marker */}
        {isSimulating && (
          <Marker position={boatPosition} icon={trawlerIcon}>
            <Popup>
              <div className="p-1 space-y-1">
                <div className="font-bold text-xs text-blue-600 uppercase">Simulated Trawler</div>
                <strong className="text-sm">{scenario.trawlerRoute.vesselId}</strong>
                <div className="text-xs text-slate-600">Status: {isAnimating ? scenario.trawlerRoute.status : 'Paused'}</div>
                <div className="text-xs text-slate-600">IMBL Distance: <span className="font-bold text-slate-900">{liveImblNm.toFixed(1)} NM</span></div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer> : (
        <div className="absolute top-16 bottom-0 left-0 right-0 z-0 bg-slate-100 flex items-center justify-center p-6">
          <div className="glass-panel max-w-md rounded-3xl px-6 py-8 text-center shadow-xl border border-white/60">
            <MapPin className="mx-auto mb-3 text-blue-600" size={30} />
            <h2 className="text-sm font-black text-slate-800">
              {locationStatus === 'loading' ? 'Getting your location…' : 'Location unavailable'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {locationStatus === 'loading'
                ? 'Allow browser location access to load location-specific marine intelligence.'
                : locationError}
            </p>
            {locationStatus === 'error' && (
              <button
                type="button"
                onClick={requestLocation}
                className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black"
              >
                Retry Location Access
            </button>
          )}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute top-20 left-1/2 z-[3000] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center">
          <div className="glass-panel flex max-w-full items-center gap-2 rounded-2xl border border-white/60 px-3 py-2 text-left shadow-xl">
            <MapPin className="shrink-0 text-blue-600" size={17} />
            <button
              type="button"
              onClick={() => setIsOperatingLocationOpen((open) => !open)}
              className="min-w-0 text-left"
              aria-expanded={isOperatingLocationOpen}
              aria-controls="nearby-marine-operating-locations"
            >
              {selectedOperatingLocation ? (
                <>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Operating from
                  </span>
                  <span className="block max-w-[16rem] truncate text-xs font-bold text-slate-900">
                    {selectedOperatingLocation.name}
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {locationStatus === 'loading' ? 'Getting your location…' : 'Your Location'}
                  </span>
                  <span className="block text-xs font-bold text-slate-900">
                    {locationStatus === 'error'
                      ? 'Location unavailable'
                      : 'Nearby operating locations'}
                  </span>
                </>
              )}
            </button>
            {selectedOperatingLocation && (
              <>
                <button
                  type="button"
                  onClick={() => setIsOperatingLocationOpen(true)}
                  className="shrink-0 rounded-lg px-1.5 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-50"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOperatingLocation(null)
                    setIsOperatingLocationOpen(false)
                  }}
                  className="shrink-0 rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear operating location"
                >
                  Clear
                </button>
              </>
            )}
            <span className="shrink-0 text-[10px] font-black text-slate-400">
              {isOperatingLocationOpen ? '×' : '⌄'}
            </span>
          </div>

          {mapCenter && selectedOperatingLocation && !isOperatingLocationOpen && selectedOperatingLocationDistance != null && (
            <div className="mt-1 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold capitalize tracking-wide text-white shadow-md">
              {selectedOperatingLocation.type.replaceAll('_', ' ')} ·{' '}
              {formatMarineOperatingLocationDistance(selectedOperatingLocationDistance)}{' '}
              from your current location
            </div>
          )}

          {mapCenter && isOperatingLocationOpen && (
            <div
              id="nearby-marine-operating-locations"
              className="mt-2 w-[min(23rem,calc(100vw-2rem))] rounded-3xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-md"
            >
              <div className="mb-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Nearby Marine Operating Locations
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Based on your current location · Available supported locations
                </div>
              </div>

              {nearbyOperatingLocations.length > 0 ? (
                <div className="max-h-[min(22rem,55vh)] space-y-2 overflow-y-auto">
                  {nearbyOperatingLocations.map(({ location, distanceKm }) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => {
                        setSelectedOperatingLocation(location)
                        setIsOperatingLocationOpen(false)
                      }}
                      className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <span className="mt-0.5 text-base" aria-hidden="true">⚓</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-slate-800">
                          {location.name}
                        </span>
                        <span className="mt-0.5 block text-[10px] capitalize text-slate-500">
                          {location.type.replaceAll('_', ' ')}
                          {location.state ? ` · ${location.state}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-violet-700">
                        {formatMarineOperatingLocationDistance(distanceKm)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center">
                  <div className="text-xs font-black text-slate-700">
                    No nearby marine operating locations found
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                    Your current location does not have a supported operating location nearby.
                    ORCA cannot determine a relevant marine operating area from the currently
                    available location data.
                  </p>
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold text-white hover:bg-black"
                  >
                    Retry Location
                  </button>
                </div>
              )}

              <div className="mt-3 text-[9px] text-slate-400">
                Source: MoPSW Basic Port Statistics of India 2024-25 · Table 1.3
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geofence Alert Banner */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-rose-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-xs"
            >
              <ShieldAlert size={18} /> {n.message}
              <button onClick={() => setNotifications([])} className="ml-4 opacity-70 hover:opacity-100 font-black">
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
