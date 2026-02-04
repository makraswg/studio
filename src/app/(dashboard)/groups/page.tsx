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
  Clock
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { AssignmentGroup, User, Entitlement, Resource, Tenant } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';

export default function GroupsPage() {
  const db = useFirestore();
  const { dataSource, activeTenantId } = useSettings();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [userSearch, setUserSearch] = useState('');
  const [entitlementSearch, setEntitlementSearch] = useState('');
  
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);

  const { data: groups, isLoading: isGroupsLoading, refresh: refreshGroups } = usePluggableCollection<AssignmentGroup>('groups');
  const { data: users, isLoading: isUsersLoading } = usePluggableCollection<User>('users');
  const { data: entitlements, isLoading: isEntitlementsLoading } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'null' || id === 'undefined') return '—';
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

  const syncGroupAssignments = async (groupId: string, groupName: string, userIds: string[], entIds: string[], gValidFrom: string, gValidUntil: string, tenantId: string) => {
    const currentAssignments = assignments || [];
    const timestamp = new Date().toISOString();
    const today = timestamp.split('T')[0];

    for (const uid of userIds) {
      const user = users?.find(u => u.id === uid);
      for (const eid of entIds) {
        const ent = entitlements?.find(e => e.id === eid);
        const assId = `ga_${groupId}_${uid}_${eid}`.replace(/[^a-zA-Z0-9_]/g, '_');
        const existing = currentAssignments.find(a => a.id === assId);

        if (!existing || existing.status === 'removed' || existing.validFrom !== gValidFrom || existing.validUntil !== gValidUntil) {
          const assignmentData = {
            id: assId,
            userId: uid,
            entitlementId: eid,
            originGroupId: groupId,
            status: 'active',
            grantedBy: authUser?.uid || 'system',
            grantedAt: existing?.grantedAt || timestamp,
            validFrom: gValidFrom || today,
            validUntil: gValidUntil,
            ticketRef: `GRUPPE: ${groupName}`,
            notes: `Auto-zugewiesen via Gruppe: ${groupName}`,
            tenantId: tenantId
          };

          if (dataSource === 'mysql') {
            await saveCollectionRecord('assignments', assId, assignmentData);
          } else {
            setDocumentNonBlocking(doc(db, 'assignments', assId), assignmentData, { merge: true });
          }
        }
      }
    }
  };

  const handleSaveGroup = async () => {
    if (!name) {
      toast({ variant: "destructive", title: "Fehler", description: "Name ist erforderlich." });
      return;
    }

    const groupId = selectedGroup?.id || `grp_${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    const groupData = {
      id: groupId,
      name,
      description,
      validFrom,
      validUntil,
      userIds: selectedUserIds,
      entitlementIds: selectedEntitlementIds,
      tenantId: targetTenantId
    };

    if (dataSource === 'mysql') {
      await saveCollectionRecord('groups', groupId, groupData);
    } else {
      setDocumentNonBlocking(doc(db, 'groups', groupId), groupData, { merge: true });
    }

    await syncGroupAssignments(groupId, name, selectedUserIds, selectedEntitlementIds, validFrom, validUntil, targetTenantId);

    setIsEditOpen(false);
    setIsAddOpen(false);
    toast({ title: selectedGroup ? "Gruppe aktualisiert" : "Gruppe erstellt" });
    resetForm();
    setTimeout(() => { refreshGroups(); refreshAssignments(); }, 200);
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
    setValidFrom(new Date().toISOString().split('T')[0]);
    setValidUntil('');
    setSelectedUserIds([]);
    setSelectedEntitlementIds([]);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zuweisungsgruppen</h1>
          <p className="text-sm text-muted-foreground">Automatisierter Zugriff für Abteilungen und Teams von {activeTenantId === 'all' ? 'allen Standorten' : getTenantSlug(activeTenantId)}.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none shadow-none" onClick={() => { resetForm(); setIsAddOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Neue Gruppe
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
                <TableHead className="font-bold uppercase text-[10px]">Zeitraum</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Mitglieder</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Rollen</TableHead>
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
                        <div className="text-[10px] text-muted-foreground uppercase">{group.description}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[10px] font-bold uppercase text-muted-foreground">{getTenantSlug(group.tenantId)}</TableCell>
                  <TableCell className="text-[10px] font-bold">
                    Ab: {group.validFrom || 'Sofort'}<br/>
                    {group.validUntil && `Bis: ${group.validUntil}`}
                  </TableCell>
                  <TableCell className="text-[10px] font-bold uppercase">
                    <Users className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    {group.userIds?.length || 0}
                  </TableCell>
                  <TableCell className="text-[10px] font-bold uppercase">
                    <Shield className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    {group.entitlementIds?.length || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-none">
                        <DropdownMenuItem onSelect={() => { setSelectedGroup(group); setName(group.name); setDescription(group.description); setValidFrom(group.validFrom); setValidUntil(group.validUntil); setSelectedUserIds(group.userIds); setSelectedEntitlementIds(group.entitlementIds); setIsEditOpen(true); }}>Bearbeiten</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedGroup(group); setIsDeleteOpen(true); }}>Löschen</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && !isGroupsLoading && (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground italic">Keine Gruppen gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(val) => { if(!val) { setIsAddOpen(false); setIsEditOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-4xl rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">{isEditOpen ? 'Gruppe bearbeiten' : 'Neue Gruppe'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Mandant (Scope)</Label>
                <Input value={activeTenantId === 'all' ? 'System Standard (t1)' : getTenantSlug(activeTenantId)} disabled className="rounded-none bg-muted/20" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Hinweis: Mitglieder und Rollen werden im nächsten Schritt basierend auf dem Mandanten {getTenantSlug(activeTenantId)} gefiltert.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleSaveGroup} className="rounded-none font-bold uppercase text-[10px]">Gruppe speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase text-sm">Gruppe löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Dies entfernt die Gruppe und deaktiviert die automatische Zuweisung für alle Mitglieder.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 rounded-none text-xs uppercase font-bold">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
