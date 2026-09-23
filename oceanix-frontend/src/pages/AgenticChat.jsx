import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
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
  ArrowRight,
  Compass,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Square
} from 'lucide-react'
import { useScenario } from '../context/ScenarioContext'

// --- LANGUAGE CODE MAPPINGS FOR WEB SPEECH SYNTHESIS ---
const LANGUAGE_CODES = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Tamil: 'ta-IN',
  Malayalam: 'ml-IN',
  Marathi: 'mr-IN'
}


// --- SUB-COMPONENT: PROVENANCE STEP ---
const ProvenanceStep = ({ number, title, time, detail, subtasks, isActive, isDone, confidence, horizontal = false }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: number * 0.1 }}
    className={horizontal ? 'relative min-w-[220px] flex-1 pb-0 pt-10' : 'relative pl-10 pb-7 last:pb-0'}
  >
    {/* Connector Line */}
    <div className={`${horizontal ? 'absolute left-[15px] right-0 top-[15px] h-px' : 'absolute left-[15px] top-0 bottom-0 w-px'} transition-colors duration-500 last:hidden ${
      isDone ? 'bg-emerald-300' : isActive ? 'bg-blue-300' : 'bg-slate-200'
    }`} />
    
    {/* Number Bubble */}
    <motion.div 
      animate={isActive ? { scale: [1, 1.15, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1.2 }}
      className={`absolute left-0 top-0 w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold z-10 transition-all duration-300 ${
        isDone 
          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
          : isActive 
          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-300 ring-4 ring-blue-100' 
          : 'bg-white border-slate-200 text-slate-400'
      }`}
    >
      {isDone ? <CheckCircle2 size={14} /> : number}
    </motion.div>

    <div className={`bg-white border rounded-2xl p-5 transition-all duration-300 ${
      isActive 
        ? 'border-blue-300 shadow-xl shadow-blue-500/10 ring-2 ring-blue-500/10' 
        : isDone
        ? 'border-emerald-100 shadow-sm'
        : 'border-slate-100 shadow-sm opacity-80'
    }`}>
      <div className="flex justify-between items-start mb-2 gap-3">
        <h4 className={`text-sm font-bold transition-colors ${
          isActive ? 'text-blue-600' : isDone ? 'text-slate-800' : 'text-slate-700'
        }`}>
          {title}
        </h4>
        <div className="flex items-center gap-2">
          {confidence !== undefined && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {confidence}% conf
            </span>
          )}
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-colors ${
            isActive 
              ? 'text-blue-600 bg-blue-50 animate-pulse' 
              : isDone 
              ? 'text-emerald-700 bg-emerald-50' 
              : 'text-slate-400 bg-slate-50'
          }`}>
            {isActive ? 'PROCESSING...' : isDone ? `${time}ms` : 'QUEUED'}
          </span>
        </div>
      </div>
      
      <p className="text-xs text-slate-500 leading-relaxed font-medium">{detail}</p>
      
      {subtasks && subtasks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {subtasks.map((task, i) => (
            <span 
              key={i} 
              className={`text-[9px] px-2 py-1 rounded-md font-bold border flex items-center gap-1 transition-all ${
                isDone 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : isActive
                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                  : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}
            >
              <CheckCircle2 size={10} className={isDone ? 'text-emerald-500' : 'text-slate-300'} /> 
              {task}
            </span>
          ))}
        </div>
      )}
    </div>
  </motion.div>
)

