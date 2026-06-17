"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/app/styles/icons";
import { TYPOGRAPHY, TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Layers,
  DownloadCloud,
  FileCode,
  FileArchive,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

const ARTIFACT_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_ARTIFACTS_BUCKET || "course-artifacts";
const ARTIFACT_BUCKET_FALLBACKS = ["course-artifacts", "course_artifacts"];

interface Artifact {
  id: string;
  name: string;
  type: "PDF" | "ZIP" | "Code" | "Sheet" | "Other";
  courseName: string;
  courseId?: string | number;
  size: string;
  uploadDate: string;
  downloadsCount: number;
  status: "Published" | "Draft";
  description: string;

  // ADD THESE
  fileUrl?: string;
  filePath?: string;
}



export default function AdminArtifacts() {
  const getArtifactBucketCandidates = () =>
    Array.from(
      new Set([ARTIFACT_STORAGE_BUCKET, ...ARTIFACT_BUCKET_FALLBACKS])
    );

  const getArtifactContentType = (file: File) => {
    if (file.type) return file.type;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "csv") return "text/csv";
    if (ext === "xlsx") {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (ext === "xls") return "application/vnd.ms-excel";
    if (ext === "zip") return "application/zip";

    return "application/octet-stream";
  };

  const [searchTerm, setSearchTerm] = useState("");

  // Artifacts State
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);

  // Form State
  const [artName, setArtName] = useState("");
  const [artType, setArtType] = useState<
    "PDF" | "ZIP" | "Code" | "Sheet" | "Other"
  >("PDF");

  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState<string | number>("");

  const [artSize, setArtSize] = useState("1.0 MB");

  const [status, setStatus] = useState<"Published" | "Draft">(
    "Published"
  );

  const [description, setDescription] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(
    null
  );

  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState(false);

  const [deletingArtifact, setDeletingArtifact] =
    useState<Artifact | null>(null);

  // Courses
  const [dbCourses, setDbCourses] = useState<
    { id: string | number; title: string }[]
  >([]);

  /* =========================================================
     LOAD COURSES + ARTIFACTS
  ========================================================= */

  useEffect(() => {
    loadCourses();
    loadArtifacts();
  }, []);

  const loadCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("maincourses")
        .select("id, title")
        .order("title", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      setDbCourses(data || []);
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  };

  const loadArtifacts = async () => {
    try {
      const { data, error } = await supabase
        .from("course_artifacts")
        .select(`
        *,
        maincourses (
          title
        )
      `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      const mapped: Artifact[] =
        data?.map((item: any) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          courseName:
            item.maincourses?.title || "Unknown Course",
          courseId: item.course_id,
          size: item.size,
          uploadDate: item.created_at,
          downloadsCount: item.downloads_count || 0,
          status: item.status,
          description: item.description || "",
          fileUrl: item.file_url,
          filePath: item.file_path,
        })) || [];

      setArtifacts(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  /* =========================================================
     CREATE NEW
  ========================================================= */

  const handleCreateNew = () => {
    setIsEditing(false);

    setEditingArtifactId(null);

    setArtName("");

    setArtType("PDF");

    if (dbCourses.length > 0) {
      setCourseId(dbCourses[0].id);
      setCourseName(dbCourses[0].title);
    } else {
      setCourseId("");
      setCourseName("");
    }

    setArtSize("1.0 MB");

    setStatus("Published");

    setDescription("");

    setSelectedFile(null);

    setShowModal(true);
  };

  /* =========================================================
     EDIT
  ========================================================= */

  const handleEdit = (art: Artifact) => {
    setIsEditing(true);

    setEditingArtifactId(art.id);

    setArtName(art.name);

    setArtType(art.type);

    setCourseName(art.courseName);

    setCourseId(art.courseId || "");

    setArtSize(art.size);

    setStatus(art.status);

    setDescription(art.description);

    setSelectedFile(null);

    setShowModal(true);
  };

  /* =========================================================
     FILE CHANGE
  ========================================================= */

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setSelectedFile(file);

    setArtName(file.name);

    const sizeInMB = (
      file.size /
      (1024 * 1024)
    ).toFixed(1);

    if (Number(sizeInMB) > 0.1) {
      setArtSize(`${sizeInMB} MB`);
    } else {
      const sizeInKB = Math.round(file.size / 1024);

      setArtSize(`${sizeInKB} KB`);
    }

    const ext = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    if (ext === "pdf") {
      setArtType("PDF");
    } else if (
      ["zip", "rar", "tar", "gz"].includes(ext || "")
    ) {
      setArtType("ZIP");
    } else if (
      [
        "js",
        "ts",
        "json",
        "yml",
        "yaml",
        "py",
        "sh",
      ].includes(ext || "")
    ) {
      setArtType("Code");
    } else if (
      ["xls", "xlsx", "csv"].includes(ext || "")
    ) {
      setArtType("Sheet");
    } else {
      setArtType("Other");
    }
  };

  /* =========================================================
     SAVE ARTIFACT
  ========================================================= */

  const handleSaveArtifact = async () => {
    setIsUploading(true);
    try {
      if (!artName.trim() || !courseId) {
        showToast("Please complete all required fields.");
        return;
      }

      if (!selectedFile && !isEditing) {
        showToast("Please upload a file.");
        return;
      }

      let fileUrl = "";
      let filePath = "";

      // Upload File
      if (selectedFile) {
        const uniqueFileName = `${Date.now()}-${selectedFile.name
          }`;

        filePath = `artifacts/${uniqueFileName}`;

        let usedBucket = "";
        let lastUploadError: any = null;

        for (const bucket of getArtifactBucketCandidates()) {
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, selectedFile, {
              contentType: getArtifactContentType(selectedFile),
              cacheControl: "3600",
              upsert: false,
            });

          if (!uploadError) {
            usedBucket = bucket;
            lastUploadError = null;
            break;
          }

          lastUploadError = uploadError;
        }

        if (!usedBucket) {
          console.error(lastUploadError);
          showToast(
            `Failed to upload file: ${lastUploadError?.message || "Unknown error"}`
          );
          return;
        }

        const { data } = supabase.storage
          .from(usedBucket)
          .getPublicUrl(filePath);

        fileUrl = data.publicUrl;
      }

      let successMessage = "";

      // UPDATE
      if (isEditing && editingArtifactId) {
        const existing = artifacts.find(
          (a) => a.id === editingArtifactId
        );

        const { error } = await supabase
          .from("course_artifacts")
          .update({
            name: artName,
            type: artType,
            description,
            course_id: courseId,
            size: artSize,
            status,
            file_url:
              fileUrl || existing?.fileUrl || "",
            file_path:
              filePath || existing?.filePath || "",
          })
          .eq("id", editingArtifactId);

        if (error) {
          console.error(error);
          showToast("Failed to update artifact");
          return;
        }

        successMessage = selectedFile
          ? "Artifact updated and file uploaded successfully."
          : "Artifact details updated successfully.";
      } else {
        // CREATE
        const { error } = await supabase
          .from("course_artifacts")
          .insert({
            name: artName,
            type: artType,
            description,
            course_id: courseId,
            size: artSize,
            status,
            file_url: fileUrl,
            file_path: filePath,
            downloads_count: 0,
          });

        if (error) {
          console.error(error);
          showToast("Failed to save artifact");
          return;
        }

        successMessage = "Artifact uploaded successfully.";
      }

      await loadArtifacts();

      setShowModal(false);

      setSelectedFile(null);
      showToast(successMessage);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDeleteClick = (art: Artifact) => {
    setDeletingArtifact(art);

    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingArtifact) return;

    try {
      // Delete file from storage
      if (deletingArtifact.filePath) {
        for (const bucket of getArtifactBucketCandidates()) {
          const { error } = await supabase.storage
            .from(bucket)
            .remove([deletingArtifact.filePath]);
          if (!error) break;
        }
      }

      // Delete DB row
      const { error } = await supabase
        .from("course_artifacts")
        .delete()
        .eq("id", deletingArtifact.id);

      if (error) {
        console.error(error);
        return;
      }

      setArtifacts((prev) =>
        prev.filter(
          (a) => a.id !== deletingArtifact.id
        )
      );

      setShowDeleteConfirm(false);

      setDeletingArtifact(null);
    } catch (err) {
      console.error(err);
    }
  };

  /* =========================================================
     FILTERED ARTIFACTS
  ========================================================= */

  const filteredArtifacts = artifacts.filter(
    (art) =>
      art.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      art.courseName
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      art.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  /* =========================================================
     FILE ICONS
  ========================================================= */

  const getFileIcon = (type: Artifact["type"]) => {
    switch (type) {
      case "PDF":
        return (
          <FileText className="w-5 h-5 text-red-500" />
        );

      case "ZIP":
        return (
          <FileArchive className="w-5 h-5 text-amber-500" />
        );

      case "Code":
        return (
          <FileCode className="w-5 h-5 text-blue-500" />
        );

      case "Sheet":
        return (
          <BarChart3 className="w-5 h-5 text-emerald-500" />
        );

      default:
        return (
          <FileText className="w-5 h-5 text-gray-500" />
        );
    }
  };

  const getFileBadgeColor = (
    type: Artifact["type"]
  ) => {
    switch (type) {
      case "PDF":
        return "bg-red-50 text-red-700 border-red-100";

      case "ZIP":
        return "bg-amber-50 text-amber-700 border-amber-100";

      case "Code":
        return "bg-blue-50 text-blue-700 border-blue-100";

      case "Sheet":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";

      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  /* =========================================================
     STATS
  ========================================================= */

  const parseSizeToBytes = (size: string) => {
    if (!size) return 0;
    const normalized = size.trim().toUpperCase();
    const match = normalized.match(/^([\d.]+)\s*(B|BYTES|KB|MB|GB)$/);
    if (!match) return 0;

    const value = Number(match[1]);
    if (!Number.isFinite(value)) return 0;

    const unit = match[2];
    if (unit === "GB") return value * 1024 * 1024 * 1024;
    if (unit === "MB") return value * 1024 * 1024;
    if (unit === "KB") return value * 1024;
    return value;
  };

  const totalStorageBytes = artifacts.reduce(
    (total, artifact) => total + parseSizeToBytes(artifact.size),
    0,
  );
  const totalStorageMb = totalStorageBytes / (1024 * 1024);

  const stats = [
    {
      label: "Total Artifacts",
      value: artifacts.length.toString(),
      icon: ICONS.MATERIAL,
    },
    {
      label: "Total Downloads",
      value: artifacts
        .reduce(
          (acc, a) => acc + a.downloadsCount,
          0
        )
        .toString(),
      icon: ICONS.FOLDER,
    },
    {
      label: "Storage Used",
      value: `${totalStorageMb.toFixed(1)} MB`,
      icon: ICONS.STORAGE,
    },
    {
      label: "Published Items",
      value: artifacts
        .filter((a) => a.status === "Published")
        .length.toString(),
      icon: ICONS.ITEMS,
    },
  ];

  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Artifacts Management
            </h1>
            <p className={TYPOGRAPHY.BODY.fontSize + " " + TYPOGRAPHY.BODY.lineHeight + " " + TYPOGRAPHY.BODY.fontWeight + " text-gray-600"}>
              Upload study sheets, exercises, boilerplate repositories, and other downloadable resources.
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Upload Resource
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-[var(--radius-default)] p-6 shadow-sm border border-gray-100"
            >
              {/* Icon + Value */}
              <div className="flex items-center gap-4 mb-3">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg"
                  style={{
                    backgroundColor: "rgba(22,130,241,0.08)",
                  }}
                >
                  <Image
                    src={stat.icon}
                    alt={stat.label}
                    width={24}
                    height={24}
                  />
                </div>

                <h3 className="text-2xl font-bold text-brand-primary">
                  {stat.value}
                </h3>
              </div>

              {/* Label */}
              <p className="text-sm text-[var(--color-text-secondary)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-8 mb-6">
          <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>Artifact Repository</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search resource name or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-gray-500 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Artifacts List */}
        {filteredArtifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <DownloadCloud className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-800">
              No artifacts found
            </p>
            <p className={TYPOGRAPHY_CLASSES.CAPTION + " mb-6 max-w-md"}>
              Upload resources such as documentation, design models, or project files so your learners can download them in their student dashboard.
            </p>
            <Button
              onClick={handleCreateNew}
              className="w-1/4 justify-center">
              <Plus className="w-1/2 h-4" />
              Upload First Artifact
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      File Details
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Course
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Size
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Downloads
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Uploaded
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Status
                    </th>
                    <th className={`${TYPOGRAPHY_CLASSES.INNERHEADING}  px-4 py-3 text-left `}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredArtifacts.map((art) => (
                    <tr
                      key={art.id}
                      className="hover:bg-gray-50/30 transition-colors group"
                    >
                      <td className="p-4 pl-6 max-w-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-50 rounded-xl shrink-0">
                            {getFileIcon(art.type)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm p-4 pl-1 font-medium text-gray-500 leading-tight">
                              {art.name}
                            </h4>
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {art.description || "No description provided."}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-500 text-sm">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          {art.courseName}
                        </span>
                      </td>
                      <td className="text-sm p-4 pl-6 font-medium text-gray-500 leading-tight mb-1">
                        {art.size}
                      </td>
                      <td className="p-4 text-sm text-gray-500 text-center">
                        {art.downloadsCount}
                      </td>
                      <td className="text-sm p-4 pl-6 font-medium text-gray-500 leading-tight mb-1">
                        {new Date(art.uploadDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${art.status === "Published"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                            : "bg-gray-50 border-gray-200 text-gray-500"
                            }`}
                        >
                          {art.status}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleEdit(art)}
                            className="h-8 w-8 bg-white hover:bg-blue-100 justify-center p-0"
                            title="Edit Artifact"
                          >
                            <Pencil className="w-4 text-primary h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteClick(art)}
                            className="h-8 w-8 bg-white hover:bg-red-100 justify-center p-0"
                            title="Delete Artifact"
                          >
                            <Trash2 className="w-4 text-red-600 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- UPLOAD / EDIT MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className={TYPOGRAPHY_CLASSES.SUBHEADING}>
                {isEditing ? "Edit Resource" : "Upload New Resource"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="px-4 sm:px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* File Uploader box (Only if creating new, or allowed to update file) */}
              {!isEditing && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Artifact File
                  </label>
                  {selectedFile ? (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-white rounded-lg border border-gray-100 shrink-0">
                          {getFileIcon(artType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {artName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {artSize} • {artType} Format
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/20 transition-all group p-4">
                      <DownloadCloud className="w-10 h-10 text-gray-300 group-hover:text-brand-primary transition-colors mb-2" />
                      <span className="text-sm text-gray-700 font-semibold group-hover:text-brand-primary text-center">
                        Click or drag file to upload
                      </span>
                      <span className="text-xs text-gray-400 text-center mt-1">
                        PDF, ZIP, YAML, Excel spreadsheet up to 20MB
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.zip,.rar,.tar,.gz,.js,.ts,.json,.yml,.yaml,.py,.sh,.xls,.xlsx,.csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Resource Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Playwright Setup Cheat Sheet"
                  value={artName}
                  onChange={(e) => setArtName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              {/* Course Selection */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Associated Course
                </label>
                <select
                  value={courseId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setCourseId(selectedId);
                    const courseObj = dbCourses.find((c) => String(c.id) === String(selectedId));
                    if (courseObj) {
                      setCourseName(courseObj.title);
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                >
                  {dbCourses.length > 0 ? (
                    dbCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Playwright Mastery">Playwright Mastery</option>
                      <option value="CI/CD Foundations">CI/CD Foundations</option>
                      <option value="Ultimate Automation">Ultimate Automation</option>
                    </>
                  )}
                </select>
              </div>

              {/* Type & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Resource Type
                  </label>
                  <select
                    value={artType}
                    onChange={(e) =>
                      setArtType(e.target.value as Artifact["type"])
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="ZIP">ZIP Archive</option>
                    <option value="Code">YAML/Source Code</option>
                    <option value="Sheet">Spreadsheet</option>
                    <option value="Other">Other File Type</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Visibility Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "Published" | "Draft")
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                  >
                    <option value="Published">Published (Public)</option>
                    <option value="Draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Instructions / Description
                </label>
                <textarea
                  placeholder="Explain what this file is and how students should use it..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-gray-50/50 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 bg-white">
              <Button
                onClick={() => setShowModal(false)}
                className="w-full text-primary bg-white hover:bg-gray-100 justify-center sm:w-1/2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveArtifact}
                disabled={isUploading}
                className="w-full justify-center sm:w-1/2 flex items-center gap-2"
              >
                {isUploading ? "Uploading..." : (isEditing ? "Save Changes" : "Publish Resource")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION --- */}
      {showDeleteConfirm && deletingArtifact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Delete Artifact
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">{deletingArtifact.name}</strong>
                ? Students will immediately lose access to download this resource.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingArtifact(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-hover transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- TOAST NOTIFICATION --- */}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 bg-copy-dark text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="text-emerald-400" size={20} />
          <span className="text-sm font-semibold tracking-wide">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}
