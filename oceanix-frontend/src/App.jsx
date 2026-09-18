// Run from this file
import { motion } from 'framer-motion'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Globe } from 'lucide-react'
import GISMap from './pages/GISMap'
import SafetyBarometer from './pages/SafetyBarometer'
import AgenticChat from './pages/AgenticChat'
import AdvisoryBulletin from './pages/AdvisoryBulletin'
import InteractiveMesh from './components/InteractiveMesh'

const Home = () => (
  <main className="relative min-h-screen flex items-center bg-white overflow-hidden">
    <InteractiveMesh />
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
          Prototype decision-support interface using simulated satellite-style ocean scenarios,
          SST-chlorophyll thermal fronts, and IMBL geofencing for review demonstration.
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
    <div className="absolute bottom-10 w-full flex justify-between px-12 md:px-24 text-[10px] font-mono text-slate-400 uppercase tracking-[0.2em]">
      <div>Created by <span className="text-slate-600 font-bold">Team Runtime Terror</span> for ISRO · Smart India Hackathon 2026</div>
      <div className="flex gap-8"><span>Oceansat-3</span><span>INSAT-3DR</span><span>INCOIS</span></div>
    </div>
  </main>
)

const NAV_LINKS = [
  ['/', 'HOME'],
  ['/chat', 'AI ASSISTANT'],
  ['/gis', 'COMMAND MAP'],
  ['/agents', 'AGENT WORKFLOW'],
  ['/safety', 'SAFETY STATUS'],
  ['/bulletin', 'ADVISORY BULLETIN'],
]

function Navigation() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/50 backdrop-blur-md border-b border-slate-100 z-[5000] px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white"><Globe size={18} /></div>
        <span className="font-black text-xl tracking-tighter text-slate-900">ORCA <span className="text-[10px] text-blue-500 ml-1">ISRO</span></span>
      </div>
      <div className="hidden xl:flex gap-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
        {NAV_LINKS.map(([to, label]) => (
          <Link key={to} to={to} className={pathname === to ? 'text-slate-900' : 'hover:text-slate-900'}>{label}</Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <div className="bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200 flex items-center gap-2">
          <span className="text-[10px] font-bold">English (English)</span><span className="text-slate-300">▼</span>
        </div>
        <button className="bg-rose-500/10 text-rose-600 border border-rose-200 px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2">⚠ SOS DEMO 1554</button>
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-white">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gis" element={<GISMap />} />
          <Route path="/safety" element={<SafetyBarometer />} />
          <Route path="/chat" element={<AgenticChat view="chat" />} />
          <Route path="/agents" element={<AgenticChat view="agents" />} />
          <Route path="/bulletin" element={<AdvisoryBulletin />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
