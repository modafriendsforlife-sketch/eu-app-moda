/*
 * Jornada MF — Unified Notification Engine
 *
 * A single dynamic motor that covers:
 * - Hydration goal reminders (interval-based)
 * - Planner event alerts (time-based, 15min before + exact time)
 * - Task deadline warnings (expiring tasks)
 * - Notes reminders (time-based)
 * - Financial goal deadline warnings
 *
 * Fires both system notifications (via service worker) and in-app alerts,
 * and persists every alert to Supabase for the "Central de Avisos" feed.
 */

import { supabase } from '@/lib/supabaseClient';
import { PHASE_CONFIGS, type PlannerCategoryDef } from '@/components/studying/phaseConfigs';

// ─── Types ───
export interface AlertItem {
  id: string;
  category: 'hydration' | 'planner' | 'tasks' | 'notes' | 'finance';
  title: string;
  body: string;
  icon: string;
}

interface PlannerEvent { id: string; date: string; title: string; time: string; category: string; }
interface TaskList { id: string; category: string; title: string; items: { id: string; text: string; done: boolean; deadline?: string }[]; createdAt: string; }
interface Note { id: string; category: string; title: string; content: string; reminderDate?: string; updatedAt: string; }
interface FinancialGoal { id: string; title: string; targetAmount: number; savedAmount: number; deadline: string; }

// ─── Storage keys ───
const SW_SENT_KEY = 'minha-jornada-sw-sent';
const INAPP_SENT_KEY = 'minha-jornada-notif-sent';
const NOTIF_PREF_KEY = 'minha-jornada-notif-permission-asked';

// ─── Helpers ───
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSentSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]); } catch { return new Set(); }
}

function markSent(key: string, id: string) {
  try {
    const set = getSentSet(key);
    set.add(id);
    localStorage.setItem(key, JSON.stringify([...set].slice(-300)));
  } catch {}
}

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
  } catch {}
}

// ─── Supabase persistence ───
export async function saveNotificationToHistory(userEmail: string, alert: AlertItem): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_email: userEmail.trim().toLowerCase(),
      category: alert.category,
      title: alert.title,
      body: alert.body,
      icon: alert.icon,
    });
  } catch {}
}

export async function loadNotificationHistory(userEmail: string): Promise<AlertItem[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, category, title, body, icon, is_read, created_at')
      .eq('user_email', userEmail.trim().toLowerCase())
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      category: row.category as AlertItem['category'],
      title: row.title,
      body: row.body,
      icon: row.icon ?? '🔔',
    }));
  } catch {
    return [];
  }
}

export async function markNotificationsRead(userEmail: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_email', userEmail.trim().toLowerCase())
      .eq('is_read', false);
  } catch {}
}

// ─── System notification ───
function fireSystemNotification(title: string, body: string, tag: string) {
  try {
    playAlertSound();
  } catch {}

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: '/assets/logo_nova_Moda_Friends.png',
          badge: '/assets/logo_nova_Moda_Friends.png',
          tag,
        }).catch(() => {});
      }).catch(() => {});
    } else {
      new Notification(title, { body, icon: '/assets/logo_nova_Moda_Friends.png' });
    }
  } catch {}
}

// ─── Permission management ───
export function hasPermissionBeenAsked(): boolean {
  return localStorage.getItem(NOTIF_PREF_KEY) === 'true';
}

export function shouldShowPermissionBanner(): boolean {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return false;
  if (Notification.permission === 'denied') return false;
  return !hasPermissionBeenAsked();
}

export async function requestNotificationPermission(): Promise<boolean> {
  localStorage.setItem(NOTIF_PREF_KEY, 'true');
  if (!('Notification' in window)) return false;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted' && 'serviceWorker' in navigator) {
      try { await navigator.serviceWorker.ready; } catch {}
    }
    return result === 'granted';
  } catch {
    return false;
  }
}

