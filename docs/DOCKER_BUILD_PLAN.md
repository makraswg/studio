
# Docker Build Stabilisierungs-Plan (V1.5)

Dieses Dokument beschreibt die notwendigen Schritte, um den Produktions-Build (`next build`) innerhalb der Docker-Umgebung dauerhaft lauffähig zu halten.

## 🛠️ Strategische Korrekturen

### 1. Namenskollisionen (Icons)
Um `ReferenceError` zu vermeiden, werden alle Icons, deren Namen mit Funktionen oder States kollidieren könnten, konsequent umbenannt:
- `Save` -> `SaveIcon`
- `ArrowUp` -> `ArrowUpIcon`
- `ArrowDown` -> `ArrowDownIcon`
- `ArrowRightLeft` -> `ArrowRightLeftIcon`

### 2. Import-Vollständigkeit
Alle UI-Komponenten (Switch, Dialog, Select etc.) werden im Kopf der Datei explizit importiert. Es darf kein "Lazy Loading" ohne Fallback für das Prerendering geben.

### 3. JSX Validierung
Next.js 15 bricht bei unsauberen Tag-Schachtelungen ab. Insbesondere in der Prozessansicht wurde die Struktur der Select- und Dialog-Komponenten stabilisiert.

## ✅ Checkliste für den Build
- [x] `SaveIcon` in allen Einstellungsseiten verwendet (Sync, Email, AI).
- [x] `Switch` Importe in `sync/page.tsx` und `email/page.tsx` validiert.
- [x] `SelectContent` Abschluss-Tag in der Prozessansicht (`view/[id]`) repariert.
- [x] Icons für die Prozesshistorie (`ArrowUpIcon`, `ArrowDownIcon`, `FileJsonIcon`) vervollständigt.
- [x] Behebung des `ReferenceError: Switch` durch expliziten Import in `email/page.tsx`.
