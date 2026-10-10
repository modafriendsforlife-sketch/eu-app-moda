import {
  GraduationCap,
  ArrowLeft,
  Pencil,
  Check,
  Camera,
  Image as ImageIcon,
  Plus,
  NotebookPen,
  ClipboardCheck,
  ScrollText,
  IdCard,
  Building2,
  Droplets,
  ArrowRight,
  LogOut,
  Lock,
  Trash2,
  Unlock,
  X,
  Square,
  CheckSquare,
  Bell,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import HydrationScreen from '@/components/HydrationScreen';
import PhaseHub from '@/components/studying/PhaseHub';
import { getPhaseConfig, PHASE_CONFIGS } from '@/components/studying/phaseConfigs';
import WelcomeCheckInModal from '@/components/WelcomeCheckInModal';
import { checkAllAlerts, loadNotificationHistory, markNotificationsRead } from '@/lib/notificationEngine';
import type { AlertItem } from '@/lib/notificationEngine';

interface HomePageProps {
  userName: string;
  userEmail: string;
  onBack: () => void;
  onLogout: () => void;
  isFirstSignup: boolean;
  onQuestionnaireDone: () => void;
}

type SubScreen = 'phase-grid' | 'hydration' | { type: 'phase'; phaseId: string };

interface PhaseCard {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface ProfileData {
  fullName: string;
  nickname: string;
  birthDate: string;
  photoDataUrl: string;
}

interface PhaseDeadline {
  phaseId: string;
  years: number;
  months: number;
  unlockDate: string;
}

interface PhaseSelection {
  selectedPhaseIds: string[];
  deadlines: Record<string, PhaseDeadline>;
}

function loadProfile(fallbackName: string, key: string): ProfileData {
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as ProfileData;
  } catch {}
  return { fullName: fallbackName, nickname: fallbackName, birthDate: '', photoDataUrl: '' };
}

function saveProfile(data: ProfileData, key: string) {
  localStorage.setItem(key, JSON.stringify(data));
}

function loadPhaseSelection(key: string): PhaseSelection | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.selectedPhaseIds)) {
        return { selectedPhaseIds: parsed.selectedPhaseIds, deadlines: parsed.deadlines ?? {} };
      }
    }
  } catch {}
  return null;
}

function savePhaseSelection(data: PhaseSelection, key: string) {
  localStorage.setItem(key, JSON.stringify(data));
}

function isQuestionnaireDone(key: string): boolean {
  return localStorage.getItem(key) === 'true';
}

function markQuestionnaireDone(key: string) {
  localStorage.setItem(key, 'true');
}

function formatBirthDate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  const yy = year.slice(2);
  return `${day}/${month}/${yy}`;
}

