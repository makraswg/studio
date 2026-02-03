
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
  Link as LinkIcon,
  Zap
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  setDocumentNonBlocking,
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
  
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'requested' | 'removed' | 'pending_removal'>('active');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isJiraLoading, setIsJiraLoading] = useState<string | null>(null);
  
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [jiraIssueKey, setJiraIssueKey] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Assignment['status']>('active');

  const { data: assignments, isLoading, refresh: refreshAssignments } = usePluggableCollection<Assignment>('assignments');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateAssignment = async () => {
    if (!selectedUserId || !selectedEntitlementId) return;
    const assignmentId = `ass-${Math.random().toString(36).substring(2, 9)}`;
    const assignmentData = {
      id: assignmentId,
      userId: selectedUserId,
      entitlementId: selectedEntitlementId,
      status: 'active',
      grantedBy: authUser?.uid || 'system',
      grantedAt: new Date().toISOString(),
      validFrom,
      validUntil,
      jiraIssueKey,
      ticketRef: jiraIssueKey || 'MANUELL',
      notes,
      tenantId: 't1'
    };

    if (dataSource === 'mysql') {
      await saveCollectionRecord('assignments', assignmentId, assignmentData);
    } else {
      setDocumentNonBlocking(doc(db, 'assignments', assignmentId), assignmentData);
    }
    
    setIsCreateOpen(false);
    toast({ title: "Zuweisung erstellt" });
    setTimeout(() => refreshAssignments(), 200);
  };

  const filteredAssignments = assignments?.filter(a => {
    const user = users?.find(u => u.id === a.userId);
    const match = (user?.displayName || '').toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'all' || a.status === activeTab;
    return match && matchTab;
  });

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einzelzuweisungen</h1>
          <p className="text-sm text-muted-foreground">Aktive und ausstehende Berechtigungen im Überblick.</p>
        </div>
        <Button size="sm" className="h-9 font-bold uppercase text-[10px] rounded-none" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Zuweisung erstellen
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Mitarbeiter oder Jira-Key suchen..." 
            className="pl-10 h-10 rounded-none bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex border rounded-none p-1 bg-muted/20">
          {['all', 'active', 'requested', 'pending_removal', 'removed'].map(id => (
            <Button key={id} variant={activeTab === id ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab(id as any)} className="h-8 text-[9px] font-bold uppercase px-4 rounded-none">
              {id === 'all' ? 'Alle' : id === 'active' ? 'Aktiv' : id === 'requested' ? 'Pending Joiner' : id === 'pending_removal' ? 'Pending Leaver' : 'Inaktiv'}
            </Button>
          ))}
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Mitarbeiter</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">System / Rolle</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Ticket</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments?.map((a) => {
              const user = users?.find(u => u.id === a.userId);
              const ent = entitlements?.find(e => e.id === a.entitlementId);
              const res = resources?.find(r => r.id === ent?.resourceId);

              return (
                <TableRow key={a.id} className="hover:bg-muted/5 border-b">
                  <TableCell className="py-4 font-bold text-sm">{user?.displayName || a.userId}</TableCell>
                  <TableCell>
                    <div className="font-bold text-sm">{res?.name}</div>
                    <div className="text-xs text-muted-foreground">{ent?.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "rounded-none font-bold uppercase text-[9px] border-none px-2",
                      a.status === 'active' ? "bg-emerald-50 text-emerald-700" :
                      a.status === 'requested' ? "bg-amber-50 text-amber-700" :
                      a.status === 'pending_removal' ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700"
                    )}>
                      {a.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{a.jiraIssueKey || '—'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none w-48">
                        <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>Bearbeiten</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="text-sm font-bold uppercase">Zuweisung erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Benutzer</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-none">{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Rolle</Label>
              <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent className="rounded-none">{entitlements?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none">Abbrechen</Button>
            <Button onClick={handleCreateAssignment} className="rounded-none font-bold uppercase text-[10px]">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
