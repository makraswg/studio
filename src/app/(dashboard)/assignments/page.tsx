
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
  Users
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
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser as useAuthUser 
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { exportToExcel, exportAssignmentsPdf } from '@/lib/export-utils';

export default function AssignmentsPage() {
  const db = useFirestore();
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

  const assignmentsQuery = useMemoFirebase(() => collection(db, 'assignments'), [db]);
  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const entitlementsQuery = useMemoFirebase(() => collection(db, 'entitlements'), [db]);
  const resourcesQuery = useMemoFirebase(() => collection(db, 'resources'), [db]);

  const { data: assignments, isLoading } = useCollection(assignmentsQuery);
  const { data: users } = useCollection(usersQuery);
  const { data: entitlements } = useCollection(entitlementsQuery);
  const { data: resources } = useCollection(resourcesQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateAssignment = () => {
    if (!selectedUserId || !selectedEntitlementId) {
      toast({ variant: "destructive", title: "Fehler", description: "Bitte Benutzer und Berechtigung wählen." });
      return;
    }

    addDocumentNonBlocking(collection(db, 'assignments'), {
      userId: selectedUserId,
      entitlementId: selectedEntitlementId,
      status: 'active',
      grantedBy: authUser?.uid || 'system',
      grantedAt: new Date().toISOString(),
      ticketRef,
      validUntil,
      notes,
      tenantId: 't1'
    });
    
    setIsCreateOpen(false);
    toast({ title: "Zuweisung erstellt" });
    resetForm();
  };

  const handleUpdateAssignment = () => {
    if (!selectedAssignmentId) return;

    updateDocumentNonBlocking(doc(db, 'assignments', selectedAssignmentId), {
      status,
      ticketRef,
      validUntil,
      notes,
    });

    setIsEditDialogOpen(false);
    toast({ title: "Zuweisung aktualisiert" });
    resetForm();
  };

  const confirmDeleteAssignment = () => {
    if (selectedAssignmentId) {
      deleteDocumentNonBlocking(doc(db, 'assignments', selectedAssignmentId));
      toast({ title: "Zuweisung gelöscht" });
      setIsDeleteDialogOpen(false);
      resetForm();
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
    const user = users?.find(u => u.id === assignment.userId);
    const entitlement = entitlements?.find(e => e.id === assignment.entitlementId);
    const resource = resources?.find(r => r.id === entitlement?.resourceId);
    
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      user?.displayName.toLowerCase().includes(searchLower) || 
      resource?.name.toLowerCase().includes(searchLower) ||
      assignment.userId.toLowerCase().includes(searchLower);
      
    const matchesTab = activeTab === 'all' || assignment.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleExportExcel = () => {
    if (!filteredAssignments) return;
    const exportData = filteredAssignments.map(a => {
      const user = users?.find(u => u.id === a.userId);
      const ent = entitlements?.find(e => e.id === a.entitlementId);
      const res = resources?.find(r => r.id === ent?.resourceId);
      return {
        Benutzer: user?.displayName || a.userId,
        Email: user?.email || '',
        System: res?.name || '---',
        Rolle: ent?.name || '---',
        Status: a.status,
        Herkunft: a.originGroupId ? 'GRUPPE' : 'DIREKT',
        GueltigBis: a.validUntil || 'Unbefristet',
        Ticket: a.ticketRef || ''
      };
    });
    exportToExcel(exportData, 'AccessHub_Zuweisungen');
  };

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
          <h1 className="text-2xl font-bold tracking-tight">Zugriffszuweisungen</h1>
          <p className="text-sm text-muted-foreground">Verwaltung aktiver Berechtigungen und deren Laufzeiten.</p>
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none">
                <FileDown className="w-3.5 h-3.5 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-none">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileDown className="w-4 h-4 mr-2" /> Excel Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="w-4 h-4 mr-2" /> PDF Bericht
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none">
                <Plus className="w-3.5 h-3.5 mr-2" /> Neue Zuweisung
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-none border shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold uppercase">Zugriff gewähren</DialogTitle>
                <DialogDescription className="text-xs">Mitarbeiter und entsprechende Berechtigung auswählen.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Mitarbeiter</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="h-10 rounded-none">
                      <SelectValue placeholder="Mitarbeiter wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">System & Rolle</Label>
                  <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                    <SelectTrigger className="h-10 rounded-none">
                      <SelectValue placeholder="Berechtigung wählen..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {entitlements?.map(e => {
                        const res = resources?.find(r => r.id === e.resourceId);
                        return (
                          <SelectItem key={e.id} value={e.id}>
                            {res?.name} — {e.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Ticket / Ref.</Label>
                    <Input value={ticketRef} onChange={e => setTicketRef(e.target.value)} placeholder="IT-123" className="h-10 rounded-none" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Gültig bis</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-10 rounded-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Notizen</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Interne Bemerkung..." className="h-10 rounded-none" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateAssignment} className="w-full h-11 rounded-none font-bold uppercase text-xs">Zuweisung speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Suche nach Benutzer, System oder Referenz..." 
            className="pl-10 h-10 shadow-none border-border rounded-none"
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
                const user = users?.find(u => u.id === assignment.userId);
                const ent = entitlements?.find(e => e.id === assignment.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                const isExpired = assignment.validUntil && new Date(assignment.validUntil) < new Date();
                const isFromGroup = !!assignment.originGroupId;

                return (
                  <TableRow key={assignment.id} className="group transition-colors hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                          {user?.displayName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {user?.displayName || assignment.userId}
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
                          {ent?.isInheritable && <Network className="w-3 h-3 text-muted-foreground" />}
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
              {!isLoading && filteredAssignments?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <History className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Keine Einträge gefunden.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Assignment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-none border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Zuweisung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="h-10 rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="requested">Pending</SelectItem>
                  <SelectItem value="removed">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Ticket / Ref.</Label>
                <Input value={ticketRef} onChange={e => setTicketRef(e.target.value)} className="h-10 rounded-none" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Gültig bis</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-10 rounded-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Notizen</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-10 rounded-none" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateAssignment} className="w-full h-11 rounded-none font-bold uppercase text-xs">Änderungen speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Assignment Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600 font-bold uppercase text-sm">
              <AlertTriangle className="w-5 h-5" /> Zuweisung löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Dieser Vorgang kann nicht rückgängig gemacht werden. Der Zugriff wird dauerhaft entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAssignment} className="bg-red-600 hover:bg-red-700 rounded-none font-bold uppercase text-xs">Unwiderruflich löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
