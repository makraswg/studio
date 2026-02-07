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
1. **Ganzheitlichkeit**: Module dürfen keine Datensilos sein. Daten aus dem Risikomanagement müssen im IAM sichtbar sein und umgekehrt. Jedes Modul muss seine "Nachbarn" kennen.
2. **KI-First & Kontext-Aware**: Jede KI-Funktion MUSS die Unternehmensbeschreibung (Branche, Ziele) und den Organisationsaufbau (Stellenplan) als Kontext nutzen. Die KI agiert als "Inhouse-Consultant".
3. **Workflow-Zwang**: Aktionen (wie Löschen oder Zuweisen) sind als geführte Prozesse zu verstehen, nicht nur als Tabelleneinträge.
4. **Export-Pflicht**: Jede Ansicht muss einen "Audit-Export" (PDF/Excel) besitzen, der Zeitstempel und Akteure enthält.
5. **Bedien-Einheitlichkeit**: Formulare, Dialoge und Buttons folgen einem strengen Design-System.
6. **Sprach-Präzision**: Keine "Developer-Sprache". Nutze Begriffe, die ein Azubi im ersten Lehrjahr versteht.

---

## 🏗️ Modul-Audit & Roadmap (Step-by-Step)

### 1. Zentrale Steuerung & Analytik (Dashboard)
*Das Nervenzentrum. Hier wird entschieden, was heute wichtig ist.*

*   **Step 1.1: Unified Metrics & Trends** (Optimiert ✅)
*   **Step 1.2: Action Center (Der Workflow-Einstieg)** (Implementiert ✅)
*   **Step 1.3: Risiko-Profil mit Intelligentem Drill-Down** (Implementiert ✅)
*   **NEUE AUFGABE**: Global Health-Check Widget implementieren. Zeige den Status aller API-Verbindungen (Jira, KI, LDAP) für den schnellen Check am Morgen.

### 2. Identity & Access Management (IAM)
*Wer ist wer und was darf er? Fokus auf Risikobewusstsein.*

*   **Step 2.1: Identitätsverzeichnis & Risk-Awareness** (Optimiert ✅)
*   **Step 2.2: Geführtes Quick-Assign** (Optimiert ✅)
*   **Step 2.3: Revisionssichere Historie** (Implementiert ✅)
*   **NEUE AUFGABE**: **Interaktive Zuweisungslandkarte**. Ein grafisches Diagramm (Graph-View), das Nutzer und ihre Ressourcen visualisiert. Inklusive Absprung (Drill-down) zur Einzelzuweisung bei Klick auf eine Verbindung.
*   **NEUE AUFGABE**: Privileg-Anomalie-Erkennung. Markiere Nutzer in der Karte, die Rechte besitzen, die absolut untypisch für ihre Abteilung (Stellenplan) sind.

### 3. Risikomanagement & GRC
*Gefahren erkennen, bewerten und bändigen.*

*   **Step 3.1: Risiko-Inventar & Szenario-Analyse** (In Prüfung 🔍)
    *   **AUFGABE**: KI-Szenario-Übersetzer implementieren. Score "15" -> "Kritischer Betriebsstopp für 48h".
    *   **AUFGABE**: Risiken MÜSSEN mit Prozessschritten aus Step 4 verknüpft werden.
*   **Step 3.2: Maßnahmenplan (TOM) & Wirksamkeit** (In Prüfung 🔍)
    *   **AUFGABE**: Einführung einer "Nachweispflicht" (Dokument-Link/Upload) für erledigte Maßnahmen. "Audit-Ready" bedeutet: Kein Haken ohne Beweis.

### 4. ProcessHub & Workflow-Modellierung
*Das Gehirn der Firma. Wie arbeiten wir wirklich?*

*   **Step 4.1: BPMN Designer mit KI-Assistenz** (In Prüfung 🔍)
    *   **AUFGABE**: Strikte Rollen-Validierung gegen den Stellenplan (Step 6). Kein Freitext bei Verantwortlichkeiten!
    *   **AUFGABE**: "Schritt als Kontrollpunkt markieren" -> Verknüpfung zu Risiken (Step 3).
*   **Step 4.2: Prozess-Landkarte (Enterprise Map)** (In Prüfung 🔍)
    *   **AUFGABE**: "Health-Overlay". Landkarte zeigt farblich, wo Compliance-Lücken (offene Risiken) lauern.

### 5. Datenschutz & VVT (Art. 30 DSGVO)
*Rechtssicherheit im Umgang mit Daten.*

*   **Step 5.1: Verarbeitungsverzeichnis** (In Prüfung 🔍)
    *   **AUFGABE**: System-Abhängigkeit zwingend machen (Link zu Step 7). Keine Dokumentation ohne technisches Asset!
    *   **AUFGABE**: KI-Legal-Translator nutzt Firmenkontext, um Zwecke der Verarbeitung vorzuschlagen.

### 6. Organisations-Struktur & Stellenplan
*Das Fundament der Verantwortlichkeit.*

*   **Step 6.1: Stellenplan & Rollen-Blueprints** (In Prüfung 🔍)
    *   **AUFGABE**: RBAC-Blueprint: Stellen direkt mit Standard-Rechten verknüpfen für Auto-Onboarding.
    *   **AUFGABE**: Visualisierung als grafisches Org-Chart (Baumstruktur).

### 7. Ressourcenkatalog & Asset-Inventar
*Die technische Basis.*

*   **Step 7.1: IT-Asset Management** (In Prüfung 🔍)
    *   **AUFGABE**: CIA-Wizard: KI-geführte Schutzbedarfsfeststellung basierend auf dem Firmenprofil.
    *   **AUFGABE**: Usage-Explorer: Zeige alle Prozesse und VVT-Einträge, die dieses System nutzen (**Vernetzzungs-Check**).
    *   **AUFGABE**: Drift-Detection: Warnung, wenn Assets in Jira existieren, aber nicht im Hub.

### 8. System-Konfiguration & Administration
*Technisches Setup.*

*   **Step 8.1: Setup-Wizard & KI-Kontext** (In Prüfung 🔍)
    *   **AUFGABE**: KI-Zentralkonfiguration: Ein Feld für die "Unternehmensbeschreibung", das als System-Prompt für ALLE KI-Funktionen dient.
    *   **AUFGABE**: KI-Config-Assistent übersetzt technische Fehlermeldungen in einfaches Deutsch.
*   **Step 8.2: Dry-Run Preview** (In Prüfung 🔍)
    *   **AUFGABE**: Zeige vor jedem Sync (LDAP/Jira) eine Vorschau der betroffenen Nutzer/Rechte ("Was-wäre-wenn").

---
*Ende der Master-Liste (Stand: Final Strategic Audit incl. Contextual AI & Visual Mapping - V2.1)*