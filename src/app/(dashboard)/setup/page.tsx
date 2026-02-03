
"use client";

import { useState, useEffect } from 'react';
import { useSettings, DataSource } from '@/context/settings-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Beaker, Database, GanttChartSquare } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { testMysqlConnectionAction } from '@/app/actions/mysql-actions';
import { runDatabaseMigrationAction } from '@/app/actions/migration-actions'; // Import der neuen Aktion
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type TestResult = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  details?: string[];
};

// Hilfskomponente zur Anzeige der Testergebnisse
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
      <div className={cn("mt-2 text-xs font-medium", color)}>
          <div className="flex items-center">
            {icon}
            <span>{result.message}</span>
          </div>
          {result.details && result.details.length > 0 && (
              <pre className="mt-2 p-2 bg-muted/50 rounded-md text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                  {result.details.join('\n')}
              </pre>
          )}
      </div>
  );
};

export default function SetupPage() {
  const { dataSource, setDataSource } = useSettings();
  const [currentSelection, setCurrentSelection] = useState(dataSource);
  useEffect(() => {
    setCurrentSelection(dataSource);
  }, [dataSource]);

  const [firestoreTest, setFirestoreTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mockTest, setMockTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [mysqlTest, setMysqlTest] = useState<TestResult>({ status: 'idle', message: '' });
  const [migrationResult, setMigrationResult] = useState<TestResult>({ status: 'idle', message: '' }); // Zustand für das Migrationsergebnis

  const db = useFirestore();

  const handleTestFirestore = async () => {
    // ... (unverändert)
  };

  const handleTestMock = () => {
    // ... (unverändert)
  };

  const handleTestMysql = async () => {
    setMysqlTest({ status: 'loading', message: 'MySQL-Verbindung wird getestet...' });
    const result = await testMysqlConnectionAction();
    setMysqlTest({ 
        status: result.success ? 'success' : 'error', 
        message: result.message 
    });
  };

  // NEUER HANDLER für die Migration
  const handleRunMigration = async () => {
      setMigrationResult({ status: 'loading', message: 'Datenbank-Migration wird ausgeführt...\nDas kann einen Moment dauern.' });
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
  };

  return (
    <div className="space-y-6">
        <div className="border-b pb-6">
            <h1 className="text-2xl font-bold tracking-tight">Setup & Konfiguration</h1>
            <p className="text-sm text-muted-foreground">Konfigurieren Sie die Datenquelle der Anwendung und testen Sie die Verbindungen.</p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Datenquelle</CardTitle>
          <CardDescription>
            Wählen Sie aus, welche Datenquelle die Anwendung verwenden soll. Die Tests helfen Ihnen bei der Konfiguration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={currentSelection} 
            onValueChange={handleDataSourceChange}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* ... Firestore- und Mock-Optionen (unverändert) ... */}
            
            {/* MySQL Option */}
            <Label htmlFor="mysql" className={cn(
              "flex flex-col items-start space-y-2 border rounded-md p-4 cursor-pointer transition-colors",
              currentSelection === 'mysql' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            )}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mysql" id="mysql" />
                <div className="flex flex-col">
                  <span className="font-bold text-sm">MySQL-Datenbank</span>
                  <span className="text-xs font-mono text-muted-foreground">Experimentell</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pl-6">Verwendet eine relationale MySQL-Datenbank via `.env.local`.</p>
              <div className="pl-6 pt-2 w-full space-y-4">
                  <div>
                      <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); handleTestMysql(); }}>
                          <Database className="w-3.5 h-3.5 mr-2" />
                          Verbindung testen
                      </Button>
                      <TestResultDisplay result={mysqlTest} />
                  </div>
                  <div className='border-t pt-4'>
                      <Button variant="secondary" size="sm" onClick={(e) => { e.preventDefault(); handleRunMigration(); }}>
                          <GanttChartSquare className="w-3.5 h-3.5 mr-2" />
                          DB initialisieren / migrieren
                      </Button>
                      <TestResultDisplay result={migrationResult} />
                  </div>
              </div>
            </Label>

          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
