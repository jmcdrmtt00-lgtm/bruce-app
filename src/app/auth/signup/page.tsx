'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/libs/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created! Check your email to confirm.');
      router.push('/auth/login');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body">
          <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
          <p className="text-base-content/60 text-center text-sm mb-4">Bruce IT Onboarding</p>
          <form onSubmit={handleSignup} className="space-y-4">
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
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Confirm Password</span></label>
              <input
                className="input input-bordered w-full"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm mt-4">
            Already have an account?{' '}
            <Link href="/auth/login" className="link link-primary">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
