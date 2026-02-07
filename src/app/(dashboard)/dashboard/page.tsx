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

  const prioritizedTasks = useMemo(() => {
    const tasks = [];
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
    <Card id={id} className="group border shadow-sm bg-white dark:bg-slate-900 rounded-lg overflow-hidden hover:shadow-md transition-all">
      <CardContent className="p-5">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-md" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-2 w-12" /><Skeleton className="h-6 w-10" /></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className={cn("w-10 h-10 rounded-md flex items-center justify-center transition-all group-hover:scale-110", bg, color)}>
                <Icon className="w-5 h-5" />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-primary"><Info className="w-3.5 h-3.5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[180px] bg-slate-900 text-white text-[9px] uppercase font-black p-2 border-none rounded-md">
                    {help}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
              <div className="flex items-baseline justify-between mt-0.5">
                <h3 className="text-2xl font-headline font-bold text-slate-800 dark:text-slate-100">{value}</h3>
                {trend && (
                  <div className={cn("flex items-center gap-0.5 text-[9px] font-black", trend > 0 ? "text-emerald-500" : "text-red-500")}>
                    {trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
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
    <div className="space-y-6 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">Control Center</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Governance Cockpit</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status der Sicherheit & Compliance für {activeTenantId === 'all' ? 'die gesamte Organisation' : activeTenantId}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-slate-200 hover:bg-slate-50 active:scale-95" onClick={() => setIsReportDialogOpen(true)}>
            <FileDown className="w-3.5 h-3.5 mr-2 text-primary" /> Audit Snapshot
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold uppercase text-[10px] tracking-wider px-6 bg-slate-900 hover:bg-black text-white shadow-sm active:scale-95" onClick={() => router.push('/iam-audit')}>
            <BrainCircuit className="w-3.5 h-3.5 mr-2" /> KI Audit starten
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard id="stat-users" title="Benutzer" value={filteredData.users.length} icon={Users} label="Identitäten" color="text-blue-500" bg="bg-blue-50" loading={usersLoading} trend={2.4} help="Anzahl aller registrierten Mitarbeiter im System." />
        <StatCard id="stat-resources" title="Systeme" value={filteredData.resources.length} icon={Layers} label="IT-Assets" color="text-indigo-500" bg="bg-indigo-50" loading={resourcesLoading} trend={-1.2} help="Alle Anwendungen und Hardware-Komponenten im Katalog." />
        <StatCard id="stat-assignments" title="Zugriffe" value={filteredData.assignments.filter(a => a.status === 'active').length} icon={ShieldCheck} label="Aktive Rechte" color="text-emerald-500" bg="bg-emerald-50" loading={assignmentsLoading} trend={5.8} help="Anzahl der aktuell gültigen Berechtigungen." />
        <StatCard id="stat-risks" title="Risiken" value={filteredData.risks.length} icon={AlertTriangle} label="Gefahrenlage" color="text-orange-500" bg="bg-orange-50" loading={risksLoading} trend={-4.5} help="Identifizierte Bedrohungen für das Unternehmen." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Action Center */}
        <Card className="xl:col-span-2 border shadow-sm bg-slate-900 text-white rounded-xl overflow-hidden">
          <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center text-primary">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-headline font-bold uppercase tracking-widest">Action Center</CardTitle>
                <p className="text-[9px] font-bold text-slate-400 uppercase">Was heute zu tun ist</p>
              </div>
            </div>
            <Badge className="bg-primary text-white border-none rounded-none text-[7px] font-black uppercase h-4 px-1.5">Priority High</Badge>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            {prioritizedTasks.length === 0 ? (
              <div className="py-10 text-center space-y-2 opacity-40">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Alle Workflows sind aktuell</p>
              </div>
            ) : prioritizedTasks.map((task) => (
              <div key={task.id} className="group flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer" onClick={() => router.push(task.href)}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-md flex items-center justify-center shadow-sm", task.bg, task.color)}>
                    <task.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{task.title}</h4>
                    <p className="text-[10px] text-slate-400">{task.desc}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RISK PIE */}
        <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="border-b py-4 px-6 bg-slate-50/50">
            <CardTitle className="text-xs font-headline font-bold uppercase tracking-widest">Risiko-Verteilung</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col items-center justify-center">
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={riskPieData} 
                    cx="50%" cy="50%" 
                    innerRadius={50} outerRadius={70} 
                    paddingAngle={5} dataKey="value" stroke="none"
                    onClick={(data) => router.push(`/risks?search=${data.name}`)}
                  >
                    {riskPieData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={4} className="cursor-pointer hover:opacity-80" />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '9px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black uppercase text-slate-400">Scan</span>
              </div>
            </div>
            <div className="w-full space-y-1.5 mt-4">
              {riskPieData.map((item) => (
                <div 
                  key={item.name} 
                  className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 transition-all cursor-pointer group"
                  onClick={() => router.push(`/risks?search=${item.name}`)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] font-bold uppercase text-slate-500">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="rounded-xl max-w-xl w-[95vw] bg-white p-0 border-none shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-headline font-bold uppercase">Compliance Snapshot</DialogTitle>
                <DialogDescription className="text-slate-400 text-[9px] font-bold uppercase">Offizieller Bericht für Auditoren</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" className="h-16 rounded-lg border-slate-100 flex flex-col gap-1 items-start px-4 justify-center hover:bg-primary/5 transition-all" onClick={() => handleExport('pdf', 'user')}>
              <span className="font-black uppercase text-[10px]">Identitäten (PDF)</span>
              <span className="text-[8px] text-slate-400">IAM-Gesamtbericht</span>
            </Button>
            <Button variant="outline" className="h-16 rounded-lg border-slate-100 flex flex-col gap-1 items-start px-4 justify-center hover:bg-indigo-50 transition-all" onClick={() => handleExport('pdf', 'resource')}>
              <span className="font-black uppercase text-[10px]">Systeme (PDF)</span>
              <span className="text-[8px] text-slate-400">Assetbericht</span>
            </Button>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setIsReportDialogOpen(false)} className="w-full sm:w-auto rounded-md text-[9px] font-black uppercase">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
