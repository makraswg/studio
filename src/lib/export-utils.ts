
'use client';

import { Process, ProcessVersion, Tenant, JobTitle, ProcessingActivity, Resource, RiskMeasure, Policy, PolicyVersion, Department, Feature, ProcessNode } from './types';

/**
 * Utility-Modul für den Export von Daten (PDF & Excel).
 * Optimiert für Enterprise-Reporting und GRC-Nachweise.
 */

export async function exportToExcel(data: any[], fileName: string) {
  try {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daten');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error('Excel Export fehlgeschlagen:', error);
  }
}

export async function exportUsersExcel(users: any[], tenants: any[]) {
  const data = users.map(u => ({
    'ID': u.id,
    'Anzeigename': u.displayName,
    'E-Mail': u.email,
    'Abteilung': u.department || '---',
    'Stelle': u.title || '---',
    'Mandant': tenants.find(t => t.id === u.tenantId)?.name || u.tenantId,
    'Status': u.enabled ? 'Aktiv' : 'Inaktiv',
    'Onboarding': u.onboardingDate || '---',
    'Letzter Sync': u.lastSyncedAt ? new Date(u.lastSyncedAt).toLocaleString() : '---'
  }));
  await exportToExcel(data, `Benutzerverzeichnis_${new Date().toISOString().split('T')[0]}`);
}

export async function exportResourcesExcel(resources: any[], tenants: any[]) {
  const data = resources.map(r => ({
    'Name': r.name,
    'Typ': r.assetType,
    'Kategorie': r.category,
    'Betriebsmodell': r.operatingModel,
    'Kritikalität': r.criticality,
    'Mandant': tenants.find(t => t.id === r.tenantId)?.name || r.tenantId,
    'Standort': r.dataLocation || '---',
    'Status': r.status || 'active'
  }));
  await exportToExcel(data, `Ressourcenkatalog_${new Date().toISOString().split('T')[0]}`);
}

export async function exportRisksExcel(risks: any[], resources: any[]) {
  const data = risks.map(r => {
    const asset = resources.find(res => res.id === r.assetId);
    return {
      'Titel': r.title,
      'Kategorie': r.category,
      'Asset': asset?.name || 'Global',
      'Status': r.status,
      'Brutto-Wahrscheinlichkeit': r.probability,
      'Brutto-Schaden': r.impact,
      'Brutto-Score': r.probability * r.impact,
      'Verantwortlich': r.owner,
      'Letzter Review': r.lastReviewDate ? new Date(r.lastReviewDate).toLocaleDateString() : 'Ausstehend'
    };
  });
  await exportToExcel(data, `Risikoinventar_${new Date().toISOString().split('T')[0]}`);
}

export async function exportGdprExcel(activities: any[]) {
  const data = activities.map(a => ({
    'ID': a.id,
    'Name der Tätigkeit': a.name,
    'Version': a.version,
    'Verantwortliche Abteilung': a.responsibleDepartment,
    'Rechtsgrundlage': a.legalBasis,
    'Aufbewahrungsfrist': a.retentionPeriod,
    'Status': a.status,
    'Letzte Prüfung': a.lastReviewDate ? new Date(a.lastReviewDate).toLocaleDateString() : '---'
  }));
  await exportToExcel(data, `Verarbeitungsverzeichnis_VVT_${new Date().toISOString().split('T')[0]}`);
}

/**
 * Zeichnet die Prozess-Visualisierung basierend auf den Designer-Koordinaten.
 */
