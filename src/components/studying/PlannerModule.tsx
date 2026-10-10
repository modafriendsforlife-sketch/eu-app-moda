import { useState, useEffect, useRef } from 'react';
import { BackButton, SegmentMenu, AddButton, DeleteButton } from './sharedUI';
import { useLocalStorage } from './sharedUI';
import { getPhaseConfig, type PlannerCategoryDef } from './phaseConfigs';

interface PlannerEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  category: string;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date {
  return new Date(key + 'T00:00:00');
}

export default function PlannerModule({ onBack, phaseId }: { onBack: () => void; phaseId: string }) {
  const config = getPhaseConfig(phaseId);
  const CATEGORIES = config.plannerCategories;
  const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, PlannerCategoryDef>;
  const ALERT_KEY = `${config.storagePrefix}-planner-alerts`;
  const STORAGE_KEY = `${config.storagePrefix}-planner-events`;

  const [events, setEvents] = useLocalStorage<PlannerEvent[]>(STORAGE_KEY, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formCat, setFormCat] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formTime, setFormTime] = useState('');
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [draftTime, setDraftTime] = useState('');
  const [formDate, setFormDate] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [notifMsg, setNotifMsg] = useState<PlannerCategoryDef | null>(null);
  const [detailEvent, setDetailEvent] = useState<PlannerEvent | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());

  const handleCategorySelect = (catId: string) => {
    setFormCat(catId);
    setFormDate(selectedDate);
    setFormTitle('');
    setFormTime('');
    setTimePickerOpen(false);
    setDraftTime('');
  };

  const saveEvent = () => {
    if (!formCat || !formTitle.trim() || !formDate) return;
    const newEvent: PlannerEvent = {
      id: `${Date.now()}-${Math.random()}`,
      date: formDate,
      title: formTitle.trim(),
      time: formTime,
      category: formCat,
    };
    setEvents((prev) =>
      [...prev, newEvent].sort((a, b) => {
        const catA = CAT_MAP[a.category];
        const catB = CAT_MAP[b.category];
        if (catA?.priority && !catB?.priority) return -1;
        if (!catA?.priority && catB?.priority) return 1;
        return (a.time || '99').localeCompare(b.time || '99');
      })
    );
    setFormCat(null);
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const calendarCells: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(new Date(viewMonth.year, viewMonth.month, d));

  const eventsForSelected = events.filter((e) => e.date === selectedDate);
  const eventsByDate: Record<string, PlannerEvent[]> = {};
  events.forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const prevMonth = () => {
    setViewMonth((prev) => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
    });
  };
  const nextMonth = () => {
    setViewMonth((prev) => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
    });
  };

  useEffect(() => {
    const checkAlerts = () => {
      const now = new Date();
      const alertsSent: string[] = JSON.parse(localStorage.getItem(ALERT_KEY) ?? '[]');
      events.forEach((e) => {
        const cat = CAT_MAP[e.category];
        if (!cat?.triggers) return;
        const eventDate = parseDateKey(e.date);
        const [h, m] = (e.time || '00:00').split(':').map(Number);
        eventDate.setHours(h || 0, m || 0, 0, 0);
        cat.triggers.forEach((trigger) => {
          const before = new Date(eventDate.getTime() - trigger.hoursBefore * 60 * 60 * 1000);
          const alertId = `${e.id}-${e.category}-${trigger.hoursBefore}h`;
          if (now >= before && now < eventDate && !alertsSent.includes(alertId) && !alertedRef.current.has(alertId)) {
            alertedRef.current.add(alertId);
            localStorage.setItem(ALERT_KEY, JSON.stringify([...alertsSent, alertId]));
            setNotifMsg(cat);
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
            } catch {}
          }
        });
      });
    };
    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, [events, ALERT_KEY, CAT_MAP]);

  const selectedDateObj = parseDateKey(selectedDate);
  const isToday = (d: Date) => dateKey(d) === dateKey(new Date());

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />

        {notifMsg && (
          <div className="mb-6 bg-magenta/10 border border-magenta/20 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-down">
            <div className="w-10 h-10 rounded-xl bg-magenta flex items-center justify-center shrink-0 text-white text-lg">
              {notifMsg.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm text-grafite font-medium leading-relaxed">
                {notifMsg.triggers?.[0]?.message(events.find((e) => e.category === notifMsg.id)?.title ?? '')}
              </p>
            </div>
            <button type="button" onClick={() => setNotifMsg(null)} className="text-grafite hover:text-magenta text-sm font-medium shrink-0">
              ✕
            </button>
          </div>
        )}

        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">📅</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Planner</h1>
            <p className="text-sm text-grafite">Seus compromissos</p>
          </div>
          <AddButton onClick={() => setMenuOpen(true)} ariaLabel="Adicionar compromisso" />
        </header>

        <div className="bg-card rounded-2xl p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="w-9 h-9 rounded-lg hover:bg-grafite/5 flex items-center justify-center text-grafite transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="font-display font-bold text-magenta text-sm uppercase tracking-wide">{MONTHS[viewMonth.month]} {viewMonth.year}</h2>
            <button type="button" onClick={nextMonth} className="w-9 h-9 rounded-lg hover:bg-grafite/5 flex items-center justify-center text-grafite transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d, i) => <div key={i} className="text-center text-[10px] font-bold text-grafite uppercase py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = dateKey(d);
              const dayEvents = eventsByDate[key] ?? [];
              const isSelected = key === selectedDate;
              const today = isToday(d);
              const hasPriority = dayEvents.some((e) => CAT_MAP[e.category]?.priority);
              return (
                <button key={i} type="button" onClick={() => setSelectedDate(key)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all relative ${isSelected ? 'bg-magenta text-white' : today ? 'bg-magenta/10 text-magenta' : 'hover:bg-grafite/5 text-grafite'}`}>
                  <span>{d.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 absolute bottom-1">
                      {hasPriority && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : ''}`} style={{ backgroundColor: isSelected ? '#fff' : '#E53935' }} />}
                      {dayEvents.slice(0, hasPriority ? 2 : 3).map((e) => (
                        <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? '#fff' : CAT_MAP[e.category]?.color }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-grafite/10 flex flex-wrap gap-x-3 gap-y-1.5">
            {CATEGORIES.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] text-grafite font-medium">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 mb-6 animate-fade-in">
          <h2 className="font-display font-bold text-magenta text-sm uppercase tracking-wide mb-1">
            {selectedDateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          <p className="text-xs text-grafite mb-4">{eventsForSelected.length > 0 ? `${eventsForSelected.length} compromisso(s)` : 'Nenhum compromisso neste dia'}</p>

          {eventsForSelected.length === 0 ? (
            <div className="py-8 text-center"><p className="text-sm text-grafite italic">Toque no + acima para adicionar um compromisso</p></div>
          ) : (
            <div className="space-y-2">
              {eventsForSelected.map((e) => {
                const cat = CAT_MAP[e.category];
                return (
                  <div key={e.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 group cursor-pointer hover:shadow-md hover:shadow-grafite/5 transition-all" onClick={() => setDetailEvent(e)}>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat?.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-grafite font-medium truncate">
                        <span className="text-grafite/70">[{cat?.icon} {cat?.label}]</span> {e.title}
                        {e.time && <span className="text-grafite/60 ml-2">- {e.time}</span>}
                      </p>
                    </div>
                    <DeleteButton onClick={() => deleteEvent(e.id)} ariaLabel={`Excluir ${e.title}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SegmentMenu open={menuOpen} onClose={() => setMenuOpen(false)} title="Novo compromisso"
        segments={CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color }))}
        onSelect={handleCategorySelect} />

      {detailEvent && (
        <>
          <div className="fixed inset-0 z-[55] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setDetailEvent(null)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: CAT_MAP[detailEvent.category]?.color }} />
                <h3 className="font-display font-bold text-magenta text-lg flex-1">{CAT_MAP[detailEvent.category]?.icon} {CAT_MAP[detailEvent.category]?.label}</h3>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-[10px] font-medium text-grafite/50 uppercase tracking-wider mb-1">Compromisso</p>
                  <p className="text-base text-grafite font-medium leading-snug break-words">{detailEvent.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-medium text-grafite/50 uppercase tracking-wider mb-1">Data</p>
                    <p className="text-sm text-grafite font-medium">{parseDateKey(detailEvent.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-grafite/50 uppercase tracking-wider mb-1">Horário</p>
                    <p className="text-sm text-grafite font-medium">{detailEvent.time || 'Sem horário'}</p>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setDetailEvent(null)} className="w-full bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300">
                Fechar
              </button>
            </div>
          </div>
        </>
      )}

      {formCat && (
        <>
          <div className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm animate-fade-in" onClick={() => setFormCat(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-4 py-6 sm:px-6 shadow-2xl animate-fade-in-down max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-md mx-auto">
            <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-2 mb-5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CAT_MAP[formCat]?.color }} />
              <h3 className="font-display font-bold text-magenta text-lg">{CAT_MAP[formCat]?.icon} {CAT_MAP[formCat]?.label}</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Título</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Revisão"
                  className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all" />
              </div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Data</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite focus:outline-none transition-all" />
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Horário</label>
                  <button
                    type="button"
                    onClick={() => { setDraftTime(formTime); setTimePickerOpen(true); }}
                    className="w-full min-w-0 bg-white border border-grafite/15 hover:border-magenta focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite text-left focus:outline-none transition-all"
                  >
                    {formTime || 'Selecionar horário'}
                  </button>
                </div>
              </div>
              {CAT_MAP[formCat]?.triggers && (
                <p className="text-xs text-magenta font-medium bg-magenta/5 rounded-lg px-3 py-2">
                  🔔 Você receberá um alerta antes deste compromisso.
                </p>
              )}
              <button type="button" onClick={saveEvent} disabled={!formTitle.trim() || !formDate}
                className="w-full bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300">
                Salvar compromisso
              </button>
            </div>
            </div>
          </div>

          {timePickerOpen && (
            <div className="fixed inset-0 z-[60] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setTimePickerOpen(false)}>
              <div className="w-full max-w-[360px] mx-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <h3 className="font-display font-bold text-magenta text-lg text-center mb-5">Escolher horário</h3>
                <div className="flex items-center justify-center gap-3 mb-6">
                  <select value={draftTime.split(':')[0] || '08'} onChange={(event) => setDraftTime(`${event.target.value}:${draftTime.split(':')[1] || '00'}`)} className="min-w-0 flex-1 appearance-none rounded-xl border border-grafite/15 bg-white px-3 py-3 text-center text-lg font-bold text-grafite focus:border-magenta focus:outline-none">
                    {Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')).map((hour) => <option key={hour} value={hour}>{hour}</option>)}
                  </select>
                  <span className="text-xl font-bold text-grafite">:</span>
                  <select value={draftTime.split(':')[1] || '00'} onChange={(event) => setDraftTime(`${draftTime.split(':')[0] || '08'}:${event.target.value}`)} className="min-w-0 flex-1 appearance-none rounded-xl border border-grafite/15 bg-white px-3 py-3 text-center text-lg font-bold text-grafite focus:border-magenta focus:outline-none">
                    {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map((minute) => <option key={minute} value={minute}>{minute}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => { setDraftTime(''); setFormTime(''); setTimePickerOpen(false); }} className="min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-medium text-grafite hover:bg-grafite/5">Limpar</button>
                  <button type="button" onClick={() => setTimePickerOpen(false)} className="min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-medium text-grafite hover:bg-grafite/5">Cancelar</button>
                  <button type="button" onClick={() => { setFormTime(draftTime); setTimePickerOpen(false); }} className="min-h-11 flex-1 rounded-xl bg-magenta px-3 py-2 text-sm font-bold text-white hover:bg-magenta-dark">Confirmar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
