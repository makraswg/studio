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
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  ExternalLink,
  Shield,
  Layers,
  Loader2,
  Trash2,
  Pencil,
  AlertTriangle,
  FileText,
  Info,
  Key,
  Users,
  Layout,
  CornerDownRight,
  HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  deleteDocumentNonBlocking, 
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { exportResourcesPdf } from '@/lib/export-utils';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';

export default function ResourcesPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEntitlementOpen, setIsEntitlementOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteEntitlementOpen, setIsDeleteEntitlementOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Selection States
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<any>(null);
  const [editingResource, setEditingResource] = useState<any>(null);

  // Resource Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SaaS');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDocumentationUrl, setNewDocumentationUrl] = useState('');
  const [newCriticality, setNewCriticality] = useState('medium');

  // Entitlement Form State
  const [editingEntitlementId, setEditingEntitlementId] = useState<string | null>(null);
  const [entName, setEntName] = useState('');
  const [entRisk, setEntRisk] = useState('medium');
  const [entDesc, setEntDesc] = useState('');
  const [entParentId, setEntParentId] = useState<string | null>(null);
  const [isSharedAccount, setIsSharedAccount] = useState(false);
  const [entPasswordManagerUrl, setEntPasswordManagerUrl] = useState('');

  // Data Loading
  const { data: resources, isLoading, refresh: refreshResources } = usePluggableCollection<any>('resources');
  const { data: entitlements, refresh: refreshEntitlements } = usePluggableCollection<any>('entitlements');
  const { data: assignments } = usePluggableCollection<any>('assignments');
  const { data: users } = usePluggableCollection<any>('users');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSaveResource = async () => {
    if (!newName || !newOwner) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und Besitzer sind erforderlich." });
      return;
    }

    const resourceId = editingResource?.id || `res-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const resData = {
      id: resourceId,
      name: newName,
      type: newType,
      owner: newOwner,
      url: newUrl,
      documentationUrl: newDocumentationUrl,
      criticality: newCriticality,
      tenantId: 't1',
      createdAt: editingResource?.createdAt || timestamp
    };

    const auditData = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      actorUid: authUser?.uid || 'system',
      action: editingResource ? 'System aktualisiert' : 'System registriert',
      entityType: 'resource',
      entityId: resourceId,
      timestamp,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      await saveCollectionRecord('resources', resourceId, resData);
      await saveCollectionRecord('auditEvents', auditData.id, auditData);
    } else {
      setDocumentNonBlocking(doc(db, 'resources', resourceId), resData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    toast({ title: editingResource ? "System aktualisiert" : "System registriert" });
    setIsCreateOpen(false);
    resetResourceForm();
    setTimeout(() => refreshResources(), 200);
  };

  const handleAddOrUpdateEntitlement = async () => {
    if (!entName || !selectedResource) {
      toast({ variant: "destructive", title: "Fehler", description: "Name ist erforderlich." });
      return;
    }
    
    const entId = editingEntitlementId || `ent-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const entData = {
      id: entId,
      resourceId: selectedResource.id,
      name: entName,
      riskLevel: entRisk,
      description: entDesc,
      parentId: entParentId === "none" ? null : entParentId,
      isSharedAccount: isSharedAccount ? 1 : 0,
      passwordManagerUrl: isSharedAccount ? entPasswordManagerUrl : '',
      tenantId: 't1'
    };

    const auditData = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      actorUid: authUser?.uid || 'system',
      action: editingEntitlementId ? 'Rolle aktualisiert' : 'Rolle hinzugefügt',
      entityType: 'entitlement',
      entityId: entId,
      timestamp,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      await saveCollectionRecord('entitlements', entId, entData);
      await saveCollectionRecord('auditEvents', auditData.id, auditData);
    } else {
      const fbData = { ...entData, isSharedAccount };
      setDocumentNonBlocking(doc(db, 'entitlements', entId), fbData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    toast({ title: editingEntitlementId ? "Berechtigung aktualisiert" : "Berechtigung hinzugefügt" });
    resetEntitlementForm();
    setTimeout(() => {
      refreshEntitlements();
      refreshResources();
    }, 200);
  };

  const confirmDeleteResource = async () => {
    if (selectedResource) {
      const timestamp = new Date().toISOString();
      const auditData = {
        id: `audit-${Math.random().toString(36).substring(2, 9)}`,
        actorUid: authUser?.uid || 'system',
        action: 'System gelöscht',
        entityType: 'resource',
        entityId: selectedResource.id,
        timestamp,
        tenantId: 't1'
      };

      if (dataSource === 'mysql') {
        await deleteCollectionRecord('resources', selectedResource.id);
        await saveCollectionRecord('auditEvents', auditData.id, auditData);
      } else {
        deleteDocumentNonBlocking(doc(db, 'resources', selectedResource.id));
        addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
      }
      toast({ title: "Ressource gelöscht" });
      setIsDeleteDialogOpen(false);
      setSelectedResource(null);
      setTimeout(() => refreshResources(), 200);
    }
  };

  const confirmDeleteEntitlement = async () => {
    if (selectedEntitlement) {
      const timestamp = new Date().toISOString();
      const auditData = {
        id: `audit-${Math.random().toString(36).substring(2, 9)}`,
        actorUid: authUser?.uid || 'system',
        action: 'Rolle gelöscht',
        entityType: 'entitlement',
        entityId: selectedEntitlement.id,
        timestamp,
        tenantId: 't1'
      };

      if (dataSource === 'mysql') {
        await deleteCollectionRecord('entitlements', selectedEntitlement.id);
        await saveCollectionRecord('auditEvents', auditData.id, auditData);
      } else {
        deleteDocumentNonBlocking(doc(db, 'entitlements', selectedEntitlement.id));
        addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
      }
      toast({ title: "Rolle gelöscht" });
      setIsDeleteEntitlementOpen(false);
      setSelectedEntitlement(null);
      setTimeout(() => {
        refreshEntitlements();
        refreshResources();
      }, 200);
    }
  };

  const resetResourceForm = () => {
    setNewName('');
    setNewOwner('');
    setNewUrl('');
    setNewType('SaaS');
    setNewDocumentationUrl('');
    setNewCriticality('medium');
    setEditingResource(null);
  };

  const resetEntitlementForm = () => {
    setEntName('');
    setEntDesc('');
    setEntRisk('medium');
    setEntParentId(null);
    setEditingEntitlementId(null);
    setIsSharedAccount(false);
    setEntPasswordManagerUrl('');
  };

  const openEditResource = (resource: any) => {
    setEditingResource(resource);
    setNewName(resource.name);
    setNewType(resource.type);
    setNewOwner(resource.owner);
    setNewUrl(resource.url || '');
    setNewDocumentationUrl(resource.documentationUrl || '');
    setNewCriticality(resource.criticality);
    setIsCreateOpen(true);
  };

  const filteredResources = resources?.filter((res: any) => 
    res.name.toLowerCase().includes(search.toLowerCase()) ||
    (res.owner || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderEntitlementItem = (ent: any, depth = 0) => {
    const children = entitlements?.filter((e: any) => e.parentId === ent.id) || [];
    const isShared = !!(ent.isSharedAccount === true || ent.isSharedAccount === 1 || ent.isSharedAccount === "1");

    return (
      <div key={ent.id}>
        <div className={cn(
          "flex items-center justify-between p-3 hover:bg-muted/5 group border-b last:border-0",
          depth > 0 && "pl-8"
        )}>
          <div className="flex items-center gap-2">
            {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground" />}
            <div className="flex flex-col">
              <span className="text-sm font-bold flex items-center gap-2">
                {ent.name}
                {isShared && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 text-[8px] border-orange-200">SHARED</Badge>
                )}
                {!!ent.passwordManagerUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={ent.passwordManagerUrl} target="_blank" onClick={(e) => e.stopPropagation()}>
                          <Key className="w-3.5 h-3.5 text-primary" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px] font-bold uppercase">Passwortmanager öffnen</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
              {ent.description && <span className="text-[10px] text-muted-foreground">{ent.description}</span>}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => {
              setEditingEntitlementId(ent.id);
              setEntName(ent.name);
              setEntRisk(ent.riskLevel);
              setEntParentId(ent.parentId || "none");
              setIsSharedAccount(isShared);
              setEntPasswordManagerUrl(ent.passwordManagerUrl || '');
              setEntDesc(ent.description || '');
            }}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-red-600" onClick={() => {
              setSelectedEntitlement(ent);
              setIsDeleteEntitlementOpen(true);
            }}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        {children.map((child: any) => renderEntitlementItem(child, depth + 1))}
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ressourcenkatalog</h1>
          <p className="text-sm text-muted-foreground">Zentrale Übersicht aller Anwendungen und Systeme ({dataSource.toUpperCase()}).</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => exportResourcesPdf(resources || [], entitlements || [])}>
            <FileText className="w-3.5 h-3.5 mr-2" /> PDF Export
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { resetResourceForm(); setIsCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> System registrieren
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Anwendungen oder Besitzern suchen..." 
          className="pl-10 h-10 shadow-none border-border rounded-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Inventar wird geladen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Anwendung</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Doku</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Typ</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Kritikalität</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Berechtigungen</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Management</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource: any) => {
                const resourceEnts = entitlements?.filter((e: any) => e.resourceId === resource.id) || [];
                return (
                  <TableRow key={resource.id} className="group transition-colors hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div className="cursor-pointer" onClick={() => { setSelectedResource(resource); setIsDetailsOpen(true); }}>
                          <div className="font-bold text-sm flex items-center gap-2 hover:text-primary transition-colors">
                            {resource.name}
                            {!!resource.url && (
                              <a href={resource.url} target="_blank" className="text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">{resource.owner}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {resource.documentationUrl ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a href={resource.documentationUrl} target="_blank" className="p-1.5 border hover:bg-muted inline-block">
                                <FileText className="w-3.5 h-3.5 text-slate-600" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-bold uppercase">Dokumentation öffnen</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : <span className="text-[10px] text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 rounded-none">{resource.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-none font-bold uppercase text-[9px] px-2 py-0 border-none",
                        resource.criticality === 'high' ? "bg-red-500 text-white" : 
                        resource.criticality === 'medium' ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
                      )}>
                        {resource.criticality}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        <span>{resourceEnts.length} Rollen</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-muted">
                            <MoreHorizontal className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 p-1 shadow-xl rounded-none">
                          <DropdownMenuItem onSelect={() => { setSelectedResource(resource); setIsDetailsOpen(true); }}>
                            <Layout className="w-4 h-4 mr-2" /> Details & Zugriff
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEditResource(resource)}>
                            <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {
                            setSelectedResource(resource);
                            resetEntitlementForm();
                            setTimeout(() => setIsEntitlementOpen(true), 150);
                          }}>
                            <Shield className="w-4 h-4 mr-2" /> Rollen verwalten
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => {
                            setSelectedResource(resource);
                            setIsDeleteDialogOpen(true);
                          }}>
                            <Trash2 className="w-4 h-4 mr-2" /> System entfernen
                          </DropdownMenuItem>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none border shadow-2xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">
              {editingResource ? 'System bearbeiten' : 'Neues System registrieren'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Erfassen Sie die Stammdaten und die Kritikalität für den Ressourcenkatalog.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Anwendungsname</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. SAP S/4HANA" className="rounded-none h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Systemtyp</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="rounded-none h-10">
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="SaaS">Software as a Service (SaaS)</SelectItem>
                  <SelectItem value="OnPrem">On-Premise Infrastructure</SelectItem>
                  <SelectItem value="Private Cloud">Private Cloud</SelectItem>
                  <SelectItem value="Webshop">Webshop / E-Commerce</SelectItem>
                  <SelectItem value="IoT">IoT / Industrie 4.0</SelectItem>
                  <SelectItem value="Andere">Andere / Legacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Systembesitzer (Owner)</Label>
              <Input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="Name oder Abteilung" className="rounded-none h-10" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Kritikalität</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-[10px] font-bold uppercase leading-relaxed">
                      High: Geschäftskritisch, personenbezogene Daten.<br/>
                      Medium: Wichtig für Prozesse.<br/>
                      Low: Unterstützende Tools.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={newCriticality} onValueChange={setNewCriticality}>
                <SelectTrigger className="rounded-none h-10">
                  <SelectValue placeholder="Kritikalität" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="low">Niedrig (Low)</SelectItem>
                  <SelectItem value="medium">Mittel (Medium)</SelectItem>
                  <SelectItem value="high">Hoch (High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Anwendungs-URL</Label>
              <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://app.company.com" className="rounded-none h-10" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Dokumentations-Link (Wiki/Wiki)</Label>
              <Input value={newDocumentationUrl} onChange={e => setNewDocumentationUrl(e.target.value)} placeholder="https://wiki.company.com/resource" className="rounded-none h-10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleSaveResource} className="rounded-none font-bold uppercase text-[10px]">
              {editingResource ? 'Änderungen speichern' : 'System registrieren'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl rounded-none border shadow-2xl">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold font-headline">{selectedResource?.name}</DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Besitzer: {selectedResource?.owner} • Typ: {selectedResource?.type}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-6">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Wer hat Zugriff?
                </h3>
                <div className="border rounded-none overflow-hidden max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0">
                      <TableRow>
                        <TableHead className="h-10 text-[9px] font-bold uppercase">Mitarbeiter</TableHead>
                        <TableHead className="h-10 text-[9px] font-bold uppercase">Rolle</TableHead>
                        <TableHead className="h-10 text-[9px] font-bold uppercase text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments?.filter((a: any) => {
                        const ent = entitlements?.find((e: any) => e.id === a.entitlementId);
                        return ent?.resourceId === selectedResource?.id && a.status === 'active';
                      }).map((a: any) => {
                        const user = users?.find((u: any) => u.id === a.userId);
                        const ent = entitlements?.find((e: any) => e.id === a.entitlementId);
                        return (
                          <TableRow key={a.id} className="text-xs">
                            <TableCell className="py-3 font-bold">{user?.displayName || user?.name || a.userId}</TableCell>
                            <TableCell>{ent?.name}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[8px] uppercase border-none">AKTIV</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" /> System-Info
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-muted/20 border-l-4 border-primary">
                    <p className="font-bold text-[9px] uppercase text-muted-foreground mb-1">Kritikalität</p>
                    <p className="font-bold uppercase">{selectedResource?.criticality || 'MEDIUM'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-[9px] uppercase text-muted-foreground">Links</p>
                    {!!selectedResource?.url && (
                      <a href={selectedResource.url} target="_blank" className="flex items-center gap-2 p-2 border hover:bg-muted text-primary font-bold">
                        <ExternalLink className="w-3.5 h-3.5" /> Anwendung öffnen
                      </a>
                    )}
                    {!!selectedResource?.documentationUrl && (
                      <a href={selectedResource.documentationUrl} target="_blank" className="flex items-center gap-2 p-2 border hover:bg-muted text-slate-700 font-bold">
                        <FileText className="w-3.5 h-3.5" /> Dokumentation
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)} className="rounded-none">Schließen</Button>
            <Button onClick={() => openEditResource(selectedResource)} className="rounded-none font-bold uppercase text-[10px]">Bearbeiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntitlementOpen} onOpenChange={setIsEntitlementOpen}>
        <DialogContent className="max-w-2xl rounded-none border shadow-2xl overflow-hidden p-0">
          <div className="bg-slate-900 text-white p-6">
            <h2 className="text-xl font-bold font-headline">Rollen für {selectedResource?.name}</h2>
            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Berechtigungskatalog & Hierarchie</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 border">
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Rollenname / Permission</Label>
                <Input value={entName} onChange={e => setEntName(e.target.value)} placeholder="z.B. Finanz-Editor" className="rounded-none" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung</Label>
                <Textarea value={entDesc} onChange={e => setEntDesc(e.target.value)} placeholder="Beschreibung der Berechtigung..." className="rounded-none resize-none h-20" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Risikostufe</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[200px] text-[10px] font-bold uppercase leading-relaxed">
                        High: Privilegierter Zugriff, Admin-Rechte.<br/>
                        Medium: Schreibzugriff, Fachbereichs-Spezialisten.<br/>
                        Low: Standard-Lesezugriff.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={entRisk} onValueChange={setEntRisk}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="low">Niedrig (Low)</SelectItem>
                    <SelectItem value="medium">Mittel (Medium)</SelectItem>
                    <SelectItem value="high">Hoch (High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Übergeordnete Rolle</Label>
                <Select value={entParentId || "none"} onValueChange={setEntParentId}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="none">Keine (Hauptrolle)</SelectItem>
                    {entitlements?.filter((e: any) => e.resourceId === selectedResource?.id && e.id !== editingEntitlementId).map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="shared" checked={isSharedAccount} onCheckedChange={(val) => setIsSharedAccount(!!val)} />
                  <label htmlFor="shared" className="text-[10px] font-bold uppercase cursor-pointer select-none">Shared Account / Nicht benutzerbezogen</label>
                </div>
                {isSharedAccount && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <Label className="text-[10px] font-bold uppercase text-orange-600">Passwortmanager Link (Vault URL)</Label>
                    <Input value={entPasswordManagerUrl} onChange={e => setEntPasswordManagerUrl(e.target.value)} placeholder="https://vault.company.com/..." className="rounded-none border-orange-200" />
                  </div>
                )}
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                {!!editingEntitlementId && <Button variant="ghost" size="sm" className="rounded-none" onClick={resetEntitlementForm}>Abbrechen</Button>}
                <Button size="sm" className="rounded-none font-bold uppercase text-[10px]" onClick={handleAddOrUpdateEntitlement}>
                  {editingEntitlementId ? 'Rolle aktualisieren' : 'Rolle hinzufügen'}
                </Button>
              </div>
            </div>

            <div className="border rounded-none">
              <div className="bg-muted/30 p-2 border-b text-[10px] font-bold uppercase tracking-widest">Definierte Rollen</div>
              <div className="max-h-[300px] overflow-y-auto">
                {entitlements?.filter((e: any) => e.resourceId === selectedResource?.id && !e.parentId).map((ent: any) => renderEntitlementItem(ent))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button variant="outline" onClick={() => setIsEntitlementOpen(false)} className="rounded-none">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> System löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Dies entfernt das System "{selectedResource?.name}" unwiderruflich aus dem Katalog. Alle Rollendefinitionen und Zuweisungen werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteResource} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs">Unwiderruflich löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteEntitlementOpen} onOpenChange={setIsDeleteEntitlementOpen}>
        <AlertDialogContent className="rounded-none border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">Rolle entfernen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Möchten Sie die Rolle "{selectedEntitlement?.name}" wirklich löschen? Aktive Zuweisungen an Benutzer werden dadurch ungültig.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEntitlement} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
