import React, { useState, useRef, useEffect } from 'react';
import { Document, ChatMessage, Flashcard, QuizQuestion, MindMapNode, Citation, ExplainedConcept } from '../types';
import { chatWithDocument, generateTailoredSummary, generateFlashcards, generateQuiz, explainConcept, generateMindMap, generateStrategicAnalysis, generateKeyCitations, generateStudyGuide, generateFAQ, rewriteText, generateQuizFromChat } from '../services/geminiService';
import { Send, BookOpen, Brain, List, FileText, CheckCircle, RefreshCw, Star, ArrowRight, ArrowLeft, Loader2, Play, Lightbulb, Search, X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Speaker, Shuffle, Settings, Target, Share2, Layers, Book, HelpCircle, GraduationCap, Quote, Volume2, StopCircle, Download, Timer, Pause, Bell, Trash2, Bookmark, Copy, Check, ThumbsUp, ThumbsDown, Wand2, AlignLeft, Minimize2, Maximize2, Mic, MicOff, FileQuestion, NotebookPen, Pin, Save, Cloud } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface WorkspaceProps {
  document: Document;
  onBack: () => void;
  onDelete: () => void;
  onUpdateStats: (type: 'flashcard' | 'quiz', count: number) => void;
  onUpdateDocument: (doc: Document) => void;
}

type ToolTab = 'chat' | 'summary' | 'flashcards' | 'quiz' | 'deep_dive' | 'resources' | 'concepts';

