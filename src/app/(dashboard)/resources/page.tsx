
"use client";

import { useState, useEffect } from 'react';
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
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil, 
  Network,
  ShieldAlert,
  Settings2
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
import { Entitlement } from '@/lib/types';

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

  const [resName, setResName] = useState('');
  const [resType, setResType] = useState('SaaS');
  const [resCriticality, setResCriticality] = useState('medium');
  const [resTenantId, setResTenantId] = useState('global');

  const [entName, setEntName] = useState('');
  const [entRisk, setEntRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [entIsAdmin, setEntIsAdmin] = useState(false);
  const [entMapping, setEntMapping] = useState('');

  const { data: resources, isLoading, refresh: refreshResources } = usePluggableCollection<any>('resources');
  const { data: entitlements, refresh: refreshEntitlements } = usePluggableCollection<any>('entitlements');
  const { data: tenants } = usePluggableCollection<any>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

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
      description: '',
      riskLevel: entRisk,
      isAdmin: entIsAdmin,
      externalMapping: entMapping
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
      setEntRisk(ent.riskLevel);
      setEntIsAdmin(!!ent.isAdmin);
      setEntMapping(ent.externalMapping || '');
    } else {
      setEditingEntitlement(null);
      setEntName('');
      setEntRisk('medium');
      setEntIsAdmin(false);
      setEntMapping('');
    }
    setIsEntitlementEditOpen(true);
  };

  const filteredResources = resources?.filter((res: any) => {
    const isGlobal = res.tenantId === 'global' || !res.tenantId;
    if (activeTenantId !== 'all' && !isGlobal && res.tenantId !== activeTenantId) return false;
    return res.name.toLowerCase().includes(search.toLowerCase());
  });

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ressourcenkatalog</h1>
          <p className="text-sm text-muted-foreground">Inventar für {activeTenantId === 'all' ? 'alle Standorte' : activeTenantId}.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { setSelectedResource(null); setResName(''); setIsResourceDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input placeholder="Systeme suchen..." className="w-full pl-10 h-10 border border-input bg-white px-3 text-sm focus:outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <TableCell><Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none">{resource.tenantId || 'global'}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[8px] font-bold uppercase rounded-none", resource.criticality === 'high' ? "text-red-600 border-red-100" : "text-slate-600")}>{resource.criticality}</Badge></TableCell>
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

      <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">{selectedResource ? 'System bearbeiten' : 'System registrieren'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">System-Name</Label><Input value={resName} onChange={e => setResName(e.target.value)} className="rounded-none" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Typ</Label><Select value={resType} onValueChange={setResType}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none">{['SaaS', 'OnPrem', 'IoT', 'Cloud'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Scope</Label><Select value={resTenantId} onValueChange={setResTenantId}><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger><SelectContent className="rounded-none"><SelectItem value="global">Global (Alle Firmen)</SelectItem>{tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSaveResource} className="rounded-none font-bold uppercase text-[10px]">Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntitlementListOpen} onOpenChange={setIsEntitlementListOpen}>
        <DialogContent className="max-w-4xl rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Rollen für {selectedResource?.name}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Button size="sm" className="mb-4 h-8 text-[9px] font-bold uppercase rounded-none" onClick={() => openEntitlementEdit()}><Plus className="w-3 h-3 mr-1" /> Neue Rolle</Button>
            <Table>
              <TableHeader><TableRow><TableHead className="text-[10px] font-bold uppercase">Name</TableHead><TableHead className="text-[10px] font-bold uppercase">AD Mapping</TableHead><TableHead className="text-[10px] font-bold uppercase">Admin</TableHead><TableHead className="text-right text-[10px] font-bold uppercase">Aktionen</TableHead></TableRow></TableHeader>
              <TableBody>
                {entitlements?.filter(e => e.resourceId === selectedResource?.id).map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-bold text-xs">{e.name}</TableCell>
                    <TableCell className="font-mono text-[9px] truncate max-w-[200px]">{e.externalMapping || '—'}</TableCell>
                    <TableCell>{e.isAdmin ? <Badge className="bg-red-50 text-red-700 text-[7px] uppercase border-none px-1">Admin</Badge> : 'Nein'}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEntitlementEdit(e)}><Pencil className="w-3 h-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntitlementEditOpen} onOpenChange={setIsEntitlementEditOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Rollendetails</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Rollenname</Label><Input value={entName} onChange={e => setEntName(e.target.value)} className="rounded-none" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase flex items-center gap-2"><Network className="w-3 h-3" /> AD Gruppe (DN)</Label><Input value={entMapping} onChange={e => setEntMapping(e.target.value)} placeholder="CN=...,OU=..." className="rounded-none font-mono text-[10px]" /></div>
            <div className="flex items-center space-x-2 pt-2"><Checkbox id="adm" checked={entIsAdmin} onCheckedChange={(val) => setEntIsAdmin(!!val)} /><Label htmlFor="adm" className="text-[10px] font-bold uppercase cursor-pointer text-red-600">Admin-Rechte</Label></div>
          </div>
          <DialogFooter><Button onClick={handleSaveEntitlement} className="rounded-none font-bold uppercase text-[10px]">Rolle speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isResourceDeleteOpen} onOpenChange={setIsResourceDeleteOpen}>
        <AlertDialogContent className="rounded-none"><AlertDialogHeader><AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">System löschen?</AlertDialogTitle><AlertDialogDescription className="text-xs">Alle zugehörigen Rollen und Zuweisungen werden ebenfalls gelöscht.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel><AlertDialogAction onClick={handleDeleteResource} className="bg-red-600 rounded-none text-xs uppercase font-bold">Löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
