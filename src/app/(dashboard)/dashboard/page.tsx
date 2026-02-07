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
  UserCircle,
  Table as TableIcon,
  TrendingUp,
  ArrowUpRight
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
import { Skeleton } from '@/components/ui/skeleton';
import { 
  exportFullComplianceReportPdf, 
  exportToExcel,
  exportUsersExcel,
  exportResourcesExcel
} from '@/lib/export-utils';
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
import { QuickTour, type TourStep } from '@/components/layout/quick-tour';

const riskData = [
  { name: 'Niedriges Risiko', value: 65, color: '#29ABE2' },
  { name: 'Mittleres Risiko', value: 25, color: '#FF9800' },
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
  const { data: tenants } = usePluggableCollection<any>('tenants');

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

  const handleExport = async (format: 'pdf' | 'excel', mode: 'user' | 'resource') => {
    setIsExporting(true);
    try {
      const { users: fUsers, resources: fResources, assignments: fAssignments } = filteredData;
      
      if (format === 'pdf') {
        await exportFullComplianceReportPdf(
          fUsers,
          fResources,
          entitlements || [],
          fAssignments,
          mode
        );
      } else {
        if (mode === 'user') {
          await exportUsersExcel(fUsers, tenants || []);
        } else {
          await exportResourcesExcel(fResources);
        }
      }
      
      toast({ 
        title: "Bericht erstellt", 
        description: `Der ${format.toUpperCase()}-Bericht wurde generiert.` 
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
    { id: 'stat-users', title: 'Benutzer', value: filteredData.users.length, icon: Users, label: 'Identitäten', color: 'text-blue-500', bg: 'bg-blue-500/10', loading: usersLoading },
    { id: 'stat-resources', title: 'Systeme', value: filteredData.resources.length, icon: Layers, label: 'Katalog', color: 'text-indigo-500', bg: 'bg-indigo-500/10', loading: resourcesLoading },
    { id: 'stat-assignments', title: 'Zugriffe', value: filteredData.assignments.filter((a: any) => a.status === 'active').length, icon: ShieldCheck, label: 'Aktiv', color: 'text-emerald-500', bg: 'bg-emerald-500/10', loading: assignmentsLoading },
    { id: 'stat-audits', title: 'Audits', value: auditLogs?.length || 0, icon: Activity, label: 'Journal', color: 'text-orange-500', bg: 'bg-orange-500/10', loading: auditLoading },
  ];

  const dashboardTour: TourStep[] = [
    {
      target: '#stat-users',
      title: 'Identitäts-Management',
      content: 'Hier behalten Sie den Überblick über alle Mitarbeiter und deren digitalen Fingerabdruck im Unternehmen.'
    },
    {
      target: '#campaign-progress',
      title: 'Compliance Kampagnen',
      content: 'Überwachen Sie laufende Zertifizierungs-Reviews. 68% der Identitäten wurden diesen Monat bereits geprüft.'
    },
    {
      target: '#risk-profile',
      title: 'Echtzeit Risiko-Analyse',
      content: 'Das System bewertet automatisch die Berechtigungs-Struktur und zeigt Ihnen kritische Konzentrationen von Rechten.'
    },
    {
      target: '#report-btn',
      title: 'Audit-Bereite Berichte',
      content: 'Exportieren Sie per Klick vollständige PDFs für Revisoren oder den Datenschutzbeauftragten.'
    }
  ];

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700 slide-in-from-bottom-4">
      <QuickTour tourId="dashboard-main" steps={dashboardTour} />

      {/* Header Section with subtle gradient */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">Overview</Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Status der Governance für {activeTenantId === 'all' ? 'die gesamte Organisation' : activeTenantId}.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            id="report-btn"
            variant="outline" 
            className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95" 
            onClick={() => setIsReportDialogOpen(true)}
          >
            <FileText className="w-4 h-4 mr-2 text-primary" />
            Compliance Reports
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} id={stat.id} className="group border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden hover:scale-[1.02] transition-all duration-300 active:scale-95">
            <CardContent className="p-6">
              {stat.loading ? (
                <div className="flex items-center gap-5">
                  <Skeleton className="w-14 h-14 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-8 w-12" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6", stat.bg, stat.color)}>
                    <stat.icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
                    <div className="flex items-baseline gap-1">
                      <h3 className="text-3xl font-headline font-bold text-slate-800 dark:text-slate-100">{stat.value}</h3>
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Chart/Progress Area */}
        <Card id="campaign-progress" className="xl:col-span-2 border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6 px-8 flex flex-row items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
            <div>
              <CardTitle className="text-lg font-headline font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Zertifizierungs-Kampagne</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Quartals-Review Q1/2024</p>
            </div>
            <Badge className="rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-none px-4 py-1 text-[10px] font-black uppercase">Laufend</Badge>
          </CardHeader>
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-8">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle className="text-slate-100 dark:text-slate-800" strokeWidth="8" stroke="currentColor" fill="transparent" r="58" cx="64" cy="64" />
                  <circle 
                    className="text-primary transition-all duration-1000 ease-out" 
                    strokeWidth="8" 
                    strokeDasharray={364.4} 
                    strokeDashoffset={364.4 * (1 - 0.68)} 
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="58" cx="64" cy="64" 
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-headline font-bold">68%</span>
                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Progress</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 transition-all hover:bg-white hover:shadow-lg group">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Offene Prüfungen</p>
                  <p className="text-3xl font-headline font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">142</p>
                </div>
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 transition-all hover:bg-white hover:shadow-lg group">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Abgeschlossen</p>
                  <p className="text-3xl font-headline font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-500 transition-colors">312</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-slate-500">Compliance Zielerreichung</span>
                <span className="text-primary">85% geplant</span>
              </div>
              <Progress value={68} className="h-3 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
          </CardContent>
        </Card>

        {/* Risk Profile Card */}
        <Card id="risk-profile" className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6 px-8 bg-slate-50/50 dark:bg-slate-950/50">
            <CardTitle className="text-lg font-headline font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Risiko-Profil</CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Identitäts-Risiken</p>
          </CardHeader>
          <CardContent className="p-8 flex-1 flex flex-col items-center justify-center">
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={riskData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={70} 
                    outerRadius={95} 
                    paddingAngle={8} 
                    dataKey="value" 
                    stroke="none"
                  >
                    {riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} cornerRadius={10} />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <ShieldAlert className="w-8 h-8 text-slate-200 dark:text-slate-700 mb-1 animate-pulse" />
                <span className="text-[10px] font-black uppercase text-slate-400">Status</span>
              </div>
            </div>
            <div className="w-full space-y-3 mt-8">
              {riskData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">{item.value}%</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="rounded-[2.5rem] max-w-2xl bg-white dark:bg-slate-900 p-0 border-none shadow-2xl overflow-hidden">
          <DialogHeader className="p-8 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
            <DialogTitle className="text-xl font-headline font-bold uppercase text-slate-800 dark:text-white">Compliance Berichte</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Wählen Sie den Fokus des detaillierten Audit-Berichts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Identitäten (IAM)</h4>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-16 rounded-3xl border-slate-100 dark:border-slate-800 hover:border-primary/20 hover:bg-primary/5 transition-all gap-4 active:scale-95"
                  onClick={() => handleExport('pdf', 'user')}
                  disabled={isExporting}
                >
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">Mitarbeiter PDF</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Audit-Ready</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-16 rounded-3xl border-slate-100 dark:border-slate-800 hover:border-emerald-500/20 hover:bg-emerald-50/50 transition-all gap-4 active:scale-95"
                  onClick={() => handleExport('excel', 'user')}
                  disabled={isExporting}
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <TableIcon className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">Benutzerliste</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Excel Format</p>
                  </div>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Systeme (Assets)</h4>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-16 rounded-3xl border-slate-100 dark:border-slate-800 hover:border-primary/20 hover:bg-primary/5 transition-all gap-4 active:scale-95"
                  onClick={() => handleExport('pdf', 'resource')}
                  disabled={isExporting}
                >
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">System Bericht</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">PDF Katalog</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-16 rounded-3xl border-slate-100 dark:border-slate-800 hover:border-emerald-500/20 hover:bg-emerald-50/50 transition-all gap-4 active:scale-95"
                  onClick={() => handleExport('excel', 'resource')}
                  disabled={isExporting}
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <TableIcon className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">Ressourcenkatalog</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Excel Format</p>
                  </div>
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-8 mb-8 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200">Mandanten-Fokus</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider leading-relaxed">
                Der Bericht wird exklusiv für <span className="text-primary">{activeTenantId === 'all' ? 'ALLE MANDANTEN' : activeTenantId}</span> generiert.
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
            <Button 
              variant="ghost" 
              onClick={() => setIsReportDialogOpen(false)} 
              className="rounded-xl text-[10px] font-black uppercase h-11 px-8"
            >
              Abbrechen
            </Button>
            {isExporting && (
              <div className="flex items-center gap-3 text-[10px] font-black uppercase text-primary animate-pulse pr-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Export läuft...
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
