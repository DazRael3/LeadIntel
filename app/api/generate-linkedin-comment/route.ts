import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getServerEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { isPro as isProPlan } from '@/lib/billing/plan'

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

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      // Pro gating (cost-heavy)
      const supabase = createRouteClient(request, bridge)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      if (!(await isProPlan(supabase, user.id))) {
        return fail(
          ErrorCode.FORBIDDEN,
          'Pro subscription required for LinkedIn comment generation',
          undefined,
          undefined,
          bridge,
          requestId
        )
      }

      const { companyName, triggerEvent, userSettings } = body as z.infer<typeof GenerateLinkedInCommentSchema>

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
${(userSettings as { whatYouSell?: string } | undefined)?.whatYouSell ? `Context: We sell ${(userSettings as { whatYouSell?: string }).whatYouSell} but don't mention this directly.` : ''}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 150,
      })

      const comment =
        response.choices[0]?.message?.content ||
        `Congratulations on ${triggerEvent}! Exciting times ahead for ${companyName}.`

      return ok({ comment }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/generate-linkedin-comment', userId, bridge, requestId)
    }
  },
  { bodySchema: GenerateLinkedInCommentSchema }
)
