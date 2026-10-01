import { GoogleGenAI } from '@google/genai';
import { buildAiPrompt } from './aiPrompt.js';
import { executeAiTool, getAiToolDeclarations } from './aiTools.js';

export const AI_UNAVAILABLE_MESSAGE = 'Sallu is temporarily unavailable. Please try again.';
export const MAX_TOOL_ROUNDS = 3;
export const MAX_TOOL_CALLS = 8;

export class AiUnavailableError extends Error {
  constructor() { super(AI_UNAVAILABLE_MESSAGE); }
}

const withinDeadline = (work, signal) => new Promise((resolve, reject) => {
  const abort = () => reject(new AiUnavailableError());
  if (signal.aborted) return abort();
  signal.addEventListener('abort', abort, { once: true });
  Promise.resolve(work).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
});

// Never return provider exceptions. Redact known configured secrets even if a provider echoes them.
export const redactAiText = (text, env = process.env) => {
  let cleaned = String(text);
  for (const key of ['GEMINI_API_KEY', 'JWT_SECRET', 'MONGODB_URI', 'SHEETS_EXPORT_KEY', 'TOPIC_TRACKER_EXPORT_KEY']) {
    const secret = env[key];
    if (secret && secret.length >= 4) cleaned = cleaned.split(secret).join('[redacted]');
  }
  return cleaned.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/\bAIza[A-Za-z0-9_-]{30,}\b/g, '[redacted]');
};

export const chatWithAi = async ({ message, req }, deps = {}) => {
  const env = deps.env || process.env;
  if (!env.GEMINI_API_KEY?.trim() && !deps.client) throw new AiUnavailableError();
  const client = deps.client || new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 20_000 } });
  const execute = deps.executeTool || executeAiTool;
  const now = deps.now || new Date();
  const tools = getAiToolDeclarations(req);
  const contents = [{ role: 'user', parts: [{ text: redactAiText(message, env) }] }];
  const signal = AbortSignal.timeout(45_000);
  let callCount = 0;
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const response = await withinDeadline(client.models.generateContent({
        model: env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite', contents,
        config: {
          systemInstruction: buildAiPrompt(req.user, now),
          tools: [{ functionDeclarations: tools }],
          toolConfig: { functionCallingConfig: { mode: round === MAX_TOOL_ROUNDS ? 'NONE' : 'AUTO' } },
          automaticFunctionCalling: { disable: true },
          temperature: 0.1, maxOutputTokens: 1200,
          thinkingConfig: { includeThoughts: false },
          abortSignal: signal,
        },
      }), signal);
      const content = response.candidates?.[0]?.content;
      if (!content?.parts?.length) throw new AiUnavailableError();
      const calls = content.parts.filter((part) => part.functionCall).map((part) => part.functionCall);
      if (!calls.length) {
        const answer = content.parts.filter((part) => part.text && !part.thought).map((part) => part.text).join('\n').trim();
        if (!answer) throw new AiUnavailableError();
        return { message: redactAiText(answer, env), toolCalls: [] };
      }
      if (round === MAX_TOOL_ROUNDS || calls.length > 4 || callCount + calls.length > MAX_TOOL_CALLS) {
        return { message: 'Sallu reached its lookup limit. Please ask a more specific question.', toolCalls: [] };
      }
      callCount += calls.length;
      // Preserve Google's opaque thought signatures for function-call continuity, never expose them.
      contents.push(content);
      const parts = [];
      for (const call of calls) {
        let result;
        try {
          result = await withinDeadline(execute(call.name, call.args || {}, req, { now }), signal);
        } catch {
          result = { error: 'unavailable', message: 'Live data could not be retrieved. Do not invent an answer.' };
        }
        if (signal.aborted) throw new AiUnavailableError();
        const serialized = redactAiText(JSON.stringify(result), env);
        const safeResult = serialized.length <= 40_000 ? JSON.parse(serialized)
          : { error: 'too_many_records', message: 'Narrow the question; the result exceeds the safe response size.' };
        parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: safeResult } });
      }
      contents.push({ role: 'user', parts });
    }
    throw new AiUnavailableError();
  } catch {
    throw new AiUnavailableError();
  }
};
