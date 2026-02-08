
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
  MoreVertical,
  Server,
  Archive,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Database,
  User as UserIcon,
  Save,
  Pencil,
  Trash2,
  FileEdit,
  Activity,
  Info,
  HardDrive,
  HelpCircle,
  Eye,
  ChevronRight,
  UserCircle,
  Workflow,
  Zap,
  Briefcase,
  AlertTriangle,
  Building2,
  Fingerprint,
  KeyRound
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Tenant, JobTitle, ServicePartner, ServicePartnerContact, Process, ProcessVersion, ProcessNode, Feature, FeatureProcessStep, AssetTypeOption, OperatingModelOption, ServicePartnerArea, Department } from '@/lib/types';
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
import { saveResourceAction, deleteResourceAction } from '@/app/actions/resource-actions';
import { toast } from '@/hooks/use-toast';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { usePlatformAuth } from '@/context/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  
  // System Owner
  const [systemOwnerType, setSystemOwnerType] = useState<'internal' | 'external'>('internal');
  const [systemOwnerRoleId, setSystemOwnerRoleId] = useState('');
  const [externalRefId, setExternalRefId] = useState('none'); // Combined 'p:ID' or 'a:ID'
  
  // Risk Owner (ALWAYS INTERNAL)
  const [riskOwnerRoleId, setRiskOwnerRoleId] = useState('');

  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');

  const { data: resources, isLoading, refresh } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: jobs } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: partners } = usePluggableCollection<ServicePartner>('servicePartners');
  const { data: areas } = usePluggableCollection<ServicePartnerArea>('servicePartnerAreas');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: features } = usePluggableCollection<Feature>('features');
  const { data: featureLinks } = usePluggableCollection<FeatureProcessStep>('feature_process_steps');
  
  const { data: assetTypeOptions } = usePluggableCollection<AssetTypeOption>('assetTypeOptions');
  const { data: operatingModelOptions } = usePluggableCollection<OperatingModelOption>('operatingModelOptions');

  useEffect(() => { setMounted(true); }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'all' || id === 'global') return 'alle Standorte';
    const tenant = tenants?.find((t: any) => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const suggestedCompliance = useMemo(() => {
    if (!selectedResource || !processes || !versions || !features || !featureLinks) return null;

    const resId = selectedResource.id;
    const affectedProcessIds = new Set<string>();
    versions.forEach(v => {
      if (v.model_json.nodes.some(n => n.resourceIds?.includes(resId))) {
        affectedProcessIds.add(v.process_id);
      }
    });

    const processedFeatureIds = new Set<string>();
    featureLinks.forEach(link => {
      if (affectedProcessIds.has(link.processId)) {
        processedFeatureIds.add(link.featureId);
      }
    });

    if (processedFeatureIds.size === 0) return null;

    const relevantFeatures = features.filter(f => processedFeatureIds.has(f.id));
    const rankMap = { 'low': 1, 'medium': 2, 'high': 3 };
    const classRankMap = { 'public': 1, 'internal': 2, 'confidential': 3, 'strictly_confidential': 4 };
    const revRankMap = { 1: 'low', 2: 'medium', 3: 'high' } as const;
    const revClassMap = { 1: 'public', 2: 'internal', 3: 'confidential', 4: 'strictly_confidential' } as const;

    let maxC = 1, maxI = 1, maxA = 1, maxCrit = 1, maxClass = 1;

    relevantFeatures.forEach(f => {
      maxC = Math.max(maxC, rankMap[f.confidentialityReq || 'low'] || 1);
      maxI = Math.max(maxI, rankMap[f.integrityReq || 'low'] || 1);
      maxA = Math.max(maxA, rankMap[f.availabilityReq || 'low'] || 1);
      maxCrit = Math.max(maxCrit, rankMap[f.criticality] || 1);
      if (f.criticality === 'high') maxClass = Math.max(maxClass, 3);
      else if (f.criticality === 'medium') maxClass = Math.max(maxClass, 2);
    });

    return {
      confidentiality: revRankMap[maxC as 1|2|3],
      integrity: revRankMap[maxI as 1|2|3],
      availability: revRankMap[maxA as 1|2|3],
      criticality: revRankMap[maxCrit as 1|2|3],
      classification: revClassMap[maxClass as 1|2|3|4]
    };
  }, [selectedResource, processes, versions, features, featureLinks]);

  const identityProviders = useMemo(() => {
    return resources?.filter(r => r.isIdentityProvider === true || r.isIdentityProvider === 1) || [];
  }, [resources]);

  const resetForm = () => {
    setSelectedResource(null);
    setName('');
    setAssetType('');
    setCategory('Fachanwendung');
    setOperatingModel('');
    setCriticality('medium');
    setDataClassification('internal');
    setConfidentialityReq('medium');
    setIntegrityReq('medium');
    setAvailabilityReq('medium');
    setHasPersonalData(false);
    setIsDataRepository(false);
    setIsIdentityProvider(false);
    setIdentityProviderId('none');
    setDataLocation('');
    setSystemOwnerType('internal');
    setSystemOwnerRoleId('');
    setExternalRefId('none');
    setRiskOwnerRoleId('');
    setNotes('');
    setUrl('');
  };

  const handleSave = async () => {
    if (!name || !assetType) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Name und Typ angeben." });
      return;
    }

    setIsSaving(true);
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    // Resolve External Reference
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
      id: selectedResource?.id || '',
      tenantId: targetTenantId,
      name,
      assetType,
      category,
      operatingModel,
      criticality,
      dataClassification,
      confidentialityReq,
      integrityReq,
      availabilityReq,
      hasPersonalData,
      isDataRepository,
      isIdentityProvider,
      identityProviderId: identityProviderId === 'none' ? undefined : (identityProviderId === 'self' ? (selectedResource?.id || 'self') : identityProviderId),
      dataLocation,
      systemOwnerRoleId: systemOwnerType === 'internal' && systemOwnerRoleId !== 'none' ? systemOwnerRoleId : undefined,
      externalOwnerPartnerId: systemOwnerType === 'external' ? externalOwnerPartnerId : undefined,
      externalOwnerAreaId: systemOwnerType === 'external' ? externalOwnerAreaId : undefined,
      riskOwnerRoleId: riskOwnerRoleId !== 'none' ? riskOwnerRoleId : undefined,
      notes,
      url,
      status: selectedResource?.status || 'active',
      createdAt: selectedResource?.createdAt || new Date().toISOString(),
      operatorId: '',
      riskOwner: '',
      dataOwner: '',
      mfaType: 'none',
      authMethod: identityProviderId === 'none' ? 'direct' : 'idp'
    } as Resource;

    try {
      const res = await saveResourceAction(resourceData, dataSource, user?.email || 'system');
      if (res.success) {
        toast({ title: selectedResource ? "Ressource aktualisiert" : "Ressource registriert" });
        setIsDialogOpen(false);
        resetForm();
        refresh();
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Verwaltung der IT-Assets für {getTenantSlug(activeTenantId)}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 active:scale-95" onClick={() => exportResourcesExcel(filteredResources)}>
            <Download className="w-3.5 h-3.5 mr-2" /> Export
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-95 transition-all" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Neue Ressource
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Systeme filtern..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 h-9 shrink-0">
          <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
            <SelectTrigger className="h-full border-none shadow-none text-[10px] font-bold min-w-[140px] bg-transparent">
              <Filter className="w-3 h-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle Typen</SelectItem>
              {assetTypeOptions?.filter(o => o.enabled).map(o => (
                <SelectItem key={o.id} value={o.name} className="text-xs">{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Integrität (CIA)</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">System Owner</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((res) => {
                const internalOwner = jobs?.find(j => j.id === res.systemOwnerRoleId);
                const internalDept = internalOwner ? departments?.find(d => d.id === internalOwner.departmentId) : null;
                
                const externalPartner = partners?.find(p => p.id === res.externalOwnerPartnerId);
                const externalArea = areas?.find(a => a.id === res.externalOwnerAreaId);
                
                return (
                  <TableRow key={res.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer", res.status === 'archived' && "opacity-60")} onClick={() => router.push(`/resources/${res.id}`)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                          <Server className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{res.name}</div>
                            {(res.isIdentityProvider === true || res.isIdentityProvider === 1) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-[10px] font-bold">Identitätsanbieter (IdP)</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {(res.isDataRepository === true || res.isDataRepository === 1) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-[10px] font-bold">Datenmanagement Quelle</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">{res.assetType} • {res.operatingModel}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-slate-200 uppercase">{res.confidentialityReq?.charAt(0)}{res.integrityReq?.charAt(0)}{res.availabilityReq?.charAt(0)}</Badge>
                        <Badge className={cn(
                          "text-[8px] font-black h-4 border-none uppercase",
                          res.criticality === 'high' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                        )}>{res.criticality}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {externalPartner ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-indigo-600 text-white border-none rounded-full h-3.5 px-1 text-[6px] font-black uppercase">EXTERN</Badge>
                            <span className="text-[10px] font-bold text-slate-600">{externalPartner.name}</span>
                          </div>
                          {externalArea && (
                            <span className="text-[8px] font-black uppercase text-indigo-400 pl-6">{externalArea.name}</span>
                          )}
                        </div>
                      ) : internalOwner ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                            <Briefcase className="w-3.5 h-3.5 text-primary opacity-50" /> {internalOwner.name}
                          </div>
                          {internalDept && <span className="text-[8px] font-black uppercase text-slate-400 pl-5">{internalDept.name}</span>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 italic">Nicht zugewiesen</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100" onClick={() => openEdit(res)}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => router.push(`/resources/${res.id}`)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
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
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-10">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/10 shadow-sm">
                  <Server className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate uppercase tracking-tight">{selectedResource ? 'Ressource aktualisieren' : 'Ressource registrieren'}</DialogTitle>
                  <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Asset-Management & Schutzbedarfsfeststellung</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="resource" 
                currentData={{ name, assetType, category, operatingModel }} 
                onApply={(s) => { if(s.name) setName(s.name); if(s.category) setCategory(s.category); }} 
              />
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b shrink-0 bg-white">
              <TabsList className="h-12 bg-transparent gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Basisdaten</TabsTrigger>
                <TabsTrigger value="governance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-indigo-600 transition-all">Vererbung & Schutzbedarf</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 transition-all">Verantwortung & Auth</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Name der Ressource</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white" placeholder="z.B. Microsoft 365, SAP S/4HANA..." />
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Asset Typ</Label>
                      <Select value={assetType} onValueChange={(v:any) => setAssetType(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          {assetTypeOptions?.filter(o => o.enabled).map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Betriebsmodell</Label>
                      <Select value={operatingModel} onValueChange={(v:any) => setOperatingModel(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          {operatingModelOptions?.filter(o => o.enabled).map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-6 bg-white border rounded-2xl md:col-span-2 shadow-sm space-y-6">
                      <div className="flex items-center gap-2 border-b pb-3">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Governance Rollen</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-bold uppercase text-slate-900">Datenmanagement Quelle</Label>
                            <p className="text-[8px] text-slate-400 uppercase font-black">Feature Repository</p>
                          </div>
                          <Switch checked={isDataRepository} onCheckedChange={setIsDataRepository} />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                          <div className="space-y-0.5">
                            <Label className="text-[10px] font-bold uppercase text-slate-900">Identitätsanbieter (IdP)</Label>
                            <p className="text-[8px] text-slate-400 uppercase font-black">Authentifizierungs-Quelle</p>
                          </div>
                          <Switch checked={isIdentityProvider} onCheckedChange={setIsIdentityProvider} />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="governance" className="mt-0 space-y-10">
                  {suggestedCompliance && (
                    <Alert className="bg-indigo-50 border-indigo-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                      <Zap className="h-5 w-5 text-indigo-600" />
                      <AlertTitle className="text-sm font-black uppercase text-indigo-900">Prozess-basierte Vererbung</AlertTitle>
                      <AlertDescription className="text-[11px] text-indigo-700 leading-relaxed mt-1">
                        Basierend auf den verarbeiteten Datenobjekten in den verknüpften Prozessen wird ein Schutzbedarf von <strong className="uppercase">{suggestedCompliance.criticality}</strong> empfohlen.
                        <div className="mt-3">
                          <Button size="sm" onClick={applyInheritance} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase h-8 px-4 rounded-lg shadow-md gap-2">
                            <RotateCcw className="w-3.5 h-3.5" /> Auf Vorschlag zurücksetzen
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-8">
                    <div className="flex items-center gap-2 border-b pb-3">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Schutzbedarfsfeststellung (CIA)</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Vertraulichkeit</Label>
                        <Select value={confidentialityReq} onValueChange={(v:any) => setConfidentialityReq(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{['low', 'medium', 'high'].map(v => <SelectItem key={v} value={v} className="uppercase font-bold text-[10px]">{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Integrität</Label>
                        <Select value={integrityReq} onValueChange={(v:any) => setIntegrityReq(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{['low', 'medium', 'high'].map(v => <SelectItem key={v} value={v} className="uppercase font-bold text-[10px]">{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verfügbarkeit</Label>
                        <Select value={availabilityReq} onValueChange={(v:any) => setAvailabilityReq(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{['low', 'medium', 'high'].map(v => <SelectItem key={v} value={v} className="uppercase font-bold text-[10px]">{v}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Datenklassifizierung</Label>
                        <Select value={dataClassification} onValueChange={(v:any) => setDataClassification(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Öffentlich (Public)</SelectItem>
                            <SelectItem value="internal">Intern (Internal)</SelectItem>
                            <SelectItem value="confidential">Vertraulich (Confidential)</SelectItem>
                            <SelectItem value="strictly_confidential">Streng Vertraulich</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Gesamt-Kritikalität</Label>
                        <Select value={criticality} onValueChange={(v:any) => setCriticality(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low" className="text-emerald-600">Niedrig (Low)</SelectItem>
                            <SelectItem value="medium" className="text-orange-600">Mittel (Medium)</SelectItem>
                            <SelectItem value="high" className="text-red-600">Hoch (High)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="mt-0 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* System Owner Section */}
                    <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <UserCircle className="w-4 h-4 text-primary" />
                        <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">System Owner</h4>
                      </div>
                      
                      <div className="space-y-4">
                        <RadioGroup value={systemOwnerType} onValueChange={(v: any) => setSystemOwnerType(v)} className="grid grid-cols-2 gap-2">
                          <div className={cn("flex items-center space-x-2 border p-3 rounded-xl cursor-pointer transition-all", systemOwnerType === 'internal' && "border-primary bg-primary/5")}>
                            <RadioGroupItem value="internal" id="sys-int" />
                            <Label htmlFor="sys-int" className="text-[10px] font-bold uppercase cursor-pointer">Intern (Job)</Label>
                          </div>
                          <div className={cn("flex items-center space-x-2 border p-3 rounded-xl cursor-pointer transition-all", systemOwnerType === 'external' && "border-indigo-600 bg-indigo-50/50")}>
                            <RadioGroupItem value="external" id="sys-ext" />
                            <Label htmlFor="sys-ext" className="text-[10px] font-bold uppercase cursor-pointer">Extern (Partner)</Label>
                          </div>
                        </RadioGroup>

                        {systemOwnerType === 'internal' ? (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400">Interne Rolle auswählen</Label>
                            <Select value={systemOwnerRoleId} onValueChange={setSystemOwnerRoleId}>
                              <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Keine Rolle zugewiesen</SelectItem>
                                {jobs?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => {
                                  const dept = departments?.find(d => d.id === job.departmentId);
                                  const label = dept ? `${dept.name} — ${job.name}` : job.name;
                                  return <SelectItem key={job.id} value={job.id}>{label}</SelectItem>;
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-slate-400">Externer Partner oder Bereich</Label>
                              <Select value={externalRefId} onValueChange={setExternalRefId}>
                                <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm">
                                  <SelectValue placeholder="Firma oder Bereich wählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Keine externe Zuweisung</SelectItem>
                                  {partners?.map(p => (
                                    <SelectGroup key={p.id}>
                                      <SelectLabel className="text-[8px] font-black uppercase text-slate-400 px-2 py-1 bg-slate-50/50">{p.name}</SelectLabel>
                                      <SelectItem value={`p:${p.id}`} className="font-bold text-xs">
                                        {p.name} (Zentrale)
                                      </SelectItem>
                                      {areas?.filter(a => a.partnerId === p.id).map(area => (
                                        <SelectItem key={area.id} value={`a:${area.id}`} className="text-xs pl-6">
                                          {area.name}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Authentication Section (Phase 5) */}
                    <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Identitätsanbieter (Auth)</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase text-slate-400">Anmeldung erfolgt über</Label>
                          <Select value={identityProviderId} onValueChange={setIdentityProviderId}>
                            <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm">
                              <SelectValue placeholder="IdP wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs italic">Eigenständige Anmeldung / Lokal</SelectItem>
                              <SelectItem value="self" className="text-xs font-bold text-blue-600">Dieses System ist der IdP</SelectItem>
                              {identityProviders.filter(idp => idp.id !== selectedResource?.id).map(idp => (
                                <SelectItem key={idp.id} value={idp.id} className="text-xs">
                                  {idp.name} (Zentraler IdP)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                          <p className="text-[9px] text-blue-800 leading-relaxed italic">Wählen Sie einen Identitätsanbieter aus, um SSO-Ketten oder LDAP-Abhängigkeiten zu dokumentieren.</p>
                        </div>
                      </div>
                    </div>

                    {/* Risk Owner Section (ALWAYS INTERNAL) */}
                    <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-6 md:col-span-2">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <ShieldAlert className="w-4 h-4 text-orange-600" />
                        <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Risk Owner (Intern)</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[9px] font-black uppercase text-slate-400">Verantwortliche interne Rolle</Label>
                          <Select value={riskOwnerRoleId} onValueChange={setRiskOwnerRoleId}>
                            <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Keine Rolle zugewiesen</SelectItem>
                              {jobs?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => {
                                const dept = departments?.find(d => d.id === job.departmentId);
                                const label = dept ? `${dept.name} — ${job.name}` : job.name;
                                return <SelectItem key={job.id} value={job.id}>{label}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex items-start gap-3">
                          <Info className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                          <p className="text-[9px] text-orange-800 leading-relaxed italic">Die Rechenschaftspflicht für Risiken muss laut GRC-Vorgabe immer intern verankert sein.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto rounded-xl font-bold text-[10px] px-8 h-11 uppercase">Abbrechen</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto rounded-xl font-bold text-[10px] tracking-widest px-12 h-11 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all active:scale-95 gap-2 uppercase">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
