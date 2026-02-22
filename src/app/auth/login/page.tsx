'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { supabase } from '@/libs/supabase';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      router.push(redirect);
    }
    setLoading(false);
  }

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body">
        <h1 className="text-2xl font-bold text-center mb-2">Sign In</h1>
        <p className="text-base-content/60 text-center text-sm mb-4">IT Buddy</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Email</span></label>
            <input
              className="input input-bordered w-full"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text font-semibold">Password</span></label>
            <input
              className="input input-bordered w-full"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          No account?{' '}
          <Link href="/auth/signup" className="link link-primary">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <Suspense fallback={<div className="loading loading-spinner loading-lg" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
