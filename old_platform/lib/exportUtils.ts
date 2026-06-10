import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface QuotationItem {
  material_name?: string;
  quantity?: number;
  unit_price?: number;
  supplier_name?: string;
  city?: string;
  location?: string;
  district?: string;
}

interface QuotationData {
  company_name: string;
  person_name: string;
  contact_info: string;
  communication_date: string;
  city?: string;
  location?: string;
  district?: string;
  project_type?: string;
  project_size?: string;
  current_phase?: string;
  items: QuotationItem[];
  total: number;
  is_soft_quotation?: boolean;
}

export const exportQuotationToPDF = (data: QuotationData) => {
  const doc = new jsPDF();
  
  // Add greeting and header
  doc.setFontSize(10);
  doc.text('Peace be upon you and God\'s mercy and blessings,', 105, 15, { align: 'center' });
  
  doc.setFontSize(11);
  doc.text(`Dear ${data.company_name || 'N/A'},`, 105, 22, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text('We are pleased to present you with the price quotation for the requested materials as follows:', 105, 28, { align: 'center' });
  
  // Title
  doc.setFontSize(16);
  doc.text('QUOTATION - تسعيرة', 105, 38, { align: 'center' });
  
  // Quotation details section (right-aligned labels, Arabic style)
  doc.setFontSize(10);
  let yPos = 50;
  
  doc.text('Date - التاريخ:', 180, yPos, { align: 'right' });
  doc.text(data.communication_date, 120, yPos);
  yPos += 6;
  
  doc.text('To - إلى:', 180, yPos, { align: 'right' });
  doc.text(data.company_name || 'N/A', 120, yPos);
  yPos += 6;
  
  doc.text('Contact Person - جهة الاتصال:', 180, yPos, { align: 'right' });
  doc.text(data.person_name || 'N/A', 120, yPos);
  yPos += 6;
  
  doc.text('Contact Info - رقم التواصل:', 180, yPos, { align: 'right' });
  doc.text(data.contact_info || 'N/A', 120, yPos);
  yPos += 6;
  
  if (data.city || data.location || data.district) {
    doc.text('Location - الموقع:', 180, yPos, { align: 'right' });
    doc.text([data.city, data.district, data.location].filter(Boolean).join(' - '), 120, yPos);
    yPos += 6;
  }
  
  if (data.project_type) {
    doc.text('Project - المشروع:', 180, yPos, { align: 'right' });
    doc.text(data.project_type, 120, yPos);
    yPos += 6;
  }
  
  if (data.project_size) {
    doc.text('Project Size - حجم المشروع:', 180, yPos, { align: 'right' });
    doc.text(data.project_size, 120, yPos);
    yPos += 6;
  }
  
  if (data.current_phase) {
    doc.text('Current Phase - المرحلة الحالية:', 180, yPos, { align: 'right' });
    doc.text(data.current_phase, 120, yPos);
    yPos += 6;
  }
  
  // Add soft quotation badge if applicable
  if (data.is_soft_quotation) {
    yPos += 4;
    doc.setFillColor(255, 243, 205);
    doc.rect(15, yPos - 3, 180, 10, 'F');
    doc.setTextColor(133, 100, 4);
    doc.setFontSize(9);
    doc.text('⚠ Soft Quotation – prices are indicative only and based on unit rates, final amount depends on actual quantities.', 105, yPos + 2, { align: 'center' });
    doc.text('عرض سعر مبدئي – الأسعار استرشادية فقط وتعتمد على سعر الوحدة، المبلغ النهائي يعتمد على الكميات الفعلية.', 105, yPos + 6, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPos += 12;
  }
  
  // Add quotation items table
  const tableData = data.items.map((item, index) => [
    (index + 1).toString(),
    item.material_name || 'N/A',
    'Unit', // Unit of measure
    data.is_soft_quotation ? (item.quantity?.toString() || '—') : (item.quantity?.toString() || '0'),
    item.unit_price?.toFixed(2) || '0.00',
    data.is_soft_quotation ? '—' : ((item.quantity || 0) * (item.unit_price || 0)).toFixed(2),
    item.supplier_name || 'N/A'
  ]);
  
  const footerText = data.is_soft_quotation ? 'N/A' : data.total.toFixed(2);
  
  autoTable(doc, {
    startY: yPos + 5,
    head: [['Item\nالبند', 'Description\nالوصف', 'Unit\nالوحدة', 'Qty\nالعدد', 'Unit Price\nسعر الوحدة', 'Total Price\nالسعر الكلي', 'Supplier\nالمورد']],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [41, 128, 185],
      halign: 'center',
      fontSize: 9,
      cellPadding: 2
    },
    bodyStyles: {
      halign: 'center',
      fontSize: 9
    },
    footStyles: { 
      fillColor: [41, 128, 185], 
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 10
    },
    foot: [['', '', '', 'TOTAL\nالمجموع الكلي', '', footerText, '']],
  });
  
  // Save the PDF
  const fileName = `Quotation_${data.company_name}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export const exportQuotationToExcel = (data: QuotationData) => {
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare header data (bilingual format matching Arabic structure)
  const headerData = [
    ['Peace be upon you and God\'s mercy and blessings,'],
    [`Dear ${data.company_name || 'N/A'},`],
    ['We are pleased to present you with the price quotation for the requested materials as follows:'],
    [],
    ['QUOTATION - تسعيرة'],
    [],
    ['Date - التاريخ:', data.communication_date],
    ['To - إلى:', data.company_name || 'N/A'],
    ['Contact Person - جهة الاتصال:', data.person_name || 'N/A'],
    ['Contact Info - رقم التواصل:', data.contact_info || 'N/A'],
  ];
  
  // Add project details if available
  if (data.city || data.location || data.district) {
    headerData.push(['Location - الموقع:', [data.city, data.district, data.location].filter(Boolean).join(' - ')]);
  }
  if (data.project_type) {
    headerData.push(['Project - المشروع:', data.project_type]);
  }
  if (data.project_size) {
    headerData.push(['Project Size - حجم المشروع:', data.project_size]);
  }
  if (data.current_phase) {
    headerData.push(['Current Phase - المرحلة الحالية:', data.current_phase]);
  }
  
  // Add soft quotation notice if applicable
  if (data.is_soft_quotation) {
    headerData.push([]);
    headerData.push(['⚠ Soft Quotation – prices are indicative only and based on unit rates, final amount depends on actual quantities.']);
    headerData.push(['عرض سعر مبدئي – الأسعار استرشادية فقط وتعتمد على سعر الوحدة، المبلغ النهائي يعتمد على الكميات الفعلية.']);
  }
  
  headerData.push([]);
  
  // Prepare items data (bilingual headers)
  const itemsHeader = [
    'Item\nالبند',
    'Description\nالوصف', 
    'Unit\nالوحدة',
    'Qty\nالعدد',
    'Unit Price\nسعر الوحدة',
    'Total Price\nالسعر الكلي',
    'Supplier\nالمورد'
  ];
  
  const itemsData = data.items.map((item, index) => [
    (index + 1).toString(),
    item.material_name || 'N/A',
    'Unit', // Unit of measure
    data.is_soft_quotation ? (item.quantity || '—') : (item.quantity || 0),
    item.unit_price || 0,
    data.is_soft_quotation ? '—' : ((item.quantity || 0) * (item.unit_price || 0)),
    item.supplier_name || 'N/A'
  ]);
  
  // Add total row
  const totalRow = ['', '', '', 'TOTAL - المجموع الكلي', '', data.is_soft_quotation ? 'N/A' : data.total, ''];
  
  // Combine all data
  const wsData = [...headerData, itemsHeader, ...itemsData, totalRow];
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // Item number
    { wch: 40 }, // Description
    { wch: 12 }, // Unit
    { wch: 12 }, // Quantity
    { wch: 15 }, // Unit Price
    { wch: 15 }, // Total Price
    { wch: 25 }, // Supplier
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
  
  // Save the file
  const fileName = `Quotation_${data.company_name}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
