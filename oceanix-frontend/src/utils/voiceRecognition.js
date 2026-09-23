export function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionConstructor())
}

export function createVoiceRecognition({ onTranscript, onListening, onError, onEnd } = {}) {
  const Recognition = getSpeechRecognitionConstructor()
  if (!Recognition) return null

  const recognition = new Recognition()
  recognition.lang = 'en-IN'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onstart = () => onListening?.(true)
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || '')
      .join(' ')
      .trim()
    if (transcript) onTranscript?.(transcript)
  }
  recognition.onerror = (event) => onError?.(event.error || 'recognition_error')
  recognition.onend = () => {
    onListening?.(false)
    onEnd?.()
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  }
}

export default createVoiceRecognition
