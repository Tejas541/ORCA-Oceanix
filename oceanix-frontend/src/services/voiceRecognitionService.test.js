import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSpeechRecognitionSupported,
  createVoiceRecognitionSession,
  VOICE_STATUS,
  VOICE_ERROR_MESSAGES,
} from './voiceRecognitionService.js'
import { AIVANA_INTENTS } from './aivanaInterpreter.js'
import { MARINE_OPERATING_LOCATIONS } from '../data/marineOperatingLocations.js'

const JNPA = MARINE_OPERATING_LOCATIONS.find((l) => l.id === 'major-port-jawaharlal-nehru')

// Mock SpeechRecognition factory for tests
function createMockSpeechRecognitionClass(behavior = {}) {
  return class MockSpeechRecognition {
    constructor() {
      this.lang = ''
      this.interimResults = false
      this.continuous = false
      this.maxAlternatives = 1
      this.onstart = null
      this.onresult = null
      this.onerror = null
      this.onend = null
      MockSpeechRecognition.lastInstance = this
    }

    start() {
      if (behavior.throwOnStart) {
        throw new Error(behavior.throwOnStart)
      }
      setTimeout(() => {
        if (this.onstart) this.onstart()

        if (behavior.error) {
          if (this.onerror) this.onerror({ error: behavior.error })
          if (this.onend) this.onend()
          return
        }

        if (behavior.results) {
          behavior.results.forEach((res) => {
            if (this.onresult) this.onresult(res)
          })
        }

        if (this.onend) this.onend()
      }, 5)
    }

    stop() {
      if (this.onend) this.onend()
    }

    abort() {
      if (this.onerror) this.onerror({ error: 'aborted' })
      if (this.onend) this.onend()
    }
  }
}

test('1. Supported browser detection returns true when SpeechRecognition exists', () => {
  const mockWindow = { SpeechRecognition: createMockSpeechRecognitionClass() }
  assert.equal(isSpeechRecognitionSupported(mockWindow), true)

  const mockWebkitWindow = { webkitSpeechRecognition: createMockSpeechRecognitionClass() }
  assert.equal(isSpeechRecognitionSupported(mockWebkitWindow), true)
})

test('2. Unsupported browser detection returns false and emits ERROR when starting', () => {
  const emptyWindow = {}
  assert.equal(isSpeechRecognitionSupported(emptyWindow), false)

  let reportedState = null
  let reportedError = null

  const session = createVoiceRecognitionSession({
    windowObj: emptyWindow,
    onStateChange: (st) => {
      reportedState = st
    },
    onError: (err) => {
      reportedError = err
    },
  })

  assert.equal(session.isSupported, false)
  session.start()
  assert.equal(reportedState, VOICE_STATUS.ERROR)
  assert.equal(reportedError.code, 'not-supported')
  assert.equal(reportedError.message, VOICE_ERROR_MESSAGES.NOT_SUPPORTED)
})

test('3. en-IN configuration, interimResults=true, continuous=false are set by default', (t, done) => {
  const MockClass = createMockSpeechRecognitionClass()
  const mockWindow = { SpeechRecognition: MockClass }

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onEnd: () => {
      const instance = MockClass.lastInstance
      assert.ok(instance)
      assert.equal(instance.lang, 'en-IN')
      assert.equal(instance.interimResults, true)
      assert.equal(instance.continuous, false)
      done()
    },
  })

  session.start()
})

test('4. Interim and final transcript emissions are handled in sequence', (t, done) => {
  const interimEvents = []
  let finalResult = null

  const mockEvents = [
    {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'plan a fish' }], { isFinal: false }),
      ],
    },
    {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'plan a fishing trip' }], { isFinal: true }),
      ],
    },
  ]

  const MockClass = createMockSpeechRecognitionClass({ results: mockEvents })
  const mockWindow = { SpeechRecognition: MockClass }

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onInterimResult: (text) => interimEvents.push(text),
    onFinalResult: (text) => {
      finalResult = text
    },
    onEnd: () => {
      assert.equal(interimEvents.length, 1)
      assert.equal(interimEvents[0], 'plan a fish')
      assert.equal(finalResult, 'plan a fishing trip')
      done()
    },
  })

  session.start()
})

