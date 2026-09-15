import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Configure CORS for production and local development
const corsOptions = {
  origin: process.env.CLIENT_ORIGIN 
    ? process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim())
    : true, // Allow all origins if CLIENT_ORIGIN is not specified
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Enable JSON parsing for incoming requests
app.use(express.json());

/**
 * Simple Health Check Endpoint for Deployment Platforms (Render, Railway, Fly.io, etc.):
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Detailed Health check endpoint:
 * Allows frontend or developer to check if backend is up and API key is loaded.
 */
app.get('/api/health', (req, res) => {
  const isKeyConfigured = Boolean(
    process.env.GEMINI_API_KEY && 
    process.env.GEMINI_API_KEY !== 'your_api_key_here' &&
    process.env.GEMINI_API_KEY.trim().length > 0
  );

  res.json({
    status: 'ok',
    message: 'SukuGPT backend is running successfully!',
    apiKeyConfigured: isKeyConfigured
  });
});

/**
 * Chat endpoint:
 * Accepts { message: string, history: Array<{ role: 'user'|'model', text: string }> }
 * Securely communicates with Google Gemini API and returns the AI reply.
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    // Validate that a message was provided
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Please provide a valid message.' });
    }

    // Verify that the Gemini API Key is present in backend/.env
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here' || apiKey.trim().length === 0) {
      return res.status(500).json({
        error: 'Gemini API Key is missing! Please add your GEMINI_API_KEY in the backend/.env file and restart the server.'
      });
    }

    // Initialize the official Google Gen AI client
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    // Format conversation history for multi-turn chat memory
    const contents = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const item of history) {
        if (item.text && item.role) {
          contents.push({
            role: item.role === 'assistant' ? 'model' : item.role,
            parts: [{ text: item.text }]
          });
        }
      }
    }

    // Append the latest user message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    // Helper sleep function for retry delay
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const BACKOFF_DELAYS = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s
    const MAX_ATTEMPTS = 3;
    const PRIMARY_MODEL = 'gemini-3.8-flash';
    const FALLBACK_MODEL = 'gemini-3.5-flash';
    const systemInstruction = 'You are SukuGPT, a friendly, helpful, and knowledgeable AI assistant. Answer queries clearly, nicely formatted with markdown when helpful, and be concise yet complete.';

    const is503Error = (err) => {
      const errorStr = String(err?.message || '');
      // Do NOT retry 429, quota, rate-limit, or RESOURCE_EXHAUSTED errors
      if (
        err?.status === 429 ||
        err?.code === 429 ||
        errorStr.includes('429') ||
        errorStr.includes('RESOURCE_EXHAUSTED') ||
        errorStr.includes('quota') ||
        errorStr.includes('rate limit') ||
        errorStr.includes('Too Many Requests')
      ) {
        return false;
      }

      return (
        err?.status === 503 ||
        err?.code === 503 ||
        errorStr.includes('503') ||
        errorStr.includes('UNAVAILABLE') ||
        errorStr.includes('high demand')
      );
    };

    let response = null;
    let lastError = null;

    // 1. Try Primary Model (gemini-3.8-flash) with exponential backoff retries (2s, 4s, 8s) ONLY for 503 errors
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: PRIMARY_MODEL,
          contents: contents,
          config: { systemInstruction }
        });
        lastError = null;
        break; // Success: break out of loop
      } catch (geminiError) {
        lastError = geminiError;
        if (is503Error(geminiError) && attempt < MAX_ATTEMPTS) {
          const delay = BACKOFF_DELAYS[attempt - 1] || 2000;
          console.warn(`[${PRIMARY_MODEL} 503 High Demand] Attempt ${attempt}/${MAX_ATTEMPTS} failed. Retrying in ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }

        // If error is not a 503 (e.g. 429, 400, 403), throw immediately without retrying
        throw geminiError;
      }
    }

    // 2. Fallback: If gemini-3.8-flash returns 503 after all retries, try gemini-3.5-flash once
    if (!response && lastError && is503Error(lastError)) {
      console.warn(`[Fallback] ${PRIMARY_MODEL} unavailable after ${MAX_ATTEMPTS} attempts. Trying fallback model ${FALLBACK_MODEL}...`);
      try {
        response = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: contents,
          config: { systemInstruction }
        });
        console.log(`[Fallback Success] Successfully responded using ${FALLBACK_MODEL}`);
      } catch (fallbackError) {
        console.error(`[Fallback Error] ${FALLBACK_MODEL} also failed:`, fallbackError);
        throw fallbackError;
      }
    } else if (!response && lastError) {
      throw lastError;
    }

    // Extract generated text reply
    const reply = response?.text || 'I received your message, but no text response was generated.';

    return res.json({ reply });
  } catch (error) {
    console.error('Error communicating with Gemini API:', error);

    // Provide friendly, clear error messages to the user
    let friendlyMessage = 'An unexpected error occurred while communicating with Gemini AI.';
    const errorStr = String(error.message || '');

    const isQuotaOrRateLimit =
      error?.status === 429 ||
      error?.code === 429 ||
      errorStr.includes('429') ||
      errorStr.includes('RESOURCE_EXHAUSTED') ||
      errorStr.includes('quota') ||
      errorStr.includes('rate limit') ||
      errorStr.includes('Too Many Requests');

    if (errorStr.includes('API_KEY_INVALID') || errorStr.includes('API key not valid') || error.status === 400 || error.status === 403) {
      friendlyMessage = 'Invalid Gemini API key! Please check backend/.env and make sure you pasted a valid key from Google AI Studio.';
    } else if (isQuotaOrRateLimit) {
      friendlyMessage = 'SukuGPT is temporarily unavailable because the Gemini API quota has been reached. Please try again later.';
    } else if (errorStr.includes('503') || errorStr.includes('UNAVAILABLE') || errorStr.includes('high demand') || error.status === 503) {
      friendlyMessage = 'Gemini servers are currently experiencing high demand. Please try again in a few moments.';
    } else if (error.message) {
      friendlyMessage = `Gemini Error: ${error.message}`;
    }

    return res.status(500).json({ error: friendlyMessage });
  }
});

// Start the Express server listening on 0.0.0.0 and process.env.PORT
app.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(`🚀 SukuGPT Backend is running at http://${HOST}:${PORT}`);
  console.log(`👉 Simple Health check: http://localhost:${PORT}/health`);
  console.log(`👉 Detailed Health check: http://localhost:${PORT}/api/health`);
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_api_key_here') {
    console.log(`⚠️  REMINDER: Add your Gemini API key in backend/.env`);
  } else {
    console.log(`✅ Gemini API key is configured!`);
  }
  console.log(`========================================`);
});
