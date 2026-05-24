import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;
const preferredModels = ['grok-2-latest', 'grok-3-mini'];
const placeholderKey = 'your_grok_api_key_here';
const minimumSourceLength = 20;

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY || '',
  baseURL: 'https://api.x.ai/v1',
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function hasUsableXAIKey() {
  return Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY !== placeholderKey);
}

console.log('--- Server Initialization ---');
if (hasUsableXAIKey()) {
  console.log('[xAI] XAI_API_KEY loaded successfully.');
} else {
  console.log('[xAI] WARNING: XAI_API_KEY is missing from backend/.env.');
}
console.log(`[server] Listening target port: ${port}`);

function buildPrompt(code) {
  return [
    'Analyze the provided source code and write clean README-style technical documentation in Markdown.',
    'Keep the writing polished, practical, and easy to scan.',
    'Include these sections when they are inferable from the code:',
    '- Project Overview',
    '- Features',
    '- Tech Stack',
    '- Setup Instructions',
    '- Architecture or Folder Notes',
    '- Key Functions or Classes',
    '- API Documentation',
    '- Usage Example',
    '- Known Limitations or Notes',
    '',
    'Return only the Markdown document.',
    '',
    'Source code:',
    '```',
    code,
    '```',
  ].join('\n');
}

function truncateCode(code, maxLength = 900) {
  if (code.length <= maxLength) {
    return code;
  }

  return `${code.slice(0, maxLength)}\n...`;
}

function collectRouteMatches(code) {
  const routePattern =
    /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi;
  const routes = [];
  let match;

  while ((match = routePattern.exec(code)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
    });
  }

  return routes;
}

function collectNamedSymbols(code) {
  const symbolPattern =
    /\b(?:async\s+function|function|class|const|let)\s+([A-Za-z0-9_]+)/g;
  const names = new Set();
  let match;

  while ((match = symbolPattern.exec(code)) !== null) {
    names.add(match[1]);
  }

  return Array.from(names).slice(0, 10);
}

