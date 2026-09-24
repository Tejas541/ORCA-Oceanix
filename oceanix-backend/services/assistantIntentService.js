import {
  ASSISTANT_INTENTS,
  createAssistantTask,
  getAssistantParserMetadata,
} from '../../shared/assistantTask.js'

export function interpretAssistantRequest({ text, context } = {}) {
  const task = createAssistantTask({ text, context })
  return {
    ...task,
    parser: getAssistantParserMetadata(),
    execution: 'deferred',
    supportedIntents: Object.values(ASSISTANT_INTENTS),
  }
}

export default interpretAssistantRequest

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('assistantIntentService.js')) {
  console.log(JSON.stringify(interpretAssistantRequest({ text: process.argv.slice(2).join(' ') }), null, 2))
}
