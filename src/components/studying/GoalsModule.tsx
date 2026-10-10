import { useState } from 'react';
import { BackButton, SegmentMenu, AddButton, DeleteButton } from './sharedUI';
import { useLocalStorage } from './sharedUI';
import { getPhaseConfig, type CategoryDef } from './phaseConfigs';

interface SubTask { id: string; text: string; done: boolean; }
interface Goal { id: string; category: string; title: string; subtasks: SubTask[]; createdAt: string; }

export default function GoalsModule({ onBack, phaseId }: { onBack: () => void; phaseId: string }) {
  const config = getPhaseConfig(phaseId);
  const CATEGORIES: CategoryDef[] = config.goalsCategories;
  const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, CategoryDef>;
  const STORAGE_KEY = `${config.storagePrefix}-goals`;

  const [goals, setGoals] = useLocalStorage<Goal[]>(STORAGE_KEY, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formCat, setFormCat] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [newSubText, setNewSubText] = useState('');

  const activeGoal = goals.find((g) => g.id === activeGoalId);

  const handleCategorySelect = (catId: string) => { setFormCat(catId); setFormTitle(''); };

  const createGoal = () => {
    if (!formCat || !formTitle.trim()) return;
    const newGoal: Goal = { id: `${Date.now()}`, category: formCat, title: formTitle.trim(), subtasks: [], createdAt: new Date().toISOString() };
    setGoals((prev) => [newGoal, ...prev]); setFormCat(null);
  };

  const addSub = (goalId: string) => {
    const text = newSubText.trim(); if (!text) return;
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, subtasks: [...g.subtasks, { id: `${Date.now()}`, text, done: false }] } : g));
    setNewSubText('');
  };

  const toggleSub = (goalId: string, subId: string) => {
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, subtasks: g.subtasks.map((s) => s.id === subId ? { ...s, done: !s.done } : s) } : g));
  };

  const deleteSub = (goalId: string, subId: string) => {
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, subtasks: g.subtasks.filter((s) => s.id !== subId) } : g));
  };

  const deleteGoal = (goalId: string) => { setGoals((prev) => prev.filter((g) => g.id !== goalId)); if (activeGoalId === goalId) setActiveGoalId(null); };

  const getProgress = (goal: Goal) => goal.subtasks.length === 0 ? 0 : Math.round((goal.subtasks.filter((s) => s.done).length / goal.subtasks.length) * 100);

  if (activeGoal) {
    const pct = getProgress(activeGoal);
    return (
      <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
        <div className="max-w-2xl mx-auto">
          <BackButton onBack={() => setActiveGoalId(null)} ariaLabel="Voltar para objetivos" />
          <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
            <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">{CAT_MAP[activeGoal.category]?.icon}</div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-magenta leading-tight truncate">{activeGoal.title}</h1>
              <p className="text-sm text-grafite">{pct}% concluído</p>
            </div>
            <button type="button" onClick={() => deleteGoal(activeGoal.id)} className="shrink-0 text-grafite/40 hover:text-magenta text-sm font-medium px-2 py-1 transition-colors">Excluir</button>
          </header>
          <div className="mb-6 bg-card rounded-xl p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-grafite uppercase tracking-wider">Progresso</span>
              <span className="font-display font-bold text-magenta text-lg">{pct}%</span>
            </div>
            <div className="h-3 bg-grafite/10 rounded-full overflow-hidden"><div className="h-full bg-magenta rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <input type="text" value={newSubText} onChange={(e) => setNewSubText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSub(activeGoal.id); }} placeholder="Adicionar subtarefa da meta..."
              className="flex-1 bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-xl px-4 py-3 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all" />
            <button type="button" onClick={() => addSub(activeGoal.id)} className="shrink-0 w-11 h-11 rounded-xl bg-magenta hover:bg-magenta-dark flex items-center justify-center transition-all shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
          <div className="space-y-2">
            {activeGoal.subtasks.length === 0 && <div className="py-12 text-center"><p className="text-sm text-grafite italic">Adicione subtarefas para acompanhar o progresso da meta</p></div>}
            {activeGoal.subtasks.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-3.5 group animate-fade-in">
                <button type="button" onClick={() => toggleSub(activeGoal.id, sub.id)} className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${sub.done ? 'bg-magenta border-magenta scale-110' : 'border-grafite/25 hover:border-magenta bg-white'}`}>
                  {sub.done && <svg className="w-4 h-4 text-white animate-scale-in" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </button>
                <p className={`flex-1 text-sm transition-all duration-200 ${sub.done ? 'line-through text-grafite/40' : 'text-grafite font-medium'}`}>{sub.text}</p>
                <DeleteButton onClick={() => deleteSub(activeGoal.id, sub.id)} ariaLabel="Excluir subtarefa" />
              </div>
            ))}
          </div>
          {pct === 100 && activeGoal.subtasks.length > 0 && (
            <div className="mt-6 bg-magenta/10 border border-magenta/20 rounded-2xl p-4 text-center animate-fade-in"><p className="font-display font-bold text-magenta">🏆 Meta concluída! Parabéns!</p></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />
        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">🎯</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Objetivos</h1>
            <p className="text-sm text-grafite">Defina metas e acompanhe seu progresso</p>
          </div>
          <AddButton onClick={() => setMenuOpen(true)} ariaLabel="Nova meta" />
        </header>
        {goals.length === 0 ? (
          <div className="py-16 text-center animate-fade-in"><div className="text-5xl mb-4">🎯</div><p className="text-sm text-grafite italic">Nenhuma meta ainda. Toque no + para definir!</p></div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const pct = getProgress(goal);
              return (
                <button key={goal.id} type="button" onClick={() => setActiveGoalId(goal.id)} className="w-full bg-card rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-md hover:shadow-grafite/5 animate-fade-in group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-lg">{CAT_MAP[goal.category]?.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-grafite text-sm leading-snug truncate">{goal.title}</h3>
                      <p className="text-xs text-grafite mt-0.5">{goal.subtasks.filter((s) => s.done).length}/{goal.subtasks.length} subtarefas</p>
                    </div>
                    <span className="font-display font-bold text-magenta text-lg shrink-0">{pct}%</span>
                  </div>
                  <div className="h-2.5 bg-grafite/10 rounded-full overflow-hidden"><div className="h-full bg-magenta rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <SegmentMenu open={menuOpen} onClose={() => setMenuOpen(false)} title="Nova meta" segments={CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: '#C90055' }))} onSelect={handleCategorySelect} />
      {formCat && (
        <>
          <div className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm animate-fade-in" onClick={() => setFormCat(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
            <h3 className="font-display font-bold text-magenta text-lg mb-4 text-center">{CAT_MAP[formCat]?.icon} {CAT_MAP[formCat]?.label}</h3>
            <div>
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Título da meta</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Conquistar objetivo"
                className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all" />
            </div>
            <button type="button" onClick={createGoal} disabled={!formTitle.trim()} className="w-full mt-4 bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300">Criar meta</button>
          </div>
        </>
      )}
    </div>
  );
}
