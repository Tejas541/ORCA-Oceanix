import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Play, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Volume2, 
  Database, 
  Wind, 
  Zap, 
  Map, 
  Cpu, 
  ShieldCheck, 
  Layers,
  ArrowRight
} from 'lucide-react'

// --- SUB-COMPONENT: PROVENANCE STEP ---
const ProvenanceStep = ({ number, title, time, detail, subtasks, isActive, confidence }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: number * 0.15 }}
    className="relative pl-10 pb-8 last:pb-0"
  >
    {/* Connector Line */}
    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-slate-200 last:hidden" />
    
    {/* Number Bubble */}
    <motion.div 
      animate={isActive ? { scale: [1, 1.2, 1], backgroundColor: ['#eff6ff', '#2563eb', '#eff6ff'] } : {}}
      transition={{ repeat: Infinity, duration: 2 }}
      className={`absolute left-0 top-0 w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold z-10 transition-colors ${
        isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-200 text-slate-400'
      }`}
    >
      {number}
    </motion.div>

    <div className={`bg-white border rounded-2xl p-5 transition-all ${
      isActive ? 'border-blue-200 shadow-xl shadow-blue-500/5' : 'border-slate-100 shadow-sm'
    }`}>
      <div className="flex justify-between items-start mb-2 gap-3">
        <h4 className={`text-sm font-bold ${isActive ? 'text-blue-600' : 'text-slate-800'}`}>{title}</h4>
        <div className="flex items-center gap-2">
          {confidence !== undefined && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
              {confidence}% confidence
            </span>
          )}
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
            {isActive ? 'PROCESSING...' : `${time}ms`}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed font-medium">{detail}</p>
      
      {subtasks && (
        <div className="mt-3 flex flex-wrap gap-2">
           {subtasks.map((task, i) => (
             <span key={i} className="text-[9px] px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md font-bold border border-emerald-100 flex items-center gap-1">
               <CheckCircle2 size={10} /> {task}
             </span>
           ))}
        </div>
      )}
    </div>
  </motion.div>
)

