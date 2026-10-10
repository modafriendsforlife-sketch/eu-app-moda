import { useState, useRef, useEffect, useCallback } from 'react';
import { BackButton, AddButton, DeleteButton } from './sharedUI';

interface DocItem {
  id: string;
  name: string;
  category: string;
  fileType: string;
  fileSize: number;
  addedAt: string;
}

interface CategoryDef {
  id: string;
  label: string;
  icon: string;
}

const DOC_CATEGORIES: CategoryDef[] = [
  { id: 'id',    label: 'Carteirinha',     icon: '🎓' },
  { id: 'cert',  label: 'Certificado',     icon: '📜' },
  { id: 'decl',  label: 'Declaração',      icon: '📄' },
  { id: 'work',  label: 'Trabalho',        icon: '📝' },
  { id: 'other', label: 'Outro documento', icon: '📎' },
];

const CAT_MAP = Object.fromEntries(DOC_CATEGORIES.map((c) => [c.id, c]));

const DB_NAME = 'minha-jornada-doc-files';
const DB_VERSION = 3;
const DB_FILE_STORE = 'files';
const DB_META_STORE = 'metadata';
const META_KEY = 'docs';

type AddMenuChoice = 'photo' | 'gallery' | null;

const MAX_IMAGE_DIM = 1024;
const JPEG_QUALITY = 0.7;
const MAX_FILE_BYTES = 25_000_000;

// ─── IndexedDB helpers ───
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_FILE_STORE)) {
          db.createObjectStore(DB_FILE_STORE);
        }
        if (!db.objectStoreNames.contains(DB_META_STORE)) {
          db.createObjectStore(DB_META_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function idbPutFile(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_FILE_STORE, 'readwrite');
      tx.objectStore(DB_FILE_STORE).put(blob, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Transação abortada')); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

async function idbGetFile(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_FILE_STORE, 'readonly');
      const req = tx.objectStore(DB_FILE_STORE).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

async function idbDeleteFile(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_FILE_STORE, 'readwrite');
      tx.objectStore(DB_FILE_STORE).delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

async function idbPutMeta(docs: DocItem[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_META_STORE, 'readwrite');
      tx.objectStore(DB_META_STORE).put(docs, META_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Meta abortada')); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

async function idbGetMeta(): Promise<DocItem[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(DB_META_STORE, 'readonly');
      const req = tx.objectStore(DB_META_STORE).get(META_KEY);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    } catch (e) {
      db.close();
      reject(e);
    }
  });
}

function compressImageBlob(blob: Blob, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(blob); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((out) => resolve(out ?? blob), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
      img.src = url;
    } catch {
      resolve(blob);
    }
  });
}

