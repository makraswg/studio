
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  ShieldAlert,
  Loader2,
  Zap,
  Trash2,
  Info,
  Clock,
  Ticket,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Assignment, User, Entitlement, Resource } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';

export default function AssignmentsPage() {
  const db = useFirestore();
  const { dataSource, activeTenantId } = useSettings();
  const searchParams = useSearchParams();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'requested' | 'removed'>('active');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [adminOnly, setAdminOnly] = useState(false);
  const [isJiraActionLoading, setIsJiraActionLoading] = useState(false);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Create Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const { data: assignments, isLoading, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateAssignment = async () => {
    if (!selectedUserId || !selectedEntitlementId) return;
    const targetTenantId = users?.find(u => u.id === selectedUserId)?.tenantId || 'global';
    const assignmentId = `ass-${Math.random().toString(36).substring(2, 9)}`;
    const assignmentData = {
      id: assignmentId,
      userId: selectedUserId,
      entitlementId: selectedEntitlementId,
      status: 'active',
      grantedBy: authUser?.uid || 'system',
      grantedAt: new Date().toISOString(),
      validFrom: new Date().toISOString().split('T')[0],
      validUntil,
      ticketRef: 'MANUELL',
      tenantId: targetTenantId,
      notes: 'Manuell über Konsole angelegt.',
      syncSource: 'manual'
    };
    if (dataSource === 'mysql') await saveCollectionRecord('assignments', assignmentId, assignmentData);
    else setDocumentNonBlocking(doc(db, 'assignments', assignmentId), assignmentData);
    setIsCreateOpen(false);
    toast({ title: "Zuweisung erstellt" });
    setTimeout(() => refreshAssignments(), 200);
  };

  const handleRevokeAssignment = async (assignment: Assignment) => {
    const updateData = { status: 'removed', lastReviewedAt: new Date().toISOString() };
    if (dataSource === 'mysql') await saveCollectionRecord('assignments', assignment.id, { ...assignment, ...updateData });
    else updateDocumentNonBlocking(doc(db, 'assignments', assignment.id), updateData);
    toast({ title: "Berechtigung widerrufen" });
    setTimeout(() => refreshAssignments(), 200);
  };

  const handleBulkExpiredJira = async () => {
    const expired = assignments?.filter(a => a.status === 'active' && a.validUntil && new Date(a.validUntil) < new Date() && !a.jiraIssueKey) || [];
    if (expired.length === 0) {
      toast({ title: "Keine fälligen Posten", description: "Alle abgelaufenen Zuweisungen haben bereits ein Ticket oder es gibt keine." });
      return;
    }

    setIsJiraActionLoading(true);
    try {
      const configs = await getJiraConfigs();
      if (configs.length === 0 || !configs[0].enabled) throw new Error("Jira Integration nicht aktiv.");

      for (const a of expired) {
        const user = users?.find(u => u.id === a.userId);
        const summary = `ABLAUF: Berechtigung für ${user?.displayName || a.userId}`;
        const res = await createJiraTicket(configs[0].id, summary, `Zuweisung abgelaufen am ${a.validUntil}. Bitte Entzug prüfen.`);
        if (res.success) {
          const update = { jiraIssueKey: res.key };
          if (dataSource === 'mysql') await saveCollectionRecord('assignments', a.id, { ...a, ...update });
          else updateDocumentNonBlocking(doc(db, 'assignments', a.id), update);
        }
      }
      toast({ title: "Tickets erstellt", description: `${expired.length} Jira Tickets wurden generiert.` });
      refreshAssignments();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsJiraActionLoading(false);
    }
  };

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter(a => {
      // 1. Mandant
      if (activeTenantId !== 'all' && a.tenantId !== activeTenantId) return false;
      
      const user = users?.find(u => u.id === a.userId);
      const ent = entitlements?.find(e => e.id === a.entitlementId);
      const res = resources?.find(r => r.id === ent?.resourceId);
      
      // 2. Suche
      const matchSearch = (user?.displayName || '').toLowerCase().includes(search.toLowerCase()) || (res?.name || '').toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      
      // 3. Status Tab
      const matchTab = activeTab === 'all' || a.status === activeTab;
      if (!matchTab) return false;
      
      // 4. Admin Filter
      const isAdmin = !!(ent?.isAdmin === true || ent?.isAdmin === 1 || ent?.isAdmin === "1");
      const matchAdmin = !adminOnly || isAdmin;
      
      return matchAdmin;
    });
  }, [assignments, users, entitlements, resources, search, activeTab, adminOnly, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einzelzuweisungen</h1>
          <p className="text-sm text-muted-foreground">Aktive und ausstehende Berechtigungen im Überblick.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none border-amber-200 text-amber-700 bg-amber-50" onClick={handleBulkExpiredJira} disabled={isJiraActionLoading}>
            {isJiraActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Ticket className="w-3.5 h-3.5 mr-2" />} Ablauf-Tickets erstellen
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Zuweisung erstellen
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            placeholder="Mitarbeiter oder System suchen..." 
            className="w-full pl-10 h-10 border border-input bg-white px-3 text-sm focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-4 border bg-white h-10">
          <ShieldAlert className={cn("w-4 h-4", adminOnly ? "text-red-600" : "text-muted-foreground")} />
          <Label htmlFor="admin-filter" className="text-[10px] font-bold uppercase cursor-pointer">Nur Admin-Rollen</Label>
          <Switch id="admin-filter" checked={adminOnly} onCheckedChange={setAdminOnly} />
        </div>
        <div className="flex border rounded-none p-1 bg-muted/20">
          {['all', 'active', 'requested', 'removed'].map(id => (
            <Button key={id} variant={activeTab === id ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab(id as any)} className="h-8 text-[9px] font-bold uppercase px-4 rounded-none">
              {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Pending' : 'Historie'}
            </Button>
          ))}
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Mitarbeiter</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">System / Rolle</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Gültigkeit</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
            ) : filteredAssignments.map((a) => {
              const user = users?.find(u => u.id === a.userId);
              const ent = entitlements?.find(e => e.id === a.entitlementId);
              const res = resources?.find(r => r.id === ent?.resourceId);
              const isAdmin = !!(ent?.isAdmin === true || ent?.isAdmin === 1 || ent?.isAdmin === "1");
              const isExpired = a.validUntil && new Date(a.validUntil) < new Date() && a.status === 'active';

              return (
                <TableRow key={a.id} className="hover:bg-muted/5 border-b">
                  <TableCell className="py-4">
                    <div className="font-bold text-sm">{user?.displayName || a.userId}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{a.tenantId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isAdmin && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
                      <div>
                        <div className="font-bold text-sm">{res?.name}</div>
                        <div className="text-xs text-muted-foreground">{ent?.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className={cn(
                        "rounded-none font-bold uppercase text-[9px] border-none px-2 w-fit",
                        a.status === 'active' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>{a.status}</Badge>
                      {a.jiraIssueKey && <Badge variant="outline" className="rounded-none bg-blue-50 text-blue-700 text-[8px] border-none px-2 w-fit">Jira: {a.jiraIssueKey}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className={cn(isExpired && "text-red-600 font-bold flex items-center gap-1")}>
                      {isExpired && <AlertTriangle className="w-3 h-3" />}
                      {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none w-48">
                        <DropdownMenuItem onSelect={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }}>
                          <Info className="w-3.5 h-3.5 mr-2" /> Details einsehen
                        </DropdownMenuItem>
                        {a.status !== 'removed' && (
                          <DropdownMenuItem className="text-red-600" onSelect={() => handleRevokeAssignment(a)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Zugriff widerrufen
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Zuweisungs-Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 text-xs">
            <div className="grid grid-cols-2 gap-4 border-b pb-4">
              <div><p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">ID</p><p className="font-mono">{selectedAssignment?.id}</p></div>
              <div><p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Quelle</p><p>{selectedAssignment?.syncSource || 'Manuell'}</p></div>
            </div>
            <div><p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Erteilt von</p><p>{selectedAssignment?.grantedBy} am {selectedAssignment?.grantedAt && new Date(selectedAssignment.grantedAt).toLocaleString()}</p></div>
            <div><p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Ticket / Referenz</p><p className="font-bold">{selectedAssignment?.ticketRef || selectedAssignment?.jiraIssueKey || 'N/A'}</p></div>
            <div><p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Anmerkungen</p><p className="italic">{selectedAssignment?.notes || 'Keine Anmerkungen vorhanden.'}</p></div>
          </div>
          <DialogFooter><Button onClick={() => setIsDetailsOpen(false)} className="rounded-none">Schließen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Zuweisung erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Benutzer</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {users?.filter(u => activeTenantId === 'all' || u.tenantId === activeTenantId).map(u => 
                    <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Rolle</Label>
              <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {entitlements?.map(e => {
                    const res = resources?.find(r => r.id === e.resourceId);
                    if (activeTenantId !== 'all' && res?.tenantId !== 'global' && res?.tenantId !== activeTenantId) return null;
                    return <SelectItem key={e.id} value={e.id}>{e.name} ({res?.name})</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Befristet bis (Optional)</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateAssignment} className="rounded-none font-bold uppercase text-[10px]">Zuweisen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
