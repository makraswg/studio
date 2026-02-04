
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
  AlertTriangle
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
import { Entitlement, Tenant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ResourcesPage() {
  const db = useFirestore();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isResourceDeleteOpen, setIsResourceDeleteOpen] = useState(false);
  const [isEntitlementListOpen, setIsEntitlementListOpen] = useState(false);
  const [isEntitlementEditOpen, setIsEntitlementEditOpen] = useState(false);

  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [editingEntitlement, setEditingEntitlement] = useState<Entitlement | null>(null);

  // Resource Form State
  const [resName, setResName] = useState('');
  const [resType, setResType] = useState('SaaS');
  const [resCriticality, setResCriticality] = useState('medium');
  const [resTenantId, setResTenantId] = useState('global');

  // Entitlement Form State
  const [entName, setEntName] = useState('');
  const [entDescription, setEntDescription] = useState('');
  const [entRisk, setEntRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [entIsAdmin, setEntIsAdmin] = useState(false);
  const [entMapping, setEntMapping] = useState('');
  const [entParentId, setEntParentId] = useState<string>('none');

  const { data: resources, isLoading, refresh: refreshResources } = usePluggableCollection<any>('resources');
  const { data: entitlements, refresh: refreshEntitlements } = usePluggableCollection<any>('entitlements');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'global' || id === 'null' || id === 'undefined') return 'global';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const handleSaveResource = async () => {
    if (!resName) return;
    const id = selectedResource?.id || `res-${Math.random().toString(36).substring(2, 9)}`;
    const data = {
      ...selectedResource,
      id,
      name: resName,
      type: resType,
      criticality: resCriticality,
      tenantId: resTenantId,
      owner: 'Unbekannt',
      url: '#'
    };
    if (dataSource === 'mysql') await saveCollectionRecord('resources', id, data);
    else setDocumentNonBlocking(doc(db, 'resources', id), data);
    toast({ title: "Ressource gespeichert" });
    setIsResourceDialogOpen(false);
    setTimeout(() => refreshResources(), 200);
  };

  const handleDeleteResource = async () => {
    if (!selectedResource) return;
    if (dataSource === 'mysql') await deleteCollectionRecord('resources', selectedResource.id);
    else deleteDocumentNonBlocking(doc(db, 'resources', selectedResource.id));
    toast({ title: "Ressource gelöscht" });
    setIsResourceDeleteOpen(false);
    setSelectedResource(null);
    setTimeout(() => refreshResources(), 200);
  };

  const handleSaveEntitlement = async () => {
    if (!entName || !selectedResource) return;
    const id = editingEntitlement?.id || `ent-${Math.random().toString(36).substring(2, 9)}`;
    const data = {
      id,
      resourceId: selectedResource.id,
      tenantId: selectedResource.tenantId || 'global',
      name: entName,
      description: entDescription,
      riskLevel: entRisk,
      isAdmin: entIsAdmin,
      externalMapping: entMapping,
      parentId: entParentId === 'none' ? null : entParentId
    };
    if (dataSource === 'mysql') await saveCollectionRecord('entitlements', id, data);
    else setDocumentNonBlocking(doc(db, 'entitlements', id), data);
    toast({ title: "Rolle gespeichert" });
    setIsEntitlementEditOpen(false);
    setTimeout(() => refreshEntitlements(), 200);
  };

  const openResourceEdit = (res: any) => {
    setSelectedResource(res);
    setResName(res.name);
    setResType(res.type);
    setResCriticality(res.criticality);
    setResTenantId(res.tenantId || 'global');
    setIsResourceDialogOpen(true);
  };

  const openEntitlementEdit = (ent?: Entitlement) => {
    if (ent) {
      setEditingEntitlement(ent);
      setEntName(ent.name);
      setEntDescription(ent.description || '');
      setEntRisk(ent.riskLevel || 'medium');
      setEntIsAdmin(!!ent.isAdmin);
      setEntMapping(ent.externalMapping || '');
      setEntParentId(ent.parentId || 'none');
    } else {
      setEditingEntitlement(null);
      setEntName('');
      setEntDescription('');
      setEntRisk('medium');
      setEntIsAdmin(false);
      setEntMapping('');
      setEntParentId('none');
    }
    setIsEntitlementEditOpen(true);
  };

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    return resources.filter((res: any) => {
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
          <p className="text-sm text-muted-foreground">Inventar für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { setSelectedResource(null); setResName(''); setIsResourceDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Systeme suchen..." 
          className="pl-10 h-10 border border-input bg-white px-3 text-sm focus:outline-none rounded-none" 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
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
                <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Kritikalität</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Rollen / AD Mapping</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource: any) => {
                const resourceEnts = entitlements?.filter(e => e.resourceId === resource.id) || [];
                return (
                  <TableRow key={resource.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="font-bold text-sm">{resource.name}</div>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase">{resource.type}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none">
                        {getTenantSlug(resource.tenantId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[8px] font-bold uppercase rounded-none", resource.criticality === 'high' ? "text-red-600 border-red-100" : "text-slate-600")}>
                        {resource.criticality}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {resourceEnts.slice(0, 3).map(e => (
                          <Badge key={e.id} variant="secondary" className="rounded-none text-[8px] uppercase gap-1">
                            {e.isAdmin && <ShieldAlert className="w-2.5 h-2.5 text-red-600" />}
                            {e.name}
                          </Badge>
                        ))}
                        {resourceEnts.length > 3 && <span className="text-[8px] font-bold">+{resourceEnts.length - 3} weitere</span>}
                      </div>
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
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">{selectedResource ? 'System bearbeiten' : 'System registrieren'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">System-Name</Label><Input value={resName} onChange={e => setResName(e.target.value)} className="rounded-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Typ</Label><Select value={resType} onValueChange={setResType}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{['SaaS', 'OnPrem', 'IoT', 'Cloud'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Scope</Label>
                <Select value={resTenantId} onValueChange={setResTenantId}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="global">Global (Alle Firmen)</SelectItem>
                    {tenants?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Kritikalität</Label>
              <Select value={resCriticality} onValueChange={setResCriticality}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="low">Niedrig (Standard)</SelectItem>
                  <SelectItem value="medium">Mittel (Business)</SelectItem>
                  <SelectItem value="high">Hoch (Kritisch)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveResource} className="rounded-none font-bold uppercase text-[10px]">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entitlement List Dialog */}
      <Dialog open={isEntitlementListOpen} onOpenChange={setIsEntitlementListOpen}>
        <DialogContent className="max-w-5xl rounded-none h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Settings2 className="w-5 h-5 text-primary" />
              <div>
                <DialogTitle className="text-lg font-bold uppercase tracking-wider">Rollen für {selectedResource?.name}</DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Definition der Zugriffslevel und AD-Mappings</p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-muted/10 shrink-0">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Aktive Rollen im System</p>
              <Button size="sm" className="h-8 text-[9px] font-bold uppercase rounded-none" onClick={() => openEntitlementEdit()}>
                <Plus className="w-3 h-3 mr-1.5" /> Neue Rolle definieren
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase">Rollenname</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Mapping / Basis</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Risiko</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Admin</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entitlements?.filter(e => e.resourceId === selectedResource?.id).map(e => {
                      const parent = entitlements?.find(p => p.id === e.parentId);
                      return (
                        <TableRow key={e.id} className="hover:bg-muted/5 border-b">
                          <TableCell className="py-4">
                            <div className="font-bold text-sm">{e.name}</div>
                            {e.description && <div className="text-[9px] text-muted-foreground truncate max-w-[250px]">{e.description}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {e.externalMapping ? (
                                <div className="flex items-center gap-1.5 text-[9px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 w-fit border border-blue-100">
                                  <Network className="w-2.5 h-2.5" /> {e.externalMapping}
                                </div>
                              ) : <span className="text-[9px] text-muted-foreground italic">Kein Mapping</span>}
                              {parent && (
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase">
                                  <GitGraph className="w-2.5 h-2.5" /> Erbt von: {parent.name}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[8px] font-bold uppercase rounded-none border-none px-2",
                              e.riskLevel === 'high' ? "bg-red-50 text-red-700" : 
                              e.riskLevel === 'medium' ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                            )}>
                              {e.riskLevel || 'low'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {e.isAdmin ? <ShieldAlert className="w-4 h-4 text-red-600" /> : <div className="w-4 h-4" />}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEntitlementEdit(e)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>
          <div className="p-4 border-t bg-slate-50 flex justify-end shrink-0">
            <Button onClick={() => setIsEntitlementListOpen(false)} variant="outline" className="rounded-none h-10 px-8">Schließen</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Entitlement Edit/Create Dialog */}
      <Dialog open={isEntitlementEditOpen} onOpenChange={setIsEntitlementEditOpen}>
        <DialogContent className="rounded-none border shadow-2xl max-w-2xl p-0 overflow-hidden flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                {editingEntitlement ? 'Rolle bearbeiten' : 'Neue Rolle definieren'}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Stammdaten */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 mb-4">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">Identifikation & Zweck</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Rollen-Bezeichnung</Label>
                    <Input value={entName} onChange={e => setEntName(e.target.value)} placeholder="z.B. Enterprise Admin" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung / Geschäftlicher Nutzen</Label>
                    <Textarea 
                      value={entDescription} 
                      onChange={e => setEntDescription(e.target.value)} 
                      placeholder="Was darf dieser Nutzer tun? Warum wird diese Rolle benötigt?" 
                      className="rounded-none min-h-[100px] resize-none" 
                    />
                  </div>
                </div>
              </div>

              {/* Technische Steuerung */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2 mb-4">
                  <GitGraph className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">Technische Steuerung & Vererbung</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Basis-Rolle (Inheritance)</Label>
                    <Select value={entParentId} onValueChange={setEntParentId}>
                      <SelectTrigger className="rounded-none h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="none">Keine (Eigenständige Rolle)</SelectItem>
                        {entitlements?.filter(e => e.resourceId === selectedResource?.id && e.id !== editingEntitlement?.id).map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-muted-foreground italic">Nutzer erhalten automatisch die Rechte der Basis-Rolle.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risiko-Einstufung</Label>
                    <Select value={entRisk} onValueChange={(val: any) => setEntRisk(val)}>
                      <SelectTrigger className="rounded-none h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="low">Niedrig (Standard)</SelectItem>
                        <SelectItem value="medium">Mittel (Sensibel)</SelectItem>
                        <SelectItem value="high">Hoch (Privilegiert)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Network className="w-3 h-3" /> AD Gruppe (Distinguished Name)
                  </Label>
                  <Input 
                    value={entMapping} 
                    onChange={e => setEntMapping(e.target.value)} 
                    placeholder="CN=Access_SAP,OU=Groups,DC=acme,DC=com" 
                    className="rounded-none font-mono text-[10px] h-10" 
                  />
                  <p className="text-[9px] text-muted-foreground">Ermöglicht den automatisierten Abgleich via LDAP-Sync.</p>
                </div>
                <div className="flex items-center space-x-3 pt-2 p-4 bg-red-50/30 border border-red-100">
                  <Checkbox id="is-admin-flag" checked={entIsAdmin} onCheckedChange={(val) => setEntIsAdmin(!!val)} />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="is-admin-flag" className="text-[10px] font-bold uppercase cursor-pointer text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Diese Rolle besitzt administrative Rechte
                    </Label>
                    <p className="text-[9px] text-red-600/70">Wird in Berichten und Filtern besonders hervorgehoben.</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsEntitlementEditOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button onClick={handleSaveEntitlement} className="rounded-none font-bold uppercase text-[10px] px-10">Rolle speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isResourceDeleteOpen} onOpenChange={setIsResourceDeleteOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">System löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Alle zugehörigen Rollen und Zuweisungen werden ebenfalls gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteResource} className="bg-red-600 rounded-none text-xs uppercase font-bold">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