async function drawProcessGraph(doc: any, version: ProcessVersion, startY: number) {
  const nodes = version.model_json.nodes || [];
  const edges = version.model_json.edges || [];
  const positions = version.layout_json?.positions || {};
  
  if (nodes.length === 0) return startY;

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const canvasWidth = pageWidth - (2 * margin);
  
  const xValues = nodes.map(n => positions[n.id]?.x || 0);
  const yValues = nodes.map(n => positions[n.id]?.y || 0);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  
  // Dynamic scaling to fit width and reduce vertical waste
  const scale = Math.min((canvasWidth - 20) / rangeX, 0.35);
  const actualCanvasHeight = rangeY * scale + 30;

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Visualisierung', margin, startY + 5);

  const getPdfCoords = (id: string) => {
    const pos = positions[id] || { x: 0, y: 0 };
    return {
      x: margin + 10 + (pos.x - minX) * scale,
      y: startY + 15 + (pos.y - minY) * scale
    };
  };

  // Draw Edges
  doc.setDrawColor(180);
  edges.forEach(edge => {
    const s = getPdfCoords(edge.source);
    const t = getPdfCoords(edge.target);
    doc.setLineWidth(0.15);
    doc.line(s.x, s.y, t.x, t.y);
    
    // Simple Arrow Head
    const angle = Math.atan2(t.y - s.y, t.x - s.x);
    doc.line(t.x, t.y, t.x - 1.5 * Math.cos(angle - Math.PI/6), t.y - 1.5 * Math.sin(angle - Math.PI/6));
    doc.line(t.x, t.y, t.x - 1.5 * Math.cos(angle + Math.PI/6), t.y - 1.5 * Math.sin(angle + Math.PI/6));

    if (edge.label) {
      doc.setFontSize(5);
      doc.setTextColor(100);
      const midX = (s.x + t.x) / 2;
      const midY = (s.y + t.y) / 2;
      doc.setFillColor(255);
      doc.rect(midX - 5, midY - 2, 10, 3, 'F');
      doc.text(edge.label, midX, midY, { align: 'center' });
    }
  });

  // Draw Nodes
  nodes.forEach((node, index) => {
    const { x, y } = getPdfCoords(node.id);
    const r = 4;

    let color = [245, 245, 245];
    if (node.type === 'start') color = [16, 185, 129];
    if (node.type === 'end') color = [239, 68, 68];
    if (node.type === 'decision') color = [245, 158, 11];
    if (node.type === 'subprocess') color = [79, 70, 229];

    // Every node with more than 1 successor is a branch point
    const outgoingCount = edges.filter(e => e.source === node.id).length;
    if (outgoingCount > 1) {
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.4);
    } else {
      doc.setDrawColor(100);
      doc.setLineWidth(0.1);
    }

    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(x, y, r, 'FD');

    doc.setFontSize(5);
    doc.setTextColor(node.type === 'subprocess' ? 255 : 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}`, x, y + 1.5, { align: 'center' });

    doc.setFontSize(6);
    doc.setTextColor(50);
    doc.setFont('helvetica', 'normal');
    doc.text(node.title, x, y + r + 4, { align: 'center', maxWidth: 30 });
  });

  return startY + actualCanvasHeight + 10;
}

/**
 * Fügt Header und Footer zu jeder Seite hinzu.
 */
function addPageDecorations(doc: any, tenant: Tenant) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.setFont('helvetica', 'normal');
    doc.text(tenant.name, 14, 8);
    doc.text('ComplianceHub • Vertrauliches Dokument', pageWidth - 14, 8, { align: 'right' });
    
    doc.setDrawColor(240);
    doc.line(14, 10, pageWidth - 14, 10);

    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Generiert: ${new Date().toLocaleDateString()}`, 14, pageHeight - 8);
  }
}

/**
 * Detaillierter Prozessbericht (PDF)
 */
