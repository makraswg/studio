
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  Loader2,
  Pencil,
  UserCircle,
  MoreVertical,
  Building2,
  Download,
  Filter,
  UserPlus,
  Mail,
  Info,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Briefcase,
  Eye,
  ArrowRight,
  Trash2,
  Save
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  useUser as useAuthUser
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useRouter as useNextRouter } from 'next/navigation';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportUsersExcel } from '@/lib/export-utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function UsersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { user: authUser } = useAuthUser();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isDialogOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [userTitle, setUserTitle] = useState('');

  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'disabled' | 'drift'>('all');

  const { data: users, isLoading, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: tenants } = usePluggableCollection<any>('tenants');
  const { data: assignments } = usePluggableCollection<any>('assignments');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: jobTitles } = usePluggableCollection<any>('jobTitles');
  const { data: departmentsData } = usePluggableCollection<any>('departments');
  const { refresh: refreshAudit } = usePluggableCollection<any>('auditEvents');

  useEffect(() => { setMounted(true); }, []);

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'null' || id === 'undefined') return '—';
    const tenant = tenants?.find((t: any) => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const getFullRoleName = (roleName: string, roleTenantId: string) => {
    const job = jobTitles?.find((j: any) => j.name === roleName && j.tenantId === roleTenantId);
    if (!job) return roleName;
    const dept = departmentsData?.find((d: any) => d.id === job.departmentId);
    return dept ? `${dept.name} — ${job.name}` : job.name;
  };

  const sortedRoles = useMemo(() => {
    if (!jobTitles || !departmentsData) return [];
    return [...jobTitles].sort((a, b) => {
      const deptA = departmentsData.find((d: any) => d.id === a.departmentId)?.name || '';
      const deptB = departmentsData.find((d: any) => d.id === b.departmentId)?.name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  }, [jobTitles, departmentsData]);

  const calculateDrift = (user: any) => {
    if (!user || !entitlements || !assignments) return { hasDrift: false, missing: [], extra: [], integrity: 100 };

    const userAssignments = assignments.filter((a: any) => a.userId === user.id && a.status === 'active');
    const assignedEntitlementIds = userAssignments.map((a: any) => a.entitlementId);
    
    const job = jobTitles?.find((j: any) => j.name === user.title && j.tenantId === user.tenantId);
    const blueprintIds = job?.entitlementIds || [];
    
    const targetEntitlementIds = Array.from(new Set([...assignedEntitlementIds, ...blueprintIds]));
    const targetGroups = targetEntitlementIds
      .map(eid => entitlements.find((e: any) => e.id === eid)?.externalMapping)
      .filter(Boolean) as string[];

    const actualGroups = user.adGroups || [];

    const missing = targetGroups.filter(g => !actualGroups.includes(g));
    const extra = actualGroups.filter((g: string) => {
      const isManaged = entitlements.some((e: any) => e.externalMapping === g);
      return isManaged && !targetGroups.includes(g);
    });

    const hasDrift = missing.length > 0 || extra.length > 0;
    const integrity = Math.max(0, 100 - (missing.length * 10) - (extra.length * 20));

    return { hasDrift, missing, extra, integrity };
  };

  const handleSaveUser = async () => {
    if (!displayName || !email || !tenantId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Pflichtfelder ausfüllen." });
      return;
    }

    setIsSaving(true);
    const userId = selectedUser?.id || `u-${Math.random().toString(36).substring(2, 9)}`;
    const isNew = !selectedUser;
    
    const userData = {
      ...selectedUser,
      id: userId,
      displayName,
      email,
      department,
      tenantId,
      title: userTitle,
      enabled: selectedUser ? (selectedUser.enabled === true || selectedUser.enabled === 1) : true,
      lastSyncedAt: new Date().toISOString()
    };

    try {
      if (dataSource === 'mysql') {
        const res = await saveCollectionRecord('users', userId, userData, dataSource);
        if (!res.success) throw new Error(res.error || "MySQL-Speicherfehler");
      } else {
        setDocumentNonBlocking(doc(db, 'users', userId), userData);
      }

      await logAuditEventAction(dataSource, {
        tenantId: tenantId,
        actorUid: authUser?.email || 'system',
        action: isNew ? 'Benutzer erstellt' : 'Benutzer aktualisiert',
        entityType: 'user',
        entityId: userId,
        after: userData
      });

      toast({ title: selectedUser ? "Benutzer aktualisiert" : "Benutzer angelegt" });
      setIsAddOpen(false);
      resetForm();
      setTimeout(() => { refreshUsers(); refreshAudit(); }, 200);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Speichern fehlgeschlagen", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedUser(null);
    setDisplayName('');
    setEmail('');
    setDepartment('');
    setUserTitle('');
    setTenantId(activeTenantId !== 'all' ? activeTenantId : '');
  };

  const openEdit = (user: any) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setEmail(user.email);
    setDepartment(user.department || '');
    setUserTitle(user.title || '');
    setTenantId(user.tenantId);
    setIsAddOpen(true);
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user: any) => {
      if (activeTenantId !== 'all' && user.tenantId !== activeTenantId) return false;
      const matchesSearch = (user.displayName || '').toLowerCase().includes(search.toLowerCase()) || (user.email || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      
      const isEnabled = user.enabled === true || user.enabled === 1 || user.enabled === "1";
      if (activeStatusFilter === 'active' && !isEnabled) return false;
      if (activeStatusFilter === 'disabled' && isEnabled) return false;
      
      if (activeStatusFilter === 'drift') {
        const drift = calculateDrift(user);
        if (!drift.hasDrift) return false;
      }

      return true;
    });
  }, [users, search, activeTenantId, activeStatusFilter, assignments, entitlements, jobTitles]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">IAM Directory</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Benutzerverzeichnis</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Identitäten für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs px-4 border-slate-200 active:scale-95" onClick={() => exportUsersExcel(filteredUsers, tenants || [])}>
            <Download className="w-3.5 h-3.5 mr-2" /> Excel
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-sm active:scale-95 transition-all" onClick={() => { resetForm(); setIsAddOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Benutzer anlegen
          </Button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Name oder E-Mail suchen..." 
            className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-none text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md border border-slate-200 dark:border-slate-700 h-9 shrink-0">
          {[
            { id: 'all', label: 'Alle' },
            { id: 'active', label: 'Aktiv' },
            { id: 'disabled', label: 'Inaktiv' },
            { id: 'drift', label: 'AD Drift ⚡' }
          ].map(f => (
            <button 
              key={f.id} 
              className={cn(
                "px-4 h-full text-[9px] font-bold rounded-sm transition-all whitespace-nowrap",
                activeStatusFilter === f.id ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setActiveStatusFilter(f.id as any)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-20" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Identität</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Rollen-Standardzuweisung</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Integrität (AD Sync)</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((u: any) => {
                const isEnabled = u.enabled === true || u.enabled === 1 || u.enabled === "1";
                const drift = calculateDrift(u);
                
                return (
                  <TableRow key={u.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => router.push(`/users/${u.id}`)}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-primary font-bold text-xs border">
                          {u.displayName?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 group-hover:text-primary transition-colors">{u.displayName}</div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3" /> {u.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                        <Briefcase className="w-3 h-3 text-slate-300" />
                        {getFullRoleName(u.title, u.tenantId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-24 space-y-1">
                          <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                            <span>Integrity</span>
                            <span className={drift.integrity === 100 ? "text-emerald-600" : "text-amber-600"}>{drift.integrity}%</span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn("h-full transition-all", drift.integrity === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${drift.integrity}%` }} />
                          </div>
                        </div>
                        {drift.hasDrift && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="p-1 rounded-md bg-amber-50 text-amber-600 border border-amber-100 cursor-help">
                                  <ShieldAlert className="w-3 h-3" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="p-3 bg-slate-900 text-white rounded-lg border-none shadow-xl">
                                <p className="text-[9px] font-black uppercase text-amber-400 mb-1">Abweichung erkannt</p>
                                <p className="text-[10px] leading-relaxed">Rollen in AD stimmen nicht mit Hub-Definition überein.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[8px] font-bold rounded-full border-none px-2 h-5", isEnabled ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                        {isEnabled ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-white shadow-sm" onClick={() => router.push(`/users/${u.id}`)}>
                          <Eye className="w-3.5 h-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-white shadow-sm" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-all"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                            <DropdownMenuItem onSelect={() => router.push(`/users/${u.id}`)} className="rounded-md py-2 gap-2 text-xs font-bold"><Eye className="w-3.5 h-3.5 text-primary" /> Profil ansehen</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openEdit(u)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuItem className="text-indigo-600 rounded-md py-2 gap-2 text-xs font-bold" onSelect={() => router.push(`/reviews?search=${u.displayName}`)}><Zap className="w-3.5 h-3.5" /> Review anstoßen</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(val) => { if(!val && !isSaving) setIsAddOpen(false); }}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <UserCircle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {selectedUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label required className="text-[11px] font-bold text-slate-400 ml-1">Anzeigename</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} disabled={isSaving} className="rounded-md h-11 border-slate-200" />
            </div>
            <div className="space-y-2">
              <Label required className="text-[11px] font-bold text-slate-400 ml-1">E-Mail</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} disabled={isSaving} className="rounded-md h-11 border-slate-200" />
            </div>
            <div className="space-y-2">
              <Label required className="text-[11px] font-bold text-slate-400 ml-1">Mandant</Label>
              <Select value={tenantId} onValueChange={setTenantId} disabled={isSaving}>
                <SelectTrigger className="h-11 rounded-md border-slate-200"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {tenants?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label required className="text-[11px] font-bold text-slate-400 ml-1">Rollen-Standardzuweisung</Label>
              <Select value={userTitle} onValueChange={setUserTitle} disabled={isSaving}>
                <SelectTrigger className="h-11 rounded-md border-slate-200"><SelectValue placeholder="Zuweisung wählen..." /></SelectTrigger>
                <SelectContent>
                  {sortedRoles?.filter((j: any) => tenantId === '' || tenantId === 'all' || j.tenantId === tenantId).map((j: any) => (
                    <SelectItem key={j.id} value={j.name}>{getFullRoleName(j.name, j.tenantId)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} disabled={isSaving} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleSaveUser} disabled={isSaving} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-sm">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {selectedUser ? 'Aktualisieren' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
