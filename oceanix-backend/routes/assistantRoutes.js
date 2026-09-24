import { Router } from 'express'
import { interpretAssistantRequest } from '../services/assistantIntentService.js'

const router = Router()

router.post('/interpret', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }

  return res.json(interpretAssistantRequest({ text, context: req.body?.context ?? {} }))
})

export default router