// ─── Data collection for SW ───
export function collectAlertData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  // Hydration
  try {
    const GOAL_KEY = 'minha-jornada-hydration-goal';
    const HISTORY_KEY = 'minha-jornada-hydration-history';
    const DEFAULT_GOAL = 2000;
    let goal = DEFAULT_GOAL;
    const goalRaw = localStorage.getItem(GOAL_KEY);
    if (goalRaw) { const n = parseInt(goalRaw, 10); if (!isNaN(n) && n > 0) goal = n; }
    let consumed = 0;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const records = JSON.parse(raw) as { date: string; consumed: number; goal: number }[];
        const today = records.find((r) => r.date === todayKey());
        if (today) { consumed = today.consumed; goal = today.goal || goal; }
      }
    } catch {}
    data.hydration = { goal, consumed };
  } catch {}

  // Planner events (all phases)
  try {
    const allEvents: PlannerEvent[] = [];
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-planner-events`);
        if (raw) allEvents.push(...(JSON.parse(raw) as PlannerEvent[]));
      } catch {}
    }
    data.plannerEvents = allEvents;
  } catch {}

  // Tasks (all phases)
  try {
    const allTasks: TaskList[] = [];
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-tasks`);
        if (raw) allTasks.push(...(JSON.parse(raw) as TaskList[]));
      } catch {}
    }
    data.tasks = allTasks;
  } catch {}

  // Notes (all phases)
  try {
    const allNotes: Note[] = [];
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-notes`);
        if (raw) allNotes.push(...(JSON.parse(raw) as Note[]));
      } catch {}
    }
    data.notes = allNotes;
  } catch {}

  // Financial goals (all phases)
  try {
    const allGoals: FinancialGoal[] = [];
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-financial-goals`);
        if (raw) allGoals.push(...(JSON.parse(raw) as FinancialGoal[]));
      } catch {}
    }
    data.financialGoals = allGoals;
  } catch {}

  // Sent alerts
  data.sentAlerts = [...getSentSet(SW_SENT_KEY)];

  return data;
}

