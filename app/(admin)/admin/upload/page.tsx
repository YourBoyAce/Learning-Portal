"use client";

import { useState } from "react";

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState("");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setFileName(file.name);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  const courses = [
    {
      id: 1,
      title: "Classical Rhetoric in Modernity",
      description: "Exploring ancient rhetorical techniques in contemporary discourse.",
      views: "1.2k Views",
      updated: "Updated today",
      active: true,
    },
    {
      id: 2,
      title: "The Ethics of Bio-Design",
      description: "Moral considerations in biological and architectural design.",
      views: "856 Views",
      updated: "Updated yesterday",
      active: true,
    },
    {
      id: 3,
      title: "Hermeneutics of Narrative",
      description: "Interpretation strategies for narrative structures.",
      views: "2.3k Views",
      updated: "Updated 2 days ago",
      active: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            ADMIN PORTAL / CONTENT MANAGEMENT
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Course & Video Management
          </h1>
          <p className="text-sm text-gray-500 max-w-3xl">
            Orchestrate your intellectual offerings. Create new curricula, upload high-fidelity instructional media, and curate the learner experience within a single authoritative interface.
          </p>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Left Panel - Forms */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Add New Course Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Course</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Course Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Architectural Mastery"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    placeholder="Define the pedagogical scope..."
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] resize-none"
                  />
                </div>

                <button className="w-full bg-[#1D4ED8] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors">
                  Initialize Course
                </button>
              </div>
            </div>

            {/* Upload New Video Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Video</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Select Curriculum
                  </label>
                  <select
                    value={selectedCurriculum}
                    onChange={(e) => setSelectedCurriculum(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] cursor-pointer"
                  >
                    <option value="">Select curriculum...</option>
                    <option>Classical Rhetoric in Modernity</option>
                    <option>The Ethics of Bio-Design</option>
                    <option>Hermeneutics of Narrative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Video Title
                  </label>
                  <input
                    type="text"
                    placeholder="Session 1: Introduction to Discourse"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                  />
                </div>

                {/* Upload Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-[#1D4ED8] bg-blue-50"
                      : "border-dashed border-gray-300 hover:border-gray-400"
                  }`}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>

                  {fileName ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 mb-1">{fileName}</p>
                      <p className="text-xs text-gray-500">File selected</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-900 mb-1">
                        Drop asset or click to browse
                      </p>
                      <p className="text-xs text-gray-500">MP4, MOV up to 2GB</p>
                    </>
                  )}
                </div>

                <button className="w-full bg-[#1D4ED8] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors">
                  Queue Video Asset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Active Curriculum */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Active Curriculum</h3>
                <a href="#" className="text-sm text-[#1D4ED8] font-medium hover:underline">
                  View All Archives →
                </a>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courses.map((course) => (
                  <div key={course.id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-[#1D4ED8] transition-colors cursor-pointer">
                    <div className="h-32 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">{course.title}</h4>
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{course.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span>{course.views}</span>
                        <span>{course.updated}</span>
                      </div>
                      <button className="w-full px-3 py-2 bg-gray-50 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">
                        Add Content
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add New Card */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:border-[#1D4ED8] transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Establish New Domain</p>
                  <p className="text-xs text-gray-500">Initiate a new track</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Analytics Bar */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Management Analytics</h3>
              <p className="text-sm text-gray-500">
                Your curricula reached 14,892 scholars this month. Content engagement is up 23% compared to last period.
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Enrollments</p>
                <p className="text-2xl font-bold text-gray-900">842</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">68%</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}