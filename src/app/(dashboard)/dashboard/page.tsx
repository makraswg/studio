"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Layers, 
  ShieldCheck, 
  Activity, 
  RefreshCw,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  ExternalLink,
  ShieldAlert,
  FileText,
  UserCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { exportComplianceReportPdf, exportFullComplianceReportPdf } from '@/lib/export-utils';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

const riskData = [
  { name: 'Niedriges Risiko', value: 65, color: '#3b82f6' },
  { name: 'Mittleres Risiko', value: 25, color: '#f59e0b' },
  { name: 'Hohes Risiko', value: 10, color: '#ef4444' },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  const { data: users, isLoading: usersLoading } = usePluggableCollection<any>('users');
  const { data: resources, isLoading: resourcesLoading } = usePluggableCollection<any>('resources');
  const { data: entitlements, isLoading: entitlementsLoading } = usePluggableCollection<any>('entitlements');
  const { data: assignments, isLoading: assignmentsLoading } = usePluggableCollection<any>('assignments');
  const { data: auditLogs, isLoading: auditLoading } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExportFull = async (mode: 'user' | 'resource') => {
    if (!users || !resources || !assignments || !entitlements) {
      toast({ variant: "destructive", title: "Daten fehlen", description: "Bitte warten Sie, bis alle Daten geladen sind." });
      return;
    }
    
    setIsExporting(true);
    setIsReportDialogOpen(false);
    try {
      await exportFullComplianceReportPdf(users, resources, entitlements, assignments, mode);
      toast({ title: "Bericht erstellt", description: `Der Compliance Bericht nach ${mode === 'user' ? 'Benutzern' : 'Ressourcen'} wurde generiert.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Fehler", description: "Bericht konnte nicht erstellt werden." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSync = () => {
    toast({ title: "Synchronisierung gestartet", description: "Der Abgleich mit dem LDAP-Verzeichnis läuft im Hintergrund." });
  };

  if (!mounted) return null;

  const stats = [
    { title: 'Benutzer', value: users?.length || 0, icon: Users, label: 'Identitäten', color: 'text-blue-600', bg: 'bg-blue-50', loading: usersLoading },
    { title: 'Systeme', value: resources?.length || 0, icon: Layers, label: 'Katalog', color: 'text-indigo-600', bg: 'bg-indigo-50', loading: resourcesLoading },
    { title: 'Zugriffe', value: assignments?.filter(a => a.status === 'active').length || 0, icon: ShieldCheck, label: 'Aktiv', color: 'text-emerald-600', bg: 'bg-emerald-50', loading: assignmentsLoading },
    { title: 'Audits', value: auditLogs?.length || 0, icon: Activity, label: 'Journal', color: 'text-orange-600', bg: 'bg-orange-50', loading: auditLoading },
  ];

  const totalAssignments = assignments?.length || 0;
  const reviewedAssignments = assignments?.filter(a => !!a.lastReviewedAt).length || 0;
  const reviewProgress = totalAssignments > 0 ? Math.round((reviewedAssignments / totalAssignments) * 100) : 0;

  const expiredWithoutTicketCount = assignments?.filter(a => 
    a.status === 'active' && 
    a.validUntil && 
    new Date(a.validUntil) < new Date() && 
    !a.jiraIssueKey
  ).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ComplianceHub Konsole</h1>
          <p className="text-sm text-muted-foreground">Operative Übersicht der Identitäts- und Zugriffsumgebung.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 font-bold uppercase text-[10px]"
            onClick={() => setIsReportDialogOpen(true)}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Activity className="w-3 h-3 mr-2" />}
            Compliance Bericht
          </Button>
          <Button 
            size="sm" 
            className="h-9 font-bold uppercase text-[10px]"
            onClick={handleSync}
          >
            <RefreshCw className="w-3 h-3 mr-2" /> Synchronisierung
          </Button>
        </div>
      </div>

      {expiredWithoutTicketCount > 0 && (
        <Alert variant="destructive" className="rounded-none border-red-200 bg-red-50/50">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold uppercase">Compliance Risiko erkannt</AlertTitle>
          <AlertDescription className="text-[11px] flex items-center justify-between mt-1">
            <span>Es gibt {expiredWithoutTicketCount} abgelaufene Zuweisungen ohne Dokumentation (Jira Ticket). Bitte prüfen Sie diese umgehend.</span>
            <Button variant="link" className="h-auto p-0 text-[10px] font-bold uppercase" asChild>
              <Link href="/assignments">Zu den Zuweisungen <ChevronRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-none rounded-none border">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-sm", stat.bg, stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    {stat.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <h3 className="text-2xl font-bold">{stat.value}</h3>}
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{stat.title}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-none rounded-none border overflow-hidden">
          <CardHeader className="border-b bg-muted/10 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Aktive Review-Kampagne (Q3)</CardTitle>
            <Badge className="rounded-none bg-blue-600">IN BEARBEITUNG</Badge>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <p className="text-3xl font-bold">{reviewProgress}%</p>
                <p className="text-xs text-muted-foreground">Abschlussrate</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-600 flex items-center justify-end gap-1">
                   {assignments?.filter(a => {
                     if (!a.grantedAt || a.status === 'removed') return false;
                     return ((new Date().getTime() - new Date(a.grantedAt).getTime()) / 86400000) > 90 && !a.lastReviewedAt;
                   }).length || 0} Kritisch
                </p>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Ausstehende Prüfung</p>
              </div>
            </div>
            <Progress value={reviewProgress} className="h-2 rounded-none bg-slate-100" />
            <div className="mt-8 grid grid-cols-3 gap-4 border-t pt-6">
              <div className="text-center border-r">
                <p className="text-lg font-bold">{totalAssignments}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Gesamt-Items</p>
              </div>
              <div className="text-center border-r">
                <p className="text-lg font-bold text-emerald-600">{reviewedAssignments}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Zertifiziert</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-orange-600">{assignments?.filter(a => a.status === 'requested').length || 0}</p>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Offene Anfragen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none rounded-none border">
          <CardHeader className="border-b bg-muted/10 py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Risiko-Profil</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                    {riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {riskData.map(item => (
                <div key={item.name} className="flex items-center justify-between text-[10px] font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-none" style={{backgroundColor: item.color}} />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-muted-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none rounded-none border overflow-hidden">
        <CardHeader className="border-b bg-muted/10 py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-widest">Letzte Aktivitäten</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold uppercase" asChild>
            <a href="/audit">Gesamtes Journal <ChevronRight className="ml-1 w-3 h-3" /></a>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {auditLogs?.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-center justify-between p-4 hover:bg-muted/5 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                    {log.action.includes('Zertifizierung') ? <CheckCircle2 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{log.action}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{log.actorUid} • {log.entityType} ({log.entityId})</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase">{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : 'Jetzt'}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[10px] font-bold uppercase tracking-widest">Compliance-Bericht generieren</DialogTitle>
            <DialogDescription className="text-xs">Wählen Sie die gewünschte Struktur für den Zuweisungs-Export.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-6">
            <Button 
              variant="outline" 
              className="h-16 rounded-none flex items-center justify-start gap-4 hover:bg-primary/5 hover:border-primary transition-all group"
              onClick={() => handleExportFull('user')}
            >
              <div className="p-2 bg-blue-50 text-blue-600 rounded-sm group-hover:bg-blue-100"><UserCircle className="w-6 h-6" /></div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase">Nach Benutzern</p>
                <p className="text-[10px] text-muted-foreground">Struktur: Mitarbeiter -> Berechtigungen</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-16 rounded-none flex items-center justify-start gap-4 hover:bg-primary/5 hover:border-primary transition-all group"
              onClick={() => handleExportFull('resource')}
            >
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-sm group-hover:bg-indigo-100"><Layers className="w-6 h-6" /></div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase">Nach Ressourcen</p>
                <p className="text-[10px] text-muted-foreground">Struktur: System -> Berechtigte Personen</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)} className="rounded-none h-10 px-8 text-[10px] font-bold uppercase">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
