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
  RotateCcw
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
import { saveCollectionRecord } from '@/app/actions/mysql-actions';

export default function GroupsPage() {
  const db = useFirestore();
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

  const { data: groups, isLoading, refresh: refreshGroups } = usePluggableCollection<AssignmentGroup>('groups');
  const { data: users } = usePluggableCollection<User>('users');
  const { data: entitlements } = usePluggableCollection<Entitlement>('entitlements');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zuweisungsgruppen</h1>
          <p className="text-sm text-muted-foreground">Regelbasierte Berechtigungen für Abteilungen oder Teams.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-9 font-bold uppercase text-[9px] gap-2" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? 'Aktive' : 'Archiv'}
          </Button>
          <Button size="sm" className="h-9 font-bold uppercase text-[10px]" onClick={() => { setSelectedGroup(null); setName(''); setDescription(''); setIsDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Gruppe erstellen
          </Button>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="py-4 font-bold uppercase text-[10px]">Gruppe</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Mandant</TableHead>
              <TableHead className="font-bold uppercase text-[10px]">Besetzung</TableHead>
              <TableHead className="text-right font-bold uppercase text-[10px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.map(group => (
              <TableRow key={group.id} className={cn("hover:bg-muted/5 border-b", group.status === 'archived' && "opacity-60")}>
                <TableCell className="font-bold text-sm">{group.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-[8px] font-bold uppercase">{getTenantSlug(group.tenantId)}</Badge></TableCell>
                <TableCell><span className="text-xs font-bold">{group.userConfigs?.length || 0} Nutzer</span></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-none">
                      <DropdownMenuItem onSelect={() => openEdit(group)}><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className={group.status === 'archived' ? "text-emerald-600" : "text-red-600"} 
                        onSelect={() => handleStatusChange(group, group.status === 'archived' ? 'active' : 'archived')}
                      >
                        {group.status === 'archived' ? <RotateCcw className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
                        {group.status === 'archived' ? 'Reaktivieren' : 'Archivieren'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] md:w-full rounded-2xl md:rounded-none h-[90vh] md:h-[80vh] flex flex-col p-0 overflow-hidden bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <DialogTitle className="text-sm font-bold uppercase">{selectedGroup ? 'Gruppe bearbeiten' : 'Neue Gruppe'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="rounded-none h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Beschreibung</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} className="rounded-none h-11" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">Die weitere Besetzung und Rollen-Zuweisung erfolgt in den Details nach Erstellung.</p>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveGroup} disabled={isSaving} className="rounded-none h-10 px-12 font-bold uppercase text-[10px] bg-slate-900 text-white">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
