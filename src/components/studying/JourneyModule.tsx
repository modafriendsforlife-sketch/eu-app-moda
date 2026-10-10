import { useMemo } from 'react';
import { BackButton } from './sharedUI';
import { getPhaseConfig } from './phaseConfigs';

interface TimelineNode { id: string; date: string; title: string; description: string; icon: string; }
interface TaskList { id: string; category: string; title: string; items: { id: string; text: string; done: boolean }[]; createdAt: string; }
interface Goal { id: string; category: string; title: string; subtasks: { id: string; done: boolean }[]; createdAt: string; }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function JourneyModule({ onBack, phaseId }: { onBack: () => void; phaseId: string }) {
  const config = getPhaseConfig(phaseId);
  const prefix = config.storagePrefix;

  const nodes = useMemo<TimelineNode[]>(() => {
    const collected: TimelineNode[] = [];

    try {
      const goalsRaw = localStorage.getItem(`${prefix}-goals`);
      if (goalsRaw) {
        const goals: Goal[] = JSON.parse(goalsRaw);
        goals.forEach((g) => {
          if (g.subtasks.length > 0 && g.subtasks.every((s) => s.done)) {
            collected.push({ id: `goal-${g.id}`, date: g.createdAt, title: 'Meta concluída', description: `Você concluiu todas as subtarefas da meta "${g.title}"`, icon: '🎯' });
          }
        });
      }
    } catch {}

    try {
      const tasksRaw = localStorage.getItem(`${prefix}-tasks`);
      if (tasksRaw) {
        const lists: TaskList[] = JSON.parse(tasksRaw);
        lists.forEach((l) => {
          if (l.items.length > 0 && l.items.every((i) => i.done)) {
            collected.push({ id: `task-${l.id}`, date: l.createdAt, title: 'Checklist concluída', description: `Você finalizou todas as tarefas de "${l.title}"`, icon: '✅' });
          }
        });
      }
    } catch {}

    collected.sort((a, b) => b.date.localeCompare(a.date));
    return collected;
  }, [prefix]);

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />
        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">🧭</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Minha Jornada</h1>
            <p className="text-sm text-grafite">Seus marcos registrados automaticamente</p>
          </div>
        </header>
        {nodes.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="text-5xl mb-4">🧭</div>
            <p className="text-sm text-grafite italic leading-relaxed max-w-xs mx-auto">
              Sua linha do tempo vai se preencher automaticamente conforme você conclui metas e finaliza checklists.
            </p>
          </div>
        ) : (
          <div className="relative pl-8">
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-magenta/20" />
            <div className="space-y-6">
              {nodes.map((node, index) => (
                <div key={node.id} className="relative animate-fade-in" style={{ animationDelay: `${index * 0.08}s`, opacity: 0 }}>
                  <div className="absolute -left-[22px] top-1 w-5 h-5 rounded-full bg-magenta ring-4 ring-offwhite flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div className="bg-card rounded-2xl p-4 transition-all duration-300 hover:shadow-md hover:shadow-grafite/5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-lg">{node.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-magenta text-sm leading-snug">{node.title}</h3>
                        <p className="text-xs text-grafite mt-1 leading-relaxed">{node.description}</p>
                        <p className="text-[10px] text-grafite/50 mt-2">{formatDate(node.date)} · {formatTime(node.date)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