function computeUnlockDate(years: number, months: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function isPhaseAutoUnlocked(deadline: PhaseDeadline | undefined): boolean {
  if (!deadline) return false;
  return new Date() >= new Date(deadline.unlockDate);
}

// ─── IndexedDB for profile photo (same DB as documents) ───
const PHOTO_DB_NAME = 'minha-jornada-doc-files';
const PHOTO_DB_VERSION = 3;
const PHOTO_STORE = 'files';
const PHOTO_KEY = (email: string) => `profile-photo:${email || 'default'}`;
const PHOTO_MAX_DIM = 512;
const PHOTO_QUALITY = 0.8;

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          db.createObjectStore(PHOTO_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function photoPutBlob(key: string, blob: Blob): Promise<void> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).put(blob, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

async function photoGetBlob(key: string): Promise<Blob | null> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const req = tx.objectStore(PHOTO_STORE).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

async function photoDeleteBlob(key: string): Promise<void> {
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      tx.objectStore(PHOTO_STORE).delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

function compressPhoto(blob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > PHOTO_MAX_DIM || height > PHOTO_MAX_DIM) {
          const ratio = Math.min(PHOTO_MAX_DIM / width, PHOTO_MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(blob); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((out) => resolve(out ?? blob), 'image/jpeg', PHOTO_QUALITY);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
      img.src = url;
    } catch {
      resolve(blob);
    }
  });
}

const phaseCards: PhaseCard[] = [
  { id: 'studying',   label: 'ESTOU ESTUDANDO',  icon: NotebookPen,   description: 'Organize seus estudos e matérias' },
  { id: 'internship', label: 'ESTOU EM ESTÁGIO', icon: ClipboardCheck, description: 'Acompanhe sua rotina de estágio' },
  { id: 'graduating', label: 'VOU ME FORMAR',    icon: GraduationCap,  description: 'Prepare-se para a formatura' },
  { id: 'first-job',  label: 'PRIMEIRO EMPREGO', icon: IdCard,         description: 'Dê o primeiro passo na carreira' },
  { id: 'working',    label: 'JÁ TRABALHO',      icon: Building2,      description: 'Gerencie sua vida profissional' },
];

export default function HomePage({ userName, userEmail, onBack, onLogout, isFirstSignup, onQuestionnaireDone }: HomePageProps) {
  const profileKey = `minha-jornada-profile:${userEmail || 'default'}`;
  const phaseSelectionKey = `minha-jornada-phase-selection:${userEmail || 'default'}`;
  const questionnaireDoneKey = `pesquisaConcluida:${userEmail || 'default'}`;

  const [subStack, setSubStack] = useState<SubScreen[]>(['phase-grid']);
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile(userName, profileKey));
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(profile);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [phaseSelection, setPhaseSelection] = useState<PhaseSelection | null>(() => loadPhaseSelection(phaseSelectionKey));
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showWelcomeCheckIn, setShowWelcomeCheckIn] = useState(false);
  const [notifHistory, setNotifHistory] = useState<AlertItem[]>([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [hasUnreadNotifs, setHasUnreadNotifs] = useState(false);
  const [questionnaireBackup, setQuestionnaireBackup] = useState<PhaseSelection | null>(null);
  const [isRedoQuestionnaire, setIsRedoQuestionnaire] = useState(false);

  // Questionnaire state: multi-select + per-phase deadlines
  const [selectedPhases, setSelectedPhases] = useState<Set<string>>(new Set());
  const [phaseYears, setPhaseYears] = useState<Record<string, string>>({});
  const [phaseMonths, setPhaseMonths] = useState<Record<string, string>>({});

  useEffect(() => {
    saveProfile(profile, profileKey);
  }, [profile, profileKey]);

  // Show questionnaire ONLY on first signup, and only if not already done
  useEffect(() => {
    if (isFirstSignup && !isQuestionnaireDone(questionnaireDoneKey)) {
      setShowQuestionnaire(true);
    }
  }, [isFirstSignup, questionnaireDoneKey]);

  // Show welcome check-in modal ONCE per browser session (sessionStorage).
  // Prevents reappearing while user navigates the app; resets only when
  // the tab/browser is fully closed and reopened.
  useEffect(() => {
    if (isFirstSignup && !isQuestionnaireDone(questionnaireDoneKey)) return;
    const checkinKey = `checkin_exibido:${userEmail || 'default'}`;
    try {
      if (sessionStorage.getItem(checkinKey) === 'true') return;
      sessionStorage.setItem(checkinKey, 'true');
    } catch {
      // sessionStorage may be unavailable (private mode); fall through to show
    }
    setShowWelcomeCheckIn(true);
  }, [isFirstSignup, questionnaireDoneKey, userEmail]);

  // ─── Notification engine: run alert check + load history on mount ───
  useEffect(() => {
    if (isFirstSignup && !isQuestionnaireDone(questionnaireDoneKey)) return;

    // Run an initial alert check
    const newAlerts = checkAllAlerts(userEmail);
    if (newAlerts.length > 0) {
      setHasUnreadNotifs(true);
    }

    // Load notification history from Supabase
    loadNotificationHistory(userEmail).then((history) => {
      setNotifHistory(history);
      setHasUnreadNotifs(history.length > 0);
    });

    // Periodic check every 60 seconds
    const interval = setInterval(() => {
      const alerts = checkAllAlerts(userEmail);
      if (alerts.length > 0) {
        setHasUnreadNotifs(true);
        loadNotificationHistory(userEmail).then((h) => setNotifHistory(h));
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenNotifCenter = () => {
    setShowNotifCenter(true);
    setHasUnreadNotifs(false);
    void markNotificationsRead(userEmail);
  };

  // Load profile photo from IndexedDB on mount
  useEffect(() => {
    const key = PHOTO_KEY(userEmail);
    let url: string | null = null;
    let revoked = false;
    photoGetBlob(key)
      .then((blob) => {
        if (blob && !revoked) {
          url = URL.createObjectURL(blob);
          setPhotoUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [userEmail]);

  // Bind webcam stream to video element
  useEffect(() => {
    if (showWebcam && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showWebcam, cameraStream]);

  const pushScreen = (screen: SubScreen) => {
    setSubStack((prev) => [...prev, screen]);
  };

  const popScreen = () => {
    setSubStack((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  };

  const currentSub = subStack[subStack.length - 1];

  const startEditing = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const commitEdit = () => {
    setProfile(draft);
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    setShowPhotoMenu(true);
  };

  const handleChooseCamera = () => {
    setShowPhotoMenu(false);
    setCameraError(null);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'user' } })
          .then((stream) => {
            setCameraStream(stream);
            setShowWebcam(true);
          })
          .catch(() => {
            cameraInputRef.current?.click();
          });
      } else {
        cameraInputRef.current?.click();
      }
    } catch {
      cameraInputRef.current?.click();
    }
  };

  const handleChooseGallery = () => {
    setShowPhotoMenu(false);
    galleryInputRef.current?.click();
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setShowWebcam(false);
  };

  const captureWebcamPhoto = () => {
    try {
      const video = videoRef.current;
      const canvas = cameraCanvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setCameraError('Não foi possível capturar a foto. Tente novamente.');
            return;
          }
          compressPhoto(blob).then((compressed) => {
            saveProfilePhoto(compressed);
          });
        },
        'image/jpeg',
        0.85,
      );
      stopWebcam();
    } catch {
      setCameraError('Erro ao capturar a foto. Tente novamente.');
      stopWebcam();
    }
  };

  const saveProfilePhoto = async (blob: Blob) => {
    const key = PHOTO_KEY(userEmail);
    try {
      await photoPutBlob(key, blob);
      const newUrl = URL.createObjectURL(blob);
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return newUrl;
      });
    } catch {}
  };

  const handleFilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressPhoto(file).then((compressed) => {
      saveProfilePhoto(compressed);
    });
    e.target.value = '';
  };

  const handleDeletePhoto = () => {
    const key = PHOTO_KEY(userEmail);
    photoDeleteBlob(key).catch(() => {});
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setShowPhotoMenu(false);
  };

  // ─── Questionnaire handlers ───
  const togglePhaseSelection = (phaseId: string) => {
    setSelectedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
        setPhaseYears((y) => { const c = { ...y }; delete c[phaseId]; return c; });
        setPhaseMonths((m) => { const c = { ...m }; delete c[phaseId]; return c; });
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const completeQuestionnaire = () => {
    if (selectedPhases.size === 0) return;

    const deadlines: Record<string, PhaseDeadline> = {};
    selectedPhases.forEach((phaseId) => {
      const years = parseInt(phaseYears[phaseId] ?? '0', 10) || 0;
      const months = parseInt(phaseMonths[phaseId] ?? '0', 10) || 0;
      if (years > 0 || months > 0) {
        deadlines[phaseId] = {
          phaseId,
          years,
          months,
          unlockDate: computeUnlockDate(years, months),
        };
      }
    });

    const selection: PhaseSelection = {
      selectedPhaseIds: [...selectedPhases],
      deadlines,
    };
    setPhaseSelection(selection);
    savePhaseSelection(selection, phaseSelectionKey);
    markQuestionnaireDone(questionnaireDoneKey);
    setShowQuestionnaire(false);
    setIsRedoQuestionnaire(false);
    setQuestionnaireBackup(null);
    setSelectedPhases(new Set());
    setPhaseYears({});
    setPhaseMonths({});
    onQuestionnaireDone();
  };

  const canCompleteQuestionnaire = () => {
    if (selectedPhases.size === 0) return false;
    // Each selected phase should have at least some time input (skipFormBarrier phases are exempt)
    for (const phaseId of selectedPhases) {
      const config = PHASE_CONFIGS[phaseId];
      if (config?.skipFormBarrier) continue;
      const y = parseInt(phaseYears[phaseId] ?? '0', 10) || 0;
      const m = parseInt(phaseMonths[phaseId] ?? '0', 10) || 0;
      if (y <= 0 && m <= 0) return false;
    }
    return true;
  };

  // ─── Advance Phase handlers ───
  const handleAdvancePhase = (phaseIdToUnlock: string) => {
    if (!phaseSelection) return;
    const updated: PhaseSelection = {
      ...phaseSelection,
      selectedPhaseIds: [...new Set([...phaseSelection.selectedPhaseIds, phaseIdToUnlock])],
    };
    setPhaseSelection(updated);
    savePhaseSelection(updated, phaseSelectionKey);
    setShowAdvanceModal(false);
  };

  const handleResetQuestionnaire = () => {
    setQuestionnaireBackup(phaseSelection);
    setIsRedoQuestionnaire(true);
    setPhaseSelection(null);
    setShowAdvanceModal(false);
    setShowQuestionnaire(true);
    setSelectedPhases(new Set());
    setPhaseYears({});
    setPhaseMonths({});
  };

  const cancelQuestionnaireRedo = () => {
    setPhaseSelection(questionnaireBackup);
    setQuestionnaireBackup(null);
    setIsRedoQuestionnaire(false);
    setShowQuestionnaire(false);
    setSelectedPhases(new Set());
    setPhaseYears({});
    setPhaseMonths({});
  };

  // Determine which phases are unlocked
  const isPhaseUnlocked = (phaseId: string): boolean => {
    if (!phaseSelection) return false;
    if (phaseSelection.selectedPhaseIds.includes(phaseId)) return true;
    // Check auto-unlock by date
    const deadline = phaseSelection.deadlines[phaseId];
    if (deadline && isPhaseAutoUnlocked(deadline)) return true;
    return false;
  };

  const lockedPhases = phaseCards.filter((c) => !isPhaseUnlocked(c.id));

  const initials = (profile.fullName || userName)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const greeting = profile.nickname?.trim() || profile.fullName?.trim() || userName;

  if (currentSub !== 'phase-grid') {
    if (currentSub === 'hydration') {
      return <HydrationScreen onBack={popScreen} />;
    }
    if (currentSub && typeof currentSub === 'object' && currentSub.type === 'phase') {
      const config = getPhaseConfig(currentSub.phaseId);
      return <PhaseHub config={config} onBack={popScreen} userEmail={userEmail} />;
    }
  }

  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">

        {/* Back button + logout */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a tela anterior"
            className="inline-flex items-center gap-2 text-grafite hover:text-magenta transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-grafite/20 rounded-md px-1 py-1"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair da conta"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-grafite hover:text-magenta transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/30 rounded-md px-2 py-1"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            <span>Sair</span>
          </button>
        </div>

        {/* ── Profile block ── */}
        <div className="bg-[#F3F3F3] rounded-2xl p-5 sm:p-6 mb-8 animate-fade-in-down">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">

            {/* Avatar with photo menu */}
            <div className="relative shrink-0 self-center sm:self-start">
              <button
                type="button"
                onClick={handleAvatarClick}
                aria-label="Foto de perfil"
                className="group w-20 h-20 rounded-full overflow-hidden bg-magenta/10 flex items-center justify-center ring-2 ring-white shadow-md focus:outline-none focus-visible:ring-magenta/40 transition-transform hover:scale-105"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-bold text-magenta text-xl">{initials}</span>
                )}
                <span className="absolute inset-0 bg-grafite/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" strokeWidth={1.8} />
                </span>
              </button>
              <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFilePhotoChange} className="sr-only" />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handleFilePhotoChange} className="sr-only" />
              <canvas ref={cameraCanvasRef} className="hidden" />

              {showPhotoMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPhotoMenu(false)} />
                  <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-grafite/10 py-2 w-52 animate-fade-in-down">
                    <button
                      type="button"
                      onClick={handleChooseCamera}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-grafite hover:bg-magenta/5 transition-colors text-left"
                    >
                      <Camera className="w-4 h-4 text-grafite/70" strokeWidth={1.8} />
                      <span>Tirar foto com a câmera</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleChooseGallery}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-grafite hover:bg-magenta/5 transition-colors text-left"
                    >
                      <ImageIcon className="w-4 h-4 text-grafite/70" strokeWidth={1.8} />
                      <span>Escolher da Galeria</span>
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={handleDeletePhoto}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                        <span>Excluir Foto Atual</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <p className="font-display font-bold text-grafite text-base leading-tight text-center sm:text-left">
                  Olá, <span className="text-magenta">{greeting}</span>!
                </p>
                <div className="flex items-center gap-3 justify-center sm:justify-end flex-wrap">
                  {phaseSelection && lockedPhases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAdvanceModal(true)}
                      aria-label="Avançar de fase"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-grafite/60 hover:text-magenta transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/30 rounded-md px-2 py-1"
                    >
                      <Unlock className="w-3.5 h-3.5" strokeWidth={1.8} />
                      <span>Avançar de Fase</span>
                    </button>
                  )}
                  {!phaseSelection && lockedPhases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowQuestionnaire(true)}
                      aria-label="Configurar fases"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-grafite/60 hover:text-magenta transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/30 rounded-md px-2 py-1"
                    >
                      <Unlock className="w-3.5 h-3.5" strokeWidth={1.8} />
                      <span>Configurar Fases</span>
                    </button>
                  )}
                  {/* ─── Central de Avisos bell icon ─── */}
                  <button
                    type="button"
                    onClick={handleOpenNotifCenter}
                    aria-label="Central de Avisos"
                    className="relative inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-magenta/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/30"
                  >
                    <Bell className="w-4 h-4 text-grafite hover:text-magenta transition-colors" strokeWidth={1.8} />
                    {hasUnreadNotifs && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-magenta rounded-full ring-2 ring-[#F3F3F3] animate-pulse" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={isEditing ? commitEdit : startEditing}
                    aria-label={isEditing ? 'Salvar dados' : 'Editar dados'}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-grafite hover:text-magenta transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grafite/20 rounded-md px-2 py-1"
                  >
                    {isEditing ? <Check className="w-4 h-4" strokeWidth={2} /> : <Pencil className="w-4 h-4" strokeWidth={1.8} />}
                    {isEditing ? 'Salvar' : 'Editar'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ProfileField
                  label="Nome completo"
                  value={isEditing ? draft.fullName : profile.fullName}
                  editing={isEditing}
                  onChange={(v) => setDraft({ ...draft, fullName: v })}
                />
                <ProfileField
                  label="Apelido"
                  value={isEditing ? draft.nickname : profile.nickname}
                  editing={isEditing}
                  onChange={(v) => setDraft({ ...draft, nickname: v })}
                />
                <ProfileField
                  label="Data de nascimento"
                  value={isEditing ? draft.birthDate : formatBirthDate(profile.birthDate)}
                  editing={isEditing}
                  type="date"
                  placeholder="dd/mm/aa"
                  onChange={(v) => setDraft({ ...draft, birthDate: v })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Journey data by phase ── */}
        <PhaseDataSection userEmail={userEmail} unlockedPhaseIds={phaseCards.filter(c => isPhaseUnlocked(c.id)).map(c => c.id)} />

        {/* Page title */}
        <header className="mb-6 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0 }}>
          <h2 className="font-display text-xl font-bold text-magenta leading-tight">Em qual fase você está?</h2>
          <p className="text-sm text-grafite">Escolha uma fase para acompanhar sua jornada</p>
        </header>

        {/* ── Phase cards grid ── */}
        <div className="grid grid-cols-2 gap-5 mb-8">
          {phaseCards.map((card, index) => {
            const Icon = card.icon;
            const unlocked = isPhaseUnlocked(card.id);
            return (
              <div
                key={card.id}
                className="group bg-[#F3F3F3] rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-grafite/5 animate-fade-in flex flex-col items-center text-center min-h-[180px]"
                style={{ animationDelay: `${0.1 + index * 0.07}s`, opacity: 0 }}
              >
                {/* Icon centered */}
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm mb-4">
                  <Icon className="w-8 h-8 text-grafite" strokeWidth={1.7} />
                </div>

                {/* Label + description */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  <h3 className="font-display font-bold text-magenta text-sm uppercase tracking-wide leading-snug">
                    {card.label}
                  </h3>
                  <p className="text-xs text-grafite mt-2 leading-relaxed">{card.description}</p>
                </div>

                {/* Plus button or Lock */}
                {unlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      pushScreen({ type: 'phase', phaseId: card.id });
                    }}
                    aria-label={`Acessar ${card.label}`}
                    className="mt-4 shrink-0 w-11 h-11 rounded-full bg-white hover:bg-magenta flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-magenta/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/40 group-hover:scale-110"
                  >
                    <Plus className="w-5 h-5 text-magenta group-hover:text-white transition-colors duration-300" strokeWidth={2.8} />
                  </button>
                ) : (
                  <div
                    aria-label={`${card.label} bloqueada`}
                    className="mt-4 shrink-0 w-11 h-11 rounded-full bg-grafite/10 flex items-center justify-center"
                  >
                    <Lock className="w-4 h-4 text-grafite/40" strokeWidth={2} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Well-being card — always unlocked, horizontal flexbox ─── */}
        <div className="pt-6 border-t border-grafite/5">
          <div
            className="group bg-[#F3F3F3] rounded-2xl transition-all duration-300 hover:shadow-md hover:shadow-magenta/10 animate-fade-in"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', padding: '1rem', gap: '0.75rem', opacity: 0, animationDelay: '0.5s' }}
          >
            {/* Icon — fixed at left */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-magenta/10 group-hover:bg-magenta/20 flex items-center justify-center shrink-0 transition-colors duration-300">
              <Droplets className="w-6 h-6 sm:w-7 sm:h-7 text-magenta" strokeWidth={1.7} />
            </div>

            {/* Text block — takes all available middle space */}
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
              <h3 style={{ color: '#C90055', fontWeight: 'bold', whiteSpace: 'nowrap' }} className="font-display text-sm sm:text-base uppercase tracking-wide">
                MEU BEM-ESTAR
              </h3>
              <p style={{ color: '#3E3E3E', lineHeight: '1.35' }} className="text-xs sm:text-sm mt-0.5">
                Cuide da sua hidratação e bem-estar durante a jornada
              </p>
            </div>

            {/* Oval Magenta button — fixed at right edge */}
            <button
              type="button"
              onClick={() => pushScreen('hydration')}
              aria-label="Acessar Meu Bem-Estar"
              className="inline-flex items-center gap-1 bg-magenta hover:bg-magenta-dark text-white text-xs sm:text-sm font-bold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-magenta/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/40"
              style={{ flexShrink: 0 }}
            >
              <span>Acessar</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Questionnaire Modal (Multi-Select + Per-Phase Deadlines) ─── */}
      {showQuestionnaire && (
        <div className="fixed inset-0 z-[60] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 animate-fade-in-down max-h-[90vh] overflow-y-auto relative">

            {/* Close button — only for returning users (not first signup) */}
            {!isFirstSignup && (
              <button
                type="button"
                onClick={() => {
                  if (isRedoQuestionnaire) {
                    cancelQuestionnaireRedo();
                  } else {
                    setShowQuestionnaire(false);
                    setSelectedPhases(new Set());
                    setPhaseYears({});
                    setPhaseMonths({});
                  }
                }}
                aria-label="Fechar"
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F3F3F3] hover:bg-grafite/10 flex items-center justify-center transition-colors z-10"
              >
                <X className="w-4 h-4 text-grafite" strokeWidth={2} />
              </button>
            )}

            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-magenta/10 flex items-center justify-center mx-auto mb-4">
                <NotebookPen className="w-8 h-8 text-magenta" strokeWidth={1.7} />
              </div>
              <h2 className="font-display text-xl font-bold text-magenta mb-2">Personalize sua jornada! 🌟</h2>
              <div className="bg-magenta/5 rounded-xl px-4 py-2.5 mb-1">
                <p className="text-sm text-magenta font-medium leading-relaxed">
                  Dica: O seu aplicativo vai se adaptar e trabalhar de acordo com as respostas selecionadas abaixo! 🌟
                </p>
              </div>
              <p className="text-xs text-grafite mt-2">Marque todas as fases que fazem parte da sua jornada</p>
            </div>

            {/* Multi-select phase list */}
            <div className="space-y-2.5 mb-4">
              {phaseCards.map((card) => {
                const Icon = card.icon;
                const isChecked = selectedPhases.has(card.id);
                const config = PHASE_CONFIGS[card.id];
                const needsDeadline = !config?.skipFormBarrier;
                return (
                  <div key={card.id}>
                    <button
                      type="button"
                      onClick={() => togglePhaseSelection(card.id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all duration-200 text-left ${
                        isChecked
                          ? 'bg-magenta/10 border-2 border-magenta'
                          : 'bg-[#F3F3F3] border-2 border-transparent hover:bg-magenta/5'
                      }`}
                    >
                      <div className="shrink-0">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-magenta" strokeWidth={2.2} />
                        ) : (
                          <Square className="w-5 h-5 text-grafite/30" strokeWidth={2} />
                        )}
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isChecked ? 'bg-white shadow-sm' : 'bg-white shadow-sm'}`}>
                        <Icon className="w-5 h-5 text-grafite" strokeWidth={1.7} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-sm leading-snug text-magenta">{card.label}</h3>
                        <p className="text-xs text-grafite mt-0.5">{card.description}</p>
                      </div>
                    </button>

                    {/* Per-phase deadline inputs — appear when selected (skipFormBarrier phases are checkbox-only) */}
                    {isChecked && needsDeadline && (
                      <div className="mt-2 ml-4 mr-4 mb-3 bg-white rounded-xl p-4 border border-magenta/15 animate-fade-in-down">
                        <p className="text-xs font-medium text-grafite mb-3">
                          Em quanto tempo você planeja finalizar a fase <span className="text-magenta font-bold">{card.label}</span>?
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 bg-[#F3F3F3] rounded-lg px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={phaseYears[card.id] ?? ''}
                              onChange={(e) => setPhaseYears((prev) => ({ ...prev, [card.id]: e.target.value }))}
                              placeholder="0"
                              className="w-10 text-center text-sm font-bold text-magenta bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-grafite font-medium">Ano(s)</span>
                          </label>
                          <label className="flex items-center gap-2 bg-[#F3F3F3] rounded-lg px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              max="11"
                              value={phaseMonths[card.id] ?? ''}
                              onChange={(e) => setPhaseMonths((prev) => ({ ...prev, [card.id]: e.target.value }))}
                              placeholder="0"
                              className="w-10 text-center text-sm font-bold text-magenta bg-transparent focus:outline-none"
                            />
                            <span className="text-xs text-grafite font-medium">Mês(es)</span>
                          </label>
                        </div>
                        {(() => {
                          const y = parseInt(phaseYears[card.id] ?? '0', 10) || 0;
                          const m = parseInt(phaseMonths[card.id] ?? '0', 10) || 0;
                          if (y <= 0 && m <= 0) return null;
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + y);
                          d.setMonth(d.getMonth() + m);
                          return (
                            <p className="text-[11px] text-grafite mt-2">
                              Abertura automática: <span className="font-bold text-magenta">{d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={completeQuestionnaire}
              disabled={!canCompleteQuestionnaire()}
              className="w-full bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300"
            >
              Confirmar e Começar
            </button>
            <button
              type="button"
              onClick={() => {
                if (isRedoQuestionnaire) {
                  cancelQuestionnaireRedo();
                  return;
                }
                setShowQuestionnaire(false);
                setSelectedPhases(new Set());
                setPhaseYears({});
                setPhaseMonths({});
              }}
              className="w-full bg-[#F3F3F3] hover:bg-grafite/10 text-grafite font-medium text-sm py-3 rounded-xl transition-colors mt-3"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* ─── Advance Phase Modal ─── */}
      {showAdvanceModal && phaseSelection && (
        <div className="fixed inset-0 z-[60] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-in-down max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-magenta/10 flex items-center justify-center mx-auto mb-4">
                <Unlock className="w-8 h-8 text-magenta" strokeWidth={1.7} />
              </div>
              <h2 className="font-display text-xl font-bold text-magenta mb-1">Avançar de Fase</h2>
              <p className="text-sm text-grafite leading-relaxed">
                Destrave manualmente uma fase que ainda está bloqueada. O cadeado se abre automaticamente na data programada, mas você pode adiantar se sua rotina mudou.
              </p>
            </div>

            {/* List locked phases with their unlock dates */}
            <div className="space-y-2.5 mb-5">
              {lockedPhases.map((card) => {
                const Icon = card.icon;
                const deadline = phaseSelection.deadlines[card.id];
                return (
                  <div key={card.id} className="flex items-center gap-3 bg-[#F3F3F3] rounded-xl px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
                      <Icon className="w-5 h-5 text-grafite" strokeWidth={1.7} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-sm text-magenta leading-snug">{card.label}</h3>
                      {deadline && (
                        <p className="text-[11px] text-grafite mt-0.5">
                          Abertura automática: {new Date(deadline.unlockDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdvancePhase(card.id)}
                      className="shrink-0 bg-magenta hover:bg-magenta-dark text-white text-xs font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      Destravar
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleResetQuestionnaire}
                className="w-full bg-[#F3F3F3] hover:bg-grafite/10 text-grafite font-medium text-sm py-3 rounded-xl transition-colors"
              >
                Refazer questionário
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="w-full text-grafite/60 hover:text-magenta text-sm font-medium py-2 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showWebcam && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center p-4">
          <h3 className="text-white font-display font-bold text-lg mb-4">Tirar foto</h3>
          {cameraError && (
            <p className="text-red-300 bg-red-900/40 rounded-lg px-4 py-2 mb-4 text-sm text-center max-w-sm">{cameraError}</p>
          )}
          <div className="rounded-2xl overflow-hidden shadow-2xl bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-md max-h-[60vh] object-contain" />
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={stopWebcam}
              className="bg-white/20 hover:bg-white/30 text-white font-medium text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={captureWebcamPhoto}
              className="bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-lg"
            >
              Capturar foto
            </button>
          </div>
        </div>
      )}

      {showWelcomeCheckIn && (
        <WelcomeCheckInModal
          userName={greeting}
          userEmail={userEmail}
          onClose={() => setShowWelcomeCheckIn(false)}
        />
      )}

      {/* ─── Central de Avisos Modal ─── */}
      {showNotifCenter && (
        <div className="fixed inset-0 z-[85] bg-grafite/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-down max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-magenta to-[#C90055]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <Bell className="w-6 h-6 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-white leading-tight">Central de Avisos</h2>
                  <p className="text-sm text-white/80">Seus lembretes e alertas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifCenter(false)}
                aria-label="Fechar"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" strokeWidth={2.2} />
              </button>
            </div>

            {/* Notification cards */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {notifHistory.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-magenta/5 flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-magenta/30" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-grafite font-medium">Nenhum aviso no momento.</p>
                  <p className="text-xs text-grafite/50 mt-1">Seus lembretes aparecerão aqui automaticamente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifHistory.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-start gap-3 bg-[#F8F8F8] rounded-2xl p-4 animate-fade-in"
                    >
                      <div className="w-10 h-10 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-lg">
                        {notif.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm text-grafite leading-snug">
                          {notif.title}
                        </p>
                        <p className="text-sm text-grafite/70 mt-1 leading-relaxed">
                          {notif.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 pb-6 pt-3 border-t border-grafite/5">
              <button
                type="button"
                onClick={() => setShowNotifCenter(false)}
                className="w-full bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-base py-3.5 rounded-xl transition-all duration-300"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProfileFieldProps {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function ProfileField({ label, value, editing, onChange, type = 'text', placeholder }: ProfileFieldProps) {
  return (
    <div>
      <p className="text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">{label}</p>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? label}
          className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2 text-sm text-grafite placeholder:text-grafite/25 focus:outline-none transition-all"
        />
      ) : (
        <p className="text-sm text-grafite font-medium truncate min-h-[2rem] flex items-center">
          {value || <span className="text-grafite italic font-normal">não informado</span>}
        </p>
      )}
    </div>
  );
}

// ─── Phase data section: shows ALL selected phases cumulatively with inline edit ───
function PhaseDataSection({ userEmail, unlockedPhaseIds }: { userEmail: string; unlockedPhaseIds: string[] }) {
  const [phaseData, setPhaseData] = useState<Record<string, Record<string, string>>>({});
  const [editingPhase, setEditingPhase] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const data: Record<string, Record<string, string>> = {};
    unlockedPhaseIds.forEach((phaseId) => {
      const config = PHASE_CONFIGS[phaseId];
      if (!config || config.questions.length === 0) return;
      try {
        const raw = localStorage.getItem(`minha-jornada-phase-form:${phaseId}:${userEmail || 'default'}`);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, string>;
          data[phaseId] = parsed;
        } else {
          data[phaseId] = {};
        }
      } catch {
        data[phaseId] = {};
      }
    });
    setPhaseData(data);
  }, [userEmail, unlockedPhaseIds]);

  const entries = Object.entries(phaseData);
  if (entries.length === 0) return null;

  const startEdit = (phaseId: string) => {
    setEditingPhase(phaseId);
    setDraftAnswers({ ...(phaseData[phaseId] ?? {}) });
  };

  const saveEdit = (phaseId: string) => {
    const config = PHASE_CONFIGS[phaseId];
    if (!config) return;
    const filled: Record<string, string> = {};
    config.questions.forEach((q) => {
      const val = draftAnswers[q.id]?.trim();
      if (val) filled[q.id] = val;
    });
    localStorage.setItem(`minha-jornada-phase-form:${phaseId}:${userEmail || 'default'}`, JSON.stringify(filled));
    setPhaseData((prev) => ({ ...prev, [phaseId]: filled }));
    setEditingPhase(null);
  };

  return (
    <div className="mt-4 bg-white rounded-xl p-4 border border-grafite/10 animate-fade-in">
      <p className="text-[10px] font-medium text-grafite uppercase tracking-wider mb-3">Dados da minha jornada</p>
      <div className="space-y-3">
        {entries.map(([phaseId, answers]) => {
          const config = PHASE_CONFIGS[phaseId];
          if (!config) return null;
          const isEditingThis = editingPhase === phaseId;
          return (
            <div key={phaseId} className="border-b border-grafite/5 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-display font-bold text-magenta text-xs">{config.title}</p>
                <button
                  type="button"
                  onClick={() => isEditingThis ? saveEdit(phaseId) : startEdit(phaseId)}
                  aria-label={isEditingThis ? 'Salvar' : 'Editar dados da fase'}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-grafite/50 hover:text-magenta transition-colors focus:outline-none"
                >
                  {isEditingThis ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <Pencil className="w-3.5 h-3.5" strokeWidth={1.8} />}
                  {isEditingThis ? 'Salvar' : 'Editar'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.questions.map((q) => (
                  <div key={q.id}>
                    <p className="text-[10px] text-grafite/60">{q.label}</p>
                    {isEditingThis ? (
                      <input
                        type="text"
                        value={draftAnswers[q.id] ?? ''}
                        onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={q.placeholder}
                        className="w-full bg-[#F3F3F3] border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-2.5 py-1.5 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all"
                      />
                    ) : (
                      <p className="text-sm font-medium text-grafite">{answers[q.id] || '—'}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
