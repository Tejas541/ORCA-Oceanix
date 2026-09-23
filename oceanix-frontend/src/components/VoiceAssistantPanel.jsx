import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Volume2 } from 'lucide-react'
import { useScenario } from '../context/ScenarioContext'
import { createVoiceRecognition, isSpeechRecognitionSupported } from '../utils/voiceRecognition'

const API_URL = '/api/assistant/interpret'

export default function VoiceAssistantPanel() {
  const {
    selectedOperatingLocation,
    assistantTask,
    setAssistantTask,
    assistantConversation,
    setAssistantConversation,
  } = useScenario()
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const interpret = async (value) => {
    const request = value.trim()
    if (!request || processing) return
    setProcessing(true)
    setError('')
    setAssistantConversation((messages) => [...messages, { role: 'user', text: request }])
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: request, context: { selectedOperatingLocation } }),
      })
      const task = await response.json()
      if (!response.ok) throw new Error(task.error || 'Unable to interpret request')
      setAssistantTask(task)
      const reply = task.status === 'NEEDS_CLARIFICATION'
        ? task.missingFields?.[0] === 'operatingLocation'
          ? 'Which operating location should I use?'
          : `What is the ${task.missingFields?.[0] || 'missing detail'} for this task?`
        : 'Got it. I have enough information to continue.'
      setAssistantConversation((messages) => [...messages, { role: 'orca', text: reply }])
      setInput('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setProcessing(false)
    }
  }

  const startListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    setError('')
    if (!isSpeechRecognitionSupported()) {
      setError('Voice recognition is unavailable in this browser. Use the text field below.')
      return
    }
    recognitionRef.current = createVoiceRecognition({
      onListening: setListening,
      onTranscript: setInput,
      onError: (reason) => setError(`Voice recognition error: ${reason}`),
      onEnd: () => setListening(false),
    })
    recognitionRef.current?.start()
  }

  const status = listening ? 'LISTENING' : processing ? 'PROCESSING' : assistantTask?.status || 'IDLE'
  const statusText = listening
    ? 'Listening...'
    : processing
      ? 'Understanding your request...'
      : assistantTask?.status === 'NEEDS_CLARIFICATION'
        ? 'Clarification needed'
        : assistantTask?.status === 'READY'
          ? 'Ready for the next phase'
          : 'Tell ORCA what you want to do.'

  return (
    <section className="mt-12 max-w-3xl mx-auto rounded-[2rem] border border-slate-200 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]" aria-label="ORCA Voice Assistant">
      <div className="text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">ORCA CORE INTERFACE</div>
        <h2 className="mt-3 text-2xl font-black text-slate-900">Talk to ORCA</h2>
        <p className="mt-2 text-sm text-slate-500">{statusText}</p>
        <button
          type="button"
          onClick={startListening}
          aria-label={listening ? 'Stop listening' : 'Tap to speak'}
          className={`mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border-8 transition-all ${listening ? 'border-blue-200 bg-blue-600 text-white shadow-[0_0_0_14px_rgba(37,99,235,0.12)]' : 'border-slate-100 bg-slate-950 text-white hover:bg-blue-700'}`}
        >
          {listening ? <MicOff size={30} /> : <Mic size={30} />}
        </button>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {listening ? <Volume2 size={14} className="animate-pulse text-blue-600" /> : <Mic size={14} />}
          {status}
        </div>
      </div>

      <form className="mt-7 flex gap-2" onSubmit={(event) => { event.preventDefault(); interpret(input) }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Or type a request for ORCA..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
        <button type="submit" disabled={!input.trim() || processing} className="rounded-xl bg-blue-600 px-4 text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={18} /></button>
      </form>

      {assistantTask && <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Intent: {assistantTask.intent}</span><span>Status: {assistantTask.status}</span>
        </div>
        <p className="mt-2">Transcript: “{assistantTask.originalRequest}”</p>
        {assistantTask.operatingArea && <p className="mt-1">Operating area: {assistantTask.operatingArea}</p>}
      </div>}
      {assistantConversation.length > 0 && <div className="mt-4 space-y-2 text-xs text-slate-500">
        {assistantConversation.slice(-2).map((message, index) => <p key={`${message.role}-${index}`}><strong className="text-slate-700">{message.role === 'orca' ? 'ORCA' : 'YOU'}:</strong> {message.text}</p>)}
      </div>}
      {error && <p className="mt-4 text-center text-xs font-semibold text-rose-600">{error}</p>}
      {!selectedOperatingLocation && <p className="mt-4 text-center text-[11px] text-slate-400">No operating location selected. ORCA will ask when a task requires one.</p>}
    </section>
  )
}
