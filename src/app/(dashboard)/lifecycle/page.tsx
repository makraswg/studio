
"use client";

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UserPlus, 
  UserMinus, 
  Package, 
  ArrowRight, 
  Loader2, 
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  MoreHorizontal,
  ShieldAlert,
  Filter
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
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

export default function LifecyclePage() {
  const { dataSource } = useSettings();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // States
  const [activeTab, setActiveTab] = useState('joiner');
  const [search, setSearch] = useState('');
  
  // Joiner State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewEmail] = useState('');
  const [newUserDept, setNewDept] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [onboardingDate, setOnboardingDate] = useState(new Date().toISOString().split('T')[0]);

  // Bundle Create State
  const [isBundleCreateOpen, setIsBundleCreateOpen] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<string[]>([]);
  const [roleSearchTerm, setRoleSearchTerm] = useState('');
  const [adminOnlyFilter, setAdminOnlyFilter] = useState(false);

  // Offboarding Confirmation State
  const [userToOffboard, setUserToOffboard] = useState<any>(null);
  const [isOffboardConfirmOpen, setIsOffboardConfirmOpen] = useState(false);

  const { data: users, refresh: refreshUsers } = usePluggableCollection<any>('users');
  const { data: bundles, refresh: refreshBundles } = usePluggableCollection<any>('bundles');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<any>('assignments');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateBundle = async () => {
    if (!bundleName || selectedEntitlementIds.length === 0) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und mindestens eine Rolle erforderlich." });
      return;
    }

    const bundleId = `bundle-${Math.random().toString(36).substring(2, 9)}`;
    const bundleData = {
      id: bundleId,
      tenantId: 't1',
      name: bundleName,
      description: bundleDesc,
      entitlementIds: selectedEntitlementIds
    };

    if (dataSource === 'mysql') {
      const res = await saveCollectionRecord('bundles', bundleId, bundleData);
      if (!res.success) {
        toast({ variant: "destructive", title: "Fehler", description: "MySQL-Speicherung fehlgeschlagen." });
        return;
      }
    } else {
      setDocumentNonBlocking(doc(db, 'bundles', bundleId), bundleData);
    }

    toast({ title: "Bundle erstellt" });
    setIsBundleCreateOpen(false);
    setBundleName('');
    setBundleDesc('');
    setSelectedEntitlementIds([]);
    setRoleSearchTerm('');
    setTimeout(() => refreshBundles(), 200);
  };

  const startOnboarding = async () => {
    if (!newUserName || !newUserEmail || !selectedBundleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Felder ausfüllen." });
      return;
    }

    setIsActionLoading(true);
    try {
      const bundle = bundles?.find(b => b.id === selectedBundleId);
      
      // 1. Create User
      const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
      const timestamp = new Date().toISOString();
      const userData = {
        id: userId,
        tenantId: 't1',
        externalId: `MANUAL_${userId}`,
        displayName: newUserName,
        email: newUserEmail,
        department: newUserDept,
        enabled: true,
        onboardingDate,
        lastSyncedAt: timestamp
      };

      if (dataSource === 'mysql') {
        await saveCollectionRecord('users', userId, userData);
      } else {
        setDocumentNonBlocking(doc(db, 'users', userId), userData);
      }

      // 2. Trigger Jira Ticket
      const configs = await getJiraConfigs();
      let jiraKey = 'PENDING';
      if (configs.length > 0 && configs[0].enabled) {
        const summary = `ONBOARDING: ${newUserName} (${newUserDept})`;
        const roleListText = bundle.entitlementIds.map(eid => {
          const ent = entitlements?.find(e => e.id === eid);
          const res = resources?.find(r => r.id === ent?.resourceId);
          return `${res?.name}: ${ent?.name}`;
        });
        
        const desc = `Bitte folgende Accounts für den neuen Mitarbeiter ${newUserName} erstellen:\n\nE-Mail: ${newUserEmail}\nStartdatum: ${onboardingDate}\n\nRollen laut Bundle '${bundle.name}':\n- ${roleListText.join('\n- ')}\n\nACHTUNG: Berechtigungen im Hub werden erst aktiv geschaltet, wenn dieses Ticket erledigt ist.`;
        
        const res = await createJiraTicket(configs[0].id, summary, desc);
        if (res.success) jiraKey = res.key!;
      }

      // 3. Create Assignments with status 'requested'
      for (const eid of bundle.entitlementIds) {
        const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
        const assData = {
          id: assId,
          tenantId: 't1',
          userId,
          entitlementId: eid,
          status: 'requested',
          grantedBy: 'onboarding-wizard',
          grantedAt: timestamp,
          validFrom: onboardingDate,
          jiraIssueKey: jiraKey,
          ticketRef: jiraKey,
          notes: `Wartend auf Ticket-Abschluss (${jiraKey}). Onboarding-Bundle: ${bundle.name}`
        };

        if (dataSource === 'mysql') {
          await saveCollectionRecord('assignments', assId, assData);
        } else {
          setDocumentNonBlocking(doc(db, 'assignments', assId), assData);
        }
      }

      toast({ title: "Onboarding angestoßen" });
      resetJoinerForm();
      refreshUsers();
      refreshAssignments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler beim Onboarding", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const executeOffboarding = async () => {
    if (!userToOffboard) return;
    
    setIsActionLoading(true);
    try {
      const user = userToOffboard;
      const userAssignments = assignments?.filter(a => a.userId === user.id && a.status === 'active') || [];
      const timestamp = new Date().toISOString();

      const configs = await getJiraConfigs();
      let jiraKey = 'OFFB-PENDING';
      if (configs.length > 0 && configs[0].enabled) {
        const summary = `OFFBOARDING: ${user.displayName}`;
        const res = await createJiraTicket(configs[0].id, summary, `Bitte Accounts für ${user.displayName} (${user.email}) deaktivieren.`);
        if (res.success) jiraKey = res.key!;
      }

      for (const a of userAssignments) {
        const updateData = { status: 'pending_removal', jiraIssueKey: jiraKey };
        if (dataSource === 'mysql') {
          await saveCollectionRecord('assignments', a.id, { ...a, ...updateData });
        } else {
          updateDocumentNonBlocking(doc(db, 'assignments', a.id), updateData);
        }
      }

      toast({ title: "Offboarding eingeleitet", description: `Jira-Ticket ${jiraKey} wurde erstellt.` });
      setUserToOffboard(null);
      setIsOffboardConfirmOpen(false);
      refreshUsers();
      refreshAssignments();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fehler beim Offboarding", description: error.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const resetJoinerForm = () => {
    setNewUserName('');
    setNewEmail('');
    setNewDept('');
    setSelectedBundleId(null);
    setOnboardingDate(new Date().toISOString().split('T')[0]);
  };

  const filteredEntitlements = entitlements?.filter(e => {
    const res = resources?.find(r => r.id === e.resourceId);
    const term = roleSearchTerm.toLowerCase();
    const isAdmin = !!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1");
    
    const matchesSearch = e.name.toLowerCase().includes(term) || (res?.name || '').toLowerCase().includes(term);
    const matchesAdmin = !adminOnlyFilter || isAdmin;

    return matchesSearch && matchesAdmin;
  }) || [];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Identity Lifecycle Hub</h1>
          <p className="text-sm text-muted-foreground">Zentrale Verwaltung von Joiner- und Leaver-Prozessen.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsBundleCreateOpen(true)}>
            <Package className="w-3.5 h-3.5 mr-2" /> Bundle definieren
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-12 rounded-none border w-full justify-start gap-2">
          <TabsTrigger value="joiner" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
            <UserPlus className="w-3.5 h-3.5" /> 1. Onboarding
          </TabsTrigger>
          <TabsTrigger value="leaver" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
            <UserMinus className="w-3.5 h-3.5" /> 2. Offboarding
          </TabsTrigger>
          <TabsTrigger value="bundles" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
            <Package className="w-3.5 h-3.5" /> 3. Bundles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="joiner" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 rounded-none shadow-none border">
              <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-widest">Mitarbeiter-Eintritt</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Name</Label><Input value={newUserName} onChange={e => setNewUserName(e.target.value)} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">E-Mail</Label><Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Abteilung</Label><Input value={newUserDept} onChange={e => setNewDept(e.target.value)} className="rounded-none" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Datum</Label><Input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} className="rounded-none" /></div>
                </div>
                <div className="pt-6 border-t">
                  <Label className="text-[10px] font-bold uppercase text-primary mb-4 block tracking-widest">Rollen-Bundle wählen</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {bundles?.map(bundle => (
                      <div 
                        key={bundle.id} 
                        className={cn("p-4 border cursor-pointer hover:bg-muted/5", selectedBundleId === bundle.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-white")}
                        onClick={() => setSelectedBundleId(bundle.id)}
                      >
                        <div className="font-bold text-sm uppercase">{bundle.name}</div>
                        <p className="text-[10px] text-muted-foreground">{bundle.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <div className="p-6 border-t bg-muted/5 flex justify-end">
                <Button onClick={startOnboarding} disabled={isActionLoading || !selectedBundleId} className="rounded-none font-bold uppercase text-[10px] h-11 px-10 gap-2">
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Prozess starten
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaver">
          <Card className="rounded-none shadow-none border overflow-hidden">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div><CardTitle className="text-xs font-bold uppercase tracking-widest">Offboarding-Zentrale</CardTitle></div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 rounded-none text-xs" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b"><tr className="text-[10px] font-bold uppercase text-left"><th className="p-4">Identität</th><th className="p-4">Status</th><th className="p-4 text-right">Aktion</th></tr></thead>
                <tbody className="divide-y">
                  {users?.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase())).map(u => {
                    const isEnabled = u.enabled === true || u.enabled === 1 || u.enabled === "1";
                    return (
                      <tr key={u.id} className="hover:bg-muted/5">
                        <td className="p-4"><div className="font-bold">{u.displayName}</div><div className="text-[10px] text-muted-foreground">{u.email}</div></td>
                        <td className="p-4"><Badge variant="outline" className={cn("rounded-none font-bold uppercase text-[9px] border-none", isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500")}>{isEnabled ? "AKTIV" : "INAKTIV"}</Badge></td>
                        <td className="p-4 text-right">
                          {isEnabled && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-[9px] font-bold uppercase rounded-none border-red-200 text-red-600 hover:bg-red-50" 
                              onClick={() => { 
                                setUserToOffboard(u); 
                                setIsOffboardConfirmOpen(true); 
                              }}
                            >
                              Offboarding einleiten
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bundles">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles?.map(bundle => (
              <Card key={bundle.id} className="rounded-none shadow-none border hover:border-primary transition-colors">
                <CardHeader className="bg-muted/10 border-b py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-tight">{bundle.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="w-4 h-4" /></Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <p className="text-xs text-muted-foreground">{bundle.description || 'Keine Beschreibung.'}</p>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground mb-2">Enthaltene Rollen ({bundle.entitlementIds.length})</p>
                    {bundle.entitlementIds.slice(0, 4).map(eid => {
                      const ent = entitlements?.find(e => e.id === eid);
                      const res = resources?.find(r => r.id === ent?.resourceId);
                      return (
                        <div key={eid} className="text-[10px] flex items-center justify-between py-1 border-b border-dashed last:border-0">
                          <span className="font-bold">{res?.name}</span>
                          <span className="text-muted-foreground">{ent?.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Bundle Create Dialog */}
      <Dialog open={isBundleCreateOpen} onOpenChange={setIsBundleCreateOpen}>
        <DialogContent className="rounded-none border shadow-2xl max-w-2xl overflow-hidden flex flex-col h-[80vh]">
          <DialogHeader className="shrink-0"><DialogTitle className="text-sm font-bold uppercase">Bundle definieren</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Name</Label><Input value={bundleName} onChange={e => setBundleName(e.target.value)} className="rounded-none" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Beschreibung</Label><Input value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} className="rounded-none" /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-primary tracking-widest">Rollen wählen ({selectedEntitlementIds.length})</Label>
                <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 border">
                  <ShieldAlert className={cn("w-3.5 h-3.5", adminOnlyFilter ? "text-red-600" : "text-muted-foreground")} />
                  <span className="text-[9px] font-bold uppercase">Nur Admins</span>
                  <Switch checked={adminOnlyFilter} onCheckedChange={setAdminOnlyFilter} className="scale-75 h-4" />
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Suchen..." value={roleSearchTerm} onChange={e => setRoleSearchTerm(e.target.value)} className="pl-8 h-9 rounded-none text-xs" />
              </div>
              <div className="border bg-slate-50/50 p-2 grid grid-cols-1 gap-1 max-h-64 overflow-y-auto">
                {filteredEntitlements.map(e => {
                  const res = resources?.find(r => r.id === e.resourceId);
                  const isChecked = selectedEntitlementIds.includes(e.id);
                  const isAdmin = !!(e.isAdmin === true || e.isAdmin === 1 || e.isAdmin === "1");
                  return (
                    <div 
                      key={e.id} 
                      className={cn("flex items-center gap-3 p-2 text-xs border cursor-pointer", isChecked ? "border-primary bg-primary/5" : "bg-white hover:bg-muted/50")} 
                      onClick={() => setSelectedEntitlementIds(prev => prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id])}
                    >
                      <div className={cn("w-4 h-4 border flex items-center justify-center shrink-0", isChecked ? "bg-primary border-primary" : "bg-white")}>{isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                      <div className="flex flex-col truncate">
                        <div className="flex items-center gap-1.5">
                          {isAdmin && <ShieldAlert className="w-3 h-3 text-red-600" />}
                          <span className="font-bold uppercase text-[10px]">{res?.name}</span>
                          {isAdmin && <Badge className="h-3 text-[6px] bg-red-50 text-red-700 px-1 border-red-100 uppercase">ADMIN</Badge>}
                        </div>
                        <span className="text-muted-foreground text-[10px]">{e.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsBundleCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleCreateBundle} className="rounded-none font-bold uppercase text-[10px]">Bundle Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isOffboardConfirmOpen} onOpenChange={setIsOffboardConfirmOpen}>
        <AlertDialogContent className="rounded-none border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase flex items-center gap-2 text-sm">
              <AlertTriangle className="w-5 h-5" /> Offboarding starten?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Möchten Sie das Offboarding für <strong>{userToOffboard?.displayName}</strong> wirklich einleiten? 
              {userToOffboard && assignments && (
                <span className="block mt-2 font-semibold">
                  Es werden {assignments.filter(a => a.userId === userToOffboard.id && a.status === 'active').length} aktive Berechtigungen zur Entfernung vorgemerkt.
                </span>
              )}
              Es wird automatisch ein Jira-Ticket zur Account-Deaktivierung in allen relevanten Systemen erstellt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none" disabled={isActionLoading}>Abbrechen</AlertDialogCancel>
            <Button 
              onClick={executeOffboarding} 
              disabled={isActionLoading}
              className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs h-10 px-6 gap-2"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Starten
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