// --- MAIN PAGE COMPONENT ---
export default function AgenticChat({ view = 'chat' }) {
  const navigate = useNavigate()
  const {
    selectedOperatingLocation,
    locationDecision,
    assistantTask,
  } = useScenario()
  const decision = locationDecision?.decision ?? {
    riskLevel: 'DATA_INSUFFICIENT',
    safetyScore: null,
    ventureStatusLabel: 'DATA INSUFFICIENT',
    officialDirective: 'Required evidence unavailable for the selected operating location.',
  }
  const operatingLocationName = selectedOperatingLocation?.name ?? 'SELECT OPERATING LOCATION'

  const [isRunning, setIsRunning] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(true) // Start completed with initial scenario
  const [activeStepIndex, setActiveStepIndex] = useState(5) // 0-indexed, 5 means all 5 done
  const [language, setLanguage] = useState('English')
  const [query, setQuery] = useState('What is the current ORCA decision for this operating location?')
  const [totalLatency, setTotalLatency] = useState(48.2)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState([])

  // --- 1. SINGLE CANONICAL SOURCE VARIABLE FOR FINAL DISPLAYED ADVISORY TEXT ---
  const finalDisplayedAdvisory = useMemo(() => {
    if (!selectedOperatingLocation) return 'Select an operating location on the Command Map to begin.'
    return `Current operating location: ${operatingLocationName}. ORCA decision: ${decision.riskLevel}. ${decision.safetyScore == null ? 'Safety score unavailable because required evidence is insufficient.' : `Safety score: ${decision.safetyScore}/100.`} ${decision.officialDirective}`
  }, [language, selectedOperatingLocation, operatingLocationName, decision])

  const dagTimerRef = useRef([])

  const clearDagTimers = () => {
    dagTimerRef.current.forEach(t => clearTimeout(t))
    dagTimerRef.current = []
  }

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }

  // Handle asynchronous voice loading so browser voices can be detected
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices() || []
      if (v.length > 0) {
        setVoices(v)
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  // Cancel speech on unmount or timers
  useEffect(() => {
    return () => {
      clearDagTimers()
      stopSpeech()
    }
  }, [])

  // Cancel previous speech if scenario or language changes
  useEffect(() => {
    stopSpeech()
  }, [language, selectedOperatingLocation])

  // Auto-detect scenario if query contains scenario keywords
  const handleQueryChange = (newQuery) => {
    setQuery(newQuery)
  }

  // Speak synthesized advisory using Web Speech API from the beginning
  // ROOT REQUIREMENT: speaks the EXACT SAME text displayed in the "Synthesized Marine Advisory"
  const speakAdvisory = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel() // Stop any ongoing speech and clear queue

    // 1. Text is identical to finalDisplayedAdvisory (never coordinate/numeric content)
    const textToSpeak = finalDisplayedAdvisory
    if (!textToSpeak || typeof textToSpeak !== 'string') return

    const utterance = new SpeechSynthesisUtterance(textToSpeak)
    utterance.rate = 0.95
    utterance.pitch = 1.0

    // 2. Language mapping: English → en-IN, Hindi → hi-IN, Tamil → ta-IN, Malayalam → ml-IN, Marathi → mr-IN
    const targetLangCode = LANGUAGE_CODES[language] || 'en-IN'
    utterance.lang = targetLangCode

    // 3. Voice selection from available voices
    const allVoices = (voices.length > 0 ? voices : window.speechSynthesis.getVoices()) || []
    if (allVoices.length > 0) {
      const langCodeNormalized = targetLangCode.replace('_', '-').toLowerCase()
      const langPrefix = langCodeNormalized.split('-')[0] // e.g. 'ta', 'ml', 'mr', 'hi', 'en'

      // Prefer exact language match (e.g. ta-IN, ml-IN, mr-IN, hi-IN, en-IN)
      const exactVoice = allVoices.find(v => (v.lang || '').replace('_', '-').toLowerCase() === langCodeNormalized)

      // Otherwise allow matching language prefix (e.g. ta, ml, mr, hi, en)
      const prefixVoice = allVoices.find(v => {
        const vLang = (v.lang || '').replace('_', '-').toLowerCase()
        return vLang === langPrefix || vLang.startsWith(langPrefix + '-')
      })

      const matchedVoice = exactVoice || prefixVoice
      if (matchedVoice) {
        utterance.voice = matchedVoice
      }
      // If no matching voice exists: DO NOT substitute English or coordinate-only speech.
      // Leave utterance.voice as default and let browser handle targetLangCode gracefully.
    }

    utterance.onstart = () => {
      setIsSpeaking(true)
    }

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis event/error:', e)
      setIsSpeaking(false)
    }

    try {
      setIsSpeaking(true)
      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.warn('Failed to invoke speech synthesis:', err)
      setIsSpeaking(false)
    }
  }

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeech()
    } else {
      speakAdvisory()
    }
  }

  // Execute the 5-stage DAG sequentially
  const startDAG = () => {
    stopSpeech()
    clearDagTimers()
    setIsRunning(true)
    setHasCompleted(false)
    setActiveStepIndex(0) // Step 1 is processing

    // Realistic step timings in ms
    const stepDelays = [300, 650, 1000, 1350, 1700]

    stepDelays.forEach((delay, index) => {
      const timer = setTimeout(() => {
        setActiveStepIndex(index + 1)
        if (index === stepDelays.length - 1) {
          setIsRunning(false)
          setHasCompleted(true)
          setTotalLatency((Math.random() * 20 + 35).toFixed(1))
        }
      }, delay)
      dagTimerRef.current.push(timer)
    })
  }

  // Agent Steps Data derived from active scenario
  const getAgentSteps = () => {
    return [
      {
        number: 1,
        title: "Blue Orbit Simulated Agent Pipeline",
        time: "1.2",
        detail: `Operating location: ${operatingLocationName}. ORCA decision context: ${decision.riskLevel}. Demo query categories: 'pfz_discovery, hazard_assessment, imbl_geofence'. Displayed as a 5-stage simulated pipeline.`,
        subtasks: ["5-stage simulated execution plan", `Operating location: ${operatingLocationName}`],
        confidence: 99.8
      },
      {
        number: 2,
        title: "Simulated Marine EO Data Stage",
        time: "8.4",
        detail: 'Authoritative satellite point data is not available through the current workspace decision context.',
        subtasks: ["No fabricated satellite values", "Authoritative data unavailable"],
        confidence: 99.1
      },
      {
        number: 3,
        title: "Weather & Marine Hazard Stage",
        time: "6.9",
        detail: `Canonical ORCA decision status: ${decision.riskLevel}. Required evidence is used only when available for the selected location.`,
        subtasks: [decision.ventureStatusLabel, decision.safetyScore == null ? "Required evidence unavailable" : "Canonical decision available"],
        confidence: 97.5
      },
      {
        number: 4,
        title: "PFZ Evidence Stage",
        time: "14.2",
        detail: 'PFZ recommendations are not displayed unless authoritative geometry is retrieved for the selected location.',
        subtasks: ["No unrelated demo PFZ", "Authoritative PFZ unavailable"],
        confidence: undefined
      },
      {
        number: 5,
        title: "Geospatial & Geofencing Stage",
        time: "11.5",
        detail: 'No demo IMBL segment or pre-authored route is displayed. Authoritative location-specific geofencing is unavailable.',
        subtasks: ["No unrelated demo IMBL", "Authoritative geofence unavailable"],
        confidence: 99.4
      }
    ]
  }

  const steps = getAgentSteps()

  if (!selectedOperatingLocation) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] bg-mesh pt-24 pb-20 px-6 flex items-center justify-center">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 text-center max-w-lg">
          <Compass size={32} className="mx-auto text-blue-600 mb-4" />
          <h1 className="text-2xl font-black text-slate-900">SELECT OPERATING LOCATION</h1>
          <p className="mt-3 text-sm text-slate-500">Choose an operating location on the Command Map before using the assistant or workflow.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] bg-mesh pt-24 pb-20 px-6 font-sans">
      
      {/* 1. FUTURISTIC HEADER */}
      <div className="max-w-5xl mx-auto text-center mb-10">
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
               Simulated Agent Pipeline
            </p>
          </motion.div>
        </motion.div>

        <div className="flex items-center justify-center gap-3 mt-4 mb-2">
          <div className="glass-panel px-4 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
            <Compass size={14} className="text-blue-600" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Operating Location:</span>
            <span className="font-bold text-xs text-slate-800">{operatingLocationName}</span>
          </div>

          <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase shadow-sm flex items-center gap-1.5 ${
            decision.riskLevel === 'SAFE_FOR_VENTURE' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : decision.riskLevel === 'CAUTION' 
              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {decision.riskLevel === 'SAFE_FOR_VENTURE' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {decision.ventureStatusLabel}
          </div>

          {assistantTask && (
            <div className="glass-panel px-3 py-1 rounded-full border border-blue-100 text-[9px] font-black uppercase tracking-wider text-blue-700">
              Shared task: {assistantTask.intent} · {assistantTask.status}
            </div>
          )}
        </div>

        {/* Search Interface */}
        <div className="relative max-w-2xl mx-auto mt-6 mb-6 group">
          <div className="absolute inset-0 bg-blue-500/5 blur-2xl rounded-full group-hover:bg-blue-500/10 transition-all" />
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              startDAG()
            }}
            className="relative"
          >
            <input 
              className="relative w-full bg-white border border-slate-200 rounded-[2rem] px-8 py-5 text-sm shadow-2xl outline-none focus:ring-4 ring-blue-500/5 pr-40 font-medium text-slate-700"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Ask about PFZ coordinates, sea safety, border clearance..."
            />
            <button 
              type="submit"
              disabled={isRunning}
              className="absolute right-2.5 top-2.5 bottom-2.5 bg-slate-900 text-white px-7 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
            >
              {isRunning ? 'EXECUTING...' : 'RUN DAG'} 
              <Play size={12} fill="white" className={isRunning ? 'animate-pulse' : ''} />
            </button>
          </form>
        </div>

      </div>

      {/* 2. DYNAMIC CONTENT AREA */}
      <div className={`max-w-6xl mx-auto grid grid-cols-1 ${view === 'agents' ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-8`}>
        
        {/* LEFT COLUMN: SYNTHESIZED OUTPUT */}
        <div className={`${view === 'agents' ? 'lg:col-span-12' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} space-y-6`}>
          <AnimatePresence mode="wait">
            {hasCompleted && (
              <motion.div 
                key={`${operatingLocationName}-${language}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-blue-100 relative overflow-hidden"
              >
                {/* Glowing background accent */}
                <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full pointer-events-none ${
                  decision.riskLevel === 'SAFE_FOR_VENTURE' ? 'bg-emerald-500/10' : decision.riskLevel === 'CAUTION' ? 'bg-amber-500/10' : 'bg-rose-500/10'
                }`} />

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                      <Zap size={14} fill="currentColor" /> Simulated Marine Advisory
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                      {['English', 'Hindi', 'Tamil', 'Malayalam', 'Marathi'].map(l => (
                        <button 
                          key={l}
                          onClick={() => {
                            stopSpeech()
                            setLanguage(l)
                          }}
                          className={`text-[9px] font-bold px-2.5 py-1 rounded-lg transition-all border ${
                            language === l 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md border inline-block mb-2 ${
                      decision.riskLevel === 'SAFE_FOR_VENTURE'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : decision.riskLevel === 'CAUTION'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-rose-700 bg-rose-50 border-rose-200'
                    }`}>
                      SAFETY SCORE: {decision.safetyScore == null ? '—' : `${decision.safetyScore}/100`}
                    </div>
                    <button
                      onClick={toggleSpeech}
                      className={`flex items-center gap-1.5 text-[10px] font-bold ml-auto transition-colors px-2.5 py-1 rounded-md border ${
                        isSpeaking
                          ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                          : 'bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-slate-200'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <Square size={11} className="fill-current text-rose-600" /> Stop Voice
                        </>
                      ) : (
                        <>
                          <Volume2 size={13} /> Listen ({language})
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Advisory Content */}
                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed font-medium text-sm md:text-base relative z-10 my-4">
                  {finalDisplayedAdvisory}
                </div>

                {/* Directive Banner */}
                <div className={`mt-6 p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
                  decision.riskLevel === 'SAFE_FOR_VENTURE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : decision.riskLevel === 'CAUTION'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    decision.riskLevel === 'SAFE_FOR_VENTURE' ? 'bg-emerald-500' : decision.riskLevel === 'CAUTION' ? 'bg-amber-500' : 'bg-rose-500 animate-ping'
                  }`} />
                  <div>
                    <span className="uppercase text-[9px] block text-slate-500 font-black">ORCA Decision Context</span>
                    {decision.officialDirective}
                  </div>
                </div>

                {/* Bottom Metric Row */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">SST Gradient</span>
                      <span className="text-xs font-black text-slate-800">—</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Chlorophyll</span>
                      <span className="text-xs font-black text-slate-800">—</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Wave Height</span>
                      <span className="text-xs font-black text-slate-800">{(() => { const record = locationDecision?.evidence?.find((item) => item.parameter === 'waveHeight' && item.status === 'available'); return record ? `${Number(record.value).toFixed(4)} ${record.unit ?? 'm'}` : '—' })()}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate('/gis')}
                    className="text-[10px] font-bold text-white bg-slate-900 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-black transition-all shadow-sm"
                  >
                    View Evidence Map <ArrowRight size={12} />
                  </button>
                </div>
              </motion.div>
            )}

            {isRunning && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/70 backdrop-blur-md rounded-[2.5rem] p-12 border border-blue-100 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]"
              >
                <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 animate-spin">
                  <Cpu size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-800">Simulating DAG Stages...</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  No fabricated marine observations are displayed; this pipeline remains simulated.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: PROVENANCE CHAIN */}
        {view === 'agents' && <div className="lg:col-span-12">
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Cpu size={14} /> Simulated Agent Pipeline
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">LATENCY:</span>
                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {totalLatency}ms
                </span>
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {steps.map((step, idx) => {
                const isActive = isRunning && activeStepIndex === idx
                const isDone = activeStepIndex > idx
                return (
                  <ProvenanceStep 
                    key={step.number}
                    number={step.number}
                    title={step.title}
                    time={step.time}
                    detail={step.detail}
                    subtasks={step.subtasks}
                    confidence={step.confidence}
                    isActive={isActive}
                    isDone={isDone}
                    horizontal
                  />
                )
              })}
            </div>
          </div>
        </div>}

      </div>
    </div>
  )
}
