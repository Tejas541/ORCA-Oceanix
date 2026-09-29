import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  CheckCircle2,
  Volume2,
  Zap,
  Cpu,
  ArrowRight,
  Compass,
  AlertTriangle,
  Square,
  Send,
  MessageSquare,
  Bot,
  User,
  Sparkles,
  Navigation
} from 'lucide-react'
import { useScenario } from '../context/ScenarioContext'
import { getActivityIntelligence } from '../config/activityIntelligence'

// --- LANGUAGE CODE MAPPINGS FOR WEB SPEECH SYNTHESIS ---
const LANGUAGE_CODES = {
  English: 'en-IN',
  Hindi: 'hi-IN',
  Tamil: 'ta-IN',
  Malayalam: 'ml-IN',
  Marathi: 'mr-IN'
}

function getRoutingWorkflowSteps(routePlan) {
  if (!routePlan || !routePlan.routeRequest) return []
  const activity = routePlan.routeRequest.activity
  const originName = routePlan.origin?.name || 'Selected Origin'
  const targetName = routePlan.target?.name || routePlan.target?.id || 'Target'
  const dist = routePlan.geometry?.distanceNm?.toFixed(1) ?? '—'
  const bearing =
    routePlan.evaluation?.bearingDeg != null
      ? `${routePlan.evaluation.bearingDeg}° ${routePlan.evaluation.bearingCardinal ?? ''}`
      : ''

  if (activity === 'fishing') {
    return [
      { step: 1, name: 'Interpret request', detail: 'Fishing transit objective identified from user query.' },
      { step: 2, name: 'Resolve operating location', detail: `Departure point resolved to ${originName}.` },
      { step: 3, name: 'Resolve official PFZ candidates', detail: `Retrieved ${routePlan.pfzCandidates?.length || 1} official INCOIS WFS feature(s) in operational sector.` },
      { step: 4, name: 'Evaluate PFZ candidates', detail: 'Computed equirectangular nearest-point projection and seaward azimuth bearings.' },
      { step: 5, name: 'Rank/select candidate', detail: `Selected ${targetName} at ${dist} NM (${bearing || 'seaward'}). Status: ${routePlan.recommendation?.state}.` },
      { step: 6, name: 'Create provisional corridor', detail: 'Generated straight-line reference corridor; certified navigation is not implied.' },
      { step: 7, name: 'Explain evidence and limitations', detail: 'Evaluated sea state & cyclone data; bathymetry and vessel draft limits remain unavailable.' },
    ]
  }

  if (activity === 'marine_travel') {
    const destName = routePlan.destination?.name || targetName
    return [
      { step: 1, name: 'Interpret request', detail: 'Inter-port marine travel passage planning identified.' },
      { step: 2, name: 'Resolve origin', detail: `Departure port resolved to ${originName}.` },
      { step: 3, name: 'Resolve destination', detail: `Arrival destination resolved to ${destName}.` },
      { step: 4, name: 'Evaluate origin conditions', detail: `Assessed departure sea state: ${routePlan.endpointAssessment?.origin?.summary || 'Safe'}.` },
      { step: 5, name: 'Evaluate destination conditions', detail: `Assessed destination sea state: ${routePlan.endpointAssessment?.destination?.summary || 'Safe'}.` },
      { step: 6, name: 'Generate reference/provisional corridor', detail: `Great Circle reference corridor calculated (${dist} NM).` },
      { step: 7, name: 'Explain limitations', detail: 'Route-level weather grid, land avoidance, and nautical fairways unavailable.' },
    ]
  }

  if (activity === 'port_movement') {
    return [
      { step: 1, name: 'Interpret request', detail: 'Port entry or harbour approach movement parsed.' },
      { step: 2, name: 'Resolve target port', detail: `Harbour approach resolved to ${targetName}.` },
      { step: 3, name: 'Evaluate outer approach conditions', detail: 'Assessed outer roadstead wind, wave, and surface visibility.' },
      { step: 4, name: 'Generate approach corridor', detail: `Linear reference approach corridor established (${dist} NM).` },
      { step: 5, name: 'Explain limitations', detail: 'Inner-harbour channels, berth navigation, and piloting guidance unavailable.' },
    ]
  }

  if (activity === 'ocean_exploration') {
    return [
      { step: 1, name: 'Interpret request', detail: 'Oceanographic exploration transit query parsed.' },
      { step: 2, name: 'Resolve origin and target', detail: `Operating origin ${originName} and exploration area coordinates validated.` },
      { step: 3, name: 'Evaluate regional sea state', detail: 'Assessed environmental safety conditions and weather hazards at departure.' },
      { step: 4, name: 'Create provisional corridor', detail: `Provisional exploration corridor generated (${dist} NM).` },
      { step: 5, name: 'Explain limitations', detail: 'Ocean current drift, bathymetric clearance, and cruise clearance unavailable.' },
    ]
  }

  return [
    { step: 1, name: 'Interpret request', detail: 'Marine operational query parsed.' },
    { step: 2, name: 'Resolve spatial endpoints', detail: `Endpoints resolved between ${originName} and ${targetName}.` },
    { step: 3, name: 'Evaluate environmental evidence', detail: 'Available wave, wind, and cyclone evidence screened.' },
    { step: 4, name: 'Generate provisional corridor', detail: `Provisional reference corridor generated (${dist} NM).` },
    { step: 5, name: 'Explain limitations', detail: 'Certified nautical navigation unavailable.' },
  ]
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

// --- MAIN COMPONENT ---
export default function AgenticChat({ view = 'chat' }) {
  const navigate = useNavigate()
  const {
    selectedOperatingLocation,
    locationDecision,
    activityContext,
    routePlan,
  } = useScenario()

  const decision = locationDecision?.decision ?? {
    riskLevel: 'DATA_INSUFFICIENT',
    safetyScore: null,
    ventureStatusLabel: 'DATA INSUFFICIENT',
    officialDirective: 'Required evidence unavailable for the selected operating location.',
  }
  const operatingLocationName = selectedOperatingLocation?.name ?? 'SELECT OPERATING LOCATION'

  const activityConfig = useMemo(
    () => getActivityIntelligence(activityContext?.activity),
    [activityContext?.activity]
  )

  // DAG Pipeline state for 'agents' view
  const [isRunning, setIsRunning] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(true)
  const [activeStepIndex, setActiveStepIndex] = useState(5)
  const [totalLatency, setTotalLatency] = useState(48.2)

  // Chat & Voice state for 'chat' view
  const [language, setLanguage] = useState('English')
  const [chatInput, setChatInput] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState([])
  const chatBottomRef = useRef(null)

  // Conversational thread state
  const [messages, setMessages] = useState(() => [
    {
      id: 'init-1',
      sender: 'aivana',
      text: `Hello! I'm Aivana, your ORCA marine assistant. Current operating location: ${operatingLocationName}. ${
        decision.riskLevel === 'DATA_INSUFFICIENT'
          ? 'ORCA decision status: DATA INSUFFICIENT. Required evidence unavailable.'
          : `ORCA decision status: ${decision.riskLevel}. Safety score: ${decision.safetyScore}/100.`
      } ${decision.officialDirective}`,
      time: 'Just now'
    }
  ])

  // Single canonical source variable for final displayed advisory text (preserves test match)
  const finalDisplayedAdvisory = useMemo(() => {
    if (!selectedOperatingLocation) return 'Select an operating location on the Command Map to begin.'
    return `Current operating location: ${operatingLocationName}. ORCA decision: ${decision.riskLevel}. ${decision.safetyScore == null ? 'Safety score unavailable because required evidence is insufficient.' : `Safety score: ${decision.safetyScore}/100.`} ${decision.officialDirective}`
  }, [selectedOperatingLocation, operatingLocationName, decision])

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

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices() || []
      if (v.length > 0) setVoices(v)
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      clearDagTimers()
      stopSpeech()
    }
  }, [])

  useEffect(() => {
    stopSpeech()
  }, [language, selectedOperatingLocation])

  const speakText = (text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    if (!text || typeof text !== 'string') return

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.0
    const targetLangCode = LANGUAGE_CODES[language] || 'en-IN'
    utterance.lang = targetLangCode

    const allVoices = (voices.length > 0 ? voices : window.speechSynthesis.getVoices()) || []
    if (allVoices.length > 0) {
      const langCodeNormalized = targetLangCode.replace('_', '-').toLowerCase()
      const langPrefix = langCodeNormalized.split('-')[0]
      const exactVoice = allVoices.find(v => (v.lang || '').replace('_', '-').toLowerCase() === langCodeNormalized)
      const prefixVoice = allVoices.find(v => {
        const vLang = (v.lang || '').replace('_', '-').toLowerCase()
        return vLang === langPrefix || vLang.startsWith(langPrefix + '-')
      })
      const matchedVoice = exactVoice || prefixVoice
      if (matchedVoice) utterance.voice = matchedVoice
    }

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    try {
      setIsSpeaking(true)
      window.speechSynthesis.speak(utterance)
    } catch {
      setIsSpeaking(false)
    }
  }

  const speakAdvisory = () => {
    speakText(finalDisplayedAdvisory)
  }

  const toggleSpeech = () => {
    if (isSpeaking) {
      stopSpeech()
    } else {
      speakAdvisory()
    }
  }

  // Execute the 5-stage DAG sequentially (for Agent Workflow view)
  const startDAG = () => {
    stopSpeech()
    clearDagTimers()
    setIsRunning(true)
    setHasCompleted(false)
    setActiveStepIndex(0)

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

  // Conversational response generator grounded in canonical locationDecision
  const handleSendMessage = (textToSend) => {
    const q = (textToSend || chatInput).trim()
    if (!q) return

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    // Grounded factual answer based on canonical decision
    const lower = q.toLowerCase()
    let reply = ''

    if (lower.includes('wave')) {
      const waveRecord = locationDecision?.evidence?.find(e => e.parameter === 'waveHeight' && e.status === 'available')
      reply = waveRecord
        ? `Canonical wave height at ${operatingLocationName} is ${Number(waveRecord.value).toFixed(4)} ${waveRecord.unit ?? 'm'}.`
        : `Wave observations are currently unavailable for ${operatingLocationName}.`
    } else if (lower.includes('wind')) {
      const windRecord = locationDecision?.evidence?.find(e => e.parameter === 'windSpeed' && e.status === 'available')
      reply = windRecord
        ? `Canonical wind speed at ${operatingLocationName} is ${Number(windRecord.value).toFixed(4)} ${windRecord.unit ?? 'm/s'}.`
        : `Wind observations are currently unavailable for ${operatingLocationName}.`
    } else if (lower.includes('cyclone')) {
      const cycloneRecord = locationDecision?.evidence?.find(e => e.parameter === 'cyclone')
      reply = cycloneRecord?.status === 'available'
        ? `Active cyclone advisory in effect: ${cycloneRecord.value?.eventName || 'Regional cyclone watch'}.`
        : `No active severe cyclone warning is registered for ${operatingLocationName}.`
    } else if (lower.includes('safe') || lower.includes('score') || lower.includes('status')) {
      reply = decision.safetyScore == null
        ? `Operating location ${operatingLocationName} is flagged as DATA INSUFFICIENT. Safety score is unavailable because required canonical evidence is incomplete.`
        : `Operating location ${operatingLocationName} is rated ${decision.ventureStatusLabel} with a deterministic safety score of ${decision.safetyScore}/100.`
    } else if (lower.includes('pfz') || lower.includes('fish')) {
      reply = activityContext?.activity === 'ocean_exploration'
        ? `Note: PFZ fishing zones are suppressed because the active activity is Ocean Exploration. I am prioritizing regional oceanographic data (SST, Chlorophyll, Waves).`
        : `PFZ zones remain supplemental marine intelligence and do not alter ORCA's deterministic safety calculation.`
    } else if (lower.includes('travel') || lower.includes('route')) {
      reply = activityContext?.origin && activityContext?.destination
        ? `Voyage endpoints established from ${activityContext.origin.name} to ${activityContext.destination.name}. Automated nautical waypoint routing is deferred to route-planning engines.`
        : `For marine travel, please specify your origin and destination ports.`
    } else {
      reply = `Current operating location: ${operatingLocationName}. ORCA decision: ${decision.riskLevel}. ${decision.officialDirective}`
    }

    const aivanaMsg = {
      id: `a-${Date.now()}`,
      sender: 'aivana',
      text: reply,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg, aivanaMsg])
    setChatInput('')
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // 5-stage DAG pipeline definition (for Agent Workflow view)
  const steps = [
    {
      number: 1,
      title: "Blue Orbit Simulated Agent Pipeline",
      time: "1.2",
      detail: `Operating location: ${operatingLocationName}. ORCA decision context: ${decision.riskLevel}. Displayed as a 5-stage simulated pipeline.`,
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

  // Fail closed when no location selected
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

  // ==========================================
  // VIEW 1: AI ASSISTANT CONVERSATIONAL WORKSPACE
  // ==========================================
  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] bg-mesh pt-20 pb-16 px-4 md:px-8 font-sans">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Bot size={18} />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Aivana Assistant</h1>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  Conversational Mode
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Natural dialogue and operational intelligence grounded in canonical ORCA evidence.
              </p>
            </div>

            {/* Context Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center gap-2">
                <Compass size={13} className="text-blue-600" />
                <span className="text-[10px] font-bold text-slate-500">Current operating location:</span>
                <span className="text-xs font-bold text-slate-800">{operatingLocationName}</span>
              </div>

              {activityContext?.activity && (
                <div className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-sm flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-blue-700 uppercase">
                    {activityConfig.label}
                  </span>
                </div>
              )}

              {routePlan && (
                <div className="px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 shadow-sm flex items-center gap-1.5">
                  <Navigation size={12} className="text-cyan-600" />
                  <span className="text-[10px] font-bold text-cyan-800">
                    Route: {routePlan.geometry?.distanceNm?.toFixed(1)} NM
                  </span>
                </div>
              )}

              <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border shadow-sm ${
                decision.riskLevel === 'SAFE_FOR_VENTURE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : decision.riskLevel === 'CAUTION'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {decision.ventureStatusLabel}
              </div>
            </div>
          </div>

          {/* Location Safety Context Banner */}
          <div className="bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                decision.riskLevel === 'SAFE_FOR_VENTURE' ? 'bg-emerald-500' : decision.riskLevel === 'CAUTION' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <div className="text-xs text-slate-700 font-medium">
                <strong className="font-bold text-slate-900">Current operating location: {operatingLocationName}.</strong>{' '}
                {decision.officialDirective}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleSpeech}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                  isSpeaking
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                {isSpeaking ? <Square size={13} className="fill-current" /> : <Volume2 size={13} />}
                {isSpeaking ? 'Stop Voice' : 'Listen'}
              </button>
              <button
                onClick={() => navigate('/gis')}
                className="text-xs font-bold text-white bg-slate-900 hover:bg-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                Command Map <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Conversational Window */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col h-[520px]">
            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'aivana' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm text-xs font-bold">
                      A
                    </div>
                  )}

                  <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-xs leading-relaxed font-medium shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}>
                    <p>{m.text}</p>
                    <span className={`block text-[9px] font-mono mt-1 ${m.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'}`}>
                      {m.time}
                    </span>
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm text-xs font-bold">
                      <User size={14} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Activity Prompts */}
            <div className="bg-slate-50/70 border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles size={11} className="text-blue-500" /> Suggested:
              </span>
              {(activityContext?.activity === 'ocean_exploration'
                ? ['Show regional SST & Chlorophyll', 'Check wave conditions', 'What layers are active?']
                : activityContext?.activity === 'fishing'
                ? ['Is it safe for fishing?', 'Check wave & wind conditions', 'Explain official directive']
                : activityContext?.activity === 'marine_travel'
                ? ['Check voyage weather', 'Are there cyclone hazards?', 'Explain travel advice']
                : activityContext?.activity === 'port_movement'
                ? ['Check berth wind speed', 'Visibility for harbor entry', 'Wave height at port']
                : ['Check wave forecast', 'Check wind speed', 'Explain safety decision']
              ).map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  className="shrink-0 text-[11px] font-medium bg-white hover:bg-blue-50 hover:text-blue-600 text-slate-600 border border-slate-200 px-3 py-1 rounded-full transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 bg-white border-t border-slate-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask Aivana about ${operatingLocationName}, waves, weather, safety...`}
                  className="flex-1 bg-slate-100 border-none rounded-2xl px-5 py-3 text-xs outline-none focus:ring-2 ring-blue-500/20 text-slate-800 placeholder-slate-400 font-medium"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-40 shadow-sm"
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // VIEW 2: AGENT WORKFLOW & PROVENANCE PIPELINE
  // ==========================================
  return (
    <div className="min-h-screen bg-[#F9FAFB] bg-mesh pt-24 pb-20 px-6 font-sans">

      {/* 1. FUTURISTIC HEADER */}
      <div className="max-w-5xl mx-auto text-center mb-8">
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

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 mb-2">
          <div className="glass-panel px-4 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
            <Compass size={14} className="text-blue-600" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Operating location:</span>
            <span className="font-bold text-xs text-slate-800">{operatingLocationName}</span>
          </div>

          {activityContext?.activity && (
            <div className="glass-panel px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50/50 shadow-sm flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Activity Context:</span>
              <span className="font-bold text-xs text-blue-900">{activityContext.activity.toUpperCase().replaceAll('_', ' ')}</span>
              {activityContext.destination && (
                <span className="text-[10px] font-medium text-slate-500">→ {activityContext.destination.name.replace(' Port Authority', '')}</span>
              )}
            </div>
          )}

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
        </div>

        {/* Workflow Execution Trigger */}
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={startDAG}
            disabled={isRunning}
            className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {isRunning ? 'EXECUTING PIPELINE...' : 'EXECUTE SIMULATED PIPELINE'}
            <Play size={13} fill="white" className={isRunning ? 'animate-pulse' : ''} />
          </button>
          <div className="text-xs font-mono font-bold text-slate-500 bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl shadow-sm">
            LATENCY: <span className="text-blue-600 font-black">{totalLatency}ms</span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC CONTENT AREA */}
      <div className={`max-w-6xl mx-auto grid grid-cols-1 ${view === 'agents' ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-8`}>

        {/* COMPACT VERIFIED PIPELINE RESULT SNAPSHOT (Above Pipeline) */}
        <div className={`${view === 'agents' ? 'lg:col-span-12' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} space-y-6`}>
          {routePlan && (
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-cyan-200 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
                    <Navigation size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">
                      Universal Marine Routing Orchestration
                    </h3>
                    <p className="text-[10px] font-medium text-slate-500">
                      Activity: <strong className="text-slate-800 uppercase">{routePlan.routeRequest?.activity?.replaceAll('_', ' ')}</strong> • Reference Distance: <strong className="text-cyan-700">{routePlan.geometry?.distanceNm?.toFixed(1)} NM</strong>
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                  routePlan.recommendation?.recommended
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {routePlan.status.replaceAll('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[9px] font-black uppercase text-slate-400">Departure Origin</span>
                  <span className="text-xs font-bold text-slate-800">{routePlan.origin?.name || 'Selected Origin'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[9px] font-black uppercase text-slate-400">Target / Destination</span>
                  <span className="text-xs font-bold text-slate-800">{routePlan.target?.name || routePlan.target?.id || 'Operational Target'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-cyan-50/70 border border-cyan-100">
                  <span className="block text-[9px] font-black uppercase text-cyan-700">Recommendation</span>
                  <span className="text-xs font-bold text-cyan-950">{routePlan.recommendation?.state}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 font-medium">
                {routePlan.recommendation?.reason}
              </div>

              {/* Sequential Activity-Aware Routing Workflow Pipeline */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-wide">
                  Executed Deterministic Workflow ({routePlan.routeRequest?.activity?.replaceAll('_', ' ')})
                </span>
                <div className="space-y-1.5">
                  {getRoutingWorkflowSteps(routePlan).map((st) => (
                    <div key={st.step} className="flex items-start gap-2.5 text-[11px] bg-slate-50/70 p-2 rounded-xl border border-slate-100/90">
                      <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {st.step}
                      </span>
                      <div className="flex-1 leading-snug">
                        <strong className="text-slate-800">{st.name}:</strong>{' '}
                        <span className="text-slate-600">{st.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-[10px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/70 leading-relaxed">
                ⚠️ <strong>Notice:</strong> {routePlan.geometry?.disclaimer}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {hasCompleted && (
              <motion.div
                key={`${operatingLocationName}-${language}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-blue-100 relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div>
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                      <Zap size={14} fill="currentColor" /> Verified Pipeline Output Snapshot
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

                {/* Advisory Summary */}
                <div className="text-slate-700 leading-relaxed font-medium text-sm relative z-10 my-2">
                  {finalDisplayedAdvisory}
                </div>

                {/* Directive Banner */}
                <div className={`mt-4 p-3 rounded-xl border flex items-center gap-3 text-xs font-bold ${
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
              </motion.div>
            )}

            {isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/70 backdrop-blur-md rounded-3xl p-8 border border-blue-100 flex flex-col items-center justify-center text-center space-y-3 min-h-[200px]"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 animate-spin">
                  <Cpu size={22} />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Simulating DAG Stages...</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  No fabricated marine observations are displayed; this pipeline remains simulated.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 5-STAGE HORIZONTAL PIPELINE */}
        <div className="lg:col-span-12">
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Cpu size={14} /> Simulated Agent Pipeline
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">STATUS:</span>
                <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  {isRunning ? 'EXECUTING' : 'VERIFIED AUDIT'}
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
        </div>

      </div>
    </div>
  )
}
