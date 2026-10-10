export type ModuleId = 'planner' | 'tasks' | 'notes' | 'goals' | 'financial-goals' | 'journey' | 'documents';

export interface ModuleCard {
  id: ModuleId;
  label: string;
  icon: string;
  description: string;
}

export const MODULE_CARDS: ModuleCard[] = [
  { id: 'planner',   label: 'Planner',              icon: '📅', description: 'Calendário e compromissos' },
  { id: 'tasks',     label: 'Tarefas & Checklists',  icon: '✅', description: 'Organize suas tarefas' },
  { id: 'notes',     label: 'Anotações',             icon: '📝', description: 'Notas e resumos' },
  { id: 'goals',     label: 'Objetivos',             icon: '🎯', description: 'Metas e progresso' },
  { id: 'financial-goals', label: 'Metas Financeiras', icon: '💰', description: 'Guarde dinheiro para seus planos' },
  { id: 'journey',   label: 'Minha Jornada',         icon: '🧭', description: 'Linha do tempo' },
];

export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

export function saveState<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}
