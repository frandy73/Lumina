import React, { useState, useEffect } from 'react';
import { User, Document, AppView, AnalyticsData } from './types';
import Workspace from './components/Workspace';
import { getAllDocuments, saveDocument, deleteDocument, clearAllData, loadDocumentFile } from './services/storageService';
import { supabase } from './services/supabaseClient';
import { LayoutDashboard, FolderOpen, LogOut, UploadCloud, Plus, File as FileIcon, Trash2, BarChart2, Zap, Search, Loader2, Database, UserPlus, LogIn, AlertCircle, Smartphone, Moon, Sun, Crown, CheckCircle2, MessageCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';

// Polyfill/Fallback for UUID
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// CONFIGURATION WHATSAPP
const WHATSAPP_NUMBER = "50937944651"; // REMPLACER PAR VOTRE NUMÉRO (ex: 50936000000)

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningDoc, setIsOpeningDoc] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  // Auth State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Analytics State
  const [stats, setStats] = useState<AnalyticsData>({
    totalDocs: 0,
    totalFlashcardsGenerated: 0,
    quizzesTaken: 0,
    averageScore: 0,
    recentActivity: []
  });

  // Check Session on Mount
  useEffect(() => {
    const initSession = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUser({ 
                    id: session.user.id, 
                    email: session.user.email!, 
                    name: session.user.user_metadata.full_name || session.user.email!.split('@')[0] 
                });
                setView(AppView.DASHBOARD);
            }
        } catch (e) {
            console.error("Session init error:", e);
        }
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser({ 
            id: session.user.id, 
            email: session.user.email!, 
            name: session.user.user_metadata.full_name || session.user.email!.split('@')[0] 
        });
        if (view === AppView.AUTH) {
            setView(AppView.DASHBOARD);
        }
      } else {
        setUser(null);
        setView(AppView.AUTH);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Remove dependency on 'view' to prevent loop

  // Load Documents when View changes (and user exists)
  useEffect(() => {
    const loadDocs = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const storedDocs = await getAllDocuments();
        setDocuments(storedDocs);
        
        // Basic Stats
        setStats(prev => ({
          ...prev,
          totalDocs: storedDocs.length,
        }));
      } catch (error) {
        console.error("Failed to load documents:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (view !== AppView.AUTH && user) {
      loadDocs();
    }
  }, [view, user]);

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    
    try {
        if (isSignUp) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: {
                    full_name: email.split('@')[0], // Generate a default name from email
                  }
                }
            });
            if (error) throw error;
            
            // If session is null, it usually means email confirmation is required
            if (data.user && !data.session) {
                setAuthError("Compte créé ! Veuillez vérifier votre e-mail pour confirmer votre compte avant de vous connecter.");
                // Switch to login view so they can login after confirming
                setIsSignUp(false);
            } else {
                // Auto-login successful
                // State update handled by onAuthStateChange listener
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        }
    } catch (err: any) {
        console.error("Auth Error:", err);
        if (err.message && err.message.includes("Invalid login credentials")) {
            setAuthError("E-mail ou mot de passe incorrect. Si vous n'avez pas encore de compte, veuillez vous inscrire.");
        } else if (err.message && (err.message.includes("Email not confirmed") || err.message.includes("Email not verified"))) {
            setAuthError("E-mail non confirmé. Veuillez vérifier votre boîte de réception ou désactiver 'Confirm Email' dans votre tableau de bord Supabase (Authentication > Providers > Email).");
        } else {
            setAuthError(err.message || "Une erreur inattendue s'est produite lors de l'authentification.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDocuments([]);
    setUser(null);
    setView(AppView.AUTH);
  };

  const handleDownloadApp = () => {
    alert("Le téléchargement de l'APK Android (version Beta) démarrera bientôt !");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      if (file.type !== 'application/pdf') {
        alert("Veuillez télécharger un fichier PDF.");
        return;
      }
      if (file.size > 25 * 1024 * 1024) { 
        alert("La taille du fichier dépasse la limite de 25 Mo.");
        return;
      }

      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        // Generate a UUID for the document ID with fallback
        const docId = generateId();

        const newDoc: Document = {
          id: docId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadDate: new Date().toLocaleDateString(),
          base64Data: base64,
          chatHistory: []
        };
        
        try {
          await saveDocument(newDoc); // Save to Supabase
          // For local state update immediately after upload, we keep the base64
          setDocuments(prev => [newDoc, ...prev]);
          setStats(prev => ({
            ...prev, 
            totalDocs: prev.totalDocs + 1,
            recentActivity: [{ action: 'Téléchargé', time: "À l'instant", docName: file.name }, ...prev.recentActivity]
          }));
        } catch (error: any) {
          console.error("Failed to save document:", error);
          alert(`Échec du téléchargement : ${error.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;
    
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setStats(prev => ({ ...prev, totalDocs: prev.totalDocs - 1 }));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleDeleteActiveDoc = async () => {
    if (!activeDoc) return;
    // Native confirm removed here, handled by Workspace modal
    
    try {
      await deleteDocument(activeDoc.id);
      setDocuments(prev => prev.filter(d => d.id !== activeDoc!.id));
      setStats(prev => ({ ...prev, totalDocs: prev.totalDocs - 1 }));
      setActiveDoc(null);
      setView(AppView.LIBRARY);
    } catch (error) {
      console.error("Failed to delete active document:", error);
      alert("Failed to delete document.");
    }
  };

  const handleClearAllData = async () => {
    if (!confirm("⚠️ ATTENTION : Cela supprimera définitivement TOUS vos documents du cloud.\n\nÊtes-vous sûr ?")) return;
    
    setIsLoading(true);
    try {
      await clearAllData();
      setDocuments([]);
      setStats({
        totalDocs: 0,
        totalFlashcardsGenerated: 0,
        quizzesTaken: 0,
        averageScore: 0,
        recentActivity: []
      });
      setView(AppView.DASHBOARD);
      alert("Stockage cloud effacé avec succès.");
    } catch (e) {
      console.error("Failed to clear data:", e);
      alert("Échec de l'effacement des données.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDocument = async (updatedDoc: Document) => {
    setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    setActiveDoc(updatedDoc);
    
    // Debounce updates in a real app, but here we just save
    try {
      await saveDocument(updatedDoc);
    } catch (error) {
      console.error("Failed to update document persistence:", error);
    }
  };

  const openDocument = async (doc: Document) => {
    // If the document already has data (e.g. just uploaded), open it directly
    if (doc.base64Data) {
      setActiveDoc(doc);
      setView(AppView.WORKSPACE);
      return;
    }

    if (!doc.file_path) {
      alert("Erreur : Le chemin du fichier est manquant pour ce document.");
      return;
    }

    // Otherwise, fetch the PDF content from storage
    setIsOpeningDoc(true);
    try {
      const content = await loadDocumentFile(doc.file_path);
      const fullDoc = { ...doc, base64Data: content };
      setActiveDoc(fullDoc);
      
      // Update local state so we don't fetch again this session
      setDocuments(prev => prev.map(d => d.id === doc.id ? fullDoc : d));
      
      setView(AppView.WORKSPACE);
    } catch (error) {
      console.error("Failed to load document content:", error);
      alert("Impossible de charger le fichier du document. Veuillez réessayer.");
    } finally {
      setIsOpeningDoc(false);
    }
  };

  const updateStats = (type: 'flashcard' | 'quiz', count: number) => {
    setStats(prev => {
       const newActivity = [...prev.recentActivity];
       if (type === 'flashcard') {
         newActivity.unshift({ action: 'Flashcards générées', time: "À l'instant", docName: activeDoc?.name || 'Doc' });
         return { ...prev, totalFlashcardsGenerated: prev.totalFlashcardsGenerated + count, recentActivity: newActivity.slice(0, 5) };
       } else {
         newActivity.unshift({ action: 'Quiz terminé', time: "À l'instant", docName: activeDoc?.name || 'Doc' });
         return { ...prev, quizzesTaken: prev.quizzesTaken + count, recentActivity: newActivity.slice(0, 5) };
       }
    });
  };

  // --- Views ---

  const renderSubscriptionView = () => {
    const benefits = [
        "Documents PDF illimités",
        "Modèle IA avancé (Plus rapide)",
        "Génération de Quiz & Flashcards illimités",
        "Support technique prioritaire",
        "Accès aux nouvelles fonctionnalités en avant-première",
        "Analyse approfondie de documents"
    ];

    const message = encodeURIComponent(`Bonjour, je suis intéressé par l'abonnement Lumina Premium à 1000 Gourdes. Mon email est: ${user?.email}`);
    const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

    return (
        <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Passez au niveau supérieur 🚀</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                    Débloquez tout le potentiel de Lumina pour booster vos études et votre productivité.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-w-md w-full relative transition-colors">
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Lumina Premium</h3>
                            <span className="inline-block mt-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full uppercase tracking-wider">
                                Recommandé
                            </span>
                        </div>
                        <Crown className="text-yellow-500 w-10 h-10" fill="currentColor" />
                    </div>

                    <div className="mb-8">
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">1000 Gdes</span>
                            <span className="text-slate-500 dark:text-slate-400 font-medium">/ mois</span>
                        </div>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Paiement via MonCash ou Virement</p>
                    </div>

                    <ul className="space-y-4 mb-8">
                        {benefits.map((benefit, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                <span className="text-slate-700 dark:text-slate-300 text-sm">{benefit}</span>
                            </li>
                        ))}
                    </ul>

                    <a 
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-center flex items-center justify-center gap-2 transition-all hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                        <MessageCircle size={20} fill="currentColor" className="text-white" />
                        Contacter le vendeur (WhatsApp)
                    </a>
                    
                    <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
                        Activation rapide après confirmation du paiement.
                    </p>
                </div>
            </div>
        </div>
    );
  };

  const renderAuthView = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-900 dark:to-purple-900 p-4 transition-colors">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md transition-colors">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
             <Zap className="text-indigo-600 dark:text-indigo-400 w-8 h-8" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Lumina</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Assistant d'apprentissage IA</p>
        </div>
        
        {authError && (
            <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${authError.includes('Compte créé') ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'}`}>
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p>{authError}</p>
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
            <input 
                type="email" 
                required 
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700 dark:text-white transition-colors" 
                placeholder="etudiant@exemple.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mot de passe</label>
            <input 
                type="password" 
                required 
                minLength={6}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-slate-700 dark:text-white transition-colors" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button 
             type="submit" 
             disabled={isLoading}
             className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />)}
            {isSignUp ? 'Créer un compte' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 text-center">
             <p className="text-sm text-slate-600 dark:text-slate-400">
                 {isSignUp ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}
                 <button 
                    onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
                    className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline focus:outline-none"
                 >
                     {isSignUp ? "Se connecter" : "S'inscrire"}
                 </button>
             </p>
        </div>
      </div>
    </div>
  );

  const renderDashboardView = () => {
    const chartData = [
      { name: 'Docs', value: stats.totalDocs },
      { name: 'Cartes', value: stats.totalFlashcardsGenerated },
      { name: 'Quiz', value: stats.quizzesTaken },
    ];

    return (
      <div className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Ravi de vous revoir, {user?.name}</h2>
          <p className="text-slate-500 dark:text-slate-400">Voici votre progression d'apprentissage.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
             <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><FileIcon size={24} /></div>
             <div><p className="text-sm text-slate-500 dark:text-slate-400">Documents</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalDocs}</p></div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
             <div className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl"><Zap size={24} /></div>
             <div><p className="text-sm text-slate-500 dark:text-slate-400">Flashcards</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalFlashcardsGenerated}</p></div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
             <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl"><BarChart2 size={24} /></div>
             <div><p className="text-sm text-slate-500 dark:text-slate-400">Quiz terminés</p><p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.quizzesTaken}</p></div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-80 transition-colors">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Aperçu de l'activité</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: theme === 'dark' ? '#334155' : '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', color: theme === 'dark' ? '#fff' : '#000', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-80 overflow-y-auto transition-colors">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Activité récente</h3>
              <div className="space-y-4">
                {stats.recentActivity.length === 0 && <p className="text-slate-400 text-sm">Aucune activité pour le moment.</p>}
                {stats.recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{act.action}</span>
                    <span className="text-slate-500 dark:text-slate-400">sur {act.docName}</span>
                    <span className="text-slate-400 dark:text-slate-500 ml-auto text-xs">{act.time}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderLibraryView = () => {
    const filteredDocs = documents.filter(doc => 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="p-8 max-w-7xl mx-auto relative">
        {/* Loading Overlay when opening document */}
        {isOpeningDoc && (
          <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl">
             <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
             <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Téléchargement de votre document...</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Vos documents</h2>
            <p className="text-slate-500 dark:text-slate-400">Stockés en toute sécurité dans le cloud.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white transition-colors"
               />
            </div>
            <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer shadow-md whitespace-nowrap ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
              <span>{isLoading ? 'Sauvegarde...' : 'Ajouter PDF'}</span>
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={isLoading} />
            </label>
          </div>
        </div>

        {documents.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
             <UploadCloud size={48} className="mb-4 text-slate-400 dark:text-slate-500" />
             <p className="text-lg font-medium">Aucun document</p>
             <p className="text-sm">Téléchargez un PDF pour commencer</p>
          </div>
        ) : filteredDocs.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400">
             <Search size={32} className="mb-2 opacity-50" />
             <p>Aucun document trouvé pour "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map(doc => (
              <motion.div 
                key={doc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                onClick={() => openDocument(doc)}
                className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl">
                    <FileIcon size={24} />
                  </div>
                  <button 
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-white truncate mb-1" title={doc.name}>{doc.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{doc.uploadDate} • {(doc.size / 1024 / 1024).toFixed(2)} MB</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (view === AppView.AUTH) return renderAuthView();
  if (view === AppView.WORKSPACE && activeDoc) {
    return (
      <Workspace 
        document={activeDoc} 
        onBack={() => setView(AppView.LIBRARY)}
        onDelete={handleDeleteActiveDoc}
        onUpdateStats={updateStats}
        onUpdateDocument={handleUpdateDocument}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 hidden md:flex flex-col transition-colors">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 dark:text-indigo-400">
            <Zap fill="currentColor" /> Lumina
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setView(AppView.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === AppView.DASHBOARD ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <LayoutDashboard size={20} /> Tableau de bord
          </button>
          <button 
            onClick={() => setView(AppView.LIBRARY)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === AppView.LIBRARY ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <FolderOpen size={20} /> Mes documents
          </button>
          <button 
            onClick={() => setView(AppView.SUBSCRIPTION)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === AppView.SUBSCRIPTION ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <Crown size={20} className={view === AppView.SUBSCRIPTION ? 'fill-indigo-600 dark:fill-indigo-400' : ''} /> Pass Premium
          </button>
        </nav>
        <div className="p-6 border-t border-slate-100 dark:border-slate-700 space-y-2">
          
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Mode Sombre' : 'Mode Clair'}
          </button>

          <div className="flex items-center gap-3 mb-2 pt-2">
             <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
               {user?.name.charAt(0)}
             </div>
             <div className="overflow-hidden">
               <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{user?.name}</p>
               <p className="text-xs text-slate-400 truncate">{user?.email}</p>
             </div>
          </div>

          <button onClick={handleDownloadApp} className="w-full flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-2 rounded-lg transition-colors">
             <Smartphone size={16} /> App Mobile
          </button>
          
          <button onClick={handleClearAllData} className="w-full flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
             <Database size={16} /> Vider le cloud
          </button>

          <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors">
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between px-4 sticky top-0 z-10 transition-colors">
           <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><Zap fill="currentColor"/> Lumina</div>
           <div className="flex gap-4 items-center">
             <button onClick={toggleTheme} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>
             <button onClick={() => setView(AppView.DASHBOARD)} className={view === AppView.DASHBOARD ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}><LayoutDashboard size={24}/></button>
             <button onClick={() => setView(AppView.LIBRARY)} className={view === AppView.LIBRARY ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}><FolderOpen size={24}/></button>
             <button onClick={() => setView(AppView.SUBSCRIPTION)} className={view === AppView.SUBSCRIPTION ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}><Crown size={24}/></button>
           </div>
        </div>

        {view === AppView.DASHBOARD && renderDashboardView()}
        {view === AppView.LIBRARY && renderLibraryView()}
        {view === AppView.SUBSCRIPTION && renderSubscriptionView()}
      </main>
    </div>
  );
};

export default App;