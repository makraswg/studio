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
  Mail
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
import { Bundle, JobTitle, Entitlement, Resource, Tenant } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { usePlatformAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LifecyclePage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const router = useRouter();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
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

  // Bundle Editor State
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
  const { data: departments } = usePluggableCollection<Department>('departments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';

  const sortedJobs = useMemo(() => {
    if (!jobs || !departments) return [];
    return [...jobs].sort((a, b) => {
      const deptA = departments.find(d => d.id === a.departmentId)?.name || '';
      const deptB = departments.find(d => d.id === b.departmentId)?.name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });
  }, [jobs, departments]);

  const getFullRoleName = (jobId: string) => {
    const job = jobs?.find(j => j.id === jobId);
    if (!job) return jobId;
    const dept = departments?.find(d => d.id === job.departmentId);
    return dept ? `${dept.name} — ${job.name}` : job.name;
  };

  const getTenantSlug = (id?: string | null) => {
    if (!id || id === 'all' || id === 'global') return 'global';
    const tenant = tenants?.find((t: any) => t.id === id);
    return tenant ? tenant.slug : id;
  };

  const filteredRoles = useMemo(() => {
    if (!entitlements || !resources) return [];
    return entitlements.filter((e: any) => {
      const res = resources.find((r: any) => r.id === e.resourceId);
      const isGlobal = res?.tenantId === 'global' || !res?.tenantId;
      if (activeTenantId !== 'all' && !isGlobal && res?.tenantId !== activeTenantId) return false;
      const matchSearch = e.name.toLowerCase().includes(roleSearchTerm.toLowerCase()) || res?.name.toLowerCase().includes(roleSearchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (adminOnlyFilter && !e.isAdmin) return false;
      return true;
    });
  }, [entitlements, resources, roleSearchTerm, adminOnlyFilter, activeTenantId]);

  const handleCreateBundle = async () => {
    if (!bundleName || selectedEntitlementIds.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und Rollen sind erforderlich." });
      return;
    }
    const bundleId = selectedBundle?.id || `bundle-${Math.random().toString(36).substring(2, 9)}`;
    const targetTenantId = activeTenantId === 'all' ? 't1' : activeTenantId;
    
    const bundleData: Bundle = {
      ...selectedBundle,
      id: bundleId,
      tenantId: targetTenantId,
      name: bundleName,
      description: bundleDesc,
      status: selectedBundle?.status || 'active',
      entitlementIds: selectedEntitlementIds
    };
    
    try {
      const res = await saveCollectionRecord('bundles', bundleId, bundleData, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: targetTenantId,
          actorUid: user?.email || 'system',
          action: selectedBundle ? `Onboarding-Paket aktualisiert: ${bundleName}` : `Onboarding-Paket erstellt: ${bundleName}`,
          entityType: 'bundle',
          entityId: bundleId,
          after: bundleData
        });

        toast({ title: selectedBundle ? "Paket aktualisiert" : "Paket erstellt" });
        setIsBundleCreateOpen(false);
        refreshBundles();
      } else throw new Error(res.error || "Fehler beim Speichern");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const handleBundleStatusChange = async (bundle: Bundle, newStatus: 'active' | 'archived') => {
    const updated = { ...bundle, status: newStatus };
    const res = await saveCollectionRecord('bundles', bundle.id, updated, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource, {
        tenantId: bundle.tenantId || 'global',
        actorUid: user?.email || 'system',
        action: `${newStatus === 'archived' ? 'Paket archiviert' : 'Paket reaktiviert'}: ${bundle.name}`,
        entityType: 'bundle',
        entityId: bundle.id,
        after: updated
      });
      toast({ title: newStatus === 'archived' ? "Paket archiviert" : "Paket reaktiviert" });
      refreshBundles();
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteCollectionRecord('bundles', deleteTarget.id, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: 'global',
          actorUid: user?.email || 'system',
          action: `Onboarding-Paket permanent gelöscht: ${deleteTarget.label}`,
          entityType: 'bundle',
          entityId: deleteTarget.id
        });

        toast({ title: "Paket permanent gelöscht" });
        refreshBundles();
        setDeleteTarget(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditBundle = (bundle: Bundle) => {
    setSelectedBundle(bundle);
    setBundleName(bundle.name);
    setBundleDesc(bundle.description || '');
    setSelectedEntitlementIds(bundle.entitlementIds || []);
    setIsBundleCreateOpen(true);
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
      const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
      
      // 1. Combine roles from Bundle and Job Blueprint
      const bundle = bundles?.find(b => b.id === selectedBundleId);
      const job = jobs?.find(j => j.id === selectedJobId);
      
      const allEntitlementIds = new Set<string>();
      bundle?.entitlementIds.forEach(id => allEntitlementIds.add(id));
      job?.entitlementIds?.forEach(id => allEntitlementIds.add(id));

      const entitlementList = Array.from(allEntitlementIds);

      // 2. Create User Record
      const userData = { 
        id: userId, 
        tenantId: targetTenantId, 
        displayName: newUserName, 
        email: newUserEmail, 
        enabled: true, 
        status: 'active', 
        onboardingDate, 
        title: job?.name || '',
        lastSyncedAt: timestamp 
      };
      await saveCollectionRecord('users', userId, userData, dataSource);

      // 3. Build Detailed Jira Description
      let jiraDescription = `Automatisches Onboarding-Ticket erstellt via ComplianceHub Gateway.\n\n`;
      jiraDescription += `BENUTZERDATEN:\n`;
      jiraDescription += `- Name: ${newUserName}\n`;
      jiraDescription += `- E-Mail: ${newUserEmail}\n`;
      jiraDescription += `- Eintrittsdatum: ${onboardingDate}\n`;
      jiraDescription += `- Rollenprofil: ${job?.name || 'Keine Angabe'}\n\n`;
      
      jiraDescription += `GEWÄHLTE PROFILE:\n`;
      if (bundle) jiraDescription += `- Paket: ${bundle.name}\n`;
      if (job) jiraDescription += `- Blueprint: ${job.name}\n`;
      jiraDescription += `\nBENÖTIGTE BERECHTIGUNGEN (${entitlementList.length}):\n`;

      for (const eid of entitlementList) {
        const ent = entitlements?.find(e => e.id === eid);
        const res = resources?.find(r => r.id === ent?.resourceId);
        if (ent && res) {
          jiraDescription += `- [${res.name}] : ${ent.name}${ent.isAdmin ? ' (ADMIN-RECHTE ERFORDERLICH!)' : ''}\n`;
        } else {
          jiraDescription += `- Unbekannte Berechtigung (ID: ${eid})\n`;
        }
      }

      // 4. Create Jira Ticket
      const configs = await getJiraConfigs(dataSource);
      let jiraKey = 'manuell';
      
      if (configs.length > 0 && configs[0].enabled) {
        const res = await createJiraTicket(
          configs[0].id, 
          `Onboarding: ${newUserName} (${job?.name || 'Mitarbeiter'})`, 
          jiraDescription, 
          dataSource
        );
        if (res.success) {
          jiraKey = res.key!;
          toast({ title: "Jira Ticket erstellt", description: `Vorgang ${jiraKey} wurde angelegt.` });
        }
      }

      // 5. Create Assignments in requested state
      for (const eid of entitlementList) {
        const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
        const assData = { 
          id: assId, 
          tenantId: targetTenantId, 
          userId, 
          entitlementId: eid, 
          status: 'requested', 
          grantedBy: authUser?.email || 'onboarding-wizard', 
          grantedAt: timestamp, 
          validFrom: onboardingDate, 
          jiraIssueKey: jiraKey, 
          syncSource: 'manual' 
        };
        await saveCollectionRecord('assignments', assId, assData, dataSource);
      }

      await logAuditEventAction(dataSource, {
        tenantId: targetTenantId,
        actorUid: authUser?.email || 'onboarding-wizard',
        action: `Onboarding Prozess gestartet: ${newUserName} (Jira: ${jiraKey})`,
        entityType: 'user',
        entityId: userId,
        after: userData
      });

      toast({ title: "Onboarding Prozess aktiv", description: "Identität und Zuweisungen wurden vorbereitet." });
      
      // Reset Form
      setNewUserName(''); 
      setNewEmail(''); 
      setSelectedBundleId(null); 
      setSelectedJobId(null);
      
      setTimeout(() => { refreshUsers(); refreshAssignments(); }, 300);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Identity Lifecycle</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Lifecycle Hub</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automatisierte On- und Offboarding-Prozesse für {activeTenantId === 'all' ? 'alle Standorte' : getTenantSlug(activeTenantId)}.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold text-xs gap-2" onClick={() => { 
            setSelectedBundle(null); setBundleName(''); setBundleDesc(''); setSelectedEntitlementIds([]); setIsBundleCreateOpen(true); 
          }}>
            <Package className="w-3.5 h-3.5" /> Paket definieren
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800 h-11 rounded-lg border w-full justify-start gap-1 p-1 overflow-x-auto no-scrollbar">
          <TabsTrigger value="joiner" className="px-6 text-[11px] font-bold rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
            <UserPlus className="w-3.5 h-3.5 mr-2" /> Onboarding
          </TabsTrigger>
          <TabsTrigger value="leaver" className="px-6 text-[11px] font-bold rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
            <UserMinus className="w-3.5 h-3.5 mr-2" /> Offboarding
          </TabsTrigger>
          <TabsTrigger value="bundles" className="px-6 text-[11px] font-bold rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
            <Package className="w-3.5 h-3.5 mr-2" /> Rollenpakete
          </TabsTrigger>
        </TabsList>

        <TabsContent value="joiner">
          <Card className="rounded-xl shadow-sm border overflow-hidden bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <UserPlus className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100">Neuen Eintritt registrieren</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest">Stammdaten des Mitarbeiters</Label>
                    <div className="space-y-4 pt-2">
                      <div className="relative group">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Vollständiger Name" className="rounded-xl h-11 pl-10 border-slate-200 bg-slate-50/50" />
                      </div>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                        <Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} placeholder="E-Mail Adresse" className="rounded-xl h-11 pl-10 border-slate-200 bg-slate-50/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold text-slate-400 ml-1">Eintritt am</Label>
                          <Input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} className="rounded-xl h-11 border-slate-200 bg-slate-50/50" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[9px] font-bold text-slate-400 ml-1 uppercase tracking-widest">Rollenprofil</Label>
                          <Select value={selectedJobId || ''} onValueChange={setSelectedJobId}>
                            <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white">
                              <SelectValue placeholder="Rolle wählen..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {sortedJobs?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(job => (
                                <SelectItem key={job.id} value={job.id} className="text-xs font-bold">
                                  {getFullRoleName(job.id)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black uppercase text-slate-900 tracking-wider">Jira Gateway Aktiv</p>
                      <p className="text-[10px] text-slate-500 italic leading-relaxed">
                        Das System erstellt automatisch ein Provisionierungsticket für die IT-Abteilung inklusive aller Blueprint-Berechtigungen.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-widest">Zusatz-Rollenpaket wählen</Label>
                    <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black px-2 h-4 uppercase">Optionen</Badge>
                  </div>
                  <ScrollArea className="h-[320px] rounded-2xl border border-slate-100 bg-slate-50/30 p-2 shadow-inner">
                    <div className="grid grid-cols-1 gap-2">
                      <div 
                        className={cn(
                          "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                          !selectedBundleId ? "border-slate-300 bg-slate-100 ring-1 ring-slate-200 shadow-sm" : "bg-white dark:bg-slate-800 border-slate-100 hover:border-slate-200"
                        )} 
                        onClick={() => setSelectedBundleId(null)}
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-800">Kein Zusatz-Paket</span>
                          <p className="text-[9px] text-slate-400 font-medium mt-0.5">Nur Blueprint-Rollen verwenden</p>
                        </div>
                        {!selectedBundleId && <CheckCircle2 className="w-4 h-4 text-slate-500" />}
                      </div>
                      <Separator className="my-1 opacity-50" />
                      {bundles?.filter(b => b.status !== 'archived' && (activeTenantId === 'all' || b.tenantId === activeTenantId)).map(bundle => (
                        <div 
                          key={bundle.id} 
                          className={cn(
                            "p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                            selectedBundleId === bundle.id ? "border-primary bg-primary/5 ring-2 ring-primary/5 shadow-sm" : "bg-white dark:bg-slate-800 border-slate-100 hover:border-slate-200"
                          )} 
                          onClick={() => setSelectedBundleId(bundle.id)}
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">{bundle.name}</span>
                            <p className="text-[9px] text-slate-400 font-medium mt-0.5">{bundle.entitlementIds?.length || 0} Berechtigungen inkludiert</p>
                          </div>
                          {selectedBundleId === bundle.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t bg-slate-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 italic">
                <Info className="w-3.5 h-3.5" />
                Initial-Passwort wird automatisch generiert und per E-Mail versendet.
              </div>
              <Button 
                onClick={startOnboarding} 
                disabled={isActionLoading || (!selectedBundleId && !selectedJobId) || !newUserName} 
                className="w-full md:w-auto rounded-xl font-bold text-[10px] uppercase tracking-widest h-12 px-16 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 active:scale-95 transition-all gap-2"
              >
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Onboarding starten
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leaver">
          <Card className="rounded-xl shadow-sm border bg-white dark:bg-slate-900">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shadow-inner">
                  <UserMinus className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100">Offboarding & Austritt</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-10 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-dashed border-slate-200">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">Mitarbeiter suchen</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Nutzen Sie das Benutzerverzeichnis, um bei einem Austritt alle Berechtigungen gesammelt zu entziehen und ein Jira-Ticket zur Hardware-Rückgabe zu erstellen.
                </p>
              </div>
              <Button variant="outline" className="rounded-md font-bold text-xs h-10 px-8 border-slate-200 mt-4" onClick={() => router.push('/users')}>
                Zum Benutzerverzeichnis <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Pakete suchen..." 
                className="pl-9 h-9 rounded-md border-slate-200 bg-white"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold gap-2" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {showArchived ? 'Aktive Pakete' : 'Archiv'}
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Rollenpaket</TableHead>
                  <TableHead className="font-bold text-[11px] text-slate-400">Mandant</TableHead>
                  <TableHead className="font-bold text-[11px] text-slate-400 text-center">Inhalt</TableHead>
                  <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles?.filter(b => (showArchived ? b.status === 'archived' : b.status !== 'archived') && (activeTenantId === 'all' || b.tenantId === activeTenantId)).map(bundle => (
                  <TableRow key={bundle.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0", bundle.status === 'archived' && "opacity-60")}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800">{bundle.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{bundle.description || 'Keine Beschreibung'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-full text-[8px] font-bold border-slate-200 text-slate-500 px-2 h-5">
                        {getTenantSlug(bundle.tenantId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="rounded-full bg-slate-50 text-slate-600 border-none font-bold text-[10px] h-5 px-2">
                        {bundle.entitlementIds?.length || 0} Rollen
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => openEditBundle(bundle)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 rounded-md transition-all"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-lg p-1 w-56 shadow-xl border">
                            <DropdownMenuItem onSelect={() => openEditBundle(bundle)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Paket bearbeiten</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem 
                              className={cn("rounded-md py-2 gap-2 text-xs font-bold", bundle.status === 'archived' ? "text-emerald-600" : "text-red-600")} 
                              onSelect={() => handleBundleStatusChange(bundle, bundle.status === 'archived' ? 'active' : 'archived')}
                            >
                              {bundle.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                              {bundle.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                            </DropdownMenuItem>
                            {isSuperAdmin && (
                              <DropdownMenuItem className="text-red-600 font-bold" onSelect={() => setDeleteTarget({ id: bundle.id, label: bundle.name })}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Permanent löschen
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bundle Create/Edit Dialog */}
      <Dialog open={isBundleCreateOpen} onOpenChange={setIsBundleCreateOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] rounded-xl flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-primary shadow-xl border border-white/10">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">{selectedBundle ? 'Onboarding-Paket bearbeiten' : 'Neues Paket definieren'}</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold mt-0.5">Vordefinierte Systemrollen für neue Mitarbeiter</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Paketbezeichnung</Label>
                  <Input value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="z.B. Marketing Basis, IT-Entwickler..." className="rounded-md h-11 border-slate-200 font-bold text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Beschreibung</Label>
                  <Input value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} placeholder="Zweck des Pakets..." className="rounded-md h-11 border-slate-200 text-sm" />
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <Label className="text-[11px] font-bold text-primary flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Systemrollen auswählen ({selectedEntitlementIds.length} gewählt)
                    </Label>
                    <p className="text-[10px] text-slate-400 mt-0.5">Diese Rollen werden bei Aktivierung des Pakets automatisch zugewiesen.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                      <Input 
                        placeholder="Rollen filtern..." 
                        value={roleSearchTerm}
                        onChange={e => setRoleSearchTerm(e.target.value)}
                        className="h-8 pl-8 text-[10px] rounded-md min-w-[180px]"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 h-8 border rounded-md bg-slate-50 text-slate-500">
                      <ShieldAlert className="w-3 h-3" />
                      <span className="text-[9px] font-bold">Admin-Only</span>
                      <Switch checked={adminOnlyFilter} onCheckedChange={setAdminOnlyFilter} className="scale-75" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredRoles.map((ent: any) => {
                    const res = resources?.find((r: any) => r.id === ent.resourceId);
                    return (
                      <div 
                        key={ent.id} 
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer transition-all flex items-center gap-3 group shadow-sm",
                          selectedEntitlementIds.includes(ent.id) 
                            ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500/20" 
                            : "bg-white dark:bg-slate-800 border-slate-100 hover:border-slate-200"
                        )} 
                        onClick={() => setSelectedEntitlementIds(prev => 
                          selectedEntitlementIds.includes(ent.id) ? prev.filter(id => id !== ent.id) : [...prev, ent.id]
                        )}
                      >
                        <Checkbox checked={selectedEntitlementIds.includes(ent.id)} className="rounded-sm h-4 w-4" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{ent.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] font-black uppercase text-slate-400">{res?.name}</span>
                            {ent.isAdmin && <Badge className="bg-red-50 text-red-600 border-none rounded-full h-3 px-1 text-[6px] font-black">Admin</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-800 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsBundleCreateOpen(false)} className="rounded-md h-10 px-8 font-bold text-[11px]">Abbrechen</Button>
            <Button 
              onClick={handleCreateBundle} 
              disabled={isActionLoading || !bundleName} 
              className="rounded-md h-10 px-12 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Änderungen speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center">Paket permanent löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Möchten Sie das Onboarding-Paket <strong>{deleteTarget?.label}</strong> wirklich permanent löschen? 
              <br/><br/>
              <span className="text-red-600 font-bold">Achtung:</span> Diese Aktion kann nicht rückgängig gemacht werden. Bestehende Mitarbeiter-Accounts bleiben unberührt, aber das Paket kann nicht mehr für neue Eintritte genutzt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-md font-bold text-xs h-11 px-8 border-slate-200">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-xs h-11 px-10 gap-2 shadow-lg"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Permanent löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}