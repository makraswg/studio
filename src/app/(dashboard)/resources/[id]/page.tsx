
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
  MapPin
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { 
  Resource, Process, ProcessVersion, ProcessNode, Risk, RiskMeasure, ProcessingActivity, Feature, JobTitle, ServicePartner, ServicePartnerContact, ServicePartnerArea, Department, Entitlement, BackupJob, ResourceUpdateProcess 
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default function ResourceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => { setMounted(true); }, []);

  const resource = useMemo(() => resources?.find(r => r.id === id), [resources, id]);
  const resourceRoles = useMemo(() => entitlements?.filter(e => e.resourceId === id) || [], [entitlements, id]);
  const resourceBackups = useMemo(() => backupJobs?.filter(b => b.resourceId === id) || [], [backupJobs, id]);
  const resourceUpdates = useMemo(() => {
    const linkIds = updateLinks?.filter(u => u.resourceId === id).map(u => u.processId) || [];
    return processes?.filter(p => linkIds.includes(p.id)) || [];
  }, [updateLinks, processes, id]);

  const resourceRisks = useMemo(() => risks?.filter(r => r.assetId === id) || [], [risks, id]);
  
  // --- INHERITANCE LOGIC (DATA & GDPR) ---
  const inheritedData = useMemo(() => {
    if (!resource || !versions || !featureLinks || !features) return null;

    // 1. Find all processes using this resource
    const usedInProcessIds = new Set<string>();
    versions.forEach(v => {
      const nodes = v.model_json?.nodes || [];
      if (nodes.some(n => n.resourceIds?.includes(resource.id))) {
        usedInProcessIds.add(v.process_id);
      }
    });

    // 2. Find all features linked to these processes
    const linkedFeatureIds = new Set<string>();
    featureLinks.forEach((link: any) => {
      if (usedInProcessIds.has(link.processId)) {
        linkedFeatureIds.add(link.featureId);
      }
    });

    const linkedFeatures = Array.from(linkedFeatureIds).map(fid => features.find(f => f.id === fid)).filter(Boolean) as Feature[];

    if (linkedFeatures.length === 0) return null;

    // 3. Aggregate values
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
        if (val > maxV) {
          maxV = val;
          maxReq = f[prop] as any;
        }
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
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary text-white shadow-lg active:scale-95" onClick={() => router.push(`/resources?edit=${resource.id}`)}>
            <Settings2 className="w-3.5 h-3.5 mr-2" /> Konfigurieren
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Integrität & Schutzbedarf</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 border shadow-inner flex flex-col items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase">Vererbte Kritikalität</span>
                <p className={cn("text-2xl font-black uppercase", inheritedCriticality === 'high' ? "text-red-600" : inheritedCriticality === 'medium' ? "text-orange-600" : "text-emerald-600")}>
                  {inheritedCriticality}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[8px] font-bold text-slate-400 uppercase">
                  <Zap className="w-2.5 h-2.5" /> Basierend auf {resourceRisks.length} Risiken
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Daten-Klassifizierung</p>
                  {inheritedData && <Badge className="bg-blue-50 text-blue-600 border-none text-[7px] font-black h-4 uppercase">Geerbt</Badge>}
                </div>
                <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", inheritedData ? "border-blue-200 text-blue-700 bg-blue-50/30" : "")}>
                  {finalClass || 'internal'}
                </Badge>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-[7px] font-black text-slate-400 uppercase">C</span>
                    <span className="text-[9px] font-bold">{String(finalC)?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-[7px] font-black text-slate-400 uppercase">I</span>
                    <span className="text-[9px] font-bold">{String(finalI)?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-[7px] font-black text-slate-400 uppercase">A</span>
                    <span className="text-[9px] font-bold">{String(finalA)?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400 uppercase">DSGVO STATUS</span>
                  <Badge variant={finalGDPR ? 'default' : 'outline'} className={cn("h-4 px-1.5 text-[7px] font-black", finalGDPR ? "bg-emerald-100 text-emerald-700 border-none" : "text-slate-300")}>
                    {finalGDPR ? 'PERSONENBEZUG' : 'KEIN PB'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400 uppercase">BACKUP STATUS</span>
                  <Badge variant={resource.backupRequired ? 'default' : 'outline'} className={cn("h-4 px-1.5 text-[7px] font-black", resource.backupRequired ? "bg-orange-100 text-orange-700 border-none" : "text-slate-300")}>{resource.backupRequired ? 'AKTIV' : 'N/A'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {inheritedData && (
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-3 shadow-sm">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-900 uppercase">Vererbte Governance</p>
                <p className="text-[9px] text-blue-700 leading-relaxed font-medium">
                  Schutzbedarf und Personenbezug werden automatisch aus {inheritedData.featureCount} Datenobjekten in {inheritedData.processCount} Prozessen abgeleitet.
                </p>
              </div>
            </div>
          )}
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white shadow-sm">
                <Info className="w-3.5 h-3.5" /> Überblick
              </TabsTrigger>
              <TabsTrigger value="ownership" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Ownership
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white shadow-sm">
                <Settings2 className="w-3.5 h-3.5 text-orange-600" /> Wartung & Backup
              </TabsTrigger>
              <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white shadow-sm">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Systemrollen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Basisinformationen</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Asset-Kategorie</Label>
                      <p className="text-sm font-bold text-slate-800">{resource.category || '---'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Betriebsmodell</Label>
                      <p className="text-sm font-bold text-slate-800">{resource.operatingModel || '---'}</p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Zusammenfassung & Notizen</Label>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner">
                      {resource.notes || 'Keine detaillierte Beschreibung hinterlegt.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ownership" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Internal Ownership */}
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-900 text-white p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shadow-lg border border-white/10">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Interne Verantwortung</CardTitle>
                        <CardDescription className="text-[9px] text-white/50 font-black uppercase">Governance & Business Owner</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm"><UserCircle className="w-6 h-6" /></div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Owner</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{internalOwner?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-accent shadow-sm"><ShieldAlert className="w-6 h-6" /></div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Risk Owner</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{internalRiskOwner?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* External Ownership */}
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-indigo-600 text-white p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white shadow-lg border border-white/10">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Externer Betrieb</CardTitle>
                        <CardDescription className="text-[9px] text-white/50 font-black uppercase">Dienstleister & Support</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-2xl space-y-1">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Service Partner</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-indigo-900">{externalPartner?.name || 'Kein Partner'}</p>
                        {externalPartner?.website && <a href={externalPartner.website} target="_blank" className="text-indigo-400 hover:text-indigo-600"><ExternalLink className="w-3.5 h-3.5" /></a>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-800">{externalContact?.name || 'Kein Kontakt'}</p>
                          <p className="text-[9px] text-slate-400 truncate">{externalContact?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <p className="text-[10px] font-bold text-slate-800">{externalArea?.name || 'Kein Fachbereich'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-orange-600" />
                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Backup & Restore Jobs</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-white border-orange-200 text-orange-700 font-black text-[9px] px-2 h-5">{resourceBackups.length} Jobs</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 text-[10px] font-black uppercase text-slate-400">Bezeichnung</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 text-center">Zyklus</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Verantwortlich</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">IT-Leitfaden</TableHead>
                        <TableHead className="text-right px-6 text-[10px] font-black uppercase text-slate-400">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceBackups.map(job => (
                        <TableRow key={job.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="py-4 px-6">
                            <div className="font-bold text-xs text-slate-800">{job.name}</div>
                            <p className="text-[9px] text-slate-400 truncate max-w-[150px]">{job.storage_location}</p>
                          </TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black uppercase h-5 border-slate-200 bg-white">{job.cycle}</Badge></TableCell>
                          <TableCell><span className="text-[10px] font-bold text-slate-600">{getJobName(job.responsible_id)}</span></TableCell>
                          <TableCell>
                            {job.it_process_id ? (
                              <button className="text-[9px] text-primary font-bold flex items-center gap-1 hover:underline" onClick={() => router.push(`/processhub/view/${job.it_process_id}`)}>
                                <Workflow className="w-3 h-3" /> {getProcessTitle(job.it_process_id)}
                              </button>
                            ) : <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[10px] font-black text-slate-800">{job.lastReviewDate || 'Offen'}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Review</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {resourceBackups.length === 0 && <TableRow><TableCell colSpan={5} className="py-16 text-center text-xs text-slate-400 italic">Keine Backup-Jobs konfiguriert</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Patch-Management Workflows</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resourceUpdates.map(p => (
                      <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-300 transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-blue-600 shadow-sm"><Workflow className="w-5 h-5" /></div>
                          <div>
                            <span className="text-[11px] font-bold text-slate-800">{p.title}</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">IT-Leitfaden</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-all" />
                      </div>
                    ))}
                    {resourceUpdates.length === 0 && <div className="col-span-full py-10 text-center text-xs text-slate-400 italic border-2 border-dashed rounded-2xl">Keine Update-Prozesse verknüpft</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <CardTitle className="text-sm font-bold">Systemspezifische Rollen (IAM)</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-widest">Grundlage für Berechtigungs-Reviews</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-3 px-6 font-bold text-[10px] uppercase text-slate-400">Rollenbezeichnung</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Risiko</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400">Status</TableHead>
                        <TableHead className="text-right px-6 font-bold text-[10px] uppercase text-slate-400">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceRoles.map(role => (
                        <TableRow key={role.id} className="group hover:bg-slate-50 border-b last:border-0 cursor-pointer" onClick={() => router.push(`/roles/${role.id}`)}>
                          <TableCell className="py-4 px-6">
                            <div className="font-bold text-xs text-slate-800 group-hover:text-primary transition-colors">{role.name}</div>
                            <p className="text-[9px] text-slate-400 truncate max-w-xs">{role.description || 'Keine Funktionsbeschreibung'}</p>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={cn("text-[8px] font-black h-4 px-1.5 border-slate-200 uppercase", role.riskLevel === 'high' ? "text-red-600 bg-red-50" : "text-slate-500")}>{role.riskLevel}</Badge></TableCell>
                          <TableCell>{role.isAdmin ? <Badge className="bg-red-600 text-white border-none text-[7px] font-black h-4 px-1.5">PRIVILEGIERT</Badge> : <span className="text-[10px] text-slate-400 font-bold uppercase">Standard</span>}</TableCell>
                          <TableCell className="text-right px-6"><Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100"><ArrowRight className="w-4 h-4 text-primary" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {resourceRoles.length === 0 && <TableRow><TableCell colSpan={4} className="py-16 text-center text-xs text-slate-400 italic">Keine Rollen für dieses System definiert</TableCell></TableRow>}
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
