'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, Mail, Lock, CheckCircle2, ArrowRight, Zap, Send, KeyRound } from 'lucide-react';
import { usePlatformAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { authenticateUserAction } from '@/app/actions/auth-actions';
import { requestPasswordResetAction, sendMagicLinkAction } from '@/app/actions/smtp-actions';
import { verifyTotpLoginAction } from '@/app/actions/otp-actions';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription as ModalDescription } from '@/components/ui/dialog';
import { useAuth } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser, isUserLoading } = usePlatformAuth();
  const { dataSource } = useSettings();
  const auth = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 2FA State
  const [isTotpRequired, setIsTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // Magic Link State
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);

  // Forgot Password State
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && user) {
      router.push('/dashboard');
    }
  }, [user, router, mounted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    setAuthError(null);

    try {
      if (!email || !password) {
        throw new Error("Bitte E-Mail und Passwort eingeben.");
      }

      const result = await authenticateUserAction(dataSource, email, password);
      
      if (!result.success) {
        setAuthError(result.error || "Zugriff verweigert. Bitte prüfen Sie Ihre Daten.");
        setIsActionLoading(false);
        return;
      }

      if (result.requires2FA) {
        setIsTotpRequired(true);
        setIsActionLoading(false);
        return;
      }

      completeLogin(result.user);

    } catch (err: any) {
      setAuthError(err.message || "Ein Systemfehler ist aufgetreten.");
      setIsActionLoading(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const res = await verifyTotpLoginAction(email, totpCode, dataSource);
      if (res.success) {
        completeLogin(res.user);
      } else {
        setAuthError(res.error || "Falscher Code.");
        setIsActionLoading(false);
      }
    } catch (e) {
      setAuthError("Fehler bei der 2FA Verifizierung.");
      setIsActionLoading(false);
    }
  };

  const completeLogin = async (userData: any) => {
    if (dataSource === 'firestore' && auth) {
      try {
        await signInAnonymously(auth);
      } catch (fbErr) {
        console.error("Firebase Auth Bridge failed", fbErr);
      }
    }
    
    toast({ title: "Erfolgreich angemeldet" });
    setUser(userData);
    router.push('/dashboard');
  };

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsActionLoading(true);
    setAuthError(null);
    try {
      const res = await sendMagicLinkAction(email, dataSource);
      if (res.success) {
        setIsMagicLinkSent(true);
        toast({ title: "Magic Link gesendet", description: "Prüfen Sie Ihr Postfach." });
      } else {
        setAuthError(res.message);
      }
    } catch (e: any) {
      setAuthError("Schnittstellenfehler.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail) return;
    setIsForgotLoading(true);
    try {
      const res = await requestPasswordResetAction(forgotEmail);
      if (res.success) setForgotSuccess(true);
      else toast({ variant: "destructive", title: "Fehler", description: res.message });
    } catch (e) {
      toast({ variant: "destructive", title: "Systemfehler" });
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (!mounted || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-500">
      <div className="mb-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="w-16 h-16 bg-primary flex items-center justify-center rounded-2xl shadow-xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-300">
          <Shield className="w-9 h-9 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-900 dark:text-white">ComplianceHub</h1>
          <div className="mt-2 relative inline-block group">
            <p className="text-xl font-script text-primary transition-transform duration-300">
              Struktur statt Bauchgefühl
            </p>
            <svg className="absolute -bottom-2.5 left-0 w-full h-3 text-primary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M1 5C20 1 80 1 99 5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500 delay-150">
        <Card className="border-none shadow-2xl rounded-3xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-headline font-bold text-slate-800 dark:text-slate-100">Identity Login</CardTitle>
              <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase border-primary/20 text-primary px-2 bg-primary/5">
                {dataSource}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Bitte wählen Sie Ihre bevorzugte Methode.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {authError && (
              <Alert variant="destructive" className="rounded-xl border-none bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-[11px] font-bold">{authError}</AlertDescription>
              </Alert>
            )}

            {!isTotpRequired ? (
              <Tabs defaultValue="password" onValueChange={() => setAuthError(null)} className="w-full">
                <TabsList className="grid grid-cols-2 h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <TabsTrigger value="password" className="rounded-lg text-[10px] font-bold uppercase tracking-wider">Passwort</TabsTrigger>
                  <TabsTrigger value="magic" className="rounded-lg text-[10px] font-bold uppercase tracking-wider gap-2">
                    <Zap className="w-3 h-3 text-primary fill-current" /> Magic Link
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="password" className="pt-6 space-y-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black tracking-widest text-slate-400 ml-1 uppercase">E-Mail</Label>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary" />
                        <Input 
                          type="email" 
                          placeholder="name@firma.de" 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)} 
                          className="rounded-xl h-12 pl-10 border-slate-200 focus:bg-white" 
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Passwort</Label>
                        <button 
                          type="button" 
                          className="text-[9px] font-black text-primary hover:underline"
                          onClick={() => { setForgotSuccess(false); setForgotEmail(email); setIsForgotOpen(true); }}
                        >
                          Vergessen?
                        </button>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary" />
                        <Input 
                          type="password" 
                          placeholder="••••••••"
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          className="rounded-xl h-12 pl-10 border-slate-200 focus:bg-white" 
                          required
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] shadow-lg active:scale-95 transition-all gap-2 uppercase" 
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      Anmelden
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="magic" className="pt-6 space-y-6">
                  {isMagicLinkSent ? (
                    <div className="py-8 text-center space-y-4 animate-in zoom-in-95">
                      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-inner">
                        <Send className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-slate-800">Prüfen Sie Ihr Postfach!</h3>
                        <p className="text-[11px] text-slate-500 leading-relaxed">Wir haben einen Anmeldelink an <strong className="text-slate-900">{email}</strong> gesendet.</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] font-bold text-slate-400" onClick={() => setIsMagicLinkSent(false)}>Zurück zur Auswahl</Button>
                    </div>
                  ) : (
                    <form onSubmit={handleMagicLinkRequest} className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black tracking-widest text-slate-400 ml-1 uppercase">Deine E-Mail</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary" />
                          <Input 
                            type="email" 
                            placeholder="name@firma.de" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="rounded-xl h-12 pl-10 border-slate-200" 
                            required
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-[10px] tracking-[0.2em] shadow-lg active:scale-95 transition-all gap-2 uppercase" 
                        disabled={isActionLoading || !email}
                      >
                        {isActionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
                        Link anfordern
                      </Button>
                      <p className="text-[10px] text-slate-400 text-center font-medium leading-relaxed italic">Passwortloses Einloggen über gesicherten Einmal-Link.</p>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="pt-4 space-y-6 animate-in slide-in-from-right-4">
                <div className="flex items-center gap-4 border-b pb-4 border-slate-100">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Zwei-Faktor-Auth</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Code erforderlich</p>
                  </div>
                </div>
                <form onSubmit={handleTotpVerify} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">6-stelliger Authenticator-Code</Label>
                    <Input 
                      value={totpCode} 
                      onChange={e => setTotpCode(e.target.value)} 
                      placeholder="000 000" 
                      className="h-12 rounded-xl text-center text-xl font-black tracking-[0.5em] border-primary/20 bg-primary/5"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] tracking-[0.2em] shadow-lg gap-2 uppercase" 
                    disabled={isActionLoading || totpCode.length < 6}
                  >
                    {isActionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                    Verifizieren & Login
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full text-[10px] font-bold text-slate-400" onClick={() => { setIsTotpRequired(false); setTotpCode(''); }}>
                    Abbrechen
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
          <CardFooter className="pb-8 flex justify-center border-t pt-4 bg-slate-50/50">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-3 h-3" /> Enterprise Protected Connection
            </p>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="rounded-3xl max-w-sm border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="text-lg font-headline font-bold">Passwort vergessen?</DialogTitle>
            <ModalDescription className="text-xs text-slate-500">Geben Sie Ihre E-Mail an, um ein neues Passwort zu setzen.</ModalDescription>
          </DialogHeader>
          <div className="p-6">
            {forgotSuccess ? (
              <div className="py-4 flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><CheckCircle2 className="w-8 h-8" /></div>
                <p className="text-[11px] text-center font-bold text-slate-600">Prüfen Sie Ihr Postfach.</p>
                <Button className="rounded-xl w-full" onClick={() => setIsForgotOpen(false)}>Schließen</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">E-Mail</Label>
                  <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="rounded-xl h-11" placeholder="max@beispiel.de" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full rounded-xl font-bold text-[10px] h-11 uppercase" onClick={handleForgotSubmit} disabled={isForgotLoading}>
                    {isForgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Reset anfordern
                  </Button>
                  <Button variant="ghost" className="w-full rounded-xl font-bold text-[10px]" onClick={() => setIsForgotOpen(false)}>Abbrechen</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
