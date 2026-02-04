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
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  UserPlus, 
  AlertTriangle,
  History,
  Info,
  Terminal,
  XCircle,
  Search,
  Shield,
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
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { fetchJiraSyncItems, resolveJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function JiraSyncPage() {
  const { dataSource } = useSettings();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed'>('pending');
  const [showDebug, setShowDebug] = useState(false);
  
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [approvedTickets, setApprovedTickets] = useState<any[]>([]);
  const [doneTickets, setDoneTickets] = useState<any[]>([]);
  const [activeConfig, setActiveConfig] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Debug info
  const [debugInfo, setDebugInfo] = useState<{
    configSource: string;
    jqlQueries: Record<string, string>;
    lastResponse: any;
  }>({
    configSource: 'none',
    jqlQueries: {},
    lastResponse: null
  });

  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
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
        
        const queries = {
          pending: `project = "${config.projectKey}" AND status NOT IN ("${config.approvedStatusName}", "${config.doneStatusName}", "Canceled", "Rejected")`,
          approved: `project = "${config.projectKey}" AND status = "${config.approvedStatusName}"`,
          done: `project = "${config.projectKey}" AND status = "${config.doneStatusName}"`
        };

        const [pendingRes, approvedRes, doneRes] = await Promise.all([
          fetchJiraSyncItems(config.id, 'pending', dataSource),
          fetchJiraSyncItems(config.id, 'approved', dataSource),
          fetchJiraSyncItems(config.id, 'done', dataSource)
        ]);
        
        if (!pendingRes.success) setLastError(pendingRes.error || "Fehler beim Laden der Warteschlange");
        if (!approvedRes.success) setLastError(approvedRes.error || "Fehler beim Laden der Genehmigungen");
        if (!doneRes.success) setLastError(doneRes.error || "Fehler beim Laden erledigter Tickets");

        setPendingTickets(pendingRes.items);
        
        setApprovedTickets(approvedRes.items.map(t => {
          const existingAssignment = assignments?.find(a => a.jiraIssueKey === t.key);
          const matchedRole = entitlements?.find(e => t.summary.toLowerCase().includes(e.name.toLowerCase()));
          
          return {
            ...t,
            existingAssignment,
            matchedRole: existingAssignment ? entitlements?.find(e => e.id === existingAssignment.entitlementId) : matchedRole
          };
        }));
        
        setDoneTickets(doneRes.items);

        setDebugInfo({
          configSource: dataSource,
          jqlQueries: queries,
          lastResponse: {
            pending: pendingRes,
            approved: approvedRes,
            done: doneRes,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (e: any) {
      setLastError(e.message);
      toast({ variant: "destructive", title: "API Fehler", description: e.message });
      setDebugInfo(prev => ({ ...prev, lastResponse: { error: e.message, timestamp: new Date().toISOString() } }));
    } finally {
      setIsLoading(false);
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

    if (isLeaver && affectedUserId) {
      const user = users?.find(u => u.id === affectedUserId);
      if (user) {
        const userData = { ...user, enabled: false, offboardingDate: timestamp.split('T')[0] };
        if (dataSource === 'mysql') {
          await saveCollectionRecord('users', user.id, userData, dataSource);
        } else {
          updateDocumentNonBlocking(doc(db, 'users', user.id), { enabled: false, offboardingDate: timestamp.split('T')[0] });
        }
      }
    }

    toast({ title: "Hub-Finalisierung erfolgreich", description: `Berechtigungen für Ticket ${ticket.key} wurden aktualisiert.` });
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

  const handleUpdateMatchedRole = (ticketKey: string, roleId: string) => {
    const role = entitlements?.find(e => e.id === roleId);
    setApprovedTickets(prev => prev.map(t => t.key === ticketKey ? { ...t, matchedRole: role } : t));
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jira Synchronisation</h1>
          <p className="text-sm text-muted-foreground">Gateway für Genehmigungen und Abschluss-Bestätigungen.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowDebug(!showDebug)} 
            className={cn("h-9 font-bold uppercase text-[10px] rounded-none", showDebug && "bg-slate-100")}
          >
            <Bug className="w-3.5 h-3.5 mr-2" /> Diagnose
          </Button>
          <Button variant="outline" size="sm" onClick={loadSyncData} disabled={isLoading} className="h-9 font-bold uppercase text-[10px] rounded-none">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} Aktualisieren
          </Button>
        </div>
      </div>

      {lastError && (
        <Alert variant="destructive" className="rounded-none border-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs font-bold uppercase">Synchronisationsfehler</AlertTitle>
          <AlertDescription className="text-[10px] font-bold uppercase">
            {lastError} - Prüfen Sie den Diagnose-Bereich für technische Details.
          </AlertDescription>
        </Alert>
      )}

      {!activeConfig && !isLoading && (
        <div className="p-10 border-2 border-dashed flex flex-col items-center justify-center text-center gap-4 bg-muted/10">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <div>
            <h3 className="font-bold uppercase text-sm">Jira nicht konfiguriert</h3>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">Bitte hinterlegen Sie eine valide Jira-Verbindung in den Einstellungen (inkl. Projekt-Key), um Tickets zu synchronisieren.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-none uppercase font-bold text-[10px]" onClick={() => window.location.href='/settings'}>Zu den Einstellungen</Button>
        </div>
      )}

      {activeConfig && (
        <Tabs value={activeTab} onValueChange={setActiveTab as any} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-12 rounded-none border w-full justify-start gap-2">
            <TabsTrigger value="pending" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
              1. Warteschlange ({pendingTickets.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
              2. Genehmigungen ({approvedTickets.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-none px-8 gap-2 text-[10px] font-bold uppercase data-[state=active]:bg-white">
              3. Erledigte Tickets ({doneTickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="admin-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4 font-bold uppercase text-[10px]">Key</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Prozess / Inhalt</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Erstellt</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Jira Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTickets.map((ticket) => {
                  const isOffboarding = ticket.summary.toLowerCase().includes('offboarding');
                  return (
                    <TableRow key={ticket.key} className="hover:bg-muted/5 border-b">
                      <TableCell className="py-4 font-bold text-primary text-xs">{ticket.key}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 mb-1">
                          {isOffboarding ? (
                            <Badge className="bg-red-50 text-red-700 rounded-none text-[8px] border-red-100 font-black px-1.5 h-4.5"><UserMinus className="w-2.5 h-2.5 mr-1" /> OFFBOARDING</Badge>
                          ) : (
                            <Badge className="bg-blue-50 text-blue-700 rounded-none text-[8px] border-blue-100 font-black px-1.5 h-4.5"><UserPlus className="w-2.5 h-2.5 mr-1" /> ONBOARDING</Badge>
                          )}
                        </div>
                        <div className="font-bold text-sm">{ticket.summary}</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Reporter: {ticket.reporter}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(ticket.created).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="rounded-none text-[9px] font-bold uppercase border-slate-200 bg-slate-50 text-slate-700">
                          {ticket.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pendingTickets.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">Keine Tickets in der Warteschlange.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="approved" className="admin-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4 font-bold uppercase text-[10px]">Key</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Inhalt</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Zugeordnete Rolle</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedTickets.map((ticket) => (
                  <TableRow key={ticket.key} className="hover:bg-muted/5 border-b">
                    <TableCell className="py-4 font-bold text-primary text-xs">{ticket.key}</TableCell>
                    <TableCell>
                      <div className="font-bold text-sm">{ticket.summary}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">{ticket.requestedUserEmail}</div>
                    </TableCell>
                    <TableCell>
                      {ticket.matchedRole ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-none rounded-none text-[9px] font-bold uppercase">{ticket.matchedRole.name}</Badge>
                      ) : (
                        <Select onValueChange={(val) => handleUpdateMatchedRole(ticket.key, val)}>
                          <SelectTrigger className="h-8 text-[9px] font-bold uppercase rounded-none border-dashed">
                            <SelectValue placeholder="Rolle wählen..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {entitlements?.map(e => (
                              <SelectItem key={e.id} value={e.id} className="text-xs">
                                {resources?.find(r => r.id === e.resourceId)?.name}: {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        className="h-8 text-[9px] font-bold uppercase rounded-none" 
                        disabled={!ticket.matchedRole} 
                        onClick={() => handleAssignFromApproved(ticket)}
                      >
                        Bestätigen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {approvedTickets.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">Keine genehmigten Tickets zur Verarbeitung.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 text-[10px] font-bold uppercase text-blue-700 leading-relaxed">
              Hinweis: Tickets, die in Jira auf 'Erledigt' stehen, müssen hier finalisiert werden, damit die Status-Änderungen (Onboarding/Offboarding) im ComplianceHub wirksam werden.
            </div>
            <div className="admin-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-4 font-bold uppercase text-[10px]">Key</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Prozess / Betreff</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Hub-Status</TableHead>
                    <TableHead className="text-right font-bold uppercase text-[10px]">Finalisierung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doneTickets.map((ticket) => {
                    const linkedViaKey = assignments?.filter(a => a.jiraIssueKey === ticket.key) || [];
                    let linkedAssignments = linkedViaKey;
                    
                    if (linkedAssignments.length === 0 && ticket.requestedUserEmail) {
                      const user = users?.find(u => u.email.toLowerCase() === ticket.requestedUserEmail.toLowerCase());
                      if (user) {
                        linkedAssignments = assignments?.filter(a => a.userId === user.id && (a.status === 'requested' || a.status === 'pending_removal')) || [];
                      }
                    }

                    const linkedCount = linkedAssignments.length;
                    const isAlreadyProcessed = linkedCount > 0 && linkedAssignments.every(a => a.status === 'active' || a.status === 'removed');
                    const isOffboarding = ticket.summary.toLowerCase().includes('offboarding');

                    return (
                      <TableRow key={ticket.key} className="hover:bg-muted/5 border-b">
                        <TableCell className="py-4 font-bold text-xs">{ticket.key}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 mb-1">
                            {isOffboarding ? (
                              <Badge className="bg-red-50 text-red-700 rounded-none text-[8px] border-red-100 font-black px-1.5 h-4.5"><UserMinus className="w-2.5 h-2.5 mr-1" /> OFFBOARDING</Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-700 rounded-none text-[8px] border-blue-100 font-black px-1.5 h-4.5"><UserPlus className="w-2.5 h-2.5 mr-1" /> ONBOARDING</Badge>
                            )}
                          </div>
                          <div className="font-bold text-sm">{ticket.summary}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">Status: {ticket.status}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="rounded-none text-[9px] font-bold uppercase border-slate-200 w-fit">
                              {linkedCount} Zuweisungen
                            </Badge>
                            {isAlreadyProcessed && <Badge className="bg-emerald-50 text-emerald-700 rounded-none text-[8px] w-fit">VERARBEITET</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className={cn(
                              "h-8 text-[9px] font-bold uppercase rounded-none",
                              isOffboarding ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                            )}
                            onClick={() => handleApplyCompletedTicket(ticket)}
                            disabled={linkedCount === 0 || isAlreadyProcessed}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {isOffboarding ? 'Entzug finalisieren' : 'Rechte aktivieren'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {doneTickets.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">Keine abgeschlossenen Tickets zur Finalisierung gefunden.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Technical Diagnostics Area */}
      {showDebug && (
        <Card className="rounded-none border-2 border-slate-200 shadow-none bg-slate-50 mt-12 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="bg-slate-900 text-white py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Technische Diagnose: Jira API-Tunnel
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Aktive Konfiguration</Label>
                  <div className="p-3 border bg-white rounded-none space-y-2">
                    <div className="flex justify-between text-[10px] font-bold border-b pb-1"><span>Quelle:</span> <span className="text-primary uppercase">{debugInfo.configSource}</span></div>
                    <div className="flex justify-between text-[10px] font-bold border-b pb-1"><span>Projekt Key:</span> <span className="uppercase">{activeConfig?.projectKey || 'MISSING'}</span></div>
                    <div className="flex justify-between text-[10px] font-bold border-b pb-1"><span>Status OK:</span> <span>{activeConfig?.approvedStatusName || 'MISSING'}</span></div>
                    <div className="flex justify-between text-[10px] font-bold"><span>Status DONE:</span> <span>{activeConfig?.doneStatusName || 'MISSING'}</span></div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Antwort-Statistik & API-Fehler</Label>
                  <div className="p-3 border bg-white rounded-none">
                    <ScrollArea className="h-64">
                      <pre className="text-[10px] font-mono whitespace-pre-wrap">
                        {JSON.stringify(debugInfo.lastResponse, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-2">
                    <FileCode className="w-3 h-3" /> Generierte JQL Abfragen
                  </Label>
                  <div className="space-y-2">
                    {Object.entries(debugInfo.jqlQueries).map(([key, jql]) => (
                      <div key={key} className="p-2 border bg-slate-100 rounded-none">
                        <p className="text-[8px] font-black uppercase text-slate-400 mb-1">{key} Queue</p>
                        <code className="text-[9px] font-mono break-all text-slate-700 leading-relaxed block">
                          {jql}
                        </code>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-2 italic">
                    Tipp: Kopieren Sie diese JQL-Abfragen direkt in den Jira Issue Navigator, um zu prüfen ob Jira dort Ergebnisse zurückliefert.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
