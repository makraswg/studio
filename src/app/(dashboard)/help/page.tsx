"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  Pencil, 
  Save, 
  Plus, 
  Trash2, 
  Loader2, 
  Info,
  ChevronRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  Search,
  Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { saveCollectionRecord, deleteCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { HelpContent } from '@/lib/types';

export default function HelpPage() {
  const { dataSource } = useSettings();
  const { user } = usePlatformAuth();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedHelp, setSelectedHelp] = useState<HelpContent | null>(null);

  // Form State
  const [section, setSection] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [order, setOrder] = useState('0');

  const { data: helpItems, isLoading, refresh } = usePluggableCollection<HelpContent>('helpContent');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredHelp = useMemo(() => {
    if (!helpItems) return [];
    return helpItems
      .filter(h => 
        h.title.toLowerCase().includes(search.toLowerCase()) || 
        h.content.toLowerCase().includes(search.toLowerCase()) ||
        h.section.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [helpItems, search]);

  const sections = useMemo(() => {
    if (!helpItems) return [];
    return Array.from(new Set(helpItems.map(h => h.section))).sort();
  }, [helpItems]);

  const handleSaveHelp = async () => {
    if (!title || !content || !section) {
      toast({ variant: "destructive", title: "Fehler", description: "Titel, Bereich und Inhalt sind erforderlich." });
      return;
    }

    setIsSaving(true);
    const id = selectedHelp?.id || `help-${Math.random().toString(36).substring(2, 9)}`;
    const data: HelpContent = {
      id,
      section,
      title,
      content,
      order: parseInt(order) || 0
    };

    try {
      const res = await saveCollectionRecord('helpContent', id, data, dataSource);
      if (res.success) {
        toast({ title: "Hilfe-Eintrag gespeichert" });
        setIsDialogOpen(false);
        resetForm();
        refresh();
      } else {
        throw new Error(res.error || "Fehler beim Speichern");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHelp = async (id: string) => {
    if (!confirm("Diesen Hilfe-Eintrag wirklich löschen?")) return;
    
    try {
      const res = await deleteCollectionRecord('helpContent', id, dataSource);
      if (res.success) {
        toast({ title: "Eintrag gelöscht" });
        refresh();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fehler beim Löschen", description: e.message });
    }
  };

  const resetForm = () => {
    setSelectedHelp(null);
    setSection('');
    setTitle('');
    setContent('');
    setOrder('0');
  };

  const openEdit = (item: HelpContent) => {
    setSelectedHelp(item);
    setSection(item.section);
    setTitle(item.title);
    setContent(item.content);
    setOrder(item.order.toString());
    setIsDialogOpen(true);
  };

  const canEdit = user?.role === 'superAdmin' || user?.role === 'admin';

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-none border-2 border-primary/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase font-headline">Hilfe & Dokumentation</h1>
            <p className="text-sm text-muted-foreground mt-1">Erklärungen zu Workflows, Funktionen und der Plattform-Bedienung.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button 
              variant={isEditMode ? "default" : "outline"} 
              size="sm" 
              onClick={() => setIsEditMode(!isEditMode)}
              className="h-9 font-bold uppercase text-[10px] rounded-none px-6"
            >
              {isEditMode ? <ShieldCheck className="w-3.5 h-3.5 mr-2" /> : <Pencil className="w-3.5 h-3.5 mr-2" />}
              {isEditMode ? 'Ansichts-Modus' : 'Bearbeiten'}
            </Button>
          )}
          {isEditMode && (
            <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }} className="h-9 font-bold uppercase text-[10px] rounded-none px-6">
              <Plus className="w-3.5 h-3.5 mr-2" /> Neuer Eintrag
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Nach Themen oder Inhalten suchen..." 
          className="pl-10 h-12 border-2 border-border bg-white dark:bg-slate-900 text-sm focus:outline-none rounded-none shadow-none focus:ring-0 focus:border-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Lade Dokumentation...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-4">
            <div className="bg-card border p-1 rounded-none">
              <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30">
                Themenbereiche
              </p>
              <div className="mt-1 space-y-1">
                {sections.map(s => (
                  <button 
                    key={s}
                    className="w-full text-left px-3 py-2 text-[11px] font-bold uppercase hover:bg-primary/5 hover:text-primary transition-colors flex items-center justify-between group"
                    onClick={() => {
                      const el = document.getElementById(`section-${s}`);
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <span>{s}</span>
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>

            <Card className="rounded-none border shadow-none bg-slate-900 text-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-[10px] font-bold uppercase text-primary tracking-widest flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 fill-current" /> Schnell-Tipp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] leading-relaxed italic text-slate-300">
                  Nutzen Sie den Jira-Sync Tab, um Onboardings erst dann im ComplianceHub zu aktivieren, wenn die technische Bereitstellung in Jira bestätigt wurde.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-3 space-y-12">
            {sections.map(s => (
              <div key={s} id={`section-${s}`} className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-3">
                  <span className="w-10 h-px bg-primary/20" />
                  {s}
                </h2>
                
                <div className="grid grid-cols-1 gap-4">
                  {filteredHelp.filter(h => h.section === s).map(item => (
                    <Card key={item.id} className="rounded-none border shadow-none group hover:border-primary/30 transition-all bg-card relative">
                      {isEditMode && (
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 text-blue-600" onClick={() => openEdit(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-red-600" onClick={() => handleDeleteHelp(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold font-headline">{item.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {item.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {filteredHelp.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed bg-muted/10">
                <Info className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-bold uppercase text-muted-foreground">Keine passenden Hilfe-Themen gefunden.</p>
                <Button variant="ghost" className="mt-4 text-[10px] font-bold uppercase" onClick={() => setSearch('')}>Suche zurücksetzen</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Help Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl w-[95vw] md:w-full h-[90vh] md:h-auto rounded-[1.5rem] md:rounded-none border-2 shadow-2xl p-0 overflow-hidden flex flex-col bg-card">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Settings2 className="w-5 h-5 text-primary" />
              <DialogTitle className="text-sm font-bold uppercase tracking-wider">
                {selectedHelp ? 'Hilfe-Eintrag bearbeiten' : 'Neuer Hilfe-Eintrag'}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bereich (Sektion)</Label>
                  <Input 
                    value={section} 
                    onChange={e => setSection(e.target.value)} 
                    placeholder="z.B. Workflows" 
                    className="rounded-none h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Sortierung (Reihenfolge)</Label>
                  <Input 
                    type="number" 
                    value={order} 
                    onChange={e => setOrder(e.target.value)} 
                    className="rounded-none h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Überschrift / Thema</Label>
                <Input 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="Was wird erklärt?" 
                  className="rounded-none h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Erklärungstext (Inhalt)</Label>
                <Textarea 
                  value={content} 
                  onChange={e => setContent(e.target.value)} 
                  placeholder="Detaillierte Beschreibung..." 
                  className="rounded-none min-h-[200px] leading-relaxed"
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-muted/30 border-t shrink-0 flex flex-col-reverse sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto rounded-none h-10 px-8 font-bold uppercase text-[10px]">Abbrechen</Button>
            <Button onClick={handleSaveHelp} disabled={isSaving} className="w-full sm:w-auto rounded-none font-bold uppercase text-[10px] px-10 h-10 gap-2 bg-slate-900 text-white">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              In Datenbank speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
