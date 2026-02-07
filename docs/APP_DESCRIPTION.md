# AccessHub - Enterprise Governance & IAM Platform (Technical Description)

**Rolle**: Diese Dokumentation dient als funktionaler und technischer Leitfaden für die AccessHub-Plattform. Sie verknüpft Geschäftsprozesse direkt mit den implementierten Code-Modulen.

---

## 1. Zentrale Steuerung & Analytik (Dashboard)
Das Cockpit für das Management und GRC-Beauftragte.

*   **Step 1.1: Unified Metrics**: Echtzeit-Visualisierung der Benutzeranzahl, aktiven Systeme und kritischen Zuweisungen.
    *   *Code-Referenz*: `src/app/(dashboard)/dashboard/page.tsx`
*   **Step 1.2: Zertifizierungs-Kampagne**: Überwachung des Fortschritts von Rezertifizierungen (z. B. Quartals-Reviews).
    *   *Code-Referenz*: `src/app/(dashboard)/dashboard/page.tsx` (Progress Logic)
*   **Step 1.3: Risiko-Profil**: Grafische Auswertung der Identitäts-Risiken nach Kritikalität (Pie Chart).
    *   *Code-Referenz*: `src/app/(dashboard)/dashboard/page.tsx`
*   **Step 1.4: Smart Governance Insights**: KI-gestützte proaktive Warnungen vor Compliance-Lücken direkt auf der Startseite.
    *   *Code-Referenz*: `src/app/(dashboard)/dashboard/page.tsx`, `src/ai/flows/iam-audit-flow.ts`
*   **Step 1.5: Global Search (Cmd+K)**: Plattformweite Schnellsuche für Identitäten, Ressourcen und Risiken.
    *   *Code-Referenz*: `src/components/layout/command-menu.tsx`, `src/app/(dashboard)/layout.tsx`

## 2. Identity & Access Management (IAM)
Der Kern für die Verwaltung digitaler Identitäten.

*   **Step 2.1: Benutzerverzeichnis**: Zentrale Liste aller Mitarbeiter inklusive Tenant-Zugehörigkeit und Status.
    *   *Code-Referenz*: `src/app/(dashboard)/users/page.tsx`, `src/app/actions/mysql-actions.ts`
*   **Step 2.2: Einzelzuweisungen**: Manuelle Vergabe von Rechten mit Dokumentation von Gültigkeit und Ticket-Referenz.
    *   *Code-Referenz*: `src/app/(dashboard)/assignments/page.tsx`
*   **Step 2.3: Access Reviews**: Workflow-gestützte Prüfung ("Zertifizierung") von bestehenden Berechtigungen durch Vorgesetzte.
    *   *Code-Referenz*: `src/app/(dashboard)/reviews/page.tsx`
*   **Step 2.4: KI-Access-Advisor**: Intelligente Empfehlungs-Engine, die Risikoscores für Benutzerprofile berechnet.
    *   *Code-Referenz*: `src/ai/flows/access-advisor-flow.ts`, `src/app/(dashboard)/reviews/page.tsx`

## 3. Lifecycle Hub & Automatisierung
Effizienzsteigerung durch automatisierte Joiner-Mover-Leaver (JML) Prozesse.

*   **Step 3.1: Onboarding-Wizard**: Schnelle Erfassung neuer Mitarbeiter inklusive Zuweisung vordefinierter Rollenpakete.
    *   *Code-Referenz*: `src/app/(dashboard)/lifecycle/page.tsx`
*   **Step 3.2: Offboarding-Engine**: Revisionssicherer Entzug aller Berechtigungen bei Austritt eines Mitarbeiters.
    *   *Code-Referenz*: `src/app/(dashboard)/lifecycle/page.tsx`
*   **Step 3.3: Berechtigungspakete (Bundles)**: Bündelung mehrerer Systemrollen zu logischen Funktionspaketen.
    *   *Code-Referenz*: `src/app/(dashboard)/lifecycle/page.tsx`
*   **Step 3.4: Zuweisungsgruppen**: Regelbasierte Automatisierung von Rechten basierend auf LDAP-Mapping oder Abteilungen.
    *   *Code-Referenz*: `src/app/(dashboard)/groups/page.tsx`

## 4. Ressourcen- & Assetkatalog
Inventarisierung der IT-Landschaft nach Sicherheitsaspekten.

*   **Step 4.1: System-Registrierung**: Dokumentation von IT-Assets inklusive Kritikalität und CIA-Schutzbedarf.
    *   *Code-Referenz*: `src/app/(dashboard)/resources/page.tsx`
