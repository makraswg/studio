
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { BookOpen, Loader2, Save as SaveIcon, ExternalLink, Info, BadgeCheck } from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { BookStackConfig } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default function BookStackSettingsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [configDraft, setConfigDraft] = useState<Partial<BookStackConfig>>({});

  const { data: configs, refresh } = usePluggableCollection<BookStackConfig>('bookstackConfigs');

  useEffect(() => {
    if (configs && configs.length > 0) setConfigDraft(configs[0]);
    else setConfigDraft({ id: 'bs-default', enabled: false });
  }, [configs]);

  const handleSave = async () => {
    if (!configDraft.id) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('bookstackConfigs', configDraft.id, configDraft, dataSource);
      if (res.success) {
        toast({ title: "BookStack Konfiguration gespeichert" });
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">BookStack Dokumentation</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Automatisierter Export von Prozess-Leitfäden</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="flex items-center justify-between p-6 bg-primary/5 dark:bg-slate-950 rounded-xl border border-primary/10">
            <div className="space-y-1">
              <Label className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">BookStack Publishing aktiv</Label>
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Erlaubt den Export von Prozess-Modellen als Dokumentationsseiten.</p>
            </div>
            <Switch checked={!!configDraft.enabled} onCheckedChange={v => setConfigDraft({...configDraft, enabled: v})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">BookStack Basis-URL</Label>
              <Input value={configDraft.url || ''} onChange={e => setConfigDraft({...configDraft, url: e.target.value})} placeholder="https://docs.firma.local" className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Standard Book ID</Label>
              <Input value={configDraft.default_book_id || ''} onChange={e => setConfigDraft({...configDraft, default_book_id: e.target.value})} placeholder="z.B. 1" className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-2 tracking-widest">
              <BadgeCheck className="w-4 h-4 text-emerald-600" /> API-Authentifizierung
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Token ID</Label>
                <Input value={configDraft.token_id || ''} onChange={e => setConfigDraft({...configDraft, token_id: e.target.value})} className="rounded-xl h-12 border-slate-200 dark:border-slate-800 font-mono" />
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Token Secret</Label>
                <Input type="password" value={configDraft.token_secret || ''} onChange={e => setConfigDraft({...configDraft, token_secret: e.target.value})} className="rounded-xl h-12 border-slate-200 dark:border-slate-800 font-mono" />
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase">Einrichtungshinweis</p>
              <p className="text-[11px] text-slate-500 italic leading-relaxed">
                Die API-Daten können in BookStack unter &quot;Mein Profil → API Tokens&quot; generiert werden. Stellen Sie sicher, dass der Account über die Berechtigung &quot;Seiten erstellen&quot; verfügt.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-8 border-t border-slate-100 dark:border-slate-800">
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="rounded-xl font-black uppercase text-xs tracking-[0.1em] h-12 px-16 gap-3 bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
              Speichern
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
