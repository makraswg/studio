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
  X,
  UserCircle2,
  ArrowRight,
  CalendarDays,
  MoreVertical
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
        const res = await createJiraTicket(configs[0].id, `ABLAUF: ${user?.displayName || a.userId}`, `Zuweisung abgelaufen am ${a.validUntil}.`, dataSource);
        if (res.success) {
          const update = { jiraIssueKey: res.key };
          if (dataSource === 'mysql') await saveCollectionRecord('assignments', a.id, { ...a, ...update });
          else updateDocumentNonBlocking(doc(db, 'assignments', a.id), update);
        }
      }
      toast({ title: "Audit-Ready", description: "Jira Tickets wurden erstellt." });
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
    <div className="space-y-10 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <Badge className="mb-2 rounded-full px-3 py-0 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border-none">Assignments</Badge>
          <h1 className="text-4xl font-headline font-bold tracking-tight text-slate-900 dark:text-white">Einzelzuweisungen</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Überblick für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-6 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 transition-all" onClick={handleBulkExpiredJira} disabled={isJiraActionLoading}>
            {isJiraActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ticket className="w-4 h-4 mr-2" />} Ablauf-Tickets
          </Button>
          <Button className="h-11 rounded-2xl font-bold uppercase text-[10px] tracking-widest px-8 shadow-lg shadow-primary/20" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Zuweisung erstellen
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="flex flex-col lg:flex-row gap-6 bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Mitarbeiter oder System suchen..." 
            className="pl-11 h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white transition-all shadow-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 px-5 py-2 border rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <ShieldAlert className={cn("w-4 h-4", adminOnly ? "text-red-600" : "text-slate-400")} />
          <Label htmlFor="admin-filter" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-slate-500">Privilegierte Rollen</Label>
          <Switch id="admin-filter" checked={adminOnly} onCheckedChange={setAdminOnly} />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
          {['all', 'active', 'requested', 'removed'].map(id => (
            <button 
              key={id} 
              className={cn(
                "px-4 h-9 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                activeTab === id ? "bg-white dark:bg-slate-800 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setActiveTab(id as any)}
            >
              {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Pending' : 'Historie'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Lade Zuweisungen...</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredAssignments.map((a) => {
              const user = users?.find(u => u.id === a.userId);
              const ent = entitlements?.find(e => e.id === a.entitlementId);
              const res = resources?.find(r => r.id === ent?.resourceId);
              const isAdmin = !!(ent?.isAdmin === true || ent?.isAdmin === 1 || ent?.isAdmin === "1");
              const isExpired = a.validUntil && new Date(a.validUntil) < new Date() && a.status === 'active';
              
              return (
                <Card key={a.id} className="border-none shadow-lg rounded-3xl overflow-hidden bg-white dark:bg-slate-900">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <UserCircle2 className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white leading-tight">{user?.displayName || a.userId}</h3>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{getTenantSlug(a.tenantId)}</p>
                        </div>
                      </div>
                      <Badge className={cn(
                        "rounded-full border-none px-3 text-[9px] font-black uppercase",
                        a.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                      )}>{a.status}</Badge>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-3 mb-6">
                      <div className="flex items-center gap-3">
                        <Layers className={cn("w-4 h-4", isAdmin ? "text-red-600" : "text-primary")} />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{res?.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 truncate uppercase">{ent?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> bis {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : '∞'}</span>
                        {isExpired && <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Abgelaufen</span>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800" onClick={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }}>
                        Details
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-10 h-10 p-0 rounded-xl border-slate-200 dark:border-slate-800"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl p-2 w-56 shadow-2xl">
                          <DropdownMenuItem className="rounded-xl py-2.5 gap-3" onSelect={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }}><Info className="w-4 h-4" /> Details anzeigen</DropdownMenuItem>
                          {a.status === 'active' && (
                            <DropdownMenuItem className="text-red-600 rounded-xl py-2.5 gap-3" onSelect={() => handleRevokeAssignment(a)}>
                              <Trash2 className="w-4 h-4" /> Zugriff widerrufen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-950/50">
                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                  <TableHead className="py-6 px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Mitarbeiter</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">System / Rolle</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Status</TableHead>
                  <TableHead className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Gültigkeit</TableHead>
                  <TableHead className="text-right px-8 font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((a) => {
                  const user = users?.find(u => u.id === a.userId);
                  const ent = entitlements?.find(e => e.id === a.entitlementId);
                  const res = resources?.find(r => r.id === ent?.resourceId);
                  const isAdmin = !!(ent?.isAdmin === true || ent?.isAdmin === 1 || ent?.isAdmin === "1");
                  const isExpired = a.validUntil && new Date(a.validUntil) < new Date() && a.status === 'active';
                  const isGroupManaged = !!a.originGroupId || a.syncSource === 'group';

                  return (
                    <TableRow key={a.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                      <TableCell className="py-5 px-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <UserIcon className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{user?.displayName || a.userId}</div>
                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{getTenantSlug(a.tenantId)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-xl", isAdmin ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
                            {isAdmin ? <ShieldAlert className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{res?.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{ent?.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge className={cn(
                            "rounded-full border-none px-3 h-6 text-[9px] font-black uppercase w-fit",
                            a.status === 'active' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-slate-100 text-slate-500"
                          )}>{a.status}</Badge>
                          {isGroupManaged && (
                            <Badge className="bg-indigo-50 text-indigo-600 border-none rounded-full text-[8px] font-black uppercase px-2 h-5 w-fit">
                              <Workflow className="w-2.5 h-2.5 mr-1" /> Gruppe
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={cn("text-xs font-bold flex items-center gap-2", isExpired ? "text-red-600" : "text-slate-600 dark:text-slate-400")}>
                          <CalendarDays className="w-3.5 h-3.5 opacity-50" />
                          {a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'}
                          {isExpired && <AlertTriangle className="w-3.5 h-3.5" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-9 rounded-xl text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all"
                            onClick={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }}
                          >
                            Details
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><MoreHorizontal className="w-5 h-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl">
                              <DropdownMenuItem onSelect={() => { setSelectedAssignment(a); setIsDetailsOpen(true); }} className="rounded-xl py-2.5 gap-3"><Info className="w-4 h-4 text-primary" /> Vollständige Details</DropdownMenuItem>
                              {a.status !== 'removed' && !isGroupManaged && (
                                <DropdownMenuItem className="text-red-600 rounded-xl py-2.5 gap-3" onSelect={() => handleRevokeAssignment(a)}>
                                  <Trash2 className="w-4 h-4" /> Zugriff widerrufen
                                </DropdownMenuItem>
                              )}
                              {isGroupManaged && (
                                <DropdownMenuItem disabled className="text-slate-400 italic rounded-xl py-2.5 gap-3">
                                  <Lock className="w-4 h-4" /> Gruppenverwaltet
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
        </>
      )}

      {/* Details Dialog optimized for readability */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] rounded-[3rem] p-0 overflow-hidden bg-white dark:bg-slate-950 border-none shadow-2xl">
          <DialogHeader className="p-10 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary font-black text-2xl shadow-xl shadow-black/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-headline font-bold tracking-tight uppercase">Zuweisung Details</DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                  <UserCircle className="w-3.5 h-3.5" /> {users?.find(u => u.id === selectedAssignment?.userId)?.displayName || 'Unbekannt'}
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-10 space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Status</Label>
                  <Badge className={cn("rounded-full px-4 h-7 text-[10px] font-black uppercase border-none", selectedAssignment?.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{selectedAssignment?.status}</Badge>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Mandant</Label>
                  <div className="flex items-center gap-2 font-black text-xs text-primary uppercase">
                    <Building2 className="w-4 h-4" /> {getTenantSlug(selectedAssignment?.tenantId)}
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Quelle</Label>
                  <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase border-slate-200 dark:border-slate-800 px-4 h-7">{selectedAssignment?.syncSource || 'Manuell'}</Badge>
                </div>
              </div>

              <div className="space-y-4">
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Identität</Label>
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center"><UserIcon className="w-5 h-5 text-slate-400" /></div>
                      <div>
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{users?.find(u => u.id === selectedAssignment?.userId)?.displayName}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-wider">{users?.find(u => u.id === selectedAssignment?.userId)?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Rolle & System</Label>
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center"><Layers className="w-5 h-5 text-primary" /></div>
                      {(() => {
                        const ent = entitlements?.find(e => e.id === selectedAssignment?.entitlementId);
                        const res = resources?.find(r => r.id === ent?.resourceId);
                        return (
                          <div>
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{res?.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">{ent?.name}</p>
                              {ent?.isAdmin && <Badge className="bg-red-50 text-red-600 border-none rounded-full text-[8px] h-4 font-black px-2">ADMIN</Badge>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-6">
                <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Gültig ab</p><p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedAssignment?.validFrom || 'Sofort'}</p></div>
                <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Gültig bis</p><p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedAssignment?.validUntil || '∞'}</p></div>
                <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Zertifiziert</p><p className="text-xs font-bold text-slate-700 dark:text-slate-300">{selectedAssignment?.lastReviewedAt ? new Date(selectedAssignment.lastReviewedAt).toLocaleDateString() : 'Ausstehend'}</p></div>
                <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Ticket</p><p className="text-xs font-bold text-primary font-mono">{selectedAssignment?.ticketRef || selectedAssignment?.jiraIssueKey || 'N/A'}</p></div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <Button onClick={() => setIsDetailsOpen(false)} className="rounded-xl h-12 px-12 font-black uppercase text-[10px] tracking-widest shadow-xl">Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog remains logic-identical but styled */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="max-w-sm rounded-[2.5rem] p-0 overflow-hidden bg-white dark:bg-slate-950 border-none shadow-2xl">
          <DialogHeader className="p-8 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
            <DialogTitle className="text-xl font-headline font-bold text-red-600 uppercase flex items-center gap-3">
              <AlertTriangle className="w-6 h-6" /> Zugriff entziehen
            </DialogTitle>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Mitarbeiter</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{users?.find(u => u.id === assignmentToRevoke?.userId)?.displayName}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Entzug wirksam bis</Label>
              <Input type="date" value={revokeValidUntil} onChange={e => setRevokeValidUntil(e.target.value)} className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t flex gap-3">
            <Button variant="ghost" onClick={() => setIsRevokeOpen(false)} className="flex-1 rounded-xl text-[10px] font-black uppercase">Abbrechen</Button>
            <Button onClick={confirmRevokeAssignment} disabled={isSaving} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest h-12 gap-2 shadow-lg shadow-red-200 dark:shadow-none">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Lade Daten...</p></div>}>
      <AssignmentsPageContent />
    </Suspense>
  );
}
