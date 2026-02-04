
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
import { Input } from '@/components/ui/input';
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
  AlertTriangle,
  Layers,
  Calendar,
  ShieldCheck,
  User as UserIcon,
  Link as LinkIcon,
  Workflow,
  Lock,
  ChevronRight,
  UserCircle,
  Building2,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
  updateDocumentNonBlocking,
  setDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Assignment, User, Entitlement, Resource, Tenant } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
  const [isSaving, setIsSaving] = useState(false);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Revoke State
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [assignmentToRevoke, setAssignmentToRevoke] = useState<Assignment | null>(null);
  const [revokeValidUntil, setRevokeValidUntil] = useState(new Date().toISOString().split('T')[0]);
  
  // Create Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const { data: assignments, isLoading, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { refresh: refreshAudit } = usePluggableCollection<any>('auditEvents');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'null' || id === 'undefined') return '—';
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const handleCreateAssignment = async () => {
    if (!selectedUserId || !selectedEntitlementId) return;
    
    setIsSaving(true);
    const targetUser = users?.find(u => u.id === selectedUserId);
    const targetTenantId = targetUser?.tenantId || activeTenantId || 'global';
    const assignmentId = `ass-${Math.random().toString(36).substring(2, 9)}`;
    
    const assignmentData = {
      id: assignmentId,
      userId: selectedUserId,
      entitlementId: selectedEntitlementId,
      status: 'active',
      grantedBy: authUser?.email || 'system',
      grantedAt: new Date().toISOString(),
      validFrom: new Date().toISOString().split('T')[0],
      validUntil,
      ticketRef: 'MANUELL',
      tenantId: targetTenantId,
      notes: 'Manuell über Konsole angelegt.',
      syncSource: 'manual'
    };

    try {
      if (dataSource === 'mysql') {
        const res = await saveCollectionRecord('assignments', assignmentId, assignmentData);
        if (!res.success) throw new Error(res.error || "MySQL Fehler beim Speichern");
      } else {
        setDocumentNonBlocking(doc(db, 'assignments', assignmentId), assignmentData);
      }
      
      const role = entitlements?.find(e => e.id === selectedEntitlementId);
      const resResource = resources?.find(r => r.id === role?.resourceId);
      await logAuditEventAction(dataSource, {
        tenantId: targetTenantId,
        actorUid: authUser?.email || 'system',
        action: `Einzelzuweisung erstellt: ${targetUser?.displayName} -> ${resResource?.name}/${role?.name}`,
        entityType: 'assignment',
        entityId: assignmentId,
        after: assignmentData
      });

      setIsCreateOpen(false);
      toast({ title: "Zuweisung erstellt" });
      setSelectedUserId('');
      setSelectedResourceId('');
      setSelectedEntitlementId('');
      setValidUntil('');
      
      setTimeout(() => { refreshAssignments(); refreshAudit(); }, 300);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeAssignment = (assignment: Assignment) => {
    if (assignment.originGroupId || assignment.syncSource === 'group') {
      toast({ variant: "destructive", title: "Aktion verweigert", description: "Gruppenbasierte Zuweisungen können nur über die Zuweisungsgruppe verwaltet werden." });
      return;
    }
    setAssignmentToRevoke(assignment);
    setRevokeValidUntil(new Date().toISOString().split('T')[0]);
    setIsRevokeOpen(true);
  };

  const confirmRevokeAssignment = async () => {
    if (!assignmentToRevoke) return;

    setIsSaving(true);
    const updateData = { 
      status: 'removed', 
      validUntil: revokeValidUntil,
      lastReviewedAt: new Date().toISOString() 
    };

    try {
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', assignmentToRevoke.id, { ...assignmentToRevoke, ...updateData });
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', assignmentToRevoke.id), updateData);
      }
      
      const user = users?.find(u => u.id === assignmentToRevoke.userId);
      const ent = entitlements?.find(e => e.id === assignmentToRevoke.entitlementId);
      const resResource = resources?.find(r => r.id === ent?.resourceId);

      await logAuditEventAction(dataSource, {
        tenantId: assignmentToRevoke.tenantId || 'global',
        actorUid: authUser?.email || 'system',
        action: `Zugriff entzogen (bis: ${revokeValidUntil}): ${user?.displayName} -> ${resResource?.name}/${ent?.name}`,
        entityType: 'assignment',
        entityId: assignmentToRevoke.id,
        after: { ...assignmentToRevoke, ...updateData }
      });

      setIsRevokeOpen(false);
      setAssignmentToRevoke(null);
      toast({ title: "Berechtigung widerrufen" });
      setTimeout(() => { refreshAssignments(); refreshAudit(); }, 200);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkExpiredJira = async () => {
    const expired = assignments?.filter(a => a.status === 'active' && a.validUntil && new Date(a.validUntil) < new Date() && !a.jiraIssueKey) || [];
    if (expired.length === 0) {
      toast({ title: "Keine fälligen Posten", description: "Alle abgelaufenen Zuweisungen haben bereits ein Ticket oder es gibt keine." });
      return;
    }

    setIsJiraActionLoading(true);
    try {
      const configs = await getJiraConfigs(dataSource);
      if (configs.length === 0 || !configs[0].enabled) throw new Error("Jira Integration nicht aktiv oder nicht gefunden.");

      for (const a of expired) {
        const user = users?.find(u => u.id === a.userId);
        const summary = `ABLAUF: Berechtigung für ${user?.displayName || a.userId}`;
        const res = await createJiraTicket(configs[0].id, summary, `Zuweisung abgelaufen am ${a.validUntil}. Bitte Entzug prüfen.`, dataSource);
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
      if (activeTenantId !== 'all' && a.tenantId !== activeTenantId) return false;
      const user = users?.find(u => u.id === a.userId);
      const ent = entitlements?.find(e => e.id === a.entitlementId);
      const resResource = resources?.find(r => r.id === ent?.resourceId);
      const matchSearch = (user?.displayName || '').toLowerCase().includes(search.toLowerCase()) || (resResource?.name || '').toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      const matchTab = activeTab === 'all' || a.status === activeTab;
      if (!matchTab) return false;
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
          <p className="text-sm text-muted-foreground">Aktive und ausstehende Berechtigungen im Überblick für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
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
          <Input 
            placeholder="Mitarbeiter oder System suchen..." 
            className="w-full pl-10 h-10 border border-input bg-white px-3 text-sm focus:outline-none rounded-none"
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
              <TableHead className="font-bold uppercase text-[10px]">Status / Herkunft</TableHead>
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
              const resResource = resources?.find(r => r.id === ent?.resourceId);
              const isAdmin = !!(ent?.isAdmin === true || ent?.isAdmin === 1 || ent?.isAdmin === "1");
              const isExpired = a.validUntil && new Date(a.validUntil) < new Date() && a.status === 'active';
              const isGroupManaged = !!a.originGroupId || a.syncSource === 'group';

              return (
                <TableRow key={a.id} className="hover:bg-muted/5 border-b">
                  <TableCell className="py-4">
                    <div className="font-bold text-sm">{user?.displayName || a.userId}</div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">{getTenantSlug(a.tenantId)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isAdmin && <ShieldAlert className="w-3.5 h-3.5 text-red-600" />}
                      <div>
                        <div className="font-bold text-sm">{resResource?.name}</div>
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
                      {isGroupManaged && (
                        <Badge variant="outline" className="rounded-none bg-indigo-50 text-indigo-700 border-none px-2 w-fit text-[8px] font-bold uppercase flex items-center gap-1">
                          <Workflow className="w-2.5 h-2.5" /> Gruppe
                        </Badge>
                      )}
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
                        {a.status !== 'removed' && !isGroupManaged && (
                          <DropdownMenuItem className="text-red-600" onSelect={() => handleRevokeAssignment(a)}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Zugriff widerrufen
                          </DropdownMenuItem>
                        )}
                        {isGroupManaged && (
                          <DropdownMenuItem disabled className="text-muted-foreground italic">
                            <Lock className="w-3.5 h-3.5 mr-2" /> Gruppenverwaltet
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Zuweisung erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">1. Benutzer auswählen</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-none">
                  <ScrollArea className="h-48">
                    {users?.filter(u => activeTenantId === 'all' || u.tenantId === activeTenantId).map(u => 
                      <SelectItem key={u.id} value={u.id}>{u.displayName} ({getTenantSlug(u.tenantId)})</SelectItem>
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="space-y-2 animate-in fade-in">
                <Label className="text-[10px] font-bold uppercase">2. System auswählen</Label>
                <Select value={selectedResourceId} onValueChange={(val) => { setSelectedResourceId(val); setSelectedEntitlementId(''); }}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <ScrollArea className="h-48">
                      {resources?.filter(r => {
                        const user = users?.find(u => u.id === selectedUserId);
                        return r.tenantId === 'global' || r.tenantId === user?.tenantId;
                      }).map(r => 
                        <SelectItem key={r.id} value={r.id}>
                          <div className="flex items-center gap-2"><Layers className="w-3 h-3 text-muted-foreground" /> {r.name}</div>
                        </SelectItem>
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedResourceId && (
              <div className="space-y-2 animate-in fade-in">
                <Label className="text-[10px] font-bold uppercase">3. Rolle wählen</Label>
                <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    <ScrollArea className="h-48">
                      {entitlements?.filter(e => e.resourceId === selectedResourceId).map(e => 
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center gap-2">
                            {!!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1") && <ShieldAlert className="w-3 h-3 text-red-600" />}
                            {e.name}
                          </div>
                        </SelectItem>
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Befristet bis (Optional)</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleCreateAssignment} disabled={!selectedEntitlementId || isSaving} className="rounded-none font-bold uppercase text-[10px] gap-2">
              {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              Zuweisen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="max-w-sm rounded-none border-2">
          <DialogHeader>
            <DialogTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              Zugriff Widerrufen
            </DialogTitle>
            <DialogDescription className="text-xs">
              Legen Sie fest, bis zu welchem Datum der Zugriff noch gültig sein soll. Für sofortigen Entzug wählen Sie das heutige Datum.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted/20 border rounded-none">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Mitarbeiter</p>
              <p className="text-xs font-bold">{users?.find(u => u.id === assignmentToRevoke?.userId)?.displayName}</p>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mt-2 mb-1">System / Rolle</p>
              {(() => {
                const ent = entitlements?.find(e => e.id === assignmentToRevoke?.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                return <p className="text-xs font-bold">{res?.name} / {ent?.name}</p>;
              })()}
            </div>
            <div className="space-y-2">
              <Label className="text-[9px] font-bold uppercase">Gültig bis</Label>
              <Input 
                type="date" 
                value={revokeValidUntil} 
                onChange={e => setRevokeValidUntil(e.target.value)} 
                className="rounded-none h-9" 
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsRevokeOpen(false)} className="rounded-none h-9 flex-1 text-[10px] font-bold uppercase">Abbrechen</Button>
            <Button onClick={confirmRevokeAssignment} disabled={isSaving} className="rounded-none h-9 flex-1 text-[10px] font-bold uppercase gap-2 bg-red-600 hover:bg-red-700 text-white">
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Entzug Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] h-[90vh] rounded-none p-0 overflow-hidden flex flex-col border shadow-2xl">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 flex items-center justify-center rounded-sm shrink-0">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold uppercase tracking-tight leading-none mb-1">Zuweisung Details</DialogTitle>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  <UserCircle className="w-3 h-3" /> 
                  <span className="truncate">Inhaber: {users?.find(u => u.id === selectedAssignment?.userId)?.displayName || 'Unbekannt'}</span>
                </div>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 bg-white">
            <div className="p-6 space-y-6 pb-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 border bg-slate-50/50">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5 block tracking-widest">Status</Label>
                  <Badge variant="outline" className={cn(
                    "rounded-none font-bold uppercase text-[10px] px-3 py-0.5",
                    selectedAssignment?.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {selectedAssignment?.status}
                  </Badge>
                </div>
                <div className="p-3 border bg-slate-50/50">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5 block tracking-widest">Mandant</Label>
                  <div className="flex items-center gap-2 font-bold text-xs text-primary uppercase">
                    <Building2 className="w-3.5 h-3.5" />
                    {getTenantSlug(selectedAssignment?.tenantId)}
                  </div>
                </div>
                <div className="p-3 border bg-slate-50/50">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5 block tracking-widest">Quelle</Label>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10px] uppercase">{selectedAssignment?.syncSource || 'Manuell'}</span>
                    {selectedAssignment?.originGroupId && (
                      <Badge className="bg-indigo-600 text-white rounded-none text-[8px] h-4">GROUP</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Identität & Berechtigung</span>
                  <Separator className="flex-1" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-bold uppercase text-slate-500">Benutzer</Label>
                      <span className="text-[8px] font-mono text-muted-foreground opacity-50">UID: {selectedAssignment?.userId}</span>
                    </div>
                    <div className="p-3 border bg-white flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{users?.find(u => u.id === selectedAssignment?.userId)?.displayName || 'Unbekannter Nutzer'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{users?.find(u => u.id === selectedAssignment?.userId)?.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] font-bold uppercase text-slate-500">Rolle & System</Label>
                      <span className="text-[8px] font-mono text-muted-foreground opacity-50">EID: {selectedAssignment?.entitlementId}</span>
                    </div>
                    <div className="p-3 border bg-white flex items-start gap-3">
                      <div className="w-8 h-8 rounded-sm bg-primary/5 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      {(() => {
                        const ent = entitlements?.find(e => e.id === selectedAssignment?.entitlementId);
                        const resResource = resources?.find(r => r.id === ent?.resourceId);
                        return (
                          <div className="min-w-0">
                            <p className="font-bold text-xs truncate">{resResource?.name || 'Unbekannt'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-[10px] text-muted-foreground truncate">{ent?.name}</p>
                              {ent?.isAdmin && <Badge className="bg-red-100 text-red-700 border-none rounded-none text-[8px] h-3.5 px-1">ADMIN</Badge>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Zeitraum & Governance</span>
                  <Separator className="flex-1" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Gültig ab</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {selectedAssignment?.validFrom || 'Sofort'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Gültig bis</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {selectedAssignment?.validUntil || 'Unbefristet'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Zertifiziert</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <ShieldCheck className={cn("w-3 h-3", selectedAssignment?.lastReviewedAt ? "text-emerald-500" : "text-slate-300")} />
                      {selectedAssignment?.lastReviewedAt ? new Date(selectedAssignment.lastReviewedAt).toLocaleDateString() : 'Ausstehend'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Prüfer</p>
                    <div className="text-[10px] font-mono truncate text-muted-foreground">
                      {selectedAssignment?.reviewedBy || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Prozess & Notizen</span>
                  <Separator className="flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 border border-blue-100 bg-blue-50/30">
                      <div className="min-w-0">
                        <p className="text-[8px] font-bold uppercase text-blue-600">Ticket-Referenz</p>
                        <p className="font-bold text-[10px] mt-0.5 truncate">{selectedAssignment?.ticketRef || selectedAssignment?.jiraIssueKey || 'KEINE'}</p>
                      </div>
                      <Ticket className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                    <div className="p-2.5 border bg-white">
                      <p className="text-[8px] font-bold uppercase text-muted-foreground">Erteilt von</p>
                      <p className="text-[10px] font-bold mt-0.5">{selectedAssignment?.grantedBy || 'System'}</p>
                      <p className="text-[8px] text-muted-foreground mt-0.5">am {selectedAssignment?.grantedAt ? new Date(selectedAssignment.grantedAt).toLocaleString() : 'Unbekannt'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <Info className="w-2.5 h-2.5" /> Anmerkungen
                    </Label>
                    <div className="p-3 bg-amber-50/30 border border-amber-100 min-h-[60px] max-h-[120px] overflow-y-auto text-[10px] italic leading-relaxed text-slate-600">
                      {selectedAssignment?.notes || 'Keine zusätzlichen Anmerkungen vorhanden.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
            <Button onClick={() => setIsDetailsOpen(false)} className="rounded-none h-9 px-8 font-bold uppercase text-[10px] tracking-widest bg-slate-900 hover:bg-slate-800 text-white">
              Fenster Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
