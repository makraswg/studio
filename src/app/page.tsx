'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { usePlatformAuth } from '@/context/auth-context';
import { useSettings } from '@/context/settings-context';
import { authenticateUserAction } from '@/app/actions/auth-actions';
import { requestPasswordResetAction } from '@/app/actions/smtp-actions';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser, isUserLoading } = usePlatformAuth();
  const { dataSource } = useSettings();
  
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

  // Prevent hydration mismatch
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
      if (!email) {
        throw new Error("Bitte geben Sie eine E-Mail Adresse ein.");
      }
      
      // Password is required for MySQL
      if (dataSource === 'mysql' && !password) {
          throw new Error("Bitte geben Sie Ihr Passwort ein.");
      }

      const result = await authenticateUserAction(dataSource, email, password);
      
      if (!result.success || !result.user) {
        setAuthError(result.error || "Zugriff verweigert. Bitte prüfen Sie Ihre Daten.");
        setIsActionLoading(false);
        return;
      }
      
      toast({ title: "Anmeldung erfolgreich", description: `Willkommen zurück, ${result.user.displayName}` });
      setUser(result.user);
      router.push('/dashboard');

    } catch (err: any) {
      setAuthError(err.message || "Ein technischer Fehler ist aufgetreten.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail) {
      toast({ variant: "destructive", title: "E-Mail fehlt", description: "Bitte geben Sie Ihre E-Mail Adresse ein." });
      return;
    }
    
    setIsForgotLoading(true);
    try {
      const res = await requestPasswordResetAction(forgotEmail);
      if (res.success) {
        setForgotSuccess(true);
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.message });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Systemfehler", description: "Dienst aktuell nicht erreichbar." });
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (!mounted || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary/20" />
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
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-wider">Plattform Login</CardTitle>
              <div className="px-2 py-0.5 text-[8px] font-bold uppercase border rounded-none border-primary/20 text-primary">
                {dataSource === 'mysql' ? 'Lokal' : dataSource === 'firestore' ? 'Cloud' : 'Demo'}
              </div>
            </div>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground/60">
              Identitätsprüfung via {dataSource === 'mysql' ? 'Lokale Datenbank' : 'Cloud Verzeichnis'}
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-5 pt-6">
              {authError && (
                <Alert variant="destructive" className="rounded-none border-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-[10px] font-bold uppercase">Anmeldefehler</AlertTitle>
                  <AlertDescription className="text-xs font-medium">{authError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">E-Mail Adresse</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@firma.de" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="rounded-none h-11 pl-10 border-muted-foreground/20 focus:border-primary transition-all" 
                    required
                  />
                </div>
              </div>

              {dataSource === 'mysql' && (
                <div className="space-y-2 animate-in slide-in-from-top-1">
                  <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••"
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="rounded-none h-11 pl-10 border-muted-foreground/20 focus:border-primary transition-all" 
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      className="text-[10px] font-bold uppercase text-primary hover:text-primary/80 transition-colors"
                      onClick={() => { setForgotSuccess(false); setForgotEmail(email); setIsForgotOpen(true); }}
                    >
                      Passwort vergessen?
                    </button>
                  </div>
                </div>
              )}
              
              <div className="p-3 bg-muted/30 border border-dashed text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-3 h-3 text-primary" />
                Sichere Verbindung aktiv
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col gap-3 pb-8">
              <Button 
                type="submit" 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-none font-bold uppercase text-xs tracking-widest transition-all shadow-lg shadow-primary/20" 
                disabled={isActionLoading}
              >
                {isActionLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                Systemzugang anfordern
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="rounded-none max-w-sm border-2">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wider">Passwort-Wiederherstellung</DialogTitle>
            <DialogDescription className="text-xs font-medium">
              {forgotSuccess 
                ? "Prüfen Sie Ihr Postfach auf weitere Instruktionen." 
                : "Geben Sie Ihre registrierte E-Mail Adresse ein."}
            </DialogDescription>
          </DialogHeader>
          
          {forgotSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <p className="text-[10px] text-center font-bold uppercase text-emerald-700">Anfrage erfolgreich versendet!</p>
              <Button variant="outline" className="rounded-none w-full font-bold uppercase text-[10px] h-10" onClick={() => setIsForgotOpen(false)}>Schließen</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Empfänger E-Mail</Label>
                <Input 
                  type="email" 
                  placeholder="admin@firma.de" 
                  value={forgotEmail} 
                  onChange={e => setForgotEmail(e.target.value)} 
                  className="rounded-none h-10" 
                />
              </div>
              <DialogFooter className="flex flex-col gap-2 pt-4">
                <Button 
                  className="w-full rounded-none font-bold uppercase text-[10px] h-11 gap-2" 
                  onClick={handleForgotSubmit} 
                  disabled={isForgotLoading}
                >
                  {isForgotLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Reset-Link anfordern
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full rounded-none font-bold uppercase text-[10px] h-10" 
                  onClick={() => setIsForgotOpen(false)}
                >
                  <ArrowLeft className="w-3 h-3 mr-2" /> Abbrechen
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
