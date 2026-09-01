import React, { useState } from 'react'
import { MapContainer, TileLayer, Circle, Polyline, Popup, Marker } from 'react-leaflet'
import { Layers, Play, MessageSquare, Target, ShieldAlert, Anchor } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { motion, AnimatePresence } from 'framer-motion'
import L from 'leaflet'

const trawlerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2942/2942940.png',
  iconSize: [30, 30],
})

export default function GISMap() {
  const [activeLayers, setActiveLayers] = useState(['PFZ', 'IMBL'])
  const [isSimulating, setIsSimulating] = useState(false)
  const [notifications, setNotifications] = useState([])

  const safePath = [
    [9.9312, 76.2673],
    [10.1, 75.8],
    [10.3, 75.5],
    [10.51, 75.82],
  ]

  const triggerSimulation = () => {
    setIsSimulating(true)
    setNotifications([])

    setTimeout(() => {
      setNotifications([{ id: 1, type: 'IMBL', message: 'Warning: Approaching IMBL Buffer Zone' }])
    }, 2000)
  }

  return (
    <div className="h-screen w-full relative bg-slate-50">
      {/* 1. Left Sidebar: Map Layers */}
      <div className="absolute top-24 left-6 z-[1000] w-72 glass-panel rounded-3xl p-6 shadow-2xl border border-white/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Layers size={14} /> Map Layers
          </h3>
          <span className="text-[10px] font-mono text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded">ISRO L3</span>
        </div>

        <div className="space-y-3">
          {[
            { id: 'PFZ', label: 'PFZ Fishing Zones', color: 'bg-emerald-500', icon: <Target size={14}/> },
            { id: 'IMBL', label: 'IMBL Border Buffer', color: 'bg-rose-500', icon: <ShieldAlert size={14}/> },
            { id: 'MPA', label: 'MPA Eco Reserves', color: 'bg-orange-400', icon: <Anchor size={14}/> },
            { id: 'CYCLONE', label: 'Cyclone Track', color: 'bg-blue-600', icon: <Layers size={14}/> }
          ].map((layer) => (
            <button 
              key={layer.id}
              onClick={() => setActiveLayers(prev => prev.includes(layer.id) ? prev.filter(i => i !== layer.id) : [...prev, layer.id])}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${activeLayers.includes(layer.id) ? 'bg-white border-slate-200 shadow-sm' : 'bg-transparent border-transparent opacity-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${layer.color}`} />
                <span className="text-xs font-bold text-slate-700">{layer.label}</span>
              </div>
              <div className="text-slate-400">{layer.icon}</div>
            </button>
          ))}
        </div>

        <button
          onClick={triggerSimulation}
          className="w-full mt-8 bg-slate-900 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
        >
          <Play size={14} fill="white" /> Simulate Trawler Route
        </button>
      </div>

      {/* 2. Right Sidebar: AI Assistant */}
      <div className="absolute top-24 right-6 z-[1000] w-96 bottom-10 glass-panel rounded-[2rem] shadow-2xl border border-white/50 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-bold text-sm text-slate-800 tracking-tight">Blue Orbit Assistant</span>
          </div>
          <span className="text-[9px] font-bold bg-slate-900 text-white px-2 py-1 rounded-md">AGENTIC AI</span>
        </div>
        
        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    <MessageSquare className="text-blue-500 opacity-20" size={32} />
                </div>
                <p className="text-xs text-slate-400 font-medium max-w-[200px]">
                    Click anywhere on the map or ask a query to start reasoning.
                </p>
            </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/80 border-t border-slate-100">
          <div className="relative">
            <input 
              className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 text-sm outline-none focus:ring-2 ring-blue-500/20 pr-12" 
              placeholder="Ask anything about ocean safety..." 
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                ↑
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Stats Bar */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-8 py-3 rounded-2xl flex gap-8 items-center border border-white/50 shadow-xl">
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Wave Height</span>
            <span className="text-sm font-black text-slate-800">1.12m</span>
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Wind</span>
            <span className="text-sm font-black text-slate-800">6.2 kts</span>
        </div>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Safety Index</span>
            <span className="text-sm font-black text-emerald-600">80/100</span>
        </div>
      </div>

      {/* 4. The Leaflet Map */}
      <MapContainer
        center={[10.5, 76.0]}
        zoom={8}
        className="h-full w-full z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO | ISRO Oceansat-3'
        />

        {activeLayers.includes('PFZ') && (
          <Circle
            center={[12.9716, 74.8560]}
            radius={20000}
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 }}
          />
        )}

        {isSimulating && (
          <Polyline
            positions={safePath}
            pathOptions={{ color: '#2563eb', weight: 4, dashArray: '10, 10' }}
          />
        )}

        {isSimulating && (
          <Marker position={safePath[0]} icon={trawlerIcon}>
            <Popup>
              Vessel: BlueFin-01 <br /> Status: Navigating to PFZ
            </Popup>
          </Marker>
        )}

        {activeLayers.includes('IMBL') && (
          <Circle
            center={[9.2, 79.2]}
            radius={40000}
            pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.1 }}
          >
            <Popup>International Maritime Boundary Line - Restricted Access</Popup>
          </Circle>
        )}
      </MapContainer>

      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-rose-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-xs"
            >
              <ShieldAlert size={16} /> {n.message}
              <button onClick={() => setNotifications([])} className="ml-4 opacity-50">
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}