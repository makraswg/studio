
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
  Filter, 
  Plus, 
  CheckCircle2, 
  Clock, 
  XCircle,
  User as UserIcon,
  Loader2,
  ShieldCheck,
  BrainCircuit
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, useUser as useAuthUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getAccessAdvice, type AccessAdvisorOutput } from '@/ai/flows/access-advisor-flow';

export default function AssignmentsPage() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'requested' | 'removed'>('all');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedEntitlementId, setSelectedEntitlementId] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [notes, setNotes] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AccessAdvisorOutput | null>(null);

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
      notes,
    });
    
    setIsCreateOpen(false);
    toast({ title: "Zuweisung erstellt" });
  };

  const runAiAdvisor = async (userId: string) => {
    const targetUser = users?.find(u => u.id === userId);
    if (!targetUser) return;

    setIsAnalyzing(userId);
    setAiAdvice(null);

    const userAssignments = assignments?.filter(a => a.userId === userId) || [];
    const assignmentDetails = userAssignments.map(a => {
      const ent = entitlements?.find(e => e.id === a.entitlementId);
      const res = resources?.find(r => r.id === ent?.resourceId);
      return {
        resourceName: res?.name || 'Unbekannt',
        entitlementName: ent?.name || 'Unbekannt',
        riskLevel: ent?.riskLevel || 'mittel'
      };
    });

    try {
      const advice = await getAccessAdvice({
        userDisplayName: targetUser.displayName,
        userEmail: targetUser.email,
        department: targetUser.department || 'N/A',
        assignments: assignmentDetails
      });
      setAiAdvice(advice);
    } catch (e) {
      toast({ variant: "destructive", title: "KI-Fehler" });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const filteredAssignments = assignments?.filter(assignment => {
    const user = users?.find(u => u.id === assignment.userId);
    const entitlement = entitlements?.find(e => e.id === assignment.entitlementId);
    const resource = resources?.find(r => r.id === entitlement?.resourceId);
    const searchLower = search.toLowerCase();
    const matchesSearch = user?.displayName.toLowerCase().includes(searchLower) || resource?.name.toLowerCase().includes(searchLower);
    const matchesTab = activeTab === 'all' || assignment.status === activeTab;
    return matchesSearch && matchesTab;
  });

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Zuweisungen</h1>
          <p className="text-muted-foreground mt-1">Benutzerrechte verwalten.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary px-6 h-11"><Plus className="w-5 h-5 mr-2" /> Neue Zuweisung</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Zugriff gewähren</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Benutzer</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Benutzer..." /></SelectTrigger>
                  <SelectContent>{users?.map(u => <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Berechtigung</Label>
                <Select value={selectedEntitlementId} onValueChange={setSelectedEntitlementId}>
                  <SelectTrigger><SelectValue placeholder="Berechtigung..." /></SelectTrigger>
                  <SelectContent>
                    {entitlements?.map(e => {
                      const res = resources?.find(r => r.id === e.resourceId);
                      return <SelectItem key={e.id} value={e.id}>{res?.name} - {e.name}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={handleCreateAssignment} className="w-full">Erstellen</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {aiAdvice && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">KI-Risikoberater</h3>
            <Badge className="ml-auto" variant={aiAdvice.riskScore > 70 ? 'destructive' : 'default'}>Score: {aiAdvice.riskScore}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{aiAdvice.summary}</p>
          <Button variant="ghost" size="sm" onClick={() => setAiAdvice(null)}>Verwerfen</Button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'active', 'requested', 'removed'].map(id => (
          <Button key={id} variant={activeTab === id ? 'default' : 'outline'} onClick={() => setActiveTab(id as any)} className="capitalize rounded-full">
            {id}
          </Button>
        ))}
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-accent/30">
              <TableRow>
                <TableHead>Benutzer</TableHead>
                <TableHead>Berechtigung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssignments?.map(assignment => {
                const user = users?.find(u => u.id === assignment.userId);
                const ent = entitlements?.find(e => e.id === assignment.entitlementId);
                const res = resources?.find(r => r.id === ent?.resourceId);
                return (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{user?.displayName}</TableCell>
                    <TableCell>{res?.name} - {ent?.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{assignment.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => runAiAdvisor(assignment.userId)} disabled={isAnalyzing === assignment.userId}>
                        {isAnalyzing === assignment.userId ? <Loader2 className="animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />} Risiko-KI
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
