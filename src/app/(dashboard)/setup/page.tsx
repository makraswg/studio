
"use client";

import { useState, useEffect } from 'react';
import { useSettings, DataSource } from '@/context/settings-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Beaker, 
  Database, 
  GanttChartSquare, 
  ShieldCheck, 
  Trash2,
  AlertTriangle,
  Sparkles,
  Zap,
  Building2,
  Shield,
  ArrowRight,
  Mail,
  Lock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { testMysqlConnectionAction, truncateDatabaseAreasAction } from '@/app/actions/mysql-actions';
import { runDatabaseMigrationAction, checkSystemStatusAction } from '@/app/actions/migration-actions';
import { seedDemoDataAction } from '@/app/actions/demo-actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePlatformAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

type TestResult = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  details?: string[];
};

const TestResultDisplay = ({ result }: { result: TestResult }) => {
  if (result.status === 'idle') return null;

  const icon = {
    loading: <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />,
    success: <CheckCircle className="w-3.5 h-3.5 mr-2" />,
    error: <XCircle className="w-3.5 h-3.5 mr-2" />,
  }[result.status];

  const color = {
    loading: 'text-muted-foreground',
    success: 'text-green-600',
    error: 'text-red-600',
  }[result.status];

  return (
      <div className={cn("mt-2 text-[10px] font-bold", color)}>
          <div className="flex items-center">
            {icon}
            <span>{result.message}</span>
          </div>
          {result.details && result.details.length > 0 && (
              <pre className="mt-2 p-2 bg-muted/50 border text-[9px] font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                  {result.details.join('\n')}
              </pre>
          )}
      </div>
  );
};