// --- MAIN PAGE COMPONENT ---
export default function AgenticChat() {
  const [isRunning, setIsRunning] = useState(false)
  const [language, setLanguage] = useState('English')
  const [query, setQuery] = useState('What are the sea conditions, PFZ suitability, and IMBL distance today?')

  const speakAdvisory = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const text = "Namaste! I have processed your request. The sea-venture clearance is safe for venture with a score of 74."
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  // Fake loading sequence
  const startDAG = () => {
    setIsRunning(true)
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] bg-mesh pt-24 pb-20 px-6">
      
      {/* 1. FUTURISTIC HEADER */}
      <div className="max-w-5xl mx-auto text-center mb-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative inline-block"
        >
          <h1 className="text-7xl md:text-8xl font-black text-slate-900 tracking-tighter opacity-[0.03] select-none" style={{ fontFamily: 'monospace' }}>
            ISRO OCEAN AI
          </h1>
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <p className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-[0.4em] bg-[#F9FAFB] px-4">
               Autonomous Multi-Agent Reasoning Engine
            </p>
          </motion.div>
        </motion.div>

        {/* Search Interface */}
        <div className="relative max-w-2xl mx-auto mt-8 mb-8 group">
          <div className="absolute inset-0 bg-blue-500/5 blur-2xl rounded-full group-hover:bg-blue-500/10 transition-all" />
          <input 
            className="relative w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-6 text-sm shadow-2xl outline-none focus:ring-4 ring-blue-500/5 pr-40 font-medium text-slate-700"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about PFZ coordinates, sea safety, border clearance..."
          />
          <button 
            onClick={startDAG}
            disabled={isRunning}
            className="absolute right-3 top-3 bottom-3 bg-slate-900 text-white px-8 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
          >
            {isRunning ? 'EXECUTING...' : 'RUN DAG'} 
            <Play size={12} fill="white" className={isRunning ? 'animate-pulse' : ''} />
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'Nearest Tuna PFZ (Kochi)', icon: <Target size={12}/> },
            { label: 'Sea Venture Safety (Chennai)', icon: <ShieldCheck size={12}/> },
            { label: 'Cyclone Warnings (Bay of Bengal)', icon: <Wind size={12}/> }
          ].map(chip => (
            <button 
              key={chip.label} 
              onClick={() => setQuery(chip.label)}
              className="px-4 py-2 bg-white border border-slate-100 rounded-full text-[10px] font-bold text-slate-500 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2"
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. DYNAMIC CONTENT AREA */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT COLUMN: SYNTHESIZED OUTPUT */}
        <div className="lg:col-span-7 space-y-6">
           <AnimatePresence>
             {isRunning && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-blue-100 relative overflow-hidden"
               >
                  {/* Glowing background accent */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full" />

                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                      <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                         <Zap size={14} fill="currentColor" /> Synthesized Marine Advisory
                      </h3>
                      <div className="flex gap-2">
                        {['English', 'Hindi', 'Tamil', 'Malayalam'].map(l => (
                          <button 
                            key={l}
                            onClick={() => setLanguage(l)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all border ${
                              language === l ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-slate-100'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 inline-block mb-2">
                        CONFIDENCE: 94.6%
                      </div>
                      <button
                        onClick={speakAdvisory}
                        className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-blue-500 ml-auto transition-colors"
                      >
                        <Volume2 size={14} /> Listen (Voice)
                      </button>
                    </div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium text-sm md:text-base relative z-10"
                  >
                    Namaste! I have processed your request across 5 parallel agent nodes. 
                    <br /><br />
                    At coordinates <span className="text-blue-600 font-bold">15.18°N, 79.72°E</span>, the sea conditions are moderate with waves of 1.03m and a wind speed of 14.9 kts. The safety score for sea-venture is <span className="text-emerald-600 font-bold">74.2/100 (SAFE)</span>. 
                    <br /><br />
                    The <span className="text-blue-600 underline decoration-2 underline-offset-4">Alleppey Thermal Front</span> is approximately 69.9 km away, bearing 257° (WSW), which indicates high suitability for Oil Sardine fishing. You are currently 176.25 NM away from the International Maritime Boundary Line (IMBL), maintaining safe operational compliance.
                  </motion.div>

                  <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                     <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">SST Gradient</span>
                           <span className="text-xs font-black text-slate-700">0.98°C/10km</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-bold text-slate-400 uppercase">Chlorophyll</span>
                           <span className="text-xs font-black text-slate-700">2.73 mg/m³</span>
                        </div>
                     </div>
                     <button className="text-[10px] font-bold text-white bg-slate-900 px-5 py-2 rounded-xl flex items-center gap-2 hover:bg-black transition-all">
                        View Evidence Map <ArrowRight size={12} />
                     </button>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: PROVENANCE CHAIN */}
        <div className="lg:col-span-5">
          <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-8 border border-white/50 shadow-sm h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Cpu size={14} /> Agent Provenance Chain
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">LATENCY:</span>
                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">5791.77ms</span>
              </div>
            </div>

            <div className="space-y-0">
              <ProvenanceStep 
                number={1} 
                title="Blue Orbit Master Supervisor & DAG Planner" 
                time="0.01" 
                detail="Parsed query intent: 'pfz_discovery, sea_safety'. Language detected: 'en'. Formulated 5-stage execution graph."
                subtasks={["Decomposed into 5 parallel subtasks"]}
                isActive={isRunning && !isRunning} // Mock logic: can animate based on timer
              />
              <ProvenanceStep 
                number={2} 
                title="Marine EO Data Discovery & Ingestion Agent" 
                time="0.02" 
                detail="Retrieved Oceansat-3 OCM-3 (Chl-a: 2.73 mg/m³) and INSAT-3DR TIR (SST: 27.72°C). Cloud cover: 33.0%."
                subtasks={["High radiometric quality confirmed", "99.2% Data Integrity"]}
                confidence={99.2}
              />
              <ProvenanceStep 
                number={3} 
                title="Weather & Marine Disaster Hazard Agent" 
                time="0.02" 
                detail="Calculated Wave Height (1.03m) and risk index 74.2/100. Status: SAFE_FOR_VENTURE."
                subtasks={["Normal navigation permitted"]}
              />
              <ProvenanceStep 
                number={4} 
                title="Ocean Analytics & PFZ Agent" 
                time="0.19" 
                detail="Computed thermal front gradient (|∇SST|) × chlorophyll gradient. Identified top zone 'Off Kochi'."
                subtasks={["High suitability for Oil Sardine"]}
              />
              <ProvenanceStep 
                number={5} 
                title="Geospatial & Geofencing Agent" 
                time="0.11" 
                detail="Evaluated IMBL distance (176.25 NM). Generated A* safe route avoiding restricted zones."
                subtasks={["IMBL Compliance Validated"]}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

const Target = ({ size }) => <Map size={size} />