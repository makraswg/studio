
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
  AlertTriangle
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
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ResourcesPage() {
  const db = useFirestore();
  const { user: authUser } = useUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEntitlementOpen, setIsEntitlementOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteEntitlementOpen, setIsDeleteEntitlementOpen] = useState(false);
  
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [selectedEntitlement, setSelectedEntitlement] = useState<any>(null);

  // Resource Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SaaS');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCriticality, setNewCriticality] = useState('medium');

  // Entitlement Form State
  const [editingEntitlementId, setEditingEntitlementId] = useState<string | null>(null);
  const [entName, setEntName] = useState('');
  const [entRisk, setEntRisk] = useState('medium');
  const [entDesc, setEntDesc] = useState('');

  const resourcesQuery = useMemoFirebase(() => collection(db, 'resources'), [db]);
  const entitlementsQuery = useMemoFirebase(() => collection(db, 'entitlements'), [db]);

  const { data: resources, isLoading } = useCollection(resourcesQuery);
  const { data: entitlements } = useCollection(entitlementsQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateResource = () => {
    if (!newName || !newOwner) {
      toast({ variant: "destructive", title: "Erforderlich", description: "Name und Besitzer sind erforderlich." });
      return;
    }

    addDocumentNonBlocking(collection(db, 'resources'), {
      name: newName,
      type: newType,
      owner: newOwner,
      url: newUrl,
      criticality: newCriticality,
      createdAt: new Date().toISOString()
    });
    
    setIsCreateOpen(false);
    toast({ title: "Ressource hinzugefügt" });
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

  if (!mounted) return <div className="p-8 h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ressourcenkatalog</h1>
          <p className="text-muted-foreground mt-1">Dokumentation von Systemen und Anwendungen.</p>
        </div>
        
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-primary gap-2 h-11 px-6 shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" /> Ressource hinzufügen
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Ressourcen suchen..." 
          className="pl-10 h-11 bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Lade Katalog...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-accent/30">
              <TableRow>
                <TableHead className="w-[300px] py-4">Ressource</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kritikalität</TableHead>
                <TableHead>Berechtigungen</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.map((resource) => {
                const resourceEnts = entitlements?.filter(e => e.resourceId === resource.id) || [];
                return (
                  <TableRow key={resource.id} className="group transition-colors hover:bg-accent/10">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            {resource.name}
                            {resource.url && <a href={resource.url} target="_blank" className="text-muted-foreground hover:text-primary"><ExternalLink className="w-3 h-3" /></a>}
                          </div>
                          <div className="text-xs text-muted-foreground">{resource.owner}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{resource.type}</Badge></TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "font-bold",
                        resource.criticality === 'high' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                      )} variant="outline">
                        {resource.criticality?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{resourceEnts.length} Rollen</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault();
                            setSelectedResource(resource);
                            resetEntitlementForm();
                            setTimeout(() => setIsEntitlementOpen(true), 10);
                          }}>
                            Berechtigungen verwalten
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive font-bold" 
                            onSelect={(e) => {
                              e.preventDefault();
                              setSelectedResource(resource);
                              setTimeout(() => setIsDeleteDialogOpen(true), 10);
                            }}
                          >
                            Ressource löschen
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

      {/* Create/Edit Resource Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Ressource</DialogTitle>
            <DialogDescription>Registrieren Sie ein neues System im Inventar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Typ</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SaaS">SaaS</SelectItem>
                  <SelectItem value="OnPrem">On-Premises</SelectItem>
                  <SelectItem value="Tool">Internes Werkzeug</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Besitzer</Label>
              <Input value={newOwner} onChange={e => setNewOwner(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">URL</Label>
              <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Kritikalität</Label>
              <Select value={newCriticality} onValueChange={setNewCriticality}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateResource}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Resource Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Ressource löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dies wird die Ressource <strong>{selectedResource?.name}</strong> unwiderruflich aus dem System entfernen. Alle zugehörigen Berechtigungen werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteResource} className="bg-destructive hover:bg-destructive/90">
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Entitlement Management Dialog */}
      <Dialog open={isEntitlementOpen} onOpenChange={setIsEntitlementOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Berechtigungen: {selectedResource?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className={cn(
              "space-y-4 p-4 border rounded-xl transition-colors",
              editingEntitlementId ? "bg-primary/5 border-primary/20" : "bg-accent/5"
            )}>
              <div className="flex items-center justify-between">
                <Label className="font-bold">{editingEntitlementId ? "Rolle bearbeiten" : "Neue Rolle"}</Label>
                {editingEntitlementId && (
                  <Button variant="ghost" size="sm" onClick={resetEntitlementForm} className="h-6 gap-1">
                    <X className="w-3 h-3" /> Abbrechen
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rollenname</Label>
                  <Input value={entName} onChange={e => setEntName(e.target.value)} placeholder="z.B. Administrator" />
                </div>
                <div className="space-y-2">
                  <Label>Risikostufe</Label>
                  <Select value={entRisk} onValueChange={setEntRisk}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="medium">Mittel</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Input value={entDesc} onChange={e => setEntDesc(e.target.value)} placeholder="Zweck der Berechtigung..." />
              </div>
              <Button onClick={handleAddOrUpdateEntitlement} className="w-full">
                {editingEntitlementId ? "Änderungen speichern" : "Hinzufügen"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">Definierte Rollen</Label>
              <div className="border rounded-xl divide-y bg-card max-h-[300px] overflow-y-auto">
                {entitlements?.filter(e => e.resourceId === selectedResource?.id).map(e => (
                  <div key={e.id} className="p-3 flex items-center justify-between group hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield className={cn(
                        "w-4 h-4",
                        e.riskLevel === 'high' ? "text-red-500" : e.riskLevel === 'medium' ? "text-orange-500" : "text-blue-500"
                      )} />
                      <div>
                        <p className="text-sm font-bold">{e.name}</p>
                        <p className="text-[10px] text-muted-foreground">{e.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditingEntitlementId(e.id);
                        setEntName(e.name);
                        setEntRisk(e.riskLevel);
                        setEntDesc(e.description || '');
                      }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        setSelectedEntitlement(e);
                        setIsDeleteEntitlementOpen(true);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Entitlement Confirmation */}
      <AlertDialog open={isDeleteEntitlementOpen} onOpenChange={setIsDeleteEntitlementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Berechtigung entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie die Rolle <strong>{selectedEntitlement?.name}</strong> löschen möchten? Bestehende Zuweisungen an Benutzer könnten dadurch ungültig werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEntitlement(null)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEntitlement} className="bg-destructive hover:bg-destructive/90">
              Löschen bestätigen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
