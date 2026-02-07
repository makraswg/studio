# ComplianceHub Design System & UI Guide (V1.0)

Dieses Dokument beschreibt die visuellen und funktionalen Standards des ComplianceHub. Alle zukünftigen Module müssen diesen Richtlinien folgen, um eine konsistente Enterprise-UX zu gewährleisten.

---

## 1. Visuelle Identität

### 🎨 Farbpalette
- **Primary**: `hsl(198 76% 52%)` - Vibrant Blue (#29ABE2). Einsatz für Navigation, Primäraktionen und System-Icons.
- **Accent**: `hsl(36 100% 50%)` - Warm Orange (#FF9800). Einsatz für Risikomanagement, Warnungen und Hervorhebungen.
- **Success**: Emerald Green für positive Audits und Zertifizierungen.
- **Destructive**: Red für Löschvorgänge und kritische Fehler.
- **Background**: Light Gray (#F5F5F5) / Dark Slate für den Dark Mode.

### ✍️ Typografie
- **Headlines**: *Space Grotesk*. Fett, moderner Tracking-Abstand. Keine erzwungene Großschreibung (`uppercase` vermeiden).
- **Body/Data**: *Inter*. Fokus auf Lesbarkeit bei hohen Datenmengen.
- **Mono**: Für technische IDs und Mapping-Werte.

---

## 2. UI Komponenten & Patterns

### 🧊 Formen & Radien
- **Enterprise Radius**: Standardmäßig `rounded-xl` (12px) für Cards und Dialoge. `rounded-md` für Buttons und Inputs.
- **Glassmorphism**: Subtile Unschärfe-Effekte (`backdrop-blur`) im Header und in Overlays.

### 🛡️ Dialog-Standards (Popups)
- **Header**: Icon auf der linken Seite in einer farbigen Kachel (`bg-primary/10`).
- **Abstände**: `pr-8` im Header, um Kollisionen mit dem Schließen-Button zu verhindern.
- **Footer**: Abgegrenzt durch `bg-slate-50`, Primäraktion rechts, Abbrechen links.

### 🔍 Filter & Suche (Compact Filtering)
- **Kompaktheit**: Filterelemente (Suche, Tabs, Toggles) MÜSSEN in einer einzigen, horizontalen Zeile zusammengefasst werden. 
- **Layout**: Flex-Container mit `gap-3` und `p-2` bis `p-4`, um vertikalen Platz zu sparen und eine moderne "Toolbar"-Optik zu erzeugen.

---

## 3. Generative KI Integration

### 🧠 Symbolik
- Das **BrainCircuit**-Icon ist das exklusive Symbol für alle KI-Funktionen.
- Einsatzstellen:
  - KI Identity Audit
  - KI Access Advisor (Reviews)
  - KI Prozess-Designer
  - KI Formular-Assistent

### 💬 Interaktions-Design
- KI-Vorschläge werden in blau hinterlegten Boxen (`bg-blue-50`) präsentiert.
- Übernahme-Buttons müssen klar als solche gekennzeichnet sein ("KI-Vorschlag übernehmen").

---

## 4. Governance & Berechtigungen

### 🗑️ Löschen vs. Archivieren
- **Admin**: Kann Daten archivieren (`status: 'archived'`). Der Datensatz bleibt in der Datenbank erhalten.
- **Super-Admin**: Sieht zusätzlich den Button "Permanent löschen".
- **Sicherheitsabfrage**: Jede permanente Löschung erfordert eine Bestätigung via `AlertDialog` mit explizitem Hinweis auf Unwiderruflichkeit.

---
*Stand: Februar 2024 - Design Reform Phase 4*