export async function exportDetailedProcessPdf(
  process: Process,
  version: ProcessVersion,
  tenant: Tenant,
  jobTitles: JobTitle[],
  departments: Department[],
  resources: Resource[] = [],
  allFeatures: Feature[] = []
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleDateString('de-DE');
    const dept = departments.find(d => d.id === process.responsibleDepartmentId);
    const owner = jobTitles.find(j => j.id === process.ownerRoleId);

    // GRC Aggregation
    const usedResourceIds = new Set<string>();
    const usedFeatureIds = new Set<string>();
    version.model_json.nodes.forEach(n => {
      n.resourceIds?.forEach(id => usedResourceIds.add(id));
      n.featureIds?.forEach(id => usedFeatureIds.add(id));
    });
    const resourceNames = resources.filter(r => usedResourceIds.has(r.id)).map(r => r.name).join(', ') || '---';
    const featureNames = allFeatures.filter(f => usedFeatureIds.has(f.id)).map(f => f.name).join(', ') || '---';

    // Header Area
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(14, 20, 196, 20);
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(process.title, 14, 32);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Organisation: ${tenant.name} | Dokumenten-Status: ${process.status.toUpperCase()}`, 14, 38);

    // 1. Summary
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Management Summary', 14, 52);
    
    const summaryRows = [
      ['Verantwortlich', owner?.name || '---'],
      ['Zuständige Abteilung', dept?.name || '---'],
      ['Freigabestatus', `Freigegeben am ${timestamp} durch ${owner?.name || 'System'}`],
      ['VVT Referenz (Art. 30)', process.vvtId ? `Zweck-ID: ${process.vvtId}` : '---'],
      ['IT-Infrastruktur', resourceNames],
      ['Verarbeitete Daten', featureNames],
      ['Eingang (ISO 9001)', process.inputs || '---'],
      ['Ausgang (ISO 9001)', process.outputs || '---']
    ];

    autoTable(doc, {
      startY: 55,
      body: summaryRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
      columnStyles: { 0: { fontStyle: 'bold', width: 50, fillColor: [250, 250, 250] } }
    });

    // 2. Visualization
    const graphY = (doc as any).lastAutoTable.finalY + 10;
    const tableY = await drawProcessGraph(doc, version, graphY);

    // 3. Leitfaden
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Operativer Leitfaden', 14, tableY + 5);
    
    const stepsData = (version.model_json.nodes || []).map((node, index) => {
      const role = jobTitles.find(j => j.id === node.roleId);
      const nodeRes = resources.filter(r => node.resourceIds?.includes(r.id)).map(r => r.name).join(', ');
      
      const executionInfo = [
        node.description || '',
        node.checklist?.length ? `Checkliste:\n- ${node.checklist.join('\n- ')}` : '',
        node.tips ? `EXPERTENTIPP: ${node.tips}` : '',
        node.errors ? `ACHTUNG: ${node.errors}` : ''
      ].filter(Boolean).join('\n\n');

      const successors = version.model_json.edges
        ?.filter(e => e.source === node.id)
        .map(e => {
          const targetNode = version.model_json.nodes.find(n => n.id === e.target);
          const targetIndex = version.model_json.nodes.findIndex(n => n.id === e.target) + 1;
          const label = e.label ? `[${e.label}] ` : '';
          return `${label}→ (${targetIndex}) ${targetNode?.title}`;
        })
        .join('\n');

      return [
        { content: `${index + 1}. ${node.title}`, styles: { fontStyle: 'bold' } },
        role?.name || '---',
        nodeRes || '---',
        { content: executionInfo || '---', styles: { overflow: 'linebreak' } },
        { content: successors || 'Ende', styles: { overflow: 'linebreak' } }
      ];
    });

    autoTable(doc, {
      startY: tableY + 10,
      head: [['Nr / Schritt', 'Zuständigkeit', 'Systeme', 'Durchführung & Hilfen', 'Folge-Schritte']],
      body: stepsData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak', font: 'helvetica' },
      columnStyles: { 
        0: { width: 35 }, 
        1: { width: 25 }, 
        2: { width: 25 },
        3: { width: 70 },
        4: { width: 35 }
      }
    });

    addPageDecorations(doc, tenant);
    doc.save(`Prozessbericht_${process.title.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
  }
}

/**
 * Handbuch Export: Generiert Berichte für mehrere Prozesse
 */
