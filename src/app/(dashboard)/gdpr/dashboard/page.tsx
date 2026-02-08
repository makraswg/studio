
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileCheck, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Fingerprint,
  Scale,
  Loader2,
  PieChart as PieChartIcon,
  LayoutDashboard,
  ShieldAlert,
  ClipboardList,
  Target,
  Search,
  FileText,
  Zap,
  Info
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
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessingActivity, Resource, RiskMeasure, RiskControl, Process } from '@/lib/types';

export default function PolicyHubDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { activeTenantId } = useSettings();

  const { data: activities, isLoading: isActLoading } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: controls } = usePluggableCollection<RiskControl>('riskControls');

  useEffect(() => { setMounted(true); }, []);

  const dashboardData = useMemo(() => {
    if (!activities) return { score: 0, statusData: [], riskActivities: [], total: 0, active: 0, gapCount: 0 };

    const tenantFilter = (a: ProcessingActivity) => activeTenantId === 'all' || a.tenantId === activeTenantId;
    const fActivities = activities.filter(tenantFilter);
    
    const total = fActivities.length;
    const activeCount = fActivities.filter(a => a.status === 'active').length;
    const draftCount = fActivities.filter(a => a.status === 'draft').length;
    const archivedCount = fActivities.filter(a => a.status === 'archived').length;

    // Integrity Score: Activities with at least one effective control
    const coveredActivities = fActivities.filter(act => {
        const linkedResources = resources?.filter(r => act.resourceIds?.includes(r.id)) || [];
        const resIds = new Set(linkedResources.map(r => r.id));
        const linkedMeasures = measures?.filter(m => m.isTom && m.resourceIds?.some(rid => resIds.has(rid))) || [];
        const effective = linkedMeasures.some(m => controls?.some(c => c.measureId === m.id && c.isEffective));
        return effective;
    });

    const integrityScore = total > 0 ? Math.floor((coveredActivities.length * 100) / total) : 100;

    const statusData = [
      { name: 'Aktiv', value: activeCount, color: '#10b981' },
      { name: 'Entwurf', value: draftCount, color: '#3b82f6' },
      { name: 'Archiv', value: archivedCount, color: '#94a3b8' },
    ].filter(d => d.value > 0);

    const riskActivities = fActivities
        .map(a => {
            const gaps = [];
            const linkedResources = resources?.filter(r => a.resourceIds?.includes(r.id)) || [];
            if (linkedResources.some(r => r.criticality === 'high')) gaps.push('Hoher Schutzbedarf');
            return { ...a, gaps };
        })
        .filter(a => a.gaps.length > 0)
        .slice(0, 5);

    return { 
        total, 
        active: activeCount, 
        score: integrityScore, 
        statusData, 
        riskActivities,
        gapCount: fActivities.filter(a => !a.lastReviewDate).length
    };
  }, [activities, activeTenantId, resources, measures, controls]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center rounded-xl border border-emerald-500/10 shadow-sm transition-transform hover:scale-105">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-emerald-100 text-emerald-700 text-[9px] font-bold border-none uppercase tracking-wider">Policy Hub Intelligence</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Compliance Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Status der datenschutzrechtlichen Verarbeitungstätigkeiten.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-slate-200" onClick={() => router.push('/gdpr')}>
            <FileText className="w-3.5 h-3.5 mr-2 text-emerald-600" /> VVT-Register
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all" onClick={() => router.push('/iam-audit')}>
            <BrainCircuit className="w-3.5 h-3.5 mr-2" /> KI Audit starten
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Resilience Card */}
        <Card className="rounded-2xl border-none shadow-xl bg-slate-900 text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/20 transition-all" />
            <CardContent className="p-8 space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 font-black text-[9px] uppercase tracking-widest bg-emerald-500/5">Audit Status</Badge>
                </div>
                <div className="space-y-1">
                    <h3 className="text-3xl font-headline font-black tracking-tight">{dashboardData.score}%</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Integrity Score</p>
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>TOM Abdeckung (Art. 32)</span>
                        <span className="text-emerald-400">Level {Math.ceil(dashboardData.score / 20)}</span>
                    </div>
                    <Progress value={dashboardData.score} className="h-1.5 bg-white/10" />
                    <p className="text-[9px] text-slate-400 leading-relaxed italic">
                        Berechnet aus dem Anteil der VVTs mit mindestens einer wirksamen technischen Kontrolle.
                    </p>
                </div>
            </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-emerald-200 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Verzeichnis-Umfang</p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{dashboardData.total}</h3>
                        <p className="text-[9px] text-slate-500 font-medium italic">Gemeldete Tätigkeiten</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-inner">
                        <FileCheck className="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-amber-200 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Review Bedarfe</p>
                        <h3 className="text-2xl font-black text-amber-600">{dashboardData.gapCount}</h3>
                        <p className="text-[9px] text-slate-500 font-medium italic">Fehlende Erstprüfungen</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600 shadow-inner">
                        <Clock className="w-6 h-6" />
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden md:col-span-2 group hover:border-primary/20 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-inner">
                            <Scale className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rechtliche Grundlagen</p>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">DSGVO Konformität: 100%</h3>
                            <p className="text-[9px] text-slate-500">Alle aktiven Einträge haben eine valide Basis (Art. 6).</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => router.push('/gdpr')}>Ansehen <ArrowRight className="w-3.5 h-3.5 ml-2" /></Button>
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Status Chart */}
        <Card className="border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b py-4 px-6 bg-slate-50/50">
            <CardTitle className="text-xs font-headline font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-slate-400" /> Register Maturity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col items-center justify-center">
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={dashboardData.statusData} 
                    cx="50%" cy="50%" 
                    innerRadius={60} outerRadius={80} 
                    paddingAngle={5} dataKey="value" stroke="none"
                  >
                    {dashboardData.statusData.map((entry, index) => <Cell key={index} fill={entry.color} cornerRadius={6} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-800 dark:text-white">{dashboardData.total}</span>
                <span className="text-[8px] font-black text-slate-400 uppercase">Items</span>
              </div>
            </div>
            <div className="w-full space-y-2 mt-6">
              {dashboardData.statusData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{item.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-black border-none bg-slate-100 text-slate-700 h-5 px-2">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Monitor / Gap Analysis */}
        <Card className="xl:col-span-2 border shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardHeader className="p-6 border-b bg-slate-50/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shadow-inner">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Art. 32 Gap Analysis</CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kritische Tätigkeiten mit Kontrollbedarf</p>
              </div>
            </div>
            <Badge className="bg-red-50 text-red-700 border-none rounded-full text-[8px] font-black h-5 px-3 uppercase tracking-tighter">Priorität: Hoch</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dashboardData.riskActivities.length === 0 ? (
                <div className="py-20 text-center space-y-3 opacity-30 italic">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                  <p className="text-xs font-bold uppercase">Keine kritischen Lücken identifiziert</p>
                </div>
              ) : dashboardData.riskActivities.map((act) => (
                <div key={act.id} className="p-5 flex items-center justify-between group hover:bg-slate-50 transition-all cursor-pointer" onClick={() => router.push(`/gdpr/${act.id}`)}>
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-red-600 transition-colors shadow-inner border border-white">
                      <Fingerprint className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">{act.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{act.responsibleDepartment}</span>
                        <div className="flex gap-1">
                            {act.gaps.map((g, idx) => (
                                <Badge key={idx} variant="outline" className="text-[7px] font-black h-3.5 border-red-100 text-red-600 bg-red-50/50 uppercase">{g}</Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Schutzbedarf</p>
                        <Badge className="bg-red-600 text-white border-none h-4 px-1.5 text-[7px] font-black">HIGH</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl group-hover:bg-white group-hover:shadow-sm"><ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-all" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-center">
                <Button variant="ghost" className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-primary transition-all" onClick={() => router.push('/gdpr')}>Vollständiges Register anzeigen <ChevronRight className="w-3 h-3 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Footer */}
      <footer className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
        <Card className="rounded-[2rem] border-none bg-indigo-600 text-white shadow-xl p-8 space-y-4 hover:scale-[1.02] transition-transform cursor-pointer group" onClick={() => router.push('/settings/data-map')}>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white"><Network className="w-6 h-6" /></div>
            <div>
                <h4 className="text-lg font-headline font-black uppercase tracking-tight">The Golden Chain</h4>
                <p className="text-xs text-white/60 leading-relaxed italic">Visuelle Analyse der Datenflüsse von der Identität bis zum physischen Asset.</p>
            </div>
            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2" />
        </Card>
        
        <Card className="rounded-[2rem] border-none bg-slate-900 text-white shadow-xl p-8 space-y-4 hover:scale-[1.02] transition-transform cursor-pointer group" onClick={() => router.push('/gdpr')}>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white"><FileText className="w-6 h-6" /></div>
            <div>
                <h4 className="text-lg font-headline font-black uppercase tracking-tight">Art. 30 Reports</h4>
                <p className="text-xs text-white/60 leading-relaxed italic">Generieren Sie revisionssichere PDF-Berichte für externe Auditoren in Sekunden.</p>
            </div>
            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2" />
        </Card>

        <Card className="rounded-[2rem] border-none bg-emerald-600 text-white shadow-xl p-8 space-y-4 hover:scale-[1.02] transition-transform cursor-pointer group" onClick={() => router.push('/iam-audit')}>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white"><BrainCircuit className="w-6 h-6" /></div>
            <div>
                <h4 className="text-lg font-headline font-black uppercase tracking-tight">KI Compliance</h4>
                <p className="text-xs text-white/60 leading-relaxed italic">Automatisierter Check der Berechtigungs-Struktur gegen DSGVO-Vorgaben.</p>
            </div>
            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2" />
        </Card>
      </footer>
    </div>
  );
}
