import { useState, useEffect } from 'react';

interface BackButtonProps {
  onBack: () => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export function BackButton({ onBack, label = 'Voltar', ariaLabel = 'Voltar', className = 'mb-6' }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={ariaLabel}
      className={`${className} inline-flex items-center gap-2 text-grafite hover:text-magenta transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-grafite/20 rounded-md px-1 py-1`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

interface SegmentMenuProps {
  open: boolean;
  onClose: () => void;
  title: string;
  segments: { id: string; label: string; icon: string; color: string }[];
  onSelect: (id: string) => void;
}

export function SegmentMenu({ open, onClose, title, segments, onSelect }: SegmentMenuProps) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl animate-fade-in-down max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
        <h3 className="font-display font-bold text-magenta text-lg mb-5 text-center">{title}</h3>
        <div className="space-y-2">
          {segments.map((seg) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => { onSelect(seg.id); onClose(); }}
              className="w-full flex items-center gap-3 bg-[#F3F3F3] hover:bg-magenta/5 rounded-xl px-4 py-3.5 transition-colors duration-200 text-left"
            >
              <span className="text-xl shrink-0">{seg.icon}</span>
              <span className="flex items-center gap-2 flex-1 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-sm font-medium text-grafite truncate">{seg.label}</span>
              </span>
              <svg className="w-4 h-4 text-grafite/40 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 text-sm font-medium text-grafite/60 hover:text-magenta py-2 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  label?: boolean;
  className?: string;
  stopPropagation?: boolean;
}

export function DeleteButton({ onClick, ariaLabel = 'Excluir', label = false, className = '', stopPropagation = false }: DeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => { if (stopPropagation) e.stopPropagation(); onClick(); }}
      aria-label={ariaLabel}
      className={`shrink-0 inline-flex items-center gap-1 text-grafite/50 hover:text-magenta transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/20 rounded-md ${label ? 'text-xs font-medium px-2 py-1' : 'p-1'} ${className}`}
    >
      <svg className={label ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      {label && <span>Excluir</span>}
    </button>
  );
}

interface AddButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function AddButton({ onClick, ariaLabel = 'Adicionar' }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="shrink-0 w-11 h-11 rounded-full bg-white hover:bg-magenta flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-magenta/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/40 group-hover:scale-110"
    >
      <svg className="w-5 h-5 text-magenta group-hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" strokeWidth={2.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

export function useLocalStorage<T>(key: string, fallback: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {}
    return fallback;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota exceeded — keep state in memory even if persistence fails
    }
  }, [key, state]);

  return [state, setState];
}
