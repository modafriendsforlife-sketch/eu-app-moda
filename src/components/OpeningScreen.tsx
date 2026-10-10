import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, GraduationCap, Lock, LogIn, Mail, Sparkles, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface OpeningScreenProps {
  onEnter: (name: string, email: string, isSignup: boolean) => void;
  initialMode?: 'signup' | 'login' | 'forgot' | null;
}

type FormMode = 'signup' | 'login' | 'forgot';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export default function OpeningScreen({ onEnter, initialMode = null }: OpeningScreenProps) {
  const [formMode, setFormMode] = useState<FormMode | null>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [recoveryLinkSent, setRecoveryLinkSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoClicksRef = useRef(0);
  const logoClickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setFormMode(initialMode);
    setForgotError(null);
    setRecoveryLinkSent(false);
    if (initialMode === 'forgot') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setRecoveryLinkSent(true);
      });
    }
  }, [initialMode]);

  const clearMessages = () => {
    setErrors({});
    setLoginError(null);
    setSignupError(null);
    setForgotError(null);
  };

  const switchMode = (mode: FormMode) => {
    clearMessages();
    setRecoveryLinkSent(false);
    setFormMode(mode);
  };

  const returnToOpening = () => {
    clearMessages();
    setFormMode(null);
    setName('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSignupSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Digite seu nome';
    if (!email.trim()) nextErrors.email = 'Digite seu e-mail';
    else if (!isValidEmail(email)) nextErrors.email = 'Por favor, insira um e-mail válido.';
    if (!password.trim()) nextErrors.password = 'Digite sua senha';
    else if (password.trim().length < 6) nextErrors.password = 'A senha deve ter pelo menos 6 caracteres.';
    setErrors(nextErrors);
    setSignupError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setIsSubmitting(false);

    if (error) {
      setSignupError(error.message.toLowerCase().includes('already registered')
        ? 'Este e-mail já está cadastrado. Faça login para acessar sua conta.'
        : 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
      return;
    }
    if (!data.session || !data.user) {
      setSignupError('O cadastro foi criado. Verifique seu e-mail para confirmar a conta antes de entrar.');
      return;
    }
    onEnter(name.trim(), data.user.email ?? email.trim().toLowerCase(), true);
  };

  const handleLoginSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Digite seu e-mail';
    if (!password.trim()) nextErrors.password = 'Digite sua senha';
    setErrors(nextErrors);
    setLoginError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setIsSubmitting(false);

    if (error || !data.user) {
      setLoginError('E-mail ou senha incorretos.');
      return;
    }
    onEnter(data.user.user_metadata?.display_name ?? '', data.user.email ?? email.trim().toLowerCase(), false);
  };

  const handleForgotSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (isSubmitting) return;
    setForgotError(null);

    if (recoveryLinkSent) {
      if (newPassword.length < 6) {
        setForgotError('A nova senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setForgotError('As senhas não coincidem.');
        return;
      }
      setIsSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setIsSubmitting(false);
      if (error) {
        setForgotError('Não foi possível atualizar a senha. Abra novamente o link recebido por e-mail.');
        return;
      }
      setForgotSuccess(true);
      window.setTimeout(() => {
        setForgotSuccess(false);
        setRecoveryLinkSent(false);
        setNewPassword('');
        setConfirmPassword('');
        setFormMode('login');
        setEmail(forgotEmail);
      }, 1500);
      return;
    }

    if (!forgotEmail.trim() || !isValidEmail(forgotEmail)) {
      setForgotError('Digite um e-mail válido.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
      redirectTo: window.location.origin,
    });
    setIsSubmitting(false);
    if (error) {
      setForgotError('Não foi possível iniciar a recuperação. Tente novamente.');
      return;
    }
    setRecoveryLinkSent(true);
  };

  return (
    <div className="min-h-screen bg-offwhite flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-magenta/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-magenta/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      {formMode !== null && (
        <button type="button" onClick={returnToOpening} aria-label="Voltar para a tela inicial" className="absolute top-6 left-6 z-20 inline-flex items-center gap-2 text-grafite hover:text-magenta transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-grafite/20 rounded-md px-1 py-1">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-sm font-medium">Voltar</span>
        </button>
      )}

      <div className="relative z-10 w-full max-w-md">
        {formMode === null ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-36 h-36 sm:w-44 sm:h-44 overflow-hidden mb-8">
              <img
                src="/assets/{0FCF626A-EDDD-4190-A656-A02CCD547589}.png"
                alt="Monograma MF da Moda Friends"
                width={176}
                height={176}
                loading="eager"
                decoding="sync"
                className="w-full h-full object-contain mix-blend-multiply cursor-pointer select-none"
                onClick={() => {
                  if (logoClickTimerRef.current !== null) window.clearTimeout(logoClickTimerRef.current);
                  logoClicksRef.current += 1;
                  logoClickTimerRef.current = window.setTimeout(() => {
                    logoClicksRef.current = 0;
                    logoClickTimerRef.current = null;
                  }, 1200);
                  if (logoClicksRef.current >= 5) {
                    logoClicksRef.current = 0;
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                  }
                }}
              />
            </div>
            <h1 className="font-display text-5xl sm:text-6xl font-extrabold text-grafite tracking-tight mb-4 leading-tight">JORNADA<br /><span className="text-magenta">MF</span></h1>
            <p className="text-lg text-grafite mb-12 font-medium">Seu próximo passo começa aqui.</p>
            <button onClick={() => setFormMode('signup')} className="group inline-flex items-center gap-3 bg-magenta hover:bg-magenta-dark text-white font-display font-bold text-lg px-10 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-magenta/20 hover:shadow-xl hover:shadow-magenta/30 hover:-translate-y-0.5 active:translate-y-0 animate-pulse-glow">
              <span>[ COMEÇAR ]</span>
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <div className="mt-5"><button onClick={() => setFormMode('login')} className="text-sm font-medium text-grafite hover:text-magenta transition-colors">Já tenho uma conta → Entrar</button></div>
            <div className="mt-8 flex items-center justify-center gap-2 text-grafite text-sm"><Sparkles className="w-4 h-4" /><span>Sua jornada, do estudo à carreira</span><Sparkles className="w-4 h-4" /></div>
          </div>
        ) : formMode === 'signup' ? (
          <div className="animate-fade-in" key="signup"><div className="bg-card rounded-2xl shadow-xl shadow-grafite/5 p-8 sm:p-10 border border-grafite/5">
            <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-magenta/10 mb-4"><GraduationCap className="w-7 h-7 text-magenta" strokeWidth={1.8} /></div><h2 className="font-display text-2xl font-bold text-magenta mb-1">Criar meu espaço</h2><p className="text-sm text-grafite">Preencha os dados para começar sua jornada</p></div>
            <form onSubmit={handleSignupSubmit} className="space-y-5">
              <FormField icon={<User className="w-5 h-5" />} label="Nome" type="text" value={name} onChange={setName} placeholder="Como podemos te chamar?" error={errors.name} />
              <FormField icon={<Mail className="w-5 h-5" />} label="E-mail" type="email" value={email} onChange={(value) => { setEmail(value); setSignupError(null); }} placeholder="seu@email.com" error={errors.email} />
              <FormField icon={<Lock className="w-5 h-5" />} label="Senha" type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="Crie uma senha" error={errors.password} isPasswordVisible={isPasswordVisible} onTogglePassword={() => setIsPasswordVisible((value) => !value)} />
              {signupError && <p className="text-sm text-red-600 font-medium text-center bg-red-50 rounded-lg py-2.5">{signupError}</p>}
              <button type="submit" disabled={isSubmitting} className="w-full bg-magenta hover:bg-magenta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-lg py-4 rounded-xl transition-all duration-300 shadow-lg shadow-magenta/20 hover:shadow-xl hover:shadow-magenta/30 hover:-translate-y-0.5 active:translate-y-0 mt-2">{isSubmitting ? 'Salvando...' : 'Criar meu espaço'}</button>
            </form>
            <button onClick={() => switchMode('login')} className="w-full text-center text-sm text-grafite hover:text-magenta mt-4 transition-colors font-medium">Já tenho uma conta → Entrar</button>
          </div></div>
        ) : formMode === 'login' ? (
          <div className="animate-fade-in" key="login"><div className="bg-card rounded-2xl shadow-xl shadow-grafite/5 p-8 sm:p-10 border border-grafite/5">
            <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-magenta/10 mb-4"><LogIn className="w-7 h-7 text-magenta" strokeWidth={1.8} /></div><h2 className="font-display text-2xl font-bold text-magenta mb-1">Entrar</h2><p className="text-sm text-grafite">Bem-vindo de volta à Jornada MF</p></div>
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <FormField icon={<Mail className="w-5 h-5" />} label="E-mail" type="email" value={email} onChange={(value) => { setEmail(value); setLoginError(null); }} placeholder="seu@email.com" error={errors.email} />
              <FormField icon={<Lock className="w-5 h-5" />} label="Senha" type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(value) => { setPassword(value); setLoginError(null); }} placeholder="Sua senha" error={errors.password} isPasswordVisible={isPasswordVisible} onTogglePassword={() => setIsPasswordVisible((value) => !value)} />
              {loginError && <p className="text-sm text-red-600 font-medium text-center bg-red-50 rounded-lg py-2.5">{loginError}</p>}
              <button type="submit" disabled={isSubmitting} className="w-full bg-magenta hover:bg-magenta-dark disabled:opacity-40 text-white font-display font-bold text-lg py-4 rounded-xl transition-all duration-300 shadow-lg shadow-magenta/20 hover:shadow-xl hover:shadow-magenta/30 hover:-translate-y-0.5 active:translate-y-0 mt-2">{isSubmitting ? 'Entrando...' : 'Entrar'}</button>
            </form>
            <button onClick={() => { setForgotEmail(email.trim()); switchMode('forgot'); }} className="w-full text-center text-sm text-grafite hover:text-magenta mt-4 transition-colors font-medium">Esqueci minha senha</button>
            <button onClick={() => switchMode('signup')} className="w-full flex items-center justify-center gap-2 text-center text-sm text-grafite hover:text-magenta mt-2 transition-colors font-medium"><ArrowLeft className="w-4 h-4" />Voltar para o cadastro</button>
          </div></div>
        ) : (
          <div className="animate-fade-in" key="forgot"><div className="bg-card rounded-2xl shadow-xl shadow-grafite/5 p-8 sm:p-10 border border-grafite/5">
            <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-magenta/10 mb-4"><Lock className="w-7 h-7 text-magenta" strokeWidth={1.8} /></div><h2 className="font-display text-2xl font-bold text-magenta mb-1">Esqueci minha senha</h2><p className="text-sm text-grafite">{recoveryLinkSent ? 'Defina sua nova senha abaixo.' : 'Enviaremos um link seguro para seu e-mail.'}</p></div>
            {forgotSuccess ? <div className="text-center py-6"><div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-green-600" strokeWidth={2} /></div><p className="text-sm text-grafite font-medium">Senha atualizada com sucesso!</p></div> : recoveryLinkSent ? <form onSubmit={handleForgotSubmit} className="space-y-5"><FormField icon={<Lock className="w-5 h-5" />} label="Nova senha" type={isPasswordVisible ? 'text' : 'password'} value={newPassword} onChange={setNewPassword} placeholder="Digite a nova senha" isPasswordVisible={isPasswordVisible} onTogglePassword={() => setIsPasswordVisible((value) => !value)} /><FormField icon={<Lock className="w-5 h-5" />} label="Confirme a nova senha" type={isPasswordVisible ? 'text' : 'password'} value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" />{forgotError && <p className="text-sm text-red-600 font-medium text-center bg-red-50 rounded-lg py-2.5">{forgotError}</p>}<button type="submit" disabled={isSubmitting} className="w-full bg-magenta hover:bg-magenta-dark disabled:opacity-40 text-white font-display font-bold text-lg py-4 rounded-xl transition-all duration-300 shadow-lg shadow-magenta/20 mt-2">{isSubmitting ? 'Salvando...' : 'Salvar nova senha'}</button></form> : <form onSubmit={handleForgotSubmit} className="space-y-5"><FormField icon={<Mail className="w-5 h-5" />} label="E-mail da conta" type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="seu@email.com" />{forgotError && <p className="text-sm text-red-600 font-medium text-center bg-red-50 rounded-lg py-2.5">{forgotError}</p>}<button type="submit" disabled={isSubmitting} className="w-full bg-magenta hover:bg-magenta-dark disabled:opacity-40 text-white font-display font-bold text-lg py-4 rounded-xl transition-all duration-300 shadow-lg shadow-magenta/20 mt-2">{isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}</button></form>}
            {!forgotSuccess && <button onClick={() => switchMode('login')} className="w-full flex items-center justify-center gap-2 text-center text-sm text-grafite hover:text-magenta mt-4 transition-colors font-medium"><ArrowLeft className="w-4 h-4" />Voltar para o login</button>}
          </div></div>
        )}
      </div>
    </div>
  );
}

