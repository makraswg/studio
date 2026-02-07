# AccessHub - Master Backlog & Strategisches Manifest

**Rolle**: Dieses Dokument ist das zentrale Steuerungs-Instrument für Entwickler und Unternehmensberater. Es kombiniert die funktionale Dokumentation mit einer tiefgreifenden GRC-Audit-Logik.

---

## 🎯 Die Vision: "Governance am Frühstückstisch"
AccessHub soll die erste Compliance-App sein, die **alles in einem Guss** denkt. 
- **Zielgruppe**: Mittelstand (SME).
- **Usability-Benchmark**: "Azubi-tauglich" (Intuitiv, geführt, keine Fachbegriffe ohne Erklärung).
- **Audit-Benchmark**: "Prüfer-fest" (Lückenlose Historie, Revisionssicherheit, klare Verantwortlichkeiten).

---

## 📜 Master-Anweisungen (Audit-Kriterien)
1. **Ganzheitlichkeit**: Module dürfen keine Datensilos sein. Daten aus dem Risikomanagement müssen im IAM sichtbar sein und umgekehrt.
2. **KI-First**: Jedes Formular braucht eine KI-Assistenz für Ausfüllhilfen und Plausibilitätschecks.
3. **Workflow-Zwang**: Aktionen (wie Löschen oder Zuweisen) sind als geführte Prozesse zu verstehen, nicht nur als Tabelleneinträge.
4. **Export-Pflicht**: Jede Ansicht muss einen "Audit-Export" (PDF/Excel) besitzen, der Zeitstempel und Akteure enthält.
5. **Bedien-Einheitlichkeit**: Formulare, Dialoge und Buttons folgen einem strengen Design-System.
6. **Sprach-Präzision**: Keine "Developer-Sprache". Nutze Begriffe, die ein Azubi im ersten Lehrjahr versteht.

---

## 🏗️ Modul-Audit & Roadmap (Step-by-Step)

### 1. Zentrale Steuerung & Analytik (Dashboard)
*Das Nervenzentrum. Hier wird entschieden, was heute wichtig ist.*

*   **Step 1.1: Unified Metrics**
    *   *Code*: `src/app/(dashboard)/dashboard/page.tsx`
    *   *Status*: Implementiert.
    *   *Consultant Audit*: Es sind nur statische Zähler. Ein Azubi weiß nicht, ob "100 Nutzer" gut oder schlecht sind. 
    *   **KRITIK**: Fehlende Trend-Indikatoren (+/- % zum Vormonat) und "Health-Ampeln".
    *   **OPTIMIERUNG**: Metriken müssen Kontext bieten. "10 neue Nutzer seit gestern" ist eine Information, "100 Nutzer gesamt" nur eine Zahl.

*   **Step 1.2: Zertifizierungs-Kampagne**
    *   *Status*: Visueller Fortschritt vorhanden.
    *   *Consultant Audit*: Es fehlt der direkte Workflow-Einstieg. 
    *   **KRITIK**: "68%" sieht schön aus, aber wer hält uns auf? 
    *   **OPTIMIERUNG**: Ein Klick auf den Progress-Bar muss die Liste der "Säumigen Reviewer" öffnen.

*   **Step 1.3: Risiko-Profil (Pie Chart)**
    *   *Status*: Statische Darstellung.
    *   *Consultant Audit*: Keine Drill-Down Funktion. 
    *   **KRITIK**: Silo-Denken. Das Chart ist von den eigentlichen Daten isoliert.
    *   **OPTIMIERUNG**: Klick auf "Hohes Risiko" filtert sofort die Risikoliste (Modulübergreifender Link).

*   **Step 1.4: Smart Governance Insights (KI)**
    *   *Code*: `src/ai/flows/iam-audit-flow.ts`
    *   *Status*: KI-Warnungen vorhanden.
    *   *Consultant Audit*: Zu generisch. 
    *   **KRITIK**: Die KI weiß nicht, was im Jira passiert.
    *   **OPTIMIERUNG**: Verknüpfung mit Jira-Tickets (z.B. "Warnung: 5 offene Leaver-Tickets seit > 3 Tagen"). Proaktive Vorschläge statt nur Warnungen.

### 2. Identity & Access Management (IAM)
*Der Kern der digitalen Identität.*