function inferStack(code) {
  const stack = [];

  if (/express/i.test(code)) stack.push('Express');
  if (/react/i.test(code)) stack.push('React');
  if (/mongoose|mongodb/i.test(code)) stack.push('MongoDB');
  if (/postgres|sequelize|prisma/i.test(code)) stack.push('SQL database tooling');
  if (/dotenv/i.test(code)) stack.push('dotenv');
  if (/fetch\(|axios/i.test(code)) stack.push('HTTP client usage');
  if (/import\s+OpenAI|from\s+['"]openai['"]/i.test(code)) stack.push('OpenAI-compatible SDK');

  return stack.length > 0 ? stack : ['JavaScript / Node.js'];
}

function inferFeatures(code, routes, symbols) {
  const features = [];

  if (routes.length > 0) {
    features.push(`Exposes ${routes.length} HTTP endpoint${routes.length === 1 ? '' : 's'} for application workflows.`);
  }
  if (/async\s+function|await\s+/i.test(code)) {
    features.push('Uses asynchronous logic for non-blocking processing.');
  }
  if (/process\.env/i.test(code)) {
    features.push('Reads runtime configuration from environment variables.');
  }
  if (/try\s*{[\s\S]*catch\s*\(/i.test(code)) {
    features.push('Includes defensive error handling around critical operations.');
  }
  if (symbols.length > 0) {
    features.push('Defines reusable functions or classes for core behavior.');
  }

  return features.length > 0 ? features : ['Processes provided source code and turns it into readable technical documentation.'];
}

function inferOverview(code, routes) {
  if (/generate-docs/i.test(code) || routes.some((route) => route.path.includes('generate-docs'))) {
    return 'This service accepts source code input and produces README-style technical documentation for that code.';
  }
  if (routes.length > 0) {
    return 'This code appears to implement an HTTP API service with request handling and structured responses.';
  }
  if (/react/i.test(code)) {
    return 'This code appears to power a React-based user interface with component-driven rendering.';
  }

  return 'This code appears to define application logic that can be documented from the provided source structure and behavior.';
}

function createFallbackDocumentation(code) {
  const routes = collectRouteMatches(code);
  const symbols = collectNamedSymbols(code);
  const stack = inferStack(code);
  const features = inferFeatures(code, routes, symbols);
  const overview = inferOverview(code, routes);
  const usageExample = routes.find((route) => route.path === '/generate-docs')
    ? [
        '```bash',
        'curl -X POST http://localhost:5000/generate-docs \\',
        '  -H "Content-Type: application/json" \\',
        '  -d "{\"code\":\"console.log(\\\"hello\\\")\"}"',
        '```',
      ].join('\n')
    : [
        '```js',
        '// Provide the source code to the relevant module or entry point.',
        truncateCode(code, 240),
        '```',
      ].join('\n');

  const apiSection =
    routes.length > 0
      ? routes
          .map((route) => `- \`${route.method} ${route.path}\`: Handles application-specific request processing.`)
          .join('\n')
      : '- No explicit HTTP routes were confidently inferred from the provided code snippet.';

  const symbolSection =
    symbols.length > 0
      ? symbols.map((name) => `- \`${name}\`: Important symbol detected in the provided code.`).join('\n')
      : '- No named functions or classes were confidently inferred from the provided code snippet.';

  return [
    '# Technical Documentation',
    '',
    '## Project Overview',
    overview,
    '',
    '## Features',
    ...features.map((feature) => `- ${feature}`),
    '',
    '## Tech Stack',
    ...stack.map((item) => `- ${item}`),
    '',
    '## Setup Instructions',
    '1. Install project dependencies with `npm install`.',
    '2. Configure the required environment variables for this project.',
    '3. Start the relevant development or backend server.',
    '4. Send source code to the application flow that generates documentation.',
    '',
    '## Key Functions Or Classes',
    symbolSection,
    '',
    '## API Documentation',
    apiSection,
    '',
    '## Usage Example',
    usageExample,
    '',
    '## Code Snapshot',
    '```js',
    truncateCode(code),
    '```',
    '',
    '## Notes',
    '- This document was generated by the backend fallback formatter when the xAI response was unavailable.',
    '- The fallback stays clean for the frontend while backend logs preserve the underlying error details for debugging.',
  ].join('\n');
}

function classifyXAIError(error) {
  const status = error?.status || error?.response?.status || 500;
  const message = String(error?.message || error?.error?.message || '');
  const normalized = message.toLowerCase();

  if (!hasUsableXAIKey()) {
    return {
      type: 'missing_xai_api_key',
      status: 500,
      logMessage: 'Missing XAI_API_KEY in backend/.env.',
    };
  }

  if (
    status === 401 ||
    normalized.includes('invalid api key') ||
    normalized.includes('incorrect api key') ||
    normalized.includes('unauthorized')
  ) {
    return {
      type: 'invalid_api_key',
      status: 401,
      logMessage: 'Invalid xAI API key.',
    };
  }

  if (
    status === 404 ||
    normalized.includes('model not found') ||
    normalized.includes('does not exist') ||
    normalized.includes('unknown model') ||
    normalized.includes('unsupported model')
  ) {
    return {
      type: 'model_not_found',
      status: 404,
      logMessage: 'Requested xAI model was not found.',
    };
  }

  if (
    status === 429 ||
    normalized.includes('quota') ||
    normalized.includes('billing') ||
    normalized.includes('rate limit') ||
    normalized.includes('insufficient credits')
  ) {
    return {
      type: 'quota_or_billing',
      status: 429,
      logMessage: 'Quota, billing, or rate-limit issue from xAI.',
    };
  }

  return {
    type: 'xai_request_failed',
    status,
    logMessage: 'Unexpected xAI API error.',
  };
}

async function generateWithXAI(code) {
  const prompt = buildPrompt(code);
  let lastError;

  for (const model of preferredModels) {
    try {
      console.log(`[xAI] Attempting documentation generation with model: ${model}`);

      const response = await client.chat.completions.create({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior technical writer. Produce concise, accurate, README-style Markdown documentation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const text = response?.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new Error(`Empty response received from xAI model ${model}.`);
      }

      console.log(`[xAI] Documentation generated successfully with model: ${model}`);
      return { docs: text, model };
    } catch (error) {
      const classification = classifyXAIError(error);
      lastError = error;

      console.error(`[xAI] ${classification.logMessage}`, {
        model,
        status: error?.status || error?.response?.status || null,
        message: error?.message || 'Unknown error',
      });

      if (classification.type === 'model_not_found' && model !== preferredModels[preferredModels.length - 1]) {
        console.log(`[xAI] Trying fallback model after model failure: ${preferredModels[1]}`);
        continue;
      }

      error.classification = classification;
      error.attemptedModel = model;
      throw error;
    }
  }

  throw lastError || new Error('xAI request failed before a response was produced.');
}

app.get('/health', (req, res) => {
  res.json({ status: 'Backend running' });
});

app.post('/generate-docs', async (req, res) => {
  console.log('\n[server] Request received at POST /generate-docs');

  try {
    const { code } = req.body ?? {};

    if (!code || typeof code !== 'string' || code.trim().length < minimumSourceLength) {
      console.log('[server] Error: source code was missing, empty, or too short.');
      return res.status(400).json({
        error: 'Please paste valid source code to analyze.',
        score: 0,
        issues: [],
      });
    }

    if (!hasUsableXAIKey()) {
      const classification = classifyXAIError(new Error('Missing XAI_API_KEY'));
      console.error(`[xAI] ${classification.logMessage}`);

      return res.json({
        docs: createFallbackDocumentation(code),
        fallback: true,
        reason: classification.type,
      });
    }

    try {
      const result = await generateWithXAI(code);
      return res.json({
        docs: result.docs,
        model: result.model,
        fallback: false,
      });
    } catch (error) {
      const classification = error.classification || classifyXAIError(error);

      console.error('[server] Returning clean fallback documentation after xAI failure.', {
        reason: classification.type,
        attemptedModel: error.attemptedModel || null,
      });

      return res.json({
        docs: createFallbackDocumentation(code),
        fallback: true,
        reason: classification.type,
      });
    }
  } catch (error) {
    console.error('[server] Unexpected error generating documentation:', error);
    return res.status(500).json({ error: 'Unexpected backend error while generating documentation.' });
  }
});

app.listen(port, () => {
  console.log(`[server] Server is running on http://localhost:${port}`);
});
