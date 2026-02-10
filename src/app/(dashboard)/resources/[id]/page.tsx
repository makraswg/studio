
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
  Settings2,
  Clock,
  BadgeCheck,
  Zap,
  UserCircle,
  Briefcase,
  Building2,
  Globe,
  Plus,
  Pencil,
  Save,
  KeyRound,
  ShieldX,
  HardDrive,
  ClipboardList,
  History,
  MapPin,
  CheckCircle,
  X,
  Fingerprint,
  ShieldAlert,
  Mail
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Resource, Process, ProcessVersion, Risk, RiskMeasure, ProcessingActivity, Feature, JobTitle, ServicePartner, ServicePartnerContact, ServicePartnerArea, Department, Entitlement, BackupJob, ResourceUpdateProcess, Task, PlatformUser 
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

  if (!resource) return null;

  const finalGDPR = inheritedData ? inheritedData.hasPersonalData : !!resource.hasPersonalData;
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden group">
            <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-4 px-6">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Governance Cockpit</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-inner flex flex-col items-center text-center group-hover:scale-[1.02] transition-transform duration-500">
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
              
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Schutzbedarf (CIA)</p>
                  {inheritedData && <Badge className="bg-blue-600 text-white border-none text-[8px] font-black h-5 px-3 uppercase tracking-widest shadow-lg shadow-blue-200">Dynamisch</Badge>}
                </div>
                
                <div className="space-y-2">
                  {[
                    { label: 'Vertraulichkeit', val: finalC, icon: Shield },
                    { label: 'Integrität', val: finalI, icon: CheckCircle2 },
                    { label: 'Verfügbarkeit', val: finalA, icon: Activity }
                  ].map((req) => (
                    <div key={req.label} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-2">
                        <req.icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">{req.label}</span>
                      </div>
                      <Badge className={cn(
                        "text-[8px] font-black h-5 px-2 border-none shadow-sm uppercase",
                        req.val === 'high' ? "bg-red-50 text-red-700" : 
                        req.val === 'medium' ? "bg-orange-50 text-orange-700" : 
                        "bg-emerald-50 text-emerald-700"
                      )}>
                        {req.val === 'high' ? 'HOCH' : req.val === 'medium' ? 'MITTEL' : 'NIEDRIG'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between items-center group/row">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DSGVO RELEVANZ</span>
                  <Badge className={cn(
                    "h-5 px-2 text-[8px] font-black border-none transition-all", 
                    finalGDPR ? "bg-emerald-500 text-white shadow-lg" : "bg-slate-100 text-slate-400"
                  )}>
                    {finalGDPR ? 'JA' : 'NEIN'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center group/row">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BACKUP PFLICHT</span>
                  <Badge className={cn(
                    "h-5 px-2 text-[8px] font-black border-none transition-all", 
                    resource.backupRequired ? "bg-orange-500 text-white shadow-lg" : "bg-slate-100 text-slate-400"
                  )}>
                    {resource.backupRequired ? 'AKTIV' : 'N/A'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-12 rounded-2xl border w-full justify-start gap-1 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="details" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Info className="w-4 h-4" /> Stammdaten & Ownership
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <Settings2 className="w-4 h-4" /> Wartung & Backup
              </TabsTrigger>
              <TabsTrigger value="audit" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <BadgeCheck className="w-4 h-4" /> Zugriff & Rollen
              </TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-xl px-5 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg transition-all">
                <ClipboardList className="w-4 h-4" /> Aufgaben ({resourceTasks.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6">
                  <CardTitle className="text-lg font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">System-Kontext</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Asset-Kategorie</Label>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">{resource.category || '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Anmelde-Infrastruktur</Label>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <Fingerprint className="w-4 h-4 text-primary" /> {resource.isIdentityProvider ? 'Eigenes IdP-System' : 'Externer Directory-Dienst'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Technischer Standort</Label>
                        <div className="flex items-center gap-3 text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <MapPin className="w-4 h-4 text-slate-300" /> {resource.dataLocation || 'Nicht spezifiziert'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Service URL</Label>
                        <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
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
                  
                  <div className="space-y-4 pt-6 border-t">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Verantwortlichkeiten (Ownership)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black uppercase text-primary">Interne Steuerung</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <UserCircle className="w-5 h-5 text-slate-400" />
                            <div><p className="text-[8px] font-bold text-slate-400 uppercase">System Owner</p><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{internalOwner?.name || 'Nicht zugewiesen'}</p></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <ShieldAlert className="w-5 h-5 text-slate-400" />
                            <div><p className="text-[8px] font-bold text-slate-400 uppercase">Risk Owner</p><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{internalRiskOwner?.name || 'Nicht zugewiesen'}</p></div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Externer Betrieb</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-indigo-400" />
                            <div><p className="text-[8px] font-bold text-slate-400 uppercase">Partner</p><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{externalPartner?.name || 'Keiner'}</p></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Briefcase className="w-5 h-5 text-indigo-400" />
                            <div><p className="text-[8px] font-bold text-slate-400 uppercase">Ansprechpartner</p><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{externalContact?.name || '---'}</p></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-orange-50/50 dark:bg-orange-950/20 border-b p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center rounded-2xl text-orange-600 shadow-md">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Sicherungs-Jobs & Workflows</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resourceBackups.map(job => {
                      const itProc = processes?.find(p => p.id === job.it_process_id);
                      return (
                        <div key={job.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="space-y-1">
                            <h5 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                              {job.name}
                              <Badge className="bg-orange-500 text-white border-none rounded-full text-[8px] font-black h-4 px-2">{job.cycle}</Badge>
                            </h5>
                            <p className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-2"><MapPin className="w-3 h-3" /> {job.storage_location}</p>
                          </div>
                          {itProc && (
                            <Button variant="outline" size="sm" className="h-8 rounded-xl text-[10px] font-black uppercase border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => router.push(`/processhub/view/${itProc.id}`)}>
                              <Workflow className="w-3.5 h-3.5 mr-2" /> Recovery Leitfaden
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {resourceBackups.length === 0 && <div className="p-16 text-center opacity-30 italic text-xs uppercase tracking-widest text-slate-400">Keine Backup-Jobs konfiguriert</div>}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 border-b p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center rounded-2xl text-blue-600 shadow-md">
                      <Activity className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-sm font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Patch-Management (Updates)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {resourceUpdates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resourceUpdates.map(p => (
                        <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between group hover:border-blue-300 cursor-pointer transition-all shadow-sm" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                          <div className="flex items-center gap-3">
                            <Workflow className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.title}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  ) : <div className="p-16 text-center border-2 border-dashed rounded-3xl opacity-20 italic text-xs uppercase tracking-widest text-slate-400">Kein Patch-Bedarf definiert</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-slate-50 dark:bg-slate-800 border-b p-6">
                  <CardTitle className="text-lg font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">System-Berechtigungen (Roles)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30 dark:bg-slate-950/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 font-black text-[10px] uppercase text-slate-400">Rollenbezeichnung</TableHead>
                        <TableHead className="font-black text-[10px] uppercase text-slate-400 text-center">Risiko</TableHead>
                        <TableHead className="text-right px-6 font-black text-[10px] uppercase text-slate-400">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceRoles.map(role => (
                        <TableRow key={role.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800 cursor-pointer" onClick={() => router.push(`/roles/${role.id}`)}>
                          <TableCell className="py-4 px-6">
                            <div className="font-black text-sm text-slate-800 dark:text-slate-100">{role.name}</div>
                            {role.isAdmin && <Badge className="bg-red-600 text-white border-none rounded-full text-[7px] font-black h-4 px-1.5 mt-1 uppercase">Privilegiert</Badge>}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-[9px] font-black h-5 border-none uppercase", role.riskLevel === 'high' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500")}>{role.riskLevel}</Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><ArrowRight className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-2xl border shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b p-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Operative Aufgaben</CardTitle>
                  <Button size="sm" variant="outline" className="h-9 rounded-xl text-[10px] font-black uppercase gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm" onClick={() => setIsTaskDialogOpen(true)}><Plus className="w-3.5 h-3.5" /> Aufgabe</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resourceTasks.map(t => (
                      <div key={t.id} className="p-4 px-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center justify-between group cursor-pointer" onClick={() => router.push('/tasks')}>
                        <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg", t.status === 'done' ? "bg-emerald-500" : t.priority === 'critical' ? "bg-red-600" : "bg-indigo-600")}>
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{t.title}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status: {t.status} • Fällig: {t.dueDate || '∞'}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                    ))}
                    {resourceTasks.length === 0 && <div className="py-16 text-center opacity-30 italic text-xs uppercase tracking-widest text-slate-400">Keine Aufgaben für diese Ressource</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-800 border-b shrink-0">
            <DialogTitle className="text-xl font-headline font-black uppercase tracking-tight">Aufgabe für Asset erstellen</DialogTitle>
            <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Referenz: {resource.name}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <Label required className="text-[10px] font-bold uppercase text-slate-400">Titel</Label>
                <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="rounded-xl h-12 font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label required className="text-[10px] font-bold uppercase text-slate-400">Verantwortlich</Label>
                  <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>{pUsers?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Deadline</Label>
                  <Input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="rounded-xl h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Beschreibung</Label>
                <Textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="rounded-2xl min-h-[100px]" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-800 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} className="rounded-xl font-bold text-xs">Abbrechen</Button>
            <Button onClick={handleCreateTask} disabled={isSavingTask || !taskTitle} className="rounded-xl px-12 bg-primary text-white font-bold text-xs shadow-lg gap-2">
              {isSavingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
