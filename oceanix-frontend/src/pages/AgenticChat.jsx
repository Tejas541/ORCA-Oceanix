import React, { useState, useEffect, useRef, useMemo } from 'react'
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

// --- MULTILINGUAL ADVISORY STRINGS ---
const ADVISORY_TRANSLATIONS = {
  kochi: {
    English: "Demo simulation: This five-stage pipeline summarizes the Kochi scenario. At Kochi Fishing Harbour (9.9312°N, 76.2673°E), sea conditions are moderate with waves of 1.03m and wind of 14.9 kts. The safety score for sea-venture is 74.2/100 (SAFE FOR VENTURE). The Alleppey Thermal Front is approximately 69.9 km away, bearing 257° (WSW), indicating high suitability for Oil Sardine fishing. You are currently 176.25 NM away from the demo IMBL line, maintaining safe operational compliance.",
    Hindi: "डेमो सिमुलेशन: यह पांच-चरण पाइपलाइन कोच्चि परिदृश्य का सारांश है। कोच्चि मत्स्य बंदरगाह (9.9312°N, 76.2673°E) पर समुद्र की स्थिति सामान्य है (लहरें: 1.03m, हवा: 14.9 kts WNW)। सुरक्षा सूचकांक 74.2/100 (सुरक्षित) है। अल्लेप्पी थर्मल फ्रंट लगभग 69.9 किमी दूर (257° WSW) स्थित है, जो तारली (Oil Sardine) मछली पकड़ने के लिए अत्यधिक अनुकूल है। IMBL से दूरी 176.25 NM है और समुद्री सीमा नियमों का पूर्ण पालन हो रहा है।",
    Tamil: "டெமோ சிமுலேஷன்: இது கொச்சி சூழலுக்கான ஐந்து-நிலை சுருக்கம். கொச்சி மீன்பிடி துறைமுகத்தில் (9.9312°N, 76.2673°E) கடல் நிலை சீராக உள்ளது (அலை: 1.03 மீ, காற்று: 14.9 நாட்ஸ்). பாதுகாப்பு குறியீடு 74.2/100 (பாதுகாப்பானது). ஆலப்புழா தெர்மல் ஃப்ரண்ட் 69.9 கி.மீ தொலைவில் உள்ளது, இது மத்தி மீன் பிடிப்பதற்கு மிகவும் ஏற்றது. IMBL எல்லை வரை 176.25 NM தொலைவில் பாதுகாப்பாக இயங்கலாம்.",
    Malayalam: "ഡെമോ സിമുലേഷൻ: ഇത് കൊച്ചി സാഹചര്യത്തിന്റെ അഞ്ച്-ഘട്ട സംഗ്രഹമാണ്. കൊച്ചി ഫിഷിംഗ് ഹാർബറിൽ (9.9312°N, 76.2673°E) കടൽ ശാന്തമാണ് (തിരമാല: 1.03 മീറ്റർ, കാറ്റ്: 14.9 നോട്ട്സ് WNW). സുരക്ഷാ സ്കോർ 74.2/100 (കടലിൽ പോകാൻ സുരക്ഷിതം). ആലപ്പുഴ തെർമൽ ഫ്രണ്ട് 69.9 കി.മീ അകലെയാണ് (257° WSW), മത്തി ലഭ്യതയ്ക്ക് ഏറ്റവും അനുയോജ്യം. IMBL അതിർത്തിയിൽ നിന്നും 176.25 NM അകലം പാലിച്ച് സുരക്ഷിതമായി തുടരുന്നു.",
    Marathi: "डेमो सिम्युलेशन: हा कोची परिस्थितीचा पाच-टप्प्यातील सारांश आहे. कोची मत्स्यव्यवसाय बंदरावर (९.९३१२°N, ७६.२६७३°E) समुद्राची स्थिती सामान्य असून लाटा १.०३m आणि वारा १४.९ kts WNW आहे. सागरी सफरीसाठी सुरक्षा निर्देशांक ७४.२/१०० (सुरक्षित) आहे. अलेप्पी थर्मल फ्रंट सुमारे ६९.९ किमी अंतरावर (२५७° WSW) असून तारली (Oil Sardine) मासेमारीसाठी अत्यंत अनुकूल आहे. IMBL सीमारेषेपासून १७६.२५ NM सुरक्षित अंतर राखले गेले आहे."
  },
  chennai: {
    English: "Demo simulation: This five-stage pipeline summarizes the Chennai scenario. At Chennai Fishing Harbour (13.124°N, 80.297°E), sea conditions are moderate to rough with waves of 1.85m and wind of 18.4 kts ENE. The safety score is 61.5/100 (CAUTION — SHORT TRIPS ONLY). The Pulicat Shelf Front is approximately 48 km away (bearing 52° NE). Note that lightning risk is elevated at 41%. Remain outside the 15 NM demo IMBL buffer toward Palk Strait (92 NM). Daylight coastal operations only.",
    Hindi: "डेमो सिमुलेशन: यह पांच-चरण पाइपलाइन चेन्नई परिदृश्य का सारांश है। चेन्नई मत्स्य बंदरगाह (13.124°N, 80.297°E) पर समुद्र मध्यम से अशांत है (लहरें: 1.85m, हवा: 18.4 kts ENE)। सुरक्षा स्कोर 61.5/100 (सावधानी — केवल छोटी यात्राएं) है। पुलिकट शेल्फ फ्रंट 48 किमी दूर है। बिजली गिरने का जोखिम 41% है। पाक जलडमरूमध्य के पास IMBL बफर जोन से बाहर रहें। केवल दिन के समय तटीय संचालन की अनुमति है।",
    Tamil: "டெமோ சிமுலேஷன்: இது சென்னை சூழலுக்கான ஐந்து-நிலை சுருக்கம். சென்னை துறைமுக பகுதியில் (13.124°N, 80.297°E) கடல் எச்சரிக்கை நிலையில் உள்ளது (அலை: 1.85 மீ, காற்று: 18.4 நாட்ஸ்). பாதுகாப்பு குறியீடு 61.5/100 (எச்சரிக்கை — குறுகிய பயணங்கள் மட்டும்). பலவேற்காடு முன் பகுதி 48 கி.மீ தொலைவில் உள்ளது. மின்னல் அபாயம் 41% உள்ளதால் குறுகிய பகல் நேர பயணங்கள் மட்டுமே பரிந்துரைக்கப்படுகிறது. பாக் நீரிணை IMBL எல்லையில் இருந்து 92 NM விலகி இருக்கவும்.",
    Malayalam: "ഡെമോ സിമുലേഷൻ: ഇത് ചെന്നൈ സാഹചര്യത്തിന്റെ അഞ്ച്-ഘട്ട സംഗ്രഹമാണ്. ചെന്നൈ ഹാർബറിൽ (13.124°N, 80.297°E) കടൽ പ്രക്ഷുബ്ധമാണ് (തിരമാല: 1.85 മീറ്റർ, കാറ്റ്: 18.4 നോട്ട്സ്). സുരക്ഷാ സ്കോർ 61.5/100 (ജാഗ്രത — ചെറിയ ദൂര യാത്രകൾ മാത്രം). പുലിക്കാട്ട് ഫ്രണ്ട് 48 കി.മീ അകലെയാണ്. ഇടിമിന്നൽ സാധ്യത 41% ഉള്ളതിനാൽ തീരപ്രദേശങ്ങളിൽ പകൽ സമയത്ത് മാത്രം യാത്ര ചെയ്യുക. IMBL അതിർത്തിയിൽ ജാഗ്രത പാലിക്കുക.",
    Marathi: "डेमो सिम्युलेशन: हा चेन्नई परिस्थितीचा पाच-टप्प्यातील सारांश आहे. चेन्नई मत्स्यव्यवसाय बंदरावर (१३.१२४°N, ८०.२९७°E) समुद्रात मध्यम ते तीव्र लाटा आहेत (लाटा: १.८५m, वारा: १८.४ kts ENE). सुरक्षा निर्देशांक ६१.५/१०० (सावधानता — केवळ लहान फेऱ्या) आहे. पुलिकट शेल्फ फ्रंट सुमारे ४८ किमी अंतरावर आहे. विजांचा धोका ४१% पर्यंत वाढलेला आहे. पाक सामुद्रधुनीजवळील १५ NM IMBL बफर क्षेत्रात जाणे टाळा. केवळ दिवसा किनारी मासेमारीची परवानगी आहे."
  },
  'bay-of-bengal': {
    English: "DEMO HAZARD SCENARIO! This simulated five-stage pipeline summarizes a Bay of Bengal cyclone scenario. Safety score: 28/100 (UNSAFE — NO VENTURE). Significant wave heights are 3.4m with gale winds reaching 34 kts NNE and poor visibility (2 NM). Cloud cover is 82% and lightning risk is 68%. PFZ recommendations are withheld in this demo scenario. Return-to-harbour guidance is simulated.",
    Hindi: "डेमो खतरा परिदृश्य! यह सिमुलेटेड पांच-चरण पाइपलाइन बंगाल की खाड़ी के चक्रवात परिदृश्य का सारांश है। सुरक्षा स्कोर: 28/100 (असुरक्षित — समुद्र में न जाएं)। 3.4m ऊंची तूफानी लहरें, 34 kts की तेज हवाएं और खराब दृश्यता (2 NM) दर्ज की गई है। इस डेमो परिदृश्य में मत्स्य सलाह स्थगित है और बंदरगाह लौटने का मार्गदर्शन सिमुलेटेड है।",
    Tamil: "டெமோ ஆபத்து சூழல்! இது வங்காள விரிகுடா புயல் சூழலுக்கான சிமுலேஷன் சுருக்கம். பாதுகாப்பு குறியீடு: 28/100 (ஆபத்தானது — கடலுக்கு செல்ல வேண்டாம்). அலைகள் 3.4 மீ உயரம் வரை எழும்புகின்றன, காற்றின் வேகம் 34 நாட்ஸ் NNE. இந்த டெமோ சூழலில் மீன்பிடி பரிந்துரைகள் நிறுத்தப்பட்டுள்ளன; துறைமுகத்திற்கு திரும்பும் வழிகாட்டுதல் சிமுலேட்டானது.",
    Malayalam: "ഡെമോ അപകട സാഹചര്യം! ഇത് ബംഗാൾ ഉൾക്കടൽ ചുഴലിക്കാറ്റ് സാഹചര്യത്തിന്റെ സിമുലേഷൻ സംഗ്രഹമാണ്. സുരക്ഷാ സ്കോർ: 28/100 (അപകടകരം — കടലിൽ പോകരുത്). തിരമാലകൾ 3.4 മീറ്ററും കാറ്റിന്റെ വേഗത 34 നോട്ട്സും കവിയുന്നു. ഈ ഡെമോ സാഹചര്യത്തിൽ ഫിഷിംഗ് നിർദ്ദേശങ്ങൾ നിർത്തിവെച്ചിരിക്കുന്നു; തുറമുഖത്തേക്ക് മടങ്ങാനുള്ള മാർഗനിർദ്ദേശം സിമുലേറ്റഡാണ്.",
    Marathi: "डेमो धोका परिस्थिती! हा बंगालच्या उपसागरातील चक्रीवादळ परिस्थितीचा सिम्युलेशन सारांश आहे. सुरक्षा निर्देशांक: २८/१०० (असुरक्षित — समुद्रात जाऊ नये). ३.४m उंचीच्या लाटा आणि ३४ kts वेगाचे वादळी वारे वाहत असून दृश्यमानता कमी (२ NM) आहे. या डेमो परिस्थितीत मत्स्य सल्ला थांबवला आहे आणि बंदरावर परतण्याचे मार्गदर्शन सिम्युलेटेड आहे."
  }
}

