import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Droplets, Check, Bell, GlassWater, RotateCcw } from 'lucide-react';
import { showReminderNotification } from '@/pushNotifications';

interface HydrationScreenProps {
  onBack: () => void;
}

interface DayRecord {
  date: string;
  consumed: number;
  goal: number;
}

const GOAL_KEY = 'minha-jornada-hydration-goal';
const HISTORY_KEY = 'minha-jornada-hydration-history';
const ALERT_KEY = 'minha-jornada-hydration-alert';

const DEFAULT_GOAL = 2000;
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAY_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadGoal(): number {
  const raw = localStorage.getItem(GOAL_KEY);
  if (raw) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_GOAL;
}

function loadHistory(): DayRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw) as DayRecord[];
  } catch {}
  return [];
}

function saveHistory(records: DayRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

function getLast7Days(records: DayRecord[], goal: number): DayRecord[] {
  const days: DayRecord[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const found = records.find((r) => r.date === key);
    days.push({
      date: key,
      consumed: found ? found.consumed : 0,
      goal: found ? found.goal : goal,
    });
  }
  return days;
}

export default function HydrationScreen({ onBack }: HydrationScreenProps) {
  const [goal, setGoal] = useState<number>(() => loadGoal());
  const [goalInput, setGoalInput] = useState<string>(() => String(loadGoal()));
  const [history, setHistory] = useState<DayRecord[]>(() => loadHistory());
  const [showAlert, setShowAlert] = useState(false);
  const [goalSavedMsg, setGoalSavedMsg] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const alertShownRef = useRef(false);

  const today = todayKey();
  const todayRecord = history.find((r) => r.date === today);
  const consumed = todayRecord?.consumed ?? 0;
  const effectiveGoal = todayRecord?.goal ?? goal;
  const percentage = Math.min(100, Math.round((consumed / effectiveGoal) * 100));

  const updateHistory = useCallback((newConsumed: number, newGoal: number) => {
    setHistory((prev) => {
      const key = todayKey();
      const idx = prev.findIndex((r) => r.date === key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], consumed: newConsumed, goal: newGoal };
        saveHistory(updated);
        return updated;
      } else {
        const updated = [...prev, { date: key, consumed: newConsumed, goal: newGoal }];
        saveHistory(updated);
        return updated;
      }
    });
  }, []);

  const addWater = (amount: number) => {
    const newConsumed = consumed + amount;
    updateHistory(newConsumed, effectiveGoal);
  };

  const saveGoal = () => {
    const n = parseInt(goalInput, 10);
    if (!isNaN(n) && n > 0) {
      setGoal(n);
      localStorage.setItem(GOAL_KEY, String(n));
      updateHistory(consumed, n);
      setGoalSavedMsg(true);
      setTimeout(() => setGoalSavedMsg(false), 2500);
    }
  };

  const resetToday = () => {
    updateHistory(0, effectiveGoal);
  };

  // Smart alert check — fires once after 16:00 if below 50%
  useEffect(() => {
    const checkAlert = () => {
      const now = new Date();
      const hour = now.getHours();
      const currentConsumed = history.find((r) => r.date === today)?.consumed ?? 0;
      const currentGoal = history.find((r) => r.date === today)?.goal ?? goal;
      const shouldAlert = hour >= 16 && currentConsumed < currentGoal * 0.5;

      const alreadyAlerted = sessionStorage.getItem(ALERT_KEY) === today;

      if (shouldAlert && !alreadyAlerted && !alertShownRef.current) {
        alertShownRef.current = true;
        sessionStorage.setItem(ALERT_KEY, today);
        void showReminderNotification(
          'Lembrete de hidratação',
          'Você ainda não atingiu metade da sua meta de hidratação hoje. Que tal beber um copo d\'água agora?',
          `hydration-${today}`,
        );
        setShowAlert(true);
      }
    };

    checkAlert();
    const interval = setInterval(checkAlert, 60000);
    return () => clearInterval(interval);
  }, [history, goal, today]);

  // Beep sound on alert
  useEffect(() => {
    if (showAlert) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const beep = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
          gain.gain.linearRampToValueAtTime(0, start + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        beep(880, 0, 0.2);
        beep(1100, 0.25, 0.2);
        beep(880, 0.5, 0.2);
      } catch {}
    }
  }, [showAlert]);

  const last7 = getLast7Days(history, goal);
  const maxBar = Math.max(effectiveGoal, ...last7.map((d) => d.consumed));

  // Circular progress SVG
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">

        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para Minha Fase"
          className="mb-6 inline-flex items-center gap-2 text-grafite hover:text-magenta transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-grafite/20 rounded-md px-1 py-1"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          <span className="text-sm font-medium">Voltar</span>
        </button>

        {/* Alert notification */}
        {showAlert && (
          <div className="mb-6 bg-magenta/10 border border-magenta/20 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-down">
            <div className="w-10 h-10 rounded-xl bg-magenta flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-grafite font-medium leading-relaxed">
                Hora de cuidar de você! 💧 Você ainda não atingiu metade da sua meta de hidratação hoje. Que tal beber um copo d'água agora?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAlert(false)}
              aria-label="Fechar alerta"
              className="text-grafite hover:text-magenta text-sm font-medium shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Title */}
        <header className="mb-6 animate-fade-in-down">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0">
              <Droplets className="w-6 h-6 text-magenta" strokeWidth={1.7} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Minha Hidratação</h1>
              <p className="text-sm text-grafite">Acompanhe sua meta diária de água</p>
            </div>
          </div>
        </header>

        {/* Daily goal setting */}
        <div className="bg-card rounded-2xl p-5 mb-6 flex items-center gap-3 animate-fade-in">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">
              Meta diária (ml)
            </label>
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              min={100}
              step={100}
              className="w-full bg-white border border-grafite/10 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-lg font-display font-bold text-grafite focus:outline-none transition-all"
            />
          </div>
          <button
            type="button"
            onClick={saveGoal}
            className="shrink-0 inline-flex items-center gap-1.5 bg-grafite hover:bg-grafite/85 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all duration-200 mt-5"
          >
            <Check className="w-4 h-4" strokeWidth={2.2} />
            Salvar
          </button>
        </div>

        {goalSavedMsg && (
          <div className="mb-6 flex items-center gap-2 text-green-600 text-sm font-medium animate-fade-in-down">
            <Check className="w-4 h-4" strokeWidth={2.2} />
            Meta atualizada com sucesso!
          </div>
        )}

        {/* Circular progress chart */}
        <div className="bg-card rounded-2xl p-8 mb-6 flex flex-col items-center animate-fade-in">
          <div className="relative w-[220px] h-[220px] mb-2">
            <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
              {/* Background circle */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="#E5E5E5"
                strokeWidth="6"
              />
              {/* Progress arc */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="#C90055"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-4xl font-bold text-grafite leading-none">
                {consumed}
                <span className="text-lg font-medium text-grafite ml-1">ml</span>
              </span>
              <span className="text-sm font-medium text-grafite mt-2">
                de {effectiveGoal} ml
              </span>
              <span className={`font-display text-2xl font-bold mt-1 ${percentage >= 100 ? 'text-magenta' : 'text-grafite'}`}>
                {percentage}%
              </span>
            </div>
          </div>
          {percentage >= 100 && (
            <p className="text-sm text-magenta font-medium mt-1 animate-fade-in">
              Meta atingida! Parabéns! 🎉
            </p>
          )}
        </div>

        {/* Quick increment buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            type="button"
            onClick={() => addWater(200)}
            className="bg-card hover:bg-white rounded-2xl py-4 flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-md hover:shadow-grafite/5 group"
          >
            <GlassWater className="w-5 h-5 text-grafite group-hover:text-magenta transition-colors" strokeWidth={1.5} />
            <span className="font-display font-bold text-grafite text-base group-hover:text-magenta transition-colors">
              +200 ml
            </span>
          </button>
          <button
            type="button"
            onClick={() => addWater(500)}
            className="bg-card hover:bg-white rounded-2xl py-4 flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-md hover:shadow-grafite/5 group"
          >
            <GlassWater className="w-8 h-8 text-grafite group-hover:text-magenta transition-colors" strokeWidth={1.5} />
            <span className="font-display font-bold text-grafite text-base group-hover:text-magenta transition-colors">
              +500 ml
            </span>
          </button>
        </div>

        {/* 7-day history bar chart */}
        <div className="bg-card rounded-2xl p-6 mb-6 animate-fade-in">
          <h2 className="font-display font-bold text-magenta text-sm uppercase tracking-wide mb-1">
            Últimos 7 dias
          </h2>
          <p className="text-xs text-grafite mb-5">Barras em Magenta indicam dias com 100% da meta atingida. Clique em um dia para ver o consumo.</p>
          <div className="flex items-end justify-between gap-2 h-32">
            {last7.map((day, i) => {
              const dayPct = day.goal > 0 ? Math.min(100, (day.consumed / day.goal) * 100) : 0;
              const barHeight = maxBar > 0 ? (day.consumed / maxBar) * 100 : 0;
              const reached = day.goal > 0 && day.consumed >= day.goal;
              const isToday = day.date === today;
              const isSelected = selectedDayIdx === i;
              const dayDate = new Date(day.date + 'T00:00:00');
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDayIdx(isSelected ? null : i)}
                  className={`flex-1 flex flex-col items-center gap-2 rounded-lg p-1 transition-colors ${isSelected ? 'bg-magenta/5' : 'hover:bg-grafite/[0.02]'}`}
                >
                  <div className="w-full flex-1 flex items-end justify-center relative">
                    <div
                      className={`w-full max-w-[28px] rounded-t-lg transition-all duration-500 ${reached ? 'bg-magenta' : 'bg-grafite/25'} ${isToday ? 'ring-[3px] ring-magenta ring-offset-2 ring-offset-card' : ''}`}
                      style={{ height: `${Math.max(barHeight, 4)}%` }}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? 'text-magenta' : 'text-grafite'} font-bold`}>
                    {WEEKDAY_LABELS[dayDate.getDay()]}
                  </span>
                  <span className="text-[10px] text-grafite font-bold -mt-1">{dayPct}%</span>
                </button>
              );
            })}
          </div>
          {selectedDayIdx !== null && last7[selectedDayIdx] && (
            <div className="mt-4 bg-magenta/5 border border-magenta/10 rounded-xl px-4 py-3 text-sm text-grafite font-medium animate-fade-in">
              {WEEKDAY_FULL[new Date(last7[selectedDayIdx].date + 'T00:00:00').getDay()]}: {last7[selectedDayIdx].consumed} ml de {last7[selectedDayIdx].goal} ml
              {last7[selectedDayIdx].goal > 0 && last7[selectedDayIdx].consumed >= last7[selectedDayIdx].goal && (
                <span className="text-magenta ml-1">— Meta atingida! 🎉</span>
              )}
            </div>
          )}
        </div>

        {/* Reset consumption button */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <button
            type="button"
            onClick={resetToday}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-transparent border-2 border-magenta/30 hover:border-magenta hover:bg-magenta/5 text-magenta text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2} />
            Zerar Consumo de Hoje
          </button>
        </div>
      </div>
    </div>
  );
}
