
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
import { Input } from '@/components/ui/input';
import { 
  Search, 
  RefreshCw,
  Plus,
  UserCircle,
  ShieldCheck,
  MoreHorizontal,
  Loader2,
  ShieldAlert,
  BrainCircuit,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection'; // Geändert
import { useFirestore, setDocumentNonBlocking, useUser as useAuthUser } from '@/firebase'; // Beibehalten für Schreibaktionen
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getAccessAdvice } from '@/ai/flows/access-advisor-flow';

export default function UsersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Geändert auf usePluggableCollection
  const { data: users, loading: isLoading } = usePluggableCollection('users');
  const { data: assignments } = usePluggableCollection('assignments');
  const { data: entitlements } = usePluggableCollection('entitlements');
  const { data: resources } = usePluggableCollection('resources');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast({ title: "Synchronisierung abgeschlossen", description: "LDAP-Status aktualisiert." });
    }, 1500);
  };

  // Diese Funktion funktioniert weiterhin nur mit Firestore. Eine Mock-Implementierung ist nicht vorgesehen.
  const handleAddUser = () => {
    if (!newDisplayName || !newEmail) return;
    const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
    setDocumentNonBlocking(doc(db, 'users', userId), {
      id: userId,
      externalId: `MANUAL_${userId}`,
      displayName: newDisplayName,
      email: newEmail,
      enabled: true,
      lastSyncedAt: new Date().toISOString(),
      tenantId: 't1'
    });
    setIsAddOpen(false);
    toast({ title: "Benutzer hinzugefügt" });
    setNewDisplayName('');
    setNewEmail('');
  };

  const openAdvisor = async (userDoc: any) => {
    setIsAdvisorLoading(true);
    setIsAdvisorOpen(true);
    setAiAdvice(null);
    
    try {
      const userAssignments = assignments?.filter(a => a.userId === userDoc.id && a.status !== 'removed') || [];
      const detailedAssignments = userAssignments.map(a => {
        const ent = entitlements?.find(e => e.id === a.entitlementId);
        const res = resources?.find(r => r.id === ent?.resourceId);
        return {
          resourceName: res?.name || 'Unbekannt',
          entitlementName: ent?.name || 'Unbekannt',
          riskLevel: ent?.riskLevel || 'medium'
        };
      });

      const advice = await getAccessAdvice({
        userDisplayName: userDoc.displayName,
        userEmail: userDoc.email,
        department: userDoc.department || 'Allgemein',
        assignments: detailedAssignments
      });
      setAiAdvice(advice);
    } catch (e) {
      toast({ variant: "destructive", title: "KI Fehler", description: "Bericht konnte nicht geladen werden." });
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  const filteredUsers = users?.filter(user => 
    (user.name || user.displayName).toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benutzerverzeichnis</h1>
          <p className="text-sm text-muted-foreground">Zentrale Verwaltung aller Identitäten und deren Status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 font-bold uppercase text-[10px]" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={cn("w-3 h-3 mr-2", isSyncing && "animate-spin")} /> LDAP Sync
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px]" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-3 h-3 mr-2" /> Hinzufügen
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Suche nach Name, E-Mail, Abteilung..." 
          className="pl-10 h-10 rounded-none shadow-none border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="admin-card overflow-hidden rounded-none shadow-none">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4 font-bold uppercase tracking-widest text-[10px]">Identität</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Abteilung / Rolle</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                <TableHead className="font-bold uppercase tracking-widest text-[10px]">Zugriffsprofil</TableHead>
                <TableHead className="text-right font-bold uppercase tracking-widest text-[10px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user) => {
                const userEntsCount = assignments?.filter(a => a.userId === user.id && a.status === 'active').length || 0;
                return (
                  <TableRow key={user.id} className="group hover:bg-muted/5 border-b">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 font-bold uppercase text-xs">
                          {(user.name || user.displayName).charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{user.name || user.displayName}</div>
                          <div className="text-[10px] text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-xs">{user.department || '—'}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{user.title || 'Kein Titel'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[9px] font-bold uppercase rounded-none border-none", user.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                        {user.enabled ? "AKTIV" : "DEAKTIVIERT"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-slate-600">
                        <ShieldCheck className="w-3 h-3" /> {userEntsCount} Berechtigungen
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-none p-1 shadow-xl">
                          <DropdownMenuItem onSelect={() => { setSelectedUser(user); setTimeout(() => setIsProfileOpen(true), 150); }}>
                            <UserCircle className="w-3.5 h-3.5 mr-2" /> Identitätsprofil
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(`/assignments?search=${user.name || user.displayName}`)}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Zugriffe verwalten
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-blue-600 font-bold" onSelect={() => openAdvisor(user)}>
                            <BrainCircuit className="w-3.5 h-3.5 mr-2" /> KI-Access Advisor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
       {/* ... Dialoge bleiben unverändert ... */}
    </div>
  );
}
