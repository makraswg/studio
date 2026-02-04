
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
  Workflow, 
  Users, 
  Shield, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil,
  Check,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Layers,
  X,
  ArrowRight,
  ShieldCheck,
  Save as SaveIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  deleteDocumentNonBlocking, 
  setDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AssignmentGroup, User, Entitlement, Resource, Tenant, GroupMemberConfig } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';

export default function GroupsPage() {
  const db = useFirestore();
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [userSearch, setUserSearch] = useState('');
  const [entitlementSearch, setEntitlementSearch] = useState('');
  
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Member States
  const [userConfigs, setUserConfigs] = useState<GroupMemberConfig[]>([]);
  const [entitlementConfigs, setEntitlementConfigs] = useState<GroupMemberConfig[]>([]);

  // Individual Date Prompt State
  const [isDatePromptOpen, setIsDatePromptOpen] = useState(false);
  const [promptContext, setPromptContext] = useState<{ type: 'user' | 'entitlement', id: string, action: 'add' | 'remove' } | null>(null);
  const [tempValidFrom, setPromptValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [tempValidUntil, setPromptValidUntil] = useState<string>('');

  const { data: groups, isLoading: isGroupsLoading, refresh: refreshGroups } = usePluggableCollection<AssignmentGroup>('groups');
  const { data: users, isLoading: isUsersLoading } = usePluggableCollection<User>('users');
  const { data: entitlements, isLoading: isEntitlementsLoading } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { refresh: refreshAssignments } = usePluggableCollection<any>('assignments');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'null' || id === 'undefined' || id === 'all') return 'Global';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    return groups.filter(g => {
      const matchesTenant = activeTenantId === 'all' || g.tenantId === activeTenantId;
      const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
      return matchesTenant && matchesSearch;
    });
  }, [groups, search, activeTenantId]);

  const filteredUsersSelection = useMemo(() => {
    if (!users) return [];
    return users.filter(u => {
      const matchesTenant = activeTenantId === 'all' || u.tenantId === activeTenantId;
      const matchesSearch = u.displayName.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase());
      return matchesTenant && matchesSearch;
    });
  }, [users, userSearch, activeTenantId]);

  const filteredEntitlementsSelection = useMemo(() => {
    if (!entitlements || !resources) return [];
    return entitlements.filter(e => {
      const resource = resources.find(r => r.id === e.resourceId);
      const matchesTenant = activeTenantId === 'all' || resource?.tenantId === activeTenantId || resource?.tenantId === 'global';
      const matchesSearch = e.name.toLowerCase().includes(entitlementSearch.toLowerCase()) || resource?.name.toLowerCase().includes(entitlementSearch.toLowerCase());
      return matchesTenant && matchesSearch;
    });
  }, [entitlements, resources, entitlementSearch, activeTenantId]);

  const syncGroupAssignments = async (groupId: string, groupName: string, uConfigs: GroupMemberConfig[], eConfigs: GroupMemberConfig[], tenantId: string) => {
    const timestamp = new Date().toISOString();

    for (const uc of uConfigs) {
      for (const ec of eConfigs) {
        const assId = `ga_${groupId}_${uc.id}_${ec.id}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
        
        // Regel: Nutze die restriktivere Gültigkeit
        // Gültig ab: Das spätere der beiden Daten
        const effectiveFrom = (uc.validFrom && ec.validFrom) 
          ? (new Date(uc.validFrom) > new Date(ec.validFrom) ? uc.validFrom : ec.validFrom) 
          : (uc.validFrom || ec.validFrom || timestamp.split('T')[0]);
        
        // Gültig bis: Das frühere der beiden Daten (falls vorhanden)
        let effectiveUntil: string | null = null;
        if (uc.validUntil && ec.validUntil) {
          effectiveUntil = new Date(uc.validUntil) < new Date(ec.validUntil) ? uc.validUntil : ec.validUntil;
        } else {
          effectiveUntil = uc.validUntil || ec.validUntil || null;
        }

        // Status bestimmen
        const isCurrentlyRemoved = effectiveUntil && new Date(effectiveUntil) < new Date();

        const assignmentData = {
          id: assId,
          userId: uc.id,
          entitlementId: ec.id,
          originGroupId: groupId,
          status: isCurrentlyRemoved ? 'removed' : 'active',
          grantedBy: authUser?.displayName || 'System',
          grantedAt: timestamp,
          validFrom: effectiveFrom,
          validUntil: effectiveUntil,
          ticketRef: `GRUPPE: ${groupName}`,
          notes: `Automatisierte Zuweisung via Gruppe: ${groupName}`,
          tenantId: tenantId,
          syncSource: 'group'
        };

        if (dataSource === 'mysql') {
          await saveCollectionRecord('assignments', assId, assignmentData);
        } else {
          setDocumentNonBlocking(doc(db, 'assignments', assId), assignmentData, { merge: true });
        }
      }
    }
  };

  const handleSaveGroup = async () => {
    if (!name) {
      toast({ variant: "destructive", title: "Fehler", description: "Gruppenname ist erforderlich." });
      return;
    }

    setIsSaving(true);
    const groupId = selectedGroup?.id || `grp_${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    const groupData = {
      id: groupId,
      name,
      description,
      userConfigs,
      entitlementConfigs,
      tenantId: targetTenantId,
      // Legacy arrays for indexing/searching
      userIds: userConfigs.map(u => u.id),
      entitlementIds: entitlementConfigs.map(e => e.id)
    };

    try {
      if (dataSource === 'mysql') {
        await saveCollectionRecord('groups', groupId, groupData);
      } else {
        setDocumentNonBlocking(doc(db, 'groups', groupId), groupData, { merge: true });
      }

      await syncGroupAssignments(groupId, name, userConfigs, entitlementConfigs, targetTenantId);

      setIsDialogOpen(false);
      toast({ title: selectedGroup ? "Gruppe aktualisiert" : "Gruppe erstellt" });
      resetForm();
      setTimeout(() => { refreshGroups(); refreshAssignments(); }, 300);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (selectedGroup) {
      if (dataSource === 'mysql') {
        await deleteCollectionRecord('groups', selectedGroup.id);
      } else {
        deleteDocumentNonBlocking(doc(db, 'groups', selectedGroup.id));
      }
      setIsDeleteOpen(false);
      toast({ title: "Gruppe gelöscht" });
      setTimeout(() => { refreshGroups(); refreshAssignments(); }, 200);
    }
  };

  const resetForm = () => {
    setSelectedGroup(null);
    setName('');
    setDescription('');
    setUserConfigs([]);
    setEntitlementConfigs([]);
    setUserSearch('');
    setEntitlementSearch('');
  };

  const openEdit = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setName(group.name);
    setDescription(group.description || '');
    setUserConfigs(group.userConfigs || []);
    setEntitlementConfigs(group.entitlementConfigs || []);
    setIsDialogOpen(true);
  };

  const handleToggleItem = (type: 'user' | 'entitlement', id: string) => {
    const list = type === 'user' ? userConfigs : entitlementConfigs;
    const isAlreadySelected = list.some(item => item.id === id);
    
    setPromptContext({ type, id, action: isAlreadySelected ? 'remove' : 'add' });
    setPromptValidFrom(new Date().toISOString().split('T')[0]);
    
    if (isAlreadySelected) {
      const existing = list.find(item => item.id === id);
      setPromptValidUntil(existing?.validUntil || new Date().toISOString().split('T')[0]);
    } else {
      setPromptValidUntil('');
    }
    
    setIsDatePromptOpen(true);
  };

  const confirmDatePrompt = () => {
    if (!promptContext) return;
    const { type, id, action } = promptContext;
    const list = type === 'user' ? userConfigs : entitlementConfigs;
    const setList = type === 'user' ? setUserConfigs : setEntitlementConfigs;

    if (action === 'add') {
      const newConfig: GroupMemberConfig = {
        id,
        validFrom: tempValidFrom,
        validUntil: tempValidUntil || null
      };
      setList([...list, newConfig]);
    } else {
      if (!tempValidUntil) {
        setList(list.filter(item => item.id !== id));
      } else {
        setList(list.map(item => item.id === id ? { ...item, validUntil: tempValidUntil } : item));
      }
    }

    setIsDatePromptOpen(false);
    setPromptContext(null);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zuweisungsgruppen</h1>
          <p className="text-sm text-muted-foreground">Regelbasierte Berechtigungen für Abteilungen oder Teams.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none shadow-none" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Gruppe erstellen
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Gruppen suchen..." 
          className="pl-10 h-10 shadow-none border-border rounded-none bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isGroupsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Lade Gruppen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase text-[10px]">Gruppe</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Besetzung</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Berechtigungen</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <TableRow key={group.id} className="group hover:bg-muted/5 border-b">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 text-primary flex items-center justify-center"><Workflow className="w-5 h-5" /></div>
                      <div>
                        <div className="font-bold text-sm">{group.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase truncate max-w-[200px]">{group.description || 'Keine Beschreibung'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[8px] font-bold uppercase rounded-none">{getTenantSlug(group.tenantId)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      {group.userConfigs?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Shield className="w-3 h-3 text-muted-foreground" />
                      {group.entitlementConfigs?.length || 0}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-none">
                        <DropdownMenuItem onSelect={() => openEdit(group)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedGroup(group); setIsDeleteOpen(true); }}><Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && !isGroupsLoading && (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground italic">Keine Zuweisungsgruppen gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl rounded-none h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Workflow className="w-4 h-4 text-primary" />
              {selectedGroup ? 'Gruppe bearbeiten' : 'Neue Zuweisungsgruppe'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name der Gruppe</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. IT-Abteilung Kernteam" className="rounded-none h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Zweck der Gruppe..." className="rounded-none h-10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t">
                {/* Benutzer-Auswahl */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> 1. Mitglieder wählen ({userConfigs.length})
                    </Label>
                    <div className="relative w-48">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input 
                        placeholder="Nutzer suchen..." 
                        value={userSearch} 
                        onChange={e => setUserSearch(e.target.value)} 
                        className="h-7 pl-7 text-[10px] rounded-none" 
                      />
                    </div>
                  </div>
                  <div className="border rounded-none h-[450px] overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1 bg-muted/5">
                      <div className="p-2 space-y-1">
                        {filteredUsersSelection.map(u => {
                          const config = userConfigs.find(c => c.id === u.id);
                          const isSelected = !!config;
                          return (
                            <div 
                              key={u.id} 
                              className={cn(
                                "flex items-center gap-3 p-2 cursor-pointer transition-colors text-xs border border-transparent",
                                isSelected ? "bg-primary/10 border-primary/20" : "hover:bg-muted"
                              )}
                              onClick={() => handleToggleItem('user', u.id)}
                            >
                              <Checkbox checked={isSelected} className="rounded-none pointer-events-none" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{u.displayName}</p>
                                {config && (
                                  <p className="text-[8px] text-primary font-bold uppercase mt-0.5">
                                    {config.validFrom} {config.validUntil ? `→ ${config.validUntil}` : ' (Unbefristet)'}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Rollen-Auswahl */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-primary flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5" /> 2. Rollen zuweisen ({entitlementConfigs.length})
                    </Label>
                    <div className="relative w-48">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input 
                        placeholder="Rolle suchen..." 
                        value={entitlementSearch} 
                        onChange={e => setEntitlementSearch(e.target.value)} 
                        className="h-7 pl-7 text-[10px] rounded-none" 
                      />
                    </div>
                  </div>
                  <div className="border rounded-none h-[450px] overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1 bg-muted/5">
                      <div className="p-2 space-y-1">
                        {filteredEntitlementsSelection.map(e => {
                          const res = resources?.find(r => r.id === e.resourceId);
                          const config = entitlementConfigs.find(c => c.id === e.id);
                          const isSelected = !!config;
                          return (
                            <div 
                              key={e.id} 
                              className={cn(
                                "flex items-center gap-3 p-2 cursor-pointer transition-colors text-xs border border-transparent",
                                isSelected ? "bg-emerald-50 border-emerald-200" : "hover:bg-muted"
                              )}
                              onClick={() => handleToggleItem('entitlement', e.id)}
                            >
                              <Checkbox 
                                checked={isSelected} 
                                className="rounded-none pointer-events-none data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" 
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold truncate">{e.name}</p>
                                <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-1">
                                  <Layers className="w-2 h-2" /> {res?.name || 'System'}
                                </p>
                                {config && (
                                  <p className="text-[8px] text-emerald-600 font-bold uppercase mt-0.5">
                                    {config.validFrom} {config.validUntil ? `→ ${config.validUntil}` : ' (Unbefristet)'}
                                  </p>
                                )}
                              </div>
                              {e.isAdmin && <Shield className="w-3 h-3 text-red-600" />}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-slate-50 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-none h-10 px-8">Abbrechen</Button>
            <Button 
              onClick={handleSaveGroup} 
              disabled={isSaving || !name || userConfigs.length === 0 || entitlementConfigs.length === 0} 
              className="rounded-none h-10 px-10 font-bold uppercase text-[10px] gap-2"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />}
              Gruppe & Zuweisungen speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item-Level Date Prompt */}
      <Dialog open={isDatePromptOpen} onOpenChange={setIsDatePromptOpen}>
        <DialogContent className="max-w-sm rounded-none border-2">
          <DialogHeader>
            <DialogTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {promptContext?.action === 'add' ? 'Gültigkeit festlegen' : 'Entfernung bestätigen'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {promptContext?.action === 'add' 
                ? 'Ab wann soll dieses Element der Gruppe hinzugefügt werden?' 
                : 'Bis wann soll dieses Element noch gültig sein? (Leer lassen für sofortigen Entzug)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {promptContext?.action === 'add' && (
              <div className="space-y-2">
                <Label className="text-[9px] font-bold uppercase">Gültig ab</Label>
                <Input type="date" value={tempValidFrom} onChange={e => setPromptValidFrom(e.target.value)} className="rounded-none h-9" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-[9px] font-bold uppercase">{promptContext?.action === 'add' ? 'Freigabe bis (Optional)' : 'Gültig bis'}</Label>
              <Input type="date" value={tempValidUntil} onChange={e => setPromptValidUntil(e.target.value)} className="rounded-none h-9" />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsDatePromptOpen(false)} className="rounded-none h-9 flex-1 text-[10px] font-bold uppercase">Abbrechen</Button>
            <Button onClick={confirmDatePrompt} className="rounded-none h-9 flex-1 text-[10px] font-bold uppercase gap-2">
              {promptContext?.action === 'add' ? <Plus className="w-3 h-3" /> : <X className="w-3 h-3" />}
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-none border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Gruppe permanent löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              Dies entfernt die Zuweisungsgruppe **{selectedGroup?.name}**. 
              <br/><br/>
              **Achtung:** Existierende Einzelzuweisungen, die durch diese Gruppe erstellt wurden, bleiben im System erhalten, verlieren aber ihre Verknüpfung zur Gruppe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none uppercase text-[10px] font-bold">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700 rounded-none text-[10px] font-bold uppercase">Gruppe löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
