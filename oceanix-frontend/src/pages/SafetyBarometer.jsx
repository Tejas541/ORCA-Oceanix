import React from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { Activity, ShieldCheck, Wind, Waves, Zap, Map as MapIcon } from 'lucide-react'

const HealthCard = ({ title, latency, health }) => (
  <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</h4>
      <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold border border-emerald-100">{health} Health</span>
    </div>
    <div className="flex items-end justify-between">
       <div className="space-y-1">
          <p className="text-xs font-bold text-slate-800">Latency: {latency}</p>
          <p className="text-[10px] text-blue-500 font-medium">NRSC Ground Synced</p>
       </div>
       <Activity size={20} className="text-slate-200" />
    </div>
  </div>
)

export default function SafetyBarometer() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-24 px-12 pb-12 bg-mesh">
      {/* 1. Top Health Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <HealthCard title="ISRO Oceansat-3 (OCM-3)" latency="42 min" health="98.4%" />
        <HealthCard title="ISRO INSAT-3DR (TIR)" latency="12 min" health="99.1%" />
        <HealthCard title="Copernicus Sentinel-3" latency="88 min" health="96.8%" />
      </div>

      {/* 2. Main Safety Analysis Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] rounded-full" />
            
            <div className="flex items-start justify-between mb-12">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner border border-emerald-200">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Kochi Fishing Harbour</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">SAFE FOR VENTURE</h2>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Safety Index</p>
                <div className="text-5xl font-black text-slate-900">74.2<span className="text-xl text-slate-300">/100</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Wave Height', value: '1.03 m', icon: <Waves size={16} /> },
                { label: 'Wind Speed', value: '14.9 kts', icon: <Wind size={16} /> },
                { label: 'Sea State', value: 'Moderate', icon: <Activity size={16} /> },
                { label: 'Lightning Risk', value: '24.9%', icon: <Zap size={16} /> }
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
                  <div className="text-slate-400 mb-3">{stat.icon}</div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{stat.value}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-10 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
               <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Official Directive: Normal fishing and coastal navigation permitted.</p>
            </div>
          </div>
        </div>

        {/* 3. Local Map Preview */}
        <div className="bg-white rounded-[2.5rem] p-4 shadow-xl border border-slate-100 h-full min-h-[400px] flex flex-col">
            <div className="p-4 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Monitoring</span>
                <MapIcon size={16} className="text-slate-300" />
            </div>
            <div className="flex-1 rounded-[1.8rem] overflow-hidden border border-slate-100">
                <MapContainer center={[10.0, 76.0]} zoom={8} className="h-full w-full" zoomControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                </MapContainer>
            </div>
        </div>
      </div>
    </div>
  )
}