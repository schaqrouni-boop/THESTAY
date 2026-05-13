// Génération des rapports PDF (Cuisine et Menuiserie)
// Utilise jsPDF + jspdf-autotable, et rasterise le logo SVG en PNG pour insertion.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TYPOLOGIES, itemsForTypology } from './data.js';
import { getPhotosBySection } from './storage.js';
import { blobToDataURL, loadImageEl } from './photoUtils.js';

const PRIMARY = [30, 64, 175]; // bleu THE STAY
const SLATE = [71, 85, 105];
const GREEN = [22, 163, 74];
const ORANGE = [234, 88, 12];
const GRAY = [148, 163, 184];

// Cache du logo en data URL (rasterisé une seule fois)
let logoCache = null;

async function loadLogoPng(width = 1200) {
  if (logoCache) return logoCache;
  try {
    const res = await fetch('logo.svg');
    if (!res.ok) return null;
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.height / img.width || 0.2;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = Math.round(width * ratio);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          ratio
        });
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
    logoCache = dataUrl;
    return logoCache;
  } catch (e) {
    console.warn('Logo non chargé :', e);
    return null;
  }
}

function statusFor(done, total) {
  if (total === 0) return { label: '—', color: GRAY };
  if (done === 0) return { label: 'Non commencé', color: GRAY };
  if (done >= total) return { label: 'Terminé', color: GREEN };
  return { label: 'En cours', color: ORANGE };
}

function formatDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// --------- En-tête commun ---------

async function drawHeader(doc, title) {
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogoPng();

  // Bandeau bleu en haut
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 30, 'F');

  // Logo (rasterisé) à gauche, blanc-sur-bleu via fond clair
  if (logo) {
    const logoH = 14;
    const logoW = logoH / logo.ratio;
    // Encadré blanc autour du logo pour qu'il reste lisible
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 8, logoW + 6, logoH + 4, 2, 2, 'F');
    doc.addImage(logo.dataUrl, 'PNG', 13, 10, logoW, logoH);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('THE STAY', 12, 19);
  }

  // Titre à droite
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(title, pageW - 12, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Suivi de chantier', pageW - 12, 22, { align: 'right' });
}

// --------- Bandeau d'infos (technicien + date + résumé) ---------

