import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Use the latest Claude 3.5 Sonnet model (non-deprecated)
export const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'; 