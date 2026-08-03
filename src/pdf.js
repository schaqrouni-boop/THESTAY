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

function formatShortDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function drawPageNumber(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(
    `Page ${doc.internal.getCurrentPageInfo().pageNumber}`,
    pageW - 12,
    pageH - 6,
    { align: 'right' }
  );
}

function drawSignatureAndFooter(
  doc,
  { signatureDataUrl, technicianName, dateStr, companyName, companyRepName, companySignatureDataUrl }
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const hasSecond = !!(companySignatureDataUrl || companyName || companyRepName);

  if (!hasSecond) {
    // --- Signature unique (contrôle technicien) ---
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

    drawPageNumber(doc);
    return;
  }

  // --- Double signature (réception co-signée THE STAY + entreprise) ---
  const y = pageH - 56;
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.3);
  doc.line(10, y, pageW - 10, y);

  const boxW = (pageW - 24 - 8) / 2; // 2 colonnes, marges 12 + gap 8
  const boxH = 22;
  const titleY = y + 4;
  const sigY = y + 6;
  const cols = [
    {
      x: 12,
      title: 'Réceptionné par — THE STAY',
      name: technicianName,
      sig: signatureDataUrl
    },
    {
      x: 12 + boxW + 8,
      title: `Entreprise — ${companyName || '—'}`,
      name: companyRepName,
      sig: companySignatureDataUrl
    }
  ];
  for (const c of cols) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE);
    doc.setFontSize(8.5);
    doc.text(c.title, c.x, titleY, { maxWidth: boxW });
    doc.setDrawColor(...GRAY);
    doc.roundedRect(c.x, sigY, boxW, boxH, 1, 1, 'S');
    if (c.sig) {
      try {
        doc.addImage(c.sig, 'PNG', c.x + 1, sigY + 1, boxW - 2, boxH - 2);
      } catch (e) {
        console.warn('Signature non insérée', e);
      }
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    doc.text(`Nom : ${c.name || '—'}`, c.x, sigY + boxH + 4, { maxWidth: boxW });
  }
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text(`Date : ${dateStr} — Lu et approuvé`, 12, sigY + boxH + 10);

  drawPageNumber(doc);
}

// --------- Table d'un groupe (ou ungrouped) pour une typologie ---------

