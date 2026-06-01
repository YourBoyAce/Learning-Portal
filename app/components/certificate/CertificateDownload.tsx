
"use client";

import { useRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

import Certificate from "./Certificate";

interface Props {
  userName?: string;
  studentName?: string;
  courseName: string;
  completedDate?: string;
  issuedDate?: string;
}

export default function CertificateDownload({
  userName,
  studentName,
  courseName,
  completedDate,
  issuedDate,
}: Props) {
  const certificateRef = useRef<HTMLDivElement>(null);

  const finalUserName =
    userName || studentName || "Learner";

  const finalCompletedDate =
    completedDate ||
    issuedDate ||
    new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const downloadCertificate = async () => {
    try {
      if (!certificateRef.current) {
        console.error("Certificate ref not found");
        return;
      }

      const dataUrl = await toPng(
        certificateRef.current,
        {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: "#ffffff",
        }
      );

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [1200, 850],
      });

      pdf.addImage(
        dataUrl,
        "PNG",
        0,
        0,
        1200,
        850
      );

      pdf.save(
        `${courseName
          .replace(/[^a-zA-Z0-9]/g, "-")
          .toLowerCase()}-certificate.pdf`
      );
    } catch (error) {
      console.error(
        "Certificate download failed:",
        error
      );
    }
  };

  return (
    <>
      <button
        onClick={downloadCertificate}
        className="bg-[#174778] text-white px-6 py-3 rounded-xl hover:bg-[#113a63] transition-colors font-semibold"
      >
        Download Certificate
      </button>

      {/* Hidden certificate used for PDF generation */}
      <div
        style={{
          position: "fixed",
          left: "-10000px",
          top: "0",
          width: "1200px",
          height: "850px",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -9999,
        }}
      >
        <Certificate
          ref={certificateRef}
          userName={finalUserName}
          courseName={courseName}
          completedDate={finalCompletedDate}
        />
      </div>
    </>
  );
}