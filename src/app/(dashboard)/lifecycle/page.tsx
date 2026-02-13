
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UserPlus, 
  UserMinus, 
  Package, 
  Loader2, 
  Search,
  CheckCircle2,
  Zap,
  ShieldAlert,
  MoreHorizontal,
  Pencil,
  Trash2,
  Info,
  Layers,
  ChevronRight,
  UserCircle,
  Building2,
  User as UserIcon,
  Plus,
  AlertTriangle,
  Archive,
  RotateCcw,
  Save,
  Check,
  ArrowRight,
  Briefcase,
  Ticket,
  Mail,
  UserX
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { startOffboardingAction } from '@/app/actions/user-actions';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Bundle, JobTitle, Entitlement, Resource, Tenant, Assignment } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { usePlatformAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LifecyclePage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('joiner');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  // Onboarding Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewEmail] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [onboardingDate, setOnboardingDate] = useState(new Date().toISOString().split('T')[0]);

  // Offboarding State
  const [leaverSearch, setLeaverSearch] = useState('');
  const [selectedLeaverId, setSelectedLeaverId] = useState<string | null>(null);
  const [offboardingDate, setOffboardingDate] = useState(new Date().toISOString().split('T')[0]);

  // Rollen-Standardzuweisung Editor State
  const [isBundleCreateOpen, setIsBundleCreateOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false);

  // Deletion state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: users, isLoading: isUsersLoading, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: bundles, isLoading: isBundlesLoading, refresh: refreshBundles } = usePluggableCollection<Bundle>('bundles');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: jobs } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<any>('departments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';

  const sortedJobs = useMemo(() => {
    if (!jobs || !departments) return [];
    return [...jobs].sort((a, b) => {
      const deptA = departments.find((d: any) => d.id === a.departmentId)?.name || '';
      const deptB = departments.find((d: any) => d.id === b.departmentId)?.name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  }, [jobs, departments]);

  const activeUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u: any) => {
      const isEnabled = u.enabled === true || u.enabled === 1 || u.enabled === "1";
      const matchesSearch = u.displayName.toLowerCase().includes(leaverSearch.toLowerCase()) || u.email.toLowerCase().includes(leaverSearch.toLowerCase());
      const matchesTenant = activeTenantId === 'all' || u.tenantId === activeTenantId;
      return isEnabled && matchesSearch && matchesTenant;
    });
  }, [users, leaverSearch, activeTenantId]);

  const getFullRoleName = (jobId: string) => {
    const job = jobs?.find(j => j.id === jobId);
    if (!job) return jobId;
    const dept = departments?.find((d: any) => d.id === job.departmentId);
    return dept ? `${dept.name} — ${job.name}` : job.name;
  };

  const startOnboarding = async () => {
    if (!newUserName || !newUserEmail || (!selectedBundleId && !selectedJobId)) {
      toast({ variant: "destructive", title: "Fehler", description: "Name, E-Mail und entweder Paket oder Rolle sind erforderlich." });
      return;
    }
    
    setIsActionLoading(true);
    try {
      const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
      const timestamp = new Date().toISOString();
      const userId = `u-onb-${Math.random().toString(36).substring(2, 9)}`;
      
      const bundle = bundles?.find(b => b.id === selectedBundleId);
      const job = jobs?.find(j => j.id === selectedJobId);
      const dept = departments?.find((d: any) => d.id === job?.departmentId);
      
      const allEntitlementIds = new Set<string>();
      bundle?.entitlementIds.forEach(id => allEntitlementIds.add(id));
      job?.entitlementIds?.forEach(id => allEntitlementIds.add(id));

      const entitlementList = Array.from(allEntitlementIds);

      const userData = { 
        id: userId, 
        tenantId: targetTenantId, 
        externalId: `onb-${newUserEmail.split('@')[0]}`,
        displayName: newUserName, 
        email: newUserEmail, 
        enabled: true, 
        status: 'active', 
        onboardingDate, 
        department: dept?.name || '',
        title: job?.name || '',
        lastSyncedAt: timestamp 
      };
      await saveCollectionRecord('users', userId, userData, dataSource);

      let jiraDescription = `Automatisches Onboarding-Ticket erstellt via ComplianceHub Gateway.\n\n`;
      jiraDescription += `BENUTZERDATEN:\n`;
      jiraDescription += `- Name: ${newUserName}\n`;
      jiraDescription += `- E-Mail: ${newUserEmail}\n`;
      jiraDescription += `- Eintrittsdatum: ${onboardingDate}\n`;
      jiraDescription += `- Abteilung: ${dept?.name || '---'}\n\n`;
      
      jiraDescription += `BENÖTIGTE BERECHTIGUNGEN (${entitlementList.length}):\n`;
      for (const eid of entitlementList) {
        const ent = entitlements?.find(e => e.id === eid);
        const res = resources?.find(r => r.id === ent?.resourceId);
        if (ent && res) jiraDescription += `- [${res.name}] : ${ent.name}\n`;
      }

      const configs = await getJiraConfigs(dataSource);
      let jiraKey = 'manuell';
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(configs[0].id, `Onboarding: ${newUserName}`, jiraDescription, dataSource);
        if (res.success) jiraKey = res.key!;
      }

      for (const eid of entitlementList) {
        const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
        await saveCollectionRecord('assignments', assId, { 
          id: assId, tenantId: targetTenantId, userId, entitlementId: eid, status: 'requested', 
          grantedBy: user?.email || 'onboarding-wizard', grantedAt: timestamp, 
          validFrom: onboardingDate, jiraIssueKey: jiraKey, syncSource: 'manual' 
        }, dataSource);
      }

      toast({ title: "Onboarding gestartet", description: "Identität wurde angelegt." });
      setNewUserName(''); setNewEmail(''); setSelectedBundleId(null); setSelectedJobId(null);
      refreshUsers(); refreshAssignments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStartOffboarding = async () => {
    if (!selectedLeaverId) return;
    setIsActionLoading(true);
    try {
      const res = await startOffboardingAction(selectedLeaverId, offboardingDate, dataSource, user?.email || 'system');
      if (res.success) {
        toast({ title: "Offboarding eingeleitet", description: `Jira Ticket: ${res.jiraKey}` });
        setSelectedLeaverId(null);
        setLeaverSearch('');
        refreshUsers(); refreshAssignments();
      } else {
        toast({ variant: "destructive", title: "Fehler", description: res.error });
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Identity Lifecycle</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Lifecycle Hub</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Steuerung von Ein- und Austrittsprozessen.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 h-11 rounded-lg border w-full justify-start gap-1 p-1 overflow-x-auto no-scrollbar">
          <TabsTrigger value="joiner" className="px-6 text-[11px] font-bold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <UserPlus className="w-3.5 h-3.5 mr-2" /> Onboarding (Joiner)
          </TabsTrigger>
          <TabsTrigger value="leaver" className="px-6 text-[11px] font-bold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <UserX className="w-3.5 h-3.5 mr-2" /> Offboarding (Leaver)
          </TabsTrigger>
          <TabsTrigger value="bundles" className="px-6 text-[11px] font-bold rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Package className="w-3.5 h-3.5 mr-2" /> Rollenpakete
          </TabsTrigger>
        </TabsList>

        <TabsContent value="joiner" className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="rounded-xl shadow-sm border overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b py-4">
              <div className="flex items-center gap-3"><CardTitle className="text-sm font-bold">Mitarbeiter-Eintritt</CardTitle></div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Stammdaten & Profil</Label>
                    <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Vollständiger Name" className="h-11 rounded-xl" />
                    <Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} placeholder="E-Mail Adresse" className="h-11 rounded-xl" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-slate-400">Eintrittsdatum</Label>
                        <Input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-slate-400">Rollenprofil (Blueprint)</Label>
                        <Select value={selectedJobId || ''} onValueChange={setSelectedJobId}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                          <SelectContent>
                            {sortedJobs?.filter((j: any) => activeTenantId === 'all' || j.tenantId === activeTenantId).map((job: any) => (
                              <SelectItem key={job.id} value={job.id}>{getFullRoleName(job.id)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Zusatz-Pakete</Label>
                  <ScrollArea className="h-[250px] border rounded-xl p-2 bg-slate-50/50 shadow-inner">
                    <div className="space-y-2">
                      {bundles?.filter(b => b.status === 'active' && (activeTenantId === 'all' || b.tenantId === activeTenantId)).map(bundle => (
                        <div 
                          key={bundle.id} 
                          className={cn(
                            "p-3 rounded-lg border bg-white cursor-pointer transition-all",
                            selectedBundleId === bundle.id ? "border-primary ring-1 ring-primary/20" : "hover:border-primary/30"
                          )}
                          onClick={() => setSelectedBundleId(selectedBundleId === bundle.id ? null : bundle.id)}
                        >
                          <p className="text-xs font-bold text-slate-800">{bundle.name}</p>
                          <p className="text-[9px] text-slate-400">{bundle.entitlementIds?.length || 0} Rechte</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t bg-slate-50/50 flex justify-end">
              <Button onClick={startOnboarding} disabled={isActionLoading || !newUserName} className="h-11 px-12 rounded-xl font-bold text-xs uppercase gap-2 bg-primary shadow-lg shadow-primary/20">
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Onboarding starten
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leaver" className="animate-in fade-in slide-in-from-bottom-2">
          <Card className="rounded-xl shadow-sm border overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <CardTitle className="text-sm font-bold">Mitarbeiter-Austritt einleiten</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Benutzer-Selektion</Label>
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input placeholder="Mitarbeiter suchen..." value={leaverSearch} onChange={e => setLeaverSearch(e.target.value)} className="h-11 pl-10 rounded-xl" />
                    </div>
                    <ScrollArea className="h-[250px] border rounded-xl p-2 bg-slate-50/50">
                      <div className="space-y-1">
                        {activeUsers.map(u => (
                          <div 
                            key={u.id} 
                            className={cn(
                              "p-3 rounded-lg border bg-white cursor-pointer transition-all flex items-center justify-between",
                              selectedLeaverId === u.id ? "border-red-500 ring-1 ring-red-500/20 bg-red-50/10" : "hover:border-red-200"
                            )}
                            onClick={() => setSelectedLeaverId(u.id)}
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-800">{u.displayName}</p>
                              <p className="text-[9px] text-slate-400 italic">{u.email}</p>
                            </div>
                            {selectedLeaverId === u.id && <Check className="w-4 h-4 text-red-600" />}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Zeitpunkt & Details</Label>
                    <div className="p-4 bg-slate-50 rounded-xl border space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-bold text-slate-400">Letzter Arbeitstag</Label>
                        <Input type="date" value={offboardingDate} onChange={e => setOffboardingDate(e.target.value)} className="h-11 rounded-xl bg-white" />
                      </div>
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black uppercase text-red-900">Aktion: Deprovisionierung</p>
                          <p className="text-[9px] text-red-700 italic leading-relaxed">
                            Alle aktiven Berechtigungen werden auf 'Entzug angefordert' gesetzt. Ein Jira-Ticket zur technischen Umsetzung wird erstellt.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t bg-slate-50/50 flex justify-end">
              <Button onClick={handleStartOffboarding} disabled={isActionLoading || !selectedLeaverId} className="h-11 px-12 rounded-xl font-bold text-xs uppercase gap-2 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100">
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />} Offboarding starten
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bundles">
          {/* Bundle Management UI */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow><TableHead className="py-4 px-6">Paket</TableHead><TableHead>Umfang</TableHead><TableHead className="text-right px-6">Aktionen</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {bundles?.map(b => (
                  <TableRow key={b.id} className="group hover:bg-slate-50">
                    <TableCell className="py-4 px-6 font-bold text-sm">{b.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-bold">{b.entitlementIds?.length || 0} Rollen</Badge></TableCell>
                    <TableCell className="text-right px-6">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100" onClick={() => deleteCollectionRecord('bundles', b.id, dataSource).then(() => refreshBundles())}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
