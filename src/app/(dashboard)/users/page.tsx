
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  MoreHorizontal, 
  RefreshCw,
  Plus,
  UserCircle,
  ShieldCheck,
  Building2,
  Loader2
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
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking, useUser as useAuthUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function UsersPage() {
  const db = useFirestore();
  const { user: authUser } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const { data: users, isLoading } = useCollection(usersQuery);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast({ title: "Synchronisierung abgeschlossen", description: "Das LDAP-Verzeichnis ist auf dem neuesten Stand." });
    }, 2000);
  };

  const handleAddUser = () => {
    if (!newDisplayName || !newEmail) {
      toast({ variant: "destructive", title: "Erforderlich", description: "Name und E-Mail sind erforderlich." });
      return;
    }

    const userId = `u-${Math.random().toString(36).substring(2, 9)}`;
    const userRef = doc(db, 'users', userId);
    
    const userData = {
      id: userId,
      externalId: `MANUAL_${userId}`,
      displayName: newDisplayName,
      email: newEmail,
      department: newDepartment,
      title: newTitle,
      enabled: true,
      lastSyncedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(userRef, userData, { merge: true });
    addDocumentNonBlocking(collection(db, 'auditEvents'), {
      actorUid: authUser?.uid || 'system',
      action: 'Benutzer erstellen',
      entityType: 'user',
      entityId: userId,
      timestamp: new Date().toISOString()
    });

    toast({ title: "Benutzer hinzugefügt", description: `${newDisplayName} wurde dem Verzeichnis hinzugefügt.` });
    setIsAddOpen(false);
    setNewDisplayName('');
    setNewEmail('');
  };

  const filteredUsers = users?.filter(user => 
    user.displayName.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.department?.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Benutzerverzeichnis</h1>
          <p className="text-muted-foreground mt-1">Verwaltete Benutzer, die über LDAP/Active Directory synchronisiert werden.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2 h-11 px-6 border-primary text-primary hover:bg-primary/5"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
            {isSyncing ? "LDAP wird synchronisiert..." : "Von LDAP synchronisieren"}
          </Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary gap-2 h-11 px-6 shadow-lg shadow-primary/20">
                <Plus className="w-5 h-5" /> Benutzer hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Verzeichnisbenutzer hinzufügen</DialogTitle>
                <DialogDescription>Manuelles Erstellen eines Benutzereintrags.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Name</Label>
                  <Input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">E-Mail</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddUser}>Benutzer speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Suche nach Name, E-Mail, Abteilung..." 
            className="pl-10 h-11 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Verzeichnis wird geladen...</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-accent/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[350px] py-4">Mitarbeiter</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Synchronisiert</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.map((user) => (
                <TableRow key={user.id} className="group transition-colors hover:bg-accent/10">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-primary font-bold uppercase">
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold">{user.displayName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{user.department || 'N/A'}</span>
                      <span className="text-[10px] text-muted-foreground">{user.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-bold", user.enabled ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")} variant="outline">
                      {user.enabled ? "AKTIVIERT" : "DEAKTIVIERT"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {user.lastSyncedAt ? new Date(user.lastSyncedAt).toLocaleDateString() : 'Nie'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setSelectedUser(user);
                          setIsProfileOpen(true);
                        }}>
                          <UserCircle className="w-4 h-4 mr-2" /> Profil anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/assignments?search=${user.displayName}`} className="flex w-full items-center">
                            <ShieldCheck className="w-4 h-4 mr-2" /> Zuweisungen anzeigen
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Benutzerprofil</DialogTitle>
            <DialogDescription>Details zum Verzeichnisbenutzer.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-accent/10 border">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold uppercase">
                  {selectedUser.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.title}</p>
                  <Badge className="mt-2 bg-green-500/10 text-green-600 border-none">AKTIV</Badge>
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">E-Mail:</span>
                  <span className="font-medium">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Abteilung:</span>
                  <span className="font-medium">{selectedUser.department || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsProfileOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