*   **Step 4.2: Rollendefinition (Entitlements)**: Granulare Hinterlegung von Berechtigungsstufen pro System inklusive Risiko-Einstufung.
    *   *Code-Referenz*: `src/app/(dashboard)/resources/page.tsx`
*   **Step 4.3: KI Form Assistant**: Unterstützung bei der Erfassung technischer Details durch Domänen-Wissen der KI.
    *   *Code-Referenz*: `src/components/ai/form-assistant.tsx`, `src/ai/flows/form-assistant-flow.ts`

## 5. Risikomanagement (GRC Core)
Präventive Bedrohungsabwehr nach BSI IT-Grundschutz.

*   **Step 5.1: Risikoinventar**: Erfassung von Bedrohungsszenarien (Brutto- vs. Netto-Risiko).
    *   *Code-Referenz*: `src/app/(dashboard)/risks/page.tsx`
*   **Step 5.2: Interaktive Risiko-Matrix**: Drill-down Heatmap zur Identifikation von Hochrisiko-Clustern.
    *   *Code-Referenz*: `src/app/(dashboard)/risks/reports/page.tsx`
*   **Step 5.3: Gefährdungskatalog**: Bibliothek für standardisierte Bedrohungen (z. B. BSI G-Katalog).
    *   *Code-Referenz*: `src/app/(dashboard)/risks/catalog/page.tsx`
*   **Step 5.4: Maßnahmen & Kontrollen (TOMs)**: Verknüpfung von Risiken mit technischen und organisatorischen Maßnahmen.
    *   *Code-Referenz*: `src/app/(dashboard)/risks/measures/page.tsx`
*   **Step 5.5: Approval Workflows**: Formale Abnahme von Risikobewertungen durch Risk Owner.
    *   *Code-Referenz*: `src/app/(dashboard)/risks/page.tsx` (Approval Dialog)

## 6. ProcessHub (Business Architecture)
Verknüpfung von Governance mit operativen Prozessen.

*   **Step 6.1: Process Designer**: Visueller Modellierer für Geschäftsprozesse (ISO 9001).
    *   *Code-Referenz*: `src/app/(dashboard)/processhub/[id]/page.tsx`
*   **Step 6.2: KI Process Advisor**: Chat-basierter Assistent, der Prozessmodelle generiert.
    *   *Code-Referenz*: `src/ai/flows/process-designer-flow.ts`
*   **Step 6.3: Prozesslandkarte**: Dynamische Visualisierung der Vernetzung aller Prozesse.
    *   *Code-Referenz*: `src/app/(dashboard)/processhub/map/page.tsx`
*   **Step 6.4: Collaborative Comments**: Diskussions-Thread für Teams direkt am Prozessmodell.
    *   *Code-Referenz*: `src/app/(dashboard)/processhub/[id]/page.tsx`

## 7. Integrationen & Ökosystem
Nahtlose Anbindung an die bestehende IT-Infrastruktur.

*   **Step 7.1: Jira Service Management Sync**: Synchronisation von Tickets und Asset Discovery (Insight).
    *   *Code-Referenz*: `src/app/(dashboard)/integrations/jira/page.tsx`, `src/app/actions/jira-actions.ts`
*   **Step 7.2: LDAP/AD Sync**: Automatische Übernahme von Identitäten aus dem Verzeichnisdienst.
    *   *Code-Referenz*: `src/app/actions/sync-actions.ts`, `src/app/(dashboard)/settings/sync/page.tsx`
*   **Step 7.3: BookStack Export**: Dokumentations-Export von Prozessen in das externe Wiki.
    *   *Code-Referenz*: `src/app/actions/bookstack-actions.ts`

## 8. Plattform-Administration
Infrastruktur-Kontrolle und Compliance-Rahmen.

*   **Step 8.1: Multi-Tenancy**: Mandantentrennung und Konfiguration regionaler Compliance-Regeln.
    *   *Code-Referenz*: `src/app/(dashboard)/settings/general/page.tsx`
*   **Step 8.2: User Experience Settings**: Zentrale Steuerung von Animationen und interaktiven Touren.
    *   *Code-Referenz*: `src/app/(dashboard)/settings/ux/page.tsx`
*   **Step 8.3: Data Import Engine**: Massen-Import von BSI-Katalogen und Kreuztabellen.
    *   *Code-Referenz*: `src/app/actions/bsi-import-actions.ts`, `src/app/actions/bsi-cross-table-actions.ts`
*   **Step 8.4: Database Setup**: Initialisierung der MySQL-Tabellen und Migrationen.
    *   *Code-Referenz*: `src/app/(dashboard)/setup/page.tsx`, `src/app/actions/migration-actions.ts`

---
*Dokumentation Stand: Phase 3 Abschluss - Erstellt vom System-Architekten.*
