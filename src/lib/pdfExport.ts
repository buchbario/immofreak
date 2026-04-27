import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Shared: Render any DIN A4 React element to PDF ─────────── */

export async function exportElementToPDF(element: HTMLElement, filename: string) {
  // 1. Undo the visual-scale wrapper (scale 0.75) so html2canvas
  //    reads the true 794×1123 px A4 layout without distortion
  const scaleWrapper = element.parentElement;
  const savedTransform = scaleWrapper?.style.transform ?? '';
  if (scaleWrapper) scaleWrapper.style.transform = 'none';

  // 2. Let the browser settle into the un-scaled layout
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  try {
    // 3. Capture at 2× for crisp print quality
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
    });

    // 4. Write DIN A4 PDF (210 × 297 mm)
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    pdf.save(filename);
  } finally {
    // 5. Restore the visual scale
    if (scaleWrapper) scaleWrapper.style.transform = savedTransform;
  }
}

/* ── Legacy functions (kept for backward compat) ─────────────── */

function addLine(doc: jsPDF, text: string, y: number, fontSize = 10, bold = false): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(30);
  const lines = doc.splitTextToSize(text, 170);
  doc.text(lines, 20, y);
  return y + lines.length * (fontSize * 0.5);
}

interface RentIncreaseData {
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  unitName: string;
  oldRent: number;
  newRent: number;
  effectiveDate: string;
  reason: string;
  date: string;
}

export function generateRentIncreasePDF(data: RentIncreaseData) {
  const doc = new jsPDF();
  let y = 20;

  y = addLine(doc, data.propertyName, y, 12, true);
  y = addLine(doc, data.propertyAddress, y + 2);
  y += 10;

  y = addLine(doc, 'An', y);
  y = addLine(doc, data.tenantName, y + 2);
  y = addLine(doc, `${data.unitName}, ${data.propertyAddress}`, y + 2);
  y += 10;

  y = addLine(doc, `Datum: ${data.date}`, y);
  y += 5;

  y = addLine(doc, `Betreff: Mieterhöhung für ${data.unitName}, ${data.propertyAddress}`, y, 11, true);
  y += 8;

  y = addLine(doc, `Sehr geehrte/r ${data.tenantName},`, y);
  y += 5;

  y = addLine(doc, `hiermit teile ich Ihnen mit, dass die monatliche Kaltmiete für Ihre Wohnung ${data.unitName} in ${data.propertyAddress} angepasst wird.`, y);
  y += 8;

  const increase = data.newRent - data.oldRent;
  const pct = data.oldRent > 0 ? (increase / data.oldRent) * 100 : 0;

  y = addLine(doc, `Bisherige Kaltmiete: ${fmt(data.oldRent)} € monatlich`, y);
  y = addLine(doc, `Neue Kaltmiete: ${fmt(data.newRent)} € monatlich`, y + 2);
  y = addLine(doc, `Erhöhung: ${fmt(increase)} € (${pct.toFixed(1)} %)`, y + 2);
  y += 8;

  y = addLine(doc, `Die neue Miete gilt ab dem ${data.effectiveDate}.`, y);
  y += 5;

  y = addLine(doc, 'Begründung:', y, 10, true);
  y = addLine(doc, data.reason, y + 2);
  y += 8;

  y = addLine(doc, 'Ich bitte Sie, der Mieterhöhung bis spätestens zum Ende des übernächsten Monats zuzustimmen.', y);
  y += 8;

  y = addLine(doc, 'Mit freundlichen Grüßen', y);
  y += 15;
  y = addLine(doc, '_________________________', y);
  addLine(doc, 'Vermieter', y + 2);

  doc.save(`Mieterhöhung_${data.tenantName.replace(/\s/g, '_')}.pdf`);
}

interface UtilityBillData {
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  unitName: string;
  year: number;
  totalArea: number;
  unitArea: number;
  areaShare: number;
  costs: { type: string; provider: string; totalCost: number }[];
  totalCosts: number;
  tenantShare: number;
  monthlyAdvance: number;
  yearlyAdvance: number;
  difference: number;
  date: string;
}

export function generateUtilityBillPDF(data: UtilityBillData) {
  const doc = new jsPDF();
  let y = 20;

  y = addLine(doc, data.propertyName, y, 12, true);
  y = addLine(doc, data.propertyAddress, y + 2);
  y += 10;

  y = addLine(doc, 'An', y);
  y = addLine(doc, data.tenantName, y + 2);
  y = addLine(doc, `${data.unitName}, ${data.propertyAddress}`, y + 2);
  y += 10;

  y = addLine(doc, `Datum: ${data.date}`, y);
  y += 5;

  y = addLine(doc, `Betreff: Nebenkostenabrechnung ${data.year} für ${data.unitName}`, y, 11, true);
  y += 8;

  y = addLine(doc, `Sehr geehrte/r ${data.tenantName},`, y);
  y += 5;

  y = addLine(doc, `hiermit erhalten Sie die Nebenkostenabrechnung für den Zeitraum 01.01.${data.year} bis 31.12.${data.year}.`, y);
  y += 8;

  y = addLine(doc, `Gesamtwohnfläche: ${data.totalArea} m²  |  Ihre Wohnfläche: ${data.unitArea} m² (${(data.areaShare * 100).toFixed(1)} %)`, y);
  y += 8;

  y = addLine(doc, 'Kostenaufstellung:', y, 10, true);
  y += 2;
  for (const c of data.costs) {
    y = addLine(doc, `  ${c.type} (${c.provider}): ${fmt(c.totalCost)} €`, y + 1);
  }
  y += 5;

  y = addLine(doc, `Gesamtkosten: ${fmt(data.totalCosts)} €`, y, 10, true);
  y = addLine(doc, `Ihr Anteil: ${fmt(data.tenantShare)} €`, y + 3);
  y = addLine(doc, `Vorauszahlungen: ${fmt(data.yearlyAdvance)} €`, y + 3);
  y += 8;

  if (data.difference > 0) {
    y = addLine(doc, `Nachzahlung: ${fmt(data.difference)} €`, y, 11, true);
    y += 3;
    y = addLine(doc, `Bitte überweisen Sie den Betrag innerhalb von 30 Tagen.`, y);
  } else {
    y = addLine(doc, `Guthaben: ${fmt(Math.abs(data.difference))} €`, y, 11, true);
    y += 3;
    y = addLine(doc, `Das Guthaben wird mit der nächsten Mietzahlung verrechnet.`, y);
  }
  y += 8;

  y = addLine(doc, 'Mit freundlichen Grüßen', y);
  y += 15;
  y = addLine(doc, '_________________________', y);
  addLine(doc, 'Vermieter', y + 2);

  doc.save(`NK_Abrechnung_${data.year}_${data.tenantName.replace(/\s/g, '_')}.pdf`);
}
