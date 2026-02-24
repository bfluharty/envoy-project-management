import OpenAI from 'openai'
import env from '#start/env'

export interface EmailAnalysis {
  analysis: {
    intent: string
    urgency: 'high' | 'medium' | 'low'
    category: 'request' | 'information' | 'follow-up' | 'meeting' | 'task' | 'other'
    keyPoints: string[]
    requiredActions: string[]
    deadlines: string[]
  }
  responseStrategy: {
    shouldRespond: boolean
    responseType: 'immediate' | 'scheduled' | 'needMoreInfo'
    tone: 'formal' | 'professional' | 'friendly'
    keyPointsToAddress: string[]
  }
  extractedData: {
    dates: string[]
    contacts: string[]
    requests: string[]
    commitments: string[]
  }
}

export interface EmailResponse {
  emailResponse: {
    subject: string
    greeting: string
    body: string
    closing: string
    signature?: string
  }
  metadata: {
    tone: 'formal' | 'professional' | 'friendly'
    estimatedReadTime: string
    containsActionItems: boolean
    nextSteps: string[]
  }
}

export interface EmailContent {
  greeting: string
  body: string
  closing: string
  signature: string
}

export interface EmailDataInput {
  subject: string
  body: string
  from: string
  to: string[]
  cc?: string[]
  date: string
  threadId?: string
  threadContext?: string
}

export interface InitialEmailRequest {
  recipients: string[]
  subject: string
  context: string
}

function getClient(): OpenAI | null {
  const apiKey = env.get('OPENAI_API_KEY')
  if (!apiKey || apiKey === '') return null
  return new OpenAI({ apiKey })
}

/**
 * Analyze an email for intent, urgency, key points, and response strategy.
 * Returns null if OPENAI_API_KEY is not set.
 */
export async function analyzeEmail(emailData: EmailDataInput): Promise<EmailAnalysis | null> {
  const client = getClient()
  if (!client) return null

  const toStr = Array.isArray(emailData.to) ? emailData.to.join(', ') : String(emailData.to)
  const ccStr = emailData.cc ? `CC: ${emailData.cc.join(', ')}\n` : ''

  const prompt = `Analyze this email:

Subject: ${emailData.subject}
From: ${emailData.from}
To: ${toStr}
${ccStr}Date: ${emailData.date}

Content:
${emailData.body}

Return a JSON object with:
- analysis: { intent, urgency (high|medium|low), category (request|information|follow-up|meeting|task|other), keyPoints, requiredActions, deadlines }
- responseStrategy: { shouldRespond, responseType (immediate|scheduled|needMoreInfo), tone (formal|professional|friendly), keyPointsToAddress }
- extractedData: { dates, contacts, requests, commitments }`

  const response = await client.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional email assistant that helps process and respond to emails effectively.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) return null
  return JSON.parse(content) as EmailAnalysis
}

/**
 * Generate a reply given email data and optional analysis.
 * Returns null if OPENAI_API_KEY is not set.
 */
export async function generateResponse(
  emailData: EmailDataInput,
  analysis: EmailAnalysis | null
): Promise<EmailResponse | null> {
  const client = getClient()
  if (!client) return null

  const toStr = Array.isArray(emailData.to) ? emailData.to.join(', ') : String(emailData.to)
  const ccStr = emailData.cc ? `CC: ${emailData.cc.join(', ')}\n` : ''
  const analysisBlock = analysis ? `Analysis:\n${JSON.stringify(analysis, null, 2)}` : ''

  const prompt = `Generate a professional email response:

Original Email:
Subject: ${emailData.subject}
From: ${emailData.from}
To: ${toStr}
${ccStr}Date: ${emailData.date}

Content:
${emailData.body}
${analysisBlock}

Guidelines:
1. Write in a clear, professional, and appropriate tone
2. Address all key points from the original email
3. Be concise but thorough
4. Use appropriate greetings and closings
5. Maintain a helpful and solution-oriented approach
6. Include clear next steps or actions if needed
7. Match the formality level of the original email

Return a JSON object with:
{
    "emailResponse": {
        "subject": "Response subject (or leave empty to use Re: original)",
        "greeting": "Email greeting",
        "body": "Main email body",
        "closing": "Email closing",
        "signature": "Optional signature"
    },
    "metadata": {
        "tone": "formal|professional|friendly",
        "estimatedReadTime": "1-2 minutes",
        "containsActionItems": true|false,
        "nextSteps": ["Array of next steps"]
    }
}`

  const response = await client.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional email assistant that helps process and respond to emails effectively.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) return null
  const parsed = JSON.parse(content) as {
    emailResponse?: {
      subject?: string
      greeting?: string
      body?: string
      closing?: string
      signature?: string
    }
    metadata?: {
      tone?: string
      estimatedReadTime?: string
      containsActionItems?: boolean
      nextSteps?: string[]
    }
  }
  return {
    emailResponse: {
      subject: parsed?.emailResponse?.subject ?? '',
      greeting: parsed?.emailResponse?.greeting ?? 'Hi,',
      body: parsed?.emailResponse?.body ?? 'Thank you for your email. I will get back to you soon.',
      closing: parsed?.emailResponse?.closing ?? 'Best regards,',
      signature: parsed?.emailResponse?.signature ?? '',
    },
    metadata: {
      tone: (parsed?.metadata?.tone as 'formal' | 'professional' | 'friendly') ?? 'professional',
      estimatedReadTime: parsed?.metadata?.estimatedReadTime ?? '1 minute',
      containsActionItems: parsed?.metadata?.containsActionItems ?? false,
      nextSteps: Array.isArray(parsed?.metadata?.nextSteps) ? parsed.metadata.nextSteps : [],
    },
  }
}

/**
 * Generate initial email content (greeting, body, closing, signature) for starting a thread.
 * Returns null if OPENAI_API_KEY is not set.
 */
export async function generateInitialEmail(
  request: InitialEmailRequest
): Promise<EmailContent | null> {
  const client = getClient()
  if (!client) return null

  const recipients =
    typeof request.recipients === 'string' ? [request.recipients] : request.recipients
  const prompt = `You are an AI assistant helping to write a professional email.

Context:
- Recipients: ${recipients.join(', ')}
- Subject: ${request.subject}
- Context: ${request.context}

Write a professional email that initiates a conversation based on the given context. The email should be:
- Professional and courteous
- Clear and concise
- Appropriate for business communication
- Written in a way that encourages response

Provide the response in JSON format with the following structure:
{
    "greeting": "The email greeting",
    "body": "The main content of the email",
    "closing": "The email closing",
    "signature": "The email signature"
}`

  const response = await client.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are a professional email writing assistant.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) return null
  const parsed = JSON.parse(content) as {
    greeting?: string
    body?: string
    closing?: string
    signature?: string
  }
  return {
    greeting: parsed.greeting ?? '',
    body: parsed.body ?? '',
    closing: parsed.closing ?? '',
    signature: parsed.signature ?? '',
  }
}
