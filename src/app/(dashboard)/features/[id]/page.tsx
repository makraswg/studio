
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  Tag, 
  Activity, 
  Building2, 
  Layers, 
  Workflow, 
  AlertTriangle, 
  CheckCircle2, 
  Network, 
  Clock, 
  Zap, 
  Info, 
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Settings2,
  FileText,
  ArrowRightCircle,
  ArrowLeftCircle,
  Database,
  Shield,
  Briefcase,
  GitBranch,
  X,
  Scale,
  CheckCircle,
  ClipboardList,
  Target,
  MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Feature, FeatureLink, FeatureDependency, Process, Resource, Risk, RiskMeasure, 
  Department, JobTitle, FeatureProcessLink, UsageTypeOption, ProcessVersion, Task
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { linkFeatureToProcessAction, unlinkFeatureFromProcessAction } from '@/app/actions/feature-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { usePlatformAuth } from '@/context/auth-context';

export default function FeatureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // Link Form State
  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [selectedUsageType, setSelectedUsageType] = useState('');
  const [selectedCriticality, setSelectedCriticality] = useState<'low' | 'medium' | 'high'>('low');

  const { data: features, isLoading: isFeatLoading, refresh: refreshFeature } = usePluggableCollection<Feature>('features');
  const { data: processLinks, refresh: refreshProcLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: links, refresh: refreshLinks } = usePluggableCollection<FeatureLink>('feature_links');
  const { data: dependencies, refresh: refreshDeps } = usePluggableCollection<FeatureDependency>('feature_dependencies');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: usageTypes } = usePluggableCollection<UsageTypeOption>('usage_type_options');
  const { data: tasks, refresh: refreshTasks } = usePluggableCollection<Task>('tasks');

  useEffect(() => { setMounted(true); }, []);

  const feature = useMemo(() => features?.find(f => f.id === id), [features, id]);
  const relatedProcLinks = useMemo(() => processLinks?.filter((l: any) => l.featureId === id) || [], [processLinks, id]);
  const relatedLinks = useMemo(() => links?.filter(l => l.featureId === id) || [], [links, id]);
  const relatedTasks = useMemo(() => tasks?.filter(t => t.entityId === id && t.entityType === 'feature') || [], [tasks, id]);

  const linkedRisks = useMemo(() => relatedLinks.filter(l => l.targetType === 'risk').map(l => risks?.find(r => r.id === l.targetId)).filter(Boolean), [relatedLinks, risks]);
  const mitigatingMeasures = useMemo(() => {
    const riskIds = linkedRisks.map(r => r?.id);
    return measures?.filter(m => m.riskIds.some(rid => riskIds.includes(rid))) || [];
  }, [linkedRisks, measures]);

  const handleLinkProcess = async () => {
    if (!selectedProcessId || !selectedUsageType || !selectedNodeId) {
      toast({ variant: "destructive", title: "Fehler", description: "Prozess, Arbeitsschritt und Nutzungstyp sind erforderlich." });
      return;
    }
    setIsLinking(true);
    try {
      await linkFeatureToProcessAction({
        featureId: id as string,
        processId: selectedProcessId,
        nodeId: selectedNodeId,
        usageType: selectedUsageType,
        criticality: selectedCriticality
      } as any, dataSource);
      toast({ title: "Prozessschritt verknüpft" });
      refreshProcLinks();
      refreshFeature();
      setSelectedProcessId('');
      setSelectedNodeId('');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkProcess = async (linkId: string) => {
    await unlinkFeatureFromProcessAction(linkId, id as string, dataSource);
    toast({ title: "Verknüpfung entfernt" });
    refreshProcLinks();
    refreshFeature();
  };

  const currentProcessNodes = useMemo(() => {
    if (!selectedProcessId || !versions) return [];
    const ver = versions.find(v => v.process_id === selectedProcessId);
    return ver?.model_json?.nodes?.filter(n => n.type === 'step') || [];
  }, [selectedProcessId, versions]);

  if (!mounted) return null;

  if (isFeatLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Governance-Daten...</p></div>;
  }

  if (!feature) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold text-slate-900">Merkmal nicht gefunden</h2><Button onClick={() => router.push('/features')}>Zurück zur Übersicht</Button></div>;
  }

  const dept = departments?.find(d => d.id === feature.deptId);
  const owner = jobTitles?.find(j => j.id === feature.ownerId);

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/features')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{feature.name}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                feature.status === 'active' ? "bg-emerald-50 text-emerald-700" : feature.status === 'open_questions' ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
              )}>{feature.status.replace('_', ' ')}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Träger: {feature.carrier}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs" onClick={() => {
            saveTaskAction({
              tenantId: feature.tenantId,
              title: `Überprüfung Merkmal: ${feature.name}`,
              description: `Fachliche Prüfung der Definition und Nutzungskontexte erforderlich.`,
              entityType: 'feature',
              entityId: feature.id,
              assigneeId: user?.id || ''
            }, dataSource, user?.email || 'system').then(() => {
              toast({ title: "Prüfungs-Aufgabe erstellt" });
              refreshTasks();
            });
          }}>
            <ClipboardList className="w-3.5 h-3.5 mr-2" /> Aufgabe erstellen
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6">
            <Zap className="w-3.5 h-3.5 mr-2" /> KI Audit
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verantwortung & Kritikalität</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verantwortliche Abteilung</p>
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                    <Building2 className="w-4 h-4 text-primary" /> {dept?.name || '---'}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verantwortliche Rolle</p>
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> {owner?.name || '---'}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Bewertungsergebnis</p>
                <div className={cn(
                  "p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all",
                  feature.criticality === 'high' ? "bg-red-50 border-red-100 text-red-700" : 
                  feature.criticality === 'medium' ? "bg-orange-50 border-orange-100 text-orange-700" : 
                  "bg-emerald-50 border-emerald-100 text-emerald-700"
                )}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase">{feature.criticality} ({feature.criticalityScore} Pkt.)</span>
                    <span className="text-[8px] font-bold opacity-70 italic">Matrix Score</span>
                  </div>
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-indigo-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Aktive Aufgaben</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {relatedTasks.filter(t => t.status !== 'done').map(t => (
                <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-indigo-300 transition-all" onClick={() => router.push('/tasks')}>
                  <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{t.title}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <Badge className="bg-indigo-600 text-white border-none rounded-full text-[7px] font-black px-1.5 h-3.5">{t.status}</Badge>
                    <span className="text-[8px] font-bold text-slate-400 italic">{t.dueDate || 'Keine Frist'}</span>
                  </div>
                </div>
              ))}
              {relatedTasks.filter(t => t.status !== 'done').length === 0 && (
                <div className="text-center py-6 opacity-30">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[9px] font-bold uppercase">Keine offenen Tasks</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1">
              <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><Info className="w-3.5 h-3.5" /> Überblick</TabsTrigger>
              <TabsTrigger value="context" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><GitBranch className="w-3.5 h-3.5" /> Prozess-Kontext</TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><ClipboardList className="w-3.5 h-3.5" /> Aufgaben</TabsTrigger>
              <TabsTrigger value="impact" className="rounded-lg px-6 gap-2 text-[11px] font-bold text-primary data-[state=active]:bg-white data-[state=active]:shadow-sm"><Zap className="w-3.5 h-3.5" /> Impact-Analyse</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <CardTitle className="text-sm font-bold">Definition & Zweck</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Beschreibung</Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">{feature.description || 'Keine fachliche Beschreibung hinterlegt.'}</p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Zweck der Erfassung</Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{feature.purpose || 'Der Zweck wurde noch nicht explizit dokumentiert.'}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="context" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Workflow className="w-5 h-5 text-indigo-600" />
                      <div>
                        <CardTitle className="text-sm font-bold">Zugeordnete Prozessschritte</CardTitle>
                        <CardDescription className="text-[10px] font-bold">Verwendung in operativen Abläufen.</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-4">
                    {relatedProcLinks.map((link: any) => {
                      const proc = processes?.find(p => p.id === link.processId);
                      const ver = versions?.find(v => v.process_id === link.processId);
                      const node = ver?.model_json?.nodes?.find(n => n.id === link.nodeId);
                      return (
                        <div key={link.id} className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm hover:border-indigo-300 transition-all group">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner"><Workflow className="w-5 h-5" /></div>
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase text-slate-400 tracking-widest">{proc?.title || 'Prozess'}</p>
                              <p className="text-sm font-bold text-slate-800 truncate">{node?.title || 'Unbekannter Schritt'}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-indigo-100 text-indigo-600">{link.usageType}</Badge>
                                <Badge className={cn(
                                  "text-[8px] font-black uppercase border-none",
                                  link.criticality === 'high' ? "bg-red-50 text-red-600" : link.criticality === 'medium' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                                )}>{link.criticality}</Badge>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleUnlinkProcess(link.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}

                    <div className="p-6 border-2 border-dashed rounded-2xl bg-slate-50/50 space-y-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Arbeitsschritt verknüpfen</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">1. Prozess wählen</Label>
                          <Select value={selectedProcessId} onValueChange={(val) => { setSelectedProcessId(val); setSelectedNodeId(''); }}>
                            <SelectTrigger className="rounded-xl h-10 border-slate-200 bg-white"><SelectValue placeholder="Prozess..." /></SelectTrigger>
                            <SelectContent>
                              {processes?.filter(p => activeTenantId === 'all' || p.tenantId === activeTenantId).map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">2. Arbeitsschritt wählen</Label>
                          <Select value={selectedNodeId} onValueChange={setSelectedNodeId} disabled={!selectedProcessId}>
                            <SelectTrigger className="rounded-xl h-10 border-slate-200 bg-white"><SelectValue placeholder="Schritt..." /></SelectTrigger>
                            <SelectContent>
                              {currentProcessNodes.map(n => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">3. Nutzungstyp</Label>
                          <Select value={selectedUsageType} onValueChange={setSelectedUsageType}>
                            <SelectTrigger className="rounded-xl h-10 border-slate-200 bg-white"><SelectValue placeholder="Nutzungstyp..." /></SelectTrigger>
                            <SelectContent>
                              {usageTypes?.filter(o => o.enabled).map(opt => <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-slate-400">4. Kritikalität</Label>
                          <Select value={selectedCriticality} onValueChange={(v: any) => setSelectedCriticality(v)}>
                            <SelectTrigger className="rounded-xl h-10 border-slate-200 bg-white"><SelectValue placeholder="Kritikalität..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Niedrig</SelectItem>
                              <SelectItem value="medium">Mittel</SelectItem>
                              <SelectItem value="high">Hoch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button className="w-full rounded-xl h-10 font-bold text-xs gap-2 shadow-lg" onClick={handleLinkProcess} disabled={isLinking || !selectedProcessId || !selectedNodeId || !selectedUsageType}>
                        {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Verknüpfung erstellen
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    <div>
                      <CardTitle className="text-sm font-bold">Verknüpfte Aufgaben</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Maßnahmen und Klärungsbedarfe</CardDescription>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2" onClick={() => router.push('/tasks')}>
                    Alle Aufgaben <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-3">
                    {relatedTasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:border-indigo-300 transition-all cursor-pointer group" onClick={() => router.push('/tasks')}>
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm",
                            t.status === 'done' ? "bg-emerald-500" : t.priority === 'critical' ? "bg-red-600" : "bg-indigo-600"
                          )}>
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{t.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-slate-200">{t.status}</Badge>
                              <span className="text-[9px] text-slate-400 font-medium">Zugeordnet: {t.assigneeId ? 'Verantwortlicher' : 'Offen'}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                    {relatedTasks.length === 0 && (
                      <div className="py-12 text-center border-2 border-dashed rounded-2xl opacity-30">
                        <CheckCircle className="w-10 h-10 mx-auto mb-3" />
                        <p className="text-xs font-bold uppercase">Keine Aufgaben verknüpft</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="impact" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg"><Zap className="w-5 h-5" /></div>
                      <div>
                        <CardTitle className="text-base font-headline font-bold">Impact Analysis</CardTitle>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Risikobewertung im Kontext der Merkmalsnutzung</p>
                      </div>
                    </div>
                    <Badge className="bg-white/10 text-white border-none rounded-full px-3 h-6 text-[10px] font-black uppercase tracking-widest">Active Analysis</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl space-y-4 shadow-inner">
                      <h4 className="text-xs font-black uppercase text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Risikopotenzial
                      </h4>
                      <div className="space-y-3">
                        {linkedRisks.map(r => (
                          <div key={r?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-xl border border-red-100 dark:border-red-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-red-600 text-white border-none rounded-md text-[9px] font-black h-5 px-2">{r?.impact * r?.probability}</Badge>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{r?.title}</span>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => router.push(`/risks?search=${r?.title}`)}><ExternalLink className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                        {linkedRisks.length === 0 && <p className="text-[11px] text-slate-500 italic">Keine direkt verknüpften Risiken gefunden.</p>}
                      </div>
                    </div>

                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-4 shadow-inner">
                      <h4 className="text-xs font-black uppercase text-emerald-700 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Bestehende Kontrollen
                      </h4>
                      <div className="space-y-3">
                        {mitigatingMeasures.map(m => (
                          <div key={m?.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /></div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">{m?.title}</span>
                            </div>
                            <Badge variant="outline" className="text-[8px] font-black uppercase text-emerald-600 border-emerald-100">{m?.status}</Badge>
                          </div>
                        ))}
                        {mitigatingMeasures.length === 0 && <p className="text-[11px] text-slate-500 italic">Keine aktiven Kontrollen für dieses Merkmal.</p>}
                      </div>
                    </div>
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