export default function DocumentsModule({ onBack }: { onBack: () => void }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ blob: Blob; fileName: string; fileType: string } | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('other');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  // Load metadata from IndexedDB on mount
  useEffect(() => {
    idbGetMeta()
      .then((saved) => {
        if (saved && Array.isArray(saved)) setDocs(saved);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  // Persist metadata to IndexedDB whenever docs change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    idbPutMeta(docs).catch(() => {});
  }, [docs, loaded]);

  // Webcam video element binding
  useEffect(() => {
    if (showWebcam && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showWebcam, cameraStream]);

  // Pending file preview URL
  useEffect(() => {
    if (pendingFile) {
      const url = URL.createObjectURL(pendingFile.blob);
      setPendingPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPendingPreviewUrl(null);
  }, [pendingFile]);

  // Load thumbnails from IndexedDB for image docs
  const loadThumbnails = useCallback(async (docList: DocItem[]) => {
    const newThumbs: Record<string, string> = {};
    await Promise.all(
      docList
        .filter((d) => d.fileType.startsWith('image/'))
        .map(async (d) => {
          try {
            const blob = await idbGetFile(d.id);
            if (blob) newThumbs[d.id] = URL.createObjectURL(blob);
          } catch {}
        }),
    );
    setThumbUrls((prev) => {
      Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
      return newThumbs;
    });
  }, []);

  useEffect(() => {
    loadThumbnails(docs);
  }, [docs, loadThumbnails]);

  useEffect(() => {
    if (!previewDoc) {
      setPreviewUrl(null);
      return;
    }
    let url: string | null = null;
    let revoked = false;
    idbGetFile(previewDoc.id)
      .then((blob) => {
        if (blob && !revoked) {
          url = URL.createObjectURL(blob);
          if (!revoked) setPreviewUrl(url);
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewDoc]);

  const openAddMenu = () => {
    setAddMenu(true);
  };

  const handleAddChoice = (choice: AddMenuChoice) => {
    setAddMenu(false);
    setCameraError(null);
    if (choice === 'photo') {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'environment' } })
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
    } else if (choice === 'gallery') {
      fileInputRef.current?.click();
    }
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
          compressImageBlob(blob, MAX_IMAGE_DIM, JPEG_QUALITY).then((compressed) => {
            setPendingFile({ blob: compressed, fileName: 'foto-camera.jpg', fileType: 'image/jpeg' });
            setEditName('Foto da câmera');
            setEditCat('other');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setSaveError(`Arquivo muito grande (${(file.size / 1_000_000).toFixed(1)} MB). O máximo é 25 MB.`);
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setSaveError('Apenas fotos são permitidas. Selecione uma imagem da galeria.');
      e.target.value = '';
      return;
    }
    setSaveError(null);
    compressImageBlob(file, MAX_IMAGE_DIM, JPEG_QUALITY).then((compressed) => {
      setPendingFile({ blob: compressed, fileName: file.name, fileType: file.type });
      setEditName(file.name.replace(/\.[^.]+$/, ''));
      setEditCat('other');
    });
    e.target.value = '';
  };

  const savePendingDoc = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!pendingFile || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const docId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newDoc: DocItem = {
      id: docId,
      name: editName.trim() || pendingFile.fileName,
      category: editCat,
      fileType: pendingFile.fileType,
      fileSize: pendingFile.blob.size,
      addedAt: new Date().toISOString(),
    };
    try {
      await idbPutFile(docId, pendingFile.blob);
      const verify = await idbGetFile(docId);
      if (!verify) throw new Error('Arquivo não confirmado no armazenamento');
      setDocs((prev) => [newDoc, ...prev]);
      setPendingFile(null);
      setEditName('');
      setEditCat('other');
    } catch {
      setSaveError('Não foi possível salvar este arquivo. Verifique o espaço e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDoc = (docId: string) => {
    idbDeleteFile(docId).catch(() => {});
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    if (previewDoc?.id === docId) setPreviewDoc(null);
  };

  const handleDownload = async () => {
    if (!previewDoc) return;
    try {
      const blob = await idbGetFile(previewDoc.id);
      if (!blob) return;
      const fileName = previewDoc.name.match(/\.[a-z0-9]+$/i) ? previewDoc.name : `${previewDoc.name}.jpg`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {}
  };

  // ─── Full-screen preview ───
  if (previewDoc) {
    return (
      <div className="fixed inset-0 z-[60] bg-offwhite flex flex-col">
        <div className="sticky top-0 z-10 shrink-0 px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center gap-2 sm:gap-3 bg-white shadow-sm">
          <BackButton onBack={() => setPreviewDoc(null)} label="Voltar para a Pasta" ariaLabel="Voltar para a pasta de documentos" className="mb-0 min-h-11 shrink-0" />
          <h2 className="font-display font-bold text-magenta text-base flex-1 truncate">{previewDoc.name}</h2>
          <DeleteButton
            onClick={() => deleteDoc(previewDoc.id)}
            ariaLabel="Excluir documento"
            label
          />
        </div>
        <div className="min-h-0 flex-1 flex flex-col p-3 sm:p-4 overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt={previewDoc.name} className="w-full h-full max-w-full max-h-full object-contain rounded-lg mx-auto" />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm text-grafite/50">Carregando...</span>
            </div>
          )}
        </div>
        {previewUrl && (
          <div className="shrink-0 px-4 sm:px-6 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-center bg-offwhite">
            <button
              type="button"
              onClick={handleDownload}
              aria-label={`Baixar ${previewDoc.name}`}
              className="inline-flex min-h-11 items-center justify-center bg-magenta text-white font-display font-bold text-sm px-6 py-3 rounded-xl hover:bg-magenta-dark transition-colors"
            >
              Baixar foto
            </button>
          </div>
        )}
        <div className="px-6 pb-6 text-center">
          <span className="text-[10px] text-grafite/50">{CAT_MAP[previewDoc.category]?.label ?? 'Documento'}</span>
        </div>
      </div>
    );
  }

  // ─── Main documents list (flat, no folders) ───
  return (
    <div className="min-h-screen bg-offwhite px-6 py-8 sm:py-10">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      <div className="max-w-2xl mx-auto">
        <BackButton onBack={onBack} ariaLabel="Voltar para Estou Estudando" />

        <header className="mb-6 flex flex-row items-center gap-3 animate-fade-in-down">
          <div className="w-12 h-12 rounded-xl bg-magenta/10 flex items-center justify-center shrink-0 text-2xl">📁</div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-magenta leading-tight">Documentos</h1>
            <p className="text-sm text-grafite">Organize certificados, trabalhos e fotos</p>
          </div>
          <AddButton onClick={openAddMenu} ariaLabel="Adicionar documento" />
        </header>

        {docs.length === 0 ? (
          <div className="py-16 text-center animate-fade-in">
            <div className="text-5xl mb-4">📷</div>
            <p className="text-sm text-grafite italic">Nenhuma foto ainda. Toque no + para adicionar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setPreviewDoc(doc)}
                className="bg-card rounded-2xl p-3 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:shadow-md hover:shadow-grafite/5 animate-fade-in relative"
              >
                <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center shadow-sm mb-2 overflow-hidden">
                  {thumbUrls[doc.id] ? (
                    <img src={thumbUrls[doc.id]} alt={doc.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-grafite/30">📷</span>
                  )}
                </div>
                <span className="text-xs font-medium text-grafite truncate w-full">{doc.name}</span>
                <DeleteButton
                  onClick={() => deleteDoc(doc.id)}
                  ariaLabel={`Excluir ${doc.name}`}
                  className="absolute top-1 right-1"
                  stopPropagation
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {renderAddMenu(addMenu, handleAddChoice)}
      {renderDocForm(pendingFile, () => { setPendingFile(null); setSaveError(null); }, editName, setEditName, editCat, setEditCat, savePendingDoc, saveError, isSaving, pendingPreviewUrl)}
      {showWebcam && renderWebcam(videoRef, cameraCanvasRef, captureWebcamPhoto, stopWebcam, cameraError)}
    </div>
  );
}

// ─── Bottom sheet: choose add method ───
function renderAddMenu(open: boolean, onChoice: (c: AddMenuChoice) => void) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm animate-fade-in" onClick={() => onChoice(null)} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
        <h3 className="font-display font-bold text-magenta text-lg mb-5 text-center">Adicionar</h3>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onChoice('photo')}
            className="w-full flex items-center gap-3 bg-[#F3F3F3] hover:bg-magenta/5 rounded-xl px-4 py-4 transition-colors text-left"
          >
            <span className="text-2xl shrink-0">📷</span>
            <span className="text-sm font-medium text-grafite flex-1">Tirar Foto</span>
            <span className="text-[10px] text-grafite/50">Abre a câmera</span>
          </button>
          <button
            type="button"
            onClick={() => onChoice('gallery')}
            className="w-full flex items-center gap-3 bg-[#F3F3F3] hover:bg-magenta/5 rounded-xl px-4 py-4 transition-colors text-left"
          >
            <span className="text-2xl shrink-0">🖼️</span>
            <span className="text-sm font-medium text-grafite flex-1">Escolher da Galeria</span>
            <span className="text-[10px] text-grafite/50">JPG, PNG</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => onChoice(null)}
          className="w-full mt-5 text-sm font-medium text-grafite/60 hover:text-magenta py-2 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}

// ─── Webcam overlay ───
function renderWebcam(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCapture: () => void,
  onCancel: () => void,
  cameraError: string | null,
) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex flex-col items-center justify-center p-4">
      <h3 className="text-white font-display font-bold text-lg mb-4">Câmera</h3>
      {cameraError && (
        <p className="text-red-300 bg-red-900/40 rounded-lg px-4 py-2 mb-4 text-sm text-center max-w-sm">{cameraError}</p>
      )}
      <div className="rounded-2xl overflow-hidden shadow-2xl bg-black">
        <video ref={videoRef} autoPlay playsInline className="w-full max-w-md max-h-[60vh] object-contain" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="bg-white/20 hover:bg-white/30 text-white font-medium text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onCapture}
          className="bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-sm px-8 py-3 rounded-xl transition-colors shadow-lg"
        >
          Capturar foto
        </button>
      </div>
    </div>
  );
}

// ─── Bottom sheet: name + categorize after capture/upload ───
function renderDocForm(
  pending: { blob: Blob; fileName: string; fileType: string } | null,
  onClose: () => void,
  name: string,
  setName: (v: string) => void,
  cat: string,
  setCat: (v: string) => void,
  onSave: (e?: React.MouseEvent | React.FormEvent) => void,
  saveError: string | null,
  isSaving: boolean,
  previewUrl: string | null,
) {
  if (!pending) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-grafite/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 shadow-2xl animate-fade-in-down max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-grafite/20 rounded-full mx-auto mb-5" />
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-xl bg-[#F3F3F3] flex items-center justify-center overflow-hidden shadow-sm">
            {previewUrl ? (
              <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">📷</span>
            )}
          </div>
        </div>
        <h3 className="font-display font-bold text-magenta text-base mb-1 text-center">Salvar foto</h3>
        <p className="text-[11px] text-grafite/50 text-center mb-5">Foto selecionada — confira os dados abaixo</p>

        <div className="mb-4">
          <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-1">Nome da foto</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Certificado de Conclusão"
            className="w-full bg-white border border-grafite/15 focus:border-magenta focus:ring-1 focus:ring-magenta/20 rounded-lg px-3 py-2.5 text-sm text-grafite placeholder:text-grafite/30 focus:outline-none transition-all"
          />
        </div>
        <div className="mb-5">
          <label className="block text-[10px] font-medium text-grafite uppercase tracking-wider mb-2">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {DOC_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  cat === c.id ? 'bg-magenta text-white' : 'bg-[#F3F3F3] text-grafite hover:bg-magenta/5'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
        {saveError && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{saveError}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#F3F3F3] hover:bg-grafite/10 text-grafite font-display font-bold text-sm py-3.5 rounded-xl transition-colors"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(e); }}
            disabled={!name.trim() || isSaving}
            className="bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-sm py-3.5 rounded-xl transition-all duration-300"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </>
  );
}
