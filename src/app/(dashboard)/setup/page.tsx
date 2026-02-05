
"use client";

import { useState, useEffect } from 'react';
import { useSettings, DataSource } from '@/context/settings-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertTriangle
} from 'lucide-react';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { testMysqlConnectionAction, truncateDatabaseAreasAction } from '@/app/actions/mysql-actions';
import { runDatabaseMigrationAction } from '@/app/actions/migration-actions';
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
      <div className={cn("mt-2 text-[10px] font-bold uppercase", color)}>
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
  const { dataSource, setDataSource } = useSettings();
  const [currentSelection, setCurrentSelection] = useState(dataSource);
  const [isClearing, setIsClearing] = useState(false);
  
  const [cloudTest, setCloudTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mockTest, setMockTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mysqlTest, setMysqlTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [migrationResult, setMigrationResult] = useState<TestResult>({ status: 'idle', message: '' });

  useEffect(() => {
    setCurrentSelection(dataSource);
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
      toast({
        title: result.success ? "Erfolgreich" : "Fehlgeschlagen",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      const res = await truncateDatabaseAreasAction();
      if (res.success) {
        toast({ title: "Daten bereinigt", description: res.message });
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
    <div className="space-y-6">
        <div className="border-b pb-6">
            <h1 className="text-2xl font-bold tracking-tight">Setup & Infrastruktur</h1>
            <p className="text-sm text-muted-foreground">Zentrale Konfiguration der Datenquelle und Datenbanken.</p>
        </div>

      <Card className="rounded-none shadow-none border">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-widest">Aktive Plattform-Datenquelle</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <RadioGroup 
            value={currentSelection} 
            onValueChange={handleDataSourceChange}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* MySQL Option */}
            <div className={cn(
              "flex flex-col items-start space-y-4 border p-6 transition-all",
              currentSelection === 'mysql' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50 border-border'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="mysql" id="mysql" />
                <Label htmlFor="mysql" className="cursor-pointer">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Lokal (MySQL / SQL)</span>
                    <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">On-Premise (Empfohlen)</span>
                  </div>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">Nutzt Ihre eigene relationale SQL-Struktur für vollständige Datenkontrolle.</p>
              <div className="w-full space-y-3 pt-2">
                  <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleTestMysql(); }}>
                      <Database className="w-3.5 h-3.5 mr-2" /> Datenbank-Ping
                  </Button>
                  <TestResultDisplay result={mysqlTest} />
                  
                  <div className="pt-2 border-t">
                      <Button variant="secondary" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleRunMigration(); }}>
                          <GanttChartSquare className="w-3.5 h-3.5 mr-2" /> Initialisieren
                      </Button>
                      <TestResultDisplay result={migrationResult} />
                  </div>
              </div>
            </div>

            {/* Cloud Option */}
            <div className={cn(
              "flex flex-col items-start space-y-4 border p-6 transition-all",
              currentSelection === 'firestore' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50 border-border'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="firestore" id="firestore" />
                <Label htmlFor="firestore" className="cursor-pointer">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Zentral (Cloud Engine)</span>
                    <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Global Managed</span>
                  </div>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">Verwendet die globale Infrastruktur für mandantenübergreifende Koordination.</p>
              <div className="w-full pt-2">
                  <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleTestCloud(); }}>
                    <ShieldCheck className="w-3.5 h-3.5 mr-2" /> System-Test
                  </Button>
                  <TestResultDisplay result={cloudTest} />
              </div>
            </div>

            {/* Mock Option */}
            <div className={cn(
              "flex flex-col items-start space-y-4 border p-6 transition-all",
              currentSelection === 'mock' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50 border-border'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="mock" id="mock" />
                <Label htmlFor="mock" className="cursor-pointer">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Demo (Vorschau)</span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Statisch</span>
                  </div>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">Statische Beispieldaten für Präsentationen ohne echte Datenbankanbindung.</p>
              <div className="w-full pt-2">
                  <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleTestMock(); }}>
                    <Beaker className="w-3.5 h-3.5 mr-2" /> Laden
                  </Button>
                  <TestResultDisplay result={mockTest} />
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {currentSelection === 'mysql' && (
        <Card className="rounded-none shadow-none border border-red-100 bg-red-50/10">
          <CardHeader className="bg-red-50/30 border-b py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Datenpflege & Bereinigung
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="text-sm font-bold">Bestandsdaten leeren</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Löscht alle Kataloge, Risiken, Ressourcen und Zuweisungen. <br/>
                  <span className="font-bold text-red-600 uppercase text-[9px]">Achtung:</span> Benutzer und Systemeinstellungen bleiben erhalten.
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="rounded-none font-bold uppercase text-[10px] px-8 h-10 shadow-lg">
                    Datenbank Leeren
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-none border-2">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" /> Sind Sie absolut sicher?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs leading-relaxed">
                      Diese Aktion löscht unwiderruflich alle im System erfassten:
                      <ul className="list-disc list-inside mt-2 space-y-1 font-bold">
                        <li>Importierten Kataloge & Gefährdungen</li>
                        <li>Risikoinventare & Maßnahmenpläne</li>
                        <li>Ressourcen & Rollendefinitionen</li>
                        <li>Aktiven und historischen Zuweisungen</li>
                        <li>Audit-Logs</li>
                      </ul>
                      <p className="mt-4 italic">Hub-Administratoren, IAM-Nutzer und technische Konfigurationen werden NICHT gelöscht.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-none uppercase text-[10px] font-bold">Abbrechen</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleClearDatabase} 
                      className="bg-red-600 hover:bg-red-700 rounded-none text-[10px] font-bold uppercase"
                      disabled={isClearing}
                    >
                      {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                      Bereinigung Durchführen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="p-4 bg-muted/20 border text-[10px] font-bold uppercase text-muted-foreground">
        Hinweis: Die Datenquelle bestimmt, wie Identitäten und Zuweisungen gespeichert werden. MySQL ist die empfohlene Konfiguration für lokale Installationen.
      </div>
    </div>
  );
}
