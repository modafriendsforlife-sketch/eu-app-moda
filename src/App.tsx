import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import OpeningScreen from '@/components/OpeningScreen';
import HomePage from '@/components/HomePage';
import { requestPushPermissionAndSaveSubscription } from '@/pushNotifications';
import { shouldShowPermissionBanner, requestNotificationPermission } from '@/lib/notificationEngine';
import { supabase } from '@/lib/supabaseClient';

type Screen = 'opening' | 'home';
type OpeningMode = 'signup' | 'login' | 'forgot' | null;

function App() {
  const [screen, setScreen] = useState<Screen>('opening');
  const [openingMode, setOpeningMode] = useState<OpeningMode>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isFirstSignup, setIsFirstSignup] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session?.user) return;
      setUserName(session.user.user_metadata?.display_name ?? '');
      setUserEmail(session.user.email ?? '');
      setScreen('home');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setOpeningMode('forgot');
        setScreen('opening');
        return;
      }
      if (event === 'SIGNED_OUT') {
        setUserName('');
        setUserEmail('');
        setScreen('opening');
        setOpeningMode(null);
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        setUserName(session.user.user_metadata?.display_name ?? '');
        setUserEmail(session.user.email ?? '');
        setScreen('home');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (screen === 'home' && shouldShowPermissionBanner()) {
      setShowNotifBanner(true);
    }
  }, [screen]);

  const handleActivateNotifications = async () => {
    await requestNotificationPermission();
    void requestPushPermissionAndSaveSubscription();
    setShowNotifBanner(false);
  };

  const handleEnter = (name: string, email: string, isSignup: boolean) => {
    setUserName(name);
    setUserEmail(email);
    setIsFirstSignup(isSignup);
    setOpeningMode(null);
    setScreen('home');
    void requestPushPermissionAndSaveSubscription();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-offwhite">
      {screen === 'opening' && (
        <OpeningScreen onEnter={handleEnter} initialMode={openingMode} />
      )}
      {screen === 'home' && (
        <HomePage
          userName={userName}
          userEmail={userEmail}
          onBack={() => undefined}
          onLogout={handleLogout}
          isFirstSignup={isFirstSignup}
          onQuestionnaireDone={() => setIsFirstSignup(false)}
        />
      )}

      {showNotifBanner && screen === 'home' && (
        <div className="fixed top-0 left-0 right-0 z-[90] animate-fade-in-down">
          <div className="max-w-2xl mx-auto mt-4 mx-4 bg-white rounded-2xl shadow-xl border border-magenta/15 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-magenta" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-magenta text-sm">Ativar notificações?</p>
              <p className="text-xs text-grafite mt-0.5">Receba lembretes de hidratação, compromissos e prazos em tempo real.</p>
            </div>
            <button type="button" onClick={handleActivateNotifications} className="shrink-0 bg-magenta hover:bg-magenta-dark text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors">
              Ativar
            </button>
            <button type="button" onClick={() => setShowNotifBanner(false)} aria-label="Dispensar" className="shrink-0 w-7 h-7 rounded-full hover:bg-grafite/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-grafite/60" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
