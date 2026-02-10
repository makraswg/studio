
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight,
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
  History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Process, ProcessVersion, ProcessNode, Risk, RiskMeasure, ProcessingActivity, Feature, JobTitle, ServicePartner, ServicePartnerContact, FeatureProcessStep, ServicePartnerArea, Department, Entitlement, BackupJob, ResourceUpdateProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calculateProcessMaturity } from '@/lib/process-utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { saveResourceAction } from '@/app/actions/resource-actions';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { usePlatformAuth } from '@/context/auth-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export default function ResourceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = usePlatformAuth();
  const { activeTenantId, dataSource } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [isInheriting, setIsInheriting] = useState(false);

  // Data
  const { data: resources, isLoading: isResLoading, refresh: refreshRes } = usePluggableCollection<Resource>('resources');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: risks } = usePluggableCollection<Risk>('risks');
  const { data: measures } = usePluggableCollection<RiskMeasure>('riskMeasures');
  const { data: vvts } = usePluggableCollection<ProcessingActivity>('processingActivities');
  const { data: features } = usePluggableCollection<Feature>('features');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departmentsData } = usePluggableCollection<Department>('departments');
  const { data: featureLinks } = usePluggableCollection<FeatureProcessStep>('feature_process_steps');
  const { data: partners } = usePluggableCollection<ServicePartner>('servicePartners');
  const { data: entitlements, refresh: refreshRoles } = usePluggableCollection<Entitlement>('entitlements');
  const { data: backupJobs } = usePluggableCollection<BackupJob>('backup_jobs');
  const { data: updateLinks } = usePluggableCollection<ResourceUpdateProcess>('resource_update_processes');

  useEffect(() => { setMounted(true); }, []);

  const resource = useMemo(() => resources?.find(r => r.id === id), [resources, id]);
  const resourceRoles = useMemo(() => entitlements?.filter(e => e.resourceId === id) || [], [entitlements, id]);
  const resourceBackups = useMemo(() => backupJobs?.filter(b => b.resourceId === id) || [], [backupJobs, id]);
  const resourceUpdates = useMemo(() => {
    const linkIds = updateLinks?.filter(u => u.resourceId === id).map(u => u.processId) || [];
    return processes?.filter(p => linkIds.includes(p.id)) || [];
  }, [updateLinks, processes, id]);
  
  const systemOwnerRole = useMemo(() => jobTitles?.find(j => j.id === resource?.systemOwnerRoleId), [jobTitles, resource]);
  const systemOwnerDept = useMemo(() => departmentsData?.find(d => d.id === systemOwnerRole?.departmentId), [departmentsData, systemOwnerRole]);

  const getJobName = (roleId?: string) => {
    if (!roleId) return '---';
    return jobTitles?.find(j => j.id === roleId)?.name || roleId;
  };

  const getProcessTitle = (procId?: string) => {
    if (!procId) return '---';
    return processes?.find(p => p.id === procId)?.title || procId;
  };

  if (!mounted) return null;

  if (isResLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Analysiere Asset-Kontext...</p></div>;
  }

  if (!resource) return null;

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/resources')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{resource.name}</h1>
              <Badge className={cn(
                "rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                resource.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
              )}>{resource.assetType}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {resource.id} • {resource.operatingModel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-slate-200" onClick={() => router.push(`/audit?search=${resource.id}`)}>
            <Activity className="w-3.5 h-3.5 mr-2" /> Audit-Historie
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all active:scale-95" onClick={() => router.push('/resources')}>
            <Settings2 className="w-3.5 h-3.5 mr-2" /> Bearbeiten
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verantwortung & Ownership</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">System Owner (Intern)</p>
                {systemOwnerRole ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Briefcase className="w-4 h-4 text-primary" /> {systemOwnerRole.name}
                    </div>
                    {systemOwnerDept && <p className="text-[9px] text-slate-400 font-bold uppercase pl-6">{systemOwnerDept.name}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 italic font-medium p-1">Nicht zugewiesen</p>
                )}
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Integrität (CIA)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400">V</span>
                    <span className="text-[10px] font-bold uppercase">{resource.confidentialityReq}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400">I</span>
                    <span className="text-[10px] font-bold uppercase">{resource.integrityReq}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border flex flex-col items-center">
                    <span className="text-[8px] font-black text-slate-400">A</span>
                    <span className="text-[10px] font-bold uppercase">{resource.availabilityReq}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="maintenance" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner">
              <TabsTrigger value="maintenance" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Settings2 className="w-3.5 h-3.5 text-orange-600" /> Datensicherung & Updates
              </TabsTrigger>
              <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Systemrollen ({resourceRoles.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="maintenance" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><HardDrive className="w-5 h-5 text-orange-600" /> Datensicherung (Backup Jobs)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 text-[10px] font-black uppercase text-slate-400">Job Bezeichnung</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Zyklus</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Verantwortlich</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Prozesse</TableHead>
                        <TableHead className="text-right px-6 text-[10px] font-black uppercase text-slate-400">Review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceBackups.map(job => (
                        <TableRow key={job.id} className="border-b last:border-0">
                          <TableCell className="py-4 px-6">
                            <div className="font-bold text-xs text-slate-800">{job.name}</div>
                            <div className="text-[9px] text-slate-400 font-medium truncate max-w-xs">{job.storage_location}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] font-bold uppercase">{job.cycle}</Badge></TableCell>
                          <TableCell><span className="text-[10px] font-bold text-slate-600">{getJobName(job.responsibleRoleId)}</span></TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {job.it_process_id && (
                                <button className="text-[9px] text-primary font-bold flex items-center gap-1 hover:underline" onClick={() => router.push(`/processhub/view/${job.it_process_id}`)}>
                                  <Workflow className="w-3 h-3" /> IT: {getProcessTitle(job.it_process_id)}
                                </button>
                              )}
                              {job.detail_process_id && (
                                <button className="text-[9px] text-indigo-600 font-bold flex items-center gap-1 hover:underline" onClick={() => router.push(`/processhub/view/${job.detail_process_id}`)}>
                                  <Activity className="w-3 h-3" /> Detail: {getProcessTitle(job.detail_process_id)}
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <span className="text-[9px] font-bold text-slate-400">{job.lastReviewDate || 'Ausstehend'}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {resourceBackups.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-[10px] text-slate-400 uppercase italic">Keine Backup-Jobs konfiguriert</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600" /> Patch-Management & Updates</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {resourceUpdates.map(p => (
                      <div key={p.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-blue-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                        <div className="flex items-center gap-3">
                          <Workflow className="w-4 h-4 text-blue-600" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{p.title}</p>
                            <Badge variant="outline" className="text-[7px] font-black h-3.5 border-none bg-white">IT-PROZESS</Badge>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-all" />
                      </div>
                    ))}
                    {resourceUpdates.length === 0 && <div className="col-span-full py-10 text-center text-[10px] text-slate-400 uppercase italic">Keine Update-Prozesse verknüpft</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Zugeordnete Systemrollen</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 font-bold text-[10px] uppercase text-slate-400">Rollenbezeichnung</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Risiko</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400 text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceRoles.map(role => (
                        <TableRow key={role.id} className="group hover:bg-slate-50 border-b last:border-0">
                          <TableCell className="py-4 px-6">
                            <div className="font-bold text-xs text-slate-800">{role.name}</div>
                            <div className="text-[9px] text-slate-400 font-medium truncate max-w-xs">{role.description || 'Keine Beschreibung'}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-slate-200 uppercase">{role.riskLevel}</Badge></TableCell>
                          <TableCell className="text-right px-6"><Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={() => router.push(`/roles/${role.id}`)}>Details</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
