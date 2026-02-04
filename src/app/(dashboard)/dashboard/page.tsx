
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
  PieChart, 
  Pie, 
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { exportFullComplianceReportPdf } from '@/lib/export-utils';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { useSettings } from '@/context/settings-context';
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
  const { activeTenantId } = useSettings();

  const { data: users, isLoading: usersLoading } = usePluggableCollection<any>('users');
  const { data: resources, isLoading: resourcesLoading } = usePluggableCollection<any>('resources');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: assignments, isLoading: assignmentsLoading } = usePluggableCollection<any>('assignments');
  const { data: auditLogs, isLoading: auditLoading } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    if (!users || !resources || !assignments) return { users: [], resources: [], assignments: [] };
    
    const fUsers = activeTenantId === 'all' ? users : users.filter((u: any) => u.tenantId === activeTenantId);
    const fResources = activeTenantId === 'all' ? resources : resources.filter((r: any) => r.tenantId === activeTenantId || r.tenantId === 'global' || !r.tenantId);
    const userIds = new Set(fUsers.map((u: any) => u.id));
    const fAssignments = assignments.filter((a: any) => userIds.has(a.userId));

    return { users: fUsers, resources: fResources, assignments: fAssignments };
  }, [users, resources, assignments, activeTenantId]);

  const handleExport = async (mode: 'user' | 'resource') => {
    setIsExporting(true);
    try {
      const { users: fUsers, resources: fResources, assignments: fAssignments } = filteredData;
      
      await exportFullComplianceReportPdf(
        fUsers,
        fResources,
        entitlements || [],
        fAssignments,
        mode
      );
      
      toast({ 
        title: "Bericht erstellt", 
        description: `Der PDF-Bericht (nach ${mode === 'user' ? 'Benutzern' : 'Systemen'}) wurde generiert.` 
      });
      setIsReportDialogOpen(false);
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Export fehlgeschlagen", 
        description: e.message 
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!mounted) return null;

  const stats = [
    { title: 'Benutzer', value: filteredData.users.length, icon: Users, label: 'Identitäten', color: 'text-blue-600', bg: 'bg-blue-50', loading: usersLoading },
    { title: 'Systeme', value: filteredData.resources.length, icon: Layers, label: 'Katalog', color: 'text-indigo-600', bg: 'bg-indigo-50', loading: resourcesLoading },
    { title: 'Zugriffe', value: filteredData.assignments.filter((a: any) => a.status === 'active').length, icon: ShieldCheck, label: 'Aktiv', color: 'text-emerald-600', bg: 'bg-emerald-50', loading: assignmentsLoading },
    { title: 'Audits', value: auditLogs?.length || 0, icon: Activity, label: 'Journal', color: 'text-orange-600', bg: 'bg-orange-50', loading: auditLoading },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ComplianceHub Konsole</h1>
          <p className="text-sm text-muted-foreground">Übersicht für {activeTenantId === 'all' ? 'die gesamte IT-Landschaft' : activeTenantId}.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 font-bold uppercase text-[10px] rounded-none border-primary/20 hover:bg-primary/5" 
            onClick={() => setIsReportDialogOpen(true)}
          >
            <FileText className="w-3.5 h-3.5 mr-2 text-primary" />
            Compliance Bericht
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-none rounded-none border">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-2 rounded-sm", stat.bg, stat.color)}><stat.icon className="w-4 h-4" /></div>
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  {stat.loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />
                  ) : (
                    <h3 className="text-2xl font-bold">{stat.value}</h3>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-none rounded-none border">
          <CardHeader className="border-b bg-muted/10 py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Zertifizierungs-Kampagne (Q1/2024)</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-3xl font-bold">68%</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Gesamtfortschritt der Reviews</p>
              </div>
              <Badge className="rounded-none bg-blue-600 uppercase text-[9px] px-3">Laufend</Badge>
            </div>
            <Progress value={68} className="h-2 rounded-none bg-slate-100" />
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="p-4 border bg-muted/5">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Offene Prüfungen</p>
                <p className="text-xl font-bold">142</p>
              </div>
              <div className="p-4 border bg-muted/5">
                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Abgeschlossen</p>
                <p className="text-xl font-bold">312</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none rounded-none border">
          <CardHeader className="border-b bg-muted/10 py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Risiko-Profil</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={riskData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={5} 
                    dataKey="value" 
                    stroke="none"
                  >
                    {riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-2 mt-4">
              {riskData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-[10px] font-bold uppercase">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span>{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Compliance Bericht generieren</DialogTitle>
            <DialogDescription className="text-xs">
              Wählen Sie das Format und die Gruppierung für den detaillierten Audit-Bericht.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4 py-4">
            <Button
              variant="outline"
              className="justify-start h-16 rounded-none border-primary/20 hover:border-primary hover:bg-primary/5 gap-4"
              onClick={() => handleExport('user')}
              disabled={isExporting}
            >
              <div className="p-2 bg-primary/10 rounded-sm">
                <UserCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase">PDF: Nach Benutzern</p>
                <p className="text-[10px] text-muted-foreground">Alle aktiven Zugriffe pro Mitarbeiter aufgelistet.</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-16 rounded-none border-primary/20 hover:border-primary hover:bg-primary/5 gap-4"
              onClick={() => handleExport('resource')}
              disabled={isExporting}
            >
              <div className="p-2 bg-primary/10 rounded-sm">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase">PDF: Nach Ressourcen</p>
                <p className="text-[10px] text-muted-foreground">Alle berechtigten Personen pro IT-System.</p>
              </div>
            </Button>
          </div>

          <div className="p-3 bg-muted/20 border text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Bericht wird für Mandant: {activeTenantId === 'all' ? 'ALLE' : activeTenantId} erstellt.
          </div>

          <DialogFooter className="mt-4">
            <Button 
              variant="ghost" 
              onClick={() => setIsReportDialogOpen(false)} 
              className="rounded-none text-[10px] font-bold uppercase h-10"
            >
              Abbrechen
            </Button>
            {isExporting && (
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Wird generiert...
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