export async function exportProcessManualPdf(
  processes: Process[],
  versions: ProcessVersion[],
  tenant: Tenant,
  departments: Department[],
  jobTitles: JobTitle[],
  resources: Resource[] = [],
  allFeatures: Feature[] = []
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('de-DE');

    // --- DECKBLATT (Druckfreundlich Hell) ---
    doc.setTextColor(30, 41, 59);
    
    // Logo / Icon centered at top
    doc.setDrawColor(220);
    doc.setFillColor(245, 245, 245);
    doc.circle(105, 50, 15, 'FD');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'bold');
    doc.text('GRC', 105, 51, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('Prozess-Handbuch', 105, 90, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(tenant.name, 105, 105, { align: 'center' });
    
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(70, 115, 140, 115);

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Zentrale Prozessdokumentation | Stand: ${now}`, 105, 130, { align: 'center' });
    doc.text(`Gesamtumfang: ${processes.length} Prozesse`, 105, 136, { align: 'center' });

    // --- PAGE MAPPING LOOP ---
    const processPages: Record<string, number> = {};
    const groupedProcesses: Record<string, Process[]> = {};
    
    processes.forEach(p => {
      const deptName = departments.find(d => d.id === p.responsibleDepartmentId)?.name || 'Zentrale Organisation';
      if (!groupedProcesses[deptName]) groupedProcesses[deptName] = [];
      groupedProcesses[deptName].push(p);
    });

    // We leave page 2 for TOC
    doc.addPage(); 

    for (const deptName of Object.keys(groupedProcesses).sort()) {
      for (const p of groupedProcesses[deptName]) {
        const ver = versions.find(v => v.process_id === p.id && v.version === p.currentVersion);
        if (!ver) continue;

        doc.addPage();
        const pageIdx = (doc as any).internal.getNumberOfPages();
        processPages[p.id] = pageIdx;
        
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(p.title, 14, 25);
        
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Organisationseinheit: ${deptName}`, 14, 30);
        doc.line(14, 33, 196, 33);

        const usedResourceIds = new Set<string>();
        const usedFeatureIds = new Set<string>();
        ver.model_json.nodes.forEach(n => {
          n.resourceIds?.forEach(id => usedResourceIds.add(id));
          n.featureIds?.forEach(id => usedFeatureIds.add(id));
        });
        const resNames = resources.filter(r => usedResourceIds.has(r.id)).map(r => r.name).join(', ') || '---';
        const featNames = allFeatures.filter(f => usedFeatureIds.has(f.id)).map(f => f.name).join(', ') || '---';

        autoTable(doc, {
          startY: 38,
          body: [
            ['Verantwortlich', jobTitles.find(j => j.id === p.ownerRoleId)?.name || '---'],
            ['Freigabestatus', `Freigegeben am ${now} durch ${jobTitles.find(j => j.id === p.ownerRoleId)?.name || 'Revision'}`],
            ['VVT Referenz', p.vvtId ? `Zweck-ID: ${p.vvtId}` : '---'],
            ['IT-Infrastruktur', resNames],
            ['Verarbeitete Daten', featNames],
            ['Eingang (ISO)', p.inputs || '---'],
            ['Ausgang (ISO)', p.outputs || '---']
          ],
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, font: 'helvetica' },
          columnStyles: { 0: { fontStyle: 'bold', width: 45, fillColor: [250, 250, 250] } }
        });

        const graphY = (doc as any).lastAutoTable.finalY + 8;
        const tableY = await drawProcessGraph(doc, ver, graphY);

        autoTable(doc, {
          startY: tableY + 5,
          head: [['Nr', 'Arbeitsschritt', 'Zuständigkeit', 'Durchführung / Hilfen', 'Folge-Schritte']],
          body: ver.model_json.nodes.map((n, i) => {
            const successors = ver.model_json.edges
              .filter(e => e.source === n.id)
              .map(e => {
                const targetNode = ver.model_json.nodes.find(node => node.id === e.target);
                const targetIdx = ver.model_json.nodes.findIndex(node => node.id === e.target) + 1;
                const label = e.label ? `[${e.label}] ` : '';
                
                let pageRef = '';
                if (targetNode?.type === 'subprocess' && targetNode.targetProcessId) {
                  const tp = processPages[targetNode.targetProcessId];
                  if (tp) pageRef = ` (S. ${tp})`;
                }
                
                return `${label}→ (${targetIdx}) ${targetNode?.title}${pageRef}`;
              }).join('\n');

            const details = [
              n.description, 
              n.checklist?.length ? `Checkliste:\n- ${n.checklist.join('\n- ')}` : '',
              n.tips ? `TIPP: ${n.tips}` : ''
            ].filter(Boolean).join('\n\n');

            return [
              `${i + 1}`,
              { content: n.title, styles: { fontStyle: 'bold' } }, 
              jobTitles.find(j => j.id === n.roleId)?.name || '-',
              { content: details || '-', styles: { overflow: 'linebreak' } },
              { content: successors || 'Ende', styles: { overflow: 'linebreak' } }
            ];
          }),
          theme: 'striped',
          styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak', font: 'helvetica' },
          columnStyles: { 0: { width: 8 }, 1: { width: 35 }, 3: { width: 70 }, 4: { width: 35 } }
        });
      }
    }

    // --- RENDER TOC ON PAGE 2 (AFTER CONTENT MAPPING) ---
    doc.setPage(2);
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Inhaltsverzeichnis', 14, 30);
    
    let tocY = 45;
    for (const deptName of Object.keys(groupedProcesses).sort()) {
      doc.setFontSize(10);
      doc.setTextColor(30);
      doc.setFont('helvetica', 'bold');
      doc.text(deptName.toUpperCase(), 14, tocY);
      doc.setDrawColor(37, 99, 235);
      doc.line(14, tocY + 1, 30, tocY + 1);
      tocY += 8;
      
      groupedProcesses[deptName].forEach(p => {
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.setFont('helvetica', 'normal');
        
        const label = `   ${p.title}`;
        const pageNum = processPages[p.id]?.toString() || '?';
        
        doc.text(label, 14, tocY);
        
        // Dot Leader Logic
        const titleWidth = doc.getTextWidth(label);
        const pageNumWidth = doc.getTextWidth(pageNum);
        const dotStart = 14 + titleWidth + 2;
        const dotEnd = 196 - pageNumWidth - 2;
        
        if (dotEnd > dotStart) {
          doc.setDrawColor(200);
          doc.setLineDashPattern([0.5, 1.5], 0);
          doc.line(dotStart, tocY - 1, dotEnd, tocY - 1);
          doc.setLineDashPattern([], 0); // Reset
        }

        doc.text(pageNum, 196, tocY, { align: 'right' });
        tocY += 6;

        if (tocY > 270) {
          doc.addPage();
          tocY = 20;
        }
      });
      tocY += 4;
    }

    addPageDecorations(doc, tenant);
    doc.save(`Handbuch_${tenant.name.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Handbuch Export fehlgeschlagen:', error);
  }
}

/**
 * Richtlinien-Export als PDF.
 */
export async function exportPolicyPdf(policy: Policy, version: PolicyVersion, tenantName: string) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleDateString('de-DE');

    doc.setFontSize(22);
    doc.setTextColor(5, 150, 105); 
    doc.text(policy.title, 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Organisation: ${tenantName} | Stand: ${timestamp} | V${version.version}.${version.revision}`, 14, 35);
    
    doc.setDrawColor(230);
    doc.line(14, 40, 196, 40);

    autoTable(doc, {
      startY: 45,
      body: [
        ['Typ', policy.type],
        ['Status', policy.status.toUpperCase()],
        ['Änderungsgrund', version.changelog || 'Keine Angabe']
      ],
      theme: 'grid',
      styles: { fontSize: 8, font: 'helvetica' },
      columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
    });

    const contentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.setTextColor(0);
    const splitContent = doc.splitTextToSize(version.content.replace(/<[^>]*>?/gm, ''), 180);
    doc.text(splitContent, 14, contentY);

    doc.save(`Richtlinie_${policy.title.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Policy PDF Export failed:', error);
  }
}

export async function exportPolicyDocx(policy: Policy, version: PolicyVersion) {
  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${policy.title}</title></head>
    <body style="font-family: Arial, sans-serif;">
      <h1 style="color: #059669;">${policy.title}</h1>
      <p><strong>Version:</strong> ${version.version}.${version.revision}</p>
      <p><strong>Status:</strong> ${policy.status}</p>
      <hr/>
      <div style="white-space: pre-wrap;">
        ${version.content.replace(/<[^>]*>?/gm, '')}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Richtlinie_${policy.title.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
