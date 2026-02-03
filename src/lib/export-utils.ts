'use client';

/**
 * Utility-Modul für den Export von Daten.
 * Verwendet dynamische Importe, um SSR-Fehler zu vermeiden.
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

export async function exportAssignmentsPdf(
  assignments: any[],
  users: any[],
  entitlements: any[],
  resources: any[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    doc.setFontSize(18);
    doc.text('ComplianceHub - Compliance Bericht: Zuweisungen', 14, 20);
    doc.setFontSize(10);
    doc.text(`Erstellt am: ${timestamp}`, 14, 30);
    doc.text('Mandant: Acme Corp', 14, 35);

    const tableData = assignments.map((a) => {
      const user = users?.find((u) => u.id === a.userId);
      const ent = entitlements?.find((e) => e.id === a.entitlementId);
      const res = resources?.find((r) => r.id === ent?.resourceId);
      return [
        user?.displayName || a.userId,
        `${res?.name || '---'} / ${ent?.name || '---'}`,
        a.status.toUpperCase(),
        a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet',
        a.ticketRef || 'N/A'
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Mitarbeiter', 'System / Rolle', 'Status', 'Gültig bis', 'Ticket']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    doc.save(`Zuweisungen_Bericht_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
  }
}

export async function exportResourcesPdf(resources: any[], entitlements: any[]) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    doc.setFontSize(18);
    doc.text('ComplianceHub - Ressourcenkatalog Bericht', 14, 20);
    doc.setFontSize(10);
    doc.text(`Erstellt am: ${timestamp}`, 14, 30);
    doc.text('Mandant: Acme Corp', 14, 35);

    const tableData = resources.map((r) => {
      const resourceEnts = entitlements?.filter((e) => e.resourceId === r.id) || [];
      return [
        r.name,
        r.type,
        r.criticality.toUpperCase(),
        r.owner,
        resourceEnts.map((e) => e.name).join(', '),
        r.documentationUrl ? 'JA' : 'NEIN'
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['System', 'Typ', 'Kritikalität', 'Besitzer', 'Rollen', 'Doku']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    doc.save(`Ressourcen_Bericht_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
  }
}

export async function exportComplianceReportPdf(
  users: any[],
  resources: any[],
  assignments: any[],
  auditLogs: any[]
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text('ComplianceHub Compliance Statusbericht', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Erstellungsdatum: ${timestamp}`, 14, 35);
    doc.text('Mandant: Acme Corp', 14, 40);
    doc.text('Status: Vertraulich / Intern', 14, 45);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('1. Zusammenfassung der IAM-Umgebung', 14, 60);
    
    const statsData = [
      ['Metrik', 'Wert'],
      ['Gesamtbenutzer', (users?.length || 0).toString()],
      ['Systeme im Katalog', (resources?.length || 0).toString()],
      ['Aktive Zugriffsberechtigungen', (assignments?.filter((a: any) => a.status === 'active').length || 0).toString()],
      ['Review-Fortschritt (Q3)', `${Math.round((assignments?.filter((a: any) => !!a.lastReviewedAt).length / (assignments?.length || 1)) * 100)}%`]
    ];

    autoTable(doc, {
      startY: 65,
      head: [['Metrik', 'Wert']],
      body: statsData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });

    const nextY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('2. Letzte Compliance-relevante Ereignisse', 14, nextY);
    
    const auditData = (auditLogs || []).slice(0, 8).map((log: any) => [
      new Date(log.timestamp).toLocaleString('de-DE'),
      log.actorUid,
      log.action,
      log.entityType
    ]);

    autoTable(doc, {
      startY: nextY + 5,
      head: [['Zeitpunkt', 'Akteur', 'Aktion', 'Entität']],
      body: auditData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    doc.save(`Compliance_Statusbericht_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Compliance Export fehlgeschlagen:', error);
  }
}

/**
 * Erstellt einen detaillierten Zuweisungs-Bericht gruppiert nach Nutzer oder Ressource.
 */
export async function exportFullComplianceReportPdf(
  users: any[],
  resources: any[],
  entitlements: any[],
  assignments: any[],
  mode: 'user' | 'resource'
) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('de-DE');

    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235);
    doc.text('Detaillierter Compliance Zuweisungsbericht', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Struktur: Gruppiert nach ${mode === 'user' ? 'Benutzern' : 'Ressourcen'}`, 14, 35);
    doc.text(`Erstellungsdatum: ${timestamp}`, 14, 40);
    doc.text('Mandant: Acme Corp', 14, 45);

    let startY = 55;

    if (mode === 'user') {
      const activeAssignments = assignments.filter(a => a.status !== 'removed');
      const uniqueUserIds = [...new Set(activeAssignments.map(a => a.userId))];
      
      uniqueUserIds.forEach((uid, index) => {
        const user = users.find(u => u.id === uid);
        const userAssignments = activeAssignments.filter(a => a.userId === uid);
        
        if (startY > 250) { doc.addPage(); startY = 20; }

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${user?.displayName || uid} (${user?.email || 'keine E-Mail'})`, 14, startY);
        startY += 5;

        const tableData = userAssignments.map(a => {
          const ent = entitlements.find(e => e.id === a.entitlementId);
          const res = resources.find(r => r.id === ent?.resourceId);
          return [
            res?.name || 'Unbekanntes System',
            ent?.name || 'Unbekannte Rolle',
            ent?.riskLevel?.toUpperCase() || 'MEDIUM',
            a.status.toUpperCase(),
            a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [['System', 'Rolle', 'Risiko', 'Status', 'Gültigkeit']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 8 },
          margin: { left: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 15;
      });
    } else {
      const activeAssignments = assignments.filter(a => a.status !== 'removed');
      const uniqueResourceIds = [...new Set(resources.map(r => r.id))];

      resources.forEach((res, index) => {
        const resAssignments = activeAssignments.filter(a => {
          const ent = entitlements.find(e => e.id === a.entitlementId);
          return ent?.resourceId === res.id;
        });

        if (resAssignments.length === 0) return;

        if (startY > 250) { doc.addPage(); startY = 20; }

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. System: ${res.name} (Besitzer: ${res.owner})`, 14, startY);
        startY += 5;

        const tableData = resAssignments.map(a => {
          const user = users.find(u => u.id === a.userId);
          const ent = entitlements.find(e => e.id === a.entitlementId);
          return [
            user?.displayName || a.userId,
            user?.email || '-',
            ent?.name || 'Unbekannte Rolle',
            a.status.toUpperCase(),
            a.validUntil ? new Date(a.validUntil).toLocaleDateString() : 'Unbefristet'
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [['Benutzer', 'E-Mail', 'Rolle', 'Status', 'Gültigkeit']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          styles: { fontSize: 8 },
          margin: { left: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 15;
      });
    }

    doc.save(`Compliance_Detailbericht_${mode}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('PDF Export fehlgeschlagen:', error);
  }
}
