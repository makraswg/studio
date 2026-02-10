
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
  Save as SaveIcon,
  Fingerprint,
  KeyRound,
  ShieldX,
  HardDrive,
  RefreshCw,
  ClipboardList
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Process, ProcessVersion, ProcessNode, Risk, RiskMeasure, ProcessingActivity, Feature, JobTitle, ServicePartner, ServicePartnerContact, FeatureProcessStep, ServicePartnerArea, Department, Entitlement, BackupJob, UpdateProcess } from '@/lib/types';
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

  // Role Management State
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Entitlement | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleRiskLevel, setRoleRiskLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [roleIsAdmin, setRoleIsAdmin] = useState(false);
  const [roleMapping, setRoleMapping] = useState('');

  // Backup Job State
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isSavingBackup, setIsSavingBackup] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [backupCycle, setBackupCycle] = useState<'daily' | 'weekly' | 'monthly' | 'manual'>('daily');
  const [backupLocation, setBackupLocation] = useState('');
  const [backupReview, setBackupReview] = useState('');

  // Update Process State
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [updateName, setUpdateName] = useState('');
  const [updateFreq, setUpdateFreq] = useState<'monthly' | 'quarterly' | 'on_release' | 'manual'>('monthly');
  const [updateRespId, setUpdateRespId] = useState('');
  const [updateLastRun, setUpdateLastRun] = useState('');

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
  const { data: contacts } = usePluggableCollection<ServicePartnerContact>('servicePartnerContacts');
  const { data: areas } = usePluggableCollection<ServicePartnerArea>('servicePartnerAreas');
  const { data: entitlements, refresh: refreshRoles } = usePluggableCollection<Entitlement>('entitlements');
  const { data: backups, refresh: refreshBackups } = usePluggableCollection<BackupJob>('backupJobs');
  const { data: updates, refresh: refreshUpdates } = usePluggableCollection<UpdateProcess>('updateProcesses');

  useEffect(() => { setMounted(true); }, []);

  const resource = useMemo(() => resources?.find(r => r.id === id), [resources, id]);
  const resourceRoles = useMemo(() => entitlements?.filter(e => e.resourceId === id) || [], [entitlements, id]);
  const resourceBackups = useMemo(() => backups?.filter(b => b.resourceId === id) || [], [backups, id]);
  const resourceUpdates = useMemo(() => updates?.filter(u => u.resourceId === id) || [], [updates, id]);
  
  const systemOwnerRole = useMemo(() => jobTitles?.find(j => j.id === resource?.systemOwnerRoleId), [jobTitles, resource]);
  const systemOwnerDept = useMemo(() => departmentsData?.find(d => d.id === systemOwnerRole?.departmentId), [departmentsData, systemOwnerRole]);
  const systemOwnerPartner = useMemo(() => partners?.find(p => p.id === resource?.externalOwnerPartnerId), [partners, resource]);
  const systemOwnerArea = useMemo(() => areas?.find(a => a.id === resource?.externalOwnerAreaId), [areas, resource]);
  const riskOwnerRole = useMemo(() => jobTitles?.find(j => j.id === resource?.riskOwnerRoleId), [jobTitles, resource]);
  const riskOwnerDept = useMemo(() => departmentsData?.find(d => d.id === riskOwnerRole?.departmentId), [departmentsData, riskOwnerRole]);

  const identityProvider = useMemo(() => {
    if (!resource?.identityProviderId) return null;
    if (resource.identityProviderId === resource.id) return resource;
    return resources?.find(r => r.id === resource.identityProviderId);
  }, [resource, resources]);

  const impactAnalysis = useMemo(() => {
    if (!resource || !processes || !versions) return { processes: [], vvts: [], features: [] };
    const affectedProcesses = processes.filter(p => {
      const ver = versions.find(v => v.process_id === p.id && v.version === p.currentVersion);
      return ver?.model_json?.nodes?.some((n: ProcessNode) => n.resourceIds?.includes(resource.id));
    });
    const vvtIds = new Set(affectedProcesses.map(p => p.vvtId).filter(Boolean));
    const affectedVvts = vvts?.filter(v => vvtIds.has(v.id)) || [];
    const featureIdsUsed = new Set<string>();
    featureLinks?.forEach(link => { if (affectedProcesses.some(p => p.id === link.processId)) featureIdsUsed.add(link.featureId); });
    const linkedFeatures = features?.filter(f => featureIdsUsed.has(f.id) || f.dataStoreId === resource.id) || [];
    return { processes: affectedProcesses, vvts: affectedVvts, features: linkedFeatures };
  }, [resource, processes, versions, vvts, features, featureLinks]);

  const effectiveInheritance = useMemo(() => {
    if (!impactAnalysis.features || impactAnalysis.features.length === 0) return null;
    const rankMap = { 'low': 1, 'medium': 2, 'high': 3 };
    const classRankMap = { 'public': 1, 'internal': 2, 'confidential': 3, 'strictly_confidential': 4 };
    const revRankMap = { 1: 'low', 2: 'medium', 3: 'high' } as const;
    const revClassMap = { 1: 'public', 2: 'internal', 3: 'confidential', 4: 'strictly_confidential' } as const;
    let maxCrit = 1, maxC = 1, maxI = 1, maxA = 1, maxClass = 1;
    impactAnalysis.features.forEach(f => {
      maxCrit = Math.max(maxCrit, rankMap[f.criticality] || 1);
      maxC = Math.max(maxC, rankMap[f.confidentialityReq || 'low'] || 1);
      maxI = Math.max(maxI, rankMap[f.integrityReq || 'low'] || 1);
      maxA = Math.max(maxA, rankMap[f.availabilityReq || 'low'] || 1);
      if (f.criticality === 'high') maxClass = Math.max(maxClass, 3);
      else if (f.criticality === 'medium') maxClass = Math.max(maxClass, 2);
    });
    return { criticality: revRankMap[maxCrit as 1|2|3], confidentiality: revRankMap[maxC as 1|2|3], integrity: revRankMap[maxI as 1|2|3], availability: revRankMap[maxA as 1|2|3], classification: revClassMap[maxClass as 1|2|3|4] };
  }, [impactAnalysis.features]);

  const hasInheritanceMismatch = useMemo(() => {
    if (!resource || !effectiveInheritance) return false;
    const rankMap = { 'low': 1, 'medium': 2, 'high': 3 };
    const classRankMap = { 'public': 1, 'internal': 2, 'confidential': 3, 'strictly_confidential': 4 };
    const isUnderCrit = rankMap[resource.criticality] < rankMap[effectiveInheritance.criticality];
    const isUnderC = rankMap[resource.confidentialityReq] < rankMap[effectiveInheritance.confidentiality];
    const isUnderClass = (classRankMap[resource.dataClassification as keyof typeof classRankMap] || 1) < classRankMap[effectiveInheritance.classification];
    return isUnderCrit || isUnderC || isUnderClass;
  }, [resource, effectiveInheritance]);

  const handleApplyInheritance = async () => {
    if (!resource || !effectiveInheritance) return;
    setIsInheriting(true);
    const updatedResource: Resource = { ...resource, criticality: effectiveInheritance.criticality, confidentialityReq: effectiveInheritance.confidentiality, integrityReq: effectiveInheritance.integrity, availabilityReq: effectiveInheritance.availability, dataClassification: effectiveInheritance.classification };
    try {
      const res = await saveResourceAction(updatedResource, dataSource, user?.email || 'system');
      if (res.success) { toast({ title: "Compliance-Vorschlag übernommen" }); refreshRes(); }
    } finally { setIsInheriting(false); }
  };

  const handleSaveBackup = async () => {
    if (!backupName || !resource) return;
    setIsSavingBackup(true);
    const bid = `bck-${Math.random().toString(36).substring(2, 7)}`;
    const data: BackupJob = { id: bid, resourceId: resource.id, name: backupName, cycle: backupCycle, location: backupLocation, lastReviewDate: backupReview };
    const res = await saveCollectionRecord('backupJobs', bid, data, dataSource);
    if (res.success) { toast({ title: "Backup Job gespeichert" }); setIsBackupDialogOpen(false); refreshBackups(); }
    setIsSavingBackup(false);
  };

  const handleSaveUpdate = async () => {
    if (!updateName || !resource) return;
    setIsSavingUpdate(true);
    const uid = `upd-${Math.random().toString(36).substring(2, 7)}`;
    const data: UpdateProcess = { id: uid, resourceId: resource.id, name: updateName, frequency: updateFreq, responsibleRoleId: updateRespId, lastRunDate: updateLastRun };
    const res = await saveCollectionRecord('updateProcesses', uid, data, dataSource);
    if (res.success) { toast({ title: "Update Prozess gespeichert" }); setIsUpdateDialogOpen(false); refreshUpdates(); }
    setIsSavingUpdate(false);
  };

  const handleSaveRole = async () => {
    if (!roleName || !resource) return;
    setIsSavingRole(true);
    const roleId = selectedRole?.id || `ent-${Math.random().toString(36).substring(2, 9)}`;
    const roleData: Entitlement = { ...selectedRole, id: roleId, resourceId: resource.id, name: roleName, description: roleDesc, riskLevel: roleRiskLevel, isAdmin: roleIsAdmin, externalMapping: roleMapping, tenantId: resource.tenantId };
    try {
      const res = await saveCollectionRecord('entitlements', roleId, roleData, dataSource);
      if (res.success) { toast({ title: selectedRole ? "Rolle aktualisiert" : "Rolle angelegt" }); setIsRoleDialogOpen(false); refreshRoles(); }
    } finally { setIsSavingRole(false); }
  };

  const openRoleEdit = (role: Entitlement) => {
    setSelectedRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description || '');
    setRoleRiskLevel(role.riskLevel as any || 'low');
    setRoleIsAdmin(!!role.isAdmin);
    setRoleMapping(role.externalMapping || '');
    setIsRoleDialogOpen(true);
  };

  const resetRoleForm = () => {
    setSelectedRole(null);
    setRoleName('');
    setRoleDesc('');
    setRoleRiskLevel('low');
    setRoleIsAdmin(false);
    setRoleMapping('');
  };

  const sortedRoles = useMemo(() => {
    if (!jobTitles || !departmentsData) return [];
    return [...jobTitles].sort((a, b) => {
      const deptA = departmentsData.find(d => d.id === a.departmentId)?.name || '';
      const deptB = departmentsData.find(d => d.id === b.departmentId)?.name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  }, [jobTitles, departmentsData]);

  const getFullRoleName = (roleId?: string) => {
    if (!roleId || roleId === 'none') return '---';
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departmentsData?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  };

  if (!mounted) return null;

  if (isResLoading) {
    return <div className="h-full flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Analysiere Asset-Kontext...</p></div>;
  }

  if (!resource) {
    return <div className="p-20 text-center space-y-4"><AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" /><h2 className="text-xl font-headline font-bold text-slate-900">Ressource nicht gefunden</h2><Button onClick={() => router.push('/resources')}>Zurück zum Katalog</Button></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/resources')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">{resource?.name}</h1>
              <Badge className={cn("rounded-full px-2 h-5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm", resource?.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700")}>{resource?.assetType}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {resource?.id} • {resource?.operatingModel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-6 border-slate-200" onClick={() => router.push(`/audit?search=${resource?.id}`)}><Activity className="w-3.5 h-3.5 mr-2" /> Audit-Historie</Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-95 transition-all" onClick={() => router.push('/resources')}><Settings2 className="w-3.5 h-3.5 mr-2" /> Bearbeiten</Button>
        </div>
      </header>

      {hasInheritanceMismatch && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-4">
          <Zap className="h-5 w-5 text-amber-600" />
          <AlertTitle className="font-bold text-sm">Governance Drift erkannt!</AlertTitle>
          <AlertDescription className="text-xs mt-1 leading-relaxed">Die verarbeiteten Datenobjekte erfordern eine höhere Klassifizierung (<strong className="uppercase">{effectiveInheritance?.classification}</strong>).<div className="mt-3"><Button size="sm" onClick={handleApplyInheritance} disabled={isInheriting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase h-8 px-4 rounded-lg shadow-md gap-2 transition-all">{isInheriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Werte übernehmen</Button></div></AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4 px-6"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verantwortung</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">System Owner</p>{systemOwnerPartner ? (<div className="space-y-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100 shadow-inner"><div className="flex items-center gap-2"><Badge className="bg-indigo-600 text-white border-none rounded-full h-3 px-1 text-[6px] font-black uppercase tracking-widest">EXTERN</Badge><p className="text-[10px] font-black uppercase text-indigo-900 truncate">{systemOwnerPartner.name}</p></div>{systemOwnerArea && (<div className="flex items-center gap-2 pt-1 border-t border-indigo-100/50"><Briefcase className="w-3.5 h-3.5 text-indigo-400" /><p className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight">{systemOwnerArea.name}</p></div>)}</div>) : systemOwnerRole ? (<div className="space-y-1"><div className="flex items-center gap-2 text-slate-900 font-bold text-sm"><Briefcase className="w-4 h-4 text-primary" /> {systemOwnerRole.name}</div>{systemOwnerDept && <p className="text-[9px] text-slate-400 font-bold uppercase pl-6">{systemOwnerDept.name}</p>}</div>) : (<p className="text-sm text-slate-300 italic font-medium p-1">Nicht zugewiesen</p>)}</div>
              <div className="space-y-1"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Risk Owner</p>{riskOwnerRole ? (<div className="space-y-1"><div className="flex items-center gap-2 text-slate-900 font-bold text-sm"><ShieldAlert className="w-4 h-4 text-orange-600" /> {riskOwnerRole.name}</div>{riskOwnerDept && <p className="text-[9px] text-slate-400 font-bold uppercase pl-6">{riskOwnerDept.name}</p>}</div>) : (<p className="text-sm text-slate-300 italic font-medium p-1">Nicht zugewiesen</p>)}</div>
            </CardContent>
          </Card>
        </aside>

        <div className="lg:col-span-3">
          <Tabs defaultValue="roles" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 h-11 rounded-xl border w-full justify-start gap-1 shadow-inner overflow-x-auto no-scrollbar">
              <TabsTrigger value="roles" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Rollen</TabsTrigger>
              <TabsTrigger value="impact" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><Zap className="w-3.5 h-3.5 text-primary" /> Impact</TabsTrigger>
              {resource?.backupRequired && <TabsTrigger value="backup" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-emerald-600"><HardDrive className="w-3.5 h-3.5" /> Datensicherung</TabsTrigger>}
              {resource?.updatesRequired && <TabsTrigger value="updates" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-blue-600"><RefreshCw className="w-3.5 h-3.5" /> Patching</TabsTrigger>}
              <TabsTrigger value="details" className="rounded-lg px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"><Info className="w-3.5 h-3.5" /> Technik</TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="space-y-6">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-primary" /><div><CardTitle className="text-sm font-bold">Systemrollen</CardTitle><CardDescription className="text-[10px] font-bold uppercase">Berechtigungsprofile</CardDescription></div></div>
                  <Button size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2 bg-primary text-white shadow-sm" onClick={() => { resetRoleForm(); setIsRoleDialogOpen(true); }}><Plus className="w-3.5 h-3.5" /> Rolle hinzufügen</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table><TableHeader className="bg-slate-50/30"><TableRow><TableHead className="py-3 px-6 font-bold text-[10px] uppercase text-slate-400">Rolle</TableHead><TableHead className="font-bold text-[10px] uppercase text-slate-400">Risiko</TableHead><TableHead className="font-bold text-[10px] uppercase text-slate-400">Typ</TableHead><TableHead className="text-right px-6 font-bold text-[10px] uppercase text-slate-400">Aktionen</TableHead></TableRow></TableHeader><TableBody>
                    {resourceRoles.map(role => (
                      <TableRow key={role.id} className="group hover:bg-slate-50 border-b last:border-0"><TableCell className="py-4 px-6"><div className="font-bold text-xs text-slate-800">{role.name}</div><div className="text-[9px] text-slate-400 font-medium truncate max-w-xs">{role.description || '---'}</div></TableCell><TableCell><Badge variant="outline" className={cn("text-[8px] font-black h-4 border-none", role.riskLevel === 'high' ? "bg-red-50 text-red-600" : role.riskLevel === 'medium' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600")}>{role.riskLevel?.toUpperCase()}</Badge></TableCell><TableCell>{role.isAdmin ? <Badge className="bg-red-600 text-white border-none rounded-full h-4 px-1.5 text-[7px] font-black uppercase">ADMIN</Badge> : <Badge variant="outline" className="text-[7px] font-bold text-slate-400 h-4 px-1.5">Standard</Badge>}</TableCell><TableCell className="text-right px-6"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openRoleEdit(role)}><Pencil className="w-3.5 h-3.5" /></Button></div></TableCell></TableRow>
                    ))}
                  </TableBody></Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup" className="space-y-6 animate-in fade-in">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-emerald-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3"><HardDrive className="w-5 h-5 text-emerald-600" /><div><CardTitle className="text-sm font-bold text-emerald-900">Datensicherungskonzept</CardTitle><CardDescription className="text-[10px] font-bold text-emerald-600 uppercase">Sicherstellung der Datenverfügbarkeit</CardDescription></div></div>
                  <Button size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2 bg-emerald-600 text-white shadow-sm" onClick={() => { setBackupName(''); setIsBackupDialogOpen(true); }}><Plus className="w-3.5 h-3.5" /> Backup Job</Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-3">
                    {resourceBackups.map(b => (
                      <div key={b.id} className="p-4 bg-white border rounded-2xl flex items-center justify-between hover:border-emerald-300 transition-all shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner"><HardDrive className="w-5 h-5" /></div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{b.name}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-[8px] font-black uppercase border-none bg-slate-50">{b.cycle}</Badge>
                              <span className="text-[9px] text-slate-400 font-medium italic">Ort: {b.location}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Letzter Test</p>
                          <p className="text-[10px] font-bold text-slate-700">{b.lastReviewDate || 'Ausstehend'}</p>
                        </div>
                      </div>
                    ))}
                    {resourceBackups.length === 0 && <div className="py-12 text-center border-2 border-dashed rounded-2xl opacity-30 italic text-xs uppercase">Keine Jobs definiert</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="updates" className="space-y-6 animate-in fade-in">
              <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-blue-50/50 border-b p-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3"><RefreshCw className="w-5 h-5 text-blue-600" /><div><CardTitle className="text-sm font-bold text-blue-900">Patch-Management</CardTitle><CardDescription className="text-[10px] font-bold text-blue-600 uppercase">Wartung & Sicherheits-Updates</CardDescription></div></div>
                  <Button size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase gap-2 bg-blue-600 text-white shadow-sm" onClick={() => { setUpdateName(''); setIsUpdateDialogOpen(true); }}><Plus className="w-3.5 h-3.5" /> Prozess hinzufügen</Button>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-3">
                    {resourceUpdates.map(u => (
                      <div key={u.id} className="p-4 bg-white border rounded-2xl flex items-center justify-between hover:border-blue-300 transition-all shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-inner"><ClipboardList className="w-5 h-5" /></div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{u.name}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-[8px] font-black uppercase border-none bg-slate-50">{u.frequency.replace('_', ' ')}</Badge>
                              <span className="text-[9px] text-slate-400 font-medium italic">Verantw.: {getFullRoleName(u.responsibleRoleId)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Letzter Lauf</p>
                          <p className="text-[10px] font-bold text-slate-700">{u.lastRunDate || 'Noch nie'}</p>
                        </div>
                      </div>
                    ))}
                    {resourceUpdates.length === 0 && <div className="py-12 text-center border-2 border-dashed rounded-2xl opacity-30 italic text-xs uppercase">Keine Prozesse definiert</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="impact" className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between"><div className="flex items-center gap-3"><Workflow className="w-5 h-5 text-indigo-600" /><div><CardTitle className="text-sm font-bold">Workflows</CardTitle></div></div><Badge variant="outline">{impactAnalysis.processes.length}</Badge></CardHeader>
                  <CardContent className="p-0"><ScrollArea className="h-[250px]"><div className="divide-y divide-slate-50">{impactAnalysis.processes.map(p => (<div key={p.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/processhub/view/${p.id}`)}><span className="text-xs font-bold text-slate-700">{p.title}</span><ChevronRight className="w-4 h-4 text-slate-300" /></div>))}</div></ScrollArea></CardContent>
                </Card>
                <Card className="rounded-2xl border shadow-sm bg-white overflow-hidden"><CardHeader className="bg-emerald-50/30 border-b p-6 flex flex-row items-center justify-between"><div className="flex items-center gap-3"><FileCheck className="w-5 h-5 text-emerald-600" /><div><CardTitle className="text-sm font-bold">Audit-Scope</CardTitle></div></div><Badge variant="outline">{impactAnalysis.vvts.length}</Badge></CardHeader><CardContent className="p-0"><ScrollArea className="h-[250px]"><div className="divide-y divide-slate-50">{impactAnalysis.vvts.map(v => (<div key={v.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/gdpr?search=${v.name}`)}><span className="text-xs font-bold text-slate-700">{v.name}</span><ChevronRight className="w-4 h-4" /></div>))}</div></ScrollArea></CardContent></Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Role Management Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary border border-primary/10 shadow-lg"><Shield className="w-5 h-5" /></div><div><DialogTitle className="text-lg font-bold">Systemrolle</DialogTitle></div></div></DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2"><Label className="text-[11px] font-bold text-slate-400 uppercase">Name</Label><Input value={roleName} onChange={e => setRoleName(e.target.value)} className="rounded-xl h-11" /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[11px] font-bold text-slate-400 uppercase">Risiko</Label><Select value={roleRiskLevel} onValueChange={(v:any) => setRoleRiskLevel(v)}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Niedrig</SelectItem><SelectItem value="medium">Mittel</SelectItem><SelectItem value="high">Hoch</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border mt-6"><Label className="text-[10px] font-bold text-slate-500">Admin</Label><Switch checked={roleIsAdmin} onCheckedChange={setRoleIsAdmin} /></div></div>
            <div className="space-y-2"><Label className="text-[11px] font-bold text-slate-400 uppercase">ID / Mapping</Label><Input value={roleMapping} onChange={e => setRoleMapping(e.target.value)} className="rounded-xl h-11 font-mono text-xs" /></div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t"><Button variant="ghost" onClick={() => setIsRoleDialogOpen(false)}>Abbrechen</Button><Button onClick={handleSaveRole} disabled={isSavingRole} className="rounded-xl h-11 px-8 bg-primary text-white shadow-lg gap-2">{isSavingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Dialog */}
      <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 bg-white">
          <DialogHeader className="p-6 bg-emerald-600 text-white"><DialogTitle>Backup Job erfassen</DialogTitle></DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Job-Bezeichnung</Label><Input value={backupName} onChange={e => setBackupName(e.target.value)} className="h-11 rounded-xl" placeholder="z.B. Voll-Backup Datenbank" /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Zyklus</Label><Select value={backupCycle} onValueChange={(v:any) => setBackupCycle(v)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Täglich</SelectItem><SelectItem value="weekly">Wöchentlich</SelectItem><SelectItem value="monthly">Monatlich</SelectItem><SelectItem value="manual">Manuell</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Review am</Label><Input type="date" value={backupReview} onChange={e => setBackupReview(e.target.value)} className="h-11 rounded-xl" /></div></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Speicherort</Label><Input value={backupLocation} onChange={e => setBackupLocation(e.target.value)} className="h-11 rounded-xl" placeholder="Cloud Storage / Tape" /></div>
          </div>
          <DialogFooter className="p-4 bg-slate-50"><Button variant="ghost" onClick={() => setIsBackupDialogOpen(false)}>Abbrechen</Button><Button onClick={handleSaveBackup} className="bg-emerald-600 text-white rounded-xl h-11 px-8 shadow-lg">Job sichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 bg-white">
          <DialogHeader className="p-6 bg-blue-600 text-white"><DialogTitle>Wartungs-Prozess erfassen</DialogTitle></DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Prozess-Bezeichnung</Label><Input value={updateName} onChange={e => setUpdateName(e.target.value)} className="h-11 rounded-xl" placeholder="z.B. Security Patching" /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Frequenz</Label><Select value={updateFreq} onValueChange={(v:any) => setUpdateFreq(v)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monatlich</SelectItem><SelectItem value="quarterly">Quartalsweise</SelectItem><SelectItem value="on_release">Bei Release</SelectItem><SelectItem value="manual">Manuell</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Zuständig</Label><Select value={updateRespId} onValueChange={setUpdateRespId}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle..." /></SelectTrigger><SelectContent>{sortedRoles.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Letzter Patch-Run</Label><Input type="date" value={updateLastRun} onChange={e => setUpdateLastRun(e.target.value)} className="h-11 rounded-xl" /></div>
          </div>
          <DialogFooter className="p-4 bg-slate-50"><Button variant="ghost" onClick={() => setIsUpdateDialogOpen(false)}>Abbrechen</Button><Button onClick={handleSaveUpdate} className="bg-blue-600 text-white rounded-xl h-11 px-8 shadow-lg">Prozess sichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
