
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Building2, 
  Plus, 
  PlusCircle,
  Trash2, 
  Save, 
  Loader2, 
  Archive, 
  RotateCcw,
  Search,
  Mail,
  UserCircle,
  Info,
  Pencil,
  Briefcase,
  ChevronRight,
  MapPin,
  ExternalLink,
  Users
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ServicePartner, ServicePartnerContact, ServicePartnerArea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';

export default function ServicePartnerSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  // Dialog States
  const [isPartnerDialogOpen, setIsPartnerDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  
  const [selectedPartner, setSelectedPartner] = useState<ServicePartner | null>(null);
  const [selectedContact, setSelectedContact] = useState<ServicePartnerContact | null>(null);
  const [selectedArea, setSelectedArea] = useState<ServicePartnerArea | null>(null);

  // Form States
  const [isSaving, setIsSaving] = useState(false);
  const [pName, setPName] = useState('');
  const [pIndustry, setPIndustry] = useState('');
  const [pWebsite, setPWebsite] = useState('');

  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cRole, setCRole] = useState('');

  const [aName, setAName] = useState('');
  const [aDesc, setADesc] = useState('');

  const { data: partners, refresh: refreshPartners, isLoading: pLoading } = usePluggableCollection<ServicePartner>('servicePartners');
  const { data: contacts, refresh: refreshContacts } = usePluggableCollection<ServicePartnerContact>('servicePartnerContacts');
  const { data: areas, refresh: refreshAreas } = usePluggableCollection<ServicePartnerArea>('servicePartnerAreas');

  useEffect(() => { setMounted(true); }, []);

  const handleSavePartner = async () => {
    if (!pName) return;
    setIsSaving(true);
    const id = selectedPartner?.id || `sp-${Math.random().toString(36).substring(2, 7)}`;
    const data: ServicePartner = {
      id,
      tenantId: activeTenantId === 'all' ? 'global' : activeTenantId,
      name: pName,
      industry: pIndustry,
      website: pWebsite,
      status: selectedPartner?.status || 'active',
      createdAt: selectedPartner?.createdAt || new Date().toISOString()
    };
    const res = await saveCollectionRecord('servicePartners', id, data, dataSource);
    if (res.success) {
      toast({ title: "Partner gespeichert" });
      setIsPartnerDialogOpen(false);
      refreshPartners();
    }
    setIsSaving(false);
  };

  const handleSaveContact = async () => {
    if (!cName || !selectedPartner) return;
    setIsSaving(true);
    const id = selectedContact?.id || `spc-${Math.random().toString(36).substring(2, 7)}`;
    const data: ServicePartnerContact = {
      id,
      partnerId: selectedPartner.id,
      name: cName,
      email: cEmail,
      phone: cPhone,
      role: cRole
    };
    const res = await saveCollectionRecord('servicePartnerContacts', id, data, dataSource);
    if (res.success) {
      toast({ title: "Ansprechpartner gespeichert" });
      setIsContactDialogOpen(false);
      refreshContacts();
    }
    setIsSaving(false);
  };

  const handleSaveArea = async () => {
    if (!aName || !selectedPartner) return;
    setIsSaving(true);
    const id = selectedArea?.id || `spa-${Math.random().toString(36).substring(2, 7)}`;
    const data: ServicePartnerArea = {
      id,
      partnerId: selectedPartner.id,
      name: aName,
      description: aDesc
    };
    const res = await saveCollectionRecord('servicePartnerAreas', id, data, dataSource);
    if (res.success) {
      toast({ title: "Fachbereich gespeichert" });
      setIsAreaDialogOpen(false);
      refreshAreas();
    }
    setIsSaving(false);
  };

  const filteredPartners = useMemo(() => {
    if (!partners) return [];
    return partners.filter(p => {
      const matchesStatus = showArchived ? p.status === 'archived' : p.status !== 'archived';
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [partners, search, showArchived]);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 flex items-center justify-center rounded-xl border border-indigo-100 shadow-sm">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-indigo-100 text-indigo-700 text-[9px] font-bold border-none uppercase tracking-wider">Vendor Risk Management</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase tracking-tight">Service Partner & Externe</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Verwaltung externer Dienstleister, Fachbereiche und Ansprechpartner.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-9 font-bold text-xs gap-2" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {showArchived ? 'Aktive Partner' : 'Archiv'}
          </Button>
          <Button size="sm" className="h-9 rounded-md font-bold text-xs px-6 bg-primary text-white shadow-lg shadow-primary/20" onClick={() => { setSelectedPartner(null); setPName(''); setPIndustry(''); setPWebsite(''); setIsPartnerDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Partner anlegen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-4">
          <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-4">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-600" />
                <Input placeholder="Partner suchen..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-9 text-xs rounded-lg bg-white" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPartners.map(p => (
                    <div 
                      key={p.id} 
                      className={cn(
                        "p-4 cursor-pointer transition-all hover:bg-slate-50 flex items-center justify-between group",
                        selectedPartner?.id === p.id ? "bg-indigo-50/50 border-l-4 border-l-indigo-600" : "bg-white dark:bg-slate-900"
                      )}
                      onClick={() => setSelectedPartner(p)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{p.industry || 'Keine Branche'}</p>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-all", selectedPartner?.id === p.id && "translate-x-1 text-indigo-600")} />
                    </div>
                  ))}
                  {filteredPartners.length === 0 && (
                    <div className="py-20 text-center opacity-30 italic text-xs uppercase tracking-widest">Keine Partner gefunden</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-8 space-y-6">
          {selectedPartner ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-headline font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedPartner.name}</h2>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-white border-slate-200 text-[10px] font-bold uppercase">{selectedPartner.industry}</Badge>
                    {selectedPartner.website && (
                      <a href={selectedPartner.website} target="_blank" className="text-[10px] text-primary font-bold flex items-center gap-1 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Website öffnen
                      </a>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setPName(selectedPartner.name); setPIndustry(selectedPartner.industry || ''); setPWebsite(selectedPartner.website || ''); setIsPartnerDialogOpen(true); }} className="h-8 rounded-lg text-[10px] font-black uppercase"><Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contacts Section */}
                <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-4 px-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Ansprechpartner
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/5" onClick={() => { setSelectedContact(null); setCName(''); setCEmail(''); setCPhone(''); setCRole(''); setIsContactDialogOpen(true); }}><PlusCircle className="w-4 h-4" /></Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    {contacts?.filter(c => c.partnerId === selectedPartner.id).map(contact => (
                      <div key={contact.id} className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm group hover:border-primary/20 transition-all flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{contact.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium truncate italic">{contact.email}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => { setSelectedContact(contact); setCName(contact.name); setCEmail(contact.email); setCPhone(contact.phone || ''); setCRole(contact.role || ''); setIsContactDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCollectionRecord('servicePartnerContacts', contact.id, dataSource).then(() => refreshContacts())}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                    {contacts?.filter(c => c.partnerId === selectedPartner.id).length === 0 && (
                      <div className="py-10 text-center opacity-20"><Info className="w-8 h-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Keine Kontakte</p></div>
                    )}
                  </CardContent>
                </Card>

                {/* Areas Section */}
                <Card className="rounded-2xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-4 px-6 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5" /> Fachbereiche
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => { setSelectedArea(null); setAName(''); setADesc(''); setIsAreaDialogOpen(true); }}><PlusCircle className="w-4 h-4" /></Button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    {areas?.filter(a => a.partnerId === selectedPartner.id).map(area => (
                      <div key={area.id} className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm group hover:border-emerald-200 transition-all flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{area.name}</p>
                          <p className="text-[9px] text-slate-400 truncate font-medium">{area.description || 'Keine Details'}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => { setSelectedArea(area); setAName(area.name); setADesc(area.description || ''); setIsAreaDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCollectionRecord('servicePartnerAreas', area.id, dataSource).then(() => refreshAreas())}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                    {areas?.filter(a => a.partnerId === selectedPartner.id).length === 0 && (
                      <div className="py-10 text-center opacity-20"><Info className="w-8 h-8 mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Keine Bereiche</p></div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-40 border-2 border-dashed rounded-3xl opacity-30">
              <Building2 className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Wählen Sie einen Partner aus</p>
            </div>
          )}
        </main>
      </div>

      {/* Partner Dialog */}
      <Dialog open={isPartnerDialogOpen} onOpenChange={setIsPartnerDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary border border-white/10 shadow-lg"><Building2 className="w-5 h-5" /></div>
              <div><DialogTitle className="text-lg font-bold">{selectedPartner ? 'Partner bearbeiten' : 'Neuer Partner'}</DialogTitle><DialogDescription className="text-[10px] text-white/50 font-bold uppercase mt-0.5">Externer Dienstleister Stammdaten</DialogDescription></div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Firma / Name</Label><Input value={pName} onChange={e => setPName(e.target.value)} className="h-11 rounded-xl font-bold" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Branche</Label><Input value={pIndustry} onChange={e => setPIndustry(e.target.value)} className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Website (URL)</Label><Input value={pWebsite} onChange={e => setPWebsite(e.target.value)} className="h-11 rounded-xl font-mono text-xs" placeholder="https://..." /></div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t"><Button variant="ghost" onClick={() => setIsPartnerDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button><Button onClick={handleSavePartner} disabled={isSaving || !pName} className="rounded-xl bg-primary text-white font-bold text-[10px] px-8 h-11 shadow-lg gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary border border-white/10 shadow-lg"><UserCircle className="w-5 h-5" /></div>
              <div><DialogTitle className="text-lg font-bold">Ansprechpartner</DialogTitle><DialogDescription className="text-[10px] text-white/50 font-bold uppercase mt-0.5">{selectedPartner?.name}</DialogDescription></div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Name</Label><Input value={cName} onChange={e => setCName(e.target.value)} className="h-11 rounded-xl font-bold" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">E-Mail</Label><Input value={cEmail} onChange={e => setCEmail(e.target.value)} className="h-11 rounded-xl font-medium" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Telefon</Label><Input value={cPhone} onChange={e => setCPhone(e.target.value)} className="h-11 rounded-xl" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Funktion</Label><Input value={cRole} onChange={e => setCRole(e.target.value)} className="h-11 rounded-xl" /></div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t"><Button variant="ghost" onClick={() => setIsContactDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button><Button onClick={handleSaveContact} disabled={isSaving || !cName} className="rounded-xl bg-primary text-white font-bold text-[10px] px-8 h-11 shadow-lg gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Area Dialog */}
      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary border border-white/10 shadow-lg"><Briefcase className="w-5 h-5" /></div>
              <div><DialogTitle className="text-lg font-bold">Fachbereich / Portfolio</DialogTitle><DialogDescription className="text-[10px] text-white/50 font-bold uppercase mt-0.5">{selectedPartner?.name}</DialogDescription></div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung</Label><Input value={aName} onChange={e => setAName(e.target.value)} placeholder="z.B. IT-Infrastruktur, Marketing-Support..." className="h-11 rounded-xl font-bold" /></div>
            <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Beschreibung</Label><Input value={aDesc} onChange={e => setADesc(e.target.value)} className="h-11 rounded-xl" /></div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t"><Button variant="ghost" onClick={() => setIsAreaDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button><Button onClick={handleSaveArea} disabled={isSaving || !aName} className="rounded-xl bg-primary text-white font-bold text-[10px] px-8 h-11 shadow-lg gap-2">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