interface FormFieldProps {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  isPasswordVisible?: boolean;
  onTogglePassword?: () => void;
}

function FormField({ icon, label, type, value, onChange, placeholder, error, isPasswordVisible, onTogglePassword }: FormFieldProps) {
  return <div><label className="block text-sm font-medium text-grafite mb-1.5">{label}</label><div className={`relative flex items-center rounded-xl border bg-white transition-all duration-200 ${error ? 'border-magenta ring-1 ring-magenta/20' : 'border-grafite/10 focus-within:border-magenta focus-within:ring-1 focus-within:ring-magenta/20'}`}><span className="pl-4 text-grafite">{icon}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={type === 'password' ? 'new-password' : undefined} className="w-full bg-transparent px-3 py-3.5 text-grafite placeholder:text-grafite/40 focus:outline-none text-sm" />{onTogglePassword && <button type="button" onClick={onTogglePassword} aria-label={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'} className="mr-3 text-grafite hover:text-magenta transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta/30 rounded-md">{isPasswordVisible ? <EyeOff className="w-5 h-5" strokeWidth={1.8} /> : <Eye className="w-5 h-5" strokeWidth={1.8} />}</button>}</div>{error && <p className="text-xs text-magenta mt-1 font-medium">{error}</p>}</div>;
}