*   **Step 2.1: Benutzerverzeichnis**
    *   *Code*: `src/app/(dashboard)/users/page.tsx`
    *   *Status*: Tabelle & Cards vorhanden.
    *   *Consultant Audit*: Woher kommen die Daten? (LDAP-Herkunft muss klarer sein).
    *   **NEUE AUFGABE**: "Inkonsistenz-Flag" einführen. Wenn ein Nutzer im AD deaktiviert ist, aber im Hub noch als "Aktiv" steht, muss ein Azubi das sofort sehen.

*   **Step 2.2: Einzelzuweisungen & Quick Assign**
    *   *Code*: `src/app/(dashboard)/assignments/page.tsx`
    *   *Status*: Manuelle Vergabe möglich.
    *   *Consultant Audit*: Ein Azubi könnte kritische Rechte versehentlich vergeben.
    *   **KRITIK**: Fehlende Kopplung zum Risiko-Modul. 
    *   **NEUE AUFGABE**: "Real-time Risk Check". Vor dem Speichern einer Zuweisung prüft das System: "Hat die Rolle 'Admin' im Risikomanagement ein hohes Score?". Falls ja: Warnung anzeigen.

*   **Step 2.3: Access Reviews (Rezertifizierung)**
    *   *Code*: `src/app/(dashboard)/reviews/page.tsx`
    *   *Status*: Workflow vorhanden.
    *   *Consultant Audit*: "Review-Fatigue". Manager klicken alles schnell durch.
    *   **NEUE AUFGABE**: "Smart Pre-Selection". Die KI markiert unkritische Standard-Rechte vorab als "Ok", damit sich der Mensch auf die 5% gefährlichen Ausnahmen konzentriert.

*   **Step 2.4: KI-Access-Advisor**
    *   *Code*: `src/ai/flows/access-advisor-flow.ts`
    *   *Status*: Flow vorhanden.
    *   *Consultant Audit*: Der Advisor ist isoliert.
    *   **NEUE AUFGABE**: "Peer-Analytik". Der Advisor muss sagen können: "Andere Mitarbeiter in der Abteilung 'Marketing' haben dieses Recht nicht - eventuell Überprivilegierung?".

### 3. Risikomanagement & GRC
*Die strategische Absicherung des Unternehmens.*

*   **Step 3.1: Risikoinventar & Szenarien**
    *   *Code*: `src/app/(dashboard)/risks/page.tsx`
    *   *Status*: Implementiert mit Brutto/Netto-Logik.
    *   *Consultant Audit*: Ein Azubi versteht "Eintrittswahrscheinlichkeit 3" nicht.
    *   **KRITIK**: Zu mathematisch, zu wenig deskriptiv. Keine Verbindung zum ProcessHub.
    *   **NEUE AUFGABE**: "Szenario-Translator". Die KI übersetzt Scores in Alltagssprache. Integration eines "Link to Process" Buttons, um zu sehen, in welchem Arbeitsablauf das Risiko schlummert.

*   **Step 3.2: Gefährdungskatalog (BSI/ISO)**
    *   *Code*: `src/app/(dashboard)/risks/catalog/page.tsx`
    *   *Status*: Browser für G-Codes vorhanden.
    *   *Consultant Audit*: Ein Junior weiß nicht, welcher BSI-Code für welches Asset relevant ist.
    *   **KRITIK**: Der Katalog ist ein passives Nachschlagewerk statt ein aktiver Helfer.
    *   **NEUE AUFGABE**: "Smart Derive". Basierend auf dem Asset-Typ (z.B. "SaaS") schlägt das System automatisch die Top-5 Gefährdungen aus dem Katalog vor.

*   **Step 3.3: Maßnahmenplan (TOM)**
    *   *Code*: `src/app/(dashboard)/risks/measures/page.tsx`
    *   *Status*: CRUD für Maßnahmen.
    *   *Consultant Audit*: Ein Wirtschaftsprüfer wird nach Beweisen fragen.
    *   **KRITIK**: "Wirksamkeit: Ja" ist eine unbelegte Behauptung.
    *   **NEUE AUFGABE**: "Evidence-Upload Placeholder". Jede wirksame Maßnahme braucht ein Feld für einen Dateiupload oder einen URL-Link zum Nachweis (Audit-Proofing).

*   **Step 3.4: Heatmap & Reporting**
    *   *Code*: `src/app/(dashboard)/risks/reports/page.tsx`
    *   *Status*: Interaktive Matrix vorhanden.
    *   *Consultant Audit*: Schön anzusehen, aber keine Handlungsempfehlung.
    *   **KRITIK**: Die Matrix zeigt das Elend, aber nicht den Ausweg.
    *   **NEUE AUFGABE**: "Top-3 Mitigation Focus". Automatische Liste der drei Maßnahmen, die den Gesamt-Risk-Score der Firma am effektivsten senken würden.

