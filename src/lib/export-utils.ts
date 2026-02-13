'use client';

import { Process, ProcessVersion, Tenant, JobTitle, ProcessingActivity, Resource, RiskMeasure, Policy, PolicyVersion, Department, Feature, ProcessNode } from './types';

/**
 * Utility-Modul für den Export von Daten (PDF & Excel).
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
  const canvasHeight = 100; // Feste Höhe für die Karte im PDF

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Grafische Prozess-Landkarte', margin, startY + 5);

  // Koordinaten-Normalisierung (Scale & Fit)
  const xValues = nodes.map(n => positions[n.id]?.x || 0);
  const yValues = nodes.map(n => positions[n.id]?.y || 0);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const rangeX = (maxX - minX) || 1;
  const rangeY = (maxY - minY) || 1;
  const scale = Math.min((canvasWidth - 40) / rangeX, (canvasHeight - 20) / rangeY, 0.5);

  const getPdfCoords = (id: string) => {
    const pos = positions[id] || { x: 0, y: 0 };
    return {
      x: margin + 20 + (pos.x - minX) * scale,
      y: startY + 15 + (pos.y - minY) * scale
    };
  };

  // Draw Edges
  doc.setDrawColor(200);
  edges.forEach(edge => {
    const s = getPdfCoords(edge.source);
    const t = getPdfCoords(edge.target);
    doc.line(s.x, s.y, t.x, t.y);
    
    if (edge.label) {
      doc.setFontSize(5);
      doc.setTextColor(100);
      doc.text(edge.label, (s.x + t.x) / 2, (s.y + t.y) / 2, { align: 'center' });
    }
  });

  // Draw Nodes
  nodes.forEach(node => {
    const { x, y } = getPdfCoords(node.id);
    const r = 4; // Node radius

    let color = [240, 240, 240];
    if (node.type === 'start') color = [16, 185, 129];
    if (node.type === 'end') color = [239, 68, 68];
    if (node.type === 'decision') color = [245, 158, 11];
    if (node.type === 'subprocess') color = [79, 70, 229];

    doc.setDrawColor(150);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.circle(x, y, r, 'FD');

    doc.setFontSize(6);
    doc.setTextColor(0);
    doc.text(node.title, x, y + r + 4, { align: 'center', maxWidth: 30 });
  });

  return startY + canvasHeight + 10;
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
    
    // Header
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(tenant.name, 14, 10);
    doc.text('Vertraulich / Audit-Dokument', pageWidth - 14, 10, { align: 'right' });
    doc.setDrawColor(230);
    doc.line(14, 12, pageWidth - 14, 12);

    // Footer
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(`System: ComplianceHub • Export: ${new Date().toLocaleDateString()}`, 14, pageHeight - 10);
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
    const timestamp = new Date().toLocaleString('de-DE');
    const dept = departments.find(d => d.id === process.responsibleDepartmentId);
    const owner = jobTitles.find(j => j.id === process.ownerRoleId);

    // Deckblatt
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(24);
    doc.text('Prozessdokumentation', 14, 25);
    
    doc.setTextColor(0);
    doc.setFontSize(20);
    doc.text(process.title, 14, 60);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Organisation: ${tenant.name}`, 14, 70);
    doc.text(`Status: ${process.status.toUpperCase()} | Version: ${version.version}.0 | Stand: ${timestamp}`, 14, 75);

    // 1. Management Summary
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('1. Übersicht & Metadaten', 14, 95);
    
    autoTable(doc, {
      startY: 100,
      body: [
        ['Zuständige Abteilung', dept?.name || '---'],
        ['Process Owner (Rolle)', owner?.name || '---'],
        ['Automatisierungsgrad', process.automationLevel || 'manuell'],
        ['Frequenz', process.processingFrequency || 'on demand'],
        ['Input (Eingang)', process.inputs || 'Keine Angabe'],
        ['Output (Ergebnis)', process.outputs || 'Keine Angabe'],
        ['Strategische Ziele / KPIs', process.kpis || '---']
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', width: 50, fillColor: [245, 247, 250] } }
    });

    // 2. Visuelle Darstellung
    const graphY = (doc as any).lastAutoTable.finalY + 15;
    await drawProcessGraph(doc, version, graphY);

    // 3. Operative Details (Tabellarisch)
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('2. Operativer Leitfaden & GRC-Bezug', 14, 25);
    
    const stepsData = (version.model_json.nodes || []).map((node) => {
      const role = jobTitles.find(j => j.id === node.roleId);
      const resNames = resources.filter(r => node.resourceIds?.includes(r.id)).map(r => r.name).join(', ');
      const featNames = allFeatures.filter(f => node.featureIds?.includes(f.id)).map(f => f.name).join(', ');
      
      const details = [
        node.description || '',
        node.checklist?.length ? `Checkliste:\n- ${node.checklist.join('\n- ')}` : '',
        node.tips ? `Tipp: ${node.tips}` : '',
        node.errors ? `Achtung: ${node.errors}` : ''
      ].filter(Boolean).join('\n\n');

      const successors = version.model_json.edges
        ?.filter(e => e.source === node.id)
        .map(e => `${e.label ? '['+e.label+'] → ' : '→ '}${version.model_json.nodes.find(n => n.id === e.target)?.title}`)
        .join('\n');

      return [
        { content: node.title, styles: { fontStyle: 'bold' } },
        role?.name || '---',
        `${resNames}${resNames && featNames ? ' | ' : ''}${featNames}` || '---',
        details || '---',
        successors || 'Ende'
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['Arbeitsschritt', 'Verantwortung', 'Systeme / Daten', 'Durchführung & Hinweise', 'Nächste Schritte']],
      body: stepsData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
      columnStyles: { 
        0: { width: 35 }, 
        1: { width: 30 }, 
        2: { width: 35 },
        3: { width: 55 },
        4: { width: 30 }
      }
    });

    addPageDecorations(doc, tenant);
    doc.save(`Prozessbericht_${process.title.replace(/\s+/g, '_')}_V${version.version}.pdf`);
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

    // Deckblatt
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(255);
    doc.setFontSize(36);
    doc.text('Unternehmens-Handbuch', 105, 100, { align: 'center' });
    doc.setFontSize(18);
    doc.text(tenant.name, 105, 115, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(150);
    doc.text(`Gesamtdokumentation der Geschäftsprozesse`, 105, 135, { align: 'center' });
    doc.text(`Stand: ${now} | Umfang: ${processes.length} Prozesse`, 105, 142, { align: 'center' });

    // Inhaltsverzeichnis
    doc.addPage();
    doc.setTextColor(0);
    doc.setFontSize(18);
    doc.text('Inhaltsverzeichnis', 14, 30);
    let tocY = 45;

    processes.forEach((p, idx) => {
      doc.setFontSize(10);
      doc.text(`${idx + 1}. ${p.title}`, 14, tocY);
      doc.text(`..........`, 150, tocY); // Füllpunkte
      tocY += 8;
      if (tocY > 270) { doc.addPage(); tocY = 20; }
    });

    // Prozesse einzeln generieren
    for (const p of processes) {
      const ver = versions.find(v => v.process_id === p.id && v.version === p.currentVersion);
      if (!ver) continue;

      doc.addPage();
      doc.setFontSize(22);
      doc.setTextColor(37, 99, 235);
      doc.text(p.title, 14, 30);
      doc.setDrawColor(230);
      doc.line(14, 35, 196, 35);

      // Header-Tabelle für den Prozess
      autoTable(doc, {
        startY: 40,
        body: [
          ['Abteilung', departments.find(d => d.id === p.responsibleDepartmentId)?.name || '---'],
          ['Owner', jobTitles.find(j => j.id === p.ownerRoleId)?.name || '---'],
          ['Automation', p.automationLevel || '---']
        ],
        theme: 'plain',
        styles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: 'bold', width: 30 } }
      });

      const currentY = (doc as any).lastAutoTable.finalY + 10;
      await drawProcessGraph(doc, ver, currentY);

      autoTable(doc, {
        startY: currentY + 110,
        head: [['Schritt', 'Rolle', 'Tätigkeit', 'Nächster']],
        body: ver.model_json.nodes.map(n => [
          n.title, 
          jobTitles.find(j => j.id === n.roleId)?.name || '-',
          n.description || '-',
          ver.model_json.edges.filter(e => e.source === n.id).map(e => e.label || '→').join(', ')
        ]),
        theme: 'striped',
        styles: { fontSize: 7 }
      });
    }

    addPageDecorations(doc, tenant);
    doc.save(`Prozesshandbuch_${tenant.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
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
      styles: { fontSize: 8 },
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