function drawGroupTable(doc, { typology, lotId, group, state, startY }) {
  const items = group.items;
  const head = [['Unité', ...items.map((i) => i.label), 'État']];
  const body = [];

  // Groupe restreint (ex. Garde-Corps) : ne montrer que les unités concernées.
  const units = group.onlyUnits
    ? typology.units.filter((u) => group.onlyUnits.includes(u))
    : typology.units;

  for (const unit of units) {
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

// --------- Bloc photos par typologie ---------
// Dessine les photos d'une typologie (déjà filtrées) à partir de startY.
// Groupe par unité. Gère les sauts de page.
// Retourne le Y final après le bloc.

async function drawPhotosBlock(doc, sectionLabel, photos, startY, typoLabelStr) {
  if (!photos.length) return startY;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 10;
  const topY = 38;
  const bottomLimit = pageH - 58;

  const groups = new Map();
  for (const p of photos) {
    if (!groups.has(p.unitId)) groups.set(p.unitId, []);
    groups.get(p.unitId).push(p);
  }

  let y = startY;
  let firstOnPage = false;

  const cols = 3;
  const colGap = 4;
  const slotW = (pageW - marginX * 2 - (cols - 1) * colGap) / cols;
  const slotH = 45;
  const captionH = 5;
  const rowH = slotH + captionH + 2;
  const headingBarH = 9;

  const drawHeadingBar = (text, suffix = '') => {
    // Bandeau bleu pleine largeur avec libellé unité en blanc
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(marginX, y, pageW - 2 * marginX, headingBarH, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(text + (suffix ? ' ' + suffix : ''), marginX + 4, y + 6.5);
    y += headingBarH + 3;
  };

  const newPage = async () => {
    doc.addPage();
    await drawHeader(doc, `${sectionLabel} — Photos ${typoLabelStr || ''}`.trim());
    y = topY;
    firstOnPage = true;
  };

  for (const [unitId, items] of groups) {
    const heading = `${unitId}  ·  ${items.length} photo${items.length > 1 ? 's' : ''}`;

    // Saut de page si pas la place pour le bandeau + au moins une ligne de photos
    if (y + headingBarH + rowH + 4 > bottomLimit) await newPage();
    if (!firstOnPage) y += 4;
    drawHeadingBar(heading);
    firstOnPage = false;

    let col = 0;
    let photoIndex = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      let dataUrl;
      let imgW;
      let imgH;
      try {
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

      // Saut de page si une nouvelle ligne ne tient pas
      if (col === 0 && y + rowH > bottomLimit) {
        await newPage();
        drawHeadingBar(heading, '(suite)');
      }

      const slotX = marginX + col * (slotW + colGap);
      const slotY = y;

      // Cadre photo
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

      // Caption sous la photo : "S01 · 18/06 14:30"
      photoIndex += 1;
      const dateStr = formatShortDateTime(p.createdAt);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...SLATE);
      doc.text(
        dateStr ? `${unitId} · ${dateStr}` : `${unitId}`,
        slotX + slotW / 2,
        slotY + slotH + 3.5,
        { align: 'center' }
      );

      col += 1;
      if (col === cols) {
        col = 0;
        y += rowH + 2;
      }
    }
    if (col !== 0) {
      y += rowH + 2;
    }
    y += 2;
  }

  return y;
}

// --------- Génération d'un rapport pour un lot ---------

export async function generateReport({
  lotId,
  state,
  technicianName,
  signatureDataUrl,
  companyName = null,
  companyRepName = null,
  companySignatureDataUrl = null,
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
    for (const u of t.units) {
      const items = flatItemsForLot(t.id, lotId, u);
      if (!items.length) continue;
      const us = state?.[t.id]?.[u]?.[lotId] || {};
      for (const it of items) {
        globalTotal += 1;
        if (us[it.key]) globalDone += 1;
      }
    }
  }

  await drawHeader(doc, title);
  drawInfoBlock(doc, { technicianName, dateStr, globalDone, globalTotal });

  // Pré-charger toutes les photos une seule fois et grouper par typologie
  const photosByTypo = new Map();
  if (includePhotos) {
    try {
      const allPhotos = await getPhotosBySection(lotId, sessionId);
      for (const p of allPhotos) {
        if (!photosByTypo.has(p.typoId)) photosByTypo.set(p.typoId, []);
        photosByTypo.get(p.typoId).push(p);
      }
    } catch (e) {
      console.warn('Chargement photos KO', e);
    }
  }

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
      // Groupe restreint sans aucune unité concernée dans cette typologie → on saute.
      if (group.onlyUnits && !typology.units.some((u) => group.onlyUnits.includes(u))) {
        continue;
      }

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

    // Insertion des photos de la typologie juste après ses tableaux
    const typoPhotos = photosByTypo.get(typology.id);
    if (includePhotos && typoPhotos?.length) {
      // Titre du bloc photos de cette typologie
      if (cursorY > pageH - 80) {
        doc.addPage();
        await drawHeader(doc, title);
        cursorY = 38;
      }
      // Petit carré bleu comme repère visuel (remplace l'emoji, non supporté par jsPDF)
      doc.setFillColor(...PRIMARY);
      doc.rect(10, cursorY - 1, 3.5, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY);
      doc.text(
        `Photos — ${typology.label} (${typoPhotos.length})`,
        16,
        cursorY + 2
      );
      cursorY += 6;

      cursorY = await drawPhotosBlock(doc, title, typoPhotos, cursorY, typology.label);
      cursorY += 4;
    }
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1) {
      await drawHeader(doc, title);
    }
    drawSignatureAndFooter(doc, {
      signatureDataUrl,
      technicianName,
      dateStr,
      companyName,
      companyRepName,
      companySignatureDataUrl
    });
  }

  const blob = doc.output('blob');
  const safeShort = lot.short.replace(/[^a-zA-Z0-9]+/g, '_');
  const fileName = `THESTAY_${safeShort}_${dateStr.replace(/\//g, '-')}.pdf`;
  return { blob, fileName };
}