### 4. ProcessHub (Workflow-Management)
*Das prozessuale Gedächtnis des Unternehmens.*

*   **Step 4.1: Prozessübersicht & Management**
    *   *Code*: `src/app/(dashboard)/processhub/page.tsx`
    *   *Status*: Liste vorhanden.
    *   *Consultant Audit*: Nur eine Liste ohne Kontext.
    *   **KRITIK**: Ein Azubi sieht nicht, welcher Prozess "Compliance-kritisch" ist.
    *   **NEUE AUFGABE**: "Criticality-Badge". Prozesse müssen automatisch als "Kritisch" markiert werden, wenn sie mit High-Risk-Assets oder persönlichen Daten verknüpft sind.

*   **Step 4.2: AI Process Designer (Visual Editor)**
    *   *Code*: `src/app/(dashboard)/processhub/[id]/page.tsx`
    *   *Status*: Iframe-Integration & KI-Chat vorhanden.
    *   *Consultant Audit*: Datensilos bei der Rollenzuweisung.
    *   **KRITIK**: Rollen im Prozess sind aktuell Freitext. Das bricht das Audit.
    *   **NEUE AUFGABE**: "Strict Role Sync". Rollenzuweisungen in Schritten müssen gegen den Stellenplan (Step 6) validiert werden. Die KI muss Rollen vorschlagen, die bereits im IAM existieren.

*   **Step 4.3: Prozesslandkarte (Map)**
    *   *Code*: `src/app/(dashboard)/processhub/map/page.tsx`
    *   *Status*: Vernetzte Ansicht vorhanden.
    *   *Consultant Audit*: Nur visuelles Eye-Candy.
    *   **KRITIK**: Keine Information über "Risiko-Staus" in der Kette.
    *   **NEUE AUFGABE**: "Process Health Overlay". In der Landkarte müssen Prozesse rot leuchten, wenn verknüpfte Risiken überfällig sind oder Maßnahmen nicht greifen.

### 5. Datenschutz & VVT
*Die Einhaltung der Privatsphäre als Prozess.*

*   **Step 5.1: Verarbeitungsverzeichnis (VVT)**
    *   *Code*: `src/app/(dashboard)/gdpr/page.tsx`
    *   *Status*: CRUD für Tätigkeiten implementiert.
    *   *Consultant Audit*: Dokumentation ohne technische Basis ist wertlos.
    *   **KRITIK**: Fehlende harte Kopplung zu den IT-Systemen.
    *   **NEUE AUFGABE**: "System-Dependency-Check". Ein VVT-Eintrag muss zwingend mit Assets aus dem Ressourcenkatalog verknüpft werden. Wenn das System ein hohes Risiko hat, muss das VVT gelb leuchten.

*   **Step 5.2: KI-Formular-Assistent (Datenschutz)**
    *   *Code*: `src/ai/flows/form-assistant-flow.ts`
    *   *Status*: Hilfe beim Ausfüllen vorhanden.
    *   *Consultant Audit*: Fachbegriffe schrecken Azubis ab.
    *   **NEUE AUFGABE**: "Plain Language Mode". Die KI muss Rechtsgrundlagen (Art. 6 etc.) in einfache Sprache übersetzen ("Vertragserfüllung" statt Paragraphen).

*   **Step 5.3: Löschkonzept-Generator**
    *   *Status*: Manuelle Eingabe.
    *   *Consultant Audit*: Das schwierigste Feld für SME.
    *   **NEUE AUFGABE**: "Smart Retention". Basierend auf der Datenkategorie (z.B. "Bewerberdaten") schlägt das System automatisch die gesetzliche Frist (z.B. 6 Monate) vor.

### 6. Konzernstruktur & Stellenplan
*Das organisatorische Fundament der Governance.*

*   **Step 6.1: Mandanten & Abteilungen**
    *   *Code*: `src/app/(dashboard)/settings/structure/page.tsx`
    *   *Status*: Hierarchische Tabellen implementiert.
    *   *Consultant Audit*: Zu trocken. Ein Azubi sieht den Wald vor lauter Bäumen nicht.
    *   **KRITIK**: Fehlende visuelle Hierarchie. Wer gehört zu wem?
    *   **NEUE AUFGABE**: "Visual Org-Chart". Eine Baum-Ansicht der Organisation zur schnellen Navigation.

