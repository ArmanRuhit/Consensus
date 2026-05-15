import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { api, type PollSummary } from '../lib/api';
import socket from '../lib/socket';

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function useCopyTimer() {
  const [copied, setCopied] = useState(false);
  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return { copied, handleCopy };
}

interface QuestionDraft {
  text: string;
  isMandatory: boolean;
  options: { text: string }[];
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'create' | 'mypolls'>('create');

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-[#EEF0F2] px-8 py-4">
        <h1 className="text-xl font-bold text-[#1A1A1A]">Consensus</h1>
        <div className="flex items-center gap-4">
          <a href="https://github.com/ArmanRuhit/Consensus" target="_blank" rel="noopener noreferrer" className="text-[#888888] hover:text-[#1A1A1A] transition-colors">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <span className="text-sm text-[#666666]">{user?.name}</span>
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="rounded-full border border-[#EEF0F2] px-4 py-1.5 text-sm text-[#666666] hover:bg-[#F7F8FA] transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-6 flex gap-1 rounded-lg bg-[#F7F8FA] p-1">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === 'create' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#888888] hover:text-[#1A1A1A]'}`}
          >
            Create Poll
          </button>
          <button
            onClick={() => setTab('mypolls')}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === 'mypolls' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#888888] hover:text-[#1A1A1A]'}`}
          >
            My Polls
          </button>
        </div>

        {tab === 'create' ? (
          <div className="animate-fade-in"><CreatePollForm /></div>
        ) : (
          <div className="animate-fade-in"><MyPollsList /></div>
        )}
      </div>
    </div>
  );
}

function CreatePollForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responseMode, setResponseMode] = useState<'anonymous' | 'authenticated'>('anonymous');
  const [expiresAt, setExpiresAt] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { text: '', isMandatory: true, options: [{ text: '' }, { text: '' }] },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdUrl, setCreatedUrl] = useState('');
  const { copied, handleCopy } = useCopyTimer();

  function updateQuestion(qi: number, field: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, ...field } : q)));
  }

  function updateOption(qi: number, oi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, text } : o)) } : q,
      ),
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, options: [...q.options, { text: '' }] } : q)));
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q)),
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { text: '', isMandatory: true, options: [{ text: '' }, { text: '' }] }]);
  }

  function removeQuestion(qi: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Title is required'); return; }
    if (!expiresAt) { setError('Expiry date is required'); return; }
    if (new Date(expiresAt) <= new Date()) { setError('Expiry must be in the future'); return; }

    const cleaned = questions
      .map((q) => ({ ...q, text: q.text.trim(), options: q.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim() })) }))
      .filter((q) => q.text);

    if (cleaned.length === 0) { setError('At least one question with text is required'); return; }
    for (const q of cleaned) {
      if (q.options.length < 2) { setError(`Question "${q.text}" needs at least 2 options`); return; }
    }

    setSubmitting(true);
    try {
      const result = await api.createPoll({
        title: title.trim(),
        description: description.trim() || undefined,
        responseMode,
        expiresAt: new Date(expiresAt).toISOString(),
        questions: cleaned,
      });
      setCreatedUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setSubmitting(false);
    }
  }

  if (createdUrl) {
    return (
      <div className="rounded-xl border border-[#EEF0F2] p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Poll created!</h1>
        <p className="mt-1 text-xs text-[#888888]">Share this link to collect responses:</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#EEF0F2] bg-[#F7F8FA] px-4 py-3">
          <span className="flex-1 truncate text-sm text-[#1A1A1A] text-left">{createdUrl}</span>
          <button
            onClick={() => handleCopy(createdUrl)}
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-[#666666] border border-[#EEF0F2] hover:bg-[#F7F8FA] transition-colors"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-green-600">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </span>
            ) : 'Copy'}
          </button>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(`/p/${createdUrl.split('/').pop()}/manage`)}
            className="flex-1 rounded-full bg-[#4A9FD8] py-3 text-sm font-semibold text-white hover:bg-[#3d8cc0] transition-colors"
          >
            View analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#EEF0F2] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="text-xl font-bold text-[#1A1A1A]">Create Poll</h2>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-[#666666]">Title</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What team offsite?"
            className="mt-1.5 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-[#888888] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]" />
        </div>

        <div>
          <label className="text-xs font-medium text-[#666666]">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pick your top venue. Closes Friday." rows={3}
            className="mt-1.5 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-[#888888] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8] resize-none" />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-[#666666]">Response mode</label>
            <select value={responseMode} onChange={(e) => setResponseMode(e.target.value as 'anonymous' | 'authenticated')}
              className="mt-1.5 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]">
              <option value="anonymous">Anonymous</option>
              <option value="authenticated">Authenticated</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-[#666666]">Expiry date & time</label>
            <input type="datetime-local" required value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1.5 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]" />
          </div>
        </div>

        <div className="border-t border-[#EEF0F2] pt-5">
          <div className="space-y-6">
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-lg border border-[#EEF0F2] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1A1A1A]">Question {qi + 1}</span>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(qi)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                </div>
                <input type="text" value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} placeholder="Which city?"
                  className="mt-2 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-[#888888] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]" />
                <div className="mt-3 space-y-2">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="text" value={o.text} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`}
                        className="block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2 text-sm text-[#1A1A1A] placeholder-[#888888] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]" />
                      {q.options.length > 2 && (
                        <button type="button" onClick={() => removeOption(qi, oi)} className="text-xs text-red-400 hover:text-red-600 shrink-0">×</button>
                      )}
                    </div>
                  ))}
                </div>
                {q.options.length < 10 && (
                  <button type="button" onClick={() => addOption(qi)}
                    className="mt-2 w-full rounded-md border border-dashed border-[#EEF0F2] px-3 py-2 text-sm text-[#888888] hover:bg-[#F7F8FA] transition-colors">+ Add option</button>
                )}
                <label className="mt-3 flex items-center gap-2 text-sm text-[#666666]">
                  <input type="checkbox" checked={q.isMandatory} onChange={(e) => updateQuestion(qi, { isMandatory: e.target.checked })} className="h-4 w-4 accent-[#4A9FD8]" />
                  Mandatory
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={addQuestion}
            className="mt-4 w-full rounded-md border border-dashed border-[#EEF0F2] px-3 py-2 text-sm text-[#888888] hover:bg-[#F7F8FA] transition-colors">+ Add question</button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={submitting}
        className="mt-6 w-full rounded-full bg-[#4A9FD8] py-3 text-sm font-semibold text-white hover:bg-[#3d8cc0] transition-colors disabled:opacity-50">
        {submitting ? 'Creating...' : 'Create Poll'}
      </button>
    </form>
  );
}

function MyPollsList() {
  const navigate = useNavigate();
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const joinedRef = useRef<Set<string>>(new Set());
  const connectedRef = useRef(false);
  const pollsRef = useRef(polls);
  pollsRef.current = polls;

  async function load() {
    try {
      const data = await api.getMyPolls();
      setPolls(data);
    } catch {
      // handled by redirect from api
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    connectedRef.current = false;
    if (!socket.connected) socket.connect();

    function onConnect() {
      connectedRef.current = true;
      for (const p of pollsRef.current) {
        if (!joinedRef.current.has(p.shortId)) {
          joinedRef.current.add(p.shortId);
          socket.emit('poll:join', p.shortId);
        }
      }
    }

    function onResponseNew(data: { shortId: string }) {
      setHighlightedId(data.shortId);
      setTimeout(() => setHighlightedId(null), 2000);
      setPolls((prev) =>
        prev.map((p) =>
          p.shortId === data.shortId ? { ...p, responseCount: p.responseCount + 1 } : p,
        ),
      );
    }

    function onPollState(data: { shortId: string; state: string }) {
      setPolls((prev) =>
        prev.map((p) =>
          p.shortId === data.shortId ? { ...p, state: data.state as PollSummary['state'] } : p,
        ),
      );
    }

    socket.on('connect', onConnect);
    socket.on('response:new', onResponseNew);
    socket.on('poll:state', onPollState);
    return () => {
      socket.off('connect', onConnect);
      socket.off('response:new', onResponseNew);
      socket.off('poll:state', onPollState);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (connectedRef.current) {
      for (const p of polls) {
        if (!joinedRef.current.has(p.shortId)) {
          joinedRef.current.add(p.shortId);
          socket.emit('poll:join', p.shortId);
        }
      }
    }
  }, [polls]);

  async function handlePublish(shortId: string) {
    setPublishing(shortId);
    try {
      await api.publishPoll(shortId);
      await load();
    } catch {
      // ignore
    } finally {
      setPublishing(null);
    }
  }

  async function handleClose(shortId: string) {
    setClosing(shortId);
    try {
      await api.closePoll(shortId);
      await load();
    } catch {
      // ignore
    } finally {
      setClosing(null);
    }
  }

  if (loading) return <div className="text-center text-sm text-[#888888] py-12">Loading...</div>;

  if (polls.length === 0) {
    return (
      <div className="rounded-xl border border-[#EEF0F2] p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-sm text-[#888888]">You haven't created any polls yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {polls.map((p) => (
        <div key={p.shortId} className={`rounded-xl border border-[#EEF0F2] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all ${highlightedId === p.shortId ? 'animate-flash' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.state === 'active' ? 'bg-green-50 text-green-700' :
                  p.state === 'expired' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-purple-50 text-purple-700'
                }`}>
                  {p.state.charAt(0).toUpperCase() + p.state.slice(1)}
                </span>
                <span className="text-xs text-[#888888]">{p.responseCount} response{p.responseCount !== 1 ? 's' : ''}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#1A1A1A] truncate">{p.title}</p>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <button onClick={() => { copyToClipboard(`${window.location.origin}/p/${p.shortId}`); setCopiedId(p.shortId); setTimeout(() => setCopiedId(null), 1500); }}
                className="rounded-full border border-[#EEF0F2] px-3 py-1.5 text-xs text-[#666666] hover:bg-[#F7F8FA] transition-colors">
                {copiedId === p.shortId ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </span>
                ) : 'Copy Link'}
              </button>
              <button onClick={() => navigate(`/p/${p.shortId}/manage`)}
                className="rounded-full border border-[#EEF0F2] px-3 py-1.5 text-xs text-[#666666] hover:bg-[#F7F8FA] transition-colors">
                View
              </button>
              {p.state === 'expired' && (
                <button onClick={() => handlePublish(p.shortId)} disabled={publishing === p.shortId}
                  className="rounded-full bg-[#4A9FD8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3d8cc0] transition-colors disabled:opacity-50">
                  {publishing === p.shortId ? '...' : 'Publish'}
                </button>
              )}
              {p.state === 'active' && (
                <button onClick={() => handleClose(p.shortId)} disabled={closing === p.shortId}
                  className="rounded-full border border-[#EEF0F2] px-3 py-1.5 text-xs text-[#888888] hover:bg-[#F7F8FA] transition-colors disabled:opacity-50">
                  {closing === p.shortId ? '...' : 'Close'}
                </button>
              )}
              {p.state === 'published' && (
                <span className="text-xs text-[#888888]">Published</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