// --- SUB-COMPONENT: PROVENANCE STEP ---
const ProvenanceStep = ({ number, title, time, detail, subtasks, isActive, isDone, confidence }) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: number * 0.1 }}
    className="relative pl-10 pb-7 last:pb-0"
  >
    {/* Connector Line */}
    <div className={`absolute left-[15px] top-0 bottom-0 w-px transition-colors duration-500 last:hidden ${
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
  const { selectedScenarioId, selectedScenario: scenario, setSelectedScenarioId, scenarios, defaultScenarioId } = useScenario()

  const [isRunning, setIsRunning] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(true) // Start completed with initial scenario
  const [activeStepIndex, setActiveStepIndex] = useState(5) // 0-indexed, 5 means all 5 done
  const [language, setLanguage] = useState('English')
  const [query, setQuery] = useState('What are the sea conditions, PFZ suitability, and IMBL distance today?')
  const [totalLatency, setTotalLatency] = useState(48.2)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState([])

  // --- 1. SINGLE CANONICAL SOURCE VARIABLE FOR FINAL DISPLAYED ADVISORY TEXT ---
  const finalDisplayedAdvisory = useMemo(() => {
    const scenarioAdvisories = ADVISORY_TRANSLATIONS[selectedScenarioId] || ADVISORY_TRANSLATIONS[defaultScenarioId]
    return scenarioAdvisories[language] || scenarioAdvisories['English']
  }, [selectedScenarioId, language, defaultScenarioId])

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
  }, [selectedScenarioId, language])

  // Auto-detect scenario if query contains scenario keywords
  const handleQueryChange = (newQuery) => {
    setQuery(newQuery)
    const q = newQuery.toLowerCase()
    if (q.includes('chennai') || q.includes('pulicat')) {
      setSelectedScenarioId('chennai')
    } else if (q.includes('bay of bengal') || q.includes('cyclone') || q.includes('mizan')) {
      setSelectedScenarioId('bay-of-bengal')
    } else if (q.includes('kochi') || q.includes('sardine') || q.includes('alleppey')) {
      setSelectedScenarioId('kochi')
    }
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
  const startDAG = (scenarioIdToRun = selectedScenarioId) => {
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

  // Handle switching scenario from dropdown or chips
  const handleScenarioSwitch = (newId) => {
    stopSpeech()
    setSelectedScenarioId(newId)
    const defaultHints = {
      kochi: 'What are the sea conditions, PFZ suitability, and IMBL distance today?',
      chennai: 'Is it safe to venture from Chennai harbour with current lightning and wind?',
      'bay-of-bengal': 'What is the cyclone alert and wave warning in the Bay of Bengal?'
    }
    setQuery(defaultHints[newId] || 'What are sea conditions and PFZ coordinates?')
    startDAG(newId)
  }

  // Agent Steps Data derived from active scenario
  const getAgentSteps = () => {
    return [
      {
        number: 1,
        title: "Blue Orbit Simulated Agent Pipeline",
        time: "1.2",
        detail: `Target Region: ${scenario.region}. Demo query categories: 'pfz_discovery, hazard_assessment, imbl_geofence'. Displayed as a 5-stage simulated pipeline.`,
        subtasks: ["5-stage execution plan formulated", `Harbour: ${scenario.harbour.name}`],
        confidence: 99.8
      },
      {
        number: 2,
        title: "Simulated Marine EO Data Stage",
        time: "8.4",
        detail: `Loaded simulated Oceansat-3-style chlorophyll (${scenario.oceanParameters.chlorophyll} mg/m³) and INSAT-3DR-style SST (${scenario.oceanParameters.sst}°C) values. Cloud cover: ${scenario.oceanParameters.cloudCoverPercent}%.`,
        subtasks: ["Simulated satellite-style inputs", "Fixture data status shown"],
        confidence: 99.1
      },
      {
        number: 3,
        title: "Weather & Marine Hazard Stage",
        time: "6.9",
        detail: `Wave Height: ${scenario.oceanConditions.waveHeight}m, Wind: ${scenario.oceanConditions.windSpeed} kts (${scenario.oceanConditions.windDirection}). Lightning: ${scenario.oceanConditions.lightningRiskPercent}%. Status: ${scenario.risk.riskLevel}.`,
        subtasks: [scenario.risk.ventureStatusLabel, scenario.cyclone.active ? `Warning: ${scenario.cyclone.name}` : "No active cyclone threat"],
        confidence: 97.5
      },
      {
        number: 4,
        title: "PFZ Scenario Stage",
        time: "14.2",
        detail: scenario.risk.riskLevel === 'UNSAFE_NO_VENTURE'
          ? `PFZ recommendation withheld. Cyclone ${scenario.cyclone.name} override active for maritime safety.`
          : `Scenario values show a thermal-front gradient (|∇SST|: ${scenario.oceanParameters.sstGradient}°C/10km) and PFZ: '${scenario.pfz.name}'.`,
        subtasks: [
          scenario.pfz.targetSpecies !== 'N/A' ? `Target: ${scenario.pfz.targetSpecies}` : "PFZ Withheld",
          `Confidence: ${scenario.pfz.confidence}%`
        ],
        confidence: scenario.pfz.confidence
      },
      {
        number: 5,
        title: "Geospatial & Geofencing Stage",
        time: "11.5",
        detail: `Computed Haversine distance to demo IMBL: ${scenario.imbl.distanceFromHarbourNm} NM (Buffer: ${scenario.imbl.bufferNm} NM). A pre-authored demo route is displayed with the geofence.`,
        subtasks: ["IMBL geofence evaluated", "Demo route displayed"],
        confidence: 99.4
      }
    ]
  }

  const steps = getAgentSteps()

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

        {/* Scenario Bar */}
        <div className="flex items-center justify-center gap-3 mt-4 mb-2">
          <div className="glass-panel px-4 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
            <Compass size={14} className="text-blue-600" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Demo Scenario:</span>
            <select
              value={selectedScenarioId}
              onChange={(e) => handleScenarioSwitch(e.target.value)}
              className="bg-transparent font-bold text-xs text-slate-800 outline-none cursor-pointer"
            >
              {Object.values(scenarios).map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.label} ({sc.risk.riskLevel === 'SAFE_FOR_VENTURE' ? '🟢 SAFE' : sc.risk.riskLevel === 'CAUTION' ? '🟡 CAUTION' : '🔴 NO VENTURE'})
                </option>
              ))}
            </select>
          </div>

          <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase shadow-sm flex items-center gap-1.5 ${
            scenario.risk.riskLevel === 'SAFE_FOR_VENTURE' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : scenario.risk.riskLevel === 'CAUTION' 
              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {scenario.risk.riskLevel === 'SAFE_FOR_VENTURE' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {scenario.risk.ventureStatusLabel}
          </div>
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

        {/* Suggestion Chips */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { id: 'kochi', label: 'Nearest Tuna PFZ (Kochi)', icon: <Map size={12}/> },
            { id: 'chennai', label: 'Sea Venture Safety (Chennai)', icon: <ShieldCheck size={12}/> },
            { id: 'bay-of-bengal', label: 'Cyclone Warnings (Bay of Bengal)', icon: <Wind size={12}/> }
          ].map(chip => (
            <button 
              key={chip.label} 
              onClick={() => handleScenarioSwitch(chip.id)}
              className={`px-4 py-2 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 border ${
                selectedScenarioId === chip.id
                  ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/50'
              }`}
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. DYNAMIC CONTENT AREA */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SYNTHESIZED OUTPUT */}
        <div className={`${view === 'agents' ? 'lg:col-span-7' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} space-y-6`}>
          <AnimatePresence mode="wait">
            {hasCompleted && (
              <motion.div 
                key={selectedScenarioId + language}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-blue-100 relative overflow-hidden"
              >
                {/* Glowing background accent */}
                <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full pointer-events-none ${
                  scenario.risk.riskLevel === 'SAFE_FOR_VENTURE' ? 'bg-emerald-500/10' : scenario.risk.riskLevel === 'CAUTION' ? 'bg-amber-500/10' : 'bg-rose-500/10'
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
                      scenario.risk.riskLevel === 'SAFE_FOR_VENTURE'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : scenario.risk.riskLevel === 'CAUTION'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-rose-700 bg-rose-50 border-rose-200'
                    }`}>
                      SAFETY SCORE: {scenario.risk.safetyScore}/100
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
                  scenario.risk.riskLevel === 'SAFE_FOR_VENTURE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : scenario.risk.riskLevel === 'CAUTION'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    scenario.risk.riskLevel === 'SAFE_FOR_VENTURE' ? 'bg-emerald-500' : scenario.risk.riskLevel === 'CAUTION' ? 'bg-amber-500' : 'bg-rose-500 animate-ping'
                  }`} />
                  <div>
                    <span className="uppercase text-[9px] block text-slate-500 font-black">Demo Guidance</span>
                    {scenario.risk.officialDirective}
                  </div>
                </div>

                {/* Bottom Metric Row */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">SST Gradient</span>
                      <span className="text-xs font-black text-slate-800">{scenario.oceanParameters.sstGradient}°C/10km</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Chlorophyll</span>
                      <span className="text-xs font-black text-slate-800">{scenario.oceanParameters.chlorophyll} mg/m³</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Wave Height</span>
                      <span className="text-xs font-black text-slate-800">{scenario.oceanConditions.waveHeight}m</span>
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
                  Displaying simulated ocean parameters and maritime geofence calculations for {scenario.label}.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: PROVENANCE CHAIN */}
        {view === 'agents' && <div className="lg:col-span-5">
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-white/60 shadow-sm h-full">
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

            <div className="space-y-0">
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
