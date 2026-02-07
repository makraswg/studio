"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building2, Globe, Shield, Info, BrainCircuit } from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function GeneralSettingsPage() {
  const { dataSource, activeTenantId } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({});

  const { data: tenants, refresh } = usePluggableCollection<Tenant>('tenants');

  useEffect(() => {
    const current = tenants?.find(t => t.id === (activeTenantId === 'all' ? 't1' : activeTenantId));
    if (current) setTenantDraft(current);
  }, [tenants, activeTenantId]);

  const handleSave = async () => {
    if (!tenantDraft.id || !tenantDraft.name) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('tenants', tenantDraft.id, tenantDraft, dataSource);
      if (res.success) {
        toast({ title: "Mandant gespeichert" });
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">Mandanten-Stammdaten</CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-black uppercase px-3 h-5">
                ID: {tenantDraft.id || 'NEW'}
              </Badge>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Primäre Konfiguration</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Unternehmensname</Label>
            <Input 
              value={tenantDraft.name || ''} 
              onChange={e => setTenantDraft({...tenantDraft, name: e.target.value})} 
              className="rounded-xl h-12 font-bold text-base border-slate-200 dark:border-slate-800 focus:border-primary transition-all" 
              placeholder="z.B. Acme Corp"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Regulatorischer Rahmen</Label>
            <Select 
              value={tenantDraft.region || 'EU-DSGVO'} 
              onValueChange={v => setTenantDraft({...tenantDraft, region: v})}
            >
              <SelectTrigger className="rounded-xl h-12 border-slate-200 dark:border-slate-800 font-bold">
                <SelectValue placeholder="Wählen..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="EU-DSGVO">Europa (GDPR / DSGVO)</SelectItem>
                <SelectItem value="BSI-IT-Grundschutz">Deutschland (BSI Grundschutz)</SelectItem>
                <SelectItem value="NIST-USA">USA (NIST / HIPAA)</SelectItem>
                <SelectItem value="ISO-GLOBAL">International (ISO 27001)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 md:col-span-2">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">System-Alias (Slug)</Label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input 
                value={tenantDraft.slug || ''} 
                disabled 
                className="rounded-xl h-12 pl-11 bg-slate-50 dark:bg-slate-950 font-mono text-sm border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed" 
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">KI-Kontext (Unternehmensbeschreibung)</h3>
          </div>
          <div className="p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 space-y-4">
            <div className="flex items-start gap-4">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                Diese Beschreibung dient als primärer Kontext für alle KI-Funktionen (Audit, Advisor, Designer). 
                Beschreiben Sie Branche, Unternehmensgröße, IT-Infrastruktur und spezifische Compliance-Ziele.
              </p>
            </div>
            <Textarea 
              value={tenantDraft.companyDescription || ''} 
              onChange={e => setTenantDraft({...tenantDraft, companyDescription: e.target.value})}
              placeholder="Beispiel: Wir sind ein mittelständisches Logistikunternehmen mit 200 Mitarbeitern. Unsere IT-Infrastruktur ist hybrid (On-Prem SAP und Microsoft 365). Wir legen höchsten Wert auf Ausfallsicherheit der ERP-Systeme..."
              className="min-h-[150px] rounded-xl border-slate-200 focus:border-primary bg-white dark:bg-slate-950 p-4 text-xs font-medium leading-relaxed"
            />
          </div>
        </div>

        <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-800">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="rounded-xl font-black uppercase text-xs tracking-[0.1em] h-12 px-12 gap-3 bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Änderungen Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
