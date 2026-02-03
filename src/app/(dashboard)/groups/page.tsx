
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
  X, 
  Check,
  AlertCircle
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
import { Label } from '@/components/ui/label';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking, 
  updateDocumentNonBlocking,
  setDocumentNonBlocking
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AssignmentGroup, User, Entitlement, Resource } from '@/lib/types';

export default function GroupsPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const groupsQuery = useMemoFirebase(() => collection(db, 'groups'), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const entitlementsQuery = useMemoFirebase(() => collection(db, 'entitlements'), [db]);
  const resourcesQuery = useMemoFirebase(() => collection(db, 'resources'), [db]);
  const assignmentsQuery = useMemoFirebase(() => collection(db, 'assignments'), [db]);

  const { data: groups, isLoading } = useCollection<AssignmentGroup>(groupsQuery);
  const { data: users } = useCollection<User>(usersQuery);
  const { data: entitlements } = useCollection<Entitlement>(entitlementsQuery);
  const { data: resources } = useCollection<Resource>(resourcesQuery);
  const { data: assignments } = useCollection(assignmentsQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateGroup = () => {
    if (!name) return;
    const groupId = `grp-${Math.random().toString(36).substring(2, 9)}`;
    setDocumentNonBlocking(doc(db, 'groups', groupId), {
      id: groupId,
      name,
      description,
      userIds: [],
      entitlementIds: [],
      tenantId: 't1'
    });
    setIsAddOpen(false);
    toast({ title: "Gruppe erstellt" });
    setName('');
    setDescription('');
  };

  const syncAssignmentsForGroup = (group: AssignmentGroup, userIds: string[], entitlementIds: string[]) => {
    // Diese Logik stellt sicher, dass alle User in der Gruppe alle Entitlements der Gruppe haben.
    // In einer echten App würde das ein Cloud Function Backend machen.
    userIds.forEach(uid => {
      entitlementIds.forEach(eid => {
        const existing = assignments?.find(a => a.userId === uid && a.entitlementId === eid && a.originGroupId === group.id);
        if (!existing) {
          const assId = `ga-${group.id}-${uid}-${eid}`.substring(0, 20);
          setDocumentNonBlocking(doc(db, 'assignments', assId), {
            id: assId,
            userId: uid,
            entitlementId: eid,
            originGroupId: group.id,
            status: 'active',
            grantedBy: 'system',
            grantedAt: new Date().toISOString(),
            ticketRef: `GROUP_${group.name}`,
            notes: `Auto-zugewiesen via Gruppe: ${group.name}`,
            tenantId: 't1'
          });
        }
      });
    });
  };

  const handleUpdateGroupMembership = (group: AssignmentGroup, type: 'users' | 'entitlements', id: string) => {
    const updatedUserIds = [...group.userIds];
    const updatedEntIds = [...group.entitlementIds];

    if (type === 'users') {
      const idx = updatedUserIds.indexOf(id);
      if (idx > -1) updatedUserIds.splice(idx, 1);
      else updatedUserIds.push(id);
    } else {
      const idx = updatedEntIds.indexOf(id);
      if (idx > -1) updatedEntIds.splice(idx, 1);
      else updatedEntIds.push(id);
    }

    updateDocumentNonBlocking(doc(db, 'groups', group.id), {
      userIds: updatedUserIds,
      entitlementIds: updatedEntIds
    });

    syncAssignmentsForGroup(group, updatedUserIds, updatedEntIds);
    toast({ title: "Gruppe aktualisiert" });
  };

  const handleDeleteGroup = (groupId: string) => {
    deleteDocumentNonBlocking(doc(db, 'groups', groupId));
    // Man müsste hier auch die verknüpften assignments löschen
    assignments?.filter(a => a.originGroupId === groupId).forEach(a => {
      deleteDocumentNonBlocking(doc(db, 'assignments', a.id));
    });
    toast({ title: "Gruppe und zugehörige Zuweisungen entfernt" });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zuweisungsgruppen</h1>
          <p className="text-sm text-muted-foreground">Automatisieren Sie den Zugriff für Rollen-Cluster oder Abteilungen.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Neue Gruppe
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Gruppen suchen..." 
          className="pl-10 h-10 shadow-none border-border rounded-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>
        ) : (
          groups?.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map(group => (
            <div key={group.id} className="admin-card p-6 flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Workflow className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{group.name}</h3>
                    <p className="text-xs text-muted-foreground">{group.description || 'Keine Beschreibung'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-red-600 rounded-none h-8 w-8" onClick={() => handleDeleteGroup(group.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> Mitglieder ({group.userIds.length})
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {users?.map(u => (
                      <div 
                        key={u.id} 
                        className={cn(
                          "flex items-center justify-between p-2 text-xs border cursor-pointer hover:bg-muted/30 transition-colors",
                          group.userIds.includes(u.id) ? "border-blue-200 bg-blue-50/50" : "border-transparent"
                        )}
                        onClick={() => handleUpdateGroupMembership(group, 'users', u.id)}
                      >
                        <span className="font-medium truncate">{u.displayName}</span>
                        {group.userIds.includes(u.id) && <Check className="w-3 h-3 text-blue-600" />}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <Shield className="w-3 h-3" /> Rollen ({group.entitlementIds.length})
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {entitlements?.map(e => {
                      const res = resources?.find(r => r.id === e.resourceId);
                      return (
                        <div 
                          key={e.id} 
                          className={cn(
                            "flex items-center justify-between p-2 text-[10px] border cursor-pointer hover:bg-muted/30 transition-colors",
                            group.entitlementIds.includes(e.id) ? "border-blue-200 bg-blue-50/50" : "border-transparent"
                          )}
                          onClick={() => handleUpdateGroupMembership(group, 'entitlements', e.id)}
                        >
                          <div className="flex flex-col truncate">
                            <span className="font-bold uppercase tracking-tighter">{res?.name}</span>
                            <span className="text-muted-foreground truncate">{e.name}</span>
                          </div>
                          {group.entitlementIds.includes(e.id) && <Check className="w-3 h-3 text-blue-600 shrink-0 ml-2" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {!isLoading && groups?.length === 0 && (
          <div className="col-span-full py-20 border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Workflow className="w-10 h-10 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Keine Gruppen definiert</p>
          </div>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm rounded-none border shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Gruppe erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gruppenname</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="rounded-none h-10" placeholder="z.B. IT-Infrastruktur-Team" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} className="rounded-none h-10" placeholder="Basis-Zugriff für alle Admin-Kollegen" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreateGroup} className="w-full h-11 rounded-none font-bold uppercase text-xs">Gruppe anlegen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
