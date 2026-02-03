
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
  CheckCircle2,
  X,
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
import { AssignmentGroup, User, Entitlement, Resource } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';

export default function GroupsPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  // Dialog States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  // Form Selection Search
  const [userSearch, setUserSearch] = useState('');
  const [entitlementSearch, setEntitlementSearch] = useState('');
  
  // Form State
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncGroupAssignments = async (groupId: string, groupName: string, userIds: string[], entIds: string[], gValidFrom: string, gValidUntil: string) => {
    const currentAssignments = assignments || [];
    const timestamp = new Date().toISOString();
    const today = timestamp.split('T')[0];

    // 1. Create or update assignments for group members
    for (const uid of userIds) {
      const user = users?.find(u => u.id === uid);
      for (const eid of entIds) {
        const ent = entitlements?.find(e => e.id === eid);
        const res = resources?.find(r => r.id === ent?.resourceId);
        
        // Create deterministic ID for the user-entitlement pair within this group
        const assId = `ga_${groupId}_${uid}_${eid}`.replace(/[^a-zA-Z0-9_]/g, '_');
        const existing = currentAssignments.find(a => a.id === assId);

        // Update if not existing, or if validity/status has changed
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
            tenantId: 't1'
          };

          const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
          const auditData = {
            id: auditId,
            actorUid: authUser?.uid || 'system',
            action: `Zuweisung [${ent?.name}] für [${user?.displayName || uid}] via Gruppe [${groupName}] ${existing ? 'aktualisiert' : 'erstellt'}`,
            entityType: 'assignment',
            entityId: assId,
            timestamp,
            tenantId: 't1',
            before: existing || null,
            after: assignmentData
          };

          if (dataSource === 'mysql') {
            await saveCollectionRecord('assignments', assId, assignmentData);
            await saveCollectionRecord('auditEvents', auditId, auditData);
          } else {
            setDocumentNonBlocking(doc(db, 'assignments', assId), assignmentData, { merge: true });
            addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
          }
        }
      }
    }

    // 2. Remove orphaned assignments (users or roles no longer in the group)
    const currentGroupAssignments = currentAssignments.filter(a => a.originGroupId === groupId);
    for (const a of currentGroupAssignments) {
      const userStillInGroup = userIds.includes(a.userId);
      const entStillInGroup = entIds.includes(a.entitlementId);

      if ((!userStillInGroup || !entStillInGroup) && a.status !== 'removed') {
        const user = users?.find(u => u.id === a.userId);
        const ent = entitlements?.find(e => e.id === a.entitlementId);
        
        const updatedAssignment = { 
          ...a, 
          status: 'removed',
          notes: `${a.notes || ''} [Entfernt via Gruppen-Sync ${today}]`.trim()
        };
        
        const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
        const auditData = {
          id: auditId,
          actorUid: authUser?.uid || 'system',
          action: `Zuweisung [${ent?.name}] für [${user?.displayName || a.userId}] via Gruppen-Sync [${groupName}] entfernt`,
          entityType: 'assignment',
          entityId: a.id,
          timestamp,
          tenantId: 't1',
          before: a,
          after: updatedAssignment
        };

        if (dataSource === 'mysql') {
          await saveCollectionRecord('assignments', a.id, updatedAssignment);
          await saveCollectionRecord('auditEvents', auditId, auditData);
        } else {
          setDocumentNonBlocking(doc(db, 'assignments', a.id), { 
            status: 'removed',
            notes: `${a.notes || ''} [Entfernt via Gruppen-Sync ${today}]`
          }, { merge: true });
          addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
        }
      }
    }
  };

  const handleSaveGroup = async () => {
    if (!name) {
      toast({ variant: "destructive", title: "Fehler", description: "Name ist erforderlich." });
      return;
    }

    // DUPLICATE CHECK: Verhindern, dass Gruppen Rollen zuweisen, die Nutzer bereits besitzen
    const conflicts: string[] = [];
    const currentAssignments = assignments || [];
    const currentGroupId = selectedGroup?.id || 'NEW_GROUP';

    for (const uid of selectedUserIds) {
      const user = users?.find(u => u.id === uid);
      const userName = user?.displayName || user?.name || uid;
      
      for (const eid of selectedEntitlementIds) {
        const ent = entitlements?.find(e => e.id === eid);
        const res = resources?.find(r => r.id === ent?.resourceId);
        const roleName = `${res?.name || 'Unbekannt'} - ${ent?.name || 'Unbekannte Rolle'}`;

        // Wir suchen nach aktiven Zuweisungen für diesen Nutzer und diese Rolle,
        // die NICHT aus der aktuell bearbeiteten Gruppe stammen.
        const existing = currentAssignments.find(a => 
          a.userId === uid && 
          a.entitlementId === eid && 
          a.status === 'active' &&
          a.originGroupId !== currentGroupId
        );

        if (existing) {
          conflicts.push(`${userName} besitzt bereits [${roleName}]`);
        }
      }
    }

    if (conflicts.length > 0) {
      toast({ 
        variant: "destructive", 
        title: "Speichern nicht möglich", 
        description: `Es wurden Zuweisungskonflikte gefunden: ${conflicts.slice(0, 2).join(', ')}${conflicts.length > 2 ? ` (+${conflicts.length - 2} weitere)` : ''}. Bitte entfernen Sie die betroffenen Nutzer oder Rollen aus der Gruppe.`
      });
      return;
    }

    const groupId = selectedGroup?.id || `grp_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const groupData = {
      id: groupId,
      name,
      description,
      validFrom,
      validUntil,
      userIds: selectedUserIds,
      entitlementIds: selectedEntitlementIds,
      tenantId: 't1'
    };

    const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
    const auditData = {
      id: auditId,
      actorUid: authUser?.uid || 'system',
      action: selectedGroup 
        ? `Zuweisungsgruppe [${name}] aktualisiert (${selectedUserIds.length} Mitglieder, ${selectedEntitlementIds.length} Rollen)`
        : `Zuweisungsgruppe [${name}] erstellt (${selectedUserIds.length} Mitglieder, ${selectedEntitlementIds.length} Rollen)`,
      entityType: 'group',
      entityId: groupId,
      timestamp,
      tenantId: 't1',
      before: selectedGroup || null,
      after: groupData
    };

    if (dataSource === 'mysql') {
      const result = await saveCollectionRecord('groups', groupId, groupData);
      if (!result.success) {
        toast({ variant: "destructive", title: "Fehler", description: result.error });
        return;
      }
      await saveCollectionRecord('auditEvents', auditId, auditData);
    } else {
      setDocumentNonBlocking(doc(db, 'groups', groupId), groupData, { merge: true });
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    // Synergize with assignments table and create individual audits
    await syncGroupAssignments(groupId, name, selectedUserIds, selectedEntitlementIds, validFrom, validUntil);

    setIsEditOpen(false);
    setIsAddOpen(false);
    toast({ title: selectedGroup ? "Gruppe aktualisiert" : "Gruppe erstellt" });
    resetForm();
    
    setTimeout(() => {
      refreshGroups();
      refreshAssignments();
    }, 200);
  };

  const handleDeleteGroup = async () => {
    if (selectedGroup) {
      const timestamp = new Date().toISOString();
      const today = timestamp.split('T')[0];
      
      const groupAuditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
      const groupAuditData = {
        id: groupAuditId,
        actorUid: authUser?.uid || 'system',
        action: `Zuweisungsgruppe [${selectedGroup.name}] gelöscht (alle Zuweisungen einzeln entzogen)`,
        entityType: 'group',
        entityId: selectedGroup.id,
        timestamp,
        tenantId: 't1',
        before: selectedGroup
      };

      if (dataSource === 'mysql') {
        await deleteCollectionRecord('groups', selectedGroup.id);
        await saveCollectionRecord('auditEvents', groupAuditId, groupAuditData);
      } else {
        deleteDocumentNonBlocking(doc(db, 'groups', selectedGroup.id));
        addDocumentNonBlocking(collection(db, 'auditEvents'), groupAuditData);
      }

      // Soft delete and audit all group assignments individually
      const groupAssignments = assignments?.filter(a => a.originGroupId === selectedGroup.id) || [];
      for (const a of groupAssignments) {
        if (a.status !== 'removed') {
          const user = users?.find(u => u.id === a.userId);
          const ent = entitlements?.find(e => e.id === a.entitlementId);
          
          const updatedAssignment = { ...a, status: 'removed', validUntil: today };
          const assAuditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
          const assAuditData = {
            id: assAuditId,
            actorUid: authUser?.uid || 'system',
            action: `Zuweisung [${ent?.name}] für [${user?.displayName || a.userId}] via Gruppen-Löschung [${selectedGroup.name}] entfernt`,
            entityType: 'assignment',
            entityId: a.id,
            timestamp,
            tenantId: 't1',
            before: a,
            after: updatedAssignment
          };

          if (dataSource === 'mysql') {
            await saveCollectionRecord('assignments', a.id, updatedAssignment);
            await saveCollectionRecord('auditEvents', assAuditId, assAuditData);
          } else {
            setDocumentNonBlocking(doc(db, 'assignments', a.id), { status: 'removed', validUntil: today }, { merge: true });
            addDocumentNonBlocking(collection(db, 'auditEvents'), assAuditData);
          }
        }
      }
      
      setIsDeleteOpen(false);
      toast({ title: "Gruppe gelöscht" });
      resetForm();
      
      setTimeout(() => {
        refreshGroups();
        refreshAssignments();
      }, 200);
    }
  };

  const openEdit = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setName(group.name);
    setDescription(group.description || '');
    setValidFrom(group.validFrom || new Date().toISOString().split('T')[0]);
    setValidUntil(group.validUntil || '');
    setSelectedUserIds(Array.isArray(group.userIds) ? [...group.userIds] : []);
    setSelectedEntitlementIds(Array.isArray(group.entitlementIds) ? [...group.entitlementIds] : []);
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
    setValidFrom(new Date().toISOString().split('T')[0]);
    setValidUntil('');
    setSelectedUserIds([]);
    setSelectedEntitlementIds([]);
    setUserSearch('');
    setEntitlementSearch('');
  };

  const toggleUser = (userId: string) => {
    if (!userId) return;
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleEntitlement = (entId: string) => {
    if (!entId) return;
    setSelectedEntitlementIds(prev => 
      prev.includes(entId) ? prev.filter(id => id !== entId) : [...prev, entId]
    );
  };

  if (!mounted) return null;

  const filteredRoles = entitlements?.filter(e => {
    const res = resources?.find(r => r.id === e.resourceId);
    const term = entitlementSearch.toLowerCase();
    const entName = e.name || '';
    const resName = res?.name || '';
    return entName.toLowerCase().includes(term) || resName.toLowerCase().includes(term);
  }) || [];

  const filteredMembers = users?.filter(u => {
    const term = userSearch.toLowerCase();
    const displayName = u.displayName || u.name || '';
    const email = u.email || '';
    return displayName.toLowerCase().includes(term) || email.toLowerCase().includes(term);
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zuweisungsgruppen</h1>
          <p className="text-sm text-muted-foreground">Automatisierter Zugriff für Abteilungen und Teams ({dataSource.toUpperCase()}).</p>
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
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Gruppe</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Zeitraum</TableHead>
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
                      <div className="w-9 h-9 bg-primary/10 text-primary flex items-center justify-center">
                        <Workflow className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{group.name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase truncate max-w-[200px]">{group.description || 'Keine Beschreibung'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-[10px] font-bold uppercase">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3 h-3" /> Ab: {group.validFrom || 'Sofort'}
                      </div>
                      {group.validUntil ? (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar className="w-3 h-3" /> Bis: {group.validUntil}
                        </div>
                      ) : (
                        <div className="text-muted-foreground italic">Unbefristet</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {Array.isArray(group.userIds) ? group.userIds.length : 0} Personen
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-600">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      {Array.isArray(group.entitlementIds) ? group.entitlementIds.length : 0} Rollen
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-muted">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-1 shadow-xl rounded-none border-border">
                        <DropdownMenuItem onSelect={() => openEdit(group)}>
                          <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => openDelete(group)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isEditOpen || isAddOpen} onOpenChange={(val) => { if(!val) { setIsEditOpen(false); setIsAddOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-4xl rounded-none border shadow-2xl bg-white p-0 overflow-hidden flex flex-col min-h-[600px]">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-4 h-4 text-primary" />
              {isEditOpen ? 'Gruppe bearbeiten' : 'Neue Gruppe erstellen'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Automatisierte Rollenverteilung basierend auf Gruppenzugehörigkeit.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="general" className="w-full flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start rounded-none bg-muted/50 border-b h-12 p-0 px-6 gap-6 shrink-0">
              <TabsTrigger value="general" className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-[10px] font-bold uppercase">1. Allgemein</TabsTrigger>
              <TabsTrigger value="roles" className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-[10px] font-bold uppercase">2. Rollen ({selectedEntitlementIds.length})</TabsTrigger>
              <TabsTrigger value="members" className="h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-[10px] font-bold uppercase">3. Mitglieder ({selectedUserIds.length})</TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0">
              <TabsContent value="general" className="p-6 space-y-4 m-0">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gruppenname</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="rounded-none h-10 shadow-none" placeholder="z.B. Marketing Team" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} className="rounded-none h-10 shadow-none" placeholder="Zweck dieser Gruppe..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3" /> Gültig ab (Standard)</Label>
                    <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Freigabe bis (Standard)</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none h-10" />
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 text-[10px] text-blue-700 uppercase font-bold leading-relaxed mt-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p>Hinweis: Die gewählten Zeiträume werden auf alle generierten Zuweisungen übertragen. Änderungen an der Gruppe synchronisieren die Termine aller Mitglieder automatisch nach und werden einzeln protokolliert.</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="roles" className="p-6 space-y-4 m-0 flex flex-col">
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Rollen oder Systeme filtern..." 
                    className="pl-9 h-10 text-[11px] rounded-none bg-muted/20 border-none shadow-none"
                    value={entitlementSearch}
                    onChange={e => setEntitlementSearch(e.target.value)}
                  />
                </div>
                <div className="h-[400px] overflow-y-auto border bg-slate-50/50 p-2 custom-scrollbar">
                  {isEntitlementsLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : filteredRoles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1">
                      {filteredRoles.map(e => {
                        const res = resources?.find(r => r.id === e.resourceId);
                        const isSelected = selectedEntitlementIds.includes(e.id);
                        return (
                          <div 
                            key={e.id} 
                            className={cn(
                              "flex items-center justify-between p-2 text-[10px] border cursor-pointer hover:bg-muted transition-colors",
                              isSelected ? "border-primary/30 bg-primary/5" : "border-transparent bg-white"
                            )}
                            onClick={() => toggleEntitlement(e.id)}
                          >
                            <div className="flex flex-col truncate">
                              <span className="font-bold uppercase tracking-tighter text-slate-800">{res?.name || 'System'}</span>
                              <span className="text-muted-foreground truncate">{e.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSelected && <Badge className="bg-primary text-white rounded-none text-[8px] h-4">GEWÄHLT</Badge>}
                              <div className={cn("w-4 h-4 border flex items-center justify-center", isSelected ? "bg-primary border-primary" : "bg-white")}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Shield className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase">Keine Rollen gefunden</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="members" className="p-6 space-y-4 m-0 flex flex-col">
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Mitarbeiter suchen..." 
                    className="pl-9 h-10 text-[11px] rounded-none bg-muted/20 border-none shadow-none"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
                <div className="h-[400px] overflow-y-auto border bg-slate-50/50 p-2 custom-scrollbar">
                  {isUsersLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : filteredMembers.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1">
                      {filteredMembers.map(u => {
                        const isSelected = selectedUserIds.includes(u.id);
                        const displayName = u.displayName || u.name || 'Unbekannter Benutzer';
                        return (
                          <div 
                            key={u.id} 
                            className={cn(
                              "flex items-center justify-between p-2 text-[10px] border cursor-pointer hover:bg-muted transition-colors",
                              isSelected ? "border-primary/30 bg-primary/5" : "border-transparent bg-white"
                            )}
                            onClick={() => toggleUser(u.id)}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-6 h-6 bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase shrink-0">{displayName.charAt(0)}</div>
                              <div className="flex flex-col truncate">
                                <span className="font-bold text-slate-800">{displayName}</span>
                                <span className="text-muted-foreground uppercase text-[8px]">{u.department || 'Keine Abteilung'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isSelected && <Badge className="bg-primary text-white rounded-none text-[8px] h-4">AKTIV</Badge>}
                              <div className={cn("w-4 h-4 border flex items-center justify-center", isSelected ? "bg-primary border-primary" : "bg-white")}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Users className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase">Keine Mitarbeiter gefunden</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between shrink-0">
            <div className="text-[9px] font-bold text-muted-foreground uppercase">
              {selectedUserIds.length} Mitglieder • {selectedEntitlementIds.length} Rollen
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-none h-10 shadow-none" onClick={() => { setIsEditOpen(false); setIsAddOpen(false); resetForm(); }}>Abbrechen</Button>
              <Button onClick={handleSaveGroup} className="h-10 rounded-none font-bold uppercase text-[10px] px-8 shadow-none">
                {isEditOpen ? 'Änderungen speichern' : 'Gruppe anlegen'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-bold uppercase text-sm">
              <AlertTriangle className="w-5 h-5" /> Gruppe löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Dies löscht die Gruppe "{selectedGroup?.name}". Alle automatischen Zuweisungen dieser Gruppe werden ebenfalls sofort als 'removed' markiert und im Audit Log für jeden Nutzer protokolliert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none shadow-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs shadow-none">Unwiderruflich löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
