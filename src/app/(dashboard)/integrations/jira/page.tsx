
"use client";

import { useState, useEffect } from 'react';
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
  Ticket
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export default function JiraSyncPage() {
  const { dataSource } = useSettings();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed'>('approved');
  
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [approvedTickets, setApprovedTickets] = useState<any[]>([]);
  const [doneTickets, setDoneTickets] = useState<any[]>([]);
  const [activeConfig, setActiveConfig] = useState<any>(null);

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
    try {
      const configs = await getJiraConfigs();
      if (configs.length > 0 && configs[0].enabled) {
        setActiveConfig(configs[0]);
        
        const [pending, approved, done] = await Promise.all([
          fetchJiraSyncItems(configs[0].id, 'pending'),
          fetchJiraSyncItems(configs[0].id, 'approved'),
          fetchJiraSyncItems(configs[0].id, 'done')
        ]);
        
        setPendingTickets(pending);
        
        setApprovedTickets(approved.map(t => {
          // Check for existing requested assignments first
          const existingAssignment = assignments?.find(a => a.jiraIssueKey === t.key);
          const matchedRole = entitlements?.find(e => t.summary.toLowerCase().includes(e.name.toLowerCase()));
          
          return {
            ...t,
            existingAssignment,
            matchedRole: existingAssignment ? entitlements?.find(e => e.id === existingAssignment.entitlementId) : matchedRole
          };
        }));
        
        setDoneTickets(done);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "API Fehler", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCompletedTicket = async (ticket: any) => {
    const linkedAssignments = assignments?.filter(a => a.jiraIssueKey === ticket.key) || [];
    if (linkedAssignments.length === 0) {
      toast({ variant: "destructive", title: "Keine Daten", description: "Keine ausstehenden Änderungen für dieses Ticket gefunden." });
      return;
    }

    const isLeaver = ticket.summary.toLowerCase().includes('offboarding');
    const timestamp = new Date().toISOString();
    let affectedUserId = linkedAssignments[0].userId;

    for (const a of linkedAssignments) {
      const newStatus = isLeaver ? 'removed' : 'active';
      const updateData = { status: newStatus, lastReviewedAt: timestamp };
      
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', a.id, { ...a, ...updateData });
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', a.id), updateData);
      }
    }

    if (isLeaver) {
      const user = users?.find(u => u.id === affectedUserId);
      if (user) {
        const userData = { ...user, enabled: false, offboardingDate: timestamp.split('T')[0] };
        if (dataSource === 'mysql') {
          await saveCollectionRecord('users', user.id, userData);
        } else {
          updateDocumentNonBlocking(doc(db, 'users', user.id), { enabled: false, offboardingDate: timestamp.split('T')[0] });
        }
      }
    }

    toast({ title: "Finalisierung erfolgreich", description: `Änderungen für Ticket ${ticket.key} wurden im Hub übernommen.` });
    setDoneTickets(prev => prev.filter(t => t.key !== ticket.key));
    setTimeout(() => refreshAssignments(), 200);
  };

  const handleAssignFromApproved = async (ticket: any) => {
    const user = users?.find(u => u.email.toLowerCase() === ticket.requestedUserEmail?.toLowerCase());
    const ent = ticket.matchedRole;
    
    if (!user || !ent) {
      toast({ variant: "destructive", title: "Zuweisung nicht möglich", description: "Benutzer oder Rolle konnte nicht automatisch zugeordnet werden." });
      return;
    }

    const timestamp = new Date().toISOString();

    // Check if it's an existing requested assignment
    if (ticket.existingAssignment) {
      const updateData = { status: 'active', lastReviewedAt: timestamp };
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', ticket.existingAssignment.id, { ...ticket.existingAssignment, ...updateData });
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', ticket.existingAssignment.id), updateData);
      }
    } else {
      // New external assignment
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
        tenantId: 't1'
      };

      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', assignmentId, assignmentData);
      } else {
        addDocumentNonBlocking(collection(db, 'assignments'), assignmentData);
      }
    }

    await resolveJiraTicket(activeConfig.id, ticket.key, "Berechtigung im ComplianceHub aktiviert.");
    setApprovedTickets(prev => prev.filter(t => t.key !== ticket.key));
    toast({ title: "Ticket verarbeitet" });
    setTimeout(() => refreshAssignments(), 200);
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
        <Button variant="outline" size="sm" onClick={loadSyncData} disabled={isLoading} className="h-9 font-bold uppercase text-[10px] rounded-none">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} Aktualisieren
        </Button>
      </div>

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
                <TableHead className="font-bold uppercase text-[10px]">Inhalt</TableHead>
                <TableHead className="font-bold uppercase text-[10px]">Erstellt</TableHead>
                <TableHead className="text-right font-bold uppercase text-[10px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTickets.map((ticket) => (
                <TableRow key={ticket.key} className="hover:bg-muted/5 border-b">
                  <TableCell className="py-4 font-bold text-primary text-xs">{ticket.key}</TableCell>
                  <TableCell>
                    <div className="font-bold text-sm">{ticket.summary}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">{ticket.reporter}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(ticket.created).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="rounded-none text-[9px] font-bold uppercase border-slate-200">
                      {ticket.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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
                  <TableHead className="font-bold uppercase text-[10px]">Zugehörige Items</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Finalisierung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doneTickets.map((ticket) => {
                  const linkedCount = assignments?.filter(a => a.jiraIssueKey === ticket.key).length || 0;
                  return (
                    <TableRow key={ticket.key} className="hover:bg-muted/5 border-b">
                      <TableCell className="py-4 font-bold text-xs">{ticket.key}</TableCell>
                      <TableCell>
                        <div className="font-bold text-sm">{ticket.summary}</div>
                        <div className="text-[9px] text-muted-foreground uppercase">Status: {ticket.status}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-none text-[9px] font-bold uppercase border-slate-200">
                          {linkedCount} Zuweisungen
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          className="h-8 text-[9px] font-bold uppercase rounded-none bg-blue-600 hover:bg-blue-700" 
                          onClick={() => handleApplyCompletedTicket(ticket)}
                          disabled={linkedCount === 0}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Änderungen übernehmen
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
    </div>
  );
}
