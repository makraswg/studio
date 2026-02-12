"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
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
  X,
  UserCircle2,
  ArrowRight,
  CalendarDays,
  MoreVertical,
  Activity,
  Save,
  Shield,
  Trash2,
  Info
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
import { Card, CardContent } from '@/components/ui/card';

function AssignmentsPageContent() {
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
    if (!selectedUserId || !selectedEntitlementId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Benutzer und Rolle auswählen." });
      return;
    }
    
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
      ticketRef: 'manuell',
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
      resetCreateForm();
      setTimeout(() => { refreshAssignments(); refreshAudit(); }, 300);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Speichern", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedUserId('');
    setSelectedResourceId('');
    setSelectedEntitlementId('');
    setValidUntil('');
  };

  const handleRevokeAssignment = (assignment: Assignment) => {
    if (assignment.originGroupId || assignment.syncSource === 'group') {
      toast({ variant: "destructive", title: "Aktion verweigert", description: "Gruppenbasierte Zuweisungen werden über Gruppen gesteuert." });
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
        action: `Zugriff entzogen: ${user?.displayName} -> ${resResource?.name}/${ent?.name}`,
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
      toast({ title: "Keine fälligen Posten" });
      return;
    }

    setIsJiraActionLoading(true);
    try {
      const configs = await getJiraConfigs(dataSource);
      if (configs.length === 0 || !configs[0].enabled) throw new Error("Jira nicht konfiguriert.");

      for (const a of expired) {
        const user = users?.find(u => u.id === a.userId);
        const res = await createJiraTicket(configs[0].id, `Ablauf: ${user?.displayName || a.userId}`, `Zuweisung abgelaufen am ${a.validUntil}.`, dataSource);
        if (res.success) {
          const update = { jiraIssueKey: res.key };
          if (dataSource === 'mysql') await saveCollectionRecord('assignments', a.id, { ...a, ...update });
          else updateDocumentNonBlocking(doc(db, 'assignments', a.id), update);
        }
      }
      toast({ title: "Audit-ready", description: "Jira Tickets wurden erstellt." });
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
      return !adminOnly || isAdmin;
    });
  }, [assignments, users, entitlements, resources, search, activeTab, adminOnly, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">AccessHub</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Einzelzuweisungen</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direkte Berechtigungsvergabe für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 hover:bg-amber-50 text-amber-600 transition-all active:scale-95" onClick={handleBulkExpiredJira} disabled={isJiraActionLoading}>
            {isJiraActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Ticket className="w-3.5 h-3.5 mr-2" />} Ablauf-Tickets
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-sm active:scale-95" onClick={() => { resetCreateForm(); setIsCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Zuweisung erstellen
          </Button>
        </div>
      </div>

      {/* Unified Search/Filter Row */}
      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Mitarbeiter oder System suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          {['all', 'active', 'requested', 'removed'].map(id => (
            <button 
              key={id} 
              className={cn(
                "px-3 h-full text-[9px] font-bold rounded-sm transition-all whitespace-nowrap",
                activeTab === id ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setActiveTab(id as any)}
            >
              {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Pending' : 'Historie'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 h-9 border rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 shrink-0">
          <ShieldAlert className={cn("w-3.5 h-3.5", adminOnly ? "text-red-600" : "text-slate-400")} />
          <Label htmlFor="admin-filter" className="text-[10px] font-bold cursor-pointer text-slate-500 whitespace-nowrap">Privilegiert</Label>
          <Switch id="admin-filter" checked={adminOnly} onCheckedChange={setAdminOnly} className="scale-75" />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
          <p className="text-xs font-bold text-slate-400">Lade Zuweisungen...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-xs text-slate-400">Mitarbeiter</TableHead>
                <TableHead className="font-bold text-xs text-slate-400">System / Rolle</TableHead>
                <TableHead className="font-bold text-xs text-slate-400">Status</TableHead>
                <TableHead className="font-bold text-xs text-slate-400">Gültigkeit</TableHead>
                <TableHead className="text-right px-6 font-bold text-xs text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments.map((a) => {
                const user = users?.find(u => u.id === a.userId);
                const ent = entitlements?.find(e => e.id === a.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                const isAdmin = !!(ent?.isAdmin === true || ent?.isAdmin === 1 || ent?.isAdmin === "1");
                const isExpired = a.validUntil && new Date(a.validUntil) < new Date() && a.status === 'active';
                const isGroupManaged = !!a.originGroupId || a.syncSource === 'group' || a.syncSource === 'ldap';

                return (
                  <TableRow key={a.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shadow-inner">
                          <UserIcon className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-800">{user?.displayName || a.userId}</div>
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{getTenantSlug(a.tenantId)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg", isAdmin ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
                          {isAdmin ? <ShieldAlert className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 truncate">{res?.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold truncate">{ent?.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn(
                          "rounded-full border-none px-2 h-5 text-[10px] font-bold w-fit",
                          a.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        )}>{a.status}</Badge>
                        {isGroupManaged && (
                          <Badge className="bg-indigo-50 text-indigo-600 border-none rounded-full text-[8px] font-bold px-1.5 h-4 w-fit">
                            Automatik
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={cn("text-[10px] font-bold flex items-center gap-1.5", isExpired ? "text-red-600" : "text-slate-600")}>
                        <CalendarDays className="w-3 h-3 opacity-50" />
                        {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 rounded-md text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }}
                        >
                          Details
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 active:scale-95 transition-transform"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                            <DropdownMenuItem onSelect={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }} className="rounded-md py-2 gap-2 text-xs font-bold"><Info className="w-3.5 h-3.5 text-primary" /> Details</DropdownMenuItem>
                            {a.status !== 'removed' && !isGroupManaged && (
                              <DropdownMenuItem className="text-red-600 rounded-md py-2 gap-2 text-xs font-bold" onSelect={() => handleRevokeAssignment(a)}>
                                <Trash2 className="w-3.5 h-3.5" /> Widerrufen
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Assignment Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-inner">
                <Plus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-headline font-bold text-primary">Einzelzuweisung erstellen</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-slate-400 mt-0.5">Manueller Berechtigungs-Workflow</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <div className="space-y-1.5">
                <Label required className="text-[10px] font-bold text-slate-400 ml-1">1. Identität auswählen</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-11 rounded-md border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="Mitarbeiter wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <ScrollArea className="h-48">
                      {users?.filter(u => activeTenantId === 'all' || u.tenantId === activeTenantId).map(u => (
                        <SelectItem key={u.id} value={u.id} className="text-xs">{u.displayName} ({u.email})</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label required className="text-[10px] font-bold text-slate-400 ml-1">2. System auswählen</Label>
                <Select value={selectedResourceId} onValueChange={(val) => { setSelectedResourceId(val); setSelectedEntitlementId(''); }}>
                  <SelectTrigger className="h-11 rounded-md border-slate-200 bg-slate-50/50">
                    <SelectValue placeholder="System wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-md">
                    <ScrollArea className="h-48">
                      {resources?.filter(r => r.tenantId === 'global' || activeTenantId === 'all' || r.tenantId === activeTenantId).map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              {selectedResourceId && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                  <Label required className="text-[10px] font-bold text-slate-400 ml-1">3. Rolle / Berechtigung wählen</Label>
                  <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                    <SelectTrigger className="h-11 rounded-md border-slate-200 bg-slate-50/50">
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                      <ScrollArea className="h-48">
                        {entitlements?.filter(e => e.resourceId === selectedResourceId).map(e => (
                          <SelectItem key={e.id} value={e.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              {!!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1") && <ShieldAlert className="w-3 h-3 text-red-600" />}
                              {e.name}
                            </div>
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 ml-1">Gültig bis (Optional)</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-md h-11 border-slate-200" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} className="w-full sm:w-auto rounded-md font-bold text-[10px] px-6">Abbrechen</Button>
            <Button size="sm" onClick={handleCreateAssignment} disabled={isSaving || !selectedEntitlementId || !selectedUserId} className="w-full sm:w-auto rounded-md font-bold text-[11px] px-8 h-11 bg-primary text-white shadow-sm">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2" />} Zuweisung aktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-xl p-0 overflow-hidden bg-white border-none shadow-2xl flex flex-col h-[85vh]">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900">Zuweisung Details</DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1.5">
                  <UserCircle className="w-3 h-3" /> {users?.find(u => u.id === selectedAssignment?.userId)?.displayName || 'Unbekannt'}
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Label className="text-[10px] font-bold text-slate-400 mb-1.5 block">Status</Label>
                  <Badge className={cn("rounded-full px-3 h-6 text-[10px] font-bold border-none", selectedAssignment?.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{selectedAssignment?.status}</Badge>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Label className="text-[10px] font-bold text-slate-400 mb-1.5 block">Mandant</Label>
                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-primary">
                    <Building2 className="w-3 h-3" /> {getTenantSlug(selectedAssignment?.tenantId)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <Label className="text-[10px] font-bold text-slate-400 mb-1.5 block">Quelle</Label>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold border-slate-200 px-3 h-6">{selectedAssignment?.syncSource || 'manuell'}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1">Identität</Label>
                  <div className="p-4 rounded-xl bg-white border flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shadow-inner"><UserIcon className="w-4 h-4 text-slate-400" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-800 truncate">{users?.find(u => u.id === selectedAssignment?.userId)?.displayName}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{users?.find(u => u.id === selectedAssignment?.userId)?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 ml-1">Rolle & System</Label>
                  <div className="p-4 rounded-xl bg-white border flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shadow-inner"><Layers className="w-4 h-4 text-primary" /></div>
                    {(() => {
                      const ent = entitlements?.find(e => e.id === selectedAssignment?.entitlementId);
                      const res = resources?.find(r => r.id === ent?.resourceId);
                      return (
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-800 truncate">{res?.name}</p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[10px] text-slate-400 font-bold truncate">{ent?.name}</p>
                            {ent?.isAdmin && <Badge className="bg-red-50 text-red-600 border-none rounded-full text-[8px] h-4 font-bold px-1.5">Admin</Badge>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 border grid grid-cols-2 md:grid-cols-4 gap-4 shadow-inner">
                <div><p className="text-[10px] font-bold text-slate-400 mb-0.5">Gültig ab</p><p className="text-[11px] font-bold text-slate-700">{selectedAssignment?.validFrom || 'Sofort'}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 mb-0.5">Gültig bis</p><p className="text-[11px] font-bold text-slate-700">{selectedAssignment?.validUntil || '∞'}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 mb-0.5">Audit</p><p className="text-[11px] font-bold text-slate-700">{selectedAssignment?.lastReviewedAt ? new Date(selectedAssignment.lastReviewedAt).toLocaleDateString() : 'Offen'}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 mb-0.5">Referenz</p><p className="text-[11px] font-bold text-primary font-mono truncate">{selectedAssignment?.ticketRef || selectedAssignment?.jiraIssueKey || 'N/A'}</p></div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
            <Button size="sm" onClick={() => setIsDetailsOpen(false)} className="w-full sm:w-auto rounded-md font-bold text-[11px] px-8">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="max-w-sm rounded-xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          <DialogHeader className="p-6 bg-red-50 border-b border-red-100 pr-8">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-3 mx-auto shadow-sm">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <Badge className="bg-red-600 text-white border-none rounded-full h-4 px-2 text-[8px] font-black uppercase tracking-widest mx-auto mb-2">Entzug erforderlich</Badge>
            <DialogTitle className="text-base font-headline font-bold text-red-600 text-center">Zugriff entziehen</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 border shadow-inner">
              <p className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-widest">Betroffene Identität</p>
              <p className="text-xs font-bold text-slate-800">{users?.find(u => u.id === assignmentToRevoke?.userId)?.displayName}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest">Wirksam bis</Label>
              <Input type="date" value={revokeValidUntil} onChange={e => setRevokeValidUntil(e.target.value)} className="rounded-md h-10 border-slate-200" />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col gap-2">
            <Button size="sm" onClick={confirmRevokeAssignment} disabled={isSaving} className="w-full rounded-md bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-11 shadow-lg shadow-red-100">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1.5" />} Widerrufen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsRevokeOpen(false)} className="w-full h-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-bold">Lade Daten...</p></div>}>
      <AssignmentsPageContent />
    </Suspense>
  );
}