*   **Step 6.2: Stellenprofile (Job Titles)**
    *   *Status*: CRUD für Stellen.
    *   *Consultant Audit*: Stellen sind aktuell nur Namen ohne Pflichten.
    *   **KRITIK**: Ein Auditor will die "Rollen-Definition" sehen, um SoD-Verstöße auf der Ebene der Stellenbeschreibung zu prüfen.
    *   **NEUE AUFGABE**: "Role Blueprint". Verknüpfung von Stellen mit Standard-Berechtigungen (RBAC-Vorbereitung).

### 7. Ressourcenkatalog & Asset-Inventar
*Das technische Rückgrat der Compliance.*

*   **Step 7.1: Asset-Management**
    *   *Code*: `src/app/(dashboard)/resources/page.tsx`
    *   *Status*: CRUD für Ressourcen implementiert.
    *   *Consultant Audit*: Ein Junior weiß nicht, warum ein System "kritisch" ist.
    *   **KRITIK**: Fehlende Dependency Mapping. 
    *   **NEUE AUFGABE**: "Usage-Explorer". Anzeige im Asset-Formular, in welchen **Prozessen (Step 4)** und welchen **VVT-Einträgen (Step 5)** diese Ressource verwendet wird.

*   **Step 7.2: Schutzbedarfsfeststellung (CIA)**
    *   *Status*: Dropdowns vorhanden.
    *   *Consultant Audit*: Zu technisch für Azubis.
    *   **NEUE AUFGABE**: "CIA Assessment Wizard". Die KI führt den Nutzer durch Fragen ("Was passiert wenn Daten weg sind?") zur richtigen Einstufung von Vertraulichkeit, Integrität und Verfügbarkeit.

*   **Step 7.3: Lifecycle & Archivierung**
    *   *Status*: Archivierung möglich.
    *   *Consultant Audit*: Ein Auditor prüft die Aussonderung von Systemen.
    *   **NEUE AUFGABE**: "Decommissioning Protocol". Ein geführter Workflow zum Abschalten eines Systems inkl. Checkliste (z.B. Backup gemacht? Zugriff gesperrt?).

*   **Step 7.4: Externer Daten-Sync (JSM)**
    *   *Code*: `src/app/actions/jira-actions.ts`
    *   *Status*: Import aus Jira Assets möglich.
    *   *Consultant Audit*: Dubletten-Gefahr.
    *   **NEUE AUFGABE**: "Drift Detection". Das System meldet sich, wenn sich Daten in Jira ändern (z.B. neuer Owner), die im Hub noch alt sind.

### 8. System-Konfiguration & Administration
*Das technische Steuerpult der Plattform.*

*   **Step 8.1: LDAP & Identity Sync**
    *   *Code*: `src/app/(dashboard)/settings/sync/page.tsx`
    *   *Consultant Audit*: LDAP-Settings sind für SMEs oft unlösbar komplex.
    *   **NEUE AUFGABE**: "Connection Wizard". Ein Schritt-für-Schritt Dialog, der die LDAP-Verbindung testet und technische Fehlermeldungen in einfaches Deutsch übersetzt.

*   **Step 8.2: Jira Gateway**
    *   *Code*: `src/app/(dashboard)/settings/integrations/page.tsx`
    *   *Consultant Audit*: Wenn die Jira-Verbindung bricht, merken es die Fachabteilungen zu spät.
    *   **NEUE AUFGABE**: "Integration Health Monitoring". Proaktive Warnung im Dashboard (Step 1), wenn die Jira-API nicht mehr antwortet.

*   **Step 8.3: KI-Governance Konfiguration**
    *   *Code*: `src/app/(dashboard)/settings/ai/page.tsx`
    *   *Consultant Audit*: Die KI-Prompts sind statisch.
    *   **NEUE AUFGABE**: "Company Persona Editor". Ein Feld, in dem der Consultant der KI beibringen kann, wie die Firma tickt (z.B. "Wir sind eine Bank, sei extrem streng beim SoD-Check").

*   **Step 8.4: Daten-Management & Setup**
    *   *Code*: `src/app/(dashboard)/setup/page.tsx`
    *   *Consultant Audit*: Das Setup wirkt aktuell wie ein Prototyp-Tool.
    *   **NEUE AUFGABE**: "SME Onboarding Flow". Eine geführte Tour beim ersten Start, die sicherstellt, dass Mandanten, Abteilungen und erste Ressourcen in der richtigen Reihenfolge angelegt werden.

---
*(Ende der Master-Aufgabenliste - Audit Phase abgeschlossen)*
