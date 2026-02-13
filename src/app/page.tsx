
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePlatformAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { authenticateUserAction } from '@/app/actions/auth-actions';
import { requestPasswordResetAction } from '@/app/actions/smtp-actions';
import { checkSystemStatusAction } from '@/app/actions/migration-actions';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as ModalDescription } from '@/components/ui/dialog';
import { useAuth } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

function LoginForm() {
  const router = useRouter();
  const { user, setUser, isUserLoading } = usePlatformAuth();
  const { dataSource } = useSettings();
  const auth = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingSystem, setIsCheckingSystem] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Forgot Password States
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (dataSource === 'mysql') {
      checkSystemStatusAction().then(res => {
        if (!res.initialized) {
          router.push('/setup-wizard');
        } else {
          setIsCheckingSystem(false);
        }
      }).catch(err => {
        setDbError("Verbindung zur MySQL-Datenbank fehlgeschlagen. Prüfen Sie, ob der Container läuft.");
        setIsCheckingSystem(false);
      });
    } else {
      setIsCheckingSystem(false);
    }
  }, [dataSource, router]);

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
      if (!email || !password) throw new Error("Bitte E-Mail und Passwort eingeben.");

      const result = await authenticateUserAction(dataSource, email, password);
      
      if (!result.success || !result.user) {
        setAuthError(result.error || "Zugriff verweigert.");
        setIsActionLoading(false);
        return;
      }

      if (dataSource === 'firestore' && auth) {
        try { await signInAnonymously(auth); } catch (fbErr) {}
      }
      
      toast({ title: "Erfolgreich angemeldet" });
      setUser(result.user);
      
      // Force hard redirect to ensure middleware picks up the new session cookie immediately
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 100);

    } catch (err: any) {
      setAuthError(err.message || "Ein Systemfehler ist aufgetreten.");
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
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (!mounted || isCheckingSystem || (isUserLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 transition-colors duration-500">
      <div className="mb-12 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="w-16 h-16 bg-primary flex items-center justify-center rounded-2xl shadow-xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-300">
          <Shield className="w-9 h-9 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-900 dark:text-white uppercase">ComplianceHub</h1>
          <p className="text-xl font-script text-primary mt-2">Struktur statt Bauchgefühl</p>
        </div>
      </div>

      <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-500">
        <Card className="border-none shadow-2xl rounded-3xl bg-white dark:bg-slate-800 overflow-hidden">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-xl font-headline font-bold">Identity Login</CardTitle>
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs">Zugriff auf Governance-Konsole</CardDescription>
              <Badge variant="outline" className="text-[9px] font-black uppercase text-primary bg-primary/5">{dataSource}</Badge>
            </div>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-6">
              {dbError && <Alert variant="destructive" className="rounded-xl"><AlertDescription className="text-[10px] font-bold">{dbError}</AlertDescription></Alert>}
              {authError && <Alert variant="destructive" className="rounded-xl"><AlertDescription className="text-[11px] font-bold">{authError}</AlertDescription></Alert>}
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-widest text-slate-400">E-Mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary" />
                  <Input type="email" placeholder="name@firma.de" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12 pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label className="text-[10px] font-black tracking-widest text-slate-400">Passwort</Label>
                  <button type="button" className="text-[9px] font-black text-primary" onClick={() => { setIsForgotOpen(true); setForgotSuccess(false); setForgotEmail(email); }}>Vergessen?</button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary" />
                  <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl h-12 pl-10" required />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-4 pb-8">
              <Button type="submit" className="w-full h-12 bg-primary text-white rounded-xl font-bold text-xs tracking-[0.2em] shadow-lg gap-2" disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />} Anmelden
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="rounded-3xl max-w-sm border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-800">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b">
            <DialogTitle>Passwort zurücksetzen</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {forgotSuccess ? (
              <div className="py-4 flex flex-col items-center space-y-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-600" />
                <p className="text-xs text-center font-bold">Prüfen Sie Ihr Postfach.</p>
                <Button className="w-full" onClick={() => setIsForgotOpen(false)}>Schließen</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="rounded-xl h-11" placeholder="E-Mail..." />
                <Button className="w-full rounded-xl" onClick={handleForgotSubmit} disabled={isForgotLoading}>
                  {isForgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link senden"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
