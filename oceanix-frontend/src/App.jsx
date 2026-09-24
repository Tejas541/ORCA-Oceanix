// Run from this file
import { motion } from 'framer-motion'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import GISMap from './pages/GISMap'
import SafetyBarometer from './pages/SafetyBarometer'
import AgenticChat from './pages/AgenticChat'
import AdvisoryBulletin from './pages/AdvisoryBulletin'
import AivanaVoiceInterface from './components/AivanaVoiceInterface'

const Home = () => (
  <main className="relative min-h-screen flex flex-col justify-between bg-white overflow-hidden pt-20">
    {/* Subtle Diamond Grid Background matching reference image */}
    <div className="absolute inset-0 bg-diamond-grid opacity-60 pointer-events-none" />

    {/* Hero Section Container */}
    <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-2 md:pt-4">
      {/* Super-title */}
      <motion.p
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-[11px] font-bold tracking-[0.25em] text-slate-400 uppercase mb-2.5"
      >
        INDIAN OCEAN &nbsp;•&nbsp; SAFER SEAS &nbsp;•&nbsp; SMARTER DECISIONS
      </motion.p>

      {/* Main Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="text-5xl sm:text-6xl md:text-7xl font-black text-[#0f172a] tracking-tight leading-[1.08] max-w-4xl mx-auto"
      >
        The Agentic Brain <br />
        for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400">Indian Ocean</span>
      </motion.h1>

      {/* Supporting Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-3 text-sm md:text-base text-slate-500 max-w-xl mx-auto leading-relaxed font-normal"
      >
        Talk to ORCA. Get real-time insights. Make safer decisions. <br className="hidden sm:inline" />
        Built for the people who work, travel and protect our oceans.
      </motion.p>

      {/* Central Aivana Voice Interface with Orb, Quick Actions, Input & CTAs */}
      <AivanaVoiceInterface />
    </div>

    {/* Ocean Wave Bottom Visual Treatment matching approved reference design */}
    <div className="relative w-full overflow-hidden mt-auto">
      <div className="relative h-44 sm:h-52 md:h-60 w-full">
        <img
          src="/ocean_waves.jpg"
          alt="Indian Ocean waves"
          className="w-full h-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/30 to-transparent pointer-events-none" />

        {/* Footer Text overlay directly on the waves */}
        <div className="absolute bottom-5 sm:bottom-6 left-0 right-0 z-20 w-full flex flex-col sm:flex-row justify-between items-center gap-2 px-6 sm:px-12 md:px-16 text-[10px] font-mono font-bold text-slate-700 uppercase tracking-[0.2em]">
          <div>
            CREATED BY <span className="text-slate-900 font-black">TEAM RUNTIME TERROR</span> FOR ISRO &nbsp;·&nbsp; SMART INDIA HACKATHON 2026
          </div>
          <div className="flex gap-4 sm:gap-6 font-black text-slate-800">
            <span>OCEANSAT-3</span>
            <span className="text-slate-400 font-normal">|</span>
            <span>INSAT-3DR</span>
            <span className="text-slate-400 font-normal">|</span>
            <span>INCOIS</span>
          </div>
        </div>
      </div>
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
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur-md border-b border-slate-100 z-[5000] px-6 md:px-10 flex items-center justify-between">
      {/* Brand: ORCA ISRO */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-lg bg-[#070e1e] border border-blue-500/30 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:border-blue-400 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" />
            <path d="M12 3a9 9 0 0 1 9 9c0 3.5-2 6.5-5 8" stroke="url(#nav-logo-grad)" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.9" />
            <defs>
              <linearGradient id="nav-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="font-black text-xl tracking-tight text-slate-900">
          ORCA <span className="text-[11px] font-bold text-blue-600 ml-0.5 tracking-wider">ISRO</span>
        </span>
      </Link>

      {/* Navigation Links */}
      <div className="hidden xl:flex items-center gap-6 text-[11px] font-bold tracking-wider uppercase">
        {NAV_LINKS.map(([to, label]) => {
          const isActive = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`relative transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {isActive ? (
                <div className="flex flex-col items-center">
                  <span className="bg-slate-100 text-slate-900 px-3.5 py-1.5 rounded-full font-bold">
                    {label}
                  </span>
                  <span className="w-5 h-0.5 bg-blue-600 rounded-full mt-0.5 absolute -bottom-1" />
                </div>
              ) : (
                <span className="px-2 py-1.5">{label}</span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <div className="bg-slate-100 hover:bg-slate-200/80 px-3.5 py-1.5 rounded-full border border-slate-200/80 flex items-center gap-1.5 cursor-pointer transition-colors">
          <span className="text-[11px] font-bold text-slate-700">English (English)</span>
          <span className="text-slate-400 text-[10px]">▼</span>
        </div>
        <button className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-200 px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-sm transition-colors">
          <span>⚠</span> SOS DEMO 1554
        </button>
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
