
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  Loader2, 
  Server, 
  Activity, 
  ShieldCheck, 
  Workflow, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Target, 
  ArrowRight,
  Database,
  ExternalLink,
  Shield,
  Info,
  CalendarDays,
  User as UserIcon,
  Tag,
  Scale,
  Settings2,
  Clock,
  BadgeCheck,
  Zap,
  ArrowUp,
  UserCircle,
  Briefcase,
  Building2,
  Mail,
  RotateCcw,
  Globe,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Save,
  Fingerprint,
  KeyRound,
  ShieldX,
  HardDrive,
  ClipboardList,
  History,
  Phone,
  MapPin,
  ListChecks,
  CheckCircle,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Resource, Process, ProcessVersion, ProcessNode, Risk, RiskMeasure, ProcessingActivity, Feature, JobTitle, ServicePartner, ServicePartnerContact, ServicePartnerArea, Department, Entitlement, BackupJob, ResourceUpdateProcess, Task, PlatformUser 
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveTaskAction } from '@/app/actions/task-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ResourceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { activeTenantId, dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);

  // Task Dialog State
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  const { data: resources, isLoading: isResLoading } = usePluggableCollection<Resource>('resources');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: backupJobs } = usePluggableCollection<BackupJob>('backup_jobs');
  const { data: updateLinks } = usePluggableCollection<ResourceUpdateProcess>('resource_update_processes');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: partners } = usePluggableCollection<ServicePartner>('servicePartners');
  const { data: contacts } = usePluggableCollection<ServicePartnerContact>('servicePartnerContacts');
  const { data: areas } = usePluggableCollection<ServicePartnerArea>('servicePartnerAreas');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: features } = usePluggableCollection<Feature>('features');
  const { data: featureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: tasks, refresh: refreshTasks } = usePluggableCollection<Task>('tasks');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');

  useEffect(() => { setMounted(true); }, []);

  const resource = useMemo(() => resources?.find(r => r.id === id), [resources, id]);
  const resourceRoles = useMemo(() => entitlements?.filter(e => e.resourceId === id) || [], [entitlements, id]);
  const resourceBackups = useMemo(() => backupJobs?.filter(b => b.resourceId === id) || [], [backupJobs, id]);
  const resourceUpdates = useMemo(() => {
    const linkIds = updateLinks?.filter(u => u.resourceId === id).map(u => u.processId) || [];
    return processes?.filter(p => linkIds.includes(p.id)) || [];
  }, [updateLinks, processes, id]);

  const resourceRisks = useMemo(() => risks?.filter(r => r.assetId === id) || [], [risks, id]);
  const resourceTasks = useMemo(() => tasks?.filter(t => t.entityId === id && t.entityType === 'resource') || [], [tasks, id]);
  
  const inheritedData = useMemo(() => {
    if (!resource || !versions || !featureLinks || !features) return null;
    const usedInProcessIds = new Set<string>();
    versions.forEach(v => {
      const nodes = v.model_json?.nodes || [];
      if (nodes.some(n => n.resourceIds?.includes(resource.id))) {
        usedInProcessIds.add(v.process_id);
      }
    });
    const linkedFeatureIds = new Set<string>();
    featureLinks.forEach((link: any) => {
      if (usedInProcessIds.has(link.processId)) {
        linkedFeatureIds.add(link.featureId);
      }
    });
    const linkedFeatures = Array.from(linkedFeatureIds).map(fid => features.find(f => f.id === fid)).filter(Boolean) as Feature[];
    if (linkedFeatures.length === 0) return null;
    const hasPersonalData = linkedFeatures.some(f => !!f.hasPersonalData);
    const classificationOrder = { strictly_confidential: 4, confidential: 3, internal: 2, public: 1 };
    let maxClass: Resource['dataClassification'] = 'internal';
    let maxVal = 0;
    linkedFeatures.forEach(f => {
      const v = classificationOrder[f.dataClassification as keyof typeof classificationOrder] || 0;
      if (v > maxVal) {
        maxVal = v;
        maxClass = f.dataClassification as any;
      }
    });
    const reqOrder = { high: 3, medium: 2, low: 1 };
    const getReq = (prop: 'confidentialityReq' | 'integrityReq' | 'availabilityReq') => {
      let maxReq: 'low' | 'medium' | 'high' = 'low';
      let maxV = 0;
      linkedFeatures.forEach(f => {
        const val = reqOrder[f[prop] as keyof typeof reqOrder] || 0;
        if (val > maxV) { maxV = val; maxReq = f[prop] as any; }
      });
      return maxReq;
    };
    return { 
      hasPersonalData, 
      dataClassification: maxClass, 
      confidentialityReq: getReq('confidentialityReq'), 
      integrityReq: getReq('integrityReq'), 
      availabilityReq: getReq('availabilityReq'), 
      featureCount: linkedFeatures.length, 
      processCount: usedInProcessIds.size 
    };
  }, [resource, versions, featureLinks, features]);

  const inheritedCriticality = useMemo(() => {
    if (resourceRisks.length === 0) return 'low';
    const maxScore = Math.max(...resourceRisks.map(r => r.impact * r.probability));
    if (maxScore >= 15) return 'high';
    if (maxScore >= 8) return 'medium';
    return 'low';
  }, [resourceRisks]);

  const internalOwner = useMemo(() => jobTitles?.find(j => j.id === resource?.systemOwnerRoleId), [jobTitles, resource]);
  const internalRiskOwner = useMemo(() => jobTitles?.find(j => j.id === resource?.riskOwnerRoleId), [jobTitles, resource]);
  const externalPartner = useMemo(() => partners?.find(p => p.id === resource?.externalOwnerPartnerId), [partners, resource]);
  const externalContact = useMemo(() => contacts?.find(c => c.id === resource?.externalOwnerContactId), [contacts, resource]);
  const externalArea = useMemo(() => areas?.find(a => a.id === resource?.externalOwnerAreaId), [areas, resource]);

  const handleCreateTask = async () => {
    if (!taskTitle || !taskAssigneeId) {
      toast({ variant: "destructive", title: "Fehler", description: "Titel und Verantwortlicher sind erforderlich." });
      return;
    }
    setIsSavingTask(true);
    try {
      const res = await saveTaskAction({
        tenantId: resource?.tenantId || activeTenantId || 'global',
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        assigneeId: taskAssigneeId,
        dueDate: taskDueDate,
        entityType: 'resource',
        entityId: id as string,
        creatorId: user?.id || 'system',
        status: 'todo'
      }, dataSource, user?.email || 'system');

      if (res.success) {
        toast({ title: "Aufgabe erstellt" });
        setIsTaskDialogOpen(false);
        setTaskTitle('');
        setTaskDesc('');
        setTaskAssigneeId('');
        refreshTasks();
      }
    } finally {
      setIsSavingTask(false);
    }
  };

  if (!mounted) return null;

  if (isResLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Asset-Kontext...</p></div>;
  }

  if (!resource) {
    return (
      <div className="p-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-headline font-bold text-slate-900">Ressource nicht gefunden</h2>
        <Button onClick={() => router.push('/resources')}>Zurück zum Katalog</Button>
      </div>
    );
  }

  const finalGDPR = inheritedData ? inheritedData.hasPersonalData : !!resource.hasPersonalData;
  const finalClass = inheritedData ? inheritedData.dataClassification : resource.dataClassification;
  const finalC = inheritedData ? inheritedData.confidentialityReq : resource.confidentialityReq;
  const finalI = inheritedData ? inheritedData.integrityReq : resource.integrityReq;
  const finalA = inheritedData ? inheritedData.availabilityReq : resource.availabilityReq;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/resources')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{resource.name}</h1>
              <Badge className="rounded-full px-3 h-6 text-[10px] font-black uppercase bg-primary/10 text-primary border-none shadow-sm">{resource.assetType}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <Building2 className="w-3 h-3" /> Asset-Management • {resource.operatingModel}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs px-6 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm transition-all active:scale-95" onClick={() => setIsTaskDialogOpen(true)}>
            <ClipboardList className="w-4 h-4 mr-2" /> Aufgabe erstellen
          </Button>
          <Button size="sm" className="h-10 rounded-xl font-bold text-xs px-8 bg-primary text-white shadow-lg shadow-primary/20 active:scale-95 transition-all" onClick={() => router.push(`/resources?edit=${resource.id}`)}>
            <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-[2rem] border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Sicherheitszustand</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="p-6 rounded-[1.5rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col items-center text-center group-hover:scale-[1.02] transition-transform duration-500">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Effektive Kritikalität</span>
                <p className={cn(
                  "text-4xl font-black uppercase tracking-tighter", 
                  inheritedCriticality === 'high' ? "text-red-600" : inheritedCriticality === 'medium' ? "text-orange-600" : "text-emerald-600"
                )}>
                  {inheritedCriticality}
                </p>
                <div className="flex items-center gap-2 mt-3 text-[9px] font-bold text-slate-400 uppercase bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-slate-100">
                  <Zap className="w-3 h-3 text-primary fill-current" /> Erbe: Risikolage
                </div>
              </div>
              
              <div className="space-y-6 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Daten-Klassifizierung</p>
                  {inheritedData && <Badge className="bg-blue-600 text-white border-none text-[8px] font-black h-5 px-3 uppercase tracking-widest shadow-lg shadow-blue-200">Dynamisch</Badge>}
                </div>
                
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border-2 border-slate-50 dark:border-slate-800 shadow-sm flex items-center justify-center">
                  <span className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    finalClass === 'strictly_confidential' ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {finalClass?.replace('_', ' ') || 'internal'}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'C', val: finalC },
                    { label: 'I', val: finalI },
                    { label: 'A', val: finalA }
                  ].map((req) => (
                    <div key={req.label} className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <span className="text-[8px] font-black text-slate-400 uppercase mb-1.5">{req.label}</span>
                      <span className={cn(
                        "text-xs font-black", 
                        req.val === 'high' ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'
                      )}>
                        {String(req.val)?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex justify-between items-center group/row">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover/row:text-primary transition-colors">DSGVO RELEVANZ</span>
                  <Badge className={cn(
                    "h-5 px-2 text-[8px] font-black border-none transition-all", 
                    finalGDPR ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" : "bg-slate-100 text-slate-400"
                  )}>
                    {finalGDPR ? 'JA' : 'NEIN'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center group/row">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover/row:text-orange-600 transition-colors">BACKUP PFLICHT</span>
                  <Badge className={cn(
                    "h-5 px-2 text-[8px] font-black border-none transition-all", 
                    resource.backupRequired ? "bg-orange-500 text-white shadow-lg shadow-orange-100" : "bg-slate-100 text-slate-400"
                  )}>
                    {resource.backupRequired ? 'AKTIV' : 'N/A'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-2 border-primary/20 shadow-2xl bg-primary/5 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -mr-12 -mt-12 blur-2xl" />
            <CardContent className="p-10 space-y-8 relative z-10">
              <div className="w-14 h-14 bg-primary rounded-[1.25rem] flex items-center justify-center shadow-lg border border-white/10 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-headline font-black uppercase tracking-tight leading-none text-slate-900 dark:text-white">Compliance Hub</h3>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">Integrity Level</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                  <span>Dokumentationsgrad</span>
                  <span className="text-emerald-600">100%</span>
                </div>
                <Progress value={100} className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic font-medium">
                  Status: Audit-Ready. Die Kritikalität wurde automatisch aus der Datenlast der verknüpften Geschäftsprozesse abgeleitet.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1.5 h-14 rounded-2xl border w-full justify-start gap-2 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-xl px-8 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Info className="w-4 h-4" /> Überblick
              </TabsTrigger>
              <TabsTrigger value="ownership" className="rounded-xl px-8 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Building2 className="w-4 h-4 text-primary" /> Ownership
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-xl px-8 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Settings2 className="w-4 h-4 text-orange-600" /> Wartung & Backup
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-xl px-8 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <ClipboardList className="w-4 h-4 text-indigo-600" /> Aufgaben ({resourceTasks.length})
              </TabsTrigger>
              <TabsTrigger value="roles" className="rounded-xl px-8 gap-3 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <KeyRound className="w-4 h-4 text-slate-500" /> Systemrollen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-[2rem] border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-slate-950 rounded-2xl flex items-center justify-center shadow-md border border-slate-100">
                      <Database className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-headline font-bold uppercase tracking-tight">Stammdaten & Asset-Kontext</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Technische und logische Einordnung</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-10 space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div className="space-y-2 group/field">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-hover/field:text-primary transition-colors">Kategorie</Label>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">{resource.category || '---'}</p>
                      </div>
                      <div className="space-y-2 group/field">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-hover/field:text-primary transition-colors">Technischer Standort</Label>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <MapPin className="w-4 h-4 text-slate-300" /> {resource.dataLocation || 'Nicht spezifiziert'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="space-y-2 group/field">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-hover/field:text-primary transition-colors">Anmelde-Infrastruktur (IdP)</Label>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <Fingerprint className="w-4 h-4 text-primary" /> {resource.isIdentityProvider ? 'Eigenes IdP-System' : 'Externer Directory-Dienst'}
                        </div>
                      </div>
                      <div className="space-y-2 group/field">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest group-hover/field:text-primary transition-colors">Service URL</Label>
                        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          {resource.url && resource.url !== '#' ? (
                            <a href={resource.url} target="_blank" className="text-sm font-bold text-primary flex items-center gap-2 hover:underline">
                              {resource.url} <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Keine URL hinterlegt</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fachliche Bestimmung & Notizen</Label>
                    <div className="relative group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-200 dark:bg-slate-800 rounded-full" />
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50/50 dark:bg-slate-950/50 p-8 rounded-[1.5rem] shadow-inner italic pl-10">
                        {resource.notes || 'Keine detaillierte Beschreibung hinterlegt.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ownership" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-[2rem] border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
                  <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/10 group-hover:rotate-3 transition-transform duration-500">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-headline font-black uppercase tracking-widest text-slate-900 dark:text-white">Interne Verantwortung</CardTitle>
                        <CardDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Governance & Business Owner</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] flex items-center gap-5 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-300 shadow-sm">
                      <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-primary shadow-md border border-slate-100"><UserCircle className="w-8 h-8" /></div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">System Owner</p>
                        <p className="text-base font-black text-slate-800 dark:text-slate-100 truncate">{internalOwner?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                    <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] flex items-center gap-5 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-300 shadow-sm">
                      <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-accent shadow-md border border-slate-100"><ShieldAlert className="w-8 h-8" /></div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Risk Owner</p>
                        <p className="text-base font-black text-slate-800 dark:text-slate-100 truncate">{internalRiskOwner?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
                  <CardHeader className="bg-indigo-50 dark:bg-indigo-900/20 border-b p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-slate-950 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-800 group-hover:-rotate-3 transition-transform duration-500">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-headline font-black uppercase tracking-widest text-slate-900 dark:text-white">Externer Betrieb</CardTitle>
                        <CardDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dienstleister & Support</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="p-6 bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-[1.5rem] space-y-2 shadow-inner">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Service Partner</p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-black text-indigo-900 dark:text-indigo-300 tracking-tight">{externalPartner?.name || 'Kein Partner'}</p>
                        {externalPartner?.website && <a href={externalPartner.website} target="_blank" className="text-indigo-400 hover:text-indigo-600 transition-all hover:scale-110"><ExternalLink className="w-5 h-5" /></a>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-200 transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><UserIcon className="w-5 h-5" /></div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{externalContact?.name || 'Kein Kontakt'}</p>
                          <p className="text-[9px] text-slate-400 font-medium truncate italic mt-0.5">{externalContact?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:border-indigo-200 transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 border border-slate-100 shadow-inner"><Briefcase className="w-5 h-5" /></div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{externalArea?.name || 'Kein Fachbereich'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-[2rem] border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-orange-50/50 dark:bg-orange-950/20 border-b p-8 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 shadow-lg border border-orange-200 dark:border-orange-800">
                      <HardDrive className="w-7 h-7" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-headline font-black uppercase tracking-widest text-orange-900 dark:text-orange-300">Datensicherung (Backup)</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-orange-600/60">Business Continuity Management</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white dark:bg-slate-900 border-orange-200 text-orange-700 font-black text-[10px] px-4 h-7 rounded-full shadow-sm">{resourceBackups.length} Jobs aktiv</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resourceBackups.map(job => {
                      const itProc = processes?.find(p => p.id === job.it_process_id);
                      const contact = contacts?.find(c => c.id === job.external_contact_id);
                      const partner = partners?.find(p => p.id === contact?.partnerId);
                      const role = jobTitles?.find(r => r.id === job.responsible_id);

                      return (
                        <div key={job.id} className="p-10 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-500 group">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
                            <div className="space-y-6 flex-1">
                              <div>
                                <h5 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3 group-hover:text-orange-600 transition-colors">
                                  {job.name} 
                                  <Badge className="bg-orange-500 text-white border-none rounded-full text-[9px] h-5 px-3 uppercase font-black shadow-lg shadow-orange-100">
                                    {job.cycle === 'Benutzerdefiniert' ? job.custom_cycle : job.cycle}
                                  </Badge>
                                </h5>
                                <p className="text-[11px] text-slate-400 font-bold uppercase mt-2 flex items-center gap-2 tracking-[0.1em]">
                                  <MapPin className="w-3.5 h-3.5 text-orange-400" /> {job.storage_location}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2 group-hover:border-orange-200 transition-all duration-500">
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Verantwortung</p>
                                  <div className="flex items-center gap-3">
                                    {job.responsible_type === 'internal' ? (
                                      <><Building2 className="w-4 h-4 text-primary" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{role?.name || 'Interner Dienst'}</span></>
                                    ) : (
                                      <><Globe className="w-4 h-4 text-indigo-600" /><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{partner?.name}: {contact?.name || 'Extern'}</span></>
                                    )}
                                  </div>
                                </div>
                                <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2 group-hover:border-orange-200 transition-all duration-500">
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Letzter Review</p>
                                  <div className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                                    <History className="w-4 h-4 text-slate-400" /> {job.lastReviewDate || 'Ungeprüft'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="w-full md:w-72 space-y-3">
                              <p className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Recovery-Leitfaden</p>
                              {itProc ? (
                                <Button variant="outline" className="w-full h-12 justify-between px-6 rounded-2xl text-[11px] font-black uppercase gap-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 shadow-sm transition-all duration-300" onClick={() => router.push(`/processhub/view/${itProc.id}`)}>
                                  <div className="flex items-center gap-3"><Workflow className="w-4 h-4" /> Workflow</div>
                                  <ArrowRight className="w-4 h-4 opacity-30" />
                                </Button>
                              ) : (
                                <div className="text-[10px] text-slate-300 font-bold uppercase text-center py-6 border-2 border-dashed rounded-[1.5rem] bg-slate-50/50 dark:bg-slate-900/50">
                                  <ShieldX className="w-6 h-6 mx-auto mb-2 opacity-20" />
                                  Kein Prozess
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {resourceBackups.length === 0 && (
                      <div className="py-32 text-center opacity-30 italic space-y-4">
                        <HardDrive className="w-16 h-16 mx-auto text-slate-300" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">Keine Backup-Jobs konfiguriert</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 border-b p-8 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shadow-lg border border-blue-200 dark:border-blue-800">
                      <Activity className="w-7 h-7" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-headline font-black uppercase tracking-widest text-blue-900 dark:text-blue-300">Patch-Management (Updates)</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-blue-600/60">Sicherstellung der System-Aktualität</CardDescription>
                    </div>
                  </div>
                  <Badge className={cn(
                    "rounded-full px-4 h-7 text-[10px] font-black border-none shadow-sm transition-all duration-500", 
                    resource.updatesRequired ? "bg-blue-500 text-white shadow-blue-100" : "bg-slate-100 text-slate-400"
                  )}>
                    {resource.updatesRequired ? 'AKTIV' : 'N/A'}
                  </Badge>
                </CardHeader>
                <CardContent className="p-10">
                  {resource.updatesRequired ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {resourceUpdates.map(p => (
                        <div key={p.id} className="p-6 bg-slate-50 dark:bg-slate-950 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-blue-300 hover:bg-white dark:hover:bg-slate-900 transition-all duration-500 cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform duration-500"><Workflow className="w-6 h-6" /></div>
                            <div>
                              <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{p.title}</span>
                              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Patching-Workflow</p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-2" />
                        </div>
                      ))}
                      {resourceUpdates.length === 0 && <div className="col-span-full py-20 text-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] border-2 border-dashed rounded-[2rem] bg-slate-50/30 dark:bg-slate-950/30 italic">Keine Update-Prozesse verknüpft</div>}
                    </div>
                  ) : (
                    <div className="p-32 text-center border-2 border-dashed rounded-[3rem] opacity-20 bg-slate-50/30 dark:bg-slate-950/30">
                      <ShieldX className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <p className="text-sm font-black uppercase tracking-[0.3em]">Kein Patch-Bedarf definiert</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-[2.5rem] border shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-8 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shadow-lg border border-indigo-200 dark:border-indigo-800">
                      <ClipboardList className="w-7 h-7" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-headline font-black uppercase tracking-widest">Operative Aufgaben</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/60">Wartung, Audit & Monitoring</CardDescription>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-10 rounded-xl text-[10px] font-black uppercase gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm transition-all" onClick={() => setIsTaskDialogOpen(true)}>
                    <Plus className="w-4 h-4" /> Neue Aufgabe
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resourceTasks.map(t => (
                      <div key={t.id} className="p-6 px-10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all duration-500 flex items-center justify-between group cursor-pointer" onClick={() => router.push('/tasks')}>
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-2 group-hover:rotate-0 transition-transform duration-500",
                            t.status === 'done' ? "bg-emerald-500" : t.priority === 'critical' ? "bg-red-600" : "bg-indigo-600"
                          )}>
                            <ClipboardList className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">{t.title}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <Badge variant="outline" className="text-[9px] font-black h-5 px-2 border-slate-200 shadow-sm uppercase tracking-widest">{t.status}</Badge>
                              <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5"><Clock className="w-3 h-3" /> Fällig: {t.dueDate || '∞'}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2" />
                      </div>
                    ))}
                    {resourceTasks.length === 0 && (
                      <div className="py-32 text-center opacity-30 italic space-y-4">
                        <CheckCircle className="w-16 h-16 mx-auto text-emerald-500" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">Keine offenen Aufgaben</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-[2.5rem] border shadow-2xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 shadow-lg border border-slate-200 dark:border-slate-800">
                      <KeyRound className="w-7 h-7" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-headline font-black uppercase tracking-widest">Systemspezifische Rollen (IAM)</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grundlage für Berechtigungs-Reviews</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30 dark:bg-slate-950/30">
                      <TableRow className="border-slate-100 dark:border-slate-800">
                        <TableHead className="py-5 px-10 font-black text-[10px] uppercase text-slate-400 tracking-[0.2em]">Rollenbezeichnung</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-slate-400 text-center tracking-[0.2em]">Risiko</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-[0.2em]">Privileg-Level</TableHead>
                        <TableHead className="text-right px-10 font-black text-[10px] uppercase text-slate-400 tracking-[0.2em]">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceRoles.map(role => (
                        <TableRow key={role.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-all duration-300 cursor-pointer" onClick={() => router.push(`/roles/${role.id}`)}>
                          <TableCell className="py-6 px-10">
                            <div className="font-black text-sm text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors tracking-tight">{role.name}</div>
                            <p className="text-[10px] text-slate-400 truncate max-w-sm font-bold italic mt-1">{role.description || 'Keine Funktionsbeschreibung'}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-black h-5 px-3 border-none uppercase shadow-sm tracking-widest transition-all", 
                              role.riskLevel === 'high' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                            )}>{role.riskLevel}</Badge>
                          </TableCell>
                          <TableCell>
                            {role.isAdmin ? (
                              <Badge className="bg-red-600 text-white border-none text-[8px] font-black h-5 px-3 shadow-lg shadow-red-100 tracking-widest">PRIVILEGIERT</Badge>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Standard-Profil</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right px-10">
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-white dark:hover:bg-slate-900 shadow-md">
                              <ArrowRight className="w-5 h-5 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {resourceRoles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-32 text-center text-[11px] font-black text-slate-300 uppercase tracking-[0.3em]">
                            Keine Rollen für dieses System definiert
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] rounded-[2rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="p-8 bg-slate-50 dark:bg-slate-800 border-b shrink-0 pr-12">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-primary/10 rounded-[1.25rem] flex items-center justify-center text-primary border border-primary/10 shadow-sm">
                <ClipboardList className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-headline font-black uppercase tracking-tight truncate text-slate-900 dark:text-white">Aufgabe für Asset erstellen</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Referenz: {resource.name}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-white dark:bg-slate-900">
            <div className="p-10 space-y-10">
              <div className="space-y-3">
                <Label required className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest">Titel der Aufgabe</Label>
                <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="rounded-2xl h-14 text-base font-black border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm focus:ring-primary/20" placeholder="z.B. Backup-Integrität prüfen..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label required className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest">Verantwortlicher Admin</Label>
                  <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                    <SelectTrigger className="rounded-2xl h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold">
                      <SelectValue placeholder="Wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {pUsers?.map(u => <SelectItem key={u.id} value={u.id} className="text-xs font-bold">{u.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest">Deadline</Label>
                  <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="rounded-2xl h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest">Priorität</Label>
                  <Select value={taskPriority} onValueChange={(v: any) => setTaskPriority(v)}>
                    <SelectTrigger className="rounded-2xl h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="low" className="text-xs font-bold">Niedrig</SelectItem>
                      <SelectItem value="medium" className="text-xs font-bold">Mittel</SelectItem>
                      <SelectItem value="high" className="text-xs font-bold">Hoch</SelectItem>
                      <SelectItem value="critical" className="text-xs font-bold text-red-600">Kritisch (Notfall)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest">Handlungsanweisungen</Label>
                <Textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="rounded-[1.5rem] min-h-[120px] text-sm font-medium border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-6 leading-relaxed shadow-inner" placeholder="Was genau muss im Kontext dieses Assets getan werden?..." />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-800 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} className="rounded-2xl font-black text-[11px] px-10 h-12 text-slate-400 hover:bg-white dark:hover:bg-slate-900 uppercase tracking-widest transition-all">Abbrechen</Button>
            <Button onClick={handleCreateTask} disabled={isSavingTask || !taskTitle || !taskAssigneeId} className="rounded-2xl font-black text-[11px] tracking-widest px-16 h-12 bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 gap-3 uppercase active:scale-95 transition-all">
              {isSavingTask ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Aufgabe sichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
