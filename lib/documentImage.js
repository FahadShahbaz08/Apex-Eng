"use client";

const clean = value => String(value ?? "").trim();

export function meaningfulFilename(...parts) {
  const name = parts.map(clean).filter(Boolean).join("-")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return name || "Apex-Engineering-document";
}

const wrap = (ctx, value, width) => {
  const text = clean(value) || "—";
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
};

const downloadCanvas = (canvas, filename, delay = 0) => {
  canvas.toBlob(blob => {
    if (!blob) return;
    setTimeout(() => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, delay);
  }, "image/png");
};

/** Produces a crisp, black-and-white PNG statement. Very long tables are split into numbered images. */
export function downloadTableImage({ company, title, subtitle, headers, rows, filename, summary = [] }) {
  const scale = 2;
  const width = 1600;
  const margin = 54;
  const usable = width - margin * 2;
  const headerHeight = 166;
  const tableHeaderHeight = 54;
  const footerHeight = 48;
  const lineHeight = 22;
  const rowPad = 20;
  const safeRows = rows.length ? rows : [["No entries", ...headers.slice(1).map(() => "")]];
  const sampleCanvas = document.createElement("canvas");
  const sample = sampleCanvas.getContext("2d");
  sample.font = "16px Arial";
  const weights = headers.map((header, index) => {
    const longest = [header, ...safeRows.slice(0, 100).map(row => row[index])]
      .reduce((max, value) => Math.max(max, clean(value).length), 0);
    return Math.max(9, Math.min(28, longest));
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const widths = weights.map(value => usable * value / weightTotal);
  const rowHeight = row => Math.max(48, ...row.map((value, index) => wrap(sample, value, widths[index] - 20).length * lineHeight + rowPad));
  const measured = safeRows.map(row => ({ row, height: rowHeight(row) }));
  const maxPageHeight = 6200;
  const pages = [];
  let current = [], used = headerHeight + tableHeaderHeight + footerHeight + (summary.length ? summary.length * 34 + 30 : 0);
  measured.forEach(entry => {
    if (current.length && used + entry.height > maxPageHeight) {
      pages.push(current);
      current = [];
      used = headerHeight + tableHeaderHeight + footerHeight;
    }
    current.push(entry);
    used += entry.height;
  });
  if (current.length) pages.push(current);

  pages.forEach((page, pageIndex) => {
    const lastPage = pageIndex === pages.length - 1;
    const summaryHeight = lastPage && summary.length ? summary.length * 34 + 30 : 0;
    const height = headerHeight + tableHeaderHeight + page.reduce((sum, entry) => sum + entry.height, 0) + summaryHeight + footerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "top";
    ctx.font = "bold 34px Georgia";
    ctx.fillText(clean(company?.name) || "Apex Engineering", margin, 38);
    ctx.font = "15px Arial";
    ctx.fillText(clean(company?.address), margin, 82);
    ctx.fillText(clean(company?.phone), margin, 105);
    ctx.textAlign = "right";
    ctx.font = "bold 23px Arial";
    ctx.fillText(clean(title), width - margin, 40);
    ctx.font = "14px Arial";
    ctx.fillText(clean(subtitle), width - margin, 78);
    if (pages.length > 1) ctx.fillText(`Page ${pageIndex + 1} of ${pages.length}`, width - margin, 104);
    ctx.textAlign = "left";
    ctx.fillRect(margin, 137, usable, 3);

    let y = headerHeight;
    let x = margin;
    ctx.fillStyle = "#efefef";
    ctx.fillRect(margin, y, usable, tableHeaderHeight);
    ctx.fillStyle = "#000";
    ctx.font = "bold 14px Arial";
    headers.forEach((header, index) => {
      ctx.strokeRect(x, y, widths[index], tableHeaderHeight);
      ctx.fillText(clean(header).toUpperCase(), x + 10, y + 18, widths[index] - 20);
      x += widths[index];
    });
    y += tableHeaderHeight;
    ctx.font = "16px Arial";
    page.forEach(({ row, height: h }) => {
      x = margin;
      row.forEach((value, index) => {
        ctx.strokeRect(x, y, widths[index], h);
        wrap(ctx, value, widths[index] - 20).forEach((line, lineIndex) => ctx.fillText(line, x + 10, y + 11 + lineIndex * lineHeight));
        x += widths[index];
      });
      y += h;
    });
    if (lastPage && summary.length) {
      y += 14;
      const boxWidth = 470;
      summary.forEach(([label, value], index) => {
        const boxX = width - margin - boxWidth;
        if (index === summary.length - 1) ctx.lineWidth = 2;
        ctx.strokeRect(boxX, y, boxWidth, 34);
        ctx.font = index === summary.length - 1 ? "bold 17px Arial" : "15px Arial";
        ctx.fillText(clean(label), boxX + 10, y + 8);
        ctx.textAlign = "right";
        ctx.fillText(clean(value), boxX + boxWidth - 10, y + 8);
        ctx.textAlign = "left";
        ctx.lineWidth = 1;
        y += 34;
      });
    }
    ctx.font = "13px Arial";
    ctx.fillText(`Generated by Apex Engineering ERP · ${new Date().toLocaleString()}`, margin, height - 28);
    const base = meaningfulFilename(filename || title);
    const pageSuffix = pages.length > 1 ? `-page-${String(pageIndex + 1).padStart(2, "0")}` : "";
    downloadCanvas(canvas, `${base}${pageSuffix}.png`, pageIndex * 250);
  });
}

export function downloadInvoiceImage(sale, state) {
  const party = state.parties.find(item => item.id === sale.partyId);
  const lookupName = line => state.items.find(item => item.id === line.itemId)?.name || state.rawMaterials?.find(item => item.id === line.itemId)?.name || line.itemName || "Item";
  const currency = value => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 2 }).format(Number(value || 0)).replace("PKR", "Rs");
  downloadTableImage({
    company: state.company,
    title: `Sales invoice ${sale.document}`,
    subtitle: `${party?.name || "Customer"} · ${sale.date}${sale.dueDate ? ` · Due ${sale.dueDate}` : ""}`,
    headers: ["Item", "Quantity", "Price per unit", "Line total"],
    rows: sale.lines.map(line => [lookupName(line), line.quantity, currency(line.rate), currency(Number(line.quantity) * Number(line.rate))]),
    summary: [["Subtotal", currency(sale.subtotal)], ["Discount", currency(sale.discount)], ["Tax / charges", currency(Number(sale.tax) + Number(sale.charges))], ["Received", currency(sale.paid)], ["Balance", currency(Number(sale.total) - Number(sale.paid))], ["Invoice total", currency(sale.total)]],
    filename: meaningfulFilename(party?.name || "Customer", sale.document, "invoice")
  });
}
