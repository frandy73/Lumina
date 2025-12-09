import React, { useState, useRef, useEffect } from 'react';
import { Document, ChatMessage, Flashcard, QuizQuestion, MindMapNode, Citation } from '../types';
import { chatWithDocument, generateTailoredSummary, generateFlashcards, generateQuiz, explainConcept, generateMindMap, generateStrategicAnalysis, generateKeyCitations, generateStudyGuide, generateFAQ } from '../services/geminiService';
import { Send, BookOpen, Brain, List, FileText, CheckCircle, RefreshCw, Star, ArrowRight, ArrowLeft, Loader2, Play, Lightbulb, Search, X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight, Speaker, Shuffle, Settings, Target, Share2, Layers, Book, HelpCircle, GraduationCap, Quote, Volume2, StopCircle, Download, Timer, Pause, Bell, Trash2 } from 'lucide-react';
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

type ToolTab = 'chat' | 'summary' | 'flashcards' | 'quiz' | 'deep_dive' | 'resources';

const Workspace: React.FC<WorkspaceProps> = ({ document: doc, onBack, onDelete, onUpdateStats, onUpdateDocument }) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('chat');
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>(doc.chatHistory || []);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Explainer Overlay State
  const [explainerOverlay, setExplainerOverlay] = useState<{ show: boolean, term: string, text: string | null }>({ show: false, term: '', text: null });
  
  // PDF State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isReading, setIsReading] = useState(false);
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
  }, [messages]);

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
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.show]);

  // --- Handlers ---

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
    downloadContent(content, `${doc.name}_activeResourceTab}.md`, 'text/markdown');
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
    setExplainerOverlay({ show: true, term: text, text: null });
    
    try {
      const result = await explainConcept(doc, text);
      setExplainerOverlay({ show: true, term: text, text: result });
    } catch (e) {
      setExplainerOverlay({ show: true, term: text, text: "Échec de l'explication." });
    }
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
    <div key={node.label} className="ml-4 my-2 border-l-2 border-indigo-200 pl-4 relative">
       <div className="flex items-center gap-2">
         <div className={`w-3 h-3 rounded-full ${depth === 0 ? 'bg-indigo-600' : 'bg-indigo-300'}`}></div>
         <span className={`font-medium ${depth === 0 ? 'text-lg text-indigo-900' : 'text-slate-700'}`}>{node.label}</span>
       </div>
       {node.children && node.children.map(child => renderMindMapNode(child, depth + 1))}
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Posez-moi une question sur <span className="font-semibold">{doc.name}</span> !</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 px-4 shadow-sm text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
            {msg.role === 'model' && msg.suggestedQuestions && (
               <div className="flex gap-2 flex-wrap ml-2">
                  {msg.suggestedQuestions.map((q, i) => (
                    <button key={i} onClick={() => handleSendMessage(q)} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-200">
                      {q}
                    </button>
                  ))}
               </div>
            )}
          </div>
        ))}
        {isChatLoading && (
          <div className="flex justify-start">
             <div className="bg-white border border-slate-200 rounded-2xl p-3 px-4 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span className="text-sm text-slate-500">Réflexion...</span>
             </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            className="flex-1 border border-slate-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            placeholder="Posez votre question..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button 
            onClick={() => handleSendMessage()}
            disabled={isChatLoading || !inputMessage.trim()}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="text-indigo-600" /> Résumé
        </h3>
        <div className="flex gap-2 text-sm">
          <select 
            value={summaryType} 
            onChange={(e) => setSummaryType(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="simple">Simple (Vulgarisation)</option>
            <option value="analytical">Analytique</option>
            <option value="pedagogical">Pédagogique (Professeur)</option>
            <option value="concrete">Concret</option>
          </select>
          <select 
            value={summaryLang} 
            onChange={(e) => setSummaryLang(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="en">Anglais</option>
            <option value="fr">Français</option>
            <option value="ht">Créole Haïtien</option>
          </select>
          {summary && (
            <button 
              onClick={handleDownloadSummary} 
              className="p-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
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
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500">
          <p className="mb-4">Générez un résumé adapté à vos besoins.</p>
          <button onClick={handleGenerateSummary} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Générer</button>
        </div>
      )}
      {isSummaryLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
          <p>Analyse du document...</p>
        </div>
      )}
      {summary && !isSummaryLoading && (
        <div className="prose prose-indigo max-w-none text-slate-700">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );

  const renderFlashcards = () => (
    <div className="h-full flex flex-col p-6 items-center">
      <div className="w-full flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="text-indigo-600" /> Flashcards
        </h3>
        {flashcards.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handleDownloadFlashcards} className="p-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg" title="Exporter pour Anki (CSV)"><Download size={18} /></button>
            <button onClick={handleShuffleFlashcards} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Mélanger"><Shuffle size={18} /></button>
            <button onClick={handleGenerateFlashcards} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Régénérer"><RefreshCw size={18} /></button>
          </div>
        )}
      </div>

      {!flashcards.length && !isFlashcardsLoading && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500">
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
         <div className="flex flex-col items-center justify-center flex-1 text-slate-500">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
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
              <div className="absolute w-full h-full backface-hidden bg-white border border-slate-200 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-2">Question</span>
                <p className="text-lg font-medium text-slate-800">{flashcards[currentCardIndex].front}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); speakText(flashcards[currentCardIndex].front); }}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-indigo-600"
                >
                  <Speaker size={18} />
                </button>
              </div>
              
              {/* Back */}
              <div className="absolute w-full h-full backface-hidden bg-indigo-600 text-white rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center text-center" style={{ transform: 'rotateY(180deg)' }}>
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
              className="p-3 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-700"/>
            </button>
            <span className="text-sm font-medium text-slate-500">
              {currentCardIndex + 1} / {flashcards.length}
            </span>
            <button 
              onClick={() => { if(currentCardIndex < flashcards.length - 1) { setCurrentCardIndex(c => c + 1); setIsFlipped(false); } }}
              disabled={currentCardIndex === flashcards.length - 1}
              className="p-3 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={24} className="text-slate-700"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderQuiz = () => (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <CheckCircle className="text-indigo-600" /> Quiz IA
      </h3>

      {showQuizSetup && !isQuizLoading && (
         <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-full space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de questions</label>
                <div className="flex gap-2">
                  {[3, 5, 10, 15].map(n => (
                    <button 
                      key={n}
                      onClick={() => setQuizConfig({...quizConfig, count: n})}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${quizConfig.count === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">Sujet / Chapitre (Optionnel)</label>
                 <input 
                   type="text"
                   className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
          <p>Génération des questions...</p>
        </div>
      )}

      {!showQuizSetup && !isQuizLoading && quizQuestions.length > 0 && !quizFinished && (
        <div className="max-w-2xl mx-auto w-full flex-1">
          <div className="mb-6 flex justify-between items-center text-sm text-slate-500 font-medium">
             <button onClick={() => setShowQuizSetup(true)} className="text-indigo-600 hover:underline">Quitter le Quiz</button>
             <span>Question {currentQuestionIndex + 1} sur {quizQuestions.length}</span>
          </div>
          
          <h4 className="text-lg font-semibold text-slate-800 mb-6">
            {quizQuestions[currentQuestionIndex].question}
          </h4>

          <div className="space-y-3">
            {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
               let btnClass = "w-full p-4 text-left rounded-xl border transition-all duration-200 ";
               if (selectedAnswer === null) {
                 btnClass += "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50";
               } else if (idx === quizQuestions[currentQuestionIndex].correctAnswerIndex) {
                 btnClass += "bg-green-100 border-green-500 text-green-800";
               } else if (selectedAnswer === idx) {
                 btnClass += "bg-red-100 border-red-500 text-red-800";
               } else {
                 btnClass += "border-slate-200 opacity-50";
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-900">
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
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
               >
                 {currentQuestionIndex === quizQuestions.length - 1 ? 'Terminer' : 'Question suivante'} <ArrowRight size={16} />
               </button>
             </div>
          )}
        </div>
      )}

      {quizFinished && (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={40} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Quiz terminé !</h3>
          <p className="text-slate-500 mb-6">Vous avez obtenu <span className="font-bold text-indigo-600 text-xl">{quizScore}</span> sur {quizQuestions.length}</p>
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

  const renderDeepDive = () => (
    <div className="h-full flex flex-col p-6 overflow-hidden">
       <div className="flex gap-4 border-b border-slate-200 mb-4 pb-1">
         <button onClick={() => setActiveDeepDiveTab('mindmap')} className={`pb-2 px-1 text-sm font-medium ${activeDeepDiveTab === 'mindmap' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Carte mentale</button>
         <button onClick={() => setActiveDeepDiveTab('strategy')} className={`pb-2 px-1 text-sm font-medium ${activeDeepDiveTab === 'strategy' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Analyse stratégique</button>
         <button onClick={() => setActiveDeepDiveTab('citations')} className={`pb-2 px-1 text-sm font-medium ${activeDeepDiveTab === 'citations' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Citations clés</button>
       </div>

       <div className="flex-1 overflow-y-auto">
         {isDeepDiveLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
               <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
               <p>Analyse approfondie en cours...</p>
            </div>
         ) : (
            <>
               {activeDeepDiveTab === 'mindmap' && mindMap && (
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[300px]">
                    <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Layers size={20} className="text-indigo-600"/> Structure du document</h4>
                    {renderMindMapNode(mindMap)}
                 </div>
               )}
               {activeDeepDiveTab === 'strategy' && strategicAnalysis && (
                 <div className="prose prose-indigo max-w-none bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                   <ReactMarkdown>{strategicAnalysis}</ReactMarkdown>
                 </div>
               )}
               {activeDeepDiveTab === 'citations' && keyCitations && (
                 <div className="space-y-4">
                   {keyCitations.map((cit, i) => (
                     <div key={i} className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                       <Quote className="text-indigo-300 mb-2" size={24} />
                       <p className="text-lg font-medium text-indigo-900 italic mb-3">"{cit.text}"</p>
                       <div className="flex justify-between items-center text-sm">
                         <span className="font-bold text-indigo-700">{cit.author || "Source"}</span>
                         <span className="text-indigo-500">{cit.context}</span>
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
    <div className="h-full flex flex-col p-6 overflow-hidden">
       <div className="flex justify-between items-center border-b border-slate-200 mb-4 pb-1">
         <div className="flex gap-4">
            <button onClick={() => setActiveResourceTab('guide')} className={`pb-2 px-1 text-sm font-medium ${activeResourceTab === 'guide' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Guide d'étude</button>
            <button onClick={() => setActiveResourceTab('faq')} className={`pb-2 px-1 text-sm font-medium ${activeResourceTab === 'faq' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>FAQ</button>
            <button onClick={() => setActiveResourceTab('methodology')} className={`pb-2 px-1 text-sm font-medium ${activeResourceTab === 'methodology' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Méthodologie</button>
         </div>
         {(activeResourceTab === 'guide' || activeResourceTab === 'faq') && (
            <button 
              onClick={handleDownloadResources} 
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
              title="Télécharger"
            >
              <Download size={16} />
            </button>
         )}
       </div>

       <div className="flex-1 overflow-y-auto">
         {isResourcesLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
               <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
               <p>Compilation des ressources...</p>
            </div>
         ) : (
            <>
               {activeResourceTab === 'guide' && studyGuide && (
                 <div className="prose prose-indigo max-w-none bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                   <ReactMarkdown>{studyGuide}</ReactMarkdown>
                 </div>
               )}
               {activeResourceTab === 'faq' && faq && (
                 <div className="space-y-4">
                   {faq.map((item, i) => (
                     <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                       <h5 className="font-bold text-indigo-900 mb-2 flex items-start gap-2">
                         <HelpCircle size={18} className="mt-1 shrink-0" /> {item.question}
                       </h5>
                       <p className="text-slate-700 ml-6">{item.answer}</p>
                     </div>
                   ))}
                 </div>
               )}
               {activeResourceTab === 'methodology' && (
                 <div className="prose prose-indigo max-w-none bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
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
    <div className="flex h-screen bg-slate-50 relative">
      {/* Context Menu Overlay */}
      {contextMenu.show && (
        <div 
          className="custom-context-menu fixed z-50 bg-white shadow-xl rounded-lg border border-slate-200 py-1 px-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              handleExplainConcept(contextMenu.text);
              setContextMenu({ ...contextMenu, show: false });
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
          >
            <Lightbulb size={16} />
            Expliquer "{contextMenu.text.length > 15 ? contextMenu.text.substring(0, 15) + '...' : contextMenu.text}"
          </button>
          <button 
            onClick={() => {
              speakText(contextMenu.text);
              setContextMenu({ ...contextMenu, show: false });
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-md cursor-pointer transition-colors"
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
           className="fixed top-20 right-4 z-40 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-64"
        >
           <div className="flex justify-between items-center mb-3">
             <h4 className="font-bold text-slate-800 flex items-center gap-2"><Timer size={18} className="text-indigo-600"/> Mode Concentration</h4>
             <button onClick={() => setShowFocusTimer(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
           </div>
           
           {timerMessage ? (
             <div className="mb-4 p-3 bg-indigo-50 text-indigo-700 text-sm text-center rounded-lg font-medium animate-pulse">
               {timerMessage}
             </div>
           ) : (
             <div className="flex justify-center mb-4">
                <div className={`text-4xl font-mono font-bold tracking-wider ${focusState.mode === 'focus' ? 'text-indigo-600' : 'text-green-600'}`}>
                  {formatTime(focusState.time)}
                </div>
             </div>
           )}

           <div className="flex gap-2 mb-4">
             <button 
                onClick={() => setFocusMode('focus')}
                className={`flex-1 text-xs py-1 rounded font-medium ${focusState.mode === 'focus' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
             >
               Travail
             </button>
             <button 
                onClick={() => setFocusMode('break')}
                className={`flex-1 text-xs py-1 rounded font-medium ${focusState.mode === 'break' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-100'}`}
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
               className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
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
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h3 className="font-bold text-lg text-indigo-900 flex items-center gap-2">
                <Lightbulb size={20} /> Concept : {explainerOverlay.term}
              </h3>
              <button onClick={() => setExplainerOverlay({show: false, term: '', text: null})} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6">
               {!explainerOverlay.text ? (
                 <div className="flex flex-col items-center py-8 text-slate-500">
                   <Loader2 className="animate-spin w-8 h-8 mb-2 text-indigo-600"/>
                   <p>Consultation de l'IA...</p>
                 </div>
               ) : (
                 <div className="prose prose-sm prose-indigo"><ReactMarkdown>{explainerOverlay.text}</ReactMarkdown></div>
               )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Back Button & Header (Mobile mostly, but useful) */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b z-20 flex items-center justify-between px-4 md:hidden">
         <div className="flex items-center">
            <button onClick={onBack} className="p-2 mr-2"><ArrowLeft size={20}/></button>
            <span className="font-semibold truncate max-w-[150px]">{doc.name}</span>
         </div>
         <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50">
           <Trash2 size={20} />
         </button>
      </div>

      {/* PDF Viewer - Left Side (Hidden on mobile when tab is active, or use tabs) */}
      <div className="hidden md:flex flex-col w-1/2 h-full border-r border-slate-200 bg-slate-100 pt-16 md:pt-0">
         <div className="h-14 border-b bg-white flex items-center px-4 justify-between z-20 shadow-sm relative">
            <button onClick={onBack} className="flex items-center text-slate-600 hover:text-slate-900 text-sm font-medium">
              <ArrowLeft size={16} className="mr-2" /> Retour
            </button>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
               <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 rounded-md hover:bg-white text-slate-600"><ZoomOut size={16} /></button>
               <span className="text-xs font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
               <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="p-1.5 rounded-md hover:bg-white text-slate-600"><ZoomIn size={16} /></button>
            </div>
            
            <div className="flex items-center gap-2">
                <button 
                   onClick={handleReadCurrentPage}
                   className={`p-1.5 rounded-lg transition-colors ${isReading ? 'bg-red-50 text-red-600 animate-pulse' : 'hover:bg-slate-100 text-slate-500'}`}
                   title={isReading ? "Arrêter" : "Lire la page"}
                >
                  {isReading ? <StopCircle size={18} /> : <Volume2 size={18} />}
                </button>
                <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><RotateCw size={18} /></button>
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                <button onClick={previousPage} disabled={pageNumber <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30"><ChevronLeft size={18} /></button>
                <span className="text-sm font-medium text-slate-600 w-16 text-center">{pageNumber} / {numPages || '-'}</span>
                <button onClick={nextPage} disabled={pageNumber >= numPages} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30"><ChevronRight size={18} /></button>
                <div className="h-4 w-px bg-slate-300 mx-1"></div>
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Supprimer">
                  <Trash2 size={18} />
                </button>
            </div>
         </div>
         
         <div 
           ref={pdfContainerRef}
           className="flex-1 bg-slate-200 overflow-auto relative flex justify-center p-4 md:p-8"
         >
           <PdfDocument
              file={doc.base64Data}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-400" size={32} /></div>}
              className="shadow-xl"
           >
              <PdfPage pageNumber={pageNumber} scale={scale} rotate={rotation} className="bg-white" renderTextLayer={true} renderAnnotationLayer={false}/>
           </PdfDocument>
         </div>
      </div>

      {/* AI Tools - Right Side */}
      <div className="w-full md:w-1/2 h-full flex flex-col bg-white pt-14 md:pt-0">
        
        {/* Tool Navigation */}
        <div className="h-14 border-b flex items-center px-2 overflow-x-auto no-scrollbar justify-between">
           <div className="flex items-center">
             <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'chat' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <Brain size={18} /> Chat
             </button>
             <button onClick={() => setActiveTab('summary')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'summary' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <FileText size={18} /> Résumé
             </button>
             <button onClick={() => setActiveTab('flashcards')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'flashcards' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <BookOpen size={18} /> Cartes
             </button>
             <button onClick={() => setActiveTab('quiz')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'quiz' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <CheckCircle size={18} /> Quiz
             </button>
             <button onClick={() => setActiveTab('deep_dive')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'deep_dive' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <Target size={18} /> Analyse
             </button>
             <button onClick={() => setActiveTab('resources')} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'resources' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <GraduationCap size={18} /> Ressources
             </button>
           </div>
           
           {/* Focus Mode Toggle */}
           <button 
             onClick={() => setShowFocusTimer(!showFocusTimer)}
             className={`p-2 rounded-lg transition-colors mr-2 ${showFocusTimer ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
             title="Mode Concentration"
           >
             <Timer size={20} />
           </button>
        </div>

        {/* Tool Content */}
        <div className="flex-1 overflow-hidden relative">
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
                {activeTab === 'resources' && renderResources()}
             </motion.div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Workspace;