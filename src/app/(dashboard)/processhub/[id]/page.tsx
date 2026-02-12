
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  Save as SaveIcon, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  Trash2,
  Network,
  Lock,
  Unlock,
  PlusCircle,
  Zap,
  ClipboardList,
  Building2,
  CheckCircle,
  FileStack,
  Upload,
  Server,
  Tag,
  Settings2,
  Clock,
  ListChecks,
  AlertCircle,
  Lightbulb,
  FileCheck,
  UserCircle,
  ArrowUp,
  ArrowDown,
  Info,
  Search,
  Briefcase,
  ArrowLeftCircle,
  ArrowRightCircle,
  X,
  ClipboardCheck,
  Layers,
  ShieldAlert,
  Save
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { applyProcessOpsAction, updateProcessMetadataAction, commitProcessVersionAction } from '@/app/actions/process-actions';
import { linkFeatureToProcessAction, unlinkFeatureFromProcessAction } from '@/app/actions/feature-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { saveMediaAction, deleteMediaAction } from '@/app/actions/media-actions';
import { runOcrAction } from '@/ai/flows/ocr-flow';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessNode, ProcessOperation, ProcessVersion, Department, RegulatoryOption, Feature, MediaFile, Resource, Task, PlatformUser, ProcessingActivity, DataSubjectGroup, DataCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { AiFormAssistant } from '@/components/ai/form-assistant';

