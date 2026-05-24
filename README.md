# DocuMind AI Agent

DocuMind AI Agent is a full-stack documentation generator that turns raw source code into README-style technical documentation. The frontend sends code to an Express backend, and the backend uses the `openai` SDK against the xAI API at `https://api.x.ai/v1`.

## Architecture

- `frontend/`: React + Vite interface for pasting code and rendering generated Markdown.
- `backend/`: Express API that accepts source code, calls Grok models, and returns documentation.

## Backend Behavior

- Endpoint: `POST /generate-docs`
- Frontend target: `http://localhost:5000/generate-docs`
- Primary model: `grok-2-latest`
- Automatic fallback model: `grok-3-mini`
- SDK: `openai`
- xAI base URL: `https://api.x.ai/v1`

If xAI is unavailable, the backend silently returns clean fallback documentation so the frontend still shows usable output. Detailed failure reasons stay in backend console logs for debugging.

## Environment Variables

Create `backend/.env` with:

```env
XAI_API_KEY=your_grok_api_key_here
PORT=5000
```

## Local Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend starts on [http://localhost:5000](http://localhost:5000).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on the Vite dev server and continues calling `http://localhost:5000/generate-docs`.

## API Contract

### `POST /generate-docs`

Request body:

```json
{
  "code": "function hello() { console.log('hello'); }"
}
```

Success response:

```json
{
  "docs": "# Technical Documentation\n...",
  "model": "grok-2-latest",
  "fallback": false
}
```

Fallback response when xAI fails:

```json
{
  "docs": "# Technical Documentation\n...",
  "fallback": true,
  "reason": "quota_or_billing"
}
```

Validation error:

```json
{
  "error": "Source code is required."
}
```

## Error Handling

The backend classifies and logs these cases:

- Missing `XAI_API_KEY`
- Invalid API key
- Model not found
- Quota, billing, or rate-limit issues
- Other unexpected xAI request failures

These errors do not surface as quota or API warnings in the frontend when fallback documentation can be generated.

## Notes

- The repo now uses `XAI_API_KEY` for backend AI requests.
- The backend keeps console logs enabled so provider and fallback behavior stay visible during debugging.
