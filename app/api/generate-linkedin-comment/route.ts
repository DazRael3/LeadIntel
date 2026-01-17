import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getServerEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'

// Lazy initialization of OpenAI client (only created at runtime, not during build)
let openaiInstance: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const env = getServerEnv()
    openaiInstance = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    })
  }
  return openaiInstance
}

const GenerateLinkedInCommentSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  triggerEvent: z.string().min(1, 'Trigger event is required'),
  userSettings: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Validate request body
    let body
    try {
      body = await validateBody(request, GenerateLinkedInCommentSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const { companyName, triggerEvent, userSettings } = body

    // Generate LinkedIn comment
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional LinkedIn engagement expert. Write authentic, helpful LinkedIn comments that build rapport.
Rules:
- Keep it to 2-3 sentences
- Be genuine and congratulatory
- Add value, don't just congratulate
- Use 1-2 relevant emojis naturally
- Never mention sales or pitches
- Match the tone of the trigger event (excited for funding, supportive for hiring, etc.)
- If relevant, subtly connect to what the company does`,
        },
        {
          role: 'user',
          content: `Write a LinkedIn comment for ${companyName}'s recent activity: ${triggerEvent}
${userSettings?.whatYouSell ? `Context: We sell ${userSettings.whatYouSell} but don't mention this directly.` : ''}`,
        },
      ],
      temperature: 0.8,
      max_tokens: 150,
    })

    const comment = response.choices[0]?.message?.content || `Congratulations on ${triggerEvent}! Exciting times ahead for ${companyName}. 🚀`

    return ok({ comment }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/generate-linkedin-comment', undefined, bridge)
  }
}
