
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
  ExternalLink,
  Shield,
  Layers,
  Loader2,
  Trash2,
  Pencil,
  AlertTriangle,
  FileDown,
  FileText,
  Info,
  Key,
  Users,
  Layout,
  CornerDownRight,
  UserX
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
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection'; // Geändert
import { 
  useFirestore, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking, 
  updateDocumentNonBlocking
} from '@/firebase'; // Schreib-Hooks beibehalten
import { collection, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { exportToExcel, exportResourcesPdf } from '@/lib/export-utils';

export default function ResourcesPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEntitlementOpen, setIsEntitlementOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteEntitlementOpen, setIsDeleteEntitlementOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<any>(null);
  const [editingResource, setEditingResource] = useState<any>(null);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SaaS');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDocumentationUrl, setNewDocumentationUrl] = useState('');
  const [newCriticality, setNewCriticality] = useState('medium');

  const [editingEntitlementId, setEditingEntitlementId] = useState<string | null>(null);
  const [entName, setEntName] = useState('');
  const [entRisk, setEntRisk] = useState('medium');
  const [entDesc, setEntDesc] = useState('');
  const [entParentId, setEntParentId] = useState<string | null>(null);
  const [isSharedAccount, setIsSharedAccount] = useState(false);
  const [entPasswordManagerUrl, setEntPasswordManagerUrl] = useState('');

  // Geändert auf usePluggableCollection
  const { data: resources, loading: isLoading } = usePluggableCollection('resources');
  const { data: entitlements } = usePluggableCollection('entitlements');
  const { data: assignments } = usePluggableCollection('assignments');
  const { data: users } = usePluggableCollection('users');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateOrUpdateResource = () => {
    if (!newName || !newOwner) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und Besitzer sind erforderlich." });
      return;
    }

    const resData = {
      name: newName,
      type: newType,
      owner: newOwner,
      url: newUrl,
      documentationUrl: newDocumentationUrl,
      criticality: newCriticality,
      tenantId: 't1'
    };

    if (editingResource) {
      updateDocumentNonBlocking(doc(db, 'resources', editingResource.id), resData);
      toast({ title: "System aktualisiert" });
    } else {
      addDocumentNonBlocking(collection(db, 'resources'), {
        ...resData,
        createdAt: new Date().toISOString(),
      });
      toast({ title: "System registriert" });
    }

    setIsCreateOpen(false);
    resetResourceForm();
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

  const handleAddOrUpdateEntitlement = () => {
    if (!entName || !selectedResource) return;
    const entData = {
      resourceId: selectedResource.id,
      name: entName,
      riskLevel: entRisk,
      description: entDesc,
      parentId: entParentId === "none" ? null : entParentId,
      isSharedAccount,
      passwordManagerUrl: isSharedAccount ? entPasswordManagerUrl : '',
      tenantId: 't1'
    };
    if (editingEntitlementId) {
      updateDocumentNonBlocking(doc(db, 'entitlements', editingEntitlementId), entData);
      toast({ title: "Berechtigung aktualisiert" });
    } else {
      addDocumentNonBlocking(collection(db, 'entitlements'), entData);
      toast({ title: "Berechtigung hinzugefügt" });
    }
    resetEntitlementForm();
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

  const confirmDeleteResource = () => {
    if (selectedResource) {
      deleteDocumentNonBlocking(doc(db, 'resources', selectedResource.id));
      toast({ title: "Ressource gelöscht" });
      setIsDeleteDialogOpen(false);
      setSelectedResource(null);
    }
  };

  const confirmDeleteEntitlement = () => {
    if (selectedEntitlement) {
      deleteDocumentNonBlocking(doc(db, 'entitlements', selectedEntitlement.id));
      toast({ title: "Berechtigung gelöscht" });
      setIsDeleteEntitlementOpen(false);
      setSelectedEntitlement(null);
    }
  };

  const filteredResources = resources?.filter(res => 
    res.name.toLowerCase().includes(search.toLowerCase()) ||
    (res.owner || '').toLowerCase().includes(search.toLowerCase()) // Sicherstellen, dass owner existiert
  );

  const handleExportExcel = async () => {
    if (!filteredResources) return;
    const exportData = filteredResources.map(r => {
      const resourceEnts = entitlements?.filter(e => e.resourceId === r.id) || [];
      return {
        System: r.name,
        Typ: r.type,
        Kritikalitaet: r.criticality,
        Besitzer: r.owner,
        URL: r.url || '',
        Dokumentation: r.documentationUrl || '',
        Rollen: resourceEnts.map(e => e.name).join(', ')
      };
    });
    await exportToExcel(exportData, 'AccessHub_Ressourcenkatalog');
  };

  const handleExportPdf = async () => {
    if (!filteredResources || !entitlements) return;
    await exportResourcesPdf(filteredResources, entitlements);
  };

  const openDetails = (resource: any) => {
    setSelectedResource(resource);
    setTimeout(() => setIsDetailsOpen(true), 150);
  };

  const renderEntitlementItem = (ent: any, depth = 0) => {
    const children = entitlements?.filter(e => e.parentId === ent.id) || [];
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
                {ent.isSharedAccount && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <UserX className="w-3.5 h-3.5 text-orange-600" />
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px] font-bold uppercase">Shared Account / Nicht benutzerbezogen</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {ent.passwordManagerUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={ent.passwordManagerUrl} target="_blank" onClick={(e) => e.stopPropagation()}>
                          <Key className="w-3.5 h-3.5 text-orange-600" />
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
              setIsSharedAccount(!!ent.isSharedAccount);
              setEntPasswordManagerUrl(ent.passwordManagerUrl || '');
              setEntDesc(ent.description || '');
            }}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-red-600" onClick={() => {
              setSelectedEntitlement(ent);
              setIsDeleteEntitlementOpen(true);
            }}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        {children.map(child => renderEntitlementItem(child, depth + 1))}
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* ... Header and Search ... */}
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
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Links</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Typ</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Kritikalität</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Berechtigungen</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Management</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => {
                const resourceEnts = entitlements?.filter(e => e.resourceId === resource.id) || [];
                return (
                  <TableRow key={resource.id} className="group transition-colors hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div className="cursor-pointer" onClick={() => openDetails(resource)}>
                          <div className="font-bold text-sm flex items-center gap-2 hover:text-primary transition-colors">
                            {resource.name}
                            {resource.url && <a href={resource.url} target="_blank" className="text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}><ExternalLink className="w-3 h-3" /></a>}
                          </div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">{resource.owner}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {resource.documentationUrl && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a href={resource.documentationUrl} target="_blank" className="p-1.5 border hover:bg-muted transition-colors">
                                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent className="text-[10px] font-bold uppercase">Dokumentation</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {!resource.documentationUrl && (
                          <span className="text-[10px] text-muted-foreground italic uppercase">Keine Links</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 rounded-none">{resource.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-none font-bold uppercase text-[9px] px-2 py-0 border-none",
                        resource.criticality === 'high' ? "bg-red-500 text-white" : "bg-blue-600 text-white"
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
                          <DropdownMenuItem onSelect={() => openDetails(resource)}>
                            <Layout className="w-4 h-4 mr-2" /> Details & Zugriff
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEditResource(resource)}>
                            <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault();
                            setSelectedResource(resource);
                            resetEntitlementForm();
                            setTimeout(() => setIsEntitlementOpen(true), 150);
                          }}>
                            <Shield className="w-4 h-4 mr-2" /> Rollen verwalten
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={(e) => {
                            e.preventDefault();
                            setSelectedResource(resource);
                            setTimeout(() => setIsDeleteDialogOpen(true), 150);
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
      {/* ... Dialogs ... */}
    </div>
  );
}
