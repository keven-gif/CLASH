import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/supabase/client';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // BUG 1 FIX: Navigate when user becomes truthy (after async auth state update)
  // instead of navigating immediately after signIn() resolves
  useEffect(() => {
    if (user) {
      const redirect = searchParams.get('redirect') || '/lobby';
      navigate(redirect);
    }
  }, [user, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (forgotMode) {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/#/auth' });
        setResetSent(true);
        setLoading(false);
        return;
      }
      if (mode === 'signup') {
        await signUp(email, password, username);
        setEmailSent(true);
        setLoading(false);
        return;
      }
      await signIn(email, password);
      // Navigation is handled by the useEffect above — DO NOT navigate here
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Check your email and password.');
    }
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="w-screen h-screen bg-void flex flex-col items-center justify-center p-6 select-none">
        <Mail size={48} className="text-accent-cyan mb-4" />
        <h2 className="font-orbitron font-bold text-[22px] text-text-primary mb-2">CHECK YOUR EMAIL</h2>
        <p className="font-rajdhani text-[15px] text-text-secondary text-center max-w-[320px] mb-6">
          We sent a confirmation link to <span className="text-accent-cyan">{email}</span>. Click it to activate your account.
        </p>
        <button
          onClick={() => { setEmailSent(false); setMode('login'); }}
          className="font-rajdhani text-[14px] text-text-muted hover:text-accent-cyan transition-colors"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className="w-screen h-screen bg-void flex flex-col items-center justify-center p-6 select-none">
        <Mail size={48} className="text-accent-cyan mb-4" />
        <h2 className="font-orbitron font-bold text-[22px] text-text-primary mb-2">RESET EMAIL SENT</h2>
        <p className="font-rajdhani text-[15px] text-text-secondary text-center max-w-[320px] mb-6">
          Check <span className="text-accent-cyan">{email}</span> for a password reset link.
        </p>
        <button
          onClick={() => { setResetSent(false); setForgotMode(false); }}
          className="font-rajdhani text-[14px] text-text-muted hover:text-accent-cyan transition-colors"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-void overflow-hidden select-none flex flex-col md:flex-row">
      {/* Brand Side */}
      <motion.div
        className="flex-shrink-0 md:flex-1 flex flex-col items-center justify-center bg-bg-elevated border-r border-border-subtle p-6 md:p-12"
        initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Zap size={48} className="text-accent-cyan mb-4" />
        <h1 className="font-orbitron font-black text-[32px] md:text-[48px] tracking-logo text-text-primary">
          CLASH
        </h1>
        <p className="font-rajdhani font-semibold text-[16px] text-text-secondary mt-2 tracking-widest">
          ONLINE
        </p>
        <p className="font-rajdhani text-[14px] text-text-muted mt-4 text-center max-w-[280px]">
          Battle fighters from around the world in real-time PvP combat.
        </p>
      </motion.div>

      {/* Form Side */}
      <motion.div
        className="flex-1 flex flex-col items-center justify-center p-6 md:p-12"
        initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="font-orbitron font-bold text-[22px] text-text-primary mb-6">
          {forgotMode ? 'RESET PASSWORD' : mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
        </h2>

        {error && (
          <motion.div
            className="mb-4 px-4 py-2 rounded-lg bg-[#E81D2D20] border border-[#E81D2D40] text-[#FF6B6B] font-rajdhani text-[14px] text-center max-w-[360px] w-full"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="w-full max-w-[360px] space-y-4">
          {mode === 'signup' && !forgotMode && (
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary font-rajdhani text-[16px] placeholder:text-text-muted focus:border-accent-cyan focus:outline-none transition-colors"
                required
              />
            </div>
          )}
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary font-rajdhani text-[16px] placeholder:text-text-muted focus:border-accent-cyan focus:outline-none transition-colors"
              required
            />
          </div>
          {!forgotMode && (
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary font-rajdhani text-[16px] placeholder:text-text-muted focus:border-accent-cyan focus:outline-none transition-colors"
                required minLength={6}
              />
            </div>
          )}

          <motion.button
            type="submit" disabled={loading}
            className="w-full h-12 rounded-xl bg-accent-cyan text-bg-dark font-rajdhani font-bold text-[18px] tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-bg-dark/30 border-t-bg-dark rounded-full animate-spin" />
            ) : forgotMode ? (
              <>SEND RESET LINK <ArrowRight size={18} /></>
            ) : (
              <>{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'} <ArrowRight size={18} /></>
            )}
          </motion.button>
        </form>

        {!forgotMode && (
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            className="mt-6 font-rajdhani text-[14px] text-text-muted hover:text-accent-cyan transition-colors"
          >
            {mode === 'login' ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        )}

        {mode === 'login' && !forgotMode && (
          <button
            onClick={() => { setForgotMode(true); setError(''); }}
            className="mt-2 font-rajdhani text-[13px] text-text-muted/70 hover:text-text-muted transition-colors"
          >
            Forgot password?
          </button>
        )}

        {forgotMode && (
          <button
            onClick={() => { setForgotMode(false); setError(''); }}
            className="mt-6 font-rajdhani text-[14px] text-text-muted hover:text-accent-cyan transition-colors"
          >
            Back to sign in
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-3 font-rajdhani text-[13px] text-text-muted/60 hover:text-text-muted transition-colors"
        >
          Back to menu
        </button>
      </motion.div>
    </div>
  );
}
