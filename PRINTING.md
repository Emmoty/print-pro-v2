# CloudPrint Pro - Printing & Document Processing Guide

## 1. Supported Document Formats

The CloudPrint Pro Secure Print Bridge natively processes and normalizes:

| Category | Extensions | Conversion Engine | Output |
| :--- | :--- | :--- | :--- |
| **PDF** | `.pdf` | Native PDF Engine | Standardized PDF Stream |
| **Office Documents** | `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx` | Headless LibreOffice Sandbox | Vector PDF |
| **Images** | `.jpg`, `.jpeg`, `.png`, `.webp` | High-Resolution Image Engine | Centered Page-Fitted PDF |
| **Plain Text** | `.txt` | Text Stream Normalizer | Standard Document PDF |

---

## 2. Hardware Paper Size & Aspect-Ratio Normalization

Standard paper dimensions in PostScript Points:
- **A4**: `595.28 x 841.89 pt` (Standard default in Kenya & international)
- **A5**: `419.53 x 595.28 pt` (Booklet / Small format)
- **A3**: `841.89 x 1190.55 pt` (Large architectural / posters)
- **Letter**: `612.00 x 792.00 pt`
- **Legal**: `612.00 x 1008.00 pt`

Images are scaled proportionally with **aspect ratio preservation**, 36pt margins, and automatic center alignment to prevent stretching or clipping.

---

## 3. Windows Native Spooling Engine

The agent uses Windows native printing APIs via PowerShell:
```powershell
Start-Process -FilePath 'spool_doc.pdf' -Verb PrintTo -ArgumentList '"HP LaserJet Pro MFP M127-M128 PCLmS"' -WindowStyle Hidden
```
- **Multi-Copy Support**: Dispatches discrete physical sets if `copies > 1`.
- **Per-Printer Mutex**: Guarantees strictly 1 physical print operation per printer at a time to prevent spooler collisions and paper jams.
- **Headless**: Operates without opening GUI windows (Acrobat, Edge, or Chrome).
