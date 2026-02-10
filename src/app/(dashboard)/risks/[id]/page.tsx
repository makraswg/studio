
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  AlertTriangle, 
  ShieldAlert, 
  Activity, 
  ShieldCheck, 
  Workflow, 
  Zap, 
  Target, 
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  History,
  Clock,
  User as UserIcon,
  Server,
  Pencil,
  BrainCircuit,
  Settings2,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Risk, Resource, RiskMeasure, RiskControl, Process, Task, PlatformUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { usePlatformAuth } from '@/context/auth-context';
import { getRiskAdvice, RiskAdvisorOutput } from '@/ai/flows/risk-advisor-flow';
import { Label } from '@/components/ui/label';

export default function RiskDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  
  // AI State
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<RiskAdvisorOutput | null>(null);

  const { data: risks, isLoading: isRisksLoading } = usePluggableCollection<Risk>('risks');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: allMeasures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: allControls } = usePluggableCollection<RiskControl>('riskControls');
  const { data: allTasks } = usePluggableCollection<Task>('tasks');

  useEffect(() => { setMounted(true); }, []);

  const risk = useMemo(() => risks?.find(r => r.id === id), [risks, id]);
  const asset = useMemo(() => resources?.find(r => r.id === risk?.assetId), [resources, risk]);
  const process = useMemo(() => processes?.find(p => p.id === risk?.processId), [processes, risk]);
  
  const linkedMeasures = useMemo(() => 
    allMeasures?.filter(m => m.riskIds?.includes(id as string)) || [],
    [allMeasures, id]
  );

  const linkedControls = useMemo(() => {
    const measureIds = new Set(linkedMeasures.map(m => m.id));
    return allControls?.filter(c => measureIds.has(c.measureId)) || [];
  }, [allControls, linkedMeasures]);

  const riskTasks = useMemo(() => 
    allTasks?.filter(t => t.entityId === id && t.entityType === 'risk') || [],
    [allTasks, id]
  );

  const handleOpenAdvisor = async () => {
    if (!risk) return;
    setIsAdvisorLoading(true);
    try {
      const advice = await getRiskAdvice({
        title: risk.title,
        description: risk.description || '',
        category: risk.category,
        impact: risk.impact,
        probability: risk.probability,
        assetName: asset?.name,
        tenantId: activeTenantId,
        dataSource
      });
      setAiAdvice(advice);
    } catch (e) {
      toast({ variant: "destructive", title: "KI-Fehler", description: "Beratung konnte nicht geladen werden." });
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  if (!mounted) return null;

  if (isRisksLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-accent opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Analysiere Risikoszenario...</p></div>;
  }

  if (!risk) return null;

  const bruteScore = risk.impact * risk.probability;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/risks')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{risk.title}</h1>
              <Badge className={cn(
                "rounded-full px-3 h-6 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                bruteScore >= 15 ? "bg-red-50 text-red-700" : bruteScore >= 8 ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"
              )}>{risk.category}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Risiko-Management • {risk.status}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm" onClick={handleOpenAdvisor} disabled={isAdvisorLoading}>
            {isAdvisorLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />} KI-Berater
          </Button>
          <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 active:scale-95 transition-all" onClick={() => router.push(`/risks?edit=${risk.id}`)}>
            <Settings2 className="w-4 h-4 mr-2" /> Bearbeiten
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4 px-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Gefährdungslage</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col items-center text-center group-hover:scale-[1.02] transition-transform duration-500">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Brutto Risiko-Score</span>
                <p className={cn("text-4xl font-black tracking-tighter", bruteScore >= 15 ? "text-red-600" : bruteScore >= 8 ? "text-orange-600" : "text-emerald-600")}>{bruteScore}</p>
                <div className="flex items-center gap-2 mt-3 text-[9px] font-bold text-slate-400 uppercase bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-slate-100">
                  Impact {risk.impact} × Wahrsch. {risk.probability}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-1 group/field">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Eigner (Owner)</Label>
                  <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <UserIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{risk.owner}</span>
                  </div>
                </div>
                <div className="space-y-1 group/field">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Behandlungsstrategie</Label>
                  <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">{risk.treatmentStrategy || 'Mitigate'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-12 rounded-2xl border w-full justify-start gap-1 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Info className="w-4 h-4" /> Analyse & Kontext
              </TabsTrigger>
              <TabsTrigger value="mitigation" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <ShieldCheck className="w-4 h-4" /> Maßnahmen & TOM
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <ClipboardList className="w-4 h-4" /> Aufgaben ({riskTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6">
                  <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Szenariobeschreibung</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Beschreibung der Bedrohung</Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl shadow-inner italic border border-slate-100 dark:border-slate-800">
                      "{risk.description || 'Keine detaillierte Beschreibung hinterlegt.'}"
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {asset && (
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-slate-400">Betroffenes IT-System</Label>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors" onClick={() => router.push(`/resources/${asset.id}`)}>
                          <Server className="w-4 h-4 text-indigo-500" /> {asset.name}
                        </div>
                      </div>
                    )}
                    {process && (
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-slate-400">Betroffener Workflow</Label>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm transition-colors" onClick={() => router.push(`/processhub/view/${process.id}`)}>
                          <Workflow className="w-4 h-4 text-orange-500" /> {process.title}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mitigation" className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 gap-3">
                {linkedMeasures.map(m => (
                  <div key={m.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between group hover:border-emerald-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/risks/measures/${m.id}`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30 shadow-inner"><ShieldCheck className="w-5 h-5" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{m.title}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{m.tomCategory || 'Maßnahme'}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-all group-hover:translate-x-1" />
                  </div>
                ))}
                {linkedMeasures.length === 0 && <div className="py-16 text-center border-2 border-dashed rounded-3xl opacity-30 italic uppercase text-[10px] text-slate-400">Keine Maßnahmen verknüpft</div>}
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6 animate-in fade-in">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6">
                  <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Operative Tasks</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {riskTasks.map(t => (
                      <div key={t.id} className="p-4 px-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center justify-between group cursor-pointer" onClick={() => router.push('/tasks')}>
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg", t.status === 'done' ? "bg-emerald-500" : t.priority === 'critical' ? "bg-red-600" : "bg-indigo-600")}>
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <div><p className="text-sm font-black text-slate-800 dark:text-slate-100">{t.title}</p><p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status: {t.status}</p></div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                    {riskTasks.length === 0 && <div className="py-16 text-center opacity-30 italic text-[10px] uppercase text-slate-400">Keine Aufgaben für dieses Risiko</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
