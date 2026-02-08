
"use client";

import { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  BookOpen, 
  ChevronRight, 
  ShieldCheck, 
  Zap, 
  Search, 
  Workflow, 
  Layers, 
  Target, 
  Scale, 
  Users, 
  ArrowRight,
  Info,
  Network,
  Sparkles,
  MousePointer2,
  Lock,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  Fingerprint,
  FileCheck,
  ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function HelpHubPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const GuideCard = ({ icon: Icon, title, desc, color, bg, items }: any) => (
    <Card className="rounded-[2rem] border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden group hover:scale-[1.02] transition-all duration-500">
      <CardHeader className={cn("p-8 border-b", bg)}>
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", color, "bg-white")}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-headline font-black uppercase tracking-tight">{title}</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-70">Modul-Leitfaden</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium italic">"{desc}"</p>
        <div className="space-y-3">
          {items.map((item: string, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
              <CheckCircle2 className={cn("w-4 h-4 mt-0.5 shrink-0", color.replace('text-', 'text-'))} />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{item}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-12 pb-32 animate-in fade-in duration-700 max-w-7xl mx-auto">
      {/* Visual Header */}
      <section className="relative h-[350px] rounded-[3rem] overflow-hidden bg-slate-900 flex flex-col items-center justify-center p-8 text-center border-b-8 border-primary">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/tech/1200/800')] opacity-20 grayscale" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-slate-900" />
        
        <div className="relative z-10 space-y-6 max-w-3xl">
          <Badge className="bg-primary text-white border-none rounded-full px-4 h-7 text-[10px] font-black uppercase tracking-[0.3em] shadow-lg animate-bounce">
            Knowledge Hub
          </Badge>
          <h1 className="text-4xl md:text-6xl font-headline font-black text-white tracking-tighter uppercase leading-none">
            Struktur statt <span className="text-primary italic">Bauchgefühl</span>
          </h1>
          <p className="text-base text-slate-300 font-medium leading-relaxed">
            Willkommen in der Architektur der Resilienz. Hier lernst du, wie Daten fließen, Risiken gemindert werden und Compliance zum automatisierten Standard wird.
          </p>
          <div className="relative group max-w-md mx-auto pt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input 
              placeholder="Was willst du meistern?" 
              className="h-14 pl-12 rounded-2xl bg-white/10 backdrop-blur-xl border-white/20 text-white placeholder:text-slate-500 text-lg focus:ring-primary/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* The Golden Chain - Interactive Data Map */}
      <section className="space-y-8 px-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-headline font-black uppercase tracking-widest text-slate-900 dark:text-white">Die Goldene Kette</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Wie alles zusammenhängt</p>
        </div>

        <div className="relative p-10 bg-white dark:bg-slate-900 border rounded-[3rem] shadow-2xl overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between min-w-[900px] gap-4 relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
            
            {[
              { id: 'vvt', label: 'Zweck (VVT)', icon: FileCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Warum?' },
              { id: 'proc', label: 'Prozess', icon: Workflow, color: 'text-primary', bg: 'bg-primary/10', sub: 'Wie?' },
              { id: 'res', label: 'IT-System', icon: Server, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'Womit?' },
              { id: 'feat', label: 'Daten', icon: Database, color: 'text-sky-600', bg: 'bg-sky-50', sub: 'Was?' },
              { id: 'risk', label: 'Risiko', icon: AlertTriangle, color: 'text-accent', bg: 'bg-accent/10', sub: 'Was stört?' },
              { id: 'ctrl', label: 'Kontrolle', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Sicher?' }
            ].map((node, i) => (
              <div key={node.id} className="relative z-10 flex flex-col items-center gap-4 group">
                <div className={cn(
                  "w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-xl border-4 border-white dark:border-slate-800 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3",
                  node.bg, node.color
                )}>
                  <node.icon className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase text-slate-900 dark:text-white leading-tight">{node.label}</p>
                  <Badge variant="ghost" className="text-[8px] font-black uppercase text-slate-400 p-0 h-auto">{node.sub}</Badge>
                </div>
                {i < 5 && (
                  <div className="absolute top-1/2 -right-4 -translate-y-1/2 text-slate-300">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row items-center gap-8 border-l-8 border-primary">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
            <Info className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-headline font-bold uppercase tracking-tight">Echte Resilienz durch Vernetzung</h4>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              In der ComplianceHub-Welt ist kein Datum ein einsames Objekt. Ein Risiko bedroht ein System, das System speichert Daten, und diese Daten sind Teil eines Prozesses, der wiederum einen gesetzlichen Zweck (VVT) erfüllt. 
              <br/>
              <span className="text-primary font-bold">Änderst du einen Link, aktualisiert die KI automatisch die gesamte Compliance-Kette.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Module Guides */}
      <section className="px-4">
        <Tabs defaultValue="access" className="space-y-10">
          <TabsList className="h-14 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-[1.5rem] border w-full md:w-auto justify-start gap-2 shadow-inner overflow-x-auto no-scrollbar">
            <TabsTrigger value="access" className="rounded-xl px-8 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg">
              <Users className="w-4 h-4" /> Access
            </TabsTrigger>
            <TabsTrigger value="workflow" className="rounded-xl px-8 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg">
              <Workflow className="w-4 h-4" /> Workflow
            </TabsTrigger>
            <TabsTrigger value="risk" className="rounded-xl px-8 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg">
              <ShieldAlert className="w-4 h-4" /> Risk
            </TabsTrigger>
            <TabsTrigger value="policy" className="rounded-xl px-8 gap-2 text-[11px] font-black uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-lg">
              <FileCheck className="w-4 h-4" /> Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <GuideCard 
                icon={Fingerprint}
                title="Identity & Access (IAM)"
                bg="bg-blue-500 text-white"
                color="text-blue-600"
                desc="Identitäten sind das Fundament deiner Sicherheit. Hier steuerst du, wer was wann darf."
                items={[
                  "Blueprints definieren: Erstelle Standard-Rechte für Job-Profile (z.B. IT-Admin).",
                  "Automatisierung: Onboarding-Pakete bündeln Rollen für neue Mitarbeiter.",
                  "Drift-Detection: Gleihe das AD/LDAP gegen deine Blueprints ab.",
                  "Access Reviews: Prüfe regelmäßig, ob Berechtigungen noch nötig sind."
                ]}
              />
              <div className="space-y-6">
                <div className="p-8 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-black uppercase text-indigo-900 tracking-widest flex items-center gap-2">
                    <Zap className="w-4 h-4 fill-current" /> Cross-Module Power
                  </h4>
                  <p className="text-xs text-indigo-700 font-medium leading-relaxed italic">
                    "Verknüpfst du eine Rolle mit einer Ressource, erbt der Nutzer automatisch die Kritikalität des Systems. Die KI prüft im Identity-Audit, ob die Rolle zum Stellenprofil passt (Least Privilege)."
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-3xl bg-white border shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ziel</p>
                    <p className="text-sm font-bold text-slate-800">Zero Trust</p>
                  </div>
                  <div className="p-6 rounded-3xl bg-white border shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Standard</p>
                    <p className="text-sm font-bold text-slate-800">ISO 27001</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <GuideCard 
                icon={GitBranch}
                title="Workflow & Asset Management"
                bg="bg-primary text-white"
                color="text-primary"
                desc="Prozesse sind die Arterien deines Unternehmens. Hier wird die reale Arbeit dokumentiert."
                items={[
                  "IT-Systeme registrieren: Pflege den Katalog deiner Software und Hardware.",
                  "Daten-Mapping: Definiere fachliche Datenobjekte (Features) und ihren CIA-Bedarf.",
                  "Prozess-Design: Zeichne visuelle Abläufe und verknüpfe genutzte Systeme.",
                  "Maturity Tracking: Steigere den Reifegrad deiner Dokumentation."
                ]}
              />
              <div className="p-8 rounded-[2.5rem] bg-blue-50/50 border border-blue-100 flex flex-col justify-center gap-6 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md border"><Database className="w-6 h-6 text-primary" /></div>
                  <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">The Data Inheritance Logic</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge className="h-6 w-6 rounded-full bg-slate-900 text-white border-none p-0 flex items-center justify-center text-[10px]">1</Badge>
                    <p className="text-xs font-bold text-slate-600">Datenobjekt (Feature) erhält Schutzbedarf.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="h-6 w-6 rounded-full bg-slate-900 text-white border-none p-0 flex items-center justify-center text-[10px]">2</Badge>
                    <p className="text-xs font-bold text-slate-600">IT-System hostet dieses Datenobjekt.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="h-6 w-6 rounded-full bg-primary text-white border-none p-0 flex items-center justify-center text-[10px]">3</Badge>
                    <p className="text-xs font-black text-primary uppercase italic">System erbt Schutzbedarf automatisch!</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <GuideCard 
                icon={Target}
                title="Risk & Control (GRC)"
                bg="bg-accent text-white"
                color="text-accent"
                desc="Identifiziere Gefahren, bevor sie zum Vorfall werden. Messbare Sicherheit statt Hoffnung."
                items={[
                  "Risiko-Inventar: Erfasse Bedrohungen für Assets und Prozesse.",
                  "BSI Integration: Nutze den Katalog für standardisierte Gefährdungen.",
                  "Maßnahmenplan: Definiere strategische Gegenmaßnahmen (Pläne).",
                  "Kontroll-Monitoring: Prüfe operativ, ob deine TOMs wirklich wirksam sind."
                ]}
              />
              <div className="space-y-6">
                <div className="p-8 rounded-[2.5rem] bg-orange-50/50 border border-orange-100 shadow-sm space-y-4">
                  <h4 className="text-sm font-black uppercase text-orange-900 tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Evidence-Based Security
                  </h4>
                  <p className="text-xs text-orange-800 font-medium leading-relaxed">
                    "Eine Maßnahme ohne wirksame Kontrolle ist nur ein Wunsch. Erst wenn der Kontroll-Check positiv ist, steigt dein <strong>Resilience Score</strong> auf dem Dashboard."
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 p-6 rounded-3xl bg-slate-900 text-white text-center">
                    <AlertTriangle className="w-6 h-6 text-accent mx-auto mb-2" />
                    <p className="text-[10px] font-bold uppercase opacity-50">Impact</p>
                    <p className="text-sm font-black">Score 1-25</p>
                  </div>
                  <div className="flex-1 p-6 rounded-3xl bg-emerald-600 text-white text-center">
                    <CheckCircle2 className="w-6 h-6 text-white mx-auto mb-2" />
                    <p className="text-[10px] font-bold uppercase opacity-50">Resultat</p>
                    <p className="text-sm font-black">Wirksamkeit</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="policy" className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <GuideCard 
                icon={FileCheck}
                title="Policy & GDPR Hub"
                bg="bg-emerald-600 text-white"
                color="text-emerald-600"
                desc="Datenschutz ist kein Formular, sondern gelebte Prozessqualität."
                items={[
                  "Verzeichnis (VVT): Dokumentiere deine Verarbeitungstätigkeiten nach Art. 30.",
                  "Rechtsgrundlagen: Weise jedem Zweck die passende Basis zu.",
                  "Automatisierte TOM: Ziehe Nachweise direkt aus dem RiskHub.",
                  "KI Audit: Lass die KI prüfen, ob deine IAM-Struktur konform ist."
                ]}
              />
              <div className="p-10 rounded-[3rem] bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center gap-6 shadow-inner relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                <Scale className="w-12 h-12 text-emerald-600" />
                <div>
                  <h4 className="text-base font-black uppercase text-slate-900 mb-2">Audit-Ready in Seconds</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs">
                    "Weil VVTs an Prozesse gekoppelt sind, generiert das System den Datenschutz-Bericht automatisch aus den technischen Realitäten deiner IT."
                  </p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-full h-6 px-4 text-[9px] font-black uppercase tracking-widest shadow-sm">Compliance Automator</Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Quick Links Footer */}
      <footer className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-4">
        <div className="p-6 rounded-3xl bg-slate-50 border flex items-center justify-between group cursor-pointer hover:bg-white transition-all shadow-sm" onClick={() => window.open('https://compliance-hub.local/docs')}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><BookOpen className="w-5 h-5" /></div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Vollständige Doku</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
        </div>
        <div className="p-6 rounded-3xl bg-slate-50 border flex items-center justify-between group cursor-pointer hover:bg-white transition-all shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white"><Network className="w-5 h-5" /></div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Support anfordern</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
        </div>
        <div className="p-6 rounded-3xl bg-slate-50 border flex items-center justify-between group cursor-pointer hover:bg-white transition-all shadow-sm" onClick={() => window.location.href='/setup'}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><HelpCircle className="w-5 h-5" /></div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">System Status</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
        </div>
      </footer>
    </div>
  );
}
