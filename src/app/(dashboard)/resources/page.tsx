
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
  X,
  AlertTriangle,
  FileDown,
  FileText,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking, 
  updateDocumentNonBlocking 
} from '@/firebase';
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
  
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<any>(null);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SaaS');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCriticality, setNewCriticality] = useState('medium');

  const [editingEntitlementId, setEditingEntitlementId] = useState<string | null>(null);
  const [entName, setEntName] = useState('');
  const [entRisk, setEntRisk] = useState('medium');
  const [entDesc, setEntDesc] = useState('');
  const [entParentId, setEntParentId] = useState<string | null>(null);

  const resourcesQuery = useMemoFirebase(() => collection(db, 'resources'), [db]);
  const entitlementsQuery = useMemoFirebase(() => collection(db, 'entitlements'), [db]);

  const { data: resources, isLoading } = useCollection(resourcesQuery);
  const { data: entitlements } = useCollection(entitlementsQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateResource = () => {
    if (!newName || !newOwner) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und Besitzer sind erforderlich." });
      return;
    }
    addDocumentNonBlocking(collection(db, 'resources'), {
      name: newName,
      type: newType,
      owner: newOwner,
      url: newUrl,
      criticality: newCriticality,
      createdAt: new Date().toISOString(),
      tenantId: 't1'
    });
    setIsCreateOpen(false);
    toast({ title: "System registriert" });
    setNewName('');
    setNewOwner('');
    setNewUrl('');
  };

  const handleAddOrUpdateEntitlement = () => {
    if (!entName || !selectedResource) return;
    const entData = {
      resourceId: selectedResource.id,
      name: entName,
      riskLevel: entRisk,
      description: entDesc,
      parentId: entParentId === "none" ? null : entParentId,
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
    res.owner.toLowerCase().includes(search.toLowerCase())
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
        Rollen: resourceEnts.map(e => e.name).join(', ')
      };
    });
    await exportToExcel(exportData, 'AccessHub_Ressourcenkatalog');
  };

  const handleExportPdf = async () => {
    if (!filteredResources || !entitlements) return;
    await exportResourcesPdf(filteredResources, entitlements);
  };

  const renderEntitlementTree = (parentId: string | null = null, depth: number = 0) => {
    const children = entitlements?.filter(e => e.resourceId === selectedResource?.id && (e.parentId === parentId || (!e.parentId && parentId === null)));
    
    if (!children || children.length === 0) return null;

    return children.map(e => (
      <div key={e.id} className="space-y-1">
        <div className={cn(
          "flex items-center justify-between p-3 transition-colors hover:bg-muted/5 group",
          depth > 0 && "ml-6 border-l pl-4"
        )}>
          <div className="flex items-center gap-3">
            {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
            <Badge variant="outline" className={cn(
              "text-[9px] uppercase font-bold rounded-none",
              e.riskLevel === 'high' ? "text-red-600 border-red-200" : "text-blue-600 border-blue-200"
            )}>{e.riskLevel}</Badge>
            <span className="text-sm font-bold">
              {e.name}
            </span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => {
              setEditingEntitlementId(e.id);
              setEntName(e.name);
              setEntRisk(e.riskLevel);
              setEntParentId(e.parentId || "none");
            }}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-red-600" onClick={() => {
              setSelectedEntitlement(e);
              setIsDeleteEntitlementOpen(true);
            }}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        {renderEntitlementTree(e.id, depth + 1)}
      </div>
    ));
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ressourcenkatalog</h1>
          <p className="text-sm text-muted-foreground">Inventar aller registrierten IT-Systeme.</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none">
                <FileDown className="w-3.5 h-3.5 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-none">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileDown className="w-4 h-4 mr-2" /> Excel Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="w-4 h-4 mr-2" /> PDF Bericht
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-2" /> System hinzufügen
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Systeme, Eigentümer oder IDs filtern..." 
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
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {resource.name}
                            {resource.url && <a href={resource.url} target="_blank" className="text-muted-foreground hover:text-primary"><ExternalLink className="w-3 h-3" /></a>}
                          </div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">{resource.owner}</div>
                        </div>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md rounded-none border shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">System registrieren</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name des IT-Systems</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-10 rounded-none" placeholder="z.B. SAP S/4HANA" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Betriebsmodell</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="SaaS">Cloud / SaaS</SelectItem>
                    <SelectItem value="OnPrem">On-Premises</SelectItem>
                    <SelectItem value="Private Cloud">Private Cloud</SelectItem>
                    <SelectItem value="Webshop">Webshop</SelectItem>
                    <SelectItem value="IoT">IoT / Industrie 4.0</SelectItem>
                    <SelectItem value="Andere">Andere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Kritikalität</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-[10px]">
                        <p className="font-bold mb-1">Einstufung:</p>
                        <p>Hoch: Kernsystem, Ausfall stoppt Business.</p>
                        <p>Mittel: Wichtig, Workaround möglich.</p>
                        <p>Niedrig: Unterstützendes Tool.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={newCriticality} onValueChange={setNewCriticality}>
                  <SelectTrigger className="h-10 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">System-Eigentümer (Owner)</Label>
              <Input value={newOwner} onChange={e => setNewOwner(e.target.value)} className="h-10 rounded-none" placeholder="Verantwortlicher Admin oder Team" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Zugriffs-URL (Optional)</Label>
              <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} className="h-10 rounded-none" placeholder="https://..." />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreateResource} className="w-full h-11 rounded-none font-bold uppercase text-xs">System im Katalog speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntitlementOpen} onOpenChange={setIsEntitlementOpen}>
        <DialogContent className="max-w-2xl rounded-none border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Rollen-Hierarchie: {selectedResource?.name}</DialogTitle>
            <DialogDescription className="text-xs">Bauen Sie einen Berechtigungsbaum durch Auswahl von übergeordneten Rollen auf.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="p-4 border rounded-none bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-primary">
                  {editingEntitlementId ? "Rolle bearbeiten" : "Neue Rolle hinzufügen"}
                </Label>
                {editingEntitlementId && <Button variant="ghost" size="sm" onClick={resetEntitlementForm} className="h-6 w-6 p-0 rounded-none"><X className="w-3.5 h-3.5" /></Button>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Rollenname</Label>
                  <Input value={entName} onChange={e => setEntName(e.target.value)} className="h-9 rounded-none" placeholder="z.B. Buchhaltung L1" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Übergeordnete Rolle</Label>
                  <Select value={entParentId || "none"} onValueChange={setEntParentId}>
                    <SelectTrigger className="h-9 rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="none">Keine (Wurzel-Rolle)</SelectItem>
                      {entitlements?.filter(e => e.resourceId === selectedResource?.id && e.id !== editingEntitlementId).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] font-bold uppercase">Sicherheitsrisiko</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-[10px]">
                          <p className="font-bold mb-1">Risikoklassen:</p>
                          <p>Hoch: Privilegiert (Admin, Root, DB-Write).</p>
                          <p>Mittel: Standard-Schreibrechte.</p>
                          <p>Niedrig: Read-Only / View-Only.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={entRisk} onValueChange={setEntRisk}>
                    <SelectTrigger className="h-9 rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAddOrUpdateEntitlement} size="sm" className="w-full h-10 font-bold uppercase text-[10px] rounded-none">
                {editingEntitlementId ? "Rolle aktualisieren" : "Rolle zum Katalog hinzufügen"}
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Aktuelle Baumstruktur</Label>
              <div className="border rounded-none max-h-64 overflow-auto bg-card">
                <div className="divide-y">
                  {renderEntitlementTree()}
                  {!isLoading && entitlements?.filter(e => e.resourceId === selectedResource?.id).length === 0 && (
                    <div className="p-8 text-center text-xs text-muted-foreground italic">Keine Rollen definiert.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">System löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Alle Rollen und Zuweisungen werden unwiderruflich entfernt. Dies kann Compliance-Lücken verursachen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteResource} className="bg-red-600 rounded-none font-bold uppercase text-xs">System unwiderruflich entfernen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteEntitlementOpen} onOpenChange={setIsDeleteEntitlementOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold uppercase text-sm">Rolle entfernen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Die Rolle wird aus dem System entfernt. Achtung: Untergeordnete Rollen verlieren ihren Bezug und müssen neu zugewiesen werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEntitlement} className="bg-red-600 rounded-none font-bold uppercase text-xs">Rolle löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
