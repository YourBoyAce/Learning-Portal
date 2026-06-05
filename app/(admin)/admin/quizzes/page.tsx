"use client";

import { useState, useEffect } from "react";
import {Button} from "@/components/ui/button";
import {ICONS} from "@/app/styles/icons";
import { TYPOGRAPHY_CLASSES } from "@/app/styles/typography";
import Image from "next/image";
import {
  HelpCircle,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  PlusCircle,
  Layers,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // Index 0-3
}

interface Quiz {
  id: string;
  title: string;
  courseName: string;
  courseId?: string | number; // Added to reference Supabase maincourses table
  questionsCount: number;
  passingScore: number; // percentage, e.g. 80
  attemptsCount: number;
  averageScore: number; // percentage
  status: "Active" | "Inactive";
  questions: Question[];
}

const INITIAL_QUIZZES: Quiz[] = [
  {
    id: "quiz-1",
    title: "Playwright Core Concepts",
    courseName: "Playwright Mastery",
    questionsCount: 5,
    passingScore: 80,
    attemptsCount: 48,
    averageScore: 86,
    status: "Active",
    questions: [
      {
        id: "q-1-1",
        text: "Which command is used to run Playwright tests in headless mode?",
        options: [
          "npx playwright test",
          "npx playwright test --headed",
          "npx playwright run",
          "npx playwright start",
        ],
        correctAnswer: 0,
      },
      {
        id: "q-1-2",
        text: "What is the default test timeout in Playwright?",
        options: ["10 seconds", "30 seconds", "45 seconds", "60 seconds"],
        correctAnswer: 1,
      },
      {
        id: "q-1-3",
        text: "Which fixture provides a clean browser context for each test?",
        options: ["browser", "context", "page", "request"],
        correctAnswer: 2,
      },
      {
        id: "q-1-4",
        text: "How do you generate codegen scripts in Playwright?",
        options: [
          "npx playwright record",
          "npx playwright codegen",
          "npx playwright generate",
          "npx playwright build",
        ],
        correctAnswer: 1,
      },
      {
        id: "q-1-5",
        text: "Which method is used to wait for a network response in Playwright?",
        options: [
          "page.waitForLoadState()",
          "page.waitForNavigation()",
          "page.waitForResponse()",
          "page.waitForSelector()",
        ],
        correctAnswer: 2,
      },
    ],
  },
  {
    id: "quiz-2",
    title: "GitHub Actions CI/CD Basics",
    courseName: "CI/CD Foundations",
    questionsCount: 3,
    passingScore: 70,
    attemptsCount: 32,
    averageScore: 78,
    status: "Active",
    questions: [
      {
        id: "q-2-1",
        text: "In GitHub Actions, what is the default filename and extension for workflows?",
        options: [
          ".github/workflows/main.json",
          ".github/workflows/main.yml",
          "config/workflows/main.yml",
          ".github/actions/main.yml",
        ],
        correctAnswer: 1,
      },
      {
        id: "q-2-2",
        text: "Which keyword defines the triggers for a GitHub Actions workflow?",
        options: ["trigger", "events", "on", "when"],
        correctAnswer: 2,
      },
      {
        id: "q-2-3",
        text: "Where do self-hosted runners execute workflow jobs?",
        options: [
          "On GitHub's cloud virtual machines",
          "On your own local or cloud infrastructure",
          "Directly in the web browser console",
          "Inside the GitHub repository's git folder",
        ],
        correctAnswer: 1,
      },
    ],
  },
  {
    id: "quiz-3",
    title: "Advanced Locators and Assertions",
    courseName: "Ultimate Automation",
    questionsCount: 4,
    passingScore: 80,
    attemptsCount: 15,
    averageScore: 74,
    status: "Inactive",
    questions: [
      {
        id: "q-3-1",
        text: "Which Playwright assertion is used to check if an element is visible?",
        options: [
          "await expect(locator).toBeVisible()",
          "await expect(locator).isVisible()",
          "await expect(locator).toExist()",
          "await expect(locator).toBePresent()",
        ],
        correctAnswer: 0,
      },
      {
        id: "q-3-2",
        text: "Which locator strategy is highly recommended for accessibility-friendly testing?",
        options: [
          "page.locator('xpath=...')",
          "page.getByRole()",
          "page.locator('.css-class')",
          "page.locator('#element-id')",
        ],
        correctAnswer: 1,
      },
    ],
  },
];

