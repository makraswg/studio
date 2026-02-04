
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
  Link as LinkIcon
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
      const res = resources?.find(r => r.id === role?.resourceId);
      await logAuditEventAction(dataSource, {
        tenantId: targetTenantId,
        actorUid: authUser?.email || 'system',
        action: `Einzelzuweisung erstellt: ${targetUser?.displayName} -> ${res?.name}/${role?.name}`,
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

  const handleRevokeAssignment = async (assignment: Assignment) => {
    const updateData = { status: 'removed', lastReviewedAt: new Date().toISOString() };
    if (dataSource === 'mysql') await saveCollectionRecord('assignments', assignment.id, { ...assignment, ...updateData });
    else updateDocumentNonBlocking(doc(db, 'assignments', assignment.id), updateData);
    
    const user = users?.find(u => u.id === assignment.userId);
    const ent = entitlements?.find(e => e.id === assignment.entitlementId);
    const res = resources?.find(r => r.id === ent?.resourceId);

    await logAuditEventAction(dataSource, {
      tenantId: assignment.tenantId || 'global',
      actorUid: authUser?.email || 'system',
      action: `Zugriff entzogen: ${user?.displayName} -> ${res?.name}/${ent?.name}`,
      entityType: 'assignment',
      entityId: assignment.id,
      after: { ...assignment, ...updateData }
    });

    toast({ title: "Berechtigung widerrufen" });
    setTimeout(() => { refreshAssignments(); refreshAudit(); }, 200);
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
      if (activeTenantId !== 'all' && a.tenantId !== activeTenantId) return false;
      const user = users?.find(u => u.id === a.userId);
      const ent = entitlements?.find(e => e.id === a.entitlementId);
      const res = resources?.find(r => r.id === ent?.resourceId);
      const matchSearch = (user?.displayName || '').toLowerCase().includes(search.toLowerCase()) || (res?.name || '').toLowerCase().includes(search.toLowerCase());
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
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">{getTenantSlug(a.tenantId)}</div>
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

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] rounded-none p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div>
                <DialogTitle className="text-sm font-bold uppercase tracking-wider">Einzelzuweisung Details</DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Zugeordnet an {users?.find(u => u.id === selectedAssignment?.userId)?.displayName}</p>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8 text-xs">
              {/* Basis-Informationen */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px] flex items-center gap-1.5"><Info className="w-3 h-3" /> Zuweisungs-ID</p>
                  <p className="font-mono bg-muted/30 px-2 py-1 border">{selectedAssignment?.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px] flex items-center gap-1.5"><ShieldAlert className="w-3 h-3" /> Status</p>
                  <Badge variant="outline" className={cn(
                    "rounded-none font-bold uppercase text-[10px] px-3",
                    selectedAssignment?.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {selectedAssignment?.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px] flex items-center gap-1.5"><LinkIcon className="w-3 h-3" /> Herkunft / Quelle</p>
                  <p className="font-bold uppercase tracking-tight">{selectedAssignment?.syncSource || 'Manuelle Erfassung'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px] flex items-center gap-1.5"><UserIcon className="w-3 h-3" /> Mandant</p>
                  <p className="font-bold uppercase text-primary">{getTenantSlug(selectedAssignment?.tenantId)}</p>
                </div>
              </div>

              {/* Identitäten & Ressourcen */}
              <div className="space-y-4 pt-6 border-t">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Identität & Berechtigung</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-3 border bg-slate-50/50">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground mb-2">Benutzer</p>
                    <p className="font-bold text-sm mb-1">{users?.find(u => u.id === selectedAssignment?.userId)?.displayName || 'Unbekannt'}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">UID: {selectedAssignment?.userId}</p>
                  </div>
                  <div className="p-3 border bg-slate-50/50">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground mb-2">Rolle & System</p>
                    {(() => {
                      const ent = entitlements?.find(e => e.id === selectedAssignment?.entitlementId);
                      const res = resources?.find(r => r.id === ent?.resourceId);
                      return (
                        <>
                          <p className="font-bold text-sm mb-1">{res?.name} / {ent?.name}</p>
                          <p className="text-[9px] font-mono text-muted-foreground">EID: {selectedAssignment?.entitlementId}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Gültigkeitszeitraum */}
              <div className="space-y-4 pt-6 border-t">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Zeitraum & Governance</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Gültig ab</p>
                    <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-bold">{selectedAssignment?.validFrom || '—'}</span></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Gültig bis</p>
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="font-bold">{selectedAssignment?.validUntil || 'Unbefristet'}</span></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Zertifiziert am</p>
                    <div className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /><span className="font-bold">{selectedAssignment?.lastReviewedAt ? new Date(selectedAssignment.lastReviewedAt).toLocaleDateString() : 'Ausstehend'}</span></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Prüfer (UID)</p>
                    <p className="truncate font-mono text-[10px]">{selectedAssignment?.reviewedBy || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Erteilung & Tickets */}
              <div className="space-y-4 pt-6 border-t">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prozess & Referenzen</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Erteilt von</p>
                    <p className="font-bold">{selectedAssignment?.grantedBy}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">am {selectedAssignment?.grantedAt && new Date(selectedAssignment.grantedAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Ticket / Jira Key</p>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-sm">{selectedAssignment?.ticketRef || selectedAssignment?.jiraIssueKey || 'Keine Referenz'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Anmerkungen */}
              <div className="space-y-2 pt-6 border-t">
                <p className="text-muted-foreground mb-1 uppercase font-bold text-[9px]">Interne Notizen</p>
                <div className="p-4 bg-amber-50/30 border border-amber-100 italic leading-relaxed">
                  {selectedAssignment?.notes || 'Keine zusätzlichen Anmerkungen hinterlegt.'}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
            <Button onClick={() => setIsDetailsOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
