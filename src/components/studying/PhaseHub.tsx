import { useState, useEffect } from 'react';
import { Pencil, Check } from 'lucide-react';
import { BackButton, AddButton } from './sharedUI';
import { useStudyNotifications } from './useStudyNotifications';
import { getPhaseConfig, type PhaseConfig } from './phaseConfigs';
import type { ModuleId } from './studyingTypes';
import PlannerModule from './PlannerModule';
import TasksModule from './TasksModule';
import NotesModule from './NotesModule';
import GoalsModule from './GoalsModule';
import FinancialGoalsModule from './FinancialGoalsModule';
import JourneyModule from './JourneyModule';
import DocumentsModule from './DocumentsModule';
import HoursTrackerModule from './HoursTrackerModule';

type View = 'hub' | ModuleId | 'hours-tracker';

interface PhaseHubProps {
  config: PhaseConfig;
  onBack: () => void;
  userEmail: string;
}

const PHASE_FORM_KEY = (phaseId: string, email: string) => `minha-jornada-phase-form:${phaseId}:${email || 'default'}`;

function loadPhaseForm(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {}
  return {};
}

function savePhaseForm(key: string, data: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(data));
}

export default function PhaseHub({ config, onBack, userEmail }: PhaseHubProps) {
  const [viewStack, setViewStack] = useState<View[]>(['hub']);
  const currentView = viewStack[viewStack.length - 1];
  const { showPermissionBanner, requestPermission, activeNotifications, dismissNotification } = useStudyNotifications(config);

  const formKey = PHASE_FORM_KEY(config.id, userEmail);
  const [formDone, setFormDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>(() => loadPhaseForm(formKey));
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = loadPhaseForm(formKey);
    const hasAnswers = Object.keys(saved).length > 0;
    setFormAnswers(saved);
    setFormDone(hasAnswers);
    // Only show blocking form if questions exist AND skipFormBarrier is not set
    setShowForm(!hasAnswers && config.questions.length > 0 && !config.skipFormBarrier);
    setDraftAnswers(hasAnswers ? { ...saved } : {});
  }, [formKey, config.questions.length, config.skipFormBarrier]);

  const pushView = (v: View) => setViewStack((prev) => [...prev, v]);
  const popView = () => setViewStack((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));

  const handleFormSubmit = () => {
    const filled: Record<string, string> = {};
    config.questions.forEach((q) => {
      const val = draftAnswers[q.id]?.trim();
      if (val) filled[q.id] = val;
    });
    savePhaseForm(formKey, filled);
    setFormAnswers(filled);
    setFormDone(true);
    setShowForm(false);
  };

  const handleEditForm = () => {
    setDraftAnswers({ ...formAnswers });
    setShowForm(true);
  };

  // ─── Inline data card handlers (for skipFormBarrier phases) ───
  const [editingDataCard, setEditingDataCard] = useState(false);

  const handleDataCardSave = () => {
    const filled: Record<string, string> = {};
    config.questions.forEach((q) => {
      const val = draftAnswers[q.id]?.trim();
      if (val) filled[q.id] = val;
    });
    savePhaseForm(formKey, filled);
    setFormAnswers(filled);
    setFormDone(Object.keys(filled).length > 0);
    setEditingDataCard(false);
  };

  const handleDataCardEdit = () => {
    setDraftAnswers({ ...formAnswers });
    setEditingDataCard(true);
  };

  if (currentView !== 'hub') {
    return (
      <>
        {renderModule(currentView, popView, config.id, config.storagePrefix)}
        {activeNotifications.length > 0 && renderNotificationStack(activeNotifications, dismissNotification)}
      </>
    );
  }

  // ─── Phase form modal (blocking barrier — skipped for skipFormBarrier phases) ───
  if (showForm && config.questions.length > 0 && !config.skipFormBarrier) {
    return (
      <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
        <div className="max-w-md mx-auto">
          <BackButton onBack={onBack} ariaLabel="Voltar" />

          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 animate-fade-in-down mt-4">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-xl bg-magenta/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📋</span>
              </div>
              <h2 className="font-display text-xl font-bold text-magenta mb-1">{config.title}</h2>
              <p className="text-sm text-grafite">Conte um pouco mais sobre sua jornada nesta fase</p>
            </div>

            <div className="space-y-5 mb-6">
              {config.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-grafite mb-1.5">{q.label}</label>
                  <input
                    type="text"
                    value={draftAnswers[q.id] ?? ''}
                    onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.placeholder}
                    className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-xl px-4 py-3 text-sm text-grafite placeholder:text-grafite/40 focus:outline-none transition-all"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleFormSubmit}
              className="w-full bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300"
            >
              Salvar e Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar para minha fase" />

        {showPermissionBanner && (
          <div className="mb-6 bg-white rounded-2xl p-5 shadow-md border border-magenta/15 animate-fade-in-down flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">🔔</div>
            <div className="flex-1 text-center sm:text-left">
              <p className="font-display font-bold text-magenta text-sm mb-1">[ Ativar Lembretes e Notificações no Celular ]</p>
              <p className="text-xs text-grafite">Receba alertas antes de compromissos e do vencimento das suas metas financeiras.</p>
            </div>
            <button type="button" onClick={requestPermission} className="bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-sm px-6 py-2.5 rounded-xl transition-all duration-300 shadow-sm shrink-0">Ativar</button>
          </div>
        )}

        {activeNotifications.length > 0 && (
          <div className="mb-6 space-y-3">
            {activeNotifications.map((notif) => (
              <div key={notif.id} className="bg-magenta/10 border border-magenta/20 rounded-2xl p-4 flex items-start gap-3 animate-fade-in-down">
                <div className="w-10 h-10 rounded-xl bg-magenta flex items-center justify-center shrink-0 text-white text-lg">{notif.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-magenta mb-0.5">{notif.title}</p>
                  <p className="text-sm text-grafite leading-relaxed">{notif.body}</p>
                </div>
                <button type="button" onClick={() => dismissNotification(notif.id)} className="text-grafite hover:text-magenta text-sm font-bold shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Phase data card — editable inline */}
        {config.questions.length > 0 && (
          <div className="mb-6 bg-[#F3F3F3] rounded-2xl p-4 animate-fade-in-down">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-grafite uppercase tracking-wider">Dados da minha jornada</p>
              <button
                type="button"
                onClick={() => editingDataCard ? handleDataCardSave() : handleDataCardEdit()}
                className="inline-flex items-center gap-1 text-xs text-grafite hover:text-magenta transition-colors font-medium focus:outline-none"
              >
                {editingDataCard
                  ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Salvar</>
                  : <><Pencil className="w-3.5 h-3.5" strokeWidth={1.8} /> Editar</>
                }
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {config.questions.map((q) => (
                <div key={q.id}>
                  <p className="text-[10px] text-grafite/60">{q.label}</p>
                  {editingDataCard ? (
                    <input
                      type="text"
                      value={draftAnswers[q.id] ?? ''}
                      onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder={q.placeholder}
                      className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all"
                    />
                  ) : (
                    <p className="text-sm font-medium text-grafite truncate">{formAnswers[q.id] || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <header className="mb-8 animate-fade-in-down">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-magenta leading-tight mb-1">{config.title}</h1>
          <p className="text-sm text-grafite">Escolha um módulo para organizar sua jornada</p>
        </header>

        {/* Hours tracker card — only for internship phase */}
        {config.hasHoursTracker && (
          <div className="mb-4 group bg-magenta/5 border border-magenta/15 rounded-2xl p-5 flex flex-row items-center gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-magenta/10 animate-fade-in cursor-pointer" onClick={() => pushView('hours-tracker')}>
            <div className="flex flex-row items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-2xl">⏱️</div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-magenta text-sm uppercase tracking-wide leading-snug">Controle de Horas de Estágio</h3>
                <p className="text-xs text-grafite mt-0.5 leading-relaxed">Registre e acompanhe suas horas realizadas</p>
              </div>
            </div>
            <AddButton onClick={() => pushView('hours-tracker')} ariaLabel="Abrir Controle de Horas" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {config.modules.map((mod, index) => (
            <div key={mod.id} className="group bg-[#F3F3F3] rounded-2xl p-5 flex flex-row items-center gap-4 transition-all duration-300 hover:shadow-lg hover:shadow-grafite/5 animate-fade-in" style={{ animationDelay: `${0.1 + index * 0.07}s`, opacity: 0 }}>
              <div className="flex flex-row items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm text-2xl">{mod.icon}</div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-grafite text-sm uppercase tracking-wide leading-snug">{mod.label}</h3>
                  <p className="text-xs text-grafite mt-0.5 leading-relaxed">{mod.description}</p>
                </div>
              </div>
              <AddButton onClick={() => pushView(mod.id)} ariaLabel={`Abrir ${mod.label}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderModule(view: View, popView: () => void, phaseId: string, storagePrefix: string) {
  if (view === 'hours-tracker') {
    return <HoursTrackerModule onBack={popView} storageKey={`${storagePrefix}-hours-tracker`} />;
  }
  switch (view) {
    case 'planner':         return <PlannerModule onBack={popView} phaseId={phaseId} />;
    case 'tasks':           return <TasksModule onBack={popView} phaseId={phaseId} />;
    case 'notes':           return <NotesModule onBack={popView} phaseId={phaseId} />;
    case 'goals':           return <GoalsModule onBack={popView} phaseId={phaseId} />;
    case 'financial-goals': return <FinancialGoalsModule onBack={popView} phaseId={phaseId} />;
    case 'journey':         return <JourneyModule onBack={popView} phaseId={phaseId} />;
    case 'documents':       return <DocumentsModule onBack={popView} />;
    default: return null;
  }
}

function renderNotificationStack(
  notifications: { id: string; title: string; body: string; icon: string }[],
  onDismiss: (id: string) => void,
) {
  return (
    <div className="fixed top-4 left-0 right-0 z-[80] px-4 space-y-3 pointer-events-none">
      {notifications.map((notif) => (
        <div key={notif.id} className="bg-white rounded-2xl p-4 shadow-xl border border-magenta/20 flex items-start gap-3 animate-fade-in-down pointer-events-auto max-w-md mx-auto">
          <div className="w-10 h-10 rounded-xl bg-magenta flex items-center justify-center shrink-0 text-white text-lg">{notif.icon}</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-magenta mb-0.5">{notif.title}</p>
            <p className="text-sm text-grafite leading-relaxed">{notif.body}</p>
          </div>
          <button type="button" onClick={() => onDismiss(notif.id)} className="text-grafite hover:text-magenta text-sm font-bold shrink-0">✕</button>
        </div>
      ))}
    </div>
  );
}

export function createPhaseComponent(phaseId: string) {
  return function PhaseComponent({ onBack, userEmail }: { onBack: () => void; userEmail: string }) {
    const config = getPhaseConfig(phaseId);
    return <PhaseHub config={config} onBack={onBack} userEmail={userEmail} />;
  };
}
