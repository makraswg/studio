"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Building2, Globe } from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { Tenant } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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
    <Card className="rounded-[2.5rem] border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="p-10 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-xl">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-headline font-bold uppercase tracking-tight">Mandanten-Stammdaten</CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge className="bg-primary/20 text-primary border-none rounded-full text-[9px] font-black uppercase px-3 h-5">
                ID: {tenantDraft.id || 'NEW'}
              </Badge>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Primäre Konfiguration</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-10 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Unternehmensname</Label>
            <Input 
              value={tenantDraft.name || ''} 
              onChange={e => setTenantDraft({...tenantDraft, name: e.target.value})} 
              className="rounded-2xl h-14 font-bold text-lg border-slate-200 dark:border-slate-800 focus:border-primary transition-all" 
              placeholder="z.B. Acme Corp"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">System-Alias (Slug)</Label>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <Input 
                value={tenantDraft.slug || ''} 
                disabled 
                className="rounded-2xl h-14 pl-11 bg-slate-50 dark:bg-slate-950 font-mono text-sm border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed" 
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-200">
            <Globe className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">Globale Identität</p>
            <p className="text-[11px] text-slate-500 italic leading-relaxed">
              Dieser Name wird in allen automatisierten Berichten, Onboarding-E-Mails und im Header des Mitarbeiter-Portals verwendet. 
              Änderungen sind sofort systemweit wirksam.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-10 border-t border-slate-100 dark:border-slate-800">
          <Button 
            onClick={handleSave} 
            disabled={isSaving} 
            className="rounded-2xl font-black uppercase text-xs tracking-[0.2em] h-14 px-12 gap-3 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Änderungen Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
