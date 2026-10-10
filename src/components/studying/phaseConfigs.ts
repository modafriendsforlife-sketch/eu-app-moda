import type { ModuleId } from './studyingTypes';

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
}

export interface NotificationTrigger {
  hoursBefore: number;
  notifTitle: string;
  icon: string;
  message: (title: string) => string;
  weekly?: boolean;
}

export interface PlannerCategoryDef extends CategoryDef {
  color: string;
  priority?: boolean;
  triggers?: NotificationTrigger[];
}

export interface ModuleCard {
  id: ModuleId;
  label: string;
  icon: string;
  description: string;
}

export interface PhaseQuestion {
  id: string;
  label: string;
  placeholder: string;
}

export interface PhaseConfig {
  id: string;
  title: string;
  modules: ModuleCard[];
  plannerCategories: PlannerCategoryDef[];
  taskCategories: CategoryDef[];
  notesCategories: CategoryDef[];
  goalsCategories: CategoryDef[];
  storagePrefix: string;
  questions: PhaseQuestion[];
  hasHoursTracker?: boolean;
  skipFormBarrier?: boolean;
}

const SHARED_MODULES: ModuleCard[] = [
  { id: 'planner',         label: 'Planner',            icon: '📅', description: 'Calendário e compromissos' },
  { id: 'tasks',           label: 'Tarefas & Checklists', icon: '✅', description: 'Organize suas tarefas' },
  { id: 'notes',           label: 'Anotações',           icon: '📝', description: 'Notas e resumos' },
  { id: 'goals',           label: 'Objetivos',           icon: '🎯', description: 'Metas e progresso' },
  { id: 'financial-goals', label: 'Metas Financeiras',   icon: '💰', description: 'Guarde dinheiro para seus planos' },
  { id: 'journey',         label: 'Minha Jornada',       icon: '🧭', description: 'Linha do tempo' },
  { id: 'documents',       label: 'Documentos',          icon: '📁', description: 'Adicione fotos e use a câmera' },
];

const WORKING_MODULES: ModuleCard[] = SHARED_MODULES.filter((m) => m.id !== 'goals');

// ─── Estou Estudando (existing, unchanged) ───
const STUDYING: PhaseConfig = {
  id: 'studying',
  title: 'ESTOU ESTUDANDO',
  modules: SHARED_MODULES,
  storagePrefix: 'minha-jornada',
  questions: [
    { id: 'course', label: 'Qual curso você está fazendo?', placeholder: 'Ex: Pedagogia' },
    { id: 'institution', label: 'Qual a sua instituição de ensino?', placeholder: 'Ex: Universidade Federal' },
  ],
  plannerCategories: [
    { id: 'delivery', label: 'Entrega',           icon: '📅', color: '#E53935', priority: true, triggers: [{ hoursBefore: 24, notifTitle: 'Lembrete de Prazo', icon: '⏰', message: (t) => `Atenção ao prazo! ⏰ A atividade '${t}' está agendada para amanhã. Garanta que tudo esteja pronto e organizado!` }] },
    { id: 'class',    label: 'Aula',              icon: '📚', color: '#1E88E5' },
    { id: 'exam',     label: 'Prova',             icon: '📝', color: '#C90055', triggers: [
      { hoursBefore: 24, notifTitle: 'Compromisso Importante', icon: '⚠️', message: (t) => `Atenção! ⚠️ O seu compromisso importante de ${t} está chegando. Prepare-se e dê uma conferida na sua rotina hoje! Boa sorte! 🌟` },
      { hoursBefore: 2,  notifTitle: 'Compromisso em 2 horas',  icon: '⚠️', message: (t) => `Atenção! ⚠️ O seu compromisso importante de ${t} está chegando. Prepare-se e dê uma conferida na sua rotina hoje! Boa sorte! 🌟` },
    ] },
    { id: 'work',     label: 'Trabalho',          icon: '📄', color: '#F48FB1', triggers: [{ hoursBefore: 24, notifTitle: 'Lembrete de Prazo', icon: '⏰', message: (t) => `Atenção ao prazo! ⏰ A atividade '${t}' está agendada para amanhã. Garanta que tudo esteja pronto e organizado!` }] },
    { id: 'seminar',  label: 'Seminário',         icon: '🎤', color: '#FDD835' },
    { id: 'group',    label: 'Trabalho em grupo', icon: '👥', color: '#26C6DA' },
    { id: 'course',   label: 'Curso',             icon: '🎓', color: '#3E3E3E' },
    { id: 'other',    label: 'Outra data',        icon: '⭐', color: '#BDBDBD' },
  ],
  taskCategories: [
    { id: 'study',   label: 'Checklist de estudos',    icon: '📚' },
    { id: 'exam',    label: 'Checklist para prova',    icon: '📝' },
    { id: 'work',    label: 'Checklist de trabalho',   icon: '📄' },
    { id: 'seminar', label: 'Checklist de seminário',  icon: '🎤' },
    { id: 'course',  label: 'Checklist de curso',      icon: '🎓' },
    { id: 'custom',  label: 'Checklist personalizado', icon: '📌' },
  ],
  notesCategories: [
    { id: 'subject',  label: 'Matéria',        icon: '📚' },
    { id: 'summary',  label: 'Resumo',         icon: '📝' },
    { id: 'idea',     label: 'Ideia',          icon: '💡' },
    { id: 'reminder', label: 'Lembrete',       icon: '📌' },
    { id: 'free',     label: 'Anotação livre', icon: '✏️' },
  ],
  goalsCategories: [
    { id: 'study',    label: 'Estudos',          icon: '📚' },
    { id: 'course',   label: 'Curso',            icon: '🎓' },
    { id: 'perf',     label: 'Desempenho',       icon: '📈' },
    { id: 'achieve',  label: 'Conquista',        icon: '🏆' },
    { id: 'personal', label: 'Objetivo pessoal', icon: '✨' },
  ],
};

