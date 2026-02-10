
"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
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
  Shield,
  Fingerprint,
  KeyRound,
  ShieldAlert,
  QrCode
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { setupTotpAction, verifyAndEnableTotpAction, disableTotpAction } from '@/app/actions/otp-actions';
import { PlatformUser, Tenant, PlatformRole } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

export const dynamic = 'force-dynamic';

export default function PlatformUsersPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

  // 2FA Dialog State
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string, qrCode: string } | null>(null);
  const [totpVerificationCode, setTotpVerificationCode] = useState('');
  const [is2FALoading, setIs2FALoading] = useState(false);

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

  const handleOpen2FASetup = async (user: PlatformUser) => {
    setSelectedUser(user);
    setIs2FALoading(true);
    setIs2FADialogOpen(true);
    try {
      const res = await setupTotpAction(user.id, user.email, dataSource);
      if (res.success) {
        setTotpSetupData({ secret: res.secret!, qrCode: res.qrCode! });
      } else {
        toast({ variant: "destructive", title: "Setup-Fehler", description: res.error });
      }
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!selectedUser || !totpSetupData || !totpVerificationCode) return;
    setIs2FALoading(true);
    try {
      const res = await verifyAndEnableTotpAction(selectedUser.id, totpSetupData.secret, totpVerificationCode, dataSource);
      if (res.success) {
        toast({ title: "2FA aktiviert", description: "Die Zwei-Faktor-Authentifizierung ist nun aktiv." });
        setIs2FADialogOpen(false);
        refreshUsers();
      } else {
        toast({ variant: "destructive", title: "Verifizierung fehlgeschlagen", description: res.error });
      }
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleDisable2FA = async (userId: string) => {
    if(!confirm("Zwei-Faktor-Authentifizierung für diesen Benutzer wirklich deaktivieren?")) return;
    setIs2FALoading(true);
    try {
      const res = await disableTotpAction(userId, dataSource);
      if (res.success) {
        toast({ title: "2FA deaktiviert" });
        refreshUsers();
      }
    } finally {
      setIs2FALoading(false);
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
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">Plattform Administratoren</h1>
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
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Administrator</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest">Plattform-Rolle</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">2FA Status</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pUsers?.map(u => {
                const userRole = roles?.find(r => r.id === u.role);
                const is2FAEnabled = u.totpEnabled === true || u.totpEnabled === 1;
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
                        <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">{userRole?.name || u.role}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {is2FAEnabled ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full text-[8px] font-black px-2 h-5 uppercase">Aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200 text-slate-400 h-5 px-2">Inaktiv</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8 rounded-lg transition-all", is2FAEnabled ? "text-emerald-600 bg-emerald-50" : "text-slate-400")}
                          onClick={() => is2FAEnabled ? handleDisable2FA(u.id) : handleOpen2FASetup(u)}
                        >
                          <Fingerprint className="w-3.5 h-3.5" />
                        </Button>
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
        </CardContent>
      </Card>

      {/* Main Admin Dialog */}
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
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Anzeigename</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800" placeholder="Name..." />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">E-Mail Adresse</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800" placeholder="admin@firma.de" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Plattform-Rolle</Label>
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
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Mandanten-Scope</Label>
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

      {/* 2FA Setup Dialog */}
      <Dialog open={is2FADialogOpen} onOpenChange={setIs2FADialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0 pr-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white border border-white/10 shadow-lg">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">2FA Konfiguration</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold uppercase mt-0.5">{selectedUser?.displayName}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="p-8 space-y-8">
            {is2FALoading ? (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto opacity-20" />
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Generiere Sicherheitsschlüssel...</p>
              </div>
            ) : totpSetupData ? (
              <>
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    1. Scannen Sie diesen QR-Code mit einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator oder Authy).
                  </p>
                  <div className="p-4 bg-white border border-indigo-100 rounded-2xl shadow-inner flex justify-center">
                    <img src={totpSetupData.qrCode} alt="TOTP QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    2. Geben Sie den 6-stelligen Code aus der App zur Verifizierung ein.
                  </p>
                  <div className="space-y-2">
                    <Input 
                      value={totpVerificationCode} 
                      onChange={e => setTotpVerificationCode(e.target.value)} 
                      placeholder="000 000" 
                      className="h-12 rounded-xl text-center text-xl font-black tracking-[0.5em] border-indigo-200 bg-indigo-50/30"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400">Manueller Schlüssel (Secret)</Label>
                  <p className="text-[10px] font-mono font-bold text-slate-600 break-all select-all">{totpSetupData.secret}</p>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-red-600 flex flex-col items-center gap-2">
                <ShieldAlert className="w-10 h-10 opacity-20" />
                <p className="text-xs font-bold uppercase">Setup fehlgeschlagen</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t flex gap-2">
            <Button variant="ghost" onClick={() => setIs2FADialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase h-11 px-6">Abbrechen</Button>
            <Button onClick={handleVerify2FA} disabled={is2FALoading || totpVerificationCode.length < 6} className="rounded-xl h-11 px-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase shadow-lg gap-2 active:scale-95 transition-all">
              {is2FALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} 2FA Aktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
