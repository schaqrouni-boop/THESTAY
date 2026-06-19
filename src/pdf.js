// Génération des rapports PDF par lot.
// Pour chaque lot, le PDF contient :
//   - en-tête bleu THE STAY + titre du lot + date
//   - bandeau technicien + avancement global du lot
//   - pour chaque typologie : sous-titre + une table par groupe (ou une seule table si pas de groupes)
//   - optionnel : pages photos en grille 2 colonnes
//   - pied de page : encart signature

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TYPOLOGIES, LOTS, groupsForLot, flatItemsForLot } from './data.js';
import { getPhotosBySection } from './storage.js';
import { blobToDataURL, loadImageEl } from './photoUtils.js';

async function fetchUrlToDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const blob = await res.blob();
  return await blobToDataURL(blob);
}

const PRIMARY = [30, 64, 175];
const SLATE = [71, 85, 105];
const GREEN = [22, 163, 74];
const ORANGE = [234, 88, 12];
const GRAY = [148, 163, 184];

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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ dataUrl: canvas.toDataURL('image/png'), ratio });
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
  if (total === 0) return { color: GRAY };
  if (done === 0) return { color: GRAY };
  if (done >= total) return { color: GREEN };
  return { color: ORANGE };
}

function formatDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// --------- En-tête commun ---------

async function drawHeader(doc, title, subtitle = 'Suivi de chantier') {
  const pageW = doc.internal.pageSize.getWidth();
  const logo = await loadLogoPng();

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 30, 'F');

  if (logo) {
    const logoH = 14;
    const logoW = logoH / logo.ratio;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 8, logoW + 6, logoH + 4, 2, 2, 'F');
    doc.addImage(logo.dataUrl, 'PNG', 13, 10, logoW, logoH);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('THE STAY', 12, 19);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(title, pageW - 12, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, pageW - 12, 22, { align: 'right' });
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
  doc.text('Avancement lot :', pageW - 80, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${globalDone}/${globalTotal}  (${pct} %)`, pageW - 80, y + 14);
}

// --------- Pied de page : signature + n° page ---------

function drawSignatureAndFooter(doc, { signatureDataUrl, technicianName, dateStr }) {
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

  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const pageStr = `Page ${doc.internal.getCurrentPageInfo().pageNumber}`;
  doc.text(pageStr, pageW - 12, pageH - 6, { align: 'right' });
}

// --------- Table d'un groupe (ou ungrouped) pour une typologie ---------

function drawGroupTable(doc, { typology, lotId, group, state, startY }) {
  const items = group.items;
  const head = [['Unité', ...items.map((i) => i.label), 'État']];
  const body = [];

  for (const unit of typology.units) {
    const us = state?.[typology.id]?.[unit]?.[lotId] || {};
    let done = 0;
    const row = [unit];
    for (const it of items) {
      const ok = !!us[it.key];
      if (ok) done += 1;
      row.push(ok ? 'X' : '');
    }
    const total = items.length;
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
      if (
        data.section === 'body' &&
        data.column.index > 0 &&
        data.column.index < head[0].length - 1
      ) {
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
          data.cell.styles.textColor = statusFor(d, t).color;
        }
      }
    },
    margin: { left: 10, right: 10, top: 60, bottom: 56 }
  });

  return doc.lastAutoTable.finalY;
}

// --------- Pages photos pour un lot ---------

async function appendPhotoPages(doc, sectionLabel, photos) {
  if (!photos.length) return;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const topY = 60;
  const bottomLimit = pageH - 58;

  const groups = new Map();
  for (const p of photos) {
    const key = `${p.typoId}|${p.unitId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const typoLabel = (id) => TYPOLOGIES.find((t) => t.id === id)?.label || id;

  doc.addPage();
  await drawHeader(doc, sectionLabel + ' — Photos');
  let y = topY;
  let firstOnPage = true;

  const colGap = 6;
  const slotW = (pageW - marginX * 2 - colGap) / 2;
  const slotH = 60;

  const newPage = async () => {
    doc.addPage();
    await drawHeader(doc, sectionLabel + ' — Photos');
    y = topY;
    firstOnPage = true;
  };

  for (const [key, items] of groups) {
    const [typoId, unitId] = key.split('|');
    const heading = `${unitId} — ${typoLabel(typoId)}`;

    if (y + 8 > bottomLimit) await newPage();
    if (!firstOnPage) y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(heading, marginX, y);
    y += 6;
    firstOnPage = false;

    let col = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      let dataUrl;
      let imgW;
      let imgH;
      try {
        // p.url = signed URL Supabase Storage (cloud), p.blob = legacy (local IDB)
        if (p.url) {
          dataUrl = await fetchUrlToDataUrl(p.url);
        } else if (p.blob) {
          dataUrl = await blobToDataURL(p.blob);
        } else {
          continue;
        }
        const img = await loadImageEl(dataUrl);
        imgW = img.naturalWidth || img.width;
        imgH = img.naturalHeight || img.height;
      } catch (e) {
        console.warn('Photo non chargée', e);
        continue;
      }

      const r = Math.min(slotW / imgW, slotH / imgH);
      const drawW = imgW * r;
      const drawH = imgH * r;

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
      y += slotH + 4;
    }
  }
}