const Workspace: React.FC<WorkspaceProps> = ({ document: doc, onBack, onDelete, onUpdateStats, onUpdateDocument }) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('chat');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(doc.chatHistory || []);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rewritingMessageId, setRewritingMessageId] = useState<string | null>(null);
  const [openRewriteMenuId, setOpenRewriteMenuId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Notes State
  const [showNotes, setShowNotes] = useState(false);
  const [userNotes, setUserNotes] = useState<string>(doc.userNotes || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Summary State
  const [summary, setSummary] = useState<string | null>(doc.summary || null);
  const [summaryType, setSummaryType] = useState<string>(doc.summaryType || 'simple');
  const [summaryLang, setSummaryLang] = useState<string>(doc.summaryLang || 'fr');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Flashcard State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isFlashcardsLoading, setIsFlashcardsLoading] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizConfig, setQuizConfig] = useState<{count: number, topic: string}>({ count: 5, topic: '' });
  const [showQuizSetup, setShowQuizSetup] = useState(true);

  // Deep Dive State
  const [mindMap, setMindMap] = useState<MindMapNode | null>(doc.mindMap || null);
  const [strategicAnalysis, setStrategicAnalysis] = useState<string | null>(doc.strategicAnalysis || null);
  const [keyCitations, setKeyCitations] = useState<Citation[] | null>(doc.keyCitations || null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [activeDeepDiveTab, setActiveDeepDiveTab] = useState<'mindmap'|'strategy'|'citations'>('mindmap');

  // Resources State
  const [studyGuide, setStudyGuide] = useState<string | null>(doc.studyGuide || null);
  const [faq, setFaq] = useState<{question:string, answer:string}[] | null>(doc.faq || null);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [activeResourceTab, setActiveResourceTab] = useState<'guide'|'faq'|'methodology'>('guide');

  // Explainer & Concepts State
  const [explainerOverlay, setExplainerOverlay] = useState<{ show: boolean, term: string, text: string | null }>({ show: false, term: '', text: null });
  const [conceptHistory, setConceptHistory] = useState<ExplainedConcept[]>(doc.conceptHistory || []);

  // PDF State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isReading, setIsReading] = useState(false);
  const [pageInput, setPageInput] = useState<string>('1');
  const [isPdfFullScreen, setIsPdfFullScreen] = useState(false);
  const pdfDocumentRef = useRef<any>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; text: string }>({
    show: false, x: 0, y: 0, text: ''
  });

  // --- Focus Mode (Pomodoro) State ---
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [timerMessage, setTimerMessage] = useState<string | null>(null);
  const [focusState, setFocusState] = useState<{
    time: number;
    isRunning: boolean;
    mode: 'focus' | 'break';
  }>({ time: 25 * 60, isRunning: false, mode: 'focus' });

  useEffect(() => {
    let interval: any;
    if (focusState.isRunning && focusState.time > 0) {
      interval = setInterval(() => {
        setFocusState(prev => ({ ...prev, time: prev.time - 1 }));
      }, 1000);
    } else if (focusState.time === 0 && focusState.isRunning) {
      // Timer finished
      setFocusState(prev => ({ ...prev, isRunning: false }));
      
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.play().catch(e => console.error("Audio play failed", e));
      
      // Auto switch suggested but manual trigger for now
      if (focusState.mode === 'focus') {
         setTimerMessage("🎉 Session terminée ! Prenez une pause.");
         setFocusState({ time: 5 * 60, isRunning: false, mode: 'break' });
         setShowFocusTimer(true); // Ensure widget is visible
      } else {
         setTimerMessage("🔔 Pause terminée ! Prêt à reprendre ?");
         setFocusState({ time: 25 * 60, isRunning: false, mode: 'focus' });
         setShowFocusTimer(true);
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setTimerMessage(null), 5000);
    }
    return () => clearInterval(interval);
  }, [focusState.isRunning, focusState.time, focusState.mode]);

  const toggleFocusTimer = () => setFocusState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  const resetFocusTimer = () => setFocusState(prev => ({ 
    ...prev, 
    isRunning: false, 
    time: prev.mode === 'focus' ? 25 * 60 : 5 * 60 
  }));
  const setFocusMode = (mode: 'focus' | 'break') => setFocusState({
    mode,
    isRunning: false,
    time: mode === 'focus' ? 25 * 60 : 5 * 60
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, rewritingMessageId, showNotes]);

  // Handle Voice Input Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        // Detect language based on summaryLang preference, default to French
        recognitionRef.current.lang = summaryLang === 'en' ? 'en-US' : (summaryLang === 'ht' ? 'ht-HT' : 'fr-FR');

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputMessage(prev => prev ? `${prev} ${transcript}` : transcript);
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
            setIsListening(false);
        };
    }
  }, [summaryLang]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
    } else {
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error(e);
            setIsListening(false);
        }
    }
  };

  // Context Menu Logic
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Don't override if clicking inside our own custom menu
      if ((e.target as HTMLElement).closest('.custom-context-menu')) return;

      // Only show menu if click is inside the PDF container
      if (pdfContainerRef.current && !pdfContainerRef.current.contains(e.target as Node)) {
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      
      // We only show the custom menu if text is actually selected
      if (selectedText && selectedText.length > 0) {
        e.preventDefault();
        setContextMenu({
          show: true,
          x: e.clientX,
          y: e.clientY,
          text: selectedText
        });
      }
    };

    const handleClick = () => {
      if (contextMenu.show) setContextMenu(prev => ({ ...prev, show: false }));
      if (openRewriteMenuId) setOpenRewriteMenuId(null);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.show, openRewriteMenuId]);

  // Sync pageInput with pageNumber
  useEffect(() => {
    setPageInput(pageNumber.toString());
  }, [pageNumber]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          setPageNumber(prev => Math.max(1, prev - 1));
          break;
        case 'ArrowRight':
          setPageNumber(prev => (numPages ? Math.min(numPages, prev + 1) : prev));
          break;
        case '+':
        case '=': // + without shift often sends =
          setScale(s => Math.min(2.5, s + 0.1));
          break;
        case '-':
          setScale(s => Math.max(0.5, s - 0.1));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages]); // numPages dependency needed for ArrowRight check

  // Auto-save Notes Effect
  useEffect(() => {
    // If local notes match prop, we are saved
    if (userNotes === doc.userNotes) {
      if (saveStatus !== 'saved') setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    
    const timeoutId = setTimeout(() => {
      onUpdateDocument({ ...doc, userNotes });
      setSaveStatus('saved');
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [userNotes, doc, onUpdateDocument]);

  // --- Handlers ---

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      setPageNumber(page);
    } else {
      setPageInput(pageNumber.toString()); // Revert if invalid
    }
  };

  const downloadContent = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSummary = () => {
    if (!summary) return;
    downloadContent(summary, `${doc.name}_summary.md`, 'text/markdown');
  };

  const handleDownloadFlashcards = () => {
    if (flashcards.length === 0) return;
    // CSV format for Anki: "Front","Back"
    const csvContent = flashcards.map(fc => `"${fc.front.replace(/"/g, '""')}","${fc.back.replace(/"/g, '""')}"`).join('\n');
    downloadContent(csvContent, `${doc.name}_flashcards.csv`, 'text/csv');
  };

  const handleDownloadResources = () => {
    let content = "";
    if (activeResourceTab === 'guide' && studyGuide) content = studyGuide;
    else if (activeResourceTab === 'faq' && faq) {
      content = faq.map(f => `### ${f.question}\n${f.answer}\n`).join('\n');
    } else {
      return;
    }
    downloadContent(content, `${doc.name}_flashcards.csv`, 'text/markdown');
  };

  const handleSendMessage = async (text?: string) => {
    const msgText = text || inputMessage;
    if (!msgText.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: msgText,
      timestamp: Date.now()
    };
    
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsChatLoading(true);
    
    onUpdateDocument({ ...doc, chatHistory: updatedMessages });

    try {
      const history = updatedMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let responseText = await chatWithDocument(doc, history, newMessage.text);
      
      // Extract suggested questions if present
      const suggestRegex = /SUGGESTED_QUESTIONS:\s*(\[.*?\])/s;
      const match = responseText.match(suggestRegex);
      let suggestions: string[] = [];
      
      if (match) {
        try {
          suggestions = JSON.parse(match[1]);
          responseText = responseText.replace(match[0], '').trim();
        } catch (e) { /* ignore parse error */ }
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
        suggestedQuestions: suggestions.length > 0 ? suggestions : undefined
      };
      
      const finalMessages = [...updatedMessages, botMessage];
      setMessages(finalMessages);
      onUpdateDocument({ ...doc, chatHistory: finalMessages });
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Désolé, j'ai rencontré une erreur.",
        timestamp: Date.now()
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateQuizFromChat = async () => {
    if (messages.length === 0) {
        alert("Veuillez d'abord discuter avec le document pour générer des questions basées sur le chat.");
        return;
    }
    setIsChatLoading(true);
    try {
        const questions = await generateQuizFromChat(doc, messages);
        setQuizQuestions(questions);
        setShowQuizSetup(false); 
        setQuizFinished(false);
        setCurrentQuestionIndex(0);
        setQuizScore(0);
        setActiveTab('quiz');
    } catch (e) {
        console.error(e);
        alert("Impossible de générer le quiz à partir du chat. Veuillez réessayer.");
    } finally {
        setIsChatLoading(false);
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePinToNotes = (text: string, id: string) => {
    const newNotes = userNotes ? `${userNotes}\n\n• ${text}` : `• ${text}`;
    setUserNotes(newNotes);
    // Directly update doc to ensure sync, effect will handle status but duplicate update is safe
    onUpdateDocument({ ...doc, userNotes: newNotes });
    setPinnedId(id);
    setTimeout(() => setPinnedId(null), 2000);
    if (!showNotes) setShowNotes(true);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setUserNotes(newVal);
  };
  
  const saveNotes = () => {
    if (userNotes !== doc.userNotes) {
      onUpdateDocument({ ...doc, userNotes });
      setSaveStatus('saved');
    }
  };

  const handleLikeMessage = (id: string, isLike: boolean) => {
    const updatedMessages = messages.map(msg => {
      if (msg.id === id) {
        if (isLike) {
            return { ...msg, isLiked: !msg.isLiked, isDisliked: false };
        } else {
            return { ...msg, isDisliked: !msg.isDisliked, isLiked: false };
        }
      }
      return msg;
    });
    setMessages(updatedMessages);
    onUpdateDocument({ ...doc, chatHistory: updatedMessages });
  };

  const handleRewriteMessage = async (id: string, text: string, mode: 'bullet' | 'paragraph' | 'shorter' | 'longer') => {
    setOpenRewriteMenuId(null);
    setRewritingMessageId(id);
    try {
      const newText = await rewriteText(text, mode);
      const updatedMessages = messages.map(msg => 
        msg.id === id ? { ...msg, text: newText } : msg
      );
      setMessages(updatedMessages);
      onUpdateDocument({ ...doc, chatHistory: updatedMessages });
    } catch (e) {
      console.error(e);
    } finally {
      setRewritingMessageId(null);
    }
  };

  const handleGenerateSummary = async () => {
    setIsSummaryLoading(true);
    try {
      const summaryText = await generateTailoredSummary(doc, summaryType, summaryLang);
      setSummary(summaryText);
      onUpdateDocument({ 
        ...doc, 
        summary: summaryText, 
        summaryType: summaryType as any, 
        summaryLang: summaryLang as any 
      });
    } catch (e) {
      setSummary("Échec de la génération du résumé.");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    setIsFlashcardsLoading(true);
    setFlashcards([]);
    try {
      const cards = await generateFlashcards(doc, 10);
      setFlashcards(cards);
      onUpdateStats('flashcard', cards.length);
      setCurrentCardIndex(0);
      setIsFlipped(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsFlashcardsLoading(false);
    }
  };

  const handleShuffleFlashcards = () => {
    setFlashcards(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentCardIndex(0);
    setIsFlipped(false);
  };

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to match language
    if (summaryLang === 'fr' || text.match(/[éàèêç]/)) utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
  };

  const handleReadCurrentPage = async () => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    if (!pdfDocumentRef.current) return;

    setIsReading(true);
    try {
      const page = await pdfDocumentRef.current.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      
      if (!text.trim()) {
        alert("Aucun texte lisible trouvé sur cette page.");
        setIsReading(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (summaryLang === 'fr') utterance.lang = 'fr-FR';
      
      utterance.onend = () => setIsReading(false);
      utterance.onerror = () => setIsReading(false);
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Error reading page:", e);
      setIsReading(false);
    }
  };

  const handleStartQuiz = async () => {
    setIsQuizLoading(true);
    setQuizQuestions([]);
    setQuizFinished(false);
    setQuizScore(0);
    setCurrentQuestionIndex(0);
    setShowQuizSetup(false);
    
    try {
      const questions = await generateQuiz(doc, quizConfig.count, quizConfig.topic);
      setQuizQuestions(questions);
    } catch (e) {
      console.error(e);
      setShowQuizSetup(true); // Go back if error
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleExplainConcept = async (text: string) => {
    if (!text.trim()) return;

    // Check if we already have this concept explained in history
    const existing = conceptHistory.find(c => c.term.toLowerCase() === text.toLowerCase());
    if (existing) {
        setExplainerOverlay({ show: true, term: existing.term, text: existing.explanation });
        return;
    }

    setExplainerOverlay({ show: true, term: text, text: null });
    
    try {
      const result = await explainConcept(doc, text);
      setExplainerOverlay({ show: true, term: text, text: result });

      // Save to History
      const newConcept: ExplainedConcept = {
          id: Date.now().toString(),
          term: text,
          explanation: result,
          timestamp: Date.now()
      };
      
      const updatedHistory = [newConcept, ...conceptHistory];
      setConceptHistory(updatedHistory);
      onUpdateDocument({ ...doc, conceptHistory: updatedHistory });

    } catch (e) {
      setExplainerOverlay({ show: true, term: text, text: "Échec de l'explication." });
    }
  };

  const handleDeleteConcept = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = conceptHistory.filter(c => c.id !== id);
    setConceptHistory(updatedHistory);
    onUpdateDocument({ ...doc, conceptHistory: updatedHistory });
  };

  const loadDeepDive = async () => {
    if (doc.mindMap && doc.strategicAnalysis && doc.keyCitations) return;
    
    setIsDeepDiveLoading(true);
    try {
      // Parallel execution for speed
      const [mm, sa, kc] = await Promise.all([
        doc.mindMap ? Promise.resolve(doc.mindMap) : generateMindMap(doc),
        doc.strategicAnalysis ? Promise.resolve(doc.strategicAnalysis) : generateStrategicAnalysis(doc),
        doc.keyCitations ? Promise.resolve(doc.keyCitations) : generateKeyCitations(doc)
      ]);

      setMindMap(mm);
      setStrategicAnalysis(sa);
      setKeyCitations(kc);
      onUpdateDocument({ ...doc, mindMap: mm, strategicAnalysis: sa, keyCitations: kc });
    } catch (e) { console.error(e); } finally { setIsDeepDiveLoading(false); }
  };

  const loadResources = async () => {
    if (doc.studyGuide && doc.faq) return;
    setIsResourcesLoading(true);
    try {
       const [sg, fq] = await Promise.all([
         doc.studyGuide ? Promise.resolve(doc.studyGuide) : generateStudyGuide(doc),
         doc.faq ? Promise.resolve(doc.faq) : generateFAQ(doc)
       ]);
       setStudyGuide(sg);
       setFaq(fq);
       onUpdateDocument({ ...doc, studyGuide: sg, faq: fq });
    } catch (e) { console.error(e); } finally { setIsResourcesLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'deep_dive') loadDeepDive();
    if (activeTab === 'resources') loadResources();
  }, [activeTab]);

  // PDF Handlers
  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages);
    setPageNumber(1);
    pdfDocumentRef.current = pdf;
  };

  const changePage = (offset: number) => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    }
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  // --- Render Components ---

  const renderMindMapNode = (node: MindMapNode, depth = 0) => (
    <div key={node.label} className="ml-4 my-2 border-l-2 border-indigo-200 dark:border-indigo-800 pl-4 relative">
       <div className="flex items-center gap-2">
         <div className={`w-3 h-3 rounded-full ${depth === 0 ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-indigo-300 dark:bg-indigo-700'}`}></div>
         <span className={`font-medium ${depth === 0 ? 'text-lg text-indigo-900 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300'}`}>{node.label}</span>
       </div>
       {node.children && node.children.map(child => renderMindMapNode(child, depth + 1))}
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 dark:text-slate-400 mt-10">
            <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Posez-moi une question sur <span className="font-semibold">{doc.name}</span> !</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 px-4 shadow-sm text-sm relative ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'}`}>
                {rewritingMessageId === msg.id ? (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Loader2 size={14} className="animate-spin"/>
                        <span>Réécriture en cours...</span>
                    </div>
                ) : (
                    <ReactMarkdown className={msg.role === 'user' ? '' : 'prose dark:prose-invert prose-sm max-w-none'}>{msg.text}</ReactMarkdown>
                )}
              </div>
              
              {msg.role === 'model' && !rewritingMessageId && (
                <div className="flex items-center gap-1 mt-1 ml-1 text-slate-400 dark:text-slate-500">
                   <button 
                      onClick={() => handleCopyMessage(msg.text, msg.id)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title="Copier"
                   >
                     {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                   </button>
                   <button 
                      onClick={() => handlePinToNotes(msg.text, msg.id)}
                      className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors ${pinnedId === msg.id ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                      title="Épingler dans le bloc-notes"
                   >
                     <Pin size={14} fill={pinnedId === msg.id ? "currentColor" : "none"} />
                   </button>
                   <button 
                      onClick={() => handleLikeMessage(msg.id, true)}
                      className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors ${msg.isLiked ? 'text-green-500' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
                      title="J'aime"
                   >
                     <ThumbsUp size={14} fill={msg.isLiked ? "currentColor" : "none"} />
                   </button>
                   <button 
                      onClick={() => handleLikeMessage(msg.id, false)}
                      className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors ${msg.isDisliked ? 'text-red-500' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
                      title="Je n'aime pas"
                   >
                     <ThumbsDown size={14} fill={msg.isDisliked ? "currentColor" : "none"} />
                   </button>
                   <button 
                      onClick={() => speakText(msg.text)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title="Lire à voix haute"
                   >
                     <Volume2 size={14} />
                   </button>
                   
                   <div className="relative">
                       <button 
                          onClick={(e) => { e.stopPropagation(); setOpenRewriteMenuId(openRewriteMenuId === msg.id ? null : msg.id); }}
                          className={`p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 ${openRewriteMenuId === msg.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''}`}
                          title="Réécrire"
                       >
                         <Wand2 size={14} />
                       </button>

                       {openRewriteMenuId === msg.id && (
                           <div className="absolute top-8 left-0 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 w-48 flex flex-col animate-in fade-in zoom-in-95 duration-100 text-slate-700 dark:text-slate-200">
                               <button onClick={() => handleRewriteMessage(msg.id, msg.text, 'bullet')} className="text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                   <List size={14} /> Liste à puces
                               </button>
                               <button onClick={() => handleRewriteMessage(msg.id, msg.text, 'paragraph')} className="text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                   <AlignLeft size={14} /> Paragraphe
                               </button>
                               <button onClick={() => handleRewriteMessage(msg.id, msg.text, 'shorter')} className="text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                   <Minimize2 size={14} /> Plus court
                               </button>
                               <button onClick={() => handleRewriteMessage(msg.id, msg.text, 'longer')} className="text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                                   <Maximize2 size={14} /> Plus long
                               </button>
                           </div>
                       )}
                   </div>
                </div>
              )}
            </div>
            {msg.role === 'model' && msg.suggestedQuestions && (
               <div className="flex gap-2 flex-wrap ml-2 mt-2">
                  {msg.suggestedQuestions.map((q, i) => (
                    <button key={i} onClick={() => handleSendMessage(q)} className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-800">
                      {q}
                    </button>
                  ))}
               </div>
            )}
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
             <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 px-4 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Réflexion...</span>
             </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-colors">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-full border border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all pr-1">
          <input 
            type="text" 
            className="flex-1 bg-transparent border-none px-4 py-3 focus:outline-none text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
            placeholder={isListening ? "Écoute en cours..." : "Posez votre question..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <div className="flex items-center gap-1">
             <button
               onClick={handleGenerateQuizFromChat}
               disabled={messages.length === 0}
               className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
               title="Générer des questions (Quiz)"
            >
               <FileQuestion size={18} />
            </button>
            <button
               onClick={toggleListening}
               className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200'}`}
               title={isListening ? "Arrêter l'écoute" : "Entrée vocale"}
            >
               {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button 
                onClick={() => handleSendMessage()}
                disabled={isChatLoading || !inputMessage.trim()}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors m-1 shadow-sm"
            >
                <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <FileText className="text-indigo-600 dark:text-indigo-400" /> Résumé
        </h3>
        <div className="flex gap-2 text-sm">
          <select 
            value={summaryType} 
            onChange={(e) => setSummaryType(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="simple">Simple (Vulgarisation)</option>
            <option value="analytical">Analytique</option>
            <option value="pedagogical">Pédagogique (Professeur)</option>
            <option value="concrete">Concret</option>
          </select>
          <select 
            value={summaryLang} 
            onChange={(e) => setSummaryLang(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="en">Anglais</option>
            <option value="fr">Français</option>
            <option value="ht">Créole Haïtien</option>
          </select>
          {summary && (
            <button 
              onClick={handleDownloadSummary} 
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
              title="Télécharger Markdown"
            >
              <Download size={16} />
            </button>
          )}
          <button 
             onClick={handleGenerateSummary}
             className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
             title="Régénérer"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {!summary && !isSummaryLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400">
          <p className="mb-4">Générez un résumé adapté à vos besoins.</p>
          <button onClick={handleGenerateSummary} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Générer</button>
        </div>
      )}
      {isSummaryLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
          <p>Analyse du document...</p>
        </div>
      )}
      {summary && !isSummaryLoading && (
        <div className="prose dark:prose-invert prose-indigo max-w-none text-slate-700 dark:text-slate-300">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );

  const renderFlashcards = () => (
    <div className="h-full flex flex-col p-6 items-center bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="w-full flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BookOpen className="text-indigo-600 dark:text-indigo-400" /> Flashcards
        </h3>
        {flashcards.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handleDownloadFlashcards} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg" title="Exporter pour Anki (CSV)"><Download size={18} /></button>
            <button onClick={handleShuffleFlashcards} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title="Mélanger"><Shuffle size={18} /></button>
            <button onClick={handleGenerateFlashcards} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title="Régénérer"><RefreshCw size={18} /></button>
          </div>
        )}
      </div>

      {!flashcards.length && !isFlashcardsLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400">
          <p className="mb-4">Créez des cartes d'étude à partir de ce document.</p>
          <button 
            onClick={handleGenerateFlashcards}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Générer les cartes
          </button>
        </div>
      )}

      {isFlashcardsLoading && (
         <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
          <p>Génération des cartes...</p>
        </div>
      )}

      {flashcards.length > 0 && (
        <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center">
          <div className="relative w-full h-64 perspective-1000 cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div 
              className="w-full h-full relative preserve-3d transition-all duration-500"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front */}
              <div className="absolute w-full h-full backface-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-2">Question</span>
                <p className="text-lg font-medium text-slate-800 dark:text-white">{flashcards[currentCardIndex].front}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); speakText(flashcards[currentCardIndex].front); }}
                  className="absolute top-4 right-4 p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <Speaker size={18} />
                </button>
              </div>
              
              {/* Back */}
              <div className="absolute w-full h-full backface-hidden bg-indigo-600 dark:bg-indigo-700 text-white rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center" style={{ transform: 'rotateY(180deg)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200 mb-2">Réponse</span>
                <p className="text-lg font-medium">{flashcards[currentCardIndex].back}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); speakText(flashcards[currentCardIndex].back); }}
                  className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white"
                >
                  <Speaker size={18} />
                </button>
              </div>
            </motion.div>
          </div>

          <div className="flex items-center gap-6 mt-8">
            <button 
              onClick={() => { if(currentCardIndex > 0) { setCurrentCardIndex(c => c - 1); setIsFlipped(false); } }}
              disabled={currentCardIndex === 0}
              className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-700 dark:text-slate-300"/>
            </button>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {currentCardIndex + 1} / {flashcards.length}
            </span>
            <button 
              onClick={() => { if(currentCardIndex < flashcards.length - 1) { setCurrentCardIndex(c => c + 1); setIsFlipped(false); } }}
              disabled={currentCardIndex === flashcards.length - 1}
              className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={24} className="text-slate-700 dark:text-slate-300"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderQuiz = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors">
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <CheckCircle className="text-indigo-600 dark:text-indigo-400" /> Quiz IA
      </h3>

      {showQuizSetup && !isQuizLoading && (
         <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre de questions</label>
                <div className="flex gap-2">
                  {[3, 5, 10, 15].map(n => (
                    <button 
                      key={n}
                      onClick={() => setQuizConfig({...quizConfig, count: n})}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${quizConfig.count === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sujet / Chapitre (Optionnel)</label>
                 <input 
                   type="text"
                   className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700 dark:text-white"
                   placeholder="ex: Chapitre 4, Conclusion..."
                   value={quizConfig.topic}
                   onChange={(e) => setQuizConfig({...quizConfig, topic: e.target.value})}
                 />
              </div>
              <button 
                onClick={handleStartQuiz}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Play size={18} /> Générer le Quiz
              </button>
            </div>
         </div>
      )}

      {isQuizLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
          <p>Génération des questions...</p>
        </div>
      )}

      {!showQuizSetup && !isQuizLoading && quizQuestions.length > 0 && !quizFinished && (
        <div className="max-w-2xl mx-auto w-full flex-1">
          <div className="mb-6 flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 font-medium">
             <button onClick={() => setShowQuizSetup(true)} className="text-indigo-600 dark:text-indigo-400 hover:underline">Quitter le Quiz</button>
             <span>Question {currentQuestionIndex + 1} sur {quizQuestions.length}</span>
          </div>
          
          <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">
            {quizQuestions[currentQuestionIndex].question}
          </h4>

          <div className="space-y-3">
            {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
               let btnClass = "w-full p-4 text-left rounded-xl border transition-all duration-200 ";
               if (selectedAnswer === null) {
                 btnClass += "border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300";
               } else if (idx === quizQuestions[currentQuestionIndex].correctAnswerIndex) {
                 btnClass += "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-300";
               } else if (selectedAnswer === idx) {
                 btnClass += "bg-red-100 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-300";
               } else {
                 btnClass += "border-slate-200 dark:border-slate-700 opacity-50 dark:opacity-40 text-slate-700 dark:text-slate-300";
               }

               return (
                 <button 
                  key={idx}
                  onClick={() => {
                     if (selectedAnswer !== null) return;
                     setSelectedAnswer(idx);
                     if (idx === quizQuestions[currentQuestionIndex].correctAnswerIndex) setQuizScore(s => s + 1);
                  }}
                  disabled={selectedAnswer !== null}
                  className={btnClass}
                 >
                   <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {option}
                 </button>
               );
            })}
          </div>

          {selectedAnswer !== null && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl text-sm text-indigo-900 dark:text-indigo-200">
              <span className="font-bold block mb-1">Explication :</span>
              {quizQuestions[currentQuestionIndex].explanation}
            </motion.div>
          )}

          {selectedAnswer !== null && (
             <div className="mt-8 flex justify-end">
               <button 
                onClick={() => {
                   if (currentQuestionIndex < quizQuestions.length - 1) {
                     setCurrentQuestionIndex(p => p + 1);
                     setSelectedAnswer(null);
                   } else {
                     setQuizFinished(true);
                     onUpdateStats('quiz', 1);
                   }
                }}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
               >
                 {currentQuestionIndex === quizQuestions.length - 1 ? 'Terminer' : 'Question suivante'} <ArrowRight size={16} />
               </button>
             </div>
          )}
        </div>
      )}

      {quizFinished && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Quiz terminé !</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Vous avez obtenu <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xl">{quizScore}</span> sur {quizQuestions.length}</p>
          <button 
            onClick={() => setShowQuizSetup(true)}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Nouveau Quiz
          </button>
        </div>
      )}
    </div>
  );

  const renderConcepts = () => (
    <div className="h-full flex flex-col p-6 overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
        <Lightbulb className="text-indigo-600 dark:text-indigo-400" /> Glossaire des Concepts
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Retrouvez ici l'historique de tous les termes que vous avez demandé à l'IA d'expliquer. 
        Pour ajouter un concept, sélectionnez un mot dans le PDF et choisissez "Expliquer" dans le menu contextuel.
      </p>

      {conceptHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl m-4">
           <Lightbulb size={32} className="mb-2 opacity-50" />
           <p className="text-center px-6">Aucun concept expliqué pour le moment.<br/>Sélectionnez du texte dans le PDF pour commencer.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {conceptHistory.map((concept) => (
             <motion.div 
               key={concept.id}
               initial={{opacity: 0, y: 10}}
               animate={{opacity: 1, y: 0}}
               className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors cursor-pointer group"
               onClick={() => setExplainerOverlay({ show: true, term: concept.term, text: concept.explanation })}
             >
                <div className="flex justify-between items-start mb-1">
                   <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-lg">{concept.term}</h4>
                   <button 
                     onClick={(e) => handleDeleteConcept(concept.id, e)}
                     className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                     title="Supprimer"
                   >
                     <X size={16} />
                   </button>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                   {concept.explanation.replace(/[#*]/g, '')}
                </p>
                <div className="flex justify-between items-center mt-3">
                   <span className="text-xs text-slate-400 dark:text-slate-500">
                     {new Date(concept.timestamp).toLocaleDateString()} {new Date(concept.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   </span>
                   <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline">
                     Voir l'explication complète
                   </span>
                </div>
             </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDeepDive = () => (
    <div className="h-full flex flex-col p-6 overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
       <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-4 pb-1">
         <button onClick={() => setActiveDeepDiveTab('mindmap')} className={`pb-2 px-1 text-sm font-medium ${activeDeepDiveTab === 'mindmap' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Carte mentale</button>
         <button onClick={() => setActiveDeepDiveTab('strategy')} className={`pb-2 px-1 text-sm font-medium ${activeDeepDiveTab === 'strategy' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Analyse stratégique</button>
         <button onClick={() => setActiveDeepDiveTab('citations')} className={`pb-2 px-1 text-sm font-medium ${activeDeepDiveTab === 'citations' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Citations clés</button>
       </div>

       <div className="flex-1 overflow-y-auto">
         {isDeepDiveLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
               <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
               <p>Analyse approfondie en cours...</p>
            </div>
         ) : (
            <>
               {activeDeepDiveTab === 'mindmap' && mindMap && (
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[300px]">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Layers size={20} className="text-indigo-600 dark:text-indigo-400"/> Structure du document</h4>
                    {renderMindMapNode(mindMap)}
                 </div>
               )}
               {activeDeepDiveTab === 'strategy' && strategicAnalysis && (
                 <div className="prose dark:prose-invert prose-indigo max-w-none bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <ReactMarkdown>{strategicAnalysis}</ReactMarkdown>
                 </div>
               )}
               {activeDeepDiveTab === 'citations' && keyCitations && (
                 <div className="space-y-4">
                   {keyCitations.map((cit, i) => (
                     <div key={i} className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                       <Quote className="text-indigo-300 dark:text-indigo-500 mb-2" size={24} />
                       <p className="text-lg font-medium text-indigo-900 dark:text-indigo-200 italic mb-3">"{cit.text}"</p>
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-indigo-700 dark:text-indigo-300">{cit.author || "Source"}</span>
                         <span className="text-indigo-500 dark:text-indigo-400">{cit.context}</span>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </>
         )}
       </div>
    </div>
  );

  const renderResources = () => (
    <div className="h-full flex flex-col p-6 overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
       <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 mb-4 pb-1">
         <div className="flex gap-4">
            <button onClick={() => setActiveResourceTab('guide')} className={`pb-2 px-1 text-sm font-medium ${activeResourceTab === 'guide' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Guide d'étude</button>
            <button onClick={() => setActiveResourceTab('faq')} className={`pb-2 px-1 text-sm font-medium ${activeResourceTab === 'faq' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>FAQ</button>
            <button onClick={() => setActiveResourceTab('methodology')} className={`pb-2 px-1 text-sm font-medium ${activeResourceTab === 'methodology' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Méthodologie</button>
         </div>
         {(activeResourceTab === 'guide' || activeResourceTab === 'faq') && (
            <button 
              onClick={handleDownloadResources} 
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
              title="Télécharger"
            >
              <Download size={16} />
            </button>
         )}
       </div>

       <div className="flex-1 overflow-y-auto">
         {isResourcesLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
               <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
               <p>Compilation des ressources...</p>
            </div>
         ) : (
            <>
               {activeResourceTab === 'guide' && studyGuide && (
                 <div className="prose dark:prose-invert prose-indigo max-w-none bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                   <ReactMarkdown>{studyGuide}</ReactMarkdown>
                 </div>
               )}
               {activeResourceTab === 'faq' && faq && (
                 <div className="space-y-4">
                   {faq.map((item, i) => (
                     <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                       <h5 className="font-bold text-indigo-900 dark:text-indigo-200 mb-2 flex items-start gap-2">
                         <HelpCircle size={18} className="mt-1 shrink-0" /> {item.question}
                       </h5>
                       <p className="text-slate-700 dark:text-slate-300 ml-6">{item.answer}</p>
                     </div>
                   ))}
                 </div>
               )}
               {activeResourceTab === 'methodology' && (
                 <div className="prose dark:prose-invert prose-indigo max-w-none bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3>Guide Méthodologique d'Étude</h3>
                    <p>Pour maîtriser ce document efficacement, suivez cette méthode :</p>
                    <h4>1. Compréhension Globale (Survol)</h4>
                    <ul>
                      <li>Commencez par lire le <strong>Résumé (Simple)</strong> pour saisir l'idée générale.</li>
                      <li>Consultez la <strong>Carte mentale</strong> dans l'onglet "Analyse" pour visualiser la structure.</li>
                    </ul>
                    <h4>2. Analyse Active</h4>
                    <ul>
                      <li>Lisez le document section par section. Utilisez l'outil <strong>Expliquer</strong> (clic droit) pour les termes complexes.</li>
                      <li>Posez des questions au <strong>Chat</strong> pour clarifier les zones d'ombre.</li>
                    </ul>
                    <h4>3. Mémorisation</h4>
                    <ul>
                      <li>Utilisez les <strong>Flashcards</strong>. Activez le mode Lecture Audio (TTS) pour stimuler la mémoire auditive.</li>
                      <li>Faites des sessions courtes (Mode Focus) de 25 minutes.</li>
                    </ul>
                    <h4>4. Validation</h4>
                    <ul>
                       <li>Terminez par un <strong>Quiz</strong>. Configurez-le sur les chapitres que vous venez d'étudier.</li>
                       <li>Visez un score de 80% avant de passer au document suivant.</li>
                    </ul>
                 </div>
               )}
            </>
         )}
       </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 relative transition-colors duration-200">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer le document ?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                Cette action est irréversible. Le document <span className="font-semibold">"{doc.name}"</span> ainsi que tout l'historique de chat et les notes associées seront définitivement effacés.
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={() => {
                    onDelete();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Context Menu Overlay */}
      {contextMenu.show && (
        <div 
          className="custom-context-menu fixed z-50 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 py-1 px-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              handleExplainConcept(contextMenu.text);
              setContextMenu({ ...contextMenu, show: false });
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md cursor-pointer transition-colors"
          >
            <Lightbulb size={16} />
            Expliquer "{contextMenu.text.length > 15 ? contextMenu.text.substring(0, 15) + '...' : contextMenu.text}"
          </button>
          <button 
            onClick={() => {
              speakText(contextMenu.text);
              setContextMenu({ ...contextMenu, show: false });
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md cursor-pointer transition-colors"
          >
            <Speaker size={16} />
            Lire à voix haute
          </button>
        </div>
      )}

      {/* Focus Timer Widget */}
      {showFocusTimer && (
        <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           className="fixed top-20 right-4 z-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 w-64 transition-colors"
        >
           <div className="flex justify-between items-center mb-3">
             <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Timer size={18} className="text-indigo-600 dark:text-indigo-400"/> Mode Concentration</h4>
             <button onClick={() => setShowFocusTimer(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={16}/></button>
           </div>
           
           {timerMessage ? (
             <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm text-center rounded-lg font-medium animate-pulse">
               {timerMessage}
             </div>
           ) : (
             <div className="flex justify-center mb-4">
                <div className={`text-4xl font-mono font-bold tracking-wider ${focusState.mode === 'focus' ? 'text-indigo-600 dark:text-indigo-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatTime(focusState.time)}
                </div>
             </div>
           )}

           <div className="flex gap-2 mb-4">
             <button 
                onClick={() => setFocusMode('focus')}
                className={`flex-1 text-xs py-1 rounded font-medium ${focusState.mode === 'focus' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
             >
               Travail
             </button>
             <button 
                onClick={() => setFocusMode('break')}
                className={`flex-1 text-xs py-1 rounded font-medium ${focusState.mode === 'break' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
             >
               Pause
             </button>
           </div>

           <div className="flex gap-2">
             <button 
               onClick={toggleFocusTimer}
               className={`flex-1 py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${focusState.isRunning ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
             >
               {focusState.isRunning ? <Pause size={16}/> : <Play size={16}/>}
               {focusState.isRunning ? 'Pause' : 'Début'}
             </button>
             <button 
               onClick={resetFocusTimer}
               className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
               title="Réinitialiser"
             >
               <RefreshCw size={18} />
             </button>
           </div>
        </motion.div>
      )}

      {/* Explainer Modal */}
      {explainerOverlay.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <motion.div 
            initial={{opacity: 0, scale: 0.95}} 
            animate={{opacity: 1, scale: 1}}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800">
              <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                <Lightbulb size={20} /> Concept : {explainerOverlay.term}
              </h3>
              <button onClick={() => setExplainerOverlay({show: false, term: '', text: null})} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full dark:text-slate-400"><X size={20}/></button>
            </div>
            <div className="p-6">
               {!explainerOverlay.text ? (
                 <div className="flex flex-col items-center py-8 text-slate-500 dark:text-slate-400">
                   <Loader2 className="animate-spin w-8 h-8 mb-2 text-indigo-600 dark:text-indigo-400"/>
                   <p>Consultation de l'IA...</p>
                 </div>
               ) : (
                 <div className="prose dark:prose-invert prose-sm prose-indigo"><ReactMarkdown>{explainerOverlay.text}</ReactMarkdown></div>
               )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Back Button & Header (Mobile mostly, but useful) */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-slate-800 border-b dark:border-slate-700 z-20 flex items-center justify-between px-4 md:hidden text-slate-800 dark:text-white transition-colors">
         <div className="flex items-center">
            <button onClick={onBack} className="p-2 mr-2"><ArrowLeft size={20}/></button>
            <span className="font-semibold truncate max-w-[150px]">{doc.name}</span>
         </div>
         <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
           <Trash2 size={20} />
         </button>
      </div>

      {/* PDF Viewer - Left Side (Hidden on mobile when tab is active, or use tabs) */}
      <div className={`hidden md:flex flex-col ${isPdfFullScreen ? 'w-full' : 'w-1/2'} h-full border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 pt-16 md:pt-0 transition-all duration-300`}>
         <div className="h-14 border-b dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4 justify-between z-20 shadow-sm relative transition-colors">
            <button onClick={onBack} className="flex items-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium">
              <ArrowLeft size={16} className="mr-2" /> Retour
            </button>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 transition-colors">
               <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"><ZoomOut size={16} /></button>
               <span className="text-xs font-medium w-12 text-center text-slate-700 dark:text-slate-300">{Math.round(scale * 100)}%</span>
               <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"><ZoomIn size={16} /></button>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                   onClick={handleReadCurrentPage}
                   className={`p-1.5 rounded-lg transition-colors ${isReading ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 animate-pulse' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                   title={isReading ? "Arrêter" : "Lire la page"}
                >
                  {isReading ? <StopCircle size={18} /> : <Volume2 size={18} />}
                </button>
                <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"><RotateCw size={18} /></button>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>
                <button onClick={previousPage} disabled={pageNumber <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30"><ChevronLeft size={18} /></button>
                
                {/* Page Navigation Input */}
                <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
                  <input 
                    type="text" 
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handlePageInputSubmit}
                    className="w-10 text-center text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/ {numPages || '-'}</span>
                </form>

                <button onClick={nextPage} disabled={pageNumber >= numPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30"><ChevronRight size={18} /></button>
                
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

                <button 
                   onClick={() => setIsPdfFullScreen(!isPdfFullScreen)}
                   className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 ${isPdfFullScreen ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                   title={isPdfFullScreen ? "Réduire" : "Mode Focus (Plein écran)"}
                >
                  {isPdfFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>

                <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400" title="Supprimer">
                  <Trash2 size={18} />
                </button>
            </div>
         </div>
         
         <div 
           ref={pdfContainerRef}
           className="flex-1 bg-slate-200 dark:bg-slate-900 overflow-auto relative flex justify-center p-4 md:p-8 transition-colors"
         >
           <PdfDocument
              file={doc.base64Data}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-400" size={32} /></div>}
              className="shadow-xl"
           >
              {/* Current Page (Visible) */}
              <div className={isPdfFullScreen ? "flex justify-center" : ""}>
                 <PdfPage 
                    key={`page_${pageNumber}`}
                    pageNumber={pageNumber} 
                    scale={scale} 
                    rotate={rotation} 
                    className="bg-white shadow-lg dark:invert dark:hue-rotate-180 dark:brightness-95" 
                    renderTextLayer={true} 
                    renderAnnotationLayer={false}
                    loading={
                        <div className="flex items-center justify-center h-[800px] w-full bg-white dark:bg-slate-800">
                            <Loader2 className="animate-spin text-slate-400" size={32} />
                        </div>
                    }
                 />
              </div>

              {/* Pre-load Next Page (Hidden) */}
              <div style={{ display: 'none' }}>
                {pageNumber < numPages && (
                    <PdfPage 
                        key={`page_${pageNumber + 1}`}
                        pageNumber={pageNumber + 1} 
                        scale={scale} 
                        rotate={rotation}
                        className="bg-white shadow-lg dark:invert dark:hue-rotate-180 dark:brightness-95"
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                    />
                )}
              </div>

              {/* Cache Previous Page (Hidden) */}
              <div style={{ display: 'none' }}>
                {pageNumber > 1 && (
                    <PdfPage 
                        key={`page_${pageNumber - 1}`}
                        pageNumber={pageNumber - 1} 
                        scale={scale} 
                        rotate={rotation}
                        className="bg-white shadow-lg dark:invert dark:hue-rotate-180 dark:brightness-95"
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                    />
                )}
              </div>
           </PdfDocument>
         </div>
      </div>

      {/* AI Tools - Right Side */}
      <div className={`w-full ${isPdfFullScreen ? 'hidden' : 'md:w-1/2'} h-full flex flex-col bg-white dark:bg-slate-800 pt-14 md:pt-0 transition-colors`}>
        
        {/* Tool Navigation */}
        <div className="h-14 border-b dark:border-slate-700 flex items-center px-2 overflow-x-auto no-scrollbar justify-between">
           <div className="flex items-center">
             <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'chat' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <Brain size={18} /> Chat
             </button>
             <button onClick={() => setActiveTab('summary')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'summary' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <FileText size={18} /> Résumé
             </button>
             <button onClick={() => setActiveTab('flashcards')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'flashcards' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <BookOpen size={18} /> Cartes
             </button>
             <button onClick={() => setActiveTab('quiz')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'quiz' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <CheckCircle size={18} /> Quiz
             </button>
             <button onClick={() => setActiveTab('deep_dive')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'deep_dive' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <Target size={18} /> Analyse
             </button>
             <button onClick={() => setActiveTab('concepts')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'concepts' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <Lightbulb size={18} /> Concepts
             </button>
             <button onClick={() => setActiveTab('resources')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'resources' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <GraduationCap size={18} /> Ressources
             </button>
           </div>
           
           <div className="flex items-center gap-1">
             <button 
               onClick={() => setShowNotes(!showNotes)}
               className={`p-2 rounded-lg transition-colors ${showNotes ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
               title="Bloc-notes"
             >
               <NotebookPen size={20} />
             </button>
             
             {/* Focus Mode Toggle */}
             <button 
               onClick={() => setShowFocusTimer(!showFocusTimer)}
               className={`p-2 rounded-lg transition-colors mr-2 ${showFocusTimer ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
               title="Mode Concentration"
             >
               <Timer size={20} />
             </button>
           </div>
        </div>

        {/* Tool Content & Notes Split View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
           <div className={`flex-1 overflow-hidden relative transition-all duration-300 ${showNotes ? 'basis-[60%]' : 'basis-full'}`}>
             <AnimatePresence mode='wait'>
               <motion.div 
                 key={activeTab}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 transition={{ duration: 0.2 }}
                 className="h-full"
               >
                  {activeTab === 'chat' && renderChat()}
                  {activeTab === 'summary' && renderSummary()}
                  {activeTab === 'flashcards' && renderFlashcards()}
                  {activeTab === 'quiz' && renderQuiz()}
                  {activeTab === 'deep_dive' && renderDeepDive()}
                  {activeTab === 'concepts' && renderConcepts()}
                  {activeTab === 'resources' && renderResources()}
               </motion.div>
             </AnimatePresence>
           </div>

           {/* Notes Panel */}
           <AnimatePresence>
             {showNotes && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: '40%', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                 className="border-t border-slate-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-900/10 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20"
               >
                 <div className="p-2 border-b border-yellow-100 dark:border-yellow-900/30 flex justify-between items-center px-4 bg-yellow-50/80 dark:bg-yellow-900/20 backdrop-blur-sm">
                     <h4 className="font-bold text-yellow-800 dark:text-yellow-400 flex items-center gap-2 text-sm uppercase tracking-wide">
                       <NotebookPen size={16}/> Bloc-notes Intelligent
                     </h4>
                     <div className="flex items-center gap-3">
                       <span className={`text-xs font-medium flex items-center gap-1 transition-colors ${saveStatus === 'saving' ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-600 dark:text-green-400'}`}>
                          {saveStatus === 'saving' ? (
                            <><RefreshCw size={12} className="animate-spin" /> Enregistrement...</>
                          ) : (
                            <><Cloud size={12} /> Enregistré</>
                          )}
                       </span>
                       <div className="h-4 w-px bg-yellow-200 dark:bg-yellow-800"></div>
                       <button onClick={saveNotes} className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 rounded" title="Sauvegarder maintenant">
                         <Save size={16}/>
                       </button>
                       <button onClick={() => setShowNotes(false)} className="p-1 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 rounded">
                         <X size={16}/>
                       </button>
                     </div>
                 </div>
                 <textarea 
                     className="flex-1 w-full bg-transparent p-4 resize-none focus:outline-none text-slate-700 dark:text-slate-300 font-medium leading-relaxed text-sm"
                     placeholder="Écrivez vos notes ici ou épinglez des messages du chat..."
                     value={userNotes}
                     onChange={handleNotesChange}
                     onBlur={saveNotes}
                     spellCheck={false}
                 />
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Workspace;