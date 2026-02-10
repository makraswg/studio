
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
  Info,
  BrainCircuit,
  Clock,
  ChevronRight,
  Network
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

    // Integrity Score
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

    return { total, active: activeCount, score: integrityScore, statusData, riskActivities, gapCount: fActivities.filter(a => !a.lastReviewDate).length };
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
        {/* Audit Status Card - Refined */}
        <Card className="rounded-2xl border-2 border-emerald-500/20 shadow-sm bg-white dark:bg-slate-900 overflow-hidden relative group">
            <CardContent className="p-8 space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shadow-inner border border-emerald-500/10">
                        <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 font-black text-[9px] uppercase tracking-widest bg-emerald-500/5">Audit Status</Badge>
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-headline font-black tracking-tight text-slate-900 dark:text-white">{dashboardData.score}%</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Integrity Score</p>
                </div>
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>TOM Abdeckung (Art. 32)</span>
                        <span className="text-emerald-600">Level {Math.ceil(dashboardData.score / 20)}</span>
                    </div>
                    <Progress value={dashboardData.score} className="h-2 bg-slate-100 dark:bg-slate-800" />
                    <p className="text-[9px] text-slate-400 leading-relaxed italic mt-4">
                        Anteil der VVTs mit mindestens einer wirksamen technischen Kontrolle.
                    </p>
                </div>
            </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden group hover:border-emerald-200 transition-all">
                <CardContent className="p-6 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Register-Umfang</p>
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
                        <p className="text-[9px] text-slate-500 font-medium italic">Offen</p>
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
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Konformität</p>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">DSGVO Konformität: 100%</h3>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase" onClick={() => router.push('/gdpr')}>Ansehen <ArrowRight className="w-3.5 h-3.5 ml-2" /></Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
