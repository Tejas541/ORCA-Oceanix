import React from 'react'
import { motion } from 'framer-motion'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Globe, AlertTriangle, MessageSquare, Map as MapIcon, ShieldCheck } from 'lucide-react'
import GISMap from './pages/GISMap'
import SafetyBarometer from './pages/SafetyBarometer'
import AgenticChat from './pages/AgenticChat'
import AdvisoryBulletin from './pages/AdvisoryBulletin'
import InteractiveMesh from './components/InteractiveMesh'

const Home = () => (
  <main className="relative min-h-screen flex items-center bg-white overflow-hidden">
    {/* 1. Interactive Background Layer */}
    <InteractiveMesh />

    {/* 2. Content Layer */}
    <div className="relative z-10 w-full max-w-7xl mx-auto px-12 md:px-24">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl"
      >
        <h1 className="text-7xl md:text-8xl font-black text-[#1a1c1e] tracking-tight leading-[1.05]">
          The Agentic Brain <br />
          for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-400">Indian Ocean</span>
        </h1>

        <p className="mt-8 text-lg text-slate-500 max-w-lg leading-relaxed font-medium">
          Autonomous multi-agent platform reasoning over ISRO satellite oceanography,
          SST-chlorophyll thermal fronts, and IMBL geofencing to empower 4 million+ coastal fishermen.
        </p>

        <div className="mt-12 flex items-center gap-6">
          <Link to="/chat" className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-black transition-all group">
            Launch AI Decision Studio <span className="text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <Link to="/gis" className="bg-white border border-slate-200 text-slate-900 px-8 py-4 rounded-full font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center text-[10px]">🧭</div>
            GIS Command Map
          </Link>
        </div>
      </motion.div>
    </div>

    {/* 3. Footer Metadata */}
    <div className="absolute bottom-10 w-full flex justify-between px-12 md:px-24 text-[10px] font-mono text-slate-400 uppercase tracking-[0.2em]">
      <div>Created by <span className="text-slate-600 font-bold">Team Runtime Terror</span> for ISRO · Smart India Hackathon 2026</div>
      <div className="flex gap-8">
        <span>Oceansat-3</span>
        <span>INSAT-3DR</span>
        <span>INCOIS</span>
      </div>
    </div>
  </main>
)

function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-white">

        {/* --- NAVBAR SECTION --- */}
        <nav className="fixed top-0 left-0 right-0 h-16 bg-white/50 backdrop-blur-md border-b border-slate-100 z-[5000] px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white">
              <Globe size={18} />
            </div>
            <span className="font-black text-xl tracking-tighter text-slate-900">BLUE ORBIT <span className="text-[10px] text-blue-500 ml-1">ISRO</span></span>
          </div>

          <div className="hidden xl:flex gap-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
            <Link to="/" className="text-slate-900">Home</Link>
            <Link to="/chat" className="hover:text-slate-900">AI Chatbot</Link>
            <Link to="/gis" className="hover:text-slate-900">GIS Command</Link>
            <Link to="/chat" className="hover:text-slate-900">Agent DAG</Link>
            <Link to="/safety" className="hover:text-slate-900">Safety Barometer</Link>
            <Link to="/bulletin" className="hover:text-slate-900">Advisory Bulletin</Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200 flex items-center gap-2">
              <span className="text-[10px] font-bold">English (English)</span>
              <span className="text-slate-300">▼</span>
            </div>
            <button className="bg-rose-500/10 text-rose-600 border border-rose-200 px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2">
              ⚠ SOS 1554
            </button>
          </div>
        </nav>
        {/* --- END NAVBAR SECTION --- */}

        {/* --- ROUTING SECTION --- */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gis" element={<GISMap />} />
          <Route path="/safety" element={<SafetyBarometer />} />
          <Route path="/chat" element={<AgenticChat />} />
          <Route path="/bulletin" element={<AdvisoryBulletin />} />
        </Routes>
        {/* --- END ROUTING SECTION --- */}

      </div>
    </BrowserRouter>
  )
}

export default App