function drawInfoBlock(doc, { technicianName, dateStr, globalDone, globalTotal }) {
  const pageW = doc.internal.pageSize.getWidth();
  const y = 36;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(10, y, pageW - 20, 18, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.text('Technicien :', 14, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(technicianName || '—', 38, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('Date :', 14, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, 28, y + 14);

  const pct = globalTotal === 0 ? 0 : Math.round((globalDone / globalTotal) * 100);
  doc.setFont('helvetica', 'bold');
  doc.text('Avancement global :', pageW - 80, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${globalDone}/${globalTotal}  (${pct} %)`, pageW - 80, y + 14);
}

// --------- Pied de page : signature + n° page ---------

async function drawSignatureAndFooter(doc, { signatureDataUrl, technicianName, dateStr }) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const y = pageH - 50;

  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.3);
  doc.line(10, y, pageW - 10, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SLATE);
  doc.setFontSize(10);
  doc.text('Signature du technicien', 12, y + 7);

  // Cadre signature
  const sigX = 12;
  const sigY = y + 10;
  const sigW = 70;
  const sigH = 28;
  doc.setDrawColor(...GRAY);
  doc.roundedRect(sigX, sigY, sigW, sigH, 1, 1, 'S');
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', sigX + 1, sigY + 1, sigW - 2, sigH - 2);
    } catch (e) {
      console.warn('Signature non insérée', e);
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SLATE);
  doc.text(`Nom : ${technicianName || '—'}`, sigX + sigW + 6, sigY + 8);
  doc.text(`Date : ${dateStr}`, sigX + sigW + 6, sigY + 16);
  doc.text('Lu et approuvé', sigX + sigW + 6, sigY + 24);

  // N° page
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const pageStr = `Page ${doc.internal.getCurrentPageInfo().pageNumber}`;
  doc.text(pageStr, pageW - 12, pageH - 6, { align: 'right' });
}

// --------- Tableau d'une typologie ---------

function drawTypologyTable(doc, { section, typology, state, startY }) {
  const items =
    section === 'cuisine'
      ? itemsForTypology(typology.id).cuisine
      : itemsForTypology(typology.id).menuiserie;

  const head = [['Unité', ...items, 'État']];
  const body = [];
  let typDone = 0;
  let typTotal = 0;

  for (const unit of typology.units) {
    const unitState = state?.[typology.id]?.[unit]?.[section] || {};
    let done = 0;
    const row = [unit];
    for (const it of items) {
      const ok = !!unitState[it];
      if (ok) done += 1;
      row.push(ok ? 'X' : '');
    }
    const total = items.length;
    typDone += done;
    typTotal += total;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    row.push(`${done}/${total} · ${pct}%`);
    body.push(row);
  }

  autoTable(doc, {
    head,
    body,
    startY,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8.5
    },
    bodyStyles: { halign: 'center' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      [head[0].length - 1]: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0 && data.column.index < head[0].length - 1) {
        if (data.cell.raw === 'X') {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = GREEN;
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'body' && data.column.index === head[0].length - 1) {
        const txt = String(data.cell.raw || '');
        const m = txt.match(/(\d+)\/(\d+)/);
        if (m) {
          const d = parseInt(m[1], 10);
          const t = parseInt(m[2], 10);
          const s = statusFor(d, t);
          data.cell.styles.textColor = s.color;
        }
      }
    },
    didDrawPage: () => {
      // Header & footer re-dessinés sur chaque page par appelant
    },
    margin: { left: 10, right: 10, top: 60, bottom: 56 }
  });

  return {
    endY: doc.lastAutoTable.finalY,
    typDone,
    typTotal
  };
}

// --------- Pages photos ---------

async function appendPhotoPages(doc, sectionLabel, photos) {
  if (!photos.length) return;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const topY = 60; // sous le header
  const bottomLimit = pageH - 58; // au-dessus de la zone signature/footer

  // Grouper par typo + unité
  const groups = new Map();
  for (const p of photos) {
    const key = `${p.typoId}|${p.unitId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const typoLabel = (id) =>
    TYPOLOGIES.find((t) => t.id === id)?.label || id;

  doc.addPage();
  await drawHeader(doc, sectionLabel + ' — Photos');
  let y = topY;
  let firstOnPage = true;

  const colGap = 6;
  const slotW = (pageW - marginX * 2 - colGap) / 2; // largeur slot photo
  const slotH = 60; // hauteur slot photo (mm)

  const newPage = async () => {
    doc.addPage();
    await drawHeader(doc, sectionLabel + ' — Photos');
    y = topY;
    firstOnPage = true;
  };

  for (const [key, items] of groups) {
    const [typoId, unitId] = key.split('|');
    const heading = `${unitId} — ${typoLabel(typoId)}`;

    // Titre d'unité
    if (y + 8 > bottomLimit) await newPage();
    if (!firstOnPage) y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(heading, marginX, y);
    y += 6;
    firstOnPage = false;

    // Photos en grille 2 colonnes
    let col = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      let dataUrl;
      let imgW;
      let imgH;
      try {
        dataUrl = await blobToDataURL(p.blob);
        const img = await loadImageEl(dataUrl);
        imgW = img.naturalWidth || img.width;
        imgH = img.naturalHeight || img.height;
      } catch (e) {
        console.warn('Photo non chargée', e);
        continue;
      }

      // Adapter au slot en gardant le ratio (contain)
      const r = Math.min(slotW / imgW, slotH / imgH);
      const drawW = imgW * r;
      const drawH = imgH * r;

      // Nouvelle ligne si besoin
      if (col === 0 && y + slotH > bottomLimit) {
        await newPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...PRIMARY);
        doc.text(heading + ' (suite)', marginX, y);
        y += 6;
        firstOnPage = false;
      }

      const slotX = marginX + col * (slotW + colGap);
      const slotY = y;

      // Cadre + photo centrée dans le slot
      doc.setDrawColor(...GRAY);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(slotX, slotY, slotW, slotH, 1.2, 1.2, 'FD');
      const offsetX = slotX + (slotW - drawW) / 2;
      const offsetY = slotY + (slotH - drawH) / 2;
      try {
        doc.addImage(dataUrl, 'JPEG', offsetX, offsetY, drawW, drawH);
      } catch (e) {
        console.warn('addImage failed', e);
      }

      col += 1;
      if (col === 2) {
        col = 0;
        y += slotH + 4;
      }
    }
    if (col !== 0) {
      // Clore la ligne en cours
      y += slotH + 4;
    }
  }
}

// --------- Génération d'un rapport (section) ---------

export async function generateReport({ section, state, technicianName, signatureDataUrl, includePhotos = true }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sectionLabel = section === 'cuisine' ? 'Rapport Cuisine' : 'Rapport Menuiserie';
  const dateStr = formatDate();

  // Calcul des totaux globaux
  let globalDone = 0;
  let globalTotal = 0;
  for (const t of TYPOLOGIES) {
    const items =
      section === 'cuisine'
        ? itemsForTypology(t.id).cuisine
        : itemsForTypology(t.id).menuiserie;
    for (const u of t.units) {
      const us = state?.[t.id]?.[u]?.[section] || {};
      for (const it of items) {
        globalTotal += 1;
        if (us[it]) globalDone += 1;
      }
    }
  }

  await drawHeader(doc, sectionLabel);
  drawInfoBlock(doc, { technicianName, dateStr, globalDone, globalTotal });

  let cursorY = 60;
  for (let i = 0; i < TYPOLOGIES.length; i++) {
    const t = TYPOLOGIES[i];
    // Espace + titre typologie
    if (cursorY > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      await drawHeader(doc, sectionLabel);
      cursorY = 38;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...PRIMARY);
    doc.text(`${t.label}  (${t.units.length} unités)`, 10, cursorY);
    cursorY += 2;

    const { endY } = drawTypologyTable(doc, {
      section,
      typology: t,
      state,
      startY: cursorY + 2
    });

    cursorY = endY + 8;
  }

  // Nombre de pages "tableaux" — au-delà ce sera les pages photos qui ont
  // déjà leur propre header "— Photos".
  const lastTablePage = doc.internal.getNumberOfPages();

  if (includePhotos) {
    try {
      const photos = await getPhotosBySection(section);
      if (photos.length) {
        await appendPhotoPages(doc, sectionLabel, photos);
      }
    } catch (e) {
      console.warn('Photos non incluses :', e);
    }
  }

  // Re-passer sur toutes les pages pour ajouter header (sur les pages
  // tableaux > 1 qui n'en ont pas) et footer (signature + numéro).
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1 && p <= lastTablePage) {
      await drawHeader(doc, sectionLabel);
    }
    await drawSignatureAndFooter(doc, { signatureDataUrl, technicianName, dateStr });
  }

  const blob = doc.output('blob');
  const fileName = `THESTAY_${section === 'cuisine' ? 'Cuisine' : 'Menuiserie'}_${dateStr.replace(/\//g, '-')}.pdf`;
  return { blob, fileName };
}
