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
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { fetchJiraApprovedRequests, resolveJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { User, Entitlement, Resource, Assignment } from '@/lib/types';
import { useFirestore, addDocumentNonBlocking, useUser as useAuthUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';

export default function JiraSyncPage() {
  const { dataSource } = useSettings();
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jiraTickets, setJiraTickets] = useState<any[]>([]);
  const [activeConfig, setActiveConfig] = useState<any>(null);

  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: assignments, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');

  useEffect(() => {
    setMounted(true);
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const configs = await getJiraConfigs();
      if (configs.length > 0 && configs[0].enabled) {
        setActiveConfig(configs[0]);
        const tickets = await fetchJiraApprovedRequests(configs[0].id);
        setJiraTickets(tickets);
      }
    } catch (e: any) {
      setError(e.message || "Unbekannter Fehler beim Abrufen der Jira-Daten.");
      toast({ variant: "destructive", title: "Synchronisationsfehler", description: "Bitte prüfen Sie die API-Konfiguration." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignFromJira = async (ticket: any) => {
    if (!activeConfig) return;

    const user = users?.find(u => u.email.toLowerCase() === ticket.requestedUserEmail?.toLowerCase());
    
    if (!user) {
      toast({ 
        variant: "destructive", 
        title: "Benutzer nicht gefunden", 
        description: `Keine Identität für ${ticket.requestedUserEmail || 'unbekannte E-Mail'} gefunden.` 
      });
      return;
    }

    const ent = entitlements?.[0]; 
    if (!ent) {
      toast({ variant: "destructive", title: "Fehler", description: "Keine Rollen im System definiert." });
      return;
    }

    const alreadyHas = assignments?.some(a => a.userId === user.id && a.entitlementId === ent.id && a.status === 'active');
    if (alreadyHas) {
      toast({ variant: "destructive", title: "Schon zugewiesen", description: `${user.displayName} besitzt diese Rolle bereits.` });
      return;
    }

    const assignmentId = `ass-jira-${ticket.key}-${Math.random().toString(36).substring(2, 5)}`;
    const timestamp = new Date().toISOString();
    
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
      notes: `Automatisch erstellt via Jira Ticket ${ticket.key}. Antragsteller: ${ticket.reporter}`,
      tenantId: 't1'
    };

    const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
    const auditData = {
      id: auditId,
      actorUid: 'jira-sync',
      action: `Zuweisung [${ent.name}] für [${user.displayName}] via Jira-Sync erstellt`,
      entityType: 'assignment',
      entityId: assignmentId,
      timestamp,
      tenantId: 't1',
      after: assignmentData
    };

    if (dataSource === 'mysql') {
      await saveCollectionRecord('assignments', assignmentId, assignmentData);
      await saveCollectionRecord('auditEvents', auditId, auditData);
    } else {
      addDocumentNonBlocking(collection(db, 'assignments'), assignmentData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    await resolveJiraTicket(activeConfig.id, ticket.key, "Berechtigung wurde erfolgreich im ComplianceHub zugewiesen.");

    toast({ title: "Zuweisung erfolgt", description: `Berechtigung für ${user.displayName} wurde aktiviert.` });
    setJiraTickets(prev => prev.filter(t => t.key !== ticket.key));
    setTimeout(() => refreshAssignments(), 200);
  };

  if (!mounted) return null;

  const debugJql = activeConfig ? `project = "${activeConfig.projectKey}" AND status = "${activeConfig.approvedStatusName}"${activeConfig.issueTypeName ? ` AND "Request Type" = "${activeConfig.issueTypeName}"` : ''}` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jira Synchronisation</h1>
          <p className="text-sm text-muted-foreground">Genehmigte Tickets als Berechtigungs-Grundlage.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSyncData} disabled={isLoading} className="h-9 font-bold uppercase text-[10px] rounded-none">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />} Aktualisieren
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-none flex items-center gap-3">
          <XCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase">Fehler beim Datenabruf</p>
            <p className="text-xs">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSyncData} className="bg-white rounded-none h-8 text-[9px] font-bold uppercase border-red-200">Wiederholen</Button>
        </div>
      )}

      {!activeConfig && !isLoading && (
        <div className="p-8 border-2 border-dashed rounded-none text-center bg-muted/10">
          <AlertTriangle className="w-10 h-10 text-orange-400 mx-auto mb-4" />
          <h3 className="font-bold text-sm uppercase">Jira Integration nicht konfiguriert</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-6">Bitte hinterlegen Sie API-Daten in den Einstellungen.</p>
          <Button size="sm" className="rounded-none font-bold uppercase text-[10px]" asChild>
            <a href="/settings">Zu den Einstellungen</a>
          </Button>
        </div>
      )}

      {activeConfig && !error && (
        <div className="admin-card overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jira API wird abgefragt...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Jira Key</TableHead>
                  <TableHead className="font-bold uppercase tracking-widest text-[10px]">Anfrage / Inhalt</TableHead>
                  <TableHead className="font-bold uppercase tracking-widest text-[10px]">Antragsteller</TableHead>
                  <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status (Jira)</TableHead>
                  <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jiraTickets.map((ticket) => (
                  <TableRow key={ticket.key} className="hover:bg-muted/5 border-b">
                    <TableCell className="py-4 font-bold text-primary text-xs">
                      <a href={`${activeConfig.url}/browse/${ticket.key}`} target="_blank" className="flex items-center gap-1 hover:underline">
                        {ticket.key} <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{ticket.summary}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                          {ticket.requestedUserEmail ? `Ziel-User: ${ticket.requestedUserEmail}` : "Keine E-Mail in Beschreibung gefunden"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-600 uppercase">{ticket.reporter}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-none text-[9px] font-bold uppercase px-2">{ticket.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        className="h-8 text-[9px] font-bold uppercase rounded-none bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleAssignFromJira(ticket)}
                        disabled={!ticket.requestedUserEmail}
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Zuweisung Bestätigen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {jiraTickets.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center p-8">
                      <div className="flex flex-col items-center gap-4">
                        <Info className="w-8 h-8 text-slate-300" />
                        <div className="space-y-1">
                          <p className="text-muted-foreground font-bold text-xs uppercase">Keine passenden Tickets gefunden</p>
                          <p className="text-[10px] text-muted-foreground max-w-md mx-auto">
                            Stellen Sie sicher, dass Tickets in Jira den Status "{activeConfig.approvedStatusName}" und den Anfragetyp "{activeConfig.issueTypeName}" besitzen.
                          </p>
                        </div>
                        <div className="bg-slate-50 border p-3 rounded-none w-full max-w-lg text-left">
                          <p className="text-[9px] font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
                            <Terminal className="w-3 h-3" /> Verwendete JQL-Abfrage:
                          </p>
                          <code className="text-[10px] font-mono text-blue-600 break-all select-all">
                            {debugJql}
                          </code>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <div className="p-4 bg-blue-50 border text-[10px] font-bold uppercase text-blue-700 leading-relaxed">
        Hinweis: Das System sucht in Jira nach Tickets, bei denen eine gültige E-Mail-Adresse in der Beschreibung hinterlegt ist. Die API nutzt den POST /search Endpunkt für maximale Kompatibilität.
      </div>
    </div>
  );
}
