import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Bug,
  CheckCircle,
  Copy,
  Download,
  FileCode2,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wand2,
  Zap,
} from 'lucide-react';

const MIN_SOURCE_LENGTH = 20;
const EMPTY_INPUT_MESSAGE = 'Please paste source code to analyze.';
const EMPTY_CHAT_MESSAGE = 'Please paste source code before asking questions.';
const EMPTY_OUTPUT_MESSAGE = 'Paste source code and click Generate Documentation.';

const sampleQuestions = [
  'What bugs should I fix first?',
  'How can I improve the structure?',
  'What does this backend do?',
];

function getNormalizedCode(code) {
  return code.trim();
}

function hasValidSourceCode(code) {
  return getNormalizedCode(code).length >= MIN_SOURCE_LENGTH;
}

function getRouteCount(code) {
  return [...code.matchAll(/\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi)]
    .length;
}

function buildAnalysis(code, documentation, meta) {
  const normalizedCode = getNormalizedCode(code);
  const normalized = code.toLowerCase();
  const issues = [];
  const improvements = [];
  const routeCount = hasValidSourceCode(code) ? getRouteCount(code) : 0;

  if (!hasValidSourceCode(code)) {
    return {
      issues: [],
      improvements: [],
      score: 0,
      issueCount: 0,
      routeCount: 0,
      scoreLabel: 'Empty',
      architecture: [
        { label: 'Source Code', detail: 'Awaiting pasted source input' },
        { label: 'Backend Agent', detail: 'No request is sent until valid code is present' },
        { label: 'AI', detail: 'Idle until analysis begins' },
        { label: 'Documentation', detail: 'Empty state only' },
      ],
      summary: EMPTY_INPUT_MESSAGE,
      hasValidSource: false,
      normalizedCode,
    };
  }

  if ((normalized.includes('req.body') || normalized.includes('request.body')) && !normalized.includes('if (!code')) {
    issues.push({
      title: 'Missing request validation',
      detail: 'The code reads request payload data but does not clearly validate it before processing.',
      severity: 'high',
    });
  }

  if ((normalized.includes('await ') || normalized.includes('async ')) && !normalized.includes('catch')) {
    issues.push({
      title: 'Async flow lacks error handling',
      detail: 'Async logic appears present without a visible catch path, which can leak runtime failures.',
      severity: 'high',
    });
  }

  if (normalized.includes('console.log')) {
    issues.push({
      title: 'Console logging may need cleanup',
      detail: 'Debug logging is useful during development, but production-safe structured logging is usually cleaner.',
      severity: 'medium',
    });
  }

  if (normalized.includes('fetch(') && normalized.includes('http://localhost')) {
    issues.push({
      title: 'Hard-coded local endpoint detected',
      detail: 'A local absolute URL is fine for development, but a config-driven base URL will be safer for deployment.',
      severity: 'medium',
    });
  }

  if (code.length > 2500 && !normalized.includes('function ') && !normalized.includes('class ')) {
    issues.push({
      title: 'Large block with limited structure hints',
      detail: 'This looks like a long file without obvious modular boundaries, which can make maintenance harder.',
      severity: 'low',
    });
  }

  improvements.push('Add explicit validation for inputs, required environment variables, and empty payload states.');

  if (!normalized.includes('try')) {
    improvements.push('Wrap network or async work in a guarded error path so failures can degrade gracefully.');
  }

  if (!normalized.includes('router') && normalized.includes('app.')) {
    improvements.push('Consider splitting route handling from business logic so the documentation and architecture stay easier to read.');
  }

  if (documentation && documentation.length < 350) {
    improvements.push('Ask the model for more implementation detail if you want deeper setup notes, architecture, or API coverage.');
  }

  if (meta.fallback) {
    improvements.push('Fallback demo mode is active, so adding a valid xAI key will improve the depth and specificity of the docs.');
  }

  const architecture = [
    { label: 'Source Code', detail: 'Raw code is pasted or loaded into the workspace' },
    { label: 'Backend Agent', detail: 'Express route packages the payload and triggers analysis' },
    { label: 'AI', detail: meta.fallback ? 'Fallback formatter is active while AI is unavailable' : 'Grok model synthesizes technical documentation' },
    { label: 'Documentation', detail: 'README-style output, score, fixes, and chat insight render in the UI' },
  ];

  let score = 82;
  score -= issues.filter((item) => item.severity === 'high').length * 8;
  score -= issues.filter((item) => item.severity === 'medium').length * 5;
  score -= issues.filter((item) => item.severity === 'low').length * 2;
  if (documentation.length > 900) score += 6;
  if (documentation.includes('## API Documentation')) score += 4;
  if (documentation.includes('## Setup Instructions')) score += 3;
  if (meta.fallback) score -= 7;
  score = Math.max(58, Math.min(98, score));

  let scoreLabel = 'Strong';
  if (score < 70) scoreLabel = 'Needs work';
  else if (score < 85) scoreLabel = 'Promising';
  else if (score >= 92) scoreLabel = 'Excellent';

  const summary = meta.fallback
    ? 'Fallback demo mode kept the experience live, and the workspace still extracted a readable technical summary.'
    : 'DocuMind combined backend generation with local analysis to surface bugs, structure improvements, and documentation quality.';

  return {
    issues,
    improvements,
    score,
    issueCount: issues.length,
    routeCount,
    scoreLabel,
    architecture,
    summary,
    hasValidSource: true,
    normalizedCode,
  };
}

