"use client";

import { useState, useEffect } from "react";
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
  HardDrive,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

interface Artifact {
  id: string;
  name: string;
  type: "PDF" | "ZIP" | "Code" | "Sheet" | "Other";
  courseName: string;
  courseId?: string | number; // Added to map to Supabase maincourses table
  size: string;
  uploadDate: string;
  downloadsCount: number;
  status: "Published" | "Draft";
  description: string;
}

const INITIAL_ARTIFACTS: Artifact[] = [
  {
    id: "art-1",
    name: "Playwright Cheat Sheet & Best Practices.pdf",
    type: "PDF",
    courseName: "Playwright Mastery",
    size: "1.8 MB",
    uploadDate: "2026-05-10",
    downloadsCount: 142,
    status: "Published",
    description: "A quick-reference study guide covering selectors, assertions, and command line tools.",
  },
  {
    id: "art-2",
    name: "complete-automation-framework-starter.zip",
    type: "ZIP",
    courseName: "Ultimate Automation",
    size: "4.2 MB",
    uploadDate: "2026-05-12",
    downloadsCount: 89,
    status: "Published",
    description: "Full boilerplate code repository with pre-configured directory layouts and configurations.",
  },
  {
    id: "art-3",
    name: "github-actions-workflow-templates.yaml",
    type: "Code",
    courseName: "CI/CD Foundations",
    size: "24 KB",
    uploadDate: "2026-05-14",
    downloadsCount: 64,
    status: "Published",
    description: "Production-ready YAML files for setting up build, lint, and test jobs in GitHub Actions.",
  },
  {
    id: "art-4",
    name: "test-metrics-calculation-sheet.xlsx",
    type: "Sheet",
    courseName: "Ultimate Automation",
    size: "350 KB",
    uploadDate: "2026-05-17",
    downloadsCount: 12,
    status: "Draft",
    description: "Template Excel worksheet for tracking test execution metrics, flaky tests, and regression rate.",
  },
];