// ─── Estou em Estágio ───
const INTERNSHIP: PhaseConfig = {
  id: 'internship',
  title: 'ESTOU EM ESTÁGIO',
  modules: SHARED_MODULES,
  storagePrefix: 'minha-jornada-internship',
  questions: [
    { id: 'company', label: 'Onde você está fazendo seu estágio?', placeholder: 'Ex: Empresa XYZ' },
    { id: 'area', label: 'Qual a área do estágio?', placeholder: 'Ex: Recursos Humanos' },
  ],
  hasHoursTracker: true,
  plannerCategories: [
    { id: 'shift',      label: 'Plantão/Turno',  icon: '⏰', color: '#C90055', priority: true, triggers: [
      { hoursBefore: 24, notifTitle: 'Compromisso Importante', icon: '⚠️', message: (t) => `Atenção! ⚠️ O seu compromisso importante de ${t} está chegando. Prepare-se e dê uma conferida na sua rotina hoje! Boa sorte! 🌟` },
      { hoursBefore: 2,  notifTitle: 'Compromisso em 2 horas',  icon: '⚠️', message: (t) => `Atenção! ⚠️ O seu compromisso importante de ${t} está chegando. Prepare-se e dê uma conferida na sua rotina hoje! Boa sorte! 🌟` },
    ] },
    { id: 'day',        label: 'Dia de estágio', icon: '📋', color: '#1E88E5' },
    { id: 'evaluation', label: 'Avaliação',      icon: '📝', color: '#FDD835' },
    { id: 'meeting',    label: 'Reunião',        icon: '👥', color: '#26C6DA' },
    { id: 'course',     label: 'Curso',          icon: '🎓', color: '#3E3E3E' },
    { id: 'appointment',label: 'Compromisso',    icon: '📌', color: '#F48FB1' },
    { id: 'other',      label: 'Outra data',     icon: '📅', color: '#BDBDBD' },
  ],
  taskCategories: [
    { id: 'internship',  label: 'Checklist do estágio',    icon: '📋' },
    { id: 'activities',  label: 'Checklist de atividades', icon: '📝' },
    { id: 'study',       label: 'Checklist de estudos',    icon: '📚' },
    { id: 'documents',   label: 'Checklist de documentos', icon: '📑' },
    { id: 'pending',     label: 'Checklist de pendências', icon: '📌' },
    { id: 'custom',      label: 'Checklist personalizado', icon: '➕' },
  ],
  notesCategories: [
    { id: 'diary',      label: 'Diário do estágio', icon: '📓' },
    { id: 'experience', label: 'Experiência prática', icon: '💼' },
    { id: 'learning',   label: 'Aprendizado',        icon: '💡' },
    { id: 'reminder',   label: 'Lembrete',           icon: '📌' },
    { id: 'free',       label: 'Anotação livre',     icon: '✏️' },
  ],
  goalsCategories: [
    { id: 'practice',    label: 'Prática profissional', icon: '💼' },
    { id: 'learning',    label: 'Aprendizado',          icon: '📚' },
    { id: 'development', label: 'Desenvolvimento',      icon: '📈' },
    { id: 'achievement', label: 'Conquista',            icon: '🏆' },
    { id: 'personal',    label: 'Objetivo pessoal',     icon: '✨' },
  ],
};