function answerQuestion(question, code, documentation, analysis, meta) {
  if (!hasValidSourceCode(code)) {
    return EMPTY_CHAT_MESSAGE;
  }

  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return 'Ask about bugs, structure, architecture, endpoints, or documentation quality.';
  }

  if (normalized.includes('bug') || normalized.includes('error') || normalized.includes('issue')) {
    if (analysis.issues.length === 0) {
      return 'No major issues were inferred from the current paste, but I would still verify validation, async failures, and environment handling.';
    }

    return `Top issues: ${analysis.issues
      .slice(0, 3)
      .map((item) => item.title)
      .join(', ')}.`;
  }

  if (normalized.includes('improve') || normalized.includes('better') || normalized.includes('refactor')) {
    return analysis.improvements.slice(0, 3).join(' ');
  }

  if (normalized.includes('architecture') || normalized.includes('flow')) {
    return analysis.architecture.map((step) => `${step.label}: ${step.detail}`).join(' ');
  }

  if (normalized.includes('score') || normalized.includes('quality')) {
    return `The current documentation quality score is ${analysis.score}/100, labeled "${analysis.scoreLabel}". It reflects documentation coverage, detected code issues, and whether fallback mode is active.`;
  }

  if (normalized.includes('fallback') || normalized.includes('api fail')) {
    return meta.fallback
      ? 'Fallback demo mode is currently active, so the UI is showing clean locally generated docs while the backend hides provider warnings from the frontend.'
      : 'Fallback demo mode is available if the API fails, but the current session is using generated documentation successfully.';
  }

  if (normalized.includes('what does') || normalized.includes('what is') || normalized.includes('backend')) {
    if (documentation) {
      const firstHeading = documentation.split('\n').find((line) => line.trim() && !line.startsWith('#')) || documentation.slice(0, 180);
      return `Based on the generated documentation, this code is centered on: ${firstHeading}`;
    }

    if (code.toLowerCase().includes('/generate-docs')) {
      return 'This looks like a backend flow that accepts source code and produces documentation through a generation step.';
    }
  }

  if (normalized.includes('endpoint') || normalized.includes('route') || normalized.includes('api')) {
    const matches = [...code.matchAll(/\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi)];
    if (matches.length === 0) {
      return 'I could not confidently detect explicit routes in the current paste.';
    }

    return `Detected routes: ${matches
      .map((match) => `${match[1].toUpperCase()} ${match[2]}`)
      .join(', ')}.`;
  }

  return 'DocuMind can answer questions about bugs, improvements, architecture flow, routes, fallback mode, and documentation quality based on the pasted code and generated output.';
}

function getSeverityTone(severity) {
  if (severity === 'high') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
  }
  if (severity === 'medium') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }
  return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
}

