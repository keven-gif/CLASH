import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Crown, Medal } from 'lucide-react';
import { api } from '@/supabase/api';
import type { Profile } from '@/supabase/client';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard(50).then((data) => {
      setPlayers(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const rankIcon = (rank: number) => {
    if (rank === 0) return <Crown size={16} className="text-[#FFB800]" />;
    if (rank === 1) return <Medal size={16} className="text-[#C0C0C0]" />;
    if (rank === 2) return <Medal size={16} className="text-[#CD7F32]" />;
    return <span className="font-orbitron text-[12px] text-text-muted w-4 text-center">{rank + 1}</span>;
  };

  const rankBorder = (rank: number) => {
    if (rank === 0) return 'border-[#FFB800]/40 bg-[#FFB800]/5';
    if (rank === 1) return 'border-[#C0C0C0]/30 bg-[#C0C0C0]/3';
    if (rank === 2) return 'border-[#CD7F32]/30 bg-[#CD7F32]/3';
    return 'border-border-subtle bg-bg-elevated';
  };

  return (
    <div className="w-screen h-screen bg-void overflow-hidden select-none flex flex-col">
      <motion.nav className="h-[10vh] flex-shrink-0 flex items-center px-4 relative z-10"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <Trophy size={20} className="text-[#FFB800]" />
          <h1 className="font-orbitron font-bold text-[20px] tracking-wide text-text-primary">LEADERBOARD</h1>
        </div>
      </motion.nav>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-[480px] mx-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-12">
              <Trophy size={40} className="text-text-muted mx-auto mb-3" />
              <p className="font-orbitron text-[14px] text-text-secondary">No players yet</p>
              <p className="font-rajdhani text-[13px] text-text-muted mt-1">Be the first to climb the ranks!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((p, i) => {
                const total = p.wins + p.losses;
                const rate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
                return (
                  <motion.div key={p.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${rankBorder(i)}`}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <div className="w-6 flex justify-center">{rankIcon(i)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-rajdhani font-semibold text-[14px] text-text-primary truncate">{p.username}</div>
                      <div className="font-rajdhani text-[11px] text-text-muted">{p.wins}W / {p.losses}L</div>
                    </div>
                    <div className="text-right">
                      <div className="font-orbitron font-bold text-[14px] text-accent-cyan">{p.rank}</div>
                      <div className="font-rajdhani text-[11px] text-text-muted">{rate}% WR</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
