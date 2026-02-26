import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Dumbbell, 
  Sun, 
  Apple, 
  Ban, 
  BookOpen, 
  Droplets, 
  Check, 
  Plus, 
  Users, 
  CheckCircle2,
  Share2,
  Trash2,
  Layout,
  Loader2,
  AlertCircle
} from 'lucide-react';

// --- Firebase Configuration ---

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDpsj_G_6CyW1Uqn6iLcmgZDNx28IqobmQ",
  authDomain: "accountability-app-3d90e.firebaseapp.com",
  projectId: "accountability-app-3d90e",
  storageBucket: "accountability-app-3d90e.firebasestorage.app",
  messagingSenderId: "777873226568",
  appId: "1:777873226568:web:a399ccce28e022a495517d",
  measurementId: "G-S6XZCW0T10"
};

// const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'accountability-app-3d90e'

// --- Constants ---
const ICON_MAP = {
  workout: Dumbbell,
  sun: Sun,
  diet: Apple,
  no_alcohol: Ban,
  read: BookOpen,
  water: Droplets,
  default: Layout
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [view, setView] = useState('landing'); // landing, session
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [error, setError] = useState(null);

  // --- Auth Logic ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setError("Connection failed. Please refresh.");
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Sync ---
  useEffect(() => {
    if (!user || !activeSession) return;

    const sessionDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', activeSession);
    
    const unsubscribe = onSnapshot(sessionDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setSessionData(snapshot.data());
      } else {
        // Only kick to landing if we were already in a session and it was deleted
        if (view === 'session' && sessionData) {
          setActiveSession(null);
          setView('landing');
          setSessionData(null);
        }
      }
    }, (err) => {
      console.error("Firestore Error:", err);
      setError("Lost connection to the session.");
    });

    return () => unsubscribe();
  }, [user, activeSession, view]);

  // Handle URL Join
  useEffect(() => {
    if (user && !activeSession) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('session');
      if (code) {
        handleJoinSession(code);
      }
    }
  }, [user]);

  const createSession = async () => {
    if (!user || isCreating) return;
    setIsCreating(true);
    setError(null);

    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', newId);
    
    const initialData = {
      id: newId,
      createdAt: Date.now(),
      tasks: [
        { id: '1', title: 'First Workout', completed: false, icon: 'workout' },
        { id: '2', title: 'Second Workout', completed: false, icon: 'sun' },
        { id: '3', title: 'Healthy Diet', completed: false, icon: 'diet' },
        { id: '4', title: 'No Alcohol', completed: false, icon: 'no_alcohol' },
        { id: '5', title: 'Read 10 pages', completed: false, icon: 'read' },
        { id: '6', title: 'Drink water', completed: false, icon: 'water' },
      ]
    };

    try {
      await setDoc(sessionRef, initialData);
      // Wait a tiny bit to ensure Firestore propagates
      setTimeout(() => {
        setActiveSession(newId);
        setView('session');
        setIsCreating(false);
      }, 100);
    } catch (err) {
      console.error("Create session error:", err);
      setError("Failed to create session. Try again.");
      setIsCreating(false);
    }
  };

  const handleJoinSession = async (code) => {
    if (!user) return;
    const targetCode = (code || sessionIdInput).toUpperCase().trim();
    if (!targetCode) return;
    
    setError(null);
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', targetCode);
    try {
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        setActiveSession(targetCode);
        setView('session');
      } else {
        if (!code) setError("Session not found.");
      }
    } catch (err) {
      console.error("Join error:", err);
      setError("Could not join session.");
    }
  };

  const toggleTask = async (taskId) => {
    if (!user || !sessionData || !activeSession) return;
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', activeSession);
    const updatedTasks = sessionData.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    await updateDoc(sessionRef, { tasks: updatedTasks });
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim() || !activeSession) return;
    
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', activeSession);
    const newTask = {
      id: Date.now().toString(),
      title: newTaskTitle,
      completed: false,
      icon: 'default'
    };
    
    await updateDoc(sessionRef, {
      tasks: arrayUnion(newTask)
    });
    setNewTaskTitle('');
  };

  const deleteTask = async (taskId) => {
    if (!user || !activeSession) return;
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', activeSession);
    const taskToDelete = sessionData.tasks.find(t => t.id === taskId);
    if (taskToDelete) {
      await updateDoc(sessionRef, {
        tasks: arrayRemove(taskToDelete)
      });
    }
  };

  const copySessionLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?session=${activeSession}`;
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const completedCount = sessionData?.tasks.filter(t => t.completed).length || 0;
  const totalCount = sessionData?.tasks.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans selection:bg-white/20">
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 mb-2 rounded-2xl bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 shadow-xl">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              Elevate
            </h1>
            <p className="text-gray-400 font-medium">Daily collaborative accountability.</p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-in zoom-in-95">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button 
              onClick={createSession}
              disabled={authLoading || isCreating}
              className="w-full py-4 bg-white text-white font-bold rounded-2xl hover:bg-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreating || authLoading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              {isCreating ? 'Creating Session...' : authLoading ? 'Connecting...' : 'Start New Day'}
            </button>
            
            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-gray-600 text-[10px] tracking-[0.2em] font-black uppercase">OR JOIN PARTNER</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Session Code"
                value={sessionIdInput}
                onChange={(e) => {
                  setSessionIdInput(e.target.value.toUpperCase());
                  setError(null);
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 uppercase text-center font-mono tracking-widest transition-all"
              />
              <button 
                onClick={() => handleJoinSession()}
                disabled={authLoading || isCreating || !sessionIdInput}
                className="px-6 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans p-4 pb-24 md:p-8 animate-in fade-in duration-500 selection:bg-white/20">
      <div className="max-w-xl mx-auto space-y-6">
        
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <CheckCircle2 className="text-white" size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Today's Progress</h2>
              <p className="text-[10px] text-gray-500 font-mono font-bold tracking-widest uppercase">Room: {activeSession}</p>
            </div>
          </div>
          <button 
            onClick={copySessionLink}
            className={`p-3 rounded-2xl transition-all shadow-xl ${copyFeedback ? 'bg-green-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5 active:scale-90'}`}
          >
            {copyFeedback ? <Check size={22} /> : <Share2 size={22} />}
          </button>
        </header>

        <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 p-8 shadow-2xl backdrop-blur-3xl">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-3xl font-bold mb-2">Goals</h3>
              <p className="text-gray-400 text-sm font-medium">
                {totalCount === 0 ? "Add your first goal below!" : progressPercent === 100 ? "Level Complete! 🏆" : "Stay focused, you've got this."}
              </p>
            </div>
            <div className="relative w-20 h-20">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="40" cy="40" r="36"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="6"
                />
                <circle
                  cx="40" cy="40" r="36"
                  fill="transparent"
                  stroke="white"
                  strokeWidth="6"
                  strokeDasharray={226.2}
                  strokeDashoffset={226.2 - (226.2 * progressPercent) / 100}
                  className="transition-all duration-1000 ease-out"
                  style={{ strokeLinecap: 'round' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-black tracking-tighter">
                {completedCount}/{totalCount}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sessionData?.tasks.map((task) => {
              const Icon = ICON_MAP[task.icon] || ICON_MAP.default;
              return (
                <div 
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`group relative flex items-center gap-4 p-1.5 pr-5 rounded-full transition-all duration-500 cursor-pointer border shadow-lg ${
                    task.completed 
                    ? 'bg-white border-white scale-[1.02] shadow-white/10' 
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20 active:scale-95'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                    task.completed ? 'bg-black text-white' : 'bg-white/10 text-gray-400'
                  }`}>
                    <Icon size={20} />
                  </div>
                  <span className={`flex-1 text-sm font-bold truncate tracking-tight transition-colors duration-500 ${task.completed ? 'text-black' : 'text-gray-300'}`}>
                    {task.title}
                  </span>
                  {task.completed ? (
                    <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                      <Check size={14} className="text-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-white/30 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-white/0 group-hover:bg-white/10 transition-colors"></div>
                    </div>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                    className="absolute -right-2 opacity-0 group-hover:opacity-100 transition-all bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full scale-50 group-hover:scale-90 shadow-xl"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={addTask} className="mt-10 pt-8 border-t border-white/10">
            <div className="flex gap-3">
              <input 
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Next mission..."
                className="flex-1 bg-white/5 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder:text-gray-600 border border-transparent focus:border-white/10 transition-all"
              />
              <button 
                type="submit"
                className="bg-white text-black px-6 rounded-2xl hover:bg-gray-200 active:scale-90 transition-all flex items-center justify-center flex-shrink-0 shadow-xl shadow-white/5"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 flex items-center gap-5 shadow-inner">
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-4 rounded-2xl text-blue-400 border border-blue-500/10">
            <Users size={28} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-lg">Live Partners</h4>
            <p className="text-xs text-gray-500 font-medium">Synced with your accountability crew.</p>
          </div>
          <div className="flex -space-x-3">
            <div className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-black shadow-lg">ME</div>
            <div className="w-10 h-10 rounded-full border-2 border-black bg-white/5 border-dashed flex items-center justify-center text-[10px] font-black text-gray-600 animate-pulse">??</div>
          </div>
        </div>

        <button 
          onClick={() => { setView('landing'); setActiveSession(null); setSessionData(null); }}
          className="w-full py-4 text-gray-600 hover:text-white transition-all text-xs font-black tracking-widest uppercase"
        >
          Disconnect Session
        </button>
      </div>
    </div>
  );
};

export default App;