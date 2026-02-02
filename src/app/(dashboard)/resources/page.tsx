
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
  Trash2
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
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function ResourcesPage() {
  const db = useFirestore();
  const { user: authUser } = useUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEntitlementOpen, setIsEntitlementOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);

  // Resource Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('SaaS');
  const [newOwner, setNewOwner] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCriticality, setNewCriticality] = useState('medium');
  const [newNotes, setNewNotes] = useState('');

  // Entitlement Form State
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

    const resourceData = {
      name: newName,
      type: newType,
      owner: newOwner,
      url: newUrl,
      criticality: newCriticality,
      notes: newNotes,
      createdAt: new Date().toISOString()
    };

    addDocumentNonBlocking(collection(db, 'resources'), resourceData);
    setIsCreateOpen(false);
    toast({ title: "Ressource hinzugefügt", description: `${newName} erfolgreich katalogisiert.` });
    setNewName('');
    setNewOwner('');
    setNewUrl('');
  };

  const handleAddEntitlement = () => {
    if (!entName || !selectedResource) return;

    const entData = {
      resourceId: selectedResource.id,
      name: entName,
      riskLevel: entRisk,
      description: entDesc,
    };

    addDocumentNonBlocking(collection(db, 'entitlements'), entData);
    setEntName('');
    setEntDesc('');
    toast({ title: "Berechtigung hinzugefügt", description: `Die Rolle "${entName}" wurde für ${selectedResource.name} definiert.` });
  };

  const filteredResources = resources?.filter(res => 
    res.name.toLowerCase().includes(search.toLowerCase()) ||
    res.owner.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ressourcenkatalog</h1>
          <p className="text-muted-foreground mt-1">Dokumentation von Systemen, Anwendungen und internen Werkzeugen.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary gap-2 h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="w-5 h-5" /> Ressource hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Neue Ressource hinzufügen</DialogTitle>
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
              <Button onClick={handleCreateResource}>Ressource speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Ressourcen suchen..." 
            className="pl-10 h-11 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px] py-4">Ressource</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kritikalität</TableHead>
                <TableHead>Rollen</TableHead>
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
                            {resource.url && <a href={resource.url} target="_blank" className="text-muted-foreground hover:text-primary" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">{resource.owner}</div>
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
                      <Badge variant="outline" className="font-bold">{resourceEnts.length} Berechtigungen</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="font-bold" 
                            onSelect={(e) => {
                              e.preventDefault();
                              setSelectedResource(resource);
                              setIsEntitlementOpen(true);
                            }}
                          >
                            Berechtigungen verwalten
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive font-bold" onClick={() => deleteDocumentNonBlocking(doc(db, 'resources', resource.id))}>
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

      <Dialog open={isEntitlementOpen} onOpenChange={setIsEntitlementOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Berechtigungen verwalten: {selectedResource?.name}</DialogTitle>
            <DialogDescription>Definieren Sie Zugriffsebenen und Rollen für diese Ressource.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4 p-4 border rounded-xl bg-accent/5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rollenname</Label>
                  <Input value={entName} onChange={e => setEntName(e.target.value)} placeholder="z.B. Nur Lesen" />
                </div>
                <div className="space-y-2">
                  <Label>Risikostufe</Label>
                  <Select value={entRisk} onValueChange={entRisk}>
                    <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Input value={entDesc} onChange={e => setEntDesc(e.target.value)} placeholder="Berechtigungen beschreiben..." />
              </div>
              <Button onClick={handleAddEntitlement} className="w-full">Berechtigung hinzufügen</Button>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">Vorhandene Berechtigungen</Label>
              <div className="border rounded-xl divide-y bg-card max-h-[300px] overflow-y-auto">
                {entitlements?.filter(e => e.resourceId === selectedResource?.id).map(e => (
                  <div key={e.id} className="p-3 flex items-center justify-between group">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'entitlements', e.id))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {entitlements?.filter(e => e.resourceId === selectedResource?.id).length === 0 && (
                  <p className="p-6 text-center text-xs text-muted-foreground">Noch keine Berechtigungen definiert.</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
