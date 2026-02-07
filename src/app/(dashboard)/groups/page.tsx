"use client";

import { useState, useEffect, useMemo } from 'react';
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
  Plus, 
  Search, 
  Workflow, 
  Users, 
  Shield, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil,
  Check,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Layers,
  X,
  ArrowRight,
  ShieldCheck,
  Save as SaveIcon,
  Archive,
  RotateCcw,
  MoreVertical,
  Info
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
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { 
  useFirestore, 
  setDocumentNonBlocking,
  useUser as useAuthUser
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AssignmentGroup, User, Entitlement, Resource, Tenant, GroupMemberConfig } from '@/lib/types';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { usePlatformAuth } from '@/context/auth-context';
import { logAuditEventAction } from '@/app/actions/audit-actions';

export default function GroupsPage() {
  const db = useFirestore();
  const { user } = usePlatformAuth();
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [userConfigs, setUserConfigs] = useState<GroupMemberConfig[]>([]);
  const [entitlementConfigs, setEntitlementConfigs] = useState<GroupMemberConfig[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: groups, isLoading, refresh: refreshGroups } = usePluggableCollection<AssignmentGroup>('groups');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';

  const getTenantSlug = (id?: string | null) => {
    const tenant = tenants?.find(t => t.id === id);
    return tenant ? tenant.slug : 'Global';
  };

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    return groups.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
      const matchTenant = activeTenantId === 'all' || g.tenantId === activeTenantId;
      const matchStatus = showArchived ? g.status === 'archived' : g.status !== 'archived';
      return matchSearch && matchTenant && matchStatus;
    });
  }, [groups, search, activeTenantId, showArchived]);

  const handleSaveGroup = async () => {
    if (!name) return;
    setIsSaving(true);
    const id = selectedGroup?.id || `grp_${Math.random().toString(36).substring(2, 9)}`;
    const groupData: AssignmentGroup = {
      ...selectedGroup,
      id,
      tenantId: activeTenantId === 'all' ? 't1' : activeTenantId,
      name,
      description,
      status: selectedGroup?.status || 'active',
      userConfigs,
      entitlementConfigs
    };

    try {
      const res = await saveCollectionRecord('groups', id, groupData, dataSource);
      if (res.success) {
        toast({ title: "Gruppe gespeichert" });
        setIsDialogOpen(false);
        refreshGroups();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (group: AssignmentGroup, newStatus: 'active' | 'archived') => {
    const updated = { ...group, status: newStatus };
    const res = await saveCollectionRecord('groups', group.id, updated, dataSource);
    if (res.success) {
      toast({ title: newStatus === 'archived' ? "Gruppe archiviert" : "Gruppe reaktiviert" });
      refreshGroups();
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteCollectionRecord('groups', deleteTarget.id, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: 'global',
          actorUid: user?.email || 'system',
          action: `Zuweisungsgruppe permanent gelöscht: ${deleteTarget.label}`,
          entityType: 'group',
          entityId: deleteTarget.id
        });

        toast({ title: "Gruppe permanent gelöscht" });
        refreshGroups();
        setDeleteTarget(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (group: AssignmentGroup) => {
    setSelectedGroup(group);
    setName(group.name);
    setDescription(group.description || '');
    setUserConfigs(group.userConfigs || []);
    setEntitlementConfigs(group.entitlementConfigs || []);
    setIsDialogOpen(true);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">Lifecycle Management</Badge>
          <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Zuweisungsgruppen</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Regelbasierte Berechtigungen für Abteilungen oder Projekt-Teams.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-9 font-bold text-xs gap-2" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? 'Aktive anzeigen' : 'Archiv'}
          </Button>
          <Button size="sm" className="h-9 font-bold text-xs px-6 shadow-sm" onClick={() => { setSelectedGroup(null); setName(''); setDescription(''); setIsDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Gruppe erstellen
          </Button>
        </div>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Nach Gruppen suchen..." 
          className="pl-9 h-10 rounded-md border-slate-200 bg-white shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" /></div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="py-4 px-6 font-bold text-[11px] text-slate-400">Gruppe</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Mandant</TableHead>
                <TableHead className="font-bold text-[11px] text-slate-400">Besetzung</TableHead>
                <TableHead className="text-right px-6 font-bold text-[11px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map(group => (
                <TableRow key={group.id} className={cn("group hover:bg-slate-50 transition-colors border-b last:border-0", group.status === 'archived' && "opacity-60")}>
                  <TableCell className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
                        <Workflow className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800">{group.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{group.description || 'Keine Beschreibung'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-full text-[8px] font-bold border-slate-200 text-slate-500 px-2 h-5">
                      {getTenantSlug(group.tenantId)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">{group.userConfigs?.length || 0} Nutzer</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => openEdit(group)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100 transition-all"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                          <DropdownMenuItem onSelect={() => openEdit(group)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem 
                            className={cn("rounded-md py-2 gap-2 text-xs font-bold", group.status === 'archived' ? "text-emerald-600" : "text-red-600")} 
                            onSelect={() => handleStatusChange(group, group.status === 'archived' ? 'active' : 'archived')}
                          >
                            {group.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                            {group.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                          </DropdownMenuItem>
                          {isSuperAdmin && (
                            <DropdownMenuItem className="text-red-600 font-bold" onSelect={() => setDeleteTarget({ id: group.id, label: group.name })}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Permanent löschen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Group Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[80vh] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shadow-sm border border-primary/10">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">{selectedGroup ? 'Zuweisungsgruppe bearbeiten' : 'Neue Gruppe erstellen'}</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5">Automatisierte Rollen-Zuweisung nach Regeln</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Name der Gruppe</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="rounded-md h-11 border-slate-200 font-bold" placeholder="z.B. Marketing-Team, IT-Support..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Beschreibung / Zweck</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} className="rounded-md h-11 border-slate-200" placeholder="Zuständigkeitsbereich..." />
                </div>
              </div>
              
              <div className="p-6 rounded-xl bg-blue-50/50 border border-blue-100 flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Info className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">Hinweis zur Konfiguration</p>
                  <p className="text-[10px] text-slate-500 italic leading-relaxed">
                    Nachdem Sie die Gruppe gespeichert haben, können Sie in der Detailansicht die spezifischen Filterregeln (Abteilungen, Standorte) definieren, um Benutzer und Rollen automatisch zu verknüpfen.
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleSaveGroup} disabled={isSaving || !name} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-xl border-none shadow-2xl p-8">
          <AlertDialogHeader>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center">Gruppe permanent löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Möchten Sie die Zuweisungsgruppe <strong>{deleteTarget?.label}</strong> wirklich permanent löschen? 
              <br/><br/>
              <span className="text-red-600 font-bold">Achtung:</span> Diese Aktion kann nicht rückgängig gemacht werden. Alle regelbasierten Zuweisungen dieser Gruppe werden entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-md font-bold text-xs h-11 px-8">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-xs h-11 px-10 gap-2 shadow-lg"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Permanent löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
