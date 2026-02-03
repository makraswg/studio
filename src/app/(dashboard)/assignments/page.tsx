"use client";

import { useState, useEffect } from 'react';
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
  History,
  X,
  FileDown,
  FileText,
  Network,
  Users,
  Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogTrigger
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
  deleteDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { exportToExcel, exportAssignmentsPdf } from '@/lib/export-utils';
import { Assignment, User, Entitlement, Resource } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';

export default function AssignmentsPage() {
  const db = useFirestore();
  const { dataSource } = useSettings();
  const searchParams = useSearchParams();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'requested' | 'removed'>('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  
  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Form State
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'requested' | 'removed'>('active');

  const { data: assignments, isLoading, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateAssignment = async () => {
    if (!selectedUserId || !selectedEntitlementId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Benutzer und Berechtigung wählen." });
      return;
    }

    const assignmentId = `ass-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const assignmentData = {
      id: assignmentId,
      userId: selectedUserId,
      entitlementId: selectedEntitlementId,
      status: 'active',
      grantedBy: authUser?.uid || 'system',
      grantedAt: timestamp,
      ticketRef,
      validUntil,
      notes,
      tenantId: 't1'
    };

    const auditData = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      actorUid: authUser?.uid || 'system',
      action: 'Einzelzuweisung erstellt',
      entityType: 'assignment',
      entityId: assignmentId,
      timestamp,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      const result = await saveCollectionRecord('assignments', assignmentId, assignmentData);
      if (!result.success) {
        toast({ variant: "destructive", title: "MySQL Fehler", description: result.error });
        return;
      }
      await saveCollectionRecord('auditEvents', auditData.id, auditData);
    } else {
      addDocumentNonBlocking(collection(db, 'assignments'), assignmentData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }
    
    setIsCreateOpen(false);
    toast({ title: "Zuweisung erstellt" });
    resetForm();
    setTimeout(() => refreshAssignments(), 200);
  };

  const handleUpdateAssignment = async () => {
    if (!selectedAssignmentId) return;

    const timestamp = new Date().toISOString();
    const assignmentData = {
      status,
      ticketRef,
      validUntil,
      notes,
    };

    const auditData = {
      id: `audit-${Math.random().toString(36).substring(2, 9)}`,
      actorUid: authUser?.uid || 'system',
      action: 'Zuweisung aktualisiert',
      entityType: 'assignment',
      entityId: selectedAssignmentId,
      timestamp,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      const existing = assignments?.find(a => a.id === selectedAssignmentId);
      if (existing) {
        const result = await saveCollectionRecord('assignments', selectedAssignmentId, { ...existing, ...assignmentData });
        if (!result.success) {
          toast({ variant: "destructive", title: "MySQL Fehler", description: result.error });
          return;
        }
        await saveCollectionRecord('auditEvents', auditData.id, auditData);
      }
    } else {
      updateDocumentNonBlocking(doc(db, 'assignments', selectedAssignmentId), assignmentData);
      addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
    }

    setIsEditDialogOpen(false);
    toast({ title: "Zuweisung aktualisiert" });
    resetForm();
    setTimeout(() => refreshAssignments(), 200);
  };

  const confirmDeleteAssignment = async () => {
    if (selectedAssignmentId) {
      const timestamp = new Date().toISOString();
      const auditData = {
        id: `audit-${Math.random().toString(36).substring(2, 9)}`,
        actorUid: authUser?.uid || 'system',
        action: 'Zuweisung gelöscht',
        entityType: 'assignment',
        entityId: selectedAssignmentId,
        timestamp,
        tenantId: 't1'
      };

      if (dataSource === 'mysql') {
        const result = await deleteCollectionRecord('assignments', selectedAssignmentId);
        if (!result.success) {
          toast({ variant: "destructive", title: "MySQL Fehler", description: result.error });
          return;
        }
        await saveCollectionRecord('auditEvents', auditData.id, auditData);
      } else {
        deleteDocumentNonBlocking(doc(db, 'assignments', selectedAssignmentId));
        addDocumentNonBlocking(collection(db, 'auditEvents'), auditData);
      }
      toast({ title: "Zuweisung gelöscht" });
      setIsDeleteDialogOpen(false);
      resetForm();
      setTimeout(() => refreshAssignments(), 200);
    }
  };

  const openEdit = (assignment: any) => {
    setSelectedAssignmentId(assignment.id);
    setSelectedUserId(assignment.userId);
    setSelectedEntitlementId(assignment.entitlementId);
    setTicketRef(assignment.ticketRef || '');
    setValidUntil(assignment.validUntil || '');
    setNotes(assignment.notes || '');
    setStatus(assignment.status || 'active');
    setTimeout(() => setIsEditDialogOpen(true), 150);
  };

  const openDelete = (assignment: any) => {
    setSelectedAssignmentId(assignment.id);
    setTimeout(() => setIsDeleteDialogOpen(true), 150);
  };

  const filteredAssignments = assignments?.filter(assignment => {
    const user = users?.find(u => u.id === (assignment.userId));
    const entitlement = entitlements?.find(e => e.id === (assignment.entitlementId));
    const resource = resources?.find(r => r.id === entitlement?.resourceId);
    
    const userName = user?.displayName || user?.name || '';
    const resourceName = resource?.name || '';
    const assignmentUserId = assignment.userId || '';

    const searchLower = search.toLowerCase();

    const matchesSearch = 
      userName.toLowerCase().includes(searchLower) || 
      resourceName.toLowerCase().includes(searchLower) ||
      assignmentUserId.toLowerCase().includes(searchLower);
      
    const matchesTab = activeTab === 'all' || assignment.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleExportPdf = () => {
    if (!filteredAssignments || !users || !entitlements || !resources) return;
    exportAssignmentsPdf(filteredAssignments, users, entitlements, resources);
  };

  const resetForm = () => {
    setSelectedAssignmentId(null);
    setSelectedUserId('');
    setSelectedEntitlementId('');
    setTicketRef('');
    setValidUntil('');
    setNotes('');
    setStatus('active');
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einzelzuweisungen</h1>
          <p className="text-sm text-muted-foreground">Verwalten Sie direkte Berechtigungen für einzelne Benutzer ({dataSource.toUpperCase()}).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={handleExportPdf}>
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
            placeholder="Suche nach Benutzer, System oder Referenz..." 
            className="pl-10 h-10 shadow-none border-border rounded-none bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border rounded-none p-1 bg-muted/20">
          {['all', 'active', 'requested', 'removed'].map(id => (
            <Button 
              key={id} 
              variant={activeTab === id ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab(id as any)} 
              className="h-8 text-[9px] font-bold uppercase px-4 rounded-none"
            >
              {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Pending' : 'Inaktiv'}
            </Button>
          ))}
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Lade Daten...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Mitarbeiter</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">System / Rolle</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Gültigkeit</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map((assignment) => {
                const user = users?.find(u => u.id === (assignment.userId));
                const userName = user?.displayName || user?.name;
                const ent = entitlements?.find(e => e.id === (assignment.entitlementId));
                const res = resources?.find(r => r.id === ent?.resourceId);
                const isExpired = assignment.validUntil && new Date(assignment.validUntil) < new Date();
                const isFromGroup = !!assignment.originGroupId;

                return (
                  <TableRow key={assignment.id} className="group transition-colors hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {(userName || 'U').charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {userName || assignment.userId}
                            {isFromGroup && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Users className="w-3.5 h-3.5 text-blue-500 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="text-[10px] font-bold uppercase">Via Gruppe zugewiesen</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase">{assignment.ticketRef || 'KEIN TICKET'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm flex items-center gap-1.5">
                          {res?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">{ent?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignment.validUntil ? (
                        <div className={cn(
                          "flex items-center gap-1.5 font-bold text-[10px] uppercase",
                          isExpired ? "text-red-600" : "text-slate-600"
                        )}>
                          <Calendar className="w-3 h-3" />
                          {new Date(assignment.validUntil).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider italic">Unbefristet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "rounded-none font-bold uppercase text-[9px] px-2 py-0 border-none",
                        assignment.status === 'active' ? "bg-emerald-50 text-emerald-700" : 
                        assignment.status === 'requested' ? "bg-amber-50 text-amber-700" : 
                        "bg-red-50 text-red-700"
                      )}>
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isFromGroup ? (
                        <div className="text-[10px] font-bold text-muted-foreground uppercase px-2 italic">Nur via Gruppe editierbar</div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-muted">
                              <MoreHorizontal className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 p-1 shadow-xl rounded-none">
                            <DropdownMenuItem onSelect={() => openEdit(assignment)}>
                              <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700" onSelect={() => openDelete(assignment)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Zuweisung löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        <DialogContent className="rounded-none border shadow-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Neue Zuweisung erstellen</DialogTitle>
            <DialogDescription className="text-xs">
              Direkte Zuweisung einer Rolle an einen Mitarbeiter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Benutzer wählen</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="Mitarbeiter auswählen..." />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {users?.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.displayName || u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Berechtigung / Rolle wählen</Label>
              <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="Ressource und Rolle wählen..." />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {entitlements?.map(e => {
                    const res = resources?.find(r => r.id === e.resourceId);
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {res?.name} - {e.name} ({e.riskLevel})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Ticket-Referenz</Label>
                <Input value={ticketRef} onChange={e => setTicketRef(e.target.value)} placeholder="z.B. INC-10293" className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gültig bis (Optional)</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleCreateAssignment} className="rounded-none font-bold uppercase text-[10px]">Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-none border shadow-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Zuweisung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="requested">Pending / Angefragt</SelectItem>
                  <SelectItem value="removed">Inaktiv / Entzogen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Ticket-Referenz</Label>
                <Input value={ticketRef} onChange={e => setTicketRef(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Gültig bis</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleUpdateAssignment} className="rounded-none font-bold uppercase text-[10px]">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 font-bold uppercase flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Zuweisung löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Dies entfernt die Zuweisung unwiderruflich. Der Benutzer verliert sofort den Zugriff auf das System.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAssignment} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
