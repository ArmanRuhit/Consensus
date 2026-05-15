import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm rounded-xl border border-[#EEF0F2] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Consensus</h1>
          <p className="mt-1 text-sm text-[#888888]">Sign in to your account</p>
          <a href="https://github.com/ArmanRuhit/Consensus" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[#888888] hover:text-[#1A1A1A] transition-colors">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            ArmanRuhit/Consensus
          </a>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-[#666666]">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-[#888888] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#666666]">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1.5 block w-full rounded-md border border-[#EEF0F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder-[#888888] outline-none focus:border-[#4A9FD8] focus:ring-1 focus:ring-[#4A9FD8]"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-full bg-[#4A9FD8] py-3 text-sm font-semibold text-white hover:bg-[#3d8cc0] transition-colors"
          >
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#888888]">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-[#4A9FD8] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
