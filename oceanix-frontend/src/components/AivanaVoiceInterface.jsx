import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import {
  Fish,
  MapPin,
  Waves,
  ShieldCheck,
  FileText,
  Compass,
  Keyboard,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { useScenario } from '../context/ScenarioContext'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations'
import AivanaOrb from './AivanaOrb'
import {
  createVoiceRecognitionSession,
  VOICE_STATUS,
  isSpeechRecognitionSupported,
} from '../services/voiceRecognitionService'
import {
  interpretAivanaRequest,
  AIVANA_INTENTS,
} from '../services/aivanaInterpreter'
import { requestBrowserLocation } from '../utils/browserGeolocation'
import {
  formatMarineOperatingLocationDistance,
  getNearbyMarineOperatingLocations,
} from '../utils/marineOperatingLocationUi'

const QUICK_ACTIONS = [
  // LEFT COLUMN
  {
    id: 'fishing',
    title: 'Plan a fishing operation',
    subtitle: 'Check marine conditions and PFZ',
    icon: Fish,
    iconBg: 'bg-blue-50 text-blue-600',
    side: 'left',
    prompt: 'Plan a fishing operation and check marine conditions and PFZ',
    requiresLocation: true,
  },
  {
    id: 'port',
    title: 'Check port conditions',
    subtitle: 'Get latest weather and safety info',
    icon: MapPin,
    iconBg: 'bg-purple-50 text-purple-600',
    side: 'left',
    prompt: 'Check port conditions and latest weather and safety info',
    requiresLocation: true,
  },
  {
    id: 'travel',
    title: 'Assess sea travel',
    subtitle: 'Understand risks and plan routes',
    icon: Waves,
    iconBg: 'bg-cyan-50 text-cyan-600',
    side: 'left',
    prompt: 'Assess sea travel, understand risks and plan routes',
    requiresLocation: true,
  },
  // RIGHT COLUMN
  {
    id: 'safety',
    title: 'Stay safe at sea',
    subtitle: 'Get alerts and advisories',
    icon: ShieldCheck,
    iconBg: 'bg-emerald-50 text-emerald-600',
    side: 'right',
    prompt: 'Stay safe at sea with active alerts and advisories',
    requiresLocation: true,
  },
  {
    id: 'capabilities',
    title: 'What can ORCA do?',
    subtitle: 'Learn about capabilities',
    icon: FileText,
    iconBg: 'bg-indigo-50 text-indigo-600',
    side: 'right',
    prompt: 'What can ORCA do? Explain capabilities',
    requiresLocation: false,
  },
  {
    id: 'explore',
    title: 'Explore the Indian Ocean',
    subtitle: 'Get insights on regions',
    icon: Compass,
    iconBg: 'bg-amber-50 text-amber-600',
    side: 'right',
    prompt: 'Explore the Indian Ocean and get insights on regions',
    requiresLocation: false,
  },
]

// Prominent canonical ports for natural clarification selection
const SUGGESTED_PORTS = [
  'major-port-jawaharlal-nehru',
  'major-port-cochin',
  'major-port-chennai',
  'major-port-mumbai',
  'major-port-deendayal',
  'major-port-mormugao',
]

export default function AivanaVoiceInterface({
  // Integration hooks for connecting to the existing assistant pipeline in target repo:
  interactionState: externalInteractionState,
  assistantMessage: externalAssistantMessage,
  transcript: externalTranscript,
  clarificationQuestion: externalClarificationQuestion,
  errorMessage: externalErrorMessage,
  onVoiceToggle,
  onSubmitQuery,
  onSelectLocation,
  onReset: externalReset,
} = {}) {
  const navigate = useNavigate()
  const {
    selectedOperatingLocation,
    setSelectedOperatingLocation,
    userCoordinates,
    setUserCoordinates,
  } = useScenario()

  // Local state for standalone preview if external props are not provided
  const [localState, setLocalState] = useState('idle') // idle | listening | processing | clarification | ready | error
  const [localTranscript, setLocalTranscript] = useState('')
  const [localClarificationQuestion, setLocalClarificationQuestion] = useState('')
  const [localAssistantMessage, setLocalAssistantMessage] = useState('')
  const [localErrorMessage, setLocalErrorMessage] = useState('')
  const [textInput, setTextInput] = useState('')
  const [pendingPrompt, setPendingPrompt] = useState('')

  // Location discovery state
  const [showLocationOffer, setShowLocationOffer] = useState(!userCoordinates)
  const [locationLoading, setLocationLoading] = useState(false)
  const [showNearbyPorts, setShowNearbyPorts] = useState(false)
  const [destinationNotice, setDestinationNotice] = useState(null)

  const nearbyOperatingLocations = useMemo(
    () => getNearbyMarineOperatingLocations(userCoordinates, MARINE_OPERATING_LOCATIONS),
    [userCoordinates]
  )

  const handleRequestLocation = async () => {
    setLocationLoading(true)
    setLocalErrorMessage('')
    try {
      const coords = await requestBrowserLocation()
      if (setUserCoordinates) {
        setUserCoordinates(coords)
      }
      setLocationLoading(false)
      setShowLocationOffer(false)
      setShowNearbyPorts(true)
      const msg = "I've got your current location. Tell me where you want to go, what you want to do, or how I can help."
      setLocalAssistantMessage(msg)
      setLocalState('ready')
      speak(msg)
    } catch {
      setLocationLoading(false)
      setShowLocationOffer(false)
      const msg = "That's okay. You can still tell me the port or operating area you want to use."
      setLocalAssistantMessage(msg)
      setLocalState('idle')
      speak(msg)
    }
  }

  const handleDismissLocationOffer = () => {
    setShowLocationOffer(false)
    const msg = "That's okay. You can still tell me the port or operating area you want to use."
    setLocalAssistantMessage(msg)
    setLocalState('idle')
  }

  const handleSelectSuggestedPort = (port) => {
    if (onSelectLocation) {
      onSelectLocation(port)
      return
    }
    setSelectedOperatingLocation(port)
    setShowNearbyPorts(false)
    setDestinationNotice(null)
    setLocalState('ready')
    const msg = `Operating location set to ${port.name}. Marine intelligence context ready.`
    setLocalAssistantMessage(msg)
    speak(msg)
  }

  // Determine active state and data (prefer external props when integrated)
  const interactionState = externalInteractionState !== undefined ? externalInteractionState : localState
  const transcript = externalTranscript !== undefined ? externalTranscript : localTranscript
  const clarificationQuestion = externalClarificationQuestion !== undefined ? externalClarificationQuestion : localClarificationQuestion
  const assistantMessage = externalAssistantMessage !== undefined ? externalAssistantMessage : localAssistantMessage
  const errorMessage = externalErrorMessage !== undefined ? externalErrorMessage : localErrorMessage

  const voiceSessionRef = useRef(null)

  // Web Speech Synthesis helper for preview
  const speak = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.0
        utterance.pitch = 1.0
        utterance.lang = 'en-IN'
        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.warn('Speech synthesis error:', err)
      }
    }
  }

  const stopVoiceOutput = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  useEffect(() => {
    return () => {
      stopVoiceOutput()
      if (voiceSessionRef.current) {
        try {
          voiceSessionRef.current.abort()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  // Applies structured interpretation output to UI state
  const applyInterpretationResult = (interpretation) => {
    if (!interpretation) return

    if (interpretation.status === 'CLARIFICATION') {
      setLocalState('clarification')
      setLocalClarificationQuestion(interpretation.clarificationQuestion)
      setLocalAssistantMessage(interpretation.clarificationQuestion)
      speak(interpretation.clarificationQuestion)
      return
    }

    if (interpretation.status === 'READY') {
      setLocalState('ready')
      if (interpretation.resolvedLocation) {
        setSelectedOperatingLocation(interpretation.resolvedLocation)
      }

      if (interpretation.intent === AIVANA_INTENTS.DESTINATION_NAVIGATION) {
        const dest = interpretation.destination
        const destName = dest?.name || 'requested destination'
        const explanation = `Understood: Navigation route to ${destName}. Note that ${destName} has not been set as your active marine operating location.`
        setLocalAssistantMessage(explanation)
        setDestinationNotice(dest)
        speak(explanation)
        return
      }

      if (interpretation.intent === AIVANA_INTENTS.NEARBY_PORTS) {
        if (userCoordinates) {
          setShowNearbyPorts(true)
          const explanation = 'Here are the marine operating locations closest to your current position:'
          setLocalAssistantMessage(explanation)
          speak(explanation)
        } else {
          setShowLocationOffer(true)
          const explanation = 'I can use your current location to suggest nearby ports. May I access your location?'
          setLocalAssistantMessage(explanation)
          speak(explanation)
        }
        return
      }

      let explanation = ''
      switch (interpretation.intent) {
        case AIVANA_INTENTS.FISHING:
          explanation = `Request understood: Fishing operation for ${interpretation.resolvedLocation?.name || 'selected area'}. Marine intelligence context ready.`
          break
        case AIVANA_INTENTS.PORT_MOVEMENT:
          explanation = `Request understood: Port movement at ${interpretation.resolvedLocation?.name || 'selected port'}. Harbour parameters ready.`
          break
        case AIVANA_INTENTS.TRAVEL:
          explanation = `Request understood: Sea travel for ${interpretation.resolvedLocation?.name || 'selected area'}. Marine safety parameters ready.`
          break
        case AIVANA_INTENTS.MARINE_SAFETY:
          explanation = `Request understood: Marine safety & hazard check for ${interpretation.resolvedLocation?.name || 'selected area'}. Ready for review.`
          break
        case AIVANA_INTENTS.ORCA_CAPABILITIES:
          explanation =
            'ORCA is an agentic ocean intelligence platform synthesizing satellite observations, coastal ocean models, weather hazards, and geofencing to protect marine operations.'
          break
        case AIVANA_INTENTS.OCEAN_EXPLORATION:
          explanation =
            'Indian Ocean intelligence monitoring active across the Arabian Sea, Bay of Bengal, and coastal zones.'
          break
        default:
          if (interpretation.resolvedLocation) {
            explanation = `Operating location set to ${interpretation.resolvedLocation.name}. Marine intelligence context ready.`
          } else {
            explanation = `Request understood for ${interpretation.resolvedLocation ? interpretation.resolvedLocation.name : 'Indian Ocean'}. Ready for analysis.`
          }
          break
      }

      setLocalAssistantMessage(explanation)
      speak(explanation)
      return
    }

    setLocalState('idle')
  }

  // Voice Interaction Handler
  const handleOrbClick = () => {
    if (onVoiceToggle) {
      onVoiceToggle()
      return
    }

    stopVoiceOutput()

    if (interactionState === 'listening') {
      if (voiceSessionRef.current) {
        voiceSessionRef.current.stop()
      }
      return
    }

    setLocalErrorMessage('')
    setLocalTranscript('')

    voiceSessionRef.current = createVoiceRecognitionSession({
      lang: 'en-IN',
      interimResults: true,
      continuous: false,
      activeLocation: selectedOperatingLocation,
      onStateChange: (st) => {
        if (st === VOICE_STATUS.LISTENING) setLocalState('listening')
        else if (st === VOICE_STATUS.PROCESSING) setLocalState('processing')
        else if (st === VOICE_STATUS.ERROR) setLocalState('error')
        else if (st === VOICE_STATUS.IDLE) setLocalState('idle')
      },
      onInterimResult: (interimText) => {
        setLocalTranscript(interimText)
      },
      onFinalResult: (finalText) => {
        setLocalTranscript(finalText)
        setPendingPrompt(finalText)
      },
      onInterpretation: (interpretation) => {
        applyInterpretationResult(interpretation)
      },
      onError: (err) => {
        setLocalState('error')
        setLocalErrorMessage(err.message)
      },
    })

    voiceSessionRef.current.start()
  }

  // Unified Assistant Pipeline: Dispatches to external onSubmitQuery or runs standalone interpreter
  const handleAssistantPipeline = (rawQuery, explicitLocation = null) => {
    if (!rawQuery || !rawQuery.trim()) return

    const query = rawQuery.trim()

    // If external assistant pipeline hook is provided, delegate directly
    if (onSubmitQuery) {
      onSubmitQuery(query, explicitLocation)
      return
    }

    // Standalone pipeline: using existing interpretAivanaRequest
    setLocalTranscript(query)
    setPendingPrompt(query)
    setLocalErrorMessage('')
    setLocalState('processing')

    setTimeout(() => {
      const interpretation = interpretAivanaRequest(
        query,
        explicitLocation,
        selectedOperatingLocation
      )
      applyInterpretationResult(interpretation)
    }, 400)
  }

  // Handle location clarification choice
  const handleSelectClarificationLocation = (loc) => {
    if (onSelectLocation) {
      onSelectLocation(loc)
      return
    }
    setSelectedOperatingLocation(loc)
    const interpretation = interpretAivanaRequest(
      pendingPrompt || 'Assess conditions',
      loc,
      null
    )
    applyInterpretationResult(interpretation)
  }

  // Handle Text Submission
  const handleTextSubmit = (e) => {
    e?.preventDefault()
    if (!textInput.trim()) return
    const text = textInput
    setTextInput('')
    handleAssistantPipeline(text)
  }

  // Reset to idle
  const handleReset = () => {
    if (externalReset) {
      externalReset()
      return
    }
    stopVoiceOutput()
    if (voiceSessionRef.current) {
      try {
        voiceSessionRef.current.abort()
      } catch {
        // ignore
      }
    }
    setLocalState('idle')
    setLocalTranscript('')
    setLocalAssistantMessage('')
    setLocalClarificationQuestion('')
    setLocalErrorMessage('')
    setPendingPrompt('')
    setShowNearbyPorts(false)
    setDestinationNotice(null)
  }

  // Filter canonical ports for clarification chips
  const candidatePorts = MARINE_OPERATING_LOCATIONS.filter((loc) =>
    SUGGESTED_PORTS.includes(loc.id)
  )

  const isOrbActive = interactionState !== 'idle'

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 md:mt-4 pb-16">
      {/* 3-Column Hero Layout matching the approved reference image */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-3 items-center">
        {/* LEFT COLUMN: 3 Quick Action Cards */}
        <div className="lg:col-span-3 flex flex-col gap-4 order-2 lg:order-1 max-w-[320px] mx-auto lg:mx-0 w-full lg:items-end">
          {QUICK_ACTIONS.filter((a) => a.side === 'left').map((action) => {
            const Icon = action.icon
            return (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAssistantPipeline(action.prompt)}
                className="bg-white/90 hover:bg-white backdrop-blur-md rounded-[22px] p-3.5 px-4 border border-slate-100/90 shadow-[0_4px_25px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)] hover:border-blue-200 transition-all text-left flex items-center gap-3.5 group cursor-pointer w-full max-w-[310px]"
              >
                <div
                  className={`w-11 h-11 rounded-full ${action.iconBg} flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105`}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors truncate">
                    {action.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight mt-1 truncate">
                    {action.subtitle}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* CENTER COLUMN: Central Glowing Aivana Orb, Input, and CTAs */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2 relative py-2">
          {/* High-fidelity organic flowing multicolor energy ring AivanaOrb */}
          <AivanaOrb
            interactionState={interactionState}
            onClick={handleOrbClick}
          />

          {/* Initial Location Permission Offer (Section 8) */}
          {showLocationOffer && !userCoordinates && interactionState === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md mx-auto mt-3 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-blue-100 shadow-xl shadow-blue-500/5 text-left relative z-20"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <MapPin size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    I can use your current location to suggest nearby ports. May I access your location?
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Browser geolocation is optional and only used for discovering nearby ports.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={handleRequestLocation}
                      disabled={locationLoading}
                      className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <MapPin size={13} /> {locationLoading ? 'Accessing...' : 'Allow Location'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissLocationOffer}
                      disabled={locationLoading}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      Not Now
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Interactive Clarification / Response / Status Dialog Card */}
          <AnimatePresence>
            {(interactionState === 'clarification' ||
              interactionState === 'ready' ||
              interactionState === 'listening' ||
              interactionState === 'processing' ||
              interactionState === 'error' ||
              transcript) && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="w-full max-w-md mx-auto mt-3 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-blue-100 shadow-xl shadow-blue-500/5 text-left relative z-20"
              >
                {/* State badge & transcript row */}
                <div className="mb-2 flex items-start gap-2">
                  {interactionState === 'listening' && (
                    <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                      Listening (en-IN)
                    </span>
                  )}
                  {interactionState === 'processing' && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                      Interpreting
                    </span>
                  )}
                  {interactionState === 'error' && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                      Voice Error
                    </span>
                  )}
                  {(interactionState === 'ready' || interactionState === 'clarification') && (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full shrink-0">
                      Query
                    </span>
                  )}
                  <p className="text-xs text-slate-700 font-medium italic truncate">
                    {transcript
                      ? `"${transcript}"`
                      : interactionState === 'listening'
                        ? 'Listening for speech...'
                        : ''}
                  </p>
                </div>

                {/* Error prompt */}
                {interactionState === 'error' && (
                  <div className="space-y-2 mt-1">
                    <div className="flex items-start gap-2 text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-xs">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                      <div>
                        <p className="font-bold">Voice recognition unavailable</p>
                        <p className="text-[11px] text-rose-600 mt-0.5">
                          {errorMessage || 'Speech recognition encountered an issue. Please use the text input below.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleOrbClick}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={handleReset}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-600 ml-auto flex items-center gap-1"
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing state prompt */}
                {interactionState === 'processing' && (
                  <div className="py-2">
                    <p className="text-xs text-slate-600 font-medium">
                      Interpreting your voice request through Aivana...
                    </p>
                  </div>
                )}

                {/* Clarification prompt */}
                {interactionState === 'clarification' && (
                  <div className="space-y-2 mt-1">
                    <p className="text-xs font-bold text-slate-900">
                      {clarificationQuestion || 'Which operating location should I use?'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Choose an official operating port or select one on the Command Map:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {candidatePorts.map((port) => (
                        <button
                          key={port.id}
                          onClick={() => handleSelectClarificationLocation(port)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-colors"
                        >
                          {port.name.replace(' Port Authority', '')}
                        </button>
                      ))}
                      <Link
                        to="/gis"
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                      >
                        <Compass size={11} /> Pick on GIS Map →
                      </Link>
                    </div>
                  </div>
                )}

                {/* Ready state output */}
                {interactionState === 'ready' && (
                  <div className="space-y-3 mt-1">
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                      {assistantMessage}
                    </p>
                    {destinationNotice && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs">
                        <div className="text-amber-800 min-w-0 flex-1 truncate">
                          <span className="font-bold">Destination:</span> {destinationNotice.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSuggestedPort(destinationNotice)}
                          className="text-[10px] font-bold px-2.5 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shrink-0"
                        >
                          Set as Operating Port
                        </button>
                      </div>
                    )}
                    {showNearbyPorts && nearbyOperatingLocations.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Nearby Marine Operating Locations
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {nearbyOperatingLocations.slice(0, 4).map(({ location, distanceKm }) => (
                            <button
                              key={location.id}
                              type="button"
                              onClick={() => handleSelectSuggestedPort(location)}
                              className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-all group"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="block text-xs font-bold text-slate-800 group-hover:text-blue-700 truncate">
                                  {location.name.replace(' Port Authority', '')}
                                </span>
                                <span className="block text-[10px] text-slate-400 capitalize">
                                  {location.type.replaceAll('_', ' ')}
                                </span>
                              </div>
                              <span className="text-[11px] font-bold text-blue-600 shrink-0 ml-2">
                                {formatMarineOperatingLocationDistance(distanceKm)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedOperatingLocation && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <MapPin size={12} />
                        <span>Active Location: {selectedOperatingLocation.name}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => navigate('/chat')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1"
                      >
                        Proceed to AI Decision Studio <ArrowRight size={12} />
                      </button>
                      <button
                        onClick={() => navigate('/gis')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                      >
                        View on Map
                      </button>
                      <button
                        onClick={handleReset}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-600 ml-auto flex items-center gap-1"
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Text Input Fallback Bar ("Type instead...") */}
          <form
            onSubmit={handleTextSubmit}
            className="w-full max-w-[390px] mx-auto mt-4 bg-white/95 backdrop-blur-md rounded-full px-4 py-2.5 border border-slate-200/90 shadow-[0_4px_25px_rgba(0,0,0,0.04)] flex items-center gap-2.5 relative z-10 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
          >
            <Keyboard size={18} className="text-slate-800 shrink-0 ml-0.5" />
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type instead..."
              className="w-full bg-transparent text-xs md:text-sm text-slate-800 placeholder:text-slate-400 font-medium outline-none"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-90"
              title="Submit query"
            >
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Action Buttons below input */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3.5 relative z-10">
            <Link
              to="/chat"
              className="bg-[#0f172a] hover:bg-black text-white px-7 py-3 rounded-full font-bold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all hover:scale-[1.02] active:scale-95 group"
            >
              Launch AI Decision Studio{' '}
              <span className="text-blue-400 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
            <Link
              to="/gis"
              className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 px-7 py-3 rounded-full font-bold text-xs md:text-sm flex items-center gap-2.5 shadow-sm transition-all hover:scale-[1.02] active:scale-95"
            >
              <Compass size={16} className="text-slate-800" />
              GIS Command Map
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: 3 Quick Action Cards */}
        <div className="lg:col-span-3 flex flex-col gap-4 order-3 max-w-[320px] mx-auto lg:mx-0 w-full lg:items-start">
          {QUICK_ACTIONS.filter((a) => a.side === 'right').map((action) => {
            const Icon = action.icon
            return (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAssistantPipeline(action.prompt)}
                className="bg-white/90 hover:bg-white backdrop-blur-md rounded-[22px] p-3.5 px-4 border border-slate-100/90 shadow-[0_4px_25px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)] hover:border-blue-200 transition-all text-left flex items-center gap-3.5 group cursor-pointer w-full max-w-[310px]"
              >
                <div
                  className={`w-11 h-11 rounded-full ${action.iconBg} flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105`}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors truncate">
                    {action.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight mt-1 truncate">
                    {action.subtitle}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