// ─── Vou Me Formar ───
const GRADUATING: PhaseConfig = {
  id: 'graduating',
  title: 'VOU ME FORMAR',
  modules: SHARED_MODULES,
  storagePrefix: 'minha-jornada-graduating',
  questions: [
    { id: 'course', label: 'Qual curso está concluindo?', placeholder: 'Ex: Pedagogia' },
    { id: 'institution', label: 'Qual sua instituição de ensino?', placeholder: 'Ex: Universidade Federal' },
  ],
  plannerCategories: [
    { id: 'exam',         label: 'Prova',        icon: '📝', color: '#1E88E5' },
    { id: 'tcc',          label: 'TCC',          icon: '📄', color: '#C90055', priority: true, triggers: [{ hoursBefore: 168, notifTitle: 'Lembrete Semanal do TCC', icon: '📄', message: (t) => `Não esqueça! 📄 Você tem o TCC "${t}" em andamento. Dedique um tempinho esta semana para avançar!`, weekly: true }] },
    { id: 'orientation',  label: 'Orientação',   icon: '👨\u200d🏫', color: '#26C6DA' },
    { id: 'presentation', label: 'Apresentação', icon: '🎤', color: '#FDD835', triggers: [{ hoursBefore: 24, notifTitle: 'Lembrete de Prazo', icon: '⏰', message: (t) => `Atenção ao prazo! ⏰ A atividade '${t}' está agendada para amanhã. Garanta que tudo esteja pronto e organizado!` }] },
    { id: 'document',     label: 'Documento',    icon: '📑', color: '#F48FB1' },
    { id: 'collation',    label: 'Colação',      icon: '🎓', color: '#E53935' },
    { id: 'graduation',   label: 'Formatura',    icon: '🎉', color: '#3E3E3E' },
    { id: 'other',        label: 'Outra data',   icon: '⭐', color: '#BDBDBD' },
  ],
  taskCategories: [
    { id: 'tcc',          label: 'Checklist do TCC',        icon: '📄' },
    { id: 'graduation',   label: 'Checklist da formatura',  icon: '🎓' },
    { id: 'documents',    label: 'Checklist de documentos', icon: '📑' },
    { id: 'exams',        label: 'Checklist de provas',     icon: '📝' },
    { id: 'presentation', label: 'Checklist de apresentação', icon: '🎤' },
    { id: 'custom',       label: 'Checklist personalizado', icon: '📌' },
  ],
  notesCategories: [
    { id: 'tcc',       label: 'TCC',          icon: '📄' },
    { id: 'idea',      label: 'Ideia',        icon: '💡' },
    { id: 'graduation',label: 'Formatura',    icon: '📌' },
    { id: 'planning',  label: 'Planejamento', icon: '📝' },
    { id: 'free',      label: 'Anotação livre', icon: '✏️' },
  ],
  goalsCategories: [
    { id: 'conclusion',   label: 'Conclusão',            icon: '🎓' },
    { id: 'tcc',          label: 'TCC',                  icon: '📄' },
    { id: 'professional', label: 'Preparação profissional', icon: '💼' },
    { id: 'next-step',    label: 'Próximo passo',        icon: '🚀' },
    { id: 'achievement',  label: 'Conquista',            icon: '🏆' },
  ],
};

