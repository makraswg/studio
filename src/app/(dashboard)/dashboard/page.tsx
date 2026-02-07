"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  ArrowUpRight,
  Zap,
  Sparkles,
  Search,
  BrainCircuit,
  ArrowRight,
  TrendingDown,
  Info,
  CalendarCheck,
  ClipboardList,
  Target,
  Clock
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  exportFullComplianceReportPdf, 
  exportUsersExcel,
  exportResourcesExcel
} from '@/lib/export-utils';
import { toast } from '@/hooks/use-toast';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const { activeTenantId } = useSettings();

  const { data: users, isLoading: usersLoading } = usePluggableCollection<any>('users');
  const { data: resources, isLoading: resourcesLoading } = usePluggableCollection<any>('resources');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: assignments, isLoading: assignmentsLoading } = usePluggableCollection<any>('assignments');
  const { data: auditLogs, isLoading: auditLoading } = usePluggableCollection<any>('auditEvents');
  const { data: risks, isLoading: risksLoading } = usePluggableCollection<any>('risks');
  const { data: tenants } = usePluggableCollection<any>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    if (!users || !resources || !assignments) return { users: [], resources: [], assignments: [], risks: [] };
    
    const fUsers = activeTenantId === 'all' ? users : users.filter((u: any) => u.tenantId === activeTenantId);
    const fResources = activeTenantId === 'all' ? resources : resources.filter((r: any) => r.tenantId === activeTenantId || r.tenantId === 'global' || !r.tenantId);
    const fRisks = risks?.filter((r: any) => activeTenantId === 'all' || r.tenantId === activeTenantId) || [];
    const userIds = new Set(fUsers.map((u: any) => u.id));
    const fAssignments = assignments.filter((a: any) => userIds.has(a.userId));

    return { users: fUsers, resources: fResources, assignments: fAssignments, risks: fRisks };
  }, [users, resources, assignments, risks, activeTenantId]);

  const riskPieData = useMemo(() => {
    if (!filteredData.risks) return [];
    const low = filteredData.risks.filter((r: any) => (r.impact * r.probability) < 8).length;
    const medium = filteredData.risks.filter((r: any) => (r.impact * r.probability) >= 8 && (r.impact * r.probability) < 15).length;
    const high = filteredData.risks.filter((r: any) => (r.impact * r.probability) >= 15).length;
    
    return [
      { name: 'Niedrig', value: low, color: '#10b981' },
      { name: 'Mittel', value: medium, color: '#FF9800' },
      { name: 'Hoch', value: high, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [filteredData.risks]);

  // Action Center Logic (Prioritized Tasks)
  const prioritizedTasks = useMemo(() => {
    const tasks = [];
    
    // Task 1: Overdue Assignments
    const overdue = filteredData.assignments.filter(a => a.status === 'active' && a.validUntil && new Date(a.validUntil) < new Date());
    if (overdue.length > 0) {
      tasks.push({
        id: 'task-overdue',
        title: 'Abgelaufene Zugriffe prüfen',
        desc: `${overdue.length} Berechtigungen sind zeitlich abgelaufen.`,
        icon: Clock,
        color: 'text-red-600',
        bg: 'bg-red-50',
        href: '/assignments?search=expired'
      });
    }

    // Task 2: High Risks without measures
    const highRisks = filteredData.risks.filter(r => (r.impact * r.probability) >= 15 && r.status === 'active');
    if (highRisks.length > 0) {
      tasks.push({
        id: 'task-risks',
        title: 'Kritische Risiken mindern',
        desc: `${highRisks.length} Hochrisiko-Szenarien benötigen Aufmerksamkeit.`,
        icon: AlertTriangle,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        href: '/risks'
      });
    }

    // Task 3: Pending Reviews
    const pendingReviews = filteredData.assignments.filter(a => a.status === 'active' && !a.lastReviewedAt);
    if (pendingReviews.length > 0) {
      tasks.push({
        id: 'task-reviews',
        title: 'Access Reviews fällig',
        desc: `${pendingReviews.length} Zuweisungen müssen rezertifiziert werden.`,
        icon: CalendarCheck,
        color: 'text-primary',
        bg: 'bg-primary/5',
        href: '/reviews'
      });
    }

    return tasks.slice(0, 3);
  }, [filteredData]);

  if (!mounted) return null;

  const handleExport = async (format: 'pdf' | 'excel', mode: 'user' | 'resource') => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await exportFullComplianceReportPdf(filteredData.users, filteredData.resources, entitlements || [], filteredData.assignments, mode);
      } else {
        if (mode === 'user') await exportUsersExcel(filteredData.users, tenants || []);
        else await exportResourcesExcel(filteredData.resources);
      }
      toast({ title: "Bericht erstellt" });
      setIsReportDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export fehlgeschlagen", description: e.message });
    } finally {
      setIsExporting(false);
    }
  };

  const StatCard = ({ id, title, value, icon: Icon, label, color, bg, loading, trend, help }: any) => (
    <Card id={id} className="group border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden hover:scale-[1.02] transition-all duration-300">
      <CardContent className="p-6">
        {loading ? (
          <div className="flex items-center gap-5">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-8 w-12" /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6", bg, color)}>
                <Icon className="w-7 h-7" />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary"><Info className="w-4 h-4" /></Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px] bg-slate-900 text-white text-[10px] uppercase font-black p-3 border-none rounded-xl shadow-2xl">
                    {help}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{label}</p>
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="text-3xl font-headline font-bold text-slate-800 dark:text-slate-100">{value}</h3>
                {trend && (
                  <div className={cn("flex items-center gap-1 text-[10px] font-black", trend > 0 ? "text-emerald-500" : "text-red-500")}>
                    {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(trend)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">Control Center</Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white">Governance Cockpit</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Status der Sicherheit & Compliance für {activeTenantId === 'all' ? 'die gesamte Organisation' : activeTenantId}.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all active:scale-95" onClick={() => setIsReportDialogOpen(true)}>
            <FileDown className="w-4 h-4 mr-2 text-primary" /> Audit Snapshot
          </Button>
          <Button className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-8 bg-slate-900 hover:bg-black text-white shadow-lg transition-all active:scale-95" onClick={() => router.push('/iam-audit')}>
            <BrainCircuit className="w-4 h-4 mr-2" /> KI Audit starten
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard id="stat-users" title="Benutzer" value={filteredData.users.length} icon={Users} label="Identitäten" color="text-blue-500" bg="bg-blue-50" loading={usersLoading} trend={2.4} help="Anzahl aller registrierten Mitarbeiter im System." />
        <StatCard id="stat-resources" title="Systeme" value={filteredData.resources.length} icon={Layers} label="IT-Assets" color="text-indigo-500" bg="bg-indigo-50" loading={resourcesLoading} trend={-1.2} help="Alle Anwendungen und Hardware-Komponenten im Katalog." />
        <StatCard id="stat-assignments" title="Zugriffe" value={filteredData.assignments.filter(a => a.status === 'active').length} icon={ShieldCheck} label="Aktive Rechte" color="text-emerald-500" bg="bg-emerald-50" loading={assignmentsLoading} trend={5.8} help="Anzahl der aktuell gültigen Berechtigungen." />
        <StatCard id="stat-risks" title="Risiken" value={filteredData.risks.length} icon={AlertTriangle} label="Gefahrenlage" color="text-orange-500" bg="bg-orange-50" loading={risksLoading} trend={-4.5} help="Identifizierte Bedrohungen für das Unternehmen." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Action Center - WORKFLOW DRIVEN */}
        <Card className="xl:col-span-2 border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-slate-900 text-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-xl">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-headline font-bold uppercase tracking-widest">Action Center</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Was heute zu tun ist</p>
              </div>
            </div>
            <Badge className="bg-primary text-white border-none rounded-none text-[8px] font-black uppercase h-4 px-1.5">Priority High</Badge>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            {prioritizedTasks.length === 0 ? (
              <div className="py-12 text-center space-y-4 opacity-40">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                <p className="text-sm font-bold uppercase tracking-widest">Alle Workflows sind aktuell</p>
              </div>
            ) : prioritizedTasks.map((task) => (
              <div key={task.id} className="group flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all cursor-pointer" onClick={() => router.push(task.href)}>
                <div className="flex items-center gap-6">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl", task.bg, task.color)}>
                    <task.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white group-hover:text-primary transition-colors">{task.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{task.desc}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-5 h-5 text-slate-500" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RISK PIE with DRILL-DOWN */}
        <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-6 px-8 bg-slate-50/50 dark:bg-slate-950/50">
            <CardTitle className="text-lg font-headline font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Risiko-Verteilung</CardTitle>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Klicken für Details</p>
          </CardHeader>
          <CardContent className="p-8 flex-1 flex flex-col items-center justify-center">
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={riskPieData} 
                    cx="50%" cy="50%" 
                    innerRadius={70} outerRadius={95} 
                    paddingAngle={8} dataKey="value" stroke="none"
                    onClick={(data) => router.push(`/risks?search=${data.name}`)}
                  >
                    {riskPieData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={10} className="cursor-pointer hover:opacity-80 transition-opacity" />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <ShieldAlert className="w-8 h-8 text-slate-100 dark:text-slate-800 mb-1" />
                <span className="text-[10px] font-black uppercase text-slate-400">Scan OK</span>
              </div>
            </div>
            <div className="w-full space-y-2 mt-8">
              {riskPieData.map((item) => (
                <div 
                  key={item.name} 
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
                  onClick={() => router.push(`/risks?search=${item.name}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] font-black uppercase text-slate-500">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">{item.value}</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Dialog remains logic-identical but fits style */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="rounded-[2rem] md:rounded-[3rem] max-w-2xl w-[95vw] md:w-full bg-white dark:bg-slate-950 p-0 border-none shadow-2xl overflow-hidden flex flex-col">
          <DialogHeader className="p-6 md:p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl">
                <FileText className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div>
                <DialogTitle className="text-xl md:text-2xl font-headline font-bold uppercase tracking-tight">Compliance Snapshot</DialogTitle>
                <DialogDescription className="text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mt-1.5">Offizieller Bericht für Auditoren</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 md:p-10 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 flex-1 overflow-y-auto">
            <Button variant="outline" className="h-20 rounded-3xl border-slate-100 flex flex-col gap-1 items-start px-6 justify-center hover:bg-primary/5 hover:border-primary/20 transition-all" onClick={() => handleExport('pdf', 'user')}>
              <span className="font-black uppercase text-[10px] md:text-[11px]">Identitäten (PDF)</span>
              <span className="text-[8px] md:text-[9px] text-slate-400">Detaillierter IAM-Bericht</span>
            </Button>
            <Button variant="outline" className="h-20 rounded-3xl border-slate-100 flex flex-col gap-1 items-start px-6 justify-center hover:bg-indigo-50 hover:border-indigo-200 transition-all" onClick={() => handleExport('pdf', 'resource')}>
              <span className="font-black uppercase text-[10px] md:text-[11px]">Systeme (PDF)</span>
              <span className="text-[8px] md:text-[9px] text-slate-400">Ressourcen- & Assetbericht</span>
            </Button>
          </div>
          <DialogFooter className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t shrink-0">
            <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)} className="w-full md:w-auto rounded-xl text-[10px] font-black uppercase">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