// --------- Génération d'un rapport pour un lot ---------

export async function generateReport({
  lotId,
  state,
  technicianName,
  signatureDataUrl,
  includePhotos = true,
  sessionId = 'draft'
}) {
  const lot = LOTS.find((l) => l.id === lotId);
  if (!lot) throw new Error(`Lot inconnu : ${lotId}`);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const title = `Rapport ${lot.label}`;
  const dateStr = formatDate();

  // Totaux globaux du lot
  let globalDone = 0;
  let globalTotal = 0;
  for (const t of TYPOLOGIES) {
    const items = flatItemsForLot(t.id, lotId);
    for (const u of t.units) {
      const us = state?.[t.id]?.[u]?.[lotId] || {};
      for (const it of items) {
        globalTotal += 1;
        if (us[it.key]) globalDone += 1;
      }
    }
  }

  await drawHeader(doc, title);
  drawInfoBlock(doc, { technicianName, dateStr, globalDone, globalTotal });

  let cursorY = 60;
  const pageH = doc.internal.pageSize.getHeight();

  for (const typology of TYPOLOGIES) {
    const groups = groupsForLot(typology.id, lotId);
    if (!groups.length || groups.every((g) => !g.items.length)) continue;

    if (cursorY > pageH - 80) {
      doc.addPage();
      await drawHeader(doc, title);
      cursorY = 38;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...PRIMARY);
    doc.text(`${typology.label}  (${typology.units.length} unités)`, 10, cursorY);
    cursorY += 4;

    for (const group of groups) {
      if (!group.items.length) continue;

      if (group.group) {
        if (cursorY > pageH - 70) {
          doc.addPage();
          await drawHeader(doc, title);
          cursorY = 38;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...SLATE);
        doc.text(group.group, 10, cursorY + 2);
        cursorY += 2;
      }

      const endY = drawGroupTable(doc, {
        typology,
        lotId,
        group,
        state,
        startY: cursorY + 2
      });
      cursorY = endY + 6;
    }

    cursorY += 4;
  }

  const lastTablePage = doc.internal.getNumberOfPages();

  if (includePhotos) {
    try {
      const photos = await getPhotosBySection(lotId, sessionId);
      if (photos.length) {
        await appendPhotoPages(doc, title, photos);
      }
    } catch (e) {
      console.warn('Photos non incluses :', e);
    }
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1 && p <= lastTablePage) {
      await drawHeader(doc, title);
    }
    drawSignatureAndFooter(doc, { signatureDataUrl, technicianName, dateStr });
  }

  const blob = doc.output('blob');
  const safeShort = lot.short.replace(/[^a-zA-Z0-9]+/g, '_');
  const fileName = `THESTAY_${safeShort}_${dateStr.replace(/\//g, '-')}.pdf`;
  return { blob, fileName };
}