export default function AdminArtifacts() {
  const [artifacts, setArtifacts] = useState<Artifact[]>(INITIAL_ARTIFACTS);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);

  // Form State
  const [artName, setArtName] = useState("");
  const [artType, setArtType] = useState<"PDF" | "ZIP" | "Code" | "Sheet" | "Other">("PDF");
  const [courseName, setCourseName] = useState("Playwright Mastery");
  const [courseId, setCourseId] = useState<string | number>("");
  const [artSize, setArtSize] = useState("1.0 MB");
  const [status, setStatus] = useState<"Published" | "Draft">("Published");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Load courses and artifacts on mount
  const [dbCourses, setDbCourses] = useState<{ id: string | number; title: string }[]>([]);

  useEffect(() => {
    // 1. Fetch courses from DB
    const loadCourses = async () => {
      try {
        const { data, error } = await supabase
          .from("maincourses")
          .select("id, title")
          .order("title", { ascending: true });
        if (data && !error) {
          setDbCourses(data);
        }
      } catch (err) {
        console.error("Failed to load courses:", err);
      }
    };
    loadCourses();

    // 2. Load artifacts from localStorage
    const saved = localStorage.getItem("automate_portal_artifacts");
    if (saved) {
      try {
        setArtifacts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse artifacts from local storage:", e);
      }
    } else {
      localStorage.setItem("automate_portal_artifacts", JSON.stringify(INITIAL_ARTIFACTS));
    }
  }, []);

  // Sync artifacts to localStorage on change
  useEffect(() => {
    if (artifacts && artifacts !== INITIAL_ARTIFACTS) {
      localStorage.setItem("automate_portal_artifacts", JSON.stringify(artifacts));
    }
  }, [artifacts]);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingArtifact, setDeletingArtifact] = useState<Artifact | null>(null);

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
      setCourseName("Playwright Mastery");
    }
    setArtSize("1.0 MB");
    setStatus("Published");
    setDescription("");
    setSelectedFile(null);
    setShowModal(true);
  };

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
    setSelectedFile(art.name);
    setShowModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArtName(file.name);
      setSelectedFile(file.name);
      
      // Calculate file size formatted nicely
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      if (Number(sizeInMB) > 0.1) {
        setArtSize(`${sizeInMB} MB`);
      } else {
        const sizeInKB = Math.round(file.size / 1024);
        setArtSize(`${sizeInKB} KB`);
      }

      // Infer file type
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") setArtType("PDF");
      else if (["zip", "rar", "tar", "gz"].includes(ext || "")) setArtType("ZIP");
      else if (["js", "ts", "json", "yml", "yaml", "py", "sh"].includes(ext || "")) setArtType("Code");
      else if (["xls", "xlsx", "csv"].includes(ext || "")) setArtType("Sheet");
      else setArtType("Other");
    }
  };

  const handleSaveArtifact = () => {
    if (!artName.trim() || !courseName.trim()) {
      alert("Please upload a file or specify the resource name.");
      return;
    }

    if (isEditing && editingArtifactId) {
      setArtifacts((prev) =>
        prev.map((art) =>
          art.id === editingArtifactId
            ? {
                ...art,
                name: artName,
                type: artType,
                courseName,
                courseId,
                size: artSize,
                status,
                description,
              }
            : art
        )
      );
    } else {
      const newArt: Artifact = {
        id: `art-${Date.now()}`,
        name: artName,
        type: artType,
        courseName,
        courseId,
        size: artSize,
        uploadDate: new Date().toISOString().split("T")[0],
        downloadsCount: 0,
        status,
        description,
      };
      setArtifacts((prev) => [newArt, ...prev]);
    }

    setShowModal(false);
  };

  const handleDeleteClick = (art: Artifact) => {
    setDeletingArtifact(art);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deletingArtifact) {
      setArtifacts((prev) => prev.filter((a) => a.id !== deletingArtifact.id));
      setShowDeleteConfirm(false);
      setDeletingArtifact(null);
    }
  };

  const filteredArtifacts = artifacts.filter(
    (art) =>
      art.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFileIcon = (type: Artifact["type"]) => {
    switch (type) {
      case "PDF":
        return <FileText className="w-5 h-5 text-red-500" />;
      case "ZIP":
        return <FileArchive className="w-5 h-5 text-amber-500" />;
      case "Code":
        return <FileCode className="w-5 h-5 text-blue-500" />;
      case "Sheet":
        return <BarChart3 className="w-5 h-5 text-emerald-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getFileBadgeColor = (type: Artifact["type"]) => {
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

  const stats = [
    {
      label: "Total Artifacts",
      value: artifacts.length.toString(),
      icon: FileText,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "Total Downloads",
      value: artifacts.reduce((acc, a) => acc + a.downloadsCount, 0).toString(),
      icon: DownloadCloud,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      label: "Storage Used",
      value: "6.4 MB",
      icon: HardDrive,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: "Published items",
      value: artifacts.filter((a) => a.status === "Published").length.toString(),
      icon: CheckCircle,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#2283FF] tracking-tight">
              Artifacts Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload study sheets, exercises, boilerplate repositories, and other downloadable resources.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="bg-[#2283FF] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Upload Resource
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4"
            >
              <div
                className={`w-12 h-12 ${stat.iconBg} rounded-xl flex items-center justify-center shrink-0`}
              >
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900">Artifact Repository</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search resource name or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2283FF] focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Artifacts List */}
        {filteredArtifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <DownloadCloud className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg text-gray-900 font-bold mb-2">
              No artifacts found
            </p>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              Upload resources such as documentation, design models, or project files so your learners can download them in their student dashboard.
            </p>
            <button
              onClick={handleCreateNew}
              className="bg-[#2283FF] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Upload First Artifact
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider pl-6">
                      File Details
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Size
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Downloads
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Uploaded
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Status
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">
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
                            <h4 className="font-semibold text-gray-900 text-sm truncate">
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
                      <td className="p-4 text-sm text-gray-700 text-center font-medium">
                        {art.size}
                      </td>
                      <td className="p-4 text-sm text-gray-500 text-center">
                        {art.downloadsCount}
                      </td>
                      <td className="p-4 text-sm text-gray-400 text-center">
                        {new Date(art.uploadDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            art.status === "Published"
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                              : "bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                        >
                          {art.status}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(art)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#2283FF] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Artifact"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(art)}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Artifact"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
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
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* File Uploader box (Only if creating new, or allowed to update file) */}
              {!isEditing && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Artifact File
                  </label>
                  {selectedFile ? (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
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
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#2283FF] hover:bg-blue-50/20 transition-all group p-4">
                      <DownloadCloud className="w-10 h-10 text-gray-300 group-hover:text-[#2283FF] transition-colors mb-2" />
                      <span className="text-sm text-gray-700 font-semibold group-hover:text-[#2283FF] text-center">
                        Click or drag file to upload
                      </span>
                      <span className="text-xs text-gray-400 text-center mt-1">
                        PDF, ZIP, YAML, Excel spreadsheet up to 20MB
                      </span>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Resource Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Playwright Setup Cheat Sheet"
                  value={artName}
                  onChange={(e) => setArtName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20"
                />
              </div>

              {/* Course Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20 bg-white"
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
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Resource Type
                  </label>
                  <select
                    value={artType}
                    onChange={(e) =>
                      setArtType(e.target.value as Artifact["type"])
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20 bg-white"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="ZIP">ZIP Archive</option>
                    <option value="Code">YAML/Source Code</option>
                    <option value="Sheet">Spreadsheet</option>
                    <option value="Other">Other File Type</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Visibility Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "Published" | "Draft")
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20 bg-white"
                  >
                    <option value="Published">Published (Public)</option>
                    <option value="Draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Instructions / Description
                </label>
                <textarea
                  placeholder="Explain what this file is and how students should use it..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2283FF] focus:ring-2 focus:ring-[#2283FF]/20 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArtifact}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#2283FF] rounded-lg hover:opacity-90 transition-opacity"
              >
                {isEditing ? "Save Changes" : "Publish Resource"}
              </button>
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
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
