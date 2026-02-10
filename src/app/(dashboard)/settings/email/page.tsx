
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { 
  Mail, 
  Loader2, 
  Save as SaveIcon, 
  Send, 
  ShieldCheck, 
  Server, 
  Globe,
  Info
} from 'lucide-react';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { testSmtpConnectionAction } from '@/app/actions/smtp-actions';
import { SmtpConfig } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default function EmailSettingsPage() {
  const { dataSource } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [smtpDraft, setSmtpDraft] = useState<Partial<SmtpConfig>>({});

  const { data: configs, refresh } = usePluggableCollection<SmtpConfig>('smtpConfigs');

  useEffect(() => {
    if (configs && configs.length > 0) setSmtpDraft(configs[0]);
    else setSmtpDraft({ id: 'smtp-default', enabled: false });
  }, [configs]);

  const handleSave = async () => {
    if (!smtpDraft.id) return;
    setIsSaving(true);
    try {
      const res = await saveCollectionRecord('smtpConfigs', smtpDraft.id, smtpDraft, dataSource);
      if (res.success) {
        toast({ title: "E-Mail Einstellungen gespeichert" });
        refresh();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await testSmtpConnectionAction(smtpDraft);
      toast({ title: "Verbindungstest", description: res.message, variant: res.success ? "default" : "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
              <Mail className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight text-slate-900 dark:text-white">SMTP E-Mail Server</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5">Benachrichtigungen & System-Mails</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="flex items-center justify-between p-6 bg-primary/5 dark:bg-slate-950 rounded-xl border border-primary/10">
            <div className="space-y-1">
              <Label className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase">E-Mail Versand aktiv</Label>
              <p className="text-[10px] uppercase font-bold text-slate-400 italic">Erlaubt den Versand von Passwort-Reset Links und Audit-Reports.</p>
            </div>
            <Switch 
              checked={!!smtpDraft.enabled} 
              onCheckedChange={v => setSmtpDraft({...smtpDraft, enabled: v})} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">SMTP Host</Label>
              <div className="relative">
                <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input value={smtpDraft.host || ''} onChange={e => setSmtpDraft({...smtpDraft, host: e.target.value})} placeholder="smtp.firma.local" className="rounded-xl h-12 pl-11 border-slate-200 dark:border-slate-800" />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Port</Label>
              <Input value={smtpDraft.port || ''} onChange={e => setSmtpDraft({...smtpDraft, port: e.target.value})} placeholder="587 / 465" className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Benutzername</Label>
              <Input value={smtpDraft.user || ''} onChange={e => setSmtpDraft({...smtpDraft, user: e.target.value})} placeholder="Benutzer oder E-Mail" className="rounded-xl h-12 border-slate-200 dark:border-slate-800" />
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Absender-Adresse</Label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input value={smtpDraft.fromEmail || ''} onChange={e => setSmtpDraft({...smtpDraft, fromEmail: e.target.value})} placeholder="noreply@firma.de" className="rounded-xl h-12 pl-11 border-slate-200 dark:border-slate-800" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-10 border-t border-slate-100 dark:border-slate-800 gap-6">
            <Button 
              variant="outline" 
              onClick={handleTest} 
              disabled={isTesting}
              className="rounded-xl h-12 px-10 font-black uppercase text-[10px] tracking-widest border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all active:scale-95 gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Verbindung Testen
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="w-full sm:w-auto rounded-xl h-12 px-16 font-black uppercase text-xs tracking-[0.1em] bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95 gap-3"
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
