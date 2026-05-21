import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function generateCertificatePDF(studentName: string, courseName: string) {
  const pdfDoc = await PDFDocument.create();

  // Standard certificate landscape layout (792 x 612 points)
  const page = pdfDoc.addPage([792, 612]);
  
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // 1. Fetch the certificate template image from the public directory
  const response = await fetch("/cert.jpeg");
  const imageBytes = await response.arrayBuffer();

  // 2. Embed the JPEG template image into the PDF
  const certImage = await pdfDoc.embedJpg(imageBytes);

  // 3. Draw the template image to fit the entire page exactly
  page.drawImage(certImage, {
    x: 0,
    y: 0,
    width: 792,
    height: 612,
  });

  // Logo color matching (#051c32 / #052c50)
  const logoColor = rgb(0.05, 0.28, 0.50);

  // 4. Overlay dynamic Course Title
  page.drawText(courseName, {
    x: 120,
    y: 338,
    size: 22,
    font: helveticaBold,
    color: logoColor,
  });

  // 5. Overlay dynamic Student Name
  page.drawText(studentName, {
    x: 120,
    y: 225,
    size: 28,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // 6. Overlay dynamic Date Issued (centered above the line)
  const currentDateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const dateStrWidth = helveticaBold.widthOfTextAtSize(currentDateStr, 11);
  page.drawText(currentDateStr, {
    x: 210 + (160 - dateStrWidth) / 2,
    y: 98,
    size: 11,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // 7. Overlay dynamic Authorized Signature (centered above the line)
  const signatureText = "Auto-Mate Team";
  const sigWidth = helveticaOblique.widthOfTextAtSize(signatureText, 14);
  page.drawText(signatureText, {
    x: 490 + (160 - sigWidth) / 2,
    y: 98,
    size: 14,
    font: helveticaOblique,
    color: logoColor,
  });

  // 8. Serialize the PDFDocument to bytes
  const pdfBytes = await pdfDoc.save();

  // Create a Blob from the PDF bytes and trigger browser download
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Certificate_${courseName.replace(/\s+/g, "_")}.pdf`;
  link.click();
}
