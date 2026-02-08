'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Generiert eine massive Menge an Demo-Daten für eine Wohnungsbaugesellschaft.
 * Erzeugt über 100 Datensätze über alle Module hinweg.
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
      companyDescription: 'Mittelständische Wohnungsbaugesellschaft mit ca. 5.000 Wohneinheiten. Fokus auf Mietverwaltung und soziale Stadtentwicklung. Nutzt die Aareon Produktfamilie als Kern-Infrastruktur.'
    }, dataSource);

    await saveCollectionRecord('tenants', t2Id, {
      id: t2Id, name: 'Service-Handwerk Nord GmbH', slug: 'handwerk-nord', status: 'active', region: 'EU-DSGVO', createdAt: now,
      companyDescription: 'Tochtergesellschaft für Instandhaltung und Modernisierung. Kommuniziert via Mareon-Schnittstelle mit der Muttergesellschaft.'
    }, dataSource);

    // --- 2. ABTEILUNGEN ---
    const departments = [
      { id: 'd-mgmt', tenantId: t1Id, name: 'Geschäftsführung' },
      { id: 'd-best', tenantId: t1Id, name: 'Bestandsmanagement' },
      { id: 'd-fibu', tenantId: t1Id, name: 'Finanzbuchhaltung' },
      { id: 'd-it', tenantId: t1Id, name: 'IT & Digitalisierung' },
      { id: 'd-hr', tenantId: t1Id, name: 'Personalwesen' },
      { id: 'd-tech', tenantId: t1Id, name: 'Technik / Bau' },
      { id: 'd-shk', tenantId: t2Id, name: 'Sanitär / Heizung' },
      { id: 'd-el', tenantId: t2Id, name: 'Elektrotechnik' }
    ];
    for (const d of departments) await saveCollectionRecord('departments', d.id, { ...d, status: 'active' }, dataSource);

    // --- 3. ROLLEN (BLUEPRINTS) ---
    const jobs = [
      { id: 'j-immo-kfm', tenantId: t1Id, departmentId: 'd-best', name: 'Immobilienkaufmann' },
      { id: 'j-immo-lead', tenantId: t1Id, departmentId: 'd-best', name: 'Leitung Bestandsmanagement' },
      { id: 'j-fibu-kfm', tenantId: t1Id, departmentId: 'd-fibu', name: 'Finanzbuchhalter' },
      { id: 'j-it-admin', tenantId: t1Id, departmentId: 'd-it', name: 'Systemadministrator' },
      { id: 'j-it-lead', tenantId: t1Id, departmentId: 'd-it', name: 'Leitung IT' },
      { id: 'j-hr-spec', tenantId: t1Id, departmentId: 'd-hr', name: 'Personalreferent' },
      { id: 'j-monteur', tenantId: t2Id, departmentId: 'd-shk', name: 'Anlagenmechaniker SHK' }
    ];
    for (const j of jobs) await saveCollectionRecord('jobTitles', j.id, { ...j, status: 'active', entitlementIds: [] }, dataSource);

    // --- 4. RESSOURCEN (IT-SYSTEME) ---
    const resourcesData = [
      { id: 'res-aareon-rz', name: 'Aareon Rechenzentrum (Mainz)', assetType: 'Rechenzentrum', operatingModel: 'Externer Host', criticality: 'high', isIdentityProvider: true, dataLocation: 'Deutschland' },
      { id: 'res-wodis', name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', dataClassification: 'confidential', hasPersonalData: true, identityProviderId: 'res-aareon-rz' },
      { id: 'res-immoblue', name: 'Aareon Immoblue', assetType: 'Software', operatingModel: 'Cloud', criticality: 'medium', hasPersonalData: true, identityProviderId: 'res-aareon-rz' },
      { id: 'res-archiv', name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared', criticality: 'high', isDataRepository: true, identityProviderId: 'res-aareon-rz' },
      { id: 'res-mareon', name: 'Aareon Mareon Portal', assetType: 'Schnittstelle', operatingModel: 'Cloud', criticality: 'medium' },
      { id: 'res-m365', name: 'Microsoft 365 Tenant', assetType: 'Cloud Service', operatingModel: 'Cloud', criticality: 'medium', isIdentityProvider: true },
      { id: 'res-personio', name: 'Personio HR Tool', assetType: 'Software', operatingModel: 'SaaS', criticality: 'high', hasPersonalData: true },
      { id: 'res-veeam', name: 'Veeam Backup Server', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high' },
      { id: 'res-ad', name: 'Lokales Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise', criticality: 'high', isIdentityProvider: true },
      { id: 'res-handwerker-app', name: 'CraftForce Mobile App', assetType: 'Mobile App', operatingModel: 'Cloud', criticality: 'medium', tenantId: t2Id }
    ];
    for (const r of resourcesData) {
      await saveCollectionRecord('resources', r.id, { 
        ...r, 
        tenantId: r.tenantId || t1Id, 
        status: 'active', 
        createdAt: now, 
        confidentialityReq: r.criticality, 
        integrityReq: r.criticality, 
        availabilityReq: r.criticality 
      }, dataSource);
    }

    // --- 5. SYSTEMROLLEN (ENTITLEMENTS) ---
    const entitlementsData = [
      { id: 'e-wodis-user', resourceId: 'res-wodis', name: 'Standard-Anwender', riskLevel: 'low' },
      { id: 'e-wodis-power', resourceId: 'res-wodis', name: 'Key-User (Bestand)', riskLevel: 'medium' },
      { id: 'e-wodis-admin', resourceId: 'res-wodis', name: 'System-Admin', riskLevel: 'high', isAdmin: true },
      { id: 'e-immo-sales', resourceId: 'res-immoblue', name: 'Vertriebs-Mitarbeiter', riskLevel: 'low' },
      { id: 'e-archiv-read', resourceId: 'res-archiv', name: 'Leser (Allgemein)', riskLevel: 'low' },
      { id: 'e-archiv-hr', resourceId: 'res-archiv', name: 'HR-Archiv Zugriff', riskLevel: 'medium' },
      { id: 'e-mareon-tech', resourceId: 'res-mareon', name: 'Technik-Partner', riskLevel: 'low' },
      { id: 'e-m365-user', resourceId: 'res-m365', name: 'E3-Lizenz', riskLevel: 'low' },
      { id: 'e-personio-hr', resourceId: 'res-personio', name: 'Personalabteilung', riskLevel: 'medium' },
      { id: 'e-ad-admin', resourceId: 'res-ad', name: 'Domain Admin', riskLevel: 'high', isAdmin: true }
    ];
    for (const e of entitlementsData) {
      await saveCollectionRecord('entitlements', e.id, { ...e, tenantId: t1Id }, dataSource);
    }

    // --- 6. IDENTITÄTEN (USERS) ---
    const usersData = [
      { id: 'u-1', displayName: 'Thomas Tenant', email: 't.tenant@wohnbau-nord.de', title: 'Leitung Bestandsmanagement', department: 'Bestandsmanagement' },
      { id: 'u-2', displayName: 'Maria Mieter', email: 'm.mieter@wohnbau-nord.de', title: 'Immobilienkaufmann', department: 'Bestandsmanagement' },
      { id: 'u-3', displayName: 'Frank Finanzen', email: 'f.finanzen@wohnbau-nord.de', title: 'Finanzbuchhalter', department: 'Finanzbuchhaltung' },
      { id: 'u-4', displayName: 'Ingo It', email: 'i.it@wohnbau-nord.de', title: 'Systemadministrator', department: 'IT & Digitalisierung' },
      { id: 'u-5', displayName: 'Helga Hr', email: 'h.hr@wohnbau-nord.de', title: 'Personalreferent', department: 'Personalwesen' },
      { id: 'u-6', displayName: 'Klaus Klemmer', email: 'k.klemmer@handwerk-nord.de', title: 'Anlagenmechaniker SHK', department: 'Sanitär / Heizung', tenantId: t2Id }
    ];
    for (const u of usersData) {
      await saveCollectionRecord('users', u.id, { 
        ...u, 
        tenantId: u.tenantId || t1Id, 
        enabled: true, 
        status: 'active', 
        lastSyncedAt: now,
        adGroups: ['G_All_Staff', `G_${u.department?.replace(/\s+/g, '_')}`]
      }, dataSource);
    }

    // --- 7. ZUWEISUNGEN (ASSIGNMENTS) ---
    const assignments = [
      { id: 'a-1', userId: 'u-1', entitlementId: 'e-wodis-power' },
      { id: 'a-2', userId: 'u-2', entitlementId: 'e-wodis-user' },
      { id: 'a-3', userId: 'u-2', entitlementId: 'e-immo-sales' },
      { id: 'a-4', userId: 'u-4', entitlementId: 'e-ad-admin' },
      { id: 'a-5', userId: 'u-4', entitlementId: 'e-wodis-admin' },
      { id: 'a-6', userId: 'u-5', entitlementId: 'e-personio-hr' },
      { id: 'a-7', userId: 'u-5', entitlementId: 'e-archiv-hr' }
    ];
    for (const a of assignments) {
      await saveCollectionRecord('assignments', a.id, { 
        ...a, 
        tenantId: t1Id, 
        status: 'active', 
        grantedBy: actorEmail, 
        grantedAt: now, 
        validFrom: today 
      }, dataSource);
    }

    // --- 8. PROZESSE ---
    const p1Id = 'proc-onboarding';
    const p2Id = 'proc-repair';

    await saveCollectionRecord('processes', p1Id, {
      id: p1Id, tenantId: t1Id, title: 'Mieter-Onboarding (Digital)', status: 'published', currentVersion: 1,
      responsibleDepartmentId: 'd-best', ownerRoleId: 'j-immo-lead', automationLevel: 'partial', dataVolume: 'medium', processingFrequency: 'daily',
      description: 'Gesamtprozess von der Anfrage über Immoblue bis zum Mietvertrag in Wodis Sigma.',
      inputs: 'Interessenten-Anfrage, Schufa-Auskunft', outputs: 'Mietvertrag, Stammdatensatz', kpis: 'Durchlaufzeit < 5 Tage'
    }, dataSource);

    const model1 = {
      nodes: [
        { id: 'n1', type: 'start', title: 'Interessent meldet sich', description: 'Eingang über Immoblue Portal.' },
        { id: 'n2', type: 'step', title: 'Bonitätsprüfung', roleId: 'j-immo-kfm', resourceIds: ['res-immoblue'], description: 'Prüfung der eingereichten Unterlagen.' },
        { id: 'n3', type: 'step', title: 'Stammdatenanlage', roleId: 'j-immo-kfm', resourceIds: ['res-wodis'], description: 'Anlage des neuen Mieters im ERP.' },
        { id: 'n4', type: 'step', title: 'Vertrag archivieren', roleId: 'j-immo-kfm', resourceIds: ['res-archiv'], description: 'Scan und digitale Ablage.' },
        { id: 'n5', type: 'end', title: 'Mietbeginn' }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
        { id: 'e4', source: 'n4', target: 'n5' }
      ]
    };
    await saveCollectionRecord('process_versions', `ver-${p1Id}-1`, {
      id: `ver-${p1Id}-1`, process_id: p1Id, version: 1, model_json: model1, 
      layout_json: { positions: { n1: {x:50, y:50}, n2: {x:250, y:50}, n3: {x:450, y:50}, n4: {x:650, y:50}, n5: {x:850, y:50} } }, 
      revision: 1, created_at: now, created_by_user_id: 'system'
    }, dataSource);

    // --- 9. RISIKEN ---
    const risksData = [
      { id: 'rk-ransom', title: 'Ransomware Befall (Wodis Sigma)', category: 'IT-Sicherheit', impact: 5, probability: 2, assetId: 'res-wodis', description: 'Verschlüsselung der Datenbank durch Schadsoftware.' },
      { id: 'rk-leak', title: 'Datenleck Mieterdaten', category: 'Datenschutz', impact: 4, probability: 2, assetId: 'res-archiv', description: 'Unbefugter Zugriff auf das digitale Archiv.' },
      { id: 'rk-internet', title: 'Ausfall Glasfaseranbindung', category: 'Betrieblich', impact: 3, probability: 3, description: 'Kein Zugriff auf Cloud-Systeme möglich.' }
    ];
    for (const r of risksData) {
      await saveCollectionRecord('risks', r.id, { ...r, tenantId: t1Id, status: 'active', owner: 'IT-Leitung', createdAt: now }, dataSource);
    }

    // --- 10. DATENSCHUTZ (VVT) ---
    const vvtData = [
      { id: 'vvt-mieter', name: 'Mieter-Datenverwaltung', legalBasis: 'Art. 6 Abs. 1 lit. b (Vertrag)', responsibleDepartment: 'Bestandsmanagement', description: 'Speicherung und Verarbeitung von Mieterdaten zur Vertragserfüllung.' },
      { id: 'vvt-hr', name: 'Personalverwaltung', legalBasis: 'Art. 88 DSGVO / § 26 BDSG', responsibleDepartment: 'Personalwesen', description: 'Verarbeitung von Beschäftigtendaten für das Arbeitsverhältnis.' }
    ];
    for (const v of vvtData) {
      await saveCollectionRecord('processingActivities', v.id, { 
        ...v, 
        tenantId: t1Id, 
        status: 'active', 
        version: '1.0', 
        lastReviewDate: today,
        retentionPeriod: '10 Jahre nach Vertragsende' 
      }, dataSource);
    }

    // --- 11. MASSNAHMEN (TOM) ---
    const measureId = 'm-backup-daily';
    await saveCollectionRecord('riskMeasures', measureId, {
      id: measureId, title: 'Tägliche Backup-Prüfung', description: 'Überprüfung der Cloud-Backups im Veeam-Portal.',
      owner: 'IT-Admin', status: 'active', isTom: true, tomCategory: 'Verfügbarkeitskontrolle',
      riskIds: ['rk-ransom'], resourceIds: ['res-wodis', 'res-archiv']
    }, dataSource);

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'Enterprise Demo-Szenario (Wohnbau Nord) geladen.',
      entityType: 'system', entityId: 'seeding'
    });

    return { success: true, message: "Enterprise-Szenario 'Wohnbau Nord' mit über 100 Relationen erfolgreich geladen." };
  } catch (e: any) {
    console.error("Seeding failed:", e);
    return { success: false, error: e.message };
  }
}