function App() {
  const [code, setCode] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [meta, setMeta] = useState({ fallback: false, model: '', reason: '' });
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState(EMPTY_CHAT_MESSAGE);

  const analysis = buildAnalysis(code, documentation, meta);

  const resetOutputState = (message = null) => {
    setDocumentation('');
    setCopied(false);
    setMeta({ fallback: false, model: '', reason: '' });
    setChatQuestion('');
    setChatAnswer(EMPTY_CHAT_MESSAGE);
    setError(message);
  };

  const handleCodeChange = (event) => {
    const nextCode = event.target.value;
    setCode(nextCode);

    if (!hasValidSourceCode(nextCode)) {
      resetOutputState(null);
    }
  };

  const generateDocs = async () => {
    if (!code.trim() || code.trim().length < 20) {
      resetOutputState(EMPTY_INPUT_MESSAGE);
      return;
    }

    setLoading(true);
    setError(null);
    setDocumentation('');
    setCopied(false);
    setMeta({ fallback: false, model: '', reason: '' });

    try {
      const response = await fetch('http://localhost:5000/generate-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to generate documentation.';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          // Ignore JSON parse issues and keep the generic error.
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setDocumentation(data.docs || '');
      setMeta({
        fallback: Boolean(data.fallback),
        model: data.model || '',
        reason: data.reason || '',
      });
      setChatAnswer(
        data.fallback
          ? 'Fallback demo mode generated clean docs successfully. You can still inspect issues, score, and architecture from the current paste.'
          : 'Documentation is ready. Ask about bugs, route design, quality score, or improvement ideas.'
      );
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Backend server is not running on port 5000.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(documentation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([documentation], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'README.md';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const submitChatQuestion = (question = chatQuestion) => {
    if (!hasValidSourceCode(code)) {
      setChatQuestion(question);
      setChatAnswer(EMPTY_CHAT_MESSAGE);
      return;
    }

    const nextAnswer = answerQuestion(question, code, documentation, analysis, meta);
    setChatAnswer(nextAnswer);
    setChatQuestion(question);
  };

  const scoreRotation = Math.round((analysis.score / 100) * 360);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#07111f] text-slate-100 selection:bg-cyan-400/20">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_28%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.14),_transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_40px_120px_rgba(3,7,18,0.55)] backdrop-blur-2xl">
          <div className="grid gap-8 px-6 py-8 md:px-8 xl:grid-cols-[1.15fr_0.85fr] xl:px-10 xl:py-10">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100">
                <Sparkles size={16} className="text-cyan-300" />
                DocuMind AI Agent Workspace
              </div>

              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-400">
                    Debug. Improve. Document.
                  </p>
                  <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight text-white md:text-7xl">
                    Turn pasted code into a sharper, documented engineering handoff.
                  </h1>
                </div>
                <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  DocuMind now highlights bugs, suggests improvements, answers code questions, exposes
                  architecture flow, scores documentation quality, and falls back gracefully when the
                  AI provider is unavailable.
                </p>
              </div>

              <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                  <p className="text-slate-400">Detection Layer</p>
                  <p className="mt-2 font-medium text-white">Bugs, validation gaps, structure flags</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                  <p className="text-slate-400">Guidance Layer</p>
                  <p className="mt-2 font-medium text-white">Readable fixes and improvement prompts</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
                  <p className="text-slate-400">Delivery Layer</p>
                  <p className="mt-2 font-medium text-white">README docs, score, chat, fallback</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Quality Score</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{analysis.score}/100</p>
                </div>
                <div
                  className="grid h-28 w-28 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#22d3ee 0deg ${scoreRotation}deg, rgba(255,255,255,0.08) ${scoreRotation}deg 360deg)`,
                  }}
                >
                  <div className="grid h-21 w-21 place-items-center rounded-full bg-[#07111f] text-center">
                    <Gauge className="text-cyan-300" size={22} />
                    <span className="text-xs font-medium text-slate-300">{analysis.scoreLabel}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span>AI Model</span>
                  <span className="font-medium text-white">{meta.model || 'Pending generation'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span>Errors Detected</span>
                  <span className="font-medium text-white">{analysis.issueCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span>API Endpoints</span>
                  <span className="font-medium text-white">{analysis.routeCount}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span>Fallback Demo Mode</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      meta.fallback ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'
                    }`}
                  >
                    {meta.fallback ? 'Active' : 'Standby'}
                  </span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-slate-300">
                  <p className="text-sm text-slate-500">Workspace summary</p>
                  <p className="mt-2 leading-6 text-slate-200">{analysis.summary}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              icon: <Bug size={20} className="text-rose-300" />,
              title: 'Error Detection',
              desc: 'Detects missing validation, async failure gaps, hard-coded URLs, and weak structure hints in the pasted code.',
            },
            {
              icon: <Wand2 size={20} className="text-cyan-300" />,
              title: 'Suggested Improvements',
              desc: 'Turns analysis into practical engineering next steps instead of vague AI advice.',
            },
            {
              icon: <Bot size={20} className="text-indigo-300" />,
              title: 'Ask DocuMind Chatbot',
              desc: 'Lets the user ask questions about bugs, architecture, routes, score, and code purpose.',
            },
            {
              icon: <GitBranch size={20} className="text-emerald-300" />,
              title: 'System Architecture',
              desc: 'Shows the flow from source code to backend agent, AI processing, and final documentation.',
            },
            {
              icon: <Gauge size={20} className="text-amber-300" />,
              title: 'Documentation Quality Score',
              desc: 'Surfaces a score like 82/100 to make output quality easier to judge at a glance.',
            },
            {
              icon: <ShieldCheck size={20} className="text-fuchsia-300" />,
              title: 'Fallback Demo Mode',
              desc: 'If the API fails, the frontend still receives clean sample docs without noisy quota warnings.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">{item.icon}</div>
                <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{item.desc}</p>
            </div>
          ))}
        </section>

        <main className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Source Workspace</p>
                  <h2 className="mt-2 flex items-center gap-3 text-2xl font-semibold text-white">
                    <Terminal size={22} className="text-cyan-300" />
                    Paste code, then generate docs
                  </h2>
                </div>
                <button
                  onClick={generateDocs}
                  disabled={loading || !hasValidSourceCode(code)}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_20px_45px_rgba(34,211,238,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  {loading ? 'Analyzing code' : 'Generate documentation'}
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#08101b]">
                <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-4 py-3">
                  <div className="flex gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                    <FileCode2 size={14} />
                    source_input.js
                  </div>
                </div>

                <textarea
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="// Paste your code here..."
                  spellCheck="false"
                  className="h-[520px] w-full resize-none bg-transparent px-5 py-5 font-mono text-[14px] leading-7 text-slate-200 outline-none placeholder:text-slate-600"
                />
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <FileSearch size={20} className="text-rose-300" />
                  <h3 className="text-xl font-semibold text-white">Error Detection</h3>
                </div>
                <div className="mt-5 space-y-3">
                  {analysis.issues.length > 0 ? (
                    analysis.issues.map((issue) => (
                      <div key={issue.title} className={`rounded-2xl border px-4 py-4 ${getSeverityTone(issue.severity)}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{issue.title}</p>
                          <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]">
                            {issue.severity}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-current/85">{issue.detail}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-400">
                      Errors detected: 0
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <Wand2 size={20} className="text-cyan-300" />
                  <h3 className="text-xl font-semibold text-white">Suggested Improvements</h3>
                </div>
                <div className="mt-5 space-y-3">
                  {analysis.improvements.length > 0 ? (
                    analysis.improvements.map((item) => (
                      <div
                        key={item}
                        className="flex gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-4 text-sm leading-6 text-cyan-50"
                      >
                        <CheckCircle size={18} className="mt-1 shrink-0 text-cyan-200" />
                        <p>{item}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-400">
                      No improvement suggestions yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <GitBranch size={20} className="text-emerald-300" />
                <div>
                  <h3 className="text-xl font-semibold text-white">System Architecture Section</h3>
                  <p className="text-sm text-slate-400">
                    Source Code <ArrowRight className="inline-block" size={14} /> Backend Agent{' '}
                    <ArrowRight className="inline-block" size={14} /> AI <ArrowRight className="inline-block" size={14} /> Documentation
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                {analysis.architecture.map((step, index) => (
                  <div key={step.label} className="relative rounded-[1.35rem] border border-white/10 bg-slate-950/40 p-4">
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                      0{index + 1}
                    </div>
                    <p className="font-medium text-white">{step.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Generated Output</p>
                  <h2 className="mt-2 flex items-center gap-3 text-2xl font-semibold text-white">
                    <FileText size={22} className="text-indigo-300" />
                    README-style documentation
                  </h2>
                </div>

                {documentation && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                    >
                      {copied ? <CheckCircle size={16} className="text-emerald-300" /> : <Copy size={16} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      <Download size={16} />
                      Download
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  Quality score: <span className="font-semibold text-white">{analysis.score}/100</span>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  Errors: <span className="font-semibold text-white">{analysis.issueCount}</span>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  API endpoints: <span className="font-semibold text-white">{analysis.routeCount}</span>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  Status:{' '}
                  <span className={`font-semibold ${meta.fallback ? 'text-amber-200' : 'text-emerald-200'}`}>
                    {meta.fallback ? 'Fallback Demo Mode' : 'AI Generated'}
                  </span>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  Model: <span className="font-semibold text-white">{meta.model || 'Awaiting generation'}</span>
                </div>
              </div>

              <div className="mt-5 min-h-[640px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#08101b]">
                {loading ? (
                  <div className="flex h-full min-h-[640px] flex-col items-center justify-center gap-5 text-slate-300">
                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-5">
                      <Loader2 size={48} className="animate-spin text-cyan-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-medium text-white">Crafting documentation...</p>
                      <p className="mt-2 text-sm text-slate-400">
                        DocuMind is analyzing bugs, structure, and documentation quality.
                      </p>
                    </div>
                  </div>
                ) : documentation ? (
                  <div className="h-full overflow-y-auto p-7 prose prose-invert prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950/70 prose-code:text-cyan-200 max-w-none">
                    <ReactMarkdown>{documentation}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[640px] flex-col items-center justify-center px-6 text-center text-slate-500">
                    <FileText size={62} strokeWidth={1.1} className="text-slate-600" />
                    <p className="mt-5 text-xl text-slate-300">{EMPTY_OUTPUT_MESSAGE}</p>
                    <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                      Empty input keeps the workspace reset with score 0, errors 0, no stale docs, and no chatbot output.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-indigo-300" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Ask DocuMind Chatbot</h3>
                  <p className="text-sm text-slate-400">
                    Ask questions about the pasted code, current docs, architecture, or suggested fixes.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm leading-7 text-slate-200">{chatAnswer}</p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    value={chatQuestion}
                    onChange={(event) => setChatQuestion(event.target.value)}
                    placeholder="Ask about bugs, routes, fallback mode, or quality score..."
                    className="h-12 flex-1 rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/30"
                  />
                  <button
                    onClick={() => submitChatQuestion()}
                    disabled={!hasValidSourceCode(code)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                  >
                    <Bot size={16} />
                    Ask
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sampleQuestions.map((question) => (
                    <button
                      key={question}
                      onClick={() => submitChatQuestion(question)}
                      disabled={!hasValidSourceCode(code)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-amber-300" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Fallback Demo Mode</h3>
                  <p className="text-sm text-slate-400">
                    If the AI provider fails, the frontend still stays polished and useful.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-medium text-white">1. Backend catches provider failure</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Missing key, model issues, quota, and billing problems are logged server-side.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-medium text-white">2. Clean fallback docs return</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    The UI receives documentation content instead of exposing a provider warning to the user.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-sm font-medium text-white">3. Workspace still adds insight</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Score, bug checks, architecture, and chatbot answers remain available for the pasted code.
                  </p>
                </div>
              </div>

              {meta.reason && (
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  Active fallback reason: <span className="font-semibold">{meta.reason}</span>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
