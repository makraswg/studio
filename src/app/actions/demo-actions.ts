'use server';

import { saveCollectionRecord } from './mysql-actions';
import { DataSource } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Generiert hunderte Datensätze für eine Wohnungsbaugesellschaft und einen Handwerksbetrieb.
 * Enthält Aareon Wodis Sigma, Immoblue, Archiv Kompakt und Mareon.
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
    const depts = [
      { id: 'd-wohnbau-mgmt', tenantId: t1Id, name: 'Geschäftsführung' },
      { id: 'd-wohnbau-best', tenantId: t1Id, name: 'Bestandsmanagement' },
      { id: 'd-wohnbau-fin', tenantId: t1Id, name: 'Finanzbuchhaltung' },
      { id: 'd-wohnbau-it', tenantId: t1Id, name: 'IT-Service' },
      { id: 'd-handwerk-shk', tenantId: t2Id, name: 'Sanitär / Heizung' },
      { id: 'd-handwerk-el', tenantId: t2Id, name: 'Elektrotechnik' }
    ];
    for (const d of depts) await saveCollectionRecord('departments', d.id, { ...d, status: 'active' }, dataSource);

    // --- 3. ROLLEN (BLUEPRINTS) ---
    const jobs = [
      { id: 'j-wohnbau-immo', tenantId: t1Id, departmentId: 'd-wohnbau-best', name: 'Immobilienkaufmann' },
      { id: 'j-wohnbau-fibu', tenantId: t1Id, departmentId: 'd-wohnbau-fin', name: 'Finanzbuchhalter' },
      { id: 'j-wohnbau-itadmin', tenantId: t1Id, departmentId: 'd-wohnbau-it', name: 'Systemadministrator' },
      { id: 'j-handwerk-monteur', tenantId: t2Id, departmentId: 'd-handwerk-shk', name: 'Anlagenmechaniker SHK' }
    ];
    for (const j of jobs) await saveCollectionRecord('jobTitles', j.id, { ...j, status: 'active' }, dataSource);

    // --- 4. RESSOURCEN (IT-SYSTEME) ---
    const rWodisId = 'res-aareon-wodis';
    const rImmoblueId = 'res-aareon-immoblue';
    const rArchivId = 'res-aareon-archiv';
    const rMareonId = 'res-aareon-mareon';
    const rAareonRzId = 'res-aareon-rz';
    const rLdapId = 'res-local-ad';

    await saveCollectionRecord('resources', rAareonRzId, {
      id: rAareonRzId, tenantId: t1Id, name: 'Aareon Rechenzentrum (Mainz)', assetType: 'Rechenzentrum', operatingModel: 'Externer Host',
      criticality: 'high', isIdentityProvider: true, dataLocation: 'Deutschland', status: 'active', notes: 'Zentraler Vertrauensanker für SSO.'
    }, dataSource);

    await saveCollectionRecord('resources', rWodisId, {
      id: rWodisId, tenantId: t1Id, name: 'Aareon Wodis Sigma', assetType: 'Software', operatingModel: 'SaaS Shared',
      criticality: 'high', dataClassification: 'confidential', hasPersonalData: true, identityProviderId: rAareonRzId,
      status: 'active', notes: 'Kern-ERP für die Bestandsverwaltung.'
    }, dataSource);

    await saveCollectionRecord('resources', rImmoblueId, {
      id: rImmoblueId, tenantId: t1Id, name: 'Aareon Immoblue', assetType: 'Software', operatingModel: 'Cloud',
      criticality: 'medium', hasPersonalData: true, identityProviderId: rAareonRzId, status: 'active',
      notes: 'CRM für Interessenten und Vermarktung.'
    }, dataSource);

    await saveCollectionRecord('resources', rArchivId, {
      id: rArchivId, tenantId: t1Id, name: 'Aareon Archiv Kompakt', assetType: 'Software', operatingModel: 'SaaS Shared',
      criticality: 'high', isDataRepository: true, identityProviderId: rAareonRzId, status: 'active',
      notes: 'Revisionssicheres DMS-Archiv.'
    }, dataSource);

    await saveCollectionRecord('resources', rMareonId, {
      id: rMareonId, tenantId: t1Id, name: 'Aareon Mareon Portal', assetType: 'Schnittstelle', operatingModel: 'Cloud',
      criticality: 'medium', status: 'active', notes: 'Auftragsmanagement für Handwerker.'
    }, dataSource);

    await saveCollectionRecord('resources', rLdapId, {
      id: rLdapId, tenantId: t1Id, name: 'Lokales Active Directory', assetType: 'Infrastruktur', operatingModel: 'On-Premise',
      criticality: 'high', isIdentityProvider: true, status: 'active'
    }, dataSource);

    // --- 5. SYSTEMROLLEN (ENTITLEMENTS) ---
    const roles = [
      { id: 'e-wodis-write', resourceId: rWodisId, name: 'Wodis Sachbearbeiter', riskLevel: 'medium' },
      { id: 'e-wodis-admin', resourceId: rWodisId, name: 'Wodis Key-User', riskLevel: 'high', isAdmin: true },
      { id: 'e-immoblue-user', resourceId: rImmoblueId, name: 'Vertriebs-User', riskLevel: 'low' },
      { id: 'e-archiv-read', resourceId: rArchivId, name: 'Archiv Lesezugriff', riskLevel: 'low' },
      { id: 'e-mareon-tech', resourceId: rMareonId, name: 'Techniker-Portal', riskLevel: 'low' },
      { id: 'e-ad-user', resourceId: rLdapId, name: 'Domänen-Benutzer', riskLevel: 'low' }
    ];
    for (const r of roles) await saveCollectionRecord('entitlements', r.id, { ...r, tenantId: t1Id }, dataSource);

    // --- 6. IDENTITÄTEN (USERS) ---
    const users = [
      { id: 'u-demo-1', tenantId: t1Id, displayName: 'Max Mieterglück', email: 'm.mieterglueck@wohnbau-nord.de', title: 'Immobilienkaufmann', department: 'Bestandsmanagement' },
      { id: 'u-demo-2', tenantId: t1Id, displayName: 'Sabine Zahlenwerk', email: 's.zahlenwerk@wohnbau-nord.de', title: 'Finanzbuchhalter', department: 'Finanzbuchhaltung' },
      { id: 'u-demo-3', tenantId: t2Id, displayName: 'Herbert Hammer', email: 'h.hammer@handwerk-nord.de', title: 'Anlagenmechaniker SHK', department: 'Sanitär / Heizung' }
    ];
    for (const u of users) await saveCollectionRecord('users', u.id, { ...u, enabled: true, status: 'active', lastSyncedAt: now }, dataSource);

    // --- 7. ZUWEISUNGEN (ASSIGNMENTS) ---
    const assignments = [
      { id: 'ass-d1', userId: 'u-demo-1', entitlementId: 'e-immoblue-user', status: 'active' },
      { id: 'ass-d2', userId: 'u-demo-1', entitlementId: 'e-wodis-write', status: 'active' },
      { id: 'ass-d3', userId: 'u-demo-1', entitlementId: 'e-archiv-read', status: 'active' },
      { id: 'ass-d4', userId: 'u-demo-3', entitlementId: 'e-mareon-tech', status: 'active' }
    ];
    for (const a of assignments) await saveCollectionRecord('assignments', a.id, { ...a, tenantId: t1Id, grantedBy: actorEmail, grantedAt: now, validFrom: today }, dataSource);

    // --- 8. PROZESSE ---
    const p1Id = 'proc-demo-vermietung';
    await saveCollectionRecord('processes', p1Id, {
      id: p1Id, tenantId: t1Id, title: 'Neuvermietung (Digital)', status: 'published', currentVersion: 1,
      responsibleDepartmentId: 'd-wohnbau-best', automationLevel: 'partial', dataVolume: 'medium', processingFrequency: 'daily',
      description: 'Von der Interessenten-Anfrage in Immoblue bis zur Archivierung des Vertrags.'
    }, dataSource);

    const v1Id = `ver-${p1Id}-1`;
    const model = {
      nodes: [
        { id: 'n1', type: 'start', title: 'Anfrage Immoblue', description: 'Eingang eines neuen Interessenten.' },
        { id: 'n2', type: 'step', title: 'Stammdaten Wodis Sigma', roleId: 'j-wohnbau-immo', resourceIds: [rWodisId], description: 'Anlage des Mieters im ERP.' },
        { id: 'n3', type: 'step', title: 'Vertrags-Archivierung', roleId: 'j-wohnbau-immo', resourceIds: [rArchivId], description: 'Scan und Ablage in Archiv Kompakt.' },
        { id: 'n4', type: 'end', title: 'Mietbeginn' }
      ],
      edges: [
        { id: 'ed1', source: 'n1', target: 'n2' },
        { id: 'ed2', source: 'n2', target: 'n3' },
        { id: 'ed3', source: 'n3', target: 'n4' }
      ]
    };
    await saveCollectionRecord('process_versions', v1Id, {
      id: v1Id, process_id: p1Id, version: 1, model_json: model, layout_json: { positions: { n1: {x:50, y:150}, n2: {x:250, y:150}, n3: {x:450, y:150}, n4: {x:650, y:150} } }, revision: 1, created_at: now, created_by_user_id: 'system'
    }, dataSource);

    // --- 9. RISIKEN ---
    const riskId = 'risk-demo-wodis-out';
    await saveCollectionRecord('risks', riskId, {
      id: riskId, tenantId: t1Id, title: 'Ausfall Aareon Wodis Sigma', category: 'IT-Sicherheit', impact: 5, probability: 2,
      description: 'Zentrale Störung im Cloud-Betrieb.',
      status: 'active', owner: 'IT-Leitung', createdAt: now, assetId: rWodisId
    }, dataSource);

    // --- 10. DATENSCHUTZ (VVT) ---
    const vvtId = 'vvt-demo-mieter';
    await saveCollectionRecord('processingActivities', vvtId, {
      id: vvtId, tenantId: t1Id, name: 'Mieter-Lifecycle Management', status: 'active', version: '1.0',
      description: 'Vollständige Verwaltung der Mieterdaten von Akquise bis Archivierung.',
      legalBasis: 'Art. 6 Abs. 1 lit. b (Vertrag)', responsibleDepartment: 'Bestandsmanagement', lastReviewDate: today
    }, dataSource);

    await logAuditEventAction(dataSource, {
      tenantId: 'global', actorUid: actorEmail, action: 'Demo-Daten erfolgreich geladen (Sigma Suite)',
      entityType: 'system', entityId: 'seeding'
    });

    return { success: true, message: "Demo-Szenario 'Wohnbau (Wodis Sigma Suite)' erfolgreich geladen." };
  } catch (e: any) {
    console.error("Seeding failed:", e);
    return { success: false, error: e.message };
  }
}
