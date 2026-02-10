
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
  ListChecks
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
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
  const { activeTenantId, dataSource } = useSettings();
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
              <Badge className="rounded-full px-2 h-5 text-[9px] font-black uppercase bg-blue-50 text-blue-700 border-none">{resource.assetType}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Asset-Management • {resource.operatingModel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary text-white shadow-lg active:scale-95 transition-all" onClick={() => router.push(`/resources?edit=${resource.id}`)}>
            <Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sicherheitszustand</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 border shadow-inner flex flex-col items-center text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Vererbte Kritikalität</span>
                <p className={cn("text-2xl font-black uppercase", inheritedCriticality === 'high' ? "text-red-600" : inheritedCriticality === 'medium' ? "text-orange-600" : "text-emerald-600")}>
                  {inheritedCriticality}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[8px] font-bold text-slate-400 uppercase">
                  <Zap className="w-2.5 h-2.5 text-primary fill-current" /> Basierend auf Risikolage
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Daten-Klassifizierung</p>
                  {inheritedData && <Badge className="bg-blue-50 text-blue-600 border-none text-[7px] font-black h-4 uppercase shadow-sm">Dynamisch</Badge>}
                </div>
                <Badge variant="outline" className={cn("text-[10px] font-bold uppercase py-1 px-3 border-slate-200", inheritedData ? "border-blue-200 text-blue-700 bg-blue-50/30" : "")}>
                  {finalClass || 'internal'}
                </Badge>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[7px] font-black text-slate-400 uppercase mb-1">C</span>
                    <span className={cn("text-[9px] font-bold", finalC === 'high' ? 'text-red-600' : 'text-slate-700')}>{String(finalC)?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[7px] font-black text-slate-400 uppercase mb-1">I</span>
                    <span className={cn("text-[9px] font-bold", finalI === 'high' ? 'text-red-600' : 'text-slate-700')}>{String(finalI)?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[7px] font-black text-slate-400 uppercase mb-1">A</span>
                    <span className={cn("text-[9px] font-bold", finalA === 'high' ? 'text-red-600' : 'text-slate-700')}>{String(finalA)?.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-widest">DSGVO RELEVANZ</span>
                  <Badge className={cn("h-4 px-1.5 text-[7px] font-black border-none", finalGDPR ? "bg-emerald-100 text-emerald-700 shadow-sm" : "bg-slate-100 text-slate-400")}>
                    {finalGDPR ? 'JA' : 'NEIN'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400 uppercase tracking-widest">BACKUP PFLICHT</span>
                  <Badge className={cn("h-4 px-1.5 text-[7px] font-black border-none", resource.backupRequired ? "bg-orange-100 text-orange-700 shadow-sm" : "bg-slate-100 text-slate-400")}>{resource.backupRequired ? 'AKTIV' : 'N/A'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-xl bg-slate-900 text-white overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-headline font-black uppercase tracking-tight">Audit Ready</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Integritäts-Score</p>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                  <span>Dokumentationsgrad</span>
                  <span className="text-emerald-400">100%</span>
                </div>
                <Progress value={100} className="h-1.5 bg-white/10 rounded-full" />
                <p className="text-[9px] text-slate-400 leading-relaxed italic border-t border-white/5 pt-4">
                  Die Kritikalität wird automatisch aus der Datenlast der verknüpften Geschäftsprozesse abgeleitet.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="overview" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Info className="w-3.5 h-3.5" /> Überblick
              </TabsTrigger>
              <TabsTrigger value="ownership" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Ownership
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Settings2 className="w-3.5 h-3.5 text-orange-600" /> Wartung & Backup
              </TabsTrigger>
              <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Systemrollen
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-slate-400" />
                    <CardTitle className="text-sm font-bold">Stammdaten & Asset-Kontext</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kategorie</Label>
                        <p className="text-sm font-bold text-slate-800">{resource.category || '---'}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Technischer Standort</Label>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <MapPin className="w-4 h-4 text-slate-300" /> {resource.dataLocation || 'Nicht spezifiziert'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Anmelde-Infrastruktur (IdP)</Label>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                          <Fingerprint className="w-4 h-4 text-primary" /> {resource.isIdentityProvider ? 'Eigenes IdP-System' : 'Externer Directory-Dienst'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Service URL</Label>
                        {resource.url && resource.url !== '#' ? (
                          <a href={resource.url} target="_blank" className="text-sm font-bold text-primary flex items-center gap-1.5 hover:underline">
                            {resource.url} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Keine URL hinterlegt</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 pt-6 border-t">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fachliche Bestimmung & Notizen</Label>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner italic">
                      {resource.notes || 'Keine detaillierte Beschreibung hinterlegt.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ownership" className="space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary shadow-sm border"><UserCircle className="w-6 h-6" /></div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Owner</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{internalOwner?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 hover:bg-slate-100 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-accent shadow-sm border"><ShieldAlert className="w-6 h-6" /></div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Risk Owner</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{internalRiskOwner?.name || 'Nicht zugewiesen'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                        {externalPartner?.website && <a href={externalPartner.website} target="_blank" className="text-indigo-400 hover:text-indigo-600 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border"><UserIcon className="w-4 h-4" /></div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-800">{externalContact?.name || 'Kein Kontakt'}</p>
                          <p className="text-[9px] text-slate-400 font-medium truncate italic">{externalContact?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border"><Briefcase className="w-4 h-4" /></div>
                        <p className="text-[10px] font-bold text-slate-800">{externalArea?.name || 'Kein Fachbereich'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-8 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-orange-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm border border-orange-200">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Datensicherung (Backup)</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-white border-orange-200 text-orange-700 font-black text-[9px] px-2 h-5 shadow-sm">{resourceBackups.length} Jobs aktiv</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {resourceBackups.map(job => {
                      const itProc = processes?.find(p => p.id === job.it_process_id);
                      const contact = contacts?.find(c => c.id === job.external_contact_id);
                      const partner = partners?.find(p => p.id === contact?.partnerId);
                      const role = jobTitles?.find(r => r.id === job.responsible_id);

                      return (
                        <div key={job.id} className="p-6 hover:bg-slate-50/50 transition-colors group">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                            <div className="space-y-4 flex-1">
                              <div>
                                <h5 className="text-base font-bold text-slate-900 flex items-center gap-2 group-hover:text-orange-600 transition-colors">
                                  {job.name} 
                                  <Badge className="bg-orange-50 text-orange-700 border-none rounded-full text-[8px] h-4 px-2 uppercase font-black">
                                    {job.cycle === 'Benutzerdefiniert' ? job.custom_cycle : job.cycle}
                                  </Badge>
                                </h5>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1.5 tracking-wider">
                                  <MapPin className="w-2.5 h-2.5" /> {job.storage_location}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm space-y-1 group-hover:border-orange-100 transition-all">
                                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Verantwortung</p>
                                  <div className="flex items-center gap-2">
                                    {job.responsible_type === 'internal' ? (
                                      <><Building2 className="w-3.5 h-3.5 text-primary" /><span className="text-[11px] font-bold text-slate-700">{role?.name || 'Interner Dienst'}</span></>
                                    ) : (
                                      <><Globe className="w-3.5 h-3.5 text-indigo-600" /><span className="text-[11px] font-bold text-slate-700">{partner?.name}: {contact?.name || 'Extern'}</span></>
                                    )}
                                  </div>
                                </div>
                                <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm space-y-1 group-hover:border-orange-100 transition-all">
                                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Letzter Review</p>
                                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                                    <History className="w-3.5 h-3.5 text-slate-400" /> {job.lastReviewDate || 'Ungeprüft'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="w-full md:w-64 space-y-2">
                              <p className="text-[8px] font-black uppercase text-slate-400 ml-1 tracking-widest">Wiederherstellungs-Leitfaden</p>
                              {itProc ? (
                                <Button variant="outline" className="w-full h-10 justify-start text-[10px] font-black uppercase gap-2 bg-white border-slate-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 shadow-sm" onClick={() => router.push(`/processhub/view/${itProc.id}`)}>
                                  <Workflow className="w-3.5 h-3.5" /> Backup-Prozess
                                </Button>
                              ) : (
                                <div className="text-[10px] text-slate-300 italic text-center py-3 border border-dashed rounded-xl bg-slate-50/50">
                                  <ShieldX className="w-4 h-4 mx-auto mb-1 opacity-20" />
                                  Kein Prozess verknüpft
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {resourceBackups.length === 0 && (
                      <div className="py-20 text-center opacity-30 italic space-y-3">
                        <HardDrive className="w-12 h-12 mx-auto" />
                        <p className="text-sm font-black uppercase tracking-widest">Keine Backup-Jobs konfiguriert</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-blue-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200">
                      <Activity className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Patch-Management (Updates)</CardTitle>
                  </div>
                  <Badge className={cn("rounded-full px-3 h-6 text-[10px] font-black border-none shadow-sm", resource.updatesRequired ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400")}>
                    {resource.updatesRequired ? 'AKTIV' : 'NICHT ERFORDERLICH'}
                  </Badge>
                </CardHeader>
                <CardContent className="p-6">
                  {resource.updatesRequired ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {resourceUpdates.map(p => (
                        <div key={p.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-blue-300 hover:bg-white transition-all cursor-pointer shadow-sm" onClick={() => router.push(`/processhub/view/${p.id}`)}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform"><Workflow className="w-5 h-5" /></div>
                            <div>
                              <span className="text-[11px] font-black text-slate-800 uppercase">{p.title}</span>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Patching-Workflow</p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                        </div>
                      ))}
                      {resourceUpdates.length === 0 && <div className="col-span-full py-12 text-center text-xs text-slate-400 italic border-2 border-dashed rounded-3xl bg-slate-50/30">Keine Update-Prozesse verknüpft</div>}
                    </div>
                  ) : (
                    <div className="p-16 text-center border-2 border-dashed rounded-3xl opacity-20 bg-slate-50/30">
                      <ShieldX className="w-12 h-12 mx-auto mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest">Kein Patch-Bedarf definiert</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6 animate-in fade-in duration-500">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-indigo-600" />
                    <div>
                      <CardTitle className="text-sm font-bold">Systemspezifische Rollen (IAM)</CardTitle>
                      <CardDescription className="text-[10px] font-black uppercase tracking-widest">Grundlage für granulare Berechtigungs-Reviews</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/30">
                      <TableRow>
                        <TableHead className="py-4 px-8 font-bold text-[10px] uppercase text-slate-400 tracking-widest">Rollenbezeichnung</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400 text-center tracking-widest">Risiko</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase text-slate-400 tracking-widest">Privileg-Level</TableHead>
                        <TableHead className="text-right px-8 font-bold text-[10px] uppercase text-slate-400 tracking-widest">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourceRoles.map(role => (
                        <TableRow key={role.id} className="group hover:bg-slate-50 border-b last:border-0 cursor-pointer" onClick={() => router.push(`/roles/${role.id}`)}>
                          <TableCell className="py-5 px-8">
                            <div className="font-bold text-xs text-slate-800 group-hover:text-primary transition-colors">{role.name}</div>
                            <p className="text-[9px] text-slate-400 truncate max-w-sm font-medium italic mt-0.5">{role.description || 'Keine Funktionsbeschreibung'}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-black h-4 px-1.5 border-none uppercase shadow-sm", 
                              role.riskLevel === 'high' ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                            )}>{role.riskLevel}</Badge>
                          </TableCell>
                          <TableCell>
                            {role.isAdmin ? (
                              <Badge className="bg-red-600 text-white border-none text-[7px] font-black h-4 px-1.5 shadow-md">ADMINISTRATIV</Badge>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Standard-Zugriff</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right px-8">
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-white shadow-sm">
                              <ArrowRight className="w-4 h-4 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {resourceRoles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
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
    </div>
  );
}
