"use client";

import { useState } from "react";

interface Course {
  id: number;
  title: string;
  description: string;
  students: number;
  status: "Published" | "Draft";
  lessons: number;
  revenue: string;
  category: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

export default function AdminCourses() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editedCourse, setEditedCourse] = useState<Course | null>(null);

  const courses: Course[] = [
    { 
      id: 1, 
      title: "Playwright Mastery", 
      description: "Master end-to-end testing with Playwright. Learn modern automation techniques, best practices, and advanced patterns.",
      students: 1420, 
      status: "Published", 
      lessons: 25, 
      revenue: "$14,200",
      category: "Testing",
      duration: "12 hours",
      level: "Intermediate"
    },
    { 
      id: 2, 
      title: "Gen AI Fundamentals", 
      description: "Introduction to Generative AI concepts, tools, and applications in modern software development.",
      students: 2310, 
      status: "Published", 
      lessons: 20, 
      revenue: "$23,100",
      category: "AI",
      duration: "8 hours",
      level: "Beginner"
    },
    { 
      id: 3, 
      title: "Selenium Advanced", 
      description: "Advanced Selenium techniques for complex test scenarios, framework design, and CI/CD integration.",
      students: 980, 
      status: "Published", 
      lessons: 30, 
      revenue: "$9,800",
      category: "Testing",
      duration: "15 hours",
      level: "Advanced"
    },
    { 
      id: 4, 
      title: "API Testing with Postman", 
      description: "Comprehensive API testing using Postman. Learn to design, execute, and automate API tests.",
      students: 1850, 
      status: "Draft", 
      lessons: 15, 
      revenue: "$0",
      category: "Testing",
      duration: "6 hours",
      level: "Intermediate"
    },
    { 
      id: 5, 
      title: "Performance Testing", 
      description: "Learn performance testing methodologies, tools like JMeter and Gatling, and optimization strategies.",
      students: 720, 
      status: "Published", 
      lessons: 18, 
      revenue: "$7,200",
      category: "Testing",
      duration: "10 hours",
      level: "Advanced"
    },
  ];

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setEditedCourse({ ...course });
  };

  const handleSaveCourse = () => {
    // In a real app, this would save to a database
    setSelectedCourse(editedCourse);
    // Show success message
  };

  const handleCreateNew = () => {
    const newCourse: Course = {
      id: courses.length + 1,
      title: "",
      description: "",
      students: 0,
      status: "Draft",
      lessons: 0,
      revenue: "$0",
      category: "",
      duration: "",
      level: "Beginner"
    };
    setSelectedCourse(newCourse);
    setEditedCourse({ ...newCourse });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Course Management
            </h1>
            <p className="text-sm text-gray-500 max-w-2xl">
              Create, edit, and manage your course catalog. Select a course to modify its content, structure, and settings.
            </p>
          </div>
          <button 
            onClick={handleCreateNew}
            className="mt-4 md:mt-0 bg-[#2563EB] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Course
          </button>
        </div>

        {/* Main Content - 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Panel - Course List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              
              {/* Search */}
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              {/* Course List */}
              <div className="max-h-[600px] overflow-y-auto">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => handleSelectCourse(course)}
                    className={`p-4 border-b border-gray-50 cursor-pointer transition-colors ${
                      selectedCourse?.id === course.id ? "bg-blue-50 border-l-4 border-l-[#2563EB]" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 flex-1">{course.title}</h4>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        course.status === "Published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {course.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{course.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{course.lessons} lessons</span>
                      <span>•</span>
                      <span>{course.students} students</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Course Details/Edit */}
          <div className="lg:col-span-2">
            {editedCourse ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                
                {/* Edit Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editedCourse.id > courses.length ? "Create New Course" : "Edit Course"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      editedCourse.status === "Published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {editedCourse.status}
                    </span>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Course Title
                    </label>
                    <input
                      type="text"
                      value={editedCourse.title}
                      onChange={(e) => setEditedCourse({ ...editedCourse, title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                      placeholder="Enter course title"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Description
                    </label>
                    <textarea
                      value={editedCourse.description}
                      onChange={(e) => setEditedCourse({ ...editedCourse, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-none"
                      placeholder="Enter course description"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Category
                      </label>
                      <input
                        type="text"
                        value={editedCourse.category}
                        onChange={(e) => setEditedCourse({ ...editedCourse, category: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        placeholder="e.g., Testing"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={editedCourse.duration}
                        onChange={(e) => setEditedCourse({ ...editedCourse, duration: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        placeholder="e.g., 12 hours"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Level
                      </label>
                      <select
                        value={editedCourse.level}
                        onChange={(e) => setEditedCourse({ ...editedCourse, level: e.target.value as "Beginner" | "Intermediate" | "Advanced" })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                      >
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Status
                      </label>
                      <select
                        value={editedCourse.status}
                        onChange={(e) => setEditedCourse({ ...editedCourse, status: e.target.value as "Published" | "Draft" })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                      >
                        <option>Draft</option>
                        <option>Published</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Number of Lessons
                      </label>
                      <input
                        type="number"
                        value={editedCourse.lessons}
                        onChange={(e) => setEditedCourse({ ...editedCourse, lessons: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <button
                      onClick={handleSaveCourse}
                      className="flex-1 bg-[#2563EB] text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setSelectedCourse(null)}
                      className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Course</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  Choose a course from the list to view and edit its details, or create a new course.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}