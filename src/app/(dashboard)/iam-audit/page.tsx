
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShieldAlert, 
  Search, 
  Loader2, 
  RefreshCw, 
  Zap, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldCheck,
  BrainCircuit,
  Settings2,
  Lock,
  ArrowRight,
  Activity,
  Split,
  Trophy,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { runIamAudit } from '@/ai/flows/iam-audit-flow';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';

export default function IamAuditPage() {
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const { data: users } = usePluggableCollection<any>('users');
  const { data: assignments } = usePluggableCollection<any>('assignments');
  const { data: resources } = usePluggableCollection<any>('resources');
  const { data: entitlements } = usePluggableCollection<any>('entitlements');
  const { data: criteria } = usePluggableCollection<any>('aiAuditCriteria');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStartAudit = async () => {
    if (!users || !assignments || !criteria) {
      toast({ variant: "destructive", title: "Daten fehlen", description: "Es konnten keine Audit-Daten geladen werden." });
      return;
    }
    
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const activeCriteria = criteria.filter((c: any) => c.enabled);
      const res = await runIamAudit({
        users: users.filter(u => activeTenantId === 'all' || u.tenantId === activeTenantId),
        assignments: assignments.filter(a => activeTenantId === 'all' || a.tenantId === activeTenantId),
        resources: resources || [],
        entitlements: entitlements || [],
        criteria: activeCriteria,
        dataSource
      });
      setAuditResult(res);
      toast({ title: "Audit abgeschlossen", description: "Die Ergebnisse liegen bereit." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Audit-Fehler", description: e.message });
    } finally {
      setIsAuditing(false);
    }
  };

  if (!mounted) return null;

  const sodConflicts = auditResult?.findings?.filter((f: any) => f.isSodConflict) || [];

  return (
    <div className="p-4 md:p-8 space-y-6 pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center rounded-lg border shadow-sm transition-transform hover:scale-105">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <Badge className="mb-1 rounded-full px-2 py-0 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">AI Governance</Badge>
            <h1 className="text-2xl font-headline font-bold text-slate-900 dark:text-white uppercase">KI Identity Audit</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automatisierte Analyse der Berechtigungs-Integrität & SoD Checks.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-md font-bold uppercase text-[9px] tracking-wider px-4 border-slate-200 hover:bg-slate-50" onClick={() => router.push('/settings/ai/audit-criteria')}>
            <Settings2 className="w-3.5 h-3.5 mr-2 text-primary" /> Audit-Regeln
          </Button>
          <Button size="sm" onClick={handleStartAudit} disabled={isAuditing || !users} className="h-9 rounded-md font-bold uppercase text-[10px] tracking-wider px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2">
            {isAuditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
            Audit starten
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Context Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="rounded-lg border shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 py-4 px-6 bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Prüf-Kontext</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Analysierte Nutzer</p>
                <p className="text-2xl font-headline font-bold text-slate-900 dark:text-white">{users?.length || 0}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Aktive Zuweisungen</p>
                <p className="text-2xl font-headline font-bold text-slate-900 dark:text-white">{assignments?.filter((a: any) => a.status === 'active').length || 0}</p>
              </div>
              <Separator className="bg-slate-100 dark:bg-slate-800" />
              <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-300">Methodik</p>
                    <p className="text-[8px] text-slate-400 italic uppercase">SoD Matrix Analysis</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {auditResult && sodConflicts.length > 0 && (
            <Card className="rounded-lg border-none bg-red-600 text-white shadow-lg animate-in zoom-in-95">
              <CardContent className="p-5 space-y-3 text-center">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mx-auto">
                  <Split className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-2xl font-black font-headline">{sodConflicts.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-80">SoD Konflikte</p>
                </div>
                <p className="text-[9px] leading-relaxed italic opacity-70">
                  Unzulässige Rollen-Kombinationen identifiziert.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results Area */}
        <div className="lg:col-span-3">
          {!auditResult && !isAuditing && (
            <div className="py-32 text-center border-2 border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/20 space-y-4 animate-in fade-in duration-700">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center mx-auto shadow-sm border">
                <ShieldCheck className="w-8 h-8 text-slate-200 dark:text-slate-800" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Audit Engine Bereit</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold max-w-[200px] mx-auto">Starten Sie den Enterprise-Scan für Identitäts-Risiken.</p>
              </div>
            </div>
          )}

          {isAuditing && (
            <div className="py-32 text-center space-y-6 animate-in fade-in zoom-in-95">
              <div className="relative w-16 h-16 mx-auto">
                <Loader2 className="w-16 h-16 animate-spin text-emerald-600 opacity-20" />
                <Zap className="absolute inset-0 m-auto w-7 h-7 text-emerald-600 animate-pulse fill-current" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-headline font-bold text-emerald-600 uppercase tracking-widest">KI Analyse läuft...</p>
                <div className="max-w-[200px] mx-auto space-y-1.5">
                  <Progress value={65} className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800" />
                  <p className="text-[8px] text-slate-400 uppercase font-black">Prüfe Funktionstrennung (SoD)</p>
                </div>
              </div>
            </div>
          )}

          {auditResult && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Card className="rounded-xl border shadow-sm overflow-hidden bg-white dark:bg-slate-900">
                <CardHeader className={cn(
                  "py-8 text-white px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-colors duration-700",
                  auditResult.score > 85 ? "bg-emerald-600" : auditResult.score > 60 ? "bg-primary" : "bg-red-600"
                )}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-5 h-5 opacity-50" />
                      <CardTitle className="text-xl font-headline font-bold uppercase tracking-widest">Audit Health Score</CardTitle>
                    </div>
                    <p className="text-[9px] uppercase font-black opacity-80 tracking-widest">Status • {activeTenantId === 'all' ? 'Global' : activeTenantId}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-px bg-white/20 hidden sm:block" />
                    <div className="text-6xl font-headline font-black">{auditResult.score}%</div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                      <p className="text-sm font-medium italic text-slate-700 dark:text-slate-300 leading-relaxed pl-2">
                        "{auditResult.summary}"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Compliance-Level</span>
                        <span className={cn(
                          "font-black",
                          auditResult.score > 85 ? "text-emerald-600" : auditResult.score > 60 ? "text-primary" : "text-red-600"
                        )}>
                          {auditResult.score > 85 ? 'KONFORM' : auditResult.score > 60 ? 'OPTIMIERBAR' : 'HOCHRISIKO'}
                        </span>
                      </div>
                      <Progress value={auditResult.score} className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 ml-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent" /> Audit Feststellungen ({auditResult.findings?.length || 0})
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {auditResult.findings?.map((f: any, i: number) => (
                    <div key={i} className={cn(
                      "p-5 rounded-lg shadow-sm border flex flex-col md:flex-row gap-5 transition-all group active:scale-[0.99]",
                      f.isSodConflict 
                        ? "bg-red-50/30 dark:bg-red-900/10 border-red-100 dark:border-red-900/30" 
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                    )}>
                      <div className="shrink-0 flex flex-col items-center gap-3">
                        <Badge className={cn(
                          "rounded-full text-[8px] font-black h-5 px-3 border-none",
                          f.severity === 'critical' ? "bg-red-600" : f.severity === 'high' ? "bg-accent" : "bg-emerald-600"
                        )}>
                          {f.severity.toUpperCase()}
                        </Badge>
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center shadow-inner border",
                          f.isSodConflict ? "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-900/40" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                        )}>
                          {f.isSodConflict ? (
                            <Split className="w-6 h-6 text-red-600" />
                          ) : (
                            <ShieldAlert className={cn("w-6 h-6", f.severity === 'critical' ? "text-red-600" : "text-slate-400")} />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 border-slate-50 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <h4 className="font-headline font-bold text-base text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">{f.finding}</h4>
                            {f.isSodConflict && <Badge className="bg-red-600 text-white rounded-none text-[7px] font-black uppercase h-3.5 px-1">SoD Conflict</Badge>}
                          </div>
                          <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">ID: {f.entityId}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-black text-[8px]">
                            {f.entityName?.charAt(0)}
                          </div>
                          <span>Betroffen: <span className="text-slate-900 dark:text-slate-200">{f.entityName}</span></span>
                        </div>
                        <div className={cn(
                          "p-4 rounded-md border relative overflow-hidden",
                          f.isSodConflict ? "bg-red-100/50 dark:bg-red-900/5 border-red-200 dark:border-red-900/20" : "bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-100/50 dark:border-emerald-900/20"
                        )}>
                          <p className={cn(
                            "text-[9px] font-black uppercase flex items-center gap-1.5 mb-1.5 tracking-widest",
                            f.isSodConflict ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-red-400"
                          )}>
                            <Zap className="w-3 h-3 fill-current" /> KI Empfehlung
                          </p>
                          <p className="text-xs text-slate-800 dark:text-slate-300 font-medium leading-relaxed italic">{f.recommendation}</p>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center justify-center">
                        <Button variant="outline" size="icon" className="w-10 h-10 rounded-md hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => router.push(`/users?search=${f.entityName}`)}>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
