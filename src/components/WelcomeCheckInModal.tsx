import { useState, useEffect, useMemo } from 'react';
import { Droplets, CalendarCheck, FolderOpen, Sparkles, X } from 'lucide-react';
import { PHASE_CONFIGS } from '@/components/studying/phaseConfigs';

interface WelcomeCheckInModalProps {
  userName: string;
  userEmail: string;
  onClose: () => void;
}

interface PlannerEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  category: string;
}

interface AlertItem {
  icon: typeof Droplets;
  iconBg: string;
  iconColor: string;
  title: string;
  message: string;
  details?: string[];
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadHydrationStatus(): { belowGoal: boolean; consumed: number; goal: number } {
  const GOAL_KEY = 'minha-jornada-hydration-goal';
  const HISTORY_KEY = 'minha-jornada-hydration-history';
  const DEFAULT_GOAL = 2000;

  let goal = DEFAULT_GOAL;
  const goalRaw = localStorage.getItem(GOAL_KEY);
  if (goalRaw) {
    const n = parseInt(goalRaw, 10);
    if (!isNaN(n) && n > 0) goal = n;
  }

  let consumed = 0;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const records = JSON.parse(raw) as { date: string; consumed: number; goal: number }[];
      const today = records.find((r) => r.date === todayKey());
      if (today) {
        consumed = today.consumed;
        goal = today.goal || goal;
      }
    }
  } catch {}

  return { belowGoal: consumed < goal, consumed, goal };
}

function loadTodayPlannerEvents(): PlannerEvent[] {
  const today = todayKey();
  const allEvents: PlannerEvent[] = [];

  for (const config of Object.values(PHASE_CONFIGS)) {
    try {
      const raw = localStorage.getItem(`${config.storagePrefix}-planner-events`);
      if (raw) {
        const events = JSON.parse(raw) as PlannerEvent[];
        allEvents.push(...events.filter((e) => e.date === today));
      }
    } catch {}
  }

  return allEvents;
}

const DOC_DB_NAME = 'minha-jornada-doc-files';
const DOC_DB_VERSION = 3;
const DOC_META_STORE = 'metadata';
const DOC_META_KEY = 'docs';

function loadDocumentsCount(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DOC_DB_NAME, DOC_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DOC_META_STORE)) {
          db.createObjectStore(DOC_META_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(DOC_META_STORE, 'readonly');
          const getReq = tx.objectStore(DOC_META_STORE).get(DOC_META_KEY);
          getReq.onsuccess = () => {
            db.close();
            const result = getReq.result;
            if (Array.isArray(result)) {
              resolve(result.length);
            } else {
              resolve(0);
            }
          };
          getReq.onerror = () => { db.close(); resolve(0); };
        } catch {
          db.close();
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export default function WelcomeCheckInModal({ userName, onClose }: WelcomeCheckInModalProps) {
  const [dismissed, setDismissed] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
 loadDocumentsCount().then(setDocCount);
  }, []);

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];

    // 1. Hydration check
    const hydration = loadHydrationStatus();
    if (hydration.belowGoal) {
      const pct = hydration.goal > 0 ? Math.round((hydration.consumed / hydration.goal) * 100) : 0;
      items.push({
        icon: Droplets,
        iconBg: 'bg-cyan-50',
        iconColor: 'text-cyan-500',
        title: 'Lembrete de Hidratação',
        message: `Você ainda não atingiu sua meta de água hoje! ${pct}% de ${hydration.goal} ml.`,
      });
    }

    // 2. Planner events today
    const todayEvents = loadTodayPlannerEvents();
    if (todayEvents.length > 0) {
      items.push({
        icon: CalendarCheck,
        iconBg: 'bg-magenta/10',
        iconColor: 'text-magenta',
        title: 'Compromissos de Hoje',
        message: `Você tem ${todayEvents.length} compromisso(s) agendado(s) para hoje!`,
        details: todayEvents.slice(0, 5).map((e) => `${e.time ? `${e.time} — ` : ''}${e.title}`),
      });
    }

    // 3. Documents reminder — only when we've confirmed count from IndexedDB
    if (docCount === 0) {
      items.push({
        icon: FolderOpen,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-500',
        title: 'Pasta de Documentos',
        message: 'Você ainda não adicionou nenhum documento. Organize seus arquivos nas fases!',
      });
    }

    return items;
  }, [docCount]);

  // Don't render until doc count is loaded from IndexedDB (avoids premature flash)
  if (dismissed || docCount === null) return null;

  const greetingName = userName?.trim() || 'Tudo bem';
  const closeButtonLabel = `Entendi, ${greetingName.split(' ')[0]}`;

  return (
    <div className="fixed inset-0 z-[80] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-down max-h-[90vh] flex flex-col">

        {/* Header with gradient */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-magenta to-[#C90055]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-white leading-tight">
                Bem-vindo(a) de volta!
              </h2>
              <p className="text-sm text-white/80">Confira seu resumo do dia</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setDismissed(true); onClose(); }}
            aria-label="Fechar"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" strokeWidth={2.2} />
          </button>
        </div>

        {/* Alerts list */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-green-500" strokeWidth={1.7} />
              </div>
              <p className="text-sm text-grafite font-medium">
                Tudo em dia por hoje! Aproveite seu dia com foco e tranquilidade.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, idx) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-[#F8F8F8] rounded-2xl p-4 animate-fade-in"
                    style={{ animationDelay: `${0.1 + idx * 0.08}s`, opacity: 0 }}
                  >
                    <div className={`w-10 h-10 rounded-xl ${alert.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${alert.iconColor}`} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm text-grafite leading-snug">
                        {alert.title}
                      </p>
                      <p className="text-sm text-grafite/70 mt-1 leading-relaxed">
                        {alert.message}
                      </p>
                      {alert.details && alert.details.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {alert.details.map((d, i) => (
                            <li key={i} className="text-xs text-grafite/60 flex items-start gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-magenta mt-1.5 shrink-0" />
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — close button */}
        <div className="shrink-0 px-6 pb-6 pt-3 border-t border-grafite/5">
          <button
            type="button"
            onClick={() => { setDismissed(true); onClose(); }}
            className="w-full bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-magenta/20"
          >
            {alerts.length > 0 ? closeButtonLabel : 'Ok, vou focar!'}
          </button>
          <button
            type="button"
            onClick={() => { setDismissed(true); onClose(); }}
            className="w-full text-grafite/50 hover:text-magenta text-xs font-medium py-2 mt-1 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
