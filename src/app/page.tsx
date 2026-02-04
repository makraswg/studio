'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { usePlatformAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { authenticateUserAction } from '@/app/actions/auth-actions';
import { requestPasswordResetAction } from '@/app/actions/smtp-actions';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';

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

      // 1. Authentifizierung gegen die gewählte Datenquelle (MySQL oder Cloud)
      const result = await authenticateUserAction(dataSource, email, password);
      
      if (!result.success || !result.user) {
        setAuthError(result.error || "Zugriff verweigert. Bitte prüfen Sie Ihre Daten.");
        setIsActionLoading(false);
        return;
      }

      // 2. Falls im Cloud-Modus, stellen wir sicher, dass auch der Firebase Auth State aktiv ist
      // Dies erlaubt den Zugriff auf Sammlungen, die 'isSignedIn()' in den Rules erfordern.
      if (dataSource === 'firestore' && auth) {
        try {
          await signInAnonymously(auth);
        } catch (fbErr) {
          console.error("Firebase Auth Bridge failed", fbErr);
          // Wir fahren trotzdem fort, da die Hub-Auth erfolgreich war
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

  if (!mounted || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary/20" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-body">
      <div className="absolute top-0 left-0 p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-headline font-bold tracking-tight text-foreground uppercase">ComplianceHub</span>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
        <Card className="border border-border shadow-2xl rounded-none bg-card">
          <CardHeader className="space-y-1 border-b bg-muted/10 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-wider">Identity Login</CardTitle>
              <div className="px-2 py-0.5 text-[8px] font-bold uppercase border rounded-none border-primary/20 text-primary">
                {dataSource === 'mysql' ? 'Lokal' : dataSource === 'firestore' ? 'Zentral' : 'Demo'}
              </div>
            </div>
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground/60">
              Governance Plattform Authentifizierung
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-5 pt-6">
              {authError && (
                <Alert variant="destructive" className="rounded-none border-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-[10px] font-bold uppercase">{authError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Benutzer E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input 
                    type="email" 
                    placeholder="name@firma.local" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="rounded-none h-11 pl-10" 
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="rounded-none h-11 pl-10" 
                    required
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button 
                    type="button" 
                    className="text-[9px] font-bold uppercase text-primary hover:underline"
                    onClick={() => { setForgotSuccess(false); setForgotEmail(email); setIsForgotOpen(true); }}
                  >
                    Zugangsdaten vergessen?
                  </button>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pb-8">
              <Button 
                type="submit" 
                className="w-full h-12 bg-primary text-primary-foreground rounded-none font-bold uppercase text-xs tracking-widest" 
                disabled={isActionLoading}
              >
                {isActionLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                Anmelden
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="rounded-none max-w-sm border-2">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Passwort zurücksetzen</DialogTitle>
          </DialogHeader>
          
          {forgotSuccess ? (
            <div className="py-8 flex flex-col items-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-[10px] text-center font-bold uppercase">E-Mail wurde versendet.</p>
              <Button className="rounded-none w-full" onClick={() => setIsForgotOpen(false)}>Schließen</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Anmelde-E-Mail</Label>
                <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="rounded-none h-10" />
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-col">
                <Button className="w-full rounded-none font-bold uppercase text-[10px] gap-2" onClick={handleForgotSubmit} disabled={isForgotLoading}>
                  {isForgotLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Reset-Link senden
                </Button>
                <Button variant="ghost" className="w-full rounded-none font-bold uppercase text-[10px]" onClick={() => setIsForgotOpen(false)}>
                  Abbrechen
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}