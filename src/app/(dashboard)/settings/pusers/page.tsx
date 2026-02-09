
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  Users, 
  ShieldCheck, 
  Mail, 
  Building2, 
  ChevronRight, 
  UserCircle,
  Plus,
  Pencil,
  Loader2,
  Save as SaveIcon,
  X,
  Lock,
  Shield
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { PlatformUser, Tenant, PlatformRole } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function PlatformUsersPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [tenantId, setTenantId] = useState('all');
  const [password, setPassword] = useState('');

  const { data: pUsers, refresh: refreshUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: roles } = usePluggableCollection<PlatformRole>('platformRoles');

  const handleSave = async () => {
    if (!displayName || !email || !roleId) {
      toast({ variant: "destructive", title: "Fehler", description: "Name, E-Mail und Rolle sind erforderlich." });
      return;
    }

    setIsSaving(true);
    const id = selectedUser?.id || `puser-${Math.random().toString(36).substring(2, 9)}`;
    const userData: Partial<PlatformUser> = {
      ...selectedUser,
      id,
      displayName,
      email,
      role: roleId,
      tenantId,
      enabled: selectedUser ? selectedUser.enabled : true,
      createdAt: selectedUser?.createdAt || new Date().toISOString(),
      authSource: selectedUser?.authSource || 'local'
    };

    if (password && userData.authSource === 'local') {
      (userData as any).password = password; 
    }

    try {
      const res = await saveCollectionRecord('platformUsers', id, userData, dataSource);
      if (res.success) {
        toast({ title: selectedUser ? "Administrator aktualisiert" : "Administrator angelegt" });
        setIsDialogOpen(false);
        refreshUsers();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(!confirm("Admin-Zugang permanent entfernen?")) return;
    try {
      const res = await deleteCollectionRecord('platformUsers', id, dataSource);
      if (res.success) {
        toast({ title: "Administrator entfernt" });
        refreshUsers();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    }
  };

  const openEdit = (user: PlatformUser) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setEmail(user.email);
    setRoleId(user.role);
    setTenantId(user.tenantId || 'all');
    setPassword('');
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedUser(null);
    setDisplayName('');
    setEmail('');
    setRoleId('');
    setTenantId('all');
    setPassword('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/10 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Plattform Administratoren</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Berechtigte Nutzer für die Governance-Konsole</p>
          </div>
        </div>
        <Button size="sm" className="h-9 rounded-md font-bold text-xs gap-2" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Admin hinzufügen
        </Button>
      </div>

      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-950/30">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Administrator</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Plattform-Rolle</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Zuständigkeit</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pUsers?.map(u => {
                const userRole = roles?.find(r => r.id === u.role);
                return (
                  <TableRow key={u.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 transition-colors">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-inner">
                          {u.displayName?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{u.displayName}</div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3" /> {u.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-indigo-500" />
                        <span className="text-xs font-bold text-slate-700">{userRole?.name || u.role}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        <Building2 className="w-3.5 h-3.5 text-slate-300" /> {u.tenantId === 'all' ? 'Globale Plattform' : tenants?.find(t => t.id === u.tenantId)?.name || u.tenantId}
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDelete(u.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {(!pUsers || pUsers.length === 0) && (
            <div className="py-20 text-center space-y-4">
              <UserCircle className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto" />
              <p className="text-[11px] font-bold text-slate-400">Keine Administratoren registriert</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedUser ? 'Administrator bearbeiten' : 'Neuer Administrator'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400">Anzeigename</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800" placeholder="Name..." />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400">E-Mail Adresse</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800" placeholder="admin@firma.de" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400">Plattform-Rolle</Label>
                  <Select value={roleId} onValueChange={setRoleId}>
                    <SelectTrigger className="rounded-md h-11 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Rolle wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400">Mandanten-Scope</Label>
                  <Select value={tenantId} onValueChange={setTenantId}>
                    <SelectTrigger className="rounded-md h-11 border-slate-200 dark:border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Global (Alle Mandanten)</SelectItem>
                      {tenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {(!selectedUser || selectedUser.authSource === 'local') && (
                <div className="space-y-2 pt-2">
                  <Label className="text-[11px] font-bold text-slate-400">Passwort {selectedUser && '(Nur zum Ändern füllen)'}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="rounded-md h-11 pl-9 border-slate-200 dark:border-slate-800" placeholder="••••••••" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
