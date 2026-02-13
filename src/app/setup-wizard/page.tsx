'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ShieldCheck, 
  Shield,
  Database, 
  UserPlus, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Server, 
  AlertCircle,
  Zap,
  Lock,
  Mail,
  Building2,
  Info,
  Save
} from 'lucide-react';
import { 
  checkSystemStatusAction, 
  runDatabaseMigrationAction, 
  createInitialAdminAction 
} from '@/app/actions/migration-actions';
import { testMysqlConnectionAction } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type SetupStep = 'welcome' | 'db-test' | 'initialize' | 'admin' | 'complete';

export default function SetupWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [dbStatus, setDbStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [tenantName, setTenantName] = useState('Meine Organisation');

  useEffect(() => {
    setMounted(true);
    // Security check: If already initialized, redirect back to login
    checkSystemStatusAction().then(res => {
      if (res.initialized) router.push('/');
    }).catch(() => {});
  }, [router]);

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const res = await testMysqlConnectionAction();
      if (res.success) {
        setDbStatus('success');
        toast({ title: "Verbindung ok", description: res.message });
      } else {
        setDbStatus('error');
        toast({ variant: "destructive", title: "Verbindungsfehler", description: res.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunMigration = async () => {
    setIsLoading(true);
    try {
      const res = await runDatabaseMigrationAction();
      if (res.success) {
        setCurrentStep('admin');
        toast({ title: "Infrastruktur bereit", description: "Tabellen erfolgreich erstellt." });
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminName || !adminEmail || !adminPassword || !tenantName) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Felder ausfüllen." });
      return;
    }
    setIsLoading(true);
    try {
      const res = await createInitialAdminAction({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        tenantName
      });
      if (res.success) {
        setCurrentStep('complete');
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  const steps: SetupStep[] = ['welcome', 'db-test', 'initialize', 'admin', 'complete'];
  const progress = (steps.indexOf(currentStep) / (steps.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-primary/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-headline font-bold text-slate-900 uppercase tracking-tight">System Setup</h1>
          <div className="max-w-xs mx-auto space-y-2">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inbetriebnahme • Schritt {steps.indexOf(currentStep) + 1} von 5</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden transition-all duration-500">
          <ScrollArea className="max-h-[70vh]">
            <CardContent className="p-10">
              
              {currentStep === 'welcome' && (
                <div className="space-y-8 animate-in fade-in zoom-in-95">
                  <div className="space-y-4 text-center">
                    <h2 className="text-xl font-headline font-bold text-slate-800">Willkommen beim ComplianceHub</h2>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Die Datenbank ist noch nicht konfiguriert. Wir führen Sie nun in wenigen Schritten durch die Ersteinrichtung Ihrer Governance-Plattform.
                    </p>
                  </div>
                  <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm shrink-0">
                      <Zap className="w-5 h-5 fill-current" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase text-blue-900">Voraussetzung</p>
                      <p className="text-[11px] text-blue-700 font-medium leading-relaxed italic">
                        Stellen Sie sicher, dass ein MySQL Server erreichbar ist (Standard: 127.0.0.1:3307 oder via Docker).
                      </p>
                    </div>
                  </div>
                  <Button className="w-full h-12 rounded-2xl font-bold uppercase text-xs tracking-widest gap-2 shadow-lg shadow-primary/20" onClick={() => setCurrentStep('db-test')}>
                    Einrichtung starten <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {currentStep === 'db-test' && (
                <div className="space-y-8 animate-in slide-in-from-right-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-50"><Server className="w-6 h-6 text-slate-500" /></div>
                      <div>
                        <h3 className="text-lg font-headline font-bold text-slate-800">Infrastruktur-Check</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase">Verbindung zum MySQL Server prüfen</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Bevor wir die Tabellen anlegen können, müssen wir sicherstellen, dass die Datenbankverbindung stabil ist.
                    </p>
                  </div>

                  <div className={cn(
                    "p-6 rounded-3xl border-2 transition-all duration-500 flex flex-col items-center gap-4",
                    dbStatus === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : 
                    dbStatus === 'error' ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-100"
                  )}>
                    {dbStatus === 'success' ? <CheckCircle2 className="w-10 h-10" /> : <Database className="w-10 h-10 opacity-30" />}
                    <div className="text-center">
                      <p className="text-sm font-bold uppercase tracking-widest">
                        {dbStatus === 'success' ? 'Verbindung hergestellt' : 
                         dbStatus === 'error' ? 'Verbindung fehlgeschlagen' : 'Warten auf Test...'}
                      </p>
                    </div>
                    {dbStatus !== 'success' && (
                      <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={isLoading} className="rounded-xl h-10 px-8 font-black uppercase text-[10px]">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Test ausführen
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="ghost" className="rounded-xl font-bold text-[10px] uppercase" onClick={() => setCurrentStep('welcome')}>Zurück</Button>
                    <Button className="flex-1 rounded-xl font-bold uppercase text-[10px] h-11 shadow-lg" disabled={dbStatus !== 'success'} onClick={() => setCurrentStep('initialize')}>Weiter zur Initialisierung</Button>
                  </div>
                </div>
              )}

              {currentStep === 'initialize' && (
                <div className="space-y-8 animate-in slide-in-from-right-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner"><Database className="w-6 h-6" /></div>
                      <div>
                        <h3 className="text-lg font-headline font-bold text-slate-800">Schema-Initialisierung</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase">Tabellen & Strukturen anlegen</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Das System wird nun alle erforderlichen Tabellen für Benutzer, Ressourcen, Risiken und Prozesse in Ihrer MySQL-Datenbank erstellen.
                    </p>
                  </div>

                  <div className="p-8 bg-slate-900 text-white rounded-3xl space-y-6 shadow-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center"><Info className="w-5 h-5 text-primary" /></div>
                      <p className="text-[11px] text-slate-400 font-medium italic">Es werden keine bestehenden Daten gelöscht, lediglich fehlende Strukturen ergänzt.</p>
                    </div>
                    <Button onClick={handleRunMigration} disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-3 shadow-lg shadow-primary/20">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                      Infrastruktur ausrollen
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 'admin' && (
                <div className="space-y-8 animate-in slide-in-from-right-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm"><UserPlus className="w-6 h-6" /></div>
                      <div>
                        <h3 className="text-lg font-headline font-bold text-slate-800">Erster Administrator</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase">Haupt-Account erstellen</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      Legen Sie nun den ersten Super-Admin fest. Mit diesen Daten loggen Sie sich nach dem Setup ein.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vollständiger Name</Label>
                      <div className="relative group">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="z.B. Max Mustermann" className="h-12 pl-10 rounded-xl font-bold" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">E-Mail (Login-Benutzername)</Label>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@firma.de" className="h-12 pl-10 rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Passwort festlegen</Label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Sicheres Passwort..." className="h-12 pl-10 rounded-xl font-mono" />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-indigo-600 ml-1">Name der Organisation</Label>
                      <div className="relative group">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                        <Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="h-12 pl-10 rounded-xl border-indigo-100 bg-indigo-50/10 font-bold" />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleCreateAdmin} disabled={isLoading || !adminName || !adminPassword} className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-2 bg-slate-900 hover:bg-black text-white shadow-xl">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Account erstellen & Setup beenden
                  </Button>
                </div>
              )}

              {currentStep === 'complete' && (
                <div className="space-y-10 text-center animate-in zoom-in-95 duration-700">
                  <div className="space-y-4">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-100 animate-bounce">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-headline font-black text-slate-900 uppercase tracking-tight">System bereit!</h2>
                    <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto">
                      Der ComplianceHub wurde erfolgreich initialisiert. Sie können sich nun mit Ihren Zugangsdaten anmelden.
                    </p>
                  </div>

                  <div className="p-6 bg-slate-50 border rounded-3xl space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400">Ihr Zugang:</p>
                    <div className="font-mono text-xs font-bold text-slate-700">{adminEmail}</div>
                  </div>

                  <Button className="w-full h-12 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-primary/20" onClick={() => router.push('/')}>
                    Zum Login Dashboard
                  </Button>
                </div>
              )}

            </CardContent>
          </ScrollArea>
        </Card>

        {/* Footer Info */}
        <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
          <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> Secure Initializer</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span>V2.8 GRC Standard</span>
        </div>
      </div>
    </div>
  );
}
