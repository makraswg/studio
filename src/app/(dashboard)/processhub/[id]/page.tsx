
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Workflow, 
  ChevronLeft, 
  Loader2, 
  Send, 
  Check, 
  X, 
  BrainCircuit, 
  ShieldCheck,
  Save, 
  Activity, 
  RefreshCw, 
  GitBranch, 
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  FilePen,
  ArrowRight,
  CheckCircle,
  Link as LinkIcon,
  Maximize2,
  CircleDot,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Info,
  Sparkles,
  Briefcase,
  Plus,
  ArrowRightCircle,
  ArrowLeftCircle,
  Link2,
  Share2,
  ArrowRight as ArrowRightIcon,
  Trash2,
  Network,
  Lock,
  Unlock,
  PlusCircle,
  Zap,
  Shield,
  History,
  ClipboardCheck,
  Building2,
  CheckSquare,
  Square,
  FileEdit,
  Tag,
  Target,
  FileStack,
  FileText,
  Upload,
  Eye,
  FileSearch,
  Server,
  Layers,
  Database,
  Settings2,
  BarChart3,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePluggableCollection } from '@/hooks/data/use-pluggable-collection';
import { useSettings } from '@/context/settings-context';
import { usePlatformAuth } from '@/context/auth-context';
import { applyProcessOpsAction, updateProcessMetadataAction, commitProcessVersionAction } from '@/app/actions/process-actions';
import { linkFeatureToProcessAction, unlinkFeatureFromProcessAction, saveFeatureAction } from '@/app/actions/feature-actions';
import { saveTaskAction } from '@/app/actions/task-actions';
import { saveMediaAction, deleteMediaAction, getMediaConfigAction } from '@/app/actions/media-actions';
import { runOcrAction } from '@/ai/flows/ocr-flow';
import { saveCollectionRecord } from '@/app/actions/mysql-actions';
import { toast } from '@/hooks/use-toast';
import { ProcessModel, ProcessLayout, Process, JobTitle, ProcessComment, ProcessNode, ProcessOperation, ProcessEdge, ProcessVersion, Department, RegulatoryOption, Feature, FeatureProcessStep, MediaFile, Resource, Task, PlatformUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

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
    let edgeSafeId = String(edge.id || `edge-${idx}`);
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    if (nodes.some(n => String(n.id) === sourceId) && nodes.some(n => String(n.id) === targetId)) {
      xml += `<mxCell id="${edgeSafeId}" value="${edge.label || ''}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#000000;strokeWidth=1.5;fontSize=10;fontColor=#000000;endArrow=block;endFill=1;curved=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}"><mxGeometry relative="1" as="geometry"/></mxCell>`;
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
    id: '', title: '', roleId: '', description: '', checklist: '', tips: '', errors: '', type: 'step', targetProcessId: '', resourceIds: [] as string[], featureIds: [] as string[], customFields: {} as Record<string, string>
  });

  // Master Data (Stammdaten) Form State
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaDeptId, setMetaDeptId] = useState('');
  const [metaFramework, setMetaFramework] = useState('');
  const [metaAutomation, setMetaAutomation] = useState<'manual' | 'partial' | 'full'>('manual');
  const [metaVolume, setMetaDataVolume] = useState<'low' | 'medium' | 'high'>('low');
  const [metaFrequency, setMetaFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'on_demand'>('on_demand');

  // Task Creation State
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Media States
  const [isUploading, setIsUploading] = useState(false);
  const [isOcring, setIsOcring] = useState(false);

  const { data: processes, refresh: refreshProc } = usePluggableCollection<Process>('processes');
  const { data: versions, refresh: refreshVersion } = usePluggableCollection<any>('process_versions');
  const { data: jobTitles } = usePluggableCollection<JobTitle>('jobTitles');
  const { data: resources } = usePluggableCollection<Resource>('resources');
  const { data: allFeatures } = usePluggableCollection<Feature>('features');
  const { data: mediaFiles, refresh: refreshMedia } = usePluggableCollection<MediaFile>('media');
  const { data: featureLinks, refresh: refreshFeatureLinks } = usePluggableCollection<any>('feature_process_steps');
  const { data: tasks, refresh: refreshTasks } = usePluggableCollection<Task>('tasks');
  const { data: pUsers } = usePluggableCollection<PlatformUser>('platformUsers');
  const { data: departments } = usePluggableCollection<Department>('departments');
  const { data: regulatoryOptions } = usePluggableCollection<RegulatoryOption>('regulatory_options');
  
  const currentProcess = useMemo(() => processes?.find((p: any) => p.id === id) || null, [processes, id]);
  const currentVersion = useMemo(() => versions?.find((v: any) => v.process_id === id), [versions, id]);
  
  const processTasks = useMemo(() => 
    tasks?.filter(t => t.entityId === id && t.entityType === 'process') || [],
    [tasks, id]
  );

  const selectedNodeMedia = useMemo(() => 
    mediaFiles?.filter(m => m.entityId === id && m.subEntityId === selectedNodeId) || [],
    [mediaFiles, id, selectedNodeId]
  );

  useEffect(() => {
    if (currentProcess) {
      setMetaTitle(currentProcess.title || '');
      setMetaDesc(currentProcess.description || '');
      setMetaDeptId(currentProcess.responsibleDepartmentId || 'none');
      setMetaFramework(currentProcess.regulatoryFramework || 'none');
      setMetaAutomation(currentProcess.automationLevel || 'manual');
      setMetaDataVolume(currentProcess.dataVolume || 'low');
      setMetaFrequency(currentProcess.processingFrequency || 'on_demand');
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

  const handleSaveMetadata = async () => {
    setIsSavingMeta(true);
    try {
      const res = await updateProcessMetadataAction(id as string, {
        title: metaTitle,
        description: metaDesc,
        responsibleDepartmentId: metaDeptId === 'none' ? undefined : metaDeptId,
        regulatoryFramework: metaFramework === 'none' ? undefined : metaFramework,
        automationLevel: metaAutomation,
        dataVolume: metaVolume,
        processingFrequency: metaFrequency
      }, dataSource);
      if (res.success) {
        toast({ title: "Stammdaten gespeichert" });
        refreshProc();
      }
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle || !taskAssigneeId) return;
    setIsSavingTask(true);
    try {
      const res = await saveTaskAction({
        tenantId: currentProcess?.tenantId || 'global',
        title: taskTitle,
        status: 'todo',
        priority: 'medium',
        assigneeId: taskAssigneeId,
        creatorId: user?.id || 'system',
        entityType: 'process',
        entityId: id as string
      }, dataSource, user?.email || 'system');
      if (res.success) {
        toast({ title: "Aufgabe erstellt" });
        setIsTaskDialogOpen(false);
        setTaskTitle('');
        refreshTasks();
      }
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleCommitVersion = async () => {
    if (!currentVersion || !user) return;
    setIsCommitting(true);
    try {
      const res = await commitProcessVersionAction(currentVersion.process_id, currentVersion.version, user.email || user.id, dataSource);
      if (res.success) {
        toast({ title: "Version gespeichert" });
        refreshVersion();
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNodeId || !user) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUri = evt.target?.result as string;
      const mediaId = `med-${Math.random().toString(36).substring(2, 9)}`;
      
      const mediaData: MediaFile = {
        id: mediaId,
        tenantId: currentProcess?.tenantId || 't1',
        module: 'ProcessHub',
        entityId: id as string,
        subEntityId: selectedNodeId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: dataUri,
        createdAt: new Date().toISOString(),
        createdBy: user.email || 'system'
      };

      try {
        const res = await saveMediaAction(mediaData, dataSource);
        if (res.success) {
          toast({ title: "Datei hochgeladen" });
          refreshMedia();
          
          if (file.type === 'application/pdf') {
            setIsOcring(true);
            const ocrRes = await runOcrAction({ fileDataUri: dataUri, fileName: file.name, dataSource });
            if (ocrRes.extractedText) {
              await saveMediaAction({ ...mediaData, ocrText: ocrRes.extractedText }, dataSource);
              toast({ title: "OCR abgeschlossen", description: "Texte aus PDF wurden indexiert." });
              refreshMedia();
            }
            setIsOcring(false);
          }
        }
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickAdd = (type: 'step' | 'decision' | 'end' | 'subprocess') => {
    if (!currentVersion) return;
    const newId = `${type}-${Date.now()}`;
    const titles = { step: 'Neuer Schritt', decision: 'Entscheidung?', end: 'Endpunkt', subprocess: 'Prozess-Referenz' };
    const nodes = currentVersion.model_json.nodes || [];
    const predecessor = selectedNodeId ? nodes.find((n: any) => n.id === selectedNodeId) : nodes[nodes.length - 1];
    
    const initialResources = predecessor?.resourceIds || [];

    const ops: ProcessOperation[] = [{ type: 'ADD_NODE', payload: { node: { id: newId, type, title: titles[type], resourceIds: initialResources } } }];
    if (predecessor) {
      ops.push({ type: 'ADD_EDGE', payload: { edge: { id: `edge-${Date.now()}`, source: predecessor.id, target: newId } } });
    }
    handleApplyOps(ops).then(s => { if(s) { setSelectedNodeId(newId); setIsStepDialogOpen(true); } });
  };

  const handleSaveNodeEdits = async () => {
    if (!selectedNodeId) return;
    
    const ops: ProcessOperation[] = [{
      type: 'UPDATE_NODE',
      payload: {
        nodeId: selectedNodeId,
        patch: {
          title: localNodeEdits.title,
          roleId: localNodeEdits.roleId,
          resourceIds: localNodeEdits.resourceIds,
          description: localNodeEdits.description,
          checklist: localNodeEdits.checklist.split('\n').filter(l => l.trim() !== '')
        }
      }
    }];
    
    const existingLinks = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === selectedNodeId) || [];
    const existingIds = existingLinks.map((l: any) => l.featureId);
    
    for (const fid of localNodeEdits.featureIds) {
      if (!existingIds.includes(fid)) {
        await linkFeatureToProcessAction({
          featureId: fid,
          processId: id as string,
          nodeId: selectedNodeId,
          usageType: 'Verarbeitung',
          criticality: 'medium'
        }, dataSource);
      }
    }
    
    for (const link of existingLinks) {
      if (!localNodeEdits.featureIds.includes(link.featureId)) {
        await unlinkFeatureFromProcessAction(link.id, link.featureId, dataSource);
      }
    }

    const success = await handleApplyOps(ops);
    if (success) {
      toast({ title: "Schritt aktualisiert" });
      refreshFeatureLinks();
      setIsStepDialogOpen(false);
    }
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
            {isCommitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />} 
            Speichern & Loggen
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden h-full relative">
        <aside style={{ width: isMobile ? '100%' : `${leftWidth}px` }} className={cn("border-r flex flex-col bg-white shrink-0 overflow-hidden relative group/sidebar h-full shadow-sm", isMobile && "hidden")}>
          <Tabs defaultValue="steps" className="h-full flex flex-col overflow-hidden">
            <TabsList className="h-11 bg-slate-50 border-b gap-0 p-0 w-full justify-start shrink-0 rounded-none overflow-x-auto no-scrollbar">
              <TabsTrigger value="steps" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-primary"><ClipboardList className="w-3.5 h-3.5" /> Ablauf</TabsTrigger>
              <TabsTrigger value="meta" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-blue-600"><Info className="w-3.5 h-3.5" /> Stammdaten</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-amber-600"><CheckCircle className="w-3.5 h-3.5" /> Aufgaben</TabsTrigger>
              <TabsTrigger value="media" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent h-full px-2 text-[10px] font-bold flex items-center justify-center gap-2 text-slate-500 data-[state=active]:text-indigo-600"><FileStack className="w-3.5 h-3.5" /> Medien</TabsTrigger>
            </TabsList>
            
            <TabsContent value="steps" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-start shrink-0">
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('step')}>+ Schritt</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('decision')}>+ Weiche</Button>
                  <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-md" onClick={() => handleQuickAdd('subprocess')}>+ Referenz</Button>
                </div>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {(currentVersion?.model_json?.nodes || []).map((node: any) => {
                    const nodeMedia = mediaFiles?.filter(m => m.entityId === id && m.subEntityId === node.id).length || 0;
                    const nodeFeats = featureLinks?.filter((l: any) => l.processId === id && l.nodeId === node.id).length || 0;
                    return (
                      <div key={node.id} className={cn("group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer bg-white shadow-sm", selectedNodeId === node.id ? "border-primary ring-2 ring-primary/5" : "border-slate-100")} onClick={() => { setSelectedNodeId(node.id); setIsStepDialogOpen(true); }}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border relative", node.type === 'decision' ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500")}>
                          {node.type === 'decision' ? <GitBranch className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                          {nodeMedia > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] font-bold border border-white">{nodeMedia}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{node.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {node.resourceIds?.length > 0 && <span className="text-[7px] text-indigo-600 font-black uppercase">{node.resourceIds.length} Systeme</span>}
                            {nodeFeats > 0 && <span className="text-[7px] text-sky-600 font-black uppercase">{nodeFeats} Daten</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="meta" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-white">
                <div className="p-6 space-y-6 pb-32">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Prozesstitel</Label>
                      <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} className="h-10 text-xs font-bold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Fachliche Beschreibung</Label>
                      <Textarea value={metaDesc} onChange={e => setMetaDesc(e.target.value)} className="min-h-[100px] text-xs leading-relaxed" />
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Verantwortliche Abteilung</Label>
                      <Select value={metaDeptId} onValueChange={setMetaDeptId}>
                        <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keine Abteilung</SelectItem>
                          {departments?.filter(d => activeTenantId === 'all' || d.tenantId === activeTenantId).map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Regulatorik / Standard</Label>
                      <Select value={metaFramework} onValueChange={setMetaFramework}>
                        <SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kein Standard</SelectItem>
                          {regulatoryOptions?.filter(o => o.enabled).map(o => (
                            <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Automatisierung</Label>
                        <Select value={metaAutomation} onValueChange={(v: any) => setMetaAutomation(v)}>
                          <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manuell</SelectItem>
                            <SelectItem value="partial">Teil-Automatisiert</SelectItem>
                            <SelectItem value="full">Voll-Automatisiert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Frequenz</Label>
                        <Select value={metaFrequency} onValueChange={(v: any) => setMetaFrequency(v)}>
                          <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Täglich</SelectItem>
                            <SelectItem value="weekly">Wöchentlich</SelectItem>
                            <SelectItem value="monthly">Monatlich</SelectItem>
                            <SelectItem value="on_demand">Ad-hoc / Bedarf</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button onClick={handleSaveMetadata} disabled={isSavingMeta} className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase gap-2 shadow-lg">
                      {isSavingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 
                      Stammdaten sichern
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <div className="px-6 py-3 border-b bg-white flex items-center justify-between shrink-0">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Offene Punkte</h4>
                <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold text-primary gap-1" onClick={() => { setTaskTitle(''); setIsTaskDialogOpen(true); }}>
                  <Plus className="w-3 h-3" /> Hinzufügen
                </Button>
              </div>
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-4 space-y-2 pb-32">
                  {processTasks.map(t => (
                    <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm group hover:border-amber-300 transition-all cursor-pointer" onClick={() => router.push('/tasks')}>
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className={cn("text-[7px] font-black uppercase h-3.5 px-1 border-none", t.status === 'done' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>{t.status}</Badge>
                        <span className="text-[8px] font-bold text-slate-400 flex items-center gap-1"><Clock className="w-2 h-2" /> {t.dueDate || '∞'}</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-800 leading-tight">{t.title}</p>
                      <p className="text-[9px] text-slate-400 mt-1 truncate">{pUsers?.find(u => u.id === t.assigneeId)?.displayName || 'Unzugewiesen'}</p>
                    </div>
                  ))}
                  {processTasks.length === 0 && (
                    <div className="py-20 text-center space-y-3 opacity-20">
                      <ClipboardList className="w-10 h-10 mx-auto" />
                      <p className="text-[10px] font-black uppercase">Keine Aufgaben</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="media" className="flex-1 m-0 overflow-hidden data-[state=active]:flex flex-col outline-none p-0 mt-0">
              <ScrollArea className="flex-1 bg-slate-50/30">
                <div className="p-6 space-y-6">
                  {mediaFiles?.filter(m => m.entityId === id).length === 0 ? (
                    <div className="py-20 text-center space-y-3 opacity-20">
                      <FileStack className="w-10 h-10 mx-auto" />
                      <p className="text-[10px] font-black uppercase">Keine Medien</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {mediaFiles?.filter(m => m.entityId === id).map(m => (
                        <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                            {m.fileType.includes('image') ? <Activity className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-slate-800 truncate">{m.fileName}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase">{m.subEntityId ? 'Schritt-Anhang' : 'Global'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
              <Button className="mt-6 rounded-xl h-11 px-8 font-bold text-xs" onClick={() => handleQuickAdd('step')}><PlusCircle className="w-4 h-4 mr-2" /> Ersten Schritt anlegen</Button>
            </div>
          )}
        </main>
      </div>

      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-2xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white h-[90vh]">
          <DialogHeader className="p-6 bg-white border-b pr-10">
            <div className="flex items-center gap-5">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", localNodeEdits.type === 'decision' ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary")}>
                {localNodeEdits.type === 'decision' ? <GitBranch className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-headline font-bold text-slate-900 truncate">{localNodeEdits.title || 'Schritt bearbeiten'}</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arbeitsschritt-Dokumentation</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <Tabs defaultValue="base" className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-slate-50 border-b h-11 px-6 justify-start rounded-none gap-6">
              <TabsTrigger value="base" className="text-[10px] font-bold uppercase gap-2">Stammdaten</TabsTrigger>
              <TabsTrigger value="resources" className="text-[10px] font-bold uppercase gap-2"><Server className="w-3.5 h-3.5" /> IT-Systeme</TabsTrigger>
              <TabsTrigger value="data" className="text-[10px] font-bold uppercase gap-2"><Tag className="w-3.5 h-3.5" /> Datenobjekte</TabsTrigger>
              <TabsTrigger value="media" className="text-[10px] font-bold uppercase gap-2"><FileStack className="w-3.5 h-3.5" /> Anhänge</TabsTrigger>
              <TabsTrigger value="details" className="text-[10px] font-bold uppercase gap-2">Tätigkeit</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-1">
              <div className="p-8 space-y-10">
                <TabsContent value="base" className="mt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">Bezeichnung</Label><Input value={localNodeEdits.title} onChange={e => setLocalNodeEdits({...localNodeEdits, title: e.target.value})} className="h-11 font-bold rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-slate-400">Verantwortliche Rolle</Label><Select value={localNodeEdits.roleId} onValueChange={(val) => setLocalNodeEdits({...localNodeEdits, roleId: val})}><SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger><SelectContent>{jobTitles?.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </TabsContent>

                <TabsContent value="resources" className="mt-0 space-y-6">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-100"><Server className="w-4 h-4" /></div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">IT-Systemunterstützung</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Welche Anwendungen werden in diesem Schritt genutzt?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resources?.filter(r => r.status !== 'archived').map(res => (
                      <div 
                        key={res.id} 
                        className={cn(
                          "p-3 border rounded-xl flex items-center gap-3 cursor-pointer transition-all shadow-sm group",
                          localNodeEdits.resourceIds.includes(res.id) ? "border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/10" : "bg-white border-slate-100 hover:border-slate-300"
                        )}
                        onClick={() => {
                          const rid = res.id;
                          setLocalNodeEdits(prev => ({
                            ...prev,
                            resourceIds: prev.resourceIds.includes(rid) ? prev.resourceIds.filter(id => id !== rid) : [...prev.resourceIds, rid]
                          }));
                        }}
                      >
                        <Checkbox checked={localNodeEdits.resourceIds.includes(res.id)} className="rounded-md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{res.name}</p>
                          <p className="text-[8px] text-slate-400 font-black uppercase">{res.assetType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="data" className="mt-0 space-y-6">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <div className="w-8 h-8 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center border border-sky-100"><Tag className="w-4 h-4" /></div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Verarbeitete Datenobjekte</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Welche fachlichen Informationen werden hier verarbeitet?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allFeatures?.filter(f => f.status !== 'archived').map(feat => (
                      <div 
                        key={feat.id} 
                        className={cn(
                          "p-3 border rounded-xl flex items-center gap-3 cursor-pointer transition-all shadow-sm group",
                          localNodeEdits.featureIds.includes(feat.id) ? "border-sky-500 bg-sky-50/20 ring-2 ring-sky-500/10" : "bg-white border-slate-100 hover:border-slate-300"
                        )}
                        onClick={() => {
                          const fid = feat.id;
                          setLocalNodeEdits(prev => ({
                            ...prev,
                            featureIds: prev.featureIds.includes(fid) ? prev.featureIds.filter(id => id !== fid) : [...prev.featureIds, fid]
                          }));
                        }}
                      >
                        <Checkbox checked={localNodeEdits.featureIds.includes(feat.id)} className="rounded-md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate group-hover:text-sky-700 transition-colors">{feat.name}</p>
                          <p className="text-[8px] text-slate-400 font-black uppercase">{feat.carrier}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="media" className="mt-0 space-y-8">
                  <div className="p-10 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 bg-slate-50/50 hover:bg-slate-100 transition-all cursor-pointer relative">
                    <div className={cn("w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md border", isUploading && "animate-pulse")}>
                      {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-slate-400" />}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-800">Dateien per Drag & Drop oder Klick hochladen</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Bilder oder PDF (Max. 5MB)</p>
                    </div>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={isUploading} />
                  </div>

                  {isOcring && (
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl animate-pulse">
                      <BrainCircuit className="w-5 h-5 text-indigo-600" />
                      <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">KI OCR analysiert PDF-Inhalte...</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedNodeMedia.map(file => (
                      <div key={file.id} className="group relative rounded-2xl border bg-white overflow-hidden shadow-sm hover:border-primary/30 transition-all">
                        {file.fileType.startsWith('image/') ? (
                          <img src={file.fileUrl} alt={file.fileName} className="w-full aspect-video object-cover" />
                        ) : (
                          <div className="w-full aspect-video bg-slate-50 flex flex-col items-center justify-center gap-2">
                            <FileText className="w-10 h-10 text-slate-300" />
                            <Badge variant="outline" className="bg-white border-slate-200 text-[8px] font-black">PDF DOCUMENT</Badge>
                          </div>
                        )}
                        <div className="p-3 flex items-center justify-between border-t bg-white">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-800 truncate">{file.fileName}</p>
                            {file.ocrText && <p className="text-[8px] text-emerald-600 font-black uppercase flex items-center gap-1"><Zap className="w-2.5 h-2.5 fill-current" /> OCR Indexiert</p>}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {file.ocrText && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600"><FileSearch className="w-3.5 h-3.5" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[250px] p-2 text-[9px] font-medium leading-relaxed bg-slate-900 border-none rounded-lg text-white">
                                    {file.ocrText.substring(0, 200)}...
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => deleteMediaAction(file.id, file.tenantId, user?.email || 'admin', dataSource).then(() => refreshMedia())}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="details" className="mt-0 space-y-8">
                  <div className="space-y-2"><Label className="text-[10px] font-bold uppercase text-slate-400">Tätigkeitsbeschreibung</Label><Textarea value={localNodeEdits.description} onChange={e => setLocalNodeEdits({...localNodeEdits, description: e.target.value})} className="text-xs min-h-[120px] rounded-xl" /></div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <DialogFooter className="p-4 bg-slate-50 border-t flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setIsStepDialogOpen(false)} className="rounded-xl h-10 px-6 font-bold text-xs">Abbrechen</Button>
            <Button onClick={handleSaveNodeEdits} className="rounded-xl h-10 px-12 bg-primary text-white shadow-lg font-bold text-xs gap-2">
              <Save className="w-4 h-4" /> Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-md rounded-xl p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-900 text-white shrink-0 pr-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-primary shadow-sm border border-white/10">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-headline font-bold uppercase tracking-tight">Prozessaufgabe erstellen</DialogTitle>
                <DialogDescription className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Klärungspunkt oder Maßnahme erfassen</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Bezeichnung</Label>
              <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="h-11 rounded-xl font-bold" placeholder="z.B. IT-Schnittstelle klären..." />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Verantwortlicher</Label>
              <Select value={taskAssigneeId} onValueChange={setTaskAssigneeId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {pUsers?.map(u => <SelectItem key={u.id} value={u.id} className="text-xs font-bold">{u.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t">
            <Button variant="ghost" onClick={() => setIsTaskDialogOpen(false)} className="rounded-xl font-bold text-[10px] uppercase">Abbrechen</Button>
            <Button onClick={handleCreateTask} disabled={isSavingTask || !taskTitle || !taskAssigneeId} className="rounded-xl bg-primary text-white font-bold text-[10px] h-11 px-8 shadow-lg gap-2">
              {isSavingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
