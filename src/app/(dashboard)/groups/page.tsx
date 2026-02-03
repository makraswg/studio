
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
  Workflow, 
  Users, 
  Shield, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil,
  Check,
  AlertTriangle,
  History,
  X
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
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  deleteDocumentNonBlocking, 
  setDocumentNonBlocking
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AssignmentGroup, User, Entitlement, Resource } from '@/lib/types';

export default function GroupsPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  // Dialog States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Form State
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);

  const { data: groups, isLoading } = usePluggableCollection<AssignmentGroup>('groups');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: assignments } = usePluggableCollection('assignments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncGroupAssignments = (groupId: string, groupName: string, userIds: string[], entIds: string[]) => {
    if (!assignments) return;

    // 1. New/Existing assignments: All users in the group should have all group entitlements
    userIds.forEach(uid => {
      entIds.forEach(eid => {
        const existing = assignments.find(a => 
          a.userId === uid && 
          a.entitlementId === eid && 
          a.originGroupId === groupId
        );

        if (!existing) {
          const assId = `ga-${groupId}-${uid}-${eid}`.substring(0, 20);
          setDocumentNonBlocking(doc(db, 'assignments', assId), {
            id: assId,
            userId: uid,
            entitlementId: eid,
            originGroupId: groupId,
            status: 'active',
            grantedBy: 'system',
            grantedAt: new Date().toISOString(),
            ticketRef: `GRUPPE: ${groupName}`,
            notes: `Auto-zugewiesen via Gruppe: ${groupName}`,
            tenantId: 't1'
          });
        }
      });
    });

    // 2. Cleanup: Remove assignments that are no longer part of this group (user or role removed)
    const currentGroupAssignments = assignments.filter(a => a.originGroupId === groupId);
    currentGroupAssignments.forEach(a => {
      const userStillInGroup = userIds.includes(a.userId);
      const entStillInGroup = entIds.includes(a.entitlementId);

      if (!userStillInGroup || !entStillInGroup) {
        deleteDocumentNonBlocking(doc(db, 'assignments', a.id));
      }
    });
  };

  const handleSaveGroup = () => {
    if (!name) {
      toast({ variant: "destructive", title: "Fehler", description: "Name ist erforderlich." });
      return;
    }

    const groupId = selectedGroup?.id || `grp-${Math.random().toString(36).substring(2, 9)}`;
    const groupData = {
      id: groupId,
      name,
      description,
      userIds: selectedUserIds,
      entitlementIds: selectedEntitlementIds,
      tenantId: 't1'
    };

    setDocumentNonBlocking(doc(db, 'groups', groupId), groupData);
    syncGroupAssignments(groupId, name, selectedUserIds, selectedEntitlementIds);

    setIsEditOpen(false);
    setIsAddOpen(false);
    toast({ title: selectedGroup ? "Gruppe aktualisiert" : "Gruppe erstellt" });
    resetForm();
  };

  const handleDeleteGroup = () => {
    if (selectedGroup) {
      deleteDocumentNonBlocking(doc(db, 'groups', selectedGroup.id));
      // Cleanup all assignments from this group
      assignments?.filter(a => a.originGroupId === selectedGroup.id).forEach(a => {
        deleteDocumentNonBlocking(doc(db, 'assignments', a.id));
      });
      setIsDeleteOpen(false);
      toast({ title: "Gruppe gelöscht" });
      resetForm();
    }
  };

  const openEdit = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setName(group.name);
    setDescription(group.description || '');
    setSelectedUserIds(group.userIds || []);
    setSelectedEntitlementIds(group.entitlementIds || []);
    setTimeout(() => setIsEditOpen(true), 150);
  };

  const openDelete = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setTimeout(() => setIsDeleteOpen(true), 150);
  };

  const resetForm = () => {
    setSelectedGroup(null);
    setName('');
    setDescription('');
    setSelectedUserIds([]);
    setSelectedEntitlementIds([]);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleEntitlement = (entId: string) => {
    setSelectedEntitlementIds(prev => 
      prev.includes(entId) ? prev.filter(id => id !== entId) : [...prev, entId]
    );
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zuweisungsgruppen</h1>
          <p className="text-sm text-muted-foreground">Strukturieren und automatisieren Sie den Zugriff für Teams.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { resetForm(); setIsAddOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Neue Gruppe
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Gruppen suchen..." 
          className="pl-10 h-10 shadow-none border-border rounded-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Lade Gruppen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Gruppe</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Beschreibung</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Mitglieder</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Rollen</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups?.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map((group) => (
                <TableRow key={group.id} className="group transition-colors hover:bg-muted/5 border-b">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Workflow className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-sm">{group.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                    {group.description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {(group.members != undefined) ? group.members : (group.userIds?.length || 0)} Personen
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      {group.entitlementIds?.length || 0} Rollen
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
                        <DropdownMenuItem onSelect={() => openEdit(group)}>
                          <Pencil className="w-4 h-4 mr-2" /> Bearbeiten & Mitglieder
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => openDelete(group)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Gruppe löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {groups?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <History className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Keine Zuweisungsgruppen vorhanden.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit/Add Group Dialog */}
      <Dialog open={isEditOpen || isAddOpen} onOpenChange={(val) => { if(!val) { setIsEditOpen(false); setIsAddOpen(false); } }}>
        <DialogContent className="max-w-4xl rounded-none border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">
              {isEditOpen ? 'Gruppe bearbeiten' : 'Neue Gruppe erstellen'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verwalten Sie Stammdaten und die automatische Rollenverteilung.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            {/* Stammdaten */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gruppenname</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="rounded-none h-10" placeholder="z.B. Marketing Team" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} className="rounded-none h-10" placeholder="Zweck dieser Gruppe..." />
              </div>

              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Rollen für diese Gruppe
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar border bg-slate-50/50 p-2">
                  {entitlements?.map(e => {
                    const res = resources?.find(r => r.id === e.resourceId);
                    const isSelected = selectedEntitlementIds.includes(e.id);
                    return (
                      <div 
                        key={e.id} 
                        className={cn(
                          "flex items-center justify-between p-2 text-[10px] border cursor-pointer hover:bg-muted transition-colors",
                          isSelected ? "border-blue-200 bg-blue-50" : "border-transparent bg-white"
                        )}
                        onClick={() => toggleEntitlement(e.id)}
                      >
                        <div className="flex flex-col truncate">
                          <span className="font-bold uppercase tracking-tighter">{res?.name}</span>
                          <span className="text-muted-foreground truncate">{e.name}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-blue-600 shrink-0 ml-2" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mitglieder */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Mitglieder (Benutzer)
                </span>
                <Badge variant="outline" className="text-[9px] rounded-none">{selectedUserIds.length} gewählt</Badge>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1 custom-scrollbar border bg-slate-50/50 p-2">
                {users?.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  const displayName = u.name || u.displayName;
                  const department = u.department || 'Keine Abteilung';
                  return (
                    <div 
                      key={u.id} 
                      className={cn(
                        "flex items-center justify-between p-2.5 text-xs border cursor-pointer hover:bg-muted transition-colors",
                        isSelected ? "border-blue-200 bg-blue-50" : "border-transparent bg-white"
                      )}
                      onClick={() => toggleUser(u.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-slate-100 flex items-center justify-center text-[10px] font-bold">{displayName.charAt(0)}</div>
                        <div className="flex flex-col">
                          <span className="font-bold">{displayName}</span>
                          <span className="text-[9px] text-muted-foreground uppercase">{department}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" className="rounded-none h-11" onClick={() => { setIsEditOpen(false); setIsAddOpen(false); }}>Abbrechen</Button>
            <Button onClick={handleSaveGroup} className="h-11 rounded-none font-bold uppercase text-xs px-8">
              {isEditOpen ? 'Änderungen speichern' : 'Gruppe anlegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-bold uppercase text-sm">
              <AlertTriangle className="w-5 h-5" /> Gruppe löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Dies löscht die Gruppe "{selectedGroup?.name}". Alle automatischen Zuweisungen, die durch diese Gruppe entstanden sind, werden ebenfalls sofort entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs">Unwiderruflich löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
