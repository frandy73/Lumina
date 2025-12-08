import React, { useState, useEffect } from 'react';
import { User, Document, AppView, AnalyticsData } from './types';
import Workspace from './components/Workspace';
import { getAllDocuments, saveDocument, deleteDocument, clearAllData } from './services/storageService';
import { LayoutDashboard, FolderOpen, LogOut, UploadCloud, Plus, File as FileIcon, Trash2, BarChart2, Zap, Search, Loader2, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';

// Mock Data
const MOCK_USER: User = { id: 'u1', name: 'Student Demo', email: 'student@example.com' };

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Analytics State
  const [stats, setStats] = useState<AnalyticsData>({
    totalDocs: 0,
    totalFlashcardsGenerated: 0,
    quizzesTaken: 0,
    averageScore: 0,
    recentActivity: []
  });

  // Load from IndexedDB on mount
  useEffect(() => {
    const loadDocs = async () => {
      setIsLoading(true);
      try {
        const storedDocs = await getAllDocuments();
        setDocuments(storedDocs);
        
        // Recalculate basic stats based on loaded docs
        setStats(prev => ({
          ...prev,
          totalDocs: storedDocs.length,
          // In a real app we'd aggregate these from doc properties, 
          // for now we just update the count.
        }));
      } catch (error) {
        console.error("Failed to load documents:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (view !== AppView.AUTH) {
      loadDocs();
    }
  }, [view]);

  // Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setUser(MOCK_USER);
    setView(AppView.DASHBOARD);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Please upload a PDF file.");
        return;
      }
      // Increased limit because IndexedDB can handle it, but keep reasonable for browser performance
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        alert("File size exceeds 25MB limit.");
        return;
      }

      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const newDoc: Document = {
          id: Date.now().toString(),
          name: file.name,
          size: file.size,
          type: file.type,
          uploadDate: new Date().toLocaleDateString(),
          base64Data: base64,
          chatHistory: []
        };
        
        try {
          await saveDocument(newDoc); // Save to DB
          setDocuments(prev => [newDoc, ...prev]);
          setStats(prev => ({
            ...prev, 
            totalDocs: prev.totalDocs + 1,
            recentActivity: [{ action: 'Uploaded', time: 'Just now', docName: file.name }, ...prev.recentActivity]
          }));
        } catch (error) {
          console.error("Failed to save document:", error);
          alert("Failed to save document to storage.");
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document and all its data?")) return;
    
    try {
      await deleteDocument(id); // Remove from DB
      setDocuments(prev => prev.filter(d => d.id !== id));
      setStats(prev => ({ ...prev, totalDocs: prev.totalDocs - 1 }));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleDeleteActiveDoc = async () => {
    if (!activeDoc) return;
    if (!confirm(`Are you sure you want to delete "${activeDoc.name}"? This cannot be undone.`)) return;

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
    if (!confirm("⚠️ WARNING: This will delete ALL documents, chat history, and flashcards permanently from your browser storage.\n\nAre you sure?")) return;
    
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
      alert("Storage cleared successfully.");
    } catch (e) {
      console.error("Failed to clear data:", e);
      alert("Failed to clear data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDocument = async (updatedDoc: Document) => {
    // Update local state
    setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    setActiveDoc(updatedDoc);
    
    // Persist to DB
    try {
      await saveDocument(updatedDoc);
    } catch (error) {
      console.error("Failed to update document persistence:", error);
    }
  };

  const openDocument = (doc: Document) => {
    setActiveDoc(doc);
    setView(AppView.WORKSPACE);
  };

  const updateStats = (type: 'flashcard' | 'quiz', count: number) => {
    setStats(prev => {
       const newActivity = [...prev.recentActivity];
       if (type === 'flashcard') {
         newActivity.unshift({ action: 'Generated Flashcards', time: 'Just now', docName: activeDoc?.name || 'Doc' });
         return { ...prev, totalFlashcardsGenerated: prev.totalFlashcardsGenerated + count, recentActivity: newActivity.slice(0, 5) };
       } else {
         newActivity.unshift({ action: 'Completed Quiz', time: 'Just now', docName: activeDoc?.name || 'Doc' });
         return { ...prev, quizzesTaken: prev.quizzesTaken + count, recentActivity: newActivity.slice(0, 5) };
       }
    });
  };

  // --- Views ---

  const AuthView = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
             <Zap className="text-indigo-600 w-8 h-8" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Lumina</h1>
          <p className="text-slate-500 mt-2">AI-Powered Learning Assistant</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="student@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="••••••••" />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Mock Login - Enter anything to continue</p>
      </div>
    </div>
  );

  const DashboardView = () => {
    const chartData = [
      { name: 'Docs', value: stats.totalDocs },
      { name: 'Cards', value: stats.totalFlashcardsGenerated },
      { name: 'Quizzes', value: stats.quizzesTaken },
    ];

    return (
      <div className="p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Welcome back, {user?.name}</h2>
          <p className="text-slate-500">Here is your learning progress.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
             <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileIcon size={24} /></div>
             <div><p className="text-sm text-slate-500">Documents</p><p className="text-2xl font-bold text-slate-800">{stats.totalDocs}</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
             <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Zap size={24} /></div>
             <div><p className="text-sm text-slate-500">Flashcards</p><p className="text-2xl font-bold text-slate-800">{stats.totalFlashcardsGenerated}</p></div>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
             <div className="p-3 bg-green-50 text-green-600 rounded-xl"><BarChart2 size={24} /></div>
             <div><p className="text-sm text-slate-500">Quizzes Taken</p><p className="text-2xl font-bold text-slate-800">{stats.quizzesTaken}</p></div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80">
              <h3 className="font-semibold text-slate-800 mb-4">Activity Overview</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
           </div>
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-80 overflow-y-auto">
              <h3 className="font-semibold text-slate-800 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {stats.recentActivity.length === 0 && <p className="text-slate-400 text-sm">No activity yet.</p>}
                {stats.recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                    <span className="font-medium text-slate-700">{act.action}</span>
                    <span className="text-slate-500">on {act.docName}</span>
                    <span className="text-slate-400 ml-auto text-xs">{act.time}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    );
  };

  const LibraryView = () => {
    const filteredDocs = documents.filter(doc => 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Your Documents</h2>
            <p className="text-slate-500">Upload PDFs to start learning. Saved locally on your device.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                  type="text" 
                  placeholder="Search documents..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
               />
            </div>
            <label className={`flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer shadow-md whitespace-nowrap ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
              <span>{isLoading ? 'Saving...' : 'Upload PDF'}</span>
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} disabled={isLoading} />
            </label>
          </div>
        </div>

        {documents.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-slate-500">
             <UploadCloud size={48} className="mb-4 text-slate-400" />
             <p className="text-lg font-medium">No documents yet</p>
             <p className="text-sm">Upload a PDF to get started</p>
          </div>
        ) : filteredDocs.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
             <Search size={32} className="mb-2 opacity-50" />
             <p>No documents found matching "{searchQuery}"</p>
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
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-red-50 text-red-500 rounded-xl">
                    <FileIcon size={24} />
                  </div>
                  <button 
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-semibold text-slate-800 truncate mb-1" title={doc.name}>{doc.name}</h3>
                <p className="text-xs text-slate-500">{doc.uploadDate} • {(doc.size / 1024 / 1024).toFixed(2)} MB</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (view === AppView.AUTH) return <AuthView />;
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
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Zap fill="currentColor" /> Lumina
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setView(AppView.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === AppView.DASHBOARD ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setView(AppView.LIBRARY)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${view === AppView.LIBRARY ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FolderOpen size={20} /> My Documents
          </button>
        </nav>
        <div className="p-6 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
               {user?.name.charAt(0)}
             </div>
             <div className="overflow-hidden">
               <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
               <p className="text-xs text-slate-400 truncate">{user?.email}</p>
             </div>
          </div>
          
          <button onClick={handleClearAllData} className="w-full flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
             <Database size={16} /> Clear Storage
          </button>

          <button onClick={() => setView(AppView.AUTH)} className="w-full flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 p-2 rounded-lg transition-colors">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white border-b flex items-center justify-between px-4 sticky top-0 z-10">
           <div className="font-bold text-lg text-indigo-600 flex items-center gap-2"><Zap fill="currentColor"/> Lumina</div>
           <div className="flex gap-4">
             <button onClick={() => setView(AppView.DASHBOARD)} className={view === AppView.DASHBOARD ? 'text-indigo-600' : 'text-slate-400'}><LayoutDashboard size={24}/></button>
             <button onClick={() => setView(AppView.LIBRARY)} className={view === AppView.LIBRARY ? 'text-indigo-600' : 'text-slate-400'}><FolderOpen size={24}/></button>
           </div>
        </div>

        {view === AppView.DASHBOARD && <DashboardView />}
        {view === AppView.LIBRARY && <LibraryView />}
      </main>
    </div>
  );
};

export default App;