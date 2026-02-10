
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
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ResourceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);

  const { data: resources, isLoading: isResLoading } = usePluggableCollection<Resource>('resources');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
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
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lade Asset-Kontext...</p></div>;
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
              <Badge className="rounded-full px-2 h-5 text-[9px] font-black uppercase bg-blue-50 text-blue-700">{resource.assetType}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {resource.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary text-white shadow-lg active:scale-95" onClick={() => router.push('/resources')}>
            <Settings2 className="w-3.5 h-3.5 mr-2" /> Konfigurieren
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase text-slate-400">Asset Integrität</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 border shadow-inner flex flex-col items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase">Schutzbedarf</span>
                <p className={cn("text-2xl font-black uppercase", resource.criticality === 'high' ? "text-red-600" : "text-emerald-600")}>{resource.criticality}</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">BACKUP STATUS</span>
                  <Badge variant={resource.backupRequired ? 'default' : 'outline'} className={cn("h-4 px-1.5 text-[7px] font-black", resource.backupRequired ? "bg-orange-100 text-orange-700 border-none" : "text-slate-300")}>{resource.backupRequired ? 'AKTIV' : 'N/A'}</Badge>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">PATCH MONITOR</span>
                  <Badge variant={resource.updatesRequired ? 'default' : 'outline'} className={cn("h-4 px-1.5 text-[7px] font-black", resource.updatesRequired ? "bg-blue-100 text-blue-700 border-none" : "text-slate-300")}>{resource.updatesRequired ? 'AKTIV' : 'N/A'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="maintenance" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner">
              <TabsTrigger value="maintenance" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white shadow-sm">
                <Settings2 className="w-3.5 h-3.5 text-orange-600" /> Wartung & Sicherung
              </TabsTrigger>
              <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Systemrollen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="maintenance" className="space-y-8">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><HardDrive className="w-5 h-5 text-orange-600" /> Backup-Historie & Jobs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 text-[10px] font-black uppercase text-slate-400">Job Bezeichnung</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Zyklus</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Verantwortlich</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">IT-Leitfaden</TableHead>
                        <TableHead className="text-right px-6 text-[10px] font-black uppercase text-slate-400">Letztes Review</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceBackups.map(job => (
                        <TableRow key={job.id} className="border-b last:border-0">
                          <TableCell className="py-4 px-6 font-bold text-xs text-slate-800">{job.name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] font-bold uppercase">{job.cycle}</Badge></TableCell>
                          <TableCell><span className="text-[10px] font-bold text-slate-600">{getJobName(job.responsible_id)}</span></TableCell>
                          <TableCell>
                            {job.it_process_id ? (
                              <button className="text-[9px] text-primary font-bold flex items-center gap-1 hover:underline" onClick={() => router.push(`/processhub/view/${job.it_process_id}`)}>
                                <Workflow className="w-3 h-3" /> {getProcessTitle(job.it_process_id)}
                              </button>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right px-6 text-[9px] font-bold text-slate-400">{job.lastReviewDate || 'Offen'}</TableCell>
                        </TableRow>
                      ))}
                      {resourceBackups.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-slate-400 italic">Keine Backup-Jobs gefunden</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600" /> Patch-Management Workflows</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resourceUpdates.map(p => (
                      <div key={p.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-blue-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                        <div className="flex items-center gap-3">
                          <Workflow className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-slate-800">{p.title}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-all" />
                      </div>
                    ))}
                    {resourceUpdates.length === 0 && <div className="col-span-full py-10 text-center text-xs text-slate-400 italic">Keine Update-Prozesse verknüpft</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Systemspezifische Rollen</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 font-bold text-[10px] uppercase text-slate-400">Bezeichnung</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Risiko</TableHead>
                        <TableHead className="text-right px-6 font-bold text-[10px] uppercase text-slate-400">Typ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceRoles.map(role => (
                        <TableRow key={role.id} className="group hover:bg-slate-50 border-b last:border-0">
                          <TableCell className="py-4 px-6 font-bold text-xs text-slate-800">{role.name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-slate-200 uppercase">{role.riskLevel}</Badge></TableCell>
                          <TableCell className="text-right px-6">{role.isAdmin ? <Badge className="bg-red-50 text-red-600 border-none text-[7px] font-bold h-4">ADMIN</Badge> : <span className="text-[10px] text-slate-400">User</span>}</TableCell>
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
