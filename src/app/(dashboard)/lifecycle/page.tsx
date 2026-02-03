
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
  ShieldCheck, 
  ArrowRight, 
  Loader2, 
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Zap,
  MoreHorizontal,
  X,
  Plus,
  Workflow,
  Clock
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
      await saveCollectionRecord('bundles', bundleId, bundleData);
    } else {
      setDocumentNonBlocking(doc(db, 'bundles', bundleId), bundleData);
    }

    toast({ title: "Bundle erstellt" });
    setIsBundleCreateOpen(false);
    setBundleName('');
    setBundleDesc('');
    setSelectedEntitlementIds([]);
    setRoleSearchTerm('');
    refreshBundles();
  };

  const startOnboarding = async () => {
    if (!newUserName || !newUserEmail || !selectedBundleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte alle Felder ausfüllen." });
      return;
    }

    setIsActionLoading(true);
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

    // 2. Trigger Jira Ticket for Service Desk FIRST to get the key
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

    // 3. Create Assignments with status 'requested' (PENDING)
    for (const eid of bundle.entitlementIds) {
      const assId = `ass-onb-${userId}-${eid}`.substring(0, 50);
      const assData = {
        id: assId,
        tenantId: 't1',
        userId,
        entitlementId: eid,
        status: 'requested', // PENDING STAGE
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

    toast({ title: "Onboarding angestoßen", description: `User angelegt. Jira Ticket ${jiraKey} erstellt. Status: Pending.` });
    setIsActionLoading(false);
    resetJoinerForm();
    refreshUsers();
    refreshAssignments();
  };

  const executeOffboarding = async () => {
    if (!userToOffboard) return;
    
    setIsActionLoading(true);
    const user = userToOffboard;
    const userAssignments = assignments?.filter(a => a.userId === user.id && a.status === 'active') || [];
    const timestamp = new Date().toISOString();

    // 1. Create Jira Ticket FIRST
    const configs = await getJiraConfigs();
    let jiraKey = 'OFFB-PENDING';
    if (configs.length > 0 && configs[0].enabled) {
      const revokeList = userAssignments.map(a => {
        const ent = entitlements?.find(e => e.id === a.entitlementId);
        const res = resources?.find(r => r.id === ent?.resourceId);
        return `${res?.name}: ${ent?.name}`;
      });

      const summary = `OFFBOARDING: ${user.displayName}`;
      const desc = `Mitarbeiter ${user.displayName} verlässt das Unternehmen.\nBitte folgende Accounts DEAKTIVIEREN:\n\nE-Mail: ${user.email}\n\nSysteme:\n- ${revokeList.join('\n- ')}\n\nACHTUNG: Der Account im Hub wird erst nach Abschluss dieses Tickets final deaktiviert.`;
      
      const res = await createJiraTicket(configs[0].id, summary, desc);
      if (res.success) jiraKey = res.key!;
    }

    // 2. Set all Assignments to 'pending_removal'
    for (const a of userAssignments) {
      const updateData = { 
        status: 'pending_removal', 
        jiraIssueKey: jiraKey,
        notes: `${a.notes || ''} [Offboarding eingeleitet via ${jiraKey}]`.trim()
      };
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', a.id, { ...a, ...updateData });
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', a.id), updateData);
      }
    }

    // 3. Create Audit Event
    const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
    const auditData = {
      id: auditId,
      actorUid: authUser?.uid || 'system',
      action: `OFFBOARDING GESTARTET: ${user.displayName} (Wartend auf ${jiraKey})`,
      entityType: 'user',
      entityId: user.id,
      timestamp,
      tenantId: 't1'
    };
    if (dataSource === 'mysql') {
      await saveCollectionRecord('auditEvents', auditId, auditData);
    } else {
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    toast({ title: "Offboarding eingeleitet", description: `Jira Ticket ${jiraKey} erstellt. Status: Pending Removal.` });
    setIsActionLoading(false);
    setUserToOffboard(null);
    setIsOffboardConfirmOpen(false);
    refreshUsers();
    refreshAssignments();
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
    return e.name.toLowerCase().includes(term) || (res?.name || '').toLowerCase().includes(term);
  }) || [];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Identity Lifecycle Hub</h1>
          <p className="text-sm text-muted-foreground">Zentrale Verwaltung von Joiner- und Leaver-Prozessen (Ticket-gesteuert).</p>
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
            <UserPlus className="w-3.5 h-3.5" /> 1. Onboarding (Joiner)
          </TabsTrigger>
          <TabsTrigger value="leaver" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
            <UserMinus className="w-3.5 h-3.5" /> 2. Offboarding (Leaver)
          </TabsTrigger>
          <TabsTrigger value="bundles" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
            <Workflow className="w-3.5 h-3.5" /> 3. Bundle Übersicht
          </TabsTrigger>
        </TabsList>

        <TabsContent value="joiner" className="animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 rounded-none shadow-none border">
              <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-widest">Mitarbeiter-Eintritt planen</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Berechtigungen werden als 'Requested' angelegt, bis die IT den Abschluss bestätigt.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Vollständiger Name</Label>
                    <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="z.B. Max Mustermann" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">E-Mail (Arbeit)</Label>
                    <Input value={newUserEmail} onChange={e => setNewEmail(e.target.value)} placeholder="max@firma.de" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Abteilung</Label>
                    <Input value={newUserDept} onChange={e => setNewDept(e.target.value)} placeholder="z.B. Vertrieb" className="rounded-none h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Eintrittsdatum</Label>
                    <Input type="date" value={onboardingDate} onChange={e => setOnboardingDate(e.target.value)} className="rounded-none h-10" />
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <Label className="text-[10px] font-bold uppercase text-primary mb-4 block tracking-widest">Rollen-Paket auswählen (Bundle)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {bundles?.map(bundle => (
                      <div 
                        key={bundle.id} 
                        className={cn(
                          "p-4 border cursor-pointer transition-all hover:bg-muted/5 group",
                          selectedBundleId === bundle.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-white"
                        )}
                        onClick={() => setSelectedBundleId(bundle.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm uppercase">{bundle.name}</span>
                          <Package className={cn("w-4 h-4", selectedBundleId === bundle.id ? "text-primary" : "text-slate-300")} />
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{bundle.description}</p>
                        <div className="mt-2 flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 rounded-none bg-slate-50">{bundle.entitlementIds.length} ROLLEN</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-100 flex gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-amber-800">Warte-Workflow aktiv</p>
                    <p className="text-[10px] text-amber-700 leading-relaxed uppercase">
                      Nach dem Start verbleiben die Zuweisungen im Status 'Requested'. Sie müssen im Tab 'Jira Synchronisation' finalisiert werden, sobald die IT das Ticket abgeschlossen hat.
                    </p>
                  </div>
                </div>
              </CardContent>
              <div className="p-6 border-t bg-muted/5 flex justify-end">
                <Button onClick={startOnboarding} disabled={isActionLoading || !selectedBundleId} className="rounded-none font-bold uppercase text-[10px] h-11 px-10 gap-2">
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Prozess anstoßen
                </Button>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-none shadow-none border">
                <CardHeader className="py-3 bg-muted/20 border-b">
                  <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">Kommende Joiner</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {users?.filter(u => u.onboardingDate && new Date(u.onboardingDate) >= new Date()).slice(0, 5).map(u => (
                      <div key={u.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">{u.displayName}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">{u.department}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] rounded-none border-blue-200 text-blue-600 font-bold uppercase">
                          {new Date(u.onboardingDate).toLocaleDateString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaver" className="animate-in fade-in slide-in-from-right-2 duration-300">
          <Card className="rounded-none shadow-none border overflow-hidden">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-widest">Offboarding-Zentrale</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase mt-1">Status 'Pending Removal' bis zur Bestätigung durch IT.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Mitarbeiter suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 rounded-none text-xs" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-left">
                    <th className="p-4">Identität</th>
                    <th className="p-4">Status im Zielsystem</th>
                    <th className="p-4 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users?.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())).map(u => {
                    const pendingRemovalCount = assignments?.filter(a => a.userId === u.id && a.status === 'pending_removal').length || 0;
                    const isEnabled = u.enabled === true || u.enabled === 1 || u.enabled === "1";
                    
                    return (
                      <tr key={u.id} className="hover:bg-muted/5 transition-colors group">
                        <td className="p-4">
                          <div className="font-bold">{u.displayName}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{u.email}</div>
                        </td>
                        <td className="p-4">
                          {pendingRemovalCount > 0 ? (
                            <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase animate-pulse">
                              <Clock className="w-4 h-4" /> Lösch-Ticket läuft ({pendingRemovalCount} Rollen)
                            </div>
                          ) : (
                            <Badge variant="outline" className={cn("rounded-none font-bold uppercase text-[9px] border-none", isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500")}>
                              {isEnabled ? "AKTIV" : "INAKTIV"}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {isEnabled && pendingRemovalCount === 0 ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-[9px] font-bold uppercase rounded-none border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => { setUserToOffboard(u); setIsOffboardConfirmOpen(true); }}
                              disabled={isActionLoading}
                            >
                              <UserMinus className="w-3 h-3 mr-1" /> Offboarding einleiten
                            </Button>
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground uppercase italic px-4">
                              {pendingRemovalCount > 0 ? "Warten auf IT..." : "Abgeschlossen"}
                            </span>
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

        <TabsContent value="bundles" className="animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles?.map(bundle => (
              <Card key={bundle.id} className="rounded-none shadow-none border group hover:border-primary transition-colors">
                <CardHeader className="bg-muted/10 border-b py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-tight">{bundle.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <p className="text-xs text-muted-foreground h-10 overflow-hidden">{bundle.description || 'Keine Beschreibung vorhanden.'}</p>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground mb-2">Enthaltene Rollen ({bundle.entitlementIds.length})</p>
                    {bundle.entitlementIds.slice(0, 4).map(eid => {
                      const ent = entitlements?.find(e => e.id === eid);
                      const res = resources?.find(r => r.id === ent?.resourceId);
                      return (
                        <div key={eid} className="text-[10px] flex items-center justify-between py-1 border-b border-dashed last:border-0">
                          <span className="font-bold truncate max-w-[120px]">{res?.name}</span>
                          <span className="text-muted-foreground truncate">{ent?.name}</span>
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
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-bold uppercase">Rollen-Bundle definieren</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bundle Name</Label>
                <Input value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="z.B. Standard Developer" className="rounded-none h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beschreibung</Label>
                <Input value={bundleDesc} onChange={e => setBundleDesc(e.target.value)} placeholder="Kurze Zweckbeschreibung..." className="rounded-none h-10" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center justify-between">
                Rollen wählen
                <span className="text-muted-foreground">{selectedEntitlementIds.length} gewählt</span>
              </Label>
              
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Nach Rollen oder Systemen suchen..." 
                  value={roleSearchTerm} 
                  onChange={e => setRoleSearchTerm(e.target.value)}
                  className="pl-8 h-9 rounded-none text-xs bg-muted/20 border-none mb-2"
                />
              </div>

              <div className="border rounded-none bg-slate-50/50 p-2 grid grid-cols-1 gap-1">
                {filteredEntitlements.map(e => {
                  const res = resources?.find(r => r.id === e.resourceId);
                  const isChecked = selectedEntitlementIds.includes(e.id);
                  return (
                    <div 
                      key={e.id} 
                      className={cn(
                        "flex items-center gap-3 p-2 text-xs border cursor-pointer transition-colors", 
                        isChecked ? "border-primary bg-primary/5" : "border-transparent bg-white hover:bg-muted/50"
                      )} 
                      onClick={() => setSelectedEntitlementIds(prev => prev.includes(e.id) ? prev.filter(id => id !== e.id) : [...prev, e.id])}
                    >
                      <div className={cn("w-4 h-4 border flex items-center justify-center shrink-0", isChecked ? "bg-primary border-primary" : "bg-white")}>
                        {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="font-bold uppercase text-[10px] truncate">{res?.name || 'System'}</span>
                        <span className="text-muted-foreground text-[10px] truncate">{e.name}</span>
                      </div>
                    </div>
                  );
                })}
                {filteredEntitlements.length === 0 && (
                  <div className="py-8 text-center text-[10px] font-bold uppercase text-muted-foreground italic">
                    Keine passenden Rollen gefunden
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setIsBundleCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleCreateBundle} className="rounded-none font-bold uppercase text-[10px]">Bundle Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offboarding Confirmation Dialog */}
      <AlertDialog open={isOffboardConfirmOpen} onOpenChange={setIsOffboardConfirmOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase flex items-center gap-2 text-sm">
              <AlertTriangle className="w-5 h-5" /> Offboarding einleiten?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-4">
              <p>
                Möchten Sie den Offboarding-Prozess für <strong>{userToOffboard?.displayName}</strong> wirklich starten?
              </p>
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 space-y-2">
                <p className="font-bold uppercase text-[10px]">Folgende Aktionen werden ausgelöst:</p>
                <ul className="list-disc pl-4 text-[10px] space-y-1 uppercase font-bold">
                  <li>Automatisches Jira-Ticket zur De-Provisionierung wird erstellt.</li>
                  <li>Alle {assignments?.filter(a => a.userId === userToOffboard?.id && a.status === 'active').length || 0} aktiven Zuweisungen werden in den Status 'Pending Removal' versetzt.</li>
                  <li>Die finale Sperrung erfolgt erst nach IT-Bestätigung im Ticket.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none shadow-none text-xs font-bold uppercase" onClick={() => setUserToOffboard(null)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={executeOffboarding} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs shadow-none">
              Offboarding starten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
