import { interpretAivanaRequest } from './aivanaInterpreter.js'

export const VOICE_STATUS = Object.freeze({
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  ERROR: 'ERROR',
})

export const VOICE_ERROR_MESSAGES = Object.freeze({
  NOT_SUPPORTED: 'Speech recognition is not supported in this browser. Please use text input.',
  NOT_ALLOWED: 'Microphone access was denied. Please check your browser microphone permissions.',
  NO_SPEECH: 'No speech was detected. Please tap the microphone and try again.',
  NETWORK: 'Network error occurred during speech recognition. Please check your connection.',
  AUDIO_CAPTURE: 'No microphone was found or the microphone is unavailable.',
  ABORTED: 'Speech recognition was stopped.',
  EMPTY_TRANSCRIPT: 'No speech recognized. Please try speaking again or use text input.',
  UNKNOWN: 'An unexpected voice recognition error occurred. Please try again or use text input.',
})

/**
 * Checks whether the Web Speech API SpeechRecognition is available.
 *
 * @param {object} [targetWindow]
 * @returns {boolean}
 */
export function isSpeechRecognitionSupported(targetWindow) {
  const win = targetWindow ?? (typeof window !== 'undefined' ? window : null)
  if (!win) return false
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition)
}

/**
 * Maps SpeechRecognition error codes to human-readable error messages.
 *
 * @param {string} errorCode
 * @returns {string}
 */
export function mapVoiceError(errorCode) {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return VOICE_ERROR_MESSAGES.NOT_ALLOWED
    case 'no-speech':
      return VOICE_ERROR_MESSAGES.NO_SPEECH
    case 'network':
      return VOICE_ERROR_MESSAGES.NETWORK
    case 'audio-capture':
      return VOICE_ERROR_MESSAGES.AUDIO_CAPTURE
    case 'aborted':
      return VOICE_ERROR_MESSAGES.ABORTED
    default:
      return VOICE_ERROR_MESSAGES.UNKNOWN
  }
}

/**
 * Creates and manages a native browser SpeechRecognition session.
 *
 * @param {object} options
 * @param {Function} [options.onStateChange] callback(state: VOICE_STATUS)
 * @param {Function} [options.onInterimResult] callback(text: string)
 * @param {Function} [options.onFinalResult] callback(text: string)
 * @param {Function} [options.onInterpretation] callback(interpretation: object)
 * @param {Function} [options.onError] callback(error: { code: string, message: string })
 * @param {Function} [options.onEnd] callback()
 * @param {string} [options.lang='en-IN']
 * @param {boolean} [options.interimResults=true]
 * @param {boolean} [options.continuous=false]
 * @param {object} [options.activeLocation=null] ScenarioContext active location
 * @param {object} [options.explicitLocation=null] UI explicit location
 * @param {object} [options.windowObj] Window reference for testing / browser environment
 * @returns {object} Session controller { start, stop, abort, isListening }
 */
export function createVoiceRecognitionSession({
  onStateChange = () => {},
  onInterimResult = () => {},
  onFinalResult = () => {},
  onInterpretation = () => {},
  onError = () => {},
  onEnd = () => {},
  lang = 'en-IN',
  interimResults = true,
  continuous = false,
  activeLocation = null,
  explicitLocation = null,
  windowObj,
} = {}) {
  const win = windowObj ?? (typeof window !== 'undefined' ? window : null)

  if (!win || !isSpeechRecognitionSupported(win)) {
    return {
      start: () => {
        const err = {
          code: 'not-supported',
          message: VOICE_ERROR_MESSAGES.NOT_SUPPORTED,
        }
        onStateChange(VOICE_STATUS.ERROR)
        onError(err)
      },
      stop: () => {},
      abort: () => {},
      isListening: () => false,
      isSupported: false,
    }
  }

  const SpeechRecognitionConstructor =
    win.SpeechRecognition || win.webkitSpeechRecognition

  let recognitionInstance = null
  let isListeningState = false
  let accumulatedFinal = ''
  let hasError = false

  const stop = () => {
    if (recognitionInstance && isListeningState) {
      try {
        recognitionInstance.stop()
      } catch {
        // ignore
      }
    }
    isListeningState = false
  }

  const abort = () => {
    if (recognitionInstance) {
      try {
        recognitionInstance.abort()
      } catch {
        // ignore
      }
    }
    isListeningState = false
    hasError = false
    onStateChange(VOICE_STATUS.IDLE)
  }

  const start = () => {
    // If currently running, stop previous
    if (isListeningState) {
      stop()
    }

    accumulatedFinal = ''
    hasError = false

    try {
      const recognition = new SpeechRecognitionConstructor()
      recognitionInstance = recognition

      recognition.lang = lang
      recognition.interimResults = interimResults
      recognition.continuous = continuous
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        isListeningState = true
        hasError = false
        onStateChange(VOICE_STATUS.LISTENING)
      }

      recognition.onresult = (event) => {
        let interimText = ''
        let finalText = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i]
          if (res.isFinal) {
            finalText += res[0].transcript
          } else {
            interimText += res[0].transcript
          }
        }

        if (interimText) {
          onInterimResult(interimText)
        }

        if (finalText) {
          accumulatedFinal = finalText
          onFinalResult(finalText)
        }
      }

      recognition.onerror = (event) => {
        isListeningState = false
        const code = event.error || 'unknown'
        if (code === 'aborted') {
          hasError = false
          onStateChange(VOICE_STATUS.IDLE)
          return
        }

        hasError = true
        const message = mapVoiceError(code)
        onStateChange(VOICE_STATUS.ERROR)
        onError({ code, message })
      }

      recognition.onend = () => {
        isListeningState = false

        if (hasError) {
          onEnd()
          return
        }

        // If we captured speech, pass it to the existing Aivana interpreter
        const trimmed = accumulatedFinal.trim()
        if (trimmed) {
          onStateChange(VOICE_STATUS.PROCESSING)
          const interpretation = interpretAivanaRequest(
            trimmed,
            explicitLocation,
            activeLocation
          )
          onInterpretation(interpretation)
        } else {
          // If ended without any speech and was not an error
          onStateChange(VOICE_STATUS.IDLE)
        }

        onEnd()
      }

      recognition.start()
    } catch (err) {
      isListeningState = false
      onStateChange(VOICE_STATUS.ERROR)
      onError({
        code: 'start-failure',
        message: err?.message || VOICE_ERROR_MESSAGES.UNKNOWN,
      })
    }
  }

  return {
    start,
    stop,
    abort,
    isListening: () => isListeningState,
    isSupported: true,
  }
}
