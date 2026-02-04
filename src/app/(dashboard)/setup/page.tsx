"use client";

import { useState, useEffect } from 'react';
import { useSettings, DataSource } from '@/context/settings-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Beaker, Database, GanttChartSquare, ShieldCheck } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { testMysqlConnectionAction } from '@/app/actions/mysql-actions';
import { runDatabaseMigrationAction } from '@/app/actions/migration-actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  
  const [firestoreTest, setFirestoreTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mockTest, setMockTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mysqlTest, setMysqlTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [migrationResult, setMigrationResult] = useState<TestResult>({ status: 'idle', message: '' });

  const db = useFirestore();

  useEffect(() => {
    setCurrentSelection(dataSource);
  }, [dataSource]);

  const handleTestFirestore = async () => {
    setFirestoreTest({ status: 'loading', message: 'Cloud-Verbindung wird geprüft...' });
    try {
      const snap = await getDocs(collection(db, 'tenants'));
      setFirestoreTest({ status: 'success', message: `Verbindung ok (${snap.size} Mandanten gefunden)` });
    } catch (e: any) {
      setFirestoreTest({ status: 'error', message: `Fehler: ${e.message}` });
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
        title: result.success ? "Migration erfolgreich" : "Migration fehlgeschlagen",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
  };

  const handleDataSourceChange = (value: DataSource) => {
    setDataSource(value);
    toast({ title: "Datenquelle geändert", description: `Die App nutzt nun ${value}.` });
  };

  return (
    <div className="space-y-6">
        <div className="border-b pb-6">
            <h1 className="text-2xl font-bold tracking-tight">Setup & Konfiguration</h1>
            <p className="text-sm text-muted-foreground">Konfigurieren Sie die Datenquelle der Anwendung und testen Sie die Verbindungen.</p>
        </div>

      <Card className="rounded-none shadow-none border">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-xs font-bold uppercase tracking-widest">Datenquellen-Management</CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
            Wählen Sie aus, welche Datenbank die Anwendung verwenden soll.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <RadioGroup 
            value={currentSelection} 
            onValueChange={handleDataSourceChange}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Firestore Option */}
            <Label htmlFor="firestore" className={cn(
              "flex flex-col items-start space-y-4 border p-6 cursor-pointer transition-all",
              currentSelection === 'firestore' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50 border-border'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="firestore" id="firestore" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Cloud Datenbank (Zentral)</span>
                  <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Managed Service</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Verwendet die skalierbare NoSQL-Zentralinstanz für globale Koordination.</p>
              <div className="w-full pt-2">
                  <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleTestFirestore(); }}>
                    <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Cloud-Test
                  </Button>
                  <TestResultDisplay result={firestoreTest} />
              </div>
            </Label>

            {/* Mock Option */}
            <Label htmlFor="mock" className={cn(
              "flex flex-col items-start space-y-4 border p-6 cursor-pointer transition-all",
              currentSelection === 'mock' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50 border-border'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="mock" id="mock" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">Offline-Vorschau</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Demo Modus</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Statische Beispieldaten für schnelle Präsentationen ohne Internetverbindung.</p>
              <div className="w-full pt-2">
                  <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleTestMock(); }}>
                    <Beaker className="w-3.5 h-3.5 mr-2" /> Lokal-Test
                  </Button>
                  <TestResultDisplay result={mockTest} />
              </div>
            </Label>

            {/* MySQL Option */}
            <Label htmlFor="mysql" className={cn(
              "flex flex-col items-start space-y-4 border p-6 cursor-pointer transition-all",
              currentSelection === 'mysql' ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50 border-border'
            )}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="mysql" id="mysql" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">MySQL (Self-Hosted)</span>
                  <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">On-Premise</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Verwendet Ihre eigene relationale SQL-Struktur für volle Datenhoheit.</p>
              <div className="w-full space-y-3 pt-2">
                  <Button variant="outline" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleTestMysql(); }}>
                      <Database className="w-3.5 h-3.5 mr-2" /> DB-Ping
                  </Button>
                  <TestResultDisplay result={mysqlTest} />
                  
                  <div className="pt-2 border-t">
                      <Button variant="secondary" size="sm" className="w-full text-[10px] font-bold uppercase h-8 rounded-none" onClick={(e) => { e.preventDefault(); handleRunMigration(); }}>
                          <GanttChartSquare className="w-3.5 h-3.5 mr-2" /> Initialisieren
                      </Button>
                      <TestResultDisplay result={migrationResult} />
                  </div>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="p-4 bg-muted/20 border text-[10px] font-bold uppercase text-muted-foreground">
        Hinweis: Ein Wechsel der Datenquelle während einer Sitzung aktualisiert die Ansicht sofort. Daten werden nicht automatisch zwischen Quellen migriert.
      </div>
    </div>
  );
}