// --------- Rapport "Actions restantes" (uniquement les cases NON cochées) ---------
// Version condensée pour les réunions : liste par unité de ce qui reste à faire.
// Skip les unités et typologies 100% terminées.

export async function generateMissingReport({
  lotId,
  state,
  technicianName,
  signatureDataUrl = null
}) {
  const lot = LOTS.find((l) => l.id === lotId);
  if (!lot) throw new Error(`Lot inconnu : ${lotId}`);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const title = `Actions restantes — ${lot.label}`;
  const dateStr = formatDate();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Totaux
  let globalDone = 0;
  let globalTotal = 0;
  for (const t of TYPOLOGIES) {
    for (const u of t.units) {
      const items = flatItemsForLot(t.id, lotId, u);
      if (!items.length) continue;
      const us = state?.[t.id]?.[u]?.[lotId] || {};
      for (const it of items) {
        globalTotal += 1;
        if (us[it.key]) globalDone += 1;
      }
    }
  }
  const globalMissing = globalTotal - globalDone;

  await drawHeader(doc, title);
  drawInfoBlock(doc, { technicianName, dateStr, globalDone, globalTotal });

  let cursorY = 60;

  // Cas "tout terminé"
  if (globalMissing === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...GREEN);
    doc.text('Aucune action restante', pageW / 2, 120, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(...SLATE);
    doc.text('Lot 100% terminé', pageW / 2, 132, { align: 'center' });
  } else {
    for (const typology of TYPOLOGIES) {
      // Calcul par unité (les items peuvent varier d'une unité à l'autre)
      const unitsWithMissing = [];
      for (const unitId of typology.units) {
        const items = flatItemsForLot(typology.id, lotId, unitId);
        if (!items.length) continue;
        const us = state?.[typology.id]?.[unitId]?.[lotId] || {};
        const done = items.filter((it) => us[it.key]).length;
        const missing = items.filter((it) => !us[it.key]);
        if (missing.length === 0) continue;
        unitsWithMissing.push({ unitId, done, total: items.length, missing });
      }
      if (unitsWithMissing.length === 0) continue;

      // Titre typologie
      if (cursorY > pageH - 60) {
        doc.addPage();
        await drawHeader(doc, title);
        cursorY = 38;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...PRIMARY);
      doc.text(
        `${typology.label} — ${unitsWithMissing.length} unité${unitsWithMissing.length > 1 ? 's' : ''} avec actions restantes`,
        10,
        cursorY
      );
      cursorY += 6;

      for (const { unitId, done, total, missing } of unitsWithMissing) {
        const pct = Math.round((done / total) * 100);
        const heightEstimate = 10 + missing.length * 4.8 + 3;

        // Saut de page si le bloc unité ne rentre pas
        if (cursorY + heightEstimate > pageH - 55) {
          doc.addPage();
          await drawHeader(doc, title);
          cursorY = 38;
        }

        // Bandeau orange par unité
        doc.setFillColor(...ORANGE);
        doc.roundedRect(10, cursorY, pageW - 20, 8, 1.2, 1.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(`${unitId} — ${done}/${total} · ${pct}%`, 13, cursorY + 5.5);
        doc.text(
          `${missing.length} action${missing.length > 1 ? 's' : ''} restante${missing.length > 1 ? 's' : ''}`,
          pageW - 13,
          cursorY + 5.5,
          { align: 'right' }
        );
        cursorY += 11;

        // Liste des items non cochés
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        for (const item of missing) {
          const label = item.group ? `${item.group} — ${item.label}` : item.label;
          doc.setFillColor(...ORANGE);
          doc.circle(14, cursorY - 1, 0.9, 'F');
          doc.text(label, 18, cursorY);
          cursorY += 4.5;
        }
        cursorY += 3;
      }
      cursorY += 4;
    }
  }

  // Header + footer sur toutes les pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1) {
      await drawHeader(doc, title);
    }
    drawSignatureAndFooter(doc, { signatureDataUrl, technicianName, dateStr });
  }

  const blob = doc.output('blob');
  const safeShort = lot.short.replace(/[^a-zA-Z0-9]+/g, '_');
  const fileName = `THESTAY_${safeShort}_ActionsRestantes_${dateStr.replace(/\//g, '-')}.pdf`;
  return { blob, fileName };
}
