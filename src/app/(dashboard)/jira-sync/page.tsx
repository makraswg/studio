"use client";

import { useState, useEffect, useMemo } from 'react';
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
  RefreshCw, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  UserPlus, 
  AlertTriangle,
  Info,
  Terminal,
  Search,
  Box,
  Clock,
  ArrowRight,
  Zap,
  Ticket,
  UserMinus,
  Bug,
  ChevronDown,
  ChevronUp,
  FileCode,
  AlertCircle,
  Download,
  Check,
  Server
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { 
  fetchJiraSyncItems, 
  resolveJiraTicket, 
  getJiraConfigs, 
  getJiraAssetObjectsAction,
  importJiraAssetsAction 
} from '@/app/actions/jira-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { User, Entitlement, Resource, Assignment } from '@/lib/types';
import { useFirestore, addDocumentNonBlocking, useUser as useAuthUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

export default function JiraGatewayHubPage() {
  const { dataSource, activeTenantId } = useSettings();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed' | 'discovery'>('pending');
  const [showDebug, setShowDebug] = useState(false);
  
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [approvedTickets, setApprovedTickets] = useState<any[]>([]);
  const [doneTickets, setDoneTickets] = useState<any[]>([]);
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Asset Discovery State
  const [assetObjects, setAssetObjects] = useState<any[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isAssetLoading, setIsAssetLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources, refresh: refreshResources } = usePluggableCollection<Resource>('resources');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');

  useEffect(() => {
    setMounted(true);
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    setIsLoading(true);
    setLastError(null);
    try {
      const configs = await getJiraConfigs(dataSource);
      if (configs.length > 0 && configs[0].enabled) {
        const config = configs[0];
        setActiveConfig(config);
        
        const [pendingRes, approvedRes, doneRes] = await Promise.all([
          fetchJiraSyncItems(config.id, 'pending', dataSource),
          fetchJiraSyncItems(config.id, 'approved', dataSource),
          fetchJiraSyncItems(config.id, 'done', dataSource)
        ]);
        
        if (!pendingRes.success) setLastError(pendingRes.error || "Fehler beim Laden der Warteschlange");
        if (!approvedRes.success) setLastError(approvedRes.error || "Fehler beim Laden der Genehmigungen");
        if (!doneRes.success) setLastError(doneRes.error || "Fehler beim Laden erledigter Tickets");

        setPendingTickets(pendingRes.items || []);
        
        setApprovedTickets((approvedRes.items || []).map(t => {
          const existingAssignment = assignments?.find(a => a.jiraIssueKey === t.key);
          const matchedRole = entitlements?.find(e => t.summary.toLowerCase().includes(e.name.toLowerCase()));
          
          return {
            ...t,
            existingAssignment,
            matchedRole: existingAssignment ? entitlements?.find(e => e.id === existingAssignment.entitlementId) : matchedRole
          };
        }));
        
        setDoneTickets(doneRes.items || []);
      }
    } catch (e: any) {
      setLastError(e.message);
      toast({ variant: "destructive", title: "API Fehler", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAssetObjects = async () => {
    if (!activeConfig?.objectTypeId) {
      toast({ variant: "destructive", title: "Fehler", description: "Kein Objekttyp für IT-Systeme konfiguriert." });
      return;
    }
    setIsAssetLoading(true);
    try {
      const res = await getJiraAssetObjectsAction(activeConfig, activeConfig.objectTypeId);
      if (res.success) {
        setAssetObjects(res.objects || []);
        toast({ title: "Assets geladen", description: `${res.objects?.length || 0} Objekte gefunden.` });
      } else {
        throw new Error(res.error);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Discovery Fehler", description: e.message });
    } finally {
      setIsAssetLoading(false);
    }
  };

  const handleImportAssets = async () => {
    if (selectedAssetIds.length === 0) return;
    setIsImporting(true);
    try {
      const objectsToImport = assetObjects.filter(obj => selectedAssetIds.includes(String(obj.id)));
      const targetTenant = activeTenantId === 'all' ? 't1' : activeTenantId;
      
      const res = await importJiraAssetsAction(objectsToImport, targetTenant, dataSource);
      if (res.success) {
        toast({ title: "Import erfolgreich", description: `${res.count} Ressourcen wurden angelegt.` });
        setSelectedAssetIds([]);
        refreshResources();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import-Fehler", description: e.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyCompletedTicket = async (ticket: any) => {
    const linkedAssignments = assignments?.filter(a => a.jiraIssueKey === ticket.key) || [];
    let targetAssignments = linkedAssignments;
    let affectedUserId = linkedAssignments.length > 0 ? linkedAssignments[0].userId : null;

    if (targetAssignments.length === 0 && ticket.requestedUserEmail) {
      const user = users?.find(u => u.email.toLowerCase() === ticket.requestedUserEmail.toLowerCase());
      if (user) {
        affectedUserId = user.id;
        targetAssignments = assignments?.filter(a => a.userId === user.id && (a.status === 'requested' || a.status === 'pending_removal')) || [];
      }
    }

    if (targetAssignments.length === 0) {
      toast({ variant: "destructive", title: "Keine Daten", description: "Keine ausstehenden Änderungen für dieses Ticket gefunden." });
      return;
    }

    const isLeaver = ticket.summary.toLowerCase().includes('offboarding');
    const timestamp = new Date().toISOString();

    for (const a of targetAssignments) {
      let newStatus: 'active' | 'removed' = 'active';
      if (isLeaver || a.status === 'pending_removal') {
        newStatus = 'removed';
      }

      const updateData = { 
        status: newStatus, 
        lastReviewedAt: timestamp,
        validUntil: newStatus === 'removed' ? timestamp.split('T')[0] : a.validUntil 
      };
      
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', a.id, { ...a, ...updateData }, dataSource);
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', a.id), updateData);
      }
    }

    toast({ title: "Finalisierung erfolgreich", description: `Berechtigungen für Ticket ${ticket.key} wurden aktualisiert.` });
    setDoneTickets(prev => prev.filter(t => t.key !== ticket.key));
    setTimeout(() => refreshAssignments(), 300);
  };

  const handleAssignFromApproved = async (ticket: any) => {
    const user = users?.find(u => u.email.toLowerCase() === ticket.requestedUserEmail?.toLowerCase());
    const ent = ticket.matchedRole;
    
    if (!user || !ent) {
      toast({ variant: "destructive", title: "Zuweisung nicht möglich", description: "Benutzer oder Rolle konnte nicht automatisch zugeordnet werden." });
      return;
    }

    const timestamp = new Date().toISOString();

    if (ticket.existingAssignment) {
      const updateData = { status: 'active', lastReviewedAt: timestamp };
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', ticket.existingAssignment.id, { ...ticket.existingAssignment, ...updateData }, dataSource);
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', ticket.existingAssignment.id), updateData);
      }
    } else {
      const assignmentId = `ass-jira-${ticket.key}-${Math.random().toString(36).substring(2, 5)}`;
      const assignmentData = {
        id: assignmentId,
        userId: user.id,
        entitlementId: ent.id,
        status: 'active',
        grantedBy: 'jira-sync',
        grantedAt: timestamp,
        validFrom: timestamp.split('T')[0],
        jiraIssueKey: ticket.key,
        ticketRef: ticket.key,
        notes: `Einzelzuweisung via Jira Ticket ${ticket.key}.`,
        tenantId: user.tenantId || 'global'
      };

      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', assignmentId, assignmentData, dataSource);
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', assignmentId), assignmentData);
      }
    }

    await resolveJiraTicket(activeConfig.id, ticket.key, "Berechtigung im ComplianceHub aktiviert.", dataSource);
    setApprovedTickets(prev => prev.filter(t => t.key !== ticket.key));
    toast({ title: "Ticket verarbeitet" });
    setTimeout(() => refreshAssignments(), 300);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Identity Sync</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Jira Gateway</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automatisierte Berechtigungsvergabe durch Atlassian JSM Tickets.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)} className={cn("h-9 rounded-md font-bold text-xs border-slate-200", showDebug && "bg-slate-100")}>
            <Bug className="w-3.5 h-3.5 mr-2" /> Diagnose
          </Button>
          <Button variant="outline" size="sm" onClick={loadSyncData} disabled={isLoading} className="h-9 rounded-md font-bold text-xs border-slate-200">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} Aktualisieren
          </Button>
        </div>
      </div>

      {lastError && (
        <Alert variant="destructive" className="rounded-xl border shadow-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold">Synchronisationsfehler</AlertTitle>
          <AlertDescription className="text-[10px] font-medium mt-1">{lastError}</AlertDescription>
        </Alert>
      )}

      {!activeConfig && !isLoading && (
        <div className="p-16 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border mb-2">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Jira Gateway nicht konfiguriert</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">Bitte hinterlegen Sie eine valide Jira-Verbindung in den Einstellungen, um Tickets zu synchronisieren.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-md font-bold text-xs h-10 px-8" onClick={() => router.push('/settings/integrations')}>Zu den Einstellungen</Button>
        </div>
      )}

      {activeConfig && (
        <Tabs value={activeTab} onValueChange={setActiveTab as any} className="space-y-6">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 h-11 rounded-lg border w-full justify-start gap-1 overflow-x-auto no-scrollbar">
            <TabsTrigger value="pending" className="rounded-md px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              1. Warteschlange ({pendingTickets.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="rounded-md px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              2. Genehmigungen ({approvedTickets.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-md px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm">
              3. Erledigte Tickets ({doneTickets.length})
            </TabsTrigger>
            <TabsTrigger value="discovery" className="rounded-md px-6 gap-2 text-[11px] font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-indigo-600">
              <RefreshCw className="w-3.5 h-3.5" /> 4. Assets Discovery
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Vorgang</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400">Prozess / Inhalt</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400 text-right">Jira Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTickets.map((ticket) => (
                    <TableRow key={ticket.key} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                      <TableCell className="py-4 px-6 font-bold text-primary text-xs">{ticket.key}</TableCell>
                      <TableCell>
                        <div className="font-bold text-sm text-slate-800">{ticket.summary}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Gemeldet von: {ticket.reporter}</div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Badge variant="outline" className="rounded-full text-[9px] font-bold border-slate-200 bg-slate-50 text-slate-600 px-3 h-5">
                          {ticket.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingTickets.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={3} className="h-32 text-center text-xs text-slate-400 italic">Die Warteschlange ist aktuell leer.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="approved">
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Vorgang</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400">Inhalt</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400">Zugeordnete Rolle</TableHead>
                    <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedTickets.map((ticket) => (
                    <TableRow key={ticket.key} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                      <TableCell className="py-4 px-6 font-bold text-primary text-xs">{ticket.key}</TableCell>
                      <TableCell>
                        <div className="font-bold text-sm text-slate-800">{ticket.summary}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{ticket.requestedUserEmail || 'Keine E-Mail erkannt'}</div>
                      </TableCell>
                      <TableCell>
                        {ticket.matchedRole ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-none rounded-full text-[9px] font-bold px-3 h-5">{ticket.matchedRole.name}</Badge>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Kein Mapping</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button size="sm" className="h-8 rounded-md font-bold text-[10px] px-4" disabled={!ticket.matchedRole} onClick={() => handleAssignFromApproved(ticket)}>
                          Bestätigen
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {approvedTickets.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-slate-400 italic">Keine genehmigten Vorgänge zur Verarbeitung.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <Alert className="rounded-xl border shadow-sm bg-blue-50/50 border-blue-100">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-xs font-bold text-blue-800">Finalisierung erforderlich</AlertTitle>
              <AlertDescription className="text-[10px] font-medium text-blue-700 mt-1">Tickets, die in Jira auf 'Erledigt' stehen, müssen hier finalisiert werden, damit die Statusänderungen im ComplianceHub wirksam werden.</AlertDescription>
            </Alert>
            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Vorgang</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400">Betreff</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400 text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doneTickets.map((ticket) => (
                    <TableRow key={ticket.key} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                      <TableCell className="py-4 px-6 font-bold text-xs">{ticket.key}</TableCell>
                      <TableCell>
                        <div className="font-bold text-sm text-slate-800">{ticket.summary}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Jira Status: {ticket.status}</div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button size="sm" className="h-8 rounded-md font-bold text-[10px] px-6 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleApplyCompletedTicket(ticket)}>
                          Finalisieren
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {doneTickets.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={3} className="h-32 text-center text-xs text-slate-400 italic">Keine abgeschlossenen Tickets gefunden.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="discovery" className="space-y-6">
            <div className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                  <RefreshCw className={cn("w-6 h-6 text-white", isAssetLoading && "animate-spin")} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">JSM Asset Discovery</h3>
                  <p className="text-[10px] text-indigo-700 font-bold mt-0.5">
                    Typ: <span className="underline">{activeConfig?.objectTypeId || 'Nicht konfiguriert'}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-md font-bold text-xs h-10 px-6 border-indigo-200 bg-white" onClick={loadAssetObjects} disabled={isAssetLoading}>
                  {isAssetLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-2" />} Scan starten
                </Button>
                <Button size="sm" className="rounded-md font-bold text-xs h-10 px-8 bg-indigo-600 hover:bg-indigo-700 shadow-lg text-white" onClick={handleImportAssets} disabled={selectedAssetIds.length === 0 || isImporting}>
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />} 
                  Import ({selectedAssetIds.length})
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-12 px-6"></TableHead>
                    <TableHead className="py-4 font-bold text-[11px] text-slate-400">Jira Key / Name</TableHead>
                    <TableHead className="font-bold text-[11px] text-slate-400 text-right">Status im Hub</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetObjects.map((obj) => {
                    const isAlreadyImported = resources?.some(r => r.id === `res-jira-${obj.id}`);
                    return (
                      <TableRow key={obj.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0", isAlreadyImported && "opacity-50")}>
                        <TableCell className="px-6">
                          <Checkbox 
                            disabled={isAlreadyImported} 
                            checked={selectedAssetIds.includes(String(obj.id))} 
                            onCheckedChange={(checked) => {
                              setSelectedAssetIds(prev => checked ? [...prev, String(obj.id)] : prev.filter(id => id !== String(obj.id)));
                            }}
                          />
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-bold text-sm text-slate-800">{obj.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{obj.label || 'ID: ' + obj.id}</div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          {isAlreadyImported ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full text-[8px] font-bold px-2 h-5">Importiert</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] font-bold rounded-full border-slate-200 h-5">Neu</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {assetObjects.length === 0 && !isAssetLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-48 text-center text-xs text-slate-400 italic">
                        Starten Sie den Scan, um Assets aus Jira Service Management abzurufen.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {showDebug && activeConfig && (
        <Card className="rounded-xl border-2 border-slate-100 shadow-none bg-slate-50/50 mt-12 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="bg-slate-900 text-white py-4 px-6 shrink-0">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Diagnose: Schnittstellen-Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-400">Aktive Konfiguration</Label>
                  <div className="p-4 border bg-white rounded-xl space-y-3 shadow-sm">
                    <div className="flex justify-between text-[10px] font-bold border-b pb-2"><span>Quelle:</span> <span className="text-primary uppercase">{dataSource}</span></div>
                    <div className="flex justify-between text-[10px] font-bold border-b pb-2"><span>Projekt Key:</span> <span className="text-slate-700">{activeConfig.projectKey}</span></div>
                    <div className="flex justify-between text-[10px] font-bold"><span>Status OK:</span> <span className="text-emerald-600">{activeConfig.approvedStatusName}</span></div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-100/50 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-500 italic leading-relaxed">
                  Nutzen Sie diesen Bereich, um die API-Konnektivität zu prüfen. Wenn Tickets nicht geladen werden, kontrollieren Sie bitte die Status-Bezeichnungen in Atlassian Jira.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
