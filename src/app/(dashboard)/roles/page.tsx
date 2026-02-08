"use client";

import { useState, useMemo, useEffect } from 'react';
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
  Shield, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Pencil, 
  Layers,
  ShieldAlert,
  Info,
  Building2,
  Save,
  ChevronRight,
  X,
  AlertTriangle
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { logAuditEventAction } from '@/app/actions/audit-actions';
import { toast } from '@/hooks/use-toast';
import { Entitlement, Resource, Tenant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AiFormAssistant } from '@/components/ai/form-assistant';
import { usePlatformAuth } from '@/context/auth-context';

export default function RolesManagementPage() {
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Entitlement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [isAdmin, setIsAdmin] = useState(false);
  const [externalMapping, setExternalMapping] = useState('');

  const { data: roles, isLoading, refresh } = usePluggableCollection<Entitlement>('entitlements');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSuperAdmin = user?.role === 'superAdmin';

  const handleSave = async () => {
    if (!name || !resourceId) {
      toast({ variant: "destructive", title: "Fehler", description: "Name und System sind erforderlich." });
      return;
    }

    setIsSaving(true);
    const id = selectedRole?.id || `ent-${Math.random().toString(36).substring(2, 9)}`;
    const resource = resources?.find(r => r.id === resourceId);
    
    const roleData: Entitlement = {
      ...selectedRole,
      id,
      name,
      description,
      resourceId,
      riskLevel,
      isAdmin,
      externalMapping,
      tenantId: resource?.tenantId || activeTenantId || 'global'
    };

    try {
      const res = await saveCollectionRecord('entitlements', id, roleData, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: roleData.tenantId || 'global',
          actorUid: user?.email || 'system',
          action: selectedRole ? `Rolle aktualisiert: ${name}` : `Rolle definiert: ${name}`,
          entityType: 'entitlement',
          entityId: id,
          after: roleData
        });

        toast({ title: selectedRole ? "Rolle aktualisiert" : "Rolle erstellt" });
        setIsDialogOpen(false);
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteCollectionRecord('entitlements', deleteTarget.id, dataSource);
      if (res.success) {
        await logAuditEventAction(dataSource, {
          tenantId: 'global',
          actorUid: user?.email || 'system',
          action: `Rolle permanent gelöscht: ${deleteTarget.label}`,
          entityType: 'entitlement',
          entityId: deleteTarget.id
        });

        toast({ title: "Rolle permanent gelöscht" });
        refresh();
        setDeleteTarget(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = (role: Entitlement) => {
    setSelectedRole(role);
    setName(role.name);
    setDescription(role.description || '');
    setResourceId(role.resourceId);
    setRiskLevel(role.riskLevel as any || 'low');
    setIsAdmin(!!role.isAdmin);
    setExternalMapping(role.externalMapping || '');
    setIsDialogOpen(true);
  };

  const applyAiSuggestions = (s: any) => {
    if (s.name) setName(s.name);
    if (s.description) setDescription(s.description);
    if (s.riskLevel) setRiskLevel(s.riskLevel as any);
    toast({ title: "KI-Vorschläge übernommen" });
  };

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter(r => {
      const resource = resources?.find(res => res.id === r.resourceId);
      if (activeTenantId !== 'all' && resource?.tenantId !== activeTenantId) return false;
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || 
                          resource?.name.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [roles, resources, search, activeTenantId]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex items-center justify-center rounded-lg border shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-primary/10 text-primary text-[9px] font-bold border-none">AccessHub</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white">Rollenverwaltung</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zentrale Definition von Berechtigungen und Zugriffsrechten pro System.</p>
          </div>
        </div>
        <Button size="sm" className="h-9 rounded-md font-bold text-[10px] px-6" onClick={() => { setSelectedRole(null); setName(''); setDescription(''); setResourceId(''); setRiskLevel('low'); setIsAdmin(false); setExternalMapping(''); setIsDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5 mr-2" /> Neue Rolle definieren
        </Button>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Nach Rolle oder System suchen..." 
          className="pl-9 h-10 rounded-md border-slate-200 bg-white"
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
                <TableHead className="py-4 px-6 font-bold text-[9px] text-slate-400">Rolle / Berechtigung</TableHead>
                <TableHead className="font-bold text-[9px] text-slate-400">System (Ressource)</TableHead>
                <TableHead className="font-bold text-[9px] text-slate-400 text-center">Risiko</TableHead>
                <TableHead className="font-bold text-[9px] text-slate-400">Typ</TableHead>
                <TableHead className="text-right px-6 font-bold text-[9px] text-slate-400">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((role) => {
                const resource = resources?.find(res => res.id === role.resourceId);
                return (
                  <TableRow key={role.id} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-md flex items-center justify-center border",
                          role.isAdmin ? "bg-red-50 text-red-600 border-red-100" : "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                          {role.isAdmin ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-800">{role.name}</div>
                          <div className="text-[9px] text-slate-400 font-medium truncate max-w-[200px]">{role.description || 'Keine Beschreibung'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">{resource?.name || 'Unbekannt'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn(
                        "rounded-full text-[8px] font-black px-2 h-5 border-none",
                        role.riskLevel === 'high' ? "bg-red-50 text-red-600" : 
                        role.riskLevel === 'medium' ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {role.riskLevel?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {role.isAdmin ? (
                        <Badge className="bg-red-600 text-white rounded-full text-[7px] font-black h-4 px-1.5">Admin</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[7px] font-bold text-slate-400 h-4 px-1.5">Standard</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" onClick={() => openEdit(role)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 shadow-xl border">
                            <DropdownMenuItem onSelect={() => openEdit(role)} className="rounded-md py-2 gap-2 text-xs font-bold"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Bearbeiten</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1" />
                            <DropdownMenuItem className="text-red-600 font-bold" onSelect={() => { 
                              if (isSuperAdmin) {
                                setDeleteTarget({ id: role.id, label: role.name });
                              } else if(confirm("Rolle permanent löschen?")) {
                                deleteCollectionRecord('entitlements', role.id, dataSource).then(() => refresh());
                              } 
                            }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Permanent löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col border shadow-2xl bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 bg-slate-50 dark:bg-slate-900 border-b shrink-0 pr-8">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedRole ? 'Rolle bearbeiten' : 'Neue Rolle definieren'}
                  </DialogTitle>
                  <DialogDescription className="text-[10px] text-slate-400 font-bold mt-0.5">Berechtigungsumfang & System-Mapping</DialogDescription>
                </div>
              </div>
              <AiFormAssistant 
                formType="gdpr" 
                currentData={{ name, description, riskLevel, isAdmin }} 
                onApply={applyAiSuggestions} 
              />
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <Label required className="text-[11px] font-bold text-slate-400 ml-1">Bezeichnung der Rolle</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800 font-bold text-sm" placeholder="z.B. IT-Admin, Buchhalter..." />
              </div>
              
              <div className="space-y-2">
                <Label required className="text-[11px] font-bold text-slate-400 ml-1">Zugehöriges System (Ressource)</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger className="rounded-md h-11 border-slate-200 dark:border-slate-800 text-xs">
                    <SelectValue placeholder="System wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {resources?.map(res => (
                      <SelectItem key={res.id} value={res.id} className="text-xs">{res.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 ml-1">Risiko-Level</Label>
                  <Select value={riskLevel} onValueChange={(v: any) => setRiskLevel(v)}>
                    <SelectTrigger className="rounded-md h-11 border-slate-200 dark:border-slate-800 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="text-xs">Niedrig (Low)</SelectItem>
                      <SelectItem value="medium" className="text-xs">Mittel (Medium)</SelectItem>
                      <SelectItem value="high" className="text-xs">Hoch (High)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-3 border rounded-md bg-slate-50 dark:bg-slate-900 h-11">
                    <Label className="text-[10px] font-bold text-slate-500">Admin-Recht</Label>
                    <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Beschreibung / Berechtigungsumfang</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[100px] rounded-lg border-slate-200 dark:border-slate-800 text-xs leading-relaxed" placeholder="Was darf dieser Nutzer im System?" />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold text-slate-400 ml-1">Technisches Mapping (External ID)</Label>
                <Input value={externalMapping} onChange={e => setExternalMapping(e.target.value)} className="rounded-md h-11 border-slate-200 dark:border-slate-800 font-mono text-xs" placeholder="role_admin_prod" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-md h-10 px-6 font-bold text-[11px]">Abbrechen</Button>
            <Button onClick={handleSave} disabled={isSaving || !name} className="rounded-md h-10 px-8 bg-primary text-white font-bold text-[11px] gap-2 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Rolle speichern
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
            <AlertDialogTitle className="text-xl font-headline font-bold text-red-600 text-center">Rolle permanent löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 font-medium leading-relaxed pt-2 text-center">
              Möchten Sie die Rolle <strong>{deleteTarget?.label}</strong> wirklich permanent löschen? 
              <br/><br/>
              <span className="text-red-600 font-bold">Achtung:</span> Diese Aktion kann nicht rückgängig gemacht werden. Alle bestehenden Zuweisungen dieser Rolle werden ungültig.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-6 gap-3 sm:justify-center">
            <AlertDialogCancel className="rounded-md font-bold text-xs h-11 px-8">Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-md font-bold text-xs h-11 px-10 gap-2"
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
