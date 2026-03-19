import Anthropic from '@anthropic-ai/sdk';
import AIConfig from '../models/AIConfig.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

export async function generateAISuggestion(category, message) {
  let config;
  try {
    config = await AIConfig.findOne({ isActive: true });
  } catch (err) {
    logger.error('generateAISuggestion – failed to load AI config:', err.message);
    return null;
  }

  if (!config) {
    logger.warn('generateAISuggestion – no active AI config found, skipping');
    return null;
  }

  let apiKey;
  try {
    apiKey = decrypt(config.apiKey);
  } catch (err) {
    logger.error('generateAISuggestion – failed to decrypt API key:', err.message);
    return null;
  }

  const client = new Anthropic({ apiKey });
  const prompt =
    `A student has reported a ${category} issue: "${message}". ` +
    `Suggest a simple, safe first-check or temporary fix a non-expert could try while waiting for the maintenance officer. ` +
    `Keep it brief and practical.`;

  logger.info(`generateAISuggestion – calling ${config.model} for category:${category}`);

  try {
    const stream = await client.messages.stream({
      model: config.model || 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });
    const response = await stream.finalMessage();
    const text = response.content[0]?.text ?? null;
    logger.ok(`generateAISuggestion – received ${text?.length ?? 0} chars`);
    return text;
  } catch (err) {
    logger.error(`generateAISuggestion – Anthropic API error:`, err.message);
    throw err; // re-throw so caller's .catch() can log the complaint id
  }
}

export async function testAIConnection(apiKey, model) {
  logger.info(`testAIConnection – testing model:${model}`);
  const client = new Anthropic({ apiKey });

  try {
    const stream = await client.messages.stream({
      model: model || 'claude-opus-4-6',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Respond with: Connection successful.' }],
    });
    const response = await stream.finalMessage();
    const text = response.content[0]?.text ?? null;
    logger.ok(`testAIConnection – success: "${text}"`);
    return text;
  } catch (err) {
    logger.error(`testAIConnection – Anthropic API error:`, err.message);
    throw err;
  }
}