test('5. Empty transcript returns to IDLE state without crashing or misinterpreting', (t, done) => {
  const MockClass = createMockSpeechRecognitionClass({ results: [] })
  const mockWindow = { SpeechRecognition: MockClass }

  const states = []
  let interpretationCalled = false

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onStateChange: (st) => states.push(st),
    onInterpretation: () => {
      interpretationCalled = true
    },
    onEnd: () => {
      assert.ok(states.includes(VOICE_STATUS.LISTENING))
      assert.equal(states[states.length - 1], VOICE_STATUS.IDLE)
      assert.equal(interpretationCalled, false)
      done()
    },
  })

  session.start()
})

test('6. Permission denied error maps to human-readable error message and ERROR state', (t, done) => {
  const MockClass = createMockSpeechRecognitionClass({ error: 'not-allowed' })
  const mockWindow = { SpeechRecognition: MockClass }

  let errorPayload = null
  let finalState = null

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onStateChange: (st) => {
      finalState = st
    },
    onError: (err) => {
      errorPayload = err
    },
    onEnd: () => {
      assert.equal(finalState, VOICE_STATUS.ERROR)
      assert.ok(errorPayload)
      assert.equal(errorPayload.code, 'not-allowed')
      assert.equal(errorPayload.message, VOICE_ERROR_MESSAGES.NOT_ALLOWED)
      done()
    },
  })

  session.start()
})

test('7. Network and no-speech recognition errors map to proper messages', (t, done) => {
  const MockClass = createMockSpeechRecognitionClass({ error: 'network' })
  const mockWindow = { SpeechRecognition: MockClass }

  let errorPayload = null

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onError: (err) => {
      errorPayload = err
    },
    onEnd: () => {
      assert.equal(errorPayload.code, 'network')
      assert.equal(errorPayload.message, VOICE_ERROR_MESSAGES.NETWORK)
      done()
    },
  })

  session.start()
})

test('8. Final transcript reaches interpretAivanaRequest() with structured interpretation', (t, done) => {
  const mockEvents = [
    {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Plan a fishing operation from JNPA' }], {
          isFinal: true,
        }),
      ],
    },
  ]

  const MockClass = createMockSpeechRecognitionClass({ results: mockEvents })
  const mockWindow = { SpeechRecognition: MockClass }

  let interpretationResult = null

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onInterpretation: (res) => {
      interpretationResult = res
    },
    onEnd: () => {
      assert.ok(interpretationResult)
      assert.equal(interpretationResult.intent, AIVANA_INTENTS.FISHING)
      assert.equal(interpretationResult.status, 'READY')
      assert.ok(interpretationResult.resolvedLocation)
      assert.equal(interpretationResult.resolvedLocation.id, JNPA.id)
      done()
    },
  })

  session.start()
})

test('9. Voice session passes active Location from context to interpretAivanaRequest() when location is omitted in speech', (t, done) => {
  const mockEvents = [
    {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'I want to plan a fishing operation' }], {
          isFinal: true,
        }),
      ],
    },
  ]

  const MockClass = createMockSpeechRecognitionClass({ results: mockEvents })
  const mockWindow = { SpeechRecognition: MockClass }

  let interpretationResult = null

  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    activeLocation: JNPA,
    onInterpretation: (res) => {
      interpretationResult = res
    },
    onEnd: () => {
      assert.ok(interpretationResult)
      assert.equal(interpretationResult.intent, AIVANA_INTENTS.FISHING)
      assert.equal(interpretationResult.status, 'READY')
      assert.equal(interpretationResult.resolvedLocation.id, JNPA.id)
      done()
    },
  })

  session.start()
})

test('10. abort() cancels the active session and resets state to IDLE', () => {
  const MockClass = createMockSpeechRecognitionClass()
  const mockWindow = { SpeechRecognition: MockClass }

  let currentState = null
  const session = createVoiceRecognitionSession({
    windowObj: mockWindow,
    onStateChange: (st) => {
      currentState = st
    },
  })

  session.start()
  session.abort()
  assert.equal(session.isListening(), false)
  assert.equal(currentState, VOICE_STATUS.IDLE)
})