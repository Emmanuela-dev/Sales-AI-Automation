import OpenAI from 'openai';
import { env, configStatus } from '../config/env';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  // Retry transient failures (429s, 5xx) before surfacing an error. Generation
  // runs inside BullMQ jobs and HTTP handlers, so keep the ceiling bounded.
  maxRetries: 2,
  timeout: 90_000,
});

export const DEFAULT_MODEL = env.OPENAI_MODEL;

/** Raised for any AI failure with a message safe to show a user. */
export class AIError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AIError';
  }
}

function assertConfigured(): void {
  if (!configStatus.openai) {
    throw new AIError(
      'OPENAI_API_KEY is not configured. Set a real key in apps/backend/.env to enable AI features.'
    );
  }
}

/** Turns provider errors into messages that explain what to actually do. */
function describeProviderError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) return 'OpenAI rejected the API key (401). Check OPENAI_API_KEY.';
    if (err.status === 404) {
      return `OpenAI has no model named "${DEFAULT_MODEL}" available to this key (404). Check OPENAI_MODEL.`;
    }
    if (err.status === 429) {
      // Both are 429 but the remedies are unrelated: one needs money, the other
      // needs patience.
      if (err.code === 'insufficient_quota') {
        return (
          'Your OpenAI account has no remaining credit (429 insufficient_quota). ' +
          'The API key itself is valid — add a payment method or buy credits at ' +
          'platform.openai.com/settings/organization/billing. Retrying will not help.'
        );
      }
      return 'OpenAI rate limit exceeded (429). Too many requests in a short window — retry shortly.';
    }
    if (err.status && err.status >= 500) {
      return `OpenAI service error (${err.status}). This is usually transient — retry shortly.`;
    }
    return `OpenAI request failed (${err.status ?? 'no status'}): ${err.message}`;
  }
  if (err instanceof Error) return `OpenAI request failed: ${err.message}`;
  return 'OpenAI request failed for an unknown reason.';
}

/**
 * Models occasionally wrap JSON in prose or a markdown fence even in JSON mode.
 * Strip the common wrappers before parsing rather than throwing outright.
 */
function extractJsonObject(content: string): string {
  const trimmed = content.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

interface JsonCompletionOptions {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Label used in error messages, e.g. "lead scoring". */
  purpose: string;
}

/**
 * Runs a JSON-mode completion and returns the parsed object.
 *
 * Every AI service previously called JSON.parse directly on the raw response,
 * so a single malformed reply became an unhandled exception and a bare 500.
 * Here a malformed reply is retried once with a stricter instruction, and only
 * then reported as an AIError with the offending text truncated for debugging.
 */
export async function generateJson<T = Record<string, unknown>>(
  options: JsonCompletionOptions
): Promise<T> {
  assertConfigured();

  const { prompt, temperature = 0.3, maxTokens, purpose } = options;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'user', content: prompt },
    ];

    if (attempt === 2) {
      messages.push({
        role: 'system',
        content:
          'Your previous response was not valid JSON. Respond with a single valid JSON object and nothing else — no prose, no markdown fences.',
      });
    }

    let content: string;
    try {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });
      content = response.choices[0]?.message?.content ?? '';
    } catch (err) {
      throw new AIError(`${purpose} failed. ${describeProviderError(err)}`, err);
    }

    if (!content.trim()) {
      if (attempt === 1) continue;
      throw new AIError(`${purpose} failed: the model returned an empty response.`);
    }

    try {
      return JSON.parse(extractJsonObject(content)) as T;
    } catch (err) {
      if (attempt === 1) continue;
      throw new AIError(
        `${purpose} failed: the model did not return valid JSON. Received: ${content.slice(0, 300)}`,
        err
      );
    }
  }

  // Unreachable — the loop either returns or throws.
  throw new AIError(`${purpose} failed unexpectedly.`);
}

/** Runs a plain text completion. Used where JSON adds nothing. */
export async function generateText(options: {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  purpose: string;
}): Promise<string> {
  assertConfigured();

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: options.prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
  } catch (err) {
    throw new AIError(`${options.purpose} failed. ${describeProviderError(err)}`, err);
  }
}
