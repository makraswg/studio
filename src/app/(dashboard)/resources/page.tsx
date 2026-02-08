
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
  Building2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Tenant, JobTitle, ServicePartner, ServicePartnerContact, Process, ProcessVersion, ProcessNode, Feature, FeatureProcessStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import { exportResourcesExcel } from '@/lib/export-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [assetType, setAssetType] = useState<Resource['assetType']>('Software');
  const [category, setCategory] = useState<Resource['category']>('Fachanwendung');
  const [operatingModel, setOperatingModel] = useState<Resource['operatingModel']>('Cloud');
  const [criticality, setCriticality] = useState<Resource['criticality']>('medium');
  const [dataClassification, setDataClassification] = useState<Resource['dataClassification']>('internal');
  const [confidentialityReq, setConfidentialityReq] = useState<Resource['confidentialityReq']>('medium');
  const [integrityReq, setIntegrityReq] = useState<Resource['integrityReq']>('medium');
  const [availabilityReq, setAvailabilityReq] = useState<Resource['availabilityReq']>('medium');
  const [hasPersonalData, setHasPersonalData] = useState(false);
  const [isDataRepository, setIsDataRepository] = useState(false);
  const [dataLocation, setDataLocation] = useState('');
  const [systemOwnerRoleId, setSystemOwnerRoleId] = useState('');
  const [riskOwnerRoleId, setRiskOwnerRoleId] = useState('');
  const [externalOwnerContactId, setExternalOwnerContactId] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');

  const { data: resources, isLoading, refresh } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: jobs } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: partners } = usePluggableCollection<ServicePartner>('servicePartners');
  const { data: contacts } = usePluggableCollection<ServicePartnerContact>('servicePartnerContacts');
  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<ProcessVersion>('process_versions');
  const { data: features } = usePluggableCollection<Feature>('features');
  const { data: featureLinks } = usePluggableCollection<FeatureProcessStep>('feature_process_steps');

  useEffect(() => { setMounted(true); }, []);

  // Inheritance Suggestion Logic
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

  const resetForm = () => {
    setSelectedResource(null);
    setName('');
    setAssetType('Software');
    setCategory('Fachanwendung');
    setOperatingModel('Cloud');
    setCriticality('medium');
    setDataClassification('internal');
    setConfidentialityReq('medium');
    setIntegrityReq('medium');
    setAvailabilityReq('medium');
    setHasPersonalData(false);
    setIsDataRepository(false);
    setDataLocation('');
    setSystemOwnerRoleId('');
    setRiskOwnerRoleId('');
    setExternalOwnerContactId('');
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
      dataLocation,
      systemOwnerRoleId: systemOwnerRoleId === 'none' ? undefined : systemOwnerRoleId,
      riskOwnerRoleId: riskOwnerRoleId === 'none' ? undefined : riskOwnerRoleId,
      externalOwnerContactId: externalOwnerContactId === 'none' ? undefined : externalOwnerContactId,
      notes,
      url,
      status: selectedResource?.status || 'active',
      createdAt: selectedResource?.createdAt || new Date().toISOString()
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
    setDataLocation(res.dataLocation || '');
    setSystemOwnerRoleId(res.systemOwnerRoleId || 'none');
    setRiskOwnerRoleId(res.riskOwnerRoleId || 'none');
    setExternalOwnerContactId(res.externalOwnerContactId || 'none');
    setNotes(res.notes || '');
    setUrl(res.url || '');
    setIsDialogOpen(true);
  };

  const applyInheritance = () => {
    if (!suggestedCompliance) return;
    setConfidentialityReq(suggestedCompliance.confidentiality);
    setIntegrityReq(suggestedCompliance.integrity);
    setAvailabilityReq(suggestedCompliance.availability);
    setCriticality(suggestedCompliance.criticality);
    setDataClassification(suggestedCompliance.classification);
    toast({ title: "Vererbungs-Vorschlag übernommen" });
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
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">IT-Inventar</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Verwaltung der IT-Assets für {activeTenantId === 'all' ? 'alle Standorte' : activeTenantId}.</p>
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Alle Typen</SelectItem>
              <SelectItem value="Software" className="text-xs">Software</SelectItem>
              <SelectItem value="Hardware" className="text-xs">Hardware</SelectItem>
              <SelectItem value="SaaS" className="text-xs">SaaS</SelectItem>
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
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Verantwortung (Role)</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((res) => {
                const ownerRole = jobs?.find(j => j.id === res.systemOwnerRoleId);
                return (
                  <TableRow key={res.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer", res.status === 'archived' && "opacity-60")} onClick={() => router.push(`/resources/${res.id}`)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                          <Server className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{res.name}</div>
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
                      {ownerRole ? (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                          <Briefcase className="w-3.5 h-3.5 text-primary opacity-50" /> {ownerRole.name}
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
            <div className="px-6 bg-white border-b shrink-0">
              <TabsList className="h-12 bg-transparent gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Basisdaten</TabsTrigger>
                <TabsTrigger value="governance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-indigo-600 transition-all">Vererbung & Schutzbedarf</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent h-full px-0 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 transition-all">Verantwortung</TabsTrigger>
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
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{['Software', 'Hardware', 'SaaS', 'Infrastruktur'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Betriebsmodell</Label>
                      <Select value={operatingModel} onValueChange={(v:any) => setOperatingModel(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{['On-Prem', 'Cloud', 'Hybrid'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
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
                            <RotateCcw className="w-3 h-3" /> Auf Vorschlag zurücksetzen
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
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">System Owner (Internal Role)</Label>
                        <Select value={systemOwnerRoleId} onValueChange={setSystemOwnerRoleId}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Keine Rolle zugewiesen</SelectItem>
                            {jobs?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Risk Owner (Internal Role)</Label>
                        <Select value={riskOwnerRoleId} onValueChange={setRiskOwnerRoleId}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Keine Rolle zugewiesen</SelectItem>
                            {jobs?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-100 rounded-2xl border border-slate-200 space-y-6 shadow-inner">
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Externer Dienstleister (Partner)</h4>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Externer Ansprechpartner</Label>
                        <Select value={externalOwnerContactId} onValueChange={setExternalOwnerContactId}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-indigo-600 text-white border-none rounded-full h-3.5 px-1 text-[6px] font-black">EXTERN</Badge>
                              <SelectValue placeholder="Partner wählen..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Kein externer Support</SelectItem>
                            {partners?.map(p => (
                              <div key={p.id}>
                                <div className="px-2 py-1.5 text-[8px] font-black uppercase text-slate-400 bg-slate-50">{p.name}</div>
                                {contacts?.filter(c => c.partnerId === p.id).map(contact => (
                                  <SelectItem key={contact.id} value={contact.id} className="pl-4">{contact.name} ({contact.email})</SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto rounded-xl font-bold text-[10px] px-8 h-11 uppercase">Abbrechen</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto rounded-xl font-bold text-[10px] px-12 h-11 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all active:scale-95 gap-2 uppercase">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
