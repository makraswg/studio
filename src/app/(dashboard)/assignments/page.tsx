
"use client";

import { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  Shield,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  AlertTriangle,
  FileDown,
  Users,
  Check,
  Clock,
  XCircle,
  ExternalLink,
  Link as LinkIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { exportAssignmentsPdf } from '@/lib/export-utils';
import { Assignment, User, Entitlement, Resource } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { createJiraTicket, getJiraConfigs } from '@/app/actions/jira-actions';

export default function AssignmentsPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  const searchParams = useSearchParams();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'requested' | 'removed'>('active');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  
  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isJiraLoading, setIsJiraLoading] = useState<string | null>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  
  // Form State
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [jiraIssueKey, setJiraIssueKey] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'requested' | 'removed'>('active');
  const [removalDate, setRemovalDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: assignments, isLoading, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');

  useEffect(() => {
    setMounted(true);
    loadJiraConfig();
  }, []);

  const loadJiraConfig = async () => {
    const configs = await getJiraConfigs();
    if (configs.length > 0) {
      setJiraBaseUrl(configs[0].url);
    }
  };

  const handleCreateJiraTicket = async (assignment: Assignment) => {
    setIsJiraLoading(assignment.id);
    const user = users?.find(u => u.id === assignment.userId);
    const ent = entitlements?.find(e => e.id === assignment.entitlementId);
    
    const configs = await getJiraConfigs();
    if (configs.length === 0 || !configs[0].enabled) {
      toast({ variant: "destructive", title: "Jira nicht aktiv", description: "Bitte konfigurieren Sie Jira in den Einstellungen." });
      setIsJiraLoading(null);
      return;
    }

    const res = await createJiraTicket(
      configs[0].id,
      `Gültigkeit abgelaufen: ${ent?.name} für ${user?.displayName}`,
      `Die Berechtigung "${ent?.name}" für den Benutzer "${user?.displayName}" (${user?.email}) ist am ${assignment.validUntil} abgelaufen. Bitte prüfen Sie die Verlängerung.`
    );

    if (res.success) {
      toast({ title: "Jira Ticket erstellt", description: `Key: ${res.key}` });
      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', assignment.id, { ...assignment, jiraIssueKey: res.key });
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', assignment.id), { jiraIssueKey: res.key });
      }
      refreshAssignments();
    } else {
      toast({ variant: "destructive", title: "Jira Fehler", description: res.error });
    }
    setIsJiraLoading(null);
  };

  const handleCreateAssignment = async () => {
    if (!selectedUserId || !selectedEntitlementId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Benutzer und Berechtigung wählen." });
      return;
    }

    const user = users?.find(u => u.id === selectedUserId);
    const ent = entitlements?.find(e => e.id === selectedEntitlementId);
    const res = resources?.find(r => r.id === ent?.resourceId);

    // IMMER eine neue ID generieren, um die Historie pro Jira-Ticket zu wahren
    const assignmentId = `ass-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const assignmentData = {
      id: assignmentId,
      userId: selectedUserId,
      entitlementId: selectedEntitlementId,
      status: 'active',
      grantedBy: authUser?.uid || 'system',
      grantedAt: timestamp,
      validFrom: validFrom || timestamp.split('T')[0],
      validUntil,
      jiraIssueKey,
      ticketRef: jiraIssueKey || 'MANUELL',
      notes,
      tenantId: 't1'
    };

    const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
    const auditData = {
      id: auditId,
      actorUid: authUser?.uid || 'system',
      action: `Einzelzuweisung [${ent?.name}] für [${user?.displayName}] erstellt (Jira: ${jiraIssueKey || 'keine'})`,
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
      setDocumentNonBlocking(doc(db, 'assignments', assignmentId), assignmentData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }
    
    setIsCreateOpen(false);
    toast({ title: "Zuweisung erstellt" });
    resetForm();
    setTimeout(() => refreshAssignments(), 200);
  };

  const handleUpdateAssignment = async () => {
    if (!selectedAssignmentId) return;
    const existing = assignments?.find(a => a.id === selectedAssignmentId);
    if (!existing) return;

    const updateData = { status, jiraIssueKey, ticketRef: jiraIssueKey, validFrom, validUntil, notes };
    if (dataSource === 'mysql') {
      await saveCollectionRecord('assignments', selectedAssignmentId, { ...existing, ...updateData });
    } else {
      updateDocumentNonBlocking(doc(db, 'assignments', selectedAssignmentId), updateData);
    }

    setIsEditDialogOpen(false);
    toast({ title: "Zuweisung aktualisiert" });
    resetForm();
    setTimeout(() => refreshAssignments(), 200);
  };

  const confirmDeleteAssignment = async () => {
    if (selectedAssignmentId) {
      const existing = assignments?.find(a => a.id === selectedAssignmentId);
      const user = users?.find(u => u.id === existing?.userId);
      const ent = entitlements?.find(e => e.id === existing?.entitlementId);
      
      const updatedAssignment = {
        ...existing,
        status: 'removed',
        validUntil: removalDate,
        notes: `${existing?.notes || ''} [Beendet am ${removalDate}]`.trim()
      };

      const auditId = `audit-${Math.random().toString(36).substring(2, 9)}`;
      const auditData = {
        id: auditId,
        actorUid: authUser?.uid || 'system',
        action: `Zuweisung [${ent?.name}] für [${user?.displayName}] beendet (Gültig bis: ${removalDate})`,
        entityType: 'assignment',
        entityId: selectedAssignmentId,
        timestamp: new Date().toISOString(),
        tenantId: 't1',
        before: existing,
        after: updatedAssignment
      };

      if (dataSource === 'mysql') {
        await saveCollectionRecord('assignments', selectedAssignmentId, updatedAssignment);
        await saveCollectionRecord('auditEvents', auditId, auditData);
      } else {
        updateDocumentNonBlocking(doc(db, 'assignments', selectedAssignmentId), { 
          status: 'removed', 
          validUntil: removalDate 
        });
        addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
      }
      
      toast({ title: "Zuweisung archiviert" });
      setIsDeleteDialogOpen(false);
      resetForm();
      setTimeout(() => refreshAssignments(), 200);
    }
  };

  const resetForm = () => {
    setSelectedAssignmentId(null);
    setSelectedUserId('');
    setSelectedEntitlementId('');
    setJiraIssueKey('');
    setValidFrom(new Date().toISOString().split('T')[0]);
    setValidUntil('');
    setNotes('');
    setStatus('active');
  };

  if (!mounted) return null;

  const filteredAssignments = assignments?.filter(a => {
    const user = users?.find(u => u.id === a.userId);
    const ent = entitlements?.find(e => e.id === a.entitlementId);
    const res = resources?.find(r => r.id === ent?.resourceId);
    const match = (user?.displayName || '').toLowerCase().includes(search.toLowerCase()) || 
                  (res?.name || '').toLowerCase().includes(search.toLowerCase()) ||
                  (a.jiraIssueKey || '').toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'all' || a.status === activeTab;
    return match && matchTab;
  });

  // Filter für Rollen, die der gewählte User noch nicht aktiv hat
  const availableEntitlements = entitlements?.filter(e => {
    if (!selectedUserId) return true;
    const userHasIt = assignments?.some(a => a.userId === selectedUserId && a.entitlementId === e.id && a.status === 'active');
    return !userHasIt;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einzelzuweisungen</h1>
          <p className="text-sm text-muted-foreground">Arbeits- und Dokumentationsübersicht (Jira-integriert).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => exportAssignmentsPdf(filteredAssignments || [], users || [], entitlements || [], resources || [])}>
            <FileDown className="w-3.5 h-3.5 mr-2" /> Export
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Zuweisung erstellen
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Mitarbeiter, System oder Jira-Key suchen..." 
            className="pl-10 h-10 rounded-none bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border rounded-none p-1 bg-muted/20">
          {['all', 'active', 'requested', 'removed'].map(id => (
            <Button key={id} variant={activeTab === id ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab(id as any)} className="h-8 text-[9px] font-bold uppercase px-4 rounded-none">
              {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Pending' : 'Inaktiv'}
            </Button>
          ))}
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Mitarbeiter</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">System / Rolle</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Dokumentation (Jira)</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Gültigkeit</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map((a) => {
                const user = users?.find(u => u.id === a.userId);
                const ent = entitlements?.find(e => e.id === a.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                const isExpired = a.validUntil && new Date(a.validUntil) < new Date() && a.status === 'active';

                return (
                  <TableRow key={a.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="font-bold text-sm">{user?.displayName || a.userId}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">{user?.department || 'Keine Abteilung'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-sm">{res?.name}</div>
                      <div className="text-xs text-muted-foreground">{ent?.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {a.jiraIssueKey ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 rounded-none text-[9px] font-bold border-blue-100 uppercase">
                              {a.jiraIssueKey}
                            </Badge>
                            {jiraBaseUrl && (
                              <a href={`${jiraBaseUrl}/browse/${a.jiraIssueKey}`} target="_blank" className="p-1 hover:bg-slate-100 rounded-sm">
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic font-bold">KEIN TICKET</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-slate-600">
                          <Clock className="w-3 h-3" /> Ab: {a.validFrom ? new Date(a.validFrom).toLocaleDateString() : 'Sofort'}
                        </div>
                        {a.validUntil && (
                          <div className={cn("flex items-center gap-1.5 font-bold text-[10px] uppercase", isExpired ? "text-red-600" : "text-slate-600")}>
                            <Calendar className="w-3 h-3" /> Bis: {new Date(a.validUntil).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("rounded-none font-bold uppercase text-[9px] border-none", a.status === 'active' ? "bg-emerald-50 text-emerald-700" : a.status === 'requested' ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.originGroupId ? (
                        <div className="text-[10px] font-bold text-muted-foreground uppercase px-2 italic">Via Gruppe</div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {isExpired && !a.jiraIssueKey && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-[9px] font-bold uppercase border-orange-200 text-orange-600 hover:bg-orange-50 rounded-none"
                              onClick={() => handleCreateJiraTicket(a)}
                              disabled={isJiraLoading === a.id}
                            >
                              {isJiraLoading === a.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <LinkIcon className="w-3 h-3 mr-1" />} Jira Ticket
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-none shadow-xl">
                              <DropdownMenuItem onSelect={() => { setSelectedAssignmentId(a.id); setStatus(a.status); setJiraIssueKey(a.jiraIssueKey || ''); setValidFrom(a.validFrom || ''); setValidUntil(a.validUntil || ''); setNotes(a.notes); setIsEditDialogOpen(true); }}><Pencil className="w-4 h-4 mr-2" /> Bearbeiten</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onSelect={() => { setSelectedAssignmentId(a.id); setIsDeleteDialogOpen(true); }}><XCircle className="w-4 h-4 mr-2" /> Beenden</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Zuweisung Erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Benutzer</Label>
              <Select value={selectedUserId} onValueChange={(val) => { setSelectedUserId(val); setSelectedEntitlementId(''); }}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Mitarbeiter..." /></SelectTrigger>
                <SelectContent className="rounded-none">{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Rolle</Label>
              <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId} disabled={!selectedUserId}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder={selectedUserId ? "Rolle..." : "Zuerst Mitarbeiter wählen"} />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {availableEntitlements?.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                  {availableEntitlements?.length === 0 && (
                    <div className="p-4 text-center text-[10px] font-bold uppercase text-muted-foreground">Keine weiteren Rollen verfügbar</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Jira Ticket-Referenz (Key)</Label>
              <Input value={jiraIssueKey} onChange={e => setJiraIssueKey(e.target.value.toUpperCase())} placeholder="z.B. IT-1234" className="rounded-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Gültig ab</Label>
                <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Freigabe bis (Vorgesetzter)</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleCreateAssignment} className="rounded-none font-bold uppercase text-[10px]">Zuweisen & Dokumentieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Zuweisung Bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Jira Ticket-Referenz (Key)</Label>
              <Input value={jiraIssueKey} onChange={e => setJiraIssueKey(e.target.value.toUpperCase())} className="rounded-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Gültig ab</Label>
                <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Freigabe bis (Vorgesetzter)</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Bemerkungen</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleUpdateAssignment} className="rounded-none font-bold uppercase text-[10px]">Änderungen Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="text-red-600 font-bold uppercase">Zuweisung Beenden</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-xs leading-relaxed">
              Möchten Sie diese Berechtigung im ComplianceHub archivieren? Der Status wird auf 'Inaktiv' gesetzt. Hinweis: Diese Aktion hat keinen direkten Einfluss auf das Zielsystem (nur Dokumentation).
            </p>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Abmeldedatum</Label>
              <Input type="date" value={removalDate} onChange={e => setRemovalDate(e.target.value)} className="rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={confirmDeleteAssignment} className="bg-red-600 hover:bg-red-700 text-white rounded-none font-bold uppercase text-[10px]">Beenden & Archivieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
