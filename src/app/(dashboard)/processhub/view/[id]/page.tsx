
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  ShieldCheck,
  Activity, 
  RefreshCw, 
  ChevronRight,
  ClipboardList,
  FilePen,
  Link as LinkIcon,
  Maximize2,
  CircleDot,
  ExternalLink,
  Info,
  Briefcase,
  FileDown,
  Download,
  Building2,
  CheckCircle,
  Network,
  Eye,
  Lock,
  ListChecks,
  AlertTriangle,
  Lightbulb,
  ArrowDown,
  GitBranch,
  ArrowRight,
  Shield,
  History,
  Clock,
  User as UserIcon,
  Layers,
  ChevronDown,
  ArrowUpRight,
  Split,
  FileText,
  FileEdit,
  ArrowRightCircle,
  Tag,
  Zap,
  CheckCircle2,
  HelpCircle,
  Target,
  Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessVersion, ProcessNode, Tenant, Department, RegulatoryOption, Feature, Resource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { calculateProcessMaturity } from '@/lib/process-utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { exportDetailedProcessPdf } from '@/lib/export-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';

function generateMxGraphXml(model: ProcessModel, layout: ProcessLayout) {
  let xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>`;
  const nodes = model.nodes || [];
  const edges = model.edges || [];
  const positions = layout.positions || {};

  nodes.forEach((node, idx) => {
    let nodeSafeId = String(node.id || `node-${idx}`);
    const pos = positions[nodeSafeId] || { x: 50 + (idx * 220), y: 150 };
    let style = '';
    let w = 140, h = 70;
    let label = node.title;
    
    switch (node.type) {
      case 'start': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 40; h = 40; 
        break;
      case 'end': 
        style = 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#ffffff;strokeColor=#000000;strokeWidth=4;shadow=0;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;'; 
        w = 40; h = 40; 
        break;
      case 'decision': 
        style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;'; 
        w = 60; h = 60;
        label = 'X'; 
        break;
      case 'subprocess':
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;dashed=1;shadow=0;';
        w = 140; h = 70;
        break;
      default: 
        style = 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.5;shadow=0;';
        w = 140; h = 70;
    }
    
    const displayValue = node.type === 'decision' ? label : node.title;
    xml += `<mxCell id="${nodeSafeId}" value="${displayValue}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="edge-${idx}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;fontSize=10;fontColor=#000000;endArrow=block;endFill=1;curved=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDetailViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'guide'>('guide');
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);

  const { data: processes } = usePluggableCollection<Process>('processes');
  const { data: versions } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: tenants } = usePluggableCollection<Tenant>('tenants');
  const { data: auditLogs } = usePluggableCollection<any>('auditEvents');
  const { data: featureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: media } = usePluggableCollection<any>('media');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const allProcessVersions = useMemo(() => 
    versions?.filter((v: any) => v.process_id === id).sort((a: any, b: any) => b.version - a.version) || [],
    [versions, id]
  );

  const activeVersion = useMemo(() => {
    if (selectedVersionNum === null) return allProcessVersions[0];
    return allProcessVersions.find((v: any) => v.version === selectedVersionNum);
  }, [allProcessVersions, selectedVersionNum]);

  const processFeatures = useMemo(() => {
    if (!featureLinks) return [];
    const links = featureLinks.filter((l: any) => l.processId === id);
    const featureIds = [...new Set(links.map((l: any) => l.featureId))];
    return featureIds.map(fid => allFeatures?.find(f => f.id === fid)).filter(Boolean);
  }, [featureLinks, id, allFeatures]);

  const processResources = useMemo(() => {
    if (!activeVersion) return [];
    const resourceIds = new Set<string>();
    activeVersion.model_json.nodes.forEach((n: ProcessNode) => {
      if (n.resourceIds) n.resourceIds.forEach(rid => resourceIds.add(rid));
    });
    return Array.from(resourceIds).map(rid => resources?.find(r => r.id === rid)).filter(Boolean);
  }, [activeVersion, resources]);

  const maturity = useMemo(() => {
    if (!currentProcess || !activeVersion) return null;
    const pMedia = media?.filter((m: any) => m.entityId === id).length || 0;
    return calculateProcessMaturity(currentProcess, activeVersion, pMedia);
  }, [currentProcess, activeVersion, media, id]);

  const currentDept = useMemo(() => departments?.find(d => d.id === currentProcess?.responsibleDepartmentId), [departments, currentProcess]);
  
  const processAudit = useMemo(() => 
    auditLogs?.filter((e: any) => e.entityId === id && e.entityType === 'process')
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [],
    [auditLogs, id]
  );

  useEffect(() => { setMounted(true); }, []);

  const syncDiagram = useCallback(() => {
    if (!iframeRef.current || !activeVersion || viewMode !== 'diagram') return;
    const xml = generateMxGraphXml(activeVersion.model_json, activeVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 0 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 500);
  }, [activeVersion, viewMode]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !activeVersion || viewMode !== 'diagram') return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagram();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, activeVersion, syncDiagram, viewMode]);

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body">
      <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-10 w-10 text-slate-400 hover:bg-slate-100 rounded-xl"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-headline font-bold tracking-tight text-slate-900 truncate">{currentProcess?.title}</h1>
              <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-full px-2 h-5 text-[10px] font-black uppercase tracking-widest">{currentProcess?.status}</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">V{activeVersion?.version}.0 • Leitfaden</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border">
            <Button variant={viewMode === 'diagram' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('diagram')}><Network className="w-3.5 h-3.5 mr-1.5" /> Visuell</Button>
            <Button variant={viewMode === 'guide' ? 'secondary' : 'ghost'} size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase px-4" onClick={() => setViewMode('guide')}><ListChecks className="w-3.5 h-3.5 mr-1.5" /> Leitfaden</Button>
          </div>
          <Button variant="outline" className="rounded-xl h-10 px-6 font-bold text-xs border-slate-200 gap-2 shadow-sm" onClick={() => router.push(`/processhub/${id}`)}><FileEdit className="w-4 h-4" /> Designer</Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full">
        <aside className="w-96 border-r bg-white flex flex-col shrink-0 hidden lg:flex">
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10">
              {/* Maturity Section */}
              {maturity && (
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 fill-current" /> Maturity Center
                  </h3>
                  <Card className="rounded-2xl border-none bg-slate-900 text-white shadow-xl overflow-hidden p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Reifegrad Level {maturity.level}</p>
                        <h4 className="text-xl font-headline font-black">{maturity.levelLabel}</h4>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-primary border border-white/10">
                        <Activity className="w-6 h-6" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-400">Gesamt-Score</span>
                        <span className="text-primary">{maturity.totalPercent}%</span>
                      </div>
                      <Progress value={maturity.totalPercent} className="h-2 rounded-full bg-white/5" />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/5">
                      {maturity.dimensions.map(dim => (
                        <div key={dim.name} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {dim.status === 'complete' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <HelpCircle className="w-3 h-3 text-slate-500" />
                              )}
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{dim.name}</span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-500">{dim.score}/{dim.maxScore}</span>
                          </div>
                          <Progress value={(dim.score / dim.maxScore) * 100} className="h-1 rounded-full bg-white/5" />
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              )}

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Stammdaten</h3>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 shadow-inner">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-slate-400">Abteilung</Label>
                    <div className="flex items-center gap-2 text-slate-900"><Building2 className="w-4 h-4 text-emerald-600" /><p className="text-sm font-black uppercase">{currentDept?.name || '---'}</p></div>
                  </div>
                  <Separator className="bg-slate-200/50" />
                  <div>
                    <Label className="text-[9px] font-black uppercase text-slate-400">Beschreibung</Label>
                    <p className="text-xs text-slate-700 leading-relaxed mt-1">{currentProcess?.description || '---'}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 border-b pb-2 flex items-center gap-2"><Server className="w-3.5 h-3.5" /> IT-Systemunterstützung</h3>
                <div className="space-y-2">
                  {processResources.map((res: any) => (
                    <div key={res.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between group cursor-pointer hover:border-indigo-300 transition-all" onClick={() => router.push(`/resources?search=${res.name}`)}>
                      <span className="text-[11px] font-bold text-slate-700">{res.name}</span>
                      <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1">{res.assetType}</Badge>
                    </div>
                  ))}
                  {processResources.length === 0 && <p className="text-[10px] text-slate-300 italic px-1">Keine IT-Ressourcen zugeordnet</p>}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-b pb-2 flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Verarbeitete Merkmale</h3>
                <div className="space-y-2">
                  {processFeatures.map((f: any) => (
                    <div key={f.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm flex items-center justify-between group cursor-pointer hover:border-primary/30 transition-all" onClick={() => router.push(`/features/${f.id}`)}>
                      <span className="text-[11px] font-bold text-slate-700">{f.name}</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                  {processFeatures.length === 0 && <p className="text-[10px] text-slate-300 italic px-1">Keine Merkmale zugeordnet</p>}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Änderungshistorie</h3>
                <div className="space-y-3">
                  {processAudit.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="p-3 bg-slate-50 border rounded-xl space-y-1.5 hover:bg-white transition-all">
                      <div className="flex items-center justify-between"><span className="text-[9px] font-black text-slate-900 uppercase">{log.actorUid}</span><span className="text-[8px] font-bold text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</span></div>
                      <p className="text-[10px] text-slate-600 leading-tight italic">{log.action}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-100 relative">
          {viewMode === 'diagram' ? (
            <div className="flex-1 bg-white relative overflow-hidden shadow-inner">
              <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-12 pb-32">
                <div className="space-y-8 relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 z-0" />
                  {activeVersion?.model_json?.nodes?.map((node: ProcessNode, i: number) => {
                    const role = jobTitles?.find(j => j.id === node.roleId);
                    const nodeLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id);
                    const nodeResources = resources?.filter(r => node.resourceIds?.includes(r.id));
                    
                    return (
                      <div key={node.id} className="relative z-10 pl-16">
                        <div className={cn("absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm", node.type === 'start' ? "bg-white border-slate-900 text-slate-900" : "bg-white border-slate-200 text-slate-400")}>
                          <span className="font-headline font-bold text-lg">{i + 1}</span>
                        </div>
                        <Card className="rounded-2xl border shadow-sm overflow-hidden group hover:border-primary/20 transition-all">
                          <CardHeader className="p-6 bg-white border-b flex flex-row items-center justify-between">
                            <div>
                              <h3 className="font-headline font-bold text-base text-slate-900 uppercase">{node.title}</h3>
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                {role && <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-primary"><Briefcase className="w-3.5 h-3.5" /> {role.name}</div>}
                                {nodeResources && nodeResources.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-600"><Server className="w-3.5 h-3.5" /> {nodeResources.length} Systeme</div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 space-y-6">
                            {node.description && <p className="text-sm text-slate-700 leading-relaxed">{node.description}</p>}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                              {nodeLinks && nodeLinks.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Merkmale</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {nodeLinks.map((l: any) => {
                                      const f = allFeatures?.find(feat => feat.id === l.featureId);
                                      return <Badge key={l.id} variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[9px] font-bold h-6 px-2">{f?.name || 'Merkmal'}</Badge>;
                                    })}
                                  </div>
                                </div>
                              )}
                              {nodeResources && nodeResources.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Systeme</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {nodeResources.map(r => (
                                      <Badge key={r.id} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] font-bold h-6 px-2">{r.name}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </main>
      </div>
    </div>
  );
}