export default function SetupPage() {
  const router = useRouter();
  const { dataSource, setDataSource } = useSettings();
  const { user } = usePlatformAuth();
  const [currentSelection, setCurrentSelection] = useState(dataSource);
  const [isClearing, setIsClearing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [cloudTest, setCloudTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mockTest, setMockTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mysqlTest, setMysqlTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [migrationResult, setMigrationResult] = useState<TestResult>({ status: 'idle', message: '' });

  useEffect(() => {
    setCurrentSelection(dataSource);
    checkSystemStatusAction().then(res => setIsInitialized(res.initialized));
  }, [dataSource]);

  const handleTestCloud = async () => {
    setCloudTest({ status: 'loading', message: 'Zentralsystem-Verbindung wird geprüft...' });
    try {
      const { firestore } = initializeFirebase();
      const snap = await getDocs(collection(firestore, 'tenants'));
      setCloudTest({ status: 'success', message: `Verbindung ok (${snap.size} Mandanten gefunden)` });
    } catch (e: any) {
      setCloudTest({ status: 'error', message: `Fehler: ${e.message}` });
    }
  };

  const handleTestMock = () => {
    setMockTest({ status: 'loading', message: 'Lade statische Daten...' });
    setTimeout(() => {
      const users = getMockCollection('users');
      setMockTest({ status: 'success', message: `${users.length} Test-Nutzer geladen.` });
    }, 500);
  };

  const handleTestMysql = async () => {
    setMysqlTest({ status: 'loading', message: 'MySQL-Verbindung wird getestet...' });
    const result = await testMysqlConnectionAction();
    setMysqlTest({ 
        status: result.success ? 'success' : 'error', 
        message: result.message 
    });
  };

  const handleRunMigration = async () => {
      setMigrationResult({ status: 'loading', message: 'Migration läuft...' });
      const result = await runDatabaseMigrationAction();
      setMigrationResult({ 
          status: result.success ? 'success' : 'error', 
          message: result.message,
          details: result.details
      });
      if (result.success) {
        setIsInitialized(true);
        toast({ title: "Initialisierung erfolgreich", description: "Sie können sich nun anmelden." });
      } else {
        toast({ variant: "destructive", title: "Fehler", description: result.message });
      }
  };

  const handleSeedDemoData = async () => {
    setIsSeeding(true);
    try {
      const res = await seedDemoDataAction(dataSource, user?.email || 'admin');
      if (res.success) {
        toast({ title: "Demo-Szenario aktiv", description: res.message });
      } else {
        toast({ variant: "destructive", title: "Fehler beim Seeding", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      const res = await truncateDatabaseAreasAction();
      if (res.success) {
        toast({ title: "Daten bereinigt", description: res.message });
        setIsInitialized(false);
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.message });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsClearing(false);
    }
  };

  const handleDataSourceChange = (value: DataSource) => {
    setDataSource(value);
    toast({ title: "Datenquelle geändert", description: `Die App nutzt nun ${value}.` });
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Hero for Unauthenticated Setup */}
      {!user && (
        <div className="flex flex-col items-center text-center space-y-6 pt-10 pb-10 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="w-20 h-20 bg-primary flex items-center justify-center rounded-[2rem] shadow-2xl shadow-primary/20 rotate-3">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-headline font-black text-slate-900 dark:text-white uppercase tracking-tight">ComplianceHub <span className="text-primary italic">Setup</span></h1>
            <p className="text-base text-slate-500 max-w-2xl font-medium">Willkommen bei der Ersteinrichtung Ihrer Governance-Plattform. Bitte wählen Sie Ihre Infrastruktur und initialisieren Sie die Datenbank.</p>
          </div>
        </div>
      )}

      {/* Page Title for Auth Users */}
      {user && (
        <div className="border-b pb-6">
            <h1 className="text-2xl font-headline font-bold tracking-tight text-slate-900">Setup & Infrastruktur</h1>
            <p className="text-sm text-slate-500">Zentrale Konfiguration der Datenquelle und Datenbanken.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Default Admin Info Card */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-slate-900 text-white overflow-hidden animate-in zoom-in-95 duration-500">
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-white/10 shadow-lg">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-headline font-black uppercase tracking-widest">Standard-Administrator</CardTitle>
                  <CardDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Sicherheits-Information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-6">
              <p className="text-sm text-slate-300 font-medium leading-relaxed">
                Bei der Initialisierung wird automatisch ein administrativer Zugang angelegt. Bitte nutzen Sie diese Daten für die erste Anmeldung und ändern Sie das Passwort umgehend.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary"><Mail className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">E-Mail Adresse</p>
                    <p className="text-xs font-bold font-mono truncate">admin@compliance-hub.local</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500"><Lock className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Passwort</p>
                    <p className="text-xs font-bold font-mono">admin123</p>
                  </div>
                </div>
              </div>
              {isInitialized && !user && (
                <Button className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-primary/20 gap-2 transition-all active:scale-95" onClick={() => router.push('/')}>
                  Jetzt Anmelden <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Aktive Plattform-Datenquelle</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <RadioGroup 
                value={currentSelection} 
                onValueChange={handleDataSourceChange}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* MySQL Option */}
                <div className={cn(
                  "flex flex-col items-start space-y-4 border-2 p-6 transition-all rounded-3xl relative overflow-hidden group",
                  currentSelection === 'mysql' ? 'border-primary bg-primary/5 ring-4 ring-primary/5' : 'hover:border-slate-200 border-slate-100 bg-white'
                )}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="mysql" id="mysql" />
                    <Label htmlFor="mysql" className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-tight">Lokal (MySQL)</span>
                        <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest italic">Self-Hosted</span>
                      </div>
                    </Label>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Relationale SQL-Struktur für vollständige Datenkontrolle On-Premise.</p>
                  <div className="w-full space-y-3 pt-2">
                      <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase h-9 rounded-xl border-slate-200" onClick={(e) => { e.preventDefault(); handleTestMysql(); }}>
                          <Database className="w-3.5 h-3.5 mr-2 text-primary" /> Verbindungstest
                      </Button>
                      <TestResultDisplay result={mysqlTest} />
                      
                      <div className="pt-2 border-t border-slate-100">
                          <Button variant="secondary" size="sm" className="w-full text-[10px] font-black uppercase h-10 rounded-xl bg-slate-900 text-white hover:bg-black gap-2 shadow-lg transition-all active:scale-95" onClick={(e) => { e.preventDefault(); handleRunMigration(); }}>
                              <GanttChartSquare className="w-4 h-4" /> Initialisieren
                          </Button>
                          <TestResultDisplay result={migrationResult} />
                      </div>
                  </div>
                </div>

                {/* Cloud Option */}
                <div className={cn(
                  "flex flex-col items-start space-y-4 border-2 p-6 transition-all rounded-3xl bg-white",
                  currentSelection === 'firestore' ? 'border-primary bg-primary/5 ring-4 ring-primary/5' : 'hover:border-slate-200 border-slate-100'
                )}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="firestore" id="firestore" />
                    <Label htmlFor="firestore" className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-tight">Zentral (Cloud)</span>
                        <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Global Managed</span>
                      </div>
                    </Label>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Verwendet die globale Firestore-Cloud für mandantenübergreifende Koordination.</p>
                  <div className="w-full pt-2">
                      <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase h-9 rounded-xl border-slate-200" onClick={(e) => { e.preventDefault(); handleTestCloud(); }}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-2 text-primary" /> System-Ping
                      </Button>
                      <TestResultDisplay result={cloudTest} />
                  </div>
                </div>

                {/* Mock Option */}
                <div className={cn(
                  "flex flex-col items-start space-y-4 border-2 p-6 transition-all rounded-3xl bg-white",
                  currentSelection === 'mock' ? 'border-primary bg-primary/5 ring-4 ring-primary/5' : 'hover:border-slate-200 border-slate-100'
                )}>
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="mock" id="mock" />
                    <Label htmlFor="mock" className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase tracking-tight">Demo (Statisch)</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sandboxed</span>
                      </div>
                    </Label>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Vorschau mit statischen Daten ohne echte Datenbankanbindung.</p>
                  <div className="w-full pt-2">
                      <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase h-9 rounded-xl border-slate-200" onClick={(e) => { e.preventDefault(); handleTestMock(); }}>
                        <Beaker className="w-3.5 h-3.5 mr-2 text-primary" /> Demo-Lauf
                      </Button>
                      <TestResultDisplay result={mockTest} />
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="rounded-[2rem] border shadow-xl bg-white overflow-hidden border-indigo-100">
            <CardHeader className="bg-indigo-50/50 border-b p-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Prototyping & Demo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-800">Demo-Szenario laden</p>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                  Füllt alle Module mit vernetzten Beispieldaten für eine Wohnungsbaugesellschaft (SAP, AD, Prozesse).
                </p>
              </div>
              <Button 
                onClick={handleSeedDemoData} 
                disabled={isSeeding || dataSource !== 'mysql'} 
                className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest gap-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 transition-all active:scale-95"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                Szenario generieren
              </Button>
              {dataSource !== 'mysql' && (
                <div className="flex items-center gap-2 text-[9px] font-black text-orange-600 uppercase bg-orange-50 p-2 rounded-lg border border-orange-100">
                  <AlertTriangle className="w-3 h-3" /> Nur im MySQL-Modus verfügbar
                </div>
              )}
            </CardContent>
          </Card>

          {currentSelection === 'mysql' && (
            <Card className="rounded-[2rem] border shadow-xl bg-white overflow-hidden border-red-100">
              <CardHeader className="bg-red-50/50 border-b p-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Datenpflege
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-800">Bestandsdaten leeren</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Löscht alle operativen Daten. Administratoren und Konfigurationen bleiben erhalten.
                  </p>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-100 transition-all active:scale-95">
                      Datenbank leeren
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8 bg-white">
                    <AlertDialogHeader>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center uppercase tracking-tight">System-Bereinigung</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs leading-relaxed font-medium text-slate-500 text-center" asChild>
                        <div className="space-y-4">
                          <p>Diese Aktion löscht unwiderruflich alle Identitäten, Zuweisungen, Risiken und Prozesse.</p>
                          <div className="p-4 bg-slate-50 rounded-2xl border text-left font-bold text-slate-700">
                            <ul className="list-disc list-inside space-y-1">
                              <li>IAM Benutzerverzeichnis</li>
                              <li>Risikoinventar & TOMs</li>
                              <li>Workflow-Register</li>
                              <li>Audit-Protokolle</li>
                            </ul>
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 sm:justify-center mt-6">
                      <AlertDialogCancel className="rounded-xl h-11 px-8 font-bold text-xs uppercase border-slate-200">Abbrechen</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleClearDatabase} 
                        className="bg-red-600 hover:bg-red-700 rounded-xl h-11 px-10 font-bold text-xs uppercase shadow-lg shadow-red-100"
                        disabled={isClearing}
                      >
                        {isClearing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Bereinigen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}

          <div className="p-6 bg-slate-100 rounded-[2rem] border border-slate-200 flex items-start gap-4">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-900 uppercase">Architektur-Hinweis</p>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium italic">
                Die Wahl der Datenquelle bestimmt die Revisionssicherheit. MySQL wird für produktive lokale Installationen dringend empfohlen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
