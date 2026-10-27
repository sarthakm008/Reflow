import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react';

export default function AuthView({ onAuthenticate, onContinueAsGuest, onBack }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await onAuthenticate({ mode, name, email, password }); }
    catch (err) { setError(err.message || 'Could not authenticate. Check that the Reflow API is running.'); }
    finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <button onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4"/> Back to Reflow</button>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-8">
        <div className="mb-7 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 font-mono text-xl font-black text-slate-950">R</div><div><h1 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p className="mt-1 text-sm text-slate-400">Plan realistically. Recover intelligently.</p></div></div>
        <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-800 p-1"><button type="button" onClick={() => { setMode('login'); setError(''); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Sign in</button><button type="button" onClick={() => { setMode('register'); setError(''); }} className={`rounded-md px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Create account</button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && <label className="block text-sm font-medium text-slate-300">Name<div className="relative mt-1.5"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"/><input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-white outline-none focus:border-emerald-400" placeholder="Your name"/></div></label>}
          <label className="block text-sm font-medium text-slate-300">Email<div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"/><input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-white outline-none focus:border-emerald-400" placeholder="you@example.com"/></div></label>
          <label className="block text-sm font-medium text-slate-300">Password<div className="relative mt-1.5"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"/><input required type={showPassword ? 'text' : 'password'} minLength={mode === 'register' ? 8 : 1} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-11 text-white outline-none focus:border-emerald-400" placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}/><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-200">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></label>
          {error && <div role="alert" className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2.5 text-sm text-rose-300">{error}</div>}
          <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin"/>}{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-slate-600"><span className="h-px flex-1 bg-slate-800"/>or<span className="h-px flex-1 bg-slate-800"/></div>
        <button onClick={onContinueAsGuest} className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:text-white">Continue as guest on this device</button>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">An account lets Reflow save your tasks and focus history to your account. Guest data stays in this browser.</p>
      </div>
    </div>
  </div>;
}
