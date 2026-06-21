import { Routes, Route } from 'react-router'
import { lazy, Suspense, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useGameStore } from '@/store/gameStore'

const TitleScreen = lazy(() => import('./pages/TitleScreen'))
const CharacterSelect = lazy(() => import('./pages/CharacterSelect'))
const StageSelect = lazy(() => import('./pages/StageSelect'))
const Gameplay = lazy(() => import('./pages/Gameplay'))
const GameOver = lazy(() => import('./pages/GameOver'))
const Settings = lazy(() => import('./pages/Settings'))
const HowToPlay = lazy(() => import('./pages/HowToPlay'))
const Auth = lazy(() => import('./pages/Auth'))
const Profile = lazy(() => import('./pages/Profile'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const QueueScreen = lazy(() => import('./pages/QueueScreen'))
const LobbyScreen = lazy(() => import('./pages/LobbyScreen'))
const MegaManZero = lazy(() => import('./pages/MegaManZero'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-screen h-screen bg-void">
      <div className="font-orbitron font-bold text-xl text-text-primary animate-pulse tracking-wide">
        LOADING...
      </div>
    </div>
  )
}

function AuthSync() {
  const { user, loading } = useAuth();
  const setUser = useGameStore((s) => s.setUser);
  useEffect(() => {
    if (!loading) setUser(user);
  }, [user, loading, setUser]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthSync />
      <Routes>
        <Route path="/" element={<TitleScreen />} />
        <Route path="/select" element={<CharacterSelect />} />
        <Route path="/stage" element={<StageSelect />} />
        <Route path="/play" element={<Gameplay />} />
        <Route path="/result" element={<GameOver />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tutorial" element={<HowToPlay />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/queue" element={<QueueScreen />} />
        <Route path="/lobby" element={<LobbyScreen />} />
        <Route path="/mmz" element={<MegaManZero />} />
      </Routes>
    </Suspense>
  )
}
