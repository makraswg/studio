
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  FileCheck, 
  Activity, 
  Building2, 
  Scale, 
  ShieldCheck, 
  Workflow, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  FileDown,
  Info,
  ExternalLink,
  Target,
  ArrowRight,
  Shield,
  Zap,
  Clock,
  History,
  TrendingUp,
  Fingerprint,
  Users,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessingActivity, Resource, Process, RiskMeasure, ProcessVersion, ProcessNode, Feature, Tenant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { exportGdprPdf } from '@/lib/export-utils';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export default function GdprDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: activities, isLoading: isActLoading } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => { setMounted(true); }, []);

  const activity = useMemo(() => activities?.find(a => a.id === id), [activities, id]);
  const currentTenant = useMemo(() => tenants?.find(t => t.id === activity?.tenantId), [tenants, activity]);

  const stats = useMemo(() => {
    if (!activity || !processes || !versions || !resources || !measures) return { linkedProcesses: [], aggregatedResources: [], automatedToms: [], gapScore: 0, gaps: [] };
    const linkedProcesses = processes.filter(p => p.vvtId === activity.id);
    const resourceIds = new Set<string>();
    linkedProcesses.forEach(proc => {
      const ver = versions.find(v => v.process_id === proc.id);
      ver?.model_json?.nodes?.forEach((node: ProcessNode) => { node.resourceIds?.forEach(rid => resourceIds.add(rid)); });
    });
    const aggregatedResources = Array.from(resourceIds).map(rid => resources.find(r => r.id === rid)).filter(Boolean) as Resource[];
    const automatedToms = measures.filter(m => m.isTom && m.resourceIds?.some(rid => resourceIds.has(rid)));
    const gaps = [];
    if (aggregatedResources.some(r => r.criticality === 'high') && automatedToms.length < 3) gaps.push({ type: 'critical', msg: 'Hoher Schutzbedarf, aber wenig TOMs.' });
    const gapScore = gaps.length === 0 ? 100 : Math.max(0, 100 - (gaps.length * 25));
    return { linkedProcesses, aggregatedResources, automatedToms, gaps, gapScore };
  }, [activity, processes, versions, resources, measures]);

  const handleExport = async () => {
    if (!activity || !currentTenant) return;
    setIsExporting(true);
    try { await exportGdprPdf(activity, currentTenant, stats.aggregatedResources, stats.automatedToms); toast({ title: "PDF Bericht erstellt" }); } finally { setIsExporting(false); }
  };

  if (!mounted) return null;
  if (isActLoading) return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-emerald-600 opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade VVT-Register...</p></div>;
  if (!activity) return null;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/gdpr')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3"><h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{activity.name}</h1><Badge className="rounded-full px-2 h-5 text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border-none shadow-sm">V{activity.version}</Badge></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2"><FileCheck className="w-3 h-3" /> Art. 30 DSGVO • {activity.legalBasis}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-emerald-200 text-emerald-700 shadow-sm transition-all" onClick={handleExport} disabled={isExporting}>{isExporting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-2" />} PDF Bericht</Button>
          <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-emerald-600 text-white shadow-lg active:scale-95 transition-all">Bearbeiten</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4 px-6"><CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Maturity Score</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col items-center text-center group-hover:scale-[1.02] transition-transform duration-500">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Compliance Level</span>
                <p className="text-4xl font-black text-emerald-600">{stats.gapScore}%</p>
                <Badge variant="outline" className="mt-2 bg-white text-[8px] font-black">Art. 32 Audit</Badge>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Abteilung</Label><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activity.responsibleDepartment || '---'}</p></div>
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Rechtsbasis</Label><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activity.legalBasis || '---'}</p></div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="vvt" className="space-y-6">
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-12 rounded-2xl border w-full justify-start gap-1 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="vvt" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all"><Info className="w-4 h-4" /> Stammblatt</TabsTrigger>
              <TabsTrigger value="assets" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all"><Server className="w-4 h-4" /> Systeme & TOM</TabsTrigger>
              <TabsTrigger value="gaps" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all"><AlertTriangle className="w-4 h-4 text-red-600" /> Gaps</TabsTrigger>
            </TabsList>

            <TabsContent value="vvt" className="animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6"><CardTitle className="text-sm font-headline font-bold uppercase text-slate-900 dark:text-white">Verarbeitungszweck</CardTitle></CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Fachliche Beschreibung</Label><p className="text-sm font-medium leading-relaxed italic bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">"{activity.description}"</p></div>
                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Aufbewahrung</Label><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activity.retentionPeriod}</p></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-slate-400">Transfer Status</Label><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activity.thirdCountryTransfer ? 'Drittstaatentransfer Aktiv' : 'Kein Drittstaatentransfer'}</p></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets" className="animate-in fade-in space-y-6">
              <div className="space-y-6">
                <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4"><CardTitle className="text-sm font-bold uppercase text-slate-900 dark:text-white">IT-Infrastruktur</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">{stats.aggregatedResources.map(res => (
                      <div key={res.id} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => router.push(`/resources/${res.id}`)}>
                        <div className="flex items-center gap-3"><Server className="w-4 h-4 text-slate-400" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{res.name}</span></div>
                        <Badge variant="outline" className="text-[7px] font-black h-4 px-1 border-slate-200">{res.criticality.toUpperCase()}</Badge>
                      </div>
                    ))}</div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="bg-emerald-50/50 dark:bg-emerald-900/10 border-b p-4"><CardTitle className="text-sm font-bold uppercase text-emerald-700 dark:text-emerald-400">Verknüpfte TOM (Art. 32)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">{stats.automatedToms.map(tom => (
                      <div key={tom.id} className="p-3 px-4 flex items-center justify-between group hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer">
                        <div className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{tom.title}</span></div>
                        <Badge className="bg-emerald-500 text-white border-none text-[7px] h-4">AKTIV</Badge>
                      </div>
                    ))}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="gaps" className="animate-in fade-in">
              {stats.gaps.length > 0 ? (
                <div className="space-y-4">{stats.gaps.map((gap, i) => (
                  <div key={i} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-4 shadow-sm"><AlertTriangle className="w-6 h-6 text-red-600" /><div><p className="text-sm font-black uppercase text-red-900 dark:text-red-400">Audit Finding</p><p className="text-xs font-bold text-red-700 dark:text-red-300">{gap.msg}</p></div></div>
                ))}</div>
              ) : <div className="py-16 text-center opacity-30 italic uppercase text-[10px] text-slate-400"><CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-emerald-500" />Keine Compliance Gaps gefunden</div>}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
