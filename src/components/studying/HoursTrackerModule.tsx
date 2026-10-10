import { useState } from 'react';
import { BackButton } from './sharedUI';

interface HourLog {
  id: string;
  hours: number;
  date: string;
  note: string;
}

interface TrackerData {
  totalRequired: number;
  logs: HourLog[];
}

function loadData(key: string): TrackerData {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { totalRequired: parsed.totalRequired ?? 0, logs: parsed.logs ?? [] };
    }
  } catch {}
  return { totalRequired: 0, logs: [] };
}

function saveData(key: string, data: TrackerData) {
  localStorage.setItem(key, JSON.stringify(data));
}

export default function HoursTrackerModule({ onBack, storageKey }: { onBack: () => void; storageKey: string }) {
  const [data, setData] = useState<TrackerData>(() => loadData(storageKey));
  const [showLogModal, setShowLogModal] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logNote, setLogNote] = useState('');
  const [totalInput, setTotalInput] = useState(data.totalRequired ? String(data.totalRequired) : '');
  const [editingTotal, setEditingTotal] = useState(false);

  const completed = data.logs.reduce((sum, l) => sum + l.hours, 0);
  const remaining = Math.max(0, data.totalRequired - completed);
  const pct = data.totalRequired > 0 ? Math.min(100, (completed / data.totalRequired) * 100) : 0;

  const updateData = (next: TrackerData) => {
    setData(next);
    saveData(storageKey, next);
  };

  const handleSaveTotal = () => {
    const val = parseInt(totalInput, 10) || 0;
    updateData({ ...data, totalRequired: Math.max(0, val) });
    setEditingTotal(false);
  };

  const handleLogHours = () => {
    const val = parseFloat(logHours);
    if (isNaN(val) || val <= 0) return;
    const newLog: HourLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      hours: val,
      date: new Date().toISOString(),
      note: logNote.trim(),
    };
    updateData({ ...data, logs: [newLog, ...data.logs] });
    setLogHours('');
    setLogNote('');
    setShowLogModal(false);
  };

  const deleteLog = (id: string) => {
    updateData({ ...data, logs: data.logs.filter((l) => l.id !== id) });
  };

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />

        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">⏱️</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Controle de Horas de Estágio</h1>
            <p className="text-sm text-grafite">Acompanhe seu progresso de horas</p>
          </div>
        </header>

        {/* Total required + progress */}
        <div className="bg-[#F3F3F3] rounded-2xl p-5 mb-6 animate-fade-in-down">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Carga Horária Total Exigida</p>
              {editingTotal ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={totalInput}
                    onChange={(e) => setTotalInput(e.target.value)}
                    placeholder="Ex: 400"
                    className="w-24 bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2 text-sm font-bold text-magenta focus:outline-none"
                  />
                  <span className="text-sm font-medium text-grafite">horas</span>
                  <button type="button" onClick={handleSaveTotal} className="bg-magenta text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-magenta-dark transition-colors">Salvar</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setTotalInput(data.totalRequired ? String(data.totalRequired) : ''); setEditingTotal(true); }} className="text-left">
                  <span className="font-display text-2xl font-bold text-magenta">{data.totalRequired}</span>
                  <span className="text-sm text-grafite ml-1">horas</span>
                  <span className="text-xs text-grafite/50 ml-2 hover:text-magenta transition-colors">(editar)</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs font-medium mb-1.5">
              <span className="text-magenta">{completed}h concluídas</span>
              <span className="text-grafite">{remaining}h restantes</span>
            </div>
            <div className="w-full h-4 bg-white rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-magenta rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-center text-xs font-bold text-magenta mt-2">{pct.toFixed(1)}% completo</p>
          </div>

          {data.totalRequired === 0 && (
            <p className="text-xs text-grafite/60 italic text-center">Defina a carga horária total para começar a acompanhar seu progresso.</p>
          )}

          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            disabled={data.totalRequired === 0}
            className="w-full mt-4 bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-sm py-3 rounded-xl transition-all duration-300"
          >
            + Lançar Horas Realizadas
          </button>
        </div>

        {/* History */}
        {data.logs.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="font-display font-bold text-grafite text-sm mb-3">Histórico de Lançamentos</h2>
            <div className="space-y-2">
              {data.logs.map((log) => (
                <div key={log.id} className="bg-card rounded-xl p-3 flex items-center gap-3 animate-fade-in">
                  <div className="w-10 h-10 rounded-lg bg-magenta/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-magenta">{log.hours}h</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-grafite">{new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    {log.note && <p className="text-[11px] text-grafite/60 truncate">{log.note}</p>}
                  </div>
                  <button type="button" onClick={() => deleteLog(log.id)} className="text-grafite/40 hover:text-magenta text-xs font-bold shrink-0 transition-colors">Excluir</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Log hours modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-[60] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-fade-in-down">
            <h3 className="font-display font-bold text-magenta text-lg mb-4 text-center">Lançar Horas</h3>
            <div className="mb-4">
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Horas realizadas</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
                placeholder="Ex: 8"
                className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm font-bold text-magenta focus:outline-none"
              />
            </div>
            <div className="mb-5">
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Anotação (opcional)</label>
              <input
                type="text"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="Ex: Plantão da manhã"
                className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setShowLogModal(false); setLogHours(''); setLogNote(''); }} className="bg-[#F3F3F3] hover:bg-grafite/10 text-grafite font-display font-bold text-sm py-3 rounded-xl transition-colors">Cancelar</button>
              <button type="button" onClick={handleLogHours} disabled={!logHours || parseFloat(logHours) <= 0} className="bg-magenta hover:bg-magenta-dark disabled:opacity-40 text-white font-display font-bold text-sm py-3 rounded-xl transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
