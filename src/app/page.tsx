
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, Mail, Lock, CheckCircle2, ArrowRight, Settings2 } from 'lucide-react';
import { usePlatformAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { authenticateUserAction } from '@/app/actions/auth-actions';
import { requestPasswordResetAction } from '@/app/actions/smtp-actions';
import { checkSystemStatusAction } from '@/app/actions/migration-actions';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription as ModalDescription } from '@/components/ui/dialog';
import { useAuth } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser, isUserLoading } = usePlatformAuth();
  const { dataSource } = useSettings();
  const auth = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Forgot Password State
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if system is initialized with silent error handling
    const checkStatus = async () => {
      try {
        const status = await checkSystemStatusAction();
        if (!status.initialized) {
          router.push('/setup');
          return;
        }
      } catch (e) {
        // Fallback: stay on login page even if DB check fails
      }
      setIsInitializing(false);
    };

    checkStatus();
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
      if (!email || !password) {
        throw new Error("Bitte E-Mail und Passwort eingeben.");
      }

      const result = await authenticateUserAction(dataSource, email, password);
      
      if (!result.success || !result.user) {
        setAuthError(result.error || "Zugriff verweigert. Bitte prüfen Sie Ihre Daten.");
        setIsActionLoading(false);
        return;
      }

      if (dataSource === 'firestore' && auth) {
        try {
          await signInAnonymously(auth);
        } catch (fbErr) {
          console.error("Firebase Auth Bridge failed", fbErr);
        }
      }
      
      toast({ title: "Erfolgreich angemeldet" });
      setUser(result.user);
      router.push('/dashboard');

    } catch (err: any) {
      setAuthError(err.message || "Ein Systemfehler ist aufgetreten.");
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

  if (!mounted || (isUserLoading && !user) || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System wird geprüft...</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-500">
      {/* Logo Area */}
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

      <div className="w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-500 delay-150">
        <Card className="border-none shadow-2xl rounded-3xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-xl font-headline font-bold text-slate-800 dark:text-slate-100">Identity Login</CardTitle>
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Bitte melden Sie sich an, um fortzufahren.
              </CardDescription>
              <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase border-primary/20 text-primary px-2 bg-primary/5">
                {dataSource}
              </Badge>
            </div>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-6">
              {authError && (
                <Alert variant="destructive" className="rounded-xl border-none bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-[11px] font-bold">{authError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">E-Mail</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="email" 
                    placeholder="name@firma.de" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="rounded-xl h-12 pl-10 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:bg-white transition-all" 
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500">Passwort</Label>
                  <button 
                    type="button" 
                    className="text-[9px] font-black text-primary hover:text-primary/80 transition-colors"
                    onClick={() => { setForgotSuccess(false); setForgotEmail(email); setIsForgotOpen(true); }}
                  >
                    Vergessen?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="rounded-xl h-12 pl-10 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:bg-white transition-all" 
                    required
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-4 pb-8 flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all gap-2" 
                disabled={isActionLoading}
              >
                {isActionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                Anmelden
              </Button>
              <p className="text-[10px] text-center text-slate-400 font-medium">
                Sicherheitsgeschützte Enterprise-Verbindung
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="rounded-3xl max-sm border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
            <DialogTitle className="text-lg font-headline font-bold">Passwort zurücksetzen</DialogTitle>
            <ModalDescription className="text-xs text-slate-500">Wir senden Ihnen eine Anleitung per E-Mail.</ModalDescription>
          </DialogHeader>
          
          <div className="p-6">
            {forgotSuccess ? (
              <div className="py-4 flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-[11px] text-center font-bold text-slate-600 dark:text-slate-400">Prüfen Sie Ihr Postfach.</p>
                <Button className="rounded-xl w-full" onClick={() => setIsForgotOpen(false)}>Schließen</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black">Anmelde-E-Mail</Label>
                  <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="rounded-xl h-11" placeholder="max@beispiel.de" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full rounded-xl font-bold text-[10px] h-11 tracking-wider gap-2 shadow-md shadow-primary/10" onClick={handleForgotSubmit} disabled={isForgotLoading}>
                    {isForgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Reset-Link senden
                  </Button>
                  <Button variant="ghost" className="w-full rounded-xl font-bold text-[10px]" onClick={() => setIsForgotOpen(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
