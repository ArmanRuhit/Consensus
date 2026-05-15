import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type PollResponse, type ActivePoll, type PublishedPoll } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function PollPage() {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [poll, setPoll] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shortId) return;
    api.fetchPoll(shortId).then(setPoll).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [shortId]);

  if (loading || authLoading) return <div className="flex min-h-screen items-center justify-center bg-white" />;
  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-[#888888]">{error}</p>
    </div>
  );
  if (!poll) return null;

  if (poll.state === 'active' && poll.responseMode === 'authenticated' && !user) {
    navigate(`/login?redirect=/p/${shortId}`, { replace: true });
    return null;
  }

  if (poll.state === 'active') return <PollForm poll={poll} />;
  if (poll.state === 'expired') return <PollExpired poll={poll} />;
  return <PollResults poll={poll} />;
}

type Selections = Record<string, string>;

function PollForm({ poll }: { poll: ActivePoll }) {
  const [selections, setSelections] = useState<Selections>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { shortId } = useParams<{ shortId: string }>();

  function setSelection(questionId: string, optionId: string) {
    setSelections((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shortId) return;

    const missingMandatory = poll.questions
      .filter((q) => q.isMandatory && !selections[q.id])
      .map((q) => q.text);
    if (missingMandatory.length > 0) {
      setError(`Please answer: ${missingMandatory.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const answers = Object.entries(selections).map(([questionId, selectedOptionId]) => ({
        questionId,
        selectedOptionId,
      }));
      await api.submitResponse(shortId, { answers });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return <PollConfirmation poll={poll} />;

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-white">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-xl border border-[#EEF0F2] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">Open</span>
            <span className="text-xs text-[#888888]">
              Expires {new Date(poll.expiresAt).toLocaleString()}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{poll.title}</h1>
          {poll.description && <p className="mt-1 text-sm text-[#666666]">{poll.description}</p>}

          <div className="mt-8 space-y-8">
            {poll.questions.map((q, qi) => (
              <div key={q.id}>
                <p className="text-sm font-medium text-[#1A1A1A]">
                  {qi + 1}. {q.text}
                  {q.isMandatory && <span className="ml-0.5 text-red-400">*</span>}
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#EEF0F2] px-4 py-3 text-sm text-[#1A1A1A] hover:bg-[#F7F8FA] transition-colors has-checked:border-[#4A9FD8] has-checked:bg-[#F0F7FD]"
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={o.id}
                        checked={selections[q.id] === o.id}
                        onChange={() => setSelection(q.id, o.id)}
                        className="h-4 w-4 accent-[#4A9FD8]"
                      />
                      {o.text}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-full bg-[#4A9FD8] py-3 text-sm font-semibold text-white hover:bg-[#3d8cc0] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PollConfirmation({ poll }: { poll: ActivePoll }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm rounded-xl border border-[#EEF0F2] p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Response recorded</h1>
        <p className="mt-2 text-sm text-[#666666]">Your answers for "{poll.title}" have been submitted.</p>

        <div className="mt-8 border-t border-[#EEF0F2] pt-6">
          <p className="text-sm font-medium text-[#1A1A1A]">Want to create your own poll?</p>
          <p className="mt-1 text-xs text-[#888888]">Sign up or log in to start collecting responses in minutes.</p>
          <a
            href="/login"
            className="mt-4 inline-block w-full rounded-full bg-[#4A9FD8] py-3 text-sm font-semibold text-white hover:bg-[#3d8cc0] transition-colors"
          >
            Create a Poll
          </a>
        </div>
      </div>
    </div>
  );
}

function PollExpired({ poll }: { poll: { title: string; description: string | null } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm rounded-xl border border-[#EEF0F2] p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="text-xl font-bold text-[#1A1A1A]">{poll.title}</h1>
        {poll.description && <p className="mt-1 text-sm text-[#666666]">{poll.description}</p>}
        <p className="mt-6 text-sm text-[#888888]">This poll has ended.</p>
      </div>
    </div>
  );
}

function PollResults({ poll }: { poll: PublishedPoll }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-xl border border-[#EEF0F2] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">Published</span>
            <span className="text-xs text-[#888888]">{poll.totalResponses} response{poll.totalResponses !== 1 ? 's' : ''}</span>
          </div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{poll.title}</h1>
          {poll.description && <p className="mt-1 text-sm text-[#666666]">{poll.description}</p>}

          <div className="mt-8 space-y-8">
            {poll.questions.map((q, qi) => (
              <div key={q.id}>
                <p className="text-sm font-medium text-[#1A1A1A]">
                  {qi + 1}. {q.text}
                  <span className="ml-1 text-xs text-[#888888]">({q.totalAnswered})</span>
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((o) => (
                    <div key={o.id} className="rounded-lg border border-[#EEF0F2] px-4 py-3">
                      <div className="flex items-center justify-between text-sm text-[#1A1A1A]">
                        <span>{o.text}</span>
                        <span className="text-xs text-[#888888]">{o.count} ({o.percentage}%)</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-[#F7F8FA]">
                        <div
                          className="h-2 rounded-full bg-[#4A9FD8] transition-all"
                          style={{ width: `${o.percentage ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
