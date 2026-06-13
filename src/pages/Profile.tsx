import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Swords, LogOut, User, Percent, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/supabase/api';
import { CHARACTERS } from '@/store/gameStore';
import type { MatchRecord } from '@/supabase/client';

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loadMatches, setLoadMatches] = useState(false);

  useEffect(() => {
    if (user) {
      setLoadMatches(true);
      api.getMatchHistory(user.id, 10).then(setMatches).finally(() => setLoadMatches(false));
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="w-screen h-screen bg-void overflow-hidden select-none flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-screen h-screen bg-void overflow-hidden select-none flex flex-col items-center justify-center">
        <User size={48} className="text-text-muted mb-4" />
        <p className="font-orbitron text-[18px] text-text-secondary mb-2">Not Signed In</p>
        <p className="font-rajdhani text-[14px] text-text-muted mb-6">Sign in to view your profile and stats</p>
        <button onClick={() => navigate('/auth')} className="h-11 px-8 rounded-xl bg-accent-cyan text-bg-dark font-rajdhani font-bold tracking-wider">
          SIGN IN
        </button>
        <button onClick={() => navigate('/')} className="mt-3 font-rajdhani text-[13px] text-text-muted hover:text-text-secondary transition-colors">Back to menu</button>
      </div>
    );
  }

  const mainChar = CHARACTERS.find((c) => c.id === user.main_character);
  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;

  const statCards = [
    { label: 'Wins', value: user.wins, icon: <Trophy size={18} />, color: '#00E5D4' },
    { label: 'Losses', value: user.losses, icon: <Swords size={18} />, color: '#E81D2D' },
    { label: 'Win Rate', value: `${winRate}%`, icon: <Percent size={18} />, color: '#FFB800' },
    { label: 'Rank', value: user.rank, icon: <Trophy size={18} />, color: '#4DA6FF' },
  ];

  return (
    <div className="w-screen h-screen bg-void overflow-hidden select-none flex flex-col">
      <motion.nav className="h-[10vh] flex-shrink-0 flex items-center px-4 relative z-10"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 font-orbitron font-bold text-[20px] tracking-wide text-text-primary">PROFILE</h1>
      </motion.nav>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="max-w-[480px] mx-auto">
          <motion.div className="bg-bg-elevated border border-border-subtle rounded-2xl p-5 mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-bg-dark border-2 flex items-center justify-center overflow-hidden"
                style={{ borderColor: mainChar?.accentColor || '#00E5D4' }}>
                {mainChar ? <img src={mainChar.image} alt="" className="w-full h-full object-cover" /> : <User size={28} className="text-text-muted" />}
              </div>
              <div>
                <h2 className="font-orbitron font-bold text-[18px] text-text-primary">{user.username}</h2>
                <p className="font-rajdhani text-[13px] text-text-muted">{mainChar?.name || 'No main character'} &middot; Rank {user.rank}</p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            {statCards.map((s, i) => (
              <motion.div key={s.label} className="bg-bg-elevated border border-border-subtle rounded-xl p-3 text-center"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
                <div className="font-orbitron font-bold text-[16px] text-text-primary">{s.value}</div>
                <div className="font-rajdhani text-[10px] text-text-muted uppercase tracking-wider">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div className="bg-bg-elevated border border-border-subtle rounded-2xl p-4 mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <h3 className="font-orbitron font-bold text-[14px] text-text-secondary mb-3 flex items-center gap-2">
              <Calendar size={14} /> RECENT MATCHES
            </h3>
            {loadMatches ? (
              <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" /></div>
            ) : matches.length === 0 ? (
              <p className="font-rajdhani text-[13px] text-text-muted text-center py-4">No matches yet</p>
            ) : (
              <div className="space-y-2">
                {matches.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                    <div className="font-rajdhani text-[13px] text-text-secondary">{m.stage} &middot; {m.duration_seconds}s</div>
                    <div className={`font-rajdhani font-bold text-[13px] ${m.winner_id === user.id ? 'text-[#00E5D4]' : 'text-[#E81D2D]'}`}>
                      {m.winner_id === user.id ? 'WIN' : 'LOSS'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.button onClick={async () => { await signOut(); navigate('/'); }}
            className="w-full h-11 rounded-xl border border-[#E81D2D40] text-[#FF6B6B] font-rajdhani font-bold tracking-wider flex items-center justify-center gap-2 hover:bg-[#E81D2D10] transition-colors"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.97 }}>
            <LogOut size={16} /> SIGN OUT
          </motion.button>
        </div>
      </div>
    </div>
  );
}