// ─── Primeiro Emprego ───
const FIRST_JOB: PhaseConfig = {
  id: 'first-job',
  title: 'PRIMEIRO EMPREGO',
  modules: SHARED_MODULES,
  storagePrefix: 'minha-jornada-first-job',
  questions: [
    { id: 'area', label: 'Qual área você quer atuar?', placeholder: 'Ex: Educação' },
    { id: 'expectation', label: 'Qual sua expectativa para o primeiro emprego?', placeholder: 'Ex: Aprender na prática' },
  ],
  skipFormBarrier: true,
  plannerCategories: [
    { id: 'application',  label: 'Candidatura',     icon: '💼', color: '#1E88E5' },
    { id: 'interview',    label: 'Entrevista',      icon: '🪪', color: '#C90055', priority: true, triggers: [
      { hoursBefore: 24, notifTitle: 'Compromisso Importante', icon: '⚠️', message: (t) => `Atenção! ⚠️ O seu compromisso importante de ${t} está chegando. Prepare-se e dê uma conferida na sua rotina hoje! Boa sorte! 🌟` },
      { hoursBefore: 2,  notifTitle: 'Compromisso em 2 horas',  icon: '⚠️', message: (t) => `Atenção! ⚠️ O seu compromisso importante de ${t} está chegando. Prepare-se e dê uma conferida na sua rotina hoje! Boa sorte! 🌟` },
    ] },
    { id: 'test',         label: 'Teste',           icon: '📝', color: '#FDD835' },
    { id: 'callback',     label: 'Retorno',         icon: '📞', color: '#26C6DA' },
    { id: 'documentation',label: 'Documentação',    icon: '📄', color: '#F48FB1' },
    { id: 'first-day',    label: 'Primeiro dia',    icon: '🚀', color: '#E53935' },
    { id: 'other',        label: 'Outro compromisso', icon: '⭐', color: '#BDBDBD' },
  ],
  taskCategories: [
    { id: 'application',  label: 'Checklist de candidatura', icon: '💼' },
    { id: 'resume',       label: 'Checklist do currículo',    icon: '📄' },
    { id: 'interview',    label: 'Checklist de entrevista',   icon: '🤝' },
    { id: 'documents',    label: 'Checklist de documentos',   icon: '📑' },
    { id: 'pending',      label: 'Checklist de pendências',   icon: '📌' },
    { id: 'custom',       label: 'Checklist personalizado',   icon: '➕' },
  ],
  notesCategories: [
    { id: 'company',   label: 'Empresa',        icon: '💼' },
    { id: 'interview', label: 'Entrevista',     icon: '🤝' },
    { id: 'idea',      label: 'Ideia',          icon: '💡' },
    { id: 'reminder',  label: 'Lembrete',       icon: '📌' },
    { id: 'free',      label: 'Anotação livre', icon: '✏️' },
  ],
  goalsCategories: [
    { id: 'get-job',     label: 'Conseguir emprego', icon: '💼' },
    { id: 'resume',      label: 'Currículo',         icon: '📄' },
    { id: 'interviews',  label: 'Entrevistas',       icon: '🤝' },
    { id: 'development', label: 'Desenvolvimento',   icon: '📈' },
    { id: 'personal',    label: 'Meta pessoal',      icon: '🎯' },
  ],
};

// ─── Já Trabalho ───
const WORKING: PhaseConfig = {
  id: 'working',
  title: 'JÁ TRABALHO',
  modules: WORKING_MODULES,
  storagePrefix: 'minha-jornada-working',
  questions: [
    { id: 'company', label: 'Aonde você trabalha atualmente?', placeholder: 'Ex: Empresa XYZ' },
    { id: 'role', label: 'Qual é o seu cargo?', placeholder: 'Ex: Analista Pedagógico' },
  ],
  skipFormBarrier: true,
  plannerCategories: [
    { id: 'meeting',       label: 'Reunião',        icon: '👥', color: '#1E88E5' },
    { id: 'appointment',   label: 'Compromisso',    icon: '📌', color: '#F48FB1' },
    { id: 'course',        label: 'Curso',          icon: '📚', color: '#3E3E3E' },
    { id: 'event',         label: 'Evento',         icon: '🎤', color: '#FDD835' },
    { id: 'vacation',      label: 'Férias',         icon: '🏖️', color: '#26C6DA' },
    { id: 'consultation',  label: 'Consulta',       icon: '🩺', color: '#C90055' },
    { id: 'important-date',label: 'Data importante',icon: '📅', color: '#E53935' },
    { id: 'other',         label: 'Outro',          icon: '⭐', color: '#BDBDBD' },
  ],
  taskCategories: [
    { id: 'work-task',  label: 'Tarefa do trabalho',     icon: '💼' },
    { id: 'personal',   label: 'Checklist pessoal',      icon: '📝' },
    { id: 'travel',     label: 'Checklist de viagem',    icon: '✈️' },
    { id: 'resolve',    label: 'Coisas para resolver',   icon: '📌' },
    { id: 'pending',    label: 'Pendências',             icon: '📋' },
    { id: 'custom',     label: 'Checklist personalizado',icon: '➕' },
  ],
  notesCategories: [
    { id: 'free', label: 'Anotação livre', icon: '✏️' },
  ],
  goalsCategories: [],
};

export const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  studying:   STUDYING,
  internship: INTERNSHIP,
  graduating: GRADUATING,
  'first-job': FIRST_JOB,
  working:    WORKING,
};

export function getPhaseConfig(id: string): PhaseConfig {
  return PHASE_CONFIGS[id] ?? STUDYING;
}
