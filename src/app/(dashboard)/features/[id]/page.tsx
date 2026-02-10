
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
  Clock, 
  Zap, 
  Info, 
  ArrowRight,
  ShieldCheck,
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
  Save,
  Server,
  HardDrive
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Feature, FeatureLink, Process, Resource, Risk, RiskMeasure, 
  Department, JobTitle, ProcessVersion, Task, PlatformUser, ProcessNode, DataStore
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveTaskAction } from '@/app/actions/task-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function FeatureDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);

  // Form States
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');

  const { data: features, isLoading: isFeatLoading } = usePluggableCollection<Feature>('features');
  const { data: processLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: tasks, refresh: refreshTasks } = usePluggableCollection<Task>('tasks');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: allResources } = usePluggableCollection<Resource>('resources');

  useEffect(() => { setMounted(true); }, []);

  const feature = useMemo(() => features?.find(f => f.id === id), [features, id]);
  const relatedProcLinks = useMemo(() => processLinks?.filter((l: any) => l.featureId === id) || [], [processLinks, id]);
  const relatedTasks = useMemo(() => tasks?.filter(t => t.entityId === id && t.entityType === 'feature') || [], [tasks, id]);

  const indirectResources = useMemo(() => {
    if (!relatedProcLinks || !versions || !allResources) return [];
    const resourceIds = new Set<string>();
    relatedProcLinks.forEach((link: any) => {
      const ver = versions.find(v => v.process_id === link.processId);
      const node = ver?.model_json?.nodes?.find((n: ProcessNode) => n.id === link.nodeId);
      if (node?.resourceIds) node.resourceIds.forEach(rid => resourceIds.add(rid));
    });
    return Array.from(resourceIds).map(rid => allResources.find(r => r.id === rid)).filter(Boolean);
  }, [relatedProcLinks, versions, allResources]);

  const handleCreateTask = async () => {
    if (!taskTitle || !taskAssigneeId) return;
    setIsSavingTask(true);
    try {
      await saveTaskAction({
        tenantId: feature?.tenantId || 'global',
        title: taskTitle, status: 'todo', assigneeId: taskAssigneeId,
        creatorId: user?.id || 'system', entityType: 'feature', entityId: id as string
      }, dataSource);
      toast({ title: "Aufgabe erstellt" });
      setIsTaskDialogOpen(false);
      refreshTasks();
    } finally { setIsSavingTask(false); }
  };

  if (!mounted) return null;

  if (isFeatLoading) return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Daten...</p></div>;
  if (!feature) return null;

  const dept = departments?.find(d => d.id === feature.deptId);
  const owner = jobTitles?.find(j => j.id === feature.ownerId);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/features')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{feature.name}</h1>
              <Badge className="rounded-full px-3 h-6 text-[9px] font-black uppercase bg-primary/10 text-primary border-none shadow-sm">{feature.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
              <Database className="w-3 h-3" /> Daten-Governance • Träger: {feature.carrier}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-indigo-200 text-indigo-700 shadow-sm" onClick={() => setIsTaskDialogOpen(true)}><ClipboardList className="w-4 h-4 mr-2" /> Aufgabe</Button>
          <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-primary text-white shadow-lg active:scale-95 transition-all">Bearbeiten</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Daten-Klassifizierung</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col items-center text-center group-hover:scale-[1.02] transition-transform duration-500">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Matrix Kritikalität</span>
                <p className={cn("text-4xl font-black uppercase", feature.criticality === 'high' ? "text-red-600" : "text-emerald-600")}>{feature.criticality}</p>
                <Badge variant="outline" className="mt-2 h-5 px-2 bg-white text-[8px] font-black">{feature.criticalityScore} Punkte</Badge>
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Zuständige Abteilung</Label>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{dept?.name || '---'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Data Owner</Label>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{owner?.name || '---'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 h-14 rounded-2xl border w-full justify-start gap-2 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Info className="w-4 h-4" /> Analyse
              </TabsTrigger>
              <TabsTrigger value="context" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Workflow className="w-4 h-4" /> Prozesse & Systeme
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <ClipboardList className="w-4 h-4" /> Aufgaben ({relatedTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-8"><CardTitle className="text-lg font-headline font-bold uppercase text-slate-900 dark:text-white">Fachliche Definition</CardTitle></CardHeader>
                <CardContent className="p-10 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Zweck & Beschreibung</Label>
                    <p className="text-sm font-medium leading-relaxed italic bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">"{feature.description}"</p>
                  </div>
                  <div className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-4">
                    <Info className="w-6 h-6 text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300">{feature.purpose}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="context" className="space-y-8 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6"><CardTitle className="text-sm font-bold uppercase text-slate-900 dark:text-white">Operative Workflows</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {relatedProcLinks.map((link: any) => (
                        <div key={link.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => router.push(`/processhub/view/${link.processId}`)}>
                          <div className="flex items-center gap-3"><Workflow className="w-4 h-4 text-indigo-400" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{processes?.find(p => p.id === link.processId)?.title}</span></div>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6"><CardTitle className="text-sm font-bold uppercase text-slate-900 dark:text-white">IT-Systeme (Geerbt)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {indirectResources.map(res => (
                        <div key={res?.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => router.push(`/resources/${res?.id}`)}>
                          <div className="flex items-center gap-3"><Server className="w-4 h-4 text-slate-400" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{res?.name}</span></div>
                          <Badge variant="outline" className="text-[7px] font-black uppercase h-4 border-slate-200">{res?.assetType}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="animate-in fade-in">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {relatedTasks.map(t => (
                      <div key={t.id} className="p-6 px-10 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center justify-between group cursor-pointer" onClick={() => router.push('/tasks')}>
                        <div className="flex items-center gap-6">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg", t.status === 'done' ? "bg-emerald-500" : "bg-indigo-600")}>
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <div><p className="text-sm font-black text-slate-800 dark:text-slate-100">{t.title}</p><p className="text-[10px] text-slate-400 uppercase font-bold">Status: {t.status}</p></div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                    {relatedTasks.length === 0 && <div className="py-20 text-center text-xs text-slate-400 uppercase tracking-widest opacity-30">Keine Aufgaben gefunden</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-800 border-b shrink-0">
            <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">Aufgabe erstellen</DialogTitle>
            <DialogDescription className="text-[10px] text-slate-400 font-bold">Referenz: {feature.name}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="h-11 rounded-xl font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortlicher</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>{pUsers?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-800 border-t">
            <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCreateTask} disabled={isSavingTask || !taskTitle} className="bg-primary text-white font-bold text-xs h-11 px-8 rounded-xl shadow-lg">
              {isSavingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
