import {
  BookOpenText,
  CalendarDays,
  CircleGauge,
  FileQuestion,
  Files,
  FlaskConical,
  Headphones,
  Layers3,
  LibraryBig,
  NotebookText,
  Presentation,
  ScrollText,
  Search,
  Sparkles,
  SquareStack,
  TrendingUp,
  Upload,
} from "lucide-react";

export const navigation = [
  { id: "overview", label: "Today", detail: "What needs attention", icon: CircleGauge, group: "primary" },
  { id: "calendar", label: "Plan", detail: "Calendar and deadlines", icon: CalendarDays, group: "primary" },
  { id: "uploads", label: "Sources", detail: "Course materials", icon: Upload, group: "primary" },
  { id: "review", label: "Review", detail: "Resolve uncertainty", icon: FileQuestion, group: "primary" },
  { id: "cards", label: "Cards", detail: "Active recall", icon: SquareStack, group: "study" },
  { id: "read", label: "Read", detail: "Source-linked brief", icon: BookOpenText, group: "study" },
  { id: "field-guide", label: "Field guide", detail: "Concept relationships", icon: LibraryBig, group: "study" },
  { id: "slides", label: "Slides", detail: "Lecture review", icon: Presentation, group: "study" },
  { id: "doc", label: "Doc", detail: "Study guide", icon: NotebookText, group: "study" },
  { id: "quiz", label: "Quiz", detail: "Cited practice", icon: FileQuestion, group: "study" },
  { id: "cases", label: "Cases", detail: "Applied scenarios", icon: Layers3, group: "study" },
  { id: "cram", label: "Cram", detail: "Priority review", icon: Sparkles, group: "study" },
  { id: "listen", label: "Listen", detail: "Narrated review", icon: Headphones, group: "study" },
  { id: "progress", label: "Progress", detail: "Learning evidence", icon: TrendingUp, group: "secondary" },
  { id: "benchmarks", label: "Render lab", detail: "Export evidence", icon: FlaskConical, group: "secondary" },
] as const;

export const studyAssetTypes: Record<string, string[]> = {
  cards: ["flashcards"],
  read: ["comprehensive_guide", "weekly_summary", "reading_brief"],
  "field-guide": ["concept_map", "glossary"],
  slides: ["lecture_outline"],
  doc: ["assignment_planner", "comprehensive_guide"],
  quiz: ["practice_quiz", "practice_exam"],
  cases: ["reading_brief"],
  cram: ["formula_sheet", "final_exam_pack"],
  listen: ["weekly_summary", "reading_brief"],
};

export const mobileNavigation = [
  { id: "overview", label: "Today", icon: CircleGauge },
  { id: "calendar", label: "Plan", icon: CalendarDays },
  { id: "read", label: "Learn", icon: ScrollText },
  { id: "search", label: "Search", icon: Search },
  { id: "progress", label: "Me", icon: TrendingUp },
] as const;

export type Mode = (typeof navigation)[number]["id"];
