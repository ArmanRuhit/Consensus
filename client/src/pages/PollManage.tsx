import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type PollAnalytics } from '../lib/api';
import socket from '../lib/socket';

export default function PollManage() {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<PollAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const analyticsRef = useRef(analytics);
  analyticsRef.current = analytics;

  async function load() {
    if (!shortId) return;
    try {
      const data = await api.getPollAnalytics(shortId);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (!socket.connected) socket.connect();

    function onResponseNew(data: { shortId: string }) {
      if (data.shortId !== shortId) return;
      load();
    }

    socket.on('response:new', onResponseNew);
    if (shortId) {
      socket.emit('poll:join', shortId);
    }

    return () => {
      socket.off('response:new', onResponseNew);
      if (shortId) socket.emit('poll:leave', shortId);
    };
  }, [shortId]);

  async function handlePublish() {
    if (!shortId) return;
    setPublishing(true);
    try {
      await api.publishPoll(shortId);
      await load();
    } catch {
      // ignore
    } finally {
      setPublishing(false);
    }
  }

  async function handleClose() {
    if (!shortId) return;
    setClosing(true);
    try {
      await api.closePoll(shortId);
      await load();
    } catch {
      // ignore
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-white" />;
  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-[#888888]">{error}</p>
    </div>
  );
  if (!analytics) return null;

  const stateLabel = analytics.state.charAt(0).toUpperCase() + analytics.state.slice(1);
  const stateColor = analytics.state === 'active' ? 'bg-green-50 text-green-700' :
    analytics.state === 'expired' ? 'bg-yellow-50 text-yellow-700' :
    'bg-purple-50 text-purple-700';

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-lg px-4 py-12">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 text-sm text-[#4A9FD8] hover:underline"
        >
          &larr; Back to Dashboard
        </button>

        <div className="rounded-xl border border-[#EEF0F2] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateColor}`}>
                {stateLabel}
              </span>
              <span className="text-xs text-[#888888]">
                {analytics.totalResponses} response{analytics.totalResponses !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {analytics.state === 'active' && (
                <button
                  onClick={handleClose}
                  disabled={closing}
                  className="rounded-full border border-[#EEF0F2] px-3 py-1.5 text-xs text-[#888888] hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
                >
                  {closing ? '...' : 'Close'}
                </button>
              )}
              {analytics.state === 'expired' && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="rounded-full bg-[#4A9FD8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3d8cc0] transition-colors disabled:opacity-50"
                >
                  {publishing ? '...' : 'Publish'}
                </button>
              )}
            </div>
          </div>

          <h1 className="mt-4 text-xl font-bold text-[#1A1A1A]">{analytics.title}</h1>
          {analytics.description && (
            <p className="mt-1 text-sm text-[#666666]">{analytics.description}</p>
          )}

          <div className="mt-2 text-xs text-[#8888888]">
            {analytics.responseMode === 'anonymous' ? 'Anonymous' : 'Authenticated'} &middot;{` `}
            {analytics.state === 'active' ? 'Expires' : 'Expired'} {new Date(analytics.expiresAt).toLocaleString()}
          </div>

          <div className="mt-8 space-y-8">
            {analytics.questions.map((q, qi) => (
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
