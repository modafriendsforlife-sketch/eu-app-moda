import { useState, useRef, useEffect } from 'react';
import { BackButton, SegmentMenu, AddButton, DeleteButton } from './sharedUI';
import { useLocalStorage } from './sharedUI';
import { getPhaseConfig, type CategoryDef } from './phaseConfigs';

interface Note { id: string; category: string; title: string; content: string; updatedAt: string; }

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function NotesModule({ onBack, phaseId }: { onBack: () => void; phaseId: string }) {
  const config = getPhaseConfig(phaseId);
  const CATEGORIES: CategoryDef[] = config.notesCategories;
  const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, CategoryDef>;
  const STORAGE_KEY = `${config.storagePrefix}-notes`;

  const [notes, setNotes] = useLocalStorage<Note[]>(STORAGE_KEY, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const handleCategorySelect = (catId: string) => {
    const newNote: Note = { id: `${Date.now()}`, category: catId, title: '', content: '', updatedAt: new Date().toISOString() };
    setEditingNote(newNote); setEditCategory(catId); setEditTitle(''); setEditContent('');
  };

  useEffect(() => {
    if (!editingNote) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setNotes((prev) => {
        const updated: Note = { ...editingNote, title: editTitle, content: editContent, category: editCategory, updatedAt: new Date().toISOString() };
        const exists = prev.some((n) => n.id === updated.id);
        if (exists) return prev.map((n) => (n.id === updated.id ? updated : n));
        return [updated, ...prev];
      });
      setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1500);
    }, 800);
  }, [editTitle, editContent, editCategory, editingNote]);

  const closeEditor = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (editingNote) {
      setNotes((prev) => {
        const updated: Note = { ...editingNote, title: editTitle, content: editContent, category: editCategory, updatedAt: new Date().toISOString() };
        const exists = prev.some((n) => n.id === updated.id);
        if (exists) return prev.map((n) => (n.id === updated.id ? updated : n));
        return [updated, ...prev];
      });
    }
    setEditingNote(null);
  };

  const deleteNote = (id: string) => { setNotes((prev) => prev.filter((n) => n.id !== id)); };

  if (editingNote) {
    const cat = CAT_MAP[editCategory];
    return (
      <div className="min-h-screen bg-offwhite flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between border-b border-grafite/5">
          <button type="button" onClick={closeEditor} className="inline-flex items-center gap-2 text-grafite hover:text-magenta transition-colors rounded-md px-1 py-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <span className={`text-xs font-medium transition-opacity ${savedMsg ? 'text-magenta opacity-100' : 'text-grafite/40 opacity-0'}`}>✓ Salvo</span>
        </div>
        <div className="flex-1 px-6 py-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{cat?.icon}</span>
            <span className="text-xs font-medium text-grafite bg-magenta/5 rounded-full px-3 py-1">{cat?.label}</span>
          </div>
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título da anotação"
            className="w-full font-display text-xl font-bold text-magenta bg-transparent border-none focus:outline-none placeholder:text-magenta/30 mb-4" />
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="Comece a escrever..."
            className="w-full flex-1 min-h-[50vh] bg-transparent text-sm text-grafite leading-relaxed border-none focus:outline-none resize-none placeholder:text-grafite/25" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />
        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">📝</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Anotações</h1>
            <p className="text-sm text-grafite">Suas notas organizadas por categoria</p>
          </div>
          <AddButton onClick={() => setMenuOpen(true)} ariaLabel="Nova anotação" />
        </header>
        {notes.length === 0 ? (
          <div className="py-16 text-center animate-fade-in"><div className="text-5xl mb-4">📝</div><p className="text-sm text-grafite italic">Nenhuma anotação ainda. Toque no + para começar!</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notes.map((note) => {
              const cat = CAT_MAP[note.category];
              return (
                <div key={note.id} onClick={() => { setEditingNote(note); setEditTitle(note.title); setEditContent(note.content); setEditCategory(note.category); }}
                  className="bg-card rounded-2xl p-4 text-left cursor-pointer transition-all duration-300 hover:shadow-md hover:shadow-grafite/5 animate-fade-in group relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{cat?.icon}</span>
                    <span className="text-[10px] font-medium text-grafite bg-magenta/5 rounded-full px-2 py-0.5">{cat?.label}</span>
                  </div>
                  <h3 className="font-display font-bold text-grafite text-sm leading-snug mb-1 truncate">{note.title || 'Sem título'}</h3>
                  <p className="text-xs text-grafite line-clamp-3 leading-relaxed">{note.content || 'Vazia'}</p>
                  <p className="text-[10px] text-grafite/50 mt-2">{formatDate(note.updatedAt)}</p>
                  <DeleteButton onClick={() => deleteNote(note.id)} ariaLabel="Excluir anotação" className="absolute top-2 right-2" stopPropagation />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SegmentMenu open={menuOpen} onClose={() => setMenuOpen(false)} title="Nova anotação" segments={CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: '#C90055' }))} onSelect={handleCategorySelect} />
    </div>
  );
}
