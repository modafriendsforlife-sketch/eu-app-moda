import { useState, useEffect, useRef, useCallback } from 'react';
import { PHASE_CONFIGS, type PhaseConfig, type PlannerCategoryDef } from './phaseConfigs';
import { showReminderNotification } from '@/pushNotifications';

const NOTIF_PREF_KEY = 'minha-jornada-notif-permission-asked';
const NOTIF_SENT_KEY = 'minha-jornada-notif-sent';

interface PlannerEvent { id: string; date: string; title: string; time: string; category: string; }
interface FinancialGoal { id: string; title: string; targetAmount: number; savedAmount: number; deadline: string; }

function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };
    beep(800, 0, 0.15);
    beep(1000, 0.2, 0.15);
    beep(800, 0.4, 0.15);
    ctx.close?.();
  } catch { /* AudioContext unavailable */ }
}

function fireNotification(title: string, body: string) {
  playAlertSound();
  void showReminderNotification(title, body, `minha-jornada-${title}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/assets/logo_nova_Moda_Friends.png' }); } catch { /* */ }
  }
}

function getSentAlerts(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIF_SENT_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}

function markAlertSent(id: string) {
  const sent = getSentAlerts(); sent.add(id);
  try { localStorage.setItem(NOTIF_SENT_KEY, JSON.stringify([...sent])); } catch { /* */ }
}

function getEventDatetime(event: PlannerEvent): Date {
  const date = new Date(`${event.date}T00:00:00`);
  const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

interface ActiveNotification { id: string; title: string; body: string; icon: string; }

export function useStudyNotifications(config: PhaseConfig) {
  const [permissionAsked, setPermissionAsked] = useState(() => localStorage.getItem(NOTIF_PREF_KEY) === 'true');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [activeNotifications, setActiveNotifications] = useState<ActiveNotification[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  const dismissNotification = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setActiveNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const requestPermission = useCallback(async () => {
    localStorage.setItem(NOTIF_PREF_KEY, 'true');
    setPermissionAsked(true);
    setShowPermissionBanner(false);
    if ('Notification' in window && Notification.permission !== 'granted') {
      try { await Notification.requestPermission(); } catch { /* */ }
    }
  }, []);

  const checkAllTriggers = useCallback(() => {
    const now = new Date();
    const sent = getSentAlerts();
    const newNotifs: ActiveNotification[] = [];

    // Iterate over ALL phase configs to scan every phase's storage
    const allConfigs = Object.values(PHASE_CONFIGS);

    allConfigs.forEach((phaseConfig) => {
      // ─── Planner triggers for this phase ───
      const plannerKey = `${phaseConfig.storagePrefix}-planner-events`;
      let events: PlannerEvent[] = [];
      try { events = JSON.parse(localStorage.getItem(plannerKey) ?? '[]') as PlannerEvent[]; } catch { /* */ }

      const catMap = Object.fromEntries(phaseConfig.plannerCategories.map((c) => [c.id, c])) as Record<string, PlannerCategoryDef>;

      events.forEach((event) => {
        const cat = catMap[event.category];
        if (!cat?.triggers) return;
        const eventDate = getEventDatetime(event);
        cat.triggers.forEach((trigger) => {
          const before = new Date(eventDate.getTime() - trigger.hoursBefore * 60 * 60 * 1000);
          const alertId = `${phaseConfig.id}-${event.id}-${event.category}-${trigger.hoursBefore}h`;
          if (now >= before && now < eventDate && !sent.has(alertId) && !dismissedRef.current.has(alertId)) {
            markAlertSent(alertId);
            const body = trigger.message(event.title);
            fireNotification(trigger.notifTitle, body);
            newNotifs.push({ id: alertId, title: trigger.notifTitle, body, icon: trigger.icon });
          }
        });
      });

      // ─── Financial goals trigger for this phase ───
      const financeKey = `${phaseConfig.storagePrefix}-financial-goals`;
      let goals: FinancialGoal[] = [];
      try { goals = JSON.parse(localStorage.getItem(financeKey) ?? '[]') as FinancialGoal[]; } catch { /* */ }

      goals.forEach((goal) => {
        const percentage = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
        if (percentage >= 100) return;
        const deadlineDate = new Date(`${goal.deadline}T23:59:59`);
        const threeDaysBefore = new Date(deadlineDate.getTime() - 3 * 24 * 60 * 60 * 1000);
        const alertId = `${phaseConfig.id}-${goal.id}-finance-3d`;
        if (now >= threeDaysBefore && now < deadlineDate && !sent.has(alertId) && !dismissedRef.current.has(alertId)) {
          markAlertSent(alertId);
          const body = `Falta pouco! 💰 O prazo para atingir sua meta de '${goal.title}' vence em 3 dias. Que tal guardar mais um pouquinho hoje para bater o seu objetivo?`;
          fireNotification('Lembrete de Meta Financeira', body);
          newNotifs.push({ id: alertId, title: 'Lembrete de Meta Financeira', body, icon: '💰' });
        }
      });
    });

    if (newNotifs.length > 0) {
      setActiveNotifications((prev) => [...prev, ...newNotifs.filter((n) => !prev.some((p) => p.id === n.id))]);
    }
  }, []);

  useEffect(() => {
    if (!permissionAsked) setShowPermissionBanner(true);
    checkAllTriggers();
    const interval = setInterval(checkAllTriggers, 60_000);
    return () => clearInterval(interval);
  }, [permissionAsked, checkAllTriggers]);

  return { showPermissionBanner, requestPermission, activeNotifications, dismissNotification };
}
