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
    doc.text('AccessHub - Compliance Bericht: Zuweisungen', 14, 20);
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
    doc.text('AccessHub - Ressourcenkatalog Bericht', 14, 20);
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
        resourceEnts.map((e) => e.name).join(', ')
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['System', 'Typ', 'Kritikalität', 'Besitzer', 'Rollen']],
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
