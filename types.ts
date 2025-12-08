export interface User {
  id: string;
  name: string;
  email: string;
}

export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export interface Citation {
  text: string;
  author?: string;
  context: string;
}

export interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadDate: string;
  base64Data: string; 
  // Summary logic
  summary?: string;
  summaryType?: 'simple' | 'analytical' | 'pedagogical' | 'concrete';
  summaryLang?: 'en' | 'fr' | 'ht';
  
  chatHistory?: ChatMessage[];
  
  // New cached resources
  mindMap?: MindMapNode;
  strategicAnalysis?: string; // Markdown
  keyCitations?: Citation[];
  studyGuide?: string; // Markdown
  faq?: { question: string; answer: string }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  suggestedQuestions?: string[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  isFavorite: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
}

export interface QuizResult {
  date: string;
  score: number;
  totalQuestions: number;
  documentName: string;
}

export enum AppView {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  LIBRARY = 'LIBRARY',
  WORKSPACE = 'WORKSPACE'
}

export interface AnalyticsData {
  totalDocs: number;
  totalFlashcardsGenerated: number;
  quizzesTaken: number;
  averageScore: number;
  recentActivity: { action: string; time: string; docName: string }[];
}