// ─── Main alert check (in-app) ───
export function checkAllAlerts(userEmail: string): AlertItem[] {
  const now = new Date();
  const today = todayKey();
  const sent = getSentSet(INAPP_SENT_KEY);
  const newAlerts: AlertItem[] = [];

  // ─── 1. Hydration ───
  try {
    const GOAL_KEY = 'minha-jornada-hydration-goal';
    const HISTORY_KEY = 'minha-jornada-hydration-history';
    const DEFAULT_GOAL = 2000;
    let goal = DEFAULT_GOAL;
    const goalRaw = localStorage.getItem(GOAL_KEY);
    if (goalRaw) { const n = parseInt(goalRaw, 10); if (!isNaN(n) && n > 0) goal = n; }
    let consumed = 0;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const records = JSON.parse(raw) as { date: string; consumed: number; goal: number }[];
        const todayRec = records.find((r) => r.date === today);
        if (todayRec) { consumed = todayRec.consumed; goal = todayRec.goal || goal; }
      }
    } catch {}

    if (goal > 0 && consumed < goal) {
      const pct = Math.round((consumed / goal) * 100);
      const hour = now.getHours();
      if ([12, 16, 20].includes(hour)) {
        const alertId = `hydration-${today}-${hour}`;
        if (!sent.has(alertId)) {
          markSent(INAPP_SENT_KEY, alertId);
          const alert: AlertItem = {
            id: alertId,
            category: 'hydration',
            title: 'Lembrete de Hidratação',
            body: `Você está em ${pct}% da meta de água hoje. Que tal beber mais um copo? 💧`,
            icon: '💧',
          };
          fireSystemNotification(alert.title, alert.body, alert.id);
          newAlerts.push(alert);
        }
      }
    }
  } catch {}

  // ─── 2. Planner events ───
  try {
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-planner-events`);
        if (!raw) continue;
        const events = JSON.parse(raw) as PlannerEvent[];
        const catMap = Object.fromEntries(config.plannerCategories.map((c) => [c.id, c])) as Record<string, PlannerCategoryDef>;

        events.forEach((ev) => {
          if (ev.date !== today) return;
          const [h, m] = (ev.time || '00:00').split(':').map(Number);
          const eventTime = new Date(today + 'T00:00:00');
          eventTime.setHours(h || 0, m || 0, 0, 0);

          // Check trigger-based alerts (from phase config)
          const cat = catMap[ev.category];
          if (cat?.triggers) {
            cat.triggers.forEach((trigger) => {
              const before = new Date(eventTime.getTime() - trigger.hoursBefore * 60 * 60 * 1000);
              const alertId = `${config.id}-${ev.id}-${ev.category}-${trigger.hoursBefore}h`;
              if (now >= before && now < eventTime && !sent.has(alertId)) {
                markSent(INAPP_SENT_KEY, alertId);
                const body = trigger.message(ev.title);
                const alert: AlertItem = {
                  id: alertId,
                  category: 'planner',
                  title: trigger.notifTitle,
                  body,
                  icon: trigger.icon,
                };
                fireSystemNotification(alert.title, alert.body, alert.id);
                newAlerts.push(alert);
              }
            });
          }

          // 15-minute advance warning (universal)
          const fifteenBefore = new Date(eventTime.getTime() - 15 * 60 * 1000);
          const alertId15 = `${config.id}-${ev.id}-15min`;
          if (now >= fifteenBefore && now < eventTime && !sent.has(alertId15)) {
            markSent(INAPP_SENT_KEY, alertId15);
            const alert: AlertItem = {
              id: alertId15,
              category: 'planner',
              title: 'Compromissos de Hoje',
              body: `Compromisso "${ev.title}" às ${ev.time || 'agora'} começa em 15 minutos! 🗓️`,
              icon: '🗓️',
            };
            fireSystemNotification(alert.title, alert.body, alert.id);
            newAlerts.push(alert);
          }
        });
      } catch {}
    }
  } catch {}

  // ─── 3. Task deadlines ───
  try {
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-tasks`);
        if (!raw) continue;
        const lists = JSON.parse(raw) as TaskList[];

        lists.forEach((list) => {
          if (!list.items) return;
          list.items.forEach((item) => {
            if (item.done || !item.deadline) return;
            const deadlineDate = new Date(item.deadline + 'T23:59:59');
            const oneDayBefore = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);
            if (now >= oneDayBefore && now < deadlineDate) {
              const alertId = `${config.id}-task-dl-${item.id}`;
              if (!sent.has(alertId)) {
                markSent(INAPP_SENT_KEY, alertId);
                const alert: AlertItem = {
                  id: alertId,
                  category: 'tasks',
                  title: 'Prazo Expirando',
                  body: `A tarefa "${item.text}" está prestes a expirar! ✅`,
                  icon: '✅',
                };
                fireSystemNotification(alert.title, alert.body, alert.id);
                newAlerts.push(alert);
              }
            }
          });
        });
      } catch {}
    }
  } catch {}

  // ─── 4. Notes reminders ───
  try {
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-notes`);
        if (!raw) continue;
        const notes = JSON.parse(raw) as Note[];

        notes.forEach((note) => {
          if (!note.reminderDate) return;
          const reminderDate = new Date(note.reminderDate);
          const window = new Date(reminderDate.getTime() + 5 * 60 * 1000);
          if (now >= reminderDate && now < window) {
            const alertId = `${config.id}-note-rem-${note.id}`;
            if (!sent.has(alertId)) {
              markSent(INAPP_SENT_KEY, alertId);
              const alert: AlertItem = {
                id: alertId,
                category: 'notes',
                title: 'Lembrete de Anotação',
                body: `Você tem um lembrete: "${note.title || 'Anotação'}" 📝`,
                icon: '📝',
              };
              fireSystemNotification(alert.title, alert.body, alert.id);
              newAlerts.push(alert);
            }
          }
        });
      } catch {}
    }
  } catch {}

  // ─── 5. Financial goals ───
  try {
    for (const config of Object.values(PHASE_CONFIGS)) {
      try {
        const raw = localStorage.getItem(`${config.storagePrefix}-financial-goals`);
        if (!raw) continue;
        const goals = JSON.parse(raw) as FinancialGoal[];

        goals.forEach((goal) => {
          const pct = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
          if (pct >= 100) return;
          const deadlineDate = new Date(goal.deadline + 'T23:59:59');
          const threeDaysBefore = new Date(deadlineDate.getTime() - 3 * 24 * 60 * 60 * 1000);
          if (now >= threeDaysBefore && now < deadlineDate) {
            const alertId = `${config.id}-${goal.id}-finance-3d`;
            if (!sent.has(alertId)) {
              markSent(INAPP_SENT_KEY, alertId);
              const alert: AlertItem = {
                id: alertId,
                category: 'finance',
                title: 'Lembrete de Meta Financeira',
                body: `Falta pouco! 💰 O prazo para a meta '${goal.title}' vence em 3 dias.`,
                icon: '💰',
              };
              fireSystemNotification(alert.title, alert.body, alert.id);
              newAlerts.push(alert);
            }
          }
        });
      } catch {}
    }
  } catch {}

  // Persist new alerts to Supabase history
  if (newAlerts.length > 0 && userEmail) {
    newAlerts.forEach((alert) => {
      void saveNotificationToHistory(userEmail, alert);
    });
  }

  return newAlerts;
}

// ─── SW data bridge ───
export function setupServiceWorkerBridge() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    try {
      // SW requests alert data → respond with collected data
      if (event.data?.type === 'get-alert-data') {
        const data = collectAlertData();
        event.ports[0]?.postMessage(data);
      }

      // SW sends back updated sent-alerts list
      if (event.data?.type === 'sent-alerts-update') {
        try {
          localStorage.setItem(SW_SENT_KEY, JSON.stringify(event.data.sentAlerts || []));
        } catch {}
      }
    } catch {}
  });
}
