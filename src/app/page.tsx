
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { initiateAnonymousSignIn, initiateEmailSignIn } from '@/firebase/non-blocking-login';
import { useSettings } from '@/context/settings-context';
import { authenticatePlatformUserAction } from '@/app/actions/mysql-actions';
import { requestPasswordResetAction } from '@/app/actions/smtp-actions';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { dataSource } = useSettings();
  
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
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    setAuthError(null);

    try {
      // Wenn MySQL aktiv ist und Zugangsdaten eingegeben wurden, prüfen wir erst gegen DB
      if (dataSource === 'mysql' && email && password) {
        const result = await authenticatePlatformUserAction(email, password);
        
        if (!result.success) {
          setAuthError(result.error || "Authentifizierung fehlgeschlagen.");
          setIsActionLoading(false);
          return;
        }
        
        toast({ title: "MySQL Login erfolgreich", description: `Willkommen, ${result.user.displayName}` });
        
        // Nach erfolgreichem DB-Check starten wir eine anonyme Firebase-Sitzung für die App-Infrastruktur
        await initiateAnonymousSignIn(auth);
      } else if (email && password) {
        // Standard Firebase E-Mail Login (für Firestore Mode)
        await initiateEmailSignIn(auth, email, password);
      } else {
        // Einfacher Gast-Zugang
        await initiateAnonymousSignIn(auth);
      }
    } catch (err: any) {
      setAuthError(err.message || "Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail) return;
    setIsForgotLoading(true);
    try {
      const res = await requestPasswordResetAction(forgotEmail);
      if (res.success) {
        setForgotSuccess(true);
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.message });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Fehler", description: "Verbindung zum Server fehlgeschlagen." });
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (isUserLoading || user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-0 left-0 p-8 flex items-center gap-2">
        <Shield className="w-8 h-8 text-primary" />
        <span className="text-2xl font-headline font-bold text-foreground">ComplianceHub</span>
      </div>
      <div className="w-full max-w-md">
        <Card className="border-none shadow-xl rounded-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-headline uppercase">Anmeldung</CardTitle>
            <CardDescription>
              {dataSource === 'mysql' 
                ? "Verifizierung über die MySQL-Plattformdatenbank." 
                : "Melden Sie sich an, um den ComplianceHub zu verwalten."}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {authError && (
                <Alert variant="destructive" className="rounded-none">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Fehler</AlertTitle>
                  <AlertDescription className="text-xs">{authError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase">E-Mail</Label>
                <Input id="email" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" title="Passwort" className="text-[10px] font-bold uppercase">Passwort</Label>
                  <button 
                    type="button" 
                    className="text-[10px] font-bold uppercase text-primary hover:underline"
                    onClick={() => { setForgotSuccess(false); setForgotEmail(email); setIsForgotOpen(true); }}
                  >
                    Passwort vergessen?
                  </button>
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-none" />
              </div>
              
              <div className="p-3 bg-muted/20 border text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-3 h-3" /> Aktiver Modus: {dataSource.toUpperCase()}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 rounded-none font-bold uppercase text-xs" disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                Anmelden
              </Button>
              <div className="relative w-full text-center">
                <span className="bg-background px-2 text-[10px] text-muted-foreground uppercase font-bold">Oder</span>
                <div className="absolute top-1/2 left-0 right-0 -z-10 h-px bg-border" />
              </div>
              <Button type="button" variant="outline" className="w-full rounded-none font-bold uppercase text-[10px]" onClick={() => initiateAnonymousSignIn(auth)} disabled={isActionLoading}>
                Anonym fortfahren (Demo)
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Passwort zurücksetzen</DialogTitle>
            <DialogDescription className="text-xs">
              {forgotSuccess 
                ? "Wir haben eine E-Mail an Sie versendet." 
                : "Geben Sie Ihre E-Mail Adresse ein, um einen Reset-Link zu erhalten."}
            </DialogDescription>
          </DialogHeader>
          
          {forgotSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-xs text-center font-bold uppercase">E-Mail wurde versendet!</p>
              <Button variant="outline" className="rounded-none w-full" onClick={() => setIsForgotOpen(false)}>Schließen</Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">E-Mail Adresse</Label>
                <Input 
                  type="email" 
                  placeholder="name@company.com" 
                  value={forgotEmail} 
                  onChange={e => setForgotEmail(e.target.value)} 
                  className="rounded-none" 
                />
              </div>
              <DialogFooter className="flex flex-col gap-2 sm:flex-col">
                <Button className="w-full rounded-none font-bold uppercase text-[10px] gap-2" onClick={handleForgotSubmit} disabled={isForgotLoading}>
                  {isForgotLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Reset-Link senden
                </Button>
                <Button variant="ghost" className="w-full rounded-none font-bold uppercase text-[10px] gap-2" onClick={() => setIsForgotOpen(false)}>
                  <ArrowLeft className="w-3 h-3" /> Abbrechen
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
