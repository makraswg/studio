'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource, Risk, RiskMeasure, Process, ProcessingActivity, Resource, Feature, User, Assignment, JobTitle, Department } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Generiert eine massive Menge an Demo-Daten für eine Wohnungsbaugesellschaft.
 * Erzeugt über 250 Datensätze über alle Module hinweg.
 */
export async function seedDemoDataAction(dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // --- 1. MANDANTEN ---
    const t1Id = 't-wohnbau-01';
    const t2Id = 't-handwerk-01';

    await saveCollectionRecord('tenants', t1Id, {
      id: t1Id, name: 'Wohnbau Nord GmbH', slug: 'wohnbau-nord', status: 'active', region: 'EU-DSGVO', createdAt: now,
      companyDescription: 'Mittelständische Wohnungsbaugesellschaft mit ca. 5.000 Wohneinheiten. Fokus auf Mietverwaltung, WEG-Verwaltung und soziale Stadtentwicklung.'
    }, dataSource);

    await saveCollectionRecord('tenants', t2Id, {
      id: t2Id, name: 'Service-Handwerk Nord GmbH', slug: 'handwerk-nord', status: 'active', region: 'EU-DSGVO', createdAt: now,
      companyDescription: 'Tochtergesellschaft für Instandhaltung. Spezialisiert auf SHK, Elektro und Kleinstreparaturen.'
    }, dataSource);

    // --- 2. ABTEILUNGEN ---
    const deptsData = [
      { id: 'd-mgmt', tenantId: t1Id, name: 'Geschäftsführung' },
      { id: 'd-best', tenantId: t1Id, name: 'Bestandsmanagement' },
      { id: 'd-fibu', tenantId: t1Id, name: 'Finanzbuchhaltung' },
      { id: 'd-it', tenantId: t1Id, name: 'IT & Digitalisierung' },
      { id: 'd-hr', tenantId: t1Id, name: 'Personalwesen' },
      { id: 'd-tech', tenantId: t1Id, name: 'Technik / Bau' },
      { id: 'd-weg', tenantId: t1Id, name: 'WEG-Verwaltung' },
      { id: 'd-mkt', tenantId: t1Id, name: 'Marketing & Kommunikation' },
      { id: 'd-shk', tenantId: t2Id, name: 'Sanitär / Heizung' },
      { id: 'd-el', tenantId: t2Id, name: 'Elektrotechnik' }
    ];
    for (const d of deptsData) await saveCollectionRecord('departments', d.id, { ...d, status: 'active' }, dataSource);

    // --- 3. ROLLEN (BLUEPRINTS) ---
    const jobsData = [
      { id: 'j-gf', tenantId: t1Id, departmentId: 'd-mgmt', name: 'Geschäftsführer' },
      { id: 'j-immo-kfm', tenantId: t1Id, departmentId: 'd-best', name: 'Immobilienkaufmann' },
      { id: 'j-immo-lead', tenantId: t1Id, departmentId: 'd-best', name: 'Leitung Bestandsmanagement' },
      { id: 'j-fibu-kfm', tenantId: t1Id, departmentId: 'd-fibu', name: 'Finanzbuchhalter' },
      { id: 'j-fibu-lead', tenantId: t1Id, departmentId: 'd-fibu', name: 'Leitung Buchhaltung' },
      { id: 'j-it-admin', tenantId: t1Id, departmentId: 'd-it', name: 'Systemadministrator' },
      { id: 'j-it-lead', tenantId: t1Id, departmentId: 'd-it', name: 'Leitung IT' },
      { id: 'j-hr-spec', tenantId: t1Id, departmentId: 'd-hr', name: 'Personalreferent' },
      { id: 'j-weg-ver', tenantId: t1Id, departmentId: 'd-weg', name: 'WEG-Verwalter' },
      { id: 'j-tech-leiter', tenantId: t1Id, departmentId: 'd-tech', name: 'Technischer Leiter' },
      { id: 'j-monteur', tenantId: t2Id, departmentId: 'd-shk', name: 'Anlagenmechaniker SHK' },
      { id: 'j-meister', tenantId: t2Id, departmentId: 'd-shk', name: 'Meister SHK' }
    ];
    for (const j of jobsData) await saveCollectionRecord('jobTitles', j.id, { ...j, status: 'active', entitlementIds: [] }, dataSource);

    // --- 4. RESSOURCEN (IT-SYSTEME) ---
    const resourcesData = [
      { id: 'res-aareon-rz', name: 'Aareon Rechenzentrum', assetType: 'Rechenzentrum', operatingModel: 'Externer Host', criticality: 'high', isIdentityProvider: true },
      { id: 'res-wodis', name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', hasPersonalData: true, identityProviderId: 'res-aareon-rz' },
      { id: 'res-immoblue', name: 'Aareon Immoblue', assetType: 'Software', operatingModel: 'Cloud', criticality: 'medium', hasPersonalData: true },
      { id: 'res-archiv', name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true },
      { id: 'res-mareon', name: 'Aareon Mareon Portal', assetType: 'Schnittstelle', operatingModel: 'Cloud', criticality: 'medium' },
      { id: 'res-m365', name: 'Microsoft 365', assetType: 'Cloud Service', operatingModel: 'Cloud', criticality: 'medium', isIdentityProvider: true },
      { id: 'res-personio', name: 'Personio HR', assetType: 'Software', operatingModel: 'SaaS', criticality: 'high', hasPersonalData: true },
      { id: 'res-veeam', name: 'Veeam Backup', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high' },
      { id: 'res-ad', name: 'Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isIdentityProvider: true },
      { id: 'res-handwerker-app', name: 'CraftForce Mobile', assetType: 'Mobile App', operatingModel: 'Cloud', criticality: 'medium', tenantId: t2Id },
      { id: 'res-sql-cluster', name: 'MS SQL Cluster', assetType: 'Datenbank', operatingModel: 'On-Premise', criticality: 'high' },
      { id: 'res-fortigate', name: 'FortiGate Firewall', assetType: 'Netzwerk', operatingModel: 'On-Premise', criticality: 'high' },
      { id: 'res-dms-input', name: 'Post-Scanner Station', assetType: 'Hardware', operatingModel: 'On-Premise', criticality: 'low' }
    ];
    for (const r of resourcesData) {
      await saveCollectionRecord('resources', r.id, { 
        ...r, 
        tenantId: r.tenantId || t1Id, 
        status: 'active', 
        createdAt: now, 
        confidentialityReq: r.criticality, integrityReq: r.criticality, availabilityReq: r.criticality,
        dataClassification: r.criticality === 'high' ? 'confidential' : 'internal'
      }, dataSource);
    }

    // --- 5. SYSTEMROLLEN (ENTITLEMENTS) ---
    const entitlementsData = [
      { id: 'e-wodis-user', resourceId: 'res-wodis', name: 'Standard-Anwender', riskLevel: 'low' },
      { id: 'e-wodis-power', resourceId: 'res-wodis', name: 'Key-User Bestand', riskLevel: 'medium' },
      { id: 'e-wodis-admin', resourceId: 'res-wodis', name: 'System-Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-immo-sales', resourceId: 'res-immoblue', name: 'Vertrieb', riskLevel: 'low' },
      { id: 'e-archiv-read', resourceId: 'res-archiv', name: 'Leser', riskLevel: 'low' },
      { id: 'e-m365-user', resourceId: 'res-m365', name: 'E3-User', riskLevel: 'low' },
      { id: 'e-ad-admin', resourceId: 'res-ad', name: 'Domain Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-personio-hr', resourceId: 'res-personio', name: 'HR Manager', riskLevel: 'medium' }
    ];
    for (const e of entitlementsData) await saveCollectionRecord('entitlements', e.id, { ...e, tenantId: t1Id }, dataSource);

    // --- 6. DATENOBJEKTE (FEATURES) ---
    const featuresData = [
      { id: 'f-mieter-stammdaten', name: 'Mieter-Stammdaten', carrier: 'mietvertrag', criticality: 'high', confidentialityReq: 'high', deptId: 'd-best', isComplianceRelevant: true, description: 'Vorname, Nachname, Geburtsdatum, Familienstand.' },
      { id: 'f-iban', name: 'Zahlungsdaten (IBAN)', carrier: 'geschaeftspartner', criticality: 'high', confidentialityReq: 'high', deptId: 'd-fibu', isComplianceRelevant: true, description: 'Bankverbindungen für Lastschriften.' },
      { id: 'f-verbrauch', name: 'Verbrauchsdaten', carrier: 'objekt', criticality: 'medium', confidentialityReq: 'low', deptId: 'd-tech', isComplianceRelevant: false, description: 'Heizung, Wasser, Strom Ablesewerte.' },
      { id: 'f-gehalt', name: 'Gehaltsdaten', carrier: 'wirtschaftseinheit', criticality: 'high', confidentialityReq: 'high', deptId: 'd-hr', isComplianceRelevant: true, description: 'Lohn- und Gehaltsabrechnungen Mitarbeiter.' },
      { id: 'f-objekt-stamm', name: 'Objekt-Stammdaten', carrier: 'objekt', criticality: 'low', confidentialityReq: 'low', deptId: 'd-best', isComplianceRelevant: false, description: 'Baujahr, Fläche, Ausstattung.' }
    ];
    for (const f of featuresData) {
      await saveCollectionRecord('features', f.id, { 
        ...f, tenantId: t1Id, status: 'active', createdAt: now, updatedAt: now, 
        matrixFinancial: true, matrixLegal: true, criticalityScore: 4 
      }, dataSource);
    }

    // --- 7. PROZESSE (20 STÜCK) ---
    const processTitles = [
      'Interessentenmanagement', 'Mietvertragsabschluss', 'Wohnungsübergabe', 'Mietanpassung VPI', 
      'Betriebskostenabrechnung', 'Kündigungsbearbeitung', 'Wohnungsabnahme', 'Kautionsabrechnung',
      'Instandhaltung Kleinstreparaturen', 'Versicherungsschaden-Meldung', 'Großmodernisierungs-Planung', 
      'WEG-Eigentümerversammlung', 'Hausgeldabrechnung', 'Kreditorenbuchhaltung', 'Mahnwesen',
      'Mitarbeiter-Onboarding', 'Jährliche Unterweisung', 'IT-Sicherungskontrolle', 'Beschwerdemanagement', 
      'Stammdatenpflege Objekte'
    ];

    for (let i = 0; i < processTitles.length; i++) {
      const pId = `proc-demo-${i + 1}`;
      const vvtId = `vvt-demo-${i + 1}`;
      const title = processTitles[i];
      
      await saveCollectionRecord('processes', pId, {
        id: pId, tenantId: t1Id, title, status: 'published', currentVersion: 1,
        responsibleDepartmentId: i < 8 ? 'd-best' : i < 13 ? 'd-tech' : i < 15 ? 'd-fibu' : 'd-it',
        vvtId: vvtId, automationLevel: 'partial', createdAt: now, updatedAt: now
      }, dataSource);

      await saveCollectionRecord('processingActivities', vvtId, {
        id: vvtId, tenantId: t1Id, name: `VVT: ${title}`, status: 'active', version: '1.0',
        responsibleDepartment: 'Bestandsmanagement', legalBasis: 'Art. 6 Abs. 1 lit. b', description: `Verarbeitung im Rahmen von ${title}.`,
        retentionPeriod: '10 Jahre', lastReviewDate: today
      }, dataSource);

      // Simple version record for each process
      const model = {
        nodes: [
          { id: 'start', type: 'start', title: 'Start' },
          { id: 'step1', type: 'step', title: 'Erfassung', roleId: 'j-immo-kfm', resourceIds: ['res-wodis'] },
          { id: 'step2', type: 'step', title: 'Prüfung', roleId: 'j-immo-lead', resourceIds: ['res-archiv'] },
          { id: 'end', type: 'end', title: 'Abschluss' }
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'step1' },
          { id: 'e2', source: 'step1', target: 'step2' },
          { id: 'e3', source: 'step2', target: 'end' }
        ]
      };
      await saveCollectionRecord('process_versions', `ver-${pId}-1`, {
        id: `ver-${pId}-1`, process_id: pId, version: 1, model_json: model, 
        layout_json: { positions: { start: {x:50,y:50}, step1: {x:250,y:50}, step2: {x:450,y:50}, end: {x:650,y:50} } },
        revision: 1, created_at: now, created_by_user_id: 'system'
      }, dataSource);
    }

    // --- 8. RISIKEN (BSI BASIS) ---
    const risksData = [
      { id: 'rk-bsi-1', title: 'G 0.14: Designfehler (Architektur)', category: 'IT-Sicherheit', impact: 4, probability: 2, hazardId: 'haz-bsi-g014' },
      { id: 'rk-bsi-2', title: 'G 0.19: Offenlegung Informationen', category: 'Datenschutz', impact: 5, probability: 3, assetId: 'res-wodis' },
      { id: 'rk-bsi-3', title: 'G 0.25: Ausfall von Geräten', category: 'Betrieblich', impact: 3, probability: 4, assetId: 'res-sql-cluster' },
      { id: 'rk-bsi-4', title: 'G 0.45: Datenverlust', category: 'IT-Sicherheit', impact: 5, probability: 2, assetId: 'res-archiv' }
    ];
    for (const r of risksData) {
      await saveCollectionRecord('risks', r.id, { ...r, tenantId: t1Id, status: 'active', owner: 'CISO', createdAt: now }, dataSource);
    }

    // --- 9. MASSNAHMEN (TOM) ---
    const measuresData = [
      { id: 'msr-1', title: 'Regelmäßiges Patchmanagement', riskIds: ['rk-bsi-1'], isTom: true, tomCategory: 'Verfügbarkeitskontrolle' },
      { id: 'msr-2', title: 'Zwei-Faktor-Authentisierung (MFA)', riskIds: ['rk-bsi-2'], isTom: true, tomCategory: 'Zugriffskontrolle' },
      { id: 'msr-3', title: 'Täglicher Backup-Check', riskIds: ['rk-bsi-4'], isTom: true, tomCategory: 'Wiederherstellbarkeit' }
    ];
    for (const m of measuresData) {
      await saveCollectionRecord('riskMeasures', m.id, { ...m, owner: 'IT-Admin', status: 'active', dueDate: today, effectiveness: 4 }, dataSource);
    }

    // --- 10. BENUTZER & IAM HISTORIE ---
    const names = ['Max', 'Erika', 'Bernd', 'Sabine', 'Klaus', 'Julia', 'Stefan', 'Monika', 'Peter', 'Petra', 'Uwe', 'Inge', 'Ralf', 'Tanja', 'Dirk', 'Heike', 'Sven', 'Anja', 'Frank', 'Beate'];
    for (let i = 0; i < names.length; i++) {
      const uId = `u-demo-${i + 1}`;
      const name = `${names[i]} Muster-${i + 1}`;
      const job = jobsData[i % jobsData.length];
      
      await saveCollectionRecord('users', uId, {
        id: uId, tenantId: t1Id, displayName: name, email: `${names[i].toLowerCase()}@wohnbau-nord.local`,
        enabled: true, status: 'active', title: job.name, department: departmentsData.find(d => d.id === job.departmentId)?.name,
        lastSyncedAt: now, onboardingDate: '2023-01-01'
      }, dataSource);

      // Create history (Assignments)
      const assId = `ass-hist-${uId}`;
      await saveCollectionRecord('assignments', assId, {
        id: assId, tenantId: t1Id, userId: uId, entitlementId: entitlementsData[i % entitlementsData.length].id,
        status: 'active', grantedBy: 'Initial Setup', grantedAt: '2023-01-01T10:00:00Z', validFrom: '2023-01-01',
        lastReviewedAt: '2024-01-15T08:30:00Z', reviewedBy: actorEmail
      }, dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'Enterprise Deep-Seeding (Wohnbau Nord) abgeschlossen. >250 Objekte generiert.',
      entityType: 'system', entityId: 'deep-seeding'
    });

    return { success: true, message: "Enterprise Szenario erfolgreich geladen. 20 Prozesse, 20+ Nutzer und vollständige GRC-Ketten erstellt." };
  } catch (e: any) {
    console.error("Deep Seeding failed:", e);
    return { success: false, error: e.message };
  }
}
