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

*   **Step 1.1: Unified Metrics & Trends**
    *   *Status*: Optimiert ✅
    *   *Änderung*: Einführung von Trend-Indikatoren (+/- %) und "Was bedeutet das?" Erklärungen für Azubis.
*   **Step 1.2: Action Center (Der Workflow-Einstieg)**
    *   *Status*: Implementiert ✅
    *   *Logik*: Ersetzt statische Progress-Bars durch eine konkrete To-Do Liste ("Next Best Action"). Klicks führen direkt in die Ziel-Dialoge.
*   **Step 1.3: Risiko-Profil mit Intelligentem Drill-Down**
    *   *Status*: Implementiert ✅
    *   *Consultant Audit*: Klick auf Diagramm-Segmente filtert nun sofort die Listen in den Modulen.

### 2. Identity & Access Management (IAM)
*Wer ist wer und was darf er? Fokus auf Risikobewusstsein.*

*   **Step 2.1: Identitätsverzeichnis & Risk-Awareness**
    *   *Status*: Optimiert ✅
    *   *Änderung*: Benutzerliste zeigt nun "Critical Roles Count". Ein Azubi sieht sofort, wer "gefährliche" Rechte hat.
    *   *Code*: `src/app/(dashboard)/users/page.tsx`
*   **Step 2.2: Geführtes Quick-Assign**
    *   *Status*: Optimiert ✅
    *   *Logik*: Warnung im Dialog bei Auswahl von Admin-Rollen. Strikte Trennung von Standard- und Privilegierten Rechten.
*   **Step 2.3: Revisionssichere Historie**
    *   *Status*: Implementiert ✅
    *   *Audit-Ready*: Vollständiger Lebenslauf der Berechtigungen im Benutzerdetail.

### 3. Risikomanagement & GRC
*Gefahren erkennen, bewerten und bändigen.*

*   **Step 3.1: Risiko-Inventar & Szenario-Analyse**
    *   *Status*: In Prüfung (Audit Phase) 🔍
    *   **NEUE AUFGABE**: Risiken müssen mit Prozessschritten aus Step 4 verknüpft werden. "Was passiert im Prozess, wenn dieses Risiko eintritt?"
    *   **NEUE AUFGABE**: KI-Szenario-Übersetzer implementieren. Score "15" -> "Kritischer Betriebsstopp".
*   **Step 3.2: Maßnahmenplan (TOM) & Wirksamkeit**
    *   *Status*: In Prüfung (Audit Phase) 🔍
    *   **NEUE AUFGABE**: Einführung einer "Nachweispflicht" (Upload oder Link) für erledigte Maßnahmen für den Wirtschaftsprüfer.
    *   **NEUE AUFGABE**: "Audit-Ready" Review-Zyklus. Maßnahmen müssen alle X Monate bestätigt werden.

### 4. ProcessHub & Workflow-Modellierung
*Das Gehirn der Firma. Wie arbeiten wir wirklich?*

*   **Step 4.1: BPMN Designer mit KI-Assistenz**
    *   *Status*: Implementiert.
    *   **NEUE AUFGABE**: Strikte Rollen-Validierung gegen den Stellenplan (Step 6). Kein Freitext bei Verantwortlichkeiten.
*   **Step 4.2: Prozess-Landkarte (Enterprise Map)**
    *   *Status*: Implementiert.
    *   **NEUE AUFGABE**: "Health-Overlay". Landkarte zeigt farblich, wo Compliance-Lücken oder hohe Risiken lauern.

*(Fortsetzung der Audits folgt in den nächsten Schritten...)*
