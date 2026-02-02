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
  X
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
    const initialSearch = searchParams.get('search');
    if (initialSearch) setSearch(initialSearch);
  }, [searchParams]);

  const resetForm = () => {
    setSelectedAssignmentId(null);
    setSelectedUserId('');
    setSelectedEntitlementId('');
    setTicketRef('');
    setValidUntil('');
    setNotes('');
    setStatus('active');
  };

  const handleCreateAssignment = () => {
    if (!selectedUserId || !selectedEntitlementId) {
      toast({ variant: "destructive", title: "Erforderlich", description: "Benutzer und Berechtigung wählen." });
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
      toast({ title: "Zuweisung entfernt" });
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
    
    // UI Stabilization: Small delay to let dropdown close
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

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Zugriffszuweisungen</h1>
          <p className="text-muted-foreground mt-1 font-medium">Verwaltung von Berechtigungen und deren Laufzeiten.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 h-12 px-8 rounded-xl shadow-lg shadow-primary/30 font-bold">
              <Plus className="w-5 h-5 mr-2" /> Neue Zuweisung
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] border-none shadow-2xl glass-card">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold font-headline">Zugriff gewähren</DialogTitle>
              <DialogDescription>Wählen Sie einen Benutzer und die entsprechende Berechtigung aus.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Mitarbeiter</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="h-12 rounded-xl bg-accent/5 border-none font-medium">
                    <SelectValue placeholder="Mitarbeiter suchen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName} ({u.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">System & Rolle</Label>
                <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                  <SelectTrigger className="h-12 rounded-xl bg-accent/5 border-none font-medium">
                    <SelectValue placeholder="Berechtigung wählen..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
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
                  <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Referenz (Ticket)</Label>
                  <Input 
                    value={ticketRef} 
                    onChange={e => setTicketRef(e.target.value)} 
                    placeholder="z.B. IT-9982" 
                    className="h-12 rounded-xl bg-accent/5 border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Gültig bis (Optional)</Label>
                  <Input 
                    type="date"
                    value={validUntil} 
                    onChange={e => setValidUntil(e.target.value)} 
                    className="h-12 rounded-xl bg-accent/5 border-none"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateAssignment} className="w-full h-14 bg-primary rounded-xl font-bold text-lg shadow-lg">Zuweisung speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Suche nach Benutzer, System oder Referenz..." 
          className="pl-12 h-14 bg-card border-none shadow-sm rounded-2xl focus-visible:ring-primary focus-visible:ring-2 font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['all', 'active', 'requested', 'removed'].map(id => (
          <Button 
            key={id} 
            variant={activeTab === id ? 'default' : 'outline'} 
            onClick={() => setActiveTab(id as any)} 
            className={cn(
              "capitalize rounded-full px-6 font-bold transition-all",
              activeTab === id ? "bg-primary shadow-md" : "hover:bg-primary/5"
            )}
          >
            {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Angefagt' : 'Entfernt'}
          </Button>
        ))}
      </div>

      <div className="bg-card rounded-[2rem] border-none shadow-2xl overflow-hidden glass-card">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Lade Zuweisungen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-accent/5">
              <TableRow className="hover:bg-transparent border-b-muted">
                <TableHead className="py-6 font-bold uppercase tracking-wider text-[10px] pl-8">Mitarbeiter</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">Berechtigung</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">Gültigkeit</TableHead>
                <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status</TableHead>
                <TableHead className="text-right pr-8 font-bold uppercase tracking-wider text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map((assignment) => {
                const user = users?.find(u => u.id === assignment.userId);
                const ent = entitlements?.find(e => e.id === assignment.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                const isExpired = assignment.validUntil && new Date(assignment.validUntil) < new Date();

                return (
                  <TableRow key={assignment.id} className="group transition-all hover:bg-primary/5 border-b-muted/30">
                    <TableCell className="py-6 pl-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shadow-inner">
                          {user?.displayName?.charAt(0) || assignment.userId.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{user?.displayName || assignment.userId}</div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{assignment.ticketRef || 'KEIN TICKET'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{res?.name}</span>
                        <span className="text-xs text-muted-foreground">{ent?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assignment.validUntil ? (
                        <div className={cn(
                          "flex items-center gap-2 font-bold text-xs",
                          isExpired ? "text-red-500" : "text-muted-foreground"
                        )}>
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(assignment.validUntil).toLocaleDateString()}
                          {isExpired && <Badge variant="destructive" className="h-4 text-[8px] px-1 uppercase">Abgelaufen</Badge>}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">Unbefristet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-lg px-3 py-1 font-bold border-none shadow-sm uppercase tracking-tighter text-[10px]",
                        assignment.status === 'active' ? "bg-green-500 text-white" : 
                        assignment.status === 'requested' ? "bg-orange-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/10 hover:text-primary">
                            <MoreHorizontal className="w-6 h-6" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-none glass-card">
                          <DropdownMenuItem className="rounded-xl p-3 font-bold" onSelect={() => openEdit(assignment)}>
                            <Pencil className="w-4 h-4 mr-3 text-primary" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem className="rounded-xl p-3 font-bold text-destructive hover:bg-destructive/10" onSelect={() => openDelete(assignment)}>
                            <Trash2 className="w-4 h-4 mr-3" /> Zuweisung löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filteredAssignments?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <History className="w-12 h-12 opacity-20" />
                      <p className="font-medium">Keine Zuweisungen gefunden.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Assignment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl glass-card">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-headline">Zuweisung verwalten</DialogTitle>
            <DialogDescription>Aktualisieren Sie Status, Referenz oder Laufzeit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-accent/5">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">{users?.find(u => u.id === selectedUserId)?.displayName || selectedUserId}</p>
                <p className="text-xs text-muted-foreground">Berechtigung bleibt unverändert.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Status</Label>
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger className="h-12 rounded-xl bg-accent/5 border-none font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="requested">Angefragt / Pending</SelectItem>
                  <SelectItem value="removed">Entfernt / Deaktiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Referenz (Ticket)</Label>
                <Input 
                  value={ticketRef} 
                  onChange={e => setTicketRef(e.target.value)} 
                  className="h-12 rounded-xl bg-accent/5 border-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Gültig bis</Label>
                <Input 
                  type="date"
                  value={validUntil} 
                  onChange={e => setValidUntil(e.target.value)} 
                  className="h-12 rounded-xl bg-accent/5 border-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Interne Notizen</Label>
              <Input 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Grund der Änderung..." 
                className="h-12 rounded-xl bg-accent/5 border-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateAssignment} className="w-full h-14 bg-primary rounded-xl font-bold text-lg shadow-lg">Änderungen speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Assignment Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-destructive text-2xl font-bold font-headline">
              <AlertTriangle className="w-8 h-8" /> Zuweisung löschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium leading-relaxed pt-4">
              Möchten Sie diesen Zugriff wirklich dauerhaft entfernen? Dieser Vorgang kann nicht rückgängig gemacht werden und wird im Audit-Log protokolliert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="rounded-xl h-12 font-bold border-2" onClick={() => setSelectedAssignmentId(null)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAssignment} className="rounded-xl h-12 bg-destructive hover:bg-destructive/90 font-bold px-8">Zuweisung endgültig löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
