import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface GeneratePdfOptions {
  filename: string;
  element: HTMLElement;
  scale?: number;
}

/**
 * Generates a PDF from an HTML element using html2canvas + jsPDF.
 * This approach renders the exact visual appearance including fonts, colors, and layouts.
 */
export async function generatePdfFromElement({
  filename,
  element,
  scale = 2,
}: GeneratePdfOptions): Promise<void> {
  // Render DOM to canvas
  const canvas = await html2canvas(element, {
    scale, // Higher quality
    useCORS: true, // Allow cross-origin images (logo)
    logging: false,
    backgroundColor: "#ffffff",
    // Ensure we capture everything
    scrollX: 0,
    scrollY: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  // A4 dimensions in mm
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;

  // Calculate dimensions
  const imgWidth = CONTENT_WIDTH_MM;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Create PDF
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const imgData = canvas.toDataURL("image/png");

  // Handle multi-page content
  let heightLeft = imgHeight;
  let position = MARGIN_MM;
  const pageContentHeight = A4_HEIGHT_MM - MARGIN_MM * 2;

  // First page
  pdf.addImage(imgData, "PNG", MARGIN_MM, position, imgWidth, imgHeight);
  heightLeft -= pageContentHeight;

  // Additional pages if needed
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + MARGIN_MM;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", MARGIN_MM, position, imgWidth, imgHeight);
    heightLeft -= pageContentHeight;
  }

  pdf.save(filename);
}
