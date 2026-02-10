
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Loader2, 
  Layers, 
  Filter,
  Download,
  Server,
  Pencil,
  Eye,
  Briefcase,
  Fingerprint,
  Database,
  KeyRound,
  ShieldAlert,
  Save as SaveIcon,
  Archive,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Globe,
  UserCircle,
  HardDrive,
  Activity,
  History,
  Trash2,
  Workflow,
  X,
  PlusCircle,
  Settings2,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Tenant, JobTitle, ServicePartner, AssetTypeOption, OperatingModelOption, ServicePartnerArea, Department, Process, BackupJob, ResourceUpdateProcess, ProcessType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { exportResourcesExcel } from '@/lib/export-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveResourceAction } from '@/app/actions/resource-actions';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { usePlatformAuth } from '@/context/auth-context';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

export const dynamic = 'force-dynamic';

export default function ResourcesPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');

  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('');
  const [category, setCategory] = useState('Fachanwendung');
  const [operatingModel, setOperatingModel] = useState('');
  const [criticality, setCriticality] = useState<Resource['criticality']>('medium');
  const [dataClassification, setDataClassification] = useState<Resource['dataClassification']>('internal');
  const [confidentialityReq, setConfidentialityReq] = useState<Resource['confidentialityReq']>('medium');
  const [integrityReq, setIntegrityReq] = useState<Resource['integrityReq']>('medium');
  const [availabilityReq, setAvailabilityReq] = useState<Resource['availabilityReq']>('medium');
  const [hasPersonalData, setHasPersonalData] = useState(false);
  const [isDataRepository, setIsDataRepository] = useState(false);
  const [isIdentityProvider, setIsIdentityProvider] = useState(false);
  const [identityProviderId, setIdentityProviderId] = useState('none');
  const [dataLocation, setDataLocation] = useState('');
  
  const [systemOwnerType, setSystemOwnerType] = useState<'internal' | 'external'>('internal');
  const [systemOwnerRoleId, setSystemOwnerRoleId] = useState('');
  const [externalRefId, setExternalRefId] = useState('none'); 
  const [riskOwnerRoleId, setRiskOwnerRoleId] = useState('');

  const [backupRequired, setBackupRequired] = useState(false);
  const [updatesRequired, setUpdatesRequired] = useState(false);

  // Backup & Updates Local State
  const [localBackupJobs, setLocalBackupJobs] = useState<Partial<BackupJob>[]>([]);
  const [selectedUpdateProcessIds, setSelectedUpdateProcessIds] = useState<string[]>([]);

  // Backup Modal State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [currentBackupIdx, setCurrentBackupIdx] = useState<number | null>(null);
  const [backupForm, setBackupForm] = useState<Partial<BackupJob>>({
    name: '', cycle: 'Täglich', storage_location: '', description: '', responsible_id: '', lastReviewDate: '', it_process_id: 'none', detail_process_id: 'none'
  });

  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');

  const { data: resources, isLoading, refresh } = usePluggableCollection<Resource>('resources');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departmentsData } = usePluggableCollection<Department>('departments');
  const { data: partners } = usePluggableCollection<ServicePartner>('servicePartners');
  const { data: areas } = usePluggableCollection<ServicePartnerArea>('servicePartnerAreas');
  const { data: assetTypeOptions } = usePluggableCollection<AssetTypeOption>('assetTypeOptions');
  const { data: operatingModelOptions } = usePluggableCollection<OperatingModelOption>('operatingModelOptions');
  const { data: allProcesses } = usePluggableCollection<Process>('processes');
  const { data: allBackupJobs, refresh: refreshBackups } = usePluggableCollection<BackupJob>('backup_jobs');
  const { data: allUpdateLinks, refresh: refreshUpdates } = usePluggableCollection<ResourceUpdateProcess>('resource_update_processes');

  useEffect(() => { setMounted(true); }, []);

  const sortedRoles = useMemo(() => {
    if (!jobTitles || !departmentsData) return [];
    return [...jobTitles].sort((a, b) => {
      const deptA = departmentsData.find(d => d.id === a.departmentId)?.name || '';
      const deptB = departmentsData.find(d => d.id === b.departmentId)?.name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  }, [jobTitles, departmentsData]);

  const itProcesses = useMemo(() => {
    return allProcesses?.filter(p => p.status !== 'archived') || [];
  }, [allProcesses]);

  const handleSave = async () => {
    if (!name || !assetType) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Name und Typ angeben." });
      return;
    }

    setIsSaving(true);
    const id = selectedResource?.id || `res-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    let externalOwnerPartnerId = undefined;
    let externalOwnerAreaId = undefined;
    if (externalRefId.startsWith('p:')) {
      externalOwnerPartnerId = externalRefId.split(':')[1];
    } else if (externalRefId.startsWith('a:')) {
      externalOwnerAreaId = externalRefId.split(':')[1];
      externalOwnerPartnerId = areas?.find(a => a.id === externalOwnerAreaId)?.partnerId;
    }

    const resourceData: Resource = {
      ...selectedResource,
      id,
      tenantId: targetTenantId,
      name, assetType, category, operatingModel, criticality, dataClassification,
      confidentialityReq, integrityReq, availabilityReq,
      hasPersonalData, isDataRepository, isIdentityProvider,
      backupRequired, updatesRequired,
      identityProviderId: identityProviderId === 'none' ? undefined : (identityProviderId === 'self' ? id : identityProviderId),
      dataLocation,
      systemOwnerRoleId: systemOwnerType === 'internal' && systemOwnerRoleId !== 'none' ? systemOwnerRoleId : undefined,
      externalOwnerPartnerId: systemOwnerType === 'external' ? externalOwnerPartnerId : undefined,
      externalOwnerAreaId: systemOwnerType === 'external' ? externalOwnerAreaId : undefined,
      riskOwnerRoleId: riskOwnerRoleId !== 'none' ? riskOwnerRoleId : undefined,
      notes, url, status: selectedResource?.status || 'active',
      createdAt: selectedResource?.createdAt || new Date().toISOString()
    } as Resource;

    try {
      const res = await saveResourceAction(resourceData, dataSource, user?.email || 'system');
      if (res.success) {
        if (selectedResource) {
          const oldJobs = allBackupJobs?.filter(b => b.resourceId === id) || [];
          for (const oj of oldJobs) await deleteCollectionRecord('backup_jobs', oj.id, dataSource);
          const oldUpdates = allUpdateLinks?.filter(u => u.resourceId === id) || [];
          for (const ou of oldUpdates) await deleteCollectionRecord('resource_update_processes', ou.id, dataSource);
        }

        for (const job of localBackupJobs) {
          const jobId = job.id || `bj-${Math.random().toString(36).substring(2, 7)}`;
          await saveCollectionRecord('backup_jobs', jobId, { 
            ...job, id: jobId, resourceId: id,
            it_process_id: job.it_process_id === 'none' ? undefined : job.it_process_id,
            detail_process_id: job.detail_process_id === 'none' ? undefined : job.detail_process_id,
            updatedAt: new Date().toISOString(),
            createdAt: job.createdAt || new Date().toISOString()
          }, dataSource);
        }

        for (const pid of selectedUpdateProcessIds) {
          const lid = `upl-${id}-${pid}`;
          await saveCollectionRecord('resource_update_processes', lid, { 
            id: lid, resourceId: id, processId: pid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          }, dataSource);
        }

        toast({ title: selectedResource ? "Ressource aktualisiert" : "Ressource registriert" });
        setIsDialogOpen(false);
        refresh();
        refreshBackups();
        refreshUpdates();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (res: Resource) => {
    setSelectedResource(res);
    setName(res.name);
    setAssetType(res.assetType);
    setCategory(res.category);
    setOperatingModel(res.operatingModel);
    setCriticality(res.criticality);
    setDataClassification(res.dataClassification || 'internal');
    setConfidentialityReq(res.confidentialityReq || 'medium');
    setIntegrityReq(res.integrityReq || 'medium');
    setAvailabilityReq(res.availabilityReq || 'medium');
    setHasPersonalData(!!res.hasPersonalData);
    setIsDataRepository(!!res.isDataRepository);
    setIsIdentityProvider(!!res.isIdentityProvider);
    setBackupRequired(!!res.backupRequired);
    setUpdatesRequired(!!res.updatesRequired);
    setLocalBackupJobs(allBackupJobs?.filter(b => b.resourceId === res.id) || []);
    setSelectedUpdateProcessIds(allUpdateLinks?.filter(u => u.resourceId === res.id).map(u => u.processId) || []);
    if (res.identityProviderId === res.id) setIdentityProviderId('self');
    else setIdentityProviderId(res.identityProviderId || 'none');
    setDataLocation(res.dataLocation || '');
    const hasExternal = !!(res.externalOwnerPartnerId || res.externalOwnerAreaId);
    setSystemOwnerType(hasExternal ? 'external' : 'internal');
    setSystemOwnerRoleId(res.systemOwnerRoleId || 'none');
    if (res.externalOwnerAreaId) setExternalRefId(`a:${res.externalOwnerAreaId}`);
    else if (res.externalOwnerPartnerId) setExternalRefId(`p:${res.externalOwnerPartnerId}`);
    else setExternalRefId('none');
    setRiskOwnerRoleId(res.riskOwnerRoleId || 'none');
    setNotes(res.notes || '');
    setUrl(res.url || '');
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedResource(null);
    setName(''); setAssetType(''); setCategory('Fachanwendung'); setOperatingModel('');
    setCriticality('medium'); setDataClassification('internal');
    setConfidentialityReq('medium'); setIntegrityReq('medium'); setAvailabilityReq('medium');
    setHasPersonalData(false); setIsDataRepository(false); setIsIdentityProvider(false);
    setIdentityProviderId('none'); setDataLocation(''); setSystemOwnerType('internal');
    setSystemOwnerRoleId(''); setExternalRefId('none'); setRiskOwnerRoleId('');
    setBackupRequired(false); setUpdatesRequired(false);
    setLocalBackupJobs([]); setSelectedUpdateProcessIds([]);
    setNotes(''); setUrl('');
  };

  const handleOpenBackupModal = (idx: number | null = null) => {
    if (idx !== null) {
      setBackupForm(localBackupJobs[idx]);
      setCurrentBackupIdx(idx);
    } else {
      setBackupForm({
        name: '', cycle: 'Täglich', storage_location: '', description: '', responsible_id: '', lastReviewDate: '', it_process_id: 'none', detail_process_id: 'none'
      });
      setCurrentBackupIdx(null);
    }
    setIsBackupModalOpen(true);
  };

  const saveBackupForm = () => {
    if (!backupForm.name || !backupForm.responsible_id) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und Verantwortlicher sind erforderlich." });
      return;
    }
    const next = [...localBackupJobs];
    if (currentBackupIdx !== null) next[currentBackupIdx] = backupForm;
    else next.push({ ...backupForm, createdAt: new Date().toISOString() });
    setLocalBackupJobs(next);
    setIsBackupModalOpen(false);
  };

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    return resources.filter(res => {
      const isGlobal = res.tenantId === 'global' || !res.tenantId;
      if (activeTenantId !== 'all' && !isGlobal && res.tenantId !== activeTenantId) return false;
      const matchSearch = res.name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = showArchived ? res.status === 'archived' : res.status !== 'archived';
      const matchType = assetTypeFilter === 'all' || res.assetType === assetTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [resources, search, activeTenantId, showArchived, assetTypeFilter]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-wider">Resource Catalog</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Ressourcenkatalog</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale IT-Assets Verwaltung.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4" onClick={() => exportResourcesExcel(filteredResources)}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all active:scale-95" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Neue Ressource
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input placeholder="Systeme filtern..." className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 h-9 shrink-0">
          <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
            <SelectTrigger className="h-full border-none shadow-none text-[10px] font-bold min-w-[140px] bg-transparent">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {assetTypeOptions?.filter(o => o.enabled).map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 px-3 h-9 border rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 shrink-0">
          <Switch id="archive-toggle" checked={showArchived} onCheckedChange={setShowArchived} className="scale-75" />
          <Label htmlFor="archive-toggle" className="text-[10px] font-bold cursor-pointer text-slate-500 whitespace-nowrap">Archiv</Label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-bold text-slate-400 uppercase">Lade Inventar...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Anwendung / Asset</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 text-center uppercase tracking-widest">CIA</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 text-center uppercase tracking-widest">Backup/Updates</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((res) => {
                const backups = allBackupJobs?.filter(b => b.resourceId === res.id).length || 0;
                const updates = allUpdateLinks?.filter(u => u.resourceId === res.id).length || 0;
                return (
                  <TableRow key={res.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer", res.status === 'archived' && "opacity-60")} onClick={() => router.push(`/resources/${res.id}`)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                          <Server className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{res.name}</div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{res.assetType} • {res.operatingModel}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn("text-[8px] font-black h-4 px-1.5 border-none uppercase", res.criticality === 'high' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>{res.criticality}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {res.backupRequired && <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black gap-1 border-orange-200 text-orange-600"><HardDrive className="w-2 h-2" /> {backups}</Badge>}
                        {res.updatesRequired && <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black gap-1 border-blue-200 text-blue-600"><Activity className="w-2 h-2" /> {updates}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => openEdit(res)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => router.push(`/resources/${res.id}`)}><Eye className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                  <Server className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate uppercase tracking-tight">Asset Governance</DialogTitle>
                  <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Wartung, Backup & Schutzbedarfe</DialogDescription>
                </div>
              </div>
              <AiFormAssistant formType="resource" currentData={{ name, assetType, criticality }} onApply={(s) => { if(s.name) setName(s.name); if(s.criticality) setCriticality(s.criticality); }} />
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b shrink-0 bg-white">
              <TabsList className="h-12 bg-transparent gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Basisdaten</TabsTrigger>
                <TabsTrigger value="gov" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-emerald-600 transition-all">Schutzbedarf</TabsTrigger>
                <TabsTrigger value="maintenance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-orange-600 transition-all">Wartung & Backup</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 transition-all">Ownership</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Bezeichnung</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white shadow-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Asset Typ</Label>
                      <Select value={assetType} onValueChange={(v:any) => setAssetType(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">{assetTypeOptions?.filter(o => o.enabled).map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Betriebsmodell</Label>
                      <Select value={operatingModel} onValueChange={(v:any) => setOperatingModel(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">{operatingModelOptions?.filter(o => o.enabled).map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="gov" className="mt-0 space-y-8">
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Kritikalität</Label><Select value={criticality} onValueChange={(v:any) => setCriticality(v)}><SelectTrigger className="rounded-xl h-11 bg-slate-50/50"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="low">Niedrig</SelectItem><SelectItem value="medium">Mittel</SelectItem><SelectItem value="high">Hoch</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Schutzbedarf V</Label><Select value={confidentialityReq} onValueChange={(v:any) => setConfidentialityReq(v)}><SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2 flex items-center gap-4 pt-6"><Label className="text-[10px] font-bold text-slate-900">Pers. Daten</Label><Switch checked={hasPersonalData} onCheckedChange={setHasPersonalData} /></div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="maintenance" className="mt-0 space-y-10 pb-20">
                  <div className="space-y-10">
                    <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-orange-600" />
                          <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Datensicherung (Backup)</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">Erforderlich</Label>
                          <Switch checked={backupRequired} onCheckedChange={setBackupRequired} className="data-[state=checked]:bg-orange-600" />
                        </div>
                      </div>
                      {backupRequired && (
                        <div className="space-y-4">
                          <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-2 border-orange-200 text-orange-700" onClick={() => handleOpenBackupModal()}>
                            <PlusCircle className="w-3.5 h-3.5" /> Backup-Job anlegen
                          </Button>
                          <div className="grid grid-cols-1 gap-3">
                            {localBackupJobs.map((job, idx) => (
                              <div key={idx} className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-orange-600 border shadow-inner"><HardDrive className="w-4 h-4" /></div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{job.name}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-slate-200 uppercase">{job.cycle}</Badge>
                                      <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1"><UserCircle className="w-2.5 h-2.5" /> {jobTitles?.find(r => r.id === job.responsible_id)?.name || 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => handleOpenBackupModal(idx)}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => setLocalBackupJobs(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-blue-600" />
                          <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Updates & Patching</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] font-bold uppercase text-slate-400">Erforderlich</Label>
                          <Switch checked={updatesRequired} onCheckedChange={setUpdatesRequired} className="data-[state=checked]:bg-blue-600" />
                        </div>
                      </div>
                      {updatesRequired && (
                        <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">IT-Prozesse verknüpfen</Label>
                          <ScrollArea className="h-48 border rounded-xl bg-slate-50/50 p-2 shadow-inner">
                            <div className="grid grid-cols-1 gap-1">
                              {itProcesses.map(proc => (
                                <div key={proc.id} className={cn("p-2 rounded-lg flex items-center gap-3 cursor-pointer", selectedUpdateProcessIds.includes(proc.id) ? "bg-blue-50 border-blue-200" : "hover:bg-slate-100")} onClick={() => setSelectedUpdateProcessIds(prev => prev.includes(proc.id) ? prev.filter(id => id !== proc.id) : [...prev, proc.id])}>
                                  <Checkbox checked={selectedUpdateProcessIds.includes(proc.id)} />
                                  <span className="text-[11px] font-bold text-slate-700">{proc.title}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="mt-0 space-y-10">
                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-slate-400">System Owner (Intern)</Label>
                      <Select value={systemOwnerRoleId} onValueChange={setSystemOwnerRoleId}>
                        <SelectTrigger className="rounded-xl h-11 bg-white shadow-sm"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none">Keine</SelectItem>
                          {sortedRoles?.map(job => <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-[10px] h-11 uppercase">Abbrechen</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="rounded-xl h-11 px-12 bg-primary text-white font-bold text-[10px] uppercase shadow-lg gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Speichern
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Backup Job Modal */}
      <Dialog open={isBackupModalOpen} onOpenChange={setIsBackupModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden bg-white shadow-2xl border-none">
          <DialogHeader className="p-6 bg-orange-600 text-white shrink-0">
            <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">Backup-Job Details</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Name des Jobs</Label>
              <Input value={backupForm.name} onChange={e => setBackupForm({...backupForm, name: e.target.value})} placeholder="z.B. SQL Full Dump" className="h-11 rounded-xl font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Zyklus</Label>
                <Select value={backupForm.cycle} onValueChange={(v:any) => setBackupForm({...backupForm, cycle: v})}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">{['Täglich', 'Wöchentlich', 'Monatlich', 'Manuell'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortlicher</Label>
                <Select value={backupForm.responsible_id} onValueChange={v => setBackupForm({...backupForm, responsible_id: v})}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                  <SelectContent className="rounded-xl">{sortedRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">IT-Prozess (Workflow)</Label>
                <Select value={backupForm.it_process_id || 'none'} onValueChange={v => setBackupForm({...backupForm, it_process_id: v})}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Kein Prozess" /></SelectTrigger>
                  <SelectContent className="rounded-xl"><SelectItem value="none">Keiner</SelectItem>{itProcesses.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Detailprozess</Label>
                <Select value={backupForm.detail_process_id || 'none'} onValueChange={v => setBackupForm({...backupForm, detail_process_id: v})}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Keiner" /></SelectTrigger>
                  <SelectContent className="rounded-xl"><SelectItem value="none">Keiner</SelectItem>{itProcesses.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Speicherort</Label>
              <Input value={backupForm.storage_location} onChange={e => setBackupForm({...backupForm, storage_location: e.target.value})} placeholder="/backup/path/..." className="h-11 rounded-xl font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Letztes Review</Label>
              <Input type="date" value={backupForm.lastReviewDate} onChange={e => setBackupForm({...backupForm, lastReviewDate: e.target.value})} className="h-11 rounded-xl" />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIsBackupModalOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button>
            <Button onClick={saveBackupForm} className="rounded-xl h-11 px-12 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] uppercase shadow-lg">Job Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
