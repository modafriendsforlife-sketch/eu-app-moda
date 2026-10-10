import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { BackButton, useLocalStorage } from './sharedUI';
import { getPhaseConfig } from './phaseConfigs';

interface FinancialGoal {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string;
  createdAt: string;
}
const QUICK_AMOUNTS = [20, 50, 100, 150];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string): string {
  if (!value) return 'Sem prazo definido';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

function digitsToNumber(digits: string): number {
  if (!digits) return 0;
  return Number(digits) / 100;
}

function numberToDigits(value: number): string {
  return String(Math.round(value * 100));
}

function formatDigits(digits: string): string {
  const clean = onlyDigits(digits) || '0';
  const number = digitsToNumber(clean);
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinancialGoalsModule({ onBack, phaseId }: { onBack: () => void; phaseId: string }) {
  const config = getPhaseConfig(phaseId);
  const STORAGE_KEY = `${config.storagePrefix}-financial-goals`;
  const [goals, setGoals] = useLocalStorage<FinancialGoal[]>(STORAGE_KEY, []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [targetDigits, setTargetDigits] = useState('');
  const [deadline, setDeadline] = useState('');
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [depositDigits, setDepositDigits] = useState('');

  const totalSaved = useMemo(() => goals.reduce((sum, goal) => sum + goal.savedAmount, 0), [goals]);
  const targetNumber = digitsToNumber(targetDigits);
  const depositNumber = digitsToNumber(depositDigits);

  const resetForm = () => {
    setTitle('');
    setTargetDigits('');
    setDeadline('');
    setIsFormOpen(false);
  };

  const createGoal = () => {
    if (!title.trim() || targetNumber <= 0 || !deadline) return;
    const goal: FinancialGoal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      targetAmount: targetNumber,
      savedAmount: 0,
      deadline,
      createdAt: new Date().toISOString(),
    };
    setGoals((current) => [goal, ...current]);
    resetForm();
  };

  const addMoney = (goalId: string) => {
    if (depositNumber <= 0) return;
    setGoals((current) => current.map((goal) => (
      goal.id === goalId
        ? { ...goal, savedAmount: Math.min(goal.targetAmount, goal.savedAmount + depositNumber) }
        : goal
    )));
    setDepositDigits('');
    setSavingGoalId(null);
  };

  const addQuickAmount = (goalId: string, amount: number) => {
    setGoals((current) => current.map((goal) => (
      goal.id === goalId
        ? { ...goal, savedAmount: Math.min(goal.targetAmount, goal.savedAmount + amount) }
        : goal
    )));
  };

  const adjustDeposit = (delta: number) => {
    const next = Math.max(0, depositNumber + delta);
    setDepositDigits(numberToDigits(next));
  };

  const deleteGoal = (goalId: string) => {
    setGoals((current) => current.filter((goal) => goal.id !== goalId));
    if (savingGoalId === goalId) setSavingGoalId(null);
  };

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar" />

        <header className="mb-6 flex items-center gap-3 animate-fade-in-down">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Metas Financeiras</h1>
            <p className="text-sm text-grafite mt-1">Guarde dinheiro para realizar seus planos</p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            aria-label="Adicionar nova meta financeira"
            className="shrink-0 w-11 h-11 rounded-full bg-magenta hover:bg-magenta-dark text-white flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-magenta/20"
          >
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </header>

        <section className="bg-[#F3F3F3] rounded-2xl px-5 py-6 mb-6 animate-fade-in">
          <p className="text-[10px] uppercase tracking-wider font-bold text-grafite/60 mb-2">Total economizado</p>
          <p className="font-display text-3xl sm:text-4xl font-bold text-magenta">💰 {formatCurrency(totalSaved)} Acumulados</p>
        </section>

        {goals.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="text-5xl mb-4">💰</div>
            <p className="text-sm text-grafite italic">Nenhuma meta ainda. Toque no + para começar a guardar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const percentage = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
              const isSaving = savingGoalId === goal.id;
              const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
              return (
                <article key={goal.id} className="bg-white rounded-2xl p-5 shadow-sm border border-grafite/5 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-display font-bold text-grafite text-base leading-snug truncate">{goal.title}</h2>
                      <p className="text-xs text-grafite mt-1">Prazo final: {formatDate(goal.deadline)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteGoal(goal.id)}
                      aria-label={`Excluir meta ${goal.title}`}
                      className="shrink-0 p-1 text-grafite hover:text-magenta transition-colors"
                    >
                      <Trash2 className="w-5 h-5" strokeWidth={1.8} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-5 mb-2">
                    <span className="text-xs text-grafite">{formatCurrency(goal.savedAmount)} de {formatCurrency(goal.targetAmount)}</span>
                    <span className="font-display font-bold text-magenta text-sm">{percentage}%</span>
                  </div>
                  <div className="h-3 bg-grafite/10 rounded-full overflow-hidden">
                    <div className="h-full bg-magenta rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                  </div>

                  {isSaving ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex items-center min-w-0 flex-1">
                          <span className="absolute left-3 text-sm font-medium text-grafite/60 pointer-events-none">R$</span>
                          <input
                            autoFocus
                            type="text"
                            inputMode="numeric"
                            value={depositDigits ? formatDigits(depositDigits) : ''}
                            onChange={(event) => setDepositDigits(onlyDigits(event.target.value))}
                            onKeyDown={(event) => { if (event.key === 'Enter') addMoney(goal.id); }}
                            placeholder="0,00"
                            className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg pl-9 pr-10 py-2.5 text-sm text-grafite focus:outline-none"
                          />
                          <div className="absolute right-1 flex flex-col">
                            <button type="button" onClick={() => adjustDeposit(1)} aria-label="Aumentar valor" className="p-0.5 text-grafite/60 hover:text-magenta transition-colors">
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => adjustDeposit(-1)} aria-label="Diminuir valor" className="p-0.5 text-grafite/60 hover:text-magenta transition-colors">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <button type="button" onClick={() => addMoney(goal.id)} className="bg-magenta hover:bg-magenta-dark text-white font-bold text-sm px-4 rounded-lg transition-colors">Guardar</button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {QUICK_AMOUNTS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            disabled={amount > remaining}
                            onClick={() => addQuickAmount(goal.id, amount)}
                            className="bg-[#F3F3F3] hover:bg-magenta hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-grafite text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                          >
                            + {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>

                      <button type="button" onClick={() => { setSavingGoalId(null); setDepositDigits(''); }} className="text-grafite/60 hover:text-grafite text-xs px-1">Cancelar</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSavingGoalId(goal.id)}
                      disabled={percentage === 100}
                      className="w-full mt-4 bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-sm py-3 rounded-xl transition-all"
                    >
                      {percentage === 100 ? 'Meta concluída' : '+ Guardar Dinheiro'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isFormOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm" onClick={resetForm} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl animate-fade-in-down" onClick={(event) => event.stopPropagation()}>
            <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
            <h2 className="font-display font-bold text-magenta text-lg mb-5 text-center">Nova meta financeira</h2>
            <div className="space-y-4">
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider">Objetivo
                <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Viagem de formatura" className="mt-1 w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite focus:outline-none" />
              </label>
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider">Valor Desejado
                <div className="relative mt-1 flex items-center">
                  <span className="absolute left-3 text-sm font-medium text-grafite/60 pointer-events-none">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={targetDigits ? formatDigits(targetDigits) : ''}
                    onChange={(event) => setTargetDigits(onlyDigits(event.target.value))}
                    placeholder="0,00"
                    className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg pl-9 pr-3 py-2.5 text-sm text-grafite focus:outline-none"
                  />
                </div>
              </label>
              <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider">Prazo Final
                <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite focus:outline-none" />
              </label>
            </div>
            <button type="button" onClick={createGoal} disabled={!title.trim() || targetNumber <= 0 || !deadline} className="w-full mt-5 bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-base py-3.5 rounded-xl transition-all">Criar meta</button>
          </div>
        </>
      )}
    </div>
  );
}
