
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building2, Globe, Info, BrainCircuit } from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

export default function GeneralSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantDescription, setTenantDescription] = useState('');
  const [tenantId, setTenantId] = useState('');

  const { data: tenants, refresh } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) {
      setTenantId(current.id);
      setTenantName(current.name);
      setTenantDescription(current.companyDescription || '');
    }
  }, [tenants, activeTenantId]);

  const handleSave = async () => {
    if (!tenantId || !tenantName) {
      toast({ variant: "destructive", title: "Fehler", description: "Name ist erforderlich." });
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('tenants', tenantId, {
        id: tenantId,
        name: tenantName,
        companyDescription: tenantDescription
      }, dataSource);

      if (res.success) {
        toast({ title: "Mandant erfolgreich aktualisiert" });
        refresh();
      } else {
        throw new Error(res.error || "Datenbankfehler beim Speichern.");
      }
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Speichern fehlgeschlagen", 
        description: e.message || "Prüfen Sie Ihre Internetverbindung." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="p-8 bg-slate-50 dark:bg-slate-800 border-b shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Mandanten-Stammdaten</CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-black uppercase px-3 h-5">ID: {tenantId}</Badge>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Primäre Konfiguration</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-10">
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Unternehmensname</Label>
          <Input 
            value={tenantName} 
            onChange={e => setTenantName(e.target.value)} 
            className="rounded-xl h-12 font-bold text-base bg-slate-50/30" 
            placeholder="z.B. Acme Corp" 
            disabled={isSaving}
          />
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">KI-Kontext (Unternehmensbeschreibung)</h3>
          </div>
          <Textarea 
            value={tenantDescription} 
            onChange={e => setTenantDescription(e.target.value)}
            placeholder="Beschreiben Sie Ihre Firma für die KI..."
            className="min-h-[150px] rounded-xl p-4 text-xs font-medium bg-slate-50/30"
            disabled={isSaving}
          />
        </div>

        <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-800">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="rounded-xl font-black uppercase text-xs h-12 px-12 gap-3 shadow-lg transition-all active:scale-95"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Änderungen Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
