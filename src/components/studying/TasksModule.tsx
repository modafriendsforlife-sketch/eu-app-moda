import { useState } from 'react';
import { BackButton, SegmentMenu, AddButton, DeleteButton } from './sharedUI';
import { useLocalStorage } from './sharedUI';
import { getPhaseConfig, type CategoryDef } from './phaseConfigs';

interface TaskItem { id: string; text: string; done: boolean; }
interface TaskList { id: string; category: string; title: string; items: TaskItem[]; createdAt: string; }

export default function TasksModule({ onBack, phaseId }: { onBack: () => void; phaseId: string }) {
  const config = getPhaseConfig(phaseId);
  const CATEGORIES: CategoryDef[] = config.taskCategories;
  const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, CategoryDef>;
  const STORAGE_KEY = `${config.storagePrefix}-tasks`;

  const [lists, setLists] = useLocalStorage<TaskList[]>(STORAGE_KEY, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formCat, setFormCat] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [activeListId, setActiveListId] = useState<string | null>(null);

  const activeList = lists.find((l) => l.id === activeListId);

  const handleCategorySelect = (catId: string) => { setFormCat(catId); setFormTitle(CAT_MAP[catId]?.label ?? 'Nova checklist'); };

  const createList = () => {
    if (!formCat || !formTitle.trim()) return;
    const newList: TaskList = { id: `${Date.now()}`, category: formCat, title: formTitle.trim(), items: [], createdAt: new Date().toISOString() };
    setLists((prev) => [newList, ...prev]); setActiveListId(newList.id); setFormCat(null);
  };

  const addItem = (listId: string) => {
    const text = (newItemText[listId] ?? '').trim(); if (!text) return;
    setLists((prev) => prev.map((l) => l.id === listId ? { ...l, items: [...l.items, { id: `${Date.now()}`, text, done: false }] } : l));
    setNewItemText((prev) => ({ ...prev, [listId]: '' }));
  };

  const toggleItem = (listId: string, itemId: string) => {
    setLists((prev) => prev.map((l) => l.id === listId ? { ...l, items: l.items.map((it) => it.id === itemId ? { ...it, done: !it.done } : it) } : l));
  };

  const deleteItem = (listId: string, itemId: string) => {
    setLists((prev) => prev.map((l) => l.id === listId ? { ...l, items: l.items.filter((it) => it.id !== itemId) } : l));
  };

  const deleteList = (listId: string) => { setLists((prev) => prev.filter((l) => l.id !== listId)); if (activeListId === listId) setActiveListId(null); };

  if (activeList) {
    const completed = activeList.items.filter((i) => i.done).length;
    const total = activeList.items.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
      <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
        <div className="max-w-2xl mx-auto">
          <BackButton onBack={() => setActiveListId(null)} ariaLabel="Voltar para as checklists" />
          <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
            <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">{CAT_MAP[activeList.category]?.icon}</div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-magenta leading-tight truncate">{activeList.title}</h1>
              <p className="text-sm text-grafite">{completed} de {total} concluídas {total > 0 && `(${pct}%)`}</p>
            </div>
            <DeleteButton onClick={() => deleteList(activeList.id)} ariaLabel="Excluir checklist" label />
          </header>
          {total > 0 && (
            <div className="mb-6 bg-card rounded-xl p-3 animate-fade-in">
              <div className="h-2.5 bg-grafite/10 rounded-full overflow-hidden">
                <div className="h-full bg-magenta rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mb-6">
            <input type="text" value={newItemText[activeList.id] ?? ''} onChange={(e) => setNewItemText((prev) => ({ ...prev, [activeList.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addItem(activeList.id); }} placeholder="Adicionar tarefa..."
              className="flex-1 bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-xl px-4 py-3 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all" />
            <button type="button" onClick={() => addItem(activeList.id)} className="shrink-0 w-11 h-11 rounded-xl bg-magenta hover:bg-magenta-dark flex items-center justify-center transition-all shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
          <div className="space-y-2">
            {activeList.items.length === 0 && <div className="py-12 text-center"><p className="text-sm text-grafite italic">Nenhuma tarefa ainda. Adicione a primeira acima!</p></div>}
            {activeList.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-card rounded-xl px-4 py-3.5 group animate-fade-in">
                <button type="button" onClick={() => toggleItem(activeList.id, item.id)} className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${item.done ? 'bg-magenta border-magenta scale-110' : 'border-grafite/25 hover:border-magenta bg-white'}`}>
                  {item.done && <svg className="w-4 h-4 text-white animate-scale-in" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </button>
                <p className={`flex-1 text-sm transition-all duration-200 ${item.done ? 'line-through text-grafite/40' : 'text-grafite font-medium'}`}>{item.text}</p>
                <DeleteButton onClick={() => deleteItem(activeList.id, item.id)} ariaLabel="Excluir tarefa" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />
        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">✅</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Tarefas & Checklists</h1>
            <p className="text-sm text-grafite">Organize suas tarefas e marque conforme conclui</p>
          </div>
          <AddButton onClick={() => setMenuOpen(true)} ariaLabel="Nova checklist" />
        </header>
        {lists.length === 0 ? (
          <div className="py-16 text-center animate-fade-in"><div className="text-5xl mb-4">✅</div><p className="text-sm text-grafite italic">Nenhuma checklist ainda. Toque no + para criar!</p></div>
        ) : (
          <div className="space-y-3">
            {lists.map((list) => {
              const completed = list.items.filter((i) => i.done).length;
              const total = list.items.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <button key={list.id} type="button" onClick={() => setActiveListId(list.id)} className="w-full bg-card rounded-2xl p-4 flex items-center gap-3 text-left transition-all duration-300 hover:shadow-md hover:shadow-grafite/5 animate-fade-in group">
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-xl">{CAT_MAP[list.category]?.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-grafite text-sm leading-snug truncate">{list.title}</h3>
                    <p className="text-xs text-grafite mt-0.5">{completed}/{total} concluídas</p>
                    <div className="mt-1.5 h-1.5 bg-grafite/10 rounded-full overflow-hidden"><div className="h-full bg-magenta rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <svg className="w-5 h-5 text-grafite/30 group-hover:text-magenta transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <SegmentMenu open={menuOpen} onClose={() => setMenuOpen(false)} title="Nova checklist" segments={CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: '#C90055' }))} onSelect={handleCategorySelect} />
      {formCat && (
        <>
          <div className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm animate-fade-in" onClick={() => setFormCat(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
            <h3 className="font-display font-bold text-magenta text-lg mb-4 text-center">{CAT_MAP[formCat]?.icon} {CAT_MAP[formCat]?.label}</h3>
            <div>
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Título da checklist</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Revisão"
                className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all" />
            </div>
            <button type="button" onClick={createList} disabled={!formTitle.trim()} className="w-full mt-4 bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300">Criar checklist</button>
          </div>
        </>
      )}
    </div>
  );
}
