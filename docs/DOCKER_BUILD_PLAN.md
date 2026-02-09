
# Docker Build Stabilisierungs-Plan (V1.0)

Dieses Dokument beschreibt die notwendigen Schritte, um den Produktions-Build (`next build`) innerhalb der Docker-Umgebung wieder lauffähig zu machen.

## 🎯 Status Quo
Der Build bricht aktuell beim Prerendering statischer Seiten ab. Next.js 15 ist im Produktionsmodus extrem strikt bei der Prüfung von Variablen und JSX-Strukturen.

## 🛠️ Identifizierte Problemfelder

### 1. ReferenceErrors (Icons & Komponenten)
- **Problem**: Lucide Icons wie `Save` kollidieren mit Funktionsnamen (`handleSave`) oder werden unter falschem Namen referenziert.
- **Lösung**: Alle `Save`-Icons werden konsequent als `SaveIcon` importiert und genutzt. Fehlende Imports für `Switch` werden ergänzt.

### 2. JSX Parsing Errors
- **Problem**: Nicht geschlossene Tags (z.B. `</SelectContent>`) in komplexen Ansichten wie `/processhub/view/[id]`.
- **Lösung**: Vollständige Validierung der JSX-Struktur und Ergänzung fehlender Abschluss-Tags.

### 3. Hydration Mismatches
- **Problem**: `Select` und `Switch` Komponenten verursachen Warnungen, wenn sie auf dem Server anders initialisiert werden als auf dem Client.
- **Lösung**: Nutzung von `isMounted` Checks für kritische UI-Elemente.

## 📋 Checkliste für zukünftige Änderungen
- [ ] Icons immer mit Alias importieren: `import { Save as SaveIcon } from 'lucide-react'`
- [ ] Prüfen, ob alle Shadcn-Komponenten im File-Header importiert sind.
- [ ] Keine doppelten Imports aus der gleichen Bibliothek.
- [ ] `next build` lokal testen, bevor das Docker-Image gebaut wird.