function escapeXml(unsafe: string) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

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
    xml += `<mxCell id="${nodeSafeId}" value="${escapeXml(displayValue)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${(pos as any).x}" y="${(pos as any).y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });

  edges.forEach((edge, idx) => {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="${edge.id || `edge-${idx}`}" value="${escapeXml(edge.label || '')}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;fontSize=10;fontColor=#000000;endArrow=block;endFill=1;curved=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }
  });
  xml += `</root></mxGraphModel>`;
  return xml;
}

export default function ProcessDesignerPage() {
  const { id } = useParams();
  const router = useRouter();
  const { dataSource, activeTenantId } = useSettings();
  const { user } = usePlatformAuth();
  const isMobile = useIsMobile();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [mounted, setMounted] = useState(false);
  const [leftWidth, setLeftWidth] = useState(380);

  // UI States
  const [isDiagramLocked, setIsDiagramLocked] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  
  const [localNodeEdits, setLocalNodeEdits] = useState({ 
    id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '', type: 'step', targetProcessId: '', resourceIds: [] as string[], featureIds: [] as string[], subjectGroupIds: [] as string[], dataCategoryIds: [] as string[], predecessorIds: [] as string[], successorIds: [] as string[], customFields: {} as Record<string, string>
  });

  // Master Data Form State
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaInputs, setMetaInputs] = useState('');
  const [metaOutputs, setMetaOutputs] = useState('');
  const [metaKpis, setMetaKpis] = useState('');
  const [metaDeptId, setMetaDeptId] = useState('');
  const [metaFramework, setMetaFramework] = useState('');
  const [metaAutomation, setMetaAutomation] = useState<'manual' | 'partial' | 'full'>('manual');
  const [metaVolume, setMetaDataVolume] = useState<'low' | 'medium' | 'high'>('low');
  const [metaFrequency, setMetaFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'on_demand'>('on_demand');
  const [metaTags, setMetaTags] = useState('');
  const [metaQuestions, setMetaQuestions] = useState('');
  const [metaVvtId, setMetaVvtId] = useState('');
  const [metaOwnerRoleId, setMetaOwnerRoleId] = useState('');

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: featureLinks } = usePluggableCollection<any>('feature_process_steps');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaInputs(currentProcess.inputs || '');
      setMetaOutputs(currentProcess.outputs || '');
      setMetaKpis(currentProcess.kpis || '');
      setMetaDeptId(currentProcess.responsibleDepartmentId || 'none');
      setMetaFramework(currentProcess.regulatoryFramework || 'none');
      setMetaAutomation(currentProcess.automationLevel || 'manual');
      setMetaDataVolume(currentProcess.dataVolume || 'low');
      setMetaFrequency(currentProcess.processingFrequency || 'on_demand');
      setMetaTags(currentProcess.tags || '');
      setMetaQuestions(currentProcess.openQuestions || '');
      setMetaVvtId(currentProcess.vvtId || 'none');
      setMetaOwnerRoleId(currentProcess.ownerRoleId || 'none');
    }
  }, [currentProcess]);

  useEffect(() => {
    if (selectedNodeId && currentVersion) {
      const node = currentVersion.model_json?.nodes?.find((n: any) => n.id === selectedNodeId);
      const nodeFeatureIds = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === selectedNodeId).map((l: any) => l.featureId) || [];
      
      if (node) {
        setLocalNodeEdits({
          id: node.id,
          title: node.title || '',
          roleId: node.roleId || '',
          resourceIds: node.resourceIds || [],
          featureIds: nodeFeatureIds,
          subjectGroupIds: node.subjectGroupIds || [],
          dataCategoryIds: node.dataCategoryIds || [],
          predecessorIds: node.predecessorIds || [],
          successorIds: node.successorIds || [],
          description: node.description || '',
          checklist: (node.checklist || []).join('\n'),
          tips: node.tips || '',
          errors: node.errors || '',
          type: node.type || 'step',
          targetProcessId: node.targetProcessId || '',
          customFields: node.customFields || {}
        });
      }
    }
  }, [selectedNodeId, currentVersion, featureLinks, id]);

  useEffect(() => { setMounted(true); }, []);

  const syncDiagramToModel = useCallback(() => {
    if (!iframeRef.current || !currentVersion || isDiagramLocked) return;
    const xml = generateMxGraphXml(currentVersion.model_json, currentVersion.layout_json);
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml: xml, autosave: 1 }), '*');
    setTimeout(() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ action: 'zoom', type: 'fit' }), '*'), 300);
  }, [currentVersion, isDiagramLocked]);

  useEffect(() => {
    if (!mounted || !iframeRef.current || !currentVersion?.model_json?.nodes?.length) return;
    const handleMessage = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'init') syncDiagramToModel();
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [mounted, currentVersion?.id, syncDiagramToModel]);

  const handleApplyOps = async (ops: any[]) => {
    if (!currentVersion || !user || !ops.length) return false;
    setIsApplying(true);
    try {
      const res = await applyProcessOpsAction(currentVersion.process_id, currentVersion.version, ops, currentVersion.revision, user.id, dataSource);
      if (res.success) {
        refreshVersion();
        refreshProc();
        return true;
      }
      return false;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update fehlgeschlagen", description: e.message });
      return false;
    } finally {
      setIsApplying(false);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Arbeitsschritt permanent löschen?")) return;
    const ops: ProcessOperation[] = [{ type: 'REMOVE_NODE', payload: { nodeId } }];
    await handleApplyOps(ops);
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleSaveMetadata = async () => {
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(id as string, {
        title: metaTitle,
        description: metaDesc,
        inputs: metaInputs,
        outputs: metaOutputs,
        kpis: metaKpis,
        responsibleDepartmentId: metaDeptId === 'none' ? undefined : metaDeptId,
        regulatoryFramework: metaFramework === 'none' ? undefined : metaFramework,
        automationLevel: metaAutomation,
        dataVolume: metaVolume,
        processingFrequency: metaFrequency,
        tags: metaTags,
        openQuestions: metaQuestions,
        vvtId: metaVvtId === 'none' ? undefined : metaVvtId,
        ownerRoleId: metaOwnerRoleId === 'none' ? undefined : metaOwnerRoleId
      }, dataSource);
      if (res.success) {
        toast({ title: "Stammdaten gespeichert" });
        refreshProc();
      }
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleCommitVersion = async () => {
    if (!currentVersion || !user) return;
    setIsCommitting(true);
    try {
      const res = await commitProcessVersionAction(currentProcess.id, currentVersion.version, user.email || user.id, dataSource);
      if (res.success) {
        toast({ title: "Version gespeichert" });
        refreshVersion();
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!currentVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Prozessschritt', decision: 'Entscheidung?', end: 'Endpunkt', subprocess: 'Prozess-Referenz' };
    const nodes = currentVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : (nodes.length > 0 ? nodes[nodes.length - 1] : null);
    
    const newNode: ProcessNode = {
      id: newId,
      type,
      title: titles[type],
      checklist: [],
      roleId: predecessor?.roleId || '',
      resourceIds: predecessor?.resourceIds || [],
      featureIds: featureLinks?.filter((l: any) => predecessor && l.nodeId === predecessor.id).map((l: any) => l.featureId) || [],
      subjectGroupIds: predecessor?.subjectGroupIds || [],
      dataCategoryIds: predecessor?.dataCategoryIds || [],
      predecessorIds: predecessor ? [predecessor.id] : []
    };

    const ops: ProcessOperation[] = [{ type: 'ADD_NODE', payload: { node: newNode } }];
    if (predecessor) {
      ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } } });
    }
    handleApplyOps(ops).then(s => { if(s) { setSelectedNodeId(newId); setIsStepDialogOpen(true); } });
  };

  const getFullRoleName = (roleId: string) => {
    const role = jobTitles?.find(j => j.id === roleId);
    if (!role) return roleId;
    const dept = departments?.find(d => d.id === role.departmentId);
    return dept ? `${dept.name} — ${role.name}` : role.name;
  };

  if (!mounted) return null;

  return (
    <div className="h-screen flex flex-col -m-4 md:-m-8 overflow-hidden bg-slate-50 font-body relative">
      <header className="glass-header h-14 flex items-center justify-between px-6 shrink-0 z-20 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/processhub')} className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-md transition-all"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-headline font-bold text-sm md:text-base tracking-tight text-slate-900 truncate max-w-[200px] md:max-w-md">{currentProcess?.title}</h2>
              <Badge className="bg-primary/10 text-primary border-none rounded-full text-[9px] font-bold px-2 h-4 hidden md:flex">Designer</Badge>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">V{currentVersion?.version}.0 • Rev. {currentVersion?.revision}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isDiagramLocked && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 hover:bg-blue-50 text-blue-600 transition-all"
              onClick={syncDiagramToModel}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Diagramm generieren
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("h-8 rounded-md text-[10px] font-bold border-slate-200 gap-2 transition-all", isDiagramLocked ? "bg-slate-100 text-slate-400" : "hover:bg-amber-50 text-amber-600")}
            onClick={() => setIsDiagramLocked(!isDiagramLocked)}
          >
            {isDiagramLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isDiagramLocked ? 'Layout gesperrt' : 'Layout frei'}
          </Button>
          <Button size="sm" className="rounded-md h-8 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-sm transition-all gap-2" onClick={handleCommitVersion} disabled={isCommitting}>
            {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />} 
            Speichern & Loggen
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside className={cn("border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm hidden md:flex")} style={{ width: `${leftWidth}px` }}>
          <Tabs defaultValue="meta" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-blue-600"><Info className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger>
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><ClipboardList className="w-3.5 h-3.5" /> Ablauf</TabsTrigger>
            </TabsList>
            
            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-white">
                <div className="p-6 space-y-6 pb-10">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Prozesstitel</Label>
                      <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="h-10 text-xs font-bold rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Fachliche Beschreibung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="min-h-[100px] text-xs leading-relaxed rounded-2xl" />
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Owner (Rollen-Standardzuweisung)</Label>
                      <Select value={metaOwnerRoleId} onValueChange={setMetaOwnerRoleId}>
                        <SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none">Nicht zugewiesen</SelectItem>
                          {sortedRoles?.filter(j => activeTenantId === 'all' || j.tenantId === activeTenantId).map(role => (
                            <SelectItem key={role.id} value={role.id}>{getFullRoleName(role.id)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-4 border-t bg-slate-50 shrink-0">
                <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase gap-2 shadow-lg">
                  {isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SaveIcon className="w-3.5 h-3.5" />} 
                  Stammdaten sichern
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-start shrink-0">
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any, index: number) => (
                    <div key={node.id} className={cn("group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer bg-white shadow-sm hover:border-primary/20", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", node.type === 'decision' ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500")}>
                        {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{node.title}</p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>

        <main className="flex-1 relative bg-white overflow-hidden shadow-inner">
          {currentVersion?.model_json?.nodes?.length ? (
            <iframe ref={iframeRef} src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json" className="absolute inset-0 w-full h-full border-none" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
              <Workflow className="w-16 h-16 text-slate-200 mb-4" />
              <h2 className="text-xl font-headline font-bold text-slate-900">Modellierung starten</h2>
              <Button className="mt-6 rounded-xl h-11 px-8 font-bold text-xs" onClick={() => handleQuickAdd('step')}><PlusCircle className="w-4 h-4 mr-2" /> Ersten Prozessschritt anlegen</Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
