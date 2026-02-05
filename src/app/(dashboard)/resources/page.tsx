
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
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil, 
  Network,
  ShieldAlert,
  Settings2,
  Info,
  GitGraph,
  AlertTriangle,
  Link as LinkIcon,
  User as UserIcon,
  FileText,
  Lock,
  Globe,
  Database,
  Fingerprint,
  ChevronRight,
  Shield,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  deleteDocumentNonBlocking, 
  setDocumentNonBlocking,
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { triggerSyncJobAction } from '@/app/actions/sync-actions';
import { Entitlement, Tenant, Resource, ServicePartner } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

export default function ResourcesPage() {
  const db = useFirestore();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isResourceDeleteOpen, setIsResourceDeleteOpen] = useState(false);
  const [isEntitlementListOpen, setIsEntitlementListOpen] = useState(false);
  const [isEntitlementEditOpen, setIsEntitlementEditOpen] = useState(false);
  const [isEntitlementDeleteOpen, setIsEntitlementDeleteOpen] = useState(false);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [editingEntitlement, setEditingEntitlement] = useState<Entitlement | null>(null);

  // Resource Form State
  const [resName, setResName] = useState('');
  const [resCategory, setResCategory] = useState<Resource['category']>('standard_app');
  const [resType, setResType] = useState<Resource['type']>('SaaS');
  const [resOperatorId, setResOperatorId] = useState('');
  const [resClassification, setResClassification] = useState<Resource['dataClassification']>('internal');
  const [resLocation, setResLocation] = useState('');
  const [resMfa, setResMfa] = useState<Resource['mfaType']>('none');
  const [resAuthMethod, setResAuthMethod] = useState('direct');
  const [resCriticality, setResCriticality] = useState<Resource['criticality']>('medium');
  const [resTenantId, setResTenantId] = useState('global');
  const [resUrl, setResUrl] = useState('');
  const [resDocUrl, setResDocUrl] = useState('');
  const [resNotes, setResNotes] = useState('');

  // Entitlement Form State
  const [entName, setEntName] = useState('');
  const [entDescription, setEntDescription] = useState('');
  const [entRisk, setEntRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [entIsAdmin, setEntIsAdmin] = useState(false);
  const [entMapping, setEntMapping] = useState('');
  const [entParentId, setEntParentId] = useState<string>('none');

  const { data: resources, isLoading, refresh: refreshResources } = usePluggableCollection<Resource>('resources');
  const { data: entitlements, refresh: refreshEntitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: partners } = usePluggableCollection<ServicePartner>('servicePartners');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'global') return 'global';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const handleSyncAssets = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerSyncJobAction('job-assets-sync', dataSource);
      if (res.success) {
        toast({ title: "Synchronisation gestartet", description: "Jira Assets werden im Hintergrund abgeglichen." });
        setTimeout(() => {
          refreshResources();
          refreshEntitlements();
        }, 2000);
      } else {
        toast({ variant: "destructive", title: "Sync fehlgeschlagen", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveResource = async () => {
    if (!resName) return;
    const id = selectedResource?.id || `res-${Math.random().toString(36).substring(2, 9)}`;
    const data: Resource = {
      id, tenantId: resTenantId, name: resName, category: resCategory, type: resType,
      operatorId: resOperatorId, dataClassification: resClassification, dataLocation: resLocation,
      mfaType: resMfa, authMethod: resAuthMethod, criticality: resCriticality,
      url: resUrl || '#', documentationUrl: resDocUrl, notes: resNotes,
      createdAt: selectedResource?.createdAt || new Date().toISOString()
    };
    if (dataSource === 'mysql') await saveCollectionRecord('resources', id, data);
    else setDocumentNonBlocking(doc(db, 'resources', id), data);
    toast({ title: "System gespeichert" });
    setIsResourceDialogOpen(false);
    setTimeout(() => refreshResources(), 200);
  };

  const openResourceEdit = (res: Resource) => {
    setSelectedResource(res);
    setResName(res.name);
    setResCategory(res.category || 'standard_app');
    setResType(res.type);
    setResOperatorId(res.operatorId || '');
    setResClassification(res.dataClassification || 'internal');
    setResLocation(res.dataLocation || '');
    setResMfa(res.mfaType || 'none');
    setResAuthMethod(res.authMethod || 'direct');
    setResCriticality(res.criticality);
    setResTenantId(res.tenantId);
    setResUrl(res.url);
    setResDocUrl(res.documentationUrl || '');
    setResNotes(res.notes || '');
    setIsResourceDialogOpen(true);
  };

  const handleDeleteResource = async () => {
    if (!selectedResource) return;
    if (dataSource === 'mysql') await deleteCollectionRecord('resources', selectedResource.id);
    else deleteDocumentNonBlocking(doc(db, 'resources', selectedResource.id));
    toast({ title: "System entfernt" });
    setIsResourceDeleteOpen(false);
    setTimeout(() => refreshResources(), 200);
  };

  const handleSaveEntitlement = async () => {
    if (!entName || !selectedResource) return;
    const id = editingEntitlement?.id || `ent-${Math.random().toString(36).substring(2, 9)}`;
    const data: Entitlement = {
      id, 
      resourceId: selectedResource.id, 
      tenantId: selectedResource.tenantId,
      name: entName, 
      description: entDescription, 
      riskLevel: entRisk,
      isAdmin: entIsAdmin, 
      externalMapping: entMapping,
      parentId: entParentId === 'none' ? undefined : entParentId
    };
    if (dataSource === 'mysql') await saveCollectionRecord('entitlements', id, data);
    else setDocumentNonBlocking(doc(db, 'entitlements', id), data);
    toast({ title: "Rolle gespeichert" });
    setIsEntitlementEditOpen(false);
    setEditingEntitlement(null);
    setTimeout(() => refreshEntitlements(), 200);
  };

  const openEntitlementEdit = (ent: Entitlement | null) => {
    setEditingEntitlement(ent);
    setEntName(ent?.name || '');
    setEntDescription(ent?.description || '');
    setEntRisk(ent?.riskLevel || 'medium');
    setEntIsAdmin(!!ent?.isAdmin);
    setEntMapping(ent?.externalMapping || '');
    setEntParentId(ent?.parentId || 'none');
    setIsEntitlementEditOpen(true);
  };

  const handleDeleteEntitlement = async () => {
    if (!editingEntitlement) return;
    if (dataSource === 'mysql') await deleteCollectionRecord('entitlements', editingEntitlement.id);
    else deleteDocumentNonBlocking(doc(db, 'entitlements', editingEntitlement.id));
    toast({ title: "Rolle gelöscht" });
    setIsEntitlementDeleteOpen(false);
    setEditingEntitlement(null);
    setTimeout(() => refreshEntitlements(), 200);
  };

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    return resources.filter(res => {
      const isGlobal = res.tenantId === 'global' || !res.tenantId;
      if (activeTenantId !== 'all' && !isGlobal && res.tenantId !== activeTenantId) return false;
      return res.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [resources, search, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ressourcenkatalog</h1>
          <p className="text-sm text-muted-foreground">Compliance-Inventar für {activeTenantId === 'all' ? 'alle Firmen' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 font-bold uppercase text-[10px] rounded-none border-blue-200 text-blue-700 bg-blue-50"
            onClick={handleSyncAssets}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} Jira Assets Sync
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { setSelectedResource(null); setIsResourceDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Systemen suchen..." 
          className="pl-10 h-10 border border-input bg-white dark:bg-slate-950 px-3 text-sm focus:outline-none rounded-none" 
          value={search} onChange={(e) => setSearch(e.target.value)} 
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase text-[10px]">Anwendung</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Status / Compliance</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Verantwortung</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => {
                const partner = partners?.find(p => p.id === resource.operatorId);
                return (
                  <TableRow key={resource.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="font-bold text-sm">{resource.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none py-0 h-4 bg-muted/20">{resource.category || 'App'}</Badge>
                        <Badge variant="outline" className={cn("text-[8px] font-bold uppercase rounded-none py-0 h-4", resource.criticality === 'high' ? "bg-red-50 text-red-700" : "bg-slate-50")}>{resource.criticality}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-muted-foreground">
                          <Lock className="w-2.5 h-2.5" /> Classification: {resource.dataClassification || 'N/A'}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-muted-foreground">
                          <Fingerprint className="w-2.5 h-2.5" /> MFA: {resource.mfaType || 'none'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold">{partner?.name || 'Intern'}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">{partner?.contactPerson}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none border-primary/20 text-primary">
                        {getTenantSlug(resource.tenantId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-none">
                          <DropdownMenuItem onSelect={() => { setSelectedResource(resource); setIsEntitlementListOpen(true); }}><Settings2 className="w-3.5 h-3.5 mr-2" /> Rollen verwalten</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openResourceEdit(resource)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedResource(resource); setIsResourceDeleteOpen(true); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Resource Edit Dialog */}
      <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
        <DialogContent className="max-w-3xl rounded-none border shadow-2xl p-0 overflow-hidden flex flex-col h-[90vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Network className="w-5 h-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                {selectedResource ? 'System bearbeiten' : 'System registrieren'}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Stammdaten */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 mb-4">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">Stammdaten & Klassifizierung</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name der Anwendung</Label>
                    <Input value={resName} onChange={e => setResName(e.target.value)} placeholder="z.B. SAP S/4HANA" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">System-Kategorie</Label>
                    <Select value={resCategory} onValueChange={(v: any) => setResCategory(v)}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="business_critical">Business Kritisch</SelectItem>
                        <SelectItem value="it_tool">IT Tool</SelectItem>
                        <SelectItem value="standard_app">Standard Anwendung</SelectItem>
                        <SelectItem value="test">Test / Demo</SelectItem>
                        <SelectItem value="infrastructure">Infrastruktur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Datenklassifikation</Label>
                    <Select value={resClassification} onValueChange={(v: any) => setResClassification(v)}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="public">Öffentlich</SelectItem>
                        <SelectItem value="internal">Intern</SelectItem>
                        <SelectItem value="confidential">Vertraulich</SelectItem>
                        <SelectItem value="strictly_confidential">Streng Vertraulich (Privilegiert)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Betrieb & Standort */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 mb-4">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">Betrieb & Sicherheit</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Betriebsverantwortlicher (Service Partner)</Label>
                    <Select value={resOperatorId} onValueChange={setResOperatorId}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="internal">Interne IT (Default)</SelectItem>
                        {partners?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Datenstandort</Label>
                    <Input value={resLocation} onChange={e => setResLocation(e.target.value)} placeholder="z.B. Frankfurt, DE (AWS)" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">2-Faktor Authentifizierung (MFA)</Label>
                    <Select value={resMfa} onValueChange={(v: any) => setResMfa(v)}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="none">Nicht verfügbar</SelectItem>
                        <SelectItem value="standard_otp">Standard (App/OTP)</SelectItem>
                        <SelectItem value="standard_mail">Standard (E-Mail)</SelectItem>
                        <SelectItem value="optional_otp">Optional (App/OTP)</SelectItem>
                        <SelectItem value="optional_mail">Optional (E-Mail)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Authentifizierungsquelle</Label>
                    <Select value={resAuthMethod} onValueChange={setResAuthMethod}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="direct">Direkt (Eigenes Verzeichnis)</SelectItem>
                        {resources?.filter(r => r.id !== selectedResource?.id).map(r => (
                          <SelectItem key={r.id} value={r.id}>Via {r.name} (SSO)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Compliance & Links */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 mb-4">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">Compliance & Kontrolle</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risiko-Kritikalität</Label>
                    <Select value={resCriticality} onValueChange={(v: any) => setResCriticality(v)}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="low">Niedrig (Standard-IT)</SelectItem>
                        <SelectItem value="medium">Mittel (Business-App)</SelectItem>
                        <SelectItem value="high">Hoch (Kernprozess / Kritisch)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Zugehörigkeit (Mandant)</Label>
                    <Select value={resTenantId} onValueChange={setResTenantId}>
                      <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="global">Global (Alle Standorte)</SelectItem>
                        {tenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Anmerkungen */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Interne Notizen & Besonderheiten</Label>
                <Textarea value={resNotes} onChange={e => setResNotes(e.target.value)} placeholder="..." className="rounded-none min-h-[100px]" />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsResourceDialogOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button onClick={handleSaveResource} className="rounded-none font-bold uppercase text-[10px] px-10">System speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entitlement List Dialog */}
      <Dialog open={isEntitlementListOpen} onOpenChange={setIsEntitlementListOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0 rounded-none overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitGraph className="w-5 h-5 text-primary" />
                <DialogTitle className="text-sm font-bold uppercase">Rollen für {selectedResource?.name}</DialogTitle>
              </div>
              <Button size="sm" className="h-8 rounded-none bg-primary hover:bg-primary/90 text-[10px] font-bold uppercase" onClick={() => openEntitlementEdit(null)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Rolle hinzufügen
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold uppercase text-[10px]">Rollenname</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Risiko</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Mapping</TableHead>
                    <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlements?.filter(e => e.resourceId === selectedResource?.id).map((ent) => (
                    <TableRow key={ent.id}>
                      <TableCell>
                        <div className="font-bold text-sm flex items-center gap-2">
                          {ent.name}
                          {ent.isAdmin && <ShieldAlert className="w-3 h-3 text-red-600" />}
                        </div>
                        {ent.parentId && <div className="text-[9px] text-muted-foreground uppercase flex items-center gap-1"><ChevronRight className="w-2 h-2" /> Erbt von: {entitlements.find(e => e.id === ent.parentId)?.name}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[8px] font-bold uppercase rounded-none", ent.riskLevel === 'high' ? "bg-red-50 text-red-700 border-red-100" : "bg-slate-50")}>
                          {ent.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">{ent.externalMapping || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEntitlementEdit(ent)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => { setEditingEntitlement(ent); setIsEntitlementDeleteOpen(true); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex justify-end shrink-0">
            <Button onClick={() => setIsEntitlementListOpen(false)} className="rounded-none h-10 px-8">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entitlement Edit Dialog */}
      <Dialog open={isEntitlementEditOpen} onOpenChange={setIsEntitlementEditOpen}>
        <DialogContent className="max-w-lg rounded-none border shadow-2xl p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 bg-slate-800 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase">{editingEntitlement ? 'Rolle bearbeiten' : 'Neue Rolle definieren'}</DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name der Berechtigung</Label>
              <Input value={entName} onChange={e => setEntName(e.target.value)} placeholder="z.B. Finanz-Buchhalter" className="rounded-none h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung / Zweck</Label>
              <Textarea value={entDescription} onChange={e => setEntDescription(e.target.value)} placeholder="Wozu wird dieser Zugriff benötigt?" className="rounded-none min-h-[80px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risikostufe</Label>
                <Select value={entRisk} onValueChange={(v: any) => setEntRisk(v)}>
                  <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="low">Niedrig (Standard)</SelectItem>
                    <SelectItem value="medium">Mittel (Erweitert)</SelectItem>
                    <SelectItem value="high">Hoch (Kritisch)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Basis-Rolle (Inheritance)</Label>
                <Select value={entParentId} onValueChange={setEntParentId}>
                  <SelectTrigger className="rounded-none h-10"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="none">Keine (Direkt)</SelectItem>
                    {entitlements?.filter(e => e.resourceId === selectedResource?.id && e.id !== editingEntitlement?.id).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Technisches Mapping (AD-Gruppe / Key)</Label>
              <Input value={entMapping} onChange={e => setEntMapping(e.target.value)} placeholder="CN=APP_ROLE_01,OU=Groups..." className="rounded-none h-10 font-mono text-xs" />
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <div>
                  <Label className="text-[10px] font-bold uppercase block">Privilegierter Zugriff</Label>
                  <span className="text-[9px] text-muted-foreground uppercase">Markiert dieses Konto als Administrator</span>
                </div>
              </div>
              <Switch checked={entIsAdmin} onCheckedChange={setEntIsAdmin} />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsEntitlementEditOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button onClick={handleSaveEntitlement} className="rounded-none font-bold uppercase text-[10px] px-10">Rolle speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      <AlertDialog open={isResourceDeleteOpen} onOpenChange={setIsResourceDeleteOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader><AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">System permanent entfernen?</AlertDialogTitle><AlertDialogDescription className="text-xs">Dies löscht das System und alle zugehörigen Rollen aus dem Katalog.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteResource} className="bg-red-600 rounded-none text-xs uppercase font-bold">Löschen</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isEntitlementDeleteOpen} onOpenChange={setIsEntitlementDeleteOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader><AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">Rolle löschen?</AlertDialogTitle><AlertDialogDescription className="text-xs">Existierende Zuweisungen für Mitarbeiter bleiben als Audit-Historie erhalten, die Rolle kann aber nicht neu vergeben werden.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteEntitlement} className="bg-red-600 rounded-none text-xs uppercase font-bold">Löschen</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
