
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
  Clock,
  LayoutDashboard,
  ShieldX,
  Gauge,
  BarChart4,
  CheckSquare
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
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
  const { data: risks, isLoading: risksLoading } = usePluggableCollection<any>('risks');
  const { data: measures, isLoading: measuresLoading } = usePluggableCollection<any>('riskMeasures');
  const { data: controls, isLoading: controlsLoading } = usePluggableCollection<any>('riskControls');
  const { data: tenants } = usePluggableCollection<any>('tenants');
  const { data: features } = usePluggableCollection<any>('features');
  const { data: jobTitles } = usePluggableCollection<any>('jobTitles');
  const { data: depts } = usePluggableCollection<any>('departments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    if (!users || !resources || !assignments) return { users: [], resources: [], assignments: [], risks: [], features: [], measures: [], controls: [] };
    
    const fUsers = activeTenantId === 'all' ? users : users.filter((u: any) => u.tenantId === activeTenantId);
    const fResources = activeTenantId === 'all' ? resources : resources.filter((r: any) => r.tenantId === activeTenantId || r.tenantId === 'global' || !r.tenantId);
    const fRisks = (risks || []).filter((r: any) => activeTenantId === 'all' || r.tenantId === activeTenantId);
    const fFeatures = (features || []).filter((f: any) => activeTenantId === 'all' || f.tenantId === activeTenantId);
    const userIds = new Set(fUsers.map((u: any) => u.id));
    const fAssignments = assignments.filter((a: any) => userIds.has(a.userId));
    
    const fMeasures = (measures || []).filter((m: any) => true);
    const fControls = (controls || []).filter((c: any) => true);

    return { users: fUsers, resources: fResources, assignments: fAssignments, risks: fRisks, features: fFeatures, measures: fMeasures, controls: fControls };
  }, [users, resources, assignments, risks, features, measures, controls, activeTenantId]);

  const complianceHealth = useMemo(() => {
    if (!filteredData.controls || !filteredData.risks) return { resilienceScore: 0, riskCoverage: 0, deptRanking: [] };

    const effectiveControls = filteredData.controls.filter((c: any) => c.isEffective).length;
    const totalControls = filteredData.controls.length || 1;
    const resilienceScore = Math.floor((effectiveControls * 100) / totalControls);

    const highRisks = filteredData.risks.filter((r: any) => (r.impact * r.probability) >= 15);
    const highRisksCount = highRisks.length || 1;
    const coveredHighRisks = highRisks.filter((r: any) => {
        const riskMeasures = filteredData.measures.filter((m: any) => m.riskIds?.includes(r.id));
        const riskMeasureIds = new Set(riskMeasures.map(m => m.id));
        return filteredData.controls.some((c: any) => riskMeasureIds.has(c.measureId) && c.isEffective);
    }).length;
    const riskCoverage = Math.floor((coveredHighRisks * 100) / highRisksCount);

    const deptStats = (depts || []).filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map((d: any) => {
        const deptUsers = filteredData.users.filter((u: any) => u.department === d.name);
        const deptUserIds = new Set(deptUsers.map((u: any) => u.id));
        const deptAssignments = filteredData.assignments.filter((a: any) => deptUserIds.has(a.userId) && a.status === 'active');
        
        const total = deptAssignments.length;
        const reviewed = deptAssignments.filter((a: any) => !!a.lastReviewedAt).length;
        const score = total > 0 ? Math.floor((reviewed * 100) / total) : 100;

        return { name: d.name, score: score, count: total };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    return { resilienceScore, riskCoverage, deptRanking: deptStats };
  }, [filteredData, depts, activeTenantId]);

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

  const StatCard = ({ id, value, icon: Icon, label, color, bg, loading, help }: any) => (
    <Card id={id} className="group border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
      <CardContent className="p-6">
        {loading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-2 w-12" /><Skeleton className="h-6 w-10" /></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110", bg, color)}>
                <Icon className="w-5 h-5" />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-primary"><Info className="w-3.5 h-3.5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[180px] bg-slate-900 text-white text-[10px] font-bold p-2 border-none rounded-md">
                    {help}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{value}</h3>
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
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold">Control Center</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Governance Cockpit</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status der Sicherheit & Compliance für {activeTenantId === 'all' ? 'die gesamte Organisation' : activeTenantId}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 hover:bg-slate-50 active:scale-95" onClick={() => setIsReportDialogOpen(true)}>
            <FileDown className="w-3.5 h-3.5 mr-2 text-primary" /> Audit Snapshot
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95" onClick={() => router.push('/iam-audit')}>
            <BrainCircuit className="w-3.5 h-3.5 mr-2" /> KI Audit starten
          </Button>
        </div>
      </div>

      {/* Resilience Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden relative group">
            <CardContent className="p-8 space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shadow-inner border border-primary/10">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-primary border-primary/30 font-black text-[9px] uppercase tracking-widest bg-primary/5">Platform Health</Badge>
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-headline font-black tracking-tight text-slate-900 dark:text-white">Resilience Score</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gesamt-Sicherheitszustand</p>
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-sm font-black">
                        <span className="text-slate-400 uppercase text-[10px]">Kontroll-Effektivität</span>
                        <span className="text-primary">{complianceHealth.resilienceScore}%</span>
                    </div>
                    <Progress value={complianceHealth.resilienceScore} className="h-2 bg-slate-100" />
                    <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400 italic">
                        <Zap className="w-3.5 h-3.5 text-primary fill-current" />
                        Basis: {filteredData.controls.filter(c => c.isEffective).length} wirksame von {filteredData.controls.length} Kontrollen.
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group">
            <CardContent className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100 shadow-sm group-hover:scale-110 transition-transform">
                        <Target className="w-6 h-6" />
                    </div>
                    <Badge className="bg-orange-50 text-orange-700 border-none rounded-full text-[8px] font-black uppercase h-5 px-3">High Risk Monitor</Badge>
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-headline font-black text-slate-900 dark:text-white">{complianceHealth.riskCoverage}%</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Coverage Level</p>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
                        <span>Absicherung Hochrisiken</span>
                        <span className="text-orange-600">Level {Math.ceil(complianceHealth.riskCoverage / 20)}</span>
                    </div>
                    <Progress value={complianceHealth.riskCoverage} className="h-2 bg-slate-100" />
                    <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                        Zeigt an, wie viele kritische Bedrohungen durch mindestens eine wirksame Kontrolle abgesichert sind.
                    </p>
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <BarChart4 className="w-3.5 h-3.5" /> Department Review Integrity
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                {complianceHealth.deptRanking.map((dept, idx) => (
                    <div key={dept.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                            <div className="flex items-center gap-2">
                                <span className="w-4 text-slate-300 font-black italic">#{idx+1}</span>
                                <span className="text-slate-700 truncate max-w-[120px]">{dept.name}</span>
                            </div>
                            <span className={cn("font-black", dept.score > 80 ? "text-emerald-600" : "text-primary")}>{dept.score}%</span>
                        </div>
                        <Progress value={dept.score} className="h-1 rounded-full bg-slate-100" />
                    </div>
                ))}
            </CardContent>
        </Card>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard id="stat-users" value={filteredData.users.length} icon={Users} label="Identitäten" color="text-blue-500" bg="bg-blue-50" loading={usersLoading} help="Anzahl aller registrierten Mitarbeiter im System." />
        <StatCard id="stat-resources" value={filteredData.resources.length} icon={Layers} label="IT-Assets" color="text-indigo-500" bg="bg-indigo-50" loading={resourcesLoading} help="Alle Anwendungen und Hardware-Komponenten im Katalog." />
        <StatCard id="stat-data" value={filteredData.features.length} icon={LayoutDashboard} label="Datenobjekte" color="text-sky-500" bg="bg-sky-50" loading={false} help="Zahl der definierten Datenobjekte und Entitäten." />
        <StatCard id="stat-risks" value={filteredData.risks.length} icon={AlertTriangle} label="Gefahrenlage" color="text-orange-500" bg="bg-orange-50" loading={risksLoading} help="Identifizierte Bedrohungen für das Unternehmen." />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Action Center */}
        <Card className="xl:col-span-2 border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardHeader className="p-6 pb-2 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center text-primary">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-headline font-bold">Action Center</CardTitle>
                <p className="text-[10px] font-bold text-slate-400">Governance Ops Warteschlange</p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary border-none rounded-full text-[8px] font-black h-5 px-3 uppercase">Audit Focus</Badge>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
                <div className="group flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-primary/20 transition-all cursor-pointer shadow-sm" onClick={() => router.push('/reviews')}>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-primary">
                            <CalendarCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">Access Reviews fällig</h4>
                            <p className="text-[10px] text-slate-500">Zertifizierungen für die aktuelle Periode stehen aus.</p>
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="group flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-accent/20 transition-all cursor-pointer shadow-sm" onClick={() => router.push('/risks')}>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-accent">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">Kritische Risiken</h4>
                            <p className="text-[10px] text-slate-500">Hochrisiko-Szenarien ohne wirksame Maßnahmen identifiziert.</p>
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>
          </CardContent>
        </Card>

        {/* RISK PIE */}
        <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b py-4 px-6 bg-slate-50/50">
            <CardTitle className="text-xs font-headline font-bold text-slate-800 uppercase tracking-widest">Risiko-Verteilung</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col items-center justify-center">
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={4}>
                    {riskPieData.map((entry, index) => <Cell key={index} fill={entry.color} className="cursor-pointer" />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full space-y-1.5 mt-4">
              {riskPieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="rounded-2xl max-w-xl w-[95vw] bg-white p-0 border-none shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-headline font-bold">Compliance Snapshot</DialogTitle>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase">Offizieller Bericht für Auditoren</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" className="h-16 rounded-xl border-slate-100 flex flex-col gap-1 items-start px-4 justify-center hover:bg-primary/5 transition-all" onClick={() => handleExport('pdf', 'user')}>
              <span className="font-bold text-xs uppercase">Identitäten (PDF)</span>
              <span className="text-[10px] text-slate-400">IAM-Gesamtbericht</span>
            </Button>
            <Button variant="outline" className="h-16 rounded-xl border-slate-100 flex flex-col gap-1 items-start px-4 justify-center hover:bg-indigo-50 transition-all" onClick={() => handleExport('pdf', 'resource')}>
              <span className="font-bold text-xs uppercase">Systeme (PDF)</span>
              <span className="text-[10px] text-slate-400">Assetbericht</span>
            </Button>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setIsReportDialogOpen(false)} className="rounded-md text-[10px] font-bold uppercase">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