export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>(INITIAL_QUIZZES);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // Form State
  const [quizTitle, setQuizTitle] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState<string | number>("");
  const [passingScore, setPassingScore] = useState(80);
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: "q-temp-1",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
    },
  ]);

  // Load courses and quizzes on mount
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

    // 2. Load quizzes from localStorage
    const saved = localStorage.getItem("automate_portal_quizzes");
    if (saved) {
      try {
        setQuizzes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse quizzes from local storage:", e);
      }
    } else {
      localStorage.setItem("automate_portal_quizzes", JSON.stringify(INITIAL_QUIZZES));
    }
  }, []);

  // Sync quizzes to localStorage on change
  useEffect(() => {
    if (quizzes && quizzes !== INITIAL_QUIZZES) {
      localStorage.setItem("automate_portal_quizzes", JSON.stringify(quizzes));
    }
  }, [quizzes]);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<Quiz | null>(null);

  const handleCreateNew = () => {
    setIsEditing(false);
    setEditingQuizId(null);
    setQuizTitle("");
    if (dbCourses.length > 0) {
      setCourseId(dbCourses[0].id);
      setCourseName(dbCourses[0].title);
    } else {
      setCourseId("");
      setCourseName("Playwright Mastery");
    }
    setPassingScore(80);
    setStatus("Active");
    setQuestions([
      {
        id: "q-temp-1",
        text: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      },
    ]);
    setShowModal(true);
  };

  const handleEdit = (quiz: Quiz) => {
    setIsEditing(true);
    setEditingQuizId(quiz.id);
    setQuizTitle(quiz.title);
    setCourseName(quiz.courseName);
    setCourseId(quiz.courseId || "");
    setPassingScore(quiz.passingScore);
    setStatus(quiz.status);
    setQuestions(
      quiz.questions.length > 0
        ? quiz.questions.map((q) => ({ ...q }))
        : [
            {
              id: "q-temp-1",
              text: "",
              options: ["", "", "", ""],
              correctAnswer: 0,
            },
          ]
    );
    setShowModal(true);
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q-temp-${Date.now()}-${questions.length}`,
        text: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleQuestionTextChange = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].text = text;
    setQuestions(updated);
  };

  const handleOptionChange = (
    qIndex: number,
    oIndex: number,
    value: string
  ) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const handleCorrectAnswerChange = (qIndex: number, value: number) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = value;
    setQuestions(updated);
  };

  const handleSaveQuiz = () => {
    if (!quizTitle.trim() || !courseName.trim()) {
      alert("Please enter a quiz title and select or enter a course.");
      return;
    }

    const validQuestions = questions.filter((q) => q.text.trim() !== "");
    if (validQuestions.length === 0) {
      alert("Please add at least one question with text.");
      return;
    }

    if (isEditing && editingQuizId) {
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === editingQuizId
            ? {
                ...q,
                title: quizTitle,
                courseName,
                courseId,
                passingScore,
                status,
                questionsCount: validQuestions.length,
                questions: validQuestions,
              }
            : q
        )
      );
    } else {
      const newQuiz: Quiz = {
        id: `quiz-${Date.now()}`,
        title: quizTitle,
        courseName,
        courseId,
        passingScore,
        status,
        questionsCount: validQuestions.length,
        attemptsCount: 0,
        averageScore: 0,
        questions: validQuestions,
      };
      setQuizzes((prev) => [newQuiz, ...prev]);
    }

    setShowModal(false);
  };

  const handleDeleteClick = (quiz: Quiz) => {
    setDeletingQuiz(quiz);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deletingQuiz) {
      setQuizzes((prev) => prev.filter((q) => q.id !== deletingQuiz.id));
      setShowDeleteConfirm(false);
      setDeletingQuiz(null);
    }
  };

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.courseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
  {
    label: "Total Quizzes",
    value: quizzes.length.toString(),
    icon: ICONS.BULB,
  },
  {
    label: "Active Quizzes",
    value: quizzes.filter((q) => q.status === "Active").length.toString(),
    icon: ICONS.CLOCK,
  },
  {
    label: "Total Attempts",
    value: quizzes
      .reduce((acc, q) => acc + q.attemptsCount, 0)
      .toString(),
    icon: ICONS.ITEMS,
  },
  {
    label: "Avg. Passing Grade",
    value: `${Math.round(
      quizzes.reduce((acc, q) => acc + q.averageScore, 0) / quizzes.length
    )}%`,
    icon: ICONS.CHAMPION,
  },
];
  return (
    <div className="min-h-screen bg-surface-page p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className={TYPOGRAPHY_CLASSES.MAIN_HEADING}>
              Quiz Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Design, manage and assess learner understanding with custom quizzes.
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="w-full justify-center sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Quiz
          </Button>
        </div>

       {/* Stats Row */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {stats.map((stat) => (
    <div
      key={stat.label}
      className="bg-white rounded-[var(--radius-default)] p-6 shadow-sm border border-gray-100"
    >
      <div className="flex items-center gap-4 mb-3">
        
        <div className="flex items-center justify-center w-12 h-12 rounded-lg">
          <Image
            src={stat.icon}
            alt={stat.label}
            width={24}
            height={24}
          />
        </div>

        <div>
          <div className="text-2xl font-bold text-brand-primary">
            {stat.value}
          </div>

          <div className="text-sm text-[var(--color-text-secondary)]">
            {stat.label}
          </div>
        </div>

      </div>
    </div>
  ))}
</div>

        {/* Search */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-8 mb-6">
          <h3 className="text-xl font-bold text-gray-900">All Quizzes</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search quizzes or courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-gray-500 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent w-full sm:w-72 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Quizzes List */}
        {filteredQuizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm text-center px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <HelpCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg text-gray-900 font-bold mb-2">
              No quizzes found
            </p>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              Create comprehensive questionnaires with multiple choice options to test and grade your student knowledge.
            </p>
            <button
              onClick={handleCreateNew}
              className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create First Quiz
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider pl-6">
                      Quiz Title
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Questions
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Passing Score
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Attempts
                    </th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Avg Score
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
                  {filteredQuizzes.map((quiz) => (
                    <tr
                      key={quiz.id}
                      className="hover:bg-gray-50/30 transition-colors group"
                    >
                      <td className="p-4 pl-6 font-semibold text-gray-900 text-sm">
                        {quiz.title}
                      </td>
                      <td className="p-4 text-gray-500 text-sm">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          {quiz.courseName}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-700 text-center font-medium">
                        {quiz.questionsCount}
                      </td>
                      <td className="p-4 text-sm text-gray-700 text-center font-medium">
                        {quiz.passingScore}%
                      </td>
                      <td className="p-4 text-sm text-gray-500 text-center">
                        {quiz.attemptsCount}
                      </td>
                      <td className="p-4 text-sm text-gray-900 text-center font-bold">
                        {quiz.attemptsCount > 0 ? `${quiz.averageScore}%` : "—"}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            quiz.status === "Active"
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                              : "bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                        >
                          {quiz.status}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            onClick={() => handleEdit(quiz)}
                            className="h-8 w-8 bg-white hover:bg-blue-100 justify-center p-0"
                            title="Edit Quiz"
                          >
                            <Pencil className="w-4 text-primary h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteClick(quiz)}
                            className="h-8 w-8 bg-white hover:bg-red-100 justify-center p-0"
                            title="Delete Quiz"
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

      {/* --- CREATE / EDIT MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? "Edit Quiz" : "Create New Quiz"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="px-4 sm:px-6 py-5 space-y-6 overflow-y-auto flex-1 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Playwright Selectors"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Associated Course
                  </label>
                  <select
                    value={courseId || courseName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const match = dbCourses.find((c) => String(c.id) === String(val) || c.title === val);
                      if (match) {
                        setCourseId(match.id);
                        setCourseName(match.title);
                      } else {
                        setCourseId("");
                        setCourseName(val);
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                  >
                    {dbCourses.length === 0 ? (
                      <>
                        <option value="Playwright Mastery">Playwright Mastery</option>
                        <option value="CI/CD Foundations">CI/CD Foundations</option>
                        <option value="Ultimate Automation">Ultimate Automation</option>
                      </>
                    ) : (
                      dbCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "Active" | "Inactive")
                    }
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Questions Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-sm font-bold text-gray-800 uppercase tracking-wider">
                    Questions List
                  </label>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="text-brand-primary hover:bg-brand-primary/10 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-brand-primary/20"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Question
                  </button>
                </div>

                {questions.map((question, qIdx) => (
                  <div
                    key={question.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 relative shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold">
                        {qIdx + 1}
                      </span>
                      <div className="flex-1">
                        <textarea
                          placeholder="Type your multiple choice question here..."
                          value={question.text}
                          onChange={(e) =>
                            handleQuestionTextChange(qIdx, e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none bg-white"
                        />
                      </div>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Remove Question"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:pl-10">
                      {question.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase w-4">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <input
                            type="text"
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            value={opt}
                            onChange={(e) =>
                              handleOptionChange(qIdx, oIdx, e.target.value)
                            }
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-brand-primary"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Correct Answer Dropdown */}
                    <div className="flex items-center gap-3 pl-10 pt-2 border-t border-dashed border-gray-100">
                      <label className="text-xs font-bold text-gray-500 uppercase">
                        Correct Answer Option:
                      </label>
                      <select
                        value={question.correctAnswer}
                        onChange={(e) =>
                          handleCorrectAnswerChange(qIdx, Number(e.target.value))
                        }
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-brand-primary"
                      >
                        <option value={0}>Option A</option>
                        <option value={1}>Option B</option>
                        <option value={2}>Option C</option>
                        <option value={3}>Option D</option>
                      </select>
                    </div>
                  </div>
                ))}
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
                onClick={handleSaveQuiz}
                className="w-full justify-center sm:w-1/2"
              >
                {isEditing ? "Save Changes" : "Create Quiz"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION --- */}
      {showDeleteConfirm && deletingQuiz && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Delete Quiz
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">{deletingQuiz.title}</strong>
                ? All question data and statistics will be removed permanently.
              </p>
            </div>
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingQuiz(null);
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
