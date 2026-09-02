import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, Polygon, Popup, Marker, useMap, useMapEvents } from 'react-leaflet'
import { Layers, Play, Pause, RotateCcw, MessageSquare, Target, ShieldAlert, Anchor, Compass, Send, MapPin, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'
import { scenarios } from '../data/mockOcean'
import { useScenario } from '../context/ScenarioContext'

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

const SCENARIO_CENTERS = {
  kochi: { center: [10.2, 75.9], zoom: 9 },
  chennai: { center: [13.15, 80.45], zoom: 9 },
  'bay-of-bengal': { center: [16.5, 85.5], zoom: 7 },
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

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function GISMap() {
  const { selectedScenarioId, selectedScenario: scenario, setSelectedScenarioId } = useScenario()

  const route = scenario.trawlerRoute.coordinates
  const imblLine = scenario.imbl.coordinates
  const bufferNm = scenario.imbl.bufferNm
  const bufferRing = imblBufferPolygon(imblLine, bufferNm)

  const [activeLayers, setActiveLayers] = useState(['PFZ', 'IMBL', 'MPA', 'CYCLONE'])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [boatPosition, setBoatPosition] = useState(route[0])
  const [routeIndex, setRouteIndex] = useState(0)
  const [notifications, setNotifications] = useState([])
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

  const chatEndRef = useRef(null)
  const timerRef = useRef(null)

  // Reset simulation state when scenario changes
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
  }, [selectedScenarioId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      responseText = `Safety Index for ${scenario.label}: ${scenario.risk.safetyScore}/100 (${scenario.risk.riskLevel}). Status: ${scenario.risk.ventureStatusLabel}. Directive: ${scenario.risk.officialDirective}`
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
  }, [scenario, liveImblNm])

  // Handle map click inspection
  const handleMapClick = useCallback((coords) => {
    setClickedLocation(coords)
    const distHarbour = haversineNm(coords, scenario.harbour.coordinates)
    const distImbl = distanceToPolylineNm(coords, imblLine)

    const locMsgText = `Inspecting Location [${coords[0].toFixed(4)}°N, ${coords[1].toFixed(4)}°E]: ${distHarbour.toFixed(1)} NM from ${scenario.harbour.name}, ${distImbl.toFixed(1)} NM from demo IMBL. Composite Safety Score: ${scenario.risk.safetyScore}/100.`

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
  }, [scenario, imblLine])

  const scenarioMeta = SCENARIO_CENTERS[selectedScenarioId] || SCENARIO_CENTERS.kochi

  return (
    <div className="h-screen w-full relative bg-slate-50 overflow-hidden font-sans">
      
      {/* 0. Top Scenario Selector & Status Header */}
      <div className="absolute top-20 left-6 z-[1000] flex items-center gap-3">
        <div className="glass-panel px-4 py-2 rounded-2xl shadow-xl border border-white/60 flex items-center gap-3">
          <Compass className="text-blue-600" size={18} />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Scenario</span>
            <select
              value={selectedScenarioId}
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              className="bg-transparent font-bold text-xs text-slate-900 outline-none cursor-pointer pr-2"
            >
              {Object.values(scenarios).map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.label} ({sc.risk.riskLevel === 'SAFE_FOR_VENTURE' ? '🟢 SAFE' : sc.risk.riskLevel === 'CAUTION' ? '🟡 CAUTION' : '🔴 NO VENTURE'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-md flex items-center gap-1.5 ${
          scenario.risk.riskLevel === 'SAFE_FOR_VENTURE' 
            ? 'bg-emerald-500 text-white' 
            : scenario.risk.riskLevel === 'CAUTION' 
            ? 'bg-amber-500 text-white' 
            : 'bg-rose-600 text-white'
        }`}>
          {scenario.risk.riskLevel === 'SAFE_FOR_VENTURE' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {scenario.risk.ventureStatusLabel}
        </div>
      </div>

      {/* 1. Left Sidebar: Map Layers & Controls */}
      <div className="absolute top-36 left-6 z-[1000] w-72 glass-panel rounded-3xl p-5 shadow-2xl border border-white/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Layers size={14} /> Map Layers
          </h3>
          <span className="text-[9px] font-mono text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded">DEMO L3</span>
        </div>

        <div className="mb-4 text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg text-center">
          SIMULATED EDIL DEMO DATA
        </div>

        <div className="space-y-2">
          {[
            { id: 'PFZ', label: 'PFZ Fishing Zones', color: 'bg-emerald-500', icon: <Target size={14}/> },
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
      </div>

      {/* 2. Right Sidebar: Interactive AI Assistant */}
      <div className="absolute top-20 right-6 z-[1000] w-96 bottom-10 glass-panel rounded-[2rem] shadow-2xl border border-white/50 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/70 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-bold text-sm text-slate-800 tracking-tight flex items-center gap-1.5">
              Blue Orbit Assistant <Sparkles size={14} className="text-blue-500" />
            </span>
          </div>
          <span className="text-[9px] font-bold bg-slate-900 text-white px-2 py-1 rounded-md">SIMULATED ASSISTANT</span>
        </div>
        
        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-medium">
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
        <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex flex-wrap gap-1.5">
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
        <div className="p-3 bg-white/90 border-t border-slate-100">
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

      {/* 3. Bottom Stats Bar */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-6 py-3 rounded-2xl flex gap-6 items-center border border-white/50 shadow-xl max-w-2xl overflow-x-auto">
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Wave Height</span>
          <span className="text-xs font-black text-slate-800">{scenario.oceanConditions.waveHeight}m</span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Wind</span>
          <span className="text-xs font-black text-slate-800">{scenario.oceanConditions.windSpeed} kts</span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Safety Index</span>
          <span className={`text-xs font-black ${
            scenario.risk.safetyScore >= 70 ? 'text-emerald-600' : scenario.risk.safetyScore >= 50 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {scenario.risk.safetyScore}/100
          </span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">SST</span>
          <span className="text-xs font-black text-slate-800">{scenario.oceanParameters.sst}°C</span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Chlorophyll</span>
          <span className="text-xs font-black text-slate-800">{scenario.oceanParameters.chlorophyll} mg/m³</span>
        </div>
        <div className="w-px h-6 bg-slate-200 shrink-0" />
        <div className="flex flex-col shrink-0">
          <span className="text-[9px] font-bold text-slate-400 uppercase">IMBL Dist</span>
          <span className="text-xs font-black text-slate-800">{liveImblNm.toFixed(1)} NM</span>
        </div>
      </div>

      {/* 4. The Leaflet Map */}
      <MapContainer
        center={scenarioMeta.center}
        zoom={scenarioMeta.zoom}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <MapRecenter center={scenarioMeta.center} zoom={scenarioMeta.zoom} />
        <MapClickHandler onMapClick={handleMapClick} />

        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Harbour Origin Marker */}
        <Marker position={scenario.harbour.coordinates}>
          <Popup>
            <div className="p-1 space-y-1">
              <strong className="text-sm font-bold text-slate-900">{scenario.harbour.name}</strong>
              <div className="text-xs text-slate-600">{scenario.region}</div>
              <div className="text-[10px] text-blue-600 font-bold">Harbour Origin Pin</div>
            </div>
          </Popup>
        </Marker>

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
                  {haversineNm(clickedLocation, scenario.harbour.coordinates).toFixed(1)} NM from harbour
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
                  <div className="font-bold text-emerald-600 text-xs uppercase">Primary PFZ Zone</div>
                  <strong className="text-sm">{scenario.pfz.name}</strong>
                  <div className="text-xs text-slate-600">Target Species: <span className="font-semibold">{scenario.pfz.targetSpecies}</span></div>
                  <div className="text-xs text-slate-600">Depth: {scenario.pfz.depthMeters} m | Confidence: <span className="font-bold text-emerald-600">{scenario.pfz.confidence}%</span></div>
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
                    <div className="font-bold text-teal-600 text-xs uppercase">Secondary PFZ Zone</div>
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
      </MapContainer>

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

