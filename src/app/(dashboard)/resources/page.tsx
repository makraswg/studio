
"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  HardDrive
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { Resource, Tenant } from '@/lib/types';
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
  const [processingPurpose, setProcessingPurpose] = useState('');
  const [dataLocation, setDataLocation] = useState('');
  const [systemOwner, setSystemOwner] = useState('');
  const [riskOwner, setRiskOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');

  const { data: resources, isLoading, refresh } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => { setMounted(true); }, []);

  const activeTenant = useMemo(() => {
    if (activeTenantId === 'all') return null;
    return tenants?.find(t => t.id === activeTenantId);
  }, [tenants, activeTenantId]);

  const currentTenantName = activeTenant ? activeTenant.name : 'alle Standorte';

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
    setProcessingPurpose('');
    setDataLocation('');
    setSystemOwner('');
    setRiskOwner('');
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
      processingPurpose,
      dataLocation,
      systemOwner,
      riskOwner,
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
    setProcessingPurpose(res.processingPurpose || '');
    setDataLocation(res.dataLocation || '');
    setSystemOwner(res.systemOwner || '');
    setRiskOwner(res.riskOwner || '');
    setNotes(res.notes || '');
    setUrl(res.url || '');
    setIsDialogOpen(true);
  };

  const applyAiSuggestions = (s: any) => {
    if (s.name) setName(s.name);
    if (s.category) setCategory(s.category);
    if (s.criticality) setCriticality(s.criticality);
    if (s.processingPurpose) setProcessingPurpose(s.processingPurpose);
    toast({ title: "KI-Vorschläge übernommen" });
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
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none uppercase tracking-wider">Plattform Core</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Ressourcenkatalog</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">IT-Inventar für {currentTenantName}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 active:scale-95" onClick={() => exportResourcesExcel(filteredResources)}>
            <Download className="w-3.5 h-3.5 mr-2" /> Excel
          </Button>
          <Button variant="ghost" size="sm" className="h-9 rounded-md font-bold text-xs gap-2" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
            {showArchived ? 'Aktiv' : 'Archiv'}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    size="sm" 
                    className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={() => { resetForm(); setIsDialogOpen(true); }}
                    disabled={activeTenantId === 'all'}
                  >
                    <Plus className="w-3.5 h-3.5 mr-2" /> Ressource registrieren
                  </Button>
                </span>
              </TooltipTrigger>
              {activeTenantId === 'all' && (
                <TooltipContent className="bg-slate-900 text-white border-none rounded-lg text-[10px] font-bold p-2 shadow-xl">
                  Bitte wählen Sie erst einen Mandanten aus.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Nach Systemen suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
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
              <SelectItem value="Infrastruktur" className="text-xs">Infrastruktur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-bold text-slate-400">Inventar wird geladen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Anwendung / Asset</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Kategorie / CIA</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Besitzer</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((res) => (
                <TableRow key={res.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0", res.status === 'archived' && "opacity-60")}>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner relative">
                        <Server className="w-4 h-4" />
                        {res.isDataRepository && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full flex items-center justify-center border border-white">
                            <Database className="w-2 h-2" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors cursor-pointer" onClick={() => openEdit(res)}>{res.name}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{res.assetType} • {res.operatingModel}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[8px] font-black uppercase h-4 px-1.5 border-slate-200 text-slate-500 w-fit">{res.category}</Badge>
                        {res.isDataRepository && <Badge className="bg-indigo-50 text-indigo-700 border-none text-[7px] font-black h-4 px-1.5">REPOSITORY</Badge>}
                      </div>
                      <span className="text-[8px] font-black uppercase text-slate-400 flex items-center gap-1">
                        CIA: <span className="text-primary">{res.confidentialityReq?.charAt(0)}</span>|<span className="text-primary">{res.integrityReq?.charAt(0)}</span>|<span className="text-primary">{res.availabilityReq?.charAt(0)}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                      <UserIcon className="w-3 h-3 text-slate-300" /> {res.systemOwner || '---'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end items-center gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white shadow-sm" onClick={() => openEdit(res)}>
                        <Pencil className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-all shadow-sm"><MoreVertical className="w-4 h-4 text-slate-400" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-56 p-1 shadow-2xl border">
                          <DropdownMenuItem onSelect={() => openEdit(res)} className="rounded-lg py-2 gap-2 text-xs font-bold"><FileEdit className="w-3.5 h-3.5 text-primary" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem className="text-red-600 rounded-lg py-2 gap-2 text-xs font-bold" onSelect={() => { if(confirm("Ressource permanent löschen?")) deleteResourceAction(res.id, dataSource).then(() => refresh()); }}>
                            <Trash2 className="w-3.5 h-3.5" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
                  <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Zentrales IT-Inventar & Schutzbedarfsfeststellung</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="resource" 
                currentData={{ name, assetType, category, operatingModel, criticality, dataClassification, confidentialityReq, integrityReq, availabilityReq, hasPersonalData, processingPurpose, dataLocation, systemOwner, riskOwner, notes, url }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 bg-white border-b shrink-0">
              <TabsList className="h-12 bg-transparent gap-8 p-0">
                <TabsTrigger value="base" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-primary transition-all">Stammdaten</TabsTrigger>
                <TabsTrigger value="governance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-indigo-600 transition-all">Governance & CIA</TabsTrigger>
                <TabsTrigger value="gdpr" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-emerald-600 transition-all">Datenschutz</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent h-full px-0 gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 data-[state=active]:text-slate-900 transition-all">Verantwortung</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-slate-50/30">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Bezeichnung der Ressource</Label>
                      <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-12 text-sm font-bold border-slate-200 bg-white shadow-sm" placeholder="z.B. Microsoft 365, SAP S/4HANA..." />
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Asset Typ</Label>
                      <Select value={assetType} onValueChange={(v:any) => setAssetType(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Software', 'Hardware', 'SaaS', 'Infrastruktur'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label required className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Betriebsmodell</Label>
                      <Select value={operatingModel} onValueChange={(v:any) => setOperatingModel(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['On-Prem', 'Cloud', 'Hybrid', 'Private Cloud'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Kategorie</Label>
                      <Select value={category} onValueChange={(v:any) => setCategory(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['Fachanwendung', 'Infrastruktur', 'Sicherheitskomponente', 'Support-Tool'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Referenz URL</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input value={url} onChange={e => setUrl(e.target.value)} className="rounded-xl h-11 pl-9 border-slate-200 bg-white shadow-sm" placeholder="https://..." />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="governance" className="mt-0 space-y-10">
                  <div className="flex items-center justify-between p-6 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm">
                    <div className="space-y-1">
                      <Label className="text-sm font-black uppercase text-indigo-800">Ist Daten-Repository?</Label>
                      <p className="text-[10px] font-bold text-indigo-600 italic">Dient dieses System als primärer Speicherort für fachliche Datenobjekte?</p>
                    </div>
                    <Switch checked={isDataRepository} onCheckedChange={setIsDataRepository} className="data-[state=checked]:bg-indigo-600" />
                  </div>

                  <div className="p-6 bg-white border rounded-2xl shadow-sm space-y-8">
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" /> Schutzbedarfsfeststellung (CIA)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Vertraulichkeit</Label>
                        <Select value={confidentialityReq} onValueChange={(v:any) => setConfidentialityReq(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['low', 'medium', 'high'].map(v => <SelectItem key={v} value={v} className="uppercase font-bold text-[10px]">{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Integrität</Label>
                        <Select value={integrityReq} onValueChange={(v:any) => setIntegrityReq(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['low', 'medium', 'high'].map(v => <SelectItem key={v} value={v} className="uppercase font-bold text-[10px]">{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verfügbarkeit</Label>
                        <Select value={availabilityReq} onValueChange={(v:any) => setAvailabilityReq(v)}>
                          <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['low', 'medium', 'high'].map(v => <SelectItem key={v} value={v} className="uppercase font-bold text-[10px]">{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Datenklassifizierung</Label>
                      <Select value={dataClassification} onValueChange={(v:any) => setDataClassification(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Öffentlich (Public)</SelectItem>
                          <SelectItem value="internal">Intern (Internal)</SelectItem>
                          <SelectItem value="confidential">Vertraulich (Confidential)</SelectItem>
                          <SelectItem value="strictly_confidential">Streng Vertraulich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Kritikalität</Label>
                      <Select value={criticality} onValueChange={(v:any) => setCriticality(v)}>
                        <SelectTrigger className="rounded-xl h-11 border-slate-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low" className="text-emerald-600">Niedrig (Low)</SelectItem>
                          <SelectItem value="medium" className="text-orange-600">Mittel (Medium)</SelectItem>
                          <SelectItem value="high" className="text-red-600">Hoch (High)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="gdpr" className="mt-0 space-y-10">
                  <div className="flex items-center justify-between p-6 bg-emerald-50 border border-emerald-100 rounded-2xl shadow-sm">
                    <div className="space-y-1">
                      <Label className="text-sm font-black uppercase text-emerald-800">Verarbeitung personenbezogener Daten?</Label>
                      <p className="text-[10px] font-bold text-emerald-600 italic">Werden in diesem System Daten gemäß Art. 4 Nr. 1 DSGVO verarbeitet?</p>
                    </div>
                    <Switch checked={hasPersonalData} onCheckedChange={setHasPersonalData} className="data-[state=checked]:bg-emerald-600" />
                  </div>

                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Zweck der Verarbeitung</Label>
                      <Textarea value={processingPurpose} onChange={e => setProcessingPurpose(e.target.value)} className="rounded-2xl min-h-[100px] p-4 text-xs font-medium border-slate-200 bg-white" placeholder="z.B. Vertragsabwicklung, Lohnabrechnung..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Datenstandort / Region</Label>
                      <div className="relative">
                        <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <Input value={dataLocation} onChange={e => setDataLocation(e.target.value)} className="rounded-xl h-11 pl-9 border-slate-200 bg-white shadow-sm" placeholder="z.B. AWS Region Frankfurt (eu-central-1)" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">System Owner</Label>
                      <Input value={systemOwner} onChange={e => setSystemOwner(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-white" placeholder="Verantwortliche Person (IT)" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Risk Owner</Label>
                      <Input value={riskOwner} onChange={e => setRiskOwner(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-white" placeholder="Verantwortliche Person (Fachbereich)" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">Zusätzliche Notizen</Label>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-2xl min-h-[100px] p-4 text-xs font-medium border-slate-200 bg-white" />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto rounded-xl font-bold text-[10px] px-8 h-11 tracking-widest text-slate-400 hover:bg-white transition-all uppercase">Abbrechen</Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !name} className="w-full sm:w-auto rounded-xl font-bold text-[10px] tracking-widest px-12 h-11 bg-primary hover:bg-primary/90 text-white shadow-lg transition-all active:scale-95 gap-2 uppercase">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {selectedResource ? 'Speichern' : 'Registrieren'}
              </Button>
            </DialogFooter